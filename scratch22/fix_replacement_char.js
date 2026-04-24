const fs = require('fs');
const filePath = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
let content = fs.readFileSync(filePath, 'utf8');

// The broken chars are U+FFFD (replacement char) followed by 'ate' or 'ate'
// d\uFFFDate -> date
// Upd\uFFFDate -> Update  
// upd\uFFFDateCartUI -> updateCartUI

// Replace the broken sequences systematically
const brokenPairs = [
    // d + replacement_char + ate = date
    ['d\uFFFDate', 'date'],
    ['D\uFFFDate', 'Date'],
    // upd + replacement_char + ate = update
    ['upd\uFFFDate', 'update'],
    ['Upd\uFFFDate', 'Update'],
    ['UPD\uFFFDate', 'UPDATE'],
];

let totalFixed = 0;
brokenPairs.forEach(([bad, good]) => {
    const regex = new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const before = (content.match(regex) || []).length;
    content = content.replace(regex, good);
    if (before > 0) console.log(`Fixed "${bad}" -> "${good}": ${before} times`);
    totalFixed += before;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Total fixes: ${totalFixed}`);

// Verify
const check = (content.match(/\ufffd/g) || []).length;
console.log(`Remaining replacement chars: ${check}`);
