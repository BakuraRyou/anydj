#!/usr/bin/env python3
"""Build desktop icons from the existing logo. Requires Pillow and Chrome/Chromium."""
from pathlib import Path
from tempfile import TemporaryDirectory
import re
import shutil
import subprocess
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = root / 'desktop' / 'icons'
out.mkdir(parents=True, exist_ok=True)
logo = (root / 'public' / 'animatus-small.svg').read_text()
# Keep the original logo, freezing only its decorative animation for OS icons.
logo = re.sub(r'<animate\b[^>]*/>', '', logo, flags=re.S)
logo = re.sub(r'\bwidth="50"', 'width="904"', logo, count=1)
logo = re.sub(r'\bheight="50"', 'height="904"', logo, count=1)
logo = logo.replace('<svg', '<svg x="60" y="60"', 1)
svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect x="32" y="32" width="960" height="960" rx="210" fill="#0b0c10"/>' + logo + '</svg>'
(out / 'icon.svg').write_text(svg)
chrome = next((shutil.which(name) for name in ['google-chrome', 'chromium', 'chromium-browser'] if shutil.which(name)), None)
if not chrome:
    raise SystemExit('Chrome/Chromium is required to render the source SVG.')
with TemporaryDirectory(prefix='anydj-icon-') as temporary:
    png = Path(temporary) / 'icon.png'
    result = subprocess.run([chrome, '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--hide-scrollbars', '--default-background-color=00000000', '--force-device-scale-factor=1', '--window-size=1024,1024', f'--user-data-dir={temporary}/profile', f'--screenshot={png}', (out / 'icon.svg').as_uri()], capture_output=True, timeout=40)
    if result.returncode:
        raise SystemExit(result.stderr.decode())
    with Image.open(png) as rendered:
        image = rendered.convert('RGBA')
    if image.size != (1024, 1024):
        raise SystemExit(f'Unexpected icon dimensions: {image.size}')
    image.save(out / 'icon.png')
    image.save(out / 'icon.ico', sizes=[(size, size) for size in [16, 24, 32, 48, 64, 128, 256]])
    image.save(out / 'icon.icns')
    linux = out / 'linux'
    linux.mkdir(exist_ok=True)
    for size in [16, 24, 32, 48, 64, 128, 256, 512, 1024]:
        image.resize((size, size), Image.Resampling.LANCZOS).save(linux / f'{size}x{size}.png')
print('Built PNG, Windows ICO, macOS ICNS and Linux icon sizes from public/animatus-small.svg.')
