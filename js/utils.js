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
        lucide.createIcons();
    },

    closeModal: () => {
        document.getElementById('modal-container').classList.remove('active');
    },

    // Currency Formatting
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('es-VE', {
            style: 'currency',
            currency: 'VES',
            minimumFractionDigits: 2
        }).format(amount).replace('VES', 'Bs.');
    },

    formatUSD: (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
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

    // Search table utility
    searchTable: (inputId, tableId) => {
        const input = document.getElementById(inputId);
        const filter = input.value.toUpperCase();
        const table = document.getElementById(tableId);
        const tr = table.getElementsByTagName("tr");

        for (let i = 1; i < tr.length; i++) {
            let found = false;
            const tdArray = tr[i].getElementsByTagName("td");
            for (let j = 0; j < tdArray.length; j++) {
                if (tdArray[j]) {
                    const txtValue = tdArray[j].textContent || tdArray[j].innerText;
                    if (txtValue.toUpperCase().indexOf(filter) > -1) {
                        found = true;
                        break;
                    }
                }
            }
            tr[i].style.display = found ? "" : "none";
        }
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
