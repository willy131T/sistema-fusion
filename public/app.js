let usuarioLogueado = null; 
let esModoEdicion = false;
let carrito = [];
let catalogoPOS = []; 
const URL_API = ""; // Vacío para que Render use su propia URL automáticamente

// ==========================================
// 1. SISTEMA DE ACCESO (LOGIN Y REGISTRO)
// ==========================================

function iniciarSesion() {
    const user = document.getElementById("login-user").value;
    const pass = document.getElementById("login-pass").value;
    const rolSeleccionado = document.getElementById("login-rol").value; 

    fetch(`${URL_API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass, tipo_rol: rolSeleccionado }) 
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            usuarioLogueado = data;
            document.getElementById("vista-login").style.display = "none";
            document.getElementById("login-error").style.display = "none";
            
            // Redirigimos según el rol real
            if(data.rol === 'admin' || data.rol === 'superadmin') {
                document.getElementById("vista-admin").style.display = "block";
                cargarProductosAdmin();
                cargarProveedores();
                cargarHistorialVentas();
                
                if(data.rol === 'superadmin') {
                    document.getElementById("panel-superadmin").style.display = "block";
                    cargarAdmins(); 
                } else {
                    document.getElementById("panel-superadmin").style.display = "none";
                }

            } else if (data.rol === 'cliente') {
                document.getElementById("vista-pos").style.display = "block";
                cargarProductosPOS();
            }
        } else {
            const errorP = document.getElementById("login-error");
            errorP.innerText = data.mensaje;
            errorP.style.display = "block";
        }
    })
    .catch(err => console.error("Error de login:", err));
}

function mostrarRegistro() {
    document.getElementById("vista-login").style.display = "none";
    document.getElementById("vista-registro").style.display = "flex";
}

function ocultarRegistro() {
    document.getElementById("vista-registro").style.display = "none";
    document.getElementById("vista-login").style.display = "flex";
}

function registrarCliente() {
    const datos = {
        username: document.getElementById("reg-user").value,
        password: document.getElementById("reg-pass").value,
        nombre: document.getElementById("reg-nombre").value,
        apellido: document.getElementById("reg-apellido").value,
        rfc: document.getElementById("reg-rfc").value,
        direccion: document.getElementById("reg-direccion").value,
        fca_nac: document.getElementById("reg-fecha").value
    };

    if(!datos.username || !datos.password || !datos.nombre) {
        return alert("⚠️ Usuario, Contraseña y Nombre son obligatorios.");
    }

    fetch(`${URL_API}/registro-cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos)
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert(data.mensaje);
            ocultarRegistro(); 
        } else {
            alert("❌ " + data.error);
        }
    });
}

function cerrarSesion() {
    usuarioLogueado = null;
    carrito = [];
    document.getElementById("vista-admin").style.display = "none";
    document.getElementById("vista-pos").style.display = "none";
    document.getElementById("vista-login").style.display = "flex";
    document.getElementById("login-user").value = "";
    document.getElementById("login-pass").value = "";
    document.getElementById("login-error").style.display = "none";
    document.getElementById("panel-superadmin").style.display = "none";
}

// ==========================================
// 2. MÓDULO DEL ADMINISTRADOR
// ==========================================

function cargarProductosAdmin() {
    fetch(`${URL_API}/productos`)
    .then(res => res.json())
    .then(productos => {
        const grid = document.getElementById("grid-admin");
        grid.innerHTML = "";
        
        productos.forEach(p => {
            grid.innerHTML += `
                <div class="tarjeta-admin">
                    <strong>${p.nombre}</strong><br>
                    <small>Cód: ${p.codigo}</small><br>
                    <span class="precio">$${p.precio.toFixed(2)}</span><br>
                    <small>📦 Stock: <b>${p.stock}</b></small><br>
                    <small>NIF Prov: ${p.nif}</small>
                    <div class="acciones-card">
                        <button class="btn-editar" onclick="prepararEdicion(${p.codigo}, '${p.nombre}', ${p.precio}, ${p.stock}, '${p.nif}')">✏️ Editar</button>
                        <button class="btn-eliminar" onclick="eliminarProducto(${p.codigo})">🗑️ Borrar</button>
                    </div>
                </div>
            `;
        });
    });
}

