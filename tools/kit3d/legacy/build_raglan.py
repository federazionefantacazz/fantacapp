# Converte il progetto CLO (pieces.pkl estratto da garment.pac) nel modello raglan dell'app.
import pickle, json, struct, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SCR = sys.argv[1]; OUT = sys.argv[2]
P = pickle.load(open(SCR + '/pieces.pkl', 'rb'))
NAMES = ['front', 'back', 'sleeveR', 'sleeveL', 'collar']   # 2 = x>0 = manica destra guardando
S = 0.00084  # unità texture per mm
ORIGIN = {'front': (.06, .06), 'back': (.53, .06), 'sleeveL': (.08, .67), 'sleeveR': (.53, .67), 'collar': (.332, .02)}

def to_world(p):
    q = p.astype(np.float64).copy()
    q[:, 0] = (q[:, 0] - 24.0) / 1000
    q[:, 1] = q[:, 1] / 1000 + 0.9205
    q[:, 2] = (q[:, 2] - 33.9) / 1000 + 0.0046
    return q

pieces = {}
for i, name in enumerate(NAMES):
    d = P[i]
    pos = to_world(d['P']); tri = d['tri'].astype(np.int64)
    R = d['R'].astype(np.float64)
    # verso delle facce: le normali devono uscire dal corpo
    a, b, c = pos[tri[:, 0]], pos[tri[:, 1]], pos[tri[:, 2]]
    fn = np.cross(b - a, c - a); cen = (a + b + c) / 3
    axis = np.array([0, 0, 0.0046])
    out = cen.copy(); out[:, 1] = 0; out -= np.array([0, 0, 0.0046])
    if name.startswith('sleeve'): out = cen - np.array([0, 1.45, 0.0046]); out[:, 1] *= .3
    s = np.sign((fn * out).sum(1)).mean()
    if s < 0: tri = tri[:, [0, 2, 1]]
    # orientamento del cartamodello: il davanti visto da fuori (u cresce con x), il dietro visto da dietro (u cresce con -x)
    cx = np.corrcoef(R[:, 0], pos[:, 0])[0, 1]
    print(name, 'verts', len(pos), 'flip faces', s < 0, 'corr u/x %.2f' % cx)
    pieces[name] = dict(pos=pos, tri=tri, R=R, cx=cx)

# cucitura raglan più curva (verso la spalla), come le maglie raglan moderne
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import curve
CURVE = float(sys.argv[3]) if len(sys.argv) > 3 else 22.0  # mm
if CURVE > 0: curve.curve_raglan(pieces, A=CURVE)

# u/v nella texture (riquadri dei cartamodelli originali)
UVR = {}
for name, d in pieces.items():
    R = d['R']; mn, mx = d.get('bbox', (R.min(0), R.max(0)))
    ox, oy = ORIGIN[name]
    u = ox + (R[:, 0] - mn[0]) * S
    v = oy + (mx[1] - R[:, 1]) * S
    d['uv'] = np.stack([u, v], 1)
    d['hem'] = (R[:, 1] - mn[1]) * S  # distanza dal fondo (per orlo/polsino), in unità texture
    UVR[name] = dict(x=round(ox, 4), y=round(oy, 4), w=round((mx[0] - mn[0]) * S, 4), h=round((mx[1] - mn[1]) * S, 4))
print(json.dumps(UVR))
json.dump(UVR, open(SCR + '/uv_raglan.json', 'w'))

