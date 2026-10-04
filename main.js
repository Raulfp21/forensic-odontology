import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------- SCENE ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 5000);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1;
controls.maxDistance = 200;

// ---------- LIGHTS ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(5, 10, 8);
scene.add(key);

const fill = new THREE.DirectionalLight(0x88bbff, 1.0);
fill.position.set(-8, 2, 5);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.8);
rim.position.set(0, -10, -5);
scene.add(rim);

// ---------- STATE ----------
const teeth = {};       // fdi -> { mesh, originalPos, data }
let dentalData = null;
let model = null;

// ---------- LOAD ----------
const loader = new GLTFLoader();

Promise.all([
  fetch('./data.json').then(r => r.json()),
  new Promise((res, rej) => loader.load('./models/anatomy.glb', res, undefined, rej))
]).then(([data, gltf]) => {
  dentalData = data;
  model = gltf.scene;
  scene.add(model);

  // Fit camera to model
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center); // center at origin

  const maxDim = Math.max(size.x, size.y, size.z);
  camera.position.set(0, maxDim * 0.2, maxDim * 1.8);
  controls.target.set(0, 0, 0);
  controls.update();

  // Traverse and find teeth
  model.traverse(child => {
    if (!child.isMesh) return;

    // Normalize: render as solid white/grey, no original materials
    child.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.05,
    });
    child.castShadow = true;
    child.receiveShadow = true;

    // Check for tooth_XX names
    const match = child.name.match(/^tooth_(\d{2})/);
    if (match) {
      const fdi = match[1];
      const info = dentalData.permanentTeeth[fdi];
      if (info) {
        teeth[fdi] = {
          mesh: child,
          originalPos: child.position.clone(),
          data: info,
        };
        // Push down into the jaw initially. Direction = -Y (world up = +Y).
        // Offset scale relative to model size:
        child.position.y = child.position.y - maxDim * 0.05;
      }
    }
  });

  console.log(`Loaded ${Object.keys(teeth).length} teeth`);
  document.getElementById('loading').classList.add('hidden');
  updateAge(0);
}).catch(err => {
  console.error(err);
  document.getElementById('loading').textContent = 'Error: ' + err.message;
});

// ---------- AGE LOGIC ----------
function updateAge(age) {
  document.getElementById('age-value').textContent = age.toFixed(1);

  let eruptedCount = 0;
  let lastErupted = null;

  for (const fdi in teeth) {
    const t = teeth[fdi];
    const erupt = t.data.eruption;

    // Progress 0..1 over a 1-year eruption window
    const progress = THREE.MathUtils.clamp(age - (erupt - 0.5), 0, 1);

    // Restore original position when fully erupted, push down when not
    const downOffset = -1.5; // in local model units, tuned visually
    t.mesh.position.y = t.originalPos.y + downOffset * (1 - progress);

    // Fade in via scale
    const s = 0.3 + 0.7 * progress;
    t.mesh.scale.setScalar(s);

    if (progress > 0) {
      eruptedCount++;
      lastErupted = t.data.name;
    }
  }

  const info = document.getElementById('tooth-info');
  if (eruptedCount === 0) {
    info.textContent = 'No teeth erupted';
  } else if (eruptedCount === Object.keys(teeth).length) {
    info.textContent = 'All teeth erupted';
  } else {
    info.textContent = `${eruptedCount} teeth present`;
  }
}

// ---------- SLIDER ----------
const slider = document.getElementById('ageSlider');
slider.addEventListener('input', e => updateAge(parseFloat(e.target.value)));

// ---------- RESIZE ----------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- LOOP ----------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
