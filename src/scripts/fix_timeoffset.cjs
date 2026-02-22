const fs = require('fs');
const content = fs.readFileSync('C:/Users/benit/Desktop/triangle_flow_demo/fourier-3d/src/scripts/fourier.ts', 'utf-8');
const updated = content.replace(/state\.timeOffset/g, 'renderState.timeOffset');
fs.writeFileSync('C:/Users/benit/Desktop/triangle_flow_demo/fourier-3d/src/scripts/fourier.ts', updated);
