// ================================
// VARIABLES GLOBALES
// ================================
let menuData = { categorias: [], productos: [], extras: [], productoExtras: [] };
let filteredProducts = [];
let ticket = [];
let tipoServicio = "Recoger";
let totalActual = 0;
let costoEnvio = 0;
let cuponAplicado = null;
let clienteSeleccionado = null;
let direccionSeleccionada = null;
let direccionesCliente = [];
let clientesBuscados = [];
let todosLosClientes = [];
let clientesCargados = false;
let cuentaModalActual = null;
let meseros = [];
let meseroActual = null;

let mesas = [];
let cuentasCompletas = {};
let mesaSeleccionada = null;
let cuentaActual = null;
let filtroMesaActual = "todas";

let metodosPago = [];
let pagosActuales = [];
let totalConPropina = 0;
let usuarioLogueado = null;

let productoSeleccionado = null;
let extrasSeleccionados = [];
let cantidadExtra = 1;

let cambiosPendientes = { editados: [], cancelados: [], nuevos: [] };

// Generar folio único
function generarFolioUnico() {
    const now = new Date();
    const año = String(now.getFullYear()).slice(-2);
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const dia = String(now.getDate()).padStart(2, '0');
    const hora = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const seg = String(now.getSeconds()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    return `PED${año}${mes}${dia}${hora}${min}${seg}${random}`;
}
// ================================
// CACHE LOCAL
// ================================
function guardarCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch(e) {}
}

function obtenerCache(key) {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const parsed = JSON.parse(item);
        if (Date.now() - parsed.timestamp < CACHE_DURACION) return parsed.data;
        return null;
    } catch(e) { return null; }
}

function limpiarTodoCache() {
    Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
}

// ================================
// INICIALIZACIÓN
// ================================
window.addEventListener("load", verificarSesion);

function verificarSesion() {
    const usuarioCache = obtenerCache(CACHE_KEYS.usuario);
    if (usuarioCache && usuarioCache.id) {
        usuarioLogueado = usuarioCache;
        mostrarPOS();
        return;
    }
    mostrarLogin();
}

function mostrarLogin() {
    document.getElementById("loginContainer").style.display = "flex";
    document.getElementById("posContainer").style.display = "none";
}

function mostrarPOS() {
    document.getElementById("loginContainer").style.display = "none";
    document.getElementById("posContainer").style.display = "flex";
    
    if (usuarioLogueado) {
        document.getElementById("usuarioNombre").textContent = usuarioLogueado.nombre;
        document.getElementById("usuarioRol").textContent = usuarioLogueado.rol || "Cajero";
    }
    
    inicializarPOS();
}

async function inicializarPOS() {
    actualizarFecha();
    cargarDesdeCache();
    await cargarDatosCompletos();
    cargarEstadisticas();
    sincronizarEnBackground();
    setInterval(actualizarFecha, 60000);
    setInterval(cargarEstadisticas, 120000);
}

// ================================
// LOGIN
// ================================
async function intentarLogin() {
    const correo = document.getElementById("loginCorreo").value.trim();
    const contrasena = document.getElementById("loginContrasena").value;
    
    if (!correo || !contrasena) {
        mostrarErrorLogin("Ingresa correo y contraseña");
        return;
    }
    
    const btn = document.getElementById("btnLogin");
    btn.disabled = true;
    btn.textContent = "Ingresando...";
    document.getElementById("loginError").style.display = "none";
    
    try {
        const result = await validarLogin(correo, contrasena);
        btn.disabled = false;
        btn.textContent = "Ingresar";
        
        if (result.success) {
            usuarioLogueado = result.usuario;
            guardarCache(CACHE_KEYS.usuario, result.usuario);
            mostrarPOS();
        } else {
            mostrarErrorLogin(result.mensaje);
        }
    } catch(e) {
        btn.disabled = false;
        btn.textContent = "Ingresar";
        mostrarErrorLogin("Error de conexión");
    }
}

function mostrarErrorLogin(mensaje) {
    const el = document.getElementById("loginError");
    el.textContent = mensaje;
    el.style.display = "block";
}

function cerrarSesion() {
    abrirModalConfirmar("¿Cerrar sesión?", "Se cerrará tu sesión actual", () => {
        usuarioLogueado = null;
        localStorage.removeItem(CACHE_KEYS.usuario);
        mostrarLogin();
    });
}

// ================================
// CARGA DE DATOS
// ================================
function cargarDesdeCache() {
    const menuCache = obtenerCache(CACHE_KEYS.menu);
    if (menuCache) {
        menuData = menuCache;
        filteredProducts = menuData.productos.slice();
        renderCategorias();
        renderProductos();
    }
    
    const clientesCache = obtenerCache(CACHE_KEYS.clientes);
    if (clientesCache) {
        todosLosClientes = clientesCache;
        clientesCargados = true;
    }
    
    const meserosCache = obtenerCache(CACHE_KEYS.meseros);
    if (meserosCache) meseros = meserosCache;
    
    const metodosCache = obtenerCache(CACHE_KEYS.metodosPago);
    if (metodosCache) {
        metodosPago = metodosCache;
    } else {
        metodosPago = [
            { id: "EFE", nombre: "Efectivo" },
            { id: "TAR", nombre: "Tarjeta" },
            { id: "TRA", nombre: "Transferencia" }
        ];
    }
    
    const datosCache = obtenerCache(CACHE_KEYS.datosCompletos);
    if (datosCache) {
        mesas = datosCache.mesas || [];
        cuentasCompletas = {};
        (datosCache.cuentas || []).forEach(c => cuentasCompletas[c.folio] = c);
        renderMesas();
    }
}

async function sincronizarEnBackground() {
    if (!obtenerCache(CACHE_KEYS.menu)) cargarMenuRemoto();
    if (!obtenerCache(CACHE_KEYS.clientes)) cargarClientesRemoto();
    if (!obtenerCache(CACHE_KEYS.meseros)) cargarMeserosRemoto();
    if (!obtenerCache(CACHE_KEYS.metodosPago)) cargarMetodosPagoRemoto();
}

async function sincronizarTodo() {
    mostrarToast("Sincronizando...", "");
    limpiarTodoCache();
    
    try {
        const [menu, clientes, meserosData, metodosData, datosCompletos] = await Promise.all([
            obtenerDatosMenu(),
            obtenerTodosClientes(),
            obtenerMeseros(),
            obtenerMetodosPago(),
            obtenerMesasYCuentas()
        ]);
        
        menuData = menu;
        filteredProducts = menuData.productos.slice();
        guardarCache(CACHE_KEYS.menu, menu);
        renderCategorias();
        renderProductos();
        
        todosLosClientes = clientes || [];
        clientesCargados = true;
        guardarCache(CACHE_KEYS.clientes, clientes);
        
        meseros = meserosData || [];
        guardarCache(CACHE_KEYS.meseros, meserosData);
        
        metodosPago = metodosData || [];
        if (metodosPago.length === 0) {
            metodosPago = [
                { id: "EFE", nombre: "Efectivo" },
                { id: "TAR", nombre: "Tarjeta" },
                { id: "TRA", nombre: "Transferencia" }
            ];
        }
        guardarCache(CACHE_KEYS.metodosPago, metodosData);
        
        procesarDatosCompletos(datosCompletos);
        
        mostrarToast("✓ Sincronizado", "success");
    } catch(e) {
        mostrarToast("Error al sincronizar", "error");
    }
}

async function cargarMenuRemoto() {
    try {
        const data = await obtenerDatosMenu();
        menuData = data;
        filteredProducts = menuData.productos.slice();
        guardarCache(CACHE_KEYS.menu, data);
        renderCategorias();
        renderProductos();
    } catch(e) {}
}

async function cargarClientesRemoto() {
    try {
        const data = await obtenerTodosClientes();
        todosLosClientes = data || [];
        clientesCargados = true;
        guardarCache(CACHE_KEYS.clientes, data);
    } catch(e) {}
}

async function cargarMeserosRemoto() {
    try {
        const data = await obtenerMeseros();
        meseros = data || [];
        guardarCache(CACHE_KEYS.meseros, data);
    } catch(e) {}
}

async function cargarMetodosPagoRemoto() {
    try {
        const data = await obtenerMetodosPago();
        metodosPago = data || [];
        if (metodosPago.length === 0) {
            metodosPago = [
                { id: "EFE", nombre: "Efectivo" },
                { id: "TAR", nombre: "Tarjeta" },
                { id: "TRA", nombre: "Transferencia" }
            ];
        }
        guardarCache(CACHE_KEYS.metodosPago, data);
    } catch(e) {}
}

async function cargarDatosCompletos() {
    const grid = document.getElementById("mesasGrid");
    if (mesas.length === 0 && grid) {
        grid.innerHTML = '<div class="pos-loading"><div class="spinner"></div><p>Cargando...</p></div>';
    }
    
    try {
        const data = await obtenerMesasYCuentas();
        procesarDatosCompletos(data);
    } catch(e) {
        if (mesas.length === 0 && grid) {
            grid.innerHTML = '<div class="cuentas-empty"><span>❌</span><p>Error al cargar</p></div>';
        }
    }
}

