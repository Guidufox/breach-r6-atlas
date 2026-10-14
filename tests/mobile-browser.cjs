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
const touch=(session,type,points)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],i)=>({x,y,id:i+1}))});
const zoomValue=async page=>Number((await page.locator('#zoomValue').innerText()).replace('%',''));

(async()=>{
  assert.ok(fs.existsSync(path.join(root,'index.html')),'Run python3 tools/build_site.py first');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    for(const viewport of [{width:390,height:844},{width:360,height:740}]){
      const context=await browser.newContext({viewport,deviceScaleFactor:2,isMobile:true,hasTouch:true});
      const page=await context.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
      await page.locator('#mapHost svg').waitFor();
      const size=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth,stage:document.querySelector('#mapStage').getBoundingClientRect().toJSON(),zoomVisible:!!document.querySelector('#zoomIn').getBoundingClientRect().width}));
      assert.ok(size.scroll<=size.width+1,`Horizontal overflow at ${viewport.width}px: ${size.scroll}px`);
      assert.ok(size.stage.width>=viewport.width-2&&size.stage.height>=200,`Map too small at ${viewport.width}px`);
      assert.ok(size.zoomVisible,'Zoom controls must be available');
      const start=await zoomValue(page);await page.locator('#zoomIn').click();assert.ok(await zoomValue(page)>start,'Zoom button enlarges the map');
      const session=await context.newCDPSession(page),x=size.stage.x+size.stage.width/2,y=size.stage.y+size.stage.height*.43;
      await page.evaluate(()=>{window.mobileEvents=[];for(const name of ['pointerdown','pointermove','pointerup','pointercancel'])document.querySelector('#mapStage').addEventListener(name,e=>window.mobileEvents.push([name,e.pointerId,e.pointerType,Math.round(e.clientX),Math.round(e.clientY)]),true);});
      const before=await zoomValue(page);
      await touch(session,'touchStart',[[x-30,y],[x+30,y]]);
      await touch(session,'touchMove',[[x-65,y],[x+65,y]]);
      assert.ok(await zoomValue(page)>before,`Pinch must enlarge at ${viewport.width}px`);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));
      const previous=await page.locator('#mapHost svg').getAttribute('viewBox');
      await touch(session,'touchMove',[[x-45,y+25],[x+85,y+25]]);
      await page.waitForFunction(()=>window.mobileEvents.filter(e=>e[0]==='pointermove').length>=4);
      const panned=await page.locator('#mapHost svg').getAttribute('viewBox');
      assert.notEqual(panned,previous,`Two-finger movement must pan; events: ${JSON.stringify(await page.evaluate(()=>window.mobileEvents))}`);
      await touch(session,'touchEnd',[]);
      if(viewport.width===390){
        assert.equal(await page.locator('#operatorSettingsBtn').count(),0);
        await page.locator('[data-tool="operator"]').click();await page.locator('#operatorSelect').selectOption('osa');
        await page.locator('#operatorPlace').click();await page.locator('#mapStage').tap({position:{x:size.stage.width*.6,y:size.stage.height*.48}});
        const badge=page.locator('[data-operator-handle]');await badge.waitFor();
        const at=await badge.boundingBox(),old=Number(await badge.getAttribute('cx'));
        await touch(session,'touchStart',[[at.x+at.width/2,at.y+at.height/2]]);
        await touch(session,'touchMove',[[at.x+at.width/2+38,at.y+at.height/2+18]]);
        await touch(session,'touchEnd',[]);
        assert.ok(Math.abs(Number(await badge.getAttribute('cx'))-old)>3,'One-finger operator drag must move it');
        await page.reload();await badge.waitFor();assert.ok(Math.abs(Number(await badge.getAttribute('cx'))-old)>3,'Drag must persist after reload');
      }
      const beforeFullscreen=await page.locator('#mapHost svg').getAttribute('viewBox');
      await page.locator('#fullscreenBtn').click();
      await page.waitForFunction(()=>document.fullscreenElement?.id==='mapStage');
      await page.waitForFunction(()=>{
        const stage=document.querySelector('#mapStage').getBoundingClientRect(),map=document.querySelector('#mapHost svg [id$="-pic"]:not([display="none"])')?.getBoundingClientRect();
        return map&&Math.abs((map.top+map.bottom)/2-(stage.top+stage.bottom)/2)<stage.height*.16;
      });
      const full=await page.evaluate(()=>{
        const stage=document.querySelector('#mapStage').getBoundingClientRect(),map=document.querySelector('#mapHost svg [id$="-pic"]:not([display="none"])')?.getBoundingClientRect();
        const tools=document.querySelector('.canvas-tools').getBoundingClientRect(),zoom=document.querySelector('.zoom-tools').getBoundingClientRect();
        return {stage:stage.toJSON(),map:map?.toJSON(),tools:tools.toJSON(),zoom:zoom.toJSON()};
      });
      assert.ok(full.stage.height>=viewport.height-2,`Fullscreen stage must fill ${viewport.height}px: ${JSON.stringify(full)}`);
      assert.ok(full.map&&Math.abs((full.map.top+full.map.bottom)/2-(full.stage.top+full.stage.bottom)/2)<full.stage.height*.16,`Fullscreen map must be centered: ${JSON.stringify(full)}`);
      assert.ok(full.tools.bottom+8<=full.zoom.top,`Fullscreen controls must not overlap: ${JSON.stringify(full)}`);
      assert.ok(full.tools.width<full.stage.width-20,`Fullscreen drawing tools must stay compact: ${JSON.stringify(full)}`);
      await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>!document.fullscreenElement);
      assert.equal(await page.locator('#mapHost svg').getAttribute('viewBox'),beforeFullscreen,'Leaving fullscreen must restore the previous view');
      console.log(`Mobile ${viewport.width}x${viewport.height}: layout, buttons, pinch, pan and fullscreen OK`);
      await context.close();
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
