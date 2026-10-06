// APSRTC — Age-related changes in teeth, interactive cross-section
// Self-contained: builds its own DOM, SVG, styles, and logic.

const APSRTC = (() => {

const CRITERIA = [
  { id: 'A', name: 'Attrition',           short: 'Occlusal wear' },
  { id: 'P', name: 'Periodontosis',       short: 'Gum regression' },
  { id: 'S', name: 'Secondary dentin',    short: 'Pulp shrinkage' },
  { id: 'R', name: 'Root resorption',     short: 'Apex pits/grooves' },
  { id: 'T', name: 'Transparency',        short: 'Root translucency' },
  { id: 'C', name: 'Cementum apposition', short: 'Apex thickening' },
];

const DESCRIPTIONS = {
  A: [
    'Normal incisal edge. Enamel intact across the whole biting surface.',
    'Slight flattening. Enamel begins to wear at the incisal edge.',
    'Obvious wear. Enamel is thinned; small patches of dentin start to show.',
    'Heavy attrition. Enamel is gone; dentin is exposed and the pulp is close to the surface.',
  ],
  P: [
    'Gum line at the neck of the tooth. No root is exposed.',
    'Early regression. About one quarter of the root is exposed.',
    'Half of the root is exposed. Teeth may start to feel loose.',
    'Marked regression. About three quarters of the root is exposed above the gum.',
  ],
  S: [
    'Pulp chamber is full size. No secondary dentin laid down.',
    'A thin layer of secondary dentin has narrowed the pulp chamber slightly.',
    'Pulp cavity is markedly reduced. The chamber is half filled.',
    'Pulp cavity is nearly obliterated. Only a thin line remains.',
  ],
  R: [
    'Root apex is smooth and rounded.',
    'Small pits appear on the apex surface.',
    'Sharp grooves and irregular depressions on the apex.',
    'The apex is shortened and largely resorbed.',
  ],
  T: [
    'Root dentin is uniformly opaque. No translucency.',
    'Lower third of the root has become translucent.',
    'Lower two thirds of the root are translucent.',
    'Nearly the whole root is translucent, reaching the cervical region.',
  ],
  C: [
    'Normal cementum thickness at the apex.',
    'Cementum has thickened slightly, especially near the apex.',
    'Cementum is visibly thick at the apex.',
    'Marked apposition. The apex has become bulbous.',
  ],
};

// ---------- State ----------
const state = {
  active: 'A',
  stages: { A: 0, P: 0, S: 0, R: 0, T: 0, C: 0 },
  compare: false,
};

// ---------- SVG builders ----------
// Geometry constants (viewBox 240 x 520)
const SVG_W = 240, SVG_H = 520;
const CX = 120;

// Tooth outline (dentin), extends from crown top to root apex
function toothOutlinePath(apexOffset = 0) {
  // apexOffset: how much apex is lost due to resorption (0 at stage 0)
  const apexY = 465 + apexOffset * 25;
  return `M 78,50 Q 78,45 86,45 L 154,45 Q 162,45 162,50
          L 162,140 Q 162,190 145,205
          Q 148,300 145,400 Q 140,440 120,${apexY}
          Q 100,440 95,400 Q 92,300 95,205
          Q 78,190 78,140 Z`;
}

// Crown top variants for attrition
function crownTopY(stage) {
  // y of incisal surface, and how flat the top is
  return [45, 48, 54, 62][stage];
}

function crownWithAttrition(stage) {
  const y = crownTopY(stage);
  const flat = stage >= 2;
  if (!flat) {
    return `M 78,55 Q 78,${y} 86,${y} L 154,${y} Q 162,${y} 162,55
            L 162,140 Q 162,190 145,205 L 95,205 Q 78,190 78,140 Z`;
  }
  return `M 78,${y + 4} Q 78,${y} 82,${y} L 158,${y} Q 162,${y} 162,${y + 4}
          L 162,140 Q 162,190 145,205 L 95,205 Q 78,190 78,140 Z`;
}

// Enamel shell (crown outer band)
function enamelPath(stage) {
  const y = crownTopY(stage);
  const inner = 12;
  return `M 78,55 Q 78,${y} 86,${y} L 154,${y} Q 162,${y} 162,55
          L 162,140 Q 162,190 145,205 L ${145 - 6},200
          Q ${150},180 ${150},140 L ${150},${y + inner}
          L ${90},${y + inner} L ${90},140
          Q 90,180 96,200 L 95,205
          Q 78,190 78,140 Z`;
}

// Pulp chamber — stage controls how much is filled by secondary dentin
function pulpPath(stage) {
  const narrow = [0, 4, 12, 22][stage];  // how much the pulp shrinks at every edge
  const xL = 100 + narrow, xR = 140 - narrow;
  const yTop = 90 + narrow * 0.5;
  const canalTop = 200;
  const canalWidth = Math.max(1, 6 - narrow / 3);
  const apexY = 430 - narrow * 3;
  if (stage >= 3) {
    // Nearly obliterated: just a thin line
    return `M ${CX - 2},${yTop + 10} L ${CX + 2},${yTop + 10}
            L ${CX + 1},${apexY} L ${CX - 1},${apexY} Z`;
  }
  return `M ${xL},${yTop + 20}
          Q ${xL},${yTop} ${CX},${yTop}
          Q ${xR},${yTop} ${xR},${yTop + 20}
          L ${xR},${canalTop}
          L ${CX + canalWidth},${apexY}
          Q ${CX},${apexY + 8} ${CX - canalWidth},${apexY}
          L ${xL},${canalTop} Z`;
}

// Gum triangles — height shrinks with periodontosis
function gumPaths(stage) {
  const regression = [0, 20, 45, 70][stage]; // mm of gum lost
  const gumTopY = 205 + regression;
  const gumBottomY = 300;
  const leftGum  = `M 74,${gumTopY} L 100,${gumTopY} L 100,${gumBottomY}
                    Q 88,${gumBottomY + 10} 74,${gumBottomY} Z`;
  const rightGum = `M 140,${gumTopY} L 166,${gumTopY} L 166,${gumBottomY}
                    Q 152,${gumBottomY + 10} 140,${gumBottomY} Z`;
  return { leftGum, rightGum, gumTopY };
}

// Alveolar bone — top edge follows gum regression
function bonePaths(stage) {
  const regression = [0, 20, 45, 70][stage];
  const boneTopY = 240 + regression;
  const leftBone  = `M 60,${boneTopY} L 100,${boneTopY} L 100,500 L 60,500 Z`;
  const rightBone = `M 140,${boneTopY} L 180,${boneTopY} L 180,500 L 140,500 Z`;
  return { leftBone, rightBone, boneTopY };
}

// Root resorption: apex gets pitted then shortened
function resorptionApexPath(stage) {
  if (stage === 0) return '';
  if (stage === 1) {
    return `M 105,420 Q 115,430 120,432 Q 125,430 135,420`;
  }
  if (stage === 2) {
    return `M 100,410 L 105,425 L 110,415 L 115,428 L 120,418
            L 125,428 L 130,415 L 135,425 L 140,410`;
  }
  // stage 3: apex largely lost — short blunt end
  return `M 95,395 Q 120,415 145,395`;
}

// Transparency: overlay lower root with a semi-transparent white
function transparencyRect(stage) {
  if (stage === 0) return { y: 0, h: 0, op: 0 };
  const portions = [0, 0.33, 0.66, 1.0];
  const yStart = 460 - (460 - 205) * portions[stage];
  return { y: yStart, h: 460 - yStart, op: [0, 0.35, 0.55, 0.75][stage] };
}

// Cementum thickness at apex
function cementumWidth(stage) {
  return [2, 4, 7, 12][stage];
}

// ---------- Render ----------
function buildSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
  svg.classList.add('apstrc-svg');

  svg.innerHTML = `
    <defs>
      <linearGradient id="g-dentin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#f5e9c8"/>
        <stop offset="60%"  stop-color="#e8d5a8"/>
        <stop offset="100%" stop-color="#d8c18a"/>
      </linearGradient>
      <linearGradient id="g-enamel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#fefcf6"/>
        <stop offset="100%" stop-color="#eae2cc"/>
      </linearGradient>
      <linearGradient id="g-pulp" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#c9564b"/>
        <stop offset="100%" stop-color="#8a3630"/>
      </linearGradient>
      <linearGradient id="g-gum" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#dc9b9b"/>
        <stop offset="100%" stop-color="#b57373"/>
      </linearGradient>
      <linearGradient id="g-bone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#d9c79a"/>
        <stop offset="100%" stop-color="#b9a676"/>
      </linearGradient>
      <radialGradient id="g-highlight" cx="0.35" cy="0.3" r="0.5">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <g class="bone-layer">
      <path class="bone-left"  fill="url(#g-bone)"/>
      <path class="bone-right" fill="url(#g-bone)"/>
    </g>

    <g class="gum-layer">
      <path class="gum-left"  fill="url(#g-gum)"/>
      <path class="gum-right" fill="url(#g-gum)"/>
    </g>

    <g class="tooth-layer">
      <path class="tooth-dentin" fill="url(#g-dentin)" stroke="#a89464" stroke-width="0.8"/>
      <path class="tooth-enamel" fill="url(#g-enamel)" stroke="#c8bfa3" stroke-width="0.6"/>
      <path class="tooth-cementum" fill="none" stroke="#a58b58" stroke-linecap="round"/>
      <path class="tooth-pulp" fill="url(#g-pulp)"/>
      <path class="tooth-resorption" fill="none" stroke="#8a3630" stroke-width="1.4"/>
      <rect class="tooth-transparency" fill="#ffffff" opacity="0"/>
      <ellipse class="tooth-highlight" fill="url(#g-highlight)" cx="100" cy="90" rx="40" ry="55"/>
    </g>

    <g class="labels-layer">
      <text class="lbl" x="195" y="70">Enamel</text>
      <line class="lbl-line" x1="165" y1="66" x2="192" y2="66"/>
      <text class="lbl" x="195" y="130">Dentin</text>
      <line class="lbl-line" x1="155" y1="126" x2="192" y2="126"/>
      <text class="lbl" x="195" y="175">Pulp</text>
      <line class="lbl-line" x1="135" y1="171" x2="192" y2="171"/>
      <text class="lbl" x="195" y="240">Cementum</text>
      <line class="lbl-line" x1="152" y1="236" x2="192" y2="236"/>
      <text class="lbl" x="195" y="290">Gum</text>
      <line class="lbl-line" x1="160" y1="286" x2="192" y2="286"/>
      <text class="lbl" x="195" y="340">Alveolar bone</text>
      <line class="lbl-line" x1="170" y1="336" x2="192" y2="336"/>
    </g>
  `;
  return svg;
}

// ---------- Update visuals ----------
function render(svg) {
  const A = state.stages.A, P = state.stages.P, S = state.stages.S,
        R = state.stages.R, T = state.stages.T, C = state.stages.C;

  // tooth outline with resorption apex
  const apexOffset = [0, 0, 0, 1][R];
  svg.querySelector('.tooth-dentin').setAttribute('d', toothOutlinePath(apexOffset));
  svg.querySelector('.tooth-enamel').setAttribute('d', enamelPath(A));
  svg.querySelector('.tooth-pulp').setAttribute('d', pulpPath(S));

  // cementum: overlay along root outline, thickness varies
  const cw = cementumWidth(C);
  svg.querySelector('.tooth-cementum').setAttribute(
    'd', `M 96,205 Q 94,300 96,400 Q 100,440 120,${465 + apexOffset * 25}
          Q 140,440 144,400 Q 146,300 144,205`
  );
  svg.querySelector('.tooth-cementum').setAttribute('stroke-width', cw);

  // resorption apex outline
  const rpath = resorptionApexPath(R);
  svg.querySelector('.tooth-resorption').setAttribute('d', rpath);

  // transparency rect
  const tp = transparencyRect(T);
  const tRect = svg.querySelector('.tooth-transparency');
  tRect.setAttribute('y', tp.y);
  tRect.setAttribute('height', tp.h);
  tRect.setAttribute('opacity', tp.op);

  // gum + bone follow P
  const gum = gumPaths(P);
  svg.querySelector('.gum-left').setAttribute('d', gum.leftGum);
  svg.querySelector('.gum-right').setAttribute('d', gum.rightGum);
  const bone = bonePaths(P);
  svg.querySelector('.bone-left').setAttribute('d', bone.leftBone);
  svg.querySelector('.bone-right').setAttribute('d', bone.rightBone);
}

// ---------- UI ----------
function buildUI() {
  const root = document.createElement('div');
  root.id = 'apstrc-modal';
  root.className = 'apstrc-modal hidden';

  root.innerHTML = `
    <div class="apstrc-card">
      <div class="apstrc-head">
        <h2>Age changes in teeth — APSRTC</h2>
        <button class="apstrc-close" aria-label="close">✕</button>
      </div>

      <div class="apstrc-body">
        <div class="apstrc-left">
          <div class="apstrc-svg-host"></div>
        </div>
        <div class="apstrc-right">
          <div class="apstrc-tabs">
            ${CRITERIA.map(c => `
              <button class="apstrc-tab" data-c="${c.id}">
                <span class="ltr">${c.id}</span>
                <span class="full">${c.name}</span>
              </button>
            `).join('')}
          </div>

          <div class="apstrc-stage">
            <div class="apstrc-stage-head">
              <span class="apstrc-stage-name" id="apstrc-stage-name"></span>
              <span class="apstrc-stage-num" id="apstrc-stage-num">0</span>
            </div>
            <input type="range" min="0" max="3" step="1" value="0" class="apstrc-slider" id="apstrc-slider">
            <div class="apstrc-ticks"><span>0</span><span>1</span><span>2</span><span>3</span></div>
          </div>

          <div class="apstrc-desc" id="apstrc-desc"></div>

          <label class="apstrc-compare">
            <input type="checkbox" id="apstrc-compare">
            <span>Compare with normal (stage 0)</span>
          </label>

          <div class="apstrc-hint">
            A · P · S · R · T · C — the six criteria from Gustafson's method.
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

// ---------- Init ----------
function init() {
  // Inject styles once
  if (!document.getElementById('apstrc-styles')) {
    const s = document.createElement('style');
    s.id = 'apstrc-styles';
    s.textContent = `
      #apstrc-open {
        position: fixed; right: 12px; bottom: 96px;
        background: rgba(10,10,10,0.9);
        color: #4ade80; border: 1px solid #2a2a2a;
        border-radius: 10px; padding: 10px 16px;
        font-family: system-ui, sans-serif; font-size: 0.8em; font-weight: 600;
        cursor: pointer; z-index: 30;
      }
      #apstrc-open:active { background: rgba(74,222,128,0.15); }

      .apstrc-modal {
        position: fixed; inset: 0; z-index: 100;
        background: rgba(0,0,0,0.75);
        display: flex; align-items: center; justify-content: center;
        padding: 12px; backdrop-filter: blur(6px);
      }
      .apstrc-modal.hidden { display: none; }

      .apstrc-card {
        background: #0e0e0e; border: 1px solid #2a2a2a;
        border-radius: 14px;
        width: 100%; max-width: 720px;
        max-height: 96vh; overflow: auto;
        font-family: system-ui, sans-serif; color: #e8e8e8;
      }
      .apstrc-head {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 18px; border-bottom: 1px solid #1f1f1f;
        position: sticky; top: 0; background: #0e0e0e; z-index: 2;
      }
      .apstrc-head h2 { margin: 0; font-size: 1em; color: #4ade80; font-weight: 600; }
      .apstrc-close {
        background: none; border: none; color: #888;
        font-size: 1.4em; cursor: pointer; padding: 0 6px;
      }

      .apstrc-body {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        padding: 14px;
      }
      @media (min-width: 620px) {
        .apstrc-body { grid-template-columns: 260px 1fr; }
      }
      .apstrc-svg-host {
        background: #060606;
        border: 1px solid #1a1a1a;
        border-radius: 10px;
        padding: 6px;
        display: flex; justify-content: center;
      }
      .apstrc-svg { width: 100%; max-width: 260px; height: auto; display: block; }

      .lbl { font-size: 9px; fill: #888; }
      .lbl-line { stroke: #444; stroke-width: 0.6; }

      .apstrc-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
      .apstrc-tab {
        flex: 1 1 30%;
        background: #141414; color: #ccc;
        border: 1px solid #262626; border-radius: 8px;
        padding: 8px 6px; cursor: pointer;
        display: flex; flex-direction: column; align-items: center; gap: 2px;
        font-family: inherit;
      }
      .apstrc-tab .ltr { font-size: 1.1em; font-weight: 700; color: #4ade80; }
      .apstrc-tab .full { font-size: 0.66em; color: #888; text-align: center; }
      .apstrc-tab.active { background: #1a2a1e; border-color: #4ade80; }
      .apstrc-tab.active .full { color: #a8e8ba; }

      .apstrc-stage-head {
        display: flex; justify-content: space-between; align-items: baseline;
        margin-bottom: 4px;
      }
      .apstrc-stage-name { font-size: 0.9em; color: #aaa; }
      .apstrc-stage-num  { font-size: 1.3em; font-weight: 700; color: #4ade80; }
      .apstrc-slider {
        width: 100%; appearance: none; height: 6px;
        background: #262626; border-radius: 3px; outline: none;
      }
      .apstrc-slider::-webkit-slider-thumb {
        appearance: none; width: 22px; height: 22px;
        background: #4ade80; border-radius: 50%; cursor: pointer;
        box-shadow: 0 0 10px rgba(74,222,128,0.5);
      }
      .apstrc-ticks {
        display: flex; justify-content: space-between;
        font-size: 0.7em; color: #666; padding: 0 8px; margin-top: 4px;
      }

      .apstrc-desc {
        margin-top: 14px; font-size: 0.86em; line-height: 1.45;
        color: #d8d8d8; min-height: 3.6em;
        padding: 12px; border-left: 3px solid #4ade80;
        background: #131313; border-radius: 0 8px 8px 0;
      }

      .apstrc-compare {
        display: flex; align-items: center; gap: 8px;
        margin-top: 12px; font-size: 0.8em; color: #999; cursor: pointer;
      }
      .apstrc-hint {
        margin-top: 12px; font-size: 0.72em; color: #666;
      }
    `;
    document.head.appendChild(s);
  }

  // Open button in the corner
  const openBtn = document.createElement('button');
  openBtn.id = 'apstrc-open';
  openBtn.textContent = 'APSRTC';
  document.body.appendChild(openBtn);

  // Modal
  const modal = buildUI();
  const svgHost = modal.querySelector('.apstrc-svg-host');
  const svg = buildSVG();
  svgHost.appendChild(svg);

  const slider = modal.querySelector('#apstrc-slider');
  const stageName = modal.querySelector('#apstrc-stage-name');
  const stageNum = modal.querySelector('#apstrc-stage-num');
  const desc = modal.querySelector('#apstrc-desc');
  const tabs = modal.querySelectorAll('.apstrc-tab');

  function syncUI() {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.c === state.active));
    const c = CRITERIA.find(x => x.id === state.active);
    stageName.textContent = c.name;
    const s = state.stages[state.active];
    stageNum.textContent = s;
    slider.value = s;
    desc.textContent = DESCRIPTIONS[state.active][s];
    render(svg);
  }

  tabs.forEach(t => t.addEventListener('click', () => {
    state.active = t.dataset.c;
    syncUI();
  }));

  slider.addEventListener('input', () => {
    state.stages[state.active] = parseInt(slider.value, 10);
    syncUI();
  });

  openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  modal.querySelector('.apstrc-close').addEventListener('click',
    () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  syncUI();
  console.log('APSRTC ready');
}

return { init };
})();

window.APSRTC = APSRTC;