function procesarDatosCompletos(data) {
    if (!data) return;
    
    mesas = data.mesas || [];
    cuentasCompletas = {};
    
    (data.cuentas || []).forEach(c => {
        cuentasCompletas[c.folio] = c;
    });
    
    mesas.forEach(mesa => {
        if (mesa.folio && cuentasCompletas[mesa.folio]) {
            mesa.cuenta = cuentasCompletas[mesa.folio];
        }
    });
    
    guardarCache(CACHE_KEYS.datosCompletos, data);
    renderMesas();
}

// ================================
// UTILIDADES
// ================================
function actualizarFecha() {
    const ahora = new Date();
    const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const fecha = ahora.toLocaleDateString('es-MX', opciones);
    const hora = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    document.getElementById("posDate").textContent = fecha + " • " + hora;
}

async function cargarEstadisticas() {
    try {
        const stats = await obtenerEstadisticasHoy();
        document.getElementById("statVentas").textContent = stats.cantidad;
        document.getElementById("statTotal").textContent = "$" + stats.total.toLocaleString('es-MX');
    } catch(e) {}
}

function mostrarToast(mensaje, tipo) {
    const toast = document.getElementById("toast");
    toast.textContent = mensaje;
    toast.className = "toast" + (tipo === "success" ? " success" : "");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

// ================================
// TABS
// ================================
function cambiarTab(tab, btn) {
    document.querySelectorAll(".pos-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".pos-tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    
    if (tab === "mesas") {
        document.getElementById("tabMesas").classList.add("active");
        renderMesas();
    } else if (tab === "cuentas") {
        document.getElementById("tabCuentas").classList.add("active");
        renderCuentasAbiertas();
    } else {
        document.getElementById("tabProductos").classList.add("active");
    }
}

// ================================
// CATEGORÍAS Y PRODUCTOS
// ================================
function renderCategorias() {
    const container = document.getElementById("categoriesContainer");
    let html = '<button class="pos-cat active" data-cat="all" onclick="filtrarCategoria(\'all\', this)"><span>📋</span> Todos</button>';
    
    menuData.categorias.forEach(cat => {
        html += `<button class="pos-cat" data-cat="${cat.id}" onclick="filtrarCategoria('${cat.id}', this)">
            <span>${cat.icono}</span> ${cat.nombre}</button>`;
    });
    
    container.innerHTML = html;
}

function filtrarCategoria(catId, btn) {
    document.querySelectorAll(".pos-cat").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    filteredProducts = catId === "all" 
        ? menuData.productos.slice() 
        : menuData.productos.filter(p => p.categoria === catId);
    
    renderProductos();
}

function renderProductos() {
    const container = document.getElementById("productsContainer");
    
    if (filteredProducts.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#6b7280;padding:40px;grid-column:1/-1;">No hay productos</p>';
        return;
    }
    
    let html = "";
    filteredProducts.forEach(p => {
        const hasImage = p.imagen && p.imagen.trim() !== "";
        html += `<div class="pos-product" onclick="agregarProducto('${p.id}')">
            <div class="pos-product-img">
                ${hasImage ? `<img src="${p.imagen}" onerror="this.parentElement.innerHTML='<div class=no-img>🍽️</div>'">` : '<div class="no-img">🍽️</div>'}
            </div>
            <div class="pos-product-info">
                <div class="pos-product-name">${p.nombre}</div>
                <div class="pos-product-price">$${parseFloat(p.precio).toFixed(2)}</div>
            </div>
        </div>`;
    });
    
    container.innerHTML = html;
}

function buscarProducto() {
    const term = document.getElementById("searchInput").value.toLowerCase().trim();
    document.getElementById("searchClear").classList.toggle("show", term.length > 0);
    
    filteredProducts = term === "" 
        ? menuData.productos.slice() 
        : menuData.productos.filter(p => p.nombre.toLowerCase().includes(term));
    
    renderProductos();
}

function limpiarBusqueda() {
    document.getElementById("searchInput").value = "";
    document.getElementById("searchClear").classList.remove("show");
    filteredProducts = menuData.productos.slice();
    renderProductos();
}

// ================================
// AGREGAR PRODUCTO
// ================================
function agregarProducto(productoId) {
    const producto = menuData.productos.find(p => p.id === productoId);
    if (!producto) return;
    
    const extrasDisponibles = getExtrasProducto(productoId);
    
    if (extrasDisponibles.length > 0 || producto.tieneExtras) {
        abrirModalExtras(producto, extrasDisponibles);
    } else {
        agregarAlTicket(producto, 1, [], "", 0);
    }
}

function getExtrasProducto(productoId) {
    const extrasIds = menuData.productoExtras
        .filter(pe => pe.productoId === productoId)
        .map(pe => pe.extraId);
    return menuData.extras.filter(e => extrasIds.includes(e.id));
}

function agregarAlTicket(producto, cantidad, extras, notas, extrasTotal) {
    const precioNum = parseFloat(producto.precio) || 0;
    const extrasTotalNum = parseFloat(extrasTotal) || 0;
    const cantidadNum = parseInt(cantidad) || 1;
    const subtotal = (precioNum + extrasTotalNum) * cantidadNum;
    
    // Guardar extras con ID y nombre para mostrar y enviar
    const extrasConId = (extras || []).map(e => ({
        id: e.id,
        nombre: e.nombre,
        precio: e.precio
    }));
    
    const nuevoItem = {
        id: "local_" + Date.now() + "_" + Math.random().toString(36).substr(2,5),
        productoId: producto.id,
        nombre: producto.nombre,
        precio: precioNum,
        cantidad: cantidadNum,
        extras: extrasConId,
        extrasTotal: extrasTotalNum,
        subtotal,
        notas: notas || "",
        pendienteSync: true,
        esNuevo: true
    };
    
    if (extras.length === 0 && !notas) {
        const existing = ticket.find(t => 
            t.productoId === producto.id && 
            t.extras.length === 0 && 
            !t.notas && 
            t.esNuevo
        );
        if (existing) {
            existing.cantidad += cantidadNum;
            existing.subtotal = (existing.precio + existing.extrasTotal) * existing.cantidad;
            existing.pendienteSync = true;
            renderTicket();
            return;
        }
    }
    
    ticket.push(nuevoItem);
    renderTicket();
}

// ================================
// MODAL EXTRAS
// ================================
function abrirModalExtras(producto, extras) {
    productoSeleccionado = producto;
    extrasSeleccionados = [];
    cantidadExtra = 1;
    
    document.getElementById("extrasProductoNombre").textContent = producto.nombre;
    document.getElementById("extrasPrecioBase").textContent = "$" + parseFloat(producto.precio).toFixed(2);
    document.getElementById("extrasCantidad").textContent = cantidadExtra;
    document.getElementById("extrasNotas").value = "";
    
    let html = "";
    if (extras.length > 0) {
        extras.forEach(e => {
            html += `<div class="extra-item" data-id="${e.id}" onclick="toggleExtra('${e.id}')">
                <div class="extra-check"></div>
                <span class="extra-name">${e.nombre}</span>
                <span class="extra-price">+$${parseFloat(e.precio).toFixed(2)}</span>
            </div>`;
        });
    } else {
        html = '<p style="text-align:center;color:#6b7280;padding:20px;">Sin extras disponibles</p>';
    }
    
    document.getElementById("extrasLista").innerHTML = html;
    calcularTotalExtras();
    document.getElementById("modalExtras").classList.add("show");
}

function cerrarExtras() {
    document.getElementById("modalExtras").classList.remove("show");
    productoSeleccionado = null;
    extrasSeleccionados = [];
}

function toggleExtra(extraId) {
    const idx = extrasSeleccionados.findIndex(e => e.id === extraId);
    
    if (idx > -1) {
        extrasSeleccionados.splice(idx, 1);
    } else {
        const extra = menuData.extras.find(e => e.id === extraId);
        if (extra) extrasSeleccionados.push(extra);
    }
    
    document.querySelectorAll(".extra-item").forEach(item => {
        const itemId = item.getAttribute("data-id");
        const isSelected = extrasSeleccionados.some(e => e.id === itemId);
        item.classList.toggle("selected", isSelected);
        item.querySelector(".extra-check").innerHTML = isSelected ? "✓" : "";
    });
    
    calcularTotalExtras();
}

function cambiarCantidadExtra(delta) {
    cantidadExtra = Math.max(1, cantidadExtra + delta);
    document.getElementById("extrasCantidad").textContent = cantidadExtra;
    calcularTotalExtras();
}

function calcularTotalExtras() {
    const extrasTotal = extrasSeleccionados.reduce((sum, e) => sum + (parseFloat(e.precio) || 0), 0);
    const total = (parseFloat(productoSeleccionado.precio) + extrasTotal) * cantidadExtra;
    document.getElementById("extrasTotal").textContent = "$" + total.toFixed(2);
}

function confirmarAgregarProducto() {
    const extrasTotal = extrasSeleccionados.reduce((sum, e) => sum + (parseFloat(e.precio) || 0), 0);
    const notas = document.getElementById("extrasNotas").value.trim();
    agregarAlTicket(productoSeleccionado, cantidadExtra, extrasSeleccionados.slice(), notas, extrasTotal);
    cerrarExtras();
}

// ================================
// TIPO SERVICIO
// ================================
function setTipoServicio(tipo, btn) {
    tipoServicio = tipo;
    document.querySelectorAll(".tipo-btn").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-tipo") === tipo);
    });
    
    const direccionSection = document.getElementById("ticketDireccion");
    const btnGuardar = document.getElementById("btnGuardar");
    
    if (tipo === "Domicilio") {
        direccionSection.style.display = "block";
        btnGuardar.style.display = "flex";
        if (!clienteSeleccionado) abrirModalCliente();
    } else {
        direccionSection.style.display = "none";
        btnGuardar.style.display = "none";
        direccionSeleccionada = null;
        costoEnvio = 0;
        document.getElementById("costoEnvioInput").value = 0;
    }
    
    renderTicket();
}

