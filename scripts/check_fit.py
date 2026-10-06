import sys, re, bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
GLB = argv[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
bpy.context.view_layer.update()
print("FILE:", GLB)

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

bones = [o for o in bpy.data.objects if o.type == 'MESH' and not in_tooth(o)]
print("bone meshes:", [o.name for o in bones])
verts, polys = [], []
for o in bones:
    base = len(verts)
    verts += [o.matrix_world @ v.co for v in o.data.vertices]
    polys += [[base + i for i in p.vertices] for p in o.data.polygons]
bvh = BVHTree.FromPolygons(verts, polys)

teeth = {}
for o in bpy.data.objects:
    m = TOOTH.match(o.name)
    if m: teeth[m.group(1)] = o
print("teeth found:", len(teeth))

DIRS = [Vector(d) for d in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1))]
for fdi in sorted(teeth):
    ms = meshes_under(teeth[fdi])
    pts = [m.matrix_world @ v.co for m in ms for v in m.data.vertices]
    if not pts:
        print(f"{fdi}: NO MESH under {teeth[fdi].name} (type {teeth[fdi].type})")
        continue
    upper = fdi[0] in "1256"
    zs = [p.z for p in pts]
    length = max(zs) - min(zs)
    apex = max(pts, key=lambda p: p.z) if upper else min(pts, key=lambda p: p.z)
    out = Vector((0, 0, 1 if upper else -1))
    d_out = bvh.ray_cast(apex, out)[3]
    n_hit = sum(1 for d in DIRS if bvh.ray_cast(apex, d)[3] is not None)
    if d_out is not None:
        info = f"bone beyond apex = {d_out/length:.2f} x length"
    else:
        d_in = bvh.ray_cast(apex, -out)[3]
        info = "NO bone beyond apex"
        if d_in is not None:
            info += f", tip sticks out ~{d_in/length:.2f} x length"
    flag = "  <-- OUT?" if d_out is None or n_hit < 6 else ""
    print(f"{fdi}: {info}, dirs hit {n_hit}/6{flag}")
print("DONE")
