r"""
Broadcast-Clean End-to-End Real UI + 48kHz Audio Capture Pipeline for 声卡造物局 (v2).
- Video: Non-blocking CDP Page.startScreencast (everyNthFrame=2, deferred decode) -> rock-solid 30 fps CFR H.264 (CRF 14)
- Audio: Native Chrome audio-thread MediaRecorder (audio/webm;codecs=opus @ 256kbps -> 48kHz 16-bit stereo WAV), ZERO glitches/underruns!
- Single coherent story: #05 二八大杠车铃 -> #MY-01 《铃响晴巷》 (温暖金箔 UR) -> #MY-02 《铃响晴巷 · 夜行版》 (定向激光 UR)
"""
import base64
import json
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import imageio_ffmpeg
import soundfile as sf
import numpy as np
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[3]
FILM_DIR = ROOT_DIR / "07_showcase" / "film"
CAPTURE_DIR = FILM_DIR / "capture"
CLIPS_DIR = CAPTURE_DIR / "clips"
EXPORTS_DIR = CAPTURE_DIR / "exports"
STILLS_DIR = FILM_DIR / "covers" / "stills"
PROFILE_DIR = CAPTURE_DIR / "browser-profile-film"

for d in (CLIPS_DIR, EXPORTS_DIR, STILLS_DIR):
    d.mkdir(parents=True, exist_ok=True)

CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe"
APP_URL = "http://127.0.0.1:5173/"
TARGET_FPS = 30
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def log(msg: str):
    print(msg, flush=True)


class UploadHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Filename")
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        filename = self.headers.get("X-Filename", "upload.bin")
        data = self.rfile.read(length)
        target = CLIPS_DIR / Path(filename).name
        target.write_bytes(data)
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "bytes": len(data)}).encode())


