import { state, renderState } from "../core/state";
import { events, AUDIO_EVENTS } from "../core/events";

// Lazy getters for DOM elements to ensure they are fetched after DOM is ready
export const getAudioPlayer = () => document.getElementById("audio-player") as HTMLAudioElement;
export const getNowPlaying = () => document.getElementById("now-playing")!;
export const getSensitivityInput = () => document.getElementById("audio-sensitivity") as HTMLInputElement;

function setAudioIconSpin(isPlaying: boolean) {
    const modeAudio = document.getElementById("mode-audio");
    if (modeAudio) {
        const svg = modeAudio.querySelector("svg");
        if (svg) {
            if (isPlaying) svg.classList.add("animate-[spin_4s_linear_infinite]");
            else svg.classList.remove("animate-[spin_4s_linear_infinite]");
        }
    }
}

// Initialization helper to set up listeners
export function setupAudioListeners() {
    const player = getAudioPlayer();
    if (player) {
        player.addEventListener("play", () => setAudioIconSpin(true));
        player.addEventListener("pause", () => setAudioIconSpin(false));
    }
}

let audioCtx: AudioContext | null = null;
export let analyzer: AnalyserNode | null = null;
export let dataArray: Float32Array | null = null;
let audioSource: MediaElementAudioSourceNode | null = null;

export let micSource: MediaStreamAudioSourceNode | null = null;
export let micStream: MediaStream | null = null;

export function stopMic() {
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    if (micSource) {
        micSource.disconnect();
        micSource = null;
    }
    setAudioIconSpin(false);
}

export function initAudio() {
    if (audioCtx) return;
    const player = getAudioPlayer();
    if (!player) return;

    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 128;
    const bufferLength = analyzer.frequencyBinCount;
    dataArray = new Float32Array(bufferLength);
    audioSource = audioCtx.createMediaElementSource(player);
    audioSource.connect(analyzer);
    analyzer.connect(audioCtx.destination);
}

export function resumeAudioContext() {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

export function switchStation(url: string) {
    const player = getAudioPlayer();
    const nowPlaying = getNowPlaying();
    if (!player) return;

    if (url === "mic") {
        player.pause();
        player.src = "";

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                if (!audioCtx) initAudio();
                stopMic();
                micStream = stream;
                micSource = audioCtx!.createMediaStreamSource(stream);
                micSource.connect(analyzer!);

                if (nowPlaying) nowPlaying.classList.add("hidden");
                setAudioIconSpin(true);
            }).catch(e => {
                console.error("Mic access denied:", e);
                if (nowPlaying) {
                    nowPlaying.innerHTML = "• 麥克風未授權";
                    nowPlaying.classList.remove("hidden");
                }
            });
        }
        return;
    }

    stopMic();
    player.src = url;
    if (state.get().isRadioMode) {
        const playPromise = player.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                if (nowPlaying) nowPlaying.classList.add("hidden");
            }).catch((e: any) => {
                console.error("Audio Switch Error:", e);
                if (nowPlaying) {
                    nowPlaying.innerHTML = "• 點擊畫面允許播放";
                    nowPlaying.classList.remove("hidden");
                }
            });
        }
    }
}

export function updateAudioAnalysis(): number {
    if (!state.get().isRadioMode || !analyzer || !dataArray) return 0;

    analyzer.getFloatFrequencyData(dataArray as any);
    const baseSens = 0.35;
    const input = getSensitivityInput();
    const sens = (input ? parseFloat(input.value) : 1.0) * baseSens;
    const binCount = analyzer.frequencyBinCount;
    const activeHarmonics = state.get().NUM_HARMONICS;

    const minDb = analyzer.minDecibels;
    const maxDb = analyzer.maxDecibels;
    const range = maxDb - minDb;

    let totalEnergy = 0;
    for (let i = 0; i < activeHarmonics; i++) {
        const samplesPerHarmonic = Math.max(1, Math.floor(binCount / activeHarmonics));
        const startBin = i * samplesPerHarmonic;

        let avgVal = 0;
        for (let j = 0; j < samplesPerHarmonic; j++) {
            const dbVal = dataArray[startBin + j] || minDb;
            // Normalize dB value to 0.0 ~ 1.0
            let normalized = (dbVal - minDb) / range;
            if (normalized < 0) normalized = 0;
            if (normalized > 1) normalized = 1;

            // Apply slight exponent curve to make louds louder and quiets quieter like human hearing
            avgVal += Math.pow(normalized, 1.5) * 255;
        }
        avgVal /= samplesPerHarmonic;

        const freqWeight = (i < activeHarmonics * 0.2) ? 1.2 : (i > activeHarmonics * 0.7 ? 1.8 : 1.0);
        const targetAmp = (avgVal / 255) * 100 * sens * freqWeight;
        totalEnergy += avgVal;

        renderState.harmonics[i] += (targetAmp - renderState.harmonics[i]) * 0.15;
        if (avgVal > 50) {
            renderState.phases[i] += (avgVal / 255) * 0.1 * sens;
        }
    }

    const finalEnergy = totalEnergy / activeHarmonics;
    if (finalEnergy > 150) {
        events.emit(AUDIO_EVENTS.BEAT, finalEnergy / 255);
    }

    return finalEnergy;
}
