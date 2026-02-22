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

export function setupCanvasTap() {
    const canvasContainer = document.getElementById("canvas-container");
    if (!canvasContainer) return;

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

export function setupUI() {
    setupCanvasTap();

    const modeManual = document.getElementById("mode-manual");
    const modeAudio = document.getElementById("mode-audio");
    const modeAuto = document.getElementById("mode-auto");
    const harmonicCountInput = document.getElementById("harmonic-count-input") as HTMLInputElement;
    const orbitSpeedInput = document.getElementById("orbit-speed") as HTMLInputElement;
    const orbitRadiusInput = document.getElementById("orbit-radius") as HTMLInputElement;
    const sphereSizeInput = document.getElementById("sphere-size") as HTMLInputElement;
    const btnAutoOrbit = document.getElementById("btn-auto-orbit");
    const btnImmersive = document.getElementById("btn-immersive");
    const btnFullscreen = document.getElementById("btn-fullscreen");
    const btnResetCam = document.getElementById("btn-reset-cam");
    const nav2D = document.getElementById("nav-2d");

    const stationBtns = document.querySelectorAll(".station-btn") as NodeListOf<HTMLButtonElement>;
    if (stationBtns.length > 0) {
        currentStationUrl = stationBtns[0]?.dataset.url;
        stationBtns[0].classList.add("active"); // Initialize first station as active
    }

    setupAudioListeners();

    // Mode Switches
    modeManual?.addEventListener("click", () => {
        if (currentUIMode === "manual") toggleSettingsPanel();
        else { switchMode("manual"); toggleSettingsPanel(true); }
    });
    modeAudio?.addEventListener("click", () => {
        if (currentUIMode === "audio") toggleSettingsPanel();
        else { switchMode("audio"); toggleSettingsPanel(true); }
    });
    modeAuto?.addEventListener("click", () => {
        if (currentUIMode === "auto") toggleSettingsPanel();
        else { switchMode("auto"); toggleSettingsPanel(true); }
    });

    // Sub-buttons
    btnAutoOrbit?.addEventListener("click", (e) => {
        e.stopPropagation();
        state.isAutoOrbit = !state.isAutoOrbit;
        btnAutoOrbit.classList.toggle("active", state.isAutoOrbit);
        if (state.isAutoOrbit) {
            switchMode("auto");
            toggleSettingsPanel(true);
        }
    });

    btnImmersive?.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleImmersive();
    });

    btnFullscreen?.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
            btnFullscreen.classList.add("active");
        } else {
            document.exitFullscreen();
            btnFullscreen.classList.remove("active");
        }
    });

    document.addEventListener("fullscreenchange", () => {
        if (btnFullscreen) btnFullscreen.classList.toggle("active", !!document.fullscreenElement);
    });

    nav2D?.addEventListener("click", () => {
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
    // Handled via event delegation below for HMR robustness

    // Harmonics Step Buttons (Using Event Delegation for HMR robustness)
    const updateHarmonics = (delta: number) => {
        let count = state.NUM_HARMONICS + delta;
        if (count < 1) count = 1;
        if (count > CONSTANTS.MAX_HARMONICS) count = CONSTANTS.MAX_HARMONICS;
        state.NUM_HARMONICS = count;

        const display = document.getElementById("harmonic-count-display");
        if (display) display.textContent = count.toString();

        const input = document.getElementById("harmonic-count-input") as HTMLInputElement;
        if (input) input.value = count.toString();

        events.emit(UI_EVENTS.HARMONIC_CHANGE, count);
        createSliders();
    };

    document.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const btn = target.closest("[data-action]");
        const action = btn?.getAttribute("data-action");

        if (action === "dec") {
            updateHarmonics(-1);
            return;
        } else if (action === "inc") {
            updateHarmonics(1);
            return;
        }

        // Preset Buttons
        const presetBtn = target.closest(".preset-btn") as HTMLButtonElement | null;
        if (presetBtn) {
            handlePreset(presetBtn);
            return;
        }
    });

    setupKeyboardShortcuts();
    createSliders();
}

function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
        // Ignore if user is typing in an input or textarea
        if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
            return;
        }

        const key = e.key.toLowerCase();

        // 1. Modes
        if (key === "1") switchMode("manual");
        if (key === "2") switchMode("audio");
        if (key === "3") switchMode("auto");

        // 2. View Utilities
        if (key === " ") {
            e.preventDefault();
            const btn2d = document.getElementById("nav-2d");
            if (btn2d) {
                state.is2DMode = !state.is2DMode;
                btn2d.classList.toggle("active", state.is2DMode);
                events.emit(UI_EVENTS.TOGGLE_2D, state.is2DMode);
            }
        }
        if (key === "r") {
            events.emit(UI_EVENTS.RESET_CAMERA);
        }
        if (key === "o") {
            const btnAutoOrbit = document.getElementById("btn-auto-orbit");
            if (btnAutoOrbit) {
                state.isAutoOrbit = !state.isAutoOrbit;
                btnAutoOrbit.classList.toggle("active", state.isAutoOrbit);
            }
        }
        if (key === "i") {
            toggleImmersive();
        }
        if (key === "f") {
            const btnFullscreen = document.getElementById("btn-fullscreen");
            btnFullscreen?.click();
        }
        if (key === "s") {
            toggleSettingsPanel();
        }

        // 3. Parameters
        if (key === "-" || key === "_") {
            (document.querySelector('[data-action="dec"]') as HTMLElement)?.click();
        }
        if (key === "=" || key === "+") {
            (document.querySelector('[data-action="inc"]') as HTMLElement)?.click();
        }

        // 4. Presets (Square, Triangle, Pulse)
        if (key === "q") (document.querySelector('[data-preset="square"]') as HTMLElement)?.click();
        if (key === "w") (document.querySelector('[data-preset="triangle"]') as HTMLElement)?.click();
        if (key === "e") (document.querySelector('[data-preset="pulse"]') as HTMLElement)?.click();
    });
}

