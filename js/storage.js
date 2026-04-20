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

    // Estado de sincronización
    syncedWithServer: false,

    // Inicialización asíncrona
    init: async function() {
        console.log("🔄 Inicializando almacenamiento...");
        try {
            // Intentar cargar todo del servidor con un timeout de 3 segundos
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${API_URL}/api/all`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const remoteData = await response.json();
                this.cache = remoteData;
                this.syncedWithServer = true; // Sincronización exitosa
                
                // Actualizar backup local
                Object.keys(remoteData).forEach(key => {
                    localStorage.setItem(`soluventas_${key}`, JSON.stringify(remoteData[key]));
                });
                console.log("✅ Datos cargados desde el servidor");
                return true;
            }
        } catch (error) {
            console.warn("⚠️ Servidor desconectado o error de red, cargando modo local (offline)");
        }

        // Si falla el servidor, cargar de localStorage
        let hasLocalData = false;
        const keys = Object.keys(this.cache);
        keys.forEach(key => {
            const local = localStorage.getItem(`soluventas_${key}`);
            if (local) {
                try {
                    this.cache[key] = JSON.parse(local);
                    hasLocalData = true;
                } catch(e) {
                    console.error(`Error parseando ${key}`, e);
                }
            }
        });

        // IMPORTANTE: Si estamos offline y NO hay datos locales, 
        // NO debemos permitir que este dispositivo intente guardar nada en el servidor luego
        // porque sobrescribiría los datos reales con arrays vacíos.
        this.syncedWithServer = hasLocalData;

        return false;
    },

    save: function(key, data) {
        // Actualizar cache inmediata
        this.cache[key] = data;
        
        // Backup en navegador
        localStorage.setItem(`soluventas_${key}`, JSON.stringify(data));

        // PROTECCIÓN CRÍTICA:
        // Si este dispositivo nunca logró sincronizar con el servidor (o no tiene datos previos)
        // bloqueamos el envío al servidor para evitar borrar la data real con una "lista vacía".
        if (!this.syncedWithServer) {
            console.warn(`🛑 Bloqueado guardado de '${key}' en servidor: El dispositivo no está sincronizado.`);
            return Promise.resolve({ success: false, blocked: true });
        }

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
