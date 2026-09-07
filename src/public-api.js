const json = (data, status=200) => Response.json(data, {status,headers:{"access-control-allow-origin":"*","cache-control":"no-store"}});
const validTypes = new Set([1,5,8]);

export async function handleApi(request, env) {
  const url=new URL(request.url),path=url.pathname;
  if((path==="/api/data.php"||path==="/api/materials.php")&&request.method==="GET")return materials(url,env.DB,path.endsWith("data.php")?500:100);
  if(path==="/api/ads.php"&&request.method==="GET")return ads(env.DB,env);
  if(path==="/api/site-links"&&request.method==="GET")return siteLinks(env);
  if(path==="/api/text-ads"&&request.method==="GET")return textAds(env);
    if(path==="/api/member-posts"&&request.method==="GET")return memberPosts(url,env);
  if(path==="/api/track.php"&&request.method==="POST")return track(request,env.DB);
  if(path==="/api/track-ad.php"&&request.method==="POST")return trackAd(request,env.DB);
  if(path==="/api/wuqi.php"&&request.method==="GET")return handleWuqi(url);
  if(path==="/api/lottery.php"&&request.method==="GET")return lottery(url);
  if(path==="/api/history.php"&&request.method==="GET")return history(url);
  if(path==="/api/chat/v1"&&(request.method==="GET"||request.method==="POST"))return serviceChat(request);
  return null;
}
async function memberPosts(url,env){
  const db=env.DB,id=Math.max(0,Number(url.searchParams.get("id")||0));
  const nextPeriod=async type=>{try{const response=await fetch(`https://6htv70.com/gallerynew/h5/index/lastLotteryRecord?lotteryType=${type}`,{headers:{accept:"application/json","user-agent":"Mozilla/5.0"}}),payload=await response.json(),data=payload?.data||{},current=Number(data.period||data.intPeriod||0),next=Number(data.nextLotteryNumber||data.nextIntLotteryNumber||0);return String(next||current+1||"");}catch{return "";}};
  const view=(row,next)=>{const raw=String(row.period||""),modern=raw.startsWith("member-v2:");if(!modern)return {...row,title:row.source_name,history:Number(row.hit_status)||20};const author=String(row.source_name||""),kind=raw.slice(10),history=Math.min(200,Math.max(1,Number(row.hit_status)||20)),kindText=/^[【\[]/.test(kind)?kind:`【${kind}】`,title=(next?next+"期：":"")+author+"→"+kindText+`【${history}期中${history}期】`;return {...row,title,author,type:kind,current_data:row.content,history};};
  if(id){const post=await db.prepare("SELECT id,lottery_type,source_name,period,content,COALESCE(NULLIF(result_special,''),'yixiao') AS board,hit_status,created_at,updated_at FROM materials WHERE id=? AND section_key='member' AND published=1 LIMIT 1").bind(id).first();if(!post)return json({success:false,message:"会员贴不存在"},404);return json({success:true,post:view(post,await nextPeriod(Number(post.lottery_type)||5))});}
  const type=validTypes.has(Number(url.searchParams.get("lotteryType")))?Number(url.searchParams.get("lotteryType")):5,limit=Math.min(50,Math.max(1,Number(url.searchParams.get("limit")||20))),{results=[]}=await db.prepare("SELECT id,lottery_type,source_name,period,content,COALESCE(NULLIF(result_special,''),'yixiao') AS board,hit_status,created_at,updated_at FROM materials WHERE section_key='member' AND published=1 AND (lottery_type=? OR result_special IS NULL OR result_special='') ORDER BY id DESC LIMIT ?").bind(type,limit).all(),next=await nextPeriod(type);
  return json({success:true,posts:results.map(row=>view(row,next))});
}
async function upstreamJson(target){
  try{const response=await fetch(target,{headers:{accept:"application/json","user-agent":"Mozilla/5.0"}});if(!response.ok)throw new Error(`HTTP ${response.status}`);const payload=await response.json();return json(payload);}catch(error){console.error("public_upstream_failed",target,error?.message||error);return json({message:"数据加载失败"},502);}
}
async function lottery(url){
  const type=Number(url.searchParams.get("lotteryType")||1);if(!validTypes.has(type))return json({message:"数据加载失败"},422);
  return upstreamJson(`https://6htv70.com/gallerynew/h5/index/lastLotteryRecord?lotteryType=${type}`);
}
async function history(url){
  const type=Number(url.searchParams.get("lotteryType")||1),page=Math.min(100,Math.max(1,Number(url.searchParams.get("pageNum")||1))),year=Math.min(2100,Math.max(2000,Number(url.searchParams.get("year")||new Date().getUTCFullYear())));
  if(!validTypes.has(type))return json({message:"数据加载失败"},422);
  return upstreamJson(`https://6htv70.com/gallerynew/h5/lottery/search?pageNum=${page}&year=${year}&sort=1&lotteryType=${type}`);
}
async function siteLinks(env){try{const response=await env.CENTRAL_LINKS.fetch(new Request("https://123-liuhe-site/api/public/recommended-sites",{headers:{accept:"application/json","cache-control":"no-cache"}})),payload=await response.json();if(response.ok&&payload.success&&Array.isArray(payload.data))return json({success:true,central:true,links:payload.data.map((item,index)=>({slot:item.id||index+1,label:item.name,url:item.site_url}))});}catch(error){console.error("central_links_failed",error?.message||error);}const db=env.DB;await db.prepare("CREATE TABLE IF NOT EXISTS site_links(slot INTEGER PRIMARY KEY,label TEXT NOT NULL DEFAULT '',url TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();const {results=[]}=await db.prepare("SELECT slot,label,url FROM site_links WHERE enabled=1 ORDER BY slot").all();return json({success:true,central:false,links:results});}
async function textAds(env){try{const response=await env.CENTRAL_LINKS.fetch(new Request("https://123-liuhe-site/api/public/text-ads",{headers:{accept:"application/json","cache-control":"no-cache"}})),payload=await response.json();if(response.ok&&payload.success)return json(payload);}catch(error){console.error("central_text_ads_failed",error?.message||error);}return json({success:false,texts:[],domains:[]},502);}
async function serviceChat(request){
  const source=new URL(request.url),target=new URL("https://xinshui-chat-api.jijin888888.workers.dev/v1/chat");target.search=source.search;
  return fetch(new Request(target.toString(),request));
}
export async function handleWuqi(url){
  const map={1:"xg",5:"xam",8:"tt"},type=Number(url.searchParams.get("lotteryType")||1),page=Math.min(100,Math.max(1,Number(url.searchParams.get("page")||1)));
  if(!map[type])return json({success:false,message:"彩种错误"},422);
  try{const body=new URLSearchParams({page:String(page),type:map[type]}),response=await fetch("https://lhw.235-from.com/index/wuqiapi/getwuqibizhong",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","accept":"application/json","user-agent":"Mozilla/5.0"},body});if(!response.ok)throw new Error(String(response.status));return new Response(response.body,{status:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"}});}catch{return json({success:false,message:"五期必中接口暂时不可用"},502);}
}
async function materials(url,db,cap){
  const type=Number(url.searchParams.get("lotteryType")||1),section=(url.searchParams.get("section")||"").trim(),limit=Math.min(cap,Math.max(1,Number(url.searchParams.get("limit")||30)));
  if(!validTypes.has(type))return json({success:false,message:"彩种错误"},422);
  let sql="SELECT id,lottery_type,section_key,source_name,period,content,result_special,hit_status,updated_at FROM materials WHERE lottery_type=? AND published=1",args=[type];
  if(section){sql+=" AND section_key=?";args.push(section);}sql+=" ORDER BY CAST(period AS INTEGER) DESC,source_name ASC,id DESC LIMIT ?";args.push(limit);
  const {results=[]}=await db.prepare(sql).bind(...args).all(),stats={};
  for(const row of results){const s=stats[row.source_name]??={settled:0,hits:0,accuracy:0};if(row.hit_status!=="pending"){s.settled++;if(row.hit_status==="hit")s.hits++;}}
  for(const s of Object.values(stats))s.accuracy=s.settled?Math.round(s.hits/s.settled*100):0;
  return json({success:true,records:results,stats});
}
async function ads(db,env){
  try{const response=await env.CENTRAL_LINKS.fetch(new Request("https://123-liuhe-site/api/public/ads",{headers:{accept:"application/json","cache-control":"no-cache"}})),payload=await response.json();if(response.ok&&payload.success&&Array.isArray(payload.data)){const out={},banner=payload.data.find(item=>item.position_key==="banner"),popup=payload.data.find(item=>item.position_key==="popup");if(banner){const value={position:"banner",image:banner.image_url,link:banner.link_url,displayMode:banner.display_mode,delaySeconds:Number(banner.delay_seconds)};for(let index=1;index<=20;index++)out[`home-${index}`]=value;out.list=value;out.detail=value;}if(popup)out.popup={position:"popup",image:popup.image_url,link:popup.link_url,displayMode:popup.display_mode,delaySeconds:Number(popup.delay_seconds)};return json({success:true,central:true,ads:out});}}catch(error){console.error("central_ads_failed",error?.message||error);}
  const now=new Date().toISOString().slice(0,19).replace("T"," "),{results=[]}=await db.prepare("SELECT position_key,image_path,link_url,display_mode,delay_seconds FROM ads WHERE enabled=1 AND image_path<>'' AND (start_at IS NULL OR start_at<=?) AND (end_at IS NULL OR end_at>=?)").bind(now,now).all(),out={};
  for(const row of results)out[row.position_key]={position:row.position_key,image:row.image_path,link:row.link_url,displayMode:row.display_mode,delaySeconds:Number(row.delay_seconds)};return json({success:true,central:false,ads:out});
}
async function track(request,db){
  const form=await request.formData(),type=Number(form.get("lottery_type")),section=String(form.get("section_key")||""),device=String(form.get("device")||"");
  if(!validTypes.has(type)||!["home","history","yixiao","erxiao","sanxiao","liuxiao","tema","weishu","sanzhongsan","erzhonger","chengyu"].includes(section)||!["mobile","desktop"].includes(device))return json({success:false},422);
  const today=new Date().toISOString().slice(0,10),now=new Date().toISOString().slice(0,19).replace("T"," "),ip=request.headers.get("CF-Connecting-IP")||"",country=request.cf?.country||"未知",region=request.cf?.region||"未知",city=request.cf?.city||"未知";
  await db.prepare("INSERT INTO analytics_daily VALUES(?,?,?,?,1) ON CONFLICT(visit_date,lottery_type,section_key,device) DO UPDATE SET views=views+1").bind(today,type,section,device).run();
  if(ip)await db.prepare("INSERT INTO analytics_visitors VALUES(?,?,?,?,?,?,1) ON CONFLICT(ip_address) DO UPDATE SET country=excluded.country,region_name=excluded.region_name,city=excluded.city,last_seen=excluded.last_seen,views=views+1").bind(ip,country,region,city,now,now).run();return json({success:true});
}
async function sha256(value){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function trackAd(request,db){
  const form=await request.formData(),position=String(form.get("position_key")||""),event=String(form.get("event_type")||""),positions=[...Array.from({length:9},(_,i)=>`home-${i+1}`),"popup","list","detail"];
  if(!positions.includes(position)||!["view","click"].includes(event))return json({success:false},422);
  if(event==="view"){await db.prepare("INSERT INTO ad_stats(position_key,impressions) VALUES(?,1) ON CONFLICT(position_key) DO UPDATE SET impressions=impressions+1").bind(position).run();return json({success:true});}
  const ip=request.headers.get("CF-Connecting-IP")||"",hash=await sha256(ip||"unknown"),now=new Date().toISOString().slice(0,19).replace("T"," "),cutoff=new Date(Date.now()-86400000).toISOString().slice(0,19).replace("T"," "),prior=await db.prepare("SELECT 1 ok FROM ad_clicks WHERE position_key=? AND ip_hash=? AND clicked_at>? LIMIT 1").bind(position,hash,cutoff).first(),valid=!prior,visitor=ip?await db.prepare("SELECT country,region_name,city FROM analytics_visitors WHERE ip_address=?").bind(ip).first():null,region=visitor?[visitor.country,visitor.region_name,visitor.city].filter(Boolean).join(" / "):"未知";
  await db.batch([db.prepare("INSERT INTO ad_stats(position_key,total_clicks,valid_clicks,last_clicked_at) VALUES(?,1,?,?) ON CONFLICT(position_key) DO UPDATE SET total_clicks=total_clicks+1,valid_clicks=valid_clicks+excluded.valid_clicks,last_clicked_at=excluded.last_clicked_at").bind(position,valid?1:0,now),db.prepare("INSERT INTO ad_clicks(position_key,ip_hash,ip_address,region_name,device,page_path,clicked_at) VALUES(?,?,?,?,?,?,?)").bind(position,hash,ip,region,String(form.get("device")||"unknown").slice(0,12),String(form.get("page_path")||"").slice(0,255),now)]);return json({success:true,valid});
}

const chatText=value=>String(value||"").trim();
const chatNamePattern=/^[\u3400-\u9fff0-9]{2,12}$/u;
const chatMessagePattern=/^[\u3400-\u9fff0-9\s]{1,120}$/u;
async function chat(request,db){
  const now=new Date().toISOString().slice(0,19).replace("T"," "),location=[request.cf?.country,request.cf?.region,request.cf?.city].filter(Boolean).join(" / ")||"未知地区";
  if(request.method==="GET"){
    const url=new URL(request.url),device=chatText(url.searchParams.get("device")).slice(0,80),nickname=chatText(url.searchParams.get("nickname")).replace(/[^\u3400-\u9fff0-9]/gu,"").slice(0,12)||"一路发游客";
    if(device)await db.prepare("INSERT INTO chat_presence(device_id,nickname,last_seen,country,region_name,city) VALUES(?,?,?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET nickname=excluded.nickname,last_seen=excluded.last_seen,country=excluded.country,region_name=excluded.region_name,city=excluded.city").bind(device,nickname,now,request.cf?.country||"",request.cf?.region||"",request.cf?.city||"").run();
    const cutoff=new Date(Date.now()-7*86400000).toISOString().slice(0,19).replace("T"," "),onlineCutoff=new Date(Date.now()-5*60000).toISOString().slice(0,19).replace("T"," ");
    await db.prepare("DELETE FROM chat_messages WHERE created_at<?").bind(cutoff).run();
    const [{results=[]},onlineRow]=await Promise.all([db.prepare("SELECT id,device_id AS deviceId,nickname,content,created_at AS createdAt FROM chat_messages WHERE created_at>=? ORDER BY id DESC LIMIT 100").bind(cutoff).all(),db.prepare("SELECT COUNT(*) count FROM chat_presence WHERE last_seen>=?").bind(onlineCutoff).first()]);
    return json({success:true,messages:results.reverse(),online:Number(onlineRow?.count||1),viewerLocation:location});
  }
  let body;try{body=await request.json();}catch{return json({success:false,message:"请求格式错误"},400);}
  const device=chatText(body.deviceId).slice(0,80),nickname=chatText(body.nickname),content=chatText(body.content).replace(/\s+/gu," ");
  if(!device||!chatNamePattern.test(nickname))return json({success:false,message:"昵称只能使用2–12个中文或数字"},422);
  if(!chatMessagePattern.test(content))return json({success:false,message:"消息只能使用中文、数字和空格，最多120字"},422);
  const recentCutoff=new Date(Date.now()-3000).toISOString().slice(0,19).replace("T"," "),recent=await db.prepare("SELECT 1 ok FROM chat_messages WHERE device_id=? AND created_at>=? LIMIT 1").bind(device,recentCutoff).first();
  if(recent)return json({success:false,message:"发送太快，请稍后再试"},429);
  const result=await db.prepare("INSERT INTO chat_messages(device_id,nickname,content,created_at) VALUES(?,?,?,?)").bind(device,nickname,content,now).run();
  await db.prepare("INSERT INTO chat_presence(device_id,nickname,last_seen,country,region_name,city) VALUES(?,?,?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET nickname=excluded.nickname,last_seen=excluded.last_seen,country=excluded.country,region_name=excluded.region_name,city=excluded.city").bind(device,nickname,now,request.cf?.country||"",request.cf?.region||"",request.cf?.city||"").run();
  return json({success:true,id:result.meta.last_row_id});
}
