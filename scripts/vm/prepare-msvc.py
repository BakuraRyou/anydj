"""Extract the official x64 CRT for app-local Python build environments."""
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import urllib.request
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
cache = root / '.build/vm/msvc'
cache.mkdir(parents=True, exist_ok=True)
installer = cache / 'vc_redist.x64.exe'
if not installer.exists():
    temporary = installer.with_suffix('.download')
    with urllib.request.urlopen('https://aka.ms/vc14/vc_redist.x64.exe', timeout=120) as source, temporary.open('wb') as target:
        size = 0
        while chunk := source.read(1024 * 1024):
            size += len(chunk)
            if size > 64 * 1024 * 1024:
                raise RuntimeError('Unexpected Microsoft runtime package size')
            target.write(chunk)
    temporary.replace(installer)

def extract(source, destination):
    destination.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(['7z', 'x', '-y', '-bd', '-bso0', '-o' + str(destination), str(source)], capture_output=True)
    # Signed CABs contain a certificate trailer, reported as a harmless warning.
    if result.returncode not in (0, 1):
        raise RuntimeError('Microsoft runtime extraction failed')

extract(installer, cache / 'extracted')
manifest = ET.parse(cache / 'extracted/0').getroot()
payloads = [item.attrib for item in manifest.iter() if item.tag.endswith('Payload')]
selected = [item for item in payloads if 'vcRuntimeMinimum_amd64' in item.get('FilePath', '') and item['FilePath'].endswith('cab1.cab')]
if len(selected) != 1:
    raise RuntimeError('Expected x64 runtime CAB missing from vendor manifest')
content = installer.read_bytes()
candidates = []
position = 0
while True:
    at = content.find(b'MSCF', position)
    if at < 0:
        break
    position = at + 4
    if at + 36 > len(content):
        continue
    size = struct.unpack_from('<I', content, at + 8)[0]
    if 36 <= size <= len(content) - at:
        candidates.append((size, at))
size, at = max(candidates)
container = cache / 'container.cab'
container.write_bytes(content[at:at + size])
extract(container, cache / 'runtime')
cab = cache / 'runtime' / selected[0]['SourcePath']
if len(cab.read_bytes()) != int(selected[0]['FileSize']) or hashlib.sha1(cab.read_bytes()).hexdigest().upper() != selected[0]['Hash']:
    raise RuntimeError('Vendor runtime CAB hash mismatch')
extract(cab, cache / 'dlls')
output = cache / 'ready'
output.mkdir(exist_ok=True)
files = []
for source in sorted((cache / 'dlls').iterdir()):
    if not re.fullmatch(r'[a-zA-Z0-9_]+\.dll_amd64', source.name):
        continue
    name = source.name.removesuffix('_amd64')
    data = source.read_bytes()
    pe = struct.unpack_from('<I', data, 60)[0]
    if data[pe:pe + 4] != b'PE\0\0' or struct.unpack_from('<H', data, pe + 4)[0] != 0x8664:
        raise RuntimeError('Runtime DLL is not x64')
    (output / name).write_bytes(data)
    files.append(dict(name=name, size=len(data), sha256=hashlib.sha256(data).hexdigest()))
if not {'msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'}.issubset({item['name'] for item in files}):
    raise RuntimeError('Required runtime DLLs missing')
(output / 'manifest.json').write_text(json.dumps(dict(schema=1, files=files), indent=2) + '\n')
print('Official app-local x64 runtime prepared:', len(files), 'DLLs; Windows verifies their vendor signatures before use.')
