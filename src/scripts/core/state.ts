export const CONSTANTS = {
    MAX_HARMONICS: 60,
    POINTS_PER_LINE: 1000,
};

export const state = {
    NUM_HARMONICS: 10,
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
        state.harmonics[i] = scale * (4 / (n * Math.PI));
    }
}
