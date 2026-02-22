import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { CONSTANTS, state, renderState } from "./core/state";
import { events, UI_EVENTS, AUDIO_EVENTS } from "./core/events";
import { updateAudioAnalysis } from "./audio";
import { setupUI, getOrbitSpeedInput, getOrbitRadiusInput, getSphereSizeInput } from "./ui";
import {
    initGeometry,
    updateHarmonicVisibility,
    xRange,
    zSpacing,
    harmonicGeoms,
    sumGeom,
    epicycleSpheres,
    placeholderCircles,
    radiusLines,
    radiusLinesGeom,
    epiConnector,
    connLines,
    connGeom
} from "./core/geometry";

// --- THREE.JS SETUP ---
const container = document.getElementById("canvas-container") as HTMLElement;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020208, 0.0008); // Reduced fog density for clearer lines

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
const pixelRatio = renderer.getPixelRatio();
const targetResX = (window.innerWidth * pixelRatio) / 2;
const targetResY = (window.innerHeight * pixelRatio) / 2;

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(targetResX, targetResY),
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

// --- PARTICLES (PREMIUM STARRY SKY) ---
const createStarrySky = () => {
    const particlesGeom = new THREE.BufferGeometry();
    const count = 5000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const color1 = new THREE.Color(0x8b5cf6); // purple
    const color2 = new THREE.Color(0x06b6d4); // cyan
    const color3 = new THREE.Color(0xffffff); // white

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 2000;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2000;

        const mix = Math.random();
        let c = color3;
        if (mix < 0.3) c = color1;
        else if (mix < 0.6) c = color2;

        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;

        sizes[i] = Math.random() * 2 + 0.5;
    }

    particlesGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particlesMaterial = new THREE.PointsMaterial({
        size: 3.0,
        map: starTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });

    return new THREE.Points(particlesGeom, particlesMaterial);
};

const stardust = createStarrySky();
scene.add(stardust);
stardust.frustumCulled = false;

// --- LIGHTS & GRID ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xec4899, 4, 800);
pointLight.position.set(-100, 200, -100);
scene.add(pointLight);

const pointLight2 = new THREE.PointLight(0x3b82f6, 4, 800);
pointLight2.position.set(200, 200, 200);
scene.add(pointLight2);

const gridHelper = new THREE.GridHelper(1000, 50, 0x8b5cf6, 0x3b82f6);
gridHelper.material.opacity = 0.15;
gridHelper.material.transparent = true;
gridHelper.material.blending = THREE.AdditiveBlending;
gridHelper.material.depthWrite = false;
gridHelper.position.y = -80;
scene.add(gridHelper);

// --- INIT GEOMETRIES ---
initGeometry(scene);
updateHarmonicVisibility();

// --- EVENT HANDLERS ---
// --- RESPONSIVE CAMERA HELPERS ---
function syncCamera() {
    if (state.get().is2DMode) {
        const aspect = window.innerWidth / window.innerHeight;
        // The span we want to show is roughly from startX (-300) to epicycle area (+550)
        // Total span ~850-900.
        const span = 900;
        const targetX = 100; // Centered between -300 and 500

        const vertFovRad = (camera.fov * Math.PI) / 180;
        // Visible width at distance z: W = 2 * tan(vertFov/2) * aspect * z
        // So z = W / (2 * tan(vertFov/2) * aspect)
        let z = span / (2 * Math.tan(vertFovRad / 2) * aspect);

        // Base minimum z to keep look consistent on desktop
        z = Math.max(z, 650);

        camera.position.set(targetX, 0, z);
        controls.target.set(targetX, 0, 0);
    } else {
        // Standard 3D perspective
        if (window.innerWidth < 768) {
            camera.position.set(250, 180, 400); // Further back for mobile 3D
        } else {
            camera.position.set(200, 150, 300);
        }
        controls.target.set(0, 0, 0);
    }
    controls.update();
}

