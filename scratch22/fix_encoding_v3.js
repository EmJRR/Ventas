const fs = require('fs');
const path = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
let content = fs.readFileSync(path, 'utf8');

// Use strings instead of regex literals for special characters to avoid syntax errors
const replacements = [
    { bad: 'CÃ¡mara', good: 'Cámara' },
    { bad: 'Cmara', good: 'Cámara' },
    { bad: 'vacÃ­o', good: 'vacío' },
    { bad: 'vaco', good: 'vacío' },
    { bad: 'inicializaciÃ³n', good: 'inicialización' },
    { bad: 'inicializacin', good: 'inicialización' },
    { bad: 'asÃ­ncrona', good: 'asíncrona' },
    { bad: 'asncrona', good: 'asíncrona' },
    { bad: 'conexiÃ³n', good: 'conexión' },
    { bad: 'conexn', good: 'conexión' },
    { bad: 'configuraciÃ³n', good: 'configuración' },
    { bad: 'configuracin', good: 'configuración' },
    { bad: 'automÃ¡tico', good: 'automático' },
    { bad: 'automtico', good: 'automático' },
    { bad: 'despuÃ©s', good: 'después' },
    { bad: 'despus', good: 'después' },
    { bad: 'estÃ¡n', good: 'están' },
    { bad: 'estn', good: 'están' },
    { bad: 'estÃ¡', good: 'está' },
    { bad: 'mÃ¡s', good: 'más' },
    { bad: 'ms', good: 'más' },
    { bad: 'fallÃ³', good: 'falló' },
    { bad: 'fallo', good: 'falló' },
    { bad: 'secciÃ³n', good: 'sección' },
    { bad: 'seccin', good: 'sección' },
    { bad: 'dÃ­a', good: 'día' },
    { bad: 'da', good: 'día' },
    { bad: 'invÃ¡lido', good: 'inválido' },
    { bad: 'invlido', good: 'inválido' },
    { bad: 'Ã©xito', good: 'éxito' },
    { bad: 'xito', good: 'éxito' },
    { bad: 'categorÃ­a', good: 'categoría' },
    { bad: 'categora', good: 'categoría' },
    { bad: 'telÃ©fono', good: 'teléfono' },
    { bad: 'telfono', good: 'teléfono' },
    { bad: 'direcciÃ³n', good: 'dirección' },
    { bad: 'direccin', good: 'dirección' },
    { bad: 'gestiÃ³n', good: 'gestión' },
    { bad: 'gestn', good: 'gestión' },
    { bad: 'comisiÃ³n', good: 'comisión' },
    { bad: 'comisin', good: 'comisión' },
    { bad: 'mÃ©todo', good: 'método' },
    { bad: 'mtodo', good: 'método' },
    { bad: 'Ãºltima', good: 'última' },
    { bad: 'ltima', good: 'última' },
    { bad: 'mÃ¡scara', good: 'máscara' },
    { bad: 'mscara', good: 'máscara' },
    { bad: 'Ãºnico', good: 'único' },
    { bad: 'nico', good: 'único' },
    { bad: 'Ã±', good: 'ñ' },
    { bad: 'ðŸ”', good: '🔍' },
    { bad: 'ðŸ”', good: '🔍' },
    { bad: '\uFFFD', good: '' } // Remove replacement character if found standalone
];

replacements.forEach(r => {
    while(content.includes(r.bad)) {
        content = content.replace(r.bad, r.good);
    }
});

fs.writeFileSync(path, content, 'utf8');
console.log('Finished manual replacements');
