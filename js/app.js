/* app.js - Main Application Logic */

// Global State (Reemplazados por inicialización asíncrona)
let products, clients, sales, payments, egresos, logs, settings, currentBCVRate;

async function bootstrapApp() {
    const isOnline = await Storage.init();

    // Obtener datos del Storage (Híbrido)
    products = Storage.get('products');
    clients = Storage.get('clients');
    sales = Storage.get('sales');
    payments = Storage.get('payments');
    egresos = Storage.get('egresos');
    logs = Storage.get('logs');
    settings = Storage.get('settings') || { lowStockThreshold: 5, businessName: 'SoluVentas', businessRIF: '', businessPhone: '', businessAddress: '' };
    currentBCVRate = parseFloat(localStorage.getItem('soluventas_manual_bcv')) || 45.0;

    // Notificar estado de conexión de forma más evidente si falló
    if (isOnline) {
        UI.showToast('Conectado a la Laptop (Sincronizado)', 'success');
    } else {
        // Si no está online, mostramos el modal de error/aviso
        setTimeout(() => UI.showSyncError(), 1000);
    }

    // Inicializar UI y Eventos
    initEventListeners();

    // Verificar si toca auto-backup (datos ya cargados)
    checkAutoBackup();

    // Carga inicial de sección
    const section = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(section);
}

// Auto-Backup se llama desde bootstrapApp después de que los datos están cargados
function checkAutoBackup() {
    const lastBackup = localStorage.getItem('soluventas_last_backup');
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (!lastBackup || (now - parseInt(lastBackup)) > ONE_DAY) {
        setTimeout(performAutoBackup, 3000);
    }
}

function performAutoBackup(isManual = false) {
    try {
        const backupData = {
            version: '2.0',
            timestamp: new Date().toISOString(),
            products: Storage.get('products'),
            clients: Storage.get('clients'),
            sales: Storage.get('sales'),
            payments: Storage.get('payments'),
            egresos: Storage.get('egresos'),
            logs: Storage.get('logs'),
            settings: Storage.get('settings')
        };
        const json = JSON.stringify(backupData, null, 2);

        if (isManual) {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `soluventas_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            UI.showToast('Respaldo descargado', 'success');
        } else {
            fetch(`${window.location.origin}/api/backup/silent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: json
            }).then(res => {
                if (res.ok) {
                    localStorage.setItem('soluventas_last_backup', Date.now().toString());
                    addLog('sistema', 'Backup automático guardado en el servidor');
                    console.log("✅ Backup silencioso completado");
                }
            }).catch(e => console.error("Error backup:", e));
        }
    } catch (e) {
        console.error('Backup failed:', e);
    }
}

async function restoreBackup(file) {
    if (!file) {
        UI.showToast('Selecciona un archivo primero', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.products || !data.sales) throw new Error('Formato inválido');

            const backupDate = data.timestamp ? new Date(data.timestamp).toLocaleDateString() : 'fecha desconocida';
            if (!confirm(`¿Restaurar backup del ${backupDate}?\n¡ATENCIÓN! Se borrarán todos los datos actuales y se reemplazarán por los del respaldo.`)) return;

            UI.showToast('Restaurando datos...', 'info');

            // Actualizar variables globales
            products = data.products || [];
            clients = data.clients || [];
            sales = data.sales || [];
            payments = data.payments || [];
            egresos = data.egresos || [];
            settings = data.settings || settings;
            logs = data.logs || [];

            // Agregar log de restauración
            logs.push({
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'sistema',
                message: `Restauración de backup aplicada: ${backupDate}`
            });

            // Sincronizar TODO al servidor y localStorage
            const success = await saveAll();

            if (success) {
                UI.showToast('Backup restaurado y sincronizado correctamente', 'success');
                setTimeout(() => location.reload(), 1500);
            } else {
                throw new Error('Error al sincronizar con el servidor');
            }

        } catch (err) {
            console.error('Error al restaurar backup:', err);
            UI.showToast('Error: el archivo no es un backup válido de SoluVentas', 'error');
        }
    };
    reader.readAsText(file);
}

/* app.js - Sale confirmation and audit additions */
function addLog(type, message) {
    logs.push({
        id: Date.now(),
        date: new Date().toISOString(),
        type: type,
        message: message
    });
    saveAll();
}
const contentArea = document.getElementById('content-area');
const pageTitle = document.getElementById('page-title');
const navLinks = document.querySelectorAll('.nav-link, .bottom-nav-link');
const mobileToggle = document.getElementById('mobile-toggle');
const sidebar = document.getElementById('sidebar');
const mobileClose = document.getElementById('mobile-close');
const mobileMore = document.getElementById('mobile-more');
// Scanner Logic
UI.startScanning = function (targetId, isQuickAdd = false) {
    const container = document.getElementById('scanner-container');
    const readerDiv = document.getElementById('reader');
    if (!container || !readerDiv) return;

    // UI Feedback
    container.style.display = 'block';
    readerDiv.innerHTML = '<div style="height:250px; display:flex; align-items:center; justify-content:center; color:white; flex-direction:column; gap:10px;"><div class="spinner"></div><span>Iniciando Cámara...</span></div>';

    setTimeout(() => {
        if (window.html5QrCode) {
            window.html5QrCode.stop().then(() => startScan(targetId, isQuickAdd)).catch(() => startScan(targetId, isQuickAdd));
        } else {
            startScan(targetId, isQuickAdd);
        }
    }, 500); // 500ms para asegurar renderizado de contenedor
};

async function startScan(targetId, isQuickAdd) {
    const readerDiv = document.getElementById('reader');
    try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
            readerDiv.innerHTML = '<p style="color:white; padding:20px;">No se detectaron cámaras.</p>';
            return;
        }

        // Seleccionar preferiblemente la cámara trasera (suele ser la última del array)
        const backCamera = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('trasera')) || cameras[cameras.length - 1];

        const html5QrCode = new Html5Qrcode("reader");
        window.html5QrCode = html5QrCode;

        const config = {
            fps: 10,
            qrbox: (viewWidth, viewHeight) => {
                const width = Math.min(viewWidth * 0.8, 300);
                const height = Math.min(viewHeight * 0.5, 150);
                return { width, height };
            }
        };

        await html5QrCode.start(
            backCamera.id,
            config,
            (decodedText) => {
                const input = document.getElementById(targetId);
                if (input) {
                    if (isQuickAdd) {
                        const prod = products.find(p => p.code.toLowerCase().split(',').map(c => c.trim()).includes(decodedText.toLowerCase()));
                        if (prod) {
                            addToCart(prod.id);
                            UI.showToast(`Agregado: ${prod.name}`, 'success');
                        } else {
                            UI.showToast(`Código ${decodedText} no encontrado`, 'warning');
                        }
                    } else {
                        let val = input.value.trim();
                        let codes = val ? val.split(',').map(c => c.trim()) : [];
                        if (!codes.includes(decodedText)) {
                            codes.push(decodedText);
                            input.value = codes.join(', ');
                        }
                        UI.showToast("Código capturado: " + decodedText);
                    }
                }
                UI.stopScanning();
            }
        );
    } catch (e) {
        console.error("Camera error:", e);
        readerDiv.innerHTML = `<p style="color:#ff6b6b; padding:20px; font-size:0.8rem;">Error: ${e.message || e}<br><br>Si usas IP local, asegúrate de habilitar 'Insecure origins' en chrome://flags</p>`;
        setTimeout(UI.stopScanning, 5000);
    }
}

function stopScanAndRestore() {
    if (window.html5QrCode) {
        window.html5QrCode.stop().then(() => {
            window.html5QrCode = null;
            const container = document.getElementById('scanner-container');
            if (container) container.style.display = 'none';
        }).catch(err => {
            console.warn("Stop failed, forcing hide", err);
            window.html5QrCode = null;
            const container = document.getElementById('scanner-container');
            if (container) container.style.display = 'none';
        });
    } else {
        const container = document.getElementById('scanner-container');
        if (container) container.style.display = 'none';
    }
}

UI.stopScanning = function () {
    stopScanAndRestore();
}

const modalContainer = document.getElementById('modal-container');

// Initialize Icons
lucide.createIcons();

// --- Navigation Logic ---
const navigateTo = (section) => {
    // ALWAYS close sidebar first for responsiveness
    if (sidebar) sidebar.classList.remove('active');

    // Update UI for both Sidebar and Bottom Nav
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === section) {
            link.classList.add('active');
        }
    });

    const title = section.charAt(0).toUpperCase() + section.slice(1);
    pageTitle.textContent = title === 'Ventas' ? 'Nueva Venta' : title;

    // Smooth Transition
    contentArea.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    setTimeout(() => {
        renderSection(section);
        const sectionHeader = document.querySelector('.section-header');
        if (sectionHeader) sectionHeader.classList.add('section-fadeIn');
    }, 150); // Faster transition for 2GB RAM laptop
};

// Event Listeners moved to a function
function initEventListeners() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.currentTarget.dataset.section;
            navigateTo(section);
            window.location.hash = section;
        });
    });

    mobileToggle.addEventListener('click', () => sidebar.classList.add('active'));
    mobileClose.addEventListener('click', () => sidebar.classList.remove('active'));
    if (mobileMore) mobileMore.addEventListener('click', () => sidebar.classList.add('active'));

    // Close modal on click overlay
    modalContainer.addEventListener('click', (e) => {
        if (e.target === modalContainer || e.target.classList.contains('close-modal')) {
            UI.closeModal();
        }
    });

    // Monitor hash changes for back button support
    window.addEventListener('hashchange', () => {
        const section = window.location.hash.replace('#', '') || 'dashboard';
        navigateTo(section);
    });

    // Iniciar el BCV
    fetchBCVRate();
}

// Reemplazamos la ejecución inmediata por el bootstrap
document.addEventListener('DOMContentLoaded', bootstrapApp);

// --- Section Renderers ---
const renderSection = (section) => {
    switch (section) {
        case 'dashboard': renderDashboard(); break;
        case 'ventas': renderVentas(); break; // Nueva Venta
        case 'inventario': renderInventario(); break;
        case 'deudas': renderDeudas(); break;
        case 'historial': renderHistorial(); break;
        case 'egresos': renderEgresos(); break;
        case 'clientes': renderClientes(); break;
        case 'auditoria': renderAuditoria(); break;
        case 'configuracion': renderConfiguracion(); break;
        default: renderDashboard(); break;
    }
};

