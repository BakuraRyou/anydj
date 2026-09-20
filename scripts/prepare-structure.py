"""Fetch/check the pinned pipeline's weights. Only installation may use the network."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import socket

root = Path(__file__).resolve().parent.parent
cache = root / 'data/structure'
parser = argparse.ArgumentParser()
parser.add_argument('--download', action='store_true')
args = parser.parse_args()
for name, folder in [('HF_HOME','huggingface'),('TORCH_HOME','torch'),('MPLCONFIGDIR','matplotlib'),('NUMBA_CACHE_DIR','numba')]:
    os.environ[name] = str(cache / folder)
if not args.download:
    os.environ['HF_HUB_OFFLINE'] = '1'
    def offline(*args, **kwargs):
        raise RuntimeError('Modell fehlt. Installer mit Internetzugang ausführen.')
    socket.create_connection = offline
    socket.socket.connect = offline
    socket.socket.connect_ex = offline

import torch
from allin1_infer.models.loaders import load_pretrained_model
from demucs_infer.pretrained import get_model
torch.set_num_threads(8)
load_pretrained_model('harmonix-all', device='cpu')
get_model('htdemucs')
files = list((cache/'huggingface/hub').rglob('*.pth')) + list((cache/'torch').rglob('*.th'))
manifest = dict(version=1, model='harmonix-all', separator='htdemucs',
                packages={name:importlib.metadata.version(name) for name in ['all-in-one-infer','demucs-infer','torch','torchaudio']},
                weights=[dict(path=str(path.relative_to(cache)),sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for path in sorted(files)])
if len(files) < 9:
    raise RuntimeError('Unvollständiger Modellcache.')
temporary=cache/'ready.json.tmp'
temporary.write_text(json.dumps(manifest,indent=2)+'\n')
temporary.replace(cache/'ready.json')
print('All-In-One ist bereit: acht Harmonix-Modelle und HTDemucs, vollständig lokal.')
