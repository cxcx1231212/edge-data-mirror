import { handleApi } from './public-api.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyFor = post => `member-html:v1:${post.id}:${post.updated_at}`;
const postQuery = "SELECT id,lottery_type,period,source_name AS title,content,hit_status,updated_at FROM materials WHERE id=? AND section_key='member' AND published=1 LIMIT 1";
const responseHtml = (html, status=200) => new Response(html,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const errorPage = message => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>会员贴</title><body style="background:#101010;color:#e6c45e;font:16px system-ui;text-align:center;padding:48px 16px"><p>${escape(message)}</p><a href="/" style="color:inherit">返回首页</a></body></html>`;

async function apiJson(path, env) {
  const response = await handleApi(new Request('https://member.internal'+path),env);
  if (!response?.ok) throw new Error('member_static_upstream_failed: '+path);
  return response.json();
}
function buildContext(env) {
  const memo = new Map();
  return (key, load) => {
    if (!memo.has(key)) memo.set(key,load());
    return memo.get(key);
  };
}
async function historyRecords(type, env) {
  const year = new Date().getUTCFullYear();
  const read = x => x?.data?.recordList || x?.recordList || x?.data?.list || x?.list || [];
  const first = await apiJson(`/api/history.php?lotteryType=${type}&pageNum=1&year=${year}`,env);
  const pages = Math.min(20,Math.max(1,Number(first?.data?.pager?.totalPageCount || first?.pager?.totalPageCount)||1));
  const all = [...read(first)];
  // Limit concurrent upstream requests while preparing a snapshot.
  for (let p=2;p<=pages;p+=4) {
    const batch = await Promise.all(Array.from({length:Math.min(4,pages-p+1)},(_,i)=>apiJson(`/api/history.php?lotteryType=${type}&pageNum=${p+i}&year=${year}`,env)));
    all.push(...batch.flatMap(read));
  }
  return all.map(record=>{
    const match=String(record.period||record.issueNo||'').match(/(\d{1,3})$/),balls=(record.numberList||[]).filter(b=>b?.shengXiao);
    return match&&balls.length?{issue:Number(match[1]),period:match[1].padStart(3,'0'),balls}:null;
  }).filter(Boolean).sort((a,b)=>a.issue-b.issue);
}
export async function buildMemberSnapshot(post,env,memo=buildContext(env)) {
  const type=[1,5,8].includes(Number(post.lottery_type))?Number(post.lottery_type):5;
  const [template,history,footer,ads] = await Promise.all([
    memo('template',async()=>{const r=await env.STATIC_ASSETS.fetch(new Request('https://member.internal/yixiao-member-preview.html'));if(!r.ok)throw new Error('member_template_unavailable');return r.text();}),
    memo('history:'+type,()=>historyRecords(type,env)),
    memo('footer',()=>apiJson('/api/shared-footer',env).catch(()=>null)),
    memo('ads',()=>apiJson('/api/ads.php',env).catch(()=>null))
  ]);
  const modern=String(post.period||'').startsWith('member-v2:');
  const kind=(modern?String(post.period).slice(10):(String(post.content||'').match(/《[^》]+》\s*([^【\r\n]+)/)?.[1]||'平特一肖')).replace(/^【|】$/g,'').trim();
  const author=String(post.title||'平特主任').replace(/^《|》$/g,'');
  const limit=Math.max(1,Math.min(100,Number(post.hit_status)||Number(String(post.title||'').match(/【(\d+)期中\d+期】/)?.[1])||20));
  const records=history.slice(-limit);
  if(!records.length)throw new Error('member_history_unavailable');
  const span=(text,color)=>`<span style="color:${color};font-weight:900">${escape(text)}</span>`;
  const prefix=period=>span(period+'期：','#f5c84b')+span('《'+author+'》','#25d6e8')+span(kind,'#b561ff');
  const rows=records.map(record=>{
    const seed=[...String(post.id)+record.period].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7),regular=record.balls.slice(0,6);
    const count=kind.includes('三中三')?3:kind.includes('二中二')?2:0;
    const offset=seed%Math.max(1,regular.length-count+1);
    const value=count?regular.slice(offset,offset+count).map(b=>String(b.number).padStart(2,'0')).sort((a,b)=>Number(a)-Number(b)).join(' '):record.balls[seed%record.balls.length].shengXiao;
    return `<div class="record">${prefix(record.period)}${span('【'+value+'】','#ff4b4b')}${span('准','#f5c84b')}</div>`;
  });
  const next=String(records.at(-1).issue+1).padStart(3,'0');
  rows.push(`<div class="record">${prefix(next)}<a href="/api/member-post-register" target="_blank" rel="noopener noreferrer" style="color:#ff4b4b;font-weight:900;text-decoration:none">【注册提前看料】</a></div>`);
  const title=next+'期: '+author+'→【'+kind+'】【'+limit+'期中'+limit+'期】';
  const style=template.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
  const safeUrl=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?escape(u.href):'';}catch{return '';}};
  const ad=ads?.ads?.detail,image=safeUrl(ad?.image),link=safeUrl(ad?.link);
  const adHtml=image?`<a href="${link||'#'}" target="_blank" rel="noopener noreferrer" style="display:block;margin:10px 0 14px;line-height:0"><img src="${image}" alt="内容页广告" style="display:block;width:100%;height:auto"></a>`:'';
  const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escape(author+'【'+kind+'】')}</title><style>${style}</style></head><body><div class="site" data-member-static="v1"><header class="topbar"><a class="back" href="/">返回</a><strong class="inner-title">${escape(kind)}会员贴</strong><span class="top-spacer"></span></header><main class="page"><section class="panel"><h1>${escape(title)}</h1><p class="notice">本资料最早发布在平特一肖高手榜，往期记录可查</p><div class="records">${rows.join('')}</div><div class="shared-detail-footer" id="sharedFooter">${footer?.success?footer.html||'':''}</div></section></main><div id="memberDetailAd">${adHtml}</div><footer class="site-footer"><strong>一路发平特一肖资料站</strong><p>资料仅供参考，请理性浏览</p><p>© ${new Date().getUTCFullYear()} 平特资料站</p><a class="to-top" href="#">返回顶部</a></footer></div></body></html>`;
  await env.ASSETS_KV.put(keyFor(post),html,{metadata:{builtAt:Date.now()}});
  return html;
}
export async function prepareMemberSnapshot(id,env) {
  const post=await env.DB.prepare(postQuery).bind(id).first();
  if(!post)return false;
  await buildMemberSnapshot(post,env);
  return true;
}
export async function serveMemberSnapshot(request,env,ctx) {
  const id=Number(new URL(request.url).searchParams.get('id'));
  if(!Number.isSafeInteger(id)||id<=0)return responseHtml(errorPage('会员贴不存在'),404);
  try {
    // Always check publication status; hiding/deleting a post takes effect even with a saved HTML snapshot.
    const post=await env.DB.prepare(postQuery).bind(id).first();
    if(!post)return responseHtml(errorPage('会员贴不存在或已隐藏'),404);
    const cached=await env.ASSETS_KV.getWithMetadata(keyFor(post),'text');
    if(cached.value) {
      if(Date.now()-Number(cached.metadata?.builtAt||0)>15*60*1000)ctx.waitUntil(buildMemberSnapshot(post,env).catch(e=>console.error('member_snapshot_refresh_failed',id,e.message)));
      return responseHtml(cached.value);
    }
    return responseHtml(await buildMemberSnapshot(post,env));
  } catch(error) {
    console.error('member_snapshot_failed',id,error.message);
    return responseHtml(errorPage('会员贴暂时无法读取，请稍后重试'),503);
  }
}
export async function refreshMemberSnapshots(env) {
  const memo=buildContext(env);
  const {results=[]}=await env.DB.prepare("SELECT id,lottery_type,period,source_name AS title,content,hit_status,updated_at FROM materials WHERE section_key='member' AND published=1 ORDER BY id DESC LIMIT 50").all();
  for(const post of results) {
    try {await buildMemberSnapshot(post,env,memo);}catch(e){console.error('member_snapshot_refresh_failed',post.id,e.message);}
  }
}
