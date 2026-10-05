import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.0001, 100);
camera.position.set(0, 0, 0.25);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.05;
controls.maxDistance = 1;

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const k = new THREE.DirectionalLight(0xffffff, 2); k.position.set(0.3, 0.5, 0.5); scene.add(k);
const f = new THREE.DirectionalLight(0xffe0b0, 1.0); f.position.set(-0.5, 0.1, 0.3); scene.add(f);
const r = new THREE.DirectionalLight(0xffffff, 0.8); r.position.set(0, -0.5, -0.3); scene.add(r);

const deciduous = {};
const permanent = {};
const wisdom = {};
let dentalData = null;
let frontView = null;

const loader = new GLTFLoader();
Promise.all([
  fetch('./data.json').then(r => r.json()),
  new Promise((res, rej) => loader.load('./models/anatomy.glb', res, undefined, rej))
]).then(([d, gltf]) => {
  dentalData = d;
  const model = gltf.scene;
  scene.add(model);

  // Hide extra shells on molar glitch
  ['tooth_36', 'tooth_46'].forEach(name => {
    const g = model.getObjectByName(name);
    if (!g) return;
    const meshes = g.children.filter(c => c.isMesh);
    for (let i = 1; i < meshes.length; i++) meshes[i].visible = false;
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);

  frontView = {
    cam: new THREE.Vector3(0, maxDim * 0.05, maxDim * 1.4),
    target: new THREE.Vector3(0, 0, 0),
  };
  camera.position.copy(frontView.cam);
  controls.target.copy(frontView.target);
  controls.update();

  // Materials
  model.traverse(o => {
    if (!o.isMesh) return;
    let ancestor = o, groupName = '';
    while (ancestor) {
      if (/^tooth_\d{2}$/.test(ancestor.name) ||
          ['Mandible','Maxilla','Maxilla.l','Maxilla.r'].includes(ancestor.name)) {
        groupName = ancestor.name; break;
      }
      ancestor = ancestor.parent;
    }
    const isTooth = /^tooth_\d{2}$/.test(groupName);
    const isDeciduous = isTooth && /^tooth_[5-8]\d$/.test(groupName);
    // Deciduous slightly creamier to differentiate
    const color = isDeciduous ? 0xf5efd8 : (isTooth ? 0xfafaf5 : 0xd9c79a);
    o.material = new THREE.MeshStandardMaterial({
      color,
      roughness: isTooth ? 0.4 : 0.85,
      metalness: 0.02,
      emissive: isTooth ? 0x101010 : 0x000000,
    });
  });

  // Register teeth
  model.traverse(o => {
    const m = o.name.match(/^tooth_(\d{2})$/);
    if (!m) return;
    const fdi = m[1];

    if (dentalData.deciduousTeeth[fdi]) {
      deciduous[fdi] = { group: o, data: dentalData.deciduousTeeth[fdi] };
    } else if (dentalData.permanentTeeth[fdi]) {
      permanent[fdi] = { group: o, data: dentalData.permanentTeeth[fdi] };
    }
  });

  // Create wisdom teeth from clones of 2nd molars
  const wisdomSources = { '38':'37', '48':'47', '18':'17', '28':'27' };
  for (const fdi in dentalData.thirdMolars) {
    const srcFdi = wisdomSources[fdi];
    const src = permanent[srcFdi];
    if (!src) continue;
    const clone = src.group.clone(true);
    clone.name = `tooth_${fdi}`;
    const posterior = maxDim * 0.13;
    const sideDir = (fdi === '28' || fdi === '38') ? 1 : -1;
    const upDir = (fdi === '18' || fdi === '28') ? -1 : 1;
    clone.position.x += sideDir * maxDim * 0.008;
    clone.position.y += upDir * maxDim * 0.005;
    clone.position.z -= posterior;
    clone.scale.multiplyScalar(0.75);
    src.group.parent.add(clone);
    wisdom[fdi] = {
      group: clone,
      data: dentalData.thirdMolars[fdi],
      baseScale: 0.75,
    };
  }

  // Hide all initially
  for (const fdi in deciduous) deciduous[fdi].group.visible = false;
  for (const fdi in permanent) permanent[fdi].group.visible = false;
  for (const fdi in wisdom) wisdom[fdi].group.visible = false;

  console.log(`Deciduous: ${Object.keys(deciduous).length}`);
  console.log(`Permanent: ${Object.keys(permanent).length}`);
  console.log(`Wisdom: ${Object.keys(wisdom).length}`);

  document.getElementById('loading').classList.add('hidden');
  updateAge(0);
}).catch(e => {
  document.getElementById('loading').textContent = 'Error: ' + e.message;
});

function updateAge(age) {
  document.getElementById('age-value').textContent = age.toFixed(1);
  let dCount = 0, pCount = 0, wCount = 0;

  // Deciduous: appear, exist, resorb, vanish
  for (const fdi in deciduous) {
    const t = deciduous[fdi];
    const start = t.data.eruption;
    const end = t.data.fall;
    if (age < start || age >= end + 0.5) {
      t.group.visible = false;
      t.group.scale.setScalar(1);
      continue;
    }
    // Scale: grow in over 0.5y, resorb in last 1y
    let s = 1;
    if (age < start + 0.5) s = 0.4 + 1.2 * (age - start);
    else if (age > end - 1.0) s = Math.max(0.1, 1.0 - (age - (end - 1.0)));
    t.group.visible = true;
    t.group.scale.setScalar(s);
    dCount++;
  }

  // Permanent: appear, stay
  for (const fdi in permanent) {
    const t = permanent[fdi];
    if (age < t.data.eruption) {
      t.group.visible = false;
      t.group.scale.setScalar(1);
      continue;
    }
    const p = THREE.MathUtils.clamp((age - t.data.eruption) / 0.6, 0, 1);
    t.group.visible = true;
    t.group.scale.setScalar(0.4 + 0.6 * p);
    pCount++;
  }

  // Wisdom
  for (const fdi in wisdom) {
    const t = wisdom[fdi];
    if (age < t.data.eruption) {
      t.group.visible = false;
      t.group.scale.setScalar(t.baseScale);
      continue;
    }
    const p = THREE.MathUtils.clamp((age - t.data.eruption) / 0.6, 0, 1);
    t.group.visible = true;
    t.group.scale.setScalar(t.baseScale * (0.4 + 0.6 * p));
    wCount++;
  }

  const total = dCount + pCount + wCount;
  const info = document.getElementById('tooth-info');
  if (age < 0.5) info.textContent = 'No teeth';
  else info.textContent = `${dCount} deciduous · ${pCount} permanent · ${wCount} wisdom`;
}

document.getElementById('ageSlider')
  .addEventListener('input', e => updateAge(parseFloat(e.target.value)));

window.resetView = function () {
  if (!frontView) return;
  camera.position.copy(frontView.cam);
  controls.target.copy(frontView.target);
  controls.update();
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
})();