// ================================
// TICKET
// ================================
function calcularTotalesLocal() {
    let subtotal = ticket.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0);
    
    let envio = 0;
    if (tipoServicio === "Domicilio") {
        const envioInput = document.getElementById("costoEnvioInput");
        envio = envioInput ? (parseFloat(envioInput.value) || 0) : 0;
    }
    
    let descuento = 0;
    if (cuponAplicado) {
        descuento = Math.round(subtotal * (cuponAplicado.descuento / 100));
    }
    
    return { subtotal, envio, descuento, total: subtotal + envio - descuento };
}

function renderTicket() {
    const totales = calcularTotalesLocal();
    totalActual = totales.total;
    costoEnvio = totales.envio;
    
    const itemsContainer = document.getElementById("ticketItems");
    const emptyContainer = document.getElementById("ticketEmpty");
    const btnCobrar = document.getElementById("btnCobrar");
    const btnGuardar = document.getElementById("btnGuardar");
    
    if (ticket.length === 0) {
        itemsContainer.innerHTML = "";
        emptyContainer.style.display = "block";
        btnCobrar.disabled = true;
        if (btnGuardar) btnGuardar.disabled = true;
    } else {
        emptyContainer.style.display = "none";
        btnCobrar.disabled = false;
        if (btnGuardar) btnGuardar.disabled = false;
        
        let html = "";
        for (let i = ticket.length - 1; i >= 0; i--) {
            const item = ticket[i];
            const cantidad = parseInt(item.cantidad) || 1;
            const minusBtnDisabled = cantidad <= 1 ? ' disabled style="opacity:0.3;cursor:not-allowed;"' : '';
            
            let detalles = "";
            if (item.extras && item.extras.length > 0) {
                detalles = item.extras.map(e => e.nombre || e).join(", ");
            }
            if (item.notas) {
                detalles += (detalles ? " • " : "") + item.notas;
            }
            
            html += `<div class="ticket-item">
                <div class="ticket-item-info">
                    <div class="ticket-item-name">${cantidad > 1 ? cantidad + 'x ' : ''}${item.nombre || "Producto"}</div>
                    ${detalles ? `<div class="ticket-item-extras">${detalles}</div>` : ''}
                </div>
                <div class="ticket-item-price">$${parseFloat(item.subtotal || 0).toFixed(0)}</div>
                <div class="ticket-item-controls">
                    <div class="ticket-item-qty">
                        <button onclick="updateTicketItem(${i}, -1)"${minusBtnDisabled}>−</button>
                        <span>${cantidad}</span>
                        <button onclick="updateTicketItem(${i}, 1)">+</button>
                    </div>
                    <button class="ticket-item-delete" onclick="removeTicketItem(${i})">✕</button>
                </div>
            </div>`;
        }
        
        itemsContainer.innerHTML = html;
    }
    
    document.getElementById("ticketSubtotal").textContent = "$" + totales.subtotal.toFixed(2);
    document.getElementById("ticketEnvio").textContent = "$" + totales.envio.toFixed(2);
    document.getElementById("ticketDescuento").textContent = "-$" + totales.descuento.toFixed(2);
    document.getElementById("ticketTotal").textContent = "$" + totales.total.toFixed(2);
    document.getElementById("envioRow").style.display = totales.envio > 0 ? "flex" : "none";
    document.getElementById("descuentoRow").style.display = totales.descuento > 0 ? "flex" : "none";
}

function updateTicketItem(idx, delta) {
    const item = ticket[idx];
    const nuevaCantidad = (parseInt(item.cantidad) || 1) + delta;
    
    if (nuevaCantidad <= 0) {
        removeTicketItem(idx);
        return;
    }
    
    item.cantidad = nuevaCantidad;
    item.subtotal = (item.precio + (item.extrasTotal || 0)) * item.cantidad;
    item.pendienteSync = true;
    
    renderTicket();
}

function removeTicketItem(idx) {
    const item = ticket[idx];
    
    if (!item.esNuevo && item.id && !String(item.id).startsWith("local_")) {
        cambiosPendientes.cancelados.push(item.id);
    }
    
    ticket.splice(idx, 1);
    renderTicket();
}

function cancelarTicket() {
    if (ticket.length === 0 && !cuentaActual) return;
    
    const mensaje = cuentaActual ? "Se cancelará la cuenta completa" : "Los productos se perderán";
    
    abrirModalConfirmar("¿Cancelar ticket?", mensaje, async () => {
        if (cuentaActual && cuentaActual.folio && !cuentaActual.folio.startsWith("NUEVA-")) {
            const folioACancelar = cuentaActual.folio;
            const mesaIdACancelar = cuentaActual.mesaId;
            
            delete cuentasCompletas[folioACancelar];
            mesas.forEach(m => {
                if (m.id === mesaIdACancelar) {
                    m.estado = "Disponible";
                    m.folio = null;
                    m.cuenta = null;
                    m.total = 0;
                }
            });
            
            resetearInterfazMesa();
            cambiarTab("mesas", document.querySelector('[data-tab="mesas"]'));
            renderMesas();
            mostrarToast("Cuenta cancelada", "success");
            
            try {
                await cancelarCuenta(folioACancelar);
                cargarDatosCompletos();
            } catch(e) {
                mostrarToast("Error al cancelar en servidor", "error");
            }
        } else {
            if (cuentaActual) {
                resetearInterfazMesa();
            } else {
                resetearVenta();
            }
        }
    });
}

function resetearVenta() {
    ticket = [];
    cuponAplicado = null;
    clienteSeleccionado = null;
    direccionSeleccionada = null;
    costoEnvio = 0;
    cambiosPendientes = { editados: [], cancelados: [], nuevos: [] };
    
    document.getElementById("clienteText").textContent = "Seleccionar cliente";
    document.querySelector(".btn-cliente").classList.remove("has-cliente");
    document.getElementById("direccionText").textContent = "Seleccionar dirección";
    document.querySelector(".btn-direccion").classList.remove("has-direccion");
    document.getElementById("costoEnvioInput").value = 0;
    document.getElementById("ticketNotas").value = "";
    document.getElementById("cuponCodigo").value = "";
    document.getElementById("cuponInputSection").style.display = "flex";
    document.getElementById("cuponAplicadoSection").style.display = "none";
    document.getElementById("ticketDireccion").style.display = "none";
    
    tipoServicio = "Recoger";
    document.querySelectorAll(".tipo-btn").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-tipo") === "Recoger");
    });
    
    renderTicket();
}

// ================================
// MODAL CONFIRMAR
// ================================
let confirmarCallback = null;

function abrirModalConfirmar(titulo, mensaje, onConfirm) {
    document.getElementById("confirmarTitulo").textContent = titulo;
    document.getElementById("confirmarMensaje").textContent = mensaje;
    confirmarCallback = onConfirm;
    document.getElementById("modalConfirmar").classList.add("show");
}

function cerrarModalConfirmar() {
    document.getElementById("modalConfirmar").classList.remove("show");
    confirmarCallback = null;
}

function ejecutarConfirmar() {
    if (confirmarCallback) confirmarCallback();
    cerrarModalConfirmar();
}

// ================================
// MESAS
// ================================
function renderMesas() {
    const grid = document.getElementById("mesasGrid");
    if (!grid) return;
    
    if (mesas.length === 0) {
        grid.innerHTML = '<div class="pos-loading"><div class="spinner"></div><p>Cargando mesas...</p></div>';
        return;
    }
    
    let mesasFiltradas = mesas;
    if (filtroMesaActual === "disponibles") {
        mesasFiltradas = mesas.filter(m => m.estado === "Disponible");
    } else if (filtroMesaActual === "ocupadas") {
        mesasFiltradas = mesas.filter(m => m.estado === "Ocupada");
    }
    
    if (mesasFiltradas.length === 0) {
        grid.innerHTML = '<div class="cuentas-empty"><span>🍽️</span><p>No hay mesas en esta categoría</p></div>';
        return;
    }
    
    let html = "";
    mesasFiltradas.forEach(mesa => {
        const estadoClass = mesa.estado === "Ocupada" ? "ocupada" : "disponible";
        const icono = mesa.estado === "Ocupada" ? "🍽️" : "🪑";
        
        html += `<div class="mesa-card ${estadoClass}" onclick="seleccionarMesa('${mesa.id}')">
            <div class="mesa-icono">${icono}</div>
            <div class="mesa-numero">Mesa ${mesa.numero}</div>
            <div class="mesa-capacidad">👥 ${mesa.capacidad} personas</div>
            <div class="mesa-estado">${mesa.estado}</div>
            ${mesa.estado === "Ocupada" && mesa.total > 0 ? `
                <div class="mesa-info">
                    <div class="mesa-total">$${parseFloat(mesa.total).toFixed(2)}</div>
                    ${mesa.hora ? `<div class="mesa-hora">Desde ${(mesa.hora || "").substring(0, 5)}</div>` : ''}
                </div>
            ` : ''}
        </div>`;
    });
    
    grid.innerHTML = html;
}

