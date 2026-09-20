"""All-In-One adapter. Uses installed local weights and a per-request temp directory."""
import argparse
import contextlib
import json
import os
from pathlib import Path
import random
import socket
import sys
import time
import wave


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkpoint', required=True)
    parser.add_argument('--device', choices=['cpu'], default='cpu')
    parser.add_argument('--work-dir', required=True)
    args = parser.parse_args()
    if not Path(args.checkpoint).is_file():
        raise ValueError('All-In-One ist noch nicht eingerichtet.')
    # HF offline flags alone do not cover Demucs. Block network in the adapter.
    def offline(*args, **kwargs):
        raise RuntimeError('Offline-Analyse: Modell fehlt im lokalen Cache.')
    socket.create_connection = offline
    socket.socket.connect = offline
    socket.socket.connect_ex = offline
    started = time.monotonic()
    work = Path(args.work_dir)
    pcm = work / 'input.pcm'
    size = pcm.stat().st_size
    if size % 4 or not 44100*4*5 <= size <= 44100*4*900:
        raise ValueError('Ungültige Audiodauer.')
    duration = size / (44100*4)
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import torch
        from allin1_infer import analyze
        torch.set_num_threads(min(8, os.cpu_count() or 1))
        torch.manual_seed(0)
        random.seed(0)
        np.random.seed(0)
        audio = work / 'song.wav'
        with wave.open(str(audio), 'wb') as wav, pcm.open('rb') as source:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(44100)
            while chunk := source.read(1024*1024):
                wav.writeframesraw(chunk)
        result = analyze(str(audio), model='harmonix-all', device='cpu',
                         demix_dir=work/'demix', spec_dir=work/'spec',
                         keep_byproducts=False, multiprocess=False)
        segments = [dict(start=max(0, float(s.start)), end=min(duration, float(s.end)), label=s.label)
                    for s in result.segments if min(duration, float(s.end)) > max(0, float(s.start))]
    print(json.dumps(dict(version=1, source='all-in-one', duration=duration,
                         segments=segments, elapsedSeconds=round(time.monotonic()-started, 3)), allow_nan=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
