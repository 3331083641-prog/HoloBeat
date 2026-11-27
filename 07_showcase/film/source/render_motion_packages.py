"""
Deterministic 60fps Motion Graphics & Cover Renderer for 《声卡造物局》.
Uses the project's exact Neo-Brutalism design tokens, local bundled Noto Sans SC / JetBrains Mono fonts,
real GPT Image 2 transparent card & sticker assets, and real exported PNG/WAV/WebM artifacts.

Renders:
  1. motion_00_intro.mp4    (7.5s @ 60fps, 1920x1080) - Toy-box title & 16-card parade
  2. motion_06_exports.mp4  (7.6s @ 60fps, 1920x1080) - 4-format authentic export showcase (embeds real WebM + real WAV envelope + real PNG)
  3. motion_07_outro.mp4    (9.5s @ 60fps, 1920x1080) - Dual-card #MY-01 vs #MY-02 lineage & brand end-card
  4. covers/cover_1920x1080.png + covers/cover_480x270.png + covers/cover_480x270.jpg
"""
import functools
import json
import math
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import imageio_ffmpeg
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[3]
FILM_DIR = ROOT_DIR / "07_showcase" / "film"
SOURCE_DIR = FILM_DIR / "source"
EXPORTS_DIR = FILM_DIR / "capture" / "exports"
MOTION_DIR = FILM_DIR / "capture" / "motion"
COVERS_DIR = FILM_DIR / "covers"
CACHE_DIR = MOTION_DIR / "_prepared"

for d in (MOTION_DIR, COVERS_DIR, CACHE_DIR):
    d.mkdir(parents=True, exist_ok=True)

CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FPS = 30


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_repo_http_server():
    handler = functools.partial(QuietHandler, directory=str(ROOT_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server, port


def prepare_clean_poster_display(src_png: Path, dst_full: Path, dst_card_only: Path):
    """
    Create film-display clean copies of the genuine exported 1200x1600 poster PNG:
    - Replaces top-left 'HOLOBEAT · 声卡造物局' header strip seamlessly on matching #121319 drafting mat
      with pure '声卡造物局 · 典藏展板' (leaving original exported PNG completely untouched!).
    - Also crops the centered 800x1120 HD holographic card face for crisp dual-card outro display.
    """
    im = Image.open(src_png).convert("RGBA")
    W, H = im.size
    clean = im.copy()
    draw = ImageDraw.Draw(clean)
    # Cover only the exact top-left text bbox (x=86..420, y=50..96) with exact mat background #121319 + subtle grid preservation
    draw.rectangle([86, 50, 440, 94], fill=(18, 19, 25, 255))
    # Restore subtle 40px vertical/horizontal mat grid lines at x=120,160,... y=80
    for gx in range(120, 440, 40):
        draw.line([(gx, 50), (gx, 94)], fill=(255, 255, 255, 10), width=1)
    draw.line([(86, 80), (440, 80)], fill=(255, 255, 255, 10), width=1)

    # Render crisp Chinese replacement using system Microsoft YaHei Bold / fallback
    font_candidates = [
        "C:/Windows/Fonts/msyhbd.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/msyh.ttc",
    ]
    font = None
    for fp in font_candidates:
        if Path(fp).exists():
            font = ImageFont.truetype(fp, 22)
            break
    if font is None:
        font = ImageFont.load_default()
    draw.text((92, 58), "声卡造物局 · 典藏展板", fill=(251, 249, 244, 210), font=font)
    clean.save(dst_full)

    # Extract centered 800x1120 HD card (cardX=200, cardY=144 in exportHoloPng.ts)
    card_crop = im.crop((196, 140, 1004, 1268))
    card_crop.save(dst_card_only)


def extract_wav_envelope_bars(wav_path: Path, total_frames: int, num_bars: int = 32):
    """Compute real frame-accurate 32-band energy bars directly from the exported 48kHz WAV!"""
    data, sr = sf.read(str(wav_path), dtype="float32")
    mono = np.mean(data, axis=1) if data.ndim > 1 else data
    dur = len(mono) / sr
    # Overall static waveform fingerprint (28 bars) + per-frame dynamic FFT spectrum
    per_frame = []
    win = 1024
    hann = np.hanning(win)
    # Loop seamlessly over wav duration during showcase
    for f in range(total_frames):
        t = (f / FPS) % max(0.5, dur)
        center = int(t * sr)
        start = max(0, min(len(mono) - win, center - win // 2))
        seg = mono[start : start + win]
        if len(seg) < win:
            seg = np.pad(seg, (0, win - len(seg)))
        spec = np.abs(np.fft.rfft(seg * hann))
        # Log-spaced bins from 60Hz to 11kHz
        freqs = np.fft.rfftfreq(win, 1.0 / sr)
        edges = np.geomspace(60, 11000, num_bars + 1)
        bars = []
        for b in range(num_bars):
            mask = (freqs >= edges[b]) & (freqs < edges[b + 1])
            val = float(np.mean(spec[mask])) if np.any(mask) else 0.0
            norm = min(1.0, max(0.08, (math.log1p(val * 4.5) / 3.4)))
            bars.append(round(norm, 3))
        rms = float(np.sqrt(np.mean(seg ** 2)))
        per_frame.append({"rms": round(min(1.0, rms * 3.8), 3), "bars": bars, "prog": round(t / max(0.1, dur), 4)})
    return {"durationSec": round(dur, 3), "sampleRate": sr, "frames": per_frame}


def build_stage_html(port: int, wav_data: dict) -> str:
    """Single ultra-crisp HTML stage hosting 4 deterministic modes: intro, exports, outro, cover."""
    base = f"http://127.0.0.1:{port}"
    # Load real font CSS via Vite dev server at 5173 OR directly import fontsource CSS from repo!
    # Since Vite dev server is running at 127.0.0.1:5173, we can load its exact fontsource stylesheets,
    # OR define clean @font-face pointing to local repo font files + system fallbacks!
    cards = [
        ("bamboo-cat", "#01", "弄堂竹板", "#7C3AED", "律动"),
        ("arcade-bot", "#02", "街机拍键", "#7C3AED", "律动"),
        ("chestnut-pop", "#03", "糖炒栗子", "#7C3AED", "律动"),
        ("lion-drum", "#04", "舞狮大鼓", "#7C3AED", "律动"),
        ("street-bell", "#05", "二八车铃", "#FF5C2B", "脆响"),
        ("soda-frog", "#06", "汽水拉环", "#FF5C2B", "脆响"),
        ("mahjong-fox", "#07", "麻将脆碰", "#FF5C2B", "脆响"),
        ("street-rattle", "#08", "货郎摇鼓", "#FF5C2B", "脆响"),
        ("lucky-coin", "#09", "街机投币", "#00D4AA", "旋律"),
        ("sugar-spoon", "#10", "糖画铜勺", "#00D4AA", "旋律"),
        ("cyber-zither", "#11", "赛博古筝", "#00D4AA", "旋律"),
        ("ferris-box", "#12", "八音盒轮", "#00D4AA", "旋律"),
        ("night-sizzle", "#13", "夜市铁板", "#FFD60A", "氛围"),
        ("rain-cloud", "#14", "梅雨雨棚", "#FFD60A", "氛围"),
        ("neon-tape", "#15", "霓虹电流", "#FFD60A", "氛围"),
        ("cicada-moon", "#16", "晚风蝉鸣", "#FFD60A", "氛围"),
    ]
    stickers = ["clapper", "bell", "coin", "spoon", "spatula", "cassette", "raindrop", "cicada", "bolt", "note", "starburst", "crown"]

    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="http://127.0.0.1:5173/node_modules/@fontsource/noto-sans-sc/700.css" />
<link rel="stylesheet" href="http://127.0.0.1:5173/node_modules/@fontsource/noto-sans-sc/900.css" />
<link rel="stylesheet" href="http://127.0.0.1:5173/node_modules/@fontsource/jetbrains-mono/700.css" />
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{
    width: 1920px; height: 1080px; overflow: hidden;
    font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased;
    user-select: none;
  }}
  .mono {{ font-family: "JetBrains Mono", "Noto Sans SC", monospace; }}
  .scene {{ position: absolute; inset: 0; display: none; width: 1920px; height: 1080px; overflow: hidden; }}
  .scene.active {{ display: block; }}

  /* Neo-Brutalism Drafting Grid */
  .cream-bg {{
    background-color: #F7F3E9;
    background-image:
      radial-gradient(rgba(26,26,31,0.11) 1.5px, transparent 1.5px),
      radial-gradient(circle at 50% 42%, rgba(255,214,10,0.22), transparent 58%);
    background-size: 28px 28px, 100% 100%;
  }}
  .dark-bg {{
    background-color: #14151B;
    background-image:
      linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px),
      radial-gradient(circle at 50% 48%, rgba(124,58,237,0.18), transparent 62%);
    background-size: 36px 36px, 36px 36px, 100% 100%;
  }}
  .brutal {{
    border: 4px solid #1A1A1F;
    box-shadow: 8px 8px 0px #1A1A1F;
  }}
  .brutal-sm {{
    border: 3px solid #1A1A1F;
    box-shadow: 5px 5px 0px #1A1A1F;
  }}

  /* ================= SCENE 1: INTRO ================= */
  #intro-ring-wrap {{ position: absolute; left: 960px; top: 500px; }}
  .ring-arc {{
    position: absolute; border-radius: 50%; border: 5px solid #FF5C2B;
    transform: translate(-50%, -50%) scale(0.2); opacity: 0;
  }}
  #intro-hero-card {{
    position: absolute; left: 50%; top: 47%;
    width: 340px; height: 470px;
    margin-left: -170px; margin-top: -235px;
    border-radius: 28px; padding: 14px;
    background: linear-gradient(130deg, #FEF08A 0%, #FF5C2B 35%, #7C3AED 70%, #00D4AA 100%);
    border: 4.5px solid #1A1A1F;
    box-shadow: 12px 12px 0px #1A1A1F, 0 24px 60px rgba(26,26,31,0.22);
    transform-origin: center center;
  }}
  #intro-hero-inner {{
    width: 100%; height: 100%; border-radius: 18px;
    border: 3px solid #1A1A1F; background: linear-gradient(180deg, #FFFDF8 0%, #FFE4D1 100%);
    display: flex; flex-direction: column; overflow: hidden; position: relative;
  }}
  #intro-parade {{
    position: absolute; inset: 0; pointer-events: none;
  }}
  .parade-card {{
    position: absolute; width: 176px; height: 226px; border-radius: 18px;
    background: #FFFDF8; border: 3.5px solid #1A1A1F; box-shadow: 6px 6px 0px #1A1A1F;
    display: flex; flex-direction: column; overflow: hidden;
    transform-origin: center center;
  }}
  #intro-title-lockup {{
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 24px; pointer-events: none;
  }}
  .title-badge {{
    display: inline-flex; align-items: center; gap: 18px;
    background: #FFFDF8; border: 5px solid #1A1A1F; border-radius: 30px;
    padding: 24px 52px; box-shadow: 12px 12px 0px #1A1A1F;
  }}
  .title-text {{
    font-size: 98px; font-weight: 900; letter-spacing: 0.08em; color: #1A1A1F; line-height: 1.05;
  }}
  .slogan-pill {{
    background: #FFD60A; border: 4px solid #1A1A1F; border-radius: 999px;
    padding: 14px 40px; box-shadow: 6px 6px 0px #1A1A1F;
    font-size: 32px; font-weight: 900; color: #1A1A1F; letter-spacing: 0.06em;
  }}
  .steps-row {{ display: flex; gap: 16px; margin-top: 6px; }}
  .step-chip {{
    padding: 10px 22px; border-radius: 16px; border: 3px solid #1A1A1F;
    box-shadow: 4px 4px 0px #1A1A1F; font-size: 20px; font-weight: 900;
  }}

  /* ================= SCENE 2: EXPORTS SHOWCASE ================= */
  #exports-header {{
    position: absolute; top: 38px; left: 72px; right: 72px;
    display: flex; align-items: center; justify-content: space-between;
  }}
  .exp-grid {{
    position: absolute; top: 128px; left: 72px; right: 72px; bottom: 68px;
    display: grid; grid-template-columns: 520px 560px 1fr; gap: 36px; align-items: stretch;
  }}
  .exp-panel {{
    background: rgba(255,253,248,0.045); border: 2.5px solid rgba(255,255,255,0.16);
    border-radius: 26px; padding: 22px; display: flex; flex-direction: column;
    justify-content: space-between; position: relative; overflow: hidden;
  }}
  .exp-tag {{
    display: inline-flex; align-items: center; gap: 10px;
    font-size: 19px; font-weight: 900; color: #FFFDF8;
  }}
  .exp-pill {{
    padding: 4px 14px; border-radius: 999px; font-size: 14px; font-weight: 900;
    border: 2px solid #1A1A1F;
  }}

  /* ================= SCENE 3: OUTRO ================= */
  .outro-card-wrap {{
    position: absolute; top: 140px; width: 410px; height: 574px;
    border-radius: 30px; overflow: hidden;
    border: 4px solid #1A1A1F;
    box-shadow: 0 28px 64px rgba(0,0,0,0.65), 10px 10px 0px rgba(255,214,10,0.28);
  }}
  .outro-card-wrap img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
  .foil-sweep {{
    position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen;
    background: linear-gradient(118deg, transparent 22%, rgba(255,255,255,0.42) 48%, rgba(255,214,10,0.22) 54%, transparent 76%);
  }}

  /* ================= SCENE 4: COVER ================= */
  #scene-cover {{
    background:
      radial-gradient(circle at 71% 50%, rgba(255,214,10,0.34), rgba(255,92,43,0.14) 38%, transparent 66%),
      radial-gradient(circle at 22% 84%, rgba(124,58,237,0.20), transparent 52%),
      radial-gradient(rgba(26,26,31,0.10) 1.5px, transparent 1.5px),
      #F7F3E9;
    background-size: 100% 100%, 100% 100%, 26px 26px, 100% 100%;
  }}

  /* ================= SCENE 5: CHAPTER INTERSTITIAL CARDS ================= */
  #scene-chapter {{
    display: none; align-items: center; justify-content: center;
  }}
  #scene-chapter.active {{ display: flex; }}
  #chap-card {{
    display: flex; flex-direction: column; align-items: center; gap: 28px;
    text-align: center; padding: 54px 86px; border-radius: 36px;
    border: 5px solid #1A1A1F; box-shadow: 14px 14px 0px #1A1A1F;
    background: #FFFDF8;
  }}
  #chap-card.dark-card {{
    background: #1B1D26; border-color: #FFD60A;
    box-shadow: 12px 12px 0px rgba(255,214,10,0.38), 0 28px 70px rgba(0,0,0,0.65);
  }}
  #chap-pill {{
    display: inline-flex; align-items: center; gap: 14px;
    padding: 10px 30px; border-radius: 999px;
    border: 3.5px solid #1A1A1F; box-shadow: 5px 5px 0px #1A1A1F;
    font-size: 26px; font-weight: 900; letter-spacing: 0.08em;
  }}
  #chap-title {{
    font-size: 86px; font-weight: 900; letter-spacing: 0.06em; line-height: 1.08;
  }}
  #chap-sub {{
    font-size: 32px; font-weight: 800; letter-spacing: 0.05em; opacity: 0.85;
  }}
