import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// Constants
let NUM_HARMONICS = 10;
const MAX_HARMONICS = 60;
const POINTS_PER_LINE = 400;
let harmonics = new Array(MAX_HARMONICS).fill(0);
let phases = new Array(MAX_HARMONICS).fill(0); // Phase Shift Optimization

// Default to a square wave pattern for initial visualization
const scale = 67;
for (let i = 0; i < MAX_HARMONICS; i++) {
    const n = i + 1;
    if (n % 2 !== 0) {
        harmonics[i] = scale * (4 / (n * Math.PI));
    }
}
let timeOffset = 0;

let isRadioMode = false;
let is2DMode = false;
let isAutoOrbit = false;
let isImmersiveMode = false;

// --- THREE.JS SETUP ---
const container = document.getElementById("canvas-container") as HTMLElement;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020208, 0.0015);

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    2000,
);
camera.position.set(200, 150, 300);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ReinhardToneMapping;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0, 0);

// --- POST PROCESSING (BLOOM) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
    0.8, // strength
    0.4, // radius
    0.6  // threshold
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- PARTICLES (NEBULA EFFECT) ---
const particlesGeom = new THREE.BufferGeometry();
const particlesCount = 2000;
const posArray = new Float32Array(particlesCount * 3);
for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 1200;
}
particlesGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMaterial = new THREE.PointsMaterial({
    size: 2.0,
    color: 0x8b5cf6,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
const stardust = new THREE.Points(particlesGeom, particlesMaterial);
scene.add(stardust);

// Light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xec4899, 4, 800);
pointLight.position.set(-100, 200, -100);
scene.add(pointLight);

const pointLight2 = new THREE.PointLight(0x3b82f6, 4, 800);
pointLight2.position.set(200, 200, 200);
scene.add(pointLight2);

// Grids for axes
const gridHelper = new THREE.GridHelper(1000, 50, 0x8b5cf6, 0x3b82f6);
gridHelper.material.opacity = 0.15;
gridHelper.material.transparent = true;
gridHelper.material.blending = THREE.AdditiveBlending;
gridHelper.material.depthWrite = false;
gridHelper.position.y = -80;
scene.add(gridHelper);

// Material for lines
function getMaterial(
    color: THREE.Color | number,
    opacity: number,
    linewidth = 2,
) {
    return new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
}

// Lines and Geometry
const xRange = 600; // Total width in X (Time) - Expanded to fill more screen
const zSpacing = 15; // Spacing between harmonics in Z

// Individual Harmonic Waves
let harmonicLines: THREE.Line[] = [];
let harmonicGeoms: THREE.BufferGeometry[] = [];

function initHarmonicGeometries() {
    for (let i = 0; i < MAX_HARMONICS; i++) {
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(POINTS_PER_LINE * 3);
        geom.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3),
        );

        // Color variation from Purple to Blue gradient
        const color = new THREE.Color();
        color.lerpColors(
            new THREE.Color(0xec4899),
            new THREE.Color(0x3b82f6),
            i / Math.max(1, MAX_HARMONICS - 1),
        );

        const material = getMaterial(color, 0.6);
        const line = new THREE.Line(geom, material);
        line.frustumCulled = false;

        scene.add(line);
        harmonicLines.push(line);
        harmonicGeoms.push(geom);
    }
}
initHarmonicGeometries();

function updateHarmonicVisibility() {
    for (let i = 0; i < MAX_HARMONICS; i++) {
        if (harmonicLines[i]) {
            // 在 2D 模式下隱藏獨立波形線條，以凸顯大圓小圓的推演過程
            harmonicLines[i].visible = (i < NUM_HARMONICS) && !is2DMode;
        }
    }
}
updateHarmonicVisibility();

// --- Epicycles (傅立葉旋轉臂圓圈) ---
const epicycleSpheres: THREE.Mesh[] = [];
const radiusLines: THREE.Line[] = [];
let epiConnector: THREE.Line;

