const fs = require('fs');
const filePath = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
let content = fs.readFileSync(filePath, 'utf8');

// The issue: 'd\u00edate' means literal 'd' + 'í' + 'ate' = 'díate' 
// This happened because the word 'date' was matched by a regex that turned 'da' -> 'día'
// So 'da' + 'te' = 'd' + 'í' + 'a' + 'te' ... no that's not right
// Actually 'da' -> 'día' means: d-a -> d-í-a, so 'date' -> 'd' + 'í' + 'a' + 'te' = 'díate'
// The í was INSERTED between d and a

// The pattern to replace: 'd' + 'í' (U+00ED) + 'a' + rest = 'da' + rest
// But we need to be careful not to break actual 'día' words

// Let's count all occurrences of 'día' in the file
const diaCount = (content.match(/d\u00eda/g) || []).length;
console.log('Total occurrences of día:', diaCount);

// Check what surrounds each one
const matches = [...content.matchAll(/[a-zA-Z]*d\u00eda[a-zA-Z]*/g)];
const words = [...new Set(matches.map(m => m[0]))].sort();
console.log('Unique word contexts with día:', words.slice(0, 50));
