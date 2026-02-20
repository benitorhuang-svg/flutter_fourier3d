import { state } from '../core/state';

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
        audioPlayer.play().then(() => {
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