function initEpicycles() {
    for (let i = 0; i < MAX_HARMONICS; i++) {
        // Sphere
        const sphereGeom = new THREE.SphereGeometry(1, 16, 16);

        // distinct hues for different spheres
        const hue = (i * 0.15) % 1.0;
        const color = new THREE.Color().setHSL(hue, 0.8, 0.55);

        const sphereMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.1,
            wireframe: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const sMesh = new THREE.Mesh(sphereGeom, sphereMat);
        sMesh.frustumCulled = false;
        sMesh.visible = false;
        scene.add(sMesh);
        epicycleSpheres.push(sMesh);

        // Radius
        const rGeom = new THREE.BufferGeometry();
        rGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const rMat = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const rLine = new THREE.Line(rGeom, rMat);
        rLine.frustumCulled = false;
        rLine.visible = false;
        scene.add(rLine);
        radiusLines.push(rLine);
    }

    // 連接最後一個旋轉臂到波形的輔助線
    const connGeom = new THREE.BufferGeometry();
    connGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const connMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    epiConnector = new THREE.Line(connGeom, connMat);
    epiConnector.frustumCulled = false;
    epiConnector.visible = false;
    scene.add(epiConnector);
}
initEpicycles();

// Sum Wave (The final combined wave)
const sumGeom = new THREE.BufferGeometry();
const sumPositions = new Float32Array(POINTS_PER_LINE * 3);
sumGeom.setAttribute(
    "position",
    new THREE.BufferAttribute(sumPositions, 3),
);

// A glowing thick effect for sum wave: we use a bright color,
// Threejs LineBasicMaterial doesn't support thickness in WebGL natively across all browsers well,
// but we'll use a brighter color and full opacity.
const sumMaterial = getMaterial(0xffffff, 1.0);
const sumLine = new THREE.Line(sumGeom, sumMaterial);
sumLine.frustumCulled = false;
scene.add(sumLine);

// Connecting planes/lines between components to show synthesis
let connGeom = new THREE.BufferGeometry();
let connLines: THREE.LineSegments;

function initConnectionLines() {
    if (connLines) scene.remove(connLines);
    connGeom = new THREE.BufferGeometry();
    const connPositions = new Float32Array(MAX_HARMONICS * 2 * 3);
    connGeom.setAttribute(
        "position",
        new THREE.BufferAttribute(connPositions, 3),
    );
    // Optimized: LineBasicMaterial is much faster than LineDashedMaterial when re-calculating points
    const connMat = new THREE.LineBasicMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    connLines = new THREE.LineSegments(connGeom, connMat);
    connLines.frustumCulled = false;
    scene.add(connLines);
}
initConnectionLines();

// --- UI & LOGIC ---
const slidersContainer = document.getElementById(
    "sliders-container",
) as HTMLElement;
const presetBtns = document.querySelectorAll(".preset-btn");

// Mode Selection
const modeManual = document.getElementById("mode-manual")!;
const modeAudio = document.getElementById("mode-audio")!;
const modeAuto = document.getElementById("mode-auto")!;
const panelManual = document.getElementById("panel-manual")!;
const panelAudio = document.getElementById("panel-audio")!;
const panelAuto = document.getElementById("panel-auto")!;

// Audio Elements & State
const audioPlayer = document.getElementById("audio-player") as HTMLAudioElement;
const nowPlaying = document.getElementById("now-playing")!;
const sensitivityInput = document.getElementById("audio-sensitivity") as HTMLInputElement;
const sensValDisplay = document.getElementById("sens-val")!;

const orbitSpeedInput = document.getElementById("orbit-speed") as HTMLInputElement;
const orbitSpeedVal = document.getElementById("orbit-speed-val")!;
const orbitRadiusInput = document.getElementById("orbit-radius") as HTMLInputElement;
const orbitRadiusVal = document.getElementById("orbit-radius-val")!;

const sphereSizeInput = document.getElementById("sphere-size") as HTMLInputElement;
const sphereSizeVal = document.getElementById("sphere-size-val")!;

const harmonicCountInput = document.getElementById("harmonic-count-input") as HTMLInputElement;
const stationBtns = document.querySelectorAll(".station-btn") as NodeListOf<HTMLButtonElement>;

let currentStationUrl = stationBtns[0]?.dataset.url;

let audioCtx: AudioContext | null = null;
let analyzer: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let audioSource: MediaElementAudioSourceNode | null = null;

