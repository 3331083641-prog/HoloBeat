r"""
Master Film Assembly (v3 Calm, Unhurried, Breathable Director's Cut)
for 《声卡造物局》 Official Demonstration Film.

Key v3 Principles:
  - ZERO `atempo` VO speedup (100% natural unhurried -5%/-6% Mandarin delivery!)
  - 5 serene 2.3s Neo-Brutalism Chapter Interstitial Cards between major modules
  - Generous 1.5s - 12.5s silent breathing windows so viewers can watch, read, and listen effortlessly
  - Exact 48kHz multi-track sidechain mix (-14.5 LUFS / -1.2 dBTP) & discrete lossless stems
  - Dedicated 57px zero-overlap bottom subtitle rail + BT.709 TV-range 1080p 30fps H.264 master
"""
import json
import math
import subprocess
from pathlib import Path
import imageio_ffmpeg
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT_DIR = Path(__file__).resolve().parents[3]
FILM_DIR = ROOT_DIR / "07_showcase" / "film"
CLIPS_DIR = FILM_DIR / "capture" / "clips"
MOTION_DIR = FILM_DIR / "capture" / "motion"
EXPORTS_DIR = FILM_DIR / "capture" / "exports"
VO_DIR = FILM_DIR / "audio" / "vo"
SFX_DIR = FILM_DIR / "audio" / "sfx"
MUSIC_DIR = FILM_DIR / "audio" / "music"
STEMS_DIR = FILM_DIR / "audio" / "stems"
SUBS_DIR = FILM_DIR / "subtitles"
RENDERS_DIR = FILM_DIR / "renders"
DOCS_DIR = FILM_DIR / "docs"
WORK_DIR = FILM_DIR / "capture" / "_assembly_tmp"

for d in (STEMS_DIR, SUBS_DIR, RENDERS_DIR, DOCS_DIR, WORK_DIR):
    d.mkdir(parents=True, exist_ok=True)

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
FPS = 30


def log(msg: str):
    print(msg, flush=True)


def probe_duration(path: Path) -> float:
    out = subprocess.run([FFMPEG, "-i", str(path)], capture_output=True, text=True)
    for line in out.stderr.splitlines():
        if "Duration:" in line:
            part = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = part.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    return 0.0


