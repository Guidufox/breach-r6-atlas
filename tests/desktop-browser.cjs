'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'../_site');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).once('open',()=>res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream')).pipe(res);
});

(async()=>{
  assert.ok(fs.existsSync(path.join(root,'index.html')),'Build the site first');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    for(const viewport of [{width:1366,height:768},{width:1920,height:1080},{width:1024,height:768}]){
      const context=await browser.newContext({viewport});
      const page=await context.newPage();
      await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
      await page.locator('#mapHost svg').waitFor();
      assert.equal(await page.locator('.intro-strip').count(),0,'No introductory banner in first view');
      assert.equal(await page.locator('#updatesBtn').isVisible(),false,'Maintenance actions start collapsed');
      assert.equal(await page.locator('[data-mode="plan"]').isVisible(),false,'Strategy starts in More');
      assert.equal(await page.locator('[data-mode="study"]').isVisible(),false,'Practice starts in More');
      assert.equal(await page.locator('#teamRoomBtn').isVisible(),false,'Team starts in More');
      await page.locator('#moreMenu summary').click();
      await page.locator('[data-mode="study"]').click();
      await page.locator('#studyPrompt').waitFor({state:'visible'});
      await page.locator('[data-mode="explore"]').click();
      await page.locator('#studyPrompt').waitFor({state:'hidden'});

      await page.locator('#moreMenu summary').click();
      await page.locator('#updatesBtn').click();
      await page.locator('#updatesDialog').waitFor({state:'visible'});
      await page.locator('#updatesDialog [data-close]').click();
      assert.equal(await page.locator('#moreMenu').getAttribute('open'),null,'Menu closes after action');

      const layout=await page.evaluate(()=>({
        width:innerWidth,scroll:document.documentElement.scrollWidth,
        stage:document.querySelector('#mapStage').getBoundingClientRect().toJSON(),
        expand:document.querySelector('#expandMapBtn').getBoundingClientRect().toJSON()
      }));
      assert.ok(layout.scroll<=layout.width+1,'Desktop horizontal overflow: '+JSON.stringify(layout));
      assert.ok(layout.stage.height>=300,'Desktop map must have usable height: '+JSON.stringify(layout));
      assert.ok(layout.expand.width>80&&layout.expand.right<=viewport.width,'Fullscreen button must be visible');
      await page.keyboard.press('f');
      await page.waitForFunction(()=>document.fullscreenElement?.id==='mapStage');
      await page.locator('#fullscreenLanguageSelect').selectOption('en');
      assert.equal(await page.locator('#mapTitle').innerText(),'Bank');
      await page.locator('#fullscreenMapSelect').selectOption('chalet');
      await page.waitForFunction(()=>document.querySelector('#mapHost svg')?.getAttribute('aria-label')==='Chalet');
      await page.locator('#fullscreenFloorSelect').selectOption('0');
      assert.match(await page.locator('#canvasLabel').innerText(),/\/ B$/);
      await page.keyboard.press('f');
      await page.waitForFunction(()=>!document.fullscreenElement);
      await page.locator('#expandMapBtn').click();
      await page.waitForFunction(()=>document.fullscreenElement?.id==='mapStage');
      await page.keyboard.press('f');
      await page.waitForFunction(()=>!document.fullscreenElement);
      await page.evaluate(()=>{document.querySelector('#mapStage').requestFullscreen=()=>Promise.reject(new Error('Blocked in embedded browser'));});
      await page.keyboard.press('f');
      await page.waitForFunction(()=>document.querySelector('#mapStage').classList.contains('fullscreen-fallback'));
      const expanded=await page.locator('#mapStage').boundingBox();
      assert.ok(Math.abs(expanded.x)<1&&Math.abs(expanded.y)<1&&expanded.width>=viewport.width-1&&expanded.height>=viewport.height-1,'Fallback must fill desktop viewport: '+JSON.stringify(expanded));
      await page.locator('#fullscreenLanguageSelect').selectOption('es');
      await page.locator('#fullscreenMapSelect').selectOption('bank');
      await page.waitForFunction(()=>document.querySelector('#mapHost svg')?.getAttribute('aria-label')==='Banco');
      await page.locator('#fullscreenFloorSelect').selectOption('2');
      assert.match(await page.locator('#canvasLabel').innerText(),/\/ 2F$/);
      await page.keyboard.press('f');
      await page.waitForFunction(()=>!document.querySelector('#mapStage').classList.contains('fullscreen-fallback'));
      await page.locator('#expandMapBtn').click();
      await page.waitForFunction(()=>document.querySelector('#mapStage').classList.contains('fullscreen-fallback'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('#mapStage').classList.contains('fullscreen-fallback'));
      await page.locator('#mapSearch').fill('f');
      assert.equal(await page.evaluate(()=>!!document.fullscreenElement||document.querySelector('#mapStage').classList.contains('fullscreen-fallback')),false,'Typing in search must not expand map');
      console.log('Desktop '+viewport.width+'x'+viewport.height+': layout, F, header button, native and fallback selectors, F after selectors, Escape OK');
      await context.close();
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
