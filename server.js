const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const PDFDocument = require("pdfkit"); 

const app = express();

// Configuración de Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public")); 

// ==========================================
// CONEXIÓN A LA BASE DE DATOS (Clever Cloud)
// ==========================================
const conexion = mysql.createConnection({
  host: "bbdvoph2lhsyq0fdj6vj-mysql.services.clever-cloud.com",
  user: "u0jbkflbxdybvnxa",
  password: "O48pliXsV4vKez7i9ref", 
  database: "bbdvoph2lhsyq0fdj6vj",
  port: 3306 
});

conexion.connect(function(err){
  if(err) {
    console.log("Error de conexión:", err);
  } else {
    console.log("¡Conectado a la BD de Clever Cloud exitosamente!");
  }
});

// ==========================================
// 1. SISTEMA DE USUARIOS Y ACCESO
// ==========================================

app.post("/login", (req, res) => {
    const { username, password, tipo_rol } = req.body; 
    
    const sql = "SELECT * FROM usuarios WHERE username = ? AND password = ?";
    conexion.query(sql, [username, password], (err, result) => {
        if(err) return res.status(500).json({ success: false, error: err.message });
        
        if(result.length > 0) {
            const usuario = result[0];

            // Validación de roles
            if (tipo_rol === 'cliente' && usuario.rol !== 'cliente') {
                return res.json({ success: false, mensaje: "Seleccionaste 'Cliente' pero tu cuenta es de Admin." });
            }
            if (tipo_rol === 'admin' && (usuario.rol !== 'admin' && usuario.rol !== 'superadmin')) {
                return res.json({ success: false, mensaje: "Seleccionaste 'Admin' pero no tienes permisos." });
            }

            res.json({ 
                success: true, 
                rol: usuario.rol, 
                id_usuario: usuario.id_usuario,
                cod_client: usuario.cod_client // Enviamos el código para el POS
            });
        } else {
            res.json({ success: false, mensaje: "Usuario o contraseña incorrectos" });
        }
    });
});

app.post("/registro-cliente", (req, res) => {
    const { username, password, nombre, apellido, rfc, direccion, fca_nac } = req.body;

    conexion.query("INSERT INTO usuarios (username, password, rol) VALUES (?, ?, 'cliente')", [username, password], (err, resultUser) => {
        if(err) return res.status(500).json({ success: false, error: "El usuario ya existe." });

        const id_usuario = resultUser.insertId;

        conexion.query("SELECT COALESCE(MAX(cod_client), 0) + 1 AS nextId FROM clientes", (err, rows) => {
            const cod_client = rows[0].nextId;
            
            const sqlCliente = "INSERT INTO clientes (cod_client, nombre, apellido, rfc, direccion, fca_nac, id_usuario) VALUES (?, ?, ?, ?, ?, ?, ?)";
            conexion.query(sqlCliente, [cod_client, nombre, apellido, rfc, direccion, fca_nac, id_usuario], (err, result) => {
                if(err) return res.status(500).json({ success: false, error: "Error al guardar datos." });
                
                // IMPORTANTE: Actualizamos la tabla usuarios con su nuevo cod_client
                conexion.query("UPDATE usuarios SET cod_client = ? WHERE id_usuario = ?", [cod_client, id_usuario]);
                
                res.json({ success: true, mensaje: "¡Registro exitoso! Ya puedes iniciar sesión." });
            });
        });
    });
});

// ==========================================
// 2. MANTENIMIENTO (PRODUCTOS Y PROVEEDORES)
// ==========================================

app.get("/productos", (req, res) => {
  conexion.query("SELECT * FROM productos", (err, result) => {
    if(err) return res.status(500).send(err);
    res.json(result);
  });
});

app.post("/productos", (req, res) => {
  const { codigo, nombre, precio, stock, nif } = req.body;
  const sql = "INSERT INTO productos (codigo, nombre, precio, stock, nif) VALUES (?, ?, ?, ?, ?)";
  conexion.query(sql, [codigo, nombre, precio, stock, nif], (err) => {
    if(err) res.status(500).send("Error al guardar");
    else res.send("¡Producto registrado!");
  });
});

app.get("/proveedores", (req, res) => {
    conexion.query("SELECT * FROM proveedores", (err, result) => {
        if(err) throw err;
        res.json(result);
    });
});

