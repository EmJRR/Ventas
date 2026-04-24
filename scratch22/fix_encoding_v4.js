const fs = require('fs');
const path = 'c:/Users/LOQ/Desktop/Ventas/js/app.js';
let content = fs.readFileSync(path, 'utf8');

const replacements = [
    { bad: /CÃ¡mara/g, good: 'Cámara' },
    { bad: /Cmara/g, good: 'Cámara' },
    { bad: /vacÃ­o/g, good: 'vacío' },
    { bad: /vaco/g, good: 'vacío' },
    { bad: /inicializaciÃ³n/g, good: 'inicialización' },
    { bad: /inicializacin/g, good: 'inicialización' },
    { bad: /asÃ­ncrona/g, good: 'asíncrona' },
    { bad: /asncrona/g, good: 'asíncrona' },
    { bad: /conexiÃ³n/g, good: 'conexión' },
    { bad: /conexn/g, good: 'conexión' },
    { bad: /configuraciÃ³n/g, good: 'configuración' },
    { bad: /configuracin/g, good: 'configuración' },
    { bad: /automÃ¡tico/g, good: 'automático' },
    { bad: /automtico/g, good: 'automático' },
    { bad: /despuÃ©s/g, good: 'después' },
    { bad: /despus/g, good: 'después' },
    { bad: /estÃ¡n/g, good: 'están' },
    { bad: /estn/g, good: 'están' },
    { bad: /estÃ¡/g, good: 'está' },
    { bad: /mÃ¡s/g, good: 'más' },
    { bad: /ms/g, good: 'más' },
    { bad: /fallÃ³/g, good: 'falló' },
    { bad: /fallo/g, good: 'falló' },
    { bad: /secciÃ³n/g, good: 'sección' },
    { bad: /seccin/g, good: 'sección' },
    { bad: /dÃ­a/g, good: 'día' },
    { bad: /da/g, good: 'día' },
    { bad: /invÃ¡lido/g, good: 'inválido' },
    { bad: /invlido/g, good: 'inválido' },
    { bad: /Ã©xito/g, good: 'éxito' },
    { bad: /xito/g, good: 'éxito' },
    { bad: /categorÃ­a/g, good: 'categoría' },
    { bad: /categora/g, good: 'categoría' },
    { bad: /telÃ©fono/g, good: 'teléfono' },
    { bad: /telfono/g, good: 'teléfono' },
    { bad: /direcciÃ³n/g, good: 'dirección' },
    { bad: /direccin/g, good: 'dirección' },
    { bad: /gestiÃ³n/g, good: 'gestión' },
    { bad: /gestn/g, good: 'gestión' },
    { bad: /comisiÃ³n/g, good: 'comisión' },
    { bad: /comisin/g, good: 'comisión' },
    { bad: /mÃ©todo/g, good: 'método' },
    { bad: /mtodo/g, good: 'método' },
    { bad: /Ãºltima/g, good: 'última' },
    { bad: /ltima/g, good: 'última' },
    { bad: /mÃ¡scara/g, good: 'máscara' },
    { bad: /mscara/g, good: 'máscara' },
    { bad: /Ãºnico/g, good: 'único' },
    { bad: /nico/g, good: 'único' },
    { bad: /Ã±/g, good: 'ñ' },
    { bad: /ðŸ”/g, good: '🔍' },
    { bad: /\ufffd/g, good: '' }
];

replacements.forEach(r => {
    content = content.replace(r.bad, r.good);
});

fs.writeFileSync(path, content, 'utf8');
console.log('Finished manual replacements (fast version)');