function filtrarMesas(filtro, btn) {
    filtroMesaActual = filtro;
    document.querySelectorAll(".filtro-mesa").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderMesas();
}

async function seleccionarMesa(mesaId) {
    const mesa = mesas.find(m => m.id === mesaId);
    if (!mesa) return;
    
    mesaSeleccionada = mesa;
    
    if (mesa.estado === "Ocupada" && mesa.folio) {
        // Verificar si la cuenta está cerrada
        const cuenta = mesa.cuenta || cuentasCompletas[mesa.folio];
        
        if (cuenta && cuenta.estado === "Cerrado") {
            // Mostrar modal de cuenta cerrada para pedir PIN
            mostrarModalCuenta(cuenta);
            return;
        }
        
        if (cuenta) {
            aplicarCuentaInstantanea(cuenta, mesa);
        } else if (cuentasCompletas[mesa.folio]) {
            aplicarCuentaInstantanea(cuentasCompletas[mesa.folio], mesa);
        } else {
            await cargarCuentaConFallback(mesa.folio, mesa);
        }
    } else {
        if (!meseros || meseros.length === 0) {
            abrirMesaOptimista(mesa, "", "");
        } else {
            abrirModalMesero(mesa);
        }
    }
}

function aplicarCuentaInstantanea(cuenta, mesa) {
    cuentaActual = {
        folio: cuenta.folio,
        mesaId: mesa.id,
        mesaNumero: mesa.numero,
        meseroId: cuenta.meseroId || "",
        productos: cuenta.productos || []
    };
    
    const mesero = meseros.find(m => m.id === cuenta.meseroId);
    if (mesero) meseroActual = { id: mesero.id, nombre: mesero.nombre };
    
    ticket = [];
    (cuenta.productos || []).forEach(p => {
        if (p.estado !== "Cancelado") {
            ticket.push({
                id: p.id,
                productoId: p.productoId || "",
                nombre: p.nombre || "Producto",
                precio: parseFloat(p.precio) || 0,
                cantidad: parseInt(p.cantidad) || 1,
                extras: [],
                extrasTotal: parseFloat(p.extrasTotal) || 0,
                subtotal: parseFloat(p.subtotal) || 0,
                notas: p.notas || "",
                pendienteSync: false,
                esNuevo: false
            });
        }
    });
    
    mostrarInterfazMesa(mesa);
    renderTicket();
    cambiarTab("productos", document.querySelector('[data-tab="productos"]'));
}

async function cargarCuentaConFallback(folio, mesa) {
    cuentaActual = {
        folio,
        mesaId: mesa.id,
        mesaNumero: mesa.numero,
        meseroId: "",
        productos: []
    };
    
    ticket = [];
    mostrarInterfazMesa(mesa);
    renderTicket();
    cambiarTab("productos", document.querySelector('[data-tab="productos"]'));
    
    try {
        const cuenta = await obtenerCuentaPorFolio(folio);
        if (cuenta) {
            cuentasCompletas[folio] = cuenta;
            mesas.forEach(m => {
                if (m.id === mesa.id) m.cuenta = cuenta;
            });
            
            if (cuentaActual && cuentaActual.folio === folio) {
                cuentaActual.productos = cuenta.productos;
                cuentaActual.meseroId = cuenta.meseroId;
                
                ticket = [];
                cuenta.productos.forEach(p => {
                    if (p.estado !== "Cancelado") {
                        ticket.push({
                            id: p.id,
                            productoId: p.productoId || "",
                            nombre: p.nombre || "Producto",
                            precio: parseFloat(p.precio) || 0,
                            cantidad: parseInt(p.cantidad) || 1,
                            extras: [],
                            extrasTotal: parseFloat(p.extrasTotal) || 0,
                            subtotal: parseFloat(p.subtotal) || 0,
                            notas: p.notas || "",
                            pendienteSync: false,
                            esNuevo: false
                        });
                    }
                });
                renderTicket();
            }
        }
    } catch(e) {}
}

async function abrirMesaOptimista(mesa, meseroId, meseroNombre) {
 const folioNuevo = "TEMP-" + Date.now();
    
    cuentaActual = {
        folio: folioNuevo,
        mesaId: mesa.id,
        mesaNumero: mesa.numero,
        meseroId,
        meseroNombre,
        productos: []
    };
    
    if (meseroId) meseroActual = { id: meseroId, nombre: meseroNombre };
    
    ticket = [];
    mostrarInterfazMesa(mesa);
    document.getElementById("mesaBadge").textContent = "🍽️ Mesa " + mesa.numero + " - " + folioNuevo;
    renderTicket();
    cambiarTab("productos", document.querySelector('[data-tab="productos"]'));
    mostrarToast("Mesa " + mesa.numero + " abierta", "success");
    
    // Enviar a AppSheet en background
    try {
        await abrirCuentaMesa(mesa.id, meseroId || "", usuarioLogueado?.id || "", folioNuevo);
    } catch(e) {
        console.error("Error al crear cuenta en servidor:", e);
    }
}

function mostrarInterfazMesa(mesa) {
    document.getElementById("ticketMesaInfo").style.display = "flex";
    document.getElementById("mesaBadge").textContent = "🍽️ Mesa " + mesa.numero + " - " + (cuentaActual ? cuentaActual.folio : "");
    document.getElementById("ticketTipoContainer").style.display = "none";
    tipoServicio = "Local";
    document.getElementById("btnGuardar").style.display = "flex";
    document.getElementById("btnCerrarTicket").style.display = "flex";
    document.querySelector(".ticket-actions").classList.add("con-mesa");
    document.getElementById("ticketTitulo").textContent = "Mesa " + mesa.numero;
}

function liberarMesa() {
    if (!cuentaActual) return;
    
    const pendientes = ticket.filter(item => item.pendienteSync && item.esNuevo);
    
    if (pendientes.length > 0) {
        abrirModalConfirmar("¿Guardar cambios antes de salir?", "Tienes productos sin guardar", guardarCuenta);
        return;
    }
    
    resetearInterfazMesa();
    cambiarTab("mesas", document.querySelector('[data-tab="mesas"]'));
}

function resetearInterfazMesa() {
    mesaSeleccionada = null;
    cuentaActual = null;
    cambiosPendientes = { editados: [], cancelados: [], nuevos: [] };
    
    document.getElementById("ticketMesaInfo").style.display = "none";
    document.getElementById("ticketTipoContainer").style.display = "flex";
document.getElementById("btnCerrarTicket").style.display = "none";
    document.querySelector(".ticket-actions").classList.remove("con-mesa");
    document.getElementById("ticketTitulo").textContent = "Ticket de Venta";
    
    resetearVenta();
}

// ================================
// MODAL MESERO
// ================================
function abrirModalMesero(mesa) {
    document.getElementById("meseroMesaTitulo").textContent = "Mesa " + mesa.numero;
    
    const modal = document.getElementById("modalMesero");
    modal.dataset.mesaId = mesa.id;
    modal.dataset.mesaNumero = mesa.numero;
    
    let html = "";
    if (meseros.length === 0) {
        html = '<p style="text-align:center;color:#6b7280;padding:20px;">No hay meseros disponibles</p>';
    } else {
        meseros.forEach(m => {
            const inicial = (m.nombre || "M").charAt(0).toUpperCase();
            html += `<div class="mesero-item" onclick="seleccionarMesero('${m.id}', '${m.nombre}')">
                <div class="mesero-avatar">${inicial}</div>
                <div class="mesero-nombre">${m.nombre}</div>
            </div>`;
        });
    }
    
    document.getElementById("meseroLista").innerHTML = html;
    modal.classList.add("show");
}

function cerrarModalMesero() {
    document.getElementById("modalMesero").classList.remove("show");
}

function seleccionarMesero(meseroId, meseroNombre) {
    const modal = document.getElementById("modalMesero");
    const mesaId = modal.dataset.mesaId;
    
    cerrarModalMesero();
    
    const mesa = mesas.find(m => m.id === mesaId);
    if (mesa) abrirMesaOptimista(mesa, meseroId, meseroNombre);
}

