"""Small, aligned RMS envelopes from the stems already produced by All-In-One."""
import math
from pathlib import Path


def extract_instruments(directory, duration):
    import numpy as np
    import soundfile as sf
    step = .1
    count = math.ceil(duration / step)
    levels = {}
    for name in ('drums', 'bass', 'vocals', 'other'):
        path = Path(directory) / (name + '.wav')
        with sf.SoundFile(path) as audio:
            hop = round(audio.samplerate * step)
            values = []
            for _ in range(count):
                block = audio.read(hop, dtype='float32', always_2d=True)
                values.append(round(float(np.sqrt(np.mean(block * block))), 5) if block.size else 0)
            levels[name] = values
    return dict(version=1, source='htdemucs', step=step, **levels)
