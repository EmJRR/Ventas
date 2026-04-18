/* utils.js - Common UI helper functions */
const UI = {
    // Show toast notification
    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.classList.add('toast', `toast-${type}`);

        let icon = 'check-circle';
        if (type === 'error') icon = 'alert-circle';
        if (type === 'warning') icon = 'alert-triangle';

        toast.innerHTML = `
            <i data-lucide="${icon}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        lucide.createIcons();

        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    // Open/Close Modal
    openModal: (title, contentHTML) => {
        const modalContainer = document.getElementById('modal-container');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');

        modalTitle.textContent = title;
        modalBody.innerHTML = contentHTML;
        modalContainer.classList.add('active');
        
        // Aplicar máscara a campos específicos automáticamente
        const currencyInputs = modalBody.querySelectorAll('.currency-input');
        currencyInputs.forEach(input => UI.maskCurrency(input));

        lucide.createIcons();
    },

    closeModal: () => {
        document.getElementById('modal-container').classList.remove('active');
    },

    // Currency Formatting & Input Masking
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('es-VE', {
            style: 'currency',
            currency: 'VES',
            minimumFractionDigits: 2
        }).format(amount).replace('VES', 'Bs. ');
    },

    formatUSD: (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount).replace('USD', '$');
    },

    // Formateo dinámico para inputs (Máscara)
    maskCurrency: (input) => {
        if (!input) return;
        input.addEventListener('input', (e) => {
            // Eliminar todo lo que no sea número
            let value = e.target.value.replace(/\D/g, "");
            if (value === "") {
                e.target.value = "";
                return;
            }
            // Tratarlo como entero de centavos (ej: 100 -> 1,00)
            let numericValue = (parseInt(value, 10) / 100).toFixed(2);
            
            // Formatear con estilo local (punto miles, coma decimal)
            const parts = numericValue.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            e.target.value = parts.join(',');
        });
        
        // Evitar que entren letras o caracteres especiales
        input.addEventListener('keydown', (e) => {
            if (!/[\d\b\t]|Arrow|Backspace|Delete|Tab/.test(e.key) && !e.ctrlKey) {
                // e.preventDefault(); // Comentado para permitir navegación, la máscara limpia en 'input'
            }
        });
    },

    // Convertir el texto de la máscara a número procesable
    parseCurrency: (formattedStr) => {
        if (!formattedStr || typeof formattedStr !== 'string') return parseFloat(formattedStr) || 0;
        // Quitar puntos de miles y reemplazar coma por punto decimal
        const cleanValue = formattedStr.replace(/\./g, '').replace(',', '.');
        return parseFloat(cleanValue) || 0;
    },

    // Date Formatting
    formatDate: (dateStr) => {
        return new Date(dateStr).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Paginación y Filtrado
    searchTable: (inputId, tableId) => {
        const input = document.getElementById(inputId);
        if (!input) return;
        const filter = input.value.toUpperCase();
        const element = document.getElementById(tableId);
        if (!element) return;

        const tbody = element.tagName === 'TBODY' ? element : element.querySelector('tbody');
        if (!tbody) return;
        const tr = tbody.getElementsByTagName("tr");

        for (let i = 0; i < tr.length; i++) {
            let found = false;
            const tdArray = tr[i].getElementsByTagName("td");
            if (tdArray.length === 1 && tdArray[0].colSpan > 1) continue; // Saltar placeholder

            for (let j = 0; j < tdArray.length; j++) {
                if (tdArray[j]) {
                    const txtValue = tdArray[j].textContent || tdArray[j].innerText;
                    if (txtValue.toUpperCase().indexOf(filter) > -1) {
                        found = true;
                        break;
                    }
                }
            }
            if (found) {
                tr[i].classList.remove('search-hidden');
            } else {
                tr[i].classList.add('search-hidden');
            }
        }

        element.dataset.currentPage = 1;
        if (element.dataset.paginate === 'true') {
            UI.paginateTable(tableId, parseInt(element.dataset.itemsPerPage) || 15);
        } else {
            for (let i = 0; i < tr.length; i++) {
                tr[i].style.display = tr[i].classList.contains('search-hidden') ? 'none' : '';
            }
        }
    },

    paginateTable: (tableId, itemsPerPage = 15) => {
        const element = document.getElementById(tableId);
        if (!element) return;

        const tbody = element.tagName === 'TBODY' ? element : element.querySelector('tbody');
        if (!tbody) return;

        element.dataset.paginate = 'true';
        element.dataset.itemsPerPage = itemsPerPage;

        let paginationContainer = element.tagName === 'TBODY' ? element.parentElement.nextElementSibling : element.nextElementSibling;

        if (!paginationContainer || !paginationContainer.classList.contains('pagination-controls')) {
            paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination-controls';
            paginationContainer.style.cssText = 'display:flex; justify-content:center; gap:8px; margin-top:16px; padding-bottom:16px; align-items:center; flex-wrap:wrap;';
            const insertAfterNode = element.tagName === 'TBODY' ? element.parentElement : element;
            insertAfterNode.parentNode.insertBefore(paginationContainer, insertAfterNode.nextSibling);
        }

        element.dataset.currentPage = element.dataset.currentPage || 1;
        let currentPage = parseInt(element.dataset.currentPage);

        const rows = Array.from(tbody.getElementsByTagName('tr'));
        const dataRows = rows.filter(r => !(r.cells.length === 1 && r.cells[0].colSpan > 1));
        const visibleRows = dataRows.filter(r => !r.classList.contains('search-hidden'));

        const totalPages = Math.ceil(visibleRows.length / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        element.dataset.currentPage = currentPage;

        dataRows.forEach(r => r.style.display = 'none'); // Esconder todo internamente

        const startIndex = (currentPage - 1) * itemsPerPage;
        const pageRows = visibleRows.slice(startIndex, Math.min(startIndex + itemsPerPage, visibleRows.length));
        pageRows.forEach(r => r.style.display = ''); // Mostrar página

        paginationContainer.innerHTML = `
            <button class="btn btn-outline btn-sm" ${currentPage === 1 ? 'disabled style="opacity:0.5"' : `onclick="UI.changePage('${tableId}', -1)"`}>« Anterior</button>
            <span style="font-size:0.85rem; font-weight:800; color:var(--primary); background:var(--border-color); padding:6px 16px; border-radius:12px;">Página ${currentPage} de ${totalPages}</span>
            <button class="btn btn-outline btn-sm" ${currentPage === totalPages ? 'disabled style="opacity:0.5"' : `onclick="UI.changePage('${tableId}', 1)"`}>Siguiente »</button>
        `;
    },

    changePage: (tableId, dir) => {
        const element = document.getElementById(tableId);
        if (!element) return;
        let p = parseInt(element.dataset.currentPage) || 1;
        element.dataset.currentPage = p + dir;
        UI.paginateTable(tableId, parseInt(element.dataset.itemsPerPage) || 15);
    }
};

// Also adding simple Toast CSS here for now to be injected
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    .toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 3000;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .toast {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 24px;
        background-color: #fff;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        border-left: 4px solid var(--primary);
        animation: slideInRight 0.3s ease;
    }
    .toast-success { border-color: var(--success); }
    .toast-error { border-color: var(--danger); }
    .toast-warning { border-color: var(--warning); }
    
    .toast.hide {
        transform: translateX(120%);
        opacity: 0;
        transition: 0.5s ease;
    }
    @keyframes slideInRight {
        from { transform: translateX(120%); }
        to { transform: translateX(0); }
    }
`;
document.head.appendChild(toastStyle);

// Función para obtener y mostrar el tipo de cambio del Dólar BCV
async function fetchDollarRate() {
    const dolarValueSpan = document.getElementById('dolar-value');
    const dolarDateSpan = document.getElementById('dolar-date');

    if (!dolarValueSpan) return; // Salir si no existe el elemento en la página

    try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares');
        const data = await response.json();

        // Buscar la tasa oficial (BCV)
        const bcvRate = data.find(rate => rate.fuente === 'oficial');

        if (bcvRate && bcvRate.promedio) {
            // Formatear el monto (ej: 480,26)
            const formattedRate = bcvRate.promedio.toLocaleString('es-VE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

            dolarValueSpan.textContent = `Bs ${formattedRate}`;

            // Formatear la fecha de actualización
            const updateDate = new Date(bcvRate.fechaActualizacion);
            const formattedDate = updateDate.toLocaleDateString('es-VE');
            dolarDateSpan.textContent = `(Actualizado: ${formattedDate})`;
        } else {
            dolarValueSpan.textContent = 'No disponible';
        }
    } catch (error) {
        console.error('Error al obtener el tipo de cambio:', error);
        dolarValueSpan.textContent = 'Error al cargar';
    }
}



// Ejecutar la función al cargar la página
document.addEventListener('DOMContentLoaded', fetchDollarRate);
