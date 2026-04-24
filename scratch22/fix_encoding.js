const fs = require('fs');
const path = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
const content = fs.readFileSync(path, 'latin1'); // Read as latin1 to catch the raw bytes
// If it was already UTF-8 but seen as latin1, it will look like 'Ã¡'
// We want to convert those bytes correctly to a UTF-8 string.
const buf = Buffer.from(content, 'latin1');
fs.writeFileSync(path, buf); // This writes the raw bytes. If they were UTF-8, they stay UTF-8.
console.log('File encoding "fixed" (wrote raw bytes)');
