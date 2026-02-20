export const CONSTANTS = {
    MAX_HARMONICS: 60,
    POINTS_PER_LINE: 400,
};

export const state = {
    NUM_HARMONICS: 10,
    harmonics: new Array(CONSTANTS.MAX_HARMONICS).fill(0),
    phases: new Array(CONSTANTS.MAX_HARMONICS).fill(0),
    timeOffset: 0,
    isRadioMode: false,
    is2DMode: false,
    isAutoOrbit: false,
    isImmersiveMode: false
};

// Default to a square wave pattern for initial visualization
const scale = 67;
for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
    const n = i + 1;
    if (n % 2 !== 0) {
        state.harmonics[i] = scale * (4 / (n * Math.PI));
    }
}
