const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const PDFDocument = require("pdfkit"); 

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public")); 

// // Conexión a la BD local (ajusta según tu configuración)
// const conexion = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "", 
//   database: "sistema_fusion" 
// });

// conexion.connect(function(err){
//   if(err) {
//     console.log("Error de conexión:", err);
//   } else {
//     console.log("¡Conectado a la BD sistema_fusion exitosamente!");
//   }
// });
// Conexión a la BD en la nube (Clever Cloud)
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
// 1. SISTEMA DE LOGIN
// ==========================================
// ==========================================
// 1. SISTEMA DE LOGIN Y REGISTRO
// ==========================================

// Login (Ahora valida qué seleccionaste en la pantalla)
app.post("/login", (req, res) => {
    // tipo_rol vendrá del HTML indicando si eligieron "Admin" o "Cliente"
    const { username, password, tipo_rol } = req.body; 
    
    const sql = "SELECT * FROM usuarios WHERE username = ? AND password = ?";
    conexion.query(sql, [username, password], (err, result) => {
        if(err) return res.status(500).json({ success: false, error: err.message });
        
        if(result.length > 0) {
            const usuario = result[0];

            // Validamos que el rol seleccionado coincida con sus permisos reales
            if (tipo_rol === 'cliente' && usuario.rol !== 'cliente') {
                return res.json({ success: false, mensaje: "Seleccionaste 'Cliente' pero tu cuenta es de Administrador." });
            }
            if (tipo_rol === 'admin' && (usuario.rol !== 'admin' && usuario.rol !== 'superadmin')) {
                return res.json({ success: false, mensaje: "Seleccionaste 'Administrador' pero no tienes permisos." });
            }

            // server.js - Bloque corregido
res.json({ 
    success: true, 
    rol: usuario.rol, 
    id_usuario: usuario.id_usuario,
    cod_client: usuario.cod_client // <--- AGREGA ESTA LÍNEA AQUÍ
});
        } else {
            res.json({ success: false, mensaje: "Usuario o contraseña incorrectos" });
        }
    });
});

// Registro de Clientes Nuevos (Se dan de alta ellos mismos)
app.post("/registro-cliente", (req, res) => {
    const { username, password, nombre, apellido, rfc, direccion, fca_nac } = req.body;

    // 1. Creamos la cuenta de Login
    conexion.query("INSERT INTO usuarios (username, password, rol) VALUES (?, ?, 'cliente')", [username, password], (err, resultUser) => {
        if(err) return res.status(500).json({ success: false, error: "El usuario ya existe." });

        const id_usuario = resultUser.insertId;

        // 2. Calculamos el siguiente código de cliente disponible
        conexion.query("SELECT COALESCE(MAX(cod_client), 0) + 1 AS nextId FROM clientes", (err, rows) => {
            const cod_client = rows[0].nextId;
            
            // 3. Guardamos sus datos personales
            const sqlCliente = "INSERT INTO clientes (cod_client, nombre, apellido, rfc, direccion, fca_nac, id_usuario) VALUES (?, ?, ?, ?, ?, ?, ?)";
            conexion.query(sqlCliente, [cod_client, nombre, apellido, rfc, direccion, fca_nac, id_usuario], (err, result) => {
                if(err) return res.status(500).json({ success: false, error: "Error al guardar datos." });
                res.json({ success: true, mensaje: "¡Registro exitoso! Ya puedes iniciar sesión." });
            });
        });
    });
});

// Crear nuevos Administradores (SOLO PARA SUPERADMIN)
app.post("/crear-admin", (req, res) => {
    const { username, password } = req.body;
    
    // Por seguridad, siempre forzamos que el rol sea 'admin'
    conexion.query("INSERT INTO usuarios (username, password, rol) VALUES (?, ?, 'admin')", [username, password], (err, result) => {
        if(err) return res.status(500).json({ success: false, error: "El usuario ya existe." });
        res.json({ success: true, mensaje: "Nuevo administrador creado con éxito." });
    });
});
// ==========================================
// CRUD DE ADMINISTRADORES (SUPERADMIN)
// ==========================================

// Leer la lista de administradores
app.get("/usuarios-admin", (req, res) => {
    // Solo traemos a los que son admin o superadmin
    conexion.query("SELECT id_usuario, username, rol FROM usuarios WHERE rol IN ('admin', 'superadmin')", (err, result) => {
        if(err) return res.status(500).json({ error: "Error al obtener usuarios" });
        res.json(result);
    });
});

// Editar un administrador (Cambiar nombre o contraseña)
app.put("/usuarios-admin/:id", (req, res) => {
    const id = req.params.id;
    const { username, password } = req.body;
    
    let sql = "UPDATE usuarios SET username = ? WHERE id_usuario = ?";
    let params = [username, id];

    // Si escribieron una contraseña nueva, la actualizamos también
    if (password && password.trim() !== "") {
        sql = "UPDATE usuarios SET username = ?, password = ? WHERE id_usuario = ?";
        params = [username, password, id];
    }

    conexion.query(sql, params, (err, result) => {
        if(err) return res.status(500).json({ success: false, error: "Error al actualizar." });
        res.json({ success: true, mensaje: "¡Administrador actualizado correctamente!" });
    });
});

// Eliminar un administrador
app.delete("/usuarios-admin/:id", (req, res) => {
    const id = req.params.id;
    
    // REGLA DE ORO: Evitamos que se pueda borrar al 'superadmin'
    conexion.query("DELETE FROM usuarios WHERE id_usuario = ? AND rol != 'superadmin'", [id], (err, result) => {
        if(err) return res.status(500).json({ success: false, error: "Error al eliminar." });
        res.json({ success: true, mensaje: "Administrador eliminado del sistema." });
    });
});

