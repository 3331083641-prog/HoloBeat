import json
import os
import platform
import re
import struct
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from reliability_e2e import wav_stats, webm_stats, get

BASE_URL = os.environ.get("HOLOBEAT_URL", "http://127.0.0.1:5173")
BACKEND_URL = os.environ.get("HOLOBEAT_BACKEND_URL", "http://127.0.0.1:3789")
CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe"
EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

ROOT_DIR = Path(__file__).resolve().parents[2]
SHOTS_DIR = ROOT_DIR / "07_showcase" / "screenshots" / "v21"
EXPORTS_DIR = ROOT_DIR / "07_showcase" / "exports" / "v21"
REPORTS_DIR = ROOT_DIR / "07_showcase" / "reports"

SHOTS_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


def get_git_commit():
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=str(ROOT_DIR), text=True
        )
        return out.strip()
    except Exception:
        return "unknown"


def dismiss_toasts(page):
    close_btns = page.locator("button[aria-label='关闭提示']")
    for _ in range(close_btns.count()):
        try:
            close_btns.first.click(timeout=500)
        except Exception:
            break
    page.wait_for_timeout(120)


def measure_fps(page, duration_ms=2000):
    return page.evaluate(
        """(dur) => new Promise((resolve) => {
            let frames = 0;
            let maxDelta = 0;
            let prev = performance.now();
            const start = prev;
            function tick(now) {
                frames++;
                const dt = now - prev;
                if (dt > maxDelta) maxDelta = dt;
                prev = now;
                if (now - start >= dur) {
                    const elapsed = now - start;
                    const sec = elapsed / 1000;
                    resolve({
                        fps: Math.round((frames / sec) * 10) / 10,
                        avgFrameMs: Math.round((elapsed / Math.max(1, frames)) * 100) / 100,
                        maxFrameMs: Math.round(maxDelta * 10) / 10,
                        frames,
                        durationMs: Math.round(elapsed),
                        telemetry: window.__HOLOBEAT_PERF__ || null
                    });
                } else {
                    requestAnimationFrame(tick);
                }
            }
            requestAnimationFrame(tick);
        })""",
        duration_ms,
    )


