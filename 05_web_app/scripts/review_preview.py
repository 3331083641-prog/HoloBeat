"""Production bundles only: no source imports or store injection."""
import json, shutil, subprocess, tempfile, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from reliability_e2e import ROOT, FRONT, BACK, service, free_port, wait_service, get, wav_stats
from pinball_recording_e2e import BROWSERS
from review_e2e import SHOTS

def main():
  node=shutil.which('node')
  report={'passed':False,'testedCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'modes':{}}
  try:
    # Keep normal dist intact while generating a genuinely rebased second bundle.
    with (ROOT/'.cache/review-subpath-build.log').open('w',encoding='utf-8') as log:
      subprocess.run([node,'node_modules/vite/bin/vite.js','build','--base','/holobeat/',
        '--outDir','../.cache/review-dist-sub'],cwd=FRONT,stdout=log,stderr=subprocess.STDOUT,check=True)
    with tempfile.TemporaryDirectory(dir=ROOT/'.cache') as temp:
      ap=free_port([0]);api=f'http://127.0.0.1:{ap}'
      with service([node,'--experimental-strip-types','src/server.ts'],BACK,{
        'HOST':'127.0.0.1','PORT':str(ap),'HOLOBEAT_DB_PATH':str(Path(temp)/'preview.sqlite')}) as backend:
        wait_service(api+'/health',backend);assert get(api+'/generate')[0]==404
        for mode,basepath,dist in [('root','/','dist'),('subpath','/holobeat/','../.cache/review-dist-sub')]:
          port=free_port([0]);url=f'http://127.0.0.1:{port}'+basepath
          with service([node,'node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',str(port),
            '--base',basepath,'--outDir',dist],FRONT,{}) as preview:
            wait_service(url,preview)
            with sync_playwright() as p:
              for name,exe in BROWSERS.items():
                browser=p.chromium.launch(executable_path=str(exe),headless=True,args=['--autoplay-policy=no-user-gesture-required'])
                try:
                  context=browser.new_context(viewport={'width':1600,'height':1000},accept_downloads=True)
                  page=context.new_page();errors=[];bad=[]
                  page.on('pageerror',lambda e:errors.append(str(e)))
                  page.on('response',lambda r:bad.append(r.url) if r.status>=400 and '/assets/' in r.url else None)
                  page.goto(url)
                  page.get_by_test_id('nav-beat').click()
                  pad=page.get_by_test_id('pad-0-0');old=pad.get_attribute('aria-pressed')
                  pad.focus();page.keyboard.press('Enter')
                  expect(pad).to_have_attribute('aria-pressed','false' if old=='true' else 'true')
                  page.get_by_test_id('beat-play-btn').click()
                  expect(page.get_by_test_id('beat-play-btn')).to_contain_text('暂停')
                  page.get_by_test_id('beat-stop-btn').click()
                  expect(page.get_by_test_id('beat-play-btn')).to_contain_text('播放')
                  page.get_by_test_id('nav-forge').click()
                  page.get_by_test_id('forge-play-btn').wait_for()
                  # Load every shipped raster through the actual deployed BASE_URL.
                  images=page.evaluate("""async base=>{
                    const cards=['cicada-moon','street-bell','bamboo-cat','arcade-bot','chestnut-pop','lion-drum',
                      'soda-frog','mahjong-fox','street-rattle','lucky-coin','sugar-spoon','cyber-zither',
                      'ferris-box','night-sizzle','rain-cloud','neon-tape'];
                    const paths=[...cards.map(x=>'cards/'+x+'.webp'),
                      ...['clapper','bell','coin','spoon','spatula','cassette','raindrop','cicada','bolt','note','starburst','crown'].map(x=>'stickers/'+x+'.webp'),
                      'scenes/pinball_stage_bg.webp'];
                    for(const path of paths){const image=new Image();image.src=base+'assets/'+path;await image.decode();
                      if(!image.naturalWidth)throw Error(path);}
                    const shown=[...document.images];
                    await Promise.all(shown.map(i=>i.decode()));
                    return {decoded:paths.length,visible:shown.length,paths:shown.map(i=>new URL(i.src).pathname)};
                  }""",basepath)
                  assert images['decoded']==29
                  assert all(path.startswith(basepath) for path in images['paths']),images
                  with page.expect_download(timeout=60000) as pending:
                    page.get_by_test_id('forge-export-wav').click()
                  wav=Path(temp)/f'{mode}-{name}.wav';pending.value.save_as(wav)
                  pcm=wav_stats(wav)
                  page.screenshot(path=str(SHOTS/f'{name}-preview-{mode}.png'))
                  assert not errors and not bad,(errors,bad)
                  report['modes'][mode+'-'+name]={'passed':True,'wav':pcm,'images':images,'pageErrors':errors,'assetErrors':bad}
                finally:browser.close()
    report['passed']=len(report['modes'])==4 and all(m['passed'] for m in report['modes'].values())
  finally:
    (ROOT/'07_showcase/reports/review_preview_metrics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  if not report['passed']:raise SystemExit(1)
if __name__=='__main__':main()
