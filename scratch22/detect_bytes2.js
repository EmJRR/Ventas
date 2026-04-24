const fs = require('fs');
const filePath = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
const rawBuffer = fs.readFileSync(filePath);

// Search for 'd' followed by multi-byte UTF-8 then 'ate'
// Multi-byte UTF-8 start bytes: 0xC2-0xEF
const found = [];
for (let i = 0; i < rawBuffer.length - 6; i++) {
    if (rawBuffer[i] === 0x64) { // 'd'
        // Check if next byte starts a multi-byte sequence
        if (rawBuffer[i+1] >= 0xC2 && rawBuffer[i+1] <= 0xEF) {
            // 2-byte sequence: C2-DF xx
            if (rawBuffer[i+1] <= 0xDF && rawBuffer[i+2] === 0x61 && rawBuffer[i+3] === 0x74 && rawBuffer[i+4] === 0x65) {
                // d + [2-byte-char] + ate
                found.push({ index: i, bytes: [rawBuffer[i+1], rawBuffer[i+2]].map(b => b.toString(16)).join(' '), pattern: 'd+2byte+ate' });
            }
            // 3-byte sequence: E0-EF xx xx
            else if (rawBuffer[i+1] >= 0xE0 && rawBuffer[i+2] >= 0x80 && rawBuffer[i+3] === 0x61 && rawBuffer[i+4] === 0x74 && rawBuffer[i+5] === 0x65) {
                found.push({ index: i, bytes: [rawBuffer[i+1], rawBuffer[i+2]].map(b => b.toString(16)).join(' '), pattern: 'd+3byte+ate' });
            }
        }
    }
}
console.log('Found:', found.length);
found.slice(0, 10).forEach(f => {
    // Show context around the match
    const ctx = rawBuffer.slice(Math.max(0, f.index-5), f.index+10);
    console.log(`At ${f.index}: bytes=${f.bytes}, pattern=${f.pattern}, context=${ctx.toString('utf8', 0, ctx.length)}`);
});
