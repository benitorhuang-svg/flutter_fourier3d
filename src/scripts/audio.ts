import { state, CONSTANTS } from "./state";

export const audioPlayer = document.getElementById("audio-player") as HTMLAudioElement;
export const nowPlaying = document.getElementById("now-playing")!;
export const sensitivityInput = document.getElementById("audio-sensitivity") as HTMLInputElement;

let audioCtx: AudioContext | null = null;
export let analyzer: AnalyserNode | null = null;
export let dataArray: Uint8Array | null = null;
let audioSource: MediaElementAudioSourceNode | null = null;

export function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 128;
    const bufferLength = analyzer.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    audioSource = audioCtx.createMediaElementSource(audioPlayer);
    audioSource.connect(analyzer);
    analyzer.connect(audioCtx.destination);
}

export function resumeAudioContext() {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

export function switchStation(url: string) {
    audioPlayer.src = url;
    if (state.isRadioMode) {
        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                nowPlaying.innerHTML = "• LIVE STREAMING";
                nowPlaying.classList.remove("text-rose-400", "bg-rose-400/10");
                nowPlaying.classList.add("text-emerald-400", "bg-emerald-400/10");
            }).catch((e: any) => {
                console.error("Audio Switch Error:", e);
                nowPlaying.innerHTML = "• 點擊畫面允許播放";
                nowPlaying.classList.remove("text-emerald-400", "bg-emerald-400/10");
                nowPlaying.classList.add("text-rose-400", "bg-rose-400/10");
            });
        }
    }
}

export function updateAudioAnalysis(): number {
    if (!state.isRadioMode || !analyzer || !dataArray) return 0;

    analyzer.getByteFrequencyData(dataArray as any);
    const baseSens = 0.35; // "Sensitivity 再次調低，現在 0.35 作為標準值 1"
    const sens = parseFloat(sensitivityInput.value) * baseSens;

    const binCount = analyzer.frequencyBinCount;

    // Total energy for global vibration
    let totalEnergy = 0;

    for (let i = 0; i < state.NUM_HARMONICS; i++) {
        // Logarithmic-styled mapping to get Bass, Mids, and Treble
        const samplesPerHarmonic = Math.max(1, Math.floor(binCount / state.NUM_HARMONICS));
        const startBin = i * samplesPerHarmonic;

        let avgVal = 0;
        for (let j = 0; j < samplesPerHarmonic; j++) {
            avgVal += dataArray[startBin + j] || 0;
        }
        avgVal /= samplesPerHarmonic;

        const freqWeight = (i < state.NUM_HARMONICS * 0.2) ? 1.2 : (i > state.NUM_HARMONICS * 0.7 ? 1.8 : 1.0);
        const targetAmp = (avgVal / 255) * 100 * sens * freqWeight;

        totalEnergy += avgVal;

        // Fluid smoothing
        state.harmonics[i] += (targetAmp - state.harmonics[i]) * 0.15;

        // Add a "micro-vibration" to phases based on individual frequency intensity
        if (avgVal > 50) {
            state.phases[i] += (avgVal / 255) * 0.1 * sens;
        }
    }

    return totalEnergy / state.NUM_HARMONICS;
}
