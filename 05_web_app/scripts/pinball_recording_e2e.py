"""Real free-pinball capture, restoration, quantization and minting in isolated browsers."""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright
from reliability_e2e import BACK, FRONT, ROOT, free_port, get, service, wait_service


REPORT = ROOT / '07_showcase/reports/pinball_recording_metrics.json'
BROWSERS = {
    'chrome': Path(os.environ.get('PROGRAMFILES', 'C:/Program Files')) / 'Google/Chrome/Application/chrome.exe',
    'edge': Path(os.environ.get('PROGRAMFILES(X86)', 'C:/Program Files (x86)')) / 'Microsoft/Edge/Application/msedge.exe',
}
CHECKS = (
    'manualCollision', 'navigationRestored', 'refreshRestored', 'restoredNoAutoBalls',
    'quantizedOriginal', 'draftContainsOriginal', 'mintedExactSnapshot', 'mintedReloaded',
    'continuedRecording', 'pausedWindowResumed', 'eightSecondWindow', 'clearNavigation', 'clearRefresh', 'collisionAfterClear',
)


def attach(page):
    page.get_by_test_id('nav-gacha').wait_for(timeout=60000)
    page.evaluate("""async () => {
        const url = performance.getEntriesByType('resource').find(x => x.name.includes('/src/store/useHoloStore.ts')).name;
        window.recordingStore = (await import(url)).useHoloStore;
    }""")
    page.wait_for_function('recordingStore.getState().dbHydrated')


def recorded(page):
    return page.evaluate('recordingStore.getState().pinballRecordedEvents')


def enter_free(page):
    page.get_by_test_id('nav-pinball').click()
    page.get_by_test_id('pinball-mode-free').click()
    page.get_by_test_id('pinball-drop-btn').wait_for()
    page.evaluate('() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)))')


def controls_match(page, count):
    expect(page.get_by_text(f'8 秒录音 · {count} 音符', exact=False)).to_be_visible()
    clear = page.get_by_title('清空当前录音缓冲')
    if count:
        expect(clear).to_be_enabled()
    else:
        expect(clear).to_be_disabled()


def verify_quiet(page, expected, ms):
    """Observe every animation frame for longer than the 150 ms initial and 1.6 s auto-drop timers."""
    result = page.evaluate("""async ({expected,ms}) => {
        const start=performance.now(), observed=JSON.stringify(expected);
        let frames=0,maxBalls=0;
        while(performance.now()-start < ms) {
            await new Promise(ok=>requestAnimationFrame(ok));
            const state=recordingStore.getState(), perf=window.__HOLOBEAT_PERF__;
            if(!perf || perf.mode!=='free') throw Error('Free physics telemetry unavailable');
            if(JSON.stringify(state.pinballRecordedEvents)!==observed) throw Error('Idle recording changed');
            if(state.pinballAutoDrop) throw Error('Auto-drop unexpectedly enabled');
            maxBalls=Math.max(maxBalls,perf.activeBalls); frames++;
        }
        return {frames,maxBalls,observedMs:Math.round(performance.now()-start)};
    }""", {'expected':expected,'ms':ms})
    assert result['frames'] > 2 and result['maxBalls'] == 0, result
    controls_match(page, len(expected))
    return result


def drop_and_wait(page, previous):
    page.get_by_test_id('pinball-drop-btn').click()
    page.wait_for_function("""n => recordingStore.getState().pinballRecordedEvents.length > n""",
                           arg=previous, timeout=15000)


def next_drop_batch(page):
    page.evaluate("""() => {
        const store=recordingStore, previous=store.getState().pinballRecordedEvents;
        window.captureNextBatch=new Promise((resolve,reject)=>{
            const unsub=store.subscribe(s=>{
                if(s.pinballRecordedEvents!==previous && s.pinballRecordedEvents.length) {
                    clearTimeout(timer); unsub(); resolve(s.pinballRecordedEvents);
                }
            });
            const timer=setTimeout(()=>{unsub();reject(Error('No collision batch after manual drop'))},15000);
        });
    }""")
    page.get_by_test_id('pinball-drop-btn').click()
    return page.evaluate('window.captureNextBatch')


