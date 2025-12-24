// ================================
// CONFIGURACIÓN
// ================================
const API_URL = "https://posrestauranteback-9bd9638e87ad.herokuapp.com";

// Cache config
const CACHE_KEYS = {
    menu: "pos_menu",
    clientes: "pos_clientes",
    meseros: "pos_meseros",
    metodosPago: "pos_metodos",
    datosCompletos: "pos_datos_completos",
    usuario: "pos_usuario"
};

const CACHE_DURACION = 30 * 60 * 1000; // 30 minutos
