import bpy, os
from mathutils import Matrix

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspaces/forensic-odontology/models/anatomy.glb")

SOLIDIFY_THICKNESS = 0.0006

def collect_meshes_under(parent_name):
    parent = bpy.data.objects.get(parent_name)
    if not parent:
        return []
    out = []
    def walk(o):
        if o.type == 'MESH':
            out.append(o)
        for ch in o.children:
            walk(ch)
    walk(parent)
    return out

bone_names = ["Mandible", "Maxilla.l", "Maxilla.r"]
all_bone_meshes = []
for name in bone_names:
    all_bone_meshes.extend(collect_meshes_under(name))
all_bone_meshes = list({id(m): m for m in all_bone_meshes}.values())

print(f"Bone meshes: {[m.name for m in all_bone_meshes]}")

for m in all_bone_meshes:
    for mod in list(m.modifiers):
        if mod.type == 'SOLIDIFY':
            m.modifiers.remove(mod)
    mod = m.modifiers.new("Thicken", 'SOLIDIFY')
    mod.thickness = SOLIDIFY_THICKNESS
    mod.offset = -1.0
    mod.use_rim = True
    print(f"Added Solidify to {m.name}")

bpy.context.view_layer.update()
for m in all_bone_meshes:
    bpy.context.view_layer.objects.active = m
    m.select_set(True)
    for mod in list(m.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            print(f"  apply failed: {e}")
    m.select_set(False)

bpy.context.view_layer.update()
all_pts = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        mw = o.matrix_world
        for v in o.data.vertices:
            all_pts.append(mw @ v.co)
xs = [p.x for p in all_pts]; ys = [p.y for p in all_pts]; zs = [p.z for p in all_pts]
print(f"\nFinal bbox: X[{min(xs):.4f},{max(xs):.4f}]  Y[{min(ys):.4f},{max(ys):.4f}]  Z[{min(zs):.4f},{max(zs):.4f}]")

OUT = "/workspaces/forensic-odontology/models/anatomy.glb"
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    use_selection=True, export_apply=True, export_yup=True,
    export_materials='NONE',
)
print(f"Exported: {OUT}")