function guardarProducto() {
    const codigo = document.getElementById("prod-codigo").value;
    const nombre = document.getElementById("prod-nombre").value;
    const precio = document.getElementById("prod-precio").value;
    const stock = document.getElementById("prod-stock").value;
    const nif = document.getElementById("prod-nif").value;

    const metodo = esModoEdicion ? "PUT" : "POST";
    const ruta = esModoEdicion ? `/productos/${codigo}` : `/productos`;

    fetch(`${URL_API}${ruta}`, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, nombre, precio, stock, nif })
    })
    .then(res => res.text())
    .then(msg => {
        alert("✅ " + msg);
        cancelarEdicion();
        cargarProductosAdmin();
    });
}

function prepararEdicion(codigo, nombre, precio, stock, nif) {
    document.getElementById("prod-codigo").value = codigo;
    document.getElementById("prod-codigo").disabled = true; 
    document.getElementById("prod-nombre").value = nombre;
    document.getElementById("prod-precio").value = precio;
    document.getElementById("prod-stock").value = stock;
    document.getElementById("prod-nif").value = nif;

    esModoEdicion = true;
    document.getElementById("titulo-form").innerText = "✏️ Editar Producto";
    document.getElementById("btn-guardar").innerText = "🔄 Actualizar Producto";
    document.getElementById("btn-cancelar").style.display = "block";
}

function cancelarEdicion() {
    document.getElementById("prod-codigo").value = "";
    document.getElementById("prod-codigo").disabled = false;
    document.getElementById("prod-nombre").value = "";
    document.getElementById("prod-precio").value = "";
    document.getElementById("prod-stock").value = "";
    document.getElementById("prod-nif").value = "";

    esModoEdicion = false;
    document.getElementById("titulo-form").innerText = "➕ Nuevo Producto";
    document.getElementById("btn-guardar").innerText = "💾 Guardar Producto";
    document.getElementById("btn-cancelar").style.display = "none";
}

function eliminarProducto(codigo) {
    if(confirm("⚠️ ¿Eliminar este producto?")) {
        fetch(`${URL_API}/productos/${codigo}`, { method: "DELETE" })
        .then(() => cargarProductosAdmin());
    }
}

// PROVEEDORES
function cargarProveedores() {
    fetch(`${URL_API}/proveedores`)
    .then(res => res.json())
    .then(proveedores => {
        const select = document.getElementById("prod-nif");
        select.innerHTML = '<option value="">-- Selecciona un Proveedor --</option>'; 
        proveedores.forEach(prov => {
            select.innerHTML += `<option value="${prov.nif}">${prov.nombre} (${prov.nif})</option>`;
        });
    });
}

function mostrarFormProveedor() { document.getElementById("form-proveedor").style.display = "block"; }
function ocultarFormProveedor() { document.getElementById("form-proveedor").style.display = "none"; }

function guardarProveedor() {
    const nif = document.getElementById("prov-nif").value;
    const nombre = document.getElementById("prov-nombre").value;
    const direccion = document.getElementById("prov-direccion").value;

    if(!nif || !nombre) return alert("⚠️ El NIF y el Nombre son obligatorios.");

    fetch(`${URL_API}/proveedores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nif, nombre, direccion })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert("✅ " + data.mensaje);
            document.getElementById("prov-nif").value = "";
            document.getElementById("prov-nombre").value = "";
            document.getElementById("prov-direccion").value = "";
            ocultarFormProveedor();
            cargarProveedores(); 
        } else {
            alert("❌ " + data.error);
        }
    });
}

// ==========================================
// 3. MÓDULO DEL PUNTO DE VENTA 
// ==========================================

function cargarProductosPOS() {
    fetch(`${URL_API}/productos`)
    .then(res => res.json())
    .then(productos => {
        catalogoPOS = productos;
        const grid = document.getElementById("grid-pos");
        grid.innerHTML = "";
        
        productos.forEach(p => {
            // AQUI CONECTA LA IMAGEN DE LA BD. El onerror evita que se rompa si la imagen no existe.
            grid.innerHTML += `
                <div class="tarjeta-pos" onclick="agregarAlCarrito(${p.codigo})">
                    <img src="${p.img_url}" alt="${p.nombre}" onerror="this.src='./imagenes/default.jpg'">
                    <h4>${p.nombre}</h4>
                    <p style="color:#d35400; font-weight:bold; margin: 5px 0;">$${p.precio.toFixed(2)}</p>
                    <small>Disponibles: ${p.stock}</small>
                </div>
            `;
        });
    });
}

function agregarAlCarrito(codigo) {
    let prodDB = catalogoPOS.find(p => p.codigo === codigo);
    let itemCarrito = carrito.find(i => i.codigo === codigo);
    let cantidadActual = itemCarrito ? itemCarrito.cantidad : 0;

    if (cantidadActual + 1 > prodDB.stock) {
        return alert(`❌ No hay suficiente stock de ${prodDB.nombre}. Solo quedan ${prodDB.stock}.`);
    }

    if(itemCarrito) {
        itemCarrito.cantidad++;
    } else {
        carrito.push({ codigo: prodDB.codigo, nombre: prodDB.nombre, precio: prodDB.precio, cantidad: 1 });
    }
    renderizarCarrito();
}

function quitarDelCarrito(codigo) {
    let itemIndex = carrito.findIndex(i => i.codigo === codigo);
    if (itemIndex !== -1) {
        if (carrito[itemIndex].cantidad > 1) {
            carrito[itemIndex].cantidad--; 
        } else {
            carrito.splice(itemIndex, 1); 
        }
        renderizarCarrito();
    }
}

function renderizarCarrito() {
    const tbody = document.getElementById("cuerpo-orden");
    tbody.innerHTML = "";
    let total = 0;

    carrito.forEach(item => {
        let subtotal = item.cantidad * item.precio;
        total += subtotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.cantidad}x</td>
                <td>${item.nombre}</td>
                <td>$${subtotal.toFixed(2)}</td>
                <td><button class="btn-quitar-item" onclick="quitarDelCarrito(${item.codigo})">✖</button></td>
            </tr>
        `;
    });

    document.getElementById("lbl-total").innerText = total.toFixed(2);
    calcularCambio(); 
}

