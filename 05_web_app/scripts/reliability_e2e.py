"""Run against isolated Vite, browser profiles and a new archive. Requires Python Playwright and ffmpeg."""
import array
import contextlib
import json
import os
import re
from pathlib import Path
import shutil
import socket
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import wave


ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT / "05_web_app"
BACK = ROOT / "06_backend"
REPORT = ROOT / "07_showcase/reports/e2e_metrics.json"
def get(url):
    try:
        with urllib.request.urlopen(url, timeout=3) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as err:
        return err.code, err.read()


def wait_service(url, proc):
    for _ in range(150):
        if proc.poll() is not None:
            raise RuntimeError(f"Service exited with code {proc.returncode}")
        try:
            if get(url)[0] == 200:
                return
        except OSError:
            pass
        time.sleep(0.1)
    raise TimeoutError(url)


@contextlib.contextmanager
def service(command, directory, env):
    proc = subprocess.Popen(command, cwd=directory, env={**os.environ, **env},
                            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        yield proc
    finally:
        if os.name == "nt" and proc.poll() is None:
            subprocess.run(["taskkill","/pid",str(proc.pid),"/t","/f"],stdout=subprocess.DEVNULL,check=True)
        elif proc.poll() is None:
            proc.terminate()
        proc.wait(timeout=10)


def free_port(candidates):
    for port in candidates:
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return sock.getsockname()[1]
            except OSError:
                pass
    raise RuntimeError("No free test port on the local CORS allowlist")


def wav_stats(path):
    raw = path.read_bytes()
    assert raw[:4] == b"RIFF" and raw[8:12] == b"WAVE"
    assert struct.unpack_from("<I", raw, 4)[0] == len(raw) - 8
    with wave.open(str(path), "rb") as audio:
        ch, sr, frames = audio.getnchannels(), audio.getframerate(), audio.getnframes()
        assert audio.getsampwidth() == 2
        samples = array.array("h", audio.readframes(frames))
    assert ch == 2 and sr == 48000 and len(samples) == frames * ch
    peak = max(map(abs, samples))
    assert peak > 20
    tail = max(map(abs, samples[-int(sr * ch * .01):]))
    assert tail < max(40, peak * .01), "abrupt end to PCM tail"
    return dict(sampleRate=sr, channels=ch, bitDepth=16, dataSize=len(samples)*2,
                duration=frames/sr, peak=peak, final10msPeak=tail)


def webm_stats(path, expected):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        from imageio_ffmpeg import get_ffmpeg_exe
        ffmpeg = get_ffmpeg_exe()
    args = [ffmpeg, "-v", "error", "-i", str(path)]
    pcm = subprocess.check_output(args + ["-map", "0:a:0", "-ac", "1", "-ar", "48000", "-f", "s16le", "-"])
    frames = subprocess.check_output(args + ["-map", "0:v:0", "-progress", "pipe:1", "-f", "null", "-"]).decode()
    video = int([l.split("=")[1] for l in frames.splitlines() if l.startswith("frame=")][-1])
    video_sec = int([l.split("=")[1] for l in frames.splitlines() if l.startswith("out_time_us=")][-1])/1e6
    peak = max(map(abs, array.array("h", pcm)))
    sec = len(pcm)/96000
    assert video > 1 and peak > 20 and abs(sec-expected) < .45 and abs(video_sec-expected) < .65, (sec,video_sec,expected,peak)
    return dict(videoFrames=video, videoEndSec=video_sec, audioDuration=sec, decodedAudioPeak=peak, expectedSec=expected)



def main():
    cache = ROOT / ".cache"
    cache.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=cache) as temp:
        archive_port = free_port([0])
        port = free_port([5173,4173])
        api = f"http://127.0.0.1:{archive_port}"
        base = f"http://127.0.0.1:{port}"
        node = shutil.which("node")
        env = {"PORT":str(archive_port),"HOST":"127.0.0.1","HOLOBEAT_DB_PATH":str(Path(temp)/"archive.sqlite")}
        with service([node,"--experimental-strip-types","src/server.ts"],BACK,env) as archive:
            wait_service(api+"/api/health",archive)
            routes = {path:get(api+path)[0] for path in ("/health","/api/health","/generate")}
        with contextlib.ExitStack() as services:
            def start_archive():
                proc=services.enter_context(service([node,"--experimental-strip-types","src/server.ts"],BACK,env))
                wait_service(api+"/api/health",proc)
            vite=services.enter_context(service([node,str(Path(node).parent/"node_modules/npm/bin/npm-cli.js"),
                "run","dev","--","--config","scripts/vite.reliability.config.ts","--host","127.0.0.1","--port",str(port)],FRONT,{"VITE_HOLOBEAT_API_URL":api}))
            wait_service(base,vite)
            os.environ.update(HOLOBEAT_URL=base,HOLOBEAT_BACKEND_URL=api)
            import verify_and_capture
            verify_and_capture.run_suite(start_archive)
        with service([node,"--experimental-strip-types","src/server.ts"],BACK,env) as archive:
            wait_service(api+"/api/health",archive)
            assert json.loads(get(api+"/api/health")[1])["cardsCount"]==1
            metrics=json.loads(REPORT.read_text(encoding="utf8"))
            metrics.update(routes=routes,restartVerified=True,passed=True)
            REPORT.write_text(json.dumps(metrics,indent=2,ensure_ascii=False)+"\n",encoding="utf8")


if __name__=="__main__":
    try:
        main()
    except BaseException as exc:
        reason = re.sub(r'(/(?:api/shares|share)/)[A-Za-z0-9_-]+', r'\1[redacted]', str(exc)[:500])
        failure = {"passed":False,"errorType":type(exc).__name__,"reason":reason}
        if isinstance(exc,SystemExit) and REPORT.exists():
            failure = {**json.loads(REPORT.read_text(encoding="utf8")), **failure}
        REPORT.write_text(json.dumps(failure,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
        raise
