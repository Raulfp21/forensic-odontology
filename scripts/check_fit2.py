import sys, re, bpy
GLB = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
bpy.context.view_layer.update()
from mathutils import Vector
from mathutils.bvhtree import BVHTree

TOOTH = re.compile(r"^tooth_(\d\d)(?:\.\d+)?$")
def in_tooth(o):
    while o:
        if o.name.startswith("tooth_"): return True
        o = o.parent
    return False
def meshes_under(o):
    out = [o] if o.type == 'MESH' else []
    for c in o.children: out += meshes_under(c)
    return out

verts, polys = [], []
for o in bpy.data.objects:
    if o.type == 'MESH' and not in_tooth(o):
        base = len(verts)
        verts += [o.matrix_world @ v.co for v in o.data.vertices]
        polys += [[base + i for i in p.vertices] for p in o.data.polygons]
bvh = BVHTree.FromPolygons(verts, polys)

AX = "XYZ"
crowns = []
for o in sorted(bpy.data.objects, key=lambda o: o.name):
    m = TOOTH.match(o.name)
    if not m: continue
    fdi = m.group(1)
    pts = [mm.matrix_world @ v.co for mm in meshes_under(o) for v in mm.data.vertices]
    if not pts: continue
    sgn = 1 if fdi[0] in "1256" else -1          # +1 = root points toward +Z
    z0 = min(p.z * sgn for p in pts)
    L = max(p.z * sgn for p in pts) - z0
    root, crown = [], []
    for p in pts[::3]:
        t = (p.z * sgn - z0) / L                  # 0 = crown end, 1 = apex
        if 0.3 < t < 0.5: continue
        loc, nrm, idx, dist = bvh.find_nearest(p)
        out = (p - loc).dot(nrm) > 0 and dist > 0.01 * L
        if t >= 0.5: root.append((out, dist, p - loc))
        else: crown.append(out)
    ro = [r for r in root if r[0]]
    cpct = 100 * sum(crown) / max(1, len(crown))
    crowns.append(cpct)
    if ro:
        s = sum((r[2] for r in ro), Vector())
        k = max(range(3), key=lambda i: abs(s[i]))
        info = f"max {max(r[1] for r in ro)/L:.2f} x len, mostly {'+' if s[k] > 0 else '-'}{AX[k]}"
    else:
        info = "-"
    print(f"{fdi}: root outside {100*len(ro)/len(root):3.0f}%  ({info})  | crown outside {cpct:3.0f}%")
print("avg crown outside: %.0f%%" % (sum(crowns) / len(crowns)))
