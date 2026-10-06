import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="models/anatomy.glb")
bpy.context.view_layer.update()
def in_tooth(o):
    while o:
        if o.name.startswith("tooth_"): return True
        o = o.parent
    return False
neg = 0
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    d = o.matrix_world.determinant()
    if d < 0:
        neg += 1
        print("DET negative:", o.name, round(d, 3))
    if not in_tooth(o):
        print("BONE:", o.name, "scale", tuple(round(x, 3) for x in o.matrix_world.to_scale()), "det", round(d, 3))
print("DET negative count:", neg)