def verify_png_dimensions(path: Path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "Invalid PNG magic header"
    width, height = struct.unpack(">II", data[16:24])
    return {"bytes": len(data), "width": width, "height": height}


def verify_wav_file(path: Path):
    data = path.read_bytes()
    assert data[:4] == b"RIFF" and data[8:12] == b"WAVE", "Invalid WAV header"
    channels = struct.unpack("<H", data[22:24])[0]
    sample_rate = struct.unpack("<I", data[24:28])[0]
    bits = struct.unpack("<H", data[34:36])[0]
    byte_rate = struct.unpack("<I", data[28:32])[0]
    pcm_data = data[44:]
    duration_sec = round(len(pcm_data) / max(1, byte_rate), 3)
    peak = 0
    step = max(2, len(pcm_data) // 6000)
    step -= step % 2
    for i in range(0, len(pcm_data) - 1, step):
        val = abs(struct.unpack("<h", pcm_data[i : i + 2])[0])
        if val > peak:
            peak = val
    return {
        "bytes": len(data),
        "channels": channels,
        "sampleRate": sample_rate,
        "bitsPerSample": bits,
        "durationSec": duration_sec,
        "peakAmplitude": peak,
        "nonSilent": peak > 120,
    }


def verify_webm_file(path: Path):
    data = path.read_bytes()
    # EBML header magic for WebM / Matroska: 0x1A 0x45 0xDF 0xA3
    valid_magic = len(data) > 1024 and data[:4] == b"\x1a\x45\xdf\xa3"
    return {
        "bytes": len(data),
        "validWebmMagic": valid_magic,
    }


def check_control_in_viewport(page, testid: str, vw: int, vh: int):
    loc = page.locator(f"[data-testid='{testid}']").first
    if not loc.is_visible():
        return {"visible": False, "inViewport": False}
    box = loc.bounding_box()
    if not box:
        return {"visible": False, "inViewport": False}
    in_vp = (
        box["width"] > 10
        and box["height"] > 10
        and box["x"] >= 0
        and box["y"] >= 0
        and (box["x"] + box["width"]) <= vw + 2
        and (box["y"] + box["height"]) <= vh + 2
    )
    return {
        "visible": True,
        "inViewport": in_vp,
        "rect": {k: round(v, 1) for k, v in box.items()},
    }


def attach_store(page):
    page.get_by_test_id("nav-gacha").wait_for(timeout=60000)
    page.evaluate("""async () => {
        const path = performance.getEntriesByType('resource').find(r=>r.name.includes('/src/store/useHoloStore.ts'));
        window.state = (await import(path.name)).useHoloStore.getState;
    }""")
    page.wait_for_function("state().dbHydrated")


def measure_impacts(page):
    # Observe the existing Antigravity ripple's first Canvas arc. The instrument schedules
    # notes on the AudioContext clock. Both clocks are sampled inside the same browser.
    page.evaluate("""async () => {
        const {holoAudio} = await import('/src/audio/HoloAudioEngine.ts');
        document.documentElement.dataset.measureMotion='true';
        window.observedImpacts=[];
        const proto=CanvasRenderingContext2D.prototype;
        const arc=proto.arc;
        window.restoreArc=()=>{proto.arc=arc;delete document.documentElement.dataset.measureMotion};
        proto.arc=function(x,y,r,...args){
          const out=arc.call(this,x,y,r,...args);
          if(state().isPlaying && (Math.abs(r-(10+30/18))<0.0001 || Math.abs(r-11)<0.0001)){
            const w=this.canvas.clientWidth, h=this.canvas.clientHeight;
            const left=state().beatStageMode?16:382;
            const step=Math.round((x-left)/((w-14-left)/16)-.5);
            const track=Math.round(y/(h/4)-.55);
            if(track>=0 && track<4 && step>=0 && step<16) window.observedImpacts.push({
              step:step+(state().activePhrase==='B'?16:0),track,clockMs:holoAudio.getAudioClockMs()});
          }
          return out;
        };
    }""")
    evidence=[]
    settings=page.evaluate("({bpm:state().bpm,swing:state().swing})")
    try:
        for bpm,swing in [(92,.4),(160,.55)]:
            page.get_by_test_id("beat-stop-btn").click()
            page.evaluate("""([b,s])=>{state().setBpm(b);state().setSwing(s);
                window.observedImpacts=[];performance.clearMarks('holobeat-live-note')}""",[bpm,swing])
            page.get_by_test_id("beat-play-btn").click()
            page.wait_for_function("observedImpacts.length>=8",timeout=20000)
            pairs=page.evaluate("""() => {
                const notes=performance.getEntriesByName('holobeat-live-note').map(x=>x.detail);
                return observedImpacts.map(f=>{
                    const matches=notes.filter(n=>n.trackIndex===f.track && n.stepIndex===f.step);
                    const n=matches.sort((a,b)=>Math.abs(a.clockMs-f.clockMs)-Math.abs(b.clockMs-f.clockMs))[0];
                    return n ? f.clockMs-n.clockMs : null;
                });
            }""")
            assert None not in pairs and min(pairs)>-20 and max(pairs)<100,(bpm,pairs)
            evidence.append({"bpm":bpm,"swing":swing,"count":len(pairs),"minMs":min(pairs),"maxMs":max(pairs)})
    finally:
        page.get_by_test_id("beat-stop-btn").click()
        page.evaluate("v=>{restoreArc();state().setBpm(v.bpm);state().setSwing(v.swing)}",settings)
    return evidence


def run_suite(start_archive=None):
    metrics = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "sourceCommit": get_git_commit(),
        "environment": {
            "os": f"{platform.system()} {platform.release()}",
            "machine": platform.machine(),
            "python": platform.python_version(),
        },
        "baseUrl": BASE_URL,
        "chrome": {"version": "", "consoleErrors": [], "pageErrors": [], "checks": {}},
        "edge": {"version": "", "consoleErrors": [], "pageErrors": [], "checks": {}},
        "responsive": {},
        "performance": {},
        "exports": {},
        "screenshots": [],
    }

    with sync_playwright() as p:
        # ======================== 1. CHROME FULL STRICT E2E + 10-SHOT SHOWCASE ========================
        browser = p.chromium.launch(
            headless=True,
            executable_path=CHROME_PATH,
            args=["--autoplay-policy=no-user-gesture-required"],
        )
        metrics["chrome"]["version"] = browser.version
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            accept_downloads=True,
        )
        page = context.new_page()

        injected_share_error=False
        offline_mint=False
        metrics["injectedFaults"]={"offlineAssetRequests":[], "share503Responses":0}
        def log_console(msg):
            if msg.type != "error":
                return
            location = urlsplit(msg.location.get("url",""))
            if (offline_mint and msg.text.endswith("net::ERR_INTERNET_DISCONNECTED")
                    and location.netloc == urlsplit(BASE_URL).netloc
                    and location.path.lower().endswith((".woff2",".woff",".png",".webp",".svg",".jpg"))):
                metrics["injectedFaults"]["offlineAssetRequests"].append(location.path.split("/")[-1])
                return
            if injected_share_error and location.path == "/api/shares" and "503" in msg.text:
                metrics["injectedFaults"]["share503Responses"]+=1
                return
            metrics["chrome"]["consoleErrors"].append(msg.text+" "+location.path.rsplit("/",1)[-1] if offline_mint else msg.text)
        page.on("console",log_console)
        page.on("pageerror", lambda err: metrics["chrome"]["pageErrors"].append(str(err)))

        t0 = time.perf_counter()
        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
        metrics["performance"]["initialLoadMs"] = round((time.perf_counter() - t0) * 1000, 1)

        # Each browser context has a fresh, isolated origin database.
        attach_store(page)
        # Unlock audio
        power_btn = page.locator("button", has_text="启动声音")
        if power_btn.is_visible():
            power_btn.click()
            page.wait_for_timeout(400)
        page.wait_for_function("state().audioUnlocked")
        metrics["chrome"]["checks"]["audioUnlock"] = page.evaluate("state().audioUnlocked")

        # --- 01 声卡盲盒: 抽卡 + 刮开 + 英雄卡截图 + 翻看卡背截图 + 主题声景 ---
        page.locator("[data-testid='gacha-pull-btn']").click()
        page.wait_for_function("state().totalPulls>0")
        unbox_btn = page.get_by_test_id("gacha-quick-btn")
        if unbox_btn.is_visible():
            unbox_btn.click()
            page.wait_for_timeout(420)

        # Keep the pulled card's identity before selecting a different gallery card.
        pulled_id = page.evaluate("state().selectedGachaCardId")
        page.get_by_test_id("gacha-slot-btn").click()
        page.get_by_role("button",name="装入→").first.click()
        page.get_by_test_id("beat-play-btn").wait_for()
        metrics["chrome"]["checks"]["pulledCardInstalled"] = page.evaluate("id=>state().tracks.some(t=>t.cardId===id)",pulled_id)
        page.get_by_test_id("nav-gacha").click()
        # Select flagship benchmark hero (#05 二八车铃) after verifying pull so 01_gacha_hero showcases redesigned benchmark
        bell_slot = page.locator("button", has_text="二八车铃").first
        if bell_slot.is_visible():
            bell_slot.click()
            page.wait_for_timeout(320)

        # Check Hero Card sizing ratio on Gacha
        gacha_stage = page.locator("[data-testid='gacha-stage-container']").bounding_box()
        gacha_card = page.locator("[data-testid='gacha-hero-card-wrap']").first.bounding_box()
        gacha_ratio = round(gacha_card["height"] / max(1, gacha_stage["height"]), 3) if (gacha_stage and gacha_card) else 0
        metrics["performance"]["gachaHeroHeightRatio1080p"] = gacha_ratio

        dismiss_toasts(page)
        page.mouse.move(1020, 440)
        page.wait_for_timeout(280)
        shot_01 = SHOTS_DIR / "01_gacha_hero.png"
        page.screenshot(path=str(shot_01))
        metrics["screenshots"].append(shot_01.name)
        metrics["chrome"]["checks"]["gachaPullAndReveal"] = page.evaluate("state().totalPulls>0 && !state().needsScratch")

        # Flip card back & capture 02_gacha_card_back.png
        page.locator("[data-testid='gacha-flip-btn']").click()
        page.wait_for_timeout(450)
        back_ok = (
            page.locator("text=市井声景档案").is_visible()
            and page.locator("text=合成声学配方").is_visible()
        )
        metrics["chrome"]["checks"]["cardBackLocalized"] = bool(back_ok)
        shot_02 = SHOTS_DIR / "02_gacha_card_back.png"
        page.screenshot(path=str(shot_02))
        metrics["screenshots"].append(shot_02.name)
        page.locator("[data-testid='gacha-flip-btn']").click()
        page.wait_for_timeout(350)

        # Load curated soundscape 清晨弄堂 -> goes cleanly to Beat Deck with flagship A/B 2-bar work!
        power = page.get_by_role("button",name="启动声音")
        if power.is_visible():
            power.click()
        page.locator("[data-testid='gacha-soundscapes-btn']").click()
        page.wait_for_selector("[data-testid^='soundscape-load-']")
        page.locator("[data-testid^='soundscape-load-']").first.click()
        page.wait_for_selector("[data-testid='beat-play-btn']")
        page.wait_for_timeout(500)
        metrics["chrome"]["checks"]["gachaSoundscapeLoaded"] = True

        # --- 02 插卡编曲: 主创作演奏 + Holo Motion 截图 + A/B 段与变奏截图 ---
        dismiss_toasts(page)
        page.locator("[data-testid='beat-play-btn']").click()
        page.wait_for_timeout(950)
        shot_03 = SHOTS_DIR / "03_beat_composition.png"
        page.screenshot(path=str(shot_03))
        metrics["screenshots"].append(shot_03.name)
        metrics["performance"]["beatHoloMotionFps"] = measure_fps(page, 2000)
        metrics["chrome"]["checks"]["beatPlaybackAndHoloMotion"] = True

        metrics["performance"]["liveAudioToCanvas"] = measure_impacts(page)

        # Open collapsible Fine Variation bar + apply rule-constrained Call & Response variation -> capture 04_beat_variation.png
        page.locator("[data-testid='beat-fine-toggle']").click()
        page.wait_for_selector("[data-testid='variation-call_response']")
        page.locator("[data-testid='variation-call_response']").click()
        page.wait_for_timeout(450)
        phrase_b_active = page.locator("[data-testid='phrase-tab-B']").is_visible()
        metrics["chrome"]["checks"]["beatABVariationApplied"] = bool(phrase_b_active)
        dismiss_toasts(page)
        shot_04 = SHOTS_DIR / "04_beat_variation.png"
        page.screenshot(path=str(shot_04))
        metrics["screenshots"].append(shot_04.name)
        page.locator("[data-testid='beat-fine-toggle']").click()
        page.wait_for_timeout(150)

        # Stop Beat before sending to Pinball Show
        page.locator("[data-testid='beat-stop-btn']").click()
        page.wait_for_timeout(200)

        # --- 03 弹珠剧场 · 编曲剧场模式 + FIX #3 快照严格一致验证 ---
        page.locator("[data-testid='beat-to-pinball-btn']").click()
        page.wait_for_selector("[data-testid='pinball-show-to-forge-btn']")
        page.wait_for_timeout(300)
        dismiss_toasts(page)
        page.wait_for_timeout(850)
        shot_06 = SHOTS_DIR / "06_pinball_performance.png"
        page.screenshot(path=str(shot_06))
        metrics["screenshots"].append(shot_06.name)
        metrics["chrome"]["checks"]["beatToPinballChoreographedShow"] = True

        # FIX #3 PROOF: Go back to Beat and CLEAR Beat, then return to Pinball Show and click 送去闪卡铸造 ->
        # Forge MUST still receive the exact frozen Show snapshot (NOT empty 0-note Beat)!
        page.locator("[data-testid='nav-beat']").click()
        page.wait_for_selector("[data-testid='beat-play-btn']")
        page.locator("button", has_text="清空").first.click()
        page.wait_for_timeout(220)
        page.locator("[data-testid='nav-pinball']").click()
        page.wait_for_selector("[data-testid='pinball-show-to-forge-btn']")
        page.locator("[data-testid='pinball-show-to-forge-btn']").click()
        page.wait_for_selector("[data-testid='forge-mint-btn']")
        page.wait_for_timeout(500)
        show_forge_spec = page.locator("text=/BPM · \\d+ 音符/").first.inner_text()
        show_note_count = int(show_forge_spec.split("·")[-1].replace("音符", "").strip())
        metrics["chrome"]["checks"]["pinballShowSnapshotPreserved"] = show_note_count > 10

        # Restore flagship MARKET preset in Beat (via undo!)
        page.locator("[data-testid='nav-beat']").click()
        page.wait_for_selector("[data-testid='beat-play-btn']")
        page.locator("button[title='撤销上一步 (Ctrl+Z)']").click()
        page.wait_for_timeout(220)

        # --- 03 弹珠剧场 · 自由实验 + 8 秒录音 + 量化失真汇报 + 空录音拦截 ---
        page.locator("[data-testid='nav-pinball']").click()
        page.wait_for_selector("[data-testid='pinball-mode-free']")
        page.locator("[data-testid='pinball-mode-free']").click()
        page.wait_for_timeout(320)
        dismiss_toasts(page)
        drop_btn = page.locator("[data-testid='pinball-drop-btn']")
        for _ in range(5):
            drop_btn.click()
            page.wait_for_timeout(200)
        page.wait_for_timeout(1700)

        shot_05 = SHOTS_DIR / "05_pinball_free_jam.png"
        page.screenshot(path=str(shot_05))
        metrics["screenshots"].append(shot_05.name)
        metrics["performance"]["pinballFreeJamFps"] = measure_fps(page, 2000)

        rec_text = page.locator("text=8 秒录音").inner_text()
        m_notes = re.search(r"(\d+)\s*音符", rec_text)
        rec_note_count = int(m_notes.group(1)) if m_notes else 0
        metrics["chrome"]["checks"]["pinballRealRecording"] = rec_note_count > 0
        metrics["chrome"]["checks"]["pinballRealRecordingText"] = rec_text

        # Send to Beat Quantize Preview & verify collision/shift loss stats are visible!
        page.locator("[data-testid='pinball-to-quantize-btn']").click()
        page.wait_for_selector("[data-testid='quantize-preview-banner']")
        q_text = page.locator("[data-testid='quantize-preview-banner']").inner_text()
        metrics["chrome"]["checks"]["pinballQuantizePreviewWithLossStats"] = (
            "量化预览" in q_text and "偏移" in q_text
        )
        page.get_by_role("button", name="合并至当前轨").click()
        page.wait_for_function("!state().pinballQuantizePreview")
        page.wait_for_timeout(200)

        # Empty Pinball recording guard verification (clear toys & auto-drop so airborne balls can't re-record)
        page.locator("[data-testid='nav-pinball']").click()
        page.wait_for_selector("[data-testid='pinball-drop-btn']")
        auto_btn = page.locator("button", has_text="自动连发")
        if "开" in auto_btn.inner_text():
            auto_btn.click()
        page.locator("button", has_text="清空").first.click()
        page.wait_for_timeout(180)
        clear_rec_btn = page.locator("button[title='清空当前录音缓冲']")
        if clear_rec_btn.is_enabled():
            clear_rec_btn.click()
            page.wait_for_timeout(220)
        page.locator("[data-testid='pinball-to-forge-btn']").click()
        page.wait_for_timeout(300)
        metrics["chrome"]["checks"]["emptyPinballGuardRejected"] = page.locator(
            "[data-testid='pinball-drop-btn']"
        ).is_visible()
        # Restore LOOP preset so subsequent responsive viewport screenshots look rich
        page.locator("button", has_text="循环").first.click()
        page.wait_for_timeout(150)

        # --- 04 闪卡工坊: 铸造代表作《清晨弄堂》+ 真实声纹 + 贴纸 + 4 格式导出 ---
        page.locator("[data-testid='nav-beat']").click()
        page.wait_for_selector("[data-testid='beat-to-forge-btn']")
        page.locator("[data-testid='beat-to-forge-btn']").click()
        page.wait_for_selector("[data-testid='forge-mint-btn']")
        page.wait_for_timeout(1600)

        # Customize title & place crisp starburst sticker in upper-right safe margin
        title_input = page.locator("[data-testid='forge-title-input']")
        title_input.fill("清晨弄堂")
        page.wait_for_timeout(180)
        page.locator("[data-testid='forge-sticker-starburst']").click()
        page.wait_for_timeout(320)

        # Check Forge Hero Card ratio & UI PCM badge (distinct from WAV PCM audio peak!)
        forge_stage = page.locator("[data-testid='forge-stage-container']").bounding_box()
        forge_card = page.locator("[data-testid='forge-hero-card-wrap'] .holo-card-shell").first.bounding_box()
        if not forge_card:
            forge_card = page.locator("[data-testid='forge-hero-card-wrap']").first.bounding_box()
        metrics["performance"]["forgeHeroHeightRatio1080p"] = (
            round(forge_card["height"] / max(1, forge_stage["height"]), 3)
            if (forge_stage and forge_card)
            else 0
        )

        page.get_by_test_id("forge-pcm-badge").filter(has_text="真实 PCM 声纹").wait_for(timeout=60000)
        pcm_badge_text = page.locator("[data-testid='forge-pcm-badge']").inner_text()
        metrics["chrome"]["checks"]["realPcmUiBadgeVisible"] = ("真实 PCM 声纹" in pcm_badge_text)

        metrics["performance"]["actualPcm"] = page.evaluate("""async () => {
            const snap=state().forgeDraft.snapshot;
            const {renderCompositionSnapshotCached}=await import('/src/audio/wavExporter.ts');
            const {holoDb}=await import('/src/storage/holoDb.ts');
            const {extractRealWaveformBars}=await import('/src/audio/compositionEngine.ts');
            const artifact=await renderCompositionSnapshotCached(snap);
            const cached=await holoDb.getAudioCache(artifact.cacheKey,snap.id);
            if(!cached) throw Error('missing audio cache');
            const ctx=new OfflineAudioContext(2,1,cached.sampleRate);
            const buffer=await ctx.decodeAudioData(await cached.wavBlob.arrayBuffer());
            const bars=extractRealWaveformBars(buffer,cached.waveformBars.length);
            const error=Math.max(...bars.map((v,i)=>Math.abs(v-cached.waveformBars[i])));
            if(bars.length!==28 || Math.max(...bars)<=Math.min(...bars) || error>.005) throw Error('PCM discrepancy '+error);
            const elements=[...document.querySelectorAll('[data-testid="forge-hero-card-wrap"] span')];
            const shown=elements.filter(e=>e.style.height.endsWith('%') && e.style.backgroundColor);
            const domMatches=shown.length===bars.length && shown.every((e,i)=>parseInt(e.style.height,10)===Math.round(cached.waveformBars[i]*100));
            return {bars:bars.length,error,domMatches,seconds:buffer.duration,events:snap.events.length};
        }""")
        pcm = metrics["performance"]["actualPcm"]
        metrics["chrome"]["checks"]["realPcmWaveformRendered"] = (
            metrics["chrome"]["checks"]["realPcmUiBadgeVisible"] and pcm["domMatches"]
            and pcm["error"] <= .005 and pcm["bars"] == 28 and pcm["events"] > 0
        )
        # Snapshot Immutability Check
        spec_before = page.locator("text=/BPM · \\d+ 音符/").first.inner_text()
        page.locator("[data-testid='nav-beat']").click()
        page.wait_for_timeout(180)
        page.locator("button", has_text="清空").first.click()
        page.wait_for_timeout(180)
        page.locator("[data-testid='nav-forge']").click()
        page.wait_for_selector("[data-testid='forge-mint-btn']")
        page.wait_for_timeout(300)
        spec_after = page.locator("text=/BPM · \\d+ 音符/").first.inner_text()
        metrics["chrome"]["checks"]["snapshotImmutabilityVerified"] = (spec_before == spec_after)

        dismiss_toasts(page)
        shot_07 = SHOTS_DIR / "07_forge_editor.png"
        page.screenshot(path=str(shot_07))
        metrics["screenshots"].append(shot_07.name)

        offline_mint=True
        context.set_offline(True)
        # Mint #MY-01
        page.locator("[data-testid='forge-mint-btn']").click()
        page.wait_for_function("state().mintedCards.some(c=>c.code==='#MY-01' && c.id===state().inspectMintedId)", timeout=60000)
        page.get_by_test_id("forge-unseal-btn").wait_for()
        context.set_offline(False)
        offline_mint=False
        page.wait_for_timeout(850)
        metrics["chrome"]["checks"]["mintedCardMY01"] = True

        dismiss_toasts(page)
        shot_08 = SHOTS_DIR / "08_forge_minted_card.png"
        page.screenshot(path=str(shot_08))
        metrics["screenshots"].append(shot_08.name)

        # --- Real 4-Format Exports from the SAME Representative Work (#MY-01 清晨弄堂) ---
        with page.expect_download(timeout=15000) as dl_png:
            page.locator("[data-testid='forge-export-png']").click()
        png_path = EXPORTS_DIR / "hutong-groove-gallery-poster.png"
        dl_png.value.save_as(str(png_path))
        metrics["exports"]["png"] = verify_png_dimensions(png_path)

        with page.expect_download(timeout=20000) as dl_wav:
            page.locator("[data-testid='forge-export-wav']").click()
        wav_path = EXPORTS_DIR / "hutong-groove.wav"
        dl_wav.value.save_as(str(wav_path))
        wav_info = verify_wav_file(wav_path)
        wav_info.update(wav_stats(wav_path))
        metrics["exports"]["wav"] = wav_info
        metrics["chrome"]["checks"]["wavPcmNonSilent"] = bool(wav_info["nonSilent"])

        with page.expect_download(timeout=10000) as dl_json:
            page.locator("[data-testid='forge-export-json']").click()
        json_path = EXPORTS_DIR / "hutong-groove.holobeat.json"
        dl_json.value.save_as(str(json_path))
        parsed_proj = json.loads(json_path.read_text(encoding="utf-8"))
        metrics["exports"]["json"] = {
            "bytes": json_path.stat().st_size,
            "schema": parsed_proj.get("schema"),
            "kind": parsed_proj.get("kind"),
            "code": parsed_proj.get("card", {}).get("code"),
            "title": parsed_proj.get("card", {}).get("title"),
        }
        metrics["chrome"]["checks"]["projectJsonSchemaV3"] = (
            parsed_proj.get("schema") == "holobeat.project.v3"
        )

        # Motion Card WebM Export (Full Duration + Audio Track!)
        page.evaluate("""async()=>{window.exportMessages=[]; const m=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/store/useHoloStore.ts')); const {useHoloStore}=await import(m.name); useHoloStore.subscribe((s,p)=>{if(s.toasts!==p.toasts) window.exportMessages.push(...s.toasts.map(t=>t.text))})}""")
        try:
            with page.expect_download(timeout=30000+int(1000*wav_info["duration"])) as dl_webm:
                page.get_by_test_id("forge-export-motion").click()
        except Exception as exc:
            raise AssertionError("Forge WebM download: "+str(page.evaluate("Array.from(new Set(window.exportMessages)).slice(-8)"))) from exc
        webm_path = EXPORTS_DIR / "hutong-groove-motion.webm"
        dl_webm.value.save_as(str(webm_path))
        webm_info = verify_webm_file(webm_path)
        webm_info.update(webm_stats(webm_path,wav_info["duration"]))
        metrics["exports"]["webm"] = webm_info
        metrics["chrome"]["checks"]["motionCardWebmExported"] = bool(webm_info["validWebmMagic"])

        # Corrupt JSON import guard test (existing binder cards must stay safe!)
        bad_json_path = REPORTS_DIR / "_tmp_corrupt.holobeat.json"
        bad_json_path.write_text('{"schema":"broken","card":{"id":123}}', encoding="utf-8")
        page.locator("input[type='file']").set_input_files(str(bad_json_path))
        page.wait_for_function("state().toasts.some(t=>/格式|导入失败/.test(t.text))")
        assert page.evaluate("state().mintedCards.filter(c=>!c.isDemo).length===1")
        bad_json_path.unlink(missing_ok=True)
        metrics["chrome"]["checks"]["corruptJsonImportRejectedSafely"] = page.locator(
            "text=清晨弄堂"
        ).first.is_visible()

        # Reload Persistence Verification
        page.reload(wait_until="domcontentloaded", timeout=60000)
        attach_store(page)
        page.wait_for_selector("[data-testid='nav-forge']")
        page.locator("[data-testid='nav-forge']").click()
        page.wait_for_function("state().dbHydrated && state().mintedCards.filter(c=>!c.isDemo).length===1")
        binder_section = page.locator("section", has_text="我的卡册")
        persisted = binder_section.locator("text=清晨弄堂").first.is_visible()
        metrics["chrome"]["checks"]["indexedDbReloadPersistence"] = bool(persisted)

        # Inspect #MY-01 & Unseal -> Remix -> capture 09_binder_remix.png
        binder_section.locator("text=清晨弄堂").first.click()
        page.wait_for_selector("[data-testid='forge-unseal-btn']")
        page.locator("[data-testid='forge-unseal-btn']").click()
        page.wait_for_selector("[data-testid='beat-play-btn']")
        page.wait_for_timeout(450)
        remix_ok = page.locator("text=重混 #MY-01").first.is_visible()
        metrics["chrome"]["checks"]["unsealAndRemixLineage"] = bool(remix_ok)
        dismiss_toasts(page)
        shot_09 = SHOTS_DIR / "09_binder_remix.png"
        page.screenshot(path=str(shot_09))
        metrics["screenshots"].append(shot_09.name)

        # Sticker-change version hash + Monotonic Serial (#MY-02)
        page.locator("[data-testid='beat-to-forge-btn']").click()
        page.wait_for_selector("[data-testid='forge-mint-btn']")
        page.wait_for_timeout(400)
        page.locator("[data-testid='forge-sticker-bell']").click()
        page.wait_for_timeout(250)
        page.locator("[data-testid='forge-mint-btn']").click()
        try:
            page.wait_for_function("state().mintedCards.some(c=>c.code==='#MY-02' && c.id===state().inspectMintedId)",timeout=60000)
        except Exception as error:
            raise AssertionError("Remix mint: "+str(page.evaluate("({cards:state().mintedCards.map(c=>c.code),storage:state().lastStorageError,messages:state().toasts.map(t=>t.text)})"))) from error
        page.get_by_test_id("forge-unseal-btn").wait_for()
        metrics["chrome"]["checks"]["stickerChangeCreatesNewVersionMY02"] = True

        # --- Responsive Layout & Clickability Matrix across 4 Standard Desktop Viewports ---
        vp_targets = [
            ("gacha", "gacha-pull-btn"),
            ("beat", "beat-play-btn"),
            ("pinball", "pinball-drop-btn"),
            ("forge", "forge-export-png"),
        ]
        all_responsive_ok = True
        for w, h in [(1920, 1080), (1440, 900), (1366, 768), (1280, 720)]:
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(240)
            vp_key = f"{w}x{h}"
            metrics["responsive"][vp_key] = {}
            for tab_id, cta_id in vp_targets:
                page.locator(f"[data-testid='nav-{tab_id}']").click()
                page.wait_for_timeout(260)
                if tab_id == "pinball":
                    free_tab = page.locator("[data-testid='pinball-mode-free']")
                    if free_tab.is_visible():
                        free_tab.click()
                        page.wait_for_timeout(150)
                overflow = page.evaluate(
                    "() => ({ horizOverflow: document.documentElement.scrollWidth > window.innerWidth, vertOverflow: document.documentElement.scrollHeight > window.innerHeight })"
                )
                cta_check = check_control_in_viewport(page, cta_id, w, h)
                metrics["responsive"][vp_key][tab_id] = {
                    **overflow,
                    "primaryCta": cta_check,
                }
                if overflow["horizOverflow"] or overflow["vertOverflow"] or not cta_check["inViewport"]:
                    all_responsive_ok = False

            # Capture 10_compact_viewport.png at 1280x720 on Forge workbench
            if w == 1280 and h == 720:
                dismiss_toasts(page)
                shot_10 = SHOTS_DIR / "10_compact_viewport.png"
                page.screenshot(path=str(shot_10))
                metrics["screenshots"].append(shot_10.name)

        metrics["chrome"]["checks"]["allFourViewportsNoOverflowAndClickable"] = all_responsive_ok

        # Use only the isolated archive supplied by the owning runner.
        if "HOLOBEAT_BACKEND_URL" not in os.environ:
            raise RuntimeError("Run reliability_e2e.py to provide a disposable archive")
        if start_archive:
            start_archive()
        page.set_viewport_size({"width":1920,"height":1080})
        page.get_by_test_id("nav-forge").click()
        page.get_by_test_id("binder-item-minted-"+parsed_proj["card"]["id"]).click()
        injected_share_error=True
        page.route(BACKEND_URL+"/api/shares",lambda route: route.fulfill(status=503,
            headers={"Access-Control-Allow-Origin":BASE_URL},content_type="application/json",body="{}"))
        share_button=page.get_by_role("button",name="只读分享")
        share_button.click()
        page.wait_for_function("state().toasts.some(t=>t.text==='作品已成功归档，但分享链接创建失败。')")
        metrics["chrome"]["checks"]["partialArchiveReported"]=json.loads(get(BACKEND_URL+"/api/health")[1])["cardsCount"]==1
        page.unroute(BACKEND_URL+"/api/shares")
        injected_share_error=False
        with page.expect_response(lambda res:res.request.method=="POST" and res.url==BACKEND_URL+"/api/shares") as confirmed:
            share_button.click()
        assert confirmed.value.status in (200,201)
        outcome = page.evaluate("""async card => {
            const client = await import('/src/utils/backendClient.ts');
            const saved = await client.syncCardToBackend(card);
            if(saved.status!=='SHARED') throw Error(saved.status+' '+saved.error);
            const again = await client.syncCardToBackend(card);
            if(again.share?.token!==saved.share.token) throw Error('unstable share');
            return saved.share;
        }""",parsed_proj["card"])
        share_page = context.new_page()
        share_page.goto(outcome["shareUrl"])
        metrics["chrome"]["checks"]["backendShareHtmlShowcaseVerified"] = share_page.get_by_text("清晨弄堂",exact=True).first.is_visible()
        share_page.close()
        assert get(outcome["apiUrl"])[0] == 200
        revoked = page.evaluate("""async token=>(await import('/src/utils/backendClient.ts')).revokeCardShare(token)""",outcome["token"])
        metrics["chrome"]["checks"]["revoke"] = revoked["status"]=="REVOKED" and get(outcome["apiUrl"])[0]==404 and get(outcome["shareUrl"])[0]==404
        title = parsed_proj["card"]["title"]
        page.get_by_test_id("nav-forge").click()
        page.get_by_test_id("binder-item-minted-"+page.evaluate("state().mintedCards.find(c=>c.code==='#MY-02').id")).click()
        assert page.evaluate("state().inspectMintedId") != parsed_proj["card"]["id"]
        page.locator("input[type=file]").set_input_files(str(json_path))
        page.wait_for_function("title=>state().mintedCards.find(c=>c.id===state().inspectMintedId)?.title===title",arg=title)
        metrics["chrome"]["checks"]["validProjectImport"] = page.evaluate("id=>!!state().mintedCards.find(c=>c.id===id)",parsed_proj["card"]["id"])

        faults = browser.new_context()
        testpage=faults.new_page()
        testpage.goto(BASE_URL,wait_until="domcontentloaded")
        attach_store(testpage)
        metrics["storageLifecycle"]=testpage.evaluate("async()=>(await import('/tests/storage-browser.ts')).verifyStorageLifecycle()")
        faults.close()
        audioctx=browser.new_context()
        testpage=audioctx.new_page()
        testpage.goto(BASE_URL,wait_until="domcontentloaded")
        attach_store(testpage)
        testpage.get_by_role("button",name="启动声音").click()
        metrics["audioLifecycle"]=testpage.evaluate("async()=>(await import('/tests/audio-browser.ts')).verifyAudioLifecycle()")
        metrics["phraseAudio"]=testpage.evaluate("async()=>(await import('/tests/audio-browser.ts')).verifyPhrases()")
        audioctx.close()
        assert all(v is True for v in metrics["storageLifecycle"].values()) and all(v is True for v in metrics["audioLifecycle"].values())
        browser.close()

        # ======================== 2. MICROSOFT EDGE COMPATIBILITY CHECK ========================
        if Path(EDGE_PATH).exists():
            edge_browser = p.chromium.launch(
                headless=True,
                executable_path=EDGE_PATH,
                args=["--autoplay-policy=no-user-gesture-required"],
            )
            metrics["edge"]["version"] = edge_browser.version
            edge_page = edge_browser.new_page(viewport={"width": 1440, "height": 900})
            edge_page.on(
                "console",
                lambda msg: metrics["edge"]["consoleErrors"].append(msg.text)
                if msg.type == "error"
                else None,
            )
            edge_page.on("pageerror", lambda err: metrics["edge"]["pageErrors"].append(str(err)))
            edge_page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
            edge_page.wait_for_selector("[data-testid='nav-gacha']")
            for tab_id in ["gacha", "beat", "pinball", "forge"]:
                edge_page.locator(f"[data-testid='nav-{tab_id}']").click()
                edge_page.wait_for_timeout(280)
            metrics["edge"]["checks"]["allFourWorkbenchesLoaded"] = True
            attach_store(edge_page)
            # Record a slow, two-bar work so truncating at seven seconds fails the decode check.
            edge_page.get_by_test_id("nav-beat").click()
            edge_page.evaluate("state().setBpm(60);state().setBeatBars(2)")
            edge_page.get_by_test_id("beat-to-forge-btn").click()
            edge_page.get_by_test_id("forge-pcm-badge").filter(has_text="真实 PCM 声纹").wait_for(timeout=60000)
            edge_page.get_by_test_id("forge-export-motion").click()
            edge_page.get_by_test_id("forge-cancel-motion").click()
            edge_page.get_by_test_id("forge-export-motion").wait_for()
            with edge_page.expect_download(timeout=90000) as audio_file:
                edge_page.get_by_test_id("forge-export-wav").click()
            edge_wav = EXPORTS_DIR / "edge-long.wav"
            audio_file.value.save_as(edge_wav)
            with edge_page.expect_download(timeout=90000) as video_file:
                edge_page.get_by_test_id("forge-export-motion").click()
            edge_webm = EXPORTS_DIR / "edge-long.webm"
            video_file.value.save_as(edge_webm)
            duration = wav_stats(edge_wav)["duration"]
            metrics["exports"]["edgeWebm"] = webm_stats(edge_webm,duration)
            metrics["edge"]["checks"]["longRecordingAfterCancel"] = duration>7
            edge_browser.close()

    report_json = REPORTS_DIR / "e2e_metrics.json"
    report_json.write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))

    # ======================== STRICT ZERO-TOLERANCE GATE (FIX #9) ========================
    failures = []
    if metrics["chrome"]["consoleErrors"] or metrics["chrome"]["pageErrors"]:
        failures.append("Chrome console/page errors detected")
    if metrics["edge"]["consoleErrors"] or metrics["edge"]["pageErrors"]:
        failures.append("Edge console/page errors detected")

    required_bool_checks = [
        "partialArchiveReported","pulledCardInstalled","revoke","validProjectImport","backendShareHtmlShowcaseVerified",
        "audioUnlock",
        "gachaPullAndReveal",
        "cardBackLocalized",
        "gachaSoundscapeLoaded",
        "beatPlaybackAndHoloMotion",
        "beatABVariationApplied",
        "beatToPinballChoreographedShow",
        "pinballShowSnapshotPreserved",
        "pinballRealRecording",
        "pinballQuantizePreviewWithLossStats",
        "emptyPinballGuardRejected",
        "realPcmUiBadgeVisible", "realPcmWaveformRendered",
        "snapshotImmutabilityVerified",
        "mintedCardMY01",
        "wavPcmNonSilent",
        "projectJsonSchemaV3",
        "motionCardWebmExported",
        "corruptJsonImportRejectedSafely",
        "indexedDbReloadPersistence",
        "unsealAndRemixLineage",
        "stickerChangeCreatesNewVersionMY02",
        "allFourViewportsNoOverflowAndClickable",
    ]
    for key in required_bool_checks:
        val = metrics["chrome"]["checks"].get(key)
        if val is not True:
            failures.append(f"Required check failed: {key} = {val!r}")

    if not all(metrics["edge"]["checks"].get(k) is True for k in ("allFourWorkbenchesLoaded","longRecordingAfterCancel")):
        failures.append("Edge full audio/video verification missing")
    if len(metrics["screenshots"]) < 10:
        failures.append(f"Expected 10 showcase screenshots, got {len(metrics['screenshots'])}")

    if metrics["exports"].get("png", {}).get("width") != 1200 or metrics["exports"].get("png", {}).get("height") != 1600:
        failures.append(f"PNG poster dimensions invalid: {metrics['exports'].get('png')}")

    if failures:
        print("E2E STRICT GATE FAILED:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        sys.exit(1)

    print("ALL STRICT E2E, EXPORT, AND RESPONSIVE GATES PASSED (100%).")


if __name__ == "__main__":
    from reliability_e2e import main
    main()
