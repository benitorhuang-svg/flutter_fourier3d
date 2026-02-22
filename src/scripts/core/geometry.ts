import * as THREE from 'three';
import { CONSTANTS, state } from './state';

function getMaterial(color: THREE.Color | number, opacity: number) {
    return new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
}

export const xRange = 600;
export const zSpacing = 15;

export let harmonicLines: THREE.Line[] = [];
export let harmonicGeoms: THREE.BufferGeometry[] = [];

// --- INSTANCED STRUCTURES (draw-call reduction) ---
export let epicycleSpheres: THREE.InstancedMesh;
export let placeholderCircles: THREE.InstancedMesh;
export let radiusLines: THREE.LineSegments;
export let radiusLinesGeom: THREE.BufferGeometry;

export let epiConnector: THREE.Line;
export let connLines: THREE.LineSegments;
export let connGeom: THREE.BufferGeometry;

export const sumGeom = new THREE.BufferGeometry();
const sumPositions = new Float32Array(CONSTANTS.POINTS_PER_LINE * 3);
// Pre-fill X and Z for sum wave (only Y changes each frame)
const _sx = -xRange / 2;
const _sdx = xRange / (CONSTANTS.POINTS_PER_LINE - 1);
for (let pi = 0; pi < CONSTANTS.POINTS_PER_LINE; pi++) {
    sumPositions[pi * 3] = _sx + pi * _sdx;
    sumPositions[pi * 3 + 2] = 50; // zSum
}
sumGeom.setAttribute("position", new THREE.BufferAttribute(sumPositions, 3));
export const sumLine = new THREE.Line(sumGeom, getMaterial(0xffffff, 1.0));
sumLine.frustumCulled = false;

export function initGeometry(scene: THREE.Scene) {
    const startX = -xRange / 2;
    const dx = xRange / (CONSTANTS.POINTS_PER_LINE - 1);
    const zHarmonicStart = 0; // zSum(50) - 50

    // 1. Harmonic Lines (pre-fill X and Z; CPU updates only Y each frame)
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(CONSTANTS.POINTS_PER_LINE * 3);
        const zPos = zHarmonicStart - i * zSpacing;
        for (let pi = 0; pi < CONSTANTS.POINTS_PER_LINE; pi++) {
            positions[pi * 3] = startX + pi * dx;
            positions[pi * 3 + 2] = zPos;
        }
        geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const hue = (i * 0.1) % 1.0;
        const color = new THREE.Color().setHSL(hue, 0.8, 0.55);
        const line = new THREE.Line(geom, getMaterial(color, 0.6));
        line.frustumCulled = false;
        scene.add(line);
        harmonicLines.push(line);
        harmonicGeoms.push(geom);
    }

    // 2. Epicycle Spheres (InstancedMesh — 1 draw call for all)
    const sphereGeom = new THREE.SphereGeometry(1, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0.1, wireframe: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    epicycleSpheres = new THREE.InstancedMesh(sphereGeom, sphereMat, CONSTANTS.MAX_HARMONICS);
    epicycleSpheres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(epicycleSpheres);

    // 3. Placeholder Circles (InstancedMesh)
    const ringGeom = new THREE.TorusGeometry(1, 0.015, 8, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    placeholderCircles = new THREE.InstancedMesh(ringGeom, ringMat, CONSTANTS.MAX_HARMONICS);
    scene.add(placeholderCircles);

    // 4. Radius Lines (merged LineSegments — 1 draw call)
    radiusLinesGeom = new THREE.BufferGeometry();
    const radiPos = new Float32Array(CONSTANTS.MAX_HARMONICS * 2 * 3);
    const radiCol = new Float32Array(CONSTANTS.MAX_HARMONICS * 2 * 3);
    radiusLinesGeom.setAttribute('position', new THREE.BufferAttribute(radiPos, 3));
    radiusLinesGeom.setAttribute('color', new THREE.BufferAttribute(radiCol, 3));
    radiusLines = new THREE.LineSegments(radiusLinesGeom, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(radiusLines);

    // Init instanced colors & matrices
    const dummy = new THREE.Object3D();
    dummy.position.set(0, 0, -5000);
    dummy.updateMatrix();
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        const hue = (i * 0.1) % 1.0;
        const c = new THREE.Color().setHSL(hue, 0.8, 0.55);
        epicycleSpheres.setColorAt(i, c);
        placeholderCircles.setColorAt(i, c);
        epicycleSpheres.setMatrixAt(i, dummy.matrix);
        placeholderCircles.setMatrixAt(i, dummy.matrix);
        const ci = i * 6;
        radiCol[ci] = c.r; radiCol[ci + 1] = c.g; radiCol[ci + 2] = c.b;
        radiCol[ci + 3] = c.r; radiCol[ci + 4] = c.g; radiCol[ci + 5] = c.b;
    }

    // 5. Epi Connector
    const ecGeom = new THREE.BufferGeometry();
    ecGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    epiConnector = new THREE.Line(ecGeom, getMaterial(0xffffff, 0.6));
    epiConnector.frustumCulled = false;
    epiConnector.visible = false;
    scene.add(epiConnector);

    // 6. Sum Line
    scene.add(sumLine);

    // 7. Connection Lines (3D mode)
    connGeom = new THREE.BufferGeometry();
    connGeom.setAttribute("position", new THREE.BufferAttribute(
        new Float32Array(CONSTANTS.MAX_HARMONICS * 2 * 3), 3
    ));
    connLines = new THREE.LineSegments(connGeom, new THREE.LineBasicMaterial({
        color: 0x64748b, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    connLines.frustumCulled = false;
    scene.add(connLines);
}

export function updateHarmonicVisibility() {
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        if (harmonicLines[i]) {
            harmonicLines[i].visible = !state.get().is2DMode && (i < state.get().NUM_HARMONICS);
        }
    }
}
