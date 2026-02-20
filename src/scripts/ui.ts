import { state, CONSTANTS } from "./state";
import { audioPlayer, nowPlaying, resumeAudioContext, initAudio, switchStation } from "./audio";

// Safe DOM Getter
function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element #${id} not found.`);
    return el as T;
}

// DOM Elements
const slidersContainer = getEl("sliders-container");
const presetBtns = document.querySelectorAll(".preset-btn");

const modeManual = getEl("mode-manual");
const modeAudio = getEl("mode-audio");
const modeAuto = getEl("mode-auto");
const panelManual = getEl("panel-manual");
const panelAudio = getEl("panel-audio");
const panelAuto = getEl("panel-auto");

export const orbitSpeedInput = getEl<HTMLInputElement>("orbit-speed");
export const orbitSpeedVal = getEl("orbit-speed-val");
export const orbitRadiusInput = getEl<HTMLInputElement>("orbit-radius");
const orbitRadiusVal = getEl("orbit-radius-val");
export const sphereSizeInput = getEl<HTMLInputElement>("sphere-size");
const sphereSizeVal = getEl("sphere-size-val");

export const btnAutoOrbit = getEl("btn-auto-orbit");
const btnImmersive = getEl("btn-immersive");
export const btnBloom = getEl("btn-bloom");
const btnFullscreen = getEl("btn-fullscreen");
const nav2D = getEl("nav-2d");

const harmonicCountInput = getEl<HTMLInputElement>("harmonic-count-input");
const stationBtns = document.querySelectorAll(".station-btn") as NodeListOf<HTMLButtonElement>;

export const topHeader = getEl("top-header");
export const bottomHud = getEl("bottom-hud");
export const cameraGuide = getEl("camera-guide");

export let currentStationUrl = stationBtns[0]?.dataset.url;

interface UICallbacks {
    onSwitchMode: (mode: "manual" | "audio" | "auto") => void;
    onToggle2D: (is2D: boolean) => void;
    onToggleBloom: (enabled: boolean) => void;
    onUpdateHarmonicCount: () => void;
}

let callbacks: UICallbacks;

export function setupUI(cb: UICallbacks) {
    callbacks = cb;

    modeManual.addEventListener("click", () => switchMode("manual"));
    modeAudio.addEventListener("click", () => switchMode("audio"));
    modeAuto.addEventListener("click", () => switchMode("auto"));

    btnAutoOrbit.addEventListener("click", (e) => {
        e.stopPropagation();
        state.isAutoOrbit = !state.isAutoOrbit;
        btnAutoOrbit.classList.toggle("active", state.isAutoOrbit);
        if (state.isAutoOrbit) switchMode("auto");
    });

    btnImmersive.addEventListener("click", (e) => {
        e.stopPropagation();
        state.isImmersiveMode = !state.isImmersiveMode;
        btnImmersive.classList.toggle("active", state.isImmersiveMode);

        if (state.isImmersiveMode) {
            topHeader.classList.add("opacity-0", "pointer-events-none");
            bottomHud.classList.add("opacity-0", "pointer-events-none");
            cameraGuide.classList.add("hidden");

        } else {
            topHeader.classList.remove("opacity-0", "pointer-events-none");
            bottomHud.classList.remove("opacity-0", "pointer-events-none");
            cameraGuide.classList.remove("hidden");
        }
    });

    const canvasContainer = document.getElementById("canvas-container");
    if (canvasContainer) {
        canvasContainer.addEventListener("click", () => {
            if (state.isAutoOrbit) {
                state.isAutoOrbit = false;
                btnAutoOrbit.classList.remove("active");
            }
            if (state.isRadioMode && audioPlayer.paused) {
                audioPlayer.play().then(() => {
                    nowPlaying.innerHTML = "• LIVE STREAMING";
                    nowPlaying.classList.remove("text-rose-400", "bg-rose-400/10");
                    nowPlaying.classList.add("text-emerald-400", "bg-emerald-400/10");
                }).catch(() => { });
            }
        });
    }

    btnBloom.addEventListener("click", () => {
        const isEnabled = !btnBloom.classList.contains("active");
        btnBloom.classList.toggle("active", isEnabled);
        callbacks.onToggleBloom(isEnabled);
    });

    btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
            btnFullscreen.classList.add("active");
        } else {
            document.exitFullscreen();
            btnFullscreen.classList.remove("active");
        }
    });

    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) {
            btnFullscreen.classList.remove("active");
        } else {
            btnFullscreen.classList.add("active");
        }
    });

    nav2D.addEventListener("click", () => {
        state.is2DMode = !state.is2DMode;
        nav2D.classList.toggle("active", state.is2DMode);
        callbacks.onToggle2D(state.is2DMode);
    });

    harmonicCountInput.addEventListener("change", () => {
        let count = parseInt(harmonicCountInput.value);
        if (isNaN(count) || count < 1) count = 1;
        if (count > CONSTANTS.MAX_HARMONICS) count = CONSTANTS.MAX_HARMONICS;
        harmonicCountInput.value = count.toString();

        state.NUM_HARMONICS = count;
        callbacks.onUpdateHarmonicCount();
        createSliders();
    });

    stationBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            stationBtns.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            if (btn.dataset.url) {
                currentStationUrl = btn.dataset.url;
                switchStation(btn.dataset.url);
            }
        });
    });

    orbitSpeedInput.addEventListener("input", () => {
        orbitSpeedVal.textContent = `${orbitSpeedInput.value}x`;
    });

    orbitRadiusInput.addEventListener("input", () => {
        orbitRadiusVal.textContent = orbitRadiusInput.value;
    });

    if (sphereSizeInput) {
        sphereSizeInput.addEventListener("input", () => {
            sphereSizeVal.textContent = `${sphereSizeInput.value}x`;
        });
    }

    presetBtns.forEach((btn) => {
        btn.addEventListener("click", () => handlePreset(btn));
    });

    createSliders();
}

