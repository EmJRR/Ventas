const fs = require('fs');
const path = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
const content = fs.readFileSync(path); // Read raw bytes

// Check if it's already UTF-8
try {
    const text = content.toString('utf8');
    // If it contains things like 'Ã¡', it means the UTF-8 bytes were interpreted as latin1
    // and then saved again as UTF-8.
    // Example: 'á' (C3 A1) -> interpreted as 'Ã' (C3) and '¡' (A1) -> saved as (C3 83) (C2 A1)
    
    // Let's try to "undouble" it.
    // We can convert the string back to a buffer using 'latin1' encoding, 
    // which maps each character to its byte value.
    const restoredBuf = Buffer.from(text, 'latin1');
    const restoredText = restoredBuf.toString('utf8');
    
    fs.writeFileSync(path, restoredText, 'utf8');
    console.log('Encoding fixed by undoubling UTF-8');
} catch (e) {
    console.error('Failed to fix encoding:', e);
}
