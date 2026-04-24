const fs = require('fs');
const filePath = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
const rawBuffer = fs.readFileSync(filePath);

// Search for the ACTUAL bytes corresponding to the broken 'd?ate' pattern shown in PowerShell as 'd\uFFFDate'
// The ? in d?ate as shown in PowerShell could be a non-printable/control character
// Let's scan for 'd' followed by non-printable byte then 'ate'

const found = [];
for (let i = 0; i < rawBuffer.length - 4; i++) {
    if (rawBuffer[i] === 0x64) { // 'd'
        const b1 = rawBuffer[i+1];
        // Non-printable: control chars 0x01-0x1F, DEL 0x7F, or non-ASCII 0x80-0xFF
        if ((b1 <= 0x1F && b1 !== 0x0A && b1 !== 0x0D) || b1 === 0x7F || b1 >= 0x80) {
            // Check for 'ate' after
            if (rawBuffer[i+2] === 0x61 && rawBuffer[i+3] === 0x74 && rawBuffer[i+4] === 0x65) {
                found.push({ index: i, badByte: b1.toString(16).padStart(2,'0') });
            }
        }
    }
}
console.log('Found broken date patterns:', found.length, 'sample bytes:', found.slice(0,5).map(f => f.badByte));

// Fix: remove the bad byte between d and ate
if (found.length > 0) {
    const result = [];
    let pos = 0;
    for (const match of found) {
        result.push(rawBuffer.slice(pos, match.index + 1)); // include 'd'
        // Skip the bad byte
        result.push(rawBuffer.slice(match.index + 2, match.index + 5)); // 'ate'
        pos = match.index + 5;
    }
    result.push(rawBuffer.slice(pos));
    const fixedBuffer = Buffer.concat(result);
    fs.writeFileSync(filePath, fixedBuffer);
    console.log('Fixed!');
} else {
    console.log('No broken patterns found at byte level.');
    // Let's see what IS at the indices PowerShell found
    const content = rawBuffer.toString('utf8');
    const idx = content.indexOf('d\u00edate'); // try with í
    console.log('With í:', idx);
    const idx2 = content.indexOf('d\u0000ate'); // null byte
    console.log('With null:', idx2);
}