</style>
</head>
<body>

<!-- ==================== 00 INTRO ==================== -->
<div id="scene-intro" class="scene cream-bg">
  <div id="intro-ring-wrap">
    <div id="ring1" class="ring-arc" style="width:360px;height:360px;border-color:#FF5C2B;"></div>
    <div id="ring2" class="ring-arc" style="width:520px;height:520px;border-color:#FFD60A;"></div>
    <div id="ring3" class="ring-arc" style="width:680px;height:680px;border-color:#00D4AA;"></div>
  </div>
  <div id="intro-parade"></div>
  <div id="intro-hero-card">
    <div id="intro-hero-inner">
      <div style="position:absolute;top:14px;left:14px;background:#FFD60A;border:2.5px solid #1A1A1F;box-shadow:3px 3px 0 #1A1A1F;border-radius:10px;padding:3px 12px;font-weight:900;font-size:17px;transform:rotate(-4deg);">★ SSR</div>
      <div class="mono" style="position:absolute;top:14px;right:14px;background:#FFFDF8;border:2.5px solid #1A1A1F;box-shadow:3px 3px 0 #1A1A1F;border-radius:999px;padding:3px 12px;font-weight:800;font-size:15px;">#05</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:24px;">
        <img src="{base}/08_assets/optimized/cards/street-bell.webp" style="width:248px;height:286px;object-fit:contain;filter:drop-shadow(0 8px 14px rgba(26,26,31,0.18));" />
      </div>
      <div style="background:#FFFDF8;border-top:3px solid #1A1A1F;padding:14px 16px;text-align:center;">
        <div style="font-size:13px;font-weight:800;color:#646474;">市井脆响 · 棱镜光带</div>
        <div style="font-size:26px;font-weight:900;color:#1A1A1F;margin-top:2px;">✦ 二八大杠车铃 ✦</div>
      </div>
    </div>
  </div>
  <div id="intro-title-lockup" style="opacity:0;">
    <div id="intro-main-badge" class="title-badge">
      <div style="width:74px;height:94px;border-radius:16px;border:4px solid #1A1A1F;box-shadow:5px 5px 0 #1A1A1F;background:linear-gradient(135deg,#7C3AED,#00D4AA,#FFD60A,#FF5C2B);transform:rotate(7deg);display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 24 24" width="42" height="42"><path d="M12 2 L14.4 9.6 L22 12 L14.4 14.4 L12 22 L9.6 14.4 L2 12 L9.6 9.6 Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="1.6"/></svg>
      </div>
      <div class="title-text">声卡造物局</div>
    </div>
    <div id="intro-slogan" class="slogan-pill">把一条街，做成一张有声音的闪卡</div>
    <div id="intro-steps" class="steps-row">
      <div class="step-chip" style="background:#7C3AED;color:#FFFDF8;">01 声卡盲盒</div>
      <div class="step-chip" style="background:#FF5C2B;color:#FFFDF8;">02 插卡编曲</div>
      <div class="step-chip" style="background:#00D4AA;color:#1A1A1F;">03 弹珠剧场</div>
      <div class="step-chip" style="background:#FFD60A;color:#1A1A1F;">04 闪卡铸造</div>
    </div>
  </div>
</div>

