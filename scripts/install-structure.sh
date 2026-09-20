#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
python3 -m venv .venv-structure
.venv-structure/bin/python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu 'torch==2.14.0+cpu' 'torchaudio==2.11.0+cpu'
.venv-structure/bin/python -m pip install --no-cache-dir -r scripts/structure-requirements.lock
.venv-structure/bin/python scripts/prepare-structure.py --download
