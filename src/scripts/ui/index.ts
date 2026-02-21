import { state, CONSTANTS } from "../core/state";
import { events, UI_EVENTS } from "../core/events";
import {
    getAudioPlayer,
    getNowPlaying,
    getSensitivityInput,
    resumeAudioContext,
    initAudio,
    switchStation,
    stopMic,
    setupAudioListeners
} from "../audio";
import { fetchMarketData } from "../market/api";

// Safe DOM Getter helper
function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element #${id} not found.`);
    return el as T;
}

// Global state for mode tracking
export let currentStationUrl: string | undefined;
export let currentUIMode: "manual" | "audio" | "auto" = "manual";

// Export getters for fourier.ts to use
export const getOrbitSpeedInput = () => document.getElementById("orbit-speed") as HTMLInputElement;
export const getOrbitRadiusInput = () => document.getElementById("orbit-radius") as HTMLInputElement;
export const getSphereSizeInput = () => document.getElementById("sphere-size") as HTMLInputElement;

export function setupUI() {
    const modeManual = getEl("mode-manual");
    const modeAudio = getEl("mode-audio");
    const modeAuto = getEl("mode-auto");
    const harmonicCountInput = getEl<HTMLInputElement>("harmonic-count-input");
    const orbitSpeedInput = getEl<HTMLInputElement>("orbit-speed");
    const orbitRadiusInput = getEl<HTMLInputElement>("orbit-radius");
    const sphereSizeInput = getEl<HTMLInputElement>("sphere-size");
    const btnAutoOrbit = getEl("btn-auto-orbit");
    const btnImmersive = getEl("btn-immersive");
    const btnBloom = getEl("btn-bloom");
    const btnFullscreen = getEl("btn-fullscreen");
    const btnResetCam = document.getElementById("btn-reset-cam");
    const nav2D = getEl("nav-2d");

    const stationBtns = document.querySelectorAll(".station-btn") as NodeListOf<HTMLButtonElement>;
    currentStationUrl = stationBtns[0]?.dataset.url;

    setupAudioListeners();

    // Mode Switches
    modeManual.addEventListener("click", () => {
        if (currentUIMode === "manual") toggleSettingsPanel();
        else { switchMode("manual"); toggleSettingsPanel(true); }
    });
    modeAudio.addEventListener("click", () => {
        if (currentUIMode === "audio") toggleSettingsPanel();
        else { switchMode("audio"); toggleSettingsPanel(true); }
    });
    modeAuto.addEventListener("click", () => {
        if (currentUIMode === "auto") toggleSettingsPanel();
        else { switchMode("auto"); toggleSettingsPanel(true); }
    });

    // Sub-buttons
    btnAutoOrbit.addEventListener("click", (e) => {
        e.stopPropagation();
        state.isAutoOrbit = !state.isAutoOrbit;
        btnAutoOrbit.classList.toggle("active", state.isAutoOrbit);
        if (state.isAutoOrbit) {
            switchMode("auto");
            toggleSettingsPanel(true);
        }
    });

    btnImmersive.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleImmersive();
    });

    const canvasContainer = document.getElementById("canvas-container");
    if (canvasContainer) {
        let startX = 0;
        let startY = 0;
        let startTime = 0;

        canvasContainer.addEventListener("pointerdown", (e) => {
            startX = e.clientX;
            startY = e.clientY;
            startTime = Date.now();
        });

        canvasContainer.addEventListener("pointerup", (e) => {
            const diffX = Math.abs(e.clientX - startX);
            const diffY = Math.abs(e.clientY - startY);
            const duration = Date.now() - startTime;

            // If move is small and duration is short, it's a tap
            if (diffX < 10 && diffY < 10 && duration < 300) {
                const player = getAudioPlayer();
                if (state.isRadioMode && currentStationUrl !== "mic" && player?.paused) {
                    player.play().then(() => {
                        const np = getNowPlaying();
                        if (np) np.classList.add("hidden");
                    }).catch(() => { });
                }
                toggleImmersive();
            }
        });
    }

    btnBloom.addEventListener("click", () => {
        const isEnabled = !btnBloom.classList.contains("active");
        btnBloom.classList.toggle("active", isEnabled);
        events.emit(UI_EVENTS.TOGGLE_BLOOM, isEnabled);
    });

    btnFullscreen.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
            btnFullscreen.classList.add("active");
        } else {
            document.exitFullscreen();
            btnFullscreen.classList.remove("active");
        }
    });

    document.addEventListener("fullscreenchange", () => {
        btnFullscreen.classList.toggle("active", !!document.fullscreenElement);
    });

    nav2D.addEventListener("click", () => {
        state.is2DMode = !state.is2DMode;
        nav2D.classList.toggle("active", state.is2DMode);
        events.emit(UI_EVENTS.TOGGLE_2D, state.is2DMode);
    });

    if (btnResetCam) {
        btnResetCam.addEventListener("click", () => events.emit(UI_EVENTS.RESET_CAMERA));
    }

    // Input Listeners
    harmonicCountInput.addEventListener("input", () => {
        let count = parseInt(harmonicCountInput.value);
        if (isNaN(count)) return;
        if (count < 1) count = 1;
        if (count > CONSTANTS.MAX_HARMONICS) count = CONSTANTS.MAX_HARMONICS;
        state.NUM_HARMONICS = count;
        events.emit(UI_EVENTS.HARMONIC_CHANGE, count);
        createSliders();
    });

    orbitSpeedInput.addEventListener("input", () => {
        const valEl = document.getElementById("orbit-speed-val");
        if (valEl) valEl.textContent = `${orbitSpeedInput.value}x`;
    });

    orbitRadiusInput.addEventListener("input", () => {
        const valEl = document.getElementById("orbit-radius-val");
        if (valEl) valEl.textContent = orbitRadiusInput.value;
    });

    sphereSizeInput.addEventListener("input", () => {
        const valEl = document.getElementById("sphere-size-val");
        if (valEl) valEl.textContent = `${sphereSizeInput.value}x`;
    });

    const sensInput = getSensitivityInput();
    if (sensInput) {
        sensInput.addEventListener("input", () => {
            const valEl = document.getElementById("sens-val");
            if (valEl) valEl.textContent = `${parseFloat(sensInput.value).toFixed(1)}x`;
        });
    }

    // Station Selectors
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

    // Preset Buttons
    document.querySelectorAll(".preset-btn").forEach((btn) => {
        btn.addEventListener("click", () => handlePreset(btn));
    });

    // Harmonics Step Buttons
    const btnDec = document.getElementById("harmonic-dec");
    const btnInc = document.getElementById("harmonic-inc");
    if (btnDec && btnInc) {
        const updateHarmonics = (delta: number) => {
            let count = state.NUM_HARMONICS + delta;
            if (count < 1) count = 1;
            if (count > CONSTANTS.MAX_HARMONICS) count = CONSTANTS.MAX_HARMONICS;
            state.NUM_HARMONICS = count;

            const display = document.getElementById("harmonic-count-display");
            if (display) display.textContent = count.toString();

            events.emit(UI_EVENTS.HARMONIC_CHANGE, count);
            createSliders();
        };

        btnDec.addEventListener("click", () => updateHarmonics(-1));
        btnInc.addEventListener("click", () => updateHarmonics(1));
    }

    createSliders();
}