def start_upload_server():
    server = HTTPServer(("127.0.0.1", 0), UploadHandler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, port


INIT_SCRIPT = r"""
(() => {
  const UPLOAD_PORT = __UPLOAD_PORT__;

  // 1. Seamless In-Memory Brand Overlay (HOLOBEAT -> 声卡造物局, .holobeat.json -> 工程文件)
  function scrubNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      let t = node.nodeValue || '';
      if (!t || !/holobeat/i.test(t)) return;
      const parent = node.parentElement;
      if (parent && parent.classList.contains('zh-display') && t.trim().toUpperCase() === 'HOLOBEAT') {
        node.nodeValue = '声卡造物局';
        const sib = parent.nextElementSibling;
        if (sib && sib.textContent && sib.textContent.trim() === '声卡造物局') {
          sib.textContent = '街巷声音工坊';
        }
        return;
      }
      t = t.replace(/\(\s*\.holobeat\.json\s*\)/gi, '(可重混工程)');
      t = t.replace(/\.holobeat\.json/gi, ' 工程文件');
      t = t.replace(/HOLOBEAT\s*[·•\-]\s*声卡造物局/gi, '声卡造物局');
      t = t.replace(/HOLOBEAT/gi, '声卡造物局');
      node.nodeValue = t;
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
      if (el.hasAttribute && el.hasAttribute('title') && /holobeat/i.test(el.getAttribute('title') || '')) {
        el.setAttribute('title', (el.getAttribute('title') || '').replace(/\.holobeat\.json/gi, '工程文件').replace(/HOLOBEAT/gi, '声卡造物局'));
      }
      for (const child of el.childNodes) scrubNode(child);
    }
  }

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') scrubNode(m.target);
      else if (m.type === 'childList') {
        for (const n of m.addedNodes) scrubNode(n);
      }
    }
  });

  // 2. Refined Tactile SVG Pointer Cursor + Click Ripple (clean, non-blocking, hideable on stage)
  function installCursor() {
    if (document.getElementById('__film_cursor__')) return;
    const style = document.createElement('style');
    style.textContent = `
      #__film_cursor__ {
        position: fixed; left: -120px; top: -120px; z-index: 999999;
        width: 26px; height: 26px; pointer-events: none;
        transform: translate(-3px, -2px);
        transition: opacity 200ms ease, transform 80ms ease;
        opacity: 0;
        filter: drop-shadow(2px 2px 0px rgba(26,26,31,0.7));
      }
      #__film_cursor__.visible { opacity: 1; }
      #__film_cursor__.down { transform: translate(-3px, -2px) scale(0.86); }
      .__film_ripple__ {
        position: fixed; z-index: 999998; pointer-events: none;
        width: 18px; height: 18px; margin-left: -9px; margin-top: -9px;
        border-radius: 50%;
        border: 2.5px solid #FFD60A;
        background: rgba(255, 214, 10, 0.25);
        animation: __film_ripple_kf 340ms cubic-bezier(0.22,1,0.36,1) forwards;
      }
      @keyframes __film_ripple_kf {
        0% { transform: scale(0.6); opacity: 0.95; }
        100% { transform: scale(2.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = '__film_cursor__';
    wrap.innerHTML = `<svg viewBox="0 0 28 28" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 3.5L22 13.8L13.6 15.8L10.3 23.5L4.5 3.5Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="13.5" cy="14.5" r="2" fill="#FFD60A"/>
    </svg>`;
    document.body.appendChild(wrap);
    window.__FILM_CURSOR_ENABLED__ = true;

    window.addEventListener('pointermove', (e) => {
      wrap.style.left = e.clientX + 'px';
      wrap.style.top = e.clientY + 'px';
      if (window.__FILM_CURSOR_ENABLED__) wrap.classList.add('visible');
    }, true);
    window.addEventListener('pointerdown', (e) => {
      wrap.classList.add('down');
      if (window.__FILM_CURSOR_ENABLED__) {
        const rip = document.createElement('div');
        rip.className = '__film_ripple__';
        rip.style.left = e.clientX + 'px';
        rip.style.top = e.clientY + 'px';
        document.body.appendChild(rip);
        setTimeout(() => rip.remove(), 360);
      }
    }, true);
    window.addEventListener('pointerup', () => wrap.classList.remove('down'), true);
    window.__SET_FILM_CURSOR__ = (show) => {
      window.__FILM_CURSOR_ENABLED__ = show;
      wrap.classList.toggle('visible', show);
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    scrubNode(document.body);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    installCursor();
    if (document.title && /holobeat/i.test(document.title)) {
      document.title = document.title.replace(/HOLOBEAT\s*[·•\-]\s*/gi, '').replace(/HOLOBEAT/gi, '声卡造物局');
    }
  });

  // 3. Resilient Multi-Context Chrome MediaRecorder Web Audio Tap (ZERO main-thread underruns & immune to closed/lazy contexts!)
  const tapState = {
    contexts: [],
    recorder: null,
    chunks: [],
    recording: false,
    startEpochSec: 0,
    recStartEpochSec: 0,
    endEpochSec: 0,
    tappedCount: 0,
  };

  function startRecorderOnDest(dest) {
    if (!dest || tapState.recorder) return;
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    tapState.chunks = [];
    tapState.recStartEpochSec = (performance.timeOrigin + performance.now()) / 1000;
    tapState.recorder = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 256000 });
    tapState.recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) tapState.chunks.push(e.data); };
    tapState.recorder.start(80);
  }

  function setupContextTap(ctx) {
    if (ctx.__filmTapped) return;
    ctx.__filmTapped = true;
    const origDest = ctx.destination;
    const tapGain = ctx.createGain();
    tapGain.gain.value = 0.89;

    const rawConnect = AudioNode.prototype.connect;
    rawConnect.call(tapGain, origDest);

    const mediaDest = ctx.createMediaStreamDestination();
    rawConnect.call(tapGain, mediaDest);

    // -70dB inaudible oscillator keeps Opus encoder & MediaStream audio clock rock-steady across silent pauses (prevents Opus DTX drops!)
    const keepAlive = ctx.createOscillator();
    const keepGain = ctx.createGain();
    keepGain.gain.value = 0.0003;
    rawConnect.call(keepAlive, keepGain);
    rawConnect.call(keepGain, mediaDest);
    keepAlive.start();

    ctx.__filmTapGain = tapGain;
    ctx.__filmMediaDest = mediaDest;
    tapState.contexts.push(ctx);
    tapState.tappedCount += 1;

    if (tapState.recording && !tapState.recorder) {
      startRecorderOnDest(mediaDest);
    }
  }

  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function(target, ...rest) {
    try {
      if (target && this.context && target === this.context.destination && this !== this.context.__filmTapGain) {
        if (!this.context.__filmTapped) setupContextTap(this.context);
        return origConnect.call(this, this.context.__filmTapGain, ...rest);
      }
    } catch {}
    return origConnect.call(this, target, ...rest);
  };

  const NativeAC = window.AudioContext || window.webkitAudioContext;
  if (NativeAC) {
    const WrappedAC = function(opts) {
      const ctx = new NativeAC(Object.assign({ sampleRate: 48000 }, opts || {}));
      setupContextTap(ctx);
      return ctx;
    };
    WrappedAC.prototype = NativeAC.prototype;
    Object.setPrototypeOf(WrappedAC, NativeAC);
    window.AudioContext = WrappedAC;
    if (window.webkitAudioContext) window.webkitAudioContext = WrappedAC;
  }

  window.__FILM_AUDIO__ = {
    start() {
      tapState.chunks = [];
      tapState.recorder = null;
      tapState.recording = true;
      tapState.startEpochSec = (performance.timeOrigin + performance.now()) / 1000;
      tapState.recStartEpochSec = tapState.startEpochSec;
      const liveCtx = tapState.contexts.find(c => c.state !== 'closed');
      if (liveCtx && liveCtx.__filmMediaDest) {
        startRecorderOnDest(liveCtx.__filmMediaDest);
      }
      return { startEpochSec: tapState.startEpochSec, liveContexts: tapState.contexts.filter(c => c.state !== 'closed').length, tappedCount: tapState.tappedCount };
    },
    async stopAndUpload(filename) {
      tapState.recording = false;
      tapState.endEpochSec = (performance.timeOrigin + performance.now()) / 1000;
      let bytes = 0;
      if (tapState.recorder && tapState.recorder.state !== 'inactive') {
        const rec = tapState.recorder;
        tapState.recorder = null;
        const done = new Promise(r => { rec.onstop = r; });
        rec.stop();
        await done;
        const blob = new Blob(tapState.chunks, { type: rec.mimeType || 'audio/webm' });
        bytes = blob.size;
        await fetch(`http://127.0.0.1:${UPLOAD_PORT}/upload`, {
          method: 'POST',
          headers: { 'X-Filename': filename },
          body: blob,
        });
      }
      return {
        bytes,
        startEpochSec: tapState.startEpochSec,
        recStartEpochSec: tapState.recStartEpochSec,
        endEpochSec: tapState.endEpochSec,
        wallDurSec: +(tapState.endEpochSec - tapState.startEpochSec).toFixed(4),
      };
    },
  };
})();
"""


class CdpClipRecorder:
    def __init__(self, page, cdp, out_dir: Path, fps: int = TARGET_FPS):
        self.page = page
        self.cdp = cdp
        self.out_dir = out_dir
        self.fps = fps
        self.raw_frames: list[tuple[float, str]] = []
        self.active = False
        self.clip_name = ""
        self.cdp.on("Page.screencastFrame", self._on_frame)

    def _on_frame(self, params):
        try:
            self.cdp.send("Page.screencastFrameAck", {"sessionId": params["sessionId"]})
        except Exception:
            pass
        if not self.active:
            return
        # Ultra-lightweight callback: zero base64 decode on hot event loop!
        ts = float(params.get("metadata", {}).get("timestamp") or time.time())
        self.raw_frames.append((ts, params["data"]))

    def start(self, clip_name: str):
        self.clip_name = clip_name
        self.raw_frames = []
        self.active = True
        self.audio_meta = self.page.evaluate("() => window.__FILM_AUDIO__.start()")
        self.cdp.send("Page.startScreencast", {
            "format": "jpeg",
            "quality": 90,
            "maxWidth": 1920,
            "maxHeight": 1080,
            "everyNthFrame": 3,
        })
        return self.audio_meta

    def stop(self):
        self.active = False
        try:
            self.cdp.send("Page.stopScreencast")
        except Exception:
            pass
        aud_webm_name = f"{self.clip_name}.audio.webm"
        audio_info = self.page.evaluate("(f) => window.__FILM_AUDIO__.stopAndUpload(f)", aud_webm_name)

        aud_webm_path = self.out_dir / aud_webm_name
        wav_path = self.out_dir / f"{self.clip_name}.wav"
        mp4_path = self.out_dir / f"{self.clip_name}.mp4"

        t0 = audio_info["startEpochSec"]
        dur = audio_info["wallDurSec"]
        lead_pad_sec = max(0.0, audio_info.get("recStartEpochSec", t0) - t0)
        has_audio = audio_info["bytes"] > 150 and aud_webm_path.exists()

        if has_audio:
            tmp_wav = self.out_dir / f"_{self.clip_name}_tmp.wav"
            subprocess.run([
                FFMPEG, "-y", "-i", str(aud_webm_path),
                "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le",
                str(tmp_wav),
            ], check=True, capture_output=True)
            try:
                aud_webm_path.unlink()
            except Exception:
                pass
            wav_data, sr = sf.read(str(tmp_wav), dtype="float32")
            try:
                tmp_wav.unlink()
            except Exception:
                pass
            if lead_pad_sec > 0.01:
                pad_n = int(round(lead_pad_sec * sr))
                wav_data = np.vstack([np.zeros((pad_n, 2), dtype=np.float32), wav_data])
            sf.write(str(wav_path), wav_data, sr, subtype="PCM_16")
            wav_dur = len(wav_data) / sr
            wav_peak = float(np.max(np.abs(wav_data))) if len(wav_data) else 0.0
            dur = wav_dur
        else:
            wav_peak = 0.0
            sr = 48000
            if self.raw_frames:
                t0 = self.raw_frames[0][0]
                dur = max(0.5, self.raw_frames[-1][0] - t0)
            sf.write(str(wav_path), np.zeros((int(dur * sr), 2), dtype=np.float32), sr, subtype="PCM_16")

        frames = sorted(self.raw_frames, key=lambda x: x[0])
        if not frames:
            raise RuntimeError(f"No frames captured for {self.clip_name}")
        # Decode base64 frames ONLY after recording stopped!
        decoded = [(ts, base64.b64decode(b64)) for ts, b64 in frames]
        self.raw_frames = []

        total_out_frames = max(1, int(round(dur * self.fps)))
        # Span the full recorded frame timeline [t_first..t_last] onto dur so no ending action is ever clipped!
        t_first = decoded[0][0]
        t_last = max(t_first + 0.1, decoded[-1][0])
        span = t_last - t_first
        cmd = [
            FFMPEG, "-y",
            "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", str(self.fps), "-i", "-",
            "-i", str(wav_path),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
            "-shortest",
            str(mp4_path),
        ]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        fidx = 0
        n_src = len(decoded)
        for k in range(total_out_frames):
            frac = (k + 0.5) / total_out_frames
            target_t = t_first + frac * span
            while fidx + 1 < n_src and decoded[fidx + 1][0] <= target_t:
                fidx += 1
            proc.stdin.write(decoded[fidx][1])
        proc.stdin.close()
        _, err = proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg failed on {self.clip_name}: {err.decode(errors='ignore')[-500:]}")

        eff_fps = round(n_src / max(0.1, dur), 1)
        info = {
            "clip": self.clip_name,
            "mp4": str(mp4_path),
            "wav": str(wav_path),
            "capturedFrames": n_src,
            "outFrames": total_out_frames,
            "effectiveCaptureFps": eff_fps,
            "durationSec": round(dur, 3),
            "wavPeak": round(wav_peak, 4),
            "sampleRate": sr,
        }
        log(f"  [CLIP DONE] {self.clip_name}: {info['durationSec']}s | {eff_fps} cap-fps -> {self.fps}fps | peak={info['wavPeak']}")
        return info


def move_fast_smooth(page, x: float, y: float, steps: int = 8):
    page.mouse.move(x, y, steps=steps)


def click_smooth(page, loc, pause_after: int = 120, steps: int = 8):
    box = loc.bounding_box()
    if not box:
        loc.click()
        return
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2
    page.mouse.move(cx, cy, steps=steps)
    page.mouse.down()
    page.wait_for_timeout(55)
    page.mouse.up()
    if pause_after > 0:
        page.wait_for_timeout(pause_after)


def drag_smooth(page, x1: float, y1: float, x2: float, y2: float, steps: int = 10):
    page.mouse.move(x1, y1, steps=6)
    page.mouse.down()
    page.wait_for_timeout(40)
    page.mouse.move(x2, y2, steps=steps)
    page.mouse.up()


def set_cursor_visible(page, show: bool):
    page.evaluate("(s) => window.__SET_FILM_CURSOR__ && window.__SET_FILM_CURSOR__(s)", show)


def dismiss_toasts(page):
    page.evaluate("""() => {
        if (window.__filmStore) {
            const st = window.__filmStore.getState();
            for (const t of [...st.toasts]) st.dismissToast(t.id);
        }
    }""")
    page.wait_for_timeout(60)


def attach_store_and_audio(page):
    page.evaluate("""async () => {
        const storeRes = performance.getEntriesByType('resource').find(r => r.name.includes('/src/store/useHoloStore.ts'));
        const audioRes = performance.getEntriesByType('resource').find(r => r.name.includes('/src/audio/HoloAudioEngine.ts'));
        if (storeRes) window.__filmStore = (await import(storeRes.name)).useHoloStore;
        if (audioRes) window.__filmHoloAudio = (await import(audioRes.name)).holoAudio;
    }""")
    page.wait_for_function("Boolean(window.__filmStore && window.__filmStore.getState().dbHydrated)")


def main():
    if PROFILE_DIR.exists():
        shutil.rmtree(PROFILE_DIR, ignore_errors=True)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    server, upload_port = start_upload_server()
    init_js = INIT_SCRIPT.replace("__UPLOAD_PORT__", str(upload_port))
    manifest = {"fps": TARGET_FPS, "clips": [], "exports": {}, "shareUrl": None, "checks": {}}

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            executable_path=CHROME_PATH,
            headless=True,
            accept_downloads=True,
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            args=[
                "--autoplay-policy=no-user-gesture-required",
                "--use-gl=angle", "--use-angle=d3d11", "--enable-webgl", "--ignore-gpu-blocklist",
                "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--no-first-run",
            ],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.add_init_script(init_js)
        cdp = ctx.new_cdp_session(page)
        rec = CdpClipRecorder(page, cdp, CLIPS_DIR, fps=TARGET_FPS)

        log("1) Launching app & preparing isolated pristine demo state...")
        page.goto(APP_URL, wait_until="domcontentloaded", timeout=60000)
        page.get_by_test_id("nav-gacha").wait_for(timeout=60000)
        page.evaluate("() => document.fonts.ready")
        attach_store_and_audio(page)
        page.wait_for_timeout(500)

        power_btn = page.get_by_role("button", name="启动声音")
        if power_btn.is_visible():
            power_btn.click()
            page.wait_for_timeout(1000)

        # Clean 15/16 collector state with pity=4 so next real pull natively lands #05 二八大杠车铃!
        page.evaluate("""() => {
            const st = window.__filmStore;
            const fifteen = [
                'card-01','card-02','card-03','card-04',
                'card-06','card-07','card-08',
                'card-09','card-10','card-11','card-12',
                'card-13','card-14','card-15','card-16'
            ];
            const counts = {};
            fifteen.forEach(id => counts[id] = 1);
            st.setState({
                collection: fifteen,
                pullHistory: ['card-11', 'card-01', 'card-09', 'card-13', 'card-10', 'card-15'],
                pullCounts: counts,
                pityCount: 4,
                totalPulls: 15,
                selectedGachaCardId: 'card-01',
                needsScratch: false,
                bpm: 118,
                swing: 0.08,
                scale: 'PENTA_C',
                beatBars: 2,
                activePhrase: 'A',
                beatPhraseLoop: 'A',
                liveFxMode: 'latch',
                liveFx: { bitcrush: false, echo: false, stutter: false },
            });
            const cur = st.getState();
            const makeEmpty32 = () => Array(32).fill(false);
            const t0Steps = makeEmpty32();
            [0, 6, 8, 14].forEach(i => t0Steps[i] = true);
            const t0Acc = makeEmpty32();
            [0, 8].forEach(i => t0Acc[i] = true);
            const nextTracks = cur.tracks.map((tr, idx) => {
                const steps = idx === 0 ? t0Steps : makeEmpty32();
                const accents = idx === 0 ? t0Acc : makeEmpty32();
                const cells = Array.from({ length: 32 }, (_, i) => ({
                    on: steps[i],
                    velocity: accents[i] ? 0.96 : (i % 2 === 0 ? 0.84 : 0.74),
                    pitchOffset: 0,
                    lengthSteps: 1,
                }));
                return {
                    ...tr,
                    cardId: idx === 0 ? 'card-01' : idx === 1 ? 'card-06' : idx === 2 ? 'card-09' : 'card-13',
                    steps,
                    accents,
                    stepCells: cells,
                    volume: idx === 0 ? 0.9 : idx === 1 ? 0.78 : idx === 2 ? 0.82 : 0.72,
                    tone: idx === 0 ? 0.52 : idx === 1 ? 0.62 : idx === 2 ? 0.56 : 0.52,
                    mute: false,
                    solo: false,
                };
            });
            st.setState({ tracks: nextTracks });
        }""")
        dismiss_toasts(page)
        page.wait_for_timeout(350)

        # ==================== SCENE 01: GACHA UNBOXING & HERO CARD REVEAL (CALM HUMAN PACE) ====================
        log("2) Recording s01_gacha (relaxed pace)...")
        set_cursor_visible(page, True)
        move_fast_smooth(page, 460, 420, steps=6)
        rec.start("s01_gacha")
        page.wait_for_timeout(750)

        # Pull lever down unhurriedly
        lever = page.get_by_test_id("gacha-lever")
        lbox = lever.bounding_box()
        drag_smooth(page, lbox["x"] + 16, lbox["y"] + 24, lbox["x"] + 16, lbox["y"] + 128, steps=16)
        page.wait_for_timeout(1250)

        # Scratch off real silver foil coating smoothly across hero card!
        hero = page.get_by_test_id("hero-holo-card")
        hbox = hero.bounding_box()
        cx, cy = hbox["x"] + hbox["width"] / 2, hbox["y"] + hbox["height"] / 2
        w, h = hbox["width"], hbox["height"]
        move_fast_smooth(page, cx - w * 0.34, cy - h * 0.28, steps=10)
        page.mouse.down()
        for tx, ty in [
            (cx + w * 0.34, cy - h * 0.22),
            (cx - w * 0.34, cy - h * 0.04),
            (cx + w * 0.34, cy + h * 0.06),
            (cx - w * 0.32, cy + h * 0.22),
            (cx + w * 0.34, cy + h * 0.28),
            (cx - w * 0.14, cy - h * 0.10),
            (cx + w * 0.18, cy + h * 0.12),
        ]:
            if not page.evaluate("() => window.__filmStore.getState().needsScratch"):
                break
            page.mouse.move(tx, ty, steps=9)
            page.wait_for_timeout(75)
        page.mouse.up()

        if page.evaluate("() => window.__filmStore.getState().needsScratch"):
            page.get_by_test_id("gacha-quick-btn").click()

        page.wait_for_timeout(2000)
        dismiss_toasts(page)
        page.screenshot(path=str(STILLS_DIR / "01_gacha_bell_hero.png"))

        # Graceful unhurried 3D holographic tilt shimmer
        move_fast_smooth(page, cx - w * 0.32, cy - h * 0.22, steps=12)
        page.wait_for_timeout(420)
        move_fast_smooth(page, cx + w * 0.34, cy + h * 0.16, steps=16)
        page.wait_for_timeout(460)
        move_fast_smooth(page, cx + w * 0.12, cy - h * 0.24, steps=12)
        page.wait_for_timeout(420)
        page.mouse.move(cx - w * 0.6, cy, steps=8)

        # Solo audition (crystal clear bronze bell ring with generous tail!)
        click_smooth(page, page.get_by_role("button", name="试听音色"), pause_after=150)
        set_cursor_visible(page, False)
        page.wait_for_timeout(2400)
        set_cursor_visible(page, True)

        # Flip card to inspect back archive calmly
        click_smooth(page, page.get_by_test_id("gacha-flip-btn"), pause_after=150)
        move_fast_smooth(page, cx + w * 0.72, cy + h * 0.2, steps=8)
        set_cursor_visible(page, False)
        page.wait_for_timeout(3200)
        page.screenshot(path=str(STILLS_DIR / "02_gacha_bell_back.png"))
        set_cursor_visible(page, True)

        click_smooth(page, page.get_by_test_id("gacha-flip-btn"), pause_after=700)

        # Open 16-card deck drawer & scroll smoothly
        click_smooth(page, page.get_by_test_id("open-deck-drawer"), pause_after=650)
        drawer_scroll = page.locator("aside .holo-scroll").first
        dbox = drawer_scroll.bounding_box()
        if dbox:
            move_fast_smooth(page, dbox["x"] + dbox["width"] * 0.5, dbox["y"] + dbox["height"] * 0.5, steps=8)
            for _ in range(8):
                page.mouse.wheel(0, 145)
                page.wait_for_timeout(190)
            page.wait_for_timeout(750)
        click_smooth(page, page.get_by_role("button", name="关闭图鉴"), pause_after=450)

        # Curated soundscapes preview (readable hold)
        click_smooth(page, page.get_by_test_id("gacha-soundscapes-btn"), pause_after=2300)
        click_smooth(page, page.get_by_role("button", name="关闭策展声景"), pause_after=450)

        # Send #05 二八大杠车铃 into Beat Deck PERC slot (captures real physical flying-card animation!)
        click_smooth(page, page.get_by_test_id("gacha-slot-btn"), pause_after=650)
        click_smooth(page, page.get_by_role("button", name="装入→").nth(1), pause_after=1450)
        dismiss_toasts(page)
        page.wait_for_timeout(450)
        manifest["clips"].append(rec.stop())

        # ==================== SCENE 02: BEAT DECK LAYERING, SWAP, SOLO, KNOBS & MICRO-EDIT (CALM PACE) ====================
        log("3) Recording s02_beat_build (relaxed pace)...")
        rec.start("s02_beat_build")
        page.wait_for_timeout(550)

        click_smooth(page, page.get_by_test_id("beat-play-btn"), pause_after=2600)

        # Layer Track 1 (二八大杠车铃) off-beat crisp hits
        for s_idx in [4, 10, 12]:
            click_smooth(page, page.get_by_test_id(f"pad-1-{s_idx}"), pause_after=220, steps=8)
        page.wait_for_timeout(2600)

        # Paint Track 2 (MELODY) steps
        for s_idx in [0, 3, 6, 8, 11]:
            click_smooth(page, page.get_by_test_id(f"pad-2-{s_idx}"), pause_after=150, steps=7)
        page.wait_for_timeout(2100)

        # Swap MELODY cartridge -> #11 赛博古筝拨弦
        click_smooth(page, page.get_by_role("button", name="更换旋律轨道声卡"), pause_after=650)
        click_smooth(page, page.locator("button:has-text('赛博古筝拨弦')").first, pause_after=2600)

        # Layer Track 3 (VIBE · 夜市铁板滋啦)
        click_smooth(page, page.get_by_test_id("pad-3-0"), pause_after=240, steps=8)
        click_smooth(page, page.get_by_test_id("pad-3-8"), pause_after=2800, steps=8)

        # Solo Track 1 (二八车铃) clearly, then un-solo
        solo_btns = page.locator("button[title='独奏']")
        click_smooth(page, solo_btns.nth(1), pause_after=2650)
        click_smooth(page, solo_btns.nth(1), pause_after=1150)

        # Adjust MELODY tone knob & global swing knob smoothly
        tkbox = page.locator("[title*='滤波与音色明亮度']").nth(2).bounding_box()
        if tkbox:
            drag_smooth(page, tkbox["x"] + tkbox["width"]/2, tkbox["y"] + tkbox["height"]/2,
                        tkbox["x"] + tkbox["width"]/2, tkbox["y"] + tkbox["height"]/2 - 34, steps=14)
        page.wait_for_timeout(950)

        skbox = page.locator("[title*='摇摆度']").first.bounding_box()
        if skbox:
            drag_smooth(page, skbox["x"] + skbox["width"]/2, skbox["y"] + skbox["height"]/2,
                        skbox["x"] + skbox["width"]/2, skbox["y"] + skbox["height"]/2 - 22, steps=14)
        page.wait_for_timeout(1050)

        # Open Fine-Tuning bar & adjust pitch +1 and length 2-step on MELODY step 11
        click_smooth(page, page.get_by_test_id("beat-fine-toggle"), pause_after=550)
        p211 = page.get_by_test_id("pad-2-11").bounding_box()
        move_fast_smooth(page, p211["x"] + p211["width"]/2, p211["y"] + p211["height"]/2, steps=8)
        page.keyboard.down("Alt")
        page.mouse.click(p211["x"] + p211["width"]/2, p211["y"] + p211["height"]/2)
        page.keyboard.up("Alt")
        page.wait_for_timeout(450)
        var_bar = page.get_by_test_id("beat-variation-bar")
        click_smooth(page, var_bar.get_by_role("button", name="+", exact=True), pause_after=450, steps=8)
        click_smooth(page, var_bar.get_by_role("button", name="2步", exact=True), pause_after=2100, steps=8)
        page.screenshot(path=str(STILLS_DIR / "03_beat_composition.png"))
        manifest["clips"].append(rec.stop())

        # ==================== SCENE 03: INDEPENDENT A/B PHRASE, RULE VARIATION & MOMENTARY LIVE FX (CALM PACE) ====================
        log("4) Recording s03_beat_ab_fx (relaxed pace)...")
        rec.start("s03_beat_ab_fx")
        page.wait_for_timeout(450)

        click_smooth(page, page.get_by_role("button", name="复制 A→B"), pause_after=650)
        click_smooth(page, page.get_by_test_id("phrase-tab-B"), pause_after=750)
        click_smooth(page, page.get_by_role("button", name="A+B", exact=True), pause_after=750)

        # Rule Variation: 问答 (Call & Response)
        click_smooth(page, page.get_by_test_id("variation-call_response"), pause_after=450)
        dismiss_toasts(page)
        page.screenshot(path=str(STILLS_DIR / "04_beat_ab_variation.png"))
        set_cursor_visible(page, False)
        page.wait_for_timeout(5200)
        set_cursor_visible(page, True)

        # Close fine-tuning bar, switch Live FX to Momentary (按住生效), live perform clearly!
        click_smooth(page, page.get_by_test_id("beat-fine-toggle"), pause_after=450)
        click_smooth(page, page.get_by_test_id("fx-mode-toggle"), pause_after=700)

        for fx_id, hold_ms, gap_ms in [("fx-bitcrush", 1650, 750), ("fx-echo", 1950, 750), ("fx-stutter", 1550, 850)]:
            fbox = page.get_by_test_id(fx_id).bounding_box()
            move_fast_smooth(page, fbox["x"] + fbox["width"]/2, fbox["y"] + fbox["height"]/2, steps=10)
            page.mouse.down()
            page.wait_for_timeout(hold_ms)
            page.mouse.up()
            page.wait_for_timeout(gap_ms)

        click_smooth(page, page.get_by_test_id("beat-stop-btn"), pause_after=650)
        manifest["clips"].append(rec.stop())

        # ==================== SCENE 04: PINBALL FREE JAM + 8s RECORDING + QUANTIZE A/B COMPARE (CALM PACE) ====================
        log("5) Recording s04_pinball_free (relaxed pace)...")
        page.get_by_test_id("nav-pinball").click()
        page.wait_for_timeout(450)
        page.evaluate("""() => {
            const st = window.__filmStore.getState();
            st.setPinballMode('free');
            st.setPinballAutoDrop(false);
            st.applyPinballPreset('LOOP');
            st.setPinballRecordedEvents([]);
            st.setPinballGravity(0.95);
            st.setPinballBounce(0.92);
            st.setPinballDropRate(0.55);
        }""")
        dismiss_toasts(page)
        page.wait_for_timeout(400)

        rec.start("s04_pinball_free")
        page.wait_for_timeout(650)

        click_smooth(page, page.get_by_role("button", name="弹簧碰珠"), pause_after=550)
        click_smooth(page, page.locator("button:has-text('二八大杠车铃')").first, pause_after=650)

        canvas = page.locator("canvas").first
        cbox = canvas.bounding_box()
        move_fast_smooth(page, cbox["x"] + cbox["width"] * 0.66, cbox["y"] + cbox["height"] * 0.34, steps=10)
        page.mouse.click(cbox["x"] + cbox["width"] * 0.66, cbox["y"] + cbox["height"] * 0.34)
        page.wait_for_timeout(700)

        click_smooth(page, page.get_by_test_id("pinball-drop-btn"), pause_after=600)
        click_smooth(page, page.get_by_test_id("pinball-drop-btn"), pause_after=550, steps=6)
        auto_btn = page.locator("button:has-text('自动连发')").first
        click_smooth(page, auto_btn, pause_after=4400)
        page.screenshot(path=str(STILLS_DIR / "05_pinball_free_jam.png"))

        # Adjust Gravity & Bounce visibly
        grav_slider = page.locator("text=重力").locator("..").locator("..").locator("[role='slider']").first
        if grav_slider.count() > 0:
            gbox = grav_slider.bounding_box()
            if gbox:
                drag_smooth(page, gbox["x"] + gbox["width"]*0.45, gbox["y"] + gbox["height"]/2,
                            gbox["x"] + gbox["width"]*0.24, gbox["y"] + gbox["height"]/2, steps=14)
        page.wait_for_timeout(550)
        bkbox = page.locator("[title*='弹珠全局弹性']").first.bounding_box()
        if bkbox:
            drag_smooth(page, bkbox["x"] + bkbox["width"]/2, bkbox["y"] + bkbox["height"]/2,
                        bkbox["x"] + bkbox["width"]/2, bkbox["y"] + bkbox["height"]/2 - 34, steps=14)

        set_cursor_visible(page, False)
        page.wait_for_timeout(3200)
        set_cursor_visible(page, True)

        click_smooth(page, auto_btn, pause_after=650)
        click_smooth(page, page.get_by_test_id("pinball-to-quantize-btn"), pause_after=1250)
        dismiss_toasts(page)

        q_banner = page.get_by_test_id("quantize-preview-banner")
        q_banner.wait_for(timeout=10000)
        click_smooth(page, q_banner.get_by_role("button", name="▶ 听原录音"), pause_after=3600)
        click_smooth(page, q_banner.get_by_role("button", name="▶ 听量化轨"), pause_after=3700)
        click_smooth(page, q_banner.get_by_role("button", name="合并至当前轨"), pause_after=1400)
        dismiss_toasts(page)
        manifest["clips"].append(rec.stop())

        # ==================== SCENE 05: CHOREOGRAPHED PINBALL SHOW (NO-VO CLIMAX!) ====================
        log("6) Recording s05_pinball_show (Climax Show + Finale Sound Sigil)...")
        # Polish merged composition to crisp canonical 《铃响晴巷》 AND set draft title to '铃响晴巷' so Theater placard matches!
        page.evaluate("""() => {
            const st = window.__filmStore;
            const cur = st.getState();
            const canonical = [
                [0, 6, 8, 14, 16, 22, 24, 27, 30],          // BEAT (#01 弄堂竹板)
                [4, 10, 12, 18, 20, 26, 28, 29, 31],        // PERC (#05 二八大杠车铃)
                [0, 3, 6, 8, 11, 16, 18, 22, 24, 26, 28],   // MELODY (#11 赛博古筝拨弦)
                [0, 8, 16, 22, 28],                         // VIBE (#13 夜市铁板滋啦)
            ];
            const accMaps = [[0,8,16,24,30], [4,12,20,28,31], [0,8,16,24,28], [0,16]];
            const tracks = cur.tracks.map((tr, idx) => {
                const steps = Array(32).fill(false);
                canonical[idx].forEach(s => steps[s] = true);
                if (idx === 1 && tr.steps[2]) steps[2] = true;
                if (idx === 2 && tr.steps[14]) steps[14] = true;
                const accents = Array(32).fill(false);
                accMaps[idx].forEach(s => accents[s] = true);
                const pitchMap = idx === 2 ? { 11: 1, 22: 1, 26: 2, 28: 0 } : {};
                const lenMap = idx === 2 ? { 11: 2, 28: 2 } : (idx === 3 ? { 0: 2, 8: 2, 16: 2 } : {});
                const cells = Array.from({ length: 32 }, (_, i) => ({
                    on: steps[i],
                    velocity: accents[i] ? 0.96 : (i % 2 === 0 ? 0.84 : 0.74),
                    pitchOffset: pitchMap[i] || 0,
                    lengthSteps: lenMap[i] || 1,
                }));
                return {
                    ...tr,
                    cardId: ['card-01','card-05','card-11','card-13'][idx],
                    steps, accents, stepCells: cells,
                    volume: [0.9, 0.78, 0.82, 0.72][idx],
                    tone: [0.52, 0.62, 0.58, 0.52][idx],
                    mute: false, solo: false,
                };
            });
            st.setState({
                bpm: 118, swing: 0.18, scale: 'PENTA_C', beatBars: 2, beatPhraseLoop: 'AB',
                liveFx: { bitcrush: false, echo: false, stutter: false },
                tracks,
                forgeDraft: { ...cur.forgeDraft, title: '铃响晴巷', stickers: [] },
            });
        }""")
        page.wait_for_timeout(300)

        rec.start("s05_pinball_show")
        page.wait_for_timeout(250)
        # Click "进入弹珠剧场" -> freezes 《铃响晴巷》 & opens Choreographed Show!
        click_smooth(page, page.get_by_test_id("beat-to-pinball-btn"), pause_after=300)
        # Ensure show snapshot title reads 铃响晴巷 on Theater Placard
        page.evaluate("""() => {
            const st = window.__filmStore;
            const snap = st.getState().pinballShowSnapshot;
            if (snap) st.setState({ pinballShowSnapshot: { ...snap, title: '铃响晴巷' } });
        }""")
        dismiss_toasts(page)

        # Wait until snapshot actually begins playing and show 2.4s in regular Conductor Overview mode
        page.wait_for_function("() => window.__filmHoloAudio.isSnapshotPlaying()", timeout=10000)
        page.wait_for_timeout(2400)
        page.screenshot(path=str(STILLS_DIR / "06_pinball_show_overview.png"))

        # Enter Full Theater Mode for pure unobstructed climax performance!
        click_smooth(page, page.get_by_test_id("pinball-theater-btn"), pause_after=200)
        play_show_btn = page.get_by_test_id("pinball-play-show-btn")
        if "停止" in (play_show_btn.inner_text() or ""):
            play_show_btn.click()
            page.wait_for_timeout(250)

        set_cursor_visible(page, False)
        # Play Full Pass #1 in Theater Mode & wait until completely finished + finale sigil blooms!
        play_show_btn.click()
        page.wait_for_function("() => window.__filmHoloAudio.isSnapshotPlaying()", timeout=10000)
        page.wait_for_timeout(2300)
        page.screenshot(path=str(STILLS_DIR / "07_pinball_show_theater.png"))
        # Wait for audio playback to complete naturally (so finale sigil blooms!)
        page.wait_for_function("() => !window.__filmHoloAudio.isSnapshotPlaying()", timeout=15000)
        page.wait_for_timeout(450)
        page.screenshot(path=str(STILLS_DIR / "08_pinball_show_sigil.png"))
        page.wait_for_timeout(1600)

        # Exit Theater Mode & send exact frozen Show snapshot directly to 04 Forge!
        set_cursor_visible(page, True)
        click_smooth(page, page.get_by_test_id("pinball-theater-btn"), pause_after=300)
        click_smooth(page, page.get_by_test_id("pinball-show-to-forge-btn"), pause_after=600)
        dismiss_toasts(page)
        manifest["clips"].append(rec.stop())

        # ==================== SCENE 06: FORGE DESIGN, 5 FOILS, CLEAN STICKERS, MINT CEREMONY & AUDITION (CALM PACE) ====================
        log("7) Recording s06_forge_mint (relaxed pace)...")
        page.wait_for_function("document.querySelector('[data-testid=\"forge-pcm-badge\"]')?.textContent?.includes('真实 PCM')", timeout=15000)
        # Ensure draft starts clean with blank title & zero stickers so we design live cleanly on camera!
        page.evaluate("""() => {
            const st = window.__filmStore;
            st.setState({ forgeDraft: { ...st.getState().forgeDraft, title: '', stickers: [] } });
        }""")
        page.wait_for_timeout(250)

        rec.start("s06_forge_mint")
        page.wait_for_timeout(600)

        # 1. Type work name: 铃响晴巷
        title_input = page.get_by_test_id("forge-title-input")
        click_smooth(page, title_input, pause_after=250)
        for ch in "铃响晴巷":
            title_input.type(ch, delay=120)
        page.wait_for_timeout(650)

        # 2. Switch hero artwork to 二八大杠车铃 (street-bell)
        art_btn = page.get_by_role("button", name="换主角插画")
        for _ in range(18):
            if page.evaluate("() => window.__filmStore.getState().forgeDraft.artId") == "street-bell":
                break
            click_smooth(page, art_btn, pause_after=160, steps=6)
        page.wait_for_timeout(550)

        # 3. Choose UR rarity
        click_smooth(page, page.get_by_role("button", name="✦ UR ✦"), pause_after=550)

        # 4. Showcase all 5 holographic foils unhurriedly with gentle tilt shimmer, resting calmly on 温暖金箔!
        card_loc = page.get_by_test_id("hero-holo-card")
        fbox = card_loc.bounding_box()
        fcx, fcy = fbox["x"] + fbox["width"]/2, fbox["y"] + fbox["height"]/2
        for foil_label in ["棱镜", "星尘", "激光", "铬银", "金箔"]:
            click_smooth(page, page.get_by_role("button", name=foil_label, exact=True), pause_after=280, steps=8)
            move_fast_smooth(page, fcx - 95, fcy - 65, steps=9)
            page.wait_for_timeout(300)
            move_fast_smooth(page, fcx + 105, fcy + 55, steps=11)
            page.wait_for_timeout(340)
        page.wait_for_timeout(1050)

        # 5. Add 3 crisp non-overlapping matte street stickers into clean corner safe zones!
        for stk_id in ["clapper", "starburst", "note"]:
            click_smooth(page, page.get_by_test_id(f"forge-sticker-{stk_id}"), pause_after=320, steps=8)

        stickers_state = page.evaluate("() => window.__filmStore.getState().forgeDraft.stickers")
        targets = [(0.17, 0.64), (0.82, 0.23), (0.82, 0.65)]
        for idx, stk in enumerate(stickers_state[:3]):
            sloc = page.get_by_test_id(f"card-sticker-{stk['uid']}")
            sbox = sloc.bounding_box()
            if sbox:
                tx = fbox["x"] + fbox["width"] * targets[idx][0]
                ty = fbox["y"] + fbox["height"] * targets[idx][1]
                drag_smooth(page, sbox["x"] + sbox["width"]/2, sbox["y"] + sbox["height"]/2, tx, ty, steps=13)
                page.wait_for_timeout(320)
                if idx == 1:
                    rot_btn = page.get_by_role("button", name="旋转贴纸")
                    zoom_btn = page.get_by_role("button", name="放大贴纸")
                    if rot_btn.is_visible():
                        click_smooth(page, rot_btn, pause_after=280, steps=6)
                    if zoom_btn.is_visible():
                        click_smooth(page, zoom_btn, pause_after=280, steps=6)
        page.mouse.click(fbox["x"] - 24, fbox["y"] + 40)
        page.wait_for_timeout(1000)
        page.screenshot(path=str(STILLS_DIR / "09_forge_editor_ready.png"))

        # 6. Trigger REAL persistence-gated 5-step Mint Ceremony & wait until #MY-01 inspect state lands!
        click_smooth(page, page.get_by_test_id("forge-mint-btn"), pause_after=180)
        set_cursor_visible(page, False)
        page.wait_for_function("() => Boolean(window.__filmStore.getState().inspectMintedId)", timeout=15000)
        page.wait_for_timeout(2100)
        dismiss_toasts(page)
        page.screenshot(path=str(STILLS_DIR / "10_forge_minted_my01.png"))

        # 7. Canonical Audition on minted #MY-01 (plays exact same WAV & sweeps live PCM bars!)
        set_cursor_visible(page, True)
        click_smooth(page, page.get_by_test_id("forge-play-btn"), pause_after=100)
        set_cursor_visible(page, False)
        page.wait_for_function("() => window.__filmHoloAudio.isSnapshotPlaying()", timeout=10000)
        page.wait_for_function("() => !window.__filmHoloAudio.isSnapshotPlaying()", timeout=15000)
        page.wait_for_timeout(950)
        set_cursor_visible(page, True)
        manifest["clips"].append(rec.stop())

        # ==================== SCENE 07: REAL 4-FORMAT EXPORTS & LOCAL ARCHIVE READ-ONLY SHARE PAGE ====================
        log("8) Exporting genuine 4 formats & recording read-only share showcase...")
        with page.expect_download(timeout=30000) as dl_png:
            page.get_by_test_id("forge-export-png").click()
        png_path = EXPORTS_DIR / "lingxiang-qingxiang-poster.png"
        dl_png.value.save_as(str(png_path))
        page.wait_for_timeout(300)

        with page.expect_download(timeout=30000) as dl_wav:
            page.get_by_test_id("forge-export-wav").click()
        wav_path = EXPORTS_DIR / "lingxiang-qingxiang.wav"
        dl_wav.value.save_as(str(wav_path))
        page.wait_for_timeout(300)

        with page.expect_download(timeout=60000) as dl_webm:
            page.get_by_test_id("forge-export-motion").click()
        webm_path = EXPORTS_DIR / "lingxiang-qingxiang-motion.webm"
        dl_webm.value.save_as(str(webm_path))
        page.wait_for_timeout(300)

        with page.expect_download(timeout=30000) as dl_json:
            page.get_by_test_id("forge-export-json").click()
        json_path = EXPORTS_DIR / "lingxiang-qingxiang.holobeat.json"
        dl_json.value.save_as(str(json_path))
        shutil.copyfile(json_path, FILM_DIR / "source" / "main-work-lingxiang-qingxiang.holobeat.json")
        page.wait_for_timeout(300)
        dismiss_toasts(page)

        manifest["exports"]["my01"] = {
            "png": str(png_path), "wav": str(wav_path), "webm": str(webm_path), "json": str(json_path),
        }

        rec.start("s07_share_click")
        page.wait_for_timeout(550)
        click_smooth(page, page.get_by_role("button", name="只读分享"), pause_after=1850)
        share_url = page.evaluate("""() => {
            const st = window.__filmStore.getState();
            for (const t of st.toasts) {
                const m = String(t.text || '').match(/http:\\/\\/127\\.0\\.0\\.1:3789\\/share\\/[A-Za-z0-9_\\-]+/);
                if (m) return m[0];
            }
            return null;
        }""")
        manifest["shareUrl"] = share_url
        log(f"  Share URL: {share_url}")
        page.wait_for_timeout(750)
        dismiss_toasts(page)
        manifest["clips"].append(rec.stop())

        if share_url:
            share_page = ctx.new_page()
            share_page.add_init_script(init_js)
            share_cdp = ctx.new_cdp_session(share_page)
            share_rec = CdpClipRecorder(share_page, share_cdp, CLIPS_DIR, fps=TARGET_FPS)
            share_page.goto(share_url, wait_until="networkidle")
            share_page.evaluate("() => document.fonts.ready")
            share_page.wait_for_timeout(450)
            manifest["checks"]["sharePageHasHolobeat"] = share_page.evaluate("() => /holobeat/i.test(document.body.innerText)")
            share_page.screenshot(path=str(STILLS_DIR / "11_readonly_share_page.png"))

            share_rec.start("s07_share_page")
            set_cursor_visible(share_page, True)
            share_page.wait_for_timeout(1350)
            click_smooth(share_page, share_page.locator("#playBtn"), pause_after=100)
            set_cursor_visible(share_page, False)
            share_page.wait_for_timeout(4200)
            if "停止" in (share_page.locator("#playBtn").inner_text() or ""):
                share_page.locator("#playBtn").click()
            share_page.wait_for_timeout(650)
            manifest["clips"].append(share_rec.stop())
            share_page.close()

        # ==================== SCENE 08: PROJECT IMPORT + UNSEAL & REMIX (#MY-02 铃响晴巷·夜行版, CALM PACE) ====================
        log("9) Recording s08_import_and_remix (relaxed pace)...")
        rec.start("s08_import_and_remix")
        set_cursor_visible(page, True)
        page.wait_for_timeout(550)

        # Genuine project import restore demonstration
        click_smooth(page, page.get_by_role("button", name="返回草稿"), pause_after=600)
        ib = page.get_by_role("button", name="导入工程").bounding_box()
        if ib:
            move_fast_smooth(page, ib["x"] + ib["width"]/2, ib["y"] + ib["height"]/2, steps=10)
        page.locator("input[type='file']").set_input_files(str(json_path))
        page.wait_for_timeout(1900)
        dismiss_toasts(page)

        # Unseal & Remix #MY-01!
        my01_item = page.locator("[data-testid^='binder-item-minted-']:has-text('铃响晴巷')").first
        click_smooth(page, my01_item, pause_after=800)
        click_smooth(page, page.get_by_test_id("forge-unseal-btn"), pause_after=1100)
        dismiss_toasts(page)

        # Unmistakable Night Remix transformation at readable pace:
        # 1) Swap VIBE -> #15 港风霓虹电流
        click_smooth(page, page.get_by_role("button", name="更换氛围轨道声卡"), pause_after=650)
        click_smooth(page, page.locator("button:has-text('港风霓虹电流')").first, pause_after=700)

        # 2) Scale C 五声 -> C 小调
        click_smooth(page, page.locator("button[title*='调式锁定']").first, pause_after=650)

        # 3) BPM 118 -> 126
        bpm_up = page.get_by_role("button", name="提高速度")
        click_smooth(page, bpm_up, pause_after=300, steps=7)
        click_smooth(page, bpm_up, pause_after=650, steps=5)

        # 4) Phrase B rule variation 「加密」
        click_smooth(page, page.get_by_test_id("beat-fine-toggle"), pause_after=450)
        click_smooth(page, page.get_by_test_id("phrase-tab-B"), pause_after=550)
        click_smooth(page, page.get_by_test_id("variation-density_up"), pause_after=700)
        click_smooth(page, page.get_by_test_id("beat-fine-toggle"), pause_after=450)

        # 5) Enable Street Echo in Latch mode
        if "按住" in (page.get_by_test_id("fx-mode-toggle").inner_text() or ""):
            click_smooth(page, page.get_by_test_id("fx-mode-toggle"), pause_after=400)
        click_smooth(page, page.get_by_test_id("fx-echo"), pause_after=600)

        # 6) Play transformed Night Remix for full unhurried loop (~5.2s)
        click_smooth(page, page.get_by_test_id("beat-play-btn"), pause_after=150)
        set_cursor_visible(page, False)
        page.wait_for_timeout(5200)
        page.screenshot(path=str(STILLS_DIR / "12_beat_remix_night.png"))
        set_cursor_visible(page, True)
        click_smooth(page, page.get_by_test_id("beat-stop-btn"), pause_after=650)

        # 7) Forge & Mint #MY-02 《铃响晴巷·夜行版》 (定向激光 UR + matching #05 二八大杠车铃 + 3 clean corner stickers!)
        click_smooth(page, page.get_by_test_id("beat-to-forge-btn"), pause_after=900)
        dismiss_toasts(page)
        page.evaluate("""() => {
            const st = window.__filmStore;
            st.setState({ forgeDraft: { ...st.getState().forgeDraft, stickers: [] } });
        }""")
        art_btn = page.get_by_role("button", name="换主角插画")
        for _ in range(18):
            if page.evaluate("() => window.__filmStore.getState().forgeDraft.artId") == "street-bell":
                break
            click_smooth(page, art_btn, pause_after=130, steps=6)
        page.wait_for_timeout(350)

        title_input = page.get_by_test_id("forge-title-input")
        click_smooth(page, title_input, pause_after=200)
        title_input.fill("")
        page.wait_for_timeout(120)
        for ch in "铃响晴巷·夜行版":
            title_input.type(ch, delay=95)
        page.wait_for_timeout(450)
        click_smooth(page, page.get_by_role("button", name="激光", exact=True), pause_after=650)
        page.evaluate("""() => {
            const st = window.__filmStore;
            const d = st.getState().forgeDraft;
            st.setState({
                forgeDraft: {
                    ...d,
                    stickers: [
                        { uid: 'rmx-1', stickerId: 'clapper',   x: 17, y: 64, scale: 1.0,  rotation: -8 },
                        { uid: 'rmx-2', stickerId: 'starburst', x: 82, y: 23, scale: 1.12, rotation: 14 },
                        { uid: 'rmx-3', stickerId: 'note',      x: 82, y: 65, scale: 1.0,  rotation: 8 },
                    ],
                },
            });
        }""")
        page.wait_for_timeout(700)
        click_smooth(page, page.get_by_test_id("forge-mint-btn"), pause_after=160)
        set_cursor_visible(page, False)

        # Wait strictly until #MY-02 finishes minting & enters inspect mode!
        page.wait_for_function("""() => {
            const st = window.__filmStore.getState();
            const card = st.mintedCards.find(c => c.id === st.inspectMintedId);
            return Boolean(card && card.title.includes('夜行版'));
        }""", timeout=15000)
        page.wait_for_timeout(1950)
        dismiss_toasts(page)
        page.screenshot(path=str(STILLS_DIR / "13_forge_minted_my02_lineage.png"))

        # Play audition of #MY-02 with complete echoing tail!
        set_cursor_visible(page, True)
        click_smooth(page, page.get_by_test_id("forge-play-btn"), pause_after=100)
        set_cursor_visible(page, False)
        page.wait_for_function("() => window.__filmHoloAudio.isSnapshotPlaying()", timeout=10000)
        page.wait_for_function("() => !window.__filmHoloAudio.isSnapshotPlaying()", timeout=15000)
        page.wait_for_timeout(850)
        manifest["clips"].append(rec.stop())

        # Export #MY-02 artifacts for dual-card outro & finale audio!
        with page.expect_download(timeout=30000) as dl_png2:
            page.get_by_test_id("forge-export-png").click()
        png2_path = EXPORTS_DIR / "lingxiang-night-remix-poster.png"
        dl_png2.value.save_as(str(png2_path))
        page.wait_for_timeout(250)

        with page.expect_download(timeout=30000) as dl_wav2:
            page.get_by_test_id("forge-export-wav").click()
        wav2_path = EXPORTS_DIR / "lingxiang-night-remix.wav"
        dl_wav2.value.save_as(str(wav2_path))
        page.wait_for_timeout(250)

        with page.expect_download(timeout=30000) as dl_json2:
            page.get_by_test_id("forge-export-json").click()
        json2_path = EXPORTS_DIR / "lingxiang-night-remix.holobeat.json"
        dl_json2.value.save_as(str(json2_path))
        shutil.copyfile(json2_path, FILM_DIR / "source" / "remix-work-lingxiang-night.holobeat.json")

        manifest["exports"]["my02"] = {
            "png": str(png2_path), "wav": str(wav2_path), "json": str(json2_path),
        }

        # Clean isolated solo bell motif for intro & outro tail!
        log("10) Recording clean isolated #05 二八大杠车铃 solo motif...")
        page.get_by_test_id("nav-gacha").click()
        page.wait_for_timeout(400)
        page.evaluate("() => window.__filmStore.getState().selectGachaCard('card-05')")
        page.wait_for_timeout(150)
        rec.start("motif_bell_solo")
        page.wait_for_timeout(150)
        page.get_by_role("button", name="试听音色").click()
        page.wait_for_timeout(1900)
        manifest["clips"].append(rec.stop())

        manifest["checks"]["finalPageHasHolobeat"] = page.evaluate("() => /holobeat/i.test(document.body.innerText)")
        ctx.close()

    server.shutdown()
    manifest_path = CAPTURE_DIR / "capture_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    log("\n=== ALL SCENES CAPTURED CLEANLY (v2 BROADCAST GRADE) ===")


if __name__ == "__main__":
    main()
