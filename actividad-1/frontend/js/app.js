// ============================================
// LÓGICA JAVASCRIPT - FRONTEND
// Gestión de Stock - Reciclaje
// ============================================

// URL base de la API del backend
// Todas las peticiones van a empezar con esta dirección
const API_URL = 'http://localhost:3000/api';

// ============================================
// FUNCIÓN: Cargar y mostrar los materiales
// ============================================
// Se ejecuta al abrir la página para mostrar el stock actual
async function cargarMateriales() {
    try {
        // Pedimos los datos al backend (GET /api/materiales)
        const response = await fetch(`${API_URL}/materiales`);
        
        // Convertimos la respuesta a formato JSON
        const materiales = await response.json();
        
        // Obtenemos el elemento <tbody> de la tabla
        const tbody = document.getElementById('tablaMateriales');
        
        // Por cada material, creamos una fila <tr> con sus datos
        tbody.innerHTML = materiales.map(material => `
            <tr>
                <td>${material.nombre}</td>
                <td>${material.cantidad}</td>
                <td>${material.unidad}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        // Si hay error de conexión, lo mostramos
        console.error('Error cargando materiales:', error);
        mostrarMensaje('Error al conectar con el servidor', 'error');
    }
}

// ============================================
// FUNCIÓN: Agregar un nuevo material
// ============================================
// Se ejecuta cuando el usuario hace click en "Agregar"
async function agregarMaterial() {
    // Obtenemos los valores que escribió el usuario en los inputs
    const nombre = document.getElementById('nombre').value.trim();
    const cantidad = document.getElementById('cantidad').value || 0;
    const unidad = document.getElementById('unidad').value;
    
    // Validación simple: el nombre no puede estar vacío
    if (!nombre) {
        mostrarMensaje('El nombre del material es obligatorio', 'error');
        return;
    }
    
    try {
        // Enviamos los datos al backend (POST /api/materiales)
        const response = await fetch(`${API_URL}/materiales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'  // Le decimos que enviamos JSON
            },
            body: JSON.stringify({ nombre, cantidad, unidad })  // Convertimos a JSON
        });
        
        // Obtenemos la respuesta del servidor
        const data = await response.json();
        
        // Mostramos el mensaje (éxito o error)
        mostrarMensaje(data.error || data.message, data.error ? 'error' : 'success');
        
        // Si no hubo error, recargamos la tabla para mostrar el nuevo material
        if (!data.error) {
            // Limpiamos los campos del formulario
            document.getElementById('nombre').value = '';
            document.getElementById('cantidad').value = '';
            cargarMateriales();
        }
        
    } catch (error) {
        console.error('Error agregando material:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ============================================
// FUNCIÓN: Registrar una COMPRA (entrada de stock)
// ============================================
async function comprar() {
    const nombre = document.getElementById('nombreOperacion').value.trim();
    const cantidad = document.getElementById('cantidadOperacion').value;
    
    if (!nombre || !cantidad) {
        mostrarMensaje('Completá nombre y cantidad', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/comprar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, cantidad })
        });
        
        const data = await response.json();
        mostrarMensaje(data.error || data.message, data.error ? 'error' : 'success');
        
        if (!data.error) {
            document.getElementById('nombreOperacion').value = '';
            document.getElementById('cantidadOperacion').value = '';
            cargarMateriales();
        }
        
    } catch (error) {
        console.error('Error en compra:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ============================================
// FUNCIÓN: Registrar una VENTA (salida de stock)
// ============================================
async function vender() {
    const nombre = document.getElementById('nombreOperacion').value.trim();
    const cantidad = document.getElementById('cantidadOperacion').value;
    
    if (!nombre || !cantidad) {
        mostrarMensaje('Completá nombre y cantidad', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/vender`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, cantidad })
        });
        
        const data = await response.json();
        mostrarMensaje(data.error || data.message, data.error ? 'error' : 'success');
        
        if (!data.error) {
            document.getElementById('nombreOperacion').value = '';
            document.getElementById('cantidadOperacion').value = '';
            cargarMateriales();
        }
        
    } catch (error) {
        console.error('Error en venta:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ============================================
// FUNCIÓN: Mostrar mensajes en pantalla
// ============================================
// Muestra un mensaje temporal (éxito o error) en el div #mensaje
function mostrarMensaje(texto, tipo) {
    const div = document.getElementById('mensaje');
    div.textContent = texto;           // Ponemos el texto
    div.className = tipo;              // Aplicamos la clase CSS (error o success)
    
    // Borramos el mensaje después de 3 segundos
    setTimeout(() => {
        div.textContent = '';
        div.className = '';
    }, 3000);
}

// ============================================
// INICIALIZACIÓN
// ============================================
// Cuando el navegador termina de cargar la página, ejecutamos:
document.addEventListener('DOMContentLoaded', () => {
    cargarMateriales();  // Mostramos el stock actual
});