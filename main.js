import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(5, 10, 8);
scene.add(key);
const fill = new THREE.DirectionalLight(0x88bbff, 1.0);
fill.position.set(-8, 2, 5);
scene.add(fill);

const loader = new GLTFLoader();
loader.load('./models/anatomy.glb', gltf => {
  const model = gltf.scene;
  scene.add(model);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  camera.position.set(0, maxDim * 0.1, maxDim * 1.8);
  controls.target.set(0, 0, 0);
  controls.update();

  // --- DIAGNOSTIC ---
  const names = [];
  model.traverse(obj => {
    const parentName = obj.parent ? obj.parent.name : '-';
    names.push(`${obj.type} | name: "${obj.name}" | parent: "${parentName}"`);
    if (obj.isMesh) {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.5, metalness: 0.05,
      });
    }
  });

  const dbg = document.getElementById('loading');
  dbg.classList.remove('hidden');
  dbg.style.cssText = `
    position:absolute;inset:0;background:#0a0a0a;color:#eee;
    font:11px monospace;overflow:auto;padding:10px;
    white-space:pre-wrap;z-index:999;
  `;
  dbg.textContent = `Model size: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}\n\n` + names.join('\n');

  console.log('Diagnostic — full object list above');
}, undefined, err => {
  console.error(err);
  document.getElementById('loading').textContent = 'Error: ' + err.message;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

(function loop(){ requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();
