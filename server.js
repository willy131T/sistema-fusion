const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const PDFDocument = require("pdfkit"); 

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static("public")); 

// ==========================================
// CONEXIÓN A LA BD EN LA NUBE (Clever Cloud)
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
    console.error("Error de conexión:", err);
  } else {
    console.log("¡Conectado a la BD de Clever Cloud exitosamente!");
  }
});

// ==========================================
// 1. SISTEMA DE LOGIN Y REGISTRO
// ==========================================

// Login con validación de roles y envío de cod_client
app.post("/login", (req, res) => {
    const { username, password, tipo_rol } = req.body; 
    
    const sql = "SELECT * FROM usuarios WHERE username = ? AND password = ?";
    conexion.query(sql, [username, password], (err, result) => {
        if(err) return res.status(500).json({ success: false, error: err.message });
        
        if(result.length > 0) {
            const usuario = result[0];

            if (tipo_rol === 'cliente' && usuario.rol !== 'cliente') {
                return res.json({ success: false, mensaje: "Seleccionaste 'Cliente' pero tu cuenta es de Administrador." });
            }
            if (tipo_rol === 'admin' && (usuario.rol !== 'admin' && usuario.rol !== 'superadmin')) {
                return res.json({ success: false, mensaje: "Seleccionaste 'Administrador' pero no tienes permisos." });
            }

            // CORRECCIÓN VITAL: Enviamos el cod_client al frontend
            res.json({ 
                success: true, 
                rol: usuario.rol, 
                id_usuario: usuario.id_usuario,
                cod_client: usuario.cod_client 
            });
        } else {
            res.json({ success: false, mensaje: "Usuario o contraseña incorrectos" });
        }
    });
});

// Registro de Clientes Nuevos
app.post("/registro-cliente", (req, res) => {
    const { username, password, nombre, apellido, rfc, direccion, fca_nac } = req.body;

    conexion.query("INSERT INTO usuarios (username, password, rol) VALUES (?, ?, 'cliente')", [username, password], (err, resultUser) => {
        if(err) return res.status(500).json({ success: false, error: "El usuario ya existe." });

        const id_usuario = resultUser.insertId;

        conexion.query("SELECT COALESCE(MAX(cod_client), 0) + 1 AS nextId FROM clientes", (err, rows) => {
            const cod_client = rows[0].nextId;
            
            const sqlCliente = "INSERT INTO clientes (cod_client, nombre, apellido, rfc, direccion, fca_nac, id_usuario) VALUES (?, ?, ?, ?, ?, ?, ?)";
            conexion.query(sqlCliente, [cod_client, nombre, apellido, rfc, direccion, fca_nac, id_usuario], (err) => {
                if(err) return res.status(500).json({ success: false, error: "Error al guardar datos." });
                
                // CORRECCIÓN VITAL: Vinculamos el cod_client a la tabla usuarios
                conexion.query("UPDATE usuarios SET cod_client = ? WHERE id_usuario = ?", [cod_client, id_usuario]);
                
                res.json({ success: true, mensaje: "¡Registro exitoso! Ya puedes iniciar sesión." });
            });
        });
    });
});

app.post("/crear-admin", (req, res) => {
    const { username, password } = req.body;
    conexion.query("INSERT INTO usuarios (username, password, rol) VALUES (?, ?, 'admin')", [username, password], (err) => {
        if(err) return res.status(500).json({ success: false, error: "El usuario ya existe." });
        res.json({ success: true, mensaje: "Nuevo administrador creado con éxito." });
    });
});

// ==========================================
// 2. CRUD DE ADMINISTRADORES (SUPERADMIN)
// ==========================================

app.get("/usuarios-admin", (req, res) => {
    conexion.query("SELECT id_usuario, username, rol FROM usuarios WHERE rol IN ('admin', 'superadmin')", (err, result) => {
        if(err) return res.status(500).json({ error: "Error al obtener usuarios" });
        res.json(result);
    });
});