function initAudio() {
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

function switchMode(target: "manual" | "audio" | "auto") {
    isRadioMode = (target === "audio");

    // Hide all panels first
    [panelManual, panelAudio, panelAuto].forEach(p => {
        p.classList.add("hidden", "opacity-0");
    });

    // Reset all tabs
    [modeManual, modeAudio, modeAuto].forEach(m => {
        m.classList.remove("active");
    });

    if (target === "audio") {
        modeAudio.classList.add("active");
        panelAudio.classList.remove("hidden");
        setTimeout(() => panelAudio.classList.remove("opacity-0"), 10);

        if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
        initAudio();
        if (!audioPlayer.src || audioPlayer.src === "") {
            audioPlayer.src = currentStationUrl || "https://streaming.positivity.radio/pr/posimeditation/icecast.audio";
        }
        audioPlayer.play().then(() => {
            nowPlaying.innerHTML = "• LIVE STREAMING";
            nowPlaying.classList.remove("text-rose-400", "bg-rose-400/10");
            nowPlaying.classList.add("text-emerald-400", "bg-emerald-400/10");
        }).catch((e: any) => {
            console.warn("Auto Play Error:", e);
            nowPlaying.innerHTML = "• 點擊畫面允許播放";
            nowPlaying.classList.remove("text-emerald-400", "bg-emerald-400/10");
            nowPlaying.classList.add("text-rose-400", "bg-rose-400/10");
        });
        nowPlaying.classList.remove("hidden");
    } else if (target === "auto") {
        modeAuto.classList.add("active");
        panelAuto.classList.remove("hidden");
        setTimeout(() => panelAuto.classList.remove("opacity-0"), 10);

        // Pause carefully
        if (!audioPlayer.paused) {
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(_ => {
                    audioPlayer.pause();
                }).catch(error => {
                    // Auto-play was prevented
                    console.log("Pause handled gracefully");
                });
            }
        }
        nowPlaying.classList.add("hidden");

        if (!audioPlayer.paused) {
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                playPromise.then(_ => {
                    audioPlayer.pause();
                }).catch(error => {
                    console.log("Pause handled gracefully");
                });
            }
        }
        nowPlaying.classList.add("hidden");
    }
}

modeManual.addEventListener("click", () => switchMode("manual"));
modeAudio.addEventListener("click", () => switchMode("audio"));
modeAuto.addEventListener("click", () => switchMode("auto"));

// Global Toggles (Top bar)
const topHeader = document.getElementById("top-header")!;
const bottomHud = document.getElementById("bottom-hud")!;
const cameraGuide = document.getElementById("camera-guide")!;

const btnAutoOrbit = document.getElementById("btn-auto-orbit")!;
btnAutoOrbit.addEventListener("click", (e) => {
    e.stopPropagation();
    isAutoOrbit = !isAutoOrbit;
    btnAutoOrbit.classList.toggle("active", isAutoOrbit);
    if (isAutoOrbit) switchMode("auto");
});

const btnImmersive = document.getElementById("btn-immersive")!;
btnImmersive.addEventListener("click", (e) => {
    e.stopPropagation();
    isImmersiveMode = !isImmersiveMode;
    btnImmersive.classList.toggle("active", isImmersiveMode);

    if (isImmersiveMode) {
        topHeader.classList.add("opacity-0", "pointer-events-none");
        bottomHud.classList.add("opacity-0", "pointer-events-none");
        cameraGuide.classList.add("hidden");
    } else {
        topHeader.classList.remove("opacity-0", "pointer-events-none");
        bottomHud.classList.remove("opacity-0", "pointer-events-none");
        cameraGuide.classList.remove("hidden");
    }
});

// Canvas interaction to exit immersive and un-block audio
const handleCanvasTap = () => {
    // Still respect auto orbit cancellation for better UX
    if (isAutoOrbit) {
        isAutoOrbit = false;
        btnAutoOrbit.classList.remove("active");
    }

    // Play audio on interaction if blocked
    if (isRadioMode && audioPlayer.paused) {
        audioPlayer.play().then(() => {
            nowPlaying.innerHTML = "• LIVE STREAMING";
            nowPlaying.classList.remove("text-rose-400", "bg-rose-400/10");
            nowPlaying.classList.add("text-emerald-400", "bg-emerald-400/10");
        }).catch(() => { });
    }
};
document.getElementById("canvas-container")!.addEventListener("click", handleCanvasTap);

const btnBloom = document.getElementById("btn-bloom")!;
btnBloom.addEventListener("click", () => {
    bloomPass.enabled = !bloomPass.enabled;
    btnBloom.classList.toggle("active", bloomPass.enabled);
});

const btnFullscreen = document.getElementById("btn-fullscreen")!;
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

// Update button state when fullscreen changes via ESC or other means
document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
        btnFullscreen.classList.remove("active");
    } else {
        btnFullscreen.classList.add("active");
    }
});

