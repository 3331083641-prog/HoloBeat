"""
Generate broadcast-clean 48kHz Mandarin voiceover lines from subtitles/vo_script.json
using Microsoft Edge Neural TTS (zh-CN-XiaoxiaoNeural), then apply gentle speech polish
(high-pass 85Hz, warm presence +2dB @ 3.2kHz, gentle dynamic leveling, trim silence)
and output exact duration manifest for precision timeline alignment.
"""
import asyncio
import json
import subprocess
import wave
from pathlib import Path
import edge_tts
import imageio_ffmpeg
import numpy as np
import soundfile as sf

ROOT_DIR = Path(__file__).resolve().parents[3]
FILM_DIR = ROOT_DIR / "07_showcase" / "film"
SCRIPT_PATH = FILM_DIR / "subtitles" / "vo_script.json"
VO_DIR = FILM_DIR / "audio" / "vo"
VO_DIR.mkdir(parents=True, exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


async def synth_one(voice: str, item: dict):
    mp3_path = VO_DIR / f"{item['id']}.raw.mp3"
    wav_path = VO_DIR / f"{item['id']}.wav"
    comm = edge_tts.Communicate(
        text=item["text"],
        voice=voice,
        rate=item.get("rate", "+3%"),
        pitch=item.get("pitch", "+1Hz"),
    )
    await comm.save(str(mp3_path))

    # Convert to 48kHz stereo WAV with broadcast speech polish:
    # HPF 85Hz (remove mud) + mild warmth/presence EQ + soft compression + loudnorm to -16 LUFS
    af = (
        "highpass=f=85,"
        "equalizer=f=240:t=q:w=1.2:g=1.2,"
        "equalizer=f=3200:t=q:w=1.4:g=1.8,"
        "equalizer=f=7800:t=q:w=2.0:g=-1.5,"
        "acompressor=threshold=-20dB:ratio=2.4:attack=8:release=90:makeup=2,"
        "loudnorm=I=-16:TP=-1.5:LRA=7"
    )
    subprocess.run(
        [
            FFMPEG, "-y", "-i", str(mp3_path),
            "-af", af,
            "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le",
            str(wav_path),
        ],
        check=True,
        capture_output=True,
    )

    # Trim excess leading/trailing silence while keeping crisp 40ms breath margin
    data, sr = sf.read(str(wav_path), dtype="float32")
    mono = np.max(np.abs(data), axis=1) if data.ndim > 1 else np.abs(data)
    thresh = 0.008
    idx = np.where(mono > thresh)[0]
    if len(idx) > 0:
        pad_pre = int(sr * 0.035)
        pad_post = int(sr * 0.065)
        start = max(0, int(idx[0]) - pad_pre)
        end = min(len(data), int(idx[-1]) + pad_post)
        trimmed = data[start:end]
        # 12ms micro-fade at edges to guarantee zero clicks
        fade = min(int(sr * 0.012), len(trimmed) // 4)
        if fade > 0:
            ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
            trimmed[:fade] *= ramp
            trimmed[-fade:] *= ramp[::-1]
        sf.write(str(wav_path), trimmed, sr, subtype="PCM_16")
        dur = len(trimmed) / sr
        peak = float(np.max(np.abs(trimmed)))
    else:
        dur = len(data) / sr
        peak = 0.0

    # Clean up raw mp3 intermediate
    try:
        mp3_path.unlink()
    except Exception:
        pass

    return {
        "id": item["id"],
        "chapter": item["chapter"],
        "text": item["text"],
        "subtitle": item["subtitle"],
        "wav": str(wav_path),
        "durationSec": round(dur, 3),
        "peak": round(peak, 4),
    }


async def main():
    spec = json.loads(SCRIPT_PATH.read_text(encoding="utf-8"))
    voice = spec["voice"]
    results = []
    for item in spec["lines"]:
        r = await synth_one(voice, item)
        print(f"  [VO] {r['id']}: {r['durationSec']:.2f}s | peak={r['peak']} | {r['subtitle']}")
        results.append(r)

    manifest_path = VO_DIR / "vo_manifest.json"
    manifest_path.write_text(
        json.dumps({"voice": voice, "lines": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    total_vo = sum(r["durationSec"] for r in results)
    print(f"\n=== ALL {len(results)} VO LINES GENERATED (total speech {total_vo:.1f}s) ===")


if __name__ == "__main__":
    asyncio.run(main())
