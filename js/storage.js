/* storage.js - Sistema de Persistencia Híbrido (Local + Servidor) */
const API_URL = window.location.origin;

const Storage = {
    cache: {
        products: [],
        clients: [],
        sales: [],
        payments: [],
        egresos: [],
        logs: [],
        settings: { lowStockThreshold: 5 }
    },

    // Inicialización asíncrona
    init: async function() {
        console.log("🔄 Inicializando almacenamiento...");
        try {
            // Intentar cargar todo del servidor
            const response = await fetch(`${API_URL}/api/all`);
            if (response.ok) {
                const remoteData = await response.json();
                this.cache = remoteData;
                
                // Actualizar backup local
                Object.keys(remoteData).forEach(key => {
                    localStorage.setItem(`soluventas_${key}`, JSON.stringify(remoteData[key]));
                });
                console.log("✅ Datos cargados desde el servidor");
                return true;
            }
        } catch (error) {
            console.warn("⚠️ Servidor desconectado, cargando modo local (offline)");
        }

        // Si falla el servidor o está offline, cargar de localStorage
        const keys = Object.keys(this.cache);
        keys.forEach(key => {
            const local = localStorage.getItem(`soluventas_${key}`);
            if (local) {
                try {
                    this.cache[key] = JSON.parse(local);
                } catch(e) {
                    console.error(`Error parseando ${key}`, e);
                }
            }
        });
        return false;
    },

    save: function(key, data) {
        // Actualizar cache inmediata
        this.cache[key] = data;
        
        // Backup en navegador
        localStorage.setItem(`soluventas_${key}`, JSON.stringify(data));

        // Enviar a la laptop y retornar la promesa
        return fetch(`${API_URL}/api/save/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(res => {
            if(!res.ok) throw new Error("Server error");
        }).catch(err => {
            console.error(`❌ Error persistiendo ${key} en la laptop:`, err);
            throw err;
        });
    },

    get: function(key) {
        return this.cache[key] || [];
    }
};

// No ejecutamos Storage.init() aquí automáticamente para que el app.js decida cuándo
window.Storage = Storage;
