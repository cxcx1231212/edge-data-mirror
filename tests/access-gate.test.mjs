import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {issueSession,SESSION_COOKIE,SESSION_SECONDS} from '../src/access-gate.js';
const secret='test-only-credential-'.repeat(3);
const origin='https://site.example';
const env={BUSINESS_ACCESS_TOKEN:secret,STATIC_ASSETS:{fetch:async()=>new Response('<html><title>Business</title><a href="/">Home</a></html>')}};
const req=(path,headers={},method='GET')=>new Request(origin+path,{headers,method});
const run=(path,headers={},e=env,method='GET')=>worker.fetch(req(path,headers,method),e,{});
test('four entry cases, isolated navigation, cookie, no token in response',async()=>{
  const nav=await run('/');assert.equal(nav.status,200);const html=await nav.text();assert.match(html,/常用网址导航/);assert.doesNotMatch(html,/page-loader|Business|api\//);
  const valid=await run('/?t='+encodeURIComponent(secret));assert.equal(valid.status,200);const entry=await valid.text();assert.match(entry,/<iframe[^>]+src="\/index.html"/);assert.doesNotMatch(entry,/page-loader|history.replaceState/);assert.ok(!entry.includes(secret));
  const cookie=valid.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);assert.ok(!cookie.includes(secret));
  for(const path of ['/?t','/?t=','/?t=wrong','/?t='+secret+'&t='+secret])assert.equal((await run(path)).status,403);
  assert.equal((await run('/?t='+secret,{},{})).status,403);
});
test('HTML, aliases, JSON, APIs and member snapshots require session',async()=>{
  for(const path of ['/index.html','/index','/history','/history.html','/yixiao-member-preview.html?id=186700','/api/page.php?path=/index.html','/api/lottery.php','/api/bypass.js','/wuqi-data.php','/tmzs.json','/%69ndex.html'])assert.equal((await run(path)).status,403,path);
  const cookie=SESSION_COOKIE+'='+await issueSession(secret,origin);
  const inner=await run('/index.html',{cookie});assert.equal(inner.status,200);const innerHtml=await inner.text();assert.match(innerHtml,/page-loader/);assert.doesNotMatch(innerHtml,/<iframe/);
  const payload=await run('/api/page.php?path=/index.html',{cookie});assert.equal(payload.status,200);assert.match((await payload.json()).html,/href="\/index.html"/);
  assert.equal(payload.headers.get('cache-control'),'private, no-store');assert.equal(payload.headers.get('access-control-allow-origin'),null);
  assert.equal((await run('/?t=',{cookie})).status,403);assert.match(await (await run('/',{cookie})).text(),/常用网址导航/);
});
test('tampering, expiry, rotation, origin binding and cross-site mutation rejected',async()=>{
  const value=await issueSession(secret,origin);const cookie=SESSION_COOKIE+'='+value;
  assert.equal((await run('/index.html',{cookie:cookie+'bad'})).status,403);
  assert.equal((await run('/index.html',{cookie}, {...env,BUSINESS_ACCESS_TOKEN:secret+'new'})).status,403);
  for(const session of [await issueSession(secret,origin,Date.now()-(SESSION_SECONDS+5)*1000),await issueSession(secret,'https://other.example')])assert.equal((await run('/index.html',{cookie:SESSION_COOKIE+'='+session})).status,403);
  assert.equal((await run('/api/message',{cookie,origin:'https://other.example'},env,'POST')).status,403);
});
test('resources remain loadable and HEAD has no body',async()=>{
  for(const path of ['/assets/x.css','/assets/x.js','/image.png'])assert.equal((await run(path)).status,200);
  for(const path of ['/','/?t='+secret]){const r=await run(path,{},env,'HEAD');assert.equal(r.status,200);assert.equal(await r.text(),'');}
});