// ==========================================
// 2. CRUD DE INVENTARIO (ADMIN)
// ==========================================
// ==========================================
// RUTAS DE PROVEEDORES
// ==========================================
// Leer todos los proveedores
app.get("/proveedores", (req, res) => {
    conexion.query("SELECT * FROM proveedores", (err, result) => {
        if(err) throw err;
        res.json(result);
    });
});

// Crear un nuevo proveedor
app.post("/proveedores", (req, res) => {
    const { nif, nombre, direccion } = req.body;
    const sql = "INSERT INTO proveedores (nif, nombre, direccion) VALUES (?, ?, ?)";
    
    conexion.query(sql, [nif, nombre, direccion], (err, result) => {
        if(err) return res.status(500).json({ success: false, error: "El NIF ya existe o hubo un error." });
        res.json({ success: true, mensaje: "¡Proveedor registrado con éxito!" });
    });
});

// ¡ESTA ES LA RUTA QUE FALTABA! Leer productos
app.get("/productos", (req, res) => {
  conexion.query("SELECT * FROM productos", (err, result) => {
    if(err) throw err;
    res.json(result);
  });
});

// Crear producto (con stock)
app.post("/productos", (req, res) => {
  const { codigo, nombre, precio, stock, nif } = req.body;
  const sql = "INSERT INTO productos (codigo, nombre, precio, stock, nif) VALUES (?, ?, ?, ?, ?)";
  
  conexion.query(sql, [codigo, nombre, precio, stock, nif], (err, result) => {
    if(err) res.status(500).send("Error al guardar");
    else res.send("¡Producto registrado con éxito!");
  });
});

// Actualizar producto (con stock)
app.put("/productos/:codigoViejo", (req, res) => {
    const codigoViejo = req.params.codigoViejo;
    const { codigo, nombre, precio, stock, nif } = req.body;
    const sql = "UPDATE productos SET codigo = ?, nombre = ?, precio = ?, stock = ?, nif = ? WHERE codigo = ?";
    
    conexion.query(sql, [codigo, nombre, precio, stock, nif, codigoViejo], (err, result) => {
      if(err) res.status(500).send("Error al actualizar");
      else res.send("¡Producto actualizado!");
    });
});

// Eliminar producto
app.delete("/productos/:codigo", (req, res) => {
    const codigo = req.params.codigo;
    conexion.query("DELETE FROM productos WHERE codigo = ?", [codigo], (err, result) => {
      if(err) res.status(500).send("Error al eliminar");
      else res.send("¡Producto eliminado!");
    });
});

// ==========================================
// 3. PUNTO DE VENTA (CLIENTES)
// ==========================================

// Guardar una nueva venta (Ahora guarda pago y cambio)
app.post("/ventas", (req, res) => {
    const { cod_client, total, pago, cambio, carrito } = req.body;

    // Insertamos total, pago y cambio
    conexion.query("INSERT INTO tickets (cod_client, total, pago, cambio) VALUES (?, ?, ?, ?)", [cod_client, total, pago, cambio], (err, resultTicket) => {
        if(err) return res.status(500).json({ error: "Error al crear ticket" });

        const id_ticket = resultTicket.insertId; 
        const detalles = carrito.map(item => [item.codigo, cod_client, id_ticket, item.cantidad]);
        const sqlDetalles = "INSERT INTO productos_clientes (codigo, cod_client, id_ticket, cantidad) VALUES ?";
        
        conexion.query(sqlDetalles, [detalles], (err, resultDetalles) => {
             if(err) return res.status(500).json({ error: "Error al guardar detalles de venta" });
             
             carrito.forEach(item => {
                 conexion.query("UPDATE productos SET stock = stock - ? WHERE codigo = ?", [item.cantidad, item.codigo]);
             });

             res.json({ success: true, id_ticket: id_ticket, mensaje: "Venta registrada" });
        });
    });
});
// ==========================================
// 4. HISTORIAL DE VENTAS (ADMINISTRADOR)
// ==========================================
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

    // Agregamos t.pago y t.cambio a la consulta
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

        const doc = new PDFDocument({ margin: 30, size: [250, 400] }); 
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=ticket_venta_${id_ticket}.pdf`);
        doc.pipe(res);

        doc.fontSize(14).font('Helvetica-Bold').text('SISTEMA CORPORATIVO', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('Ticket de Compra', { align: 'center' });
        doc.text('-----------------------------------------', { align: 'center' });
        doc.text(`Folio: #00${resultados[0].id_ticket}`);
        doc.text(`Cliente: ${resultados[0].cliente}`);
        doc.text(`Fecha: ${new Date(resultados[0].fecha).toLocaleString()}`);
        doc.text('-----------------------------------------', { align: 'center' });

        resultados.forEach(item => {
            const subtotal = item.cantidad * item.precio;
            doc.text(`${item.cantidad}x ${item.nombre}`);
            doc.text(`$${item.precio.toFixed(2)} c/u  ->  $${subtotal.toFixed(2)}`, { align: 'right' });
            doc.moveDown(0.5);
        });

        doc.text('-----------------------------------------', { align: 'center' });
        doc.fontSize(12).font('Helvetica-Bold').text(`TOTAL: $${resultados[0].total.toFixed(2)}`, { align: 'right' });
        
        // Imprimimos los nuevos datos
        doc.fontSize(10).font('Helvetica').text(`Su pago: $${resultados[0].pago.toFixed(2)}`, { align: 'right' });
        doc.text(`Cambio: $${resultados[0].cambio.toFixed(2)}`, { align: 'right' });
        
        doc.moveDown(2);
        doc.fontSize(9).font('Helvetica').text('¡Gracias por su compra!', { align: 'center' });

        doc.end();
    });
});

// Encendemos el servidor
// Encendemos el servidor (Adaptado para Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
