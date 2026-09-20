#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
python3 -m venv .venv-style
.venv-style/bin/python -m pip install --no-cache-dir -r scripts/style-requirements.lock
.venv-style/bin/python scripts/prepare-style.py
