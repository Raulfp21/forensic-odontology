import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* ============================================================
   DATA — Table 4.9 with rule 2 applied (lower ~1 yr earlier,
   except lateral incisors).  Table 4.8 for deciduous.
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
  '47': { name: 'Lower Right Second Molar',   range: [11, 13] },
  '46': { name: 'Lower Right First Molar',    range: [6, 7] },
  '45': { name: 'Lower Right Second Premolar',range: [9, 11] },
  '44': { name: 'Lower Right First Premolar', range: [8, 10] },
  '43': { name: 'Lower Right Canine',         range: [10, 11] },
  '42': { name: 'Lower Right Lateral Incisor',range: [7, 9] },
  '41': { name: 'Lower Right Central Incisor',range: [5, 7] },
  '31': { name: 'Lower Left Central Incisor', range: [5, 7] },
  '32': { name: 'Lower Left Lateral Incisor', range: [7, 9] },
  '33': { name: 'Lower Left Canine',          range: [10, 11] },
  '34': { name: 'Lower Left First Premolar',  range: [8, 10] },
  '35': { name: 'Lower Left Second Premolar', range: [9, 11] },
  '36': { name: 'Lower Left First Molar',     range: [6, 7] },
  '37': { name: 'Lower Left Second Molar',    range: [11, 13] },
  '38': { name: 'Lower Left Third Molar',     range: [17, 25] },
};

const DECIDUOUS = {
  '55': { name: 'Upper Right Deciduous Second Molar', range: [1.67, 2.5], fall: 10.5 },
  '54': { name: 'Upper Right Deciduous First Molar',  range: [1.0, 1.17], fall: 9.5 },
  '53': { name: 'Upper Right Deciduous Canine',       range: [1.42, 1.5],  fall: 11.0 },
  '52': { name: 'Upper Right Deciduous Lateral Incisor', range: [0.58, 0.75], fall: 7.0 },
  '51': { name: 'Upper Right Deciduous Central Incisor', range: [0.58, 0.75], fall: 6.5 },
  '61': { name: 'Upper Left Deciduous Central Incisor',  range: [0.58, 0.75], fall: 6.5 },
  '62': { name: 'Upper Left Deciduous Lateral Incisor',  range: [0.58, 0.75], fall: 7.0 },
  '63': { name: 'Upper Left Deciduous Canine',           range: [1.42, 1.5],  fall: 11.0 },
  '64': { name: 'Upper Left Deciduous First Molar',      range: [1.0, 1.17], fall: 9.5 },
  '65': { name: 'Upper Left Deciduous Second Molar',     range: [1.67, 2.5], fall: 10.5 },
  '85': { name: 'Lower Right Deciduous Second Molar',    range: [1.67, 2.5], fall: 11.0 },
  '84': { name: 'Lower Right Deciduous First Molar',     range: [1.0, 1.17], fall: 9.5 },
  '83': { name: 'Lower Right Deciduous Canine',          range: [1.42, 1.5],  fall: 10.0 },
  '82': { name: 'Lower Right Deciduous Lateral Incisor', range: [0.83, 1.0],  fall: 6.5 },
  '81': { name: 'Lower Right Deciduous Central Incisor', range: [0.5, 0.67],  fall: 6.0 },
  '71': { name: 'Lower Left Deciduous Central Incisor',  range: [0.5, 0.67],  fall: 6.0 },
  '72': { name: 'Lower Left Deciduous Lateral Incisor',  range: [0.83, 1.0],  fall: 6.5 },
  '73': { name: 'Lower Left Deciduous Canine',           range: [1.42, 1.5],  fall: 10.0 },
  '74': { name: 'Lower Left Deciduous First Molar',      range: [1.0, 1.17],  fall: 9.5 },
  '75': { name: 'Lower Left Deciduous Second Molar',     range: [1.67, 2.5],  fall: 11.0 },
};

