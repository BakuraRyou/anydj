"""Local Discogs-EffNet inference; mono float32 LE at 16 kHz on stdin."""
import argparse
import contextlib
import json
import os
from pathlib import Path
import sys
import time


def family(label):
    genre, _, style = label.partition('---')
    if style in ('Ambient', 'Dark Ambient', 'Drone', 'New Age', 'Downtempo', 'Chillwave'):
        return 'ambient'
    if genre == 'Classical' or style in ('Modern Classical', 'Neo-Classical'):
        return 'orchestral'
    if style in ('Acoustic', 'Folk', 'Ballad') or genre in ('Folk, World, & Country', 'Blues', 'Jazz'):
        return 'acoustic'
    return {'Electronic': 'electronic', 'Rock': 'rock', 'Pop': 'pop',
            'Hip Hop': 'groove', 'Funk / Soul': 'groove', 'Reggae': 'groove', 'Latin': 'groove'}.get(genre)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkpoint', required=True)
    parser.add_argument('--device', default='cpu')
    args = parser.parse_args()
    started = time.monotonic()
    with contextlib.redirect_stdout(sys.stderr):
        import numpy as np
        import onnxruntime as ort
        from essentia.standard import FrameGenerator, TensorflowInputMusiCNN
        ort.disable_telemetry_events()
        raw = sys.stdin.buffer.read(16000 * 900 * 4 + 1)
        if len(raw) % 4 or not 16000 * 4 <= len(raw) <= 16000 * 900 * 4:
            raise ValueError('1 bis 900 Sekunden Audio erwartet.')
        audio = np.frombuffer(raw, dtype='<f4').copy()
        if not np.isfinite(audio).all() or np.max(np.abs(audio)) > 4:
            raise ValueError('Ungültige PCM-Werte.')
        duration = len(audio) / 16000
        classes = json.loads(Path(args.checkpoint).with_name('metadata.json').read_text())['classes']
        options = ort.SessionOptions()
        options.intra_op_num_threads = min(2, os.cpu_count() or 1)
        options.inter_op_num_threads = 1
        session = ort.InferenceSession(args.checkpoint, sess_options=options, providers=['CPUExecutionProvider'])
        frontend = TensorflowInputMusiCNN()
        mel = np.stack([frontend(frame) for frame in FrameGenerator(audio, frameSize=512, hopSize=256, startFromZero=False)])
        families = ['electronic', 'rock', 'pop', 'groove', 'acoustic', 'orchestral', 'ambient']
        indices = {name: [i for i, label in enumerate(classes) if family(label) == name] for name in families}
        segments = []
        for offset in range(0, len(mel), 128):
            start = offset * 256 / 16000
            if start >= duration:
                break
            end = min(duration, start + 2.048)
            samples = audio[int(start * 16000):int(end * 16000)]
            if np.sqrt(np.mean(samples ** 2)) < .001:
                scores = np.zeros(400, dtype=np.float32)
            else:
                patch = mel[offset:offset + 128]
                if len(patch) < 128:
                    patch = np.pad(patch, ((0, 128 - len(patch)), (0, 0)), mode='edge')
                scores = session.run(['activations'], {'melspectrogram': patch[None].astype(np.float32)})[0][0]
            segments.append({'start': round(start, 6), 'end': round(end, 6),
                'scores': {name: round(float(np.max(scores[ids])), 6) for name, ids in indices.items()},
                'tags': [{'label': classes[int(i)], 'score': round(float(scores[i]), 6)}
                         for i in np.argsort(scores)[-5:][::-1] if scores[i] >= .02]})
        result = {'version': 1, 'source': 'discogs-effnet', 'duration': duration,
                  'segments': segments, 'elapsedSeconds': round(time.monotonic() - started, 3)}
    print(json.dumps(result, allow_nan=False))


if __name__ == '__main__':
    main()
