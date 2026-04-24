const fs = require('fs');
const filePath = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';

// Read as a raw buffer
const rawBuffer = fs.readFileSync(filePath);

// Convert to hex string to examine the broken sequence
let hex = rawBuffer.toString('hex');

// Pattern: 64 (d) + [some broken bytes] + 61 74 65 (ate)
// Let's find all occurrences of broken 'd?ate' patterns

// Try: replace 64 XX 61 74 65 where XX is not 61-7a or 41-5a (not a letter)
// with just 64 61 74 65 (date)

// First let's see what byte is between d and ate
const indices = [];
for (let i = 0; i < rawBuffer.length - 4; i++) {
    if (rawBuffer[i] === 0x64 && rawBuffer[i+2] === 0x61 && rawBuffer[i+3] === 0x74 && rawBuffer[i+4] === 0x65) {
        const middleByte = rawBuffer[i+1];
        // Skip if middle byte is a normal letter or digit
        if (!((middleByte >= 0x41 && middleByte <= 0x5a) || (middleByte >= 0x61 && middleByte <= 0x7a) || (middleByte >= 0x30 && middleByte <= 0x39))) {
            indices.push({ index: i, middleByte: middleByte.toString(16) });
        }
    }
}
console.log('Found broken date patterns:', indices.length, 'examples:', indices.slice(0, 5));