function renderAuditoria() {
    const groupedLogs = {};

    // Sort logs descending
    const sortedLogs = [...logs].reverse();

    sortedLogs.forEach(entry => {
        const d = new Date(entry.date);
        // Create a week key: YYYY-WeekNumber
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const days = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        const weekKey = `${d.getFullYear()} - Semana ${weekNumber}`;

        if (!groupedLogs[weekKey]) groupedLogs[weekKey] = [];
        groupedLogs[weekKey].push(entry);
    });

    contentArea.innerHTML = `
        <div class="section-header">
            <div>
                <h2>Logs de Auditoría</h2>
                <p>Historial completo de actividades del sistema agrupado por semana</p>
            </div>
            <button class="btn btn-outline btn-sm" onclick="exportLogsCSV()"><i data-lucide="download"></i> Exportar Logs</button>
        </div>
        
        <div class="audit-timeline">
            ${Object.keys(groupedLogs).slice(0, 4).map(week => `
                <div class="audit-week-group" style="margin-bottom:32px;">
                    <div style="background:#f1f5f9; padding:8px 16px; border-radius:8px; display:inline-block; font-weight:700; font-size:0.85rem; color:var(--primary); margin-bottom:16px;">
                        📅 ${week}
                    </div>
                    <div class="data-table-container">
                        <table class="premium-table">
                            <thead><tr><th>Fecha / Hora</th><th>Tipo</th><th>Actividad</th></tr></thead>
                            <tbody>
                                ${groupedLogs[week].map(log => `
                                    <tr>
                                        <td data-label="Fecha / Hora">
                                            <p style="font-weight:600; color:var(--text-main); font-size:0.85rem;">${UI.formatDate(log.date).split(',')[0]}</p>
                                            <p style="font-size:0.75rem; color:var(--text-muted);">${UI.formatDate(log.date).split(',')[1] || ''}</p>
                                        </td>
                                        <td data-label="Tipo"><span class="badge badge-type-${log.type}" style="padding:4px 10px; font-weight:700; font-size:0.7rem; text-transform:uppercase;">${log.type}</span></td>
                                        <td data-label="Actividad" style="font-weight:500; font-size:0.85rem; color:var(--text-main);">${log.message}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `).join('') || '<p style="text-align:center; padding:40px; color:var(--text-muted);">No hay actividades registradas aún.</p>'}
            ${Object.keys(groupedLogs).length > 4 ? '<p style="text-align:center; font-size:0.8rem; color:var(--text-muted);">... historial antiguo archivado para optimizar rendimiento ...</p>' : ''}
        </div>
    `;
    lucide.createIcons();
}

function exportLogsCSV() {
    let csv = "Fecha,Tipo,Actividad\n";
    logs.forEach(l => {
        csv += `${l.date},${l.type},"${l.message.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// 1. Dashboard Logic
function renderDashboard() {
    const totalSalesBS = sales.reduce((acc, s) => acc + (s.totalBS || 0), 0);
    const totalSalesUSD = currentBCVRate > 0 ? (totalSalesBS / currentBCVRate) : 0;

    const totalDebt = clients.reduce((acc, c) => acc + c.debt, 0);
    const totalDebtUSD = currentBCVRate > 0 ? (totalDebt / currentBCVRate) : 0;

    const clientCount = clients.length;

    contentArea.innerHTML = `
        <div class="dashboard-stats">
            <div class="stat-card">
                <div class="stat-icon purple"><i data-lucide="trending-up"></i></div>
                <div class="stat-info">
                    <h3 style="margin-bottom: 4px; font-size: 0.75rem;">VENTAS TOTALES</h3>
                    <p style="font-weight: 800; font-size: 1.6rem; color: var(--primary);">${UI.formatUSD(totalSalesUSD)}</p>
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">${UI.formatCurrency(totalSalesBS)}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange"><i data-lucide="wallet"></i></div>
                <div class="stat-info">
                    <h3 style="margin-bottom: 4px; font-size: 0.75rem;">DEUDA TOTAL</h3>
                    <p style="font-weight: 800; font-size: 1.6rem; color: var(--primary);">${UI.formatUSD(totalDebtUSD)}</p>
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">${UI.formatCurrency(totalDebt)}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue"><i data-lucide="users"></i></div>
                <div class="stat-info"><h3>Clientes</h3><p>${clientCount}</p></div>
            </div>
            <div class="stat-card" style="cursor:pointer;" onclick="showLowStockModal()">
                <div class="stat-icon green"><i data-lucide="package"></i></div>
                <div class="stat-info"><h3>Bajo Stock</h3><p>${products.filter(p => p.stock <= settings.lowStockThreshold).length}</p></div>
            </div>
        </div>

        <div class="dashboard-chart-container stat-card" style="padding:24px; margin-bottom: 32px; height: 350px; border:none; box-shadow:var(--shadow-sm);">
            <div class="table-header"><h3>Tendencia de Ventas (7 días)</h3></div>
            <div style="height: 250px;"><canvas id="salesTrendsChart"></canvas></div>
        </div>

        <div class="grid-2-cols" style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 24px;">
            <div class="data-table-container" id="recent-sales-dashboard">
                <div class="table-header" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                    <h3>Ventas Recientes</h3>
                    <button class="btn btn-outline btn-sm" onclick="navigateTo('historial')">Ver Historial</button>
                </div>
                <div class="table-responsive">
                    <table class="premium-table">
                        <thead>
                            <tr>
                                <th>Ref.</th>
                                <th>Cliente</th>
                                <th>Monto</th>
                                <th>Estado</th>
                                <th style="text-align:right;">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="recent-sales-list">
                            ${sales.slice(-6).reverse().map(s => {
        const clientName = clients.find(c => c.id == s.clientId)?.name || 'General';
        const isDebt = s.paymentType?.toLowerCase().includes('deud') || s.paymentType?.toLowerCase().includes('debt') || s.paymentType === 'mixto/deuda';
        return `
                                <tr>
                                    <td data-label="Ref."><span class="text-id">#${s.id.toString().slice(-5)}</span></td>
                                    <td data-label="Cliente">
                                        <div style="display:flex; align-items:center; gap:10px;">
                                            <div class="mini-avatar">${clientName.charAt(0)}</div>
                                            <span style="font-weight:600; font-size:0.9rem;">${clientName}</span>
                                        </div>
                                    </td>
                                    <td data-label="Monto">
                                        <div style="display:flex; flex-direction:column;">
                                            <span class="text-price">${UI.formatCurrency(s.totalBS || 0)}</span>
                                            <small style="color:var(--text-muted); font-size:0.75rem;">$${(s.totalUSD || 0).toFixed(2)}</small>
                                        </div>
                                    </td>
                                    <td data-label="Estado">
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <span class="badge ${isDebt ? 'bg-danger' : 'bg-success'}" style="padding:4px 8px; font-size:0.7rem;">
                                                ${isDebt ? 'Pendiente' : 'Pagado'}
                                            </span>
                                        </div>
                                    </td>
                                    <td style="text-align:right;">
                                        <button class="btn-icon" onclick="printTicket(${s.id})" style="margin-left:auto;">
                                            <i data-lucide="eye" style="width:16px; height:16px;"></i>
                                        </button>
                                    </td>
                                </tr>
                            `;
    }).join('') || '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">No hay ventas recientes</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="data-table-container">
                <div class="table-header" style="margin-bottom:20px; padding-top:10px;">
                    <h3>Reposición Crítica</h3>
                </div>
                <div class="stock-list-container">
                    ${products.filter(p => p.stock <= settings.lowStockThreshold).slice(0, 8).map(p => `
                        <div style="display:flex; align-items:center; gap:12px; padding: 14px 0; border-bottom:1px solid rgba(0,0,0,0.04);">
                            <div style="width:10px; height:10px; border-radius:50%; background:${p.stock < (settings.lowStockThreshold / 2) ? 'var(--danger)' : 'var(--tertiary)'}"></div>
                            <div style="flex:1;">
                                <p style="font-weight:600; font-size:0.9rem; line-height:1.2;">${p.name}</p>
                                <p style="font-size:0.75rem; color:var(--text-muted);">Código(s): ${p.code}</p>
                            </div>
                            <div style="text-align:right;">
                                <span style="display:block; font-weight:800; color:${p.stock < (settings.lowStockThreshold / 2) ? 'var(--danger)' : 'var(--text-main)'}">${p.stock} u.</span>
                                <small style="font-size:0.7rem; color:var(--text-muted);">Restante</small>
                            </div>
                        </div>
                    `).join('') || `
                        <div style="text-align:center; padding:30px 0;">
                            <i data-lucide="check-circle" style="color:var(--success); width:32px; height:32px; margin-bottom:10px;"></i>
                            <p style="color:var(--text-muted); font-size:0.85rem;">Inventario saludable</p>
                        </div>
                    `}
                </div>
                ${products.filter(p => p.stock <= settings.lowStockThreshold).length > 8 ? `
                    <button class="btn btn-outline btn-sm" style="width:100%; margin-top:16px;" onclick="navigateTo('inventario')">Ver todos</button>
                ` : ''}
            </div>
        </div>
    `;
    lucide.createIcons();
    Charts.renderMainChart('salesTrendsChart', sales);
}

// 2. Inventario Logic
/*function renderInventario() {
    contentArea.innerHTML = `
        <div class="data-table-container">
            <div class="table-header" style="margin-bottom: 3%;">
                <div class="search-container" style="width: 100%;">
                    <input type="text" placeholder="Filtrar productos..." id="inventory-search" style="width:100%; padding:15px; border-radius:12px; border:1px solid var(--border-color); font-size:1rem; box-shadow:var(--shadow-sm);">
                </div>
                <div class="search-container" style="width: 100%;" align="center">
                    <button class="btn btn-primary" onclick="showAddProductModal()" style="margin-top: 5%;">
                        <i data-lucide="plus"></i> Agregar Producto
                    </button>
                </div>
            </div>
                <table id="inventory-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Precio</th>
                            <th>Stock</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="inventory-list">
                        ${products.map(p => `
                            <tr>
                                <td data-label="Código">${p.code}</td>
                                <td data-label="Nombre">${p.name}</td>
                                <td data-label="Precio">
                                    <span style="font-weight:700;">${UI.formatUSD(p.priceUSD || 0)}</span><br>
                                    <small style="color:var(--text-muted);">${UI.formatCurrency((p.priceUSD || 0) * currentBCVRate)}</small>
                                </td>
                                <td data-label="Stock">
                                    <span style="color: ${p.stock <= settings.lowStockThreshold ? 'var(--danger)' : 'inherit'}">${p.stock}</span>
                                </td>
                                <td data-label="Acciones">
                                    <button class="btn btn-outline btn-sm" onclick="showEditProductModal(${p.id})">
                                        <i data-lucide="edit-2"></i>
                                    </button>
                                    <button class="btn btn-outline btn-sm" onclick="deleteProduct(${p.id})">
                                        <i data-lucide="trash-2"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
        </div>
    `;
    lucide.createIcons();

    document.getElementById('inventory-search').addEventListener('input', () => {
        UI.searchTable('inventory-search', 'inventory-list');
    });
}*/
// 2. Inventario Logic
function renderInventario() {
    contentArea.innerHTML = `
        <div class="data-table-container">
            <div class="table-header" style="margin-bottom: 3%; display: flex; gap: 16px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
                <div class="search-container" style="flex: 1; min-width: 200px;">
                    <input type="text" placeholder="🔍 Filtrar productos..." id="inventory-search" style="width:100%; padding:12px 16px; border-radius:12px; border:1px solid var(--border-color); font-size:0.95rem; box-shadow:var(--shadow-sm);">
                </div>
                <button class="btn btn-primary" onclick="showAddProductModal()" style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                    <i data-lucide="plus" style="width: 18px; height: 18px;"></i> Agregar Producto
                </button>
            </div>
            
            <!-- IMPORTANTE: NO usar overflow-x auto aquí para que funcione el responsive -->
            <table id="inventory-table" class="inventory-table-responsive">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Precio</th>
                        <th>Stock</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="inventory-list">
                    ${products.map(p => `
                        <tr>
                            <td data-label="📦 Código">
                                <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
                                    ${(() => {
            const codes = (p.code || '').toString().split(',').map(c => c.trim()).filter(c => c);
            const visible = codes.slice(0, 3);
            const hidden = codes.slice(3);
            let html = visible.map(c => `<span style="background:var(--bg-surface); padding:3px 6px; border-radius:4px; border:1px solid var(--border-color); font-size:0.75rem; white-space:nowrap;">${c}</span>`).join('');
            if (hidden.length > 0) {
                const hiddenHtml = hidden.map(c => `<span style="background:var(--bg-surface); padding:3px 6px; border-radius:4px; border:1px solid var(--border-color); font-size:0.75rem; white-space:nowrap;">${c}</span>`).join('');
                html += `<div id="hidden-codes-${p.id}" style="display:none; gap:4px; flex-wrap:wrap; align-items:center;">
                                                ${hiddenHtml}
                                                <button onclick="document.getElementById('hidden-codes-${p.id}').style.display='none'; document.getElementById('btn-expand-${p.id}').style.display='inline-flex'; event.stopPropagation();" style="background:#ef4444; border:none; border-radius:4px; color:white; padding:3px 8px; font-weight:800; cursor:pointer; font-size:0.75rem; transition:0.2s; display:flex; align-items:center; justify-content:center;" title="Contraer">X</button>
                                            </div>`;
                html += `<button id="btn-expand-${p.id}" onclick="document.getElementById('hidden-codes-${p.id}').style.display='flex'; this.style.display='none'; event.stopPropagation();" style="background:var(--border-color); border:none; border-radius:4px; color:var(--text-main); padding:2px 8px; font-weight:700; cursor:pointer; font-size:0.7rem; transition:0.2s; display:inline-flex; align-items:center;" title="Ver ${hidden.length} códigos más">...</button>`;
            }
            return html;
        })()}
                                </div>
                            </td>
                            <td data-label="🏷️ Nombre"><span>${p.name}</span></td>
                            <td data-label="💲 Precio">
                                <div style="display:flex; flex-direction:column; align-items:flex-end;">
                                    <span style="font-weight:700;">${UI.formatUSD(p.priceUSD || 0)}</span>
                                    <small style="color:var(--text-muted); display: block; font-size: 0.72rem; opacity:0.8;">${UI.formatCurrency((p.priceUSD || 0) * currentBCVRate)}</small>
                                </div>
                            </td>
                            <td data-label="📊 Stock">
                                <span style="background: ${p.stock <= settings.lowStockThreshold ? 'rgba(244, 63, 94, 0.15)' : 'rgba(34, 197, 94, 0.15)'}; 
                                             color: ${p.stock <= settings.lowStockThreshold ? '#fb7185' : '#34d399'}; 
                                             padding: 4px 12px; border-radius: 8px; font-weight: 700;">
                                    ${p.stock} u.
                                </span>
                            </td>
                            <td data-label="⚡ Acciones">
                                <button class="btn btn-outline btn-sm" onclick="showEditProductModal(${p.id})" style="padding: 6px 10px;">
                                    <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                                </button>
                                <button class="btn btn-outline btn-sm" onclick="deleteProduct(${p.id})" style="padding: 6px 10px;">
                                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            ${products.length === 0 ? `
                <div style="text-align: center; padding: 48px 24px; color: var(--text-muted);">
                    <i data-lucide="package" style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No hay productos registrados</p>
                    <button class="btn btn-primary" onclick="showAddProductModal()" style="margin-top: 16px;">Agregar primer producto</button>
                </div>
            ` : ''}
        </div>
    `;

    lucide.createIcons();

    const searchInput = document.getElementById('inventory-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            UI.searchTable('inventory-search', 'inventory-list');
        });
    }
    UI.paginateTable('inventory-list', 15);
}
// 3. Ventas (Nueva Venta) Logic
let cart = [];
let currentPOSPage = 1;

function renderVentas() {
    currentPOSPage = 1; // Resetear página al entrar

    contentArea.innerHTML = `
        <div class="sales-terminal" style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px;">
            <!-- Selector de Productos -->
            <div class="data-table-container">
                <div class="table-header">
                    <div id="scanner-container" style="display:none; margin-bottom:15px; background:#f8fafc; border-radius:12px; padding:10px; border:2px dashed var(--primary); width: 100%;">
                        <div id="reader" style="width:100%; border-radius:8px; overflow:hidden;"></div>
                        <button type="button" class="btn btn-outline btn-sm" onclick="UI.stopScanning()" style="width:100%; margin-top:10px;">Cerrar Cámara</button>
                    </div>

                    <div style="margin-bottom:20px; width: 100%; display: flex; gap: 8px;">
                        <input type="text" placeholder="🔍 Buscar producto..." id="pos-search" 
                            oninput="filterPOS(this.value); checkSecretCode(this.value)" 
                            style="flex:1; padding:15px; border-radius:12px; border:1px solid var(--border-color); font-size:1rem; box-shadow:var(--shadow-sm);">
                        <button class="btn btn-primary" onclick="UI.startScanning('pos-search', true)" style="padding:0 20px;"><i data-lucide="scan"></i></button>
                    </div>
                        
                        <div id="secret-tools" style="display:none; transition: all 0.3s ease; margin-top:12px; padding:12px; background:#f8fafc; border:2px dashed var(--primary); border-radius:12px;">
                            <p style="font-size:0.7rem; color:var(--primary); font-weight:700; margin-bottom:8px;">🛠️ MODO MANTENIMIENTO ACTIVADO</p>
                            <div style="display:flex; gap:10px;">
                                <button class="btn btn-primary" style="flex:1; font-size:0.75rem;" onclick="generateTestData()">
                                    <i data-lucide="database"></i> Generar 50 Ventas
                                </button>
                                <button class="btn btn-outline" style="flex:1; font-size:0.75rem; color:var(--danger); border-color:var(--danger);" onclick="clearAllData()">
                                    <i data-lucide="trash-2"></i> Limpiar TODO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Contenedor Paginado -->
                <div id="pos-products-container">
                    <div class="products-grid" id="pos-products" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; margin-top:16px;">
                        <!-- Se llena vía renderPOSProducts -->
                    </div>
                </div>
                
                <!-- Controles de Paginación -->
                <div id="pos-pagination" style="display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 20px; padding: 10px;">
                    <!-- Se llena dinámicamente -->
                </div>
            </div>

            <!-- Carrito y Checkout -->
            <div class="data-table-container" style="display: flex; flex-direction: column;">
                <div style="padding: 12px; display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); margin-bottom: 10px;">
                    <button class="btn btn-outline btn-sm" onclick="showRecargaModal()" style="flex:1; border-color:var(--primary); color:var(--primary); display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700;">
                        <i data-lucide="smartphone" style="width:16px;"></i> Recarga
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="showAvanceModal()" style="flex:1; border-color:var(--success); color:var(--success); display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700;">
                        <i data-lucide="hand-coins" style="width:16px;"></i> Avance
                    </button>
                </div>
                <div class="table-header" style="padding-top:0;"><h3>Carrito</h3></div>
                
                <div class="cart-items" id="cart-items-list" style="flex: 1; min-height: 300px; max-height: 500px; overflow-y: auto;">
                    <p style="text-align:center; color:var(--text-muted); padding: 20px;">El carrito está vacío</p>
                </div>

                <div class="cart-footer" style="border-top: 1px solid var(--border-color); padding-top: 20px; margin-top: 20px;">
                    <div class="checkout-form" style="display:flex; flex-direction:column; gap:16px;">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <label>Cliente</label>
                                <button class="btn btn-sm" onclick="showAddClientModal()" style="padding:2px 8px; font-size:0.7rem; color:var(--primary);">+ Nuevo</button>
                            </div>
                            <select id="sale-client" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                                <option value="0">Cliente General</option>
                                ${clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:700;">
                            <span>Total USD:</span>
                            <span id="cart-total-usd">$0.00</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:1.25rem; font-weight:800; color:var(--primary); margin-bottom:8px;">
                            <span>Total Bs.:</span>
                            <span id="cart-total-bs">Bs. 0,00</span>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                            <button class="btn btn-primary btn-sm" onclick="showConfirmSaleModal('movil')">Pago Móvil</button>
                            <button class="btn btn-secondary btn-sm" onclick="showConfirmSaleModal('debito')">Débito</button>
                            <button class="btn btn-outline btn-sm" onclick="showConfirmSaleModal('cash')">Dólares ($)</button>
                            <button class="btn btn-warning btn-sm" onclick="showConfirmSaleModal('cashbs')" style="color:white; background: #f59e0b; border:none;">Efectivo (Bs.)</button>
                            <button class="btn btn-success btn-sm" onclick="showConfirmSaleModal('debt')" style="grid-column: 1 / -1;">Deudor (Deuda)</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    updateCartUI();
    renderPOSProducts(products); // Carga inicial de productos paginados
    lucide.createIcons();
}

function filterPOS(val) {
    const query = val.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query));
    currentPOSPage = 1;
    renderPOSProducts(filtered);
}

