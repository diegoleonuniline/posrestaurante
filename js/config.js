// config.js - REEMPLAZAR COMPLETAMENTE
// ================================
// CONFIGURACIÓN
// ================================
const API_URL = "https://posresrauranteback-51e5a7bbcef4.herokuapp.com";

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
