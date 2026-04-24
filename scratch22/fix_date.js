const fs = require('fs');
const path = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
let content = fs.readFileSync(path, 'utf8');

// The script replaced 'da' with 'día' everywhere, which broke 'date' -> 'díate', 'today' -> 'todíay' etc.
// We need to reverse those specific bad replacements:
const fixes = [
    // 'date' was broken -> 'díate'
    { bad: /d\u00edaate/g, good: 'date' },   // díaate
    { bad: /d\u00edaate/g, good: 'date' },   // just in case different unicode
    // 'today' -> 'todíay'
    { bad: /tod\u00edaay/g, good: 'today' },
    // 'data' -> 'díata'  
    { bad: /d\u00edaata/g, good: 'data' },
    // 'update' -> 'updíate'
    { bad: /upd\u00edaate/g, good: 'update' },
    // 'validate' -> 'validíate'
    { bad: /valid\u00edaate/g, good: 'validate' },
    // catch-all: 'díate' -> 'date' when surrounded by word context
    { bad: /d\u00edaate/g, good: 'date' },
];

// Build the actual pattern based on what's in file
// Looking at: díate appears as the literal sequence d í a t e
// In hex: 64 C3 AD 61 74 65 (d, í[utf8: c3 ad], a, t, e)
// We want to replace 'díate' with 'date'
// And 'todíay' with 'today'

let count_before = (content.match(/d\u00edaate/g) || []).length;
console.log('Before díate count:', count_before);

// Simple string replacement
while (content.includes('d\u00edaate')) {
    content = content.split('d\u00edaate').join('date');
}
while (content.includes('tod\u00edaay')) {
    content = content.split('tod\u00edaay').join('today');
}
while (content.includes('d\u00edaata')) {
    content = content.split('d\u00edaata').join('data');
}
while (content.includes('upd\u00edaate')) {
    content = content.split('upd\u00edaate').join('update');
}
while (content.includes('valid\u00edaate')) {
    content = content.split('valid\u00edaate').join('validate');
}
while (content.includes('aplicad\u00eda')) {
    content = content.split('aplicad\u00eda').join('aplicada');
}
// For remaining díate occurrences that are genuinely 'date'
// We need to look at all remaining occurrences
const remaining = content.match(/[a-zA-Z]*d\u00edaate[a-zA-Z]*/g) || [];
console.log('Remaining díate contexts:', [...new Set(remaining)].slice(0, 20));

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