# normali
def vnormals(pos, tri):
    n = np.zeros_like(pos)
    fn = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
    for k in range(3): np.add.at(n, tri[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)

# ------------------------------------------------------------ GLB (KHR_mesh_quantization)
buf = bytearray(); views = []; accs = []; meshes = []; nodes = []
def add_view(data, target=None, stride=None):
    while len(buf) % 4: buf.append(0)
    off = len(buf); buf.extend(data)
    v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
    if target: v['target'] = target
    if stride: v['byteStride'] = stride
    views.append(v); return len(views) - 1
def add_acc(view, ctype, count, typ, norm=False, mn=None, mx=None):
    a = {'bufferView': view, 'componentType': ctype, 'count': count, 'type': typ}
    if norm: a['normalized'] = True
    if mn is not None: a['min'] = mn; a['max'] = mx
    accs.append(a); return len(accs) - 1

for name in ['sleeveR', 'front', 'sleeveL', 'back', 'collar']:
    d = pieces[name]; pos = d['pos']; tri = d['tri']; n = d['nrm'] if 'nrm' in d else vnormals(pos, tri)
    lo = pos.min(0); hi = pos.max(0); ctr = (lo + hi) / 2; half = (hi - lo).max() / 2
    q = np.round((pos - ctr) / half * 32767).astype(np.int16)
    q4 = np.zeros((len(q), 4), np.int16); q4[:, :3] = q
    pa = add_acc(add_view(q4.tobytes(), 34962, 8), 5122, len(q), 'VEC3', True, q.min(0).tolist(), q.max(0).tolist())
    nq = np.zeros((len(n), 4), np.int8); nq[:, :3] = np.round(n * 127).astype(np.int8)
    na = add_acc(add_view(nq.tobytes(), 34962, 4), 5120, len(n), 'VEC3', True)
    uq = np.round(np.clip(d['uv'], 0, 1) * 65535).astype(np.uint16)
    ua = add_acc(add_view(uq.tobytes(), 34962, 4), 5123, len(uq), 'VEC2', True)
    ia = add_acc(add_view(tri.astype(np.uint16).tobytes(), 34963), 5123, tri.size, 'SCALAR')
    attrs = {'POSITION': pa, 'NORMAL': na, 'TEXCOORD_0': ua}
    meshes.append({'name': name, 'primitives': [{'attributes': attrs, 'indices': ia, 'material': 0}, {'attributes': attrs, 'indices': ia, 'material': 1}]})
    nodes.append({'name': 'raglan_' + name, 'mesh': len(meshes) - 1, 'translation': ctr.tolist(), 'scale': [half] * 3})

# ------------------------------------------------------------ maschera, normal map, cuciture
T = 2048
def raster(size, which=None):
    img = Image.new('L', (size, size), 0); dr = ImageDraw.Draw(img)
    for name, d in pieces.items():
        if which and name not in which: continue
        uv = d['uv'] * size
        for t in d['tri']: dr.polygon([tuple(uv[k]) for k in t], fill=255)
    return np.array(img)

mask = (ndimage.binary_closing(raster(1024) > 127, iterations=1) * 255).astype(np.uint8)
Image.fromarray(np.dstack([np.full_like(mask, 255)] * 3 + [mask])).save(OUT + '/mask-raglan.png', optimize=True)

# per ogni pezzo: distanza dal bordo (px a 2048) e distanza dal fondo (orlo)
height = np.zeros((T, T)); stitch = np.zeros((T, T))
px_mm = S * T  # px per mm
for name, d in pieces.items():
    m = ndimage.binary_closing(raster(T, [name]) > 127, iterations=2)  # nessuna fessura lungo la vecchia cucitura
    dist = ndimage.distance_transform_edt(m)
    # distanza dal fondo: v del fondo del pezzo
    r = UVR[name]; bottom = (r['y'] + r['h']) * T
    yy = np.arange(T)[:, None].repeat(T, 1).astype(float)
    hemd = bottom - yy
    seamd = dist.copy()
    is_body = name != 'collar'
    if is_body:
        # vicino al fondo il bordo è l'orlo, non una cucitura: lì niente bordino della cucitura
        seamd = np.where(hemd < dist + 1, 1e9, dist)
    # stoffa che scende nella cucitura (bordino di ~3 mm)
    w = 3.2 * px_mm
    h = np.where(m, 1 - np.exp(-seamd / w), 0)
    if is_body:
        # orlo / polsino ripiegato: leggero gradino a ~20 mm
        hem_mm = 22 if name in ('front', 'back') else 18
        h = h - np.where(m, 0.35 * (1 / (1 + np.exp(-(hem_mm * px_mm - hemd) / (0.8 * px_mm)))), 0)
        # doppia impuntura sull'orlo
        for mm in (hem_mm - 3, hem_mm - 9):
            stitch = np.maximum(stitch, np.where(m, np.exp(-((hemd - mm * px_mm) / (0.45 * px_mm)) ** 2), 0))
    # impuntura lungo le cuciture (a ~5 mm)
    stitch = np.maximum(stitch, np.where(m & (seamd < 1e8), np.exp(-((seamd - 5 * px_mm) / (0.45 * px_mm)) ** 2), 0))
    height = np.where(m, h, height)

# punti dell'impuntura: tratteggio
yy, xx = np.mgrid[0:T, 0:T]
dash = (np.sin((xx + yy) * 2 * np.pi / (2.6 * px_mm)) > -0.2).astype(float)
st = stitch * dash
H = height * 1.0 - st * 0.25
gy, gx = np.gradient(ndimage.gaussian_filter(H, 0.8))
k = 2.2
nx, ny, nz = -gx * k, gy * k, np.ones_like(H)  # +Y verso l'alto della texture
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
nmap = np.dstack([(nx / ln + 1) * 127.5, (ny / ln + 1) * 127.5, (nz / ln + 1) * 127.5]).clip(0, 255).astype(np.uint8)
Image.fromarray(nmap).save(SCR + '/normal-raglan.jpg', quality=88)

seams = 255 - (st * 70 + np.clip(1 - height, 0, 1) * 0 ).clip(0, 255)
allm = raster(T) > 127
seams = np.where(allm, seams, 255)
Image.fromarray(seams.astype(np.uint8)).resize((1024, 1024), Image.LANCZOS).convert('RGB').save(OUT + '/seams-raglan.jpg', quality=90)

nimg = open(SCR + '/normal-raglan.jpg', 'rb').read()
iv = add_view(nimg)
images = [{'name': 'normal.jpg', 'mimeType': 'image/jpeg', 'bufferView': iv}]
mats = [
    {'name': 'shirt_outer', 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.72}, 'normalTexture': {'index': 0}, 'extensions': {'KHR_materials_specular': {'specularFactor': 0.15}}},
    {'name': 'shirt_inner_flip', 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.98}, 'extensions': {'KHR_materials_specular': {'specularFactor': 0.15}}}
]
while len(buf) % 4: buf.append(0)
gl = {'asset': {'version': '2.0', 'generator': 'fantacapp raglan (CLO)'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}],
      'nodes': nodes, 'meshes': meshes, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(buf)}],
      'materials': mats, 'images': images, 'textures': [{'source': 0, 'sampler': 0}],
      'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
      'extensionsUsed': ['KHR_mesh_quantization', 'KHR_materials_specular'], 'extensionsRequired': ['KHR_mesh_quantization']}
js = json.dumps(gl, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(buf), 0x004E4942) + bytes(buf)
open(OUT + '/shirt-raglan.glb', 'wb').write(glb)
print('glb', len(glb))

# linea della spalla sulle maniche: per ogni fascia orizzontale del cartamodello, il punto più alto in 3D
SH = {}
for name in ('sleeveL', 'sleeveR'):
    d = pieces[name]; uv = d['uv']; pos = d['pos']; r = UVR[name]
    rows = []
    for f in np.linspace(0.02, 0.98, 25):
        v = r['y'] + f * r['h']
        sel = np.abs(uv[:, 1] - v) < r['h'] * 0.02
        if sel.sum() < 5: continue
        idx = np.where(sel)[0]
        # in alto e verso l'esterno: braccia un po' abbassate, conta la direzione perpendicolare al braccio
        sx = np.sign(pos[idx, 0].mean())
        score = pos[idx, 1] * 1.0 + np.abs(pos[idx, 0]) * 0.0
        i = idx[np.argmax(score)]
        rows.append((round(f, 3), round((uv[i, 0] - r['x']) / r['w'], 3), round(pos[i, 1], 3)))
    SH[name] = rows
    print(name, rows)