const ALL = { ...PERMANENT, ...DECIDUOUS };
const isDeciduous = fdi => '5678'.includes(fdi[0]);
const isUpper = fdi => '1256'.includes(fdi[0]);
const mid = r => (r[0] + r[1]) / 2;
const fmtYr = v => v < 2 ? `${Math.round(v * 12)} mo` : `${(+v.toFixed(1))} yr`;
const fmtRange = (lo, hi) => `${fmtYr(lo)} – ${fmtYr(hi)}`;

// Eruption is a POINT: at the midpoint of the book range.
// A tooth is present iff age >= emergence age and (deciduous: age < fall).
const emergence = fdi => mid(ALL[fdi].range);
function isPresent(fdi, age) {
  if (age < emergence(fdi)) return false;
  if (isDeciduous(fdi) && age >= ALL[fdi].fall) return false;
  return true;
}

/* Book rule 2: lower erupts ~1 yr before upper.
   Only the lateral incisor is the exception (rule 1). */
function bookRule(fdi) {
  const n = fdi[1];
  if (isDeciduous(fdi)) return 'Deciduous teeth are more regular than the permanent set but still vary.';
  if (n === '2') return 'Exception to rule 2: lateral incisors appear earlier in the upper jaw.';
  if (isUpper(fdi)) return 'Rule 2: the corresponding tooth in the lower jaw erupts about 1 year earlier.';
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
const k = new THREE.DirectionalLight(0xffffff, 2);   k.position.set(0.3, 0.5, 0.5);  scene.add(k);
const f = new THREE.DirectionalLight(0xffe0b0, 1);   f.position.set(-0.5, 0.1, 0.3); scene.add(f);
const r = new THREE.DirectionalLight(0xffffff, 0.8); r.position.set(0, -0.5, -0.3); scene.add(r);

const teeth = {};   // fdi -> { group, data, origEmissive }
let maxDim = 0.15;
let loaded = false;

function loadModel() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);
    loader.load('models/anatomy_v12_draco.glb', gltf => {
      const model = gltf.scene;
      scene.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      model.position.sub(centre);
      maxDim = Math.max(size.x, size.y, size.z);
      camera.position.set(0, maxDim * 0.1, maxDim * 1.6);
      controls.target.set(0, 0, 0);
      controls.update();

      // Material + register teeth
      model.traverse(o => {
        if (!o.isMesh) return;
        let a = o, group = '';
        while (a) {
          if (/^tooth_[5-8]\d$/.test(a.name) || /^tooth_\d{2}$/.test(a.name) ||
              /^(Maxill|Mandib)/.test(a.name)) { group = a.name; break; }
          a = a.parent;
        }
        const isTooth = /^tooth_[5-8]\d$/.test(group) || (/^tooth_\d{2}$/.test(group));
        const isDec   = /^tooth_[5-8]\d$/.test(group);
        const isBone  = /^(Maxill|Mandib)/.test(group);
        o.material = new THREE.MeshStandardMaterial({
          color: isDec ? 0xffffff : (isTooth ? 0xf0e8cc : (isBone ? 0xd9c79a : 0x888888)),
          roughness: isTooth ? 0.4 : 0.85,
          metalness: 0.02,
          emissive: isTooth ? 0x080808 : 0x000000,
        });
      });
      model.traverse(o => {
        const m = o.name.match(/^tooth_(\d{2})$/);
        if (!m) return;
        const fdi = m[1];
        if (!ALL[fdi]) return;
        teeth[fdi] = { group: o, data: ALL[fdi] };
      });
      loaded = true;
      resolve();
    }, undefined, reject);
  });
}

/* ============================================================
   AGE — binary presence, no half-crowns
   ============================================================ */
let currentAge = 0;
const ageLabel = document.getElementById('age-label');
const ageSlider = document.getElementById('age-slider');

