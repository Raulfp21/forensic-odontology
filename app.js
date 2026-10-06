import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* ============================================================
   DATA — book values only (Fig 4.21 / Table 4.9 / Table 4.8).
   The book gives ONE range per tooth type, not per jaw.
   Rule 2 (lower erupts earlier) is a teaching note, not a
   shift to apply to the table.
   ============================================================ */
const PERMANENT = {
  '18': { name: 'Upper Right Third Molar',    range: [17, 25] },
  '17': { name: 'Upper Right Second Molar',   range: [12, 14] },
  '16': { name: 'Upper Right First Molar',    range: [6, 7] },
  '15': { name: 'Upper Right Second Premolar',range: [10, 12] },
  '14': { name: 'Upper Right First Premolar', range: [9, 11] },
  '13': { name: 'Upper Right Canine',         range: [11, 12] },
  '12': { name: 'Upper Right Lateral Incisor',range: [7, 9] },
  '11': { name: 'Upper Right Central Incisor',range: [6, 8] },
  '21': { name: 'Upper Left Central Incisor', range: [6, 8] },
  '22': { name: 'Upper Left Lateral Incisor', range: [7, 9] },
  '23': { name: 'Upper Left Canine',          range: [11, 12] },
  '24': { name: 'Upper Left First Premolar',  range: [9, 11] },
  '25': { name: 'Upper Left Second Premolar', range: [10, 12] },
  '26': { name: 'Upper Left First Molar',     range: [6, 7] },
  '27': { name: 'Upper Left Second Molar',    range: [12, 14] },
  '28': { name: 'Upper Left Third Molar',     range: [17, 25] },
  '48': { name: 'Lower Right Third Molar',    range: [17, 25] },
  '47': { name: 'Lower Right Second Molar',   range: [12, 14] },
  '46': { name: 'Lower Right First Molar',    range: [6, 7] },
  '45': { name: 'Lower Right Second Premolar',range: [10, 12] },
  '44': { name: 'Lower Right First Premolar', range: [9, 11] },
  '43': { name: 'Lower Right Canine',         range: [11, 12] },
  '42': { name: 'Lower Right Lateral Incisor',range: [7, 9] },
  '41': { name: 'Lower Right Central Incisor',range: [6, 8] },
  '31': { name: 'Lower Left Central Incisor', range: [6, 8] },
  '32': { name: 'Lower Left Lateral Incisor', range: [7, 9] },
  '33': { name: 'Lower Left Canine',          range: [11, 12] },
  '34': { name: 'Lower Left First Premolar',  range: [9, 11] },
  '35': { name: 'Lower Left Second Premolar', range: [10, 12] },
  '36': { name: 'Lower Left First Molar',     range: [6, 7] },
  '37': { name: 'Lower Left Second Molar',    range: [12, 14] },
  '38': { name: 'Lower Left Third Molar',     range: [17, 25] },
};

const DECIDUOUS = {
  '55': { name: 'Upper Right Deciduous Second Molar', range: [1.67, 2.5], fall: 11.0, replaces: null },
  '54': { name: 'Upper Right Deciduous First Molar',  range: [1.0, 1.17], fall: 9.5,  replaces: '14' },
  '53': { name: 'Upper Right Deciduous Canine',       range: [1.42, 1.5],  fall: 11.0, replaces: '13' },
  '52': { name: 'Upper Right Deciduous Lateral Incisor', range: [0.58, 0.75], fall: 7.0, replaces: '12' },
  '51': { name: 'Upper Right Deciduous Central Incisor', range: [0.58, 0.75], fall: 6.5, replaces: '11' },
  '61': { name: 'Upper Left Deciduous Central Incisor',  range: [0.58, 0.75], fall: 6.5, replaces: '21' },
  '62': { name: 'Upper Left Deciduous Lateral Incisor',  range: [0.58, 0.75], fall: 7.0, replaces: '22' },
  '63': { name: 'Upper Left Deciduous Canine',           range: [1.42, 1.5],  fall: 11.0, replaces: '23' },
  '64': { name: 'Upper Left Deciduous First Molar',      range: [1.0, 1.17], fall: 9.5, replaces: '24' },
  '65': { name: 'Upper Left Deciduous Second Molar',     range: [1.67, 2.5], fall: 11.0, replaces: null },
  '85': { name: 'Lower Right Deciduous Second Molar',    range: [1.67, 2.5], fall: 11.0, replaces: null },
  '84': { name: 'Lower Right Deciduous First Molar',     range: [1.0, 1.17], fall: 9.5, replaces: '44' },
  '83': { name: 'Lower Right Deciduous Canine',          range: [1.42, 1.5],  fall: 10.0, replaces: '43' },
  '82': { name: 'Lower Right Deciduous Lateral Incisor', range: [0.83, 1.0],  fall: 6.5, replaces: '42' },
  '81': { name: 'Lower Right Deciduous Central Incisor', range: [0.5, 0.67],  fall: 6.0, replaces: '41' },
  '71': { name: 'Lower Left Deciduous Central Incisor',  range: [0.5, 0.67],  fall: 6.0, replaces: '31' },
  '72': { name: 'Lower Left Deciduous Lateral Incisor',  range: [0.83, 1.0],  fall: 6.5, replaces: '32' },
  '73': { name: 'Lower Left Deciduous Canine',           range: [1.42, 1.5],  fall: 10.0, replaces: '33' },
  '74': { name: 'Lower Left Deciduous First Molar',      range: [1.0, 1.17], fall: 9.5, replaces: '34' },
  '75': { name: 'Lower Left Deciduous Second Molar',     range: [1.67, 2.5], fall: 11.0, replaces: null },
};

