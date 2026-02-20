import { atom, map } from 'nanostores';

export type AppMode = 'manual' | 'audio' | 'auto';

// UI State Stores
export const appModeStore = atom<AppMode>('manual');
export const is2DModeStore = atom<boolean>(false);
export const isAutoOrbitStore = atom<boolean>(false);
export const isImmersiveModeStore = atom<boolean>(false);
export const isBloomEnabledStore = atom<boolean>(true);
export const numHarmonicsStore = atom<number>(10);
export const fpsStore = atom<number>(60);
export const devicePixelRatioStore = atom<number>(Math.min(window.devicePixelRatio, 2));

// Rendering Config (High frequency updates don't use stores for performance)
export const CONSTANTS = {
    MAX_HARMONICS: 60,
    POINTS_PER_LINE: 400,
};

export const coreState = {
    harmonics: new Array(CONSTANTS.MAX_HARMONICS).fill(0),
    phases: new Array(CONSTANTS.MAX_HARMONICS).fill(0),
    timeOffset: 0,
};

// Initialize default harmonic values
const scale = 67;
for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
    const n = i + 1;
    if (n % 2 !== 0) {
        coreState.harmonics[i] = scale * (4 / (n * Math.PI));
    }
}