export function toggleImmersive(force?: boolean) {
    if (force !== undefined) state.isImmersiveMode = force;
    else state.isImmersiveMode = !state.isImmersiveMode;

    const btnImmersive = document.getElementById("btn-immersive");
    const topHeader = document.getElementById("top-header");
    const cameraGuide = document.getElementById("camera-guide");

    if (btnImmersive) btnImmersive.classList.toggle("active", state.isImmersiveMode);

    if (state.isImmersiveMode) {
        topHeader?.classList.add("opacity-0", "pointer-events-none");
        cameraGuide?.classList.add("hidden");
        toggleSettingsPanel(false);
    } else {
        topHeader?.classList.remove("opacity-0", "pointer-events-none");
        cameraGuide?.classList.remove("hidden");
        toggleSettingsPanel(true);
    }
}

let isSettingsVisible = true;
function toggleSettingsPanel(forceShow?: boolean) {
    if (forceShow !== undefined) isSettingsVisible = forceShow;
    else isSettingsVisible = !isSettingsVisible;

    const bottomHud = document.getElementById("bottom-hud");
    const modeBtns = [
        document.getElementById("mode-manual"),
        document.getElementById("mode-audio"),
        document.getElementById("mode-auto")
    ];

    if (isSettingsVisible) {
        bottomHud?.classList.remove("opacity-0", "pointer-events-none", "translate-y-12", "md:translate-y-12");
        bottomHud?.classList.add("md:translate-y-0", "translate-y-0", "opacity-100");
    } else {
        bottomHud?.classList.remove("md:translate-y-0", "translate-y-0", "opacity-100");
        bottomHud?.classList.add("opacity-0", "pointer-events-none", "translate-y-12", "md:translate-y-12");
    }

    // Always keep the correct mode icon lit
    modeBtns.forEach(m => m?.classList.remove("active"));
    const activeBtn = document.getElementById(`mode-${currentUIMode}`);
    activeBtn?.classList.add("active");
}

