const fs = require('fs');
const path = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
let content = fs.readFileSync(path, 'utf8');

const finalFixes = [
    { bad: /itemás/g, good: 'items' },
    { bad: /díate/g, good: 'date' },
    { bad: /Aadir/g, good: 'Añadir' },
    { bad: /cadía/g, good: 'cada' },
    { bad: /mtodos/g, good: 'métodos' },
    { bad: /mtodo/g, good: 'método' },
    { bad: /Seccin/g, good: 'Sección' },
    { bad: /Configuracin/g, good: 'Configuración' },
    { bad: /Comisin/g, good: 'Comisión' },
    { bad: /Cmara/g, good: 'Cámara' },
    { bad: /Cdigo/g, good: 'Código' },
    { bad: /díata/g, good: 'data' }
];

finalFixes.forEach(r => {
    content = content.replace(r.bad, r.good);
});

fs.writeFileSync(path, content, 'utf8');
console.log('Final encoding polish finished');