def digest(obj):
    return hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def run_browser(p, name, base, metrics):
    exe = BROWSERS[name]
    if not exe.is_file():
        raise FileNotFoundError(f'{name} desktop executable missing')
    checks = metrics['checks']
    browser = p.chromium.launch(executable_path=str(exe),headless=True,
                                args=['--autoplay-policy=no-user-gesture-required'])
    with contextlib.ExitStack() as resources:
        resources.callback(browser.close)
        metrics['browserVersion'] = browser.version
        context = browser.new_context(viewport={'width':1440,'height':900})
        resources.callback(context.close)
        # Only serve the isolated local studio. No archive requests or third-party resources.
        def local_only(route):
            u = urlsplit(route.request.url)
            if u.netloc == urlsplit(base).netloc and not u.path.startswith('/api/'):
                route.continue_()
            else:
                route.abort()
        context.route('**/*',local_only)
        page=context.new_page()
        failures=[]
        page.on('pageerror', lambda exc: failures.append(type(exc).__name__))
        page.goto(base)
        attach(page)
        page.get_by_role('button',name='启动声音').click()
        page.wait_for_function('recordingStore.getState().audioUnlocked')
        page.evaluate('recordingStore.getState().setPinballAutoDrop(false)')
        enter_free(page)
        assert recorded(page)==[]
        for _ in range(3):
            page.get_by_test_id('pinball-drop-btn').click()
        page.wait_for_function('recordingStore.getState().pinballRecordedEvents.some(e=>e.timeOffsetMs>0)',timeout=15000)
        page.get_by_test_id('nav-beat').click()  # Unmount the physics engine before sampling.
        original=recorded(page)
        assert len(original)>=2 and 0<original[-1]['timeOffsetMs']<=8000
        metrics.update(originalEvents=len(original), originalDurationMs=original[-1]['timeOffsetMs'],
                       originalDigest=digest(original))
        checks['manualCollision']=True
        enter_free(page)
        metrics['navigationIdle']=verify_quiet(page,original,1800)
        checks['navigationRestored']=True
        page.reload()
        attach(page)
        assert recorded(page)==original
        enter_free(page)
        metrics['reloadIdle']=verify_quiet(page,original,1800)
        checks.update(refreshRestored=True,restoredNoAutoBalls=True)

        page.get_by_test_id('pinball-to-quantize-btn').click()
        page.get_by_test_id('quantize-preview-banner').wait_for()
        preview=page.evaluate('recordingStore.getState().pinballQuantizePreview')
        assert preview['sourceEvents']==original and preview['mappedCount']>0
        page.get_by_role('button',name='合并至当前轨').click()
        page.wait_for_function('!recordingStore.getState().pinballQuantizePreview')
        assert recorded(page)==original
        metrics['mappedSteps']=preview['mappedCount']
        checks['quantizedOriginal']=True
        enter_free(page)
        page.get_by_test_id('pinball-to-forge-btn').click()
        page.get_by_test_id('forge-mint-btn').wait_for()
        draft=page.evaluate('recordingStore.getState().forgeDraft.snapshot')
        assert draft['sourceType']=='pinball' and len(draft['pinballEvents'])==len(original)
        # The renderer adds a stable ID and default duration if absent. Compare every raw field.
        for source,event in zip(original,draft['pinballEvents']):
            assert all(k in event and event[k]==v for k,v in source.items())
        checks['draftContainsOriginal']=True
        page.get_by_test_id('forge-mint-btn').click()
        page.wait_for_function('recordingStore.getState().mintedCards.some(c=>!c.isDemo && c.sourceType==="pinball")',
                               timeout=60000)
        minted=page.evaluate('recordingStore.getState().mintedCards.filter(c=>!c.isDemo && c.sourceType==="pinball")')
        assert len(minted)==1 and minted[0]['snapshot']==draft
        card=minted[0]
        metrics['frozenRecordingDigest']=digest(card['snapshot']['pinballEvents'])
        checks['mintedExactSnapshot']=True
        page.reload()
        attach(page)
        page.get_by_test_id('nav-forge').click()
        page.get_by_test_id('binder-item-minted-'+card['id']).click()
        restored=page.evaluate('recordingStore.getState().mintedCards.find(c=>c.id===recordingStore.getState().inspectMintedId)')
        assert restored['snapshot']==draft and restored['sourceType']=='pinball'
        checks['mintedReloaded']=True

        enter_free(page)
        assert recorded(page)==original
        drop_and_wait(page,len(original))
        appended=recorded(page)
        assert appended[:len(original)]==original
        checks['continuedRecording']=True
        page.get_by_test_id('nav-beat').click()
        before_expiry=recorded(page)
        enter_free(page)
        # Wait a *real* window after restoring the recording, keeping the balls at zero.
        metrics['agedIdle']=verify_quiet(page,before_expiry,8150)
        resumed=next_drop_batch(page)
        # Paused time is excluded: the stored phrase is short enough to retain its entire tail.
        assert len(resumed)>len(before_expiry) and resumed[:len(before_expiry)]==before_expiry
        assert resumed[-1]['timeOffsetMs']>before_expiry[-1]['timeOffsetMs'], 'Ball flight time was lost'
        assert resumed[-1]['timeOffsetMs']<=8000
        checks['pausedWindowResumed']=True
        # Remain in this physics scene for one full active window. The next collision must evict old hits.
        page.wait_for_timeout(8150)
        fresh=next_drop_batch(page)
        assert fresh and fresh[:len(before_expiry)]!=before_expiry
        assert fresh[0]['timeOffsetMs']==0 and fresh[-1]['timeOffsetMs']<=8000
        page.get_by_test_id('nav-beat').click()
        recent=recorded(page)
        assert recent and 0<=recent[-1]['timeOffsetMs']<=8000
        metrics.update(eventsBeforeExpiry=len(before_expiry),retainedAfterPausedWindow=len(before_expiry),firstBatchAfterResuming=len(resumed),eventsAfterActiveWindow=len(fresh),
                       resumedDurationMs=recent[-1]['timeOffsetMs'])
        checks['eightSecondWindow']=True

        enter_free(page)
        page.get_by_title('清空当前录音缓冲').click()
        assert recorded(page)==[]
        page.get_by_test_id('nav-beat').click()
        enter_free(page)
        metrics['clearReturnIdle']=verify_quiet(page,[],1800)
        checks['clearNavigation']=True
        page.reload()
        attach(page)
        assert recorded(page)==[]
        enter_free(page)
        metrics['clearReloadIdle']=verify_quiet(page,[],1800)
        checks['clearRefresh']=True
        drop_and_wait(page,0)
        after_clear=recorded(page)
        assert after_clear and after_clear[0]['timeOffsetMs']==0
        metrics['newEventsAfterClear']=len(after_clear)
        checks['collisionAfterClear']=True
        metrics['pageErrorCount']=len(failures)
        assert not failures, f'{name} had {len(failures)} page errors'


