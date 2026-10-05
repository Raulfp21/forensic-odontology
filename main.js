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

scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const k = new THREE.DirectionalLight(0xffffff, 2); k.position.set(0.3, 0.5, 0.5); scene.add(k);
const f = new THREE.DirectionalLight(0xffe0b0, 1.0); f.position.set(-0.5, 0.1, 0.3); scene.add(f);
const r = new THREE.DirectionalLight(0xffffff, 0.8); r.position.set(0, -0.5, -0.3); scene.add(r);

const deciduous = {};
const permanent = {};
const wisdom = {};
let dentalData = null;
let frontView = null;
let maxDim = 0.15;

// Per-tooth Y offset (in model units) to sink deciduous roots into the socket
// Positive = push up (into maxilla for upper, into mandible for lower)
// Tune these after viewing
const DECIDUOUS_SOCKET_OFFSET = {
  // upper
  '51': 0, '61': 0, '52': 0, '62': 0, '53': 0, '63': 0,
  '54': 0, '64': 0, '55': 0, '65': 0,
  // lower — push down slightly so roots stay inside mandible
  '71': 0, '81': 0, '72': 0, '82': 0, '73': 0, '83': 0,
  '74': 0, '84': 0, '75': 0, '85': 0,
};

const loader = new GLTFLoader();
Promise.all([
  fetch('./data.json').then(r => r.json()),
  new Promise((res, rej) => loader.load('./models/anatomy.glb', res, rej))
]).then(([d, gltf]) => {
  dentalData = d;
  const model = gltf.scene;
  scene.add(model);

  // ----- ROBUST molar-shell fix -----
  // Find any object whose name starts with tooth_36 or tooth_46 and hide extra children
  ['36', '46'].forEach(fdi => {
    let parent = null;
    model.traverse(o => {
      if (!parent && o.name === `tooth_${fdi}`) parent = o;
    });
    if (!parent) {
      console.warn(`Could not find tooth_${fdi} group`);
      return;
    }
    const meshes = [];
    parent.traverse(o => { if (o.isMesh) meshes.push(o); });
    // Keep the largest mesh, hide the rest
    meshes.sort((a, b) =>
      (b.geometry.attributes.position.count) - (a.geometry.attributes.position.count));
    for (let i = 1; i < meshes.length; i++) {
      meshes[i].visible = false;
    }
    console.log(`tooth_${fdi}: hid ${Math.max(0, meshes.length - 1)} extra shells`);
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  maxDim = Math.max(size.x, size.y, size.z);

  frontView = {
    cam: new THREE.Vector3(0, maxDim * 0.05, maxDim * 1.4),
    target: new THREE.Vector3(0, 0, 0),
  };
  camera.position.copy(frontView.cam);
  controls.target.copy(frontView.target);
  controls.update();

  // ----- Textbook colours -----
  // Deciduous: chalky opaque white (bluish)
  // Permanent: warmer ivory
  // Bone: yellow-ivory
  model.traverse(o => {
    if (!o.isMesh || o.visible === false) return;

    let ancestor = o, groupName = '';
    while (ancestor) {
      if (/^tooth_[5-8]\d$/.test(ancestor.name)) { groupName = ancestor.name; break; }
      if (/^tooth_\d{2}$/.test(ancestor.name)) { groupName = ancestor.name; break; }
      if (['Mandible','Maxilla','Maxilla.l','Maxilla.r'].includes(ancestor.name)) {
        groupName = ancestor.name; break;
      }
      ancestor = ancestor.parent;
    }

    const isDeciduous = /^tooth_[5-8]\d$/.test(groupName);
    const isPermanent = /^tooth_\d{2}$/.test(groupName);
    const isBone = ['Mandible','Maxilla','Maxilla.l','Maxilla.r'].includes(groupName);

    let color, roughness, emissive;
    if (isDeciduous) {
      color = 0xffffff;       // chalky pure white
      roughness = 0.55;
      emissive = 0x0a0a0a;
    } else if (isPermanent) {
      color = 0xf0e8cc;       // warm ivory / yellowish
      roughness = 0.30;
      emissive = 0x050505;
    } else if (isBone) {
      color = 0xc9b478;       // deeper bone tan
      roughness = 0.85;
      emissive = 0x000000;
    } else {
      color = 0xaaaaaa; roughness = 0.6; emissive = 0x000000;
    }

    o.material = new THREE.MeshStandardMaterial({
      color, roughness, metalness: 0.02, emissive,
    });
  });

  // ----- Register all teeth -----
  model.traverse(o => {
    const m = o.name.match(/^tooth_(\d{2})$/);
    if (!m) return;
    const fdi = m[1];

    if (dentalData.deciduousTeeth[fdi]) {
      deciduous[fdi] = {
        group: o,
        data: dentalData.deciduousTeeth[fdi],
        baseY: o.position.y,
      };
    } else if (dentalData.permanentTeeth[fdi]) {
      permanent[fdi] = {
        group: o,
        data: dentalData.permanentTeeth[fdi],
        baseY: o.position.y,
      };
    }
  });

  // Wisdom clones
  const wisdomSources = { '38': '37', '48': '47', '18': '17', '28': '27' };
  for (const fdi in dentalData.thirdMolars) {
    const src = permanent[wisdomSources[fdi]];
    if (!src) continue;
    const clone = src.group.clone(true);
    clone.name = `tooth_${fdi}`;
    clone.position.x += (fdi === '28' || fdi === '38' ? 1 : -1) * maxDim * 0.008;
    clone.position.y += (fdi === '18' || fdi === '28' ? -1 : 1) * maxDim * 0.005;
    clone.position.z -= maxDim * 0.13;
    clone.scale.multiplyScalar(0.75);
    src.group.parent.add(clone);
    wisdom[fdi] = { group: clone, data: dentalData.thirdMolars[fdi], baseScale: 0.75 };
  }

  for (const fdi in deciduous) deciduous[fdi].group.visible = false;
  for (const fdi in permanent) permanent[fdi].group.visible = false;
  for (const fdi in wisdom) wisdom[fdi].group.visible = false;

  console.log(`Loaded ${Object.keys(deciduous).length} deciduous, ${Object.keys(permanent).length} permanent, ${Object.keys(wisdom).length} wisdom`);
  document.getElementById('loading').classList.add('hidden');
  updateAge(0);
}).catch(e => {
  console.error(e);
  document.getElementById('loading').textContent = 'Error: ' + e.message;
});

function updateAge(age) {
  document.getElementById('age-value').textContent = age.toFixed(1);
  let d = 0, p = 0, w = 0;

  for (const fdi in deciduous) {
    const t = deciduous[fdi];
    const start = t.data.eruption, end = t.data.fall;
    if (age < start || age >= end + 0.5) {
      t.group.visible = false;
      t.group.position.y = t.baseY;
      t.group.scale.setScalar(1);
      continue;
    }
    let s = 1;
    if (age < start + 0.5) s = 0.4 + 1.2 * (age - start);
    else if (age > end - 1.0) s = Math.max(0.1, 1.0 - (age - (end - 1.0)));
    t.group.visible = true;
    t.group.scale.setScalar(s);
    // Socket offset — for now zero; tune per tooth if needed
    const off = DECIDUOUS_SOCKET_OFFSET[fdi] || 0;
    // Push up for upper (into maxilla), down for lower (into mandible)
    const isUpper = /^[56]/.test(fdi);
    t.group.position.y = t.baseY + (isUpper ? 1 : -1) * off * maxDim;
    d++;
  }

  for (const fdi in permanent) {
    const t = permanent[fdi];
    if (age < t.data.eruption) { t.group.visible = false; t.group.scale.setScalar(1); continue; }
    const pp = THREE.MathUtils.clamp((age - t.data.eruption) / 0.6, 0, 1);
    t.group.visible = true;
    t.group.scale.setScalar(0.4 + 0.6 * pp);
    p++;
  }

  for (const fdi in wisdom) {
    const t = wisdom[fdi];
    if (age < t.data.eruption) { t.group.visible = false; t.group.scale.setScalar(t.baseScale); continue; }
    const pp = THREE.MathUtils.clamp((age - t.data.eruption) / 0.6, 0, 1);
    t.group.visible = true;
    t.group.scale.setScalar(t.baseScale * (0.4 + 0.6 * pp));
    w++;
  }

  const info = document.getElementById('tooth-info');
  if (age < 0.5) info.textContent = 'No teeth';
  else info.textContent = `${d} deciduous · ${p} permanent · ${w} wisdom`;
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