<!-- ==================== 06 EXPORTS SHOWCASE ==================== -->
<div id="scene-exports" class="scene dark-bg">
  <div id="exports-header">
    <div style="display:flex;align-items:center;gap:16px;">
      <span class="exp-pill" style="background:#FFD60A;color:#1A1A1F;font-size:17px;padding:6px 18px;">同源四格式成果</span>
      <span style="font-size:34px;font-weight:900;color:#FFFDF8;letter-spacing:0.04em;">#MY-01 《铃响晴巷》</span>
    </div>
    <span class="mono" style="font-size:18px;font-weight:700;color:#00D4AA;">118 BPM · C 五声 · 温暖金箔 UR · 真实冻结快照</span>
  </div>

  <div class="exp-grid">
    <!-- Left: Real Exported 1200x1600 HD Gallery Poster PNG -->
    <div id="exp-col-png" class="exp-panel">
      <div class="exp-tag">
        <span class="exp-pill" style="background:#00D4AA;color:#1A1A1F;">01</span>
        <span>高清展板海报 PNG</span>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:12px 0;">
        <div id="exp-png-frame" style="width:438px;height:584px;border-radius:18px;overflow:hidden;border:3px solid rgba(255,214,10,0.65);box-shadow:0 22px 48px rgba(0,0,0,0.65);position:relative;">
          <img src="{base}/07_showcase/film/capture/motion/_prepared/my01_poster_clean.png" style="width:100%;height:100%;object-fit:contain;display:block;" />
        </div>
      </div>
      <div class="mono" style="font-size:15px;color:rgba(255,253,248,0.68);text-align:center;">1200 × 1600 · 含声音纹章与真实 PCM 声纹</div>
    </div>

    <!-- Center: Window reserved for genuine 600x840 WebM Motion Card overlay (exact 5:7 aspect ratio, never stretched!) -->
    <div id="exp-col-webm" class="exp-panel" style="border-color:rgba(255,214,10,0.45);background:rgba(255,214,10,0.04);">
      <div class="exp-tag">
        <span class="exp-pill" style="background:#FFD60A;color:#1A1A1F;">02</span>
        <span>完整时长动态闪卡 WebM</span>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;">
        <!-- Exact slot box: x=680, y=220, w=450, h=630 (exact 600:840 = 5:7 ratio!) -->
        <div id="webm-window" style="width:450px;height:630px;border-radius:20px;border:3.5px solid #FFD60A;box-shadow:0 0 36px rgba(255,214,10,0.22);background:#14151B;"></div>
      </div>
      <div class="mono" style="font-size:15px;color:#FFD60A;text-align:center;">5:7 原始比例 · 实时声纹与四轨光环同步录制</div>
    </div>

    <!-- Right: Real 48kHz WAV Waveform + Re-Editable V3 Project Cartridge -->
    <div id="exp-col-right" style="display:flex;flex-direction:column;gap:28px;">
      <div class="exp-panel" style="flex:1.12;">
        <div class="exp-tag">
          <span class="exp-pill" style="background:#7C3AED;color:#FFFDF8;">03</span>
          <span>无损音频 WAV</span>
          <span class="mono" style="margin-left:auto;font-size:15px;color:#00D4AA;">48 kHz · 16-bit 立体声</span>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px;padding:12px 6px;">
          <div id="wav-bars-box" style="height:178px;background:#0E0F14;border:2.5px solid rgba(255,255,255,0.14);border-radius:18px;padding:18px 20px;display:flex;align-items:center;gap:6px;"></div>
          <div style="height:10px;border-radius:999px;background:rgba(255,255,255,0.1);overflow:hidden;">
            <div id="wav-prog-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#7C3AED,#FF5C2B,#FFD60A,#00D4AA);border-radius:999px;"></div>
          </div>
        </div>
        <div class="mono" style="font-size:15px;color:rgba(255,253,248,0.68);display:flex;justify-content:space-between;">
          <span>由真实导出的《铃响晴巷》WAV 波形驱动</span>
          <span id="wav-dur-label" style="color:#FFD60A;">-- s</span>
        </div>
      </div>

      <div class="exp-panel" style="flex:0.88;">
        <div class="exp-tag">
          <span class="exp-pill" style="background:#FF5C2B;color:#FFFDF8;">04</span>
          <span>可继续编辑的工程文件</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0;">
          <div style="background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.14);border-radius:14px;padding:14px 16px;">
            <div style="font-size:13px;color:rgba(255,253,248,0.58);font-weight:700;">完整音序与参数</div>
            <div style="font-size:20px;color:#FFFDF8;font-weight:900;margin-top:4px;">32 步 A/B 乐句快照</div>
          </div>
          <div style="background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.14);border-radius:14px;padding:14px 16px;">
            <div style="font-size:13px;color:rgba(255,253,248,0.58);font-weight:700;">卡面与谱系元数据</div>
            <div style="font-size:20px;color:#FFD60A;font-weight:900;margin-top:4px;">箔面 · 贴纸 · 声纹</div>
          </div>
        </div>
        <div style="font-size:16px;color:#00D4AA;font-weight:800;">✦ 随时导入工作台完整恢复，拆封重混下一代变奏</div>
      </div>
    </div>
  </div>
</div>

<!-- ==================== 07 OUTRO ==================== -->
<div id="scene-outro" class="scene dark-bg">
  <!-- Dual cards: #MY-01 Original (Gold) & #MY-02 Night Remix (Cyber Laser) -->
  <div id="outro-card-left" class="outro-card-wrap" style="left:360px;">
    <img src="{base}/07_showcase/film/capture/motion/_prepared/my01_card_face.png" />
    <div id="outro-sweep-l" class="foil-sweep"></div>
  </div>
  <div id="outro-card-right" class="outro-card-wrap" style="right:360px;">
    <img src="{base}/07_showcase/film/capture/motion/_prepared/my02_card_face.png" />
    <div id="outro-sweep-r" class="foil-sweep"></div>
  </div>

  <div id="outro-lineage-pill" style="position:absolute;left:50%;top:790px;transform:translate(-50%,-50%);background:#14151B;border:3.5px solid #FFD60A;border-radius:999px;padding:14px 32px;box-shadow:0 12px 32px rgba(0,0,0,0.7);display:flex;align-items:center;gap:16px;white-space:nowrap;">
    <span class="mono" style="color:#FFD60A;font-size:20px;font-weight:900;">#MY-01 原创首发</span>
    <span style="color:#00D4AA;font-size:22px;font-weight:900;">── 拆封重混 ──▶</span>
    <span class="mono" style="color:#C084FC;font-size:20px;font-weight:900;">#MY-02 第 1 代</span>
  </div>

  <!-- Brand End-Card Lockup -->
  <div id="outro-brand" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;opacity:0;">
    <div style="display:flex;align-items:center;gap:22px;background:#FFFDF8;border:5px solid #1A1A1F;border-radius:30px;padding:24px 54px;box-shadow:0 24px 70px rgba(255,214,10,0.28), 10px 10px 0 #FFD60A;">
      <div style="width:74px;height:94px;border-radius:16px;border:4px solid #1A1A1F;box-shadow:4px 4px 0 #1A1A1F;background:linear-gradient(135deg,#7C3AED,#00D4AA,#FFD60A,#FF5C2B);transform:rotate(7deg);display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 24 24" width="42" height="42"><path d="M12 2 L14.4 9.6 L22 12 L14.4 14.4 L12 22 L9.6 14.4 L2 12 L9.6 9.6 Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="1.6"/></svg>
      </div>
      <div style="font-size:94px;font-weight:900;letter-spacing:0.08em;color:#1A1A1F;line-height:1;">声卡造物局</div>
    </div>
    <div style="font-size:34px;font-weight:900;color:#FFD60A;letter-spacing:0.1em;margin-top:4px;">把一条街，做成一张有声音的闪卡</div>
    <div class="steps-row" style="margin-top:10px;">
      <div class="step-chip" style="background:#7C3AED;color:#FFFDF8;border-color:#FFFDF8;">01 声卡盲盒</div>
      <div class="step-chip" style="background:#FF5C2B;color:#FFFDF8;border-color:#FFFDF8;">02 插卡编曲</div>
      <div class="step-chip" style="background:#00D4AA;color:#1A1A1F;border-color:#FFFDF8;">03 弹珠剧场</div>
      <div class="step-chip" style="background:#FFD60A;color:#1A1A1F;border-color:#FFFDF8;">04 闪卡铸造</div>
    </div>
  </div>
</div>

