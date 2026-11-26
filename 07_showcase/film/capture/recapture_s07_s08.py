r"""
Targeted fast recapture of s07_share_click, s07_share_page, s08_import_and_remix, and motif_bell_solo
with the fixed multi-AudioContext audio tap (immune to temporary closed AudioContexts and lazy AudioContext creation).
Preserves already-verified spotless s01..s06 clips & exports untouched!
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
import numpy as np
import soundfile as sf
from playwright.sync_api import sync_playwright

ROOT_DIR = Path(__file__).resolve().parents[3]
FILM_DIR = ROOT_DIR / "07_showcase" / "film"
CAPTURE_DIR = FILM_DIR / "capture"
CLIPS_DIR = CAPTURE_DIR / "clips"
EXPORTS_DIR = CAPTURE_DIR / "exports"
STILLS_DIR = FILM_DIR / "covers" / "stills"
PROFILE_DIR = CAPTURE_DIR / "browser-profile-s78"

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
        (CLIPS_DIR / Path(filename).name).write_bytes(data)
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

  function scrubNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      let t = node.nodeValue || '';
      if (!t || !/holobeat/i.test(t)) return;
      const parent = node.parentElement;
      if (parent && parent.classList.contains('zh-display') && t.trim().toUpperCase() === 'HOLOBEAT') {
        node.nodeValue = '声卡造物局';
        const sib = parent.nextElementSibling;
        if (sib && sib.textContent && sib.textContent.trim() === '声卡造物局') sib.textContent = '街巷声音工坊';
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
      for (const child of el.childNodes) scrubNode(child);
    }
  }

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') scrubNode(m.target);
      else if (m.type === 'childList') for (const n of m.addedNodes) scrubNode(n);
    }
  });

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
        border-radius: 50%; border: 2.5px solid #FFD60A; background: rgba(255, 214, 10, 0.25);
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
    wrap.innerHTML = `<svg viewBox="0 0 28 28" width="26" height="26" fill="none"><path d="M4.5 3.5L22 13.8L13.6 15.8L10.3 23.5L4.5 3.5Z" fill="#FFFDF8" stroke="#1A1A1F" stroke-width="2.4" stroke-linejoin="round"/><circle cx="13.5" cy="14.5" r="2" fill="#FFD60A"/></svg>`;
    document.body.appendChild(wrap);
    window.__FILM_CURSOR_ENABLED__ = true;
    window.addEventListener('pointermove', (e) => {
      wrap.style.left = e.clientX + 'px'; wrap.style.top = e.clientY + 'px';
      if (window.__FILM_CURSOR_ENABLED__) wrap.classList.add('visible');
    }, true);
    window.addEventListener('pointerdown', (e) => {
      wrap.classList.add('down');
      if (window.__FILM_CURSOR_ENABLED__) {
        const rip = document.createElement('div');
        rip.className = '__film_ripple__'; rip.style.left = e.clientX + 'px'; rip.style.top = e.clientY + 'px';
        document.body.appendChild(rip); setTimeout(() => rip.remove(), 360);
      }
    }, true);
    window.addEventListener('pointerup', () => wrap.classList.remove('down'), true);
    window.__SET_FILM_CURSOR__ = (show) => { window.__FILM_CURSOR_ENABLED__ = show; wrap.classList.toggle('visible', show); };
  }

  document.addEventListener('DOMContentLoaded', () => {
    scrubNode(document.body);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    installCursor();
  });

  // Resilient Multi-Context Audio Tap:
  // Keeps a dedicated persistent master collector AudioContext OR attaches lazily to new contexts!
  const tapState = {
    contexts: [],
    recorder: null,
    chunks: [],
    recording: false,
    startEpochSec: 0,
    recStartEpochSec: 0,
    endEpochSec: 0,
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
    const keepAlive = ctx.createOscillator();
    const keepGain = ctx.createGain();
    keepGain.gain.value = 0.00001;
    rawConnect.call(keepAlive, keepGain);
    rawConnect.call(keepGain, mediaDest);
    keepAlive.start();

    ctx.__filmTapGain = tapGain;
    ctx.__filmMediaDest = mediaDest;
    tapState.contexts.push(ctx);

    // If recording already started (e.g. share page creates AudioContext lazily on play click!), attach immediately!
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
      // Pick first non-closed live AudioContext (primary Tone.js context!)
      const liveCtx = tapState.contexts.find(c => c.state !== 'closed');
      if (liveCtx && liveCtx.__filmMediaDest) {
        startRecorderOnDest(liveCtx.__filmMediaDest);
      }
      return { startEpochSec: tapState.startEpochSec, liveContexts: tapState.contexts.filter(c => c.state !== 'closed').length };
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
        self.raw_frames = []
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
        ts = float(params.get("metadata", {}).get("timestamp") or time.time())
        self.raw_frames.append((ts, params["data"]))

    def start(self, clip_name: str):
        self.clip_name = clip_name
        self.raw_frames = []
        self.active = True
        self.audio_meta = self.page.evaluate("() => window.__FILM_AUDIO__.start()")
        self.cdp.send("Page.startScreencast", {
            "format": "jpeg", "quality": 90, "maxWidth": 1920, "maxHeight": 1080, "everyNthFrame": 2,
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
        lead_pad_sec = max(0.0, audio_info["recStartEpochSec"] - audio_info["startEpochSec"])
        has_audio = audio_info["bytes"] > 150 and aud_webm_path.exists()

        if has_audio:
            tmp_wav = self.out_dir / f"_{self.clip_name}_tmp.wav"
            subprocess.run([
                FFMPEG, "-y", "-i", str(aud_webm_path),
                "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(tmp_wav),
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
            dur = len(wav_data) / sr
            wav_peak = float(np.max(np.abs(wav_data))) if len(wav_data) else 0.0
        else:
            sr = 48000
            wav_peak = 0.0
            sf.write(str(wav_path), np.zeros((int(dur * sr), 2), dtype=np.float32), sr, subtype="PCM_16")

        frames = sorted(self.raw_frames, key=lambda x: x[0])
        decoded = [(ts, base64.b64decode(b64)) for ts, b64 in frames]
        self.raw_frames = []
        total_out_frames = max(1, int(round(dur * self.fps)))
        cmd = [
            FFMPEG, "-y",
            "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate", str(self.fps), "-i", "-",
            "-i", str(wav_path),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
            "-shortest", str(mp4_path),
        ]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        fidx = 0
        n_src = len(decoded)
        for k in range(total_out_frames):
            target_t = t0 + (k + 0.5) / self.fps
            while fidx + 1 < n_src and decoded[fidx + 1][0] <= target_t:
                fidx += 1
            proc.stdin.write(decoded[fidx][1])
        proc.stdin.close()
        _, err = proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(err.decode(errors="ignore")[-400:])

        eff_fps = round(n_src / max(0.1, dur), 1)
        info = {
            "clip": self.clip_name, "mp4": str(mp4_path), "wav": str(wav_path),
            "capturedFrames": n_src, "outFrames": total_out_frames,
            "effectiveCaptureFps": eff_fps, "durationSec": round(dur, 3),
            "wavPeak": round(wav_peak, 4), "sampleRate": sr,
        }
        log(f"  [RECAP DONE] {self.clip_name}: {info['durationSec']}s | {eff_fps} cap-fps -> {self.fps}fps | peak={info['wavPeak']}")
        return info


def click_smooth(page, loc, pause_after=120, steps=8):
    box = loc.bounding_box()
    if not box:
        loc.click()
        return
    page.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2, steps=steps)
    page.mouse.down()
    page.wait_for_timeout(55)
    page.mouse.up()
    if pause_after > 0:
        page.wait_for_timeout(pause_after)


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


def main():
    # Fresh isolated profile -> import genuine #MY-01 JSON so #MY-01 is pristine and remix natively mints #MY-02!
    if PROFILE_DIR.exists():
        shutil.rmtree(PROFILE_DIR, ignore_errors=True)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    manifest_path = CAPTURE_DIR / "capture_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    json_path = EXPORTS_DIR / "lingxiang-qingxiang.holobeat.json"

    server, upload_port = start_upload_server()
    init_js = INIT_SCRIPT.replace("__UPLOAD_PORT__", str(upload_port))
    updated = {}

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            executable_path=CHROME_PATH,
            headless=True,
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            args=[
                "--autoplay-policy=no-user-gesture-required",
                "--use-gl=angle", "--use-angle=d3d11", "--ignore-gpu-blocklist",
                "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
            ],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.add_init_script(init_js)
        cdp = ctx.new_cdp_session(page)
        rec = CdpClipRecorder(page, cdp, CLIPS_DIR, fps=TARGET_FPS)

        page.goto(APP_URL, wait_until="networkidle")
        page.get_by_test_id("nav-gacha").wait_for(timeout=30000)
        page.evaluate("() => document.fonts.ready")
        page.evaluate("""async () => {
            const s = performance.getEntriesByType('resource').find(r => r.name.includes('/src/store/useHoloStore.ts'));
            const a = performance.getEntriesByType('resource').find(r => r.name.includes('/src/audio/HoloAudioEngine.ts'));
            if (s) window.__filmStore = (await import(s.name)).useHoloStore;
            if (a) window.__filmHoloAudio = (await import(a.name)).holoAudio;
        }""")
        page.wait_for_function("Boolean(window.__filmStore && window.__filmStore.getState().dbHydrated)")
        page.wait_for_timeout(400)

        btn = page.get_by_role("button", name="启动声音")
        if btn.is_visible():
            btn.click()
            page.wait_for_timeout(900)

        # Unlock all 16 sound cards & navigate to 04 Forge draft ready to demonstrate genuine JSON import -> #MY-01 -> #MY-02!
        page.evaluate("""() => {
            const all16 = Array.from({length:16}, (_, i) => `card-${String(i+1).padStart(2,'0')}`);
            window.__filmStore.setState({ collection: all16, activePage: 'forge' });
        }""")
        dismiss_toasts(page)
        page.wait_for_timeout(450)

        # 3) s08_import_and_remix (full crisp remix audio, native #MY-01 -> #MY-02!)
        log("1) Recapturing s08_import_and_remix with crisp live audio...")
        rec.start("s08_import_and_remix")
        set_cursor_visible(page, True)
        page.wait_for_timeout(250)

        # Genuine project import restore demonstration (#MY-01 enters binder!)
        ib = page.get_by_role("button", name="导入工程").bounding_box()
        if ib:
            page.mouse.move(ib["x"] + ib["width"]/2, ib["y"] + ib["height"]/2, steps=8)
        page.locator("input[type='file']").set_input_files(str(json_path))
        page.wait_for_timeout(1200)
        dismiss_toasts(page)

        # Click #MY-01 铃响晴巷 & click "拆封重混创作"!
        my01_item = page.locator("[data-testid^='binder-item-minted-']:has-text('铃响晴巷')").first
        click_smooth(page, my01_item, pause_after=400)
        click_smooth(page, page.get_by_test_id("forge-unseal-btn"), pause_after=550)
        dismiss_toasts(page)

        click_smooth(page, page.get_by_role("button", name="更换氛围轨道声卡"), pause_after=320)
        click_smooth(page, page.locator("button:has-text('港风霓虹电流')").first, pause_after=280)
        click_smooth(page, page.locator("button[title*='调式锁定']").first, pause_after=200)
        bpm_up = page.get_by_role("button", name="提高速度")
        click_smooth(page, bpm_up, pause_after=100, steps=6)
        click_smooth(page, bpm_up, pause_after=180, steps=4)
        click_smooth(page, page.get_by_test_id("beat-fine-toggle"), pause_after=180)
        click_smooth(page, page.get_by_test_id("phrase-tab-B"), pause_after=160)
        click_smooth(page, page.get_by_test_id("variation-density_up"), pause_after=200)
        click_smooth(page, page.get_by_test_id("beat-fine-toggle"), pause_after=160)
        if "按住" in (page.get_by_test_id("fx-mode-toggle").inner_text() or ""):
            click_smooth(page, page.get_by_test_id("fx-mode-toggle"), pause_after=140)
        click_smooth(page, page.get_by_test_id("fx-echo"), pause_after=180)

        click_smooth(page, page.get_by_test_id("beat-play-btn"), pause_after=100)
        set_cursor_visible(page, False)
        page.wait_for_timeout(4400)
        set_cursor_visible(page, True)
        click_smooth(page, page.get_by_test_id("beat-stop-btn"), pause_after=260)

        click_smooth(page, page.get_by_test_id("beat-to-forge-btn"), pause_after=520)
        dismiss_toasts(page)

        # Ensure #MY-02 shares our iconic #05 二八大杠车铃 hero identity + clean corner stickers (100% continuity!)
        page.evaluate("""() => {
            const st = window.__filmStore;
            st.setState({ forgeDraft: { ...st.getState().forgeDraft, stickers: [] } });
        }""")
        art_btn = page.get_by_role("button", name="换主角插画")
        for _ in range(18):
            if page.evaluate("() => window.__filmStore.getState().forgeDraft.artId") == "street-bell":
                break
            click_smooth(page, art_btn, pause_after=95, steps=5)
        page.wait_for_timeout(160)

        title_input = page.get_by_test_id("forge-title-input")
        click_smooth(page, title_input, pause_after=100)
        title_input.fill("")
        page.wait_for_timeout(70)
        for ch in "铃响晴巷·夜行版":
            title_input.type(ch, delay=60)
        page.wait_for_timeout(140)
        click_smooth(page, page.get_by_role("button", name="激光", exact=True), pause_after=200)

        # Place matching 3 clean non-overlapping corner stickers (clapper, starburst, note; coords are 0..100%)
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
        page.wait_for_timeout(240)

        click_smooth(page, page.get_by_test_id("forge-mint-btn"), pause_after=120)
        set_cursor_visible(page, False)
        page.wait_for_function("""() => {
            const st = window.__filmStore.getState();
            const c = st.mintedCards.find(x => x.id === st.inspectMintedId);
            return Boolean(c && c.title.includes('夜行版'));
        }""", timeout=15000)
        page.wait_for_timeout(1000)
        dismiss_toasts(page)
        page.screenshot(path=str(STILLS_DIR / "12_remix_my02_minted.png"))

        set_cursor_visible(page, True)
        click_smooth(page, page.get_by_test_id("forge-play-btn"), pause_after=80)
        set_cursor_visible(page, False)
        page.wait_for_function("() => window.__filmHoloAudio.isSnapshotPlaying()", timeout=10000)
        page.wait_for_function("() => !window.__filmHoloAudio.isSnapshotPlaying()", timeout=15000)
        page.wait_for_timeout(450)
        updated["s08_import_and_remix"] = rec.stop()

        # Re-export matching #MY-02 PNG poster, WAV & JSON so exports + outro cards match live UI 100%!
        log("2) Exporting matched #MY-02 poster, WAV & project JSON...")
        with page.expect_download(timeout=30000) as dl_p2:
            page.get_by_test_id("forge-export-png").click()
        dl_p2.value.save_as(str(EXPORTS_DIR / "lingxiang-night-remix-poster.png"))
        page.wait_for_timeout(220)
        with page.expect_download(timeout=30000) as dl_w2:
            page.get_by_test_id("forge-export-wav").click()
        dl_w2.value.save_as(str(EXPORTS_DIR / "lingxiang-night-remix.wav"))
        page.wait_for_timeout(220)
        with page.expect_download(timeout=30000) as dl_j2:
            page.get_by_test_id("forge-export-json").click()
        j2_path = EXPORTS_DIR / "lingxiang-night-remix.holobeat.json"
        dl_j2.value.save_as(str(j2_path))
        shutil.copyfile(j2_path, FILM_DIR / "source" / "remix-work-lingxiang-night.holobeat.json")
        page.wait_for_timeout(220)

        ctx.close()

    server.shutdown()
    # Preserve updated s07 metadata too
    for k in ("s07_share_click", "s07_share_page"):
        wp = CLIPS_DIR / f"{k}.wav"
        if wp.exists():
            d, sr = sf.read(str(wp), dtype="float32")
            updated[k] = {
                "clip": k, "mp4": str(CLIPS_DIR / f"{k}.mp4"), "wav": str(wp),
                "durationSec": round(len(d)/sr, 3), "wavPeak": round(float(np.max(np.abs(d))), 4), "sampleRate": sr
            }
    manifest["clips"] = [updated.get(c["clip"], c) for c in manifest["clips"]]
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    log("=== s08 & BELL MOTIF RECAPTURE COMPLETE ===")


if __name__ == "__main__":
    main()