def source_fingerprints():
    files=('05_web_app/src/pages/PinballPage.tsx','05_web_app/src/store/useHoloStore.ts')
    return {name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in files}


def main():
    cache=ROOT/'.cache'
    cache.mkdir(exist_ok=True)
    source_hashes=source_fingerprints()
    source_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    results={'timestampUtc':datetime.now(timezone.utc).isoformat(),'passed':False,'browsers':{},
             'sourceCommit':source_commit,'sourceSha256AtStart':source_hashes}
    try:
        with tempfile.TemporaryDirectory(dir=cache) as temp:
            node=shutil.which('node')
            api_port=free_port([0])
            api=f'http://127.0.0.1:{api_port}'
            with service([node,'--experimental-strip-types','src/server.ts'],BACK,{
                'PORT':str(api_port),'HOST':'127.0.0.1','HOLOBEAT_DB_PATH':str(Path(temp)/'isolated.sqlite')
            }) as backend:
                wait_service(api+'/health',backend)
                routes={path:get(api+path)[0] for path in ('/health','/generate')}
                assert routes=={'/health':200,'/generate':404}, routes
                results['preflight']=routes
            port=free_port([0])
            base=f'http://127.0.0.1:{port}'
            npm=Path(node).parent/'node_modules/npm/bin/npm-cli.js'
            with service([node,str(npm),'run','dev','--','--config','scripts/vite.reliability.config.ts',
                          '--host','127.0.0.1','--port',str(port)],FRONT,{'VITE_HOLOBEAT_API_URL':api}) as vite:
                wait_service(base,vite)
                with sync_playwright() as p:
                    for name in BROWSERS:
                        m={'checks':dict.fromkeys(CHECKS,False)}
                        results['browsers'][name]=m
                        try:
                            run_browser(p,name,base,m)
                        except Exception as err:
                            m.update(errorType=type(err).__name__,error=str(err)[:450])
                            print(name,m['errorType'],m['error'],flush=True)
        results['sourceSha256AtEnd']=source_fingerprints()
        results['sourceUnchangedDuringRun']=source_hashes==results['sourceSha256AtEnd']
        results['passed']=results['sourceUnchangedDuringRun'] and all(all(m['checks'].values()) and m.get('pageErrorCount')==0 and 'error' not in m
                              for m in results['browsers'].values()) and len(results['browsers'])==len(BROWSERS)
    finally:
        REPORT.write_text(json.dumps(results,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    if not results['passed']:
        raise SystemExit(1)


if __name__=='__main__':
    main()