<!-- ==================== COVER (1920x1080 & 480x270 Readable!) ==================== -->
<div id="scene-cover" class="scene">
  <!-- Decorative top-right soft sound arcs -->
  <svg viewBox="0 0 1920 1080" style="position:absolute;inset:0;width:1920px;height:1080px;pointer-events:none;">
    <circle cx="1390" cy="540" r="390" fill="none" stroke="#1A1A1F" stroke-opacity="0.08" stroke-width="4" stroke-dasharray="14 14"/>
    <circle cx="1390" cy="540" r="490" fill="none" stroke="#FF5C2B" stroke-opacity="0.16" stroke-width="5"/>
    <circle cx="1390" cy="540" r="590" fill="none" stroke="#7C3AED" stroke-opacity="0.11" stroke-width="4"/>
  </svg>

  <!-- Left Typography & Feature Anchor (Ultra-legible even at 480x270!) -->
  <div style="position:absolute;left:96px;top:150px;width:900px;display:flex;flex-direction:column;gap:30px;">
    <div style="display:inline-flex;align-items:center;gap:14px;background:#14151B;color:#FFD60A;border:4px solid #1A1A1F;box-shadow:6px 6px 0 #1A1A1F;border-radius:999px;padding:12px 30px;width:fit-content;font-size:28px;font-weight:900;letter-spacing:0.06em;">
      <span style="width:16px;height:16px;border-radius:50%;background:#00D4AA;display:inline-block;"></span>
      <span>中式市井潮玩 · 互动音乐创作系统</span>
    </div>

    <div style="font-size:158px;font-weight:900;color:#1A1A1F;line-height:1.02;letter-spacing:0.03em;text-shadow:8px 8px 0px #FFD60A;">
      声卡造物局
    </div>

    <div style="background:#FFD60A;border:5px solid #1A1A1F;box-shadow:9px 9px 0 #1A1A1F;border-radius:24px;padding:20px 36px;width:fit-content;font-size:44px;font-weight:900;color:#1A1A1F;letter-spacing:0.04em;">
      把一条街，做成一张有声音的闪卡
    </div>

    <div style="display:flex;gap:16px;margin-top:8px;">
      <div style="background:#7C3AED;color:#FFFDF8;border:4px solid #1A1A1F;box-shadow:5px 5px 0 #1A1A1F;border-radius:18px;padding:14px 26px;font-size:28px;font-weight:900;">声卡盲盒</div>
      <div style="background:#FF5C2B;color:#FFFDF8;border:4px solid #1A1A1F;box-shadow:5px 5px 0 #1A1A1F;border-radius:18px;padding:14px 26px;font-size:28px;font-weight:900;">插卡编曲</div>
      <div style="background:#00D4AA;color:#1A1A1F;border:4px solid #1A1A1F;box-shadow:5px 5px 0 #1A1A1F;border-radius:18px;padding:14px 26px;font-size:28px;font-weight:900;">弹珠剧场</div>
      <div style="background:#FFFDF8;color:#1A1A1F;border:4px solid #1A1A1F;box-shadow:5px 5px 0 #1A1A1F;border-radius:18px;padding:14px 26px;font-size:28px;font-weight:900;">闪卡铸造</div>
    </div>
  </div>

  <!-- Right Hero Card Fan: Secondary #MY-02 Night Card + Bamboo Card behind, Giant #MY-01 Street Bell Gold Card in front! -->
  <div style="position:absolute;right:330px;top:160px;width:440px;height:616px;border-radius:34px;overflow:hidden;border:5px solid #1A1A1F;box-shadow:12px 12px 0 #1A1A1F;transform:rotate(-11deg);opacity:0.95;">
    <img src="{base}/07_showcase/film/capture/motion/_prepared/my02_card_face.png" style="width:100%;height:100%;object-fit:cover;" />
  </div>
  <div style="position:absolute;right:108px;top:118px;width:540px;height:756px;border-radius:40px;overflow:hidden;border:6px solid #1A1A1F;box-shadow:18px 18px 0 #1A1A1F, 0 28px 65px rgba(26,26,31,0.32);transform:rotate(4.5deg);">
    <img src="{base}/07_showcase/film/capture/motion/_prepared/my01_card_face.png" style="width:100%;height:100%;object-fit:cover;" />
  </div>

  <!-- Tactile Die-Cut Stickers Accenting the Cover -->
  <img src="{base}/08_assets/optimized/stickers/starburst.webp" style="position:absolute;right:68px;top:76px;width:128px;height:128px;transform:rotate(14deg);filter:drop-shadow(4px 6px 0 rgba(26,26,31,0.35));" />
  <img src="{base}/08_assets/optimized/stickers/note.webp" style="position:absolute;right:610px;bottom:86px;width:122px;height:122px;transform:rotate(-12deg);filter:drop-shadow(4px 6px 0 rgba(26,26,31,0.35));" />
</div>

<!-- ==================== CHAPTER INTERSTITIAL CARD ==================== -->
<div id="scene-chapter" class="scene cream-bg">
  <div id="chap-card">
    <div id="chap-pill"><span id="chap-num" class="mono">01</span><span id="chap-tag">CHAPTER</span></div>
    <div id="chap-title">声卡盲盒</div>
    <div id="chap-sub">每个声音，先是一件有性格的潮玩</div>
  </div>
</div>

<script>
const BASE = "{base}";
const CARDS = {json.dumps(cards, ensure_ascii=False)};
const STICKERS = {json.dumps(stickers)};
const WAV_DATA = {json.dumps(wav_data)};

function clamp(v, a, b) {{ return Math.min(b, Math.max(a, v)); }}
function easeOutBack(t) {{
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}}
function easeOutCubic(t) {{ return 1 - Math.pow(1 - t, 3); }}
function easeInOutCubic(t) {{ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }}

// Build 16-card parade DOM once
const paradeEl = document.getElementById('intro-parade');
const paradeNodes = CARDS.map((c, i) => {{
  const [art, code, name, color, cat] = c;
  const el = document.createElement('div');
  el.className = 'parade-card';
  el.innerHTML = `
    <div style="background:${{color}};color:${{color==='#FFD60A'||color==='#00D4AA'?'#1A1A1F':'#FFFDF8'}};padding:4px 10px;font-size:12px;font-weight:900;display:flex;justify-content:space-between;border-bottom:2.5px solid #1A1A1F;">
      <span>${{cat}}</span><span class="mono">${{code}}</span>
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:8px;background:#FFFDF8;">
      <img src="${{BASE}}/08_assets/optimized/cards/${{art}}.webp" style="width:124px;height:134px;object-fit:contain;" />
    </div>
    <div style="background:#EDE7D9;border-top:2px solid #1A1A1F;padding:5px;text-align:center;font-size:15px;font-weight:900;color:#1A1A1F;">${{name}}</div>
  `;
  paradeEl.appendChild(el);
  return el;
}});

// Build 32 real WAV spectrum bars once
const wavBarsBox = document.getElementById('wav-bars-box');
const wavBarColors = ['#7C3AED','#7C3AED','#FF3D9A','#FF5C2B','#FF5C2B','#FFD60A','#FFD60A','#00D4AA'];
const wavBarNodes = Array.from({{ length: 32 }}, (_, i) => {{
  const bar = document.createElement('div');
  bar.style.flex = '1';
  bar.style.borderRadius = '6px';
  bar.style.background = wavBarColors[Math.floor((i / 32) * wavBarColors.length)];
  bar.style.height = '18%';
  wavBarsBox.appendChild(bar);
  return bar;
}});
document.getElementById('wav-dur-label').textContent = (WAV_DATA.durationSec || 5.0).toFixed(2) + 's';

