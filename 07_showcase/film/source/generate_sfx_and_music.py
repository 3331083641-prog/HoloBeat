"""
Synthesize tactile Neo-Brutalism toy foley & light musical transition cues (48kHz stereo WAV)
strictly for motion-graphic intro, chapter transitions, export-showcase reveals, and outro.
Never replaces real product audio; all synthesized procedurally via NumPy/SciPy (100% original).
"""
import math
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, filtfilt

SR = 48000
ROOT_DIR = Path(__file__).resolve().parents[3]
SFX_DIR = ROOT_DIR / "07_showcase" / "film" / "audio" / "sfx"
SFX_DIR.mkdir(parents=True, exist_ok=True)


def save_wav(name: str, stereo: np.ndarray):
    peak = np.max(np.abs(stereo)) + 1e-9
    if peak > 0.88:
        stereo = stereo * (0.88 / peak)
    sf.write(str(SFX_DIR / name), stereo.astype(np.float32), SR, subtype="PCM_16")
    print(f"  [SFX] {name}: {len(stereo)/SR:.3f}s")


def lowpass(sig, cutoff, order=3):
    b, a = butter(order, min(0.95, cutoff / (SR / 2)), btype="low")
    return filtfilt(b, a, sig)


def bandpass(sig, lo, hi, order=2):
    b, a = butter(order, [max(0.002, lo / (SR / 2)), min(0.95, hi / (SR / 2))], btype="band")
    return filtfilt(b, a, sig)


def make_whoosh_card():
    """Crisp tactile card-flick whoosh + warm wooden snap for match-cut transitions."""
    dur = 0.42
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    rng = np.random.default_rng(101)
    noise = rng.normal(0, 1, n)
    # Filtered air sweep
    env = np.sin(np.pi * (t / dur)) ** 1.7
    w_lo = bandpass(noise, 450, 2600) * env * 0.48
    w_hi = bandpass(noise, 2400, 6800) * (np.exp(-((t - 0.19) ** 2) / (2 * 0.045 ** 2))) * 0.35
    # Gentle pitch pop at peak
    f_pop = 240 + 380 * np.exp(-t * 14)
    pop = np.sin(2 * np.pi * np.cumsum(f_pop) / SR) * np.exp(-((t - 0.17) ** 2) / (2 * 0.018 ** 2)) * 0.42
    # Stereo movement L -> R
    pan_l = np.cos(0.5 * np.pi * (t / dur))
    pan_r = np.sin(0.5 * np.pi * (t / dur))
    base = w_lo + w_hi + pop
    stereo = np.stack([base * (0.65 + 0.35 * pan_l), base * (0.65 + 0.35 * pan_r)], axis=1)
    save_wav("trans_card_whoosh.wav", stereo)


def make_foil_shimmer():
    """Delicate metallic prism shimmer swell for sigil-to-forge & outro foil glints."""
    dur = 0.95
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    # Pentatonic crystal partials (C6, D6, G6, A6, C7) staggered gently
    freqs = [1046.5, 1174.7, 1568.0, 1760.0, 2093.0]
    L = np.zeros(n)
    R = np.zeros(n)
    for i, f in enumerate(freqs):
        onset = i * 0.065
        tt = np.maximum(0, t - onset)
        active = (t >= onset).astype(float)
        env = active * (1 - np.exp(-tt * 75)) * np.exp(-tt * 4.8)
        tone = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * f * 2.01 * tt)) * env * 0.16
        pan = i / (len(freqs) - 1)
        L += tone * (1.0 - 0.55 * pan)
        R += tone * (0.45 + 0.55 * pan)
    stereo = np.stack([L, R], axis=1)
    save_wav("trans_foil_shimmer.wav", stereo)


def make_toy_pop_burst():
    """Playful multi-tap Neo-Brutalism module snap-in for intro title build & export cards."""
    dur = 0.55
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    L = np.zeros(n)
    R = np.zeros(n)
    hits = [(0.0, 440, 0.28), (0.085, 587.3, 0.42), (0.17, 784.0, 0.58), (0.255, 1046.5, 0.72)]
    for onset, freq, pan in hits:
        tt = np.maximum(0, t - onset)
        m = (t >= onset).astype(float)
        # Marimba/toy-block wood-like percussive chime
        f_inst = freq * (1.0 + 0.08 * np.exp(-tt * 90))
        sig = m * (np.sin(2 * np.pi * f_inst * tt) + 0.22 * np.sin(2 * np.pi * f_inst * 3.0 * tt) * np.exp(-tt * 45))
        sig *= np.exp(-tt * 14.0) * 0.35
        L += sig * (1.0 - 0.5 * pan)
        R += sig * (0.5 + 0.5 * pan)
    stereo = np.stack([L, R], axis=1)
    save_wav("intro_toy_pops.wav", stereo)


def make_sticker_peel_place():
    """Soft matte sticker pop/thump for visual accent reveals."""
    dur = 0.24
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    f = 320 + 520 * np.exp(-t * 40)
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28) * 0.48
    rng = np.random.default_rng(7)
    crisp = bandpass(rng.normal(0, 1, n), 1800, 5200) * np.exp(-t * 60) * 0.22
    mono = sig + crisp
    save_wav("sfx_sticker_pop.wav", np.stack([mono, mono], axis=1))


