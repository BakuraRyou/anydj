"""Portable 16 kHz MusiCNN frontend (512-point Hann, 96 Slaney power bands).

Parameters: https://essentia.upf.edu/reference/std_TensorflowInputMusiCNN.html
The model's frontend is fixed; keep the parity test against Essentia when changing it.
"""
from functools import lru_cache
import numpy as np
from scipy.fft import rfft


@lru_cache(maxsize=1)
def filters():
    # Slaney's linear scale below 1 kHz, logarithmic above it.
    step = 200.0 / 3.0
    log_step = np.log(6.4) / 27.0
    maximum = 15.0 + np.log(8000.0 / 1000.0) / log_step
    mel = np.linspace(0.0, maximum, 98)
    hz = np.where(mel < 15.0, mel * step, 1000.0 * np.exp((mel - 15.0) * log_step))
    bins = np.arange(257) * (16000.0 / 512.0)
    bank = np.maximum(0.0, np.minimum(
        (bins[None, :] - hz[:-2, None]) / (hz[1:-1] - hz[:-2])[:, None],
        (hz[2:, None] - bins[None, :]) / (hz[2:] - hz[1:-1])[:, None]))
    bank *= (2.0 / (hz[2:] - hz[:-2]))[:, None]
    return bank.astype(np.float32), np.hanning(512).astype(np.float32)


def mel_spectrogram(audio):
    bank, window = filters()
    count = (len(audio) + 255) // 256 + 1
    padded = np.pad(audio, (256, 512))
    result = np.empty((count, 96), dtype=np.float32)
    # Batches bound memory for the maximum 15-minute input.
    for first in range(0, count, 512):
        offsets = np.arange(first, min(first + 512, count)) * 256
        frames = padded[offsets[:, None] + np.arange(512)] * window
        spectrum = np.abs(rfft(frames, axis=1)) ** 2
        result[first:first + len(offsets)] = np.log10(1.0 + 10000.0 * (spectrum @ bank.T))
    return result