app.put("/usuarios-admin/:id", (req, res) => {
    const id = req.params.id;
    const { username, password } = req.body;
    
    let sql = "UPDATE usuarios SET username = ? WHERE id_usuario = ?";
    let params = [username, id];

    if (password && password.trim() !== "") {
        sql = "UPDATE usuarios SET username = ?, password = ? WHERE id_usuario = ?";
        params = [username, password, id];
    }

    conexion.query(sql, params, (err) => {
        if(err) return res.status(500).json({ success: false, error: "Error al actualizar." });
        res.json({ success: true, mensaje: "¡Administrador actualizado correctamente!" });
    });
});

app.delete("/usuarios-admin/:id", (req, res) => {
    const id = req.params.id;
    conexion.query("DELETE FROM usuarios WHERE id_usuario = ? AND rol != 'superadmin'", [id], (err) => {
        if(err) return res.status(500).json({ success: false, error: "Error al eliminar." });
        res.json({ success: true, mensaje: "Administrador eliminado del sistema." });
    });
});

// ==========================================
// 3. CRUD DE INVENTARIO (ADMIN)
// ==========================================

app.get("/proveedores", (req, res) => {
    conexion.query("SELECT * FROM proveedores", (err, result) => {
        if(err) return res.status(500).json(err);
        res.json(result);
    });
});

app.post("/proveedores", (req, res) => {
    const { nif, nombre, direccion } = req.body;
    conexion.query("INSERT INTO proveedores (nif, nombre, direccion) VALUES (?, ?, ?)", [nif, nombre, direccion], (err) => {
        if(err) return res.status(500).json({ success: false, error: "El NIF ya existe o hubo un error." });
        res.json({ success: true, mensaje: "¡Proveedor registrado con éxito!" });
    });
});

app.get("/productos", (req, res) => {
  conexion.query("SELECT * FROM productos", (err, result) => {
    if(err) return res.status(500).json(err);
    res.json(result);
  });
});

app.post("/productos", (req, res) => {
  const { codigo, nombre, precio, stock, nif } = req.body;
  conexion.query("INSERT INTO productos (codigo, nombre, precio, stock, nif) VALUES (?, ?, ?, ?, ?)", [codigo, nombre, precio, stock, nif], (err) => {
    if(err) res.status(500).send("Error al guardar");
    else res.send("¡Producto registrado con éxito!");
  });
});

app.put("/productos/:codigoViejo", (req, res) => {
    const codigoViejo = req.params.codigoViejo;
    const { codigo, nombre, precio, stock, nif } = req.body;
    conexion.query("UPDATE productos SET codigo = ?, nombre = ?, precio = ?, stock = ?, nif = ? WHERE codigo = ?", [codigo, nombre, precio, stock, nif, codigoViejo], (err) => {
      if(err) res.status(500).send("Error al actualizar");
      else res.send("¡Producto actualizado!");
    });
});

app.delete("/productos/:codigo", (req, res) => {
    const codigo = req.params.codigo;
    conexion.query("DELETE FROM productos WHERE codigo = ?", [codigo], (err) => {
      if(err) res.status(500).send("Error al eliminar");
      else res.send("¡Producto eliminado!");
    });
});

// ==========================================
// 4. PUNTO DE VENTA Y VENTAS (CLIENTES)
// ==========================================

