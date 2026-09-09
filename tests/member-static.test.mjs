import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildMemberSnapshot,prepareMemberSnapshot,serveMemberSnapshot} from '../src/member-static.js';
const makePost=()=>({id:186700,lottery_type:1,period:'member-v2:【三中三】',title:'测试作者',hit_status:'20',updated_at:'2026-09-09 09:21:27'});
function setup(post=makePost()) {
  const kv=new Map(),calls=[];
  const env={
    DB:{prepare(){return {bind(){return {first:async()=>post};}};}},
    ASSETS_KV:{put:async(k,v,opts)=>kv.set(k,{value:v,metadata:opts.metadata}),getWithMetadata:async k=>kv.get(k)||{value:null,metadata:null}},
    STATIC_ASSETS:{fetch:async()=>new Response('<style>.record{color:red}</style>')},
    CENTRAL_LINKS:{fetch:async request=>Response.json(request.url.includes('/ads')?{success:true,data:[{position_key:'master-detail-bottom',image_url:'https://example.org/banner.png',link_url:'https://example.org/'}]}:{success:true,data:[{global_footer_html:'<p>公共页脚</p>'}]})}
  };
  const fetch=async url=>{calls.push(String(url));return Response.json({code:10000,data:{pager:{totalPageCount:1},recordList:[97,96].map(period=>({period,numberList:Array.from({length:7},(_,i)=>({number:String(i+1),shengXiao:'鼠'}))}))}});};
  return {env,kv,calls,fetch};
}
test('publication creates full HTML and requests serve it without data calls',async()=>{
  const {env,calls,fetch}=setup();
  const original=globalThis.fetch;globalThis.fetch=fetch;
  try{
    assert.equal(await prepareMemberSnapshot(186700,env),true);
    const count=calls.length;
    globalThis.fetch=async()=>{throw new Error('must not fetch on cache hit');};
    const response=await serveMemberSnapshot(new Request('https://example.org/yixiao-member-preview.html?id=186700'),env,{waitUntil(){throw new Error('fresh snapshot must not refresh');}});
    const html=await response.text();
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.ok(html.includes('096期：'));assert.ok(html.includes('097期：'));assert.ok(html.includes('098期：'));
    assert.ok(html.includes('公共页脚'));assert.ok(html.includes('banner.png'));
    assert.ok(html.includes('/api/member-post-register'));
    assert.ok(!html.includes('<script'));assert.ok(!html.includes('secure-loader'));assert.ok(!html.includes('正在加载'));
    assert.equal(calls.length,count);
  }finally{globalThis.fetch=original;}
});
test('hidden posts never serve cached pages',async()=>{
  const {env,kv}=setup(null);kv.set('member-html:v1:186700:2026-09-09 09:21:27',{value:'PRIVATE HTML'});
  const response=await serveMemberSnapshot(new Request('https://example.org/yixiao-member-preview.html?id=186700'),env,{});
  assert.equal(response.status,404);assert.ok(!(await response.text()).includes('PRIVATE HTML'));
});
test('old posts generate on first request and stale snapshots refresh in background',async()=>{
  const {env,kv,fetch}=setup(),original=globalThis.fetch;globalThis.fetch=fetch;
  try{
    const request=new Request('https://example.org/yixiao-member-preview.html?id=186700');
    assert.equal((await serveMemberSnapshot(request,env,{})).status,200);
    for(const value of kv.values())value.metadata.builtAt=1;
    const tasks=[];
    assert.equal((await serveMemberSnapshot(request,env,{waitUntil:p=>tasks.push(p)})).status,200);
    assert.equal(tasks.length,1);await Promise.all(tasks);
  }finally{globalThis.fetch=original;}
});
test('escapes author markup in HTML',async()=>{
  const post={...makePost(),title:'<img src=x onerror=alert(1)>'}, {env,fetch}=setup(post),original=globalThis.fetch;globalThis.fetch=fetch;
  try{const html=await buildMemberSnapshot(post,env);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));}finally{globalThis.fetch=original;}
});
test('bad IDs and failed history have no default example content',async()=>{
  const {env}=setup(),original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('offline');};
  try{
    assert.equal((await serveMemberSnapshot(new Request('https://example.org/yixiao-member-preview.html?id=-1'),env,{})).status,404);
    const response=await serveMemberSnapshot(new Request('https://example.org/yixiao-member-preview.html?id=186700'),env,{});
    assert.equal(response.status,503);const html=await response.text();assert.ok(!html.includes('斩钉截铁'));assert.ok(!html.includes('245期'));
  }finally{globalThis.fetch=original;}
});
