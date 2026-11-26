"""Targeted re-review: isolated real Chrome/Edge, source diagnostics plus dist black box."""
import json, os, shutil, subprocess, tempfile, hashlib, sqlite3
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect
from reliability_e2e import ROOT, FRONT, BACK, service, free_port, wait_service, get
from pinball_recording_e2e import BROWSERS

REPORT=ROOT/'07_showcase/reports/review_metrics.json'
SHOTS=ROOT/'07_showcase/screenshots/review-20261126'
SHOTS.mkdir(parents=True,exist_ok=True)
def attach(page):
    page.get_by_test_id('nav-beat').wait_for()
    page.evaluate("""async()=>{
      const resource = name => performance.getEntriesByType('resource').find(r=>r.name.includes(name)).name;
      window.S=(await import(resource('/src/store/useHoloStore.ts'))).useHoloStore;
      window.E=(await import(resource('/src/audio/HoloAudioEngine.ts'))).holoAudio;
      window.DB=(await import(resource('/src/storage/holoDb.ts'))).holoDb;
      window.client=await import(resource('/src/utils/backendClient.ts'));
      await E.ensureStarted();
    }""")
    page.wait_for_function('S.getState().dbHydrated')
def check(page,expr,arg=None):
    result=page.evaluate(expr,arg)
    assert result,expr