// ================================
// GUARDAR CUENTA
// ================================
async function guardarCuenta() {
    if (ticket.length === 0) {
        mostrarToast("Sin productos para guardar", "");
        return;
    }
    
    // Si es domicilio sin cuenta abierta, crear una nueva
    if (!cuentaActual && tipoServicio === "Domicilio") {
        await guardarPedidoDomicilio();
        return;
    }
    
    if (!cuentaActual) {
        mostrarToast("Sin cuenta activa", "");
        return;
    }
    
    const nuevos = [];
    const editados = [];
    
    ticket.forEach(item => {
        if (item.esNuevo && item.pendienteSync) {
            const extrasIds = (item.extras || []).map(e => e.id).filter(id => id).join(" , ");
            
            nuevos.push({
                productoId: item.productoId,
                nombre: item.nombre,
                cantidad: item.cantidad,
                precio: item.precio,
                extrasIds: extrasIds,
                extrasTotal: item.extrasTotal,
                subtotal: item.subtotal,
                notas: item.notas || ""
            });
        } else if (!item.esNuevo && item.pendienteSync && item.id && !String(item.id).startsWith("local_")) {
            editados.push({
                id: item.id,
                cantidad: item.cantidad,
                subtotal: item.subtotal
            });
        }
    });
    
    const cancelados = cambiosPendientes.cancelados.slice();
    const totalCambios = nuevos.length + editados.length + cancelados.length;
    
    if (totalCambios === 0) {
        mostrarToast("Sin cambios pendientes", "");
        resetearInterfazMesa();
        cambiarTab("mesas", document.querySelector('[data-tab="mesas"]'));
        return;
    }
    
    mostrarToast("Guardando " + totalCambios + " cambios...", "");
    
    const folioGuardando = cuentaActual.folio;
    const meseroIdGuardando = cuentaActual.meseroId || "";
    const uidGuardando = usuarioLogueado?.id || "";
    
    ticket.forEach(t => t.pendienteSync = false);
    cambiosPendientes = { editados: [], cancelados: [], nuevos: [] };
    
    resetearInterfazMesa();
    cambiarTab("mesas", document.querySelector('[data-tab="mesas"]'));
    
    try {
        const promises = [];
        
        if (nuevos.length > 0) {
            promises.push(agregarProductosCuentaBatch(folioGuardando, nuevos, meseroIdGuardando, uidGuardando));
        }
        if (editados.length > 0) {
            promises.push(actualizarDetallesBatch(editados));
        }
        if (cancelados.length > 0) {
            promises.push(cancelarDetallesBatch(cancelados));
        }
        
        await Promise.all(promises);
        mostrarToast("✓ Guardado", "success");
        cargarEstadisticas();
        cargarDatosCompletos();
    } catch(e) {
        mostrarToast("Error al guardar", "error");
    }
}

async function guardarPedidoDomicilio() {
    if (!clienteSeleccionado) {
        mostrarToast("Selecciona un cliente", "error");
        abrirModalCliente();
        return;
    }
    
    if (!direccionSeleccionada) {
        mostrarToast("Selecciona una dirección", "error");
        abrirModalDirecciones();
        return;
    }
    
    mostrarToast("Guardando pedido...", "");
    
    const totales = calcularTotalesLocal();
    
    const productosEnviar = ticket.map(item => {
        const extrasIds = (item.extras || []).map(e => e.id).filter(id => id).join(" , ");
        return {
            productoId: item.productoId,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio: item.precio,
            extrasIds: extrasIds,
            extrasTotal: item.extrasTotal,
            subtotal: item.subtotal,
            notas: item.notas || ""
        };
    });
    
    try {
        const result = await registrarPedidoDomicilio({
            productos: productosEnviar,
            total: totales.total,
            tipoServicio: "Domicilio",
            observaciones: document.getElementById("ticketNotas").value.trim(),
            clienteId: clienteSeleccionado?.id || "",
            nombreCliente: clienteSeleccionado?.nombre || "",
            telefono: clienteSeleccionado?.telefono || "",
            direccionId: direccionSeleccionada?.id || "",
            costoEnvio: totales.envio,
            cupon: cuponAplicado,
            usuarioId: usuarioLogueado?.id || ""
        });
        
        if (result && result.success) {
            mostrarToast("✓ Pedido guardado: " + result.folio, "success");
            resetearVenta();
            cargarEstadisticas();
            cargarDatosCompletos();
        } else {
            mostrarToast(result.mensaje || "Error al guardar", "error");
        }
    } catch(e) {
        mostrarToast("Error: " + e.message, "error");
    }
}

// ================================
// CUENTAS ABIERTAS
// ================================
function renderCuentasAbiertas() {
    const lista = document.getElementById("cuentasLista");
    if (!lista) return;
    
    const cuentas = Object.values(cuentasCompletas);
    
    if (cuentas.length === 0) {
        lista.innerHTML = '<div class="cuentas-empty"><span>✨</span><p>No hay cuentas abiertas</p></div>';
        return;
    }
    
    let html = "";
    cuentas.forEach(cuenta => {
        const esMesa = cuenta.mesaId && cuenta.mesaId.length > 0;
        const icono = esMesa ? "🍽️" : "🧾";
        const iconoClass = esMesa ? "mesa" : "";
        const titulo = cuenta.cliente || "Sin cliente";
        
        html += `<div class="cuenta-card" onclick="abrirCuentaDesdeCache('${cuenta.folio}')">
            <div class="cuenta-icono ${iconoClass}">${icono}</div>
            <div class="cuenta-info">
                <div class="cuenta-titulo">${titulo}</div>
                <div class="cuenta-detalle">${cuenta.folio} • ${cuenta.tipoServicio}</div>
            </div>
            <div class="cuenta-total">
                <div class="cuenta-monto">$${parseFloat(cuenta.total).toFixed(2)}</div>
                <div class="cuenta-hora">${(cuenta.hora || "").substring(0, 5)}</div>
            </div>
        </div>`;
    });
    
    lista.innerHTML = html;
}

function cargarCuentasAbiertas() {
    renderCuentasAbiertas();
    cargarDatosCompletos();
}

function abrirCuentaDesdeCache(folio) {
    const cuenta = cuentasCompletas[folio];
    if (cuenta) mostrarModalCuenta(cuenta);
}

function mostrarModalCuenta(cuenta) {
    cuentaModalActual = cuenta;
    
    const esMesa = cuenta.mesaId && cuenta.mesaId.length > 0;
    const estaCerrada = cuenta.estado === "Cerrado";
    
    document.getElementById("cuentaIcono").textContent = esMesa ? "🍽️" : "🧾";
    document.getElementById("cuentaTitulo").textContent = cuenta.cliente || "Sin cliente";
    document.getElementById("cuentaFolioModal").textContent = cuenta.folio;
    document.getElementById("cuentaHoraModal").textContent = (cuenta.hora || "").substring(0, 5) || "--:--";
    document.getElementById("cuentaClienteModal").textContent = cuenta.cliente || "Mostrador";
    
    // Mostrar estado
    const estadoInfo = document.getElementById("cuentaEstadoInfo");
    if (estaCerrada) {
        estadoInfo.textContent = "🔒 Cuenta Cerrada - Solo cobrar";
        estadoInfo.className = "cuenta-estado-info cerrada";
        estadoInfo.style.display = "block";
    } else {
        estadoInfo.textContent = "🔓 Cuenta Abierta";
        estadoInfo.className = "cuenta-estado-info abierta";
        estadoInfo.style.display = "block";
    }
    
    // Mostrar/ocultar botones según estado
    const btnAgregar = document.getElementById("btnAgregarMas");
    const btnCerrar = document.getElementById("btnCerrarCuenta");
    const btnReabrir = document.getElementById("btnReabrirCuenta");
    
    if (estaCerrada) {
        btnAgregar.style.display = "none";
        btnCerrar.style.display = "none";
        btnReabrir.style.display = "flex";
    } else {
        btnAgregar.style.display = "flex";
        btnCerrar.style.display = "flex";
        btnReabrir.style.display = "none";
    }
    
    let productosHtml = "";
    let totalItems = 0;
    const productos = cuenta.productos || [];
    
    if (productos.length > 0) {
        productos.forEach(p => {
            if (p.estado === "Cancelado") return;
            
            const cantidad = parseInt(p.cantidad) || 1;
            totalItems += cantidad;
            
            let extrasText = "";
            if (p.extras && p.extras.length > 0) extrasText = `<div class="cuenta-producto-extras">${p.extras}</div>`;
            if (p.notas) extrasText += `<div class="cuenta-producto-extras">📝 ${p.notas}</div>`;
            
            productosHtml += `<div class="cuenta-producto-item">
                <div class="cuenta-producto-qty">${cantidad}</div>
                <div class="cuenta-producto-info">
                    <div class="cuenta-producto-nombre">${p.nombre || "Producto"}</div>
                    ${extrasText}
                </div>
                <div class="cuenta-producto-precio">$${parseFloat(p.subtotal || 0).toFixed(2)}</div>
            </div>`;
        });
    }
    
    if (!productosHtml) productosHtml = '<div class="cuenta-productos-empty"><span>🛒</span><p>Sin productos</p></div>';
    
    document.getElementById("cuentaProductosLista").innerHTML = productosHtml;
    document.getElementById("cuentaCantidadItems").textContent = totalItems + " item" + (totalItems !== 1 ? "s" : "");
    document.getElementById("cuentaTotalModal").textContent = "$" + parseFloat(cuenta.total || 0).toFixed(2);
    
    document.getElementById("modalCuentaAbierta").classList.add("show");
}

function cerrarModalCuenta() {
    document.getElementById("modalCuentaAbierta").classList.remove("show");
}