function limpiarCarrito() {
    carrito = [];
    renderizarCarrito();
}

function calcularCambio() {
    let total = parseFloat(document.getElementById("lbl-total").innerText);
    let pago = parseFloat(document.getElementById("input-pago").value);
    let lblCambio = document.getElementById("lbl-cambio");

    if (!isNaN(pago) && pago >= total && total > 0) {
        lblCambio.innerText = (pago - total).toFixed(2);
        lblCambio.style.color = "#27ae60"; 
    } else {
        lblCambio.innerText = "0.00";
        lblCambio.style.color = "#e74c3c"; 
    }
}

function cobrarTicket() {
    if(carrito.length === 0) return alert("⚠️ Carrito vacío");

    const total = parseFloat(document.getElementById("lbl-total").innerText);
    const pago = parseFloat(document.getElementById("input-pago").value);

    if(isNaN(pago) || pago < total) {
        return alert("❌ El monto de pago es inválido o insuficiente.");
    }

    const cambio = pago - total;
    // Si tienes el checkbox de imprimir en tu HTML, lo lee, si no, lo asume verdadero
    const checkImprimir = document.getElementById("check-imprimir");
    const quierePDF = checkImprimir ? checkImprimir.checked : true; 
    
    // EL CODIGO SEGURO: Lo saca de la sesión. 
    const clienteActual = usuarioLogueado.cod_client;

    if(!clienteActual) {
        return alert("❌ Error: No se encontró tu ID de cliente. Por favor, cierra sesión y vuelve a entrar.");
    }

    fetch(`${URL_API}/ventas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            cod_client: clienteActual, 
            total: total,
            pago: pago,
            cambio: cambio,
            carrito: carrito 
        })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert(`✅ Venta registrada con éxito.\nSu cambio es: $${cambio.toFixed(2)}`);
            if (quierePDF) {
                window.open(`${URL_API}/ticket/${data.id_ticket}/pdf`, '_blank');
            }
            limpiarCarrito();
            document.getElementById("input-pago").value = ""; 
            cargarProductosPOS(); // Recargamos para actualizar el stock visible
        } else {
            alert("❌ Error al registrar venta: " + data.error);
        }
    })
    .catch(err => console.error("Error al cobrar:", err));
}

// ==========================================
// 4. MÓDULO DE SUPERADMIN (ADMINISTRADORES)
// ==========================================

function cargarAdmins() {
    fetch(`${URL_API}/usuarios-admin`)
    .then(res => res.json())
    .then(admins => {
        const tbody = document.getElementById("lista-admins");
        tbody.innerHTML = "";
        
        admins.forEach(admin => {
            let botones = "";
            if (admin.rol === 'superadmin') {
                botones = `<span style="color: #f39c12; font-weight: bold;">👑 Cuenta Maestra</span>`;
            } else {
                botones = `
                    <button onclick="prepararEdicionAdmin(${admin.id_usuario}, '${admin.username}')" style="background: #3498db; color: white; padding: 5px; border-radius: 3px;">✏️ Editar</button>
                    <button onclick="eliminarAdmin(${admin.id_usuario})" style="background: #e74c3c; color: white; padding: 5px; border-radius: 3px;">🗑️ Borrar</button>
                `;
            }

            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${admin.id_usuario}</td>
                    <td style="padding: 10px; font-weight: bold;">${admin.username}</td>
                    <td style="padding: 10px;">${admin.rol}</td>
                    <td style="padding: 10px;">${botones}</td>
                </tr>
            `;
        });
    });
}