export function switchMode(target: "manual" | "audio" | "auto") {
    currentUIMode = target;
    state.isRadioMode = (target === "audio");

    const panels = [
        document.getElementById("panel-manual"),
        document.getElementById("panel-audio"),
        document.getElementById("panel-auto")
    ];
    const player = getAudioPlayer();
    const nowPlaying = getNowPlaying();

    panels.forEach(p => p?.classList.add("hidden", "opacity-0"));
    const targetPanel = document.getElementById(`panel-${target}`);
    targetPanel?.classList.remove("hidden");
    setTimeout(() => targetPanel?.classList.remove("opacity-0"), 10);

    if (target === "audio") {
        resumeAudioContext();
        initAudio();
        if (currentStationUrl === "mic") switchStation("mic");
        else {
            if (player && !player.src) player.src = currentStationUrl || "";
            player?.play().finally(() => nowPlaying?.classList.add("hidden"));
        }
    } else {
        stopMic();
        player?.pause();
        if (target === "auto") {
            state.isAutoOrbit = true;
            document.getElementById("btn-auto-orbit")?.classList.add("active");
        }
        nowPlaying?.classList.add("hidden");
    }

    // Update highlights
    [
        document.getElementById("mode-manual"),
        document.getElementById("mode-audio"),
        document.getElementById("mode-auto")
    ].forEach(m => m?.classList.remove("active"));
    document.getElementById(`mode-${target}`)?.classList.add("active");

    events.emit(UI_EVENTS.MODE_SWITCH, target);
}

function handlePreset(btn: Element) {
    const preset = btn.getAttribute("data-preset");
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
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
        } else if (preset === "pulse") val = scale * 0.4;
        else if (preset === "custom") return;

        state.harmonics[i] = val;
        state.phases[i] = 0;
    }

    if (preset === "market") {
        btn.innerHTML = `<span class="animate-pulse">Loading...</span>`;
        fetchMarketData('multi-dim').then(data => {
            for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
                state.harmonics[i] = data.harmonics[i] || 0;
                state.phases[i] = data.phases[i] || 0;
            }
            btn.innerHTML = `Market`;
            updateSlidersUI();
        });
        return;
    }


    if (preset !== "custom") updateSlidersUI();
}

