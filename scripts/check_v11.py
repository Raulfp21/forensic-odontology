import bpy, bmesh, re, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspaces/forensic-odontology/models/anatomy_" + __import__("os").environ.get("MODEL", "v11") + ".glb")
bpy.context.view_layer.update()
MM = 1000.0   # scene units are metres

def tooth_of(o):
    while o:
        if re.match(r"^tooth_\d{2}$", o.name): return o.name[6:]
        o = o.parent
    return None

def wverts(o):
    a = np.empty(len(o.data.vertices) * 3, dtype=np.float32)
    o.data.vertices.foreach_get("co", a)
    a = a.reshape(-1, 3).astype(np.float64)
    M = np.array(o.matrix_world)
    return a @ M[:3, :3].T + M[:3, 3]

bone, teeth = [], {}
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    f = tooth_of(o)
    if f: teeth.setdefault(f, []).append(o)
    else: bone.append(o)
print(f"V11C bone meshes: {len(bone)}, tooth groups: {len(teeth)}")

verts, tris, off = [], [], 0
for o in bone:
    V = wverts(o); lo, hi = V.min(0) * MM, V.max(0) * MM
    bm = bmesh.new(); bm.from_mesh(o.data)
    nm = sum(1 for e in bm.edges if not e.is_manifold); bm.free()
    print(f"V11C bone {o.name[:28]:28s} verts={len(V)} nonmanifold_edges={nm} "
          f"x[{lo[0]:.0f},{hi[0]:.0f}] y[{lo[1]:.0f},{hi[1]:.0f}] z[{lo[2]:.0f},{hi[2]:.0f}] mm")
    o.data.calc_loop_triangles()
    verts += [Vector(p) for p in V]
    tris += [tuple(off + i for i in t.vertices) for t in o.data.loop_triangles]
    off += len(V)
bvh = BVHTree.FromPolygons(verts, tris)

def inside(p):
    votes = 0
    for d in (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))):
        n, org = 0, Vector(p)
        for _ in range(40):
            hit = bvh.ray_cast(org, d)
            if hit[0] is None: break
            n += 1; org = hit[0] + d * 1e-6
        votes += n % 2
    return votes >= 2

def margin(p, d):
    hit = bvh.ray_cast(Vector(p), d)
    return "none" if hit[0] is None else f"{hit[3] * MM:.1f}mm"

rng = np.random.default_rng(0)
print("V11C fdi roots_in_bone  tip_margin  behind_margin(7s,8s)")
for f in sorted(teeth):
    if int(f[0]) > 4: continue
    V = np.vstack([wverts(o) for o in teeth[f]])
    zmin, zmax = V[:, 2].min(), V[:, 2].max(); h = zmax - zmin
    up = f[0] in "12"
    root = V[V[:, 2] > zmax - 0.45 * h] if up else V[V[:, 2] < zmin + 0.45 * h]
    idx = rng.choice(len(root), min(150, len(root)), replace=False)
    pct = 100 * np.mean([inside(root[i]) for i in idx])
    tip = root[np.argmax(root[:, 2])] if up else root[np.argmin(root[:, 2])]
    tm = margin(tip, Vector((0, 0, 1 if up else -1)))
    bm_ = margin(V[np.argmax(V[:, 1])], Vector((0, 1, 0))) if f[1] in "78" else "-"
    print(f"V11C {f}  {pct:5.0f}%        {tm:>8s}    {bm_}")
