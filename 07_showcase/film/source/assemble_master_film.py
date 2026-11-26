r"""
Master Film Assembly, 48kHz Multi-Track Sidechain Mixer, Zero-Overlap Dynamic Subtitles & SRT Exporter
for 《声卡造物局》 Official Demonstration Film.

Outputs:
  - 07_showcase/film/renders/声卡造物局_演示影片_1080p.mp4        (Primary deliverable: 1920x1080 30fps H.264 + AAC 48kHz + burned crisp zero-overlap ZH subtitles)
  - 07_showcase/film/renders/声卡造物局_纯净无字幕版_1080p.mp4     (Clean textless master for easy future re-subtitling)
  - 07_showcase/film/subtitles/sheka_zaowuju_zh.srt               (Editable standard SRT matching exact master timecodes)
  - 07_showcase/film/audio/stems/stem_vo.wav                      (48kHz 16-bit stereo Mandarin VO stem)
  - 07_showcase/film/audio/stems/stem_product.wav                 (48kHz 16-bit stereo authentic product sound stem)
  - 07_showcase/film/audio/stems/stem_music_sfx.wav               (48kHz 16-bit stereo subtle bridge music + transition SFX stem)
  - 07_showcase/film/audio/master_mix_48k.wav                     (48kHz 16-bit stereo broadcast-leveled final mix)
  - 07_showcase/film/docs/timeline_timecodes.json                 (Exact chapter & feature timecode map for docs & verification)
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


def prepare_framed_segment(src_mp4: Path, out_mp4: Path, trim_start: float, trim_end: float, framed: bool, bg_hex: str, badge_text: str | None = None):
    """
    Standardize every segment cleanly to 1920x1080 @ 30fps CFR yuv420p.
    - For full-UI workbench scenes (`framed=True`): gently scale to 1808x1017 (exact 16:9, 94.2%)
      seated at y=6 on a matching #F7F3E9 (or #14151B) drafting mat with crisp dark border,
      reserving a dedicated 57px zero-overlap subtitle rail at the bottom (y=1023..1080)!
    - For motion-graphic & theater climax scenes (`framed=False`): full-bleed 1920x1080!
    """
    dur = max(0.2, trim_end - trim_start)
    if framed:
        # 1808x1017 crisp Lanczos scale + 3px #1A1A1F border frame seated cleanly at top-center (x=53, y=4)
        # Convert cleanly to standard BT.709 TV-range yuv420p so colors match across all players/browsers!
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

    # Measure exact real durations of every source clip
    def dur_of(p: Path) -> float:
        return probe_duration(p)

    # Define the 12-segment master editorial cut list
    # Each entry: (id, src_path, wav_path_or_None, trim_start, trim_end_override_or_neg_offset, framed, bg_hex, trans_in, trans_dur, chapter_title)
    # Positive value for trim_spec = explicit trim_end timestamp; negative or 0 = offset from clip end.
    raw_specs = [
        ("seg00_intro",        MOTION_DIR / "motion_00_intro.mp4",    None,                                     0.00,  0.00, False, "#F7F3E9", None,         0.00, "00 片头 · 声卡造物局"),
        ("seg01_gacha",        CLIPS_DIR / "s01_gacha.mp4",           CLIPS_DIR / "s01_gacha.wav",              0.15, -0.10, True,  "#F7F3E9", "wipeleft",   0.35, "01 声卡盲盒 · 扭取、刮膜与试听"),
        ("seg02_beat_build",   CLIPS_DIR / "s02_beat_build.mp4",      CLIPS_DIR / "s02_beat_build.wav",         0.10, -0.05, True,  "#F7F3E9", "fade",       0.25, "02 插卡编曲 · 四轨叠加、换卡与微调"),
        ("seg03_beat_ab_fx",   CLIPS_DIR / "s03_beat_ab_fx.mp4",      CLIPS_DIR / "s03_beat_ab_fx.wav",         0.05, -0.15, True,  "#F7F3E9", "fade",       0.18, "02 插卡编曲 · 32步A/B乐句、规则变奏与现场效果"),
        ("seg04_pinball_free", CLIPS_DIR / "s04_pinball_free.mp4",    CLIPS_DIR / "s04_pinball_free.wav",       0.10, -0.25, True,  "#F7F3E9", "slideleft",  0.35, "03 弹珠剧场 · 自由实验、8秒录制与量化对比"),
        ("seg05_pinball_show", CLIPS_DIR / "s05_pinball_show.mp4",    CLIPS_DIR / "s05_pinball_show.wav",       0.10, 18.20, False, "#14151B", "fadeblack",  0.45, "03 弹珠剧场 · 《铃响晴巷》编曲剧场高潮演出（无旁白纯享）"),
        ("seg06_forge_mint",   CLIPS_DIR / "s06_forge_mint.mp4",      CLIPS_DIR / "s06_forge_mint.wav",         0.10, 19.35, True,  "#F7F3E9", "circleopen", 0.45, "04 闪卡铸造 · 命名、五材质对比、贴纸与压印入册"),
        ("seg07_exports",      MOTION_DIR / "motion_06_exports.mp4",  None,                                     0.00,  0.00, False, "#14151B", "fade",       0.40, "05 同源四格式成果 · PNG/WebM/WAV/可编辑工程"),
        ("seg08_share_click",  CLIPS_DIR / "s07_share_click.mp4",     CLIPS_DIR / "s07_share_click.wav",        0.05, -0.15, True,  "#F7F3E9", "fade",       0.25, "05 本机归档 · 只读分享链接生成"),
        ("seg09_share_page",   CLIPS_DIR / "s07_share_page.mp4",      CLIPS_DIR / "s07_share_page.wav",         0.10, -0.10, True,  "#F7F3E9", "wipeleft",   0.30, "05 本机归档 · 只读作品展页与简化音符轮廓试听"),
        ("seg10_remix",        CLIPS_DIR / "s08_import_and_remix.mp4",CLIPS_DIR / "s08_import_and_remix.wav",   0.10, 25.10, True,  "#F7F3E9", "fade",       0.35, "06 工程导入恢复与拆封重混 · #MY-02《铃响晴巷·夜行版》"),
        ("seg11_outro",        MOTION_DIR / "motion_07_outro.mp4",    None,                                     0.00,  0.00, False, "#14151B", "fade",       0.50, "07 片尾定版 · 原作与重混双卡呼应"),
    ]

    log("1) Preparing standardized 1920x1080 @ 30fps BT.709 segments...")
    segments = []
    timeline_cursor = 0.0
    for idx, (sid, src_mp4, wav_path, ts, te_spec, framed, bg, trans, tdur, chap) in enumerate(raw_specs):
        full_d = dur_of(src_mp4)
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

    # ==================== STEP 2: CONCATENATE VIDEO WITH SMOOTH XFADE TRANSITIONS ====================
    log("2) Stitching video timeline with Neo-Brutalism transitions...")
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

    # ==================== STEP 3: BUILD 48kHz MULTI-TRACK STEMS & SIDECHAIN MIX ====================
    log("3) Building 48kHz stereo stems (Product / VO / Bridge Music & SFX)...")
    total_samples = int(math.ceil((max(total_dur, vid_dur) + 0.15) * SR))
    stem_product = np.zeros((total_samples, 2), dtype=np.float32)
    stem_vo = np.zeros((total_samples, 2), dtype=np.float32)
    stem_music_sfx = np.zeros((total_samples, 2), dtype=np.float32)

    seg_by_id = {s["id"]: s for s in segments}

    # 3A. Place 100% genuine product audio aligned sample-for-sample with every UI clip!
    for seg in segments:
        if seg["wav_path"] and seg["wav_path"].exists():
            w = load_wav_48k(seg["wav_path"])
            s0 = int(round(seg["trim_start"] * SR))
            s1 = min(len(w), int(round(seg["trim_end"] * SR)))
            clip_w = w[s0:s1]
            # Mild per-clip loudness balance so clicks, bell, beat, pinball, and share outline all sit vibrantly!
            gain = 1.0
            if seg["id"] == "seg01_gacha":
                gain = 1.25  # Bring out crisp lever ratchet, silver foil scratch & solo bell!
            elif seg["id"] == "seg09_share_page":
                gain = 1.35  # Make read-only share outline preview unmistakably audible!
            elif seg["id"] == "seg05_pinball_show":
                gain = 1.06  # Climax show shines at full energy!
            add_audio(stem_product, clip_w, seg["tl_start"], gain=gain, fade_in=0.06, fade_out=0.08)

    # Also place genuine exported WAVs & isolated hero bell motif in the pure motion-graphic showcase segments!
    bell_solo = load_wav_48k(CLIPS_DIR / "motif_bell_solo.wav")
    my01_wav = load_wav_48k(EXPORTS_DIR / "lingxiang-qingxiang.wav")
    my02_wav = load_wav_48k(EXPORTS_DIR / "lingxiang-night-remix.wav")

    # Intro (seg00): authentic #05 street bell rings right as hero card pops at t=0.15s!
    add_audio(stem_product, bell_solo, seg_by_id["seg00_intro"]["tl_start"] + 0.08, gain=4.2, fade_in=0.01, fade_out=0.05)

    # Exports Showcase (seg07): plays genuine exported lingxiang-qingxiang.wav (exact 1:1 audio driving the on-screen WAV visualizer!)
    s07_t = seg_by_id["seg07_exports"]["tl_start"]
    add_audio(stem_product, my01_wav, s07_t + 0.05, gain=0.92, fade_in=0.04, fade_out=0.15)
    # Loop a soft second pass tail gently to fill remaining 2s of 7.6s showcase
    if len(my01_wav) / SR < 7.2:
        rem_sec = 7.4 - (len(my01_wav) / SR)
        add_audio(stem_product, my01_wav[: int(rem_sec * SR)], s07_t + len(my01_wav) / SR, gain=0.72, fade_in=0.08, fade_out=0.45)

    # Outro (seg11): plays genuine exported #MY-02 lingxiang-night-remix.wav echoing into a final solo #05 street bell ring!
    s11_t = seg_by_id["seg11_outro"]["tl_start"]
    add_audio(stem_product, my02_wav, s11_t + 0.05, gain=0.88, fade_in=0.06, fade_out=0.35)
    # Final poetic signature: clean #05 二八大杠车铃 chime at outro t+7.15s with full natural decay tail!
    add_audio(stem_product, bell_solo, s11_t + 7.15, gain=4.4, fade_in=0.01, fade_out=0.08)

    # 3B. Place tactile transition SFX & ultra-light bridge music ONLY in motion-graphic intro/transition spots
    # (NEVER over product solo auditions, variations, A/B quantize, show climax, or share outline!)
    whoosh = load_wav_48k(SFX_DIR / "trans_card_whoosh.wav")
    shimmer = load_wav_48k(SFX_DIR / "trans_foil_shimmer.wav")
    pops = load_wav_48k(SFX_DIR / "intro_toy_pops.wav")
    bridge = load_wav_48k(MUSIC_DIR / "bridge_groove_118bpm.wav")

    # Intro light groove bed (t=0.85s..7.4s, fades out cleanly before gacha lever pull!)
    add_audio(stem_music_sfx, bridge[: int(6.6 * SR)], 0.85, gain=0.35, fade_in=0.45, fade_out=0.80)
    add_audio(stem_music_sfx, pops, 3.35, gain=0.40, fade_in=0.01, fade_out=0.05)

    # Subtle warm 118 BPM marimba bed ONLY during quiet Forge foil/sticker design phase (fades out BEFORE #MY-01 PCM audition!)
    s6_ref = seg_by_id["seg06_forge_mint"]
    add_audio(stem_music_sfx, bridge[: int(13.0 * SR)], s6_ref["tl_start"] + 0.35, gain=0.24, fade_in=0.55, fade_out=0.95)

    # Chapter transition tactile SFX synced to exact xfade timestamps
    for sid, sfx_wav, g in [
        ("seg01_gacha", whoosh, 0.34),
        ("seg04_pinball_free", whoosh, 0.34),
        ("seg05_pinball_show", shimmer, 0.44),
        ("seg06_forge_mint", shimmer, 0.44),
        ("seg07_exports", pops, 0.36),
        ("seg09_share_page", whoosh, 0.30),
        ("seg11_outro", shimmer, 0.46),
    ]:
        t_tr = seg_by_id[sid]["tl_start"]
        add_audio(stem_music_sfx, sfx_wav, max(0.0, t_tr - 0.08), gain=g, fade_in=0.01, fade_out=0.04)

    # 3C. Place all 21 Mandarin Voiceover lines strictly inside their visual chapters!
    # Zero drift, zero bleed across cuts, guaranteed breathing room over every key product sound moment:
    #  - Open solo bell audition in s01 (+4.2..+6.3s)
    #  - Open 4-track groove & solo bell in s02 (+11.1..+13.5s)
    #  - Open A/B variation (+5.1..+6.6s) & live 3-FX jam (+10.5..+13.2s) in s03
    #  - Open free bounce (+6.2..+8.3s) & Raw-vs-Quantized comparison (+10.3..+14.0s) in s04
    #  - 13 SECONDS of 100% pure VO-free Choreographed Show Climax + Finale Sigil in s05!
    #  - Full 5.5s pure minted #MY-01 PCM audition in s06!
    #  - Full 3.5s pure read-only share simplified outline preview in s09!
    #  - Full 5.5s pure BeatDeck Night Remix & full 5.5s pure minted #MY-02 audition in s10!
    stem_vo[:] = 0.0
    vo_placements = []

    def place_exact(vo_id: str, desired_start: float, hard_end: float):
        item = vo_map[vo_id]
        w = load_wav_48k(Path(item["wav"]))
        d = len(w) / SR
        st = desired_start
        if vo_placements:
            prev_end = vo_placements[-1]["end"]
            st = max(st, prev_end + 0.18)
        # If line slightly exceeds hard_end, gently speed up (up to 1.15x, natural pitch via atempo) so zero drift EVER occurs!
        if st + d > hard_end:
            avail = max(0.6, hard_end - st)
            speed = min(1.16, d / avail)
            if speed > 1.015:
                tmp_in = WORK_DIR / f"_vo_{vo_id}_in.wav"
                tmp_out = WORK_DIR / f"_vo_{vo_id}_out.wav"
                sf.write(str(tmp_in), w, SR, subtype="PCM_16")
                subprocess.run([FFMPEG, "-y", "-i", str(tmp_in), "-af", f"atempo={speed:.4f}", "-ar", str(SR), str(tmp_out)], check=True, capture_output=True)
                w = load_wav_48k(tmp_out)
                d = len(w) / SR
        add_audio(stem_vo, w, st, gain=1.12, fade_in=0.01, fade_out=0.02)
        rec_item = {"id": vo_id, "start": round(st, 3), "end": round(st + d, 3), "subtitle": item["subtitle"], "text": item["text"]}
        vo_placements.append(rec_item)
        log(f"    VO {vo_id:22s}: {st:6.2f}s .. {st+d:6.2f}s (dur {d:4.2f}s, bound<={hard_end:6.2f}s)")
        return rec_item

    s0 = seg_by_id["seg00_intro"]
    s1 = seg_by_id["seg01_gacha"]
    s2 = seg_by_id["seg02_beat_build"]
    s3 = seg_by_id["seg03_beat_ab_fx"]
    s4 = seg_by_id["seg04_pinball_free"]
    s5 = seg_by_id["seg05_pinball_show"]
    s6 = seg_by_id["seg06_forge_mint"]
    s7 = seg_by_id["seg07_exports"]
    s8 = seg_by_id["seg08_share_click"]
    s9 = seg_by_id["seg09_share_page"]
    s10 = seg_by_id["seg10_remix"]
    s11 = seg_by_id["seg11_outro"]

    # 00 Intro (0 .. 7.5s)
    place_exact("v01_hook",               s0["tl_start"] + 0.25, hard_end=s0["tl_start"] + 4.90)
    place_exact("v02_title",              s0["tl_start"] + 5.10, hard_end=s0["tl_end"] - 0.05)

    # 01 Gacha (17.1s) -> open window at +5.1..+6.15s right over solo bell ring (+5.5s)!
    place_exact("v03_gacha_pull",         s1["tl_start"] + 0.15, hard_end=s1["tl_start"] + 5.10)
    place_exact("v04_gacha_bell",         s1["tl_start"] + 6.15, hard_end=s1["tl_start"] + 10.95)
    place_exact("v05_gacha_back_deck",    s1["tl_start"] + 11.15, hard_end=s1["tl_end"] - 0.15)

    # 02 Beat Build (19.3s) -> open window at +12.15..+14.05s for 4-track groove + solo bell!
    place_exact("v06_beat_layer",         s2["tl_start"] + 0.20, hard_end=s2["tl_start"] + 6.10)
    place_exact("v07_beat_swap",          s2["tl_start"] + 6.30, hard_end=s2["tl_start"] + 12.15)
    place_exact("v08_beat_detail",        s2["tl_start"] + 14.05, hard_end=s2["tl_end"] - 0.15)

    # 03 Beat A/B + Variation + Live FX (13.2s) -> open variation (+6.05..+6.60s) & live FX jam (+11.40..+13.23s)!
    place_exact("v09_beat_ab_var",        s3["tl_start"] + 0.15, hard_end=s3["tl_start"] + 6.08)
    place_exact("v10_beat_fx",            s3["tl_start"] + 6.50, hard_end=s3["tl_start"] + 11.40)

    # 04 Pinball Free Jam + 8s Record + Quantize A/B Compare (17.6s)
    # -> 100% SILENT VO over Raw (10.5-12.0s) vs Quantized (12.5-14.0s)!!
    place_exact("v11_pinball_free",       s4["tl_start"] + 0.15, hard_end=s4["tl_start"] + 7.45)
    place_exact("v12a_pinball_send",      s4["tl_start"] + 7.65, hard_end=s4["tl_start"] + 10.42)
    place_exact("v12b_pinball_merge",     s4["tl_start"] + 14.00, hard_end=s4["tl_end"] - 0.10)

    # 05 Pinball Show Climax (~18.1s): brief 4.7s intro cue -> FULL 13.2 SECONDS OF PURE NO-VO THEATER CLIMAX + SIGIL!
    place_exact("v13_pinball_show_intro", s5["tl_start"] + 0.15, hard_end=s5["tl_start"] + 4.85)

    # 06 Forge Design + 5 Foils + Stickers + Mint Ceremony (~19.25s) -> leaves last 6.0s PURE #MY-01 PCM audition!
    place_exact("v14_forge_design",       s6["tl_start"] + 0.20, hard_end=s6["tl_start"] + 6.85)
    place_exact("v15_forge_sticker_mint", s6["tl_start"] + 7.10, hard_end=s6["tl_start"] + 13.15)

    # 07 Exports Showcase (7.6s) -> leaves last 1.5s to savor real exported WAV!
    place_exact("v16a_exports",           s7["tl_start"] + 0.20, hard_end=s7["tl_start"] + 6.10)

    # 08 Share Click (2.1s) + 09 Share Page (4.2s) -> finishes at s9 + 1.0s, leaving >3.0s PURE simplified outline preview!
    place_exact("v16b_share",             s8["tl_start"] + 0.05, hard_end=s9["tl_start"] + 1.10)

    # 10 Import + Unseal & Remix -> live BeatDeck remix (7.4-12.5s) & minted #MY-02 audition (final ~5.5s) 100% VO-FREE!
    place_exact("v17a_import_remix",      s10["tl_start"] + 0.15, hard_end=s10["tl_start"] + 7.25)
    place_exact("v17b_mint_remix",        s10["tl_start"] + 13.30, hard_end=s10["tl_start"] + 18.20)

    # 11 Outro (9.5s): warm closing message finishing right as final solo #05 bell rings at +7.15s!
    place_exact("v18_outro",              s11["tl_start"] + 0.20, hard_end=s11["tl_start"] + 7.35)

    # 3D. Smooth Broadcast Sidechain Ducking (Product & Music gently yield whenever VO speaks!)
    vo_env = np.max(np.abs(stem_vo), axis=1)
    # 200ms RMS/sliding envelope detector
    win = int(SR * 0.22)
    kernel = np.ones(win, dtype=np.float32) / win
    smooth_vo = np.convolve(vo_env, kernel, mode="same")
    # Convert to ducking factor: 1.0 when silent, 0.48 (-6.4 dB) for product audio during VO, 0.32 for bridge music during VO
    voice_presence = np.clip((smooth_vo - 0.008) / 0.045, 0.0, 1.0)
    duck_product = 1.0 - 0.50 * voice_presence
    duck_music = 1.0 - 0.68 * voice_presence

    master_raw = (
        stem_vo * 1.05
        + stem_product * duck_product[:, None] * 0.96
        + stem_music_sfx * duck_music[:, None] * 0.92
    )

    # Soft transparent peak limiter (tanh knee above 0.88 -> strictly zero digital clipping!)
    def soft_limit(x: np.ndarray, thresh: float = 0.86) -> np.ndarray:
        a = np.abs(x)
        over = a > thresh
        y = x.copy()
        y[over] = np.sign(x[over]) * (thresh + (1.0 - thresh) * np.tanh((a[over] - thresh) / (1.0 - thresh)))
        return np.clip(y, -0.96, 0.96).astype(np.float32)

    # Save 3 discrete lossless 48kHz 16-bit stereo stems!
    sf.write(str(STEMS_DIR / "stem_vo.wav"), soft_limit(stem_vo), SR, subtype="PCM_16")
    sf.write(str(STEMS_DIR / "stem_product.wav"), soft_limit(stem_product), SR, subtype="PCM_16")
    sf.write(str(STEMS_DIR / "stem_music_sfx.wav"), soft_limit(stem_music_sfx), SR, subtype="PCM_16")

    raw_master_wav = WORK_DIR / "master_raw.wav"
    final_master_wav = FILM_DIR / "audio" / "master_mix_48k.wav"
    sf.write(str(raw_master_wav), soft_limit(master_raw), SR, subtype="PCM_16")

    # Apply broadcast loudness normalization (-14.5 LUFS, True Peak -1.2 dBTP) via FFmpeg loudnorm
    subprocess.run([
        FFMPEG, "-y", "-i", str(raw_master_wav),
        "-af", "loudnorm=I=-14.5:TP=-1.2:LRA=9",
        "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le",
        str(final_master_wav),
    ], check=True, capture_output=True)
    m_data, _ = sf.read(str(final_master_wav), dtype="float32")
    log(f"  Master 48kHz mix & 3 stems saved! duration={len(m_data)/SR:.2f}s peak={float(np.max(np.abs(m_data))):.4f}")

    # ==================== STEP 4: GENERATE EDITABLE SRT + ZERO-OVERLAP STYLED ASS SUBTITLES ====================
    log("4) Writing editable SRT & crisp Neo-Brutalism ASS subtitles...")
    srt_lines = []
    ass_events = []
    for idx, vp in enumerate(vo_placements, start=1):
        srt_lines.append(f"{idx}\n{format_srt_ts(vp['start'])} --> {format_srt_ts(vp['end'])}\n{vp['subtitle']}\n")
        # Clean pill-styled bottom rail subtitle (MarginV=12 seats right inside the dedicated 57px zero-overlap bottom rail!)
        ass_events.append(f"Dialogue: 0,{format_ass_ts(vp['start'])},{format_ass_ts(vp['end'])},MainZH,,0,0,0,,{vp['subtitle']}")

    srt_path = SUBS_DIR / "sheka_zaowuju_zh.srt"
    srt_path.write_text("\n".join(srt_lines), encoding="utf-8")

    # Add subtle non-intrusive chapter badge cue on pure climax show so audience knows it's pure listening time
    # Starts AFTER v13 finishes (zero overlap!) and sits cleanly in the lower dark brick base (MarginV=12)
    show_s = max(s5["tl_start"] + 5.35, next((vp["end"] + 0.35 for vp in vo_placements if vp["id"] == "v13_pinball_show_intro"), s5["tl_start"] + 5.35))
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
    # Escape Windows drive colon for FFmpeg libass filter
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

    # Save complete exact timecode map for documentation & inspection
    tc_doc = {
        "title": "声卡造物局",
        "durationSec": round(probe_duration(final_mp4), 2),
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
    log(f"PRIMARY MASTER READY: {final_mp4}")
    log(f"Duration: {tc_doc['durationSec']}s | Size: {final_mp4.stat().st_size / 1e6:.2f} MB")
    log(f"====================================================")


if __name__ == "__main__":
    main()
