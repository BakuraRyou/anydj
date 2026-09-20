"""Offline inference: little-endian mono float32, 16000 Hz on stdin; JSON on stdout."""
import argparse
import contextlib
import json
import os
from pathlib import Path
import sys
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkpoint', required=True)
    parser.add_argument('--device', choices=['cpu', 'cuda', 'auto'], default='cpu')
    args = parser.parse_args()
    checkpoint = Path(args.checkpoint)
    if not checkpoint.is_file():
        raise ValueError('Modell fehlt. Bitte scripts/install-beat-this.sh ausführen.')
    # Require a local file; inference must never download weights implicitly.
    started = time.monotonic()
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import torch
        from beat_this.inference import Audio2Beats
        torch.set_num_threads(min(8, os.cpu_count() or 1))
        raw = sys.stdin.buffer.read(16000 * 900 * 4 + 1)
        if len(raw) % 4 or not 6400 <= len(raw) <= 16000 * 900 * 4:
            raise ValueError('Ungültige Audiodaten: 0,1 bis 900 Sekunden erwartet.')
        signal = np.frombuffer(raw, dtype='<f4').copy()
        if not np.isfinite(signal).all() or np.max(np.abs(signal)) > 4:
            raise ValueError('Ungültige PCM-Werte.')
        duration = len(signal) / 16000
        device = ('cuda' if torch.cuda.is_available() else 'cpu') if args.device == 'auto' else args.device
        # Avoid invented pulses for digital silence.
        if np.max(np.abs(signal)) < 1e-6:
            beats, downbeats = [], []
        else:
            model = Audio2Beats(checkpoint_path=str(checkpoint.resolve()), device=device, dbn=False)
            beats, downbeats = model(signal, 16000)
        def times(values):
            return sorted(set(round(float(t), 6) for t in values if 0 <= float(t) < duration))
        result = dict(version=1, source='beat-this', model='final0', device=device,
                      duration=duration, beats=times(beats), downbeats=times(downbeats),
                      elapsedSeconds=round(time.monotonic() - started, 3))
    print(json.dumps(result, allow_nan=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