function agregarMasCuenta() {
    if (!cuentaModalActual) {
        mostrarToast("Error: cuenta no cargada", "error");
        return;
    }
    
    const cuenta = cuentaModalActual;
    cerrarModalCuenta();
    
    let mesa = null;
    if (cuenta.mesaId) mesa = mesas.find(m => m.id === cuenta.mesaId);
    
    aplicarCuentaInstantanea(cuenta, mesa || { id: cuenta.mesaId, numero: "" });
    cuentaModalActual = null;
}

function cobrarCuentaModal() {
    if (!cuentaModalActual) {
        mostrarToast("Error: cuenta no cargada", "error");
        return;
    }
    
    const cuenta = cuentaModalActual;
    cerrarModalCuenta();
    
    cuentaActual = {
        folio: cuenta.folio,
        mesaId: cuenta.mesaId || "",
        mesaNumero: "",
        productos: cuenta.productos
    };
    
    ticket = [];
    cuenta.productos.forEach((p, i) => {
        if (p.estado === "Cancelado") return;
        ticket.push({
            id: p.id || ("item_" + i),
            productoId: p.productoId || "",
            nombre: p.nombre || "Producto",
            precio: parseFloat(p.precio) || 0,
            cantidad: parseInt(p.cantidad) || 1,
            extras: [],
            extrasTotal: parseFloat(p.extrasTotal) || 0,
            subtotal: parseFloat(p.subtotal) || 0,
            notas: p.notas || "",
            pendienteSync: false,
            esNuevo: false
        });
    });
    
    renderTicket();
    abrirCobro();
    cuentaModalActual = null;
}

// ================================
// CLIENTE
// ================================
async function abrirModalCliente() {
    document.getElementById("modalCliente").classList.add("show");
    document.getElementById("buscarClienteInput").value = "";
    document.getElementById("clienteNuevoForm").style.display = "none";
    document.getElementById("btnNuevoCliente").style.display = "block";
    
    if (clientesCargados && todosLosClientes.length > 0) {
        clientesBuscados = todosLosClientes.slice();
        renderClientesResultados(clientesBuscados);
    } else {
        document.getElementById("clienteResultados").innerHTML = '<div class="pos-loading"><div class="spinner"></div></div>';
        await cargarTodosClientesModal();
    }
}

function cerrarModalCliente() {
    document.getElementById("modalCliente").classList.remove("show");
}

async function cargarTodosClientesModal() {
    try {
        const clientes = await obtenerTodosClientes();
        todosLosClientes = clientes || [];
        clientesCargados = true;
        guardarCache(CACHE_KEYS.clientes, clientes);
        clientesBuscados = todosLosClientes.slice();
        renderClientesResultados(clientesBuscados);
    } catch(e) {
        document.getElementById("clienteResultados").innerHTML = '<div class="no-resultados"><span>❌</span><p>Error al cargar</p></div>';
    }
}

function filtrarClientesLocal() {
    const termino = document.getElementById("buscarClienteInput").value.toLowerCase().trim();
    
    clientesBuscados = termino === "" 
        ? todosLosClientes.slice() 
        : todosLosClientes.filter(c => {
const nombre = (c.nombre || "").toLowerCase();
            const telefono = (c.telefono || "").toLowerCase();
            const correo = (c.correo || "").toLowerCase();
            return nombre.includes(termino) || telefono.includes(termino) || correo.includes(termino);
        });
    
    renderClientesResultados(clientesBuscados);
}

function renderClientesResultados(clientes) {
    const container = document.getElementById("clienteResultados");
    
    if (!clientes || clientes.length === 0) {
        container.innerHTML = '<div class="no-resultados"><span>😕</span><p>No se encontraron clientes</p></div>';
        return;
    }
    
    let html = "";
    clientes.forEach((c, i) => {
        const inicial = (c.nombre || "C").charAt(0).toUpperCase();
        html += `<div class="cliente-item" onclick="seleccionarClienteIdx(${i})">
            <div class="cliente-item-avatar">${inicial}</div>
            <div class="cliente-item-info">
                <div class="cliente-item-nombre">${c.nombre || ""}</div>
                <div class="cliente-item-detalle">📞 ${c.telefono || ""}${c.correo ? ' • ' + c.correo : ''}</div>
            </div>
            ${c.puntos > 0 ? `<span class="cliente-item-puntos">⭐ ${c.puntos}</span>` : ''}
        </div>`;
    });
    
    container.innerHTML = html;
}

function seleccionarClienteIdx(idx) {
    if (clientesBuscados && clientesBuscados[idx]) seleccionarCliente(clientesBuscados[idx]);
}

function seleccionarCliente(cliente) {
    clienteSeleccionado = cliente;
    document.getElementById("clienteText").textContent = cliente.nombre + " • " + cliente.telefono;
    document.querySelector(".btn-cliente").classList.add("has-cliente");
    cerrarModalCliente();
    mostrarToast("Cliente: " + cliente.nombre);
    
    if (tipoServicio === "Domicilio") cargarDireccionesClienteModal();
}

function seleccionarSinCliente() {
    clienteSeleccionado = null;
    direccionSeleccionada = null;
    document.getElementById("clienteText").textContent = "Seleccionar cliente";
    document.querySelector(".btn-cliente").classList.remove("has-cliente");
    document.getElementById("direccionText").textContent = "Seleccionar dirección";
    document.querySelector(".btn-direccion").classList.remove("has-direccion");
    cerrarModalCliente();
}

function toggleNuevoCliente(mostrar) {
    document.getElementById("clienteNuevoForm").style.display = mostrar ? "block" : "none";
    document.getElementById("btnNuevoCliente").style.display = mostrar ? "none" : "block";
    
    if (mostrar) {
        document.getElementById("nuevoClienteNombre").value = "";
        document.getElementById("nuevoClienteTelefono").value = "";
        document.getElementById("nuevoClienteCorreo").value = "";
        document.getElementById("nuevoClienteDireccion").value = "";
    }
}

async function guardarNuevoCliente() {
    const nombre = document.getElementById("nuevoClienteNombre").value.trim();
    const telefono = document.getElementById("nuevoClienteTelefono").value.trim();
    const correo = document.getElementById("nuevoClienteCorreo").value.trim();
    const direccion = document.getElementById("nuevoClienteDireccion").value.trim();
    
    if (!nombre) { mostrarToast("Ingresa el nombre", "error"); return; }
    if (!telefono || telefono.length < 10) { mostrarToast("Teléfono inválido", "error"); return; }
    
    const btn = document.querySelector("#clienteNuevoForm .btn-primario");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    
    try {
        const result = await agregarCliente({ nombre, telefono, correo, direccion });
        btn.disabled = false;
        btn.textContent = "Guardar";
        
        if (result.success) {
            todosLosClientes.unshift(result.cliente);
            guardarCache(CACHE_KEYS.clientes, todosLosClientes);
            seleccionarCliente(result.cliente);
            mostrarToast("Cliente creado", "success");
        } else {
            mostrarToast(result.mensaje, "error");
        }
    } catch(e) {
        btn.disabled = false;
        btn.textContent = "Guardar";
        mostrarToast("Error: " + e.message, "error");
    }
}

// ================================
// DIRECCIONES
// ================================
function abrirModalDirecciones() {
    if (!clienteSeleccionado) {
        mostrarToast("Selecciona un cliente primero", "error");
        abrirModalCliente();
        return;
    }
    
    document.getElementById("direccionesClienteNombre").textContent = clienteSeleccionado.nombre;
    document.getElementById("modalDirecciones").classList.add("show");
    document.getElementById("direccionNuevaForm").style.display = "none";
    document.getElementById("btnNuevaDireccion").style.display = "block";
    cargarDireccionesClienteModal();
}

function cerrarModalDirecciones() {
    document.getElementById("modalDirecciones").classList.remove("show");
}

async function cargarDireccionesClienteModal() {
    document.getElementById("direccionesLista").innerHTML = '<div class="pos-loading"><div class="spinner"></div></div>';
    
    try {
        const direcciones = await obtenerDireccionesCliente(clienteSeleccionado.id);
        direccionesCliente = direcciones;
        renderDirecciones();
    } catch(e) {
        document.getElementById("direccionesLista").innerHTML = '<div class="no-resultados"><span>❌</span><p>Error al cargar</p></div>';
    }
}

function renderDirecciones() {
    const container = document.getElementById("direccionesLista");
    
    if (direccionesCliente.length === 0) {
        container.innerHTML = '<div class="no-resultados"><span>📍</span><p>No hay direcciones registradas</p></div>';
        return;
    }
    
    let html = "";
    direccionesCliente.forEach((d, i) => {
        const isSelected = direccionSeleccionada && direccionSeleccionada.id === d.id;
        const mapsLink = d.maps ? `<a href="${d.maps}" target="_blank" class="direccion-item-maps" onclick="event.stopPropagation()">🗺️</a>` : '';
        
        html += `<div class="direccion-item${isSelected ? ' selected' : ''}" onclick="seleccionarDireccionIdx(${i})">
            <span class="direccion-item-icon">📍</span>
            <span class="direccion-item-texto">${d.direccion}</span>
            ${mapsLink}
        </div>`;
    });
    
    container.innerHTML = html;
}