def make_intro_groove_bed():
    """
    Gentle 118 BPM organic percussive pulse bed (12s) inspired by C-pentatonic street clapper & warm bass,
    used ONLY as an ultra-light bridge during motion-graphic title/export/outro frames where live UI audio isn't playing.
    """
    bpm = 118.0
    step_s = 60.0 / bpm / 4.0
    bars = 8
    dur = bars * 16 * step_s + 1.5
    n = int(SR * dur)
    L = np.zeros(n)
    R = np.zeros(n)
    rng = np.random.default_rng(2026)

    def add_at(buf_l, buf_r, t0, sig, pan=0.5, gain=1.0):
        idx = int(t0 * SR)
        end = min(len(buf_l), idx + len(sig))
        if idx >= len(buf_l) or end <= idx:
            return
        seg = sig[: end - idx] * gain
        buf_l[idx:end] += seg * math.cos(pan * math.pi / 2)
        buf_r[idx:end] += seg * math.sin(pan * math.pi / 2)

    # Pre-synthesize clean tactile kit elements
    tk = np.linspace(0, 0.24, int(SR * 0.24), endpoint=False)
    kick = np.sin(2 * np.pi * np.cumsum(52 + 120 * np.exp(-tk * 38)) / SR) * np.exp(-tk * 12) * 0.52

    tw = np.linspace(0, 0.08, int(SR * 0.08), endpoint=False)
    wood = (np.sin(2 * np.pi * 760 * tw) * 0.5 + np.sin(2 * np.pi * 1140 * tw) * 0.3) * np.exp(-tw * 55) * 0.30

    th = np.linspace(0, 0.06, int(SR * 0.06), endpoint=False)
    shaker = bandpass(rng.normal(0, 1, len(th)), 5500, 11000) * np.exp(-th * 65) * 0.14

    # Warm mellow Rhodes-like C-pentatonic bass/chord pluck
    def make_pluck(freq, d=0.45):
        tp = np.linspace(0, d, int(SR * d), endpoint=False)
        s = (np.sin(2 * np.pi * freq * tp) + 0.3 * np.sin(2 * np.pi * freq * 2 * tp) * np.exp(-tp * 10)
             + 0.1 * np.sin(2 * np.pi * freq * 3 * tp) * np.exp(-tp * 18))
        return s * (1 - np.exp(-tp * 140)) * np.exp(-tp * 5.2)

    bass_notes = [130.81, 110.0, 87.31, 98.0]  # C3, A2, F2, G2
    chords = [
        [261.63, 329.63, 392.00, 587.33],  # Cadd9
        [220.00, 261.63, 329.63, 392.00],  # Am7
        [174.61, 261.63, 329.63, 440.00],  # Fmaj7
        [196.00, 293.66, 392.00, 440.00],  # Gsus2
    ]

    for bar in range(bars):
        swing = 0.16
        for step in range(16):
            t_step = (bar * 16 + step) * step_s + (swing * step_s * 0.5 if step % 2 == 1 else 0.0)
            if step in (0, 6, 8, 14):
                add_at(L, R, t_step, kick, pan=0.5, gain=0.85)
            if step in (4, 12):
                add_at(L, R, t_step, wood, pan=0.42 if step == 4 else 0.58, gain=0.72)
            if step % 2 == 0 or step in (7, 15):
                add_at(L, R, t_step, shaker, pan=0.35 + 0.3 * (step % 2), gain=0.65)
            if step in (0, 8):
                ch_idx = (bar * 2 + (0 if step == 0 else 1)) % 4
                b_sig = make_pluck(bass_notes[ch_idx], 0.55)
                add_at(L, R, t_step, b_sig, pan=0.5, gain=0.22)
                for j, cf in enumerate(chords[ch_idx]):
                    c_sig = make_pluck(cf, 0.72)
                    add_at(L, R, t_step + j * 0.014, c_sig, pan=0.28 + j * 0.15, gain=0.075)

    stereo = np.stack([L, R], axis=1)
    # Warm lowpass polish so it sits softly beneath VO without ever competing with crisp product bells
    stereo[:, 0] = lowpass(stereo[:, 0], 8500)
    stereo[:, 1] = lowpass(stereo[:, 1], 8500)
    out_path = ROOT_DIR / "07_showcase" / "film" / "audio" / "music" / "bridge_groove_118bpm.wav"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    peak = np.max(np.abs(stereo)) + 1e-9
    stereo = stereo * (0.78 / peak)
    sf.write(str(out_path), stereo.astype(np.float32), SR, subtype="PCM_16")
    print(f"  [MUSIC] bridge_groove_118bpm.wav: {len(stereo)/SR:.2f}s")


if __name__ == "__main__":
    make_whoosh_card()
    make_foil_shimmer()
    make_toy_pop_burst()
    make_sticker_peel_place()
    make_intro_groove_bed()
    print("=== SFX & BRIDGE GROOVE READY ===")
