"""Explicit installation only. Inference never downloads model files."""
import hashlib
from pathlib import Path
import urllib.request

root = Path(__file__).resolve().parent.parent / 'data' / 'style'
root.mkdir(parents=True, exist_ok=True)
base = 'https://essentia.upf.edu/models/music-style-classification/discogs-effnet/'
files = [
    ('discogs-effnet-bsdynamic-1.onnx', 'discogs-effnet.onnx', 'a280825b334797cf677939db8cd5762c0392aedd0ca6415dbc1cd083f045e43c'),
    ('discogs-effnet-bsdynamic-1.json', 'metadata.json', '1e140159496f7f932e4267b478e246bd60fbd526a7a67d3e12684a2978916420'),
]
for remote, local, expected in files:
    path = root / local
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == expected:
        continue
    with urllib.request.urlopen(base + remote, timeout=120) as response:
        content = response.read(32 * 1024 * 1024)
    if hashlib.sha256(content).hexdigest() != expected:
        raise RuntimeError('Modell-Prüfsumme stimmt nicht: ' + remote)
    temporary = path.with_suffix('.download')
    temporary.write_bytes(content)
    temporary.replace(path)
print('Discogs-EffNet lokal bereit.')
