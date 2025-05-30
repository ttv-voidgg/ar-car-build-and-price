import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';


// Declare
const canvas = document.getElementById('experience-canvas');
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
};

const renderTarget = new THREE.WebGLRenderTarget(sizes.width, sizes.height, {
    format: THREE.RGBAFormat,
    stencilBuffer: false,
    samples: 10000,
});


// Scene and camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(10, 5, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
//renderer.physicallyCorrectLights = true;
//renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // softer shadows
document.body.appendChild(renderer.domElement);

// After renderer initialization:


// PMREM environment
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envTexture = new THREE.TextureLoader().load('/textures/env.jpg', (texture) => {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    scene.background = envMap;
});

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 2;
controls.update();

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Post-processing setup
const BLOOM_LAYER = 1;

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0;
bloomPass.strength = 1;
bloomPass.radius = 0;

const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Raycaster and mouse
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();


// Helper to create soft spotlights for headlights
function createSoftSpotLight(color = 0xffffff, intensity = 100) {
    const spotLight = new THREE.SpotLight(color, intensity, 10, Math.PI / 4, 0.7, 1);
    spotLight.castShadow = true;           // Enable shadows if you want
    spotLight.penumbra = 0.7;               // Soft edge
    spotLight.decay = 2;                    // Light decay
    spotLight.shadow.mapSize.width = 1024; // Shadow quality
    spotLight.shadow.mapSize.height = 1024;
    spotLight.shadow.camera.near = 0.1;
    spotLight.shadow.camera.far = 20;
    return spotLight;
}

function preserveMat(child) {
    // Clone the existing material to preserve original properties
    const originalMat = child.material;
    const newMat = new THREE.MeshPhysicalMaterial({
        // Preserve texture or color
        map: originalMat.map || null,
        color: originalMat.color.clone(), // Retain the existing color
        roughness: originalMat.roughness ?? 0.5,
        metalness: originalMat.metalness ?? 0.3,

        // Add enhancements
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        reflectivity: 0.5,
        envMapIntensity: 1.0,
        side: THREE.DoubleSide, // Fix hollow appearance
        transparent: originalMat.transparent,
        opacity: originalMat.opacity
    });

    child.material = newMat;
    child.material.needsUpdate = true;
}

// Load GLTF with Draco
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

//Mesh Vars
let doorOpen = false;

let driverHeadlight = null;
let passengerHeadlight = null;
let driverHeadlightOGMat = null;
let passengerHeadlightOGMat = null;

const interactiveMeshes = [];

const turnLights = [];

let driverSpotLight = null;
let passengerSpotLight = null;

let hazardActive = false;
let hazardInterval = null;

const hazardLights = [];

loader.load('/models/model.glb', (gltf) => {
    gltf.scene.traverse((child) => {
        if (child.isMesh) {
            //console.log(child);

            child.material.side = THREE.DoubleSide;
            child.geometry.computeVertexNormals();

            //hazard_light
            //hazard_light001
            if (child.name.includes("turn")||child.name.includes("Turn")) {
                preserveMat(child);
                turnLights.push(child);
                hazardLights.push(child);
            }

            //body2Interior_Geo_lodABody_lodA
            if (child.name === "body2Interior_Geo_lodABody_lodA") {
                preserveMat(child);
            }

            if (child.name === "Body" || child.name === "Driver-DoorExterior-Panel") {
                // Dispose old material to avoid memory leaks
                if (child.material) {
                    child.material.dispose();
                }

                // Create a new MeshStandardMaterial with white color
                child.material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color('#F5ED07'),   // Pure white color
                    roughness: 1,                      // Medium roughness: surfaces are somewhat smooth
                    metalness: 0.7,                      // More metallic for car body reflections
                    clearcoat: 1.0,                     // Adds a shiny clear coat on top, like car paint
                    clearcoatRoughness: 0.1,            // Clearcoat is mostly smooth/shiny
                    reflectivity: 0.5,                  // Controls reflectivity of non-metal parts
                    envMapIntensity: 1.0,               // How strong the environment reflections appear
                });

                // If you want the mesh to cast/receive shadows, enable these:
                child.castShadow = true;
                child.receiveShadow = true;
            }

            if (child.name === "Driver-DoorExterior-Panel") {
                interactiveMeshes.push(child);
            }

            if (child.name === "hazard") {
                interactiveMeshes.push(child);
            }

            if (child.name.includes("Driver-Headlight")) {
                interactiveMeshes.push(child);
                driverHeadlight = child;
                preserveMat(child);
                driverHeadlightOGMat = child.material;

                // Enable bloom layer initially off
                driverHeadlight.layers.disable(BLOOM_LAYER);
            }

            if (child.name.includes("Passenger-Headlight")) {
                interactiveMeshes.push(child);
                passengerHeadlight = child;
                preserveMat(child);
                passengerHeadlightOGMat = child.material;

                passengerHeadlight.layers.disable(BLOOM_LAYER);
            }

            if (child.name.includes("headlight-switch")) {
                interactiveMeshes.push(child);
                child.material = new THREE.MeshPhysicalMaterial({
                    color: 0x000000,
                    roughness: 0.1,
                    metalness: 0,
                    ior:.4,
                    opacity: 0.007,             // Very see-through
                    transparent: true,
                    side: THREE.DoubleSide,   // Visible from all angles
                    depthWrite: false         // Prevents render sorting issues
                });
            }
        }
    });

    scene.add(gltf.scene);

    // Setup driver spotlight attached to driver headlight mesh
    if(driverHeadlight) {
        driverSpotLight = createSoftSpotLight();
        scene.add(driverSpotLight);
        scene.add(driverSpotLight.target);
        driverSpotLight.visible = false; // Start off
    }

    // Setup passenger spotlight attached to passenger headlight mesh
    if(passengerHeadlight) {
        passengerSpotLight = createSoftSpotLight();
        scene.add(passengerSpotLight);
        scene.add(passengerSpotLight.target);
        passengerSpotLight.visible = false; // Start off
    }



    // Adjust controls target to model center after loading
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    camera.lookAt(center);
    controls.update();
}, undefined, (error) => {
    console.error('Error loading model:', error);
});

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

