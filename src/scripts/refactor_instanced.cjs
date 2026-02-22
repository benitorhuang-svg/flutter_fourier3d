const fs = require('fs');

const geomFile = 'C:/Users/benit/Desktop/triangle_flow_demo/fourier-3d/src/scripts/core/geometry.ts';
const fourierFile = 'C:/Users/benit/Desktop/triangle_flow_demo/fourier-3d/src/scripts/fourier.ts';

// ----------------------------------------
// GEOMETRY FILE REFACTOR
// ----------------------------------------
let geom = fs.readFileSync(geomFile, 'utf-8');

// Replace exports
geom = geom.replace(/export const epicycleSpheres: THREE\.Mesh\[\] = \[\];/g, 'export let epicycleSpheres: THREE.InstancedMesh;');
geom = geom.replace(/export const radiusLines: THREE\.Line\[\] = \[\];/g, 'export let radiusLines: THREE.LineSegments;\nexport let radiusLinesGeom: THREE.BufferGeometry;\nexport let radiusLinesColorData: Float32Array;\nexport let placeholderCircles: THREE.InstancedMesh;');
geom = geom.replace(/export const placeholderCircles: THREE\.LineLoop\[\] = \[\];/g, '');

// Replace creation logic in initGeometry
const initRegex = /\/\/ 2\. Epicycles[\s\S]*?epiConnector = new THREE\.Line/;
geom = geom.replace(initRegex, `// 2. Epicycles (Optimized via Instancing & LineSegments)
    // A. Spheres (Instanced)
    const sphereGeom = new THREE.SphereGeometry(1, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.1,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    epicycleSpheres = new THREE.InstancedMesh(sphereGeom, sphereMat, CONSTANTS.MAX_HARMONICS);
    epicycleSpheres.frustumCulled = false;
    scene.add(epicycleSpheres);

    // B. Placeholders (Instanced Ring)
    const ringGeom = new THREE.RingGeometry(0.95, 1.05, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    placeholderCircles = new THREE.InstancedMesh(ringGeom, ringMat, CONSTANTS.MAX_HARMONICS);
    placeholderCircles.frustumCulled = false;
    scene.add(placeholderCircles);

    // C. Radius Lines (LineSegments)
    radiusLinesGeom = new THREE.BufferGeometry();
    const radiPositions = new Float32Array(CONSTANTS.MAX_HARMONICS * 6);
    radiusLinesColorData = new Float32Array(CONSTANTS.MAX_HARMONICS * 6);
    radiusLinesGeom.setAttribute('position', new THREE.BufferAttribute(radiPositions, 3));
    radiusLinesGeom.setAttribute('color', new THREE.BufferAttribute(radiusLinesColorData, 3));
    const rMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    radiusLines = new THREE.LineSegments(radiusLinesGeom, rMat);
    radiusLines.frustumCulled = false;
    scene.add(radiusLines);

    // Colors & Initial Matrices
    const dummy = new THREE.Object3D();
    dummy.position.set(99999, 99999, 99999);
    dummy.scale.set(0.0001, 0.0001, 0.0001);
    dummy.updateMatrix();

    for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
        const hue = (i * 0.1) % 1.0;
        const color = new THREE.Color().setHSL(hue, 0.8, 0.55);
        epicycleSpheres.setColorAt(i, color);
        placeholderCircles.setColorAt(i, color);
        
        epicycleSpheres.setMatrixAt(i, dummy.matrix);
        placeholderCircles.setMatrixAt(i, dummy.matrix);

        // Pre-fill colors for radius lines
        const idx = i * 6;
        radiusLinesColorData[idx] = color.r; radiusLinesColorData[idx+1] = color.g; radiusLinesColorData[idx+2] = color.b;
        radiusLinesColorData[idx+3] = color.r; radiusLinesColorData[idx+4] = color.g; radiusLinesColorData[idx+5] = color.b;
    }

    const epiConnGeom = new THREE.BufferGeometry();
    epiConnGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    epiConnector = new THREE.Line`);

fs.writeFileSync(geomFile, geom);
console.log('Updated geometry.ts');

// ----------------------------------------
// FOURIER FILE REFACTOR
// ----------------------------------------
let fourier = fs.readFileSync(fourierFile, 'utf-8');

