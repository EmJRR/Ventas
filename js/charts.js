/* charts.js - Dashboard Visualization */
const Charts = {
    renderMainChart: (canvasId, sales) => {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        // Group sales by date (last 7 days)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toISOString().split('T')[0]);
        }

        const dailyTotals = last7Days.map(date => {
            return sales
                .filter(s => s.date.split('T')[0] === date)
                .reduce((acc, s) => acc + (s.totalUSD || 0), 0);
        });

        // Destroy previous chart if exists (Chart.js instance)
        if (window.myChart) window.myChart.destroy();

        const primaryColor = '#4f46e5';
        const primaryGlow = 'rgba(79, 70, 229, 0.08)';
        
        window.myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days.map(d => d.split('-').slice(1).reverse().join('/')),
                datasets: [{
                    label: 'Ventas ($)',
                    data: dailyTotals,
                    borderColor: primaryColor,
                    backgroundColor: primaryGlow,
                    borderWidth: 4,
                    tension: 0.5,
                    fill: true,
                    pointBackgroundColor: primaryColor,
                    pointBorderColor: '#fff',
                    pointHoverRadius: 8,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#ffffff',
                        titleColor: '#1e293b',
                        bodyColor: '#64748b',
                        borderColor: 'rgba(79, 70, 229, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 12,
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: { color: '#64748b', font: { size: 11, family: 'Inter' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { size: 11, family: 'Inter' } }
                    }
                }
            }
        });
    }
};
