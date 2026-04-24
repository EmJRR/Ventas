const fs = require('fs');
const path = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
let content = fs.readFileSync(path, 'utf8');

const surgicalReplacements = [
    { bad: /díata/g, good: 'data' },
    { bad: /align-itemás/g, good: 'align-items' },
    { bad: /placeholder="x\s+/g, good: 'placeholder="🔍 ' },
    { bad: /Cmara/g, good: 'Cámara' },
    { bad: /Cdigo/g, good: 'Código' },
    { bad: /Descripcin/g, good: 'Descripción' },
    { bad: /Comisin/g, good: 'Comisión' },
    { bad: /Configuracin/g, good: 'Configuración' },
    { bad: /Historial Logic/g, good: 'Historial Logic' },
    { bad: /Seccin/g, good: 'Sección' }
];

surgicalReplacements.forEach(r => {
    content = content.replace(r.bad, r.good);
});

fs.writeFileSync(path, content, 'utf8');
console.log('Finished surgical replacements');