function seleccionarDireccionIdx(idx) {
    if (direccionesCliente && direccionesCliente[idx]) seleccionarDireccion(direccionesCliente[idx]);
}

function seleccionarDireccion(direccion) {
    direccionSeleccionada = direccion;
    document.getElementById("direccionText").textContent = direccion.direccion;
    document.querySelector(".btn-direccion").classList.add("has-direccion");
    cerrarModalDirecciones();
    mostrarToast("Dirección seleccionada");
}

function toggleNuevaDireccion(mostrar) {
    document.getElementById("direccionNuevaForm").style.display = mostrar ? "block" : "none";
    document.getElementById("btnNuevaDireccion").style.display = mostrar ? "none" : "block";
    if (mostrar) {
        document.getElementById("nuevaDireccionTexto").value = "";
        document.getElementById("nuevaDireccionMaps").value = "";
    }
}

async function guardarNuevaDireccion() {
    const direccion = document.getElementById("nuevaDireccionTexto").value.trim();
    const maps = document.getElementById("nuevaDireccionMaps").value.trim();
    
    if (!direccion) { mostrarToast("Ingresa la dirección", "error"); return; }
    
    const btn = document.querySelector("#direccionNuevaForm .btn-primario");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    
    try {
        const result = await agregarDireccionCliente(clienteSeleccionado.id, direccion, maps);
        btn.disabled = false;
        btn.textContent = "Guardar";
        
        if (result.success) {
            toggleNuevaDireccion(false);
            cargarDireccionesClienteModal();
            mostrarToast("Dirección agregada", "success");
        } else {
            mostrarToast(result.mensaje || "Error", "error");
        }
    } catch(e) {
        btn.disabled = false;
        btn.textContent = "Guardar";
        mostrarToast("Error: " + e.message, "error");
    }
}

// ================================
// CUPÓN
// ================================
async function aplicarCuponInput() {
    const codigo = document.getElementById("cuponCodigo").value.trim();
    if (!codigo) { mostrarToast("Ingresa un código", "error"); return; }
    
    const clienteId = clienteSeleccionado ? clienteSeleccionado.id : "";
    
    try {
        const result = await validarCupon(codigo, clienteId);
        if (result.success) {
            cuponAplicado = result.cupon;
            document.getElementById("cuponNombre").textContent = result.cupon.nombre;
            document.getElementById("cuponPorcentaje").textContent = result.cupon.descuento;
            document.getElementById("cuponInputSection").style.display = "none";
            document.getElementById("cuponAplicadoSection").style.display = "flex";
            renderTicket();
            mostrarToast("Cupón aplicado: " + result.cupon.descuento + "% descuento", "success");
        } else {
            mostrarToast(result.mensaje, "error");
        }
    } catch(e) {
        mostrarToast("Error: " + e.message, "error");
    }
}

function quitarCupon() {
    cuponAplicado = null;
    document.getElementById("cuponCodigo").value = "";
    document.getElementById("cuponInputSection").style.display = "flex";
    document.getElementById("cuponAplicadoSection").style.display = "none";
    renderTicket();
    mostrarToast("Cupón removido");
}

// ================================
// COBRO
// ================================
function abrirCobro() {
    if (ticket.length === 0) return;
    
    if (tipoServicio === "Domicilio") {
        if (!clienteSeleccionado) {
            mostrarToast("Selecciona un cliente para domicilio", "error");
            abrirModalCliente();
            return;
        }
        if (!direccionSeleccionada) {
            mostrarToast("Selecciona una dirección", "error");
            abrirModalDirecciones();
            return;
        }
    }
    
    pagosActuales = metodosPago.map(m => ({ metodoId: m.id, metodo: m.nombre, monto: 0 }));
    
    document.getElementById("propinaInput").value = "0";
    document.getElementById("cobroTotal").textContent = "$" + totalActual.toFixed(2);
    
    renderPagos();
    calcularTotalPagos();
    document.getElementById("modalCobro").classList.add("show");
}

function cerrarCobro() {
    document.getElementById("modalCobro").classList.remove("show");
    pagosActuales = [];
}

function renderPagos() {
    const iconos = { "EFE": "💵", "Efectivo": "💵", "TAR": "💳", "Tarjeta": "💳", "TRA": "📱", "Transferencia": "📱", "VAL": "🎫", "Vales": "🎫", "CHE": "📝", "Cheque": "📝" };
    
    let html = "";
    pagosActuales.forEach((pago, i) => {
        const icono = iconos[pago.metodoId] || iconos[pago.metodo] || "💰";
        const tieneMonto = pago.monto > 0;
        const esEfectivo = pago.metodoId === "EFE" || pago.metodo === "Efectivo";
        
        html += `<div class="metodo-card${tieneMonto ? ' tiene-monto' : ''}" onclick="seleccionarMetodoPago(${i})">
            <div class="metodo-icono">${icono}</div>
            <div class="metodo-nombre">${pago.metodo}</div>
            <input type="number" id="pagoInput${i}" class="metodo-input" value="${pago.monto || ''}" 
                placeholder="${esEfectivo ? 'Recibido' : '0.00'}" 
                oninput="actualizarMontoPago(${i}, this)" 
                onclick="event.stopPropagation()"
                ${!esEfectivo && tieneMonto ? 'readonly' : ''}>
        </div>`;
    });
    
    document.getElementById("cobroMetodos").innerHTML = html;
}

function seleccionarMetodoPago(idx) {
    const pago = pagosActuales[idx];
    const esEfectivo = pago.metodoId === "EFE" || pago.metodo === "Efectivo";
    
    if (esEfectivo) {
        enfocarInput(idx);
    } else {
        if (pago.monto > 0) {
            pago.monto = 0;
        } else {
            const propina = parseFloat(document.getElementById("propinaInput").value) || 0;
            const totalConProp = totalActual + propina;
            const pagado = pagosActuales.reduce((sum, p, i) => i !== idx ? sum + p.monto : sum, 0);
            const restante = totalConProp - pagado;
            pago.monto = Math.max(0, restante);
        }
        renderPagos();
        calcularTotalPagos();
    }
}

function enfocarInput(idx) {
    const input = document.getElementById("pagoInput" + idx);
    if (input) { input.focus(); input.select(); }
}

function actualizarMontoPago(idx, input) {
    pagosActuales[idx].monto = parseFloat(input.value) || 0;
    
    const cards = document.querySelectorAll('.metodo-card');
    if (cards[idx]) cards[idx].classList.toggle('tiene-monto', pagosActuales[idx].monto > 0);
    
    calcularTotalPagos();
}

function calcularTotalPagos() {
    const propina = parseFloat(document.getElementById("propinaInput").value) || 0;
    totalConPropina = totalActual + propina;
    
    const totalPagado = pagosActuales.reduce((sum, p) => sum + p.monto, 0);
    const restante = totalConPropina - totalPagado;
    const cambio = totalPagado - totalConPropina;
    
    document.getElementById("resumenSubtotal").textContent = "$" + totalConPropina.toFixed(2);
    document.getElementById("resumenPagado").textContent = "$" + totalPagado.toFixed(2);
    
    const restanteRow = document.getElementById("resumenRestanteRow");
    const cambioRow = document.getElementById("resumenCambioRow");
    const btnConfirmar = document.getElementById("btnConfirmarCobro");
    
    if (restante > 0.01) {
        restanteRow.style.display = "flex";
        cambioRow.style.display = "none";
        document.getElementById("resumenRestante").textContent = "$" + restante.toFixed(2);
        btnConfirmar.disabled = true;
    } else {
        restanteRow.style.display = "none";
        if (cambio > 0.01) {
            cambioRow.style.display = "flex";
            document.getElementById("resumenCambio").textContent = "$" + cambio.toFixed(2);
        } else {
            cambioRow.style.display = "none";
        }
        btnConfirmar.disabled = false;
    }
}

