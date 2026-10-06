const MysteryJaw = (() => {
  const state = { active: false, targetAge: null };
  const WINDOWS = [[0.5, 2.5], [6, 9], [9, 13], [14, 22]];
  const $ = id => document.getElementById(id);

  function injectStyles() {
    if ($('mj-styles')) return;
    const s = document.createElement('style');
    s.id = 'mj-styles';
    s.textContent = `
      body.mj-active #age-value { visibility: hidden; }
      body.mj-active #tooth-info { visibility: hidden; }
      #mj-panel { position: fixed; left: 10px; right: 10px; top: 76px;
        max-height: 60vh; background: #0c0c0c; border: 1px solid #2a2a2a;
        border-radius: 14px; display: flex; flex-direction: column;
        z-index: 60; font-family: system-ui, sans-serif; overflow: hidden;
        box-shadow: 0 12px 32px rgba(0,0,0,0.75); }
      #mj-panel.hidden { display: none; }
      .mj-head { display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px; border-bottom: 1px solid #1a1a1a; }
      .mj-head h3 { margin: 0; font-size: 0.82em; color: #f59e0b; font-weight: 600; letter-spacing: 0.5px; }
      .mj-head button { background: none; border: none; color: #888; font-size: 1.15em; cursor: pointer; padding: 0 8px; }
      .mj-body { padding: 10px 14px; overflow: auto; }
      .mj-question { font-size: 0.8em; color: #bbb; margin-bottom: 10px; line-height: 1.45; }
      .mj-question b { color: #f59e0b; }
      .mj-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .mj-row label { font-size: 0.75em; color: #888; }
      .mj-row input { width: 62px; padding: 8px; background: #131313; color: #e8e8e8;
        border: 1px solid #262626; border-radius: 6px; font-family: inherit; font-size: 0.9em; text-align: center; }
      .mj-row button { padding: 9px 12px; border-radius: 8px; font-family: inherit;
        font-size: 0.8em; font-weight: 600; cursor: pointer; }
      #mj-reveal { background: #1a2a3e; color: #60a5fa; border: 1px solid #3b82f6; }
      #mj-next   { background: #1a2a1e; color: #4ade80; border: 1px solid #4ade80; }
      .mj-result { font-size: 0.82em; color: #d8d8d8; padding: 12px; margin-top: 10px;
        background: #131313; border-left: 3px solid #f59e0b; border-radius: 0 8px 8px 0; line-height: 1.5; }
      .mj-lead { font-size: 1.05em; margin-bottom: 6px; }
      .mj-lead b { color: #888; font-weight: 500; margin-right: 6px; }
      .mj-range { color: #f59e0b; font-weight: 700; font-size: 1.2em; }
      .mj-result .ok { color: #4ade80; font-weight: 600; }
      .mj-result .near { color: #fbbf24; font-weight: 600; }
      .mj-result .no { color: #f87171; font-weight: 600; }
      .mj-result .section { margin-top: 10px; }
      .mj-result .section > b { color: #aaa; font-weight: 500; display: block; margin-bottom: 4px; }
      .mj-worked div { margin: 6px 0; font-size: 0.95em; }
      .mj-worked b { color: #f59e0b; font-weight: 600; }
      .mj-muted { color: #888; font-size: 0.9em; margin-top: 10px; line-height: 1.45; }
    `;
    document.head.appendChild(s);
  }

  function pickAge() {
    const [lo, hi] = WINDOWS[Math.floor(Math.random() * WINDOWS.length)];
    return +(lo + Math.random() * (hi - lo)).toFixed(1);
  }

  const fmtYr = v => v < 2 ? `${Math.round(v * 12)} mo` : `${+v.toFixed(1)} yr`;
  const fmtRange = (lo, hi) => `${fmtYr(lo)} – ${fmtYr(hi)}`;

  function bracket(data, age) {
    const all = [];
    for (const fdi in data.deciduousTeeth) {
      const d = data.deciduousTeeth[fdi];
      if (!d.eruptionRange) continue;
      if (d.fall && age >= d.fall) continue;
      all.push({ fdi, lo: d.eruptionRange[0], hi: d.eruptionRange[1] });
    }
    for (const fdi in data.permanentTeeth) {
      const d = data.permanentTeeth[fdi];
      if (!d.eruptionRange) continue;
      all.push({ fdi, lo: d.eruptionRange[0], hi: d.eruptionRange[1] });
    }
    const erupted = all.filter(t => t.lo <= age);
    const pending = all.filter(t => t.lo > age);

    if (!erupted.length) {
      if (!pending.length) return { lo: 0, hi: 3, last: [], next: [], openEnded: false };
      const minP = Math.min(...pending.map(t => t.lo));
      const next = pending.filter(t => t.lo === minP);
      return { lo: 0, hi: Math.max(...next.map(t => t.hi)), last: [], next: next.map(t => t.fdi), openEnded: false };
    }

    const maxE = Math.max(...erupted.map(t => t.lo));
    const last = erupted.filter(t => t.lo === maxE);
    const lo = maxE;

    if (!pending.length) {
      return { lo, hi: null, last: last.map(t => t.fdi), next: [], openEnded: true };
    }

    const minP = Math.min(...pending.map(t => t.lo));
    const next = pending.filter(t => t.lo === minP);
    return { lo, hi: Math.max(...next.map(t => t.hi)), last: last.map(t => t.fdi), next: next.map(t => t.fdi), openEnded: false };
  }

  function setSliderDisabled(on) {
    const s = $('ageSlider');
    if (s) s.disabled = on;
    document.body.classList.toggle('mj-active', on);
  }
  function pushAgeToApp(age) {
    const s = $('ageSlider');
    if (!s) return;
    s.value = age;
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function startNewRound() {
    state.targetAge = pickAge();
    state.active = true;
    setSliderDisabled(true);
    pushAgeToApp(state.targetAge);
    renderPanel();
  }

  function renderPanel() {
    const panel = $('mj-panel');
    panel.classList.remove('hidden');
    panel.innerHTML = `
      <div class="mj-head">
        <h3>MYSTERY JAW — HOW OLD?</h3>
        <div><button id="mj-reset" title="Reset view">⟲</button><button id="mj-close">✕</button></div>
      </div>
      <div class="mj-body">
        <div class="mj-question"><b>Report a RANGE, never a single age.</b> Read the jaw. Which teeth have erupted, which have not? Give the narrowest range the teeth can honestly support.</div>
        <div class="mj-row">
          <label>Between</label><input type="number" inputmode="decimal" step="0.5" min="0" max="60" id="mj-lo">
          <label>and</label><input type="number" inputmode="decimal" step="0.5" min="0" max="60" id="mj-hi">
          <label>yr</label>
          <button id="mj-reveal">Reveal</button><button id="mj-next">New jaw</button>
        </div>
        <div id="mj-output"></div>
      </div>`;
    $('mj-close').onclick = close;
    $('mj-reset').onclick = () => window.resetView && window.resetView();
    $('mj-next').onclick = startNewRound;
    $('mj-reveal').onclick = () => {
      const lo = parseFloat($('mj-lo').value), hi = parseFloat($('mj-hi').value);
      if (isNaN(lo) || isNaN(hi) || lo >= hi) {
        $('mj-output').innerHTML = '<div class="mj-result"><span class="no">Give a range: upper must be higher than lower.</span></div>';
        return;
      }
      reveal(lo, hi);
    };
  }

  function reveal(lo, hi) {
    const age = state.targetAge;
    const data = window.appAPI.getDentalData();
    const map = window.appAPI.getTeethMap();
    const b = bracket(data, age);

    let dec = 0, perm = 0;
    for (const fdi in map) if (map[fdi].group.visible) ('5678'.includes(fdi[0]) ? dec++ : perm++);

    const nameFor = fdi => { const d = data.deciduousTeeth[fdi] || data.permanentTeeth[fdi]; return d ? `${fdi} (${d.name})` : fdi; };
    const rangeFor = fdi => {
      const d = data.deciduousTeeth[fdi] || data.permanentTeeth[fdi];
      if (!d) return '—';
      return d.eruptionRange ? fmtRange(d.eruptionRange[0], d.eruptionRange[1]) : fmtYr(d.eruption);
    };

    let headline, verdictClass, steps = [];

    if (b.openEnded) {
      const X = b.lo;
      const correctShape = (lo <= X && hi >= X + 5);
      const acceptable   = (lo <= X && hi >= X + 1);
      headline = `<span class="mj-range">≥ ${fmtYr(X)}</span> <span style="color:#888;font-size:0.9em">(no upper bound can be given from teeth alone)</span>`;
      verdictClass = correctShape ? 'ok' : (acceptable ? 'near' : 'no');
      if (b.last.length) {
        steps.push(`<div><b>Step 1.</b> Last tooth to erupt: <b>${b.last.map(nameFor).join(', ')}</b>, textbook range <b>${rangeFor(b.last[0])}</b>. So the age is at least <b>${fmtYr(X)}</b>.</div>`);
      }
      steps.push(`<div><b>Step 2.</b> No further textbook tooth is due. The mouth looks the same at 20 as at 60.</div>`);
      steps.push(`<div><b>Step 3.</b> Report as <b>≥ ${fmtYr(X)} years</b>. For an upper bound use Gustafson's APSRTC method.</div>`);
    } else {
      const correctShape = (lo >= b.lo - 1 && hi <= b.hi + 1 && (hi - lo) <= (b.hi - b.lo) + 1);
      const hit = age >= lo && age <= hi;
      verdictClass = (!hit || !correctShape) ? 'no' : (correctShape ? 'ok' : 'near');
      headline = `<span class="mj-range">${fmtRange(b.lo, b.hi)}</span>`;
      if (b.last.length && b.next.length) {
        steps.push(`<div><b>Step 1.</b> Last tooth to erupt: <b>${b.last.map(nameFor).join(', ')}</b>, textbook range <b>${rangeFor(b.last[0])}</b>. It has appeared, so the age is at least <b>${fmtYr(b.lo)}</b>.</div>`);
        steps.push(`<div><b>Step 2.</b> Next tooth due: <b>${b.next.map(nameFor).join(', ')}</b>, textbook range <b>${rangeFor(b.next[0])}</b>. It has not appeared, so the age is at most <b>${fmtYr(b.hi)}</b>.</div>`);
        steps.push(`<div><b>Step 3.</b> The overlap gives the defensible band: <b>${fmtRange(b.lo, b.hi)}</b>.</div>`);
      }
    }

    const verdictText = verdictClass === 'ok'
      ? '<span class="ok">Correct and appropriately tight.</span>'
      : (verdictClass === 'near' ? '<span class="near">Close — the range could be tighter.</span>'
      : '<span class="no">Not defensible from these teeth.</span>');

    $('mj-output').innerHTML = `
      <div class="mj-result">
        <div class="mj-lead"><b>Defensible answer:</b> ${headline}</div>
        <div>${verdictText} You said ${fmtRange(lo, hi)}.</div>
        <div class="section"><b>What is on the jaw</b>${dec} deciduous · ${perm} permanent</div>
        <div class="section"><b>How the answer is reached</b><div class="mj-worked">${steps.join('')}</div></div>
        <div class="mj-muted">The textbook lists eruption ages as <i>ranges</i> because people vary: girls erupt earlier, and nutrition, climate, ethnicity and endocrine disease shift eruption. Always report a range, never a single age.</div>
      </div>`;
  }

  function open() {
    const map = window.appAPI && window.appAPI.getTeethMap();
    if (!map || !Object.keys(map).length) {
      const b = $('mj-btn'); const t = b.textContent;
      b.textContent = 'Loading…'; setTimeout(() => (b.textContent = t), 1200);
      return;
    }
    if (!$('mj-panel').classList.contains('hidden')) return;
    startNewRound();
  }

  function close() {
    $('mj-panel').classList.add('hidden');
    state.active = false;
    setSliderDisabled(false);
    pushAgeToApp(state.targetAge ?? 0);
  }

  function init() {
    if (document.getElementById('mj-btn')) return;
    injectStyles();
    const btn = document.createElement('button');
    btn.id = 'mj-btn';
    btn.textContent = 'Mystery Jaw';
    btn.onclick = open;
    (document.getElementById('side-buttons') || document.body).appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'mj-panel';
    panel.className = 'hidden';
    document.body.appendChild(panel);
    console.log('MysteryJaw ready');
  }

  return { init };
})();
window.MysteryJaw = MysteryJaw;