events.on(UI_EVENTS.TOGGLE_2D, (is2D) => {
    state.setKey('is2DMode', is2D);
    syncCamera();
    gridHelper.visible = !is2D;
    if (is2D) state.setKey('isAutoOrbit', false);
    updateHarmonicVisibility();
});

events.on(UI_EVENTS.HARMONIC_CHANGE, (count) => {
    updateHarmonicVisibility();
    // Sync UI labels if they exist
    const display = document.getElementById("harmonic-count-display");
    if (display) display.textContent = count.toString();
    const valLabel = document.getElementById("harmonic-count-val");
    if (valLabel) valLabel.textContent = count.toString();
});
events.on(UI_EVENTS.RESET_CAMERA, () => {
    syncCamera();
});

// Beat visualization
let beatStrength = 0;
events.on(AUDIO_EVENTS.BEAT, (strength) => {
    beatStrength = strength;
    // Visual reaction: burst of bloom and light intensity
    bloomPass.strength = 0.8 + strength * 1.5;
});

// --- FAST MATH LOOKUP TABLE (LUT) ---
const LUT_SIZE = 8192;
const sinLUT = new Float32Array(LUT_SIZE);
const PI2 = Math.PI * 2;
for (let i = 0; i < LUT_SIZE; i++) {
    sinLUT[i] = Math.sin((i / LUT_SIZE) * PI2);
}

function fastSin(val: number): number {
    let phase = val % PI2;
    if (phase < 0) phase += PI2;
    const idx = (phase / PI2) * LUT_SIZE;
    return sinLUT[idx | 0]; // bitwise OR acts as fast Math.floor
}

function fastCos(val: number): number {
    let phase = (val + Math.PI / 2) % PI2;
    if (phase < 0) phase += PI2;
    const idx = (phase / PI2) * LUT_SIZE;
    return sinLUT[idx | 0];
}

// --- RENDER LOOP VISIBILITY TOGGLE ---
let isPageVisible = true;
let isAnimating = false;

document.addEventListener("visibilitychange", () => {
    isPageVisible = !document.hidden;
    if (isPageVisible && !isAnimating) {
        timer.update();
        animate();
    }
});

// --- RENDER LOOP ---
const timer = new THREE.Timer();
const dummyObj = new THREE.Object3D();
const offscreenObj = new THREE.Object3D();
offscreenObj.position.set(0, 0, -5000);
offscreenObj.updateMatrix();