const startButton = document.getElementById('startButton');

//AR Orientation
let alpha = -90.00, beta = 90.00, gamma = 63.43;

function updateCameraOrientation(alpha, beta, gamma) {
    const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(-beta),
        THREE.MathUtils.degToRad(alpha),
        THREE.MathUtils.degToRad(gamma),
        'XYZ' // important order for mobile
    );

    camera.quaternion.setFromEuler(euler);
    camera.updateMatrixWorld();
}

const euler2 = new THREE.Euler().setFromQuaternion(camera.quaternion, 'XYZ');

console.log('Camera Euler angles (degrees):', {
    x: THREE.MathUtils.radToDeg(euler2.x).toFixed(2),
    y: THREE.MathUtils.radToDeg(euler2.y).toFixed(2),
    z: THREE.MathUtils.radToDeg(euler2.z).toFixed(2),
});

let usingDeviceOrientation = false; // <-- add this flag
const debugDiv = document.getElementById('orientation-debug');

startButton.addEventListener('click', async () => {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const response = await DeviceOrientationEvent.requestPermission();
            if (response !== 'granted') {
                alert("Permission not granted for motion/orientation");
                return;
            }
        } catch (error) {
            alert("Device Orientation not supported or permission error.");
            return;
        }
    }



    window.addEventListener('deviceorientation', (event) => {
        const alpha = event.alpha ?? 0; // Yaw (compass)
        const beta = event.beta ?? 0;   // Pitch (tilt front/back)
        const gamma = event.gamma ?? 0; // Roll (tilt side to side)

        // Convert degrees to radians
        const pitch = THREE.MathUtils.degToRad(beta);
        const yaw = THREE.MathUtils.degToRad(alpha);
        const roll = THREE.MathUtils.degToRad(gamma);

        // Optional: log to see what's changing
        console.log({ pitch, yaw, roll });

        // Example: Apply only pitch (elevation)
        camera.rotation.x = pitch; // tilt up/down
    });
});

// Listen for click events on the renderer's canvas
renderer.domElement.addEventListener('click', onClick, false);

let headlightOn = false;

//Hazard Function
let hazardBlinkState = false; // track on/off

function toggleHazardLights() {
    hazardActive = !hazardActive;

    if (hazardActive) {
        hazardInterval = setInterval(() => {
            hazardBlinkState = !hazardBlinkState;

            hazardLights.forEach(mesh => {
                const mat = mesh.material;

                // Save original emissive and intensity only once
                if (!mat.originalEmissive) {
                    mat.originalEmissive = mat.emissive.clone();
                    mat.originalIntensity = mat.emissiveIntensity ?? 5;
                }

                // Toggle emissive intensity and color
                if (hazardBlinkState) {
                    mat.emissive.set(0xfc8c03);      // bright yellow when blinking
                    mat.emissiveIntensity = .2;        // make it bright
                } else {
                    mat.emissive.copy(mat.originalEmissive);
                    mat.emissiveIntensity = mat.originalIntensity;
                }
            });
        }, 500);
    } else {
        clearInterval(hazardInterval);
        hazardInterval = null;
        hazardBlinkState = false;

        // Reset all lights
        hazardLights.forEach(mesh => {
            const mat = mesh.material;
            if (mat.originalEmissive) {
                mat.emissive.copy(mat.originalEmissive);
                mat.emissiveIntensity = mat.originalIntensity;
            }
        });
    }
}



console.log("Interactive Meshes:")
console.log(interactiveMeshes);



