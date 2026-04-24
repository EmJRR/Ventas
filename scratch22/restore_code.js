const fs = require('fs');
const path = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
let content = fs.readFileSync(path, 'utf8');

// Comprehensive list of broken patterns to fix
const fixes = [
    // Core technical words broken by da -> día
    { bad: /d\u00edaate/g, good: 'date' },
    { bad: /tod\u00edaay/g, good: 'today' },
    { bad: /d\u00edaata/g, good: 'data' },
    { bad: /upd\u00edaate/g, good: 'update' },
    { bad: /valid\u00edaate/g, good: 'validate' },
    { bad: /díate/g, good: 'date' },
    { bad: /todíay/g, good: 'today' },
    { bad: /díata/g, good: 'data' },
    { bad: /updíate/g, good: 'update' },
    { bad: /validíate/g, good: 'validate' },
    
    // Core technical words broken by ms -> más
    { bad: /item\u00e1s/g, good: 'items' },
    { bad: /itemás/g, good: 'items' },
    { bad: /param\u00e1s/g, good: 'params' },
    { bad: /paramás/g, good: 'params' },
    { bad: /form\u00e1s/g, good: 'forms' },
    { bad: /formás/g, good: 'forms' },
    
    // UI elements and attributes
    { bad: /align-item\u00e1s/g, good: 'align-items' },
    { bad: /align-itemás/g, good: 'align-items' },
    { bad: /justify-content/g, good: 'justify-content' }, // check if broken
    { bad: /díash/g, good: 'dash' },
    { bad: /d\u00edash/g, good: 'dash' },
    
    // Fragments
    { bad: /cad\u00eda/g, good: 'cada' },
    { bad: /cadía/g, good: 'cada' },
    { bad: /Aadir/g, good: 'Añadir' },
    { bad: /aplicad\u00eda/g, good: 'aplicada' },
    { bad: /aplicadía/g, good: 'aplicada' },
    { bad: /mtodos/g, good: 'métodos' },
    { bad: /mtodo/g, good: 'método' },
    
    // Lucide and other icon names
    { bad: /d\u00edata-lucide/g, good: 'data-lucide' },
    { bad: /díata-lucide/g, good: 'data-lucide' },
    
    // Special Characters
    { bad: /\ufffd/g, good: '' }, // Remove leftover replacement chars
    { bad: /Cmara/g, good: 'Cámara' },
    { bad: /Cdigo/g, good: 'Código' },
    { bad: /Descripcin/g, good: 'Descripción' }
];

fixes.forEach(r => {
    content = content.replace(r.bad, r.good);
});

// Final check for the word 'itemás' or 'díate'
content = content.split('itemás').join('items');
content = content.split('díate').join('date');
content = content.split('díata').join('data');
content = content.split('todíay').join('today');
content = content.split('updíate').join('update');

fs.writeFileSync(path, content, 'utf8');
console.log('Encoding fixed and technical words restored.');