def load_wav_48k(path: Path) -> np.ndarray:
    data, sr = sf.read(str(path), dtype="float32")
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    elif data.shape[1] > 2:
        data = data[:, :2]
    if sr != SR:
        g = math.gcd(sr, SR)
        data = resample_poly(data, SR // g, sr // g, axis=0).astype(np.float32)
    return data


def trim_leading_silence(sig: np.ndarray, thresh: float = 0.008, pre_roll_sec: float = 0.03) -> np.ndarray:
    mono = np.max(np.abs(sig), axis=1)
    idx = np.where(mono > thresh)[0]
    if len(idx) == 0:
        return sig
    s0 = max(0, int(idx[0]) - int(pre_roll_sec * SR))
    return sig[s0:]


def add_audio(buf: np.ndarray, sig: np.ndarray, start_sec: float, gain: float = 1.0, fade_in: float = 0.015, fade_out: float = 0.025):
    if len(sig) == 0:
        return
    seg = sig.copy() * gain
    fi = min(int(fade_in * SR), len(seg) // 3)
    fo = min(int(fade_out * SR), len(seg) // 3)
    if fi > 0:
        seg[:fi] *= np.linspace(0.0, 1.0, fi, dtype=np.float32)[:, None]
    if fo > 0:
        seg[-fo:] *= np.linspace(1.0, 0.0, fo, dtype=np.float32)[:, None]
    i0 = int(round(start_sec * SR))
    if i0 < 0:
        seg = seg[-i0:]
        i0 = 0
    i1 = min(len(buf), i0 + len(seg))
    if i1 > i0:
        buf[i0:i1] += seg[: i1 - i0]


def format_srt_ts(sec: float) -> str:
    ms_total = max(0, int(round(sec * 1000)))
    hh = ms_total // 3_600_000
    mm = (ms_total % 3_600_000) // 60_000
    ss = (ms_total % 60_000) // 1000
    ms = ms_total % 1000
    return f"{hh:02d}:{mm:02d}:{ss:02d},{ms:03d}"


def format_ass_ts(sec: float) -> str:
    cs_total = max(0, int(round(sec * 100)))
    hh = cs_total // 360_000
    mm = (cs_total % 360_000) // 6000
    ss = (cs_total % 6000) // 100
    cs = cs_total % 100
    return f"{hh}:{mm:02d}:{ss:02d}.{cs:02d}"


def prepare_framed_segment(src_mp4: Path, out_mp4: Path, trim_start: float, trim_end: float, framed: bool, bg_hex: str):
    """Standardize segment cleanly to 1920x1080 @ 30fps BT.709 TV-range yuv420p."""
    dur = max(0.2, trim_end - trim_start)
    if framed:
        vf = (
            f"fps={FPS},"
            f"scale=1808:1017:flags=lanczos:out_color_matrix=bt709:out_range=tv,"
            f"pad=1814:1023:3:3:color=#1A1A1F,"
            f"pad=1920:1080:53:4:color={bg_hex},"
            f"setsar=1,format=yuv420p"
        )
    else:
        vf = f"fps={FPS},scale=1920:1080:flags=lanczos:out_color_matrix=bt709:out_range=tv,setsar=1,format=yuv420p"

    cmd = [
        FFMPEG, "-y",
        "-ss", f"{trim_start:.3f}", "-t", f"{dur:.3f}",
        "-i", str(src_mp4),
        "-vf", vf,
        "-an",
        "-c:v", "libx264", "-preset", "fast", "-crf", "13", "-pix_fmt", "yuv420p",
        "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        str(out_mp4),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return probe_duration(out_mp4)


def main():
    vo_manifest = json.loads((VO_DIR / "vo_manifest.json").read_text(encoding="utf-8"))
    vo_map = {item["id"]: item for item in vo_manifest["lines"]}

    # 17-segment unhurried timeline: 12 real/motion scenes + 5 serene 2.3s Neo-Brutalism chapter breathing cards!
    # Positive te_spec = explicit end timestamp; <=0 = offset from end of clip.
    raw_specs = [
        ("seg00_intro",        MOTION_DIR / "motion_00_intro.mp4",    None,                                     0.00,  0.00, False, "#F7F3E9", None,         0.00, "00 片头 · 声卡造物局"),
        ("ch01_gacha",         MOTION_DIR / "chapter_01_gacha.mp4",   None,                                     0.00,  0.00, False, "#F7F3E9", "fade",       0.35, "章节卡 01 · 声卡盲盒"),
        ("seg01_gacha",        CLIPS_DIR / "s01_gacha.mp4",           CLIPS_DIR / "s01_gacha.wav",              0.15, -0.10, True,  "#F7F3E9", "fade",       0.35, "01 声卡盲盒 · 扭取、刮膜与试听"),
        ("ch02_beat",          MOTION_DIR / "chapter_02_beat.mp4",    None,                                     0.00,  0.00, False, "#F7F3E9", "fade",       0.35, "章节卡 02 · 插卡编曲"),
        ("seg02_beat_build",   CLIPS_DIR / "s02_beat_build.mp4",      CLIPS_DIR / "s02_beat_build.wav",         0.10, -0.05, True,  "#F7F3E9", "fade",       0.35, "02 插卡编曲 · 四轨叠加、换卡与微调"),
        ("seg03_beat_ab_fx",   CLIPS_DIR / "s03_beat_ab_fx.mp4",      CLIPS_DIR / "s03_beat_ab_fx.wav",         0.05, -0.15, True,  "#F7F3E9", "fade",       0.25, "02 插卡编曲 · 32步A/B乐句、规则变奏与现场效果"),
        ("ch03_pinball",       MOTION_DIR / "chapter_03_pinball.mp4", None,                                     0.00,  0.00, False, "#F7F3E9", "fade",       0.35, "章节卡 03 · 弹珠剧场"),
        ("seg04_pinball_free", CLIPS_DIR / "s04_pinball_free.mp4",    CLIPS_DIR / "s04_pinball_free.wav",       0.10, -0.15, True,  "#F7F3E9", "fade",       0.35, "03 弹珠剧场 · 自由实验、8秒录制与量化对比"),
        ("seg05_pinball_show", CLIPS_DIR / "s05_pinball_show.mp4",    CLIPS_DIR / "s05_pinball_show.wav",       0.10, -0.15, False, "#14151B", "fadeblack",  0.50, "03 弹珠剧场 · 《铃响晴巷》编曲剧场高潮演出（无旁白纯享）"),
        ("ch04_forge",         MOTION_DIR / "chapter_04_forge.mp4",   None,                                     0.00,  0.00, False, "#14151B", "fade",       0.40, "章节卡 04 · 闪卡铸造"),
        ("seg06_forge_mint",   CLIPS_DIR / "s06_forge_mint.mp4",      CLIPS_DIR / "s06_forge_mint.wav",         0.10, -0.25, True,  "#F7F3E9", "fade",       0.40, "04 闪卡铸造 · 命名、五材质对比、贴纸与压印入册"),
        ("ch05_outputs",       MOTION_DIR / "chapter_05_outputs.mp4", None,                                     0.00,  0.00, False, "#14151B", "fade",       0.40, "章节卡 05 · 导出与重混"),
        ("seg07_exports",      MOTION_DIR / "motion_06_exports.mp4",  None,                                     0.00,  0.00, False, "#14151B", "fade",       0.40, "05 同源四格式成果 · PNG/WebM/WAV/可编辑工程"),
        ("seg08_share_click",  CLIPS_DIR / "s07_share_click.mp4",     CLIPS_DIR / "s07_share_click.wav",        0.05, -0.15, True,  "#F7F3E9", "fade",       0.35, "05 本机归档 · 只读分享链接生成"),
        ("seg09_share_page",   CLIPS_DIR / "s07_share_page.mp4",      CLIPS_DIR / "s07_share_page.wav",         0.05, -0.05, True,  "#F7F3E9", "wipeleft",   0.35, "05 本机归档 · 只读作品展页与简化音符轮廓试听"),
        ("seg10_remix",        CLIPS_DIR / "s08_import_and_remix.mp4",CLIPS_DIR / "s08_import_and_remix.wav",   0.10, 44.80, True,  "#F7F3E9", "fade",       0.45, "06 工程导入恢复与拆封重混 · #MY-02《铃响晴巷·夜行版》"),
        ("seg11_outro",        MOTION_DIR / "motion_07_outro.mp4",    None,                                     0.00,  0.00, False, "#14151B", "fade",       0.55, "07 片尾定版 · 原作与重混双卡呼应"),
    ]

    log("1) Preparing 17 standardized 1920x1080 @ 30fps BT.709 segments...")
    segments = []
    timeline_cursor = 0.0
    for idx, (sid, src_mp4, wav_path, ts, te_spec, framed, bg, trans, tdur, chap) in enumerate(raw_specs):
        full_d = probe_duration(src_mp4)
        te = min(full_d, te_spec) if te_spec > 0 else max(ts + 0.5, full_d + te_spec)
        prep_mp4 = WORK_DIR / f"{sid}.mp4"
        actual_d = prepare_framed_segment(src_mp4, prep_mp4, ts, te, framed, bg)
        if idx > 0 and trans:
            timeline_cursor -= tdur
        start_on_tl = timeline_cursor
        end_on_tl = start_on_tl + actual_d
        segments.append({
            "id": sid, "prep_mp4": prep_mp4, "wav_path": wav_path,
            "trim_start": ts, "trim_end": ts + actual_d, "dur": actual_d,
            "tl_start": round(start_on_tl, 4), "tl_end": round(end_on_tl, 4),
            "trans": trans, "trans_dur": tdur, "chapter": chap, "framed": framed,
        })
        timeline_cursor = end_on_tl
        log(f"  [{idx:02d}] {sid:18s} | tl={start_on_tl:6.2f}s .. {end_on_tl:6.2f}s (dur {actual_d:5.2f}s) | {chap}")

    total_dur = timeline_cursor
    log(f"\n==> MASTER TIMELINE TOTAL DURATION: {total_dur:.2f}s ({int(total_dur//60)}m {total_dur%60:04.1f}s)")

    # ==================== STEP 2: STITCH VIDEO TIMELINE ====================
    log("2) Stitching relaxed video timeline with gentle Neo-Brutalism transitions...")
    video_only_mp4 = WORK_DIR / "master_video_only.mp4"
    inputs = []
    for seg in segments:
        inputs.extend(["-i", str(seg["prep_mp4"])])

    filter_parts = []
    prev_label = "[0:v]"
    for i in range(1, len(segments)):
        seg = segments[i]
        tr = seg["trans"] or "fade"
        td = seg["trans_dur"]
        offset = max(0.0, seg["tl_start"])
        out_label = f"[v{i}]" if i < len(segments) - 1 else "[vout]"
        filter_parts.append(f"{prev_label}[{i}:v]xfade=transition={tr}:duration={td:.3f}:offset={offset:.4f}{out_label}")
        prev_label = out_label

    fc_video = ";".join(filter_parts)
    subprocess.run([
        FFMPEG, "-y",
        *inputs,
        "-filter_complex", fc_video,
        "-map", "[vout]",
        "-r", str(FPS),
        "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p",
        "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        str(video_only_mp4),
    ], check=True, capture_output=True)
    vid_dur = probe_duration(video_only_mp4)
    log(f"  Video-only master stitched cleanly: {vid_dur:.3f}s")

    # ==================== STEP 3: BUILD 48kHz STEMS (ZERO VO SPEEDUP!) ====================
    log("3) Building 48kHz stereo stems (Product / Natural-Speed VO / Light Music & SFX)...")
    total_samples = int(math.ceil((max(total_dur, vid_dur) + 0.15) * SR))
    stem_product = np.zeros((total_samples, 2), dtype=np.float32)
    stem_vo = np.zeros((total_samples, 2), dtype=np.float32)
    stem_music_sfx = np.zeros((total_samples, 2), dtype=np.float32)

    seg_by_id = {s["id"]: s for s in segments}

    # 3A. Authentic product audio aligned cleanly with every UI scene
    for seg in segments:
        if seg["wav_path"] and seg["wav_path"].exists():
            w = load_wav_48k(seg["wav_path"])
            s0 = int(round(seg["trim_start"] * SR))
            s1 = min(len(w), int(round(seg["trim_end"] * SR)))
            clip_w = w[s0:s1]
            gain = 1.0
            if seg["id"] == "seg01_gacha":
                gain = 1.28
            elif seg["id"] == "seg09_share_page":
                gain = 1.38
            elif seg["id"] == "seg05_pinball_show":
                gain = 1.06
            add_audio(stem_product, clip_w, seg["tl_start"], gain=gain, fade_in=0.06, fade_out=0.10)

    # Trimmed isolated #05 bell motif (exact crisp onset!) + genuine exported WAVs
    bell_solo = trim_leading_silence(load_wav_48k(CLIPS_DIR / "motif_bell_solo.wav"), thresh=0.006, pre_roll_sec=0.02)
    my01_wav = load_wav_48k(EXPORTS_DIR / "lingxiang-qingxiang.wav")
    my02_wav = load_wav_48k(EXPORTS_DIR / "lingxiang-night-remix.wav")

    # Intro (seg00, 9.0s): crisp #05 copper bell opens the film!
    add_audio(stem_product, bell_solo, seg_by_id["seg00_intro"]["tl_start"] + 0.12, gain=4.0, fade_in=0.01, fade_out=0.06)

    # Exports Showcase (seg07, 9.6s): genuine exported #MY-01 WAV plays cleanly + gentle second pass
    s07_t = seg_by_id["seg07_exports"]["tl_start"]
    add_audio(stem_product, my01_wav, s07_t + 0.10, gain=0.92, fade_in=0.05, fade_out=0.18)
    d_my01 = len(my01_wav) / SR
    if d_my01 < 9.0:
        rem = 9.2 - d_my01
        add_audio(stem_product, my01_wav[: int(rem * SR)], s07_t + d_my01, gain=0.76, fade_in=0.10, fade_out=0.55)

    # Outro (seg11, 11.2s): genuine exported #MY-02 WAV + final poetic solo #05 bell chime at +9.25s!
    s11_t = seg_by_id["seg11_outro"]["tl_start"]
    add_audio(stem_product, my02_wav, s11_t + 0.10, gain=0.86, fade_in=0.08, fade_out=0.45)
    add_audio(stem_product, bell_solo, s11_t + 9.25, gain=4.3, fade_in=0.01, fade_out=0.08)

    # 3B. Gentle tactile transition SFX & warm background marimba ONLY in quiet non-music spots
    whoosh = load_wav_48k(SFX_DIR / "trans_card_whoosh.wav")
    shimmer = load_wav_48k(SFX_DIR / "trans_foil_shimmer.wav")
    pops = load_wav_48k(SFX_DIR / "intro_toy_pops.wav")
    bridge = load_wav_48k(MUSIC_DIR / "bridge_groove_118bpm.wav")

    # Intro warm marimba bed (0.9s .. 8.8s)
    add_audio(stem_music_sfx, bridge[: int(7.9 * SR)], 0.90, gain=0.33, fade_in=0.50, fade_out=0.95)
    add_audio(stem_music_sfx, pops, 3.60, gain=0.38, fade_in=0.01, fade_out=0.05)

    # Subtle warm marimba bed during quiet Forge foil/sticker design phase ONLY (fades out cleanly BEFORE #MY-01 PCM audition!)
    s6_ref = seg_by_id["seg06_forge_mint"]
    add_audio(stem_music_sfx, bridge[: int(16.2 * SR)], s6_ref["tl_start"] + 0.45, gain=0.22, fade_in=0.65, fade_out=1.20)
    # Loop softly for 4s more until t+20.2s (still 3.5s BEFORE #MY-01 PCM audition at +24.0s!)
    add_audio(stem_music_sfx, bridge[: int(4.6 * SR)], s6_ref["tl_start"] + 16.0, gain=0.19, fade_in=0.60, fade_out=1.20)

    # Soft tactile SFX on chapter cards & transitions
    for sid, sfx_wav, g in [
        ("ch01_gacha", pops, 0.34),
        ("ch02_beat", whoosh, 0.30),
        ("ch03_pinball", whoosh, 0.30),
        ("seg05_pinball_show", shimmer, 0.40),
        ("ch04_forge", shimmer, 0.38),
        ("ch05_outputs", pops, 0.34),
        ("seg09_share_page", whoosh, 0.28),
        ("seg11_outro", shimmer, 0.44),
    ]:
        t_tr = seg_by_id[sid]["tl_start"]
        add_audio(stem_music_sfx, sfx_wav, max(0.0, t_tr + 0.05), gain=g, fade_in=0.01, fade_out=0.04)

    # 3C. Place all 25 relaxed VO lines at 100% NATURAL 1.000x SPEED (ZERO atempo!) with generous pauses!
    vo_placements = []

    def place_natural(vo_id: str, abs_start: float):
        item = vo_map[vo_id]
        w = load_wav_48k(Path(item["wav"]))
        d = len(w) / SR
        st = abs_start
        if vo_placements:
            prev_end = vo_placements[-1]["end"]
            if st < prev_end + 0.65:
                st = prev_end + 0.65
        add_audio(stem_vo, w, st, gain=1.10, fade_in=0.015, fade_out=0.025)
        rec_item = {"id": vo_id, "start": round(st, 3), "end": round(st + d, 3), "subtitle": item["subtitle"], "text": item["text"]}
        vo_placements.append(rec_item)
        gap = round(st - vo_placements[-2]["end"], 2) if len(vo_placements) >= 2 else round(st, 2)
        log(f"    VO {vo_id:20s}: {st:6.2f}s .. {st+d:6.2f}s (dur {d:4.2f}s | pause before={gap:5.2f}s)")
        return rec_item

    s0  = seg_by_id["seg00_intro"]
    s1  = seg_by_id["seg01_gacha"]
    s2  = seg_by_id["seg02_beat_build"]
    s3  = seg_by_id["seg03_beat_ab_fx"]
    s4  = seg_by_id["seg04_pinball_free"]
    s5  = seg_by_id["seg05_pinball_show"]
    s6  = seg_by_id["seg06_forge_mint"]
    s7  = seg_by_id["seg07_exports"]
    s8  = seg_by_id["seg08_share_click"]
    s9  = seg_by_id["seg09_share_page"]
    s10 = seg_by_id["seg10_remix"]
    s11 = seg_by_id["seg11_outro"]

    # 00 Intro (9.0s) — calm opening with 1.2s pause between hook & title, then 2.3s silent Chapter Card 01!
    place_natural("v01_hook",          s0["tl_start"] + 0.45)   # +0.45 .. +4.43
    place_natural("v02_title",         s0["tl_start"] + 5.65)   # +5.65 .. +7.99

    # 01 Gacha (26.8s) — solo bell audition @ +9.5s is WIDE OPEN, card back & 16-card deck unhurried!
    place_natural("v03_gacha_pull",    s1["tl_start"] + 0.40)   # +0.40 .. +2.92  (2.0s pause watching scratch!)
    place_natural("v04_gacha_bell",    s1["tl_start"] + 4.95)   # +4.95 .. +9.39  (2.8s PURE SOLO BELL +9.4..+12.2!)
    place_natural("v05_gacha_back",    s1["tl_start"] + 12.25)  # +12.25 .. +15.26 (4.8s calm browse of 16 cards!)
    place_natural("v05b_gacha_slot",   s1["tl_start"] + 20.10)  # +20.10 .. +22.91 (3.9s watch fly into BeatDeck!)

    # 02 Beat Build (27.2s) — generous musical breathing after every layer + pure Solo Bell @ +17.5..20.5s!
    place_natural("v06_beat_layer",    s2["tl_start"] + 0.60)   # +0.60 .. +4.97  (4.4s pure 2-track groove!)
    place_natural("v07_beat_swap",     s2["tl_start"] + 9.40)   # +9.40 .. +13.18 (7.3s pure 4-track + Solo Bell!)
    place_natural("v08_beat_detail",   s2["tl_start"] + 20.50)  # +20.50 .. +25.30 (1.9s calm breath!)

    # 03 Beat A/B + Variation + Live FX (19.3s) — 5.6s pure A/B listen + 5.0s pure Live FX jam!
    place_natural("v09_beat_ab",       s3["tl_start"] + 0.60)   # +0.60 .. +4.75  (5.6s pure A/B Call-Response!)
    place_natural("v10_beat_fx",       s3["tl_start"] + 10.40)  # +10.40 .. +14.12 (5.2s pure 3-FX live jam!)

    # 04 Pinball Free Jam + 8s Record + Quantize Compare (~24s) — 6+ seconds pure Raw vs Quantized listen!
    place_natural("v11_pinball_free",  s4["tl_start"] + 0.45)   # +0.45 .. +3.81  (1.4s pause!)
    place_natural("v11b_pinball_play", s4["tl_start"] + 5.25)   # +5.25 .. +10.29 (1.4s pure marble bounces!)
    place_natural("v12a_pinball_send", s4["tl_start"] + 11.70)  # +11.70 .. +16.83 (then PURE Raw vs Quantized!)
    place_natural("v12b_pinball_merge", max(s4["tl_start"] + 20.50, s4["tl_end"] - 2.95))  # cleanly right on Merge!

    # 05 Pinball Show Climax (~16.7s) — brief 4.0s cue -> 12.5 FULL SECONDS OF 100% PURE NO-VO CLIMAX SHOW + SIGIL!
    place_natural("v13_pinball_show",  s5["tl_start"] + 0.25)   # +0.25 .. +4.27

    # 06 Forge Design + 5 Foils + Stickers + Mint (~30.5s) — 7.8s foil admiration + 11.5s mint ceremony & pure #MY-01 audition!
    place_natural("v14_forge_foil",    s6["tl_start"] + 0.80)   # +0.80 .. +6.00  (7.8s serene 5-foil tour!)
    place_natural("v15_forge_mint",    s6["tl_start"] + 13.80)  # +13.80 .. +18.68 (11.8s watch mint + pure #MY-01 PCM!)

    # 07 Exports Showcase (9.6s) — 3.9s pure exported WAV listening!
    place_natural("v16a_exports",      s7["tl_start"] + 0.65)   # +0.65 .. +5.70

    # 08 Share Click (3.4s) + 09 Share Page (5.5s) — 3.6s pure simplified outline preview!
    place_natural("v16b_share",        s8["tl_start"] + 0.25)   # ends ~s9 + 1.9s -> 3.6s pure simplified outline!

    # 10 Import + Unseal & Remix (~44.7s) — generous breathing room over EVERY edit, live Night Remix & #MY-02 audition!
    place_natural("v17a_remix",        s10["tl_start"] + 0.85)  # +0.85 .. +4.62  (4.6s watch import & unseal!)
    place_natural("v17b_remix_change", s10["tl_start"] + 9.25)  # +9.25 .. +13.83 (10.5s pure live Night Remix!)
    place_natural("v17c_remix_mint",   s10["tl_start"] + 25.00) # +25.00 .. +29.66 (15s watch mint + pure #MY-02 audition!)

    # 11 Outro (11.2s) — unhurried two-breath close + solo copper bell ring!
    place_natural("v18_outro",         s11["tl_start"] + 0.55)  # +0.55 .. +5.36  (1.1s pause!)
    place_natural("v18b_outro_tag",    s11["tl_start"] + 6.45)  # +6.45 .. +9.66 -> bell decays to +11.2s!

    # Compute actual speech density metric
    total_speech_sec = sum(vp["end"] - vp["start"] for vp in vo_placements)
    log(f"\n==> SPEECH DENSITY: {total_speech_sec:.1f}s speech / {total_dur:.1f}s film = {100*total_speech_sec/total_dur:.1f}% (ZERO atempo speedup!)")

    # 3D. Smooth Broadcast Sidechain Ducking
    vo_env = np.max(np.abs(stem_vo), axis=1)
    win = int(SR * 0.26)
    kernel = np.ones(win, dtype=np.float32) / win
    smooth_vo = np.convolve(vo_env, kernel, mode="same")
    voice_presence = np.clip((smooth_vo - 0.008) / 0.045, 0.0, 1.0)
    duck_product = 1.0 - 0.52 * voice_presence
    duck_music = 1.0 - 0.70 * voice_presence

    master_raw = (
        stem_vo * 1.06
        + stem_product * duck_product[:, None] * 0.96
        + stem_music_sfx * duck_music[:, None] * 0.90
    )

    def soft_limit(x: np.ndarray, thresh: float = 0.86) -> np.ndarray:
        a = np.abs(x)
        over = a > thresh
        y = x.copy()
        y[over] = np.sign(x[over]) * (thresh + (1.0 - thresh) * np.tanh((a[over] - thresh) / (1.0 - thresh)))
        return np.clip(y, -0.96, 0.96).astype(np.float32)

    sf.write(str(STEMS_DIR / "stem_vo.wav"), soft_limit(stem_vo), SR, subtype="PCM_16")
    sf.write(str(STEMS_DIR / "stem_product.wav"), soft_limit(stem_product), SR, subtype="PCM_16")
    sf.write(str(STEMS_DIR / "stem_music_sfx.wav"), soft_limit(stem_music_sfx), SR, subtype="PCM_16")

    raw_master_wav = WORK_DIR / "master_raw.wav"
    final_master_wav = FILM_DIR / "audio" / "master_mix_48k.wav"
    sf.write(str(raw_master_wav), soft_limit(master_raw), SR, subtype="PCM_16")

    subprocess.run([
        FFMPEG, "-y", "-i", str(raw_master_wav),
        "-af", "loudnorm=I=-14.5:TP=-1.2:LRA=9",
        "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le",
        str(final_master_wav),
    ], check=True, capture_output=True)
    m_data, _ = sf.read(str(final_master_wav), dtype="float32")
    log(f"  Master 48kHz mix & 3 stems saved! duration={len(m_data)/SR:.2f}s peak={float(np.max(np.abs(m_data))):.4f}")

    # ==================== STEP 4: EDITABLE SRT + ZERO-OVERLAP ASS SUBTITLES ====================
    log("4) Writing editable SRT & crisp Neo-Brutalism ASS subtitles...")
    srt_lines = []
    ass_events = []
    for idx, vp in enumerate(vo_placements, start=1):
        srt_lines.append(f"{idx}\n{format_srt_ts(vp['start'])} --> {format_srt_ts(vp['end'])}\n{vp['subtitle']}\n")
        ass_events.append(f"Dialogue: 0,{format_ass_ts(vp['start'])},{format_ass_ts(vp['end'])},MainZH,,0,0,0,,{vp['subtitle']}")

    srt_path = SUBS_DIR / "sheka_zaowuju_zh.srt"
    srt_path.write_text("\n".join(srt_lines), encoding="utf-8")

    # Subtle non-overlapping listening cue during pure Choreographed Show climax
    v13_end = next((vp["end"] for vp in vo_placements if vp["id"] == "v13_pinball_show"), s5["tl_start"] + 4.3)
    show_s = v13_end + 0.50
    show_e = s5["tl_end"] - 0.55
    ass_events.append(f"Dialogue: 0,{format_ass_ts(show_s)},{format_ass_ts(show_e)},PureNote,,0,0,0,,♪ 纯享演出 · 冻结编曲实时驱动 · 零物理杂音")

    ass_content = f"""[Script Info]
Title: 声卡造物局 演示影片中文字幕
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: MainZH,Microsoft YaHei,34,&H00F8FDFF,&H000AF6FF,&H001F1A1A,&HE01B1514,1,0,0,0,100,100,1.5,0,3,8,0,2,80,80,10,1
Style: PureNote,Microsoft YaHei,24,&H000AD6FF,&H00FFFFFF,&H001F1A1A,&HC01B1514,1,0,0,0,100,100,1.2,0,3,6,0,2,80,80,14,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ass_events) + "\n"

    ass_path = SUBS_DIR / "sheka_zaowuju_zh.ass"
    ass_path.write_text(ass_content, encoding="utf-8")

    # ==================== STEP 5: RENDER CLEAN MASTER & PRIMARY SUBTITLED MASTER MP4 ====================
    clean_mp4 = RENDERS_DIR / "声卡造物局_纯净无字幕版_1080p.mp4"
    final_mp4 = RENDERS_DIR / "声卡造物局_演示影片_1080p.mp4"

    log("5) Muxing Clean Master MP4 (1920x1080 30fps BT.709 H.264 + AAC 256k 48kHz)...")
    subprocess.run([
        FFMPEG, "-y",
        "-i", str(video_only_mp4),
        "-i", str(final_master_wav),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "256k", "-ar", str(SR),
        "-movflags", "+faststart",
        "-shortest",
        str(clean_mp4),
    ], check=True, capture_output=True)

    log("6) Rendering Primary Subtitled Master MP4 (burned zero-overlap ZH subtitles, BT.709, CRF 18)...")
    ass_esc = str(ass_path).replace("\\", "/").replace(":", "\\:")
    subprocess.run([
        FFMPEG, "-y",
        "-i", str(clean_mp4),
        "-vf", f"ass='{ass_esc}',format=yuv420p",
        "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.1",
        "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "copy",
        "-movflags", "+faststart",
        str(final_mp4),
    ], check=True, capture_output=True)

    tc_doc = {
        "title": "声卡造物局",
        "durationSec": round(probe_duration(final_mp4), 2),
        "speechSec": round(total_speech_sec, 2),
        "speechRatioPct": round(100 * total_speech_sec / total_dur, 1),
        "resolution": "1920x1080",
        "fps": FPS,
        "sampleRate": SR,
        "chapters": [
            {
                "id": s["id"],
                "chapter": s["chapter"],
                "start": format_srt_ts(s["tl_start"])[:8],
                "end": format_srt_ts(s["tl_end"])[:8],
                "durationSec": round(s["dur"], 2),
            }
            for s in segments
        ],
        "voPlacements": vo_placements,
    }
    (DOCS_DIR / "timeline_timecodes.json").write_text(json.dumps(tc_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    log(f"\n====================================================")
    log(f"PRIMARY MASTER READY (v3 CALM CUT): {final_mp4}")
    log(f"Duration: {tc_doc['durationSec']}s ({int(tc_doc['durationSec']//60)}m {tc_doc['durationSec']%60:04.1f}s) | Speech: {tc_doc['speechRatioPct']}% | Size: {final_mp4.stat().st_size / 1e6:.2f} MB")
    log(f"====================================================")


if __name__ == "__main__":
    main()