// Update imports
fourier = fourier.replace(/placeholderCircles,/, 'placeholderCircles,\n    radiusLinesGeom,');

// Global objects for instancing transformations
fourier = fourier.replace(/function animate\(\) \{/, `const dummyObj = new THREE.Object3D();\nconst offscreenObj = new THREE.Object3D();\noffscreenObj.position.set(99999,99999,99999);\noffscreenObj.scale.set(0.0001,0.0001,0.0001);\noffscreenObj.updateMatrix();\nfunction animate() {`);

// Rewrite the 2D logic
const loopBodyRegex = /for \(let i = 0; i < CONSTANTS\.MAX_HARMONICS; i\+\+\) \{[\s\S]*?\}\s*\} else \{/m;
fourier = fourier.replace(loopBodyRegex, `
        const radiusPosArr = radiusLinesGeom.attributes.position.array as Float32Array;
        
        for (let i = 0; i < CONSTANTS.MAX_HARMONICS; i++) {
            if (i < state.get().NUM_HARMONICS) {
                const n = i + 1;
                const amp = renderState.harmonics[i];
                const phi = renderState.phases[i] || 0;
                const theta = n * epicyclePhase + phi;

                const scaledAmp = amp * globalScale;
                const absAmp = Math.max(Math.abs(scaledAmp), 0.001);
                
                dummyObj.position.set(cx, cy, cz);
                dummyObj.scale.set(absAmp, absAmp, absAmp);
                
                // Keep persistent rotation for spheres without storing array
                // Approx pseudo-rotation using timeOffset * n
                dummyObj.rotation.x = renderState.timeOffset * 0.3 * n;
                dummyObj.rotation.y = renderState.timeOffset * 0.5 * n;
                dummyObj.updateMatrix();
                epicycleSpheres.setMatrixAt(i, dummyObj.matrix);

                const nextCx = cx + scaledAmp * Math.cos(theta);
                const nextCy = cy + scaledAmp * Math.sin(theta);

                const idx = i * 6;
                radiusPosArr[idx] = cx; radiusPosArr[idx+1] = cy; radiusPosArr[idx+2] = cz;
                radiusPosArr[idx+3] = nextCx; radiusPosArr[idx+4] = nextCy; radiusPosArr[idx+5] = cz;

                cx = nextCx;
                cy = nextCy;

                if (Math.abs(amp) < 0.5) {
                    dummyObj.position.set(cx, cy, cz);
                    dummyObj.scale.set(6, 6, 6);
                    dummyObj.rotation.set(0,0,0);
                    dummyObj.updateMatrix();
                    placeholderCircles.setMatrixAt(i, dummyObj.matrix);
                } else {
                    placeholderCircles.setMatrixAt(i, offscreenObj.matrix);
                }
            } else {
                epicycleSpheres.setMatrixAt(i, offscreenObj.matrix);
                placeholderCircles.setMatrixAt(i, offscreenObj.matrix);
                
                const idx = i * 6;
                radiusPosArr[idx] = 99999; radiusPosArr[idx+1] = 99999; radiusPosArr[idx+2] = 99999;
                radiusPosArr[idx+3] = 99999; radiusPosArr[idx+4] = 99999; radiusPosArr[idx+5] = 99999;
            }
        }
        
        epicycleSpheres.instanceMatrix.needsUpdate = true;
        placeholderCircles.instanceMatrix.needsUpdate = true;
        radiusLinesGeom.attributes.position.needsUpdate = true;
        
        radiusLines.visible = true;
        epicycleSpheres.visible = true;
        placeholderCircles.visible = true;
    } else {`);

// Hide instances correctly when not in 2D
const elseBodyRegex = /for \(let i = 0; i < CONSTANTS\.MAX_HARMONICS; i\+\+\) \{[\s\S]*?if \(epiConnector\)/m;
fourier = fourier.replace(elseBodyRegex, `
        radiusLines.visible = false;
        epicycleSpheres.visible = false;
        placeholderCircles.visible = false;
        
        if (epiConnector)`);

fs.writeFileSync(fourierFile, fourier);
console.log('Updated fourier.ts');
