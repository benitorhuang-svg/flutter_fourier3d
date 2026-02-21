import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { CONSTANTS, state } from "./core/state";
import { fetchMarketData } from "./market/api";
import {
    initGeometry,
    updateHarmonicVisibility,
    xRange,
    zSpacing,
    harmonicGeoms,
    sumGeom,
    epicycleSpheres,
    radiusLines,
    placeholderCircles,
    epiConnector,
    connLines,
    connGeom
} from "./core/geometry";

// --- THREE.JS SETUP ---
const container = document.getElementById("canvas-container") as HTMLElement;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020208, 0.0008);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(200, 150, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.4, // Reduced strength for cleaner look
    0.4, // Increased radius for smoother glow
    0.85 // Higher threshold
);
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- UTILS: CIRCLE TEXTURE ---
function createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}
const starTexture = createCircleTexture();

// --- PARTICLES (NEBULA EFFECT) ---
const particlesGeom = new THREE.BufferGeometry();
const particlesCount = 2000;
const posArray = new Float32Array(particlesCount * 3);
for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 1200;
}
particlesGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMaterial = new THREE.PointsMaterial({
    size: 4.0,
    map: starTexture,
    color: 0x10b981, // Emerald green for market
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
});
const stardust = new THREE.Points(particlesGeom, particlesMaterial);
scene.add(stardust);

// --- LIGHTS & GRID ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x34d399, 4, 800); // emerald
pointLight.position.set(-100, 200, -100);
scene.add(pointLight);

const pointLight2 = new THREE.PointLight(0x06b6d4, 4, 800); // cyan
pointLight2.position.set(200, 200, 200);
scene.add(pointLight2);

const gridHelper = new THREE.GridHelper(1000, 50, 0x10b981, 0x06b6d4);
gridHelper.material.opacity = 0.15;
gridHelper.material.transparent = true;
gridHelper.material.blending = THREE.AdditiveBlending;
gridHelper.material.depthWrite = false;
gridHelper.position.y = -80;
scene.add(gridHelper);

// --- INIT GEOMETRIES ---
state.NUM_HARMONICS = 60; // Max harmonics for full market data
initGeometry(scene);
updateHarmonicVisibility();

// Data Loading Phase
let isDataLoaded = false;
let globalScale = 1.0;

const syncUrl = `${import.meta.env.BASE_URL}/api/sync`.replace(/\/\//g, '/');

async function loadData(mode: any = 'volume-delta') {
    const loader = document.getElementById("market-loader");
    if (loader) {
        loader.style.opacity = '1';
        loader.style.pointerEvents = 'auto';
    }

    state.isAutoOrbit = true;

    let data;
    try {
        const syncRes = await fetch(`${syncUrl}?mode=${mode}`);
        if (syncRes.ok) {
            const json = await syncRes.json();
            data = json.current;
            updateHistoryTimeline(); // Refresh slider when new data comes in
        } else {
            throw new Error("Local sync not available");
        }
    } catch (e) {
        console.warn("DB Sync failed, falling back to direct API fetch.");
        data = await fetchMarketData(mode);
    }

    if (data) {
        applyMarketData(data);
    }

    // UI Updates
    const ampLabel = document.getElementById("legend-amp-val");
    const phaseLabel = document.getElementById("legend-phase-val");

    if (mode === 'volume-delta') {
        if (ampLabel) ampLabel.textContent = "Volume Intensity";
        if (phaseLabel) phaseLabel.textContent = "Constant (0)";
    } else if (mode === 'price-fft') {
        if (ampLabel) ampLabel.textContent = "Cyclic Dominance";
        if (phaseLabel) phaseLabel.textContent = "Harmonic Phase";
    } else if (mode === 'multi-dim') {
        if (ampLabel) ampLabel.textContent = "Volume Height";
        if (phaseLabel) phaseLabel.textContent = "Price Variance";
    }

    if (loader) {
        loader.style.opacity = '0';
        loader.style.pointerEvents = 'none';
    }
}

// Auto-Sync: Every 5 minutes to keep history growing
setInterval(() => {
    const activeBtn = document.querySelector('.market-mode-btn.active');
    const mode = activeBtn?.getAttribute('data-mode') || 'volume-delta';
    console.log("Auto-Syncing market data...");
    loadData(mode);
}, 1000 * 60 * 5);

function applyMarketData(data: any) {
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        // Use target arrays to trigger smooth lerping in the render loop
        const h = data.harmonics[i] ?? 0;
        const p = data.phases[i] ?? 0;

        // If it's the first load, set instantly to avoid long slide-in
        if (!isDataLoaded) {
            state.harmonics[i] = h;
            state.phases[i] = p;
        }

        state.targetHarmonics[i] = h;
        state.targetPhases[i] = p;
    }
    isDataLoaded = true;

    const timestamp = document.getElementById("last-update");
    if (timestamp) timestamp.textContent = `LAST SYNC: ${data.marketTime || new Date().toLocaleTimeString()}`;
}