function checkSecretCode(val) {
    const tools = document.getElementById('secret-tools');
    if (!tools) return;
    if (val.toUpperCase() === 'RONCITO') {
        tools.style.display = 'block';
        lucide.createIcons();
    } else {
        tools.style.display = 'none';
    }
}

function renderPOSProducts(list) {
    const container = document.getElementById('pos-products');
    const paginationContainer = document.getElementById('pos-pagination');
    if (!container || !paginationContainer) return;

    // Determinar tamaño de página por dispositivo
    const isMobile = window.innerWidth <= 768;
    const pageSize = isMobile ? 4 : 6;
    
    const totalPages = Math.ceil(list.length / pageSize);
    if (currentPOSPage > totalPages) currentPOSPage = Math.max(1, totalPages);

    const start = (currentPOSPage - 1) * pageSize;
    const end = start + pageSize;
    const paginatedList = list.slice(start, end);

    // Renderizar Productos
    if (paginatedList.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No se encontraron productos</p>`;
        paginationContainer.innerHTML = '';
        return;
    }

    container.innerHTML = paginatedList.map(p => `
        <div class="product-item-card" onclick="addToCart(${p.id})" 
             style="border: 1px solid var(--border-color); padding: 12px; border-radius: 12px; cursor: pointer; background: var(--bg-card); display:flex; flex-direction:column; gap:4px; transition: transform 0.2s;">
            <p style="font-weight:700; font-size:0.85rem; line-height:1.2; height:2rem; overflow:hidden;">${p.name}</p>
            <p style="color: var(--primary); font-weight:800; font-size:1.1rem; margin-top:4px;">${UI.formatUSD(p.priceUSD || 0)}</p>
            <p style="font-size: 0.7rem; color: var(--text-muted);">${UI.formatCurrency((p.priceUSD || 0) * currentBCVRate)}</p>
            <div style="margin-top:auto; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size: 0.65rem; padding: 2px 6px; border-radius:4px; background: ${p.stock <= settings.lowStockThreshold ? '#fee2e2' : '#f0fdf4'}; color: ${p.stock <= settings.lowStockThreshold ? '#ef4444' : '#22c55e'}; font-weight:600;">
                    Stock: ${p.stock}
                </span>
            </div>
        </div>
    `).join('');

    // Renderizar Controles de Paginación
    paginationContainer.innerHTML = `
        <button class="btn btn-outline btn-sm" ${currentPOSPage === 1 ? 'disabled style="opacity:0.5"' : ''} onclick="changePOSPage(-1)">
            <i data-lucide="chevron-left"></i>
        </button>
        <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted);">
            Página ${currentPOSPage} de ${totalPages}
        </span>
        <button class="btn btn-outline btn-sm" ${currentPOSPage === totalPages ? 'disabled style="opacity:0.5"' : ''} onclick="changePOSPage(1)">
            <i data-lucide="chevron-right"></i>
        </button>
    `;
    
    lucide.createIcons();
}

// --- Servicios Especiales ---

function showRecargaModal() {
    const html = `
        <form id="recarga-form" onsubmit="event.preventDefault(); processRecarga()">
            <div style="margin-bottom:16px;">
                <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:6px;">Monto de la Recarga (Bs.)</label>
                <input type="text" id="r-amount-bs" class="currency-input" required placeholder="0,00" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border-color); font-size:1.1rem;">
            </div>
            <div style="margin-bottom:16px;">
                <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:6px;">Ganancia / Comisión (%)</label>
                <input type="number" id="r-percentage" value="10" step="0.5" required style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border-color); font-size:1rem;">
            </div>
            <div style="margin-bottom:20px;">
                <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:6px;">Método de Pago Recibido</label>
                <select id="r-method" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border-color); background:white; font-size:1rem; cursor:pointer;">
                    <option value="movil">Pago Móvil</option>
                    <option value="debito">Débito</option>
                    <option value="efectivo $">Efectivo ($)</option>
                    <option value="efectivo Bs">Efectivo (Bs)</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; height:50px; font-weight:700;">Procesar Recarga</button>
        </form>
    `;
    UI.openModal("Servicio de Recarga", html);
    UI.maskCurrency(document.getElementById('r-amount-bs'));
}

function processRecarga() {
    const amountBS = UI.parseCurrency(document.getElementById('r-amount-bs').value);
    const percentage = parseFloat(document.getElementById('r-percentage').value) || 0;
    const method = document.getElementById('r-method').value;

    if (amountBS <= 0) return UI.showToast("Monto inválido", "error");

    const profitBS = amountBS * (percentage / 100);
    const totalUSD = amountBS / currentBCVRate;
    const profitUSD = profitBS / currentBCVRate;
    const costUSD = totalUSD - profitUSD;

    const sale = {
        id: Date.now(),
        date: new Date().toISOString(),
        clientId: 0,
        items: [{
            id: 'srv_recarga',
            name: 'Recarga Telefónica / Otros',
            qty: 1,
            priceUSD: totalUSD,
            costUSD: costUSD
        }],
        totalUSD: totalUSD,
        totalBS: amountBS,
        paymentMethods: { [method]: method === 'efectivo $' ? (amountBS / currentBCVRate) : amountBS },
        paymentType: 'completo',
        bcvRate: currentBCVRate,
        isService: true
    };

    sales.push(sale);
    addLog('servicio', `Recarga realizada por ${UI.formatCurrency(amountBS)} (Ganancia: ${UI.formatCurrency(profitBS)})`);
    saveAll();
    UI.closeModal();
    UI.showToast("Recarga registrada con éxito", "success");
    renderSection('ventas');
}

function showAvanceModal() {
    const html = `
        <form id="avance-form" onsubmit="event.preventDefault(); processAvance()">
            <div style="margin-bottom:16px;">
                <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:6px;">Monto a Entregar al Cliente (Bs. Efectivo)</label>
                <input type="text" id="a-advance-bs" class="currency-input" required placeholder="0,00" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border-color); font-size:1.1rem; color:var(--danger); font-weight:700;">
            </div>
            <div style="margin-bottom:16px;">
                <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:6px;">Comisión a Cobrar (Bs.)</label>
                <input type="text" id="a-commission-bs" class="currency-input" required placeholder="0,00" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border-color); color:var(--success); font-weight:700; font-size:1.1rem;">
            </div>
            <div style="margin-bottom:20px;">
                <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:6px;">Método de Recepción del Dinero</label>
                <select id="a-method" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border-color); background:white; font-size:1rem; cursor:pointer;">
                    <option value="movil">Pago Móvil</option>
                    <option value="debito">Débito</option>
                    <option value="efectivo $">Efectivo ($)</option>
                </select>
                <p style="font-size:0.7rem; color:var(--text-muted); margin-top:8px; line-height:1.4;">
                    * El sistema registrará el ingreso total (monto + comisión) y descontará el costo (monto entregado) para reflejar la ganancia exacta.
                </p>
            </div>
            <button type="submit" class="btn btn-success" style="width:100%; height:50px; font-weight:700;">Procesar Avance</button>
        </form>
    `;
    UI.openModal("Avance de Efectivo", html);
    UI.maskCurrency(document.getElementById('a-advance-bs'));
    UI.maskCurrency(document.getElementById('a-commission-bs'));
}

function processAvance() {
    const advanceBS = UI.parseCurrency(document.getElementById('a-advance-bs').value);
    const commissionBS = UI.parseCurrency(document.getElementById('a-commission-bs').value);
    const method = document.getElementById('a-method').value;

    if (advanceBS <= 0) return UI.showToast("Monto de avance inválido", "error");

    const totalReceivedBS = advanceBS + commissionBS;
    const totalUSD = totalReceivedBS / currentBCVRate;
    const profitUSD = commissionBS / currentBCVRate;
    const costUSD = advanceBS / currentBCVRate;

    const sale = {
        id: Date.now(),
        date: new Date().toISOString(),
        clientId: 0,
        items: [{
            id: 'srv_avance',
            name: 'Avance de Efectivo',
            qty: 1,
            priceUSD: totalUSD,
            costUSD: costUSD
        }],
        totalUSD: totalUSD,
        totalBS: totalReceivedBS,
        paymentMethods: { [method]: method === 'efectivo $' ? (totalReceivedBS / currentBCVRate) : totalReceivedBS },
        paymentType: 'completo',
        bcvRate: currentBCVRate,
        isService: true
    };

    sales.push(sale);
    addLog('servicio', `Avance de efectivo: Entregado ${UI.formatCurrency(advanceBS)}, Cobrado ${UI.formatCurrency(totalReceivedBS)}`);
    saveAll();
    UI.closeModal();
    UI.showToast("Avance registrado con éxito", "success");
    renderSection('ventas');
}

// Función para cambiar de página
function changePOSPage(dir) {
    currentPOSPage += dir;
    const searchInput = document.getElementById('pos-search');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const filtered = products.filter(p => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query));
    renderPOSProducts(filtered);
    // Scroll suave hacia los productos
    document.getElementById('pos-products-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 4. Clientes Logic
function renderClientes() {
    const totalClients = clients.length;
    const clientDebt = clients.reduce((acc, c) => acc + c.debt, 0);
    const debtorCount = clients.filter(c => c.debt > 0).length;

    contentArea.innerHTML = `
        <div class="dashboard-stats" style="margin-bottom: 24px;">
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">
                    <i data-lucide="users"></i>
                </div>
                <div class="stat-info">
                    <p>${clients.length}</p>
                    <span>Total Clientes</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);">
                    <i data-lucide="wallet"></i>
                </div>
                <div class="stat-info">
                    <p>${UI.formatCurrency(clientDebt)}</p>
                    <span>Deuda Global (Bs.)</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1); color: var(--warning);">
                    <i data-lucide="alert-triangle"></i>
                </div>
                <div class="stat-info">
                    <p>${debtorCount}</p>
                    <span>Deudores Activos</span>
                </div>
            </div>
        </div>

        <div class="data-table-container">
            <div class="table-header" style="flex-wrap: wrap; gap: 15px;">
                <div class="search-container" style="min-width: 250px; flex: 1;">
                    <i data-lucide="search"></i>
                    <input type="text" placeholder="Buscar cliente o teléfono..." id="client-search" onkeyup="UI.searchTable('client-search', 'clients-table')">
                </div>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="btn btn-outline btn-sm" onclick="exportClientesCSV()">
                        <i data-lucide="download"></i> Excel
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="showAddClientModal()">
                        <i data-lucide="user-plus"></i> Nuevo Cliente
                    </button>
                </div>
            </div>
            <table class="premium-table" id="clients-table" style="margin-top:25px;">
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th>Contacto</th>
                        <th>Estado de Cuenta</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="clients-list">
                    ${clients.map(c => {
        const initials = c.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        return `
                        <tr>
                            <td data-label="Cliente">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div class="mini-avatar">${initials}</div>
                                    <div>
                                        <p style="font-weight:700; color:var(--text-main);">${c.name}</p>
                                        <p style="font-size:0.75rem; color:var(--text-muted);">ID: #${c.id.toString().slice(-6)}</p>
                                    </div>
                                </div>
                            </td>
                            <td data-label="Contacto">
                                <p style="font-weight:600; color:var(--text-main);">${c.phone || '—'}</p>
                                <p style="font-size:0.75rem; color:var(--text-muted);">${c.email || 'Sin email'}</p>
                            </td>
                            <td data-label="Estado de Cuenta">
                                <p class="text-price" style="color: ${c.debt > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:800;">
                                    ${UI.formatCurrency(c.debt)}
                                </p>
                                <p style="font-size:0.7rem; color: ${c.debt > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:700; text-transform:uppercase;">
                                    ${c.debt > 0 ? '✖ Con Deuda' : '✓ Solvente'}
                                </p>
                            </td>
                            <td data-label="Acciones" style="text-align:right;">
                                <div style="display:flex; justify-content:flex-end; gap:6px;">
                                    <button class="btn btn-outline btn-sm" onclick="showEditClientModal(${c.id})" title="Editar">
                                        <i data-lucide="edit-2" style="width:14px;"></i>
                                    </button>
                                    <button class="btn btn-outline btn-sm" onclick="viewClientHistory(${c.id})" title="Historial">
                                        <i data-lucide="eye" style="width:14px;"></i>
                                    </button>
                                    <button class="btn btn-outline btn-sm" onclick="deleteClient(${c.id})" style="color:var(--danger);" title="Eliminar">
                                        <i data-lucide="trash-2" style="width:14px;"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
    }).join('') || '<tr><td colspan="4" style="text-align:center; padding: 40px;">No hay clientes registrados</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
    lucide.createIcons();
    document.getElementById('client-search').addEventListener('input', () => {
        UI.searchTable('client-search', 'clients-list');
    });
    UI.paginateTable('clients-list', 15);
}

function exportClientesCSV() {
    let csv = "Nombre,Teléfono,Email,Deuda Bs.\n";
    clients.forEach(c => {
        csv += `"${c.name}","${c.phone || ''}","${c.email || ''}",${c.debt.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// 5. Historial Logic
function renderHistorial() {
    const today = new Date().toISOString().split('T')[0];

    contentArea.innerHTML = `
        <div class="filter-panel" style="padding:20px; background:var(--bg-surface); border-radius:var(--border-radius-lg); margin-bottom:24px; border:1px solid var(--border-color); display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end;">
            <div style="flex:1; min-width:140px;">
                <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px; display:block;">Desde</label>
                <input type="date" id="date-from" value="${today}" style="width:100%;">
            </div>
            <div style="flex:1; min-width:140px;">
                <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px; display:block;">Hasta</label>
                <input type="date" id="date-to" value="${today}" style="width:100%;">
            </div>
            <button class="btn btn-primary" onclick="filterHistorialByDate()" style="height:46px; display:flex; align-items:center; gap:8px; padding:0 24px;">
                <i data-lucide="filter" style="width:18px;"></i> Filtrar
            </button>
            <button class="btn btn-outline" onclick="exportToCSV()" style="height:46px; display:flex; align-items:center; gap:8px;">
                <i data-lucide="download" style="width:18px;"></i> Exportar
            </button>
        </div>

        <div id="metrics-panel"></div>

        <div class="data-table-container">
            <table class="premium-table" id="history-table">
                <thead>
                    <tr>
                        <th>Fecha y Ref</th>
                        <th>Cliente</th>
                        <th>Contenido</th>
                        <th>Monto Total</th>
                        <th>Pago</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="history-list-body">
                    <!-- Dinámico -->
                </tbody>
            </table>
        </div>
    `;
    lucide.createIcons();
    filterHistorialByDate();
}

function filterHistorialByDate() {
    const from = document.getElementById('date-from').value;
    const to = document.getElementById('date-to').value;
    const listBody = document.getElementById('history-list-body');
    const metricsPanel = document.getElementById('metrics-panel');

    const filtered = sales.filter(s => {
        const date = s.date.split('T')[0];
        return date >= from && date <= to;
    });

    // Calculations
    let totalGeneratedUSD = 0;   // PFV: Precio Final de Venta (total vendido)
    let totalGeneratedBS = 0;
    let totalInvestmentUSD = 0;  // Inversión total (para card Inversión)
    let totalProducts = 0;
    let totalDebtIncurredUSD = 0;
    let totalAbonosUSD = 0;
    const productCount = {};

    filtered.forEach(s => {
        totalGeneratedUSD += s.totalUSD || 0;
        totalGeneratedBS += s.totalBS || 0;

        s.items.forEach(item => {
            totalInvestmentUSD += (item.costUSD || 0) * item.qty;
            totalProducts += item.qty;
            productCount[item.name] = (productCount[item.name] || 0) + item.qty;
        });

        // Deuda generada en esta venta (en USD)
        const debtBS = s.paymentMethods?.debt || 0;
        const debtUSD = s.totalBS > 0 ? (debtBS / s.totalBS) * (s.totalUSD || 0) : 0;
        totalDebtIncurredUSD += debtUSD;
    });

    // Abonos recibidos en el periodo (en USD)
    const periodPayments = payments.filter(p => {
        const pDate = p.date.split('T')[0];
        return pDate >= from && pDate <= to;
    });

    periodPayments.forEach(p => {
        totalAbonosUSD += p.amount / (p.bcvRate || currentBCVRate);
    });

    // --- Nueva Lógica: Ganancia Bruta menos Deuda Neta ---
    const grossProfitUSD = totalGeneratedUSD - totalInvestmentUSD;
    const netDebtInPeriodUSD = totalDebtIncurredUSD - totalAbonosUSD;

    const totalProfitUSD = grossProfitUSD - netDebtInPeriodUSD;

    const totalProfitBS = totalProfitUSD * currentBCVRate;

    // Producto más vendido
    const sortedProducts = Object.entries(productCount).sort((a, b) => b[1] - a[1]);
    const mostSold = sortedProducts[0]?.[0] || 'N/A';
    const mostSoldQty = sortedProducts[0]?.[1] || 0;

    // Actualizar Panel de Métricas
    metricsPanel.innerHTML = `
        <div class="dashboard-stats" style="margin-bottom: 24px;">
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">
                    <i data-lucide="shopping-cart"></i>
                </div>
                <div class="stat-info">
                    <h3 style="margin-bottom: 4px; font-size: 0.75rem; text-transform: uppercase;">Total Vendido</h3>
                    <p style="font-weight: 800; font-size: 1.6rem; color: var(--primary);">${UI.formatUSD(totalGeneratedUSD)}</p>
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">${UI.formatCurrency(totalGeneratedBS)}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);">
                    <i data-lucide="trending-down"></i>
                </div>
                <div class="stat-info">
                    <h3 style="margin-bottom: 4px; font-size: 0.75rem; text-transform: uppercase;">Inversión</h3>
                    <p style="font-weight: 800; font-size: 1.6rem; color: var(--danger);">${UI.formatUSD(totalInvestmentUSD)}</p>
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">${UI.formatCurrency(totalInvestmentUSD * currentBCVRate)}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: ${totalProfitUSD >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${totalProfitUSD >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    <i data-lucide="${totalProfitUSD >= 0 ? 'trending-up' : 'trending-down'}"></i>
                </div>
                <div class="stat-info">
                    <h3 style="margin-bottom: 4px; font-size: 0.75rem; text-transform: uppercase;">Ganancia Neta</h3>
                    <p style="font-weight: 800; font-size: 1.6rem; color: ${totalProfitUSD >= 0 ? 'var(--success)' : 'var(--danger)'};">${UI.formatUSD(totalProfitUSD)}</p>
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">${UI.formatCurrency(totalProfitBS)}</span>
                </div>
            </div>
            <div class="stat-card">
                 <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1); color: var(--warning);">
                    <i data-lucide="award"></i>
                </div>
                <div class="stat-info">
                    <h3 style="margin-bottom: 4px; font-size: 0.75rem; text-transform: uppercase;">Más Vendido</h3>
                    <p style="font-weight: 800; font-size: 1.1rem; color: var(--text-main);">${mostSold}</p>
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Cant: ${mostSoldQty} unids.</span>
                </div>
            </div>
        </div>
    `;

    // Actualizar Tabla de Historial (listBody ya declarado arriba)
    listBody.innerHTML = filtered.length > 0 ? filtered.slice().reverse().map(s => {
        const client = clients.find(c => c.id == s.clientId);
        const clientName = client ? client.name : (s.clientName || 'General');
        const initials = clientName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

        return `
            <tr>
                <td data-label="Fecha y Ref">
                    <p style="font-weight:700; color:var(--text-main);">${UI.formatDate(s.date).split(',')[0]}</p>
                    <p style="font-size:0.75rem; color:var(--text-muted);">${UI.formatDate(s.date).split(',')[1] || ''} | #${s.id.toString().slice(-6)}</p>
                </td>
                <td data-label="Cliente">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="mini-avatar" style="width:30px; height:30px; font-size:0.75rem;">${initials}</div>
                        <p style="font-weight:600; font-size:0.9rem;">${clientName}</p>
                    </div>
                </td>
                <td data-label="Contenido">
                    <p style="font-size:0.85rem; font-weight:500;">${s.items.length} productos</p>
                    <p style="font-size:0.7rem; color:var(--text-muted);">${s.items.map(i => i.name).join(', ').substring(0, 40)}${s.items.length > 2 ? '...' : ''}</p>
                </td>
                <td data-label="Monto Total">
                    <p class="text-price" style="font-weight:800; font-size:1.1rem;">${UI.formatCurrency(s.totalBS)}</p>
                    <p style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${UI.formatUSD(s.totalUSD)}</p>
                </td>
                <td data-label="Pago">
                    <div style="display:flex; flex-direction:column; gap:3px;">
                        ${Object.entries(s.paymentMethods || {}).filter(([_, v]) => v > 0).map(([k, v]) => `
                            <span style="font-size:0.6rem; padding:2px 6px; border-radius:4px; background:rgba(0,0,0,0.05); font-weight:700; text-transform:uppercase; color:var(--text-main);">
                                ${k}: ${k === 'cash' ? UI.formatUSD(v) : UI.formatCurrency(v)}
                            </span>
                        `).join('')}
                    </div>
                </td>
                <td data-label="Acciones" style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:6px;">
                        <button class="btn btn-outline btn-sm" onclick="printReceipt(${s.id})" title="Reimprimir Ticket">
                            <i data-lucide="printer" style="width:14px;"></i>
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="deleteSale(${s.id})" style="color:var(--danger);" title="Eliminar Venta">
                            <i data-lucide="trash-2" style="width:14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('') : '<tr><td colspan="6" style="text-align:center; padding: 40px; color:var(--text-muted);">No se encontraron ventas para este periodo</td></tr>';

    lucide.createIcons();
    UI.paginateTable('history-list-body', 15);
}

// 6. Egresos Logic
function renderEgresos() {
    const totalEgresosUSD = egresos.reduce((acc, e) => acc + (e.amountUSD || 0), 0);
    const totalEgresosBS = egresos.reduce((acc, e) => acc + (e.amountBS || 0), 0);

    contentArea.innerHTML = `
        <div class="dashboard-stats" style="margin-bottom:24px;">
            <div class="stat-card">
                <div class="stat-icon orange"><i data-lucide="minus-circle"></i></div>
                <div class="stat-info"><h3>Total Egresos USD</h3><p>${UI.formatUSD(totalEgresosUSD)}</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange"><i data-lucide="minus-circle"></i></div>
                <div class="stat-info"><h3>Total Egresos Bs.</h3><p>${UI.formatCurrency(totalEgresosBS)}</p></div>
            </div>
        </div>

        <div class="action-bar" style="margin-bottom:32px;">
            <button class="btn btn-primary btn-lg" onclick="showAddEgresoModal()" style="width:100%; display:flex; align-items:center; justify-content:center; gap:12px; padding:18px; font-size:1.1rem; font-weight:700; border-radius:16px;">
                <i data-lucide="plus-circle"></i> Registrar Nuevo Egreso
            </button>
        </div>

        <div class="data-table-container">
            <div class="table-header"><h3>Listado de Egresos / Gastos</h3></div>
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Concepto / Descripción</th>
                        <th>Monto USD</th>
                        <th>Monto Bs.</th>
                        <th>Tasa</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="egresos-list">
                    ${egresos.length > 0 ? egresos.slice().reverse().map(e => `
                        <tr>
                            <td data-label="Fecha">
                                <p style="font-weight:600; color:var(--text-main); font-size:0.85rem;">${UI.formatDate(e.date).split(',')[0]}</p>
                                <p style="font-size:0.75rem; color:var(--text-muted);">${UI.formatDate(e.date).split(',')[1] || ''}</p>
                            </td>
                            <td data-label="Concepto">
                                <p style="font-weight:700; color:var(--text-main);">${e.category}</p>
                                <p style="font-size:0.75rem; color:var(--text-muted);">${e.description}</p>
                            </td>
                            <td data-label="Monto USD">
                                <p class="text-price" style="font-weight:700;">${UI.formatUSD(e.amountUSD)}</p>
                            </td>
                            <td data-label="Monto Bs.">
                                <p class="text-price" style="color:var(--danger); font-weight:800;">${UI.formatCurrency(e.amountBS)}</p>
                            </td>
                            <td data-label="Tasa">
                                <p style="font-size:0.8rem; color:var(--text-muted);">Bs. ${e.bcvRate.toFixed(2)}</p>
                            </td>
                            <td data-label="Acciones" style="text-align:right;">
                                <div style="display:flex; justify-content:flex-end; gap:6px;">
                                    <button class="btn btn-outline btn-sm" onclick="deleteEgreso(${e.id})" style="color:var(--danger);" title="Eliminar">
                                        <i data-lucide="trash-2" style="width:14px;"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="6" style="text-align:center; padding:32px;">No se han registrado egresos aún.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
    lucide.createIcons();
    UI.paginateTable('egresos-list', 15);
}

function showAddEgresoModal() {
    UI.openModal("Registrar Nuevo Egreso", `
        <form id="egreso-form" onsubmit="event.preventDefault(); saveEgreso()">
            <div style="margin-bottom:12px;">
                <label>Concepto / Categoría</label>
                <select id="e-category" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                    <option value="Compra Mercancía">Compra de Mercancía</option>
                    <option value="Servicios">Pago de Servicios (Internet, Luz, etc.)</option>
                    <option value="Sueldos">Pago de Sueldos</option>
                    <option value="Alquiler">Alquiler</option>
                    <option value="Otros">Otros Impulsos</option>
                </select>
            </div>
            <div style="margin-bottom:12px;">
                <label>Descripción detallada</label>
                <textarea id="e-description" placeholder="Escribe el detalle del gasto..." style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); height:80px;"></textarea>
            </div>
            <div style="margin-bottom:12px;">
                 <label>Monto ($)</label>
                 <input type="number" step="0.01" id="e-amount-usd" required oninput="calculateEgresoBS()" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);" placeholder="0.00">
            </div>
            <div style="margin-bottom:12px;">
                 <label>Monto en Bolívares (Calculado automáticamente)</label>
                 <input type="number" step="0.01" id="e-amount-bs" required style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--primary); font-weight:700; font-size:1.1rem;" readonly>
                 <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Tasa BCV: ${currentBCVRate.toFixed(2)} Bs/$</p>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">Guardar Egreso</button>
        </form >
        `);
}

function calculateEgresoBS() {
    const usd = parseFloat(document.getElementById('e-amount-usd').value) || 0;
    document.getElementById('e-amount-bs').value = (usd * currentBCVRate).toFixed(2);
}

function saveEgreso() {
    const egreso = {
        id: Date.now(),
        date: new Date().toISOString(),
        category: document.getElementById('e-category').value,
        description: document.getElementById('e-description').value,
        amountUSD: parseFloat(document.getElementById('e-amount-usd').value),
        amountBS: parseFloat(document.getElementById('e-amount-bs').value),
        bcvRate: currentBCVRate
    };
    egresos.push(egreso);
    addLog('egreso', `Nuevo egreso registrado: ${egreso.category} por Bs.${egreso.amountBS.toFixed(2)}`);
    saveAll();
    UI.closeModal();
    renderEgresos();
    UI.showToast("Egreso registrado", "warning");
}

function deleteEgreso(id) {
    if (confirm("¿Eliminar este registro de gasto?")) {
        egresos = egresos.filter(e => e.id !== id);
        saveAll();
        renderEgresos();
        UI.showToast("Egreso eliminado");
    }
}

// 7. Deudas Logic
function renderDeudas() {
    const debtors = clients.filter(c => c.debt > 0);
    const totalDebtBS = debtors.reduce((sum, c) => sum + c.debt, 0);
    const totalDebtUSD = totalDebtBS / currentBCVRate;

    contentArea.innerHTML = `
        <div class="dashboard-stats" style="margin-bottom: 24px;">
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);">
                    <i data-lucide="alert-circle"></i>
                </div>
                <div class="stat-info">
                    <p>${UI.formatCurrency(totalDebtBS)}</p>
                    <span>Total por Cobrar (Bs.)</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(16, 185, 129, 0.1); color: var(--success);">
                    <i data-lucide="trending-up"></i>
                </div>
                <div class="stat-info">
                    <p>${UI.formatUSD(totalDebtUSD)}</p>
                    <span>Equivalente en USD</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">
                    <i data-lucide="users"></i>
                </div>
                <div class="stat-info">
                    <p>${debtors.length}</p>
                    <span>Deudores Activos</span>
                </div>
            </div>
        </div>

        <div class="data-table-container">
            <div class="table-header" style="flex-wrap: wrap; gap: 15px;">
                <h3>Gestión de Cobranzas</h3>
                <div class="search-container" style="min-width: 250px;">
                    <i data-lucide="search"></i>
                    <input type="text" id="debtor-search" placeholder="Buscar cliente..." onkeyup="UI.searchTable('debtor-search', 'debtors-table')">
                </div>
            </div>
            <table class="premium-table" id="debtors-table">
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th>Deuda Pendiente</th>
                        <th>Último Abono</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${debtors.length > 0 ? debtors.map(c => {
        const lastPayment = payments.filter(p => p.clientId == c.id).slice(-1)[0];
        const initials = c.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        return `
                            <tr>
                                <td data-label="Cliente">
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <div class="mini-avatar">${initials}</div>
                                        <div>
                                            <p style="font-weight:700; color:var(--text-main);">${c.name}</p>
                                            <p style="font-size:0.75rem; color:var(--text-muted);">ID: #${c.id.toString().slice(-6)}</p>
                                        </div>
                                    </div>
                                </td>
                                <td data-label="Deuda Pendiente">
                                    <p class="text-price" style="color:var(--danger); font-weight:800;">${UI.formatCurrency(c.debt)}</p>
                                    <p style="font-size:0.75rem; color:var(--text-muted);">${UI.formatUSD(c.debt / currentBCVRate)}</p>
                                </td>
                                <td data-label="Último Abono">
                                    ${lastPayment ? `
                                        <p style="font-size:0.9rem; font-weight:600;">${UI.formatDate(lastPayment.date)}</p>
                                        <p style="font-size:0.75rem; color:var(--success); font-weight:600;">+ ${UI.formatCurrency(lastPayment.amount)}</p>
                                    ` : '<span style="color:var(--text-muted); font-size:0.85rem;">Sin abonos registrados</span>'}
                                </td>
                                <td data-label="Acciones" style="text-align:right;">
                                    <button class="btn btn-primary btn-sm" onclick="showAbonoModal(${c.id})" title="Registrar Abono">
                                        <i data-lucide="banknote" style="width:16px; height:16px; margin-right:6px;"></i> Abonar
                                    </button>
                                </td>
                            </tr>
                        `;
    }).join('') : '<tr><td colspan="4" style="text-align:center; padding: 40px; color:var(--text-muted);">No hay clientes con deuda pendiente</td></tr>'}
                </tbody>
            </table>
        </div >
        `;
    lucide.createIcons();
}

// --- Cart Actions ---
function addToCart(productId) {
    const product = products.find(p => p.id == productId);
    if (!product) return;
    if (product.stock <= 0) {
        UI.showToast("Stock insuficiente", "error");
        return;
    }

    const cartItem = cart.find(item => item.id == product.id);
    if (cartItem) {
        if (cartItem.qty >= product.stock) {
            UI.showToast("Stock máximo alcanzado", "warning");
            return;
        }
        cartItem.qty++;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById('cart-items-list');
    const totalUSD = document.getElementById('cart-total-usd');
    const totalBS = document.getElementById('cart-total-bs');

    if (cart.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding: 20px;">El carrito está vacío</p>';
        if (totalUSD) totalUSD.textContent = UI.formatUSD(0);
        if (totalBS) totalBS.textContent = UI.formatCurrency(0);
        return;
    }

    let total = 0;
    list.innerHTML = cart.map(item => {
        const itemPrice = item.priceUSD || 0;
        total += itemPrice * item.qty;
        return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                <div>
                    <p style="font-weight:600; font-size:0.9rem;">${item.name}</p>
                    <p style="font-size:0.8rem; color:var(--text-muted);">${UI.formatUSD(itemPrice)} x ${item.qty} = ${UI.formatUSD(itemPrice * item.qty)}</p>
                    <p style="font-size:0.75rem; color:var(--primary);">${UI.formatCurrency(itemPrice * item.qty * currentBCVRate)}</p>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                     <button class="btn btn-outline btn-sm" onclick="changeQty(${item.id}, -1)">-</button>
                     <button class="btn btn-outline btn-sm" onclick="changeQty(${item.id}, 1)">+</button>
                     <button class="btn btn-sm" style="color:var(--danger);" onclick="removeFromCart(${item.id})"><i data-lucide="trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
    totalUSD.textContent = UI.formatUSD(total);
    totalBS.textContent = UI.formatCurrency(total * currentBCVRate);
    lucide.createIcons();
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id == id);
    const product = products.find(p => p.id == id);
    if (item) {
        const newQty = item.qty + delta;
        if (newQty > 0 && newQty <= product.stock) {
            item.qty = newQty;
        } else if (newQty > product.stock) {
            UI.showToast("Stock insuficiente", "error");
        }
    }
    updateCartUI();
}

function removeFromCart(id) {
    cart = cart.filter(i => i.id != id);
    updateCartUI();
}

// --- Logic Operations (Storage Sync) ---

function showConfirmSaleModal(primaryType) {
    if (cart.length === 0) {
        UI.showToast("Agregue productos al carrito", "error");
        return;
    }

    const clientId = parseInt(document.getElementById('sale-client').value);
    const clientName = clients.find(c => c.id == clientId)?.name || 'Cliente General';
    const totalUSD = cart.reduce((acc, item) => acc + ((item.priceUSD || 0) * item.qty), 0);
    const totalBS = totalUSD * currentBCVRate;

    // Pre-fill logic
    const fill = { movil: 0, debito: 0, cash: 0, cashBS: 0, debt: 0 };
    if (primaryType === 'cash') fill.cash = totalUSD;
    else if (primaryType === 'cashbs') fill.cashBS = totalBS;
    else if (primaryType === 'debt') fill.debt = totalBS;
    else if (primaryType === 'movil') fill.movil = totalBS;
    else if (primaryType === 'debito') fill.debito = totalBS;

    const html = `
        <div style="margin-bottom:16px;">
            <p><strong>Cliente:</strong> ${clientName}</p>
        </div>
        
        <div id="payment-summary" style="background:var(--bg-main); padding:20px; border-radius:12px; margin-bottom:20px; text-align:center; border:2px dashed var(--border-color);">
             <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">MONTO RESTANTE POR COBRAR</div>
             <div id="payment-balance-text" style="font-size:2rem; font-weight:800; color:var(--primary);">Bs. 0,00</div>
             <div id="payment-balance-usd" style="font-size:0.9rem; color:var(--text-muted);">$0.00</div>
        </div>

        <div id="payment-methods-container" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
            <div class="pay-field">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Pago Móvil (Bs.)</label>
                <input type="text" id="pay-movil" class="currency-input pay-input" value="${fill.movil.toFixed(2).replace('.', ',')}" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem;" oninput="updatePaymentBalance(${totalBS}, ${currentBCVRate})">
            </div>
            <div class="pay-field">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Débito (Bs.)</label>
                <input type="text" id="pay-debito" class="currency-input pay-input" value="${fill.debito.toFixed(2).replace('.', ',')}" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem;" oninput="updatePaymentBalance(${totalBS}, ${currentBCVRate})">
            </div>
            <div class="pay-field">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Efectivo ($)</label>
                <input type="text" id="pay-cash" class="currency-input pay-input" value="${fill.cash.toFixed(2).replace('.', ',')}" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem; border-color:var(--success);" oninput="updatePaymentBalance(${totalBS}, ${currentBCVRate})">
            </div>
            <div class="pay-field">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Efectivo (Bs.)</label>
                <input type="text" id="pay-cash-bs" class="currency-input pay-input" value="${fill.cashBS.toFixed(2).replace('.', ',')}" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem; border-color:#f59e0b;" oninput="updatePaymentBalance(${totalBS}, ${currentBCVRate})">
            </div>
            <div class="pay-field" style="grid-column: 1 / -1;">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Deuda / Crédito (Bs.)</label>
                <input type="text" id="pay-debt" class="currency-input pay-input" value="${fill.debt.toFixed(2).replace('.', ',')}" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem; border-color:var(--danger);" oninput="updatePaymentBalance(${totalBS}, ${currentBCVRate})">
            </div>
        </div>

        <button class="btn btn-primary" id="btn-finish-payment" style="width:100%; height:55px; font-size:1.1rem; font-weight:700;" onclick="completeSale(${totalBS})">Finalizar Venta</button>
    `;

    UI.openModal("Generar Pago - Detalle", html);
    updatePaymentBalance(totalBS, currentBCVRate);
}

function updatePaymentBalance(totalToPay, bcv) {
    const movil = UI.parseCurrency(document.getElementById('pay-movil').value);
    const debito = UI.parseCurrency(document.getElementById('pay-debito').value);
    const cashUSD = UI.parseCurrency(document.getElementById('pay-cash').value);
    const cashBS = UI.parseCurrency(document.getElementById('pay-cash-bs').value);
    const cashUSD_inBS = cashUSD * bcv;
    const debt = UI.parseCurrency(document.getElementById('pay-debt').value);

    const paid = movil + debito + cashUSD_inBS + cashBS + debt;
    const balance = totalToPay - paid;

    const balanceText = document.getElementById('payment-balance-text');
    const balanceUSD = document.getElementById('payment-balance-usd');
    const summaryBox = document.getElementById('payment-summary');
    const finishBtn = document.getElementById('btn-finish-payment');

    if (balance > 0.05) {
        balanceText.innerText = UI.formatCurrency(balance);
        balanceUSD.innerText = UI.formatUSD(balance / bcv);
        balanceText.style.color = "var(--primary)";
        if (summaryBox) {
            summaryBox.style.borderColor = "var(--border-color)";
            summaryBox.style.background = "var(--bg-main)";
        }
        finishBtn.style.opacity = "0.5";
        finishBtn.innerText = "Falta cubrir el total...";
    } else if (balance < -0.05) {
        balanceText.innerText = "Sobra: " + UI.formatCurrency(Math.abs(balance));
        balanceUSD.innerText = "Cambio: " + UI.formatUSD(Math.abs(balance) / bcv);
        balanceText.style.color = "var(--success)";
        if (summaryBox) {
            summaryBox.style.borderColor = "var(--success)";
            summaryBox.style.background = "var(--bg-main)";
        }
        finishBtn.style.opacity = "1";
        finishBtn.innerText = "Finalizar Venta (con cambio)";
    } else {
        balanceText.innerText = "💰 PAGO EXACTO";
        balanceUSD.innerText = "Total Cubierto";
        balanceText.style.color = "#16a34a";
        if (summaryBox) {
            summaryBox.style.borderColor = "#16a34a";
            summaryBox.style.background = "#f0fdf4";
        }
        finishBtn.style.opacity = "1";
        finishBtn.innerText = "Finalizar Venta";
    }
}

function completeSale(targetTotalBS) {
    const clientId = parseInt(document.getElementById('sale-client').value);

    // Payments amounts
    const payMovil = UI.parseCurrency(document.getElementById('pay-movil').value);
    const payDebito = UI.parseCurrency(document.getElementById('pay-debito').value);
    const payCashUSD = UI.parseCurrency(document.getElementById('pay-cash').value);
    const payCashBS = UI.parseCurrency(document.getElementById('pay-cash-bs').value);
    const payDebt = UI.parseCurrency(document.getElementById('pay-debt').value);

    const totalPaidBS = payMovil + payDebito + (payCashUSD * currentBCVRate) + payCashBS + payDebt;

    if (totalPaidBS < targetTotalBS - 0.1) {
        UI.showToast("El pago es insuficiente para cubrir el total", "error");
        return;
    }

    // Check stock one last time
    for (const item of cart) {
        const p = products.find(prod => prod.id == item.id);
        if (p.stock < item.qty) {
            UI.showToast(`Stock insuficiente de ${p.name} `, "error");
            return;
        }
    }

    const totalUSD = cart.reduce((acc, item) => acc + ((item.priceUSD || 0) * item.qty), 0);

    // Process Sale
    const sale = {
        id: Date.now(),
        date: new Date().toISOString(),
        clientId: clientId,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            qty: item.qty,
            priceUSD: item.priceUSD,
            costUSD: item.costUSD || (item.priceUSD * 0.8)
        })),
        totalUSD: totalUSD,
        totalBS: targetTotalBS,
        paymentMethods: {
            movil: payMovil,
            debito: payDebito,
            'efectivo $': payCashUSD,
            'efectivo Bs': payCashBS,
            debt: payDebt
        },
        paymentType: payDebt > 0 ? 'mixto/deuda' : 'completo',
        bcvRate: currentBCVRate
    };

    // Update Stock
    cart.forEach(item => {
        const p = products.find(prod => prod.id == item.id);
        p.stock -= item.qty;
    });

    // Update Debt if deudor
    if (payDebt > 0 && clientId !== 0) {
        const client = clients.find(c => c.id == clientId);
        if (client) client.debt += payDebt;
    } else if (payDebt > 0 && clientId === 0) {
        UI.showToast("Debe seleccionar un cliente para registrar deudas", "error");
        return;
    }

    sales.push(sale);
    addLog('venta', `Venta registrada por ${UI.formatCurrency(targetTotalBS)} ($${totalUSD.toFixed(2)})`);
    saveAll();

    cart = [];
    UI.closeModal();
    UI.showToast("Venta realizada con éxito");
    renderSection('ventas');
}

// --- Inventory Modals ---
function showAddProductModal() {
    UI.openModal("Agregar Nuevo Producto", `
        <form id="product-form" onsubmit="event.preventDefault(); saveProduct()">
            <div id="scanner-container" style="display:none; margin-bottom:15px; background:#f8fafc; border-radius:12px; padding:10px; border:2px dashed var(--primary);">
                <div id="reader" style="width:100%; border-radius:8px; overflow:hidden;"></div>
                <button type="button" class="btn btn-outline btn-sm" onclick="UI.stopScanning()" style="width:100%; margin-top:10px;">Cerrar Cámara</button>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div style="margin-bottom:12px; grid-column: 1 / -1;"> 
                    <label>Código(s) de Barra</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="p-code" placeholder="Escribe o escanea..." required style="flex:1; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                        <button type="button" class="btn btn-primary" onclick="UI.startScanning('p-code')" style="padding:0 15px;"><i data-lucide="scan"></i></button>
                    </div>
                </div>
                <div style="margin-bottom:12px; grid-column: 1 / -1;"> <label>Nombre del Producto</label><input type="text" id="p-name" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>Costo ($)</label><input type="text" id="p-cost" class="currency-input" required oninput="calculatePriceUSD()" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>% Ganancia</label><input type="number" id="p-margin" value="20" required oninput="calculatePriceUSD()" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>Venta ($)</label><input type="text" id="p-price" class="currency-input" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:#f1f5f9;" readonly> </div>
                <div style="margin-bottom:12px;"> <label>Stock Inicial</label><input type="number" id="p-stock" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px; height:50px; font-weight:700;">Guardar Producto</button>
        </form>
        `);
    lucide.createIcons();
}

function calculatePriceUSD() {
    const cost = UI.parseCurrency(document.getElementById('p-cost').value);
    const margin = parseFloat(document.getElementById('p-margin').value) || 0;
    const price = cost + (cost * (margin / 100));
    
    // Formateo manual para el campo readonly ya que la máscara no actúa en cambios por JS
    const parts = price.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    document.getElementById('p-price').value = parts.join(',');
}

function saveProduct() {
    const newP = {
        id: Date.now(),
        code: document.getElementById('p-code').value,
        name: document.getElementById('p-name').value,
        costUSD: UI.parseCurrency(document.getElementById('p-cost').value),
        profitMargin: parseFloat(document.getElementById('p-margin').value),
        priceUSD: UI.parseCurrency(document.getElementById('p-price').value),
        stock: parseInt(document.getElementById('p-stock').value)
    };
    products.push(newP);
    saveAll();
    addLog('inventario', `Nuevo producto agregado: ${newP.name} `);
    UI.closeModal();
    renderInventario();
    UI.showToast("Producto agregado");
}

function showEditProductModal(id) {
    const p = products.find(prod => prod.id == id);
    UI.openModal("Editar Producto", `
        <form id="edit-product-form" onsubmit="event.preventDefault(); updateProduct(${id})">
            <div id="scanner-container" style="display:none; margin-bottom:15px; background:#f8fafc; border-radius:12px; padding:10px; border:2px dashed var(--primary);">
                <div id="reader" style="width:100%; border-radius:8px; overflow:hidden;"></div>
                <button type="button" class="btn btn-outline btn-sm" onclick="UI.stopScanning()" style="width:100%; margin-top:10px;">Cerrar Cámara</button>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div style="margin-bottom:12px; grid-column: 1 / -1;"> 
                    <label>Código(s) de Barra</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" id="p-code" value="${p.code}" placeholder="Ej: COD1, COD2" required style="flex:1; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                        <button type="button" class="btn btn-primary" onclick="UI.startScanning('p-code')" style="padding:0 15px;"><i data-lucide="scan"></i></button>
                    </div>
                </div>
                <div style="margin-bottom:12px; grid-column: 1 / -1;"> <label>Nombre</label><input type="text" id="p-name" value="${p.name}" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>Costo ($)</label><input type="text" id="p-cost" class="currency-input" value="${(p.costUSD || 0).toFixed(2).replace('.', ',')}" required oninput="calculatePriceUSD()" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>% Ganancia</label><input type="number" id="p-margin" value="${p.profitMargin || 20}" required oninput="calculatePriceUSD()" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>Precio Venta ($)</label><input type="text" id="p-price" class="currency-input" value="${(p.priceUSD || 0).toFixed(2).replace('.', ',')}" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:#f1f5f9;" readonly> </div>
                <div style="margin-bottom:12px;"> <label>Stock</label><input type="number" id="p-stock" value="${p.stock}" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">Actualizar Producto</button>
        </form>
        `);
    lucide.createIcons();
}

function updateProduct(id) {
    const p = products.find(prod => prod.id == id);
    p.code = document.getElementById('p-code').value;
    p.name = document.getElementById('p-name').value;
    p.costUSD = UI.parseCurrency(document.getElementById('p-cost').value);
    p.profitMargin = parseFloat(document.getElementById('p-margin').value);
    p.priceUSD = UI.parseCurrency(document.getElementById('p-price').value);
    p.stock = parseInt(document.getElementById('p-stock').value);

    saveAll();
    addLog('inventario', `Producto actualizado: ${p.name} `);
    UI.closeModal();
    renderInventario();
    UI.showToast("Producto actualizado");
}

function deleteProduct(id) {
    if (confirm("¿Está seguro de eliminar este producto?")) {
        addLog('inventario', `Producto eliminado: ${products.find(p => p.id == id)?.name || id} `);
        products = products.filter(p => p.id != id);
        saveAll();
        renderInventario();
        UI.showToast("Producto eliminado", "warning");
    }
}

// --- Debt Actions ---
function showAbonoModal(clientId) {
    const client = clients.find(c => c.id == clientId);
    if (!client || client.debt <= 0) {
        UI.showToast("El cliente no tiene deudas pendientes", "info");
        return;
    }

    const totalToPay = client.debt;
    const debtUSD = totalToPay / currentBCVRate;

    const html = `
        <div style="margin-bottom:16px;">
            <p><strong>Cliente:</strong> ${client.name}</p>
        </div>
        
        <div id="abono-summary" style="background:var(--bg-main); padding:20px; border-radius:12px; margin-bottom:20px; text-align:center; border:2px dashed var(--border-color);">
             <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">SALDO PENDIENTE TRAS ABONO</div>
             <div id="abono-balance-text" style="font-size:2rem; font-weight:800; color:var(--danger);">${UI.formatCurrency(totalToPay)}</div>
             <div id="abono-balance-usd" style="font-size:0.9rem; color:var(--text-muted);">${UI.formatUSD(debtUSD)}</div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
            <div class="pay-field">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Pago Móvil (Bs.)</label>
                <input type="text" id="abono-pay-movil" class="currency-input pay-input" placeholder="0,00" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem;" oninput="updateAbonoBalance(${totalToPay}, ${currentBCVRate})">
            </div>
            <div class="pay-field">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Débito (Bs.)</label>
                <input type="text" id="abono-pay-debito" class="currency-input pay-input" placeholder="0,00" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem;" oninput="updateAbonoBalance(${totalToPay}, ${currentBCVRate})">
            </div>
            <div class="pay-field">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Efectivo ($)</label>
                <input type="number" id="abono-pay-cash" class="pay-input" step="0.01" min="0" placeholder="0.00" style="width:100%; padding:12px; border:2px solid var(--success); border-radius:10px; font-size:1.1rem;" oninput="updateAbonoBalance(${totalToPay}, ${currentBCVRate})">
                <p id="abono-cash-bs-ref" style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">≈ Bs. 0,00</p>
            </div>
            <div class="pay-field" style="display:flex; align-items:flex-end;">
                 <button class="btn btn-outline btn-sm" style="width:100%; height:46px;" onclick="fillAbonoExact(${totalToPay})">Abono Exacto</button>
            </div>
        </div>

        <button class="btn btn-primary" id="btn-finish-abono" style="width:100%; height:55px; font-size:1.1rem; font-weight:700;" onclick="saveAbonoMixed(${clientId})">Confirmar Abono(s)</button>
    `;

    UI.openModal("Registrar Abono - Detalle", html);
}

function updateAbonoBalance(debtTotal, bcv) {
    const movil = UI.parseCurrency(document.getElementById('abono-pay-movil').value);
    const debito = UI.parseCurrency(document.getElementById('abono-pay-debito').value);
    // El campo de dolares acepta USD directamente (sin mascara de centavos)
    const cashUSD = parseFloat(document.getElementById('abono-pay-cash').value) || 0;
    const cashBS = cashUSD * bcv;

    // Mostrar equivalente en Bs bajo el campo de dolares
    const cashBsRef = document.getElementById('abono-cash-bs-ref');
    if (cashBsRef) cashBsRef.innerText = '≈ ' + UI.formatCurrency(cashBS);

    const totalPaid = movil + debito + cashBS;
    const remaining = debtTotal - totalPaid;

    const balanceText = document.getElementById('abono-balance-text');
    const balanceUSD = document.getElementById('abono-balance-usd');
    const summaryBox = document.getElementById('abono-summary');
    const finishBtn = document.getElementById('btn-finish-abono');

    if (remaining > 0.01) {
        balanceText.innerText = UI.formatCurrency(remaining);
        balanceUSD.innerText = UI.formatUSD(remaining / bcv);
        balanceText.style.color = "var(--danger)";
        summaryBox.style.borderColor = "var(--border-color)";
        finishBtn.style.opacity = "1";
        finishBtn.innerText = "Registrar Abono Parcial";
    } else if (remaining < -0.05) {
        balanceText.innerText = "Sobra: " + UI.formatCurrency(Math.abs(remaining));
        balanceUSD.innerText = "Cambio: " + UI.formatUSD(Math.abs(remaining) / bcv);
        balanceText.style.color = "var(--success)";
        summaryBox.style.borderColor = "var(--success)";
        finishBtn.style.opacity = "1";
        finishBtn.innerText = "Finalizar (Deuda Pagada)";
    } else {
        balanceText.innerText = "💰 DEUDA CUBIERTA";
        balanceUSD.innerText = "Total Pagado";
        balanceText.style.color = "#16a34a";
        summaryBox.style.borderColor = "#16a34a";
        summaryBox.style.background = "#f0fdf4";
        finishBtn.style.opacity = "1";
        finishBtn.innerText = "Finalizar (Deuda Pagada)";
    }
}

function fillAbonoExact(total) {
    const input = document.getElementById('abono-pay-movil');
    const parts = total.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    input.value = parts.join(',');
    updateAbonoBalance(total, currentBCVRate);
}

function saveAbonoMixed(clientId) {
    const movil = UI.parseCurrency(document.getElementById('abono-pay-movil').value);
    const debito = UI.parseCurrency(document.getElementById('abono-pay-debito').value);
    // El campo de dolares es type="number", se lee directamente con parseFloat
    const cashUSD = parseFloat(document.getElementById('abono-pay-cash').value) || 0;
    
    const totalAbonado = movil + debito + (cashUSD * currentBCVRate);
    const client = clients.find(c => c.id == clientId);

    if (totalAbonado <= 0) {
        UI.showToast("Por favor ingrese algún monto", "error");
        return;
    }

    // Descontar de la deuda (nunca dejar deuda negativa)
    const effectiveAbono = Math.min(totalAbonado, client.debt);
    client.debt -= effectiveAbono;

    // Registrar los pagos realizados
    const now = new Date().toISOString();
    if (movil > 0) payments.push({ id: Date.now() + 1, clientId, amount: movil, method: 'Pago Móvil', bcvRate: currentBCVRate, date: now });
    if (debito > 0) payments.push({ id: Date.now() + 2, clientId, amount: debito, method: 'Débito', bcvRate: currentBCVRate, date: now });
    if (cashUSD > 0) payments.push({ id: Date.now() + 3, clientId, amount: cashUSD * currentBCVRate, method: 'Efectivo ($)', bcvRate: currentBCVRate, date: now });

    saveAll();
    addLog('abono', `Abonos por total de ${UI.formatCurrency(effectiveAbono)} para ${client.name}. Deuda restante: ${UI.formatCurrency(client.debt)}`);
    
    UI.closeModal();
    renderDeudas();
    if (window.location.hash === '#historial') filterHistorialByDate();
    UI.showToast("Abono(s) procesado(s) correctamente");
}

// --- Clients Actions ---
function showAddClientModal() {
    UI.openModal("Nuevo Cliente", `
        <form onsubmit="event.preventDefault(); saveClient()">
            <div style="margin-bottom:12px;"> <label>Nombre *</label><input type="text" id="c-name" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            <div style="margin-bottom:12px;"> <label>Teléfono</label><input type="text" id="c-phone" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            <div style="margin-bottom:12px;"> <label>Email</label><input type="email" id="c-email" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            <div style="margin-bottom:12px;"> <label>Dirección</label><input type="text" id="c-address" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">Guardar Cliente</button>
        </form>
        `);
}

function saveClient() {
    const client = {
        id: Date.now(),
        name: document.getElementById('c-name').value,
        phone: document.getElementById('c-phone').value,
        email: document.getElementById('c-email').value,
        address: document.getElementById('c-address')?.value || '',
        debt: 0,
        createdAt: new Date().toISOString()
    };
    clients.push(client);
    addLog('cliente', `Nuevo cliente registrado: ${client.name} `);
    saveAll();
    UI.closeModal();
    renderClientes();
    UI.showToast("Cliente registrado");
}

function showEditClientModal(id) {
    const c = clients.find(cl => cl.id == id);
    if (!c) return;
    UI.openModal(`Editar Cliente — ${c.name} `, `
        <form onsubmit="event.preventDefault(); updateClient(${id})">
            <div style="margin-bottom:12px;"> <label>Nombre *</label><input type="text" id="c-name" value="${c.name}" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            <div style="margin-bottom:12px;"> <label>Teléfono</label><input type="text" id="c-phone" value="${c.phone || ''}" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            <div style="margin-bottom:12px;"> <label>Email</label><input type="email" id="c-email" value="${c.email || ''}" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            <div style="margin-bottom:12px;"> <label>Dirección</label><input type="text" id="c-address" value="${c.address || ''}" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">Actualizar Cliente</button>
        </form>
        `);
}

function updateClient(id) {
    const c = clients.find(cl => cl.id == id);
    if (!c) return;
    c.name = document.getElementById('c-name').value;
    c.phone = document.getElementById('c-phone').value;
    c.email = document.getElementById('c-email').value;
    c.address = document.getElementById('c-address').value;
    saveAll();
    addLog('cliente', `Cliente actualizado: ${c.name} `);
    UI.closeModal();
    renderClientes();
    UI.showToast('Cliente actualizado');
}

function deleteClient(id) {
    const c = clients.find(cl => cl.id == id);
    if (!c) return;
    if (c.debt > 0) {
        if (!confirm(`⚠️ ${c.name} tiene una deuda activa de ${UI.formatCurrency(c.debt)}. ¿Eliminar de todas formas ? `)) return;
    } else {
        if (!confirm(`¿Eliminar al cliente "${c.name}" ? `)) return;
    }
    clients = clients.filter(cl => cl.id != id);
    saveAll();
    addLog('cliente', `Cliente eliminado: ${c.name} `);
    renderClientes();
    UI.showToast('Cliente eliminado', 'warning');
}

function viewClientHistory(clientId) {
    const client = clients.find(c => c.id == clientId);
    if (!client) return;
    const clientSales = sales.filter(s => s.clientId == clientId);
    const clientPayments = payments.filter(p => p.clientId == clientId);
    const totalPurchased = clientSales.reduce((acc, s) => acc + (s.totalBS || 0), 0);
    const totalPaid = clientPayments.reduce((acc, p) => acc + p.amount, 0);

    UI.openModal(`Historial — ${client.name} `, `
        <div class="stats-grid-modal">
            <div style="background:var(--bg-main); padding:12px; border-radius:10px; text-align:center;">
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">COMPRAS</div>
                <div style="font-size:1.1rem; font-weight:700;">${clientSales.length}</div>
            </div>
            <div style="background:var(--bg-main); padding:12px; border-radius:10px; text-align:center;">
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">TOTAL COMPRADO</div>
                <div style="font-size:1.1rem; font-weight:700;">${UI.formatCurrency(totalPurchased)}</div>
            </div>
            <div style="background:var(--bg-main); padding:12px; border-radius:10px; text-align:center; ${client.debt > 0 ? 'border: 2px solid var(--danger);' : ''}">
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">DEUDA ACTUAL</div>
                <div style="font-size:1.1rem; font-weight:700; color:${client.debt > 0 ? 'var(--danger)' : 'var(--success)'}">${UI.formatCurrency(client.debt)}</div>
            </div>
        </div>
        <h4 style="margin-bottom:10px; font-size:0.9rem; color:var(--text-muted);">ÚLTIMAS COMPRAS</h4>
        <div style="max-height:300px; overflow-y:auto; margin-bottom:16px;">
            <table class="responsive-table-modal" style="width:100%;">
                <thead><tr><th>Fecha</th><th>Total Bs.</th><th>Pago</th><th></th></tr></thead>
                <tbody>
                    ${clientSales.length > 0 ? clientSales.slice().reverse().slice(0, 10).map(s => `
                        <tr>
                            <td data-label="Fecha" style="font-size:0.8rem;">${UI.formatDate(s.date)}</td>
                            <td data-label="Monto" style="font-weight:700;">${UI.formatCurrency(s.totalBS || 0)}</td>
                            <td data-label="Método"><span class="badge ${s.paymentType?.includes('deud') || s.paymentType?.includes('debt') ? 'bg-danger' : 'bg-success'}">${s.paymentType}</span></td>
                            <td><button class="btn btn-sm btn-outline" onclick="printTicket(${s.id})"><i data-lucide="printer"></i> Ticket</button></td>
                        </tr>
                    `).join('') : '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Sin compras registradas</td></tr>'}
                </tbody>
            </table>
        </div>
        ${clientPayments.length > 0 ? `
            <h4 style="margin-bottom:10px; font-size:0.9rem; color:var(--text-muted);">ABONOS REALIZADOS</h4>
            <div style="max-height:150px; overflow-y:auto;">
                <table class="responsive-table-modal" style="width:100%;">
                    <thead><tr><th>Fecha</th><th>Monto Abonado</th></tr></thead>
                    <tbody>
                        ${clientPayments.slice().reverse().map(p => {
                            const isUSD = p.method?.includes('$') || p.method?.toLowerCase().includes('dolar');
                            const formattedAmount = isUSD ? UI.formatUSD(p.amount / (p.bcvRate || currentBCVRate)) : UI.formatCurrency(p.amount);
                            return `
                            <tr>
                                <td data-label="Fecha" style="font-size:0.8rem;">${UI.formatDate(p.date)}</td>
                                <td data-label="Abono" style="color:var(--success); font-weight:700;">${formattedAmount}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''
        }
        ${client.debt > 0 ? `<button class="btn btn-success" style="width:100%; margin-top:16px;" onclick="UI.closeModal(); showAbonoModal(${clientId})">Registrar Abono</button>` : ''}
    `);
    lucide.createIcons();
}

// --- Persistence Sync ---
async function saveAll() {
    try {
        await Promise.all([
            Storage.save('products', products),
            Storage.save('clients', clients),
            Storage.save('sales', sales),
            Storage.save('payments', payments),
            Storage.save('egresos', egresos),
            Storage.save('logs', logs),
            Storage.save('settings', settings)
        ]);
        updateGlobalAlerts();
        return true;
    } catch (e) {
        console.error("Error en sincronización global:", e);
        return false;
    }
}

function showLowStockModal() {
    const lowStockProducts = products.filter(p => p.stock <= settings.lowStockThreshold);

    UI.openModal("Aviso de Stock Bajo", `
        <div style="margin-bottom:20px; background:var(--bg-main); padding:16px; border-radius:12px; border:1px solid var(--border-color);" >
            <label style="font-weight:600; font-size:0.9rem; margin-bottom:8px; display:block;">Configurar nivel mínimo de stock para alertas:</label>
            <div style="display:flex; gap:12px;">
                <input type="number" id="threshold-input" value="${settings.lowStockThreshold}" style="flex:1; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                <button class="btn btn-primary btn-sm" onclick="saveLowStockSettings()">Cambiar Mínimo</button>
            </div>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">Actualmente se mostrarán todos los productos con ${settings.lowStockThreshold} unidades o menos.</p>
        </div>

        <div class="data-table-container">
            <table>
                <thead>
                    <tr><th>Producto</th><th>Stock</th><th>Ref. USD</th></tr>
                </thead>
                <tbody>
                    ${lowStockProducts.length > 0 ? lowStockProducts.map(p => `
                        <tr>
                            <td>${p.name}</td>
                            <td style="color:var(--danger); font-weight:700;">${p.stock} u.</td>
                            <td>${UI.formatUSD(p.priceUSD || 0)}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="3" style="text-align:center;">No hay productos bajo el mínimo configurado.</td></tr>'}
                </tbody>
            </table>
        </div>
    `);
}

function saveLowStockSettings() {
    const val = parseInt(document.getElementById('threshold-input').value);
    if (!isNaN(val) && val >= 0) {
        settings.lowStockThreshold = val;
        saveAll();
        UI.showToast("Umbral de stock actualizado");
        UI.closeModal();
        renderDashboard(); // Re-render table on dashboard
    } else {
        UI.showToast("Valor inválido", "error");
    }
}

// Maintenance Functions
function checkSecretCode(val) {
    const tools = document.getElementById('secret-tools');
    if (!tools) return;
    if (val.toUpperCase() === 'RONCITO') {
        tools.style.display = 'block';
        lucide.createIcons();
    } else {
        tools.style.display = 'none';
    }
}

function clearAllData() {
    if (!confirm("⚠️ ADVERTENCIA: Esta acción borrará permanentemente todos los productos, clientes, ventas y egresos del sistema. ¿Deseas continuar?")) return;

    // Explicitly set all keys to empty arrays to prevent defaults from loading
    Storage.save('products', []);
    Storage.save('clients', []);
    Storage.save('sales', []);
    Storage.save('payments', []);
    Storage.save('egresos', []);
    Storage.save('settings', { lowStockThreshold: 5 });

    // Also clear manual BCV if any
    localStorage.removeItem('soluventas_manual_bcv');
    addLog('sistema', `REINICIO TOTAL DEL SISTEMA - Se eliminaron todos los registros`);

    UI.showToast("Sistema reiniciado por completo", "warning");
    setTimeout(() => location.reload(), 1000);
}

// Test Data Generator
async function generateTestData() {
    if (!confirm("Esto agregará 50 ventas de prueba. ¿Continuar?")) return;

    // Forzar inicialización si falló el bootstrap
    if (!products) products = Storage.get('products') || [];
    if (!clients) clients = Storage.get('clients') || [];
    if (!sales) sales = Storage.get('sales') || [];

    // Asegurar que existan productos y clientes para la prueba
    if (products.length === 0) {
        products.push(
            { id: 101, code: 'TEST01', name: 'Producto de Prueba A', costUSD: 10, profitMargin: 20, priceUSD: 12, stock: 500 },
            { id: 102, code: 'TEST02', name: 'Producto de Prueba B', costUSD: 5, profitMargin: 50, priceUSD: 7.5, stock: 300 }
        );
    }

    if (clients.length === 0) {
        clients.push(
            { id: 201, name: 'Cliente de Prueba 1', phone: '0000', email: 'test1@test.com', debt: 0 },
            { id: 202, name: 'Cliente de Prueba 2', phone: '1111', email: 'test2@test.com', debt: 0 }
        );
    }

    const prodList = products;
    const clientList = clients;
    const methods = ['pago movil', 'debito', 'dolares', 'deudor'];

    for (let i = 0; i < 50; i++) {
        // Random date in last 30 days
        const d = new Date();
        d.setDate(d.getDate() - Math.floor(Math.random() * 30));
        d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

        const randomItems = [];
        const itemCount = Math.floor(Math.random() * 3) + 1;
        let totalUSD = 0;

        for (let j = 0; j < itemCount; j++) {
            const p = prodList[Math.floor(Math.random() * prodList.length)];
            const qty = Math.floor(Math.random() * 3) + 1;
            randomItems.push({
                id: p.id,
                name: p.name,
                qty: qty,
                priceUSD: p.priceUSD || 10,
                costUSD: p.costUSD || 8
            });
            totalUSD += (p.priceUSD || 10) * qty;
        }

        const method = methods[Math.floor(Math.random() * methods.length)];
        const bcv = 42 + (Math.random() * 8);
        const totalBS = totalUSD * bcv;

        sales.push({
            id: Date.now() + i,
            date: d.toISOString(),
            clientId: clientList[Math.floor(Math.random() * clientList.length)].id,
            items: randomItems,
            totalUSD: totalUSD,
            totalBS: totalBS,
            paymentType: method,
            paymentMethods: {
                movil: method === 'pago movil' ? totalBS : 0,
                debito: method === 'debito' ? totalBS : 0,
                cashUSD: method === 'dolares' ? totalUSD : 0,
                debt: method === 'deudor' ? totalBS : 0
            },
            bcvRate: bcv
        });
    }

    await saveAll();
    UI.showToast("50 registros generados con éxito");

    // Esperar un breve momento para el Toast y recargar
    setTimeout(() => {
        location.reload();
    }, 1500);
}

function updateGlobalAlerts() {
    // Logic for notifications removed as requested.
    // Can be used later for other global state alerts if needed.
}

// --- View Sale Details ---
function viewSaleDetails(saleId) {
    const s = sales.find(sl => sl.id == saleId);
    if (!s) return;
    const client = clients.find(c => c.id == s.clientId);
    const clientName = client?.name || 'Cliente General';

    UI.openModal(`Detalle de Venta #${s.id} `, `
        <div style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="color:var(--text-muted); font-size:0.85rem;">Fecha</span>
                <span style="font-weight:600;">${UI.formatDate(s.date)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="color:var(--text-muted); font-size:0.85rem;">Cliente</span>
                <span style="font-weight:600;">${clientName}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="color:var(--text-muted); font-size:0.85rem;">Tipo de Pago</span>
                <span class="badge ${s.paymentType?.includes('deud') || s.paymentType?.includes('debt') ? 'bg-danger' : 'bg-success'}">${s.paymentType}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="color:var(--text-muted); font-size:0.85rem;">Tasa BCV</span>
                <span style="font-weight:600;">Bs. ${(s.bcvRate || currentBCVRate).toFixed(2)}</span>
            </div>
        </div>
        <div style="background:var(--bg-main); border-radius:10px; padding:16px; margin-bottom:16px;">
            <h4 style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">PRODUCTOS</h4>
            ${s.items.map(item => `
                <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-color);">
                    <span>${item.name} x${item.qty}</span>
                    <span style="font-weight:600;">${UI.formatUSD((item.priceUSD || 0) * item.qty)}</span>
                </div>
            `).join('')}
            <div style="display:flex; justify-content:space-between; padding:12px 0 0; font-weight:800; font-size:1.1rem;">
                <span>TOTAL</span>
                <div style="text-align:right;">
                    <div>${UI.formatUSD(s.totalUSD || 0)}</div>
                    <div style="font-size:0.9rem; color:var(--primary);">${UI.formatCurrency(s.totalBS || 0)}</div>
                </div>
            </div>
        </div>
        ${s.paymentMethods ? `
            <div style="background:var(--bg-main); border-radius:10px; padding:16px; margin-bottom:16px;">
                <h4 style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">MÉTODOS DE PAGO</h4>
                ${s.paymentMethods.movil > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Pago Móvil</span><span>${UI.formatCurrency(s.paymentMethods.movil)}</span></div>` : ''}
                ${s.paymentMethods.debito > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Débito</span><span>${UI.formatCurrency(s.paymentMethods.debito)}</span></div>` : ''}
                ${(s.paymentMethods.cashUSD > 0 || s.paymentMethods['efectivo $'] > 0) ? `<div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Efectivo ($)</span><span>${UI.formatUSD(s.paymentMethods['efectivo $'] || s.paymentMethods.cashUSD)}</span></div>` : ''}
                ${s.paymentMethods['efectivo Bs'] > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Efectivo (Bs)</span><span>${UI.formatCurrency(s.paymentMethods['efectivo Bs'])}</span></div>` : ''}
                ${s.paymentMethods.debt > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 0; color:var(--danger);"><span>Deuda</span><span>${UI.formatCurrency(s.paymentMethods.debt)}</span></div>` : ''}
            </div>
        ` : ''
        }
    <button class="btn btn-outline" style="width:100%;" onclick="printTicket(${s.id})">
        <i data-lucide="printer"></i> Imprimir Ticket
    </button>
    `);
    lucide.createIcons();
}

// --- Print Ticket ---
function printTicket(saleId) {
    const s = sales.find(sl => sl.id == saleId);
    if (!s) return;
    const client = clients.find(c => c.id == s.clientId);
    const clientName = client?.name || 'Cliente General';
    const biz = settings.businessName || 'SoluVentas';
    const bizPhone = settings.businessPhone || '';
    const bizAddr = settings.businessAddress || '';
    const bcvRate = s.bcvRate || currentBCVRate;

    const ticketWin = window.open('', '_blank', 'width=400,height=700');
    ticketWin.document.write(`
        < !DOCTYPE html >
            <html>
                <head>
                    <meta charset="UTF-8">
                        <title>Ticket #${s.id}</title>
                        <style>
                            * {margin:0; padding:0; box-sizing:border-box; }
                            body {font - family: 'Courier New', monospace; font-size: 12px; color: #000; width: 300px; margin: 0 auto; padding: 10px; }
                            .center {text - align: center; }
                            .bold {font - weight: bold; }
                            .line {border - top: 1px dashed #000; margin: 8px 0; }
                            .row {display: flex; justify-content: space-between; margin: 3px 0; }
                            .total-row {font - size: 14px; font-weight: bold; border-top: 2px solid #000; padding-top: 6px; margin-top: 6px; }
                            .header {margin - bottom: 12px; }
                            .footer {margin - top: 12px; font-size: 10px; text-align: center; }
                            @media print {body {width: 80mm; } button {display: none; } }
                        </style>
                </head>
                <body>
                    <div class="header center">
                        <div class="bold" style="font-size:16px;">${biz}</div>
                        ${bizAddr ? `<div>${bizAddr}</div>` : ''}
                        ${bizPhone ? `<div>Tel: ${bizPhone}</div>` : ''}
                        <div class="line"></div>
                        <div>Comprobante de Venta</div>
                        <div>Fecha: ${new Date(s.date).toLocaleDateString('es-VE')} ${new Date(s.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div>Ticket #${s.id.toString().slice(-6)}</div>
                        <div>Cliente: ${clientName}</div>
                        <div class="line"></div>
                    </div>
                    <div class="items">
                        ${s.items.map(item => `
                    <div class="row">
                        <span>${item.name} x${item.qty}</span>
                        <span>$${((item.priceUSD || 0) * item.qty).toFixed(2)}</span>
                    </div>
                    <div style="font-size:10px; color:#555; margin-bottom:3px; padding-left:4px;">
                        Bs. ${((item.priceUSD || 0) * item.qty * bcvRate).toFixed(2)}
                    </div>
                `).join('')}
                    </div>
                    <div class="line"></div>
                    <div class="row"><span>Subtotal USD:</span><span>${UI.formatUSD(s.totalUSD || 0)}</span></div>
                    <div class="row"><span>Tasa BCV:</span><span>Bs. ${bcvRate.toFixed(2)}</span></div>
                    <div class="row total-row"><span>TOTAL Bs.:</span><span>Bs. ${(s.totalBS || 0).toFixed(2)}</span></div>
                    ${s.paymentMethods ? `
                <div class="line"></div>
                <div style="font-size:10px; margin-bottom:4px; font-weight:bold;">FORMA DE PAGO:</div>
                ${s.paymentMethods.movil > 0 ? `<div class="row"><span>Pago Móvil:</span><span>Bs. ${s.paymentMethods.movil.toFixed(2)}</span></div>` : ''}
                ${s.paymentMethods.debito > 0 ? `<div class="row"><span>Débito:</span><span>Bs. ${s.paymentMethods.debito.toFixed(2)}</span></div>` : ''}
                ${(s.paymentMethods.cashUSD > 0 || s.paymentMethods['efectivo $'] > 0) ? `<div class="row"><span>Efectivo ($):</span><span>$${(s.paymentMethods['efectivo $'] || s.paymentMethods.cashUSD).toFixed(2)}</span></div>` : ''}
                ${s.paymentMethods['efectivo Bs'] > 0 ? `<div class="row"><span>Efectivo (Bs):</span><span>Bs. ${s.paymentMethods['efectivo Bs'].toFixed(2)}</span></div>` : ''}
                ${s.paymentMethods.debt > 0 ? `<div class="row" style="font-weight:bold;"><span>DEUDA:</span><span>Bs. ${s.paymentMethods.debt.toFixed(2)}</span></div>` : ''}
            ` : ''}
                    <div class="footer">
                        <div class="line"></div>
                        <div>¡Gracias por su compra!</div>
                        <div style="font-size:9px; margin-top:4px;">Ticket generado por SoluVentas</div>
                    </div>
                    <br>
                        <div class="center">
                            <button onclick="window.print()" style="padding:8px 20px; cursor:pointer; background:#7c3aed; color:#fff; border:none; border-radius:6px; font-size:13px;">🖨️ Imprimir</button>
                            <button onclick="window.close()" style="padding:8px 20px; cursor:pointer; background:#e2e8f0; border:none; border-radius:6px; font-size:13px; margin-left:8px;">Cerrar</button>
                        </div>
                </body>
            </html>
    `);
    ticketWin.document.close();
    setTimeout(() => ticketWin.focus(), 200);
}

// --- Configuración del Negocio ---
function renderConfiguracion() {
    const lastBackup = localStorage.getItem('soluventas_last_backup');
    const lastBackupText = lastBackup ? new Date(parseInt(lastBackup)).toLocaleDateString('es-VE') : 'Nunca';
    contentArea.innerHTML = `
        <div style="max-width:700px; margin:0 auto;">
            <div class="section-header" style="margin-bottom:24px;">
                <div>
                    <h2>Configuración del Sistema</h2>
                    <p style="color:var(--text-muted);">Ajusta los parámetros del negocio y gestiona los datos</p>
                </div>
            </div>

            <div class="data-table-container" style="margin-bottom:24px;">
                <div class="table-header"><h3><i data-lucide="building-2" style="width:18px;"></i> Datos del Negocio</h3></div>
                <form onsubmit="event.preventDefault(); saveBusinessSettings()" class="config-grid">
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:6px;">Nombre del Negocio</label>
                        <input type="text" id="cfg-biz-name" value="${settings.businessName || 'SoluVentas'}" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:6px;">RIF / RUC</label>
                        <input type="text" id="cfg-biz-rif" value="${settings.businessRIF || ''}" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:6px;">Teléfono</label>
                        <input type="text" id="cfg-biz-phone" value="${settings.businessPhone || ''}" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:6px;">Dirección</label>
                        <input type="text" id="cfg-biz-addr" value="${settings.businessAddress || ''}" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:6px;">Umbral de Stock Bajo</label>
                        <input type="number" id="cfg-stock-threshold" value="${settings.lowStockThreshold || 5}" min="0" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:6px;">Tasa Manual</label>
                        <input type="text" id="cfg-manual-bcv" class="currency-input" value="${currentBCVRate.toFixed(2).replace('.', ',')}" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                    </div>
                    <div style="grid-column:1/-1;">
                        <button type="submit" class="btn btn-primary" style="width:100%;"><i data-lucide="save"></i> Guardar Configuración</button>
                    </div>
                </form>
            </div>

            <div class="data-table-container" style="margin-bottom:24px;">
                <div class="table-header"><h3><i data-lucide="database" style="width:18px;"></i> Backup y Restauración</h3></div>
                <div class="config-grid">
                    <div style="background:var(--bg-main); border-radius:10px; padding:16px;">
                        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">Backup automático</div>
                        <div style="font-weight:700; margin-bottom:12px;">${lastBackupText}</div>
                        <button class="btn btn-primary" style="width:100%;" onclick="performAutoBackup(true)">
                            <i data-lucide="download"></i> Descargar .JSON
                        </button>
                    </div>
                    <div style="background:var(--bg-main); border-radius:10px; padding:16px;">
                        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">Restaurar respaldo</div>
                        <input type="file" id="restore-file" accept=".json" style="width:100%; margin-bottom:10px; font-size:0.85rem;">
                        <button class="btn btn-outline" style="width:100%;" onclick="restoreBackup(document.getElementById('restore-file').files[0])">
                            <i data-lucide="upload"></i> Subir Archivo
                        </button>
                    </div>
                </div>
            </div>

            <div class="data-table-container" style="border:2px solid rgba(239,68,68,0.3)">
                <div class="table-header"><h3 style="color:var(--danger);"><i data-lucide="alert-triangle" style="width:18px;"></i> Zona de Peligro</h3></div>
                <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:16px;">Estas acciones son irreversibles.</p>
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <button class="btn btn-outline" style="color:var(--danger); border-color:var(--danger); flex:1; min-width:200px;" onclick="clearAllData()">
                        <i data-lucide="trash-2"></i> Borrar Todo
                    </button>
                    <button class="btn btn-outline" style="flex:1; min-width:200px;" onclick="exportToCSV()">
                        <i data-lucide="file-spreadsheet"></i> Exportar Ventas
                    </button>
                </div>
            </div>
        </div>
        `;
    lucide.createIcons();
    contentArea.querySelectorAll('.currency-input').forEach(input => UI.maskCurrency(input));
}

function saveBusinessSettings() {
    settings.businessName = document.getElementById('cfg-biz-name').value;
    settings.businessRIF = document.getElementById('cfg-biz-rif').value;
    settings.businessPhone = document.getElementById('cfg-biz-phone').value;
    settings.businessAddress = document.getElementById('cfg-biz-addr').value;
    settings.lowStockThreshold = parseInt(document.getElementById('cfg-stock-threshold').value) || 5;

    // Actualización manual del dólar
    const manualRate = UI.parseCurrency(document.getElementById('cfg-manual-bcv').value);
    if (!isNaN(manualRate) && manualRate > 0) {
        currentBCVRate = manualRate;
        localStorage.setItem('soluventas_manual_bcv', manualRate);

        // Actualizar indicador en la interfaz (intentar ambos posibles IDs para compatibilidad)
        const valueEl = document.getElementById('bcv-value') || document.getElementById('dolar-value');
        if (valueEl) {
            valueEl.innerText = `Bs.${currentBCVRate.toFixed(2)}`;
            valueEl.style.color = '#fff';
        }
        addLog('tasa', `Tasa BCV actualizada manualmente vía configuración a Bs.${manualRate.toFixed(2)}`);
    }

    saveAll();
    UI.showToast('Configuración guardada');
}

// Export CSV
function exportToCSV() {
    // Totales acumulados por caja
    const cumulativeTotals = {
        movil: 0,
        debito: 0,
        cashUSD: 0,
        debt: 0
    };
    let totalGlobalUSD = 0;
    let totalGlobalBS = 0;

    // Encabezado con BOM y columnas desglosadas
    let csv = "\uFEFFFecha;Cliente;Total USD;Total BS;Pago Movil (Bs);Debito (Bs);Efectivo ($);Deuda (Bs);Tipo\n";
    
    sales.forEach(s => {
        const clientName = clients.find(c => c.id == s.clientId)?.name || 'General';
        const usd = parseFloat(s.totalUSD) || 0;
        const bs = parseFloat(s.totalBS) || 0;
        
        // Extraer montos individuales de los métodos de pago
        const pm = s.paymentMethods || {};
        const pMovil = parseFloat(pm.movil) || 0;
        const pDebito = parseFloat(pm.debito) || 0;
        const pCash = parseFloat(pm.cashUSD) || 0;
        const pDebt = parseFloat(pm.debt) || 0;

        // Sumar a los acumuladores globales
        cumulativeTotals.movil += pMovil;
        cumulativeTotals.debito += pDebito;
        cumulativeTotals.cashUSD += pCash;
        cumulativeTotals.debt += pDebt;
        totalGlobalUSD += usd;
        totalGlobalBS += bs;

        csv += `${s.date.split('T')[0]};${clientName};${usd.toFixed(2)};${bs.toFixed(2)};${pMovil.toFixed(2)};${pDebito.toFixed(2)};${pCash.toFixed(2)};${pDebt.toFixed(2)};${s.paymentType}\n`;
    });

    // Añadir resumen final detallado por cada método de pago
    csv += "\n\n--- CIERRE DE CAJA POR METODO DE PAGO ---\n";
    csv += "Metodo;Total Acumulado\n";
    csv += `PAGO MOVIL;Bs. ${cumulativeTotals.movil.toFixed(2)}\n`;
    csv += `DEBITO;Bs. ${cumulativeTotals.debito.toFixed(2)}\n`;
    csv += `DOLARES ($);$ ${cumulativeTotals.cashUSD.toFixed(2)}\n`;
    csv += `DEUDOR (DEUDA);Bs. ${cumulativeTotals.debt.toFixed(2)}\n`;
    csv += `\nTOTAL TRANSADO (USD);$ ${totalGlobalUSD.toFixed(2)}\n`;
    csv += `TOTAL TRANSADO (BS);Bs. ${totalGlobalBS.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_ventas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    UI.showToast("Reporte detallado exportado");
}

// BCV Rate Fetching
async function fetchBCVRate() {
    const valueEl = document.getElementById('bcv-value');
    const refreshBtn = document.getElementById('refresh-bcv');

    try {
        if (refreshBtn) refreshBtn.classList.add('spinning');
        // Using the user-specified API
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        // DolarAPI returns a direct object for /oficial
        const rate = data.promedio || data.promedio_real || data.venta;

        if (rate) {
            currentBCVRate = parseFloat(rate);
            valueEl.innerText = `Bs.${currentBCVRate.toFixed(2)} `;
            valueEl.style.color = '#fff';
            // Refrescar vistas si estamos en una pantalla de precios
            const currentHash = window.location.hash.replace('#', '');
            if (currentHash === 'inventario' || currentHash === 'ventas') renderSection(currentHash);
        } else {
            throw new Error('Data format error');
        }
    } catch (error) {
        console.error("Error fetching BCV:", error);
        valueEl.innerText = 'Bs. --,--';
        valueEl.style.color = 'var(--danger)';
    } finally {
        if (refreshBtn) setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
    }
}

function showManualRateModal() {
    // Aseguramos que el valor actual se pase con el formato de la máscara (coma decimal)
    const currentValue = currentBCVRate.toFixed(2).replace('.', ',');
    UI.openModal("Actualización Manual de Tasa BCV", `
        <div style="padding:16px 0;">
            <label style="display:block; margin-bottom:8px;">Ingresa el valor del dólar actual:</label>
            <input type="text" id="manual-rate-input" class="currency-input" value="${currentValue}" 
                style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border-color); font-size:1.2rem;">
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:12px;">Se usará este valor manualmente hasta que refresques con la API.</p>
        </div>
        <button class="btn btn-primary" style="width:100%;" onclick="saveManualRate()">Actualizar Tasa</button>
    `);
}

function saveManualRate() {
    const val = UI.parseCurrency(document.getElementById('manual-rate-input').value);
    if (!isNaN(val) && val > 0) {
        currentBCVRate = val;
        const valueEl = document.getElementById('bcv-value');
        valueEl.innerText = `Bs.${currentBCVRate.toFixed(2)} `;
        valueEl.style.color = '#fff';
        UI.closeModal();
        UI.showToast("Tasa actualizada manualmente");
        localStorage.setItem('soluventas_manual_bcv', val);
        addLog('tasa', `Tasa BCV actualizada manualmente a Bs.${val.toFixed(2)} `);

        // Refrescar vistas
        const currentHash = window.location.hash.replace('#', '');
        if (currentHash === 'inventario' || currentHash === 'ventas') renderSection(currentHash);
    } else {
        UI.showToast("Monto inválido", "error");
    }
}

// Spinning animation for refresh button
const spinStyle = document.createElement('style');
document.getElementById('refresh-bcv').addEventListener('click', (e) => {
    e.stopPropagation();
    fetchBCVRate();
});

document.getElementById('manual-bcv').addEventListener('click', (e) => {
    e.stopPropagation();
    showManualRateModal();
});

// Toggle para móvil (Indicador Dólar)
document.getElementById('dolar-indicator').addEventListener('click', function() {
    if (window.innerWidth <= 768) {
        this.classList.add('expanded');
    }
});

document.getElementById('close-dolar-actions').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('dolar-indicator').classList.remove('expanded');
});

// Inicialización de la App se maneja vía DOMContentLoaded