const nav2D = document.getElementById("nav-2d")!;
nav2D.addEventListener("click", () => {
    is2DMode = !is2DMode;
    nav2D.classList.toggle("active", is2DMode);

    if (is2DMode) {
        camera.position.set(-160, 0, 650); // 往左移以騰出空間給大圓小圓，並退後
        controls.target.set(-160, 0, 0);
        gridHelper.visible = false;
        isAutoOrbit = false;
        btnAutoOrbit.classList.remove("active");

        // Force exit cinema mode visually if active
        topHeader.classList.remove("opacity-0", "pointer-events-none");
        bottomHud.classList.remove("opacity-0", "pointer-events-none");
        cameraGuide.classList.remove("hidden");

    } else {
        camera.position.set(200, 150, 300);
        controls.target.set(0, 0, 0);
        gridHelper.visible = true;
    }
    updateHarmonicVisibility();
});

harmonicCountInput.addEventListener("change", () => {
    let count = parseInt(harmonicCountInput.value);
    if (isNaN(count) || count < 1) count = 1;
    if (count > MAX_HARMONICS) count = MAX_HARMONICS; // Max limit
    harmonicCountInput.value = count.toString();

    NUM_HARMONICS = count;

    updateHarmonicVisibility();
    createSliders();
});

function createSliders() {
    slidersContainer.innerHTML = "";
    // No more class manipulation since it's now a simple flex row for reliability

    for (let i = 0; i < NUM_HARMONICS; i++) {
        const group = document.createElement("div");
        group.className =
            "bg-black/40 p-2 rounded-xl border border-white/5 flex flex-col gap-1 w-full hover:bg-white/5 transition-colors";

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
        ampVal.textContent = harmonics[i].toFixed(0);
        const ampSlider = document.createElement("input");
        ampSlider.type = "range";
        ampSlider.className = "accent-blue-500 flex-grow";
        ampSlider.min = "-100";
        ampSlider.max = "100";
        ampSlider.value = harmonics[i].toString();
        ampSlider.title = "振幅 (Amplitude)";

        const phiVal = document.createElement("span");
        phiVal.id = `phi-${i}`;
        phiVal.className = "text-[9px] font-mono text-purple-400 w-6 text-right";
        phiVal.textContent = (phases[i] / Math.PI).toFixed(1);
        const phiSlider = document.createElement("input");
        phiSlider.type = "range";
        phiSlider.className = "accent-purple-500 flex-grow";
        phiSlider.min = "0";
        phiSlider.max = "6.28";
        phiSlider.step = "0.1";
        phiSlider.value = phases[i].toString();
        phiSlider.title = "相位 (Phase)";

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
            harmonics[i] = parseFloat(ampSlider.value);
            phases[i] = parseFloat(phiSlider.value);
            ampVal.textContent = harmonics[i].toFixed(0);
            phiVal.textContent = (phases[i] / Math.PI).toFixed(1);
            updatePresetsToCustom();
        };

        ampSlider.addEventListener("input", updateVals);
        phiSlider.addEventListener("input", updateVals);

        group.appendChild(header);
        group.appendChild(ampWrapper);
        group.appendChild(phiWrapper);
        slidersContainer.appendChild(group);
    }
}

function updateSlidersUI() {
    const sliders = slidersContainer.querySelectorAll(
        'input[type="range"]',
    );
    sliders.forEach((slider, i) => {
        (slider as HTMLInputElement).value = harmonics[i].toString();
        document.getElementById(`val-${i}`)!.textContent =
            harmonics[i].toFixed(1);
    });
}

function updatePresetsToCustom() {
    presetBtns.forEach((btn) => {
        btn.classList.remove("active");
    });
    const customBtn = document.querySelector(
        '[data-preset="custom"]',
    ) as HTMLElement;
    customBtn.classList.add("active");
}

presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        const preset = btn.getAttribute("data-preset");

        // Reset styling
        presetBtns.forEach((b) => {
            b.classList.remove("active");
        });

        // Add active styling
        btn.classList.add("active");

        const scale = 45;

        for (let i = 0; i < MAX_HARMONICS; i++) {
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

            harmonics[i] = val;
            phases[i] = 0;
        }
        if (preset !== "custom") {
            updateSlidersUI();
        }
    });
});