export function toggleImmersive(force?: boolean) {
    if (force !== undefined) state.isImmersiveMode = force;
    else state.isImmersiveMode = !state.isImmersiveMode;

    const btnImmersive = document.getElementById("btn-immersive");
    const topHeader = document.getElementById("top-header");
    const cameraGuide = document.getElementById("camera-guide");
    const immersiveHideEls = document.querySelectorAll(".immersive-hide");

    if (btnImmersive) btnImmersive.classList.toggle("active", state.isImmersiveMode);

    if (state.isImmersiveMode) {
        topHeader?.classList.add("opacity-0", "pointer-events-none");
        cameraGuide?.classList.add("hidden");
        immersiveHideEls.forEach(el => el.classList.add("opacity-0", "pointer-events-none"));
        toggleSettingsPanel(false);
    } else {
        topHeader?.classList.remove("opacity-0", "pointer-events-none");
        cameraGuide?.classList.remove("hidden");
        immersiveHideEls.forEach(el => el.classList.remove("opacity-0", "pointer-events-none"));
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

        // Sync button highlights for auto-play
        const btns = document.querySelectorAll(".station-btn") as NodeListOf<HTMLButtonElement>;
        btns.forEach(b => {
            b.classList.toggle("active", b.dataset.url === currentStationUrl);
        });
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
        } else if (preset === "triangle") {
            if (n % 2 !== 0) {
                const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
                val = scale * (8 / (Math.PI * Math.PI * n * n)) * sign;
            }
        } else if (preset === "pulse") {
            // High frequency pulse
            val = scale * (i < 5 ? 0.6 : 0.05);
        }

        // We update the targets to trigger smoothing in the render loop
        state.targetHarmonics[i] = val;
        state.targetPhases[i] = 0;
    }

    if (preset === "market") {
        btn.innerHTML = `<span class="animate-pulse">Loading...</span>`;
        fetchMarketData('multi-dim').then(data => {
            for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
                state.targetHarmonics[i] = data.harmonics[i] || 0;
                state.targetPhases[i] = data.phases[i] || 0;
            }
            btn.innerHTML = `Market`;
            updateSlidersUI();
        });
        return;
    }

    updateSlidersUI();
}

let activeHarmonicIndex = 0;

export function createSliders() {
    const container = document.getElementById("harmonic-selector");
    if (!container) return;
    container.innerHTML = "";

    const masterAmp = document.getElementById("master-amp") as HTMLInputElement;
    const masterPhi = document.getElementById("master-phi") as HTMLInputElement;
    const masterAmpVal = document.getElementById("master-amp-val");
    const masterPhiVal = document.getElementById("master-phi-val");
    const activeLabel = document.getElementById("active-h-label");

    // Clear old event listeners by cloning if necessary (or just reusing standard assignment)
    // Actually, simple reassignment of oninput is fine.

    if (activeHarmonicIndex >= state.NUM_HARMONICS) {
        activeHarmonicIndex = 0;
    }

    const btnElements: HTMLButtonElement[] = [];

    const updateMasterView = () => {
        if (!masterAmp || !masterPhi) return;
        masterAmp.value = state.harmonics[activeHarmonicIndex].toString();
        masterPhi.value = state.phases[activeHarmonicIndex].toString();

        if (masterAmpVal) masterAmpVal.textContent = state.harmonics[activeHarmonicIndex].toFixed(0);
        if (masterPhiVal) masterPhiVal.textContent = (state.phases[activeHarmonicIndex] / Math.PI).toFixed(1);
        if (activeLabel) activeLabel.textContent = `H${activeHarmonicIndex + 1} Settings`;

        btnElements.forEach((btn, i) => {
            if (i === activeHarmonicIndex) {
                btn.className = "w-full aspect-square flex-shrink-0 rounded-md flex flex-col items-center justify-center border border-emerald-400/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)] transition-all cursor-default relative overflow-hidden";
                btn.innerHTML = `<span class="text-[7px] md:text-[8px] font-black">H${i + 1}</span>
                                 <div class="absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400"></div>`;
            } else {
                btn.className = "w-full aspect-square flex-shrink-0 rounded-md flex flex-col items-center justify-center border border-white/5 bg-black/40 text-slate-500 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all cursor-pointer active:scale-95";
                btn.innerHTML = `<span class="text-[7px] md:text-[8px] font-bold">H${i + 1}</span>`;
            }
        });
    };

    for (let i = 0; i < state.NUM_HARMONICS; i++) {
        const btn = document.createElement("button");
        btn.onclick = () => {
            activeHarmonicIndex = i;
            updateMasterView();
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        };
        btnElements.push(btn);
        container.appendChild(btn);
    }

    if (masterAmp && masterPhi) {
        const onInput = () => {
            state.targetHarmonics[activeHarmonicIndex] = parseFloat(masterAmp.value);
            state.targetPhases[activeHarmonicIndex] = parseFloat(masterPhi.value);

            if (masterAmpVal) masterAmpVal.textContent = state.targetHarmonics[activeHarmonicIndex].toFixed(0);
            if (masterPhiVal) masterPhiVal.textContent = (state.targetPhases[activeHarmonicIndex] / Math.PI).toFixed(1);

            document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
        };
        masterAmp.oninput = onInput;
        masterPhi.oninput = onInput;
    }

    // Call once to initialize
    updateMasterView();
}

export function updateSlidersUI() {
    createSliders();
}