function onClick(event) {
    // Calculate mouse position normalized device coordinates (-1 to +1)
    const rect = renderer.domElement.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactiveMeshes);

    if (intersects.length > 0) {
        const openRotation = THREE.MathUtils.degToRad(50);
        const closeRotation = 0;
        const clickedMesh = intersects[0].object;

        console.log(clickedMesh);

        if (clickedMesh && clickedMesh.name === "hazard") {
            toggleHazardLights();
        }

        if (clickedMesh.name === "Driver-DoorExterior-Panel") {
            if (!doorOpen) {
                gsap.to(clickedMesh.rotation, {z: openRotation, duration: 1});
            } else {
                gsap.to(clickedMesh.rotation, {z: closeRotation, duration: 1});
            }
            doorOpen = !doorOpen;
        }

        if (clickedMesh.name === "headlight-switch") {
            headlightOn = !headlightOn;

            // Toggle bloom layer on headlights
            if (driverHeadlight) {
                if(headlightOn) {
                    driverHeadlight.layers.enable(BLOOM_LAYER);
                } else {
                    driverHeadlight.layers.disable(BLOOM_LAYER);
                }
            }
            if (passengerHeadlight) {
                if(headlightOn) {
                    passengerHeadlight.layers.enable(BLOOM_LAYER);
                } else {
                    passengerHeadlight.layers.disable(BLOOM_LAYER);
                }
            }

            // Toggle emissive color on headlights
            const emissiveColor = new THREE.Color(headlightOn ? 0xffffff : 0xffffff);

            console.log(driverHeadlightOGMat);
            if (driverHeadlight) {
                driverHeadlight.material.emissive = emissiveColor;
                driverHeadlight.material.emissiveIntensity = headlightOn ? 0.005 : 0;
                driverHeadlight.material.needsUpdate = true;
                //if(driverHeadlight) driverHeadlight.layers.set(BLOOM_LAYER);
                //if(passengerHeadlight) passengerHeadlight.layers.set(BLOOM_LAYER);
            }
            if (passengerHeadlight) {
                passengerHeadlight.material.emissive = emissiveColor;
                passengerHeadlight.material.emissiveIntensity = headlightOn ? 0.005 : 0;
                passengerHeadlight.material.needsUpdate = true;

            }


            if(headlightOn) {

                driverHeadlight.material = new THREE.MeshPhysicalMaterial({
                    color: 0xffffff,
                });

                passengerHeadlight.material = new THREE.MeshPhysicalMaterial({
                    color: 0xffffff,
                });

            } else {
                driverHeadlight.material = driverHeadlightOGMat;
                passengerHeadlight.material = passengerHeadlightOGMat;
            }

            // Toggle the spotlights ON/OFF
            if(driverSpotLight) driverSpotLight.visible = headlightOn;
            if(passengerSpotLight) passengerSpotLight.visible = headlightOn;
        }
    }
}


// Animate loop
function animate() {

    // only update orbit controls if not using device orientation
    if (!usingDeviceOrientation) {
        controls.update();
    }


    // Optionally update controls target or disable orbit control rotation here
    //controls.update();


    // Update spotlights to follow headlights and point forward
    if(driverSpotLight && driverHeadlight) {
        // Get world position of the headlight
        const headlightPos = driverHeadlight.getWorldPosition(new THREE.Vector3());

        // Get the forward direction in world space
        const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(driverHeadlight.getWorldQuaternion(new THREE.Quaternion()));

        // Move the spotlight a bit backward along that direction
        const spotlightPos = headlightPos.clone().add(forward.clone().multiplyScalar(-0.3)); // 0.5 units back

        driverSpotLight.position.copy(spotlightPos);

        // Target 15 units forward
        const targetPos = spotlightPos.clone().add(forward.clone().multiplyScalar(25));
        driverSpotLight.target.position.copy(targetPos);
        driverSpotLight.target.updateMatrixWorld();

        // Create helpers
        //const driverSpotLightHelper = new THREE.SpotLightHelper(driverSpotLight);
        //scene.add(driverSpotLightHelper);
    }

    if(passengerSpotLight && passengerHeadlight) {
        const headlightPos = passengerHeadlight.getWorldPosition(new THREE.Vector3());
        const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(passengerHeadlight.getWorldQuaternion(new THREE.Quaternion()));

        const spotlightPos = headlightPos.clone().add(forward.clone().multiplyScalar(-0.3)); // 0.5 units back
        passengerSpotLight.position.copy(spotlightPos);

        const targetPos = spotlightPos.clone().add(forward.clone().multiplyScalar(25));
        passengerSpotLight.target.position.copy(targetPos);
        passengerSpotLight.target.updateMatrixWorld();

        // Create helpers
        //const driverSpotLightHelper = new THREE.SpotLightHelper(passengerSpotLight);
        //scene.add(driverSpotLightHelper);
    }

    // Render with bloom
    // Render bloom only on bloom layer objects
    scene.traverse((obj) => {
        if (obj.isMesh) {
            obj.layers.set(0); // default layer
        }
    });


    composer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
