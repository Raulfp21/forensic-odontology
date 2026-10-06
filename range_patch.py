def patch(fn, pairs):
    s = open(fn).read()
    for old, new, label in pairs:
        if new in s: print("SKIP", fn, label, "(already applied)")
        elif old in s: s = s.replace(old, new, 1); print("OK  ", fn, label)
        else: print("WARN", fn, label, "- pattern not found")
    open(fn, 'w').write(s)

# ---- main.js: teeth grow in across the textbook range, not at one age ----
patch('main.js', [
 ("function updateAge(age) {",
  "// Textbook gives eruption as a RANGE (people vary). A tooth first appears at the\n"
  "// range start and finishes erupting at the range end. Min width keeps very narrow\n"
  "// ranges (e.g. deciduous canine, ~1 month) visible as a short animation.\n"
  "function eruptWindow(data, fallbackWidth) {\n"
  "  const r = data.eruptionRange;\n"
  "  if (r && r.length === 2) return [r[0], Math.max(r[1], r[0] + 0.25)];\n"
  "  return [data.eruption, data.eruption + fallbackWidth];\n"
  "}\n\nfunction updateAge(age) {", "add eruptWindow helper"),
 ("let d = 0, p = 0, w = 0;", "let d = 0, p = 0, w = 0, er = 0;", "erupting counter"),
 ("const start = t.data.eruption, end = t.data.fall;",
  "const [start, hiE] = eruptWindow(t.data, 0.5), end = t.data.fall;", "deciduous window"),
 ("    let s = 1;\n    if (age < start + 0.5) s = 0.4 + 1.2 * (age - start);\n    else if (age > end - 1.0) s = Math.max(0.1, 1.0 - (age - (end - 1.0)));\n",
  "    const ep = THREE.MathUtils.clamp((age - start) / (hiE - start), 0, 1);\n"
  "    let s = 0.4 + 0.6 * ep;\n    if (ep < 1) er++;\n"
  "    if (age > end - 1.0) s = Math.min(s, Math.max(0.1, 1.0 - (age - (end - 1.0))));\n", "deciduous grow across range"),
 ("    if (age < t.data.eruption) { t.group.visible = false; t.group.scale.setScalar(1); continue; }\n"
  "    const pp = THREE.MathUtils.clamp((age - t.data.eruption) / 0.6, 0, 1);\n"
  "    t.group.visible = true;\n    t.group.scale.setScalar(0.4 + 0.6 * pp);\n    p++;\n",
  "    const [lo, hi] = eruptWindow(t.data, 0.6);\n"
  "    if (age < lo) { t.group.visible = false; t.group.scale.setScalar(1); continue; }\n"
  "    const pp = THREE.MathUtils.clamp((age - lo) / (hi - lo), 0, 1);\n"
  "    t.group.visible = true;\n    t.group.scale.setScalar(0.4 + 0.6 * pp);\n    if (pp < 1) er++;\n    p++;\n", "permanent grow across range"),
 ("else info.textContent = masked ? `${d} deciduous · ${p} permanent` : `${d} deciduous · ${p} permanent · jaw ${Math.round(growth * 100)}%`;",
  "else { const eTxt = er ? ` (${er} still erupting)` : ''; info.textContent = `${d} deciduous · ${p} permanent${eTxt}` + (masked ? '' : ` · jaw ${Math.round(growth * 100)}%`); }",
  "corner text shows erupting count"),
])

# ---- fdi_chart.js: test pool uses range start; explain WHY a range ----
patch('fdi_chart.js', [
 ("if(age<d.eruption) continue;",
  "if(age<(d.eruptionRange?d.eruptionRange[0]:d.eruption)) continue;", "test pool matches jaw"),
 ("if the next is about to erupt.</div>",
  "if the next is about to erupt.<br><br><b>Why a range?</b> Eruption varies between people: girls tend to be earlier, and nutrition, climate, ethnicity and endocrine disease all shift it. So report an age <i>range</i>, never a single age.</div>",
  "why-a-range note"),
])

# ---- mystery_jaw.js: same range logic ----
patch('mystery_jaw.js', [
 ("const erupted = all.filter(t => t.e <= age);\n    const pending = all.filter(t => t.e > age);",
  "const erupted = all.filter(t => t.r[0] <= age);   // visible on the jaw = range has started\n    const pending = all.filter(t => t.r[0] > age);",
  "bracket uses range start"),
 ("    let dec = 0, perm = 0;\n    for (const fdi in map) if (map[fdi].group.visible) ('5678'.includes(fdi[0]) ? dec++ : perm++);",
  "    let dec = 0, perm = 0, erupting = 0;\n    for (const fdi in map) if (map[fdi].group.visible) {\n"
  "      ('5678'.includes(fdi[0]) ? dec++ : perm++);\n"
  "      const d = data.deciduousTeeth[fdi] || data.permanentTeeth[fdi];\n"
  "      if (d && d.eruptionRange && age < d.eruptionRange[1]) erupting++;\n    }",
  "count erupting teeth"),
 ("${dec} deciduous · ${perm} permanent</div>",
  "${dec} deciduous · ${perm} permanent${erupting ? ` (${erupting} still erupting)` : ''}</div>", "show erupting in reveal"),
 ("Lower bound from the last tooth to erupt, upper bound from the next one due (Tables 4.8/4.9). Slider is unlocked: drag to see the neighbouring ages.",
  "Lower bound from the last tooth to erupt, upper bound from the next one due (Tables 4.8/4.9). These are population ranges, not rules: sex, nutrition, climate, ethnicity and endocrine disease shift eruption, which is why you report a range. Slider is unlocked: drag to see the neighbouring ages.",
  "variation justification"),
])
