const fs = require('fs');
const path = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
let content = fs.readFileSync(path, 'utf8');

// Fix all the broken word fragments caused by bad encoding replacements
const fixes = [
    // items -> broken by 'ms' -> 'más' replacement logic
    { bad: /item\u00e1s/g, good: 'items' },        // itemás
    { bad: /item\ufffd/g, good: 'items' },          // item replacement char variant
    // dates
    { bad: /d\u00edaate/g, good: 'date' },          // díaate
    { bad: /d\u00edanc/g, good: 'danc' },           // just in case
    // random fragments
    { bad: /cad\u00eda/g, good: 'cada' },            // cadía  
    { bad: /Aadir/g, good: 'Añadir' },
    { bad: /m\u00e9todo/g, good: 'método' },         // método
    { bad: /aplicad\ufffd/g, good: 'aplicada' },
    { bad: /aplicad\u00eda/g, good: 'aplicada' },     // aplicadía
];

fixes.forEach(r => {
    content = content.replace(r.bad, r.good);
});

fs.writeFileSync(path, content, 'utf8');

// Verify key occurrences
const remaining = ['itemás', 'díate', 'cadía', 'Aadir', 'item\u00e1s'];
remaining.forEach(term => {
    const count = (content.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count > 0) console.log(`Still found '${term}': ${count} times`);
});
console.log('Done');