function animate() {
    if (!isPageVisible) {
        isAnimating = false;
        return; // Pause the WebGL loop completely to save 100% CPU when tab is hidden
    }
    isAnimating = true;

    requestAnimationFrame(animate);

    timer.update();
    const delta = timer.getDelta();
    renderState.timeOffset -= delta * 0.8;

    // Decay beat strength
    beatStrength *= 0.9;
    bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 0.6, 0.1);
    pointLight.intensity = 4 + beatStrength * 10;
    pointLight2.intensity = 4 + beatStrength * 10;

    const avgEnergy = updateAudioAnalysis();
    if (avgEnergy > 0) {
        renderState.timeOffset -= (avgEnergy / 255) * 0.02;
    }

    // Smooth Morphing: Lerp current values towards targets
    const lerpFactor = 0.06;
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        renderState.harmonics[i] += (renderState.targetHarmonics[i] - renderState.harmonics[i]) * lerpFactor;
        renderState.phases[i] += (renderState.targetPhases[i] - renderState.phases[i]) * lerpFactor;
    }

    if (state.get().isAutoOrbit) {
        const speedInput = getOrbitSpeedInput();
        const radiusInput = getOrbitRadiusInput();
        const speed = speedInput ? parseFloat(speedInput.value) : 1.0;
        const radius = radiusInput ? parseFloat(radiusInput.value) : 350;
        const time = Date.now() * 0.0005 * speed;
        camera.position.x = fastSin(time) * radius;
        camera.position.z = fastCos(time) * radius;
        camera.lookAt(0, 0, 0);
    }

    const ssInput = getSphereSizeInput();
    const globalScale = ssInput ? parseFloat(ssInput.value) : 1.0;

    const startX = -xRange / 2;
    const rightX = startX + xRange;
    const period = xRange * 0.4;

    const zSum = 50;
    const zHarmonicStart = zSum - 50;

    const activeCount = state.get().NUM_HARMONICS;
    const is2D = state.get().is2DMode;
    const dx = xRange / (CONSTANTS.POINTS_PER_LINE - 1);

    // ── CPU PATH: LUT-accelerated wave computation (only writes Y) ──
    const sumArr = sumGeom.attributes.position.array as Float32Array;
    const harmonicArrs = !is2D && activeCount > 0
        ? harmonicGeoms.slice(0, activeCount).map(g => g.attributes.position.array as Float32Array)
        : [];

    for (let pi = 0; pi < CONSTANTS.POINTS_PER_LINE; pi++) {
        const x = startX + pi * dx;
        const distFromRight = rightX - x;
        const phase = (distFromRight / period) * PI2 + renderState.timeOffset;

        let ySum = 0;
        const pi3_y = pi * 3 + 1;

        for (let i = 0; i < activeCount; i++) {
            const n = i + 1;
            const amp = renderState.harmonics[i];
            const phi = renderState.phases[i] || 0;
            const waveVal = amp * globalScale * fastSin(n * phase + phi);
            ySum += waveVal;
            if (!is2D) { harmonicArrs[i][pi3_y] = waveVal; }
        }
        sumArr[pi3_y] = ySum;
    }

    if (!is2D) {
        for (let i = 0; i < activeCount; i++) {
            harmonicGeoms[i].attributes.position.needsUpdate = true;
        }
    }
    sumGeom.attributes.position.needsUpdate = true;

    stardust.rotation.y += 0.0001; // subtle rotation
    stardust.rotation.x = fastSin(renderState.timeOffset * 0.05) * 0.01;
    stardust.visible = true; // Always visible for premium feel

    if (state.get().is2DMode) {
        // Dynamic Offset for Mobile: epicycles closer to wave to save horizontal space
        const epicycleOffsetX = window.innerWidth < 768 ? 60 : 110;
        let cx = rightX + epicycleOffsetX;
        let cy = 0;
        const cz = zSum;
        const epicyclePhase = renderState.timeOffset;

        const radiPosArr = radiusLinesGeom.attributes.position.array as Float32Array;

        for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
            if (i < state.get().NUM_HARMONICS) {
                const n = i + 1;
                const amp = renderState.harmonics[i];
                const phi = renderState.phases[i] || 0;
                const theta = n * epicyclePhase + phi;

                const scaledAmp = amp * globalScale;
                const absAmp = Math.max(Math.abs(scaledAmp), 0.001);

                // Update Sphere Instance
                dummyObj.position.set(cx, cy, cz);
                dummyObj.scale.set(absAmp, absAmp, absAmp);
                // Pseudo-rotation for interest
                dummyObj.rotation.x = renderState.timeOffset * 0.3 * n;
                dummyObj.rotation.y = renderState.timeOffset * 0.5 * n;
                dummyObj.updateMatrix();
                epicycleSpheres.setMatrixAt(i, dummyObj.matrix);

                const nextCx = cx + scaledAmp * fastCos(theta);
                const nextCy = cy + scaledAmp * fastSin(theta);

                // Update Radius Line Segment
                const vIdx = i * 6;
                radiPosArr[vIdx] = cx; radiPosArr[vIdx + 1] = cy; radiPosArr[vIdx + 2] = cz;
                radiPosArr[vIdx + 3] = nextCx; radiPosArr[vIdx + 4] = nextCy; radiPosArr[vIdx + 5] = cz;

                cx = nextCx;
                cy = nextCy;

                // Update Placeholder Instance
                if (Math.abs(amp) < 0.5) {
                    dummyObj.position.set(cx, cy, cz);
                    dummyObj.scale.set(6, 6, 6);
                    dummyObj.rotation.set(0, 0, 0);
                    dummyObj.updateMatrix();
                    placeholderCircles.setMatrixAt(i, dummyObj.matrix);
                } else {
                    placeholderCircles.setMatrixAt(i, offscreenObj.matrix);
                }
            } else {
                epicycleSpheres.setMatrixAt(i, offscreenObj.matrix);
                placeholderCircles.setMatrixAt(i, offscreenObj.matrix);
                const vIdx = i * 6;
                radiPosArr[vIdx] = 0; radiPosArr[vIdx + 1] = 0; radiPosArr[vIdx + 2] = -5000;
                radiPosArr[vIdx + 3] = 0; radiPosArr[vIdx + 4] = 0; radiPosArr[vIdx + 5] = -5000;
            }
        }

        epicycleSpheres.instanceMatrix.needsUpdate = true;
        placeholderCircles.instanceMatrix.needsUpdate = true;
        radiusLinesGeom.attributes.position.needsUpdate = true;

        epicycleSpheres.visible = true;
        placeholderCircles.visible = true;
        radiusLines.visible = true;

        epiConnector.visible = true;
        epiConnector.geometry.attributes.position.setXYZ(0, cx, cy, zSum);
        epiConnector.geometry.attributes.position.setXYZ(1, rightX, cy, zSum);
        epiConnector.geometry.attributes.position.needsUpdate = true;

        connLines.visible = false;
    } else {
        epicycleSpheres.visible = false;
        placeholderCircles.visible = false;
        radiusLines.visible = false;
        if (epiConnector) epiConnector.visible = false;
        connLines.visible = true;
    }

    // Updated above in main loop for performance

    const sliceIndex = Math.floor(CONSTANTS.POINTS_PER_LINE / 2);
    const sliceX = startX + sliceIndex * (xRange / (CONSTANTS.POINTS_PER_LINE - 1));

    const connArr = connGeom.attributes.position.array as Float32Array;
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        const idx6 = i * 6; // i * 2 points * 3 coords
        if (i < state.get().NUM_HARMONICS) {
            const n = i + 1;
            const distFromRight = rightX - sliceX;
            const phase = (distFromRight / period) * Math.PI * 2 + renderState.timeOffset;
            const amp = renderState.harmonics[i];
            const phi = renderState.phases[i] || 0;
            const waveVal = amp * fastSin(n * phase + phi);

            const zPosition = zHarmonicStart - i * zSpacing;
            connArr[idx6] = sliceX;
            connArr[idx6 + 1] = waveVal;
            connArr[idx6 + 2] = zPosition;
            connArr[idx6 + 3] = sliceX;
            connArr[idx6 + 4] = 0;
            connArr[idx6 + 5] = zPosition;
        } else {
            connArr[idx6] = sliceX;
            connArr[idx6 + 1] = 0;
            connArr[idx6 + 2] = 0;
            connArr[idx6 + 3] = sliceX;
            connArr[idx6 + 4] = 0;
            connArr[idx6 + 5] = 0;
        }
    }
    connGeom.attributes.position.needsUpdate = true;

    controls.update();
    composer.render();
}

setupUI();
animate();

let resizeTimeout: ReturnType<typeof setTimeout>;
window.addEventListener("resize", () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        const nextPixelRatio = Math.min(window.devicePixelRatio, 2);
        renderer.setPixelRatio(nextPixelRatio);
        const resX = (window.innerWidth * nextPixelRatio) / 2;
        const resY = (window.innerHeight * nextPixelRatio) / 2;
        bloomPass.resolution.set(resX, resY);
        syncCamera();
    }, 150);
});
