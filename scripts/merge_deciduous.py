import bpy, os
from mathutils import Matrix, Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspaces/forensic-odontology/models/anatomy_backup.glb")

DEC_DIR = "/workspaces/forensic-odontology/deciduous_clean"
SCALE = 0.75

LEFT_TO_PERM = {
    "61": "21", "62": "22", "63": "23", "64": "24", "65": "25",
    "71": "31", "72": "32", "73": "33", "74": "34", "75": "35",
}
LEFT_TO_RIGHT = {
    "61": "51", "62": "52", "63": "53", "64": "54", "65": "55",
    "71": "81", "72": "82", "73": "83", "74": "84", "75": "85",
}

def world_center(obj):
    pts = []
    def walk(o):
        if o.type == 'MESH':
            mw = o.matrix_world
            for v in o.data.vertices:
                pts.append(mw @ v.co)
        for ch in o.children:
            walk(ch)
    walk(obj)
    if not pts:
        return None
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    return Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))

# Permanent tooth target centers
targets = {}
for left, perm in LEFT_TO_PERM.items():
    p = bpy.data.objects.get(f"tooth_{perm}")
    if not p:
        print(f"WARN missing tooth_{perm}")
        continue
    c = world_center(p)
    targets[left] = c
    print(f"tooth_{perm} center=({c.x:.4f},{c.y:.4f},{c.z:.4f})")

created = {}

for fname in sorted(os.listdir(DEC_DIR)):
    if not fname.startswith('primary_') or not fname.endswith('.glb'):
        continue
    fdi = fname.replace('.glb','').split('_')[-1]
    if fdi not in targets:
        continue

    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=os.path.join(DEC_DIR, fname))

    meshes = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not meshes:
        print(f"WARN no mesh {fname}")
        continue

    # Unparent keeping world transform
    for m in meshes:
        if m.parent:
            mw = m.matrix_world.copy()
            m.parent = None
            m.matrix_world = mw

    # Bake world matrix into vertex data
    for m in meshes:
        m.data.transform(m.matrix_world)
        m.matrix_world = Matrix.Identity(4)

    # Compute bbox center
    pts = []
    for m in meshes:
        for v in m.data.vertices:
            pts.append(v.co)
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    c_cur = Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))
    c_tgt = targets[fdi]

    # Scale about center, then translate to target
    M = Matrix.Translation(c_tgt) @ Matrix.Scale(SCALE, 4) @ Matrix.Translation(-c_cur)
    for m in meshes:
        m.data.transform(M)

    # Join sub-meshes
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    joined = meshes[0]

    # Create container at target, parent mesh to it
    container = bpy.data.objects.new(f"tooth_{fdi}", None)
    container.location = c_tgt
    bpy.context.collection.objects.link(container)

    joined.parent = container
    joined.matrix_parent_inverse = Matrix.Identity(4)
    joined.matrix_basis = Matrix.Identity(4)
    # Since we baked to world, we need the local verts relative to container
    # Easier: leave joined in world, then when container moves, joined moves with it
    # But we already baked to world, so we need to REPOSITION joined to container origin
    # Solution: bake -c_tgt into joined, then let container hold c_tgt
    joined.data.transform(Matrix.Translation(-c_tgt))

    created[fdi] = (container, joined)
    print(f"placed tooth_{fdi} at ({c_tgt.x:.4f},{c_tgt.y:.4f},{c_tgt.z:.4f})")

# Mirror
for left_fdi, (cont, mesh) in created.items():
    right_fdi = LEFT_TO_RIGHT[left_fdi]

    new_data = mesh.data.copy()
    for v in new_data.vertices:
        v.co.x *= -1
    new_data.flip_normals()

    new_mesh = bpy.data.objects.new(f"tooth_{right_fdi}_mesh", new_data)
    bpy.context.collection.objects.link(new_mesh)

    new_cont = bpy.data.objects.new(f"tooth_{right_fdi}", None)
    new_cont.location = Vector((-cont.location.x, cont.location.y, cont.location.z))
    bpy.context.collection.objects.link(new_cont)

    new_mesh.parent = new_cont
    new_mesh.matrix_parent_inverse = Matrix.Identity(4)
    new_mesh.matrix_basis = Matrix.Identity(4)

    print(f"mirrored tooth_{left_fdi} -> tooth_{right_fdi}")

# Final bbox
all_pts = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        mw = o.matrix_world
        for v in o.data.vertices:
            all_pts.append(mw @ v.co)
xs = [p.x for p in all_pts]; ys = [p.y for p in all_pts]; zs = [p.z for p in all_pts]
print(f"\nFinal bbox: X[{min(xs):.3f},{max(xs):.3f}]  Y[{min(ys):.3f},{max(ys):.3f}]  Z[{min(zs):.3f},{max(zs):.3f}]")

n = sum(1 for o in bpy.data.objects if o.type == 'EMPTY' and o.name.startswith('tooth_'))
print(f"Total tooth containers: {n}")

OUT = "/workspaces/forensic-odontology/models/anatomy.glb"
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    use_selection=True, export_apply=True, export_yup=True,
    export_materials='NONE',
)
print(f"Exported: {OUT}")
