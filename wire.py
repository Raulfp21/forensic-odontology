import re,sys
def patch(fn, pairs):
    s=open(fn).read()
    for old,new,label in pairs:
        if new in s: print("SKIP", fn, label, "(already applied)")
        elif old in s: s = s.replace(old, new, 1); print("OK  ", fn, label)
        else: print("WARN",fn,label,"- pattern not found")
    open(fn,'w').write(s)

patch('main.js',[
 ("else info.textContent = `${d}D · ${p}P · ${w}W · jaw ${Math.round(growth * 100)}%`;",
  "else info.textContent = `${d} deciduous · ${p} permanent · jaw ${Math.round(growth * 100)}%`;",
  "plain-English corner text"),
 ("document.getElementById('age-value').textContent = age.toFixed(1);",
  "const masked = document.body.classList.contains('mj-active');\n  document.getElementById('age-value').textContent = masked ? '?' : age.toFixed(1);",
  "mask age label"),
 ("else info.textContent = `${d} deciduous · ${p} permanent · jaw ${Math.round(growth * 100)}%`;",
  "else info.textContent = masked ? `${d} deciduous · ${p} permanent` : `${d} deciduous · ${p} permanent · jaw ${Math.round(growth * 100)}%`;",
  "hide jaw% during round"),
])
patch('fdi_chart.js',[
 ("const a = parseFloat(b.dataset.age);",
  "if (document.body.classList.contains('mj-active')) return;\n    const a = parseFloat(b.dataset.age);",
  "block Set-age during round (only needed if you added the Set-age button)"),
])
patch('index.html',[
 ("</body>",
  "<script type=\"module\">\n  import \"./mystery_jaw.js\";\n  window.MysteryJaw.init();\n</script>\n</body>",
  "load mystery_jaw"),
])