// History Controls
let timelineData: any[] = [];
const historySlider = document.getElementById('history-slider') as HTMLInputElement;
const timelineLabel = document.getElementById('timeline-label');
const btnGoLive = document.getElementById('btn-go-live');

async function updateHistoryTimeline() {
    try {
        const res = await fetch(`${syncUrl}?action=get-timeline`);
        if (res.ok) {
            timelineData = await res.json();
            if (historySlider && timelineData.length > 0) {
                historySlider.max = (timelineData.length - 1).toString();
                historySlider.value = "0"; // Start at latest
            }
        }
    } catch (err) {
        console.error("Failed to fetch timeline:", err);
    }
}

if (historySlider) {
    historySlider.addEventListener('input', async () => {
        const idx = parseInt(historySlider.value);
        const entry = timelineData[idx];
        if (entry) {
            if (timelineLabel) timelineLabel.textContent = `Reviewing: ${entry.marketTime}`;
            if (timelineLabel) timelineLabel.classList.add('text-emerald-400');

            const res = await fetch(`${syncUrl}?action=load-snapshot&id=${entry.id}`);
            if (res.ok) {
                const snapshot = await res.json();
                applyMarketData(snapshot);
            }
        }
    });
}

if (btnGoLive) {
    btnGoLive.addEventListener('click', () => {
        if (timelineLabel) {
            timelineLabel.textContent = "Live Stream";
            timelineLabel.classList.remove('text-emerald-400');
        }
        loadData();
    });
}

// Initial Load
loadData('volume-delta');
updateHistoryTimeline();

// Hook up mode buttons
const modeBtns = document.querySelectorAll('.market-mode-btn');
modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-mode');
        loadData(mode);
    });
});

// --- RENDER LOOP ---
const timer = new THREE.Timer();

function animate() {
    requestAnimationFrame(animate);

    timer.update();
    const delta = timer.getDelta();
    state.timeOffset -= delta * 0.8;

    // Smooth Morphing: Lerp current values towards targets
    const lerpFactor = 0.05; // Adjust for faster/slower transitions
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        state.harmonics[i] += (state.targetHarmonics[i] - state.harmonics[i]) * lerpFactor;
        state.phases[i] += (state.targetPhases[i] - state.phases[i]) * lerpFactor;
    }

    pointLight.intensity = 4;
    pointLight2.intensity = 4;

    if (state.isAutoOrbit) {
        const speed = 0.3; // Slower, more elegant orbit
        const radius = 450;
        const time = Date.now() * 0.0005 * speed;
        camera.position.x = Math.sin(time) * radius;
        camera.position.z = Math.cos(time) * radius;
        camera.lookAt(0, 0, 0);
    }

    const startX = -xRange / 2;
    const rightX = startX + xRange;
    const dx = xRange / (CONSTANTS.POINTS_PER_LINE - 1);
    const period = xRange * 0.4;

    const zSum = 50;
    const zHarmonicStart = zSum - 50;

    for (let pi = 0; pi < CONSTANTS.POINTS_PER_LINE; pi++) {
        const x = startX + pi * dx;
        const distFromRight = rightX - x;
        const phase = (distFromRight / period) * Math.PI * 2 + state.timeOffset;

        let ySum = 0;

        for (let i = 0; i < state.NUM_HARMONICS; i++) {
            const n = i + 1;
            const amp = state.harmonics[i];
            const phi = state.phases[i] || 0;
            const waveVal = amp * globalScale * Math.sin(n * phase + phi);

            ySum += waveVal;

            const zPosition = false ? zSum : (zHarmonicStart - i * zSpacing);
            harmonicGeoms[i].attributes.position.setXYZ(pi, x, waveVal, zPosition);
        }

        sumGeom.attributes.position.setXYZ(pi, x, ySum, zSum);
    }

    stardust.rotation.y += 0.0002;
    stardust.rotation.x = Math.sin(state.timeOffset * 0.1) * 0.02;
    stardust.rotation.z = Math.cos(state.timeOffset * 0.1) * 0.02;

    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        epicycleSpheres[i].visible = false;
        radiusLines[i].visible = false;
        placeholderCircles[i].visible = false;
    }
    if (epiConnector) epiConnector.visible = false;
    connLines.visible = true;

    for (let i = 0; i < state.NUM_HARMONICS; i++) {
        harmonicGeoms[i].attributes.position.needsUpdate = true;
    }
    sumGeom.attributes.position.needsUpdate = true;

    const sliceIndex = Math.floor(CONSTANTS.POINTS_PER_LINE / 2);
    const sliceX = startX + sliceIndex * dx;

    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        const idx = i * 2;
        if (i < state.NUM_HARMONICS) {
            const n = i + 1;
            const distFromRight = rightX - sliceX;
            const phase = (distFromRight / period) * Math.PI * 2 + state.timeOffset;
            const amp = state.harmonics[i];
            const phi = state.phases[i] || 0;
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
    composer.render();
}

animate();

let resizeTimeout: ReturnType<typeof setTimeout>;
window.addEventListener("resize", () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    }, 150);
});