async function confirmarVenta() {
    const btn = document.getElementById("btnConfirmarCobro");
    btn.disabled = true;
    btn.textContent = "Procesando...";
    
    const propina = parseFloat(document.getElementById("propinaInput").value) || 0;
    const totales = calcularTotalesLocal();
    totalConPropina = totales.total + propina;
    
    const pagosEnviar = pagosActuales
        .filter(p => p.monto > 0)
        .map((p, i) => ({
            metodoId: p.metodoId,
            metodo: p.metodo,
            monto: p.monto,
            propina: i === 0 ? propina : 0
        }));
    
    const totalPagado = pagosActuales.reduce((s, p) => s + p.monto, 0);
    const cambio = Math.max(0, totalPagado - totalConPropina);
    
    // Si es cuenta de mesa, guardar productos pendientes primero y luego cerrar
    if (cuentaActual && cuentaActual.folio) {
        const folioVenta = cuentaActual.folio;
        const mesaIdVenta = cuentaActual.mesaId;
        
        cerrarCobro();
        mostrarExito(folioVenta, totalConPropina, cambio, pagosEnviar);
        
        // Guardar productos pendientes primero
        const nuevos = ticket.filter(item => item.esNuevo && item.pendienteSync);
        if (nuevos.length > 0) {
            const productosEnviar = nuevos.map(item => {
                const extrasIds = (item.extras || []).map(e => e.id).filter(id => id).join(" , ");
                return {
                    productoId: item.productoId,
                    nombre: item.nombre,
                    cantidad: item.cantidad,
                    precio: item.precio,
                    extrasIds: extrasIds,
                    extrasTotal: item.extrasTotal,
                    subtotal: item.subtotal,
                    notas: item.notas || ""
                };
            });
            
            try {
                await agregarProductosCuentaBatch(folioVenta, productosEnviar, cuentaActual.meseroId || "", usuarioLogueado?.id || "");
            } catch(e) {
                console.error("Error guardando productos:", e);
            }
        }
        
        // Actualizar UI
        delete cuentasCompletas[folioVenta];
        mesas.forEach(m => {
            if (m.id === mesaIdVenta) {
                m.estado = "Disponible";
                m.folio = null;
                m.cuenta = null;
                m.total = 0;
            }
        });
        
        resetearInterfazMesa();
        
        try {
            const result = await cerrarCuenta(folioVenta, pagosEnviar, propina, usuarioLogueado?.id || "");
            if (result && result.success) {
                document.getElementById("exitoFolio").textContent = result.folio;
                mostrarToast("✓ Cobro confirmado", "success");
            }
            cargarEstadisticas();
            cargarDatosCompletos();
        } catch(e) {
            mostrarToast("Error al cerrar cuenta", "error");
        }
    } else {
        // Venta rápida sin mesa
        const folioLocal = generarFolioUnico();
        
        const productosEnviar = ticket.map(item => {
            const extrasIds = (item.extras || []).map(e => e.id).filter(id => id).join(" , ");
            return {
                productoId: item.productoId,
                nombre: item.nombre,
                cantidad: item.cantidad,
                precio: item.precio,
                extrasIds: extrasIds,
                extrasTotal: item.extrasTotal,
                subtotal: item.subtotal,
                notas: item.notas || ""
            };
        });
        
        cerrarCobro();
        mostrarExito(folioLocal, totalConPropina, cambio, pagosEnviar);
        
        try {
            const result = await registrarVentaPOS({
                productos: productosEnviar,
                total: totales.total,
                tipoServicio,
                observaciones: document.getElementById("ticketNotas").value.trim(),
                clienteId: clienteSeleccionado?.id || "",
                nombreCliente: clienteSeleccionado?.nombre || "Mostrador",
                telefono: clienteSeleccionado?.telefono || "",
                direccionId: direccionSeleccionada?.id || "",
                meseroId: meseroActual?.id || "",
                costoEnvio: totales.envio,
                cupon: cuponAplicado,
                pagos: pagosEnviar,
                propina,
                usuarioId: usuarioLogueado?.id || ""
            });
            
            if (result && result.success) {
                document.getElementById("exitoFolio").textContent = result.folio;
                mostrarToast("✓ Venta registrada", "success");
            }
            cargarEstadisticas();
        } catch(e) {
            mostrarToast("Error al registrar venta", "error");
        }
        
        resetearVenta();
    }
}

// ================================
// ÉXITO
// ================================
function mostrarExito(folio, total, cambio, pagos) {
    document.getElementById("exitoFolio").textContent = folio;
    document.getElementById("exitoTotal").textContent = "$" + parseFloat(total).toFixed(2);
    
    const cambioRow = document.getElementById("exitoCambioRow");
    if (cambio > 0) {
        cambioRow.style.display = "flex";
        document.getElementById("exitoCambio").textContent = "$" + cambio.toFixed(2);
    } else {
        cambioRow.style.display = "none";
    }
    
    const metodosTexto = pagos.map(p => p.metodo + ": $" + p.monto.toFixed(2)).join(" | ");
    const metodosEl = document.getElementById("exitoMetodos");
    if (metodosEl) metodosEl.textContent = metodosTexto;
    
    document.getElementById("modalExito").classList.add("show");
}

function nuevaVenta() {
    resetearVenta();
    document.getElementById("modalExito").classList.remove("show");
    cambiarTab("mesas", document.querySelector('[data-tab="mesas"]'));
    renderMesas();
}

function imprimirTicket() {
    mostrarToast("Función próximamente");
}

// ================================
// ATAJOS DE TECLADO
// ================================
document.addEventListener("keydown", e => {
    if (e.key === "F2") {
        e.preventDefault();
        if (document.getElementById("modalExito").classList.contains("show")) {
            nuevaVenta();
        } else {
            cancelarTicket();
        }
    }
    if (e.key === "F4" && ticket.length > 0 && !document.getElementById("modalCobro").classList.contains("show")) {
        e.preventDefault();
        abrirCobro();
    }
    if (e.key === "Enter" && document.getElementById("modalCobro").classList.contains("show")) {
        e.preventDefault();
        if (!document.getElementById("btnConfirmarCobro").disabled) confirmarVenta();
    }
    if (e.key === "Escape") {
        ["modalCobro", "modalExtras", "modalCliente", "modalDirecciones", "modalCuentaAbierta", "modalMesero", "modalConfirmar", "modalExito"].forEach(id => {
            const modal = document.getElementById(id);
            if (modal) modal.classList.remove("show");
        });
    }
});
// ================================
// CERRAR Y REABRIR CUENTAS
// ================================
async function cerrarCuentaSinCobrar() {
    if (!cuentaModalActual) return;
    
    abrirModalConfirmar("¿Cerrar cuenta?", "La cuenta quedará cerrada pero sin cobrar", async () => {
        try {
            const result = await cerrarCuentaSinCobro(cuentaModalActual.folio);
            if (result.success) {
                mostrarToast("✓ Cuenta cerrada", "success");
                cerrarModalCuenta();
                cargarDatosCompletos();
            } else {
                mostrarToast(result.mensaje || "Error", "error");
            }
        } catch(e) {
            mostrarToast("Error: " + e.message, "error");
        }
    });
}

function abrirModalReabrir() {
    document.getElementById("pinReabrir").value = "";
    document.getElementById("pinError").style.display = "none";
    document.getElementById("modalReabrir").classList.add("show");
    setTimeout(() => document.getElementById("pinReabrir").focus(), 100);
}

function cerrarModalReabrir() {
    document.getElementById("modalReabrir").classList.remove("show");
}

function togglePinVisibility() {
    const input = document.getElementById("pinReabrir");
    input.type = input.type === "password" ? "text" : "password";
}

async function confirmarReabrir() {
    const pin = document.getElementById("pinReabrir").value.trim();
    
    if (!pin) {
        document.getElementById("pinError").textContent = "Ingresa tu PIN";
        document.getElementById("pinError").style.display = "block";
        return;
    }
    
    if (!cuentaModalActual) return;
    
    try {
        const result = await reabrirCuenta(cuentaModalActual.folio, pin);
        
        if (result.success) {
            cerrarModalReabrir();
            cerrarModalCuenta();
            mostrarToast("✓ Cuenta reabierta por " + result.usuario, "success");
            
            // Actualizar estado local y abrir directo para agregar
            cuentaModalActual.estado = "Abierto";
            
            // Ir directo a agregar productos
            let mesa = null;
            if (cuentaModalActual.mesaId) {
                mesa = mesas.find(m => m.id === cuentaModalActual.mesaId);
            }
            
            aplicarCuentaInstantanea(cuentaModalActual, mesa || { id: cuentaModalActual.mesaId, numero: "" });
            
            cargarDatosCompletos();
        } else {
            document.getElementById("pinError").textContent = result.mensaje;
            document.getElementById("pinError").style.display = "block";
        }
    } catch(e) {
        document.getElementById("pinError").textContent = "Error: " + e.message;
        document.getElementById("pinError").style.display = "block";
    }
}
async function cerrarCuentaDesdeTicket() {
    if (!cuentaActual || !cuentaActual.folio || cuentaActual.folio.startsWith("NUEVA-")) {
        mostrarToast("Primero guarda la cuenta", "error");
        return;
    }
    
    abrirModalConfirmar("¿Cerrar cuenta?", "La cuenta quedará cerrada sin cobrar", async () => {
        try {
            // Guardar cambios pendientes primero
            const nuevos = ticket.filter(item => item.esNuevo && item.pendienteSync);
            if (nuevos.length > 0) {
                const productosEnviar = nuevos.map(item => {
                    const extrasIds = (item.extras || []).map(e => e.id).filter(id => id).join(" , ");
                    return {
                        productoId: item.productoId,
                        nombre: item.nombre,
                        cantidad: item.cantidad,
                        precio: item.precio,
                        extrasIds: extrasIds,
                        extrasTotal: item.extrasTotal,
                        subtotal: item.subtotal,
                        notas: item.notas || ""
                    };
                });
                await agregarProductosCuentaBatch(cuentaActual.folio, productosEnviar, cuentaActual.meseroId || "", usuarioLogueado?.id || "");
            }
            
            // Cerrar la cuenta
            const result = await cerrarCuentaSinCobro(cuentaActual.folio);
            if (result.success) {
                mostrarToast("✓ Cuenta cerrada", "success");
                resetearInterfazMesa();
                cambiarTab("mesas", document.querySelector('[data-tab="mesas"]'));
                cargarDatosCompletos();
            } else {
                mostrarToast(result.mensaje || "Error", "error");
            }
        } catch(e) {
            mostrarToast("Error: " + e.message, "error");
        }
    });
}