const ALL = { ...PERMANENT, ...DECIDUOUS };
const isDeciduous = fdi => '5678'.includes(fdi[0]);
const isUpper = fdi => '1256'.includes(fdi[0]);
const mid = r => (r[0] + r[1]) / 2;
const fmtYr = v => v < 2 ? `${Math.round(v * 12)} mo` : `${(+v.toFixed(1))} yr`;
const fmtRange = (lo, hi) => `${fmtYr(lo)} – ${fmtYr(hi)}`;

// Eruption is a point at the midpoint of the book range.
const emergence = fdi => mid(ALL[fdi].range);
function isPresent(fdi, age) {
  if (age < emergence(fdi)) return false;
  if (isDeciduous(fdi) && age >= ALL[fdi].fall) return false;
  return true;
}

/* Chart slots: each position holds deciduous + permanent (molar slots
   have no deciduous counterpart). The slot shows whichever is present. */
const SLOTS = {
  upperR: [['18'],['17'],['16'],['55','15'],['54','14'],['53','13'],['52','12'],['51','11']],
  upperL: [['61','21'],['62','22'],['63','23'],['64','24'],['65','25'],['26'],['27'],['28']],
  lowerL: [['71','31'],['72','32'],['73','33'],['74','34'],['75','35'],['36'],['37'],['38']],
  lowerR: [['48'],['47'],['46'],['85','45'],['84','44'],['83','43'],['82','42'],['81','41']],
};
function slotPresent(slot, age) {
  // deciduous first (so a child's tooth is named by its deciduous code)
  for (const f of slot) if (isPresent(f, age)) return f;
  return null;
}

function bookRule(fdi) {
  if (isDeciduous(fdi)) return 'Deciduous teeth erupt in a more regular sequence than the permanent set.';
  const n = fdi[1];
  if (n === '2') return 'Rule 1 exception: lateral incisors erupt earlier in the upper jaw.';
  if (n === '8') return 'Rule 3: wisdom teeth erupt first in the lower jaw, left before right.';
  if (isUpper(fdi)) return 'Rule 2: the corresponding lower tooth erupts about 1 year earlier, so this range is the upper limit of the pair.';
  return 'Rule 2: lower teeth erupt about 1 year before their upper counterparts.';
}

/* ============================================================
   SCENE
   ============================================================ */
const canvas = document.getElementById('jaw');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.0001, 100);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const kl = new THREE.DirectionalLight(0xffffff, 2);   kl.position.set(0.3, 0.5, 0.5); scene.add(kl);
const fl = new THREE.DirectionalLight(0xffe0b0, 1);   fl.position.set(-0.5, 0.1, 0.3); scene.add(fl);
const rl = new THREE.DirectionalLight(0xffffff, 0.8); rl.position.set(0, -0.5, -0.3); scene.add(rl);

const teeth = {};
let maxDim = 0.15;
let model3D = null;

