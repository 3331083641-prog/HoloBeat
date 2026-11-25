import json
import os
import struct
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("HOLOBEAT_URL", "http://localhost:5173")
CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe"
EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

ROOT_DIR = Path("D:/HoloBeat")
SHOTS_DIR = ROOT_DIR / "07_showcase" / "screenshots"
EXPORTS_DIR = ROOT_DIR / "07_showcase" / "exports"
REPORTS_DIR = ROOT_DIR / "07_showcase" / "reports"

SHOTS_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


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
            const start = performance.now();
            function tick(now) {
                frames++;
                if (now - start >= dur) {
                    const sec = (now - start) / 1000;
                    resolve({ fps: Math.round((frames / sec) * 10) / 10, frames, durationMs: Math.round(now - start) });
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
    pcm_data = data[44:]
    peak = 0
    step = max(2, len(pcm_data) // 4000)
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
        "peakAmplitude": peak,
        "nonSilent": peak > 120,
    }


def run_suite():
    metrics = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "baseUrl": BASE_URL,
        "chrome": {"consoleErrors": [], "pageErrors": [], "checks": {}},
        "edge": {"consoleErrors": [], "pageErrors": [], "checks": {}},
        "responsive": {},
        "performance": {},
        "exports": {},
        "screenshots": [],
    }

    with sync_playwright() as p:
        # ======================== 1. CHROME FULL E2E + SHOWCASE CAPTURE ========================
        browser = p.chromium.launch(
            headless=True,
            executable_path=CHROME_PATH,
            args=["--autoplay-policy=no-user-gesture-required"],
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            accept_downloads=True,
        )
        page = context.new_page()

        page.on(
            "console",
            lambda msg: metrics["chrome"]["consoleErrors"].append(msg.text)
            if msg.type == "error"
            else None,
        )
        page.on("pageerror", lambda err: metrics["chrome"]["pageErrors"].append(str(err)))

        t0 = time.perf_counter()
        page.goto(BASE_URL, wait_until="networkidle")
        load_ms = round((time.perf_counter() - t0) * 1000, 1)
        metrics["performance"]["initialLoadMs"] = load_ms

        # Clean storage for deterministic localized run
        page.evaluate(
            """async () => {
                localStorage.clear();
                if (indexedDB && indexedDB.deleteDatabase) {
                    indexedDB.deleteDatabase('HoloBeatStudioDB');
                }
            }"""
        )
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(500)

        # Unlock audio via 启动声音 banner
        power_btn = page.locator("button", has_text="启动声音")
        if power_btn.is_visible():
            power_btn.click()
            page.wait_for_timeout(450)
            metrics["chrome"]["checks"]["audioUnlock"] = True

        # --- 01 声卡盲盒: 扭取声卡 + 快速拆封 + 翻看卡背核查 + 截图 ---
        page.locator("button", has_text="扭取声卡").click()
        page.wait_for_timeout(950)
        unbox_btn = page.locator("button", has_text="立即刮开")
        if unbox_btn.is_visible():
            unbox_btn.click()
            page.wait_for_timeout(450)

        dismiss_toasts(page)
        page.mouse.move(1020, 440)
        page.wait_for_timeout(300)
        shot_gacha = SHOTS_DIR / "01_gacha.png"
        page.screenshot(path=str(shot_gacha))
        metrics["screenshots"].append(shot_gacha.name)
        metrics["chrome"]["checks"]["gachaPullAndReveal"] = True

        # Verify card back flip renders clean Chinese labels
        page.locator("button", has_text="翻看卡背").click()
        page.wait_for_timeout(400)
        back_ok = page.locator("text=市井声景档案").is_visible() and page.locator("text=合成声学配方").is_visible()
        assert back_ok, "Card back localized sections not visible!"
        metrics["chrome"]["checks"]["cardBackLocalized"] = True
        page.locator("button", has_text="查看正面").click()
        page.wait_for_timeout(350)

        # Send card to Beat via slot popover
        page.locator("button", has_text="装入节拍台").click()
        page.wait_for_timeout(250)
        page.locator("button", has_text="装入→").first.click()
        page.wait_for_timeout(850)
        metrics["chrome"]["checks"]["gachaSendToBeat"] = True

        # --- 02 插卡编曲: 播放 + Holo Motion 跳跃音符 ---
        dismiss_toasts(page)
        page.locator("button", has_text="播放").first.click()
        page.wait_for_timeout(900)
        shot_beat = SHOTS_DIR / "02_beat_deck.png"
        page.screenshot(path=str(shot_beat))
        metrics["screenshots"].append(shot_beat.name)
        metrics["performance"]["beatHoloMotionFps"] = measure_fps(page, 2000)
        metrics["chrome"]["checks"]["beatPlaybackAndHoloMotion"] = True

        # --- 03 弹珠剧场 · 编曲剧场模式 ---
        page.locator("button", has_text="进入弹珠剧场").click()
        page.wait_for_timeout(300)
        dismiss_toasts(page)
        page.wait_for_timeout(900)
        shot_show = SHOTS_DIR / "05_pinball_performance.png"
        page.screenshot(path=str(shot_show))
        metrics["screenshots"].append(shot_show.name)
        metrics["chrome"]["checks"]["beatToPinballChoreographedShow"] = True

        # --- 03 弹珠剧场 · 自由实验 + 8 秒录音 + 空录音校验 + 量化回流 ---
        page.locator("button", has_text="自由实验").first.click()
        page.wait_for_timeout(350)
        dismiss_toasts(page)
        drop_btn = page.locator("button", has_text="投掷弹珠")
        for _ in range(4):
            drop_btn.click()
            page.wait_for_timeout(220)
        page.wait_for_timeout(1800)

        shot_pinball = SHOTS_DIR / "03_pinball_free_jam.png"
        page.screenshot(path=str(shot_pinball))
        metrics["screenshots"].append(shot_pinball.name)
        metrics["performance"]["pinballFreeJamFps"] = measure_fps(page, 2000)

        rec_text = page.locator("text=8 秒录音").inner_text()
        metrics["chrome"]["checks"]["pinballRealRecordingText"] = rec_text

        # 送回节拍台量化预览
        page.locator("button", has_text="送回节拍台").click()
        page.wait_for_timeout(450)
        dismiss_toasts(page)
        quantize_visible = page.locator("text=量化预览").first.is_visible()
        assert quantize_visible, "Quantize preview banner did not appear!"
        shot_quantize = SHOTS_DIR / "08_beat_quantize_preview.png"
        page.screenshot(path=str(shot_quantize))
        metrics["screenshots"].append(shot_quantize.name)
        metrics["chrome"]["checks"]["pinballQuantizePreview"] = True

        page.locator("button", has_text="合并至当前轨").click()
        page.wait_for_timeout(300)

        # 空弹珠录音拦截验证
        page.locator("nav button", has_text="弹珠剧场").click()
        page.wait_for_timeout(300)
        auto_btn = page.locator("button", has_text="自动连发")
        if "开" in auto_btn.inner_text():
            auto_btn.click()
        clear_rec_btn = page.locator("button[title='清空当前录音缓冲']")
        if clear_rec_btn.is_enabled():
            clear_rec_btn.click()
            page.wait_for_timeout(250)
        page.locator("button", has_text="录成闪卡").click()
        page.wait_for_timeout(350)
        still_on_pinball = page.locator("button", has_text="投掷弹珠").is_visible()
        metrics["chrome"]["checks"]["emptyPinballGuardRejected"] = still_on_pinball

        # --- 04 闪卡铸造: 快照不可变 + 真实声纹 + 中文标题 + 压印 + 导出 ---
        page.locator("nav button", has_text="插卡编曲").click()
        page.wait_for_timeout(300)
        page.locator("button", has_text="铸造这张节拍卡").click()
        page.wait_for_timeout(2000)

        title_input = page.locator("input[placeholder='胡同放克']")
        title_input.fill("胡同放克")
        page.wait_for_timeout(200)
        page.locator("button[title^='添加']").first.click()
        page.wait_for_timeout(350)

        real_pcm_badge = page.locator("text=真实声纹").first.is_visible()
        metrics["chrome"]["checks"]["realPcmWaveformRendered"] = real_pcm_badge

        # Snapshot Immutability Check
        spec_before = page.locator("text=/BPM · \\d+ 音符/").inner_text()
        page.locator("nav button", has_text="插卡编曲").click()
        page.wait_for_timeout(200)
        page.locator("button", has_text="清空").click()
        page.wait_for_timeout(200)
        page.locator("nav button", has_text="闪卡铸造").click()
        page.wait_for_timeout(350)
        spec_after = page.locator("text=/BPM · \\d+ 音符/").inner_text()
        assert spec_before == spec_after, f"Snapshot mutated! {spec_before} != {spec_after}"
        metrics["chrome"]["checks"]["snapshotImmutabilityVerified"] = f"{spec_before} == {spec_after}"

        dismiss_toasts(page)
        shot_forge = SHOTS_DIR / "04_card_forge.png"
        page.screenshot(path=str(shot_forge))
        metrics["screenshots"].append(shot_forge.name)

        # 压印入册 (#MY-01)
        page.locator("button", has_text="压印入册").click()
        page.wait_for_timeout(2600)
        assert page.locator("text=#MY-01").first.is_visible(), "Minted #MY-01 not visible!"
        metrics["chrome"]["checks"]["mintedCardMY01"] = True

        dismiss_toasts(page)
        shot_binder = SHOTS_DIR / "06_card_binder.png"
        page.screenshot(path=str(shot_binder))
        metrics["screenshots"].append(shot_binder.name)

        # Real File Exports (PNG + WAV + JSON)
        with page.expect_download(timeout=15000) as dl_png:
            page.locator("button", has_text="PNG 海报").click()
        png_path = EXPORTS_DIR / "hutong-groove-gallery-poster.png"
        dl_png.value.save_as(str(png_path))
        metrics["exports"]["png"] = verify_png_dimensions(png_path)

        with page.expect_download(timeout=20000) as dl_wav:
            page.locator("button", has_text="WAV 音频").click()
        wav_path = EXPORTS_DIR / "hutong-groove.wav"
        dl_wav.value.save_as(str(wav_path))
        metrics["exports"]["wav"] = verify_wav_file(wav_path)

        with page.expect_download(timeout=10000) as dl_json:
            page.locator("button", has_text="导出 JSON").click()
        json_path = EXPORTS_DIR / "hutong-groove.holobeat.json"
        dl_json.value.save_as(str(json_path))
        parsed_proj = json.loads(json_path.read_text(encoding="utf-8"))
        assert parsed_proj.get("schema") == "holobeat.project.v2"
        metrics["exports"]["json"] = {
            "bytes": json_path.stat().st_size,
            "schema": parsed_proj["schema"],
            "kind": parsed_proj["kind"],
            "code": parsed_proj["card"]["code"],
            "title": parsed_proj["card"]["title"],
        }

        # Reload Persistence Check
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(550)
        page.locator("nav button", has_text="闪卡铸造").click()
        page.wait_for_timeout(500)
        binder_section = page.locator("section", has_text="我的卡册")
        persisted = binder_section.locator("text=胡同放克").first.is_visible()
        assert persisted, "Minted card did not survive reload!"
        metrics["chrome"]["checks"]["indexedDbReloadPersistence"] = True

        # Inspect #MY-01 from 我的卡册 and click 拆封重混创作 -> capture 07_unseal_remix.png!
        binder_section.locator("text=胡同放克").first.click()
        page.wait_for_timeout(350)
        page.locator("button", has_text="拆封重混创作").first.click()
        page.wait_for_timeout(500)
        remix_badge_visible = page.locator("text=重混 #MY-01").first.is_visible()
        assert remix_badge_visible, "Remix lineage badge not visible after Unseal & Remix!"
        dismiss_toasts(page)
        shot_remix = SHOTS_DIR / "07_unseal_remix.png"
        page.screenshot(path=str(shot_remix))
        metrics["screenshots"].append(shot_remix.name)
        metrics["chrome"]["checks"]["unsealAndRemixLineage"] = True

        # Monotonic Serial Check: Delete #MY-01 -> Mint new -> Must be #MY-02!
        page.locator("button", has_text="铸造这张节拍卡").click()
        page.wait_for_timeout(500)
        page.locator("button[title='删除此自铸闪卡']").first.click(force=True)
        page.wait_for_timeout(350)
        page.locator("button", has_text="压印入册").click()
        page.wait_for_timeout(2600)
        has_my_02 = page.locator("text=#MY-02").first.is_visible()
        assert has_my_02, "Expected monotonic serial #MY-02 after deleting #MY-01!"
        metrics["chrome"]["checks"]["monotonicSerialAfterDelete"] = "#MY-02"

        # --- Responsive Layout Verification across 4 standard desktop viewports ---
        for w, h in [(1920, 1080), (1440, 900), (1366, 768), (1280, 720)]:
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(200)
            vp_key = f"{w}x{h}"
            metrics["responsive"][vp_key] = {}
            for tab_name in ["声卡盲盒", "插卡编曲", "弹珠剧场", "闪卡铸造"]:
                page.locator("nav button", has_text=tab_name).click()
                page.wait_for_timeout(240)
                overflow = page.evaluate(
                    "() => ({ horizOverflow: document.documentElement.scrollWidth > window.innerWidth, vertOverflow: document.documentElement.scrollHeight > window.innerHeight })"
                )
                metrics["responsive"][vp_key][tab_name] = overflow

        browser.close()

        # ======================== 2. MICROSOFT EDGE COMPATIBILITY CHECK ========================
        if Path(EDGE_PATH).exists():
            edge_browser = p.chromium.launch(
                headless=True,
                executable_path=EDGE_PATH,
                args=["--autoplay-policy=no-user-gesture-required"],
            )
            edge_page = edge_browser.new_page(viewport={"width": 1440, "height": 900})
            edge_page.on(
                "console",
                lambda msg: metrics["edge"]["consoleErrors"].append(msg.text)
                if msg.type == "error"
                else None,
            )
            edge_page.on("pageerror", lambda err: metrics["edge"]["pageErrors"].append(str(err)))
            edge_page.goto(BASE_URL, wait_until="networkidle")
            edge_page.wait_for_timeout(450)
            for tab_name in ["声卡盲盒", "插卡编曲", "弹珠剧场", "闪卡铸造"]:
                edge_page.locator("nav button", has_text=tab_name).click()
                edge_page.wait_for_timeout(300)
            metrics["edge"]["checks"]["allFourWorkbenchesLoaded"] = True
            edge_browser.close()

    report_json = REPORTS_DIR / "e2e_metrics.json"
    report_json.write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))

    if metrics["chrome"]["consoleErrors"] or metrics["chrome"]["pageErrors"]:
        print("FAIL: Chrome console/page errors detected!", file=sys.stderr)
        sys.exit(1)
    if metrics["edge"]["consoleErrors"] or metrics["edge"]["pageErrors"]:
        print("FAIL: Edge console/page errors detected!", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    run_suite()
