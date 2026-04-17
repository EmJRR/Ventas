/* app.js - Main Application Logic */

// Global State (Reemplazados por inicialización asíncrona)
let products, clients, sales, payments, egresos, logs, settings, currentBCVRate;

async function bootstrapApp() {
    const isOnline = await Storage.init();

    products = Storage.get('products');
    clients = Storage.get('clients');
    sales = Storage.get('sales');
    payments = Storage.get('payments');
    egresos = Storage.get('egresos');
    logs = Storage.get('logs');
    settings = Storage.get('settings') || { lowStockThreshold: 5, businessName: 'SoluVentas', businessRIF: '', businessPhone: '', businessAddress: '' };
    currentBCVRate = parseFloat(localStorage.getItem('soluventas_manual_bcv')) || 45.0;

    // Notificar estado de conexión
    if (isOnline) {
        UI.showToast('Conectado a la Laptop (Sincronizado)', 'success');
    } else {
        UI.showToast('Modo Offline: Usando datos locales', 'warning');
    }

    // Inicializar UI y Eventos
    initEventListeners();

    // Carga inicial de sección
    const section = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(section);
}

// Auto-Backup on startup
(function initAutoBackup() {
    const lastBackup = localStorage.getItem('soluventas_last_backup');
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (!lastBackup || (now - parseInt(lastBackup)) > ONE_DAY) {
        setTimeout(performAutoBackup, 3000); // 3s after load
    }
})();

