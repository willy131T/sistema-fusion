let usuarioLogueado = null; 
let esModoEdicion = false;
let carrito = [];
let catalogoPOS = []; 
const URL_API = ""; // Vacío para que Render use su propia URL automática

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
    document.getElementById("panel-superadmin").style.display = "none";
}

// ==========================================
// 2. MÓDULO ADMINISTRADOR (PRODUCTOS)
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
                    <div class="acciones-card">
                        <button class="btn-editar" onclick="prepararEdicion(${p.codigo}, '${p.nombre}', ${p.precio}, ${p.stock}, '${p.nif}')">✏️ Editar</button>
                        <button class="btn-eliminar" onclick="eliminarProducto(${p.codigo})">🗑️ Borrar</button>
                    </div>
                </div>`;
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

// ==========================================
// 3. PUNTO DE VENTA Y CARRITO
// ==========================================

function cargarProductosPOS() {
    fetch(`${URL_API}/productos`)
    .then(res => res.json())
    .then(productos => {
        catalogoPOS = productos;
        const grid = document.getElementById("grid-pos");
        grid.innerHTML = "";
        productos.forEach(p => {
            grid.innerHTML += `
                <div class="tarjeta-pos" onclick="agregarAlCarrito(${p.codigo})">
                    <img src="${p.img_url}" alt="${p.nombre}">
                    <h4>${p.nombre}</h4>
                    <p style="color:#d35400; font-weight:bold;">$${p.precio.toFixed(2)}</p>
                    <small>Disponibles: ${p.stock}</small>
                </div>`;
        });
    });
}

function agregarAlCarrito(codigo) {
    let prodDB = catalogoPOS.find(p => p.codigo === codigo);
    let itemCarrito = carrito.find(i => i.codigo === codigo);
    let cantidadActual = itemCarrito ? itemCarrito.cantidad : 0;

    if (cantidadActual + 1 > prodDB.stock) {
        return alert(`❌ Stock insuficiente de ${prodDB.nombre}.`);
    }

    if(itemCarrito) {
        itemCarrito.cantidad++;
    } else {
        carrito.push({ codigo: prodDB.codigo, nombre: prodDB.nombre, precio: prodDB.precio, cantidad: 1 });
    }
    renderizarCarrito();
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
                <td><button onclick="quitarDelCarrito(${item.codigo})">✖</button></td>
            </tr>`;
    });
    document.getElementById("lbl-total").innerText = total.toFixed(2);
    calcularCambio();
}

// ==========================================
// 4. PROCESO DE PAGO (CORREGIDO)
// ==========================================

function cobrarTicket() {
    // ... validaciones de carrito y pago ...

    // SEGURIDAD: Intentamos sacar el código del cliente logueado
    // Si no existe, usamos el id_usuario. Si nada existe, ponemos 1 para que no truene.
    // Si no hay cod_client (como en el caso del admin), usamos el 1 por defecto
const clienteActual = usuarioLogueado.cod_client || 1;

    console.log("Comprador actual ID:", clienteActual); // Para que tú lo veas en la consola (F12)

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
    .then(res => {
        if(!res.ok) return res.json().then(e => { throw e; });
        return res.json();
    })
    .then(data => {
        if(data.success) {
            alert(`✅ Venta exitosa. Cambio: $${cambio.toFixed(2)}`);
            if (quierePDF) window.open(`${URL_API}/ticket/${data.id_ticket}/pdf`, '_blank');
            limpiarCarrito();
            document.getElementById("input-pago").value = ""; 
            cargarProductosPOS(); 
        }
    })
    .catch(err => alert("❌ Error: " + (err.error || err.message)));
}

// ==========================================
// 5. UTILIDADES Y EVENTOS
// ==========================================

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

function verTicketPDF(id_ticket) {
    window.open(`${URL_API}/ticket/${id_ticket}/pdf`, '_blank');
}

// Listeners para Enter
document.getElementById("login-pass").addEventListener("keypress", (e) => e.key === "Enter" && iniciarSesion());
document.getElementById("login-user").addEventListener("keypress", (e) => e.key === "Enter" && iniciarSesion());

// Funciones auxiliares de UI
function mostrarRegistro() { document.getElementById("vista-login").style.display = "none"; document.getElementById("vista-registro").style.display = "flex"; }
function ocultarRegistro() { document.getElementById("vista-registro").style.display = "none"; document.getElementById("vista-login").style.display = "flex"; }
function limpiarCarrito() { carrito = []; renderizarCarrito(); }
function prepararEdicion(c, n, p, s, ni) { /* Lógica de edición existente */ }
function cancelarEdicion() { /* Lógica de cancelar existente */ }
