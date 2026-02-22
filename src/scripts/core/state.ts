export const CONSTANTS = {
    MAX_HARMONICS: 60,
    POINTS_PER_LINE: 400,
};

export const state = {
    NUM_HARMONICS: 8,
    harmonics: new Array(CONSTANTS.MAX_HARMONICS).fill(0),
    phases: new Array(CONSTANTS.MAX_HARMONICS).fill(0),
    targetHarmonics: new Array(CONSTANTS.MAX_HARMONICS).fill(0), // For smooth interpolation
    targetPhases: new Array(CONSTANTS.MAX_HARMONICS).fill(0),    // For smooth interpolation
    timeOffset: 0,
    isRadioMode: false,
    is2DMode: false,
    isAutoOrbit: false,
    isImmersiveMode: false
};

// Initialize default harmonic values (Square Wave)
const scale = 67;
for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
    const n = i + 1;
    if (n % 2 !== 0) {
        const val = scale * (4 / (n * Math.PI));
        state.harmonics[i] = val;
        state.targetHarmonics[i] = val;
    }
}