function loadModel() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);
    loader.load('models/anatomy_v12_draco.glb', gltf => {
      model3D = gltf.scene;
      scene.add(model3D);
      const box = new THREE.Box3().setFromObject(model3D);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      model3D.position.sub(centre);
      maxDim = Math.max(size.x, size.y, size.z);
      camera.position.set(0, maxDim * 0.1, maxDim * 1.6);
      controls.target.set(0, 0, 0);
      controls.update();

      model3D.traverse(o => {
        if (!o.isMesh) return;
        let a = o, group = '';
        while (a) {
          if (/^tooth_[5-8]\d$/.test(a.name) || /^tooth_\d{2}$/.test(a.name) ||
              /^(Maxill|Mandib)/.test(a.name)) { group = a.name; break; }
          a = a.parent;
        }
        const isTooth = /^tooth_\d{2}$/.test(group);
        const isDec   = /^tooth_[5-8]\d$/.test(group);
        const isBone  = /^(Maxill|Mandib)/.test(group);
        o.material = new THREE.MeshStandardMaterial({
          color: isDec ? 0xffffff : (isTooth ? 0xf0e8cc : (isBone ? 0xd9c79a : 0x888888)),
          roughness: isTooth ? 0.4 : 0.85,
          metalness: 0.02,
          emissive: 0x000000,
        });
      });
      model3D.traverse(o => {
        const m = o.name.match(/^tooth_(\d{2})$/);
        if (!m) return;
        const fdi = m[1];
        if (!ALL[fdi]) return;
        teeth[fdi] = { group: o, data: ALL[fdi] };
      });
      resolve();
    }, undefined, reject);
  });
}

/* ============================================================
   AGE
   ============================================================ */
let currentAge = 0;
const ageLabel = document.getElementById('age-label');
const ageSlider = document.getElementById('age-slider');
function renderAge(age) {
  currentAge = Math.max(0, Math.min(25, +(+age).toFixed(1)));
  ageLabel.textContent = currentAge.toFixed(1);
  ageSlider.value = currentAge;
  for (const fdi in teeth) {
    const p = isPresent(fdi, currentAge);
    teeth[fdi].group.visible = p;
    teeth[fdi].group.scale.setScalar(1);
  }
  // refresh fdi grid dim/present classes
  document.querySelectorAll('.fdi-cell').forEach(c => {
    const fdi = c.dataset.fdi;
    c.classList.toggle('present', isPresent(fdi, currentAge));
    c.classList.toggle('absent', !isPresent(fdi, currentAge));
  });
  // if info is showing, refresh the "on the jaw at" line
  const shownFdi = document.getElementById('info').dataset.fdi;
  if (shownFdi) showInfo(shownFdi);
}

/* ============================================================
   HIGHLIGHT
   ============================================================ */
function highlight(fdi) {
  const t = teeth[fdi];
  if (!t) return;
  t.group.traverse(o => {
    if (!o.isMesh) return;
    o.material.emissive = new THREE.Color(0x4ade80);
    o.material.emissiveIntensity = 1.2;
  });
}
function clearHighlight(fdi) {
  const t = teeth[fdi];
  if (!t) return;
  t.group.traverse(o => {
    if (o.isMesh) { o.material.emissive = new THREE.Color(0x000000); o.material.emissiveIntensity = 1; }
  });
}
function clearAllHighlights() { for (const fdi in teeth) clearHighlight(fdi); }

/* ============================================================
   TABS
   ============================================================ */