window.setMode = (mode) => {{
  document.querySelectorAll('.scene').forEach(s => s.classList.remove('active'));
  document.getElementById('scene-' + mode).classList.add('active');
}};

window.renderIntro = (t) => {{
  // 0.0 - 1.5s: Hero Bell Card pops in with 3 concentric sound-wave rings!
  const hero = document.getElementById('intro-hero-card');
  const pPop = easeOutBack(clamp(t / 0.55, 0, 1));
  const pOut = easeInOutCubic(clamp((t - 3.0) / 0.6, 0, 1));
  const heroScale = pPop * (1 - pOut * 0.65);
  const heroY = (1 - pPop) * 90 - pOut * 160;
  const heroRot = Math.sin(t * 2.2) * 3.5 * (1 - pOut) - pOut * 12;
  hero.style.transform = `translateY(${{heroY.toFixed(1)}}px) scale(${{heroScale.toFixed(3)}}) rotate(${{heroRot.toFixed(2)}}deg)`;
  hero.style.opacity = (1 - pOut).toFixed(3);

  // Rings burst from bell at t=0.25s, 0.45s, 0.65s
  [0.22, 0.44, 0.66].forEach((onset, idx) => {{
    const r = document.getElementById('ring' + (idx + 1));
    const pr = clamp((t - onset) / 1.15, 0, 1);
    const sc = 0.25 + easeOutCubic(pr) * 1.45;
    const op = pr > 0 && pr < 1 ? Math.sin(pr * Math.PI) * 0.72 : 0;
    r.style.transform = `translate(-50%, -50%) scale(${{sc.toFixed(3)}})`;
    r.style.opacity = op.toFixed(3);
  }});

  // 1.1s - 4.0s: 16 cards glide in two opposing horizontal ribbons (top row L->R, bottom row R->L)
  const pRibbonIn = easeOutCubic(clamp((t - 0.95) / 0.55, 0, 1));
  const pRibbonOut = easeInOutCubic(clamp((t - 3.35) / 0.65, 0, 1));
  const ribOp = pRibbonIn * (1 - pRibbonOut * 0.88);
  paradeNodes.forEach((node, i) => {{
    const row = i < 8 ? 0 : 1;
    const col = i % 8;
    const dir = row === 0 ? 1 : -1;
    const baseX = (col * 250 - 90) + dir * (t - 1.0) * 230;
    const wrappedX = ((baseX % 2100) + 2100) % 2100 - 180;
    const y = row === 0 ? 78 + Math.sin(t * 3 + col) * 10 : 756 + Math.cos(t * 3 + col) * 10;
    const rot = (row === 0 ? -4 : 4) + Math.sin(t * 2.4 + i) * 3;
    node.style.left = wrappedX.toFixed(1) + 'px';
    node.style.top = y.toFixed(1) + 'px';
    node.style.transform = `rotate(${{rot.toFixed(2)}}deg) scale(${{(0.85 + 0.15 * pRibbonIn).toFixed(3)}})`;
    node.style.opacity = ribOp.toFixed(3);
  }});

  // 3.3s - 9.0s: Neo-Brutalism Brand Title Lockup springs to center with calm breathing hold!
  const lockup = document.getElementById('intro-title-lockup');
  const pTitle = clamp((t - 3.60) / 0.72, 0, 1);
  const pSlogan = clamp((t - 4.20) / 0.65, 0, 1);
  const pSteps = clamp((t - 4.70) / 0.65, 0, 1);
  const pExit = easeInOutCubic(clamp((t - 8.45) / 0.55, 0, 1));

  lockup.style.opacity = (pTitle > 0 ? 1 - pExit : 0).toFixed(3);
  const bScale = easeOutBack(pTitle) * (1 + pExit * 0.06);
  document.getElementById('intro-main-badge').style.transform = `scale(${{bScale.toFixed(3)}}) translateY(${{((1 - easeOutCubic(pTitle)) * 36).toFixed(1)}}px)`;
  document.getElementById('intro-slogan').style.opacity = easeOutCubic(pSlogan).toFixed(3);
  document.getElementById('intro-slogan').style.transform = `translateY(${{((1 - easeOutCubic(pSlogan)) * 24).toFixed(1)}}px)`;
  document.getElementById('intro-steps').style.opacity = easeOutCubic(pSteps).toFixed(3);
  document.getElementById('intro-steps').style.transform = `translateY(${{((1 - easeOutCubic(pSteps)) * 20).toFixed(1)}}px)`;
}};

window.configureChapter = (cfg) => {{
  const sc = document.getElementById('scene-chapter');
  sc.classList.remove('cream-bg', 'dark-bg');
  sc.classList.add(cfg.dark ? 'dark-bg' : 'cream-bg');
  const card = document.getElementById('chap-card');
  card.classList.toggle('dark-card', Boolean(cfg.dark));
  const pill = document.getElementById('chap-pill');
  pill.style.background = cfg.pillBg;
  pill.style.color = cfg.pillFg;
  document.getElementById('chap-num').textContent = cfg.num;
  document.getElementById('chap-tag').textContent = cfg.tag;
  const titleEl = document.getElementById('chap-title');
  titleEl.textContent = cfg.title;
  titleEl.style.color = cfg.dark ? '#FFFDF8' : '#1A1A1F';
  const subEl = document.getElementById('chap-sub');
  subEl.textContent = cfg.sub;
  subEl.style.color = cfg.dark ? '#FFD60A' : '#4A4A58';
}};

window.renderChapter = (t) => {{
  // Calm 2.3s chapter breathing card: smooth spring in (0..0.48s), serene readable hold (0.48..1.85s), gentle ease out (1.85..2.3s)
  const pIn = clamp(t / 0.48, 0, 1);
  const pSub = clamp((t - 0.16) / 0.42, 0, 1);
  const pOut = easeInOutCubic(clamp((t - 1.85) / 0.45, 0, 1));
  const card = document.getElementById('chap-card');
  const sc = (0.88 + 0.12 * easeOutBack(pIn)) * (1 - pOut * 0.04);
  const ty = (1 - easeOutCubic(pIn)) * 34 - pOut * 16;
  card.style.transform = `translateY(${{ty.toFixed(1)}}px) scale(${{sc.toFixed(3)}})`;
  card.style.opacity = (easeOutCubic(pIn) * (1 - pOut)).toFixed(3);
  document.getElementById('chap-sub').style.opacity = (easeOutCubic(pSub) * (1 - pOut) * 0.88).toFixed(3);
}};