function renderAge(age) {
  currentAge = age;
  ageLabel.textContent = age.toFixed(1);
  ageSlider.value = age;
  for (const fdi in teeth) {
    const present = isPresent(fdi, age);
    const t = teeth[fdi];
    t.group.visible = present;
    t.group.scale.setScalar(1);
  }
}

/* ============================================================
   HIGHLIGHT (used by Learn)
   ============================================================ */
function highlight(fdi, hex = 0x4ade80) {
  const t = teeth[fdi];
  if (!t) return;
  t.group.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData._orig) o.userData._orig = o.material.emissive.clone();
    o.material.emissive = new THREE.Color(hex);
    o.material.emissiveIntensity = 1.2;
  });
}
function clearHighlight(fdi) {
  const t = teeth[fdi];
  if (!t) return;
  t.group.traverse(o => {
    if (o.isMesh && o.userData._orig) {
      o.material.emissive.copy(o.userData._orig);
      o.material.emissiveIntensity = 1;
    }
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
  canvas.style.opacity = (name === 'test') ? '0.15' : '1';
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
  const rows = [
    ['18','17','16','15','14','13','12','11', null, '21','22','23','24','25','26','27','28'],
    ['48','47','46','45','44','43','42','41', null, '31','32','33','34','35','36','37','38'],
  ];
  rows.forEach(list => {
    const row = document.createElement('div');
    row.className = 'fdi-row';
    list.forEach(fdi => {
      if (fdi === null) {
        const gap = document.createElement('div');
        gap.style.width = '10px';
        row.appendChild(gap);
        return;
      }
      const b = document.createElement('button');
      b.className = 'fdi-cell' + (isDeciduous(fdi) ? ' decid' : '');
      b.dataset.fdi = fdi;
      b.textContent = fdi;
      b.addEventListener('click', () => onFdiClick(fdi, b));
      row.appendChild(b);
    });
    host.appendChild(row);
  });
}

function onFdiClick(fdi, btn) {
  document.querySelectorAll('.fdi-cell').forEach(x => x.classList.remove('selected'));
  btn.classList.add('selected');
  clearAllHighlights();
  highlight(fdi, 0x4ade80);
  const d = ALL[fdi];
  const present = isPresent(fdi, currentAge);
  document.getElementById('info').innerHTML = `
    <div><span class="code">${fdi}</span> <span class="name">${d.name}</span></div>
    <div class="row"><b>Eruption range:</b> ${fmtRange(d.range[0], d.range[1])}</div>
    ${isDeciduous(fdi) ? `<div class="row"><b>Sheds:</b> about ${fmtYr(d.fall)}</div>` : ''}
    <div class="row"><b>On the jaw at age ${currentAge.toFixed(1)}:</b>
      ${present ? 'present' : 'not yet erupted'}</div>
    <div class="rule">${bookRule(fdi)}</div>
  `;
}

function stepAge(delta) {
  const v = Math.max(0, Math.min(25, +(currentAge + delta).toFixed(1)));
  renderAge(v);
}
document.getElementById('age-minus').addEventListener('click', () => stepAge(-0.5));
document.getElementById('age-plus').addEventListener('click', () => stepAge(0.5));
ageSlider.addEventListener('input', e => renderAge(parseFloat(e.target.value)));

/* ============================================================
   PRACTICE — guided step-by-step
   ============================================================ */
let P = null;

function startPractice() {
  const age = pickRandomAge();
  renderAge(age);
  P = { age, step: 1, last: null, next: null, lo: '', hi: '' };
  renderPractice();
}

function pickRandomAge() {
  const windows = [[0.5, 2.5], [5, 9], [9, 13], [16, 22]];
  const [lo, hi] = windows[Math.floor(Math.random() * windows.length)];
  return +(lo + Math.random() * (hi - lo)).toFixed(1);
}

function presentTeeth(age) {
  return Object.keys(ALL).filter(fdi => isPresent(fdi, age));
}
function pendingTeeth(age) {
  return Object.keys(ALL).filter(fdi => emergence(fdi) > age);
}

// Defensible band from the book logic.
function defensibleBand(age) {
  const present = presentTeeth(age);
  const pending = pendingTeeth(age);
  if (!present.length) {
    const p = pending.sort((a,b) => emergence(a) - emergence(b))[0];
    return { lo: 0, hi: ALL[p].range[1], last: [], next: [p], open: false };
  }
  const maxE = Math.max(...present.map(emergence));
  const last = present.filter(f => emergence(f) === maxE);
  if (!pending.length) return { lo: ALL[last[0]].range[0], hi: null, last, next: [], open: true };
  const minE = Math.min(...pending.map(emergence));
  const next = pending.filter(f => emergence(f) === minE);
  return { lo: ALL[last[0]].range[0], hi: Math.max(...next.map(f => ALL[f].range[1])), last, next, open: false };
}

function renderPractice() {
  const host = document.getElementById('practice-content');
  const age = P.age;
  const present = presentTeeth(age);

  // step 1 — identify last tooth that erupted
  const step1Html = `
    <div class="step">
      <h3>Step 1 · Which tooth erupted most recently?</h3>
      <p>Of the teeth you can see on the jaw, which one is the latest in the eruption order?</p>
      <div class="fdi-pick" id="pick-last">
        ${present.map(f => `<button data-fdi="${f}" ${P.last === f ? 'class="picked"' : ''}>${f}</button>`).join('')}
      </div>
      <button class="primary" id="go2" ${P.last ? '' : 'disabled'}>Continue</button>
    </div>`;

  let step2Html = '';
  if (P.last) {
    const d = ALL[P.last];
    step2Html = `
      <div class="step">
        <h3>Step 2 · Textbook range for ${P.last}</h3>
        <p>${d.name} erupts between <b>${fmtRange(d.range[0], d.range[1])}</b>.</p>
        <p>Because it has erupted, the age is at least <b>${fmtYr(d.range[0])}</b>.</p>
      </div>`;
  }

  const pending = pendingTeeth(age);
  let step3Html = '';
  if (P.last) {
    step3Html = `
      <div class="step">
        <h3 class="${P.next ? '' : 'locked'}">Step 3 · Which tooth is next due?</h3>
        <p>Among the teeth not yet on the jaw, which one erupts earliest in the book order?</p>
        <div class="fdi-pick" id="pick-next">
          ${pending.map(f => `<button data-fdi="${f}" ${P.next === f ? 'class="picked"' : ''}>${f}</button>`).join('')}
        </div>
        <button class="primary" id="go4" ${P.next ? '' : 'disabled'}>Continue</button>
      </div>`;
  }

  let step4Html = '';
  if (P.next) {
    const d = ALL[P.next];
    step4Html = `
      <div class="step">
        <h3>Step 4 · Textbook range for ${P.next}</h3>
        <p>${d.name} erupts between <b>${fmtRange(d.range[0], d.range[1])}</b>.</p>
        <p>Because it has not erupted, the age is at most <b>${fmtYr(d.range[1])}</b>.</p>
      </div>`;
  }

  let step5Html = '';
  if (P.next) {
    step5Html = `
      <div class="step">
        <h3>Step 5 · Report the age range</h3>
        <p>Give the narrowest range the teeth can honestly support.</p>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
          <label style="color:#888;font-size:0.8em">Between</label>
          <input type="number" step="0.5" id="lo" value="${P.lo}">
          <label style="color:#888;font-size:0.8em">and</label>
          <input type="number" step="0.5" id="hi" value="${P.hi}">
          <label style="color:#888;font-size:0.8em">yr</label>
        </div>
        <button class="primary" id="reveal">Reveal</button>
      </div>`;
  }

  host.innerHTML = step1Html + step2Html + step3Html + step4Html + step5Html + '<div id="practice-result"></div>';

  host.querySelectorAll('#pick-last button').forEach(b => b.onclick = () => {
    P.last = b.dataset.fdi; renderPractice();
  });
  const go2 = host.querySelector('#go2');
  if (go2) go2.onclick = () => renderPractice();

  host.querySelectorAll('#pick-next button').forEach(b => b.onclick = () => {
    P.next = b.dataset.fdi; renderPractice();
  });
  const go4 = host.querySelector('#go4');
  if (go4) go4.onclick = () => renderPractice();

  const rev = host.querySelector('#reveal');
  if (rev) rev.onclick = () => {
    P.lo = host.querySelector('#lo').value;
    P.hi = host.querySelector('#hi').value;
    const lo = parseFloat(P.lo), hi = parseFloat(P.hi);
    const b = defensibleBand(age);
    const correct = (b.open ? false : (lo <= b.lo + 1 && hi >= b.hi - 1 && (hi - lo) <= (b.hi - b.lo) + 2));
    const trueRange = b.open ? `≥ ${fmtYr(b.lo)}` : fmtRange(b.lo, b.hi);
    host.querySelector('#practice-result').innerHTML = `
      <div class="result">
        <div><b>Defensible answer:</b> <span class="range">${trueRange}</span></div>
        <div>${correct ? '<span class="ok">Correct and appropriately tight.</span>' : '<span class="near">Compare your range with the defensible band above.</span>'}</div>
        <div style="margin-top:8px;color:#888;font-size:0.9em">
          Last erupted was <b>${b.last.join(', ') || '—'}</b>. Next due: <b>${b.next.join(', ') || '—'}</b>.
        </div>
        <div style="margin-top:8px;color:#888;font-size:0.9em">
          Eruption is a point, not a process. A tooth is either through or not.
        </div>
      </div>`;
  };
}

/* ============================================================
   TEST — FDI chart only
   ============================================================ */
let T = null;

function startTest() {
  T = { round: 0, score: 0, total: 10, age: null, style: 'range', last: null, next: null };
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
  const rowLayout = [
    ['18','17','16','15','14','13','12','11', null, '21','22','23','24','25','26','27','28'],
    ['48','47','46','45','44','43','42','41', null, '31','32','33','34','35','36','37','38'],
  ];
  const chart = rowLayout.map(list => `
    <div class="row">
      ${list.map(fdi => {
        if (fdi === null) return '<div style="width:14px"></div>';
        const present = isPresent(fdi, age);
        return `<div class="cell ${present ? 'present' : ''}">${present ? fdi : ''}</div>`;
      }).join('')}
    </div>`).join('');

  host.innerHTML = `
    <div style="font-size:0.8em;color:#bbb;margin-bottom:6px">
      <b style="color:#4ade80">Round ${T.round} of ${T.total}</b> · Score ${T.score}
    </div>
    <p style="font-size:0.8em;color:#bbb;line-height:1.45;margin:0 0 8px">
      A dental chart is shown. Teeth marked in green are present; blank cells are absent.
      Estimate the age range.
    </p>
    <div class="chart">${chart}</div>
    <div class="step" style="border-top:none">
      <h3>Your answer</h3>
      <div style="display:flex;gap:10px;margin-bottom:8px">
        <label style="color:#888;font-size:0.8em"><input type="radio" name="answerStyle" value="range" ${T.style==='range'?'checked':''}> Range only</label>
        <label style="color:#888;font-size:0.8em"><input type="radio" name="answerStyle" value="both" ${T.style==='both'?'checked':''}> Range + reasoning</label>
      </div>
      ${T.style === 'both' ? `
        <div style="margin-bottom:6px">
          <label style="color:#888;font-size:0.8em;display:block;margin-bottom:4px">Last erupted (FDI):</label>
          <div class="fdi-pick" id="pick-test-last">
            ${Object.keys(ALL).filter(f => isPresent(f, age)).map(f =>
              `<button data-fdi="${f}" ${T.last===f?'class="picked"':''}>${f}</button>`).join('')}
          </div>
        </div>
        <div style="margin-bottom:6px">
          <label style="color:#888;font-size:0.8em;display:block;margin-bottom:4px">Next due (FDI):</label>
          <div class="fdi-pick" id="pick-test-next">
            ${Object.keys(ALL).filter(f => emergence(f) > age).map(f =>
              `<button data-fdi="${f}" ${T.next===f?'class="picked"':''}>${f}</button>`).join('')}
          </div>
        </div>` : ''}
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
        <label style="color:#888;font-size:0.8em">Between</label>
        <input type="number" step="0.5" id="test-lo">
        <label style="color:#888;font-size:0.8em">and</label>
        <input type="number" step="0.5" id="test-hi">
        <label style="color:#888;font-size:0.8em">yr</label>
      </div>
      <button class="primary" id="test-submit">Submit</button>
    </div>
    <div id="test-result"></div>
  `;

  host.querySelectorAll('input[name="answerStyle"]').forEach(r =>
    r.onchange = () => { T.style = r.value; renderTest(); });
  host.querySelectorAll('#pick-test-last button').forEach(b =>
    b.onclick = () => { T.last = b.dataset.fdi; renderTest(); });
  host.querySelectorAll('#pick-test-next button').forEach(b =>
    b.onclick = () => { T.next = b.dataset.fdi; renderTest(); });
  host.querySelector('#test-submit').onclick = submitTestAnswer;
}

function submitTestAnswer() {
  const host = document.getElementById('test-result');
  const lo = parseFloat(document.getElementById('test-lo').value);
  const hi = parseFloat(document.getElementById('test-hi').value);
  if (isNaN(lo) || isNaN(hi) || lo >= hi) {
    host.innerHTML = `<div class="result"><span class="no">Give a range: upper must exceed lower.</span></div>`;
    return;
  }
  const b = defensibleBand(T.age);
  const rangeOK = b.open ? false : (lo <= b.lo + 1 && hi >= b.hi - 1 && (hi - lo) <= (b.hi - b.lo) + 2);

  let reasonOK = true;
  if (T.style === 'both') {
    const lastOK = b.last.includes(T.last) || (b.last.length === 0);
    const nextOK = b.next.includes(T.next) || (b.next.length === 0);
    reasonOK = lastOK && nextOK;
  }

  const full = rangeOK && reasonOK;
  if (full) T.score++;

  const trueRange = b.open ? `≥ ${fmtYr(b.lo)}` : fmtRange(b.lo, b.hi);
  host.innerHTML = `
    <div class="result">
      <div>${full ? '<span class="ok">Correct.</span>' : '<span class="no">Not quite.</span>'}</div>
      <div style="margin-top:6px"><b>Defensible answer:</b> <span class="range">${trueRange}</span></div>
      ${T.style === 'both' ? `
        <div style="margin-top:6px;color:#aaa;font-size:0.9em">
          <b>Last erupted:</b> ${b.last.join(', ') || '—'} — you said ${T.last || '—'}<br>
          <b>Next due:</b> ${b.next.join(', ') || '—'} — you said ${T.next || '—'}
        </div>` : ''}
      <button class="primary" id="test-next" style="margin-top:10px">Next chart</button>
    </div>`;
  host.querySelector('#test-next').onclick = nextTestRound;
}

function testSummary() {
  const host = document.getElementById('test-content');
  const pct = Math.round(100 * T.score / T.total);
  host.innerHTML = `
    <div class="result" style="border-color:#4ade80">
      <div style="font-size:1.15em"><b>Score ${T.score} / ${T.total} (${pct}%)</b></div>
      <button class="primary" id="test-restart" style="margin-top:12px">Try again</button>
    </div>`;
  host.querySelector('#test-restart').onclick = startTest;
}

/* ============================================================
   BOOT
   ============================================================ */
loadModel().then(() => {
  buildFdiGrid();
  renderAge(0);
  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
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
