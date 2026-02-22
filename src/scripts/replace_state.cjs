const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');

    // UI/Index.ts
    // 1. replace imports
    content = content.replace(/import \{ state, CONSTANTS \} from "\.\.\/core\/state";/g, 'import { state, renderState, CONSTANTS } from "../core/state";');

    // 2. replace renderState arrays
    content = content.replace(/state\.harmonics/g, 'renderState.harmonics');
    content = content.replace(/state\.phases/g, 'renderState.phases');
    content = content.replace(/state\.targetHarmonics/g, 'renderState.targetHarmonics');
    content = content.replace(/state\.targetPhases/g, 'renderState.targetPhases');

    // 3. replace nanostores getters (we match state.SOME_PROP)
    const props = ['NUM_HARMONICS', 'isRadioMode', 'is2DMode', 'isAutoOrbit', 'isImmersiveMode'];
    props.forEach(prop => {
        // Find setter assignments: state.is2DMode = val;
        const setRe = new RegExp(`state\\.${prop}\\s*=\\s*(.+?);`, 'g');
        content = content.replace(setRe, `state.setKey('${prop}', $1);`);

        // Find getters: state.is2DMode
        const getRe = new RegExp(`state\\.${prop}`, 'g');
        content = content.replace(getRe, `state.get().${prop}`);
    });

    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
}

replaceInFile(path.join(__dirname, 'ui/index.ts'));
replaceInFile(path.join(__dirname, 'fourier.ts'));