function procesarAdmin() {
    const id = document.getElementById("edit-admin-id").value;
    const user = document.getElementById("nuevo-admin-user").value;
    const pass = document.getElementById("nuevo-admin-pass").value;

    if(!user) return alert("⚠️ El nombre de usuario es obligatorio.");

    const metodo = id === "" ? "POST" : "PUT";
    const ruta = id === "" ? `/crear-admin` : `/usuarios-admin/${id}`;

    if(id === "" && !pass) return alert("⚠️ Ingresa una contraseña para el nuevo admin.");

    fetch(`${URL_API}${ruta}`, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert("✅ " + data.mensaje);
            cancelarEdicionAdmin(); 
            cargarAdmins(); 
        } else {
            alert("❌ " + data.error);
        }
    });
}

function prepararEdicionAdmin(id, username) {
    document.getElementById("edit-admin-id").value = id;
    document.getElementById("nuevo-admin-user").value = username;
    document.getElementById("nuevo-admin-pass").value = ""; 
    document.getElementById("btn-guardar-admin").innerText = "🔄 Actualizar Admin";
    document.getElementById("btn-cancelar-admin").style.display = "block";
}

function cancelarEdicionAdmin() {
    document.getElementById("edit-admin-id").value = "";
    document.getElementById("nuevo-admin-user").value = "";
    document.getElementById("nuevo-admin-pass").value = "";
    document.getElementById("btn-guardar-admin").innerText = "🛡️ Guardar Admin";
    document.getElementById("btn-cancelar-admin").style.display = "none";
}

function eliminarAdmin(id) {
    if(confirm("⚠️ ¿Despedir a este administrador? Perderá acceso al sistema.")) {
        fetch(`${URL_API}/usuarios-admin/${id}`, { method: "DELETE" })
        .then(res => res.json())
        .then(data => {
            if(data.success) cargarAdmins(); 
            else alert("❌ " + data.error);
        });
    }
}

// ==========================================
// 5. HISTORIAL DE VENTAS
// ==========================================

function cargarHistorialVentas() {
    fetch(`${URL_API}/historial-ventas`)
    .then(res => res.json())
    .then(ventas => {
        const tbody = document.getElementById("cuerpo-historial");
        tbody.innerHTML = "";
        
        if(ventas.length === 0) {
            tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>No hay ventas registradas aún.</td></tr>";
            return;
        }

        ventas.forEach(v => {
            const fechaLocal = new Date(v.fecha).toLocaleString();
            tbody.innerHTML += `
                <tr>
                    <td><b>#00${v.id_ticket}</b></td>
                    <td>${fechaLocal}</td>
                    <td>${v.nombre} ${v.apellido}</td>
                    <td style="color: #27ae60; font-weight: bold;">$${v.total.toFixed(2)}</td>
                    <td>$${v.pago.toFixed(2)}</td>
                    <td>$${v.cambio.toFixed(2)}</td>
                    <td>
                        <button onclick="verTicketPDF(${v.id_ticket})" style="background-color: #e74c3c; color: white; padding: 5px 10px; font-size: 0.85em; border-radius: 4px;">📄 Ver PDF</button>
                    </td>
                </tr>
            `;
        });
    })
    .catch(err => console.error("Error cargando historial:", err));
}

function verTicketPDF(id_ticket) {
    window.open(`${URL_API}/ticket/${id_ticket}/pdf`, '_blank');
}

// ==========================================
// EVENTOS TECLADO
// ==========================================
document.getElementById("login-pass").addEventListener("keypress", (e) => { if (e.key === "Enter") iniciarSesion(); });
document.getElementById("login-user").addEventListener("keypress", (e) => { if (e.key === "Enter") iniciarSesion(); });
