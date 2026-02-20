export const state = {
    NUM_HARMONICS: 10,
    MAX_HARMONICS: 60,
    POINTS_PER_LINE: 400,
    harmonics: new Array(60).fill(0),
    phases: new Array(60).fill(0),
    timeOffset: 0,
    isRadioMode: false,
    is2DMode: false,
    isAutoOrbit: false,
    isImmersiveMode: false
};

const scale = 67;
for (let i = 0; i < state.MAX_HARMONICS; i++) {
    const n = i + 1;
    if (n % 2 !== 0) {
        state.harmonics[i] = scale * (4 / (n * Math.PI));
    }
}