export function switchMode(target: "manual" | "audio" | "auto") {
    state.isRadioMode = (target === "audio");

    [panelManual, panelAudio, panelAuto].forEach(p => p.classList.add("hidden", "opacity-0"));
    [modeManual, modeAudio, modeAuto].forEach(m => m.classList.remove("active"));

    if (target === "audio") {
        modeAudio.classList.add("active");
        panelAudio.classList.remove("hidden");
        setTimeout(() => panelAudio.classList.remove("opacity-0"), 10);

        resumeAudioContext();
        initAudio();
        if (!audioPlayer.src || audioPlayer.src === "") {
            audioPlayer.src = currentStationUrl || "https://streaming.positivity.radio/pr/posimeditation/icecast.audio";
        }

        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                nowPlaying.innerHTML = "• LIVE STREAMING";
                nowPlaying.classList.remove("text-rose-400", "bg-rose-400/10");
                nowPlaying.classList.add("text-emerald-400", "bg-emerald-400/10");
            }).catch(() => {
                nowPlaying.innerHTML = "• 點擊畫面允許播放";
                nowPlaying.classList.remove("text-emerald-400", "bg-emerald-400/10");
                nowPlaying.classList.add("text-rose-400", "bg-rose-400/10");
            });
        }
        nowPlaying.classList.remove("hidden");

    } else if (target === "auto") {
        modeAuto.classList.add("active");
        panelAuto.classList.remove("hidden");
        setTimeout(() => panelAuto.classList.remove("opacity-0"), 10);

        if (!audioPlayer.paused) {
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(_ => audioPlayer.pause()).catch(() => { });
            }
        }
        nowPlaying.classList.add("hidden");

        state.isAutoOrbit = true;
        btnAutoOrbit.classList.add("active");

    } else {
        modeManual.classList.add("active");
        panelManual.classList.remove("hidden");
        setTimeout(() => panelManual.classList.remove("opacity-0"), 10);

        if (!audioPlayer.paused) {
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(_ => audioPlayer.pause()).catch(() => { });
            }
        }
        nowPlaying.classList.add("hidden");
    }

    callbacks.onSwitchMode(target);
}

function handlePreset(btn: Element) {
    const preset = btn.getAttribute("data-preset");
    presetBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const scale = 45;
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        let n = i + 1;
        let val = 0;

        if (preset === "square") {
            if (n % 2 !== 0) val = scale * (4 / (n * Math.PI));
        } else if (preset === "sawtooth") {
            val = scale * (2 / (n * Math.PI)) * (n % 2 === 0 ? -1 : 1);
        } else if (preset === "triangle") {
            if (n % 2 !== 0) {
                const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
                val = scale * (8 / (Math.PI * Math.PI * n * n)) * sign;
            }
        } else if (preset === "custom") {
            return;
        }

        state.harmonics[i] = val;
        state.phases[i] = 0;
    }
    if (preset !== "custom") updateSlidersUI();
}

