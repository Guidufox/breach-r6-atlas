const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const crypto=require('node:crypto');
test('CSP allows only hashed executable inline scripts and keeps unsafe-eval disabled',()=>{const html=fs.readFileSync('index.html','utf8');const csp=/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];assert(!csp.includes("'unsafe-eval'"));assert(!/script-src[^;]*'unsafe-inline'/.test(csp));for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(/\bsrc=/.test(m[0]))continue;const hash=crypto.createHash('sha256').update(m[1]).digest('base64');assert(csp.includes("'sha256-"+hash+"'"));}assert(csp.includes("object-src 'none'"));});
test('PDF and operator catalogue are not startup dependencies',()=>{const html=fs.readFileSync('index.html','utf8');assert(!/<script[^>]*src="vendor\/jspdf/.test(html));assert(!/<script[^>]*src="operators-data/.test(html));});
test('GitHub action versions are full immutable commit hashes',()=>{for(const name of fs.readdirSync('.github/workflows')){const text=fs.readFileSync('.github/workflows/'+name,'utf8');for(const m of text.matchAll(/uses:\s+([^\s]+)/g))if(m[1].startsWith('actions/'))assert(/@[a-f0-9]{40}$/.test(m[1]),m[1]);}});
test('Public branding uses the original mark and makes R6Calls credit directly accessible',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const builder=fs.readFileSync('tools/build_site.py','utf8');
  const guideBuilder=fs.readFileSync('tools/build_seo.py','utf8');
  assert.match(html,/<link rel="icon" href="icon\.svg" type="image\/svg\+xml">/);
  assert.match(html,/<img class="brand-logo" src="icon\.svg" alt=""/);
  assert.match(html,/<a class="source-credit" href="https:\/\/www\.r6calls\.com\/"/);
  assert(!html.includes('r6-logo.png'));
  assert(!builder.includes("'r6-logo.png'"));
  assert(!guideBuilder.includes('r6-logo.png'));
});