export function createSliders() {
    const container = document.getElementById("sliders-container");
    if (!container) return;
    container.innerHTML = "";

    for (let i = 0; i < state.NUM_HARMONICS; i++) {
        const group = document.createElement("div");
        group.className = "bg-black/40 p-2 md:p-2.5 rounded-xl border border-white/5 flex flex-col gap-1.5 w-full hover:bg-white/5 transition-colors h-auto min-h-[105px]";

        const header = document.createElement("div");
        header.className = "flex justify-between text-[7px] md:text-[8px] text-slate-500 font-bold uppercase border-b border-white/5 pb-0.5 mb-1";
        header.innerHTML = `<span>H${i + 1}</span>`;

        const createStepBtn = (label: string, slider: HTMLInputElement, isUp: boolean) => {
            const b = document.createElement("button");
            b.className = "w-4 h-4 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-white/40 text-[8px] transition-colors";
            b.textContent = label;
            b.onclick = (e) => {
                e.stopPropagation();
                if (isUp) slider.stepUp(); else slider.stepDown();
                slider.dispatchEvent(new Event("input"));
            };
            return b;
        };

        const createControlRow = (text: string, color: string, valueEl: HTMLElement, slider: HTMLInputElement) => {
            const wrapper = document.createElement("div");
            wrapper.className = "flex flex-col gap-0.5";
            const labelRow = document.createElement("div");
            labelRow.className = "flex justify-between items-center w-full px-0.5";
            const l = document.createElement("span");
            l.className = `text-[6px] md:text-[7px] font-bold uppercase ${color}`;
            l.textContent = text;
            labelRow.appendChild(l);
            labelRow.appendChild(valueEl);
            const actionRow = document.createElement("div");
            actionRow.className = "flex items-center gap-1";
            actionRow.appendChild(createStepBtn("-", slider, false));
            actionRow.appendChild(slider);
            actionRow.appendChild(createStepBtn("+", slider, true));
            wrapper.appendChild(labelRow);
            wrapper.appendChild(actionRow);
            return wrapper;
        };

        const ampVal = document.createElement("span");
        ampVal.id = `val-${i}`;
        ampVal.className = "text-[8px] md:text-[9px] font-mono text-blue-400";
        ampVal.textContent = state.harmonics[i].toFixed(0);

        const ampSlider = document.createElement("input");
        ampSlider.type = "range";
        ampSlider.className = "accent-blue-500 flex-grow h-4";
        ampSlider.min = "-100";
        ampSlider.max = "100";
        ampSlider.value = state.harmonics[i].toString();

        const phiVal = document.createElement("span");
        phiVal.id = `phi-${i}`;
        phiVal.className = "text-[8px] md:text-[9px] font-mono text-purple-400";
        phiVal.textContent = (state.phases[i] / Math.PI).toFixed(1);

        const phiSlider = document.createElement("input");
        phiSlider.type = "range";
        phiSlider.className = "accent-purple-500 flex-grow h-4";
        phiSlider.min = "0";
        phiSlider.max = "6.28";
        phiSlider.step = "0.1";
        phiSlider.value = state.phases[i].toString();

        const update = () => {
            state.harmonics[i] = parseFloat(ampSlider.value);
            state.phases[i] = parseFloat(phiSlider.value);
            ampVal.textContent = state.harmonics[i].toFixed(0);
            phiVal.textContent = (state.phases[i] / Math.PI).toFixed(1);
            document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
            document.querySelector('[data-preset="custom"]')?.classList.add("active");
        };

        ampSlider.oninput = update;
        phiSlider.oninput = update;

        group.appendChild(header);
        group.appendChild(createControlRow("Amp", "text-blue-300", ampVal, ampSlider));
        const divider = document.createElement("div");
        divider.className = "h-px w-full bg-white/5 my-0.5 opacity-50";
        group.appendChild(divider);
        group.appendChild(createControlRow("Phase", "text-purple-300", phiVal, phiSlider));
        container.appendChild(group);
    }
}

export function updateSlidersUI() {
    createSliders();
}
