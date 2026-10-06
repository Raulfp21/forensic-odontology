const MysteryJaw = (() => {
  const state = { active: false, targetAge: null };

  function injectStyles() {
    if (document.getElementById('mj-styles')) return;
    const s = document.createElement('style');
    s.id = 'mj-styles';
    s.textContent = `
      #mj-btn { position: fixed; right: 12px; top: 12px;
        background: rgba(10,10,10,0.9); color: #f59e0b;
        border: 1px solid #2a2a2a; border-radius: 10px;
        padding: 10px 14px; font-family: system-ui, sans-serif;
        font-size: 0.78em; font-weight: 600; cursor: pointer; z-index: 30; }
      #mj-btn:active { background: rgba(245,158,11,0.15); }

      #mj-panel { position: fixed; left: 10px; right: 10px; bottom: 84px;
        max-height: 62vh; background: #0c0c0c; border: 1px solid #2a2a2a;
        border-radius: 14px; display: flex; flex-direction: column;
        z-index: 50; font-family: system-ui, sans-serif;
        overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.75); }
      #mj-panel.hidden { display: none; }

      .mj-head { display: flex; justify-content: space-between; align-items: center;
        padding: 10px 12px; border-bottom: 1px solid #1a1a1a; background: #0c0c0c; }
      .mj-head h3 { margin: 0; font-size: 0.85em; color: #f59e0b;
        font-weight: 600; letter-spacing: 0.5px; }
      .mj-close { background: none; border: none; color: #888;
        font-size: 1.2em; cursor: pointer; padding: 0 6px; }

      .mj-body { padding: 12px 14px; overflow: auto; }
      .mj-question { font-size: 0.82em; color: #d8d8d8; margin-bottom: 12px; line-height: 1.45; }
      .mj-answer { display: flex; gap: 8px; align-items: center;
        margin-bottom: 10px; flex-wrap: wrap; }
      .mj-answer label { font-size: 0.75em; color: #888; }
      .mj-answer input { width: 68px; padding: 8px; background: #131313;
        color: #e8e8e8; border: 1px solid #262626; border-radius: 6px;
        font-family: inherit; font-size: 0.9em; text-align: center; }
      .mj-actions { display: flex; gap: 8px; margin-bottom: 8px; }
      .mj-actions button { flex: 1; padding: 10px 14px; border-radius: 8px;
        font-family: inherit; font-size: 0.82em; font-weight: 600; cursor: pointer; }
      .mj-reveal { background: #1a2a3e; color: #60a5fa; border: 1px solid #3b82f6; }
      .mj-reveal:active { background: #22354d; }
      .mj-next { background: #1a2a1e; color: #4ade80; border: 1px solid #4ade80; }
      .mj-next:active { background: #22392a; }

      .mj-result { font-size: 0.82em; color: #d8d8d8; padding: 12px;
        background: #131313; border-left: 3px solid #f59e0b;
        border-radius: 0 8px 8px 0; line-height: 1.5; margin-top: 8px; }
      .mj-result .true-age { color: #f59e0b; font-weight: 700; font-size: 1.15em; }
      .mj-result .ok  { color: #4ade80; font-weight: 600; }
      .mj-result .near{ color: #fbbf24; font-weight: 600; }
      .mj-result .no  { color: #f87171; font-weight: 600; }
      .mj-result .section { margin-top: 8px; }
      .mj-result .section b { color: #888; font-weight: 500; }
      .mj-result .section i { color: #d0d0d0; font-style: italic; }
    `;
    document.head.appendChild(s);
  }

  function pickAge() {
    const windows = [[0.5,2.5],[5,9],[9,13],[16,22]];
    const [lo,hi] = windows[Math.floor(Math.random()*windows.length)];
    return +(lo + Math.random()*(hi-lo)).toFixed(1);
  }

  function presentTeeth(age) {
    const data = window.appAPI.getDentalData();
    const map = window.appAPI.getTeethMap();
    const out = [];
    for (const fdi in map) {
      const d = data.deciduousTeeth?.[fdi] || data.permanentTeeth?.[fdi];
      if (!d) continue;
      if (age < d.eruption) continue;
      if (d.fall && age >= d.fall) continue;
      out.push({ fdi, ...d, isDec: '5678'.includes(fdi[0]) });
    }
    return out;
  }

  function startNewRound() {
    state.targetAge = pickAge();
    state.active = true;
    const slider = document.getElementById('ageSlider');
    if (slider) {
      slider.value = state.targetAge;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const ageValue = document.getElementById('age-value');
    if (ageValue) ageValue.textContent = '?';
    renderPanel();
  }

  function renderPanel() {
    const panel = document.getElementById('mj-panel');
    panel.classList.remove('hidden');
    panel.innerHTML = `
      <div class="mj-head">
        <h3>MYSTERY JAW — HOW OLD?</h3>
        <button class="mj-close">✕</button>
      </div>
      <div class="mj-body">
        <div class="mj-question">
          Study the jaw. Which teeth have erupted? Which have not?
          Consult the FDI chart and the eruption table, then enter the age range you would report.
        </div>
        <div class="mj-answer">
          <label>Between</label>
          <input type="number" step="0.5" min="0" max="30" id="mj-lo" placeholder="—">
          <label>and</label>
          <input type="number" step="0.5" min="0" max="30" id="mj-hi" placeholder="—">
          <label>years</label>
        </div>
        <div class="mj-actions">
          <button class="mj-reveal" id="mj-reveal">Reveal</button>
          <button class="mj-next" id="mj-next">New jaw</button>
        </div>
        <div id="mj-output"></div>
      </div>
    `;
    panel.querySelector('.mj-close').onclick = close;
    panel.querySelector('#mj-next').onclick = () => {
      panel.querySelector('#mj-output').innerHTML = '';
      panel.querySelector('#mj-lo').value = '';
      panel.querySelector('#mj-hi').value = '';
      startNewRound();
    };
    panel.querySelector('#mj-reveal').onclick = () => {
      const lo = parseFloat(panel.querySelector('#mj-lo').value);
      const hi = parseFloat(panel.querySelector('#mj-hi').value);
      const out = panel.querySelector('#mj-output');
      if (isNaN(lo) || isNaN(hi) || lo > hi) {
        out.innerHTML = '<div class="mj-result" style="border-color:#f87171;color:#f87171">Enter a valid range (lower ≤ upper).</div>';
        return;
      }
      reveal(lo, hi);
    };
  }

  function reveal(lo, hi) {
    const trueAge = state.targetAge;
    const output = document.getElementById('mj-output');
    const data = window.appAPI.getDentalData();
    const map = window.appAPI.getTeethMap();

    const hit = trueAge >= lo && trueAge <= hi;
    const span = hi - lo;
    let verdict;
    if (hit && span <= 3) verdict = '<span class="ok">Tight and correct.</span>';
    else if (hit)         verdict = '<span class="near">Correct but wide.</span>';
    else                  verdict = '<span class="no">Missed.</span>';

    const present = presentTeeth(trueAge);
    const dec  = present.filter(t => t.isDec).length;
    const perm = present.filter(t => !t.isDec).length;

    const upcoming = [];
    for (const fdi in map) {
      const d = data.deciduousTeeth?.[fdi] || data.permanentTeeth?.[fdi];
      if (!d) continue;
      if (d.eruption > trueAge && d.eruption - trueAge < 3) {
        const rng = d.eruptionRange ? d.eruptionRange.join('–') + ' yr' : d.eruption + ' yr';
        upcoming.push(`${fdi} — ${d.name} (erupts ${rng})`);
      }
    }

    output.innerHTML = `
      <div class="mj-result">
        <div>True age: <span class="true-age">${trueAge.toFixed(1)} yr</span> ${verdict}</div>
        <div class="section"><b>Teeth present:</b> ${dec} deciduous · ${perm} permanent</div>
        <div class="section"><b>Exam logic:</b> find the tooth that has <i>just erupted</i>.
          If the next tooth in the textbook order has not erupted, the age lies between
          their eruption ranges. Take the lower bound if the previous tooth just erupted;
          the upper bound if the next tooth is about to erupt.</div>
        ${upcoming.length ? `<div class="section"><b>Next expected (within 3 yr):</b><br>${upcoming.slice(0,6).join('<br>')}</div>` : ''}
      </div>
    `;

    const ageValue = document.getElementById('age-value');
    if (ageValue) ageValue.textContent = trueAge.toFixed(1);
  }

  function open() {
    if (!state.active) startNewRound();
    else document.getElementById('mj-panel').classList.remove('hidden');
  }

  function close() {
    document.getElementById('mj-panel').classList.add('hidden');
    state.active = false;
    const slider = document.getElementById('ageSlider');
    if (slider) slider.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function init() {
    injectStyles();
    const btn = document.createElement('button');
    btn.id = 'mj-btn';
    btn.textContent = 'Mystery Jaw';
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'mj-panel';
    panel.className = 'hidden';
    document.body.appendChild(panel);

    btn.onclick = open;
    console.log('MysteryJaw ready');
  }

  return { init };
})();

window.MysteryJaw = MysteryJaw;