function performAutoBackup() {
    try {
        const backupData = {
            version: '2.0',
            timestamp: new Date().toISOString(),
            products: Storage.get('products'),
            clients: Storage.get('clients'),
            sales: Storage.get('sales'),
            payments: Storage.get('payments'),
            egresos: Storage.get('egresos'),
            settings: Storage.get('settings')
        };
        const json = JSON.stringify(backupData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `soluventas_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        localStorage.setItem('soluventas_last_backup', Date.now().toString());
        addLog('sistema', 'Backup automático diario generado');
        UI.showToast('Backup automático generado', 'success');
    } catch (e) {
        console.error('Backup failed:', e);
    }
}

function restoreBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.version || !data.products) throw new Error('Formato inválido');
            if (!confirm(`¿Restaurar backup del ${data.timestamp?.split('T')[0]}? Se reemplazarán todos los datos actuales.`)) return;
            Storage.save('products', data.products);
            Storage.save('clients', data.clients);
            Storage.save('sales', data.sales);
            Storage.save('payments', data.payments);
            Storage.save('egresos', data.egresos || []);
            Storage.save('settings', data.settings || {});
            addLog('sistema', `Restauración de backup aplicada: ${data.timestamp}`);
            UI.showToast('Backup restaurado. Recargando...', 'success');
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            UI.showToast('Error: archivo de backup inválido', 'error');
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
                        <table>
                            <thead><tr><th>Fecha / Hora</th><th>Tipo</th><th>Actividad</th></tr></thead>
                            <tbody>
                                ${groupedLogs[week].map(log => `
                                    <tr>
                                        <td data-label="Fecha / Hora" style="white-space:nowrap; font-size:0.8rem; color:var(--text-muted);">${UI.formatDate(log.date)}</td>
                                        <td data-label="Tipo"><span class="badge badge-type-${log.type}">${log.type}</span></td>
                                        <td data-label="Actividad" style="font-size:0.9rem;">${log.message}</td>
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
    const totalDebt = clients.reduce((acc, c) => acc + c.debt, 0);
    const clientCount = clients.length;

    contentArea.innerHTML = `
        <div class="dashboard-stats">
            <div class="stat-card">
                <div class="stat-icon purple"><i data-lucide="trending-up"></i></div>
                <div class="stat-info"><h3>Ventas Totales</h3><p>${UI.formatCurrency(totalSalesBS)}</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange"><i data-lucide="wallet"></i></div>
                <div class="stat-info"><h3>Deuda Total</h3><p>${UI.formatCurrency(totalDebt)}</p></div>
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
}
// 3. Ventas (Nueva Venta) Logic
let cart = [];
function renderVentas() {
    contentArea.innerHTML = `
        <div class="sales-terminal" style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px;">
            <!-- Selector de Productos -->
            <div class="data-table-container">
                <div class="table-header">
                    <div style="margin-bottom:20px; width: 100%;">
                        <input type="text" placeholder="🔍 Buscar producto por nombre o código..." id="pos-search" 
                            oninput="filterPOS(this.value); checkSecretCode(this.value)" 
                            style="width:100%; padding:15px; border-radius:12px; border:1px solid var(--border-color); font-size:1rem; box-shadow:var(--shadow-sm);">
                        
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
                <div class="products-grid" id="pos-products" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; margin-top:16px;">
                    ${products.map(p => `
                        <div class="product-item-card" onclick="addToCart(${p.id})" style="border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; cursor: pointer; transition: 0.2s;">
                            <p style="font-weight:700; font-size:0.9rem;">${p.name}</p>
                            <p style="color: var(--primary); font-weight:700; font-size:1rem;">${UI.formatUSD(p.priceUSD || 0)}</p>
                            <p style="font-size: 0.75rem; color: var(--text-muted);">${UI.formatCurrency((p.priceUSD || 0) * currentBCVRate)}</p>
                            <p style="font-size: 0.7rem; color: var(--text-muted);">Stock: ${p.stock}</p>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Carrito y Checkout -->
            <div class="data-table-container" style="display: flex; flex-direction: column;">
                <div class="table-header" style="padding-top:10px;"><h3>Carrito</h3></div>
                
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
                            <button class="btn btn-success btn-sm" onclick="showConfirmSaleModal('debt')">Deudor (Deuda)</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    updateCartUI();
    lucide.createIcons();
}

function filterPOS(val) {
    const query = val.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query));
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
    if (!container) return;
    container.innerHTML = list.map(p => `
        <div class="product-item-card" onclick="addToCart(${p.id})" style="border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; cursor: pointer;">
            <p style="font-weight:700; font-size:0.9rem;">${p.name}</p>
            <p style="color: var(--primary); font-weight:700; font-size:1rem;">${UI.formatUSD(p.priceUSD || 0)}</p>
            <p style="font-size: 0.75rem; color: var(--text-muted);">${UI.formatCurrency((p.priceUSD || 0) * currentBCVRate)}</p>
            <p style="font-size: 0.7rem; color: var(--text-muted);">Stock: ${p.stock}</p>
        </div>
    `).join('');
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
                    <p>${UI.formatUSD(totalGeneratedUSD)}</p>
                    <span>Total Vendido</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);">
                    <i data-lucide="trending-down"></i>
                </div>
                <div class="stat-info">
                    <p>${UI.formatUSD(totalInvestmentUSD)}</p>
                    <span>Inversión</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: ${totalProfitUSD >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${totalProfitUSD >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    <i data-lucide="${totalProfitUSD >= 0 ? 'trending-up' : 'trending-down'}"></i>
                </div>
                <div class="stat-info">
                    <p style="color: ${totalProfitUSD >= 0 ? 'var(--success)' : 'var(--danger)'};">${UI.formatUSD(totalProfitUSD)}</p>
                    <span>Ganancia Neta</span>
                </div>
            </div>
            <div class="stat-card">
                 <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1); color: var(--warning);">
                    <i data-lucide="award"></i>
                </div>
                <div class="stat-info">
                    <p style="font-size:0.9rem;">${mostSold}</p>
                    <span>Más Vendido (${mostSoldQty})</span>
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
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Concepto / Descripción</th>
                        <th>Monto USD</th>
                        <th>Monto Bs.</th>
                        <th>Tasa</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${egresos.length > 0 ? egresos.slice().reverse().map(e => `
                        <tr>
                            <td data-label="Fecha">${UI.formatDate(e.date)}</td>
                            <td data-label="Concepto"><strong>${e.category}</strong><br><small>${e.description}</small></td>
                            <td data-label="Monto USD">${UI.formatUSD(e.amountUSD)}</td>
                            <td data-label="Monto Bs.">${UI.formatCurrency(e.amountBS)}</td>
                            <td data-label="Tasa">${e.bcvRate.toFixed(2)}</td>
                            <td data-label="Acciones"><button class="btn btn-sm" style="color:var(--danger);" onclick="deleteEgreso(${e.id})"><i data-lucide="trash"></i></button></td>
                        </tr>
                    `).join('') : '<tr><td colspan="6" style="text-align:center; padding:32px;">No se han registrado egresos aún.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
    lucide.createIcons();
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
    const fill = { movil: 0, debito: 0, cash: 0, debt: 0 };
    if (primaryType === 'cash') fill.cash = totalUSD;
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
                <input type="number" id="pay-movil" class="pay-input" value="${fill.movil.toFixed(2)}" step="0.01" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem;" oninput="updatePaymentBalance(${totalBS}, ${currentBCVRate})">
            </div>
            <div class="pay-field">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Débito (Bs.)</label>
                <input type="number" id="pay-debito" class="pay-input" value="${fill.debito.toFixed(2)}" step="0.01" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem;" oninput="updatePaymentBalance(${totalBS}, ${currentBCVRate})">
            </div>
            <div class="pay-field">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Efectivo ($)</label>
                <input type="number" id="pay-cash" class="pay-input" value="${fill.cash.toFixed(2)}" step="0.01" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem; border-color:var(--success);" oninput="updatePaymentBalance(${totalBS}, ${currentBCVRate})">
            </div>
            <div class="pay-field">
                <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:6px;">Deuda / Crédito (Bs.)</label>
                <input type="number" id="pay-debt" class="pay-input" value="${fill.debt.toFixed(2)}" step="0.01" style="width:100%; padding:12px; border:1px solid var(--border-color); border-radius:10px; font-size:1.1rem; border-color:var(--danger);" oninput="updatePaymentBalance(${totalBS}, ${currentBCVRate})">
            </div>
        </div>

        <button class="btn btn-primary" id="btn-finish-payment" style="width:100%; height:55px; font-size:1.1rem; font-weight:700;" onclick="completeSale(${totalBS})">Finalizar Venta</button>
    `;

    UI.openModal("Generar Pago - Detalle", html);
    updatePaymentBalance(totalBS, currentBCVRate);
}

function updatePaymentBalance(totalToPay, bcv) {
    const movil = parseFloat(document.getElementById('pay-movil').value) || 0;
    const debito = parseFloat(document.getElementById('pay-debito').value) || 0;
    const cashUSD = parseFloat(document.getElementById('pay-cash').value) || 0;
    const cashBS = cashUSD * bcv;
    const debt = parseFloat(document.getElementById('pay-debt').value) || 0;

    const paid = movil + debito + cashBS + debt;
    const balance = totalToPay - paid;

    const balanceText = document.getElementById('payment-balance-text');
    const balanceUSD = document.getElementById('payment-balance-usd');
    const summaryBox = document.getElementById('payment-summary');
    const finishBtn = document.getElementById('btn-finish-payment');

    if (balance > 0.05) {
        balanceText.innerText = "Bs. " + balance.toFixed(2);
        balanceUSD.innerText = "$ " + (balance / bcv).toFixed(2);
        balanceText.style.color = "var(--primary)";
        if (summaryBox) {
            summaryBox.style.borderColor = "var(--border-color)";
            summaryBox.style.background = "var(--bg-main)";
        }
        finishBtn.style.opacity = "0.5";
        finishBtn.innerText = "Falta cubrir el total...";
    } else if (balance < -0.05) {
        balanceText.innerText = "Sobra: Bs. " + Math.abs(balance).toFixed(2);
        balanceUSD.innerText = "Cambio: $ " + (Math.abs(balance) / bcv).toFixed(2);
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
    const payMovil = parseFloat(document.getElementById('pay-movil').value) || 0;
    const payDebito = parseFloat(document.getElementById('pay-debito').value) || 0;
    const payCashUSD = parseFloat(document.getElementById('pay-cash').value) || 0;
    const payDebt = parseFloat(document.getElementById('pay-debt').value) || 0;

    const totalPaidBS = payMovil + payDebito + (payCashUSD * currentBCVRate) + payDebt;

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
            cashUSD: payCashUSD,
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
    UI.openModal("Agregar Nuevo Producto (Precios en USD)", `
        <form id="product-form" onsubmit="event.preventDefault(); saveProduct()">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div style="margin-bottom:12px;"> <label>Código(s) (Ej. COD1, COD2)</label><input type="text" id="p-code" placeholder="Ej: COD1, COD2" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>Nombre</label><input type="text" id="p-name" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>Costo ($)</label><input type="number" step="0.01" id="p-cost" required oninput="calculatePriceUSD()" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>% de Ganancia</label><input type="number" id="p-margin" value="20" required oninput="calculatePriceUSD()" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>Precio Venta ($)</label><input type="number" step="0.01" id="p-price" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:#f1f5f9;" readonly> </div>
                <div style="margin-bottom:12px;"> <label>Stock Inicial</label><input type="number" id="p-stock" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px;">Referencia actual: ${UI.formatCurrency(currentBCVRate)}</p>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">Guardar Producto</button>
        </form>
        `);
}

function calculatePriceUSD() {
    const cost = parseFloat(document.getElementById('p-cost').value) || 0;
    const margin = parseFloat(document.getElementById('p-margin').value) || 0;
    const price = cost + (cost * (margin / 100));
    document.getElementById('p-price').value = price.toFixed(2);
}

function saveProduct() {
    const newP = {
        id: Date.now(),
        code: document.getElementById('p-code').value,
        name: document.getElementById('p-name').value,
        costUSD: parseFloat(document.getElementById('p-cost').value),
        profitMargin: parseFloat(document.getElementById('p-margin').value),
        priceUSD: parseFloat(document.getElementById('p-price').value),
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
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div style="margin-bottom:12px;"> <label>Código(s) (Ej. COD1, COD2)</label><input type="text" id="p-code" value="${p.code}" placeholder="Ej: COD1, COD2" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>Nombre</label><input type="text" id="p-name" value="${p.name}" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>Costo ($)</label><input type="number" step="0.01" id="p-cost" value="${p.costUSD || p.priceUSD}" required oninput="calculatePriceUSD()" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>% de Ganancia</label><input type="number" id="p-margin" value="${p.profitMargin || 20}" required oninput="calculatePriceUSD()" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
                <div style="margin-bottom:12px;"> <label>Precio Venta ($)</label><input type="number" step="0.01" id="p-price" value="${p.priceUSD}" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:#f1f5f9;" readonly> </div>
                <div style="margin-bottom:12px;"> <label>Stock</label><input type="number" id="p-stock" value="${p.stock}" required style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color);"> </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">Actualizar Producto</button>
        </form>
        `);
}

function updateProduct(id) {
    const p = products.find(prod => prod.id == id);
    p.code = document.getElementById('p-code').value;
    p.name = document.getElementById('p-name').value;
    p.costUSD = parseFloat(document.getElementById('p-cost').value);
    p.profitMargin = parseFloat(document.getElementById('p-margin').value);
    p.priceUSD = parseFloat(document.getElementById('p-price').value);
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
    const debtUSD = client.debt / currentBCVRate;
    UI.openModal(`Registrar Abono - ${client.name} `, `
        <div style="background:var(--bg-main); padding:15px; border-radius:10px; margin-bottom:15px; text-align:center;">
            <p style="font-size:0.8rem; color:var(--text-muted);">DEUDA TOTAL</p>
            <p style="font-size:1.4rem; font-weight:800; color:var(--danger);">${UI.formatCurrency(client.debt)}</p>
            <p style="font-size:0.9rem; color:var(--text-muted);">${UI.formatUSD(debtUSD)}</p>
        </div>
        <div>
            <label style="font-weight:600; font-size:0.9rem;">Monto a abonar (Bs.)</label>
            <input type="number" id="abono-amount" step="0.01" max="${client.debt}" placeholder="0.00" 
                style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border-color); font-size:1.1rem; margin-top:5px;"
                oninput="document.getElementById('abono-usd-ref').innerText = '≈ ' + UI.formatUSD(this.value / currentBCVRate)">
            <p id="abono-usd-ref" style="font-size:0.8rem; color:var(--primary); margin-top:5px; font-weight:600;">≈ $0.00</p>
        </div>
        <button class="btn btn-primary" style="width:100%; margin-top:20px; height:50px; font-weight:700;" onclick="saveAbono(${clientId})">Confirmar Abono</button>
    `);
}

function saveAbono(clientId) {
    const amount = parseFloat(document.getElementById('abono-amount').value);
    const client = clients.find(c => c.id == clientId);

    if (isNaN(amount) || amount <= 0 || amount > client.debt + 0.01) {
        UI.showToast("Monto inválido o excede la deuda", "error");
        return;
    }

    client.debt -= amount;
    payments.push({
        id: Date.now(),
        clientId: clientId,
        amount: amount,
        bcvRate: currentBCVRate, // Guardamos la tasa del momento del abono
        date: new Date().toISOString()
    });

    saveAll();
    addLog('abono', `Abono de ${UI.formatCurrency(amount)} de ${client.name}. Deuda restante: ${UI.formatCurrency(client.debt)} `);
    UI.closeModal();
    renderDeudas();
    if (window.location.hash === '#historial') filterHistorialByDate(); // Refrescar si estamos viendo historial
    UI.showToast("Abono procesado correctamente");
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
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px;" >
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
        <div style="max-height:200px; overflow-y:auto; margin-bottom:16px;">
            <table style="width:100%;">
                <thead><tr><th>Fecha</th><th>Total Bs.</th><th>Pago</th><th></th></tr></thead>
                <tbody>
                    ${clientSales.length > 0 ? clientSales.slice().reverse().slice(0, 10).map(s => `
                        <tr>
                            <td style="font-size:0.8rem;">${UI.formatDate(s.date)}</td>
                            <td style="font-weight:700;">${UI.formatCurrency(s.totalBS || 0)}</td>
                            <td><span class="badge ${s.paymentType?.includes('deud') || s.paymentType?.includes('debt') ? 'bg-danger' : 'bg-success'}">${s.paymentType}</span></td>
                            <td><button class="btn btn-sm btn-outline" onclick="printTicket(${s.id})"><i data-lucide="printer"></i></button></td>
                        </tr>
                    `).join('') : '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Sin compras registradas</td></tr>'}
                </tbody>
            </table>
        </div>
        ${clientPayments.length > 0 ? `
            <h4 style="margin-bottom:10px; font-size:0.9rem; color:var(--text-muted);">ABONOS REALIZADOS</h4>
            <div style="max-height:150px; overflow-y:auto;">
                <table style="width:100%;">
                    <thead><tr><th>Fecha</th><th>Monto Abonado</th></tr></thead>
                    <tbody>
                        ${clientPayments.slice().reverse().map(p => `
                            <tr>
                                <td style="font-size:0.8rem;">${UI.formatDate(p.date)}</td>
                                <td style="color:var(--success); font-weight:700;">${UI.formatCurrency(p.amount)}</td>
                            </tr>
                        `).join('')}
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
                ${s.paymentMethods.cashUSD > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Efectivo ($)</span><span>${UI.formatUSD(s.paymentMethods.cashUSD)}</span></div>` : ''}
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
                ${s.paymentMethods.cashUSD > 0 ? `<div class="row"><span>Efectivo ($):</span><span>$${s.paymentMethods.cashUSD.toFixed(2)}</span></div>` : ''}
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
                <form onsubmit="event.preventDefault(); saveBusinessSettings()" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
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
                    <div style="grid-column:1/-1;">
                        <label style="font-size:0.85rem; font-weight:600; display:block; margin-bottom:6px;">Umbral de Stock Bajo (unidades)</label>
                        <input type="number" id="cfg-stock-threshold" value="${settings.lowStockThreshold || 5}" min="0" style="width:200px; padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                    </div>
                    <div style="grid-column:1/-1;">
                        <button type="submit" class="btn btn-primary"><i data-lucide="save"></i> Guardar Configuración</button>
                    </div>
                </form>
            </div>

            <div class="data-table-container" style="margin-bottom:24px;">
                <div class="table-header"><h3><i data-lucide="database" style="width:18px;"></i> Backup y Restauración</h3></div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div style="background:var(--bg-main); border-radius:10px; padding:16px;">
                        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">Último backup automático</div>
                        <div style="font-weight:700; margin-bottom:12px;">${lastBackupText}</div>
                        <button class="btn btn-primary" onclick="performAutoBackup()">
                            <i data-lucide="download"></i> Descargar Backup Ahora
                        </button>
                    </div>
                    <div style="background:var(--bg-main); border-radius:10px; padding:16px;">
                        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">Restaurar desde archivo .json</div>
                        <input type="file" id="restore-file" accept=".json" style="width:100%; margin-bottom:10px; font-size:0.85rem;">
                        <button class="btn btn-outline" onclick="restoreBackup(document.getElementById('restore-file').files[0])">
                            <i data-lucide="upload"></i> Restaurar Backup
                        </button>
                    </div>
                </div>
            </div>

            <div class="data-table-container" style="border:2px solid rgba(239,68,68,0.3)">
                <div class="table-header"><h3 style="color:var(--danger);"><i data-lucide="alert-triangle" style="width:18px;"></i> Zona de Peligro</h3></div>
                <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:16px;">Estas acciones son irreversibles. Realiza un backup antes de proceder.</p>
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <button class="btn btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="clearAllData()">
                        <i data-lucide="trash-2"></i> Borrar Todos los Datos
                    </button>
                    <button class="btn btn-outline" onclick="exportToCSV()">
                        <i data-lucide="file-spreadsheet"></i> Exportar Ventas CSV
                    </button>
                    <button class="btn btn-outline" onclick="exportLogsCSV()">
                        <i data-lucide="file-text"></i> Exportar Logs CSV
                    </button>
                </div>
            </div>
        </div>
        `;
    lucide.createIcons();
}

function saveBusinessSettings() {
    settings.businessName = document.getElementById('cfg-biz-name').value;
    settings.businessRIF = document.getElementById('cfg-biz-rif').value;
    settings.businessPhone = document.getElementById('cfg-biz-phone').value;
    settings.businessAddress = document.getElementById('cfg-biz-addr').value;
    settings.lowStockThreshold = parseInt(document.getElementById('cfg-stock-threshold').value) || 5;
    saveAll();
    UI.showToast('Configuración guardada');
}

// Export CSV
function exportToCSV() {
    let csv = "Fecha,Cliente,Total USD,Total BS,Metodo\n";
    sales.forEach(s => {
        const clientName = clients.find(c => c.id == s.clientId)?.name || 'General';
        csv += `${s.date.split('T')[0]},${clientName},${s.totalUSD || 0},${s.totalBS || 0},${s.paymentType} \n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
    const currentValue = document.getElementById('bcv-value').innerText.replace('Bs. ', '');
    UI.openModal("Actualización Manual de Tasa BCV", `
        < div style = "padding:16px 0;" >
            <label style="display:block; margin-bottom:8px;">Ingresa el valor del dólar actual:</label>
            <input type="number" id="manual-rate-input" step="0.01" value="${currentValue === '--,--' ? '' : currentValue}" 
                style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border-color); font-size:1.2rem;">
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:12px;">Se usará este valor manualmente hasta que refresques con la API.</p>
        </div>
        <button class="btn btn-primary" style="width:100%;" onclick="saveManualRate()">Actualizar Tasa</button>
    `);
}

function saveManualRate() {
    const val = parseFloat(document.getElementById('manual-rate-input').value);
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
spinStyle.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .spinning { animation: spin 1s linear infinite; } `;
document.head.appendChild(spinStyle);

document.getElementById('refresh-bcv').addEventListener('click', fetchBCVRate);
document.getElementById('manual-bcv').addEventListener('click', showManualRateModal);

// No se necesita el listener de 'load' redundante que causa condiciones de carrera
// El inicio se maneja exclusivamente por bootstrapApp en DOMContentLoaded
