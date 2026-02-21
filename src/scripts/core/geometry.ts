import * as THREE from 'three';
import { CONSTANTS, state } from './state';

function getMaterial(color: THREE.Color | number, opacity: number, linewidth = 2) {
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
export const epicycleSpheres: THREE.Mesh[] = [];
export const radiusLines: THREE.Line[] = [];
export let epiConnector: THREE.Line;
export let connLines: THREE.LineSegments;
export let connGeom: THREE.BufferGeometry;

export const sumGeom = new THREE.BufferGeometry();
const sumPositions = new Float32Array(CONSTANTS.POINTS_PER_LINE * 3);
sumGeom.setAttribute("position", new THREE.BufferAttribute(sumPositions, 3));
export const sumLine = new THREE.Line(sumGeom, getMaterial(0xffffff, 1.0));
sumLine.frustumCulled = false;

export function initGeometry(scene: THREE.Scene) {
    // 1. Harmonic Geometries
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(CONSTANTS.POINTS_PER_LINE * 3);
        geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const color = new THREE.Color();
        color.lerpColors(
            new THREE.Color(0xec4899),
            new THREE.Color(0x3b82f6),
            i / Math.max(1, CONSTANTS.MAX_HARMONICS - 1),
        );

        const material = getMaterial(color, 0.6);
        const line = new THREE.Line(geom, material);
        line.frustumCulled = false;

        scene.add(line);
        harmonicLines.push(line);
        harmonicGeoms.push(geom);
    }

    // 2. Epicycles
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        const sphereGeom = new THREE.SphereGeometry(1, 16, 16);
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

    const epiConnGeom = new THREE.BufferGeometry();
    epiConnGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    epiConnector = new THREE.Line(epiConnGeom, getMaterial(0xffffff, 0.6));
    epiConnector.frustumCulled = false;
    epiConnector.visible = false;
    scene.add(epiConnector);

    // 3. Sum wave
    scene.add(sumLine);

    // 4. Connection Lines
    connGeom = new THREE.BufferGeometry();
    const connPositions = new Float32Array(CONSTANTS.MAX_HARMONICS * 2 * 3);
    connGeom.setAttribute("position", new THREE.BufferAttribute(connPositions, 3));
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

export function updateHarmonicVisibility() {
    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        if (harmonicLines[i]) {
            harmonicLines[i].visible = (i < state.NUM_HARMONICS) && !state.is2DMode;
        }
    }
}