function switchStation(url: string) {
    currentStationUrl = url;
    audioPlayer.src = url;
    if (isRadioMode) {
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

stationBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        stationBtns.forEach((b) => {
            b.classList.remove("active");
        });

        btn.classList.add("active");

        if (btn.dataset.url) switchStation(btn.dataset.url);
    });
});

sensitivityInput.addEventListener("input", () => {
    sensValDisplay.textContent = `${sensitivityInput.value}x`;
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

// Init UI
createSliders();

// Render loop
const timer = new THREE.Timer();

function animate() {
    requestAnimationFrame(animate);

    timer.update();
    const delta = timer.getDelta();
    timeOffset += delta * 0.8; // Lowered speed of wave for a calmer feel

    // Update harmonics if in radio mode
    if (isRadioMode && analyzer && dataArray) {
        analyzer.getByteFrequencyData(dataArray as any);
        const baseSens = 0.35; // "Sensitivity 再次調低，現在 0.35 作為標準值 1"
        const sens = parseFloat(sensitivityInput.value) * baseSens;

        const binCount = analyzer.frequencyBinCount;

        // Total energy for global vibration
        let totalEnergy = 0;

        for (let i = 0; i < NUM_HARMONICS; i++) {
            // Logarithmic-styled mapping to get Bass, Mids, and Treble
            // This ensures we sample from a wider range of the 64 available bins
            const samplesPerHarmonic = Math.max(1, Math.floor(binCount / NUM_HARMONICS));
            const startBin = i * samplesPerHarmonic;

            let avgVal = 0;
            for (let j = 0; j < samplesPerHarmonic; j++) {
                avgVal += dataArray[startBin + j] || 0;
            }
            avgVal /= samplesPerHarmonic;

            // Apply different weighting: 
            // Bass (lower i) gets more weight for traditional visual impact
            // Treble (higher i) gets higher sensitivity for "vibration" look
            const freqWeight = (i < NUM_HARMONICS * 0.2) ? 1.2 : (i > NUM_HARMONICS * 0.7 ? 1.8 : 1.0);
            const targetAmp = (avgVal / 255) * 100 * sens * freqWeight;

            totalEnergy += avgVal;

            // Fluid smoothing
            harmonics[i] += (targetAmp - harmonics[i]) * 0.15;

            // Add a "micro-vibration" to phases based on individual frequency intensity
            // High frequency energy causes faster phase jitter
            if (avgVal > 50) {
                phases[i] += (avgVal / 255) * 0.1 * sens;
            }
        }

        // Global vibration: speed up timeOffset slightly on loud parts
        const avgEnergy = totalEnergy / NUM_HARMONICS;
        timeOffset += (avgEnergy / 255) * 0.02;
    }

    // Auto Orbit - Camera Rotation
    if (isAutoOrbit) {
        const speed = parseFloat(orbitSpeedInput.value);
        const radius = parseFloat(orbitRadiusInput.value);
        const time = Date.now() * 0.0005 * speed;
        camera.position.x = Math.sin(time) * radius;
        camera.position.z = Math.cos(time) * radius;
        camera.lookAt(0, 0, 0);
    }

    const startX = -xRange / 2;
    const endX = xRange / 2;
    const dx = xRange / (POINTS_PER_LINE - 1);

    const period = xRange * 0.4; // The wavelength factor in 3D

    // Calculate positions
    const zSum = 50; // Distance of the sum wave from origin
    const zHarmonicStart = zSum - 50; // Starting point for individual harmonics behind the sum

    for (let pi = 0; pi < POINTS_PER_LINE; pi++) {
        const x = startX + pi * dx;
        const phase = (x / period) * Math.PI * 2 - timeOffset;

        let ySum = 0;

        for (let i = 0; i < NUM_HARMONICS; i++) {
            const n = i + 1;
            const amp = harmonics[i];
            const phi = phases[i] || 0;
            const waveVal = amp * Math.sin(n * phase + phi);

            ySum += waveVal;

            // Update individual harmonic position
            // If in 2D mode, all harmonics collapse to the front (zSum plane)
            const zPosition = is2DMode ? zSum : (zHarmonicStart - i * zSpacing);
            harmonicGeoms[i].attributes.position.setXYZ(
                pi,
                x,
                waveVal,
                zPosition,
            );
        }

        // Update sum position
        sumGeom.attributes.position.setXYZ(pi, x, ySum, zSum);
    }

    // Move Stardust slowly and organically
    stardust.rotation.y += 0.0002;
    stardust.rotation.x = Math.sin(timeOffset * 0.1) * 0.02;
    stardust.rotation.z = Math.cos(timeOffset * 0.1) * 0.02;
    if (is2DMode) stardust.visible = false;
    else stardust.visible = true;

    // Epicycles Animation (傅立葉大圓+小圓)
    if (is2DMode) {
        let cx = startX - 90; // 圓心起點，拉近與波形的距離縮短連線
        let cy = 0;
        const cz = zSum;

        const epiPhase = (startX / period) * Math.PI * 2 - timeOffset;

        for (let i = 0; i < MAX_HARMONICS; i++) {
            if (i < NUM_HARMONICS) {
                const n = i + 1;
                const amp = harmonics[i];
                const phi = phases[i] || 0;
                const theta = n * epiPhase + phi;

                epicycleSpheres[i].visible = true;
                radiusLines[i].visible = true;

                // Position and scale sphere
                let globalScale = sphereSizeInput ? parseFloat(sphereSizeInput.value) : 1.0;
                epicycleSpheres[i].position.set(cx, cy, cz);
                const absAmp = Math.max(Math.abs(amp), 0.001) * globalScale; // Render it even if 0
                epicycleSpheres[i].scale.set(absAmp, absAmp, absAmp);
                epicycleSpheres[i].rotation.x += 0.005 * n;
                epicycleSpheres[i].rotation.y += 0.008 * n;

                const nextCx = cx + amp * Math.cos(theta);
                const nextCy = cy + amp * Math.sin(theta);

                // Position radius link
                radiusLines[i].geometry.attributes.position.setXYZ(0, cx, cy, cz);
                radiusLines[i].geometry.attributes.position.setXYZ(1, nextCx, nextCy, cz);
                radiusLines[i].geometry.attributes.position.needsUpdate = true;

                // Keep matrix updated
                epicycleSpheres[i].updateMatrix();
                radiusLines[i].updateMatrix();

                // Always advance positions, even by 0 if amp is 0
                cx = nextCx;
                cy = nextCy;
            } else {
                epicycleSpheres[i].visible = false;
                radiusLines[i].visible = false;
            }
        }

        // 將末端推演出的 Y 值連線至右側的展開波形起頭
        epiConnector.visible = true;
        epiConnector.geometry.attributes.position.setXYZ(0, cx, cy, zSum);
        epiConnector.geometry.attributes.position.setXYZ(1, startX, cy, zSum);
        epiConnector.geometry.attributes.position.needsUpdate = true;

        connLines.visible = false;
    } else {
        for (let i = 0; i < MAX_HARMONICS; i++) {
            epicycleSpheres[i].visible = false;
            radiusLines[i].visible = false;
        }
        if (epiConnector) epiConnector.visible = false;
        connLines.visible = true;
    }

    // Update geometry
    for (let i = 0; i < NUM_HARMONICS; i++) {
        if (!is2DMode) {
            harmonicGeoms[i].attributes.position.needsUpdate = true;
        }
    }
    sumGeom.attributes.position.needsUpdate = true;
    // Removed bounding sphere rebuild for optimization

    // Connecting lines slice
    const sliceIndex = Math.floor(POINTS_PER_LINE / 2);
    const sliceX = startX + sliceIndex * dx;

    for (let i = 0; i < MAX_HARMONICS; i++) {
        const idx = i * 2;
        if (i < NUM_HARMONICS) {
            const n = i + 1;
            const phase = (sliceX / period) * Math.PI * 2 - timeOffset;
            const amp = harmonics[i];
            const phi = phases[i] || 0;
            const waveVal = amp * Math.sin(n * phase + phi);

            const zPosition = zHarmonicStart - i * zSpacing;
            connGeom.attributes.position.setXYZ(idx, sliceX, waveVal, zPosition);
            connGeom.attributes.position.setXYZ(idx + 1, sliceX, 0, zPosition);
        } else {
            connGeom.attributes.position.setXYZ(idx, sliceX, 0, 0);
            connGeom.attributes.position.setXYZ(idx + 1, sliceX, 0, 0);
        }
    }
    connGeom.attributes.position.needsUpdate = true;

    controls.update();
    // Use composer instead of direct renderer
    composer.render();
}

animate();

// Resize handle (Debounced)
let resizeTimeout: ReturnType<typeof setTimeout>;
window.addEventListener("resize", () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        bloomPass.resolution.set(window.innerWidth / 2, window.innerHeight / 2);
    }, 150);
});