export function createSliders() {
    slidersContainer.innerHTML = "";

    for (let i = 0; i < state.NUM_HARMONICS; i++) {
        const group = document.createElement("div");
        group.className = "bg-black/40 p-2 rounded-xl border border-white/5 flex flex-col gap-1 w-full hover:bg-white/5 transition-colors";

        const header = document.createElement("div");
        header.className = "flex justify-between text-[8px] text-slate-500 font-bold uppercase mb-1";
        header.innerHTML = `<span>H${i + 1}</span>`;

        const createStepBtn = (label: string, slider: HTMLInputElement, isUp: boolean) => {
            const b = document.createElement("button");
            b.className = "w-4 h-4 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-white/40 text-[10px] transition-colors";
            b.textContent = label;
            b.onclick = (e) => {
                e.stopPropagation();
                if (isUp) slider.stepUp(); else slider.stepDown();
                slider.dispatchEvent(new Event("input"));
            };
            return b;
        };

        const ampVal = document.createElement("span");
        ampVal.id = `val-${i}`;
        ampVal.className = "text-[9px] font-mono text-blue-400 w-6 text-right";
        ampVal.textContent = state.harmonics[i].toFixed(0);
        const ampSlider = document.createElement("input");
        ampSlider.type = "range";
        ampSlider.className = "accent-blue-500 flex-grow";
        ampSlider.min = "-100";
        ampSlider.max = "100";
        ampSlider.value = state.harmonics[i].toString();

        const phiVal = document.createElement("span");
        phiVal.id = `phi-${i}`;
        phiVal.className = "text-[9px] font-mono text-purple-400 w-6 text-right";
        phiVal.textContent = (state.phases[i] / Math.PI).toFixed(1);
        const phiSlider = document.createElement("input");
        phiSlider.type = "range";
        phiSlider.className = "accent-purple-500 flex-grow";
        phiSlider.min = "0";
        phiSlider.max = "6.28";
        phiSlider.step = "0.1";
        phiSlider.value = state.phases[i].toString();

        const ampWrapper = document.createElement("div");
        ampWrapper.className = "flex items-center gap-1";
        ampWrapper.appendChild(createStepBtn("-", ampSlider, false));
        ampWrapper.appendChild(ampSlider);
        ampWrapper.appendChild(createStepBtn("+", ampSlider, true));
        ampWrapper.appendChild(ampVal);

        const phiWrapper = document.createElement("div");
        phiWrapper.className = "flex items-center gap-1 opacity-70";
        phiWrapper.appendChild(createStepBtn("-", phiSlider, false));
        phiWrapper.appendChild(phiSlider);
        phiWrapper.appendChild(createStepBtn("+", phiSlider, true));
        phiWrapper.appendChild(phiVal);

        const updateVals = () => {
            state.harmonics[i] = parseFloat(ampSlider.value);
            state.phases[i] = parseFloat(phiSlider.value);
            ampVal.textContent = state.harmonics[i].toFixed(0);
            phiVal.textContent = (state.phases[i] / Math.PI).toFixed(1);

            // Set to custom
            presetBtns.forEach((b) => b.classList.remove("active"));
            const customBtn = document.querySelector('[data-preset="custom"]') as HTMLElement;
            if (customBtn) customBtn.classList.add("active");
        };

        ampSlider.addEventListener("input", updateVals);
        phiSlider.addEventListener("input", updateVals);

        group.appendChild(header);
        group.appendChild(ampWrapper);
        group.appendChild(phiWrapper);
        slidersContainer.appendChild(group);
    }
}

export function updateSlidersUI() {
    const sliders = slidersContainer.querySelectorAll('input[type="range"]');
    sliders.forEach((slider, i) => {
        (slider as HTMLInputElement).value = state.harmonics[i].toString();
        const valLabel = document.getElementById(`val-${i}`);
        if (valLabel) valLabel.textContent = state.harmonics[i].toFixed(1);
    });
}