const panels = {
  learn:    document.getElementById('learn-panel'),
  practice: document.getElementById('practice-panel'),
  test:     document.getElementById('test-panel'),
};
let activeTab = 'learn';
function switchTab(name) {
  activeTab = name;
  for (const k in panels) panels[k].classList.toggle('hidden', k !== name);
  document.querySelectorAll('#tabs button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));
  clearAllHighlights();
  canvas.style.opacity = (name === 'test') ? '0.12' : '1';
  if (name === 'learn') document.getElementById('info').dataset.fdi = '';
  if (name === 'practice') startPractice();
  if (name === 'test')     startTest();
}
document.querySelectorAll('#tabs button').forEach(b =>
  b.addEventListener('click', () => switchTab(b.dataset.tab)));

/* ============================================================
   LEARN
   ============================================================ */
function buildFdiGrid() {
  const host = document.getElementById('fdi-grid');
  host.innerHTML = '';
  const rows = [
    ['18','17','16','15','14','13','12','11', null, '21','22','23','24','25','26','27','28'],
    ['48','47','46','45','44','43','42','41', null, '31','32','33','34','35','36','37','38'],
  ];
  rows.forEach(list => {
    const row = document.createElement('div');
    row.className = 'fdi-row';
    list.forEach(fdi => {
      if (fdi === null) { const g = document.createElement('div'); g.style.width='12px'; row.appendChild(g); return; }
      const b = document.createElement('button');
      b.className = 'fdi-cell';
      b.dataset.fdi = fdi;
      b.textContent = fdi;
      b.addEventListener('click', () => onFdiPick(fdi, b));
      row.appendChild(b);
    });
    host.appendChild(row);
  });
}

function onFdiPick(fdi, btn) {
  document.querySelectorAll('.fdi-cell').forEach(x => x.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  clearAllHighlights();
  // if the tooth is not yet erupted, advance the slider to its range start
  if (!isPresent(fdi, currentAge) && !isDeciduous(fdi)) {
    renderAge(ALL[fdi].range[0]);
  }
  highlight(fdi);
  showInfo(fdi);
}

function showInfo(fdi) {
  const d = ALL[fdi];
  const present = isPresent(fdi, currentAge);
  const presentTxt = present ? 'present on the jaw'
    : (isDeciduous(fdi)
      ? `shed (before ${fmtYr(d.fall)})`
      : `not yet erupted (expect from ${fmtYr(d.range[0])})`);
  document.getElementById('info').dataset.fdi = fdi;
  document.getElementById('info').innerHTML = `
    <div><span class="code">${fdi}</span> <span class="name">${d.name}</span></div>
    <div class="row"><b>Eruption range:</b> ${fmtRange(d.range[0], d.range[1])}</div>
    ${isDeciduous(fdi) ? `<div class="row"><b>Sheds around:</b> ${fmtYr(d.fall)}</div>` : ''}
    <div class="row"><b>At age ${currentAge.toFixed(1)}:</b> ${presentTxt}</div>
    <div class="rule">${bookRule(fdi)}</div>`;
}

function stepAge(delta) { renderAge(currentAge + delta); }
document.getElementById('age-minus').addEventListener('click', () => stepAge(-0.5));
document.getElementById('age-plus').addEventListener('click',  () => stepAge(0.5));
ageSlider.addEventListener('input', e => renderAge(parseFloat(e.target.value)));

// ---- Tap the 3D jaw ----
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', e => {
  if (activeTab !== 'learn') return;
  ndc.x = (e.clientX / innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const hit of hits) {
    let a = hit.object;
    while (a) {
      const m = a.name.match(/^tooth_(\d{2})$/);
      if (m && teeth[m[1]]) {
        onFdiPick(m[1], document.querySelector(`.fdi-cell[data-fdi="${m[1]}"]`));
        return;
      }
      a = a.parent;
    }
  }
});

/* ============================================================
   PRACTICE
   ============================================================ */
let P = null;
function startPractice() {
  const age = pickRandomAge();
  renderAge(age);
  P = { age, last: null, next: null };
  renderPractice();
}
function pickRandomAge() {
  const w = [[0.5, 2.5], [5, 9], [9, 13], [16, 22]];
  const [lo, hi] = w[Math.floor(Math.random() * w.length)];
  return +(lo + Math.random() * (hi - lo)).toFixed(1);
}
function presentTeeth(age) { return Object.keys(ALL).filter(f => isPresent(f, age)); }
function pendingTeeth(age) { return Object.keys(ALL).filter(f => emergence(f) > age); }

function defensibleBand(age) {
  const present = presentTeeth(age);
  const pending = pendingTeeth(age);
  if (!present.length) {
    const p = pending.sort((a,b) => emergence(a) - emergence(b))[0];
    return { lo: 0, hi: ALL[p].range[1], last: [], next: [p], open: false };
  }
  const maxE = Math.max(...present.map(emergence));
  const last = present.filter(f => Math.abs(emergence(f) - maxE) < 1e-9);
  const lo = Math.min(...last.map(f => ALL[f].range[0]));
  if (!pending.length) return { lo, hi: null, last, next: [], open: true };
  const minE = Math.min(...pending.map(emergence));
  const next = pending.filter(f => Math.abs(emergence(f) - minE) < 1e-9);
  const hi = Math.max(...next.map(f => ALL[f].range[1]));
  return { lo, hi, last, next, open: false };
}