window.renderExports = (t, frameIdx) => {{
  const p1 = easeOutCubic(clamp(t / 0.55, 0, 1));
  const p2 = easeOutCubic(clamp((t - 0.14) / 0.55, 0, 1));
  const p3 = easeOutCubic(clamp((t - 0.28) / 0.55, 0, 1));
  document.getElementById('exp-col-png').style.opacity = p1.toFixed(3);
  document.getElementById('exp-col-png').style.transform = `translateY(${{((1-p1)*36).toFixed(1)}}px)`;
  document.getElementById('exp-col-webm').style.opacity = p2.toFixed(3);
  document.getElementById('exp-col-webm').style.transform = `translateY(${{((1-p2)*36).toFixed(1)}}px)`;
  document.getElementById('exp-col-right').style.opacity = p3.toFixed(3);
  document.getElementById('exp-col-right').style.transform = `translateY(${{((1-p3)*36).toFixed(1)}}px)`;

  // Subtle floating poster motion
  const rot = Math.sin(t * 1.1) * 1.4;
  document.getElementById('exp-png-frame').style.transform = `rotate(${{rot.toFixed(2)}}deg)`;

  // Real exported WAV spectrum animation!
  const fd = WAV_DATA.frames[Math.min(WAV_DATA.frames.length - 1, Math.max(0, frameIdx))];
  if (fd) {{
    for (let i = 0; i < 32; i++) {{
      const h = Math.round(clamp(fd.bars[i], 0.08, 1.0) * 100);
      wavBarNodes[i].style.height = h + '%';
    }}
    document.getElementById('wav-prog-fill').style.width = (fd.prog * 100).toFixed(1) + '%';
  }}
}};