// ==========================================
// 3. PROCESO DE VENTAS (POS)
// ==========================================

app.post("/ventas", (req, res) => {
    const { cod_client, total, pago, cambio, carrito } = req.body;

    // 1. Crear el Ticket principal
    const sqlTicket = "INSERT INTO tickets (cod_client, total, pago, cambio, fecha) VALUES (?, ?, ?, ?, NOW())";
    conexion.query(sqlTicket, [cod_client, total, pago, cambio], (err, resultTicket) => {
        if(err) {
            console.error("Error al crear ticket:", err);
            return res.status(500).json({ success: false, error: "Error en base de datos" });
        }

        const id_ticket = resultTicket.insertId; 
        
        // 2. Preparar los detalles (productos comprados)
        const detalles = carrito.map(item => [item.codigo, cod_client, id_ticket, item.cantidad]);
        const sqlDetalles = "INSERT INTO productos_clientes (codigo, cod_client, id_ticket, cantidad) VALUES ?";
        
        conexion.query(sqlDetalles, [detalles], (err) => {
             if(err) return res.status(500).json({ error: "Error al guardar detalles" });
             
             // 3. Descontar Stock
             carrito.forEach(item => {
                 conexion.query("UPDATE productos SET stock = stock - ? WHERE codigo = ?", [item.cantidad, item.codigo]);
             });

             res.json({ success: true, id_ticket: id_ticket, mensaje: "Venta registrada" });
        });
    });
});

app.get("/historial-ventas", (req, res) => {
    const sql = `
        SELECT t.id_ticket, t.fecha, t.total, t.pago, t.cambio, c.nombre, c.apellido
        FROM tickets t
        JOIN clientes c ON t.cod_client = c.cod_client
        ORDER BY t.fecha DESC`;
    conexion.query(sql, (err, result) => {
        if(err) return res.status(500).json({ error: "Error al obtener historial" });
        res.json(result);
    });
});

// ==========================================
// 4. GENERADOR DE TICKETS PDF
// ==========================================

app.get("/ticket/:id/pdf", (req, res) => {
    const id_ticket = req.params.id;
    const sql = `
        SELECT t.id_ticket, t.fecha, t.total, t.pago, t.cambio, p.nombre, p.precio, pc.cantidad, c.nombre as cliente
        FROM tickets t
        JOIN productos_clientes pc ON t.id_ticket = pc.id_ticket
        JOIN productos p ON pc.codigo = p.codigo
        JOIN clientes c ON t.cod_client = c.cod_client
        WHERE t.id_ticket = ?`;

    conexion.query(sql, [id_ticket], (err, resultados) => {
        if (err || resultados.length === 0) return res.status(404).send("Ticket no encontrado");

        const doc = new PDFDocument({ margin: 30, size: [250, 450] }); 
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=ticket_${id_ticket}.pdf`);
        doc.pipe(res);

        doc.fontSize(14).font('Helvetica-Bold').text('FUSION FERRETERÍA', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('Ticket de Venta', { align: 'center' }).moveDown();
        doc.text(`Folio: #00${resultados[0].id_ticket}`);
        doc.text(`Cliente: ${resultados[0].cliente}`);
        doc.text(`Fecha: ${new Date(resultados[0].fecha).toLocaleString()}`);
        doc.text('-----------------------------------------', { align: 'center' });

        resultados.forEach(item => {
            const subtotal = item.cantidad * item.precio;
            doc.text(`${item.cantidad}x ${item.nombre}`);
            doc.text(`$${item.precio.toFixed(2)} c/u  ->  $${subtotal.toFixed(2)}`, { align: 'right' });
        });

        doc.text('-----------------------------------------', { align: 'center' });
        doc.fontSize(11).font('Helvetica-Bold').text(`TOTAL: $${resultados[0].total.toFixed(2)}`, { align: 'right' });
        doc.fontSize(10).font('Helvetica').text(`Pago: $${resultados[0].pago.toFixed(2)}`, { align: 'right' });
        doc.text(`Cambio: $${resultados[0].cambio.toFixed(2)}`, { align: 'right' });
        
        doc.moveDown().fontSize(9).font('Helvetica').text('¡Gracias por su preferencia!', { align: 'center' });
        doc.end();
    });
});

// ==========================================
// 5. INICIO DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