function renderPractice() {
  const host = document.getElementById('practice-content');
  const age = P.age;
  const present = presentTeeth(age);
  const pending = pendingTeeth(age);
  const b = defensibleBand(age);
  const lastShown = b.last.join(', ') || '—';
  const nextShown = b.next.join(', ') || '—';
  host.innerHTML = `
    <div class="step">
      <h3>Step 1 · Look at the jaw</h3>
      <p>Count the deciduous and permanent teeth. Which tooth appears to be the most recent arrival?</p>
      <div class="fdi-pick" id="pick-last">
        ${present.map(f => `<button data-fdi="${f}" ${P.last===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
    </div>
    ${P.last ? `
    <div class="step">
      <h3>Step 2 · Range for ${P.last}</h3>
      <p>${ALL[P.last].name} erupts between <b>${fmtRange(...ALL[P.last].range)}</b>.</p>
      <p>Because it is present, the age is at least <b>${fmtYr(ALL[P.last].range[0])}</b>.</p>
    </div>` : ''}
    ${P.last ? `
    <div class="step">
      <h3>Step 3 · Which tooth is next due?</h3>
      <p>Among the FDI codes not on the jaw, which one erupts earliest in the book order?</p>
      <div class="fdi-pick" id="pick-next">
        ${pending.map(f => `<button data-fdi="${f}" ${P.next===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
    </div>` : ''}
    ${P.next ? `
    <div class="step">
      <h3>Step 4 · Range for ${P.next}</h3>
      <p>${ALL[P.next].name} erupts between <b>${fmtRange(...ALL[P.next].range)}</b>.</p>
      <p>Because it is not yet present, the age is at most <b>${fmtYr(ALL[P.next].range[1])}</b>.</p>
    </div>
    <div class="step">
      <h3>Step 5 · Report the range</h3>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">
        <label style="color:#888;font-size:0.8em">Between</label>
        <input type="number" step="0.5" id="p-lo">
        <label style="color:#888;font-size:0.8em">and</label>
        <input type="number" step="0.5" id="p-hi">
        <label style="color:#888;font-size:0.8em">yr</label>
      </div>
      <button class="primary" id="p-reveal">Reveal</button>
    </div>` : ''}
    <div id="practice-result"></div>`;

  host.querySelectorAll('#pick-last button').forEach(x =>
    x.onclick = () => { P.last = x.dataset.fdi; P.next = null; renderPractice(); });
  host.querySelectorAll('#pick-next button').forEach(x =>
    x.onclick = () => { P.next = x.dataset.fdi; renderPractice(); });
  const rev = host.querySelector('#p-reveal');
  if (rev) rev.onclick = () => {
    const lo = parseFloat(host.querySelector('#p-lo').value);
    const hi = parseFloat(host.querySelector('#p-hi').value);
    const trueRange = b.open ? `≥ ${fmtYr(b.lo)}` : fmtRange(b.lo, b.hi);
    const ok = b.open
      ? (Math.abs(lo - b.lo) <= 1)
      : (lo <= b.lo + 1 && hi >= b.hi - 1 && (hi - lo) <= (b.hi - b.lo) + 2);
    host.querySelector('#practice-result').innerHTML = `
      <div class="result">
        <div><b>Defensible answer:</b> <span class="range">${trueRange}</span></div>
        <div>${ok ? '<span class="ok">Correct.</span>' : '<span class="near">Compare your range with the band above.</span>'}</div>
        <div style="margin-top:8px;color:#888;font-size:0.9em">
          Last erupted: <b>${lastShown}</b>. Next due: <b>${nextShown}</b>.
        </div>
      </div>`;
  };
}

/* ============================================================
   TEST — chart + forced reasoning
   ============================================================ */
let T = null;
function startTest() {
  T = { round: 0, score: 0, total: 10, age: null, last: null, next: null };
  nextTestRound();
}
function nextTestRound() {
  if (T.round >= T.total) return testSummary();
  T.round++;
  T.age = pickRandomAge();
  T.last = null; T.next = null;
  renderTest();
}

function renderTest() {
  const host = document.getElementById('test-content');
  const age = T.age;
  const row = (slots) => slots.map(slot => {
    const f = slotPresent(slot, age);
    return `<div class="cell ${f ? 'present' : ''}">${f || ''}</div>`;
  }).join('');
  const chart = `
    <div class="row">${row(SLOTS.upperR)}<div style="width:14px"></div>${row(SLOTS.upperL)}</div>
    <div class="row">${row(SLOTS.lowerR)}<div style="width:14px"></div>${row(SLOTS.lowerL)}</div>`;

  const present = presentTeeth(age);
  const pending = pendingTeeth(age);
  const b = defensibleBand(age);

  host.innerHTML = `
    <div style="font-size:0.8em;color:#bbb;margin-bottom:6px">
      <b style="color:#4ade80">Round ${T.round} of ${T.total}</b> · Score ${T.score}
    </div>
    <p style="font-size:0.78em;color:#bbb;line-height:1.45;margin:0 0 8px">
      Dental chart. Green cells show the FDI of teeth present; blank cells mean absent.
      Give a defensible age range and the reason.
    </p>
    <div class="chart">${chart}</div>
    <div class="step" style="border-top:none">
      <h3>Last erupted (FDI)</h3>
      <div class="fdi-pick" id="pick-last">
        ${present.map(f => `<button data-fdi="${f}" ${T.last===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
      <h3 style="margin-top:10px">Next due (FDI)</h3>
      <div class="fdi-pick" id="pick-next">
        ${pending.map(f => `<button data-fdi="${f}" ${T.next===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
      <h3 style="margin-top:10px">Your age range</h3>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">
        <label style="color:#888;font-size:0.8em">Between</label>
        <input type="number" step="0.5" id="t-lo">
        <label style="color:#888;font-size:0.8em">and</label>
        <input type="number" step="0.5" id="t-hi">
        <label style="color:#888;font-size:0.8em">yr</label>
      </div>
      <p style="font-size:0.75em;color:#888;margin:6px 0 0">
        If no tooth is next due, leave the second box blank — the answer is then only a minimum.
      </p>
      <button class="primary" id="t-submit">Submit</button>
    </div>
    <div id="test-result"></div>`;

  host.querySelectorAll('#pick-last button').forEach(x =>
    x.onclick = () => { T.last = x.dataset.fdi; renderTest(); });
  host.querySelectorAll('#pick-next button').forEach(x =>
    x.onclick = () => { T.next = x.dataset.fdi; renderTest(); });
  host.querySelector('#t-submit').onclick = submitTest;
}

function submitTest() {
  const host = document.getElementById('test-result');
  const loRaw = document.getElementById('t-lo').value.trim();
  const hiRaw = document.getElementById('t-hi').value.trim();
  const lo = loRaw === '' ? null : parseFloat(loRaw);
  const hi = hiRaw === '' ? null : parseFloat(hiRaw);
  if (lo === null && hi === null) { host.innerHTML = `<div class="result"><span class="no">Enter a range.</span></div>`; return; }

  const b = defensibleBand(T.age);
  const trueRange = b.open ? `≥ ${fmtYr(b.lo)}` : fmtRange(b.lo, b.hi);

  let rangeOK = false;
  if (b.open) {
    const hiOK = (hi === null || hi >= b.lo + 5);
    const loOK = (lo !== null && Math.abs(lo - b.lo) <= 1);
    rangeOK = loOK && hiOK;
  } else {
    const loOK = (lo !== null && lo <= b.lo + 1 && lo >= b.lo - 2);
    const hiOK = (hi !== null && hi >= b.hi - 1 && hi <= b.hi + 2);
    rangeOK = loOK && hiOK;
  }
  const lastOK = b.last.length === 0 || b.last.includes(T.last);
  const nextOK = b.next.length === 0 || b.next.includes(T.next);
  const full = rangeOK && lastOK && nextOK;
  if (full) T.score++;

  host.innerHTML = `
    <div class="result">
      <div>${full ? '<span class="ok">Correct.</span>' : '<span class="no">Not quite.</span>'}</div>
      <div style="margin-top:6px"><b>Defensible answer:</b> <span class="range">${trueRange}</span></div>
      <div style="margin-top:6px;color:#aaa;font-size:0.9em">
        <b>Last erupted:</b> ${b.last.join(', ') || '—'} — you said ${T.last || '—'}<br>
        <b>Next due:</b> ${b.next.join(', ') || '—'} — you said ${T.next || '—'}
      </div>
      <button class="primary" id="t-next" style="margin-top:10px">Next chart</button>
    </div>`;
  host.querySelector('#t-next').onclick = nextTestRound;
}

function testSummary() {
  const host = document.getElementById('test-content');
  const pct = Math.round(100 * T.score / T.total);
  host.innerHTML = `
    <div class="result" style="border-color:#4ade80">
      <div style="font-size:1.15em"><b>Score ${T.score} / ${T.total} (${pct}%)</b></div>
      <button class="primary" id="t-restart" style="margin-top:12px">Try again</button>
    </div>`;
  host.querySelector('#t-restart').onclick = startTest;
}

/* ============================================================
   BOOT
   ============================================================ */
loadModel().then(() => {
  buildFdiGrid();
  renderAge(0);
  (function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}).catch(err => {
  console.error(err);
  document.getElementById('info').innerHTML =
    `<span style="color:#f87171">Failed to load model: ${err.message}</span>`;
});