window.renderOutro = (t) => {{
  // 0.0 - 4.6s: Dual cards #MY-01 & #MY-02 prominently displayed side by side with shimmering foil
  // 4.6 - 11.2s: Cards gracefully glide outward to frame edges as Brand Lockup rises center stage with generous closing hold!
  const pIn = easeOutBack(clamp(t / 0.78, 0, 1));
  const pSplit = easeInOutCubic(clamp((t - 4.55) / 1.0, 0, 1));
  const pBrand = easeOutCubic(clamp((t - 5.05) / 0.85, 0, 1));

  const cL = document.getElementById('outro-card-left');
  const cR = document.getElementById('outro-card-right');
  const lin = document.getElementById('outro-lineage-pill');
  const brand = document.getElementById('outro-brand');

  const sway = Math.sin(t * 1.5) * 2.2;
  const shiftOut = pSplit * 290;
  const scaleOut = 1 - pSplit * 0.24;
  const dimOut = 1 - pSplit * 0.42;

  cL.style.left = (330 - shiftOut).toFixed(1) + 'px';
  cL.style.transform = `scale(${{(pIn * scaleOut).toFixed(3)}}) rotate(${{(-5 - pSplit * 7 + sway * 0.5).toFixed(2)}}deg)`;
  cL.style.opacity = dimOut.toFixed(3);

  cR.style.right = (330 - shiftOut).toFixed(1) + 'px';
  cR.style.transform = `scale(${{(pIn * scaleOut).toFixed(3)}}) rotate(${{(5 + pSplit * 7 - sway * 0.5).toFixed(2)}}deg)`;
  cR.style.opacity = dimOut.toFixed(3);

  const sweepPos = ((t * 140) % 240) - 120;
  document.getElementById('outro-sweep-l').style.transform = `translateX(${{sweepPos.toFixed(1)}}%)`;
  document.getElementById('outro-sweep-r').style.transform = `translateX(${{(-sweepPos).toFixed(1)}}%)`;

  lin.style.opacity = (easeOutCubic(clamp((t - 0.55) / 0.5, 0, 1)) * (1 - pSplit)).toFixed(3);

  brand.style.opacity = pBrand.toFixed(3);
  brand.style.transform = `scale(${{(0.9 + 0.1 * pBrand).toFixed(3)}}) translateY(${{((1 - pBrand) * 28).toFixed(1)}}px)`;
}};
</script>
</body>
</html>
"""


def render_sequence(page, mode: str, fn_name: str, duration_sec: float, out_mp4: Path):
    total_frames = int(round(duration_sec * FPS))
    page.evaluate("(m) => window.setMode(m)", mode)
    cmd = [
        FFMPEG, "-y",
        "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "fast", "-crf", "13", "-pix_fmt", "yuv420p",
        str(out_mp4),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for f in range(total_frames):
        t = f / FPS
        page.evaluate(f"([t, f]) => window.{fn_name}(t, f)", [t, f])
        jpg = page.screenshot(type="jpeg", quality=96)
        proc.stdin.write(jpg)
    proc.stdin.close()
    _, err = proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed on {out_mp4.name}: {err.decode(errors='ignore')[-500:]}")
    print(f"  [MOTION DONE] {out_mp4.name}: {duration_sec:.2f}s ({total_frames} frames @ {FPS}fps)")


def composite_real_webm_into_exports(base_mp4: Path, real_webm: Path, out_mp4: Path):
    """
    Overlay the genuine 600x840 exported WebM motion card strictly at its native 5:7 aspect ratio
    (450x630) inside the exact center showcase window, while seamlessly scrubbing the bottom
    'HOLOBEAT 动态闪卡' footer line into '声卡造物局 动态闪卡 · #MY-01 · 温暖金箔 · 118 BPM'.
    """
    # Exact slot coordinates in 1920x1080 grid:
    # Left col = 72..592 (520px), gap=36 -> Center col = 628..1188 (560px)
    # Center col panel padding=22 -> inner center x = 908 -> webm 450px wide => x = 908 - 225 = 683
    # Header/top=128, panel pad=22, tag ~34, flex center of remaining ~806px => y = 128 + 22 + 34 + (756 - 630)/2 ≈ 247
    # Let's compute exact bounding box dynamically from DOM during render! (passed via JSON or fixed CSS)
    # We'll read exact coordinates from _prepared/webm_slot.json!
    slot = json.loads((CACHE_DIR / "webm_slot.json").read_text(encoding="utf-8"))
    sx = int(round(slot["x"]))
    sy = int(round(slot["y"]))
    sw = int(round(slot["width"]))
    sh = int(round(slot["height"]))

    # Prepare a tiny crisp footer patch PNG (450x30 on exact #14151B background) for the bottom watermark of WebM
    patch_h = 30
    patch = Image.new("RGB", (sw, patch_h), (20, 21, 27))
    draw = ImageDraw.Draw(patch)
    font_path = "C:/Windows/Fonts/msyhbd.ttc"
    font = ImageFont.truetype(font_path, 12) if Path(font_path).exists() else ImageFont.load_default()
    label = "声卡造物局 动态闪卡 · #MY-01 · 温暖金箔 · 118 BPM"
    bbox = draw.textbbox((0, 0), label, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((sw - tw) // 2, 7), label, fill=(230, 228, 222), font=font)
    patch_path = CACHE_DIR / "webm_footer_patch.png"
    patch.save(patch_path)

    # Loop real_webm smoothly to match 9.6s relaxed showcase, fade in with panel at t=0.14s..0.69s
    fc = (
        f"[1:v]fps={FPS},scale={sw}:{sh}:flags=lanczos,format=rgba,"
        f"fade=t=in:st=0.14:d=0.45:alpha=1[wm];"
        f"[0:v][wm]overlay={sx}:{sy}:shortest=1[v1];"
        f"[2:v]format=rgba,fade=t=in:st=0.14:d=0.45:alpha=1[fp];"
        f"[v1][fp]overlay={sx}:{sy + sh - patch_h - 4}:shortest=1,format=yuv420p[vout]"
    )
    cmd = [
        FFMPEG, "-y",
        "-i", str(base_mp4),
        "-stream_loop", "-1", "-i", str(real_webm),
        "-loop", "1", "-i", str(patch_path),
        "-filter_complex", fc,
        "-map", "[vout]",
        "-t", "9.6",
        "-c:v", "libx264", "-preset", "fast", "-crf", "13", "-pix_fmt", "yuv420p",
        str(out_mp4),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"  [COMPOSITE DONE] {out_mp4.name} (embedded genuine WebM @ {sx},{sy} {sw}x{sh})")


def main():
    my01_png = EXPORTS_DIR / "lingxiang-qingxiang-poster.png"
    my01_wav = EXPORTS_DIR / "lingxiang-qingxiang.wav"
    my01_webm = EXPORTS_DIR / "lingxiang-qingxiang-motion.webm"
    my02_png = EXPORTS_DIR / "lingxiang-night-remix-poster.png"

    for req in (my01_png, my01_wav, my01_webm, my02_png):
        if not req.exists():
            raise FileNotFoundError(f"Missing real export artifact: {req}")

    print("1) Preparing film-display clean poster copies & extracting genuine WAV spectrum...")
    prepare_clean_poster_display(my01_png, CACHE_DIR / "my01_poster_clean.png", CACHE_DIR / "my01_card_face.png")
    prepare_clean_poster_display(my02_png, CACHE_DIR / "my02_poster_clean.png", CACHE_DIR / "my02_card_face.png")
    wav_data = extract_wav_envelope_bars(my01_wav, total_frames=int(9.6 * FPS))

    server, port = start_repo_http_server()
    stage_html_path = CACHE_DIR / "motion_stage.html"
    stage_html_path.write_text(build_stage_html(port, wav_data), encoding="utf-8")

    chapters = [
        ("chapter_01_gacha.mp4",   {"num": "01", "tag": "DISCOVER", "title": "声卡盲盒",   "sub": "每个声音，先是一件有性格的潮玩", "pillBg": "#7C3AED", "pillFg": "#FFFDF8", "dark": False}),
        ("chapter_02_beat.mp4",    {"num": "02", "tag": "COMPOSE",  "title": "插卡编曲",   "sub": "四轨街巷声源，一层层长成节奏",   "pillBg": "#FF5C2B", "pillFg": "#FFFDF8", "dark": False}),
        ("chapter_03_pinball.mp4", {"num": "03", "tag": "PERFORM",  "title": "弹珠剧场",   "sub": "自由碰撞找灵感 · 编曲登台纯享演出", "pillBg": "#00D4AA", "pillFg": "#1A1A1F", "dark": False}),
        ("chapter_04_forge.mp4",   {"num": "04", "tag": "FORGE",    "title": "闪卡铸造",   "sub": "挑箔面、贴贴纸，把音乐压印入册",   "pillBg": "#FFD60A", "pillFg": "#1A1A1F", "dark": True}),
        ("chapter_05_outputs.mp4", {"num": "05", "tag": "REMIX",    "title": "导出与重混", "sub": "带走同源作品，随时拆封改出下一版", "pillBg": "#00D4AA", "pillFg": "#1A1A1F", "dark": True}),
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=["--use-gl=angle", "--use-angle=d3d11", "--ignore-gpu-blocklist"],
        )
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page.goto(f"http://127.0.0.1:{port}/07_showcase/film/capture/motion/_prepared/motion_stage.html", wait_until="networkidle")
        page.evaluate("() => document.fonts.ready")
        page.wait_for_timeout(400)

        # Render 00 Intro (9.0s @ 30fps)
        print("2) Rendering motion_00_intro.mp4 (9.0s)...")
        render_sequence(page, "intro", "renderIntro", 9.0, MOTION_DIR / "motion_00_intro.mp4")

        # Render 5 calm 2.3s Chapter Interstitial Cards!
        print("2b) Rendering 5 calm 2.3s Neo-Brutalism chapter breathing cards...")
        for fname, cfg in chapters:
            page.evaluate("(c) => window.configureChapter(c)", cfg)
            render_sequence(page, "chapter", "renderChapter", 2.3, MOTION_DIR / fname)

        # Render 06 Exports Base (9.6s) & record exact WebM window coordinates
        print("3) Rendering motion_06_exports_base.mp4 (9.6s)...")
        page.evaluate("() => { window.setMode('exports'); window.renderExports(2.0, 60); }")
        slot_box = page.locator("#webm-window").bounding_box()
        (CACHE_DIR / "webm_slot.json").write_text(json.dumps(slot_box), encoding="utf-8")
        render_sequence(page, "exports", "renderExports", 9.6, CACHE_DIR / "motion_06_exports_base.mp4")

        # Render 07 Outro (11.2s)
        print("4) Rendering motion_07_outro.mp4 (11.2s)...")
        render_sequence(page, "outro", "renderOutro", 11.2, MOTION_DIR / "motion_07_outro.mp4")

        # Render HD Cover (1920x1080) & Small Cover (480x270 PNG + JPG)
        print("5) Rendering 1920x1080 & 480x270 covers...")
        page.evaluate("() => window.setMode('cover')")
        page.wait_for_timeout(200)
        cover_hd = COVERS_DIR / "cover_1920x1080.png"
        page.screenshot(path=str(cover_hd))
        im_hd = Image.open(cover_hd).convert("RGB")
        im_small = im_hd.resize((480, 270), Image.Resampling.LANCZOS)
        im_small.save(COVERS_DIR / "cover_480x270.png")
        im_small.save(COVERS_DIR / "cover_480x270.jpg", quality=93, subsampling=0)

        browser.close()

    # Daemon HTTP server exits cleanly with process (avoids keep-alive shutdown deadlock)
    print("6) Compositing real 5:7 WebM motion card into motion_06_exports.mp4...", flush=True)
    composite_real_webm_into_exports(
        CACHE_DIR / "motion_06_exports_base.mp4",
        my01_webm,
        MOTION_DIR / "motion_06_exports.mp4",
    )
    print("\n=== ALL MOTION PACKAGES & COVERS RENDERED ===")


if __name__ == "__main__":
    main()
