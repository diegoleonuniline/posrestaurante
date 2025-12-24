// ================================
// API - COMUNICACIÓN CON BACKEND
// ================================

async function apiGet(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`);
    return response.json();
}

async function apiPost(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    return response.json();
}

// ================================
// ENDPOINTS
// ================================

function obtenerDatosMenu() {
    return apiGet("/api/menu");
}

function obtenerMesasYCuentas() {
    return apiGet("/api/mesas-cuentas");
}

function validarLogin(correo, contrasena) {
    return apiPost("/api/login", { correo, contrasena });
}

function obtenerMeseros() {
    return apiGet("/api/meseros");
}

function obtenerMetodosPago() {
    return apiGet("/api/metodos-pago");
}

function obtenerTodosClientes() {
    return apiGet("/api/clientes");
}

function obtenerEstadisticasHoy() {
    return apiGet("/api/estadisticas-hoy");
}

function abrirCuentaMesa(mesaId, meseroId, usuarioId, folio) {
    return apiPost("/api/abrir-cuenta", { mesaId, meseroId, usuarioId, folio });
}

function agregarProductosCuentaBatch(folio, productos, meseroId, usuarioId) {
    return apiPost("/api/agregar-productos", { folio, productos, meseroId, usuarioId });
}

function cerrarCuenta(folio, pagos, propina, usuarioId) {
    return apiPost("/api/cerrar-cuenta", { folio, pagos, propina, usuarioId });
}

function cancelarCuenta(folio) {
    return apiPost("/api/cancelar-cuenta", { folio });
}

function registrarVentaPOS(datosVenta) {
    return apiPost("/api/registrar-venta", datosVenta);
}

function agregarCliente(datos) {
    return apiPost("/api/agregar-cliente", datos);
}

function obtenerDireccionesCliente(clienteId) {
    return apiGet(`/api/direcciones/${clienteId}`);
}

function agregarDireccionCliente(clienteId, direccion, maps) {
    return apiPost("/api/agregar-direccion", { clienteId, direccion, maps });
}

function validarCupon(codigo, clienteId) {
    return apiPost("/api/validar-cupon", { codigo, clienteId });
}

function actualizarDetallesBatch(cambios) {
    return apiPost("/api/actualizar-detalles", { cambios });
}

function cancelarDetallesBatch(ids) {
    return apiPost("/api/cancelar-detalles", { ids });
}

function obtenerCuentaPorFolio(folio) {
    return apiGet(`/api/cuenta/${folio}`);
}

function obtenerHistorialVentas(limite) {
    return apiGet(`/api/historial?limite=${limite || 50}`);
}
function registrarPedidoDomicilio(datos) {
    return apiPost("/api/registrar-pedido-domicilio", datos);
}
function cerrarCuentaSinCobro(folio) {
    return apiPost("/api/cerrar-cuenta-sin-cobro", { folio });
}

function reabrirCuenta(folio, pin) {
    return apiPost("/api/reabrir-cuenta", { folio, pin });
}