def run_browser(p,name,base,api,metrics,temp):
    checks=metrics['checks']={}
    browser=p.chromium.launch(executable_path=str(BROWSERS[name]),headless=True,
      args=['--autoplay-policy=no-user-gesture-required'])
    try:
      context=browser.new_context(viewport={'width':1600,'height':1000},accept_downloads=True)
      page=context.new_page()
      errors=[]
      page.on('pageerror',lambda e: errors.append(str(e)))
      page.goto(base)
      attach(page)
      page.get_by_test_id('nav-beat').click()
      pad=page.get_by_test_id('pad-0-0')
      old=pad.get_attribute('aria-pressed')
      pad.focus();page.keyboard.press('Enter')
      expect(pad).to_have_attribute('aria-pressed','false' if old=='true' else 'true')
      page.keyboard.press('Space')
      expect(pad).to_have_attribute('aria-pressed',old)
      page.evaluate("S.setState({liveFxMode:'momentary'})")
      fx=page.get_by_test_id('fx-echo');fx.focus()
      page.keyboard.down('Space');expect(fx).to_have_attribute('aria-pressed','true')
      page.keyboard.up('Space');expect(fx).to_have_attribute('aria-pressed','false')
      checks['keyboardPadsAndHeldFx']=True
      page.screenshot(path=str(SHOTS/f'{name}-beat.png'))

      # Corrupt V2 import must not change either persistent copy of the valid draft.
      page.evaluate("S.getState().sendBeatToForge()")
      for defect in ['snapshot','pinballEvents','pinballScene']:
        check(page,"""async defect=>{
          const original=structuredClone(S.getState().forgeDraft);
          await DB.saveForgeDraft(original);
          const d=structuredClone(original);d.snapshot.id='invalid-import-'+defect;
          if(defect==='snapshot')d.snapshot={id:'broken'};
          else if(defect==='pinballEvents')d.snapshot.pinballEvents=[{nonsense:true}];
          else d.snapshot.pinballScene={toys:'invalid'};
          const before=S.getState();
          const ok=await S.getState().importProjectFile({schema:'holobeat.project.v2',kind:'forge-draft',exportedAt:Date.now(),draft:d});
          const after=S.getState();
          window.retainedDraft=JSON.stringify(original);
          return !ok && JSON.stringify(after.forgeDraft)===retainedDraft &&
            JSON.stringify(await DB.loadForgeDraft())===retainedDraft &&
            after.nextMintSerial===before.nextMintSerial && after.inspectMintedId===before.inspectMintedId;
        }""",defect)
        original=page.evaluate('retainedDraft')
        page.reload();attach(page)
        assert page.evaluate('JSON.stringify(S.getState().forgeDraft)')==original
        checks['rejectV2-'+defect+'-reload']=True

      # Gate actual cold cache I/O, retain real renderer and decoder. No fabricated audio success.
      for action in ['pause','card','page','A-stop-B']:
        page.evaluate("""action=>{
          E.stopAllPlayback(); S.getState().setActivePage('beat');
          S.setState({bpm:101+['pause','card','page','A-stop-B'].indexOf(action)});
          const original=DB.getAudioCache.bind(DB);
          window.pendingCache=0;
          let release;const gate=new Promise(r=>release=r);
          window.releaseCache=()=>{DB.getAudioCache=original;release();};
          DB.getAudioCache=async(...args)=>{pendingCache++;await gate;try{return await original(...args);}finally{pendingCache--;}};
          S.getState().sendBeatToForge();
        }""",action)
        page.get_by_test_id('forge-play-btn').click()
        page.wait_for_function('pendingCache>0')
        oldsession=page.evaluate('E.playbackSessionId')
        if action in ['pause','A-stop-B']:
          page.get_by_test_id('forge-play-btn').click()
        elif action=='card':
          page.evaluate("S.setState({inspectMintedId:S.getState().mintedCards[0].id})")
        else:page.get_by_test_id('nav-beat').click()
        page.wait_for_function('(old)=>E.playbackSessionId!==old',arg=oldsession)
        page.evaluate('releaseCache()')
        page.wait_for_function('pendingCache===0')
        # Wait for the real render promises by requesting the identical snapshot.
        page.evaluate("""async()=> {
          const m=await import('/src/audio/wavExporter.ts');
          await m.renderCompositionSnapshotCached(S.getState().forgeDraft.snapshot);
        }""")
        check(page,'!E.activeBufferSource && !E.isSnapshotPlaying()')
        if action=='A-stop-B':
          page.get_by_test_id('forge-play-btn').click()
          page.wait_for_function('E.isSnapshotPlaying()')
          # Own a reference to real native AudioBufferSourceNode, spy only on its cleanup.
          page.evaluate("""()=>{
            window.sourceB=E.activeBufferSource; window.stoppedB=false;window.disconnectedB=false;
            const stop=sourceB.stop.bind(sourceB),disconnect=sourceB.disconnect.bind(sourceB);
            sourceB.stop=(...args)=>{stoppedB=true;return stop(...args)};
            sourceB.disconnect=(...args)=>{disconnectedB=true;return disconnect(...args)};
          }""")
          page.get_by_test_id('forge-play-btn').click()
          check(page,'stoppedB && disconnectedB && sourceB.onended===null && E.activeBufferSource===null')
        checks['coldCache-'+action]=True

      page.get_by_test_id('nav-beat').click()
      page.evaluate("""()=>{
        window.events=[
          {timeOffsetMs:0,durationMs:180,cardId:'card-05',note:'C4',velocity:.8,color:'#00D4AA'},
          {timeOffsetMs:700,durationMs:180,cardId:'card-05',note:'F4',velocity:.8,color:'#00D4AA'},
          {timeOffsetMs:1800,durationMs:180,cardId:'card-05',note:'A4',velocity:.8,color:'#00D4AA'}];
        S.getState().sendPinballToBeatQuantize(events);
        window.callbacks=0;
      }""")
      page.wait_for_selector('[data-testid="quantize-preview-banner"]')
      # Real audio paths; assertions include pending raw timers, disposed racks and buffer source.
      for first,second in [('quant','raw'),('raw','quant'),('beat','raw'),('raw','beat')]:
        result=page.evaluate("""async([first,second])=>{
          E.stopAllPlayback();
          const play=async(kind)=>{
            if(kind==='raw') await E.playPinballRecording(events,()=>callbacks++);
            if(kind==='quant') await E.playQuantizedPreview(S.getState().pinballQuantizePreview,S.getState().scale);
            if(kind==='beat') await E.startTransport();
          };
          await play(first);
          const previous=E.activeBufferSource;
          let stopped=!previous,disconnected=!previous;
          if(previous){const a=previous.stop.bind(previous),b=previous.disconnect.bind(previous);
            previous.stop=(...args)=>{stopped=true;return a(...args)};
            previous.disconnect=(...args)=>{disconnected=true;return b(...args)};}
          const oldRack=E.previewRack;
          await play(second);
          return {stopped,disconnected,oldEndedCleared:!previous||previous.onended===null,
            rawTimers:E.pinballTimers.length,snapshot:E.isSnapshotPlaying(),beat:S.getState().isPlaying,
            rackDisposed:first!=='raw'||oldRack.kick.disposed};
        }""",[first,second])
        assert result['stopped'] and result['disconnected'] and result['oldEndedCleared'] and result['rackDisposed'],result
        assert result['snapshot']==(second=='quant') and result['beat']==(second=='beat'),result
        assert (result['rawTimers']>0)==(second=='raw'),result
        page.get_by_test_id('beat-stop-btn').click()
        check(page,'!E.activeBufferSource && !E.snapshotActive && !S.getState().isPlaying && E.pinballTimers.length===0 && E.overlapRacks.size===0')
        # Observe across the last scheduled raw event, not just button state.
        check(page,"""async()=>{const n=callbacks;await new Promise(r=>setTimeout(r,2050));return callbacks===n}""")
        checks[first+'-to-'+second+'-stop']=True

      # Local original -> remix -> one action archive/share recursively.
      card=page.evaluate("""async(name)=>{
        S.getState().sendBeatToForge();
        S.getState().setForgeTitle('Review original '+name);
        const original=await S.getState().mintCurrentCard();
        if(!original) throw Error('original mint failed');
        S.getState().unsealAndRemixCard(original.id);
        S.getState().performBeatInPinball();
        const origin=JSON.stringify(S.getState().pinballShowRemixOrigin);
        S.setState({beatRemixOrigin:null});
        S.getState().sendPinballShowToForge();
        if(JSON.stringify(S.getState().forgeDraft.remixOrigin)!==origin) throw Error('theatre lineage changed');
        S.getState().setForgeTitle('Review remix '+name);
        const child=await S.getState().mintCurrentCard();
        const result=await client.syncCardToBackend(child,{ancestors:S.getState().mintedCards});
        if(result.status!=='SHARED') throw Error(JSON.stringify(result));
        window.reviewShare=result.share;
        return JSON.parse(JSON.stringify({original,child,share:result.share}));
      }""",name)
      checks['localAncestorThenRemixShare']=True
      page.wait_for_function('S.getState().mintedCards.find(c=>c.id===S.getState().inspectMintedId)?.waveformIsRealPcm===true')
      page.screenshot(path=str(SHOTS/f'{name}-forge.png'))
      # Second isolated browser album starts its own MY-01, then imports/rearchives existing work.
      other=browser.new_context(viewport={'width':1600,'height':1000})
      q=other.new_page();q.goto(base);attach(q)
      independent=q.evaluate("""async(name)=>{
        S.getState().sendBeatToForge();S.getState().setForgeTitle('Independent '+name);
        const c=await S.getState().mintCurrentCard();
        const result=await client.syncCardToBackend(c,{share:false});
        if(result.status!=='ARCHIVED') throw Error(JSON.stringify(result));
        return c;
      }""",name)
      assert independent['serialNumber']==card['original']['serialNumber']==1
      assert independent['libraryId']!=card['original']['libraryId']
      checks['independentAlbumsNumberOne']=True
      restored=q.evaluate("""async(card)=>{
        const ok=await S.getState().importProjectFile({schema:'holobeat.project.v3',exportedAt:Date.now(),kind:'minted-card',card});
        if(!ok) throw Error('import failed: '+JSON.stringify(S.getState().toasts));
        const imported=S.getState().mintedCards.find(c=>c.workId===card.id);
        const result=await client.syncCardToBackend(imported);
        if(result.status!=='SHARED') throw Error(JSON.stringify(result));
        return {imported,shared:await client.fetchSharedCard(result.share.token)};
      }""",card['original'])
      assert restored['imported']['id']!=card['original']['id']
      assert restored['shared']['id']==card['original']['id']
      checks['downloadImportCanonicalShare']=True
      other.close()
      exhibit=context.new_page();exhibit.goto(card['share']['shareUrl'])
      exhibit.get_by_role('button',name='▶ 试听音符轮廓').click()
      exhibit.get_by_role('button',name='■ 停止试听').click()
      exhibit.screenshot(path=str(SHOTS/f'{name}-share.png'))
      with exhibit.expect_download() as download:
        exhibit.locator('#dlBtn').click()
      file=Path(temp)/f'{name}-download.json';download.value.save_as(file)
      project=json.loads(file.read_text(encoding='utf-8'))
      assert page.evaluate('async p=>await S.getState().importProjectFile(p)',project)
      checks['sharedProjectDownloadImport']=True
      historic=json.loads((ROOT/'07_showcase/exports/hutong-groove.holobeat.json').read_text(encoding='utf-8'))
      result=page.evaluate('async p=>await client.repairArchivedCard(p.card)',historic)
      assert result['status']=='ARCHIVED',result
      exhibit.goto(api+'/share/review-history')
      with exhibit.expect_download() as download:
        exhibit.locator('#dlBtn').click()
      history_file=Path(temp)/f'{name}-historical.json';download.value.save_as(history_file)
      restored_history=json.loads(history_file.read_text(encoding='utf-8'))
      assert page.evaluate('async p=>await S.getState().importProjectFile(p)',restored_history)
      checks['historicalSqliteRepairDownloadImport']=True

      metrics['errors']=errors;assert not errors,errors
      metrics['version']=browser.version
      metrics['archiveIds']=[card['original']['id'],card['child']['id'],independent['id']]
    finally:browser.close()

