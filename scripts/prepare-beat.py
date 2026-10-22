from pathlib import Path
import hashlib
import urllib.request
from tls_context import download_context
from beat_this.inference import Audio2Beats

target = Path('data/beat-this/final0.ckpt')
expected = '8c328b45f59d8dd3dff219253ff6a8d6482be57d0133a29140e2febbf8eb8331'
target.parent.mkdir(parents=True, exist_ok=True)
if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != expected:
    temporary = target.with_suffix('.download')
    try:
        with urllib.request.urlopen('https://cloud.cp.jku.at/public.php/dav/files/7ik4RrBKTS273gp/final0.ckpt', timeout=60, context=download_context()) as source, temporary.open('wb') as dest:
            size = 0
            while chunk := source.read(1024 * 1024):
                size += len(chunk)
                if size > 120 * 1024 * 1024:
                    raise ValueError('Unerwartete Modellgröße')
                dest.write(chunk)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != expected:
            raise ValueError('Modell-Prüfsumme stimmt nicht überein')
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
Audio2Beats(checkpoint_path=str(target.resolve()), device='cpu', dbn=False)
print('Beat This! final0 ist bereit. AnyDj verwendet die lokale CPU-Analyse.')
