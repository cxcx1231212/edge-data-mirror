const TYPES=[1,5,8], ZODIACS=["鼠","牛","虎","兔","龙","蛇","马","羊","猴","鸡","狗","猪"];
const NAMES={
  yixiao:["财神点金","鸿运当头","金牌神算","老张密报","阿旺心水","福叔手记","金库密笺","顺风快讯","老陈玄机","德叔解码","旺财秘笈","鸿运天师","一路长红","发财使者","金榜高人","民间高手","鸿运神算","富贵掌柜","金牌老李","澳门财叔","港澳神手","王牌阿叔","财神密报","金龙神算","大胜参考","福星解码","老街密探","旺角高人","鸿运先锋","金牌料王"],
  erxiao:["桥头阿伯","南门老李","祥记档案","春风茶馆","鸿运阿成","德叔笔记","旺角小哥","金福消息","老友来料","顺发阿东"],
  sanxiao:["东叔茶话","阿海手札","老钟秘笈","福来小站","大胜参考","九记快报","荣叔精选","百汇消息","顺意茶室","祥哥手记"],
  liuxiao:["富贵人家","长乐坊","顺景楼","金玉堂","鸿运坊","旺来阁","满堂彩","好景茶室","福运站","老友汇"],
  weishu:["尾数老王","阿城看尾","老莫尾数","东叔双尾","阿杰看尾","大海尾数","福嫂双尾","小马看尾","老叶尾数","旺铺双尾"],
  sanzhongsan:["老兵看盘","阿泰精选","三哥心水","老严稳料","东门快报","阿勇推荐","金手指","老梁密报","九叔手记","旺仔参考"],
  erzhonger:["老吴看号","阿森精选","福满堂","老街密报","兴旺参考","阿坤手记","顺发推荐","东叔看盘","聚宝盆","阿杰心水"],
  chengyu:["街坊成语","老陈解语","福叔成语","阿明解语","顺风成语","旺哥解语","金牌成语","老友解语","鸿运成语","喜来解语"]
};
const IDIOMS=["鼠目寸光","九牛一毛","虎虎生威","守株待兔","龙飞凤舞","画蛇添足","马到成功","亡羊补牢","沐猴而冠","闻鸡起舞","狗尾续貂","猪朋狗友"];
const PROFILES=[[1.3,.5,.2,1.1,-.1],[.5,1,.5,.6,.1],[.2,.5,1.2,.4,.05],[1,.7,.3,1.2,.15],[.4,.8,.5,.5,.7],[1.1,.4,.4,.9,-.25],[.5,.9,.7,.5,.25],[.8,.5,.7,1,-.1],[.7,.8,.4,.7,.35],[.7,.7,.7,.7,.1]];
const ts=()=>new Date().toISOString().slice(0,19).replace("T"," ");
async function getJson(url){const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0"}});if(!r.ok)throw new Error(`开奖接口 HTTP ${r.status}`);return r.json();}
async function source(type){
  const year=new Date().getUTCFullYear(),pages=[];
  for(let p=1;p<=6;p++){const d=await getJson(`https://6htv70.com/gallerynew/h5/lottery/search?pageNum=${p}&year=${year}&sort=1&lotteryType=${type}`),batch=d?.data?.recordList||[];if(!batch.length)break;pages.push(...batch);}
  const latest=await getJson(`https://6htv70.com/gallerynew/h5/index/lastLotteryRecord?lotteryType=${type}`);if(latest?.code!==10000||pages.length<30)throw new Error(`${type} 历史数据不足`);return {records:pages.slice(0,60),latest:latest.data};
}
function rank(records,items,extract,profile){
  const f10=new Map(items.map(x=>[x,0])),f30=new Map(f10),f60=new Map(f10),recent=new Map(f10),gap=new Map(items.map(x=>[x,60]));
  records.forEach((r,i)=>{for(const x of new Set(extract(r))){if(!f10.has(x))continue;if(i<10)f10.set(x,f10.get(x)+1);if(i<30)f30.set(x,f30.get(x)+1);f60.set(x,f60.get(x)+1);recent.set(x,recent.get(x)+Math.exp(-i/12));if(gap.get(x)===60)gap.set(x,i);}});
  const [a,b,c,d,e]=profile;return [...items].sort((x,y)=>(f10.get(y)*a+f30.get(y)*b+f60.get(y)*c+recent.get(y)*d+Math.min(gap.get(y),12)*e)-(f10.get(x)*a+f30.get(x)*b+f60.get(x)*c+recent.get(x)*d+Math.min(gap.get(x),12)*e));
}
const balls=r=>(r.numberList||[]).slice(0,7), numbers=r=>balls(r).map(b=>Number(b.number)).filter(n=>n>=1&&n<=49), zodiacs=r=>balls(r).map(b=>String(b.shengXiao||"")).filter(Boolean);
async function upsert(db,type,section,name,period,content){await db.prepare("INSERT INTO materials(lottery_type,section_key,source_name,period,content,result_special,hit_status,published,created_at,updated_at) VALUES(?,?,?,?,?,NULL,'pending',1,?,?) ON CONFLICT(lottery_type,section_key,source_name,period) DO NOTHING").bind(type,section,name,period,content,ts(),ts()).run();}
async function settle(db,type,latest){
  const period=String(latest.period||""),bs=(latest.numberList||[]).slice(0,7);if(!period||bs.length<7)return 0;
  const nums=bs.map(x=>String(x.number).padStart(2,"0")),zs=[...new Set(bs.map(x=>String(x.shengXiao||"")))],tails=nums.map(x=>x.at(-1)),special=nums[6],{results=[]}=await db.prepare("SELECT id,section_key,content FROM materials WHERE lottery_type=? AND period=? AND hit_status='pending'").bind(type,period).all();let updated=0;
  for(const row of results){const tokens=row.content.trim().split(/[\s,，、·・｜：:]+/u).filter(Boolean);let hit=false;if(["yixiao","erxiao","sanxiao","liuxiao"].includes(row.section_key))hit=tokens.some(x=>zs.includes(x));else if(row.section_key==="tema")hit=tokens.includes(special);else if(row.section_key==="weishu")hit=tokens.some(x=>x.endsWith("尾")&&tails.includes(x[0]));else if(row.section_key==="sanzhongsan")hit=tokens.filter(x=>nums.includes(x)).length>=3;else if(row.section_key==="erzhonger")hit=tokens.filter(x=>nums.includes(x)).length>=2;else if(row.section_key==="chengyu")hit=zs.some(x=>row.content.includes(x));await db.prepare("UPDATE materials SET result_special=?,hit_status=?,updated_at=? WHERE id=?").bind(special,hit?"hit":"miss",ts(),row.id).run();updated++;}return updated;
}
async function generate(db,type,records,period){
  for(const name of NAMES.yixiao)await upsert(db,type,"yixiao",name,period,ZODIACS[Math.floor(Math.random()*ZODIACS.length)]);
  for(const [section,size] of [["erxiao",2],["sanxiao",3],["liuxiao",6]])for(let i=0;i<10;i++){const ranked=rank(records,ZODIACS,zodiacs,PROFILES[i]),group=[];for(let j=0;j<size;j++)group.push(ranked[(i+j)%ranked.length]);await upsert(db,type,section,NAMES[section][i],period,group.join(" "));}
  const tails=rank(records,[0,1,2,3,4,5,6,7,8,9],r=>numbers(r).map(n=>n%10),PROFILES[0]);for(let i=0;i<10;i++)await upsert(db,type,"weishu",NAMES.weishu[i],period,`${tails[i]}尾 ${tails[(i+5)%10]}尾`);
  const nums=Array.from({length:49},(_,i)=>i+1);
  for(let i=0;i<10;i++){const ranked=rank(records,nums,numbers,PROFILES[i]);const three=ranked.slice(i%4,i%4+10).sort((a,b)=>a-b).map(n=>String(n).padStart(2,"0"));const pair=ranked.slice(i%3,i%3+16).sort((a,b)=>a-b).map(n=>String(n).padStart(2,"0"));await upsert(db,type,"sanzhongsan",NAMES.sanzhongsan[i],period,three.join(" "));await upsert(db,type,"erzhonger",NAMES.erzhonger[i],period,pair.join(" "));const idiom=IDIOMS[(Number(period)+i)%IDIOMS.length],zs=ZODIACS.filter(x=>idiom.includes(x));await upsert(db,type,"chengyu",NAMES.chengyu[i],period,`${idiom}｜解肖：${zs.join("・")}`);}
}
export async function runAutomation(db){
  const started=ts(),run=await db.prepare("INSERT INTO automation_runs(task_key,status,started_at) VALUES('cloudflare-auto','running',?)").bind(started).run(),id=run.meta.last_row_id,summary={};
  try{for(const type of TYPES){const {records,latest}=await source(type),updated=await settle(db,type,latest),period=String(latest.nextLotteryNumber||"");if(!period)throw new Error(`${type} 缺少下期期号`);await generate(db,type,records,period);summary[type]={success:true,settled:updated,period};}await db.prepare("UPDATE automation_runs SET status='success',summary=?,finished_at=? WHERE id=?").bind(JSON.stringify(summary),ts(),id).run();return {success:true,summary};}
  catch(error){await db.prepare("UPDATE automation_runs SET status='failed',error_message=?,finished_at=? WHERE id=?").bind(String(error?.message||error),ts(),id).run();return {success:false,error:String(error?.message||error)};}
}