def main():
    results={'timestampUtc':datetime.now(timezone.utc).isoformat(),'baseline':'e9ad983772c18aac6c39f3b2afb2abc94fa68023',
      'testedCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'browsers':{},'passed':False}
    node=shutil.which('node')
    try:
      with tempfile.TemporaryDirectory(dir=ROOT/'.cache') as temp:
        api_port=free_port([0]);port=free_port([4173,5173])
        api=f'http://127.0.0.1:{api_port}';base=f'http://127.0.0.1:{port}'
        original=json.loads((ROOT/'07_showcase/exports/hutong-groove.holobeat.json').read_text(encoding='utf-8'))['card']
        stored=json.loads(json.dumps(original))
        for key in ['capturedAt','rendererVersion','assetVersion','soundSeed','pinballEvents','pinballScene']:
          stored['snapshot'].pop(key,None)
        for event in stored['snapshot']['events']:
          for key in ['sourceX','sourceY','color']:event.pop(key,None)
        with sqlite3.connect(Path(temp)/'review.sqlite') as db:
          db.executescript((BACK/'tests/schema-v0.sql').read_text(encoding='utf-8'))
          columns=['id','serial_number','code','idempotency_key','title','rarity','foil','art_id','source_type','is_demo','lineage_depth','payload_json','created_at']
          values=[stored['id'],stored['serialNumber'],stored['code'],stored['idempotencyKey'],stored['title'],stored['rarity'],stored['foil'],stored['artId'],stored['sourceType'],0,0,json.dumps(stored),stored['createdAt']]
          db.execute('INSERT INTO minted_cards('+','.join(columns)+') VALUES('+','.join('?' for c in columns)+')',values)
          db.execute('INSERT INTO share_links(token,card_id,created_at) VALUES(?,?,?)',('review-history',stored['id'],stored['createdAt']))
        env={'PORT':str(api_port),'HOST':'127.0.0.1','HOLOBEAT_DB_PATH':str(Path(temp)/'review.sqlite')}
        with service([node,'--experimental-strip-types','src/server.ts'],BACK,env) as backend:
          wait_service(api+'/health',backend)
          assert get(api+'/generate')[0]==404
          assert b'holobeat.raw-archive.v1' in get(api+'/share/review-history')[1]
          with service([node,'node_modules/vite/bin/vite.js','--config','scripts/vite.reliability.config.ts',
              '--host','127.0.0.1','--port',str(port)],FRONT,{'VITE_HOLOBEAT_API_URL':api}) as front:
            wait_service(base,front)
            with sync_playwright() as p:
              for name in BROWSERS:
                metrics=results['browsers'][name]={}
                try:run_browser(p,name,base,api,metrics,temp)
                except Exception as e:
                  metrics['error']=str(e);print(name,str(e),flush=True)
          before=json.loads(get(api+'/health')[1])['cardsCount']
        with service([node,'--experimental-strip-types','src/server.ts'],BACK,env) as backend:
          wait_service(api+'/health',backend)
          after=json.loads(get(api+'/health')[1])['cardsCount']
          assert before==after and before>=6
          results['restart']={'before':before,'after':after}
        results['passed']=all('error' not in m and all(m['checks'].values()) for m in results['browsers'].values())
    finally:REPORT.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if not results['passed']:raise SystemExit(1)
if __name__=='__main__':main()
