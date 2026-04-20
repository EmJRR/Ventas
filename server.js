const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Helper to get file path
const getFilePath = (key) => path.join(DATA_DIR, `${key}.json`);

// API Endpoints
app.get('/api/all', (req, res) => {
    const keys = ['products', 'clients', 'sales', 'payments', 'egresos', 'settings', 'logs'];
    const result = {};
    keys.forEach(key => {
        const p = getFilePath(key);
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                if (content.trim()) {
                    result[key] = JSON.parse(content);
                } else {
                    result[key] = key === 'settings' ? { lowStockThreshold: 5 } : [];
                }
            } catch (e) {
                console.error(`❌ Error parsing ${key}.json:`, e);
                result[key] = key === 'settings' ? { lowStockThreshold: 5 } : [];
            }
        } else {
            result[key] = key === 'settings' ? { lowStockThreshold: 5 } : [];
        }
    });
    res.json(result);
});

app.post('/api/save/:key', (req, res) => {
    const key = req.params.key;
    const filePath = getFilePath(key);
    const backupPath = `${filePath}.bak`;

    // Protección: Si el archivo existe, crear backup temporal antes de sobrescribir
    if (fs.existsSync(filePath)) {
        try {
            fs.copyFileSync(filePath, backupPath);
        } catch (e) {
            console.warn(`Could not create backup for ${key}`);
        }
    }

    fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
        if (err) {
            console.error(`Error saving ${key}:`, err);
            return res.status(500).json({ error: 'Failed to save data' });
        }
        res.json({ success: true });
    });
});

// Full Backup Endpoint (Silent server-side backup)
app.post('/api/backup/silent', (req, res) => {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
    
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(backupDir, filename);
    
    fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
        if (err) {
            console.error('Error creating silent backup:', err);
            return res.status(500).json({ error: 'Failed to create backup' });
        }
        res.json({ success: true, filename });
    });
});

// Fallback for SPA (if needed, though it's static)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.clear();
    console.log('=========================================');
    console.log('   SISTEMA DE VENTAS - SERVIDOR LOCAL    ');
    console.log('=========================================');
    console.log(`\nLaptop: http://localhost:${PORT}`);
    
    // Attempt to show local IP
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    console.log('\nMóvil (desde el mismo WiFi):');
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`👉 http://${net.address}:${PORT}`);
            }
        }
    }
    console.log('\n-----------------------------------------');
    console.log('Presiona Ctrl+C para detener el servidor');
});