app.post("/ventas", (req, res) => {
    const { cod_client, total, pago, cambio, carrito } = req.body;

    // 1. Insertar el Ticket
    const sqlTicket = "INSERT INTO tickets (cod_client, fecha, total, pago, cambio) VALUES (?, NOW(), ?, ?, ?)";
    
    conexion.query(sqlTicket, [cod_client, total, pago, cambio], (err, resultTicket) => {
        if (err) {
            console.error("Error al crear ticket:", err.sqlMessage);
            return res.status(500).json({ success: false, error: "Error BD: " + err.sqlMessage });
        }

        const id_ticket = resultTicket.insertId;
        const sqlDetalles = "INSERT INTO productos_clientes (codigo, cod_client, id_ticket, cantidad) VALUES (?, ?, ?, ?)";
        
        // 2. Insertar Detalles uno por uno (Más robusto)
        carrito.forEach(item => {
            conexion.query(sqlDetalles, [item.codigo, cod_client, id_ticket, item.cantidad], (errDet) => {
                if(!errDet) {
                    // 3. Descontar Stock
                    conexion.query("UPDATE productos SET stock = stock - ? WHERE codigo = ?", [item.cantidad, item.codigo]);
                }
            });
        });

        res.json({ success: true, id_ticket: id_ticket, mensaje: "Venta registrada" });
    });
});

app.get("/historial-ventas", (req, res) => {
    const sql = `
        SELECT t.id_ticket, t.fecha, t.total, t.pago, t.cambio, c.nombre, c.apellido
        FROM tickets t
        JOIN clientes c ON t.cod_client = c.cod_client
        ORDER BY t.fecha DESC
    `;
    conexion.query(sql, (err, result) => {
        if(err) return res.status(500).json({ error: "Error al obtener historial" });
        res.json(result);
    });
});

// ==========================================
// 5. GENERADOR DE PDF
// ==========================================

app.get("/ticket/:id/pdf", (req, res) => {
    const id_ticket = req.params.id;

    const sql = `
        SELECT t.id_ticket, t.fecha, t.total, t.pago, t.cambio, p.nombre, p.precio, pc.cantidad, c.nombre as cliente
        FROM tickets t
        JOIN productos_clientes pc ON t.id_ticket = pc.id_ticket
        JOIN productos p ON pc.codigo = p.codigo
        JOIN clientes c ON t.cod_client = c.cod_client
        WHERE t.id_ticket = ?
    `;

    conexion.query(sql, [id_ticket], (err, resultados) => {
        if (err || resultados.length === 0) return res.status(404).send("Ticket no encontrado");

        const doc = new PDFDocument({ margin: 30, size: [250, 450] }); 
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=ticket_venta_${id_ticket}.pdf`); // Inline para que abra en el navegador
        doc.pipe(res);

        doc.fontSize(14).font('Helvetica-Bold').text('SISTEMA CORPORATIVO FUSIÓN', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('Ticket de Compra', { align: 'center' }).moveDown();
        doc.text('-----------------------------------------', { align: 'center' });
        doc.text(`Folio: #00${resultados[0].id_ticket}`);
        doc.text(`Cliente: ${resultados[0].cliente}`);
        doc.text(`Fecha: ${new Date(resultados[0].fecha).toLocaleString()}`);
        doc.text('-----------------------------------------', { align: 'center' }).moveDown();

        resultados.forEach(item => {
            const subtotal = item.cantidad * item.precio;
            doc.text(`${item.cantidad}x ${item.nombre}`);
            doc.text(`$${item.precio.toFixed(2)} c/u  ->  $${subtotal.toFixed(2)}`, { align: 'right' });
            doc.moveDown(0.5);
        });

        doc.text('-----------------------------------------', { align: 'center' }).moveDown();
        doc.fontSize(12).font('Helvetica-Bold').text(`TOTAL: $${resultados[0].total.toFixed(2)}`, { align: 'right' });
        
        doc.fontSize(10).font('Helvetica').text(`Su pago: $${resultados[0].pago.toFixed(2)}`, { align: 'right' });
        doc.text(`Cambio: $${resultados[0].cambio.toFixed(2)}`, { align: 'right' });
        
        doc.moveDown(2);
        doc.fontSize(9).font('Helvetica').text('¡Gracias por su compra!', { align: 'center' });

        doc.end();
    });
});

// ==========================================
// 6. INICIO DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
