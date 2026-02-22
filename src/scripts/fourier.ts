import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { CONSTANTS, state } from "./core/state";
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
    radiusLines,
    placeholderCircles,
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
    if (state.is2DMode) {
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
    state.is2DMode = is2D;
    syncCamera();
    gridHelper.visible = !is2D;
    if (is2D) state.isAutoOrbit = false;
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

// --- RENDER LOOP ---
const timer = new THREE.Timer();

function animate() {
    requestAnimationFrame(animate);

    timer.update();
    const delta = timer.getDelta();
    state.timeOffset -= delta * 0.8;

    // Decay beat strength
    beatStrength *= 0.9;
    bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 0.6, 0.1);
    pointLight.intensity = 4 + beatStrength * 10;
    pointLight2.intensity = 4 + beatStrength * 10;

    const avgEnergy = updateAudioAnalysis();
    if (avgEnergy > 0) {
        state.timeOffset -= (avgEnergy / 255) * 0.02;
    }

    // Smooth Morphing: Lerp current values towards targets
    const lerpFactor = 0.06;
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        state.harmonics[i] += (state.targetHarmonics[i] - state.harmonics[i]) * lerpFactor;
        state.phases[i] += (state.targetPhases[i] - state.phases[i]) * lerpFactor;
    }

    if (state.isAutoOrbit) {
        const speedInput = getOrbitSpeedInput();
        const radiusInput = getOrbitRadiusInput();
        const speed = speedInput ? parseFloat(speedInput.value) : 1.0;
        const radius = radiusInput ? parseFloat(radiusInput.value) : 350;
        const time = Date.now() * 0.0005 * speed;
        camera.position.x = Math.sin(time) * radius;
        camera.position.z = Math.cos(time) * radius;
        camera.lookAt(0, 0, 0);
    }

    const ssInput = getSphereSizeInput();
    const globalScale = ssInput ? parseFloat(ssInput.value) : 1.0;

    const startX = -xRange / 2;
    const rightX = startX + xRange;
    const dx = xRange / (CONSTANTS.POINTS_PER_LINE - 1);
    const period = xRange * 0.4;

    const zSum = 50;
    const zHarmonicStart = zSum - 50;

    // Pre-cache arrays for direct access (Massive performance boost)
    const sumArr = sumGeom.attributes.position.array as Float32Array;
    const harmonicArrs = state.NUM_HARMONICS > 0 ? harmonicGeoms.slice(0, state.NUM_HARMONICS).map(g => g.attributes.position.array as Float32Array) : [];

    for (let pi = 0; pi < CONSTANTS.POINTS_PER_LINE; pi++) {
        const x = startX + pi * dx;
        const distFromRight = rightX - x;
        const phase = (distFromRight / period) * Math.PI * 2 + state.timeOffset;

        let ySum = 0;
        const pi3 = pi * 3;

        for (let i = 0; i < state.NUM_HARMONICS; i++) {
            const n = i + 1;
            const amp = state.harmonics[i];
            const phi = state.phases[i] || 0;
            const waveVal = amp * globalScale * Math.sin(n * phase + phi);

            ySum += waveVal;

            if (!state.is2DMode) {
                const arr = harmonicArrs[i];
                const zPosition = zHarmonicStart - i * zSpacing;
                arr[pi3] = x;
                arr[pi3 + 1] = waveVal;
                arr[pi3 + 2] = zPosition;
            }
        }

        sumArr[pi3] = x;
        sumArr[pi3 + 1] = ySum;
        sumArr[pi3 + 2] = zSum;
    }

    // Flag for update once per buffer
    if (!state.is2DMode) {
        for (let i = 0; i < state.NUM_HARMONICS; i++) {
            harmonicGeoms[i].attributes.position.needsUpdate = true;
        }
    }
    sumGeom.attributes.position.needsUpdate = true;

    stardust.rotation.y += 0.0001; // subtle rotation
    stardust.rotation.x = Math.sin(state.timeOffset * 0.05) * 0.01;
    stardust.visible = true; // Always visible for premium feel

    if (state.is2DMode) {
        // Dynamic Offset for Mobile: epicycles closer to wave to save horizontal space
        const epicycleOffsetX = window.innerWidth < 768 ? 60 : 110;
        let cx = rightX + epicycleOffsetX;
        let cy = 0;
        const cz = zSum;
        const epicyclePhase = state.timeOffset;

        for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
            if (i < state.NUM_HARMONICS) {
                const n = i + 1;
                const amp = state.harmonics[i];
                const phi = state.phases[i] || 0;
                const theta = n * epicyclePhase + phi;

                epicycleSpheres[i].visible = true;
                radiusLines[i].visible = true;

                // VISUAL CONSISTENCY: next center is cx + scaledAmp
                const scaledAmp = amp * globalScale;
                epicycleSpheres[i].position.set(cx, cy, cz);
                const absAmp = Math.max(Math.abs(scaledAmp), 0.001);
                epicycleSpheres[i].scale.set(absAmp, absAmp, absAmp);
                epicycleSpheres[i].rotation.x += 0.005 * n;
                epicycleSpheres[i].rotation.y += 0.008 * n;

                const nextCx = cx + scaledAmp * Math.cos(theta);
                const nextCy = cy + scaledAmp * Math.sin(theta);

                radiusLines[i].geometry.attributes.position.setXYZ(0, cx, cy, cz);
                radiusLines[i].geometry.attributes.position.setXYZ(1, nextCx, nextCy, cz);
                radiusLines[i].geometry.attributes.position.needsUpdate = true;

                epicycleSpheres[i].updateMatrix();
                radiusLines[i].updateMatrix();

                cx = nextCx;
                cy = nextCy;

                // Placeholder logic: If amp is effectively 0, show a ghost circle to mark the spot
                if (Math.abs(amp) < 0.5) {
                    placeholderCircles[i].visible = true;
                    placeholderCircles[i].position.set(cx, cy, cz);
                    placeholderCircles[i].scale.set(6, 6, 6);
                } else {
                    placeholderCircles[i].visible = false;
                }
            } else {
                epicycleSpheres[i].visible = false;
                radiusLines[i].visible = false;
                placeholderCircles[i].visible = false;
            }
        }

        epiConnector.visible = true;
        epiConnector.geometry.attributes.position.setXYZ(0, cx, cy, zSum);
        epiConnector.geometry.attributes.position.setXYZ(1, rightX, cy, zSum);
        epiConnector.geometry.attributes.position.needsUpdate = true;

        connLines.visible = false;
    } else {
        for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
            epicycleSpheres[i].visible = false;
            radiusLines[i].visible = false;
            placeholderCircles[i].visible = false;
        }
        if (epiConnector) epiConnector.visible = false;
        connLines.visible = true;
    }

    // Updated above in main loop for performance

    const sliceIndex = Math.floor(CONSTANTS.POINTS_PER_LINE / 2);
    const sliceX = startX + sliceIndex * dx;

    const connArr = connGeom.attributes.position.array as Float32Array;
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        const idx6 = i * 6; // i * 2 points * 3 coords
        if (i < state.NUM_HARMONICS) {
            const n = i + 1;
            const distFromRight = rightX - sliceX;
            const phase = (distFromRight / period) * Math.PI * 2 + state.timeOffset;
            const amp = state.harmonics[i];
            const phi = state.phases[i] || 0;
            const waveVal = amp * Math.sin(n * phase + phi);

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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        bloomPass.resolution.set(window.innerWidth, window.innerHeight);
        syncCamera(); // Recalculate 2D distance for mobile portrait/landscape
    }, 150);
});
