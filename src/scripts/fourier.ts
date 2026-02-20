import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { CONSTANTS, state } from "./state";
import { updateAudioAnalysis } from "./audio";
import { setupUI, orbitSpeedInput, orbitRadiusInput, sphereSizeInput } from "./ui";
import {
    initGeometry,
    updateHarmonicVisibility,
    xRange,
    zSpacing,
    harmonicGeoms,
    sumGeom,
    epicycleSpheres,
    radiusLines,
    epiConnector,
    connLines,
    connGeom
} from "./geometry";

// --- THREE.JS SETUP ---
const container = document.getElementById("canvas-container") as HTMLElement;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020208, 0.0015);

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

// --- BIND UI ---
setupUI({
    onSwitchMode: (mode) => { },
    onToggle2D: (is2D) => {
        if (state.is2DMode) {
            camera.position.set(-160, 0, 650);
            controls.target.set(-160, 0, 0);
            gridHelper.visible = false;
            state.isAutoOrbit = false;
        } else {
            camera.position.set(200, 150, 300);
            controls.target.set(0, 0, 0);
            gridHelper.visible = true;
        }
        updateHarmonicVisibility();
    },
    onToggleBloom: (enabled) => bloomPass.enabled = enabled,
    onUpdateHarmonicCount: () => updateHarmonicVisibility()
});

// --- RENDER LOOP ---
const timer = new THREE.Timer();

function animate() {
    requestAnimationFrame(animate);

    timer.update();
    const delta = timer.getDelta();
    state.timeOffset += delta * 0.8;

    const avgEnergy = updateAudioAnalysis();
    if (avgEnergy > 0) {
        state.timeOffset += (avgEnergy / 255) * 0.02;
    }

    if (state.isAutoOrbit) {
        const speed = parseFloat(orbitSpeedInput.value);
        const radius = parseFloat(orbitRadiusInput.value);
        const time = Date.now() * 0.0005 * speed;
        camera.position.x = Math.sin(time) * radius;
        camera.position.z = Math.cos(time) * radius;
        camera.lookAt(0, 0, 0);
    }

    const startX = -xRange / 2;
    const dx = xRange / (CONSTANTS.POINTS_PER_LINE - 1);
    const period = xRange * 0.4;

    const zSum = 50;
    const zHarmonicStart = zSum - 50;

    for (let pi = 0; pi < CONSTANTS.POINTS_PER_LINE; pi++) {
        const x = startX + pi * dx;
        const phase = (x / period) * Math.PI * 2 - state.timeOffset;

        let ySum = 0;

        for (let i = 0; i < state.NUM_HARMONICS; i++) {
            const n = i + 1;
            const amp = state.harmonics[i];
            const phi = state.phases[i] || 0;
            const waveVal = amp * Math.sin(n * phase + phi);

            ySum += waveVal;

            const zPosition = state.is2DMode ? zSum : (zHarmonicStart - i * zSpacing);
            harmonicGeoms[i].attributes.position.setXYZ(pi, x, waveVal, zPosition);
        }

        sumGeom.attributes.position.setXYZ(pi, x, ySum, zSum);
    }

    stardust.rotation.y += 0.0002;
    stardust.rotation.x = Math.sin(state.timeOffset * 0.1) * 0.02;
    stardust.rotation.z = Math.cos(state.timeOffset * 0.1) * 0.02;
    stardust.visible = !state.is2DMode;

    if (state.is2DMode) {
        let cx = startX - 90;
        let cy = 0;
        const cz = zSum;
        const epiPhase = (startX / period) * Math.PI * 2 - state.timeOffset;

        for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
            if (i < state.NUM_HARMONICS) {
                const n = i + 1;
                const amp = state.harmonics[i];
                const phi = state.phases[i] || 0;
                const theta = n * epiPhase + phi;

                epicycleSpheres[i].visible = true;
                radiusLines[i].visible = true;

                let globalScale = sphereSizeInput ? parseFloat(sphereSizeInput.value) : 1.0;
                epicycleSpheres[i].position.set(cx, cy, cz);
                const absAmp = Math.max(Math.abs(amp), 0.001) * globalScale;
                epicycleSpheres[i].scale.set(absAmp, absAmp, absAmp);
                epicycleSpheres[i].rotation.x += 0.005 * n;
                epicycleSpheres[i].rotation.y += 0.008 * n;

                const nextCx = cx + amp * Math.cos(theta);
                const nextCy = cy + amp * Math.sin(theta);

                radiusLines[i].geometry.attributes.position.setXYZ(0, cx, cy, cz);
                radiusLines[i].geometry.attributes.position.setXYZ(1, nextCx, nextCy, cz);
                radiusLines[i].geometry.attributes.position.needsUpdate = true;

                epicycleSpheres[i].updateMatrix();
                radiusLines[i].updateMatrix();

                cx = nextCx;
                cy = nextCy;
            } else {
                epicycleSpheres[i].visible = false;
                radiusLines[i].visible = false;
            }
        }

        epiConnector.visible = true;
        epiConnector.geometry.attributes.position.setXYZ(0, cx, cy, zSum);
        epiConnector.geometry.attributes.position.setXYZ(1, startX, cy, zSum);
        epiConnector.geometry.attributes.position.needsUpdate = true;

        connLines.visible = false;
    } else {
        for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
            epicycleSpheres[i].visible = false;
            radiusLines[i].visible = false;
        }
        if (epiConnector) epiConnector.visible = false;
        connLines.visible = true;
    }

    for (let i = 0; i < state.NUM_HARMONICS; i++) {
        if (!state.is2DMode) {
            harmonicGeoms[i].attributes.position.needsUpdate = true;
        }
    }
    sumGeom.attributes.position.needsUpdate = true;

    const sliceIndex = Math.floor(CONSTANTS.POINTS_PER_LINE / 2);
    const sliceX = startX + sliceIndex * dx;

    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        const idx = i * 2;
        if (i < state.NUM_HARMONICS) {
            const n = i + 1;
            const phase = (sliceX / period) * Math.PI * 2 - state.timeOffset;
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
        bloomPass.resolution.set(window.innerWidth / 2, window.innerHeight / 2);
    }, 150);
});
