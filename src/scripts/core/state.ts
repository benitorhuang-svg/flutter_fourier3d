import { map, atom } from 'nanostores';

export const CONSTANTS = {
    MAX_HARMONICS: 60,
    POINTS_PER_LINE: 1500, // Increased resolution for smoother curves
};

// High-frequency render state (Updated 60 times a sec, not suitable for reactive UI stores)
export const renderState = {
    harmonics: new Array(CONSTANTS.MAX_HARMONICS).fill(0),
    phases: new Array(CONSTANTS.MAX_HARMONICS).fill(0),
    targetHarmonics: new Array(CONSTANTS.MAX_HARMONICS).fill(0),
    targetPhases: new Array(CONSTANTS.MAX_HARMONICS).fill(0),
    timeOffset: 0,
};

// Global UI and Mode State (Nanostores for Astro <-> Three.js bridging)
export const state = map({
    NUM_HARMONICS: 8,
    isRadioMode: false,
    is2DMode: false,
    isAutoOrbit: false,
    isImmersiveMode: false
});

// Initialize default harmonic values (Square Wave)
const scale = 67;
for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
    const n = i + 1;
    if (n % 2 !== 0) {
        const val = scale * (4 / (n * Math.PI));
        renderState.harmonics[i] = val;
        renderState.targetHarmonics[i] = val;
    }
}
