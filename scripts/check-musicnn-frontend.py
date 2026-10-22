"""Compare the portable frontend and actual model scores to the Linux reference."""
import json
import numpy as np
import onnxruntime as ort
from essentia.standard import FrameGenerator, TensorflowInputMusiCNN
from musicnn_frontend import mel_spectrogram
from pathlib import Path
import subprocess
import sys

reference = TensorflowInputMusiCNN()
rng = np.random.default_rng(42)
results = []
signals = [
    ('silence', np.zeros(16000, dtype=np.float32)),
    ('noise', rng.normal(0, .15, 16001).astype(np.float32)),
    ('tone', (.5 * np.sin(2 * np.pi * 440 * np.arange(16384) / 16000)).astype(np.float32)),
    ('impulse', np.eye(1, 16001, 0, dtype=np.float32)[0]),
]
if len(sys.argv) > 1:
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-t', '60', '-f', 'f32le', '-ar', '16000', '-ac', '1', '-'], check=True, capture_output=True).stdout
    signals.append(('audio', np.frombuffer(pcm, dtype='<f4')))
for name, audio in signals:
    old = np.stack([reference(frame) for frame in FrameGenerator(audio, frameSize=512, hopSize=256, startFromZero=False)])
    new = mel_spectrogram(audio)
    assert old.shape == new.shape, (name, old.shape, new.shape)
    difference = float(np.max(np.abs(old - new)))
    assert difference < .001, (name, difference)
    results.append(dict(input=name, frames=len(old), maximumMelError=difference))
    model = Path(__file__).resolve().parent.parent / 'data/style/discogs-effnet.onnx'
    if model.exists():
        session = ort.InferenceSession(str(model), providers=['CPUExecutionProvider'])
        patch = lambda value: np.pad(value, ((0, max(0, 128-len(value))), (0, 0)), mode='edge')[:128][None]
        errors = []
        for offset in range(0, len(old), 128):
            a = session.run(['activations'], {'melspectrogram': patch(old[offset:offset+128])})[0]
            b = session.run(['activations'], {'melspectrogram': patch(new[offset:offset+128])})[0]
            errors.append(float(np.max(np.abs(a-b))))
        error = max(errors)
        assert error < .001, (name, error)
        results[-1]['maximumModelScoreError'] = error
print(json.dumps(results, indent=2))
