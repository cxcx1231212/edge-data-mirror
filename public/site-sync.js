(function () {
  'use strict';
  const validTypes = [1, 5, 8];
  const sectionKeys = ['history','yixiao','erxiao','sanxiao','liuxiao','tema','weishu','sanzhongsan','erzhonger','chengyu'];
  const currentType = () => {
    const value = Number(localStorage.getItem('lotteryType'));
    return validTypes.includes(value) ? value : 1;
  };
  const cleanContent=value=>String(value||'').replace(/\s*·?\s*回测\s*$/,'').trim();
  const splitValues = value => cleanContent(value).split(/[\s,，、·・]+/).filter(Boolean);
  const parseIdiomContent = content => {
    const clean=cleanContent(content);
    const parts=clean.split('｜');
    return {idiom:(parts[0]||'成语推荐').trim(),zodiacs:(parts.slice(1).join('｜')||'').trim()};
  };
  const api = (section,lotteryType=currentType()) => fetch('api/data.php?lotteryType=' + lotteryType + '&section=' + encodeURIComponent(section) + '&limit=500', {cache:'no-store'}).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(data => data && data.success ? data : Promise.reject(new Error('Invalid response')));
  const wuqiApi = (page=1,lotteryType=currentType()) => fetch('/api/wuqi.php?lotteryType='+lotteryType+'&page='+page,{cache:'no-store'}).then(r=>{
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }).then(data=>Array.isArray(data&&data.data)?data:Promise.reject(new Error('Invalid response')));
  const wuqiCache=new Map();
  const wuqiAll=lotteryType=>{
    if(wuqiCache.has(lotteryType))return Promise.resolve(wuqiCache.get(lotteryType));
    return wuqiApi(1,lotteryType).then(first=>{
      const pages=Math.max(1,Number(first.pages)||1);const jobs=[];for(let page=2;page<=pages;page++)jobs.push(wuqiApi(page,lotteryType));
      return Promise.all(jobs).then(rest=>{const seen=new Set();const records=[...(first.data||[]),...rest.flatMap(item=>item.data||[])].filter(item=>{const key=String(item.id||item.issueNo||'');if(!key||seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>Number(b.issueNo||0)-Number(a.issueNo||0));const result={...first,data:records};wuqiCache.set(lotteryType,result);return result;});
    });
  };
  function track(section) {
    const type=currentType(); const device=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||innerWidth<760?'mobile':'desktop';
    const key='visit:'+new Date().toISOString().slice(0,10)+':'+type+':'+section+':'+location.pathname;
    if(sessionStorage.getItem(key)) return;
    const body=new URLSearchParams({lottery_type:String(type),section_key:section,device});
    fetch('api/track.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),keepalive:true}).then(response=>{
      if(response.ok) sessionStorage.setItem(key,'1');
    }).catch(()=>{});
  }
  const latestByName = records => {
    const map = new Map();
    records.forEach(record => { if (!map.has(record.source_name)) map.set(record.source_name, record); });
    return map;
  };
  const compareWinRate=(stats,nameA,nameB)=>{
    const a=stats[nameA]||{},b=stats[nameB]||{};
    const settledA=Math.max(0,Number(a.settled)||0),settledB=Math.max(0,Number(b.settled)||0);
    const hitsA=Math.max(0,Number(a.hits)||0),hitsB=Math.max(0,Number(b.hits)||0);
    const rateA=settledA?hitsA/settledA:-1,rateB=settledB?hitsB/settledB:-1;
    return rateB-rateA||settledB-settledA||hitsB-hitsA||String(nameA).localeCompare(String(nameB),'zh-CN');
  };
  const setTokens = (node, content, className) => {
    if (!node) return;
    node.textContent = '';
    splitValues(content).forEach(value => {
      const span = document.createElement('span');
      if (className) span.className = className;
      span.textContent = value;
      node.appendChild(span);
    });
  };
  const drawNumberCache=new Map();
  const drawRecordCache=new Map();
  const periodKey=value=>{const digits=String(value||'').replace(/\D/g,'');const short=digits.length>3?digits.slice(-3):digits;return String(Number(short)||'');};
  async function drawNumbersFor(periods){
    const wanted=new Set(periods.map(periodKey).filter(Boolean));
    const found=new Map();
    wanted.forEach(period=>{const key=currentType()+':'+period;if(drawNumberCache.has(key))found.set(period,drawNumberCache.get(key));});
    const missing=()=>[...wanted].filter(period=>!found.has(period));
    if(!missing().length)return found;
    const year=new Date().getFullYear();
    for(let page=1;page<=4&&missing().length;page++){
      try{
        const response=await fetch('/api/history.php?pageNum='+page+'&year='+year+'&sort=1&lotteryType='+currentType(),{cache:'no-store'});
        if(!response.ok)break;
        const payload=await response.json();
        const records=payload&&payload.data&&Array.isArray(payload.data.recordList)?payload.data.recordList:[];
        records.forEach(record=>{const period=periodKey(record.period);const numbers=new Set((record.numberList||[]).slice(0,7).map(item=>String(item.number||'').padStart(2,'0')));if(period&&numbers.size){drawNumberCache.set(currentType()+':'+period,numbers);drawRecordCache.set(currentType()+':'+period,record);if(wanted.has(period))found.set(period,numbers);}});
        if(!records.length)break;
      }catch(_){break;}
    }
    return found;
  }
  async function drawRecordsFor(periods){
    await drawNumbersFor(periods);
    const result=new Map();
    periods.map(periodKey).filter(Boolean).forEach(period=>{const record=drawRecordCache.get(currentType()+':'+period);if(record)result.set(period,record);});
    return result;
  }
  function drawStrip(record){
    const wrap=document.createElement('div');wrap.className='period-draw';
    const label=document.createElement('span');label.className='period-draw-label';label.textContent='当期开奖';wrap.appendChild(label);
    if(!record||!Array.isArray(record.numberList)||record.numberList.length<7){const pending=document.createElement('span');pending.className='period-draw-pending';pending.textContent='待开奖';wrap.appendChild(pending);return wrap;}
    const balls=document.createElement('span');balls.className='period-draw-balls';
    record.numberList.slice(0,7).forEach((item,index)=>{
      if(index===6){const plus=document.createElement('span');plus.className='period-draw-plus';plus.textContent='+';balls.appendChild(plus);}
      const ball=document.createElement('span');ball.className='period-draw-ball';
      const number=document.createElement('b');number.className='period-draw-number color-'+(Number(item.color)||1);number.textContent=String(item.number||'').padStart(2,'0');
      const zodiac=document.createElement('small');zodiac.textContent=item.shengXiao||'-';ball.append(number,zodiac);balls.appendChild(ball);
    });
    wrap.appendChild(balls);return wrap;
  }
  const isNumberSection=section=>section==='sanzhongsan'||section==='erzhonger';
  const isZodiacSection=section=>section==='yixiao'||section==='erxiao'||section==='sanxiao'||section==='liuxiao';
  const numberLimit=section=>section==='sanzhongsan'?10:section==='erzhonger'?16:49;
  function showEmpty(node,text='暂无资料'){
    if(!node)return;node.textContent='';const empty=document.createElement('div');empty.className='material-empty';empty.textContent=text;node.appendChild(empty);
  }
  function setNumberBalls(node,content,winning,limit=49){
    node.textContent='';node.classList.add('number-value');const row=document.createElement('span');row.className='number-row three-number-row';
    splitValues(content).filter(value=>/^\d{1,2}$/.test(value)).slice(0,limit).forEach(value=>{const number=value.padStart(2,'0');const matched=winning&&winning.has(number);const ball=document.createElement('span');ball.className='mini-ball three-ball'+(matched?' matched':'');ball.textContent=number;if(matched){const check=document.createElement('i');check.className='number-hit-check';check.textContent='✓';check.setAttribute('aria-label','命中');ball.appendChild(check);}row.appendChild(ball);});
    node.appendChild(row);
  }
  function setZodiacPicks(node,content,winningZodiacs){
    node.textContent='';node.classList.add('zodiac-pick-value');
    const row=document.createElement('span');row.className='zodiac-pick-row';
    splitValues(content).forEach(value=>{
      const matched=winningZodiacs&&winningZodiacs.has(value);
      const item=document.createElement('span');item.className='zodiac-pick'+(matched?' matched':'');item.textContent=value;
      if(matched){const check=document.createElement('i');check.className='zodiac-hit-check';check.textContent='✓';check.setAttribute('aria-label','命中');item.appendChild(check);}
      row.appendChild(item);
    });
    node.appendChild(row);
  }
  let activeMaterialPeriod='';
  async function updateHomepageSection(section, data) {
    const link = document.querySelector('.section .more[href="' + section + '.html"]');
    const panel = link && link.closest('.section');
    if (!panel) return;
    const finish=()=>{panel.querySelector('.homepage-material-loading')?.remove();panel.classList.remove('materials-loading');};
    if(!data.records.length){panel.querySelectorAll('.material,.six-row,.tail,.combo-card,.idiom').forEach(card=>card.hidden=true);finish();return;}
    const currentPeriod=Math.max(...data.records.map(record=>Number(record.period)||0));
    const currentPeriodText=String(data.records.find(record=>(Number(record.period)||0)===currentPeriod)?.period||currentPeriod);
    if(currentPeriod>Number(activeMaterialPeriod||0))activeMaterialPeriod=currentPeriodText;
    const latest = latestByName(data.records.filter(record=>(Number(record.period)||0)===currentPeriod));
    const countNode = panel.querySelector('.section-title .count');
    if (countNode && (countNode.textContent.includes('统计中') || /共\d+份资料/.test(countNode.textContent))) countNode.textContent = '（共' + latest.size + '份资料）';
    const available = [...latest.values()].sort((a,b)=>compareWinRate(data.stats||{},a.source_name,b.source_name));
    const used = new Set();
    const drawMap=isNumberSection(section)?await drawNumbersFor([...latest.values()].map(record=>record.period)):new Map();
    const compactTitleSections=['yixiao','erxiao','weishu','sanzhongsan','erzhonger','chengyu'];
    if(compactTitleSections.includes(section)){
      const grid=panel.querySelector('.grid-3,.tail-grid,.combo-grid,.idiom-grid');
      if(grid){grid.className='grid-3';grid.innerHTML=available.map(()=>'<div class="material"><div class="name"></div><div class="pick"></div></div>').join('');}
    }
    const categoryNames={yixiao:'平特一肖',erxiao:'平特二肖',sanxiao:'平特三肖',liuxiao:'平特六肖',weishu:'平特尾数',sanzhongsan:'三中三',erzhonger:'二中二',chengyu:'成语解肖'};
    const promoNames={yixiao:'全年公开',erxiao:'精选推荐',sanxiao:'高手心水',liuxiao:'重点关注',weishu:'连准公开',sanzhongsan:'稳中好料',erzhonger:'热门推荐',chengyu:'每期公开'};
    const fourCharAuthor=value=>{const chars=[...String(value||'').replace(/\s+/g,'')];if(chars.length>=4)return chars.slice(0,4).join('');if(chars.length===3)return chars.join('')+'哥';if(chars.length===2)return chars.join('')+'高手';if(chars.length===1)return chars.join('')+'师傅料';return '民间高手';};
    panel.querySelectorAll('.material,.six-row,.tail,.combo-card,.idiom').forEach(card => {
      const nameNode = card.querySelector('.name,strong,.title');
      const record = available.find(item => !used.has(item.source_name));
      if (!record) return;
      used.add(record.source_name);
      card.hidden=false;
      card.classList.add('title-only');
      const display=section==='chengyu'?parseIdiomContent(record.content):{idiom:record.source_name,zodiacs:record.content};
      const detailUrl=section+'-1.html?source='+encodeURIComponent(record.source_name);
      card.style.cursor='pointer';card.setAttribute('role','link');card.tabIndex=0;card.setAttribute('aria-label','查看 '+record.source_name+' 往期记录');
      card.onclick=event=>{if(event.target.closest('a,button'))return;location.href=detailUrl;};
      card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();location.href=detailUrl;}};
      if (nameNode){const author=section==='yixiao'?fourCharAuthor(record.source_name):record.source_name;nameNode.textContent=record.period+'期: '+author+'→【'+(categoryNames[section]||section)+'】←'+(promoNames[section]||'免费公开');}
      if(section==='chengyu'){
        const periodTag=card.querySelector('.period-tag'); if(periodTag) periodTag.textContent='第'+record.period+'期';
        const lines=card.querySelectorAll('.line');
        if(lines[0]) lines[0].textContent=display.zodiacs;
        if(lines[1]) lines[1].textContent='推荐生肖：'+display.zodiacs.replace(/^解肖：/,'').replace(/[・、，]/g,' ');
        return;
      }
      const plain = card.querySelector('.pick,.value,.line.green,.line');
      const combo = card.querySelector('.combo-nums');
      if (combo) {
        if(isNumberSection(section))setNumberBalls(combo,record.content,drawMap.get(periodKey(record.period)),numberLimit(section));
        else setTokens(combo, record.content, 'combo-num');
        const chip = card.querySelector('.chip');
        if (chip) chip.textContent = '共' + splitValues(record.content).length + '码';
      } else if (plain && card.classList.contains('six-row')) {
        setTokens(plain, record.content, '');
      } else if (plain) {
        plain.textContent = section==='chengyu'?display.zodiacs:cleanContent(record.content);
      }
    });
    finish();
  }
  function updateFive(data) {
    const grid = document.getElementById('fiveHistoryGrid');
    if (!grid || !data.records.length) return;
    const source = data.records[0].source_name;
    const records = data.records.filter(r => r.source_name === source).slice(0, 5);
    if (!records.length) return;
    grid.textContent = '';
    records.forEach(record => {
      const row = document.createElement('div'); row.className = 'five-row';
      const issue = document.createElement('div'); issue.className = 'issue'; issue.textContent = record.period + '期';
      const nums = document.createElement('div'); nums.className = 'numline';
      splitValues(record.content).forEach(value => { const n=document.createElement('span'); n.className='num'; n.textContent=value; nums.appendChild(n); });
      row.append(issue, nums);
      if (record.hit_status !== 'pending') {
        const result=document.createElement('div'); result.className='five-result'; result.append('开奖特码 ' + (record.result_special || '-'));
        const strong=document.createElement('strong'); strong.className=record.hit_status==='hit'?'win':'lose'; strong.textContent=record.hit_status==='hit'?'命中':'未中'; result.appendChild(strong); row.appendChild(result);
      }
      grid.appendChild(row);
    });
  }
  function updateFiveWuqi(payload){
    const grid=document.getElementById('fiveHistoryGrid');
    const nav=document.querySelector('.five-history-nav');
    const records=Array.isArray(payload.data)?payload.data:[];
    if(!grid||!nav||!records.length)return;
    const groups=[];for(let i=0;i<records.length;i+=5)groups.push(records.slice(i,i+5));
    const periodOf=item=>String(item.issueNo||'').slice(-3);
    const render=groupIndex=>{
      grid.textContent='';
      (groups[groupIndex]||[]).forEach(item=>{
        const numbers=String(item.haoma||'').split(/[,，\s]+/).filter(Boolean).map(n=>n.padStart(2,'0'));
        const special=item.tema==null||item.tema===''?'':String(item.tema).padStart(2,'0');
        const row=document.createElement('div');row.className='five-row';
        const issue=document.createElement('div');issue.className='issue';issue.textContent=periodOf(item)+'期';
        const nums=document.createElement('div');nums.className='numline';numbers.forEach(value=>{const n=document.createElement('span');n.className='num'+(special===value?' hit':'');n.textContent=value;nums.appendChild(n);});
        row.append(issue,nums);
        const result=document.createElement('div');result.className='five-result';
        if(special){result.append('开奖特码 '+special);const won=numbers.includes(special);const strong=document.createElement('strong');strong.className=won?'win':'lose';strong.textContent=won?'命中':'未中';result.appendChild(strong);}else{result.classList.add('pending');result.textContent='未开奖';}
        row.appendChild(result);
        grid.appendChild(row);
      });
      [...nav.children].forEach((button,index)=>button.classList.toggle('active',index===groupIndex));
    };
    nav.textContent='';groups.forEach((group,index)=>{if(!group.length)return;const button=document.createElement('button');button.type='button';button.textContent=periodOf(group[0])+'–'+periodOf(group[group.length-1])+'期';button.addEventListener('click',()=>render(index));nav.appendChild(button);});
    render(0);
  }
  function renderHomepage() {
    const localPreview=location.protocol==='file:',previewCategories={yixiao:'平特一肖',erxiao:'平特二肖',sanxiao:'平特三肖'},previewPromos={yixiao:'全年公开',erxiao:'精选推荐',sanxiao:'高手心水'};
    if(localPreview)Object.keys(previewCategories).forEach(section=>{const panel=document.querySelector('.section .more[href="'+section+'.html"]')?.closest('.section');panel?.querySelectorAll('.material .name').forEach(node=>{const author=node.dataset.author||node.textContent.trim();node.dataset.author=author;node.textContent='236期: '+author+'→【'+previewCategories[section]+'】←'+previewPromos[section];node.closest('.material')?.classList.add('title-only');});});
    ['yixiao','erxiao','sanxiao','liuxiao','weishu','sanzhongsan','erzhonger','chengyu'].forEach(section => {
      const more=document.querySelector('.section .more[href="'+section+'.html"]');
      const panel=more&&more.closest('.section');
      if(!panel)return;
      const openList=event=>{if(event.target.closest('a,button'))return;location.href=section+'.html';};
      const title=panel.querySelector('.section-title .left');
      const staticTitleSections=['yixiao','erxiao','weishu','sanzhongsan','erzhonger','chengyu'];
      if(title&&!staticTitleSections.includes(section)){title.style.cursor='pointer';title.setAttribute('role','link');title.tabIndex=0;title.onclick=openList;title.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();location.href=section+'.html';}};}
      if(title&&staticTitleSections.includes(section)){title.style.cursor='default';title.removeAttribute('role');title.removeAttribute('tabindex');title.onclick=null;title.onkeydown=null;}
      panel.querySelectorAll('.material,.six-row,.tail,.combo-card,.idiom').forEach(card=>{card.hidden=!localPreview;card.style.cursor='pointer';card.setAttribute('role','link');card.tabIndex=0;card.onclick=openList;card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();location.href=section+'.html';}};});
      if(!localPreview){panel.classList.add('materials-loading');panel.querySelector('.homepage-material-loading')?.remove();}
    });
    const requestedType=currentType();activeMaterialPeriod='';
    const jobs=sectionKeys.filter(section=>section!=='tema').map(section => api(section,requestedType).then(data => {
      if(currentType()!==requestedType)return;
      return updateHomepageSection(section, data);
    }).catch(() => {if(currentType()!==requestedType)return;const panel=document.querySelector('.section .more[href="'+section+'.html"]')?.closest('.section');panel?.classList.remove('materials-loading');}));
    const ready=Promise.allSettled(jobs).then(()=>{if(currentType()!==requestedType)return;document.documentElement.classList.remove('materials-booting');loadTextAds();});
    wuqiAll(requestedType).then(data=>{if(currentType()===requestedType)updateFiveWuqi(data);}).catch(()=>{});
    return ready;
  }
  function updateSiteNetworkTitle(type=currentType()){
    const names={1:'香港',5:'澳门',8:'天天'},title=document.getElementById('siteNetworkTitle');
    if(title)title.textContent='↓↓★★★'+(names[type]||'澳门')+'连准网站推荐★★★↓↓';
  }
  function loadSiteNetwork(){
    updateSiteNetworkTitle();
    fetch('/api/site-links',{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject()).then(payload=>{
      if(!payload||!payload.success||!Array.isArray(payload.links)||!payload.links.length)return;
      const list=document.getElementById('siteNetworkList');if(!list)return;list.textContent='';
      payload.links.forEach(item=>{if(!item||!item.label||!item.url)return;const link=document.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener';link.textContent=item.label;list.appendChild(link);});
    }).catch(()=>{});
  }
  function renderList(section) {
    showEmpty(document.querySelector('.inner-list'),'正在加载资料…');
    api(section).then(async data => {
      const currentPeriod=Math.max(...data.records.map(record=>Number(record.period)||0));
      const latest = latestByName(data.records.filter(record=>(Number(record.period)||0)===currentPeriod));
      if (!latest.size){showEmpty(document.querySelector('.inner-list'));return;}
      const list = document.querySelector('.inner-list'); list.textContent = '';
      const ordered=[...latest.entries()].sort(([nameA],[nameB])=>compareWinRate(data.stats||{},nameA,nameB));
      const drawMap=isNumberSection(section)?await drawNumbersFor([...latest.values()].map(record=>record.period)):new Map();
      ordered.forEach(([name,record]) => {
        const display=section==='chengyu'?parseIdiomContent(record.content):{idiom:name,zodiacs:record.content};
        const row=document.createElement('a'); row.className='inner-row has-stats'+(isNumberSection(section)?' number-list-row':''); row.href=section+'-1.html?source='+encodeURIComponent(name);
        const nameNode=document.createElement('span'); nameNode.className='inner-name'; nameNode.textContent=display.idiom;
        const side=document.createElement('span'); side.className='row-side';
        const value=document.createElement('span'); value.className='inner-value';
        if(isNumberSection(section))setNumberBalls(value,record.content,drawMap.get(periodKey(record.period)),numberLimit(section));
        else value.textContent=section==='chengyu'?display.zodiacs:cleanContent(record.content);
        const badge=document.createElement('span'); badge.className='accuracy-badge'; const stat=data.stats[name]||{accuracy:0,hits:0,settled:0}; badge.textContent=stat.settled+'期中'+stat.hits+'期';
        side.append(value,badge); row.append(nameNode,side); list.appendChild(row);
      });
    }).catch(() => showEmpty(document.querySelector('.inner-list')));
  }
  function renderDetail(section) {
    const params = new URLSearchParams(location.search);
    const source = params.get('source') || (document.querySelector('.inner-title') || {}).textContent || '';
    const detailLabels={yixiao:'平特一肖',erxiao:'平特二肖',sanxiao:'平特三肖',liuxiao:'平特六肖',tema:'特码',weishu:'平特尾数',sanzhongsan:'三中三',erzhonger:'二中二',chengyu:'成语解肖'};
    const title = document.querySelector('.inner-title'); if (title && params.get('source')) title.textContent = source+'【'+(detailLabels[section]||section)+'】';
    showEmpty(document.querySelector('.inner-list'),'正在加载资料…');
    api(section).then(async data => {
      const records = data.records.filter(r => r.source_name === source.trim());
      if (!records.length){showEmpty(document.querySelector('.inner-list'));return;}
      const simpleDetailSections=['yixiao','erxiao','sanxiao','liuxiao','weishu','sanzhongsan','erzhonger','chengyu'];
      if(simpleDetailSections.includes(section)){
        const statsCard=document.querySelector('.stats-card');if(statsCard)statsCard.hidden=true;
        const list=document.querySelector('.inner-list');list.textContent='';
        const labels=detailLabels;
        const drawRecords=await drawRecordsFor(records.map(record=>record.period));
        records.forEach(record=>{
          const drawRecord=drawRecords.get(periodKey(record.period)),drawItems=drawRecord&&Array.isArray(drawRecord.numberList)?drawRecord.numberList.slice(0,7):[],drawNumbers=new Set(drawItems.map(item=>String(item.number||'').padStart(2,'0'))),drawZodiacs=new Set(drawItems.map(item=>item.shengXiao).filter(Boolean));
          const values=splitValues(record.content),matched=value=>isNumberSection(section)?drawNumbers.has(String(value).padStart(2,'0')):section==='weishu'?drawItems.some(item=>String(item.number||'').padStart(2,'0').endsWith(String(value).replace(/尾$/,''))):drawZodiacs.has(value)||[...drawZodiacs].some(zodiac=>String(value).includes(zodiac));
          const matches=values.filter(matched).length,hit=isNumberSection(section)?matches>=(section==='sanzhongsan'?3:2):matches>0;
          if(['yixiao','erxiao','sanxiao'].includes(section)){
            const item=document.createElement('div');item.className='triple-detail-row pingte-detail-row';
            const period=document.createElement('div');period.className='triple-detail-period';period.textContent=record.period+'期';
            const center=document.createElement('div');center.className='triple-detail-center';
            const picks=document.createElement('div');picks.className='triple-detail-picks pingte-detail-picks';
            values.forEach((value,index)=>{const token=document.createElement('span');token.className=drawItems.length&&matched(value)?'matched':'';token.textContent=value;picks.appendChild(token);if(index<values.length-1)picks.append(' ');});
            if(!values.length)picks.append(cleanContent(record.content));
            const draw=document.createElement('div');draw.className='triple-detail-draw pingte-zodiac-draw';
            if(drawItems.length){
              drawItems.forEach((entry,index)=>{if(index===6){const plus=document.createElement('i');plus.className='triple-draw-plus';plus.textContent='+';draw.appendChild(plus);}const zodiac=document.createElement('b');zodiac.className='pingte-draw-zodiac'+(index===6?' special':'');zodiac.textContent=entry.shengXiao||'—';draw.appendChild(zodiac);});
            }else{draw.textContent='开奖生肖：待开奖';}
            const result=document.createElement('div');result.className='triple-detail-result '+(drawItems.length?(hit?'hit':'miss'):'pending');result.textContent=drawItems.length?(hit?'准':'错'):'待开奖';
            center.append(picks,draw);item.append(period,center,result);list.appendChild(item);return;
          }
          if(section==='sanzhongsan'||section==='weishu'){
            const item=document.createElement('div');item.className='triple-detail-row';
            const period=document.createElement('div');period.className='triple-detail-period';period.textContent=record.period+'期';
            const center=document.createElement('div');center.className='triple-detail-center';
            const picks=document.createElement('div');picks.className='triple-detail-picks';
            values.forEach((value,index)=>{const token=document.createElement('span');token.className=drawItems.length&&matched(value)?'matched':'';token.textContent=value;picks.appendChild(token);if(index<values.length-1)picks.append(' · ');});
            if(!values.length)picks.textContent=cleanContent(record.content);
            const draw=document.createElement('div');draw.className='triple-detail-draw';
            if(drawItems.length){
              drawItems.forEach((entry,index)=>{if(index===6){const plus=document.createElement('i');plus.className='triple-draw-plus';plus.textContent='+';draw.appendChild(plus);}const ball=document.createElement('b');ball.className='triple-draw-ball color-'+(Number(entry.color)||1);ball.textContent=String(entry.number||'').padStart(2,'0');draw.appendChild(ball);});
            }else{draw.textContent='开奖结果：待开奖';}
            const result=document.createElement('div');result.className='triple-detail-result '+(drawItems.length?(hit?'hit':'miss'):'pending');result.textContent=drawItems.length?(hit?'准':'错'):'待开奖';
            center.append(picks,draw);item.append(period,center,result);list.appendChild(item);return;
          }
          const item=document.createElement('div');item.className='simple-detail-item';const row=document.createElement('div');row.className='simple-yixiao-row';
          const period=document.createElement('span');period.className='simple-detail-period';period.textContent=record.period+'期';
          const summary=document.createElement('span');summary.className='simple-detail-summary';
          values.forEach((value,index)=>{const token=document.createElement('span');token.className='simple-detail-token'+(drawItems.length&&matched(value)?' matched':'');token.textContent=value;summary.appendChild(token);if(index<values.length-1)summary.append(' ');});
          if(!values.length)summary.append(cleanContent(record.content));
          const result=document.createElement('span');result.className='simple-detail-result '+(drawItems.length?(hit?'hit':'miss'):'pending');result.textContent=drawItems.length?(hit?'准':'错'):'待开奖';
          const meta=document.createElement('div');meta.className='simple-detail-meta';meta.append(period,result);row.append(summary);
          item.append(row,meta,drawStrip(drawRecord));list.appendChild(item);
        });
        return;
      }
      const stat = data.stats[source.trim()] || {hits:0,settled:0,accuracy:0};
      const statNodes = document.querySelectorAll('.stats-card .stat strong');
      const statLabels = document.querySelectorAll('.stats-card .stat span');
      let streak=0;for(const record of records){if(record.hit_status==='pending')continue;if(record.hit_status==='hit')streak++;else break;}
      if (statNodes[0]) statNodes[0].textContent = stat.hits + '期';
      if (statNodes[1]) statNodes[1].textContent = stat.settled + '期中' + stat.hits + '期';
      if (statNodes[2]) statNodes[2].textContent = streak + '期';
      if (statNodes[3]) statNodes[3].textContent = stat.settled + '期';
      if (statLabels[0]) statLabels[0].textContent = '命中期数';
      if (statLabels[1]) statLabels[1].textContent = '命中情况';
      const list = document.querySelector('.inner-list'); list.textContent='';
      const drawMap=isNumberSection(section)?await drawNumbersFor(records.map(record=>record.period)):new Map();
      const drawRecords=await drawRecordsFor(records.map(record=>record.period));
      records.forEach(record => {
        const row=document.createElement('div'); row.className='record draw-record-row'+(isNumberSection(section)?' number-record-row':'');
        const period=document.createElement('span'); period.className='period'; period.textContent='第'+record.period+'期';
        const value=document.createElement('span'); value.className='value';
        const drawRecord=drawRecords.get(periodKey(record.period));
        if(isNumberSection(section))setNumberBalls(value,record.content,drawMap.get(periodKey(record.period)),numberLimit(section));
        else if(isZodiacSection(section))setZodiacPicks(value,record.content,drawRecord&&Array.isArray(drawRecord.numberList)?new Set(drawRecord.numberList.slice(0,7).map(item=>item.shengXiao).filter(Boolean)):null);
        else value.textContent=cleanContent(record.content);
        const result=document.createElement('span'); result.className='ok'+(record.hit_status==='miss'?' miss':''); result.textContent=record.hit_status==='hit'?'✓':record.hit_status==='miss'?'×':'待';
        row.append(period,value,result,drawStrip(drawRecord)); list.appendChild(row);
      });
    }).catch(() => showEmpty(document.querySelector('.inner-list')));
  }
  function ensureAdStyles(){
    if(document.getElementById('bannerAdStyles'))return;
    const style=document.createElement('style'); style.id='bannerAdStyles';
    style.textContent='.banner-ad{display:block;width:100%;margin:10px 0 14px;border:1px solid #453a20;border-radius:8px;overflow:hidden;background:#151515;line-height:0}.banner-ad img{display:block;width:100%;height:auto;aspect-ratio:7.5/1;object-fit:cover}.banner-ad:focus-visible{outline:2px solid #efcd68;outline-offset:2px}.popup-ad-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:22px;background:rgba(0,0,0,.76)}.popup-ad-box{position:relative;width:min(520px,92vw);max-height:82vh}.popup-ad-link{display:block;border-radius:12px;overflow:hidden;line-height:0;box-shadow:0 12px 42px rgba(0,0,0,.65)}.popup-ad-link img{display:block;width:100%;max-height:78vh;object-fit:contain;background:#111}.popup-ad-close{position:absolute;right:-13px;top:-13px;z-index:2;width:36px;height:36px;border:2px solid #fff;border-radius:50%;background:#202020;color:#fff;font:700 25px/30px Arial;cursor:pointer;box-shadow:0 2px 9px rgba(0,0,0,.55)}.popup-ad-close:focus-visible{outline:3px solid #efcd68;outline-offset:2px}.site-footer{margin:18px 0 0;padding:24px 14px 28px;border-top:1px solid #6a531e;background:linear-gradient(180deg,#12100a,#090909);text-align:center;color:#8f8f8f}.site-footer strong{display:block;color:#e6c45e;font-size:17px;margin-bottom:8px}.site-footer p{margin:5px 0;font-size:12px}.site-footer button{margin-top:12px;padding:8px 18px;border:1px solid #65501e;border-radius:7px;background:#1c170c;color:#e4c35e;font:700 13px inherit}.site-footer button:active{transform:translateY(1px)}@media(max-width:650px){.banner-ad{margin:8px 0 11px;border-radius:6px}.popup-ad-overlay{padding:18px}.popup-ad-box{width:min(88vw,430px)}.popup-ad-close{right:-11px;top:-11px;width:34px;height:34px;font-size:23px}.site-footer{margin-top:14px;padding:21px 10px 24px}}';
    style.textContent+='.shared-text-ads{display:grid;grid-template-columns:1fr;gap:1px;margin:7px 0 12px;padding:1px;border:1px solid #5a4820;border-radius:7px;overflow:hidden;background:#3b311d}.shared-text-ads a{display:flex;min-height:36px;align-items:center;justify-content:center;padding:7px 6px;background:#111;color:#f2cf68;font-weight:800;line-height:1.4;text-align:center;text-decoration:none;overflow-wrap:anywhere}';
    style.textContent+='.inner-list{padding:0 10px 10px}.inner-row{min-height:52px;margin:0;border:0;border-bottom:1px solid #2d2921;border-radius:0;background:#101112;padding:9px 11px}.inner-row:nth-child(even){background:#141516}.inner-row .inner-name{font-size:15px;font-weight:700}.inner-row .inner-value{font-size:17px}.inner-row .row-side{display:flex;flex-direction:row!important;align-items:center!important;justify-content:flex-end;gap:9px!important}.inner-row .accuracy-badge{flex:0 0 auto;padding:3px 7px;font-size:11px}.record{min-height:50px;margin:0;border:0;border-bottom:1px solid #2d2921;border-radius:0;background:#101112;padding:10px 11px}.record:nth-child(even){background:#141516}@media(max-width:430px){.inner-list{padding:0 8px 8px}.inner-row{min-height:48px;padding:8px}.inner-row .inner-name{font-size:14px}.inner-row .inner-value{font-size:16px}.inner-row .row-side{gap:6px!important}.record{padding:9px 8px}}';
    style.textContent+='.simple-detail-item{padding:10px 12px 12px;border-bottom:1px solid #2d2921;background:#101112}.simple-detail-item:nth-child(even){background:#141516}.simple-yixiao-row{display:flex;align-items:center;justify-content:center;min-height:38px;padding-bottom:7px;color:#f0cf69;font-size:16px;font-weight:800;line-height:1.45}.simple-detail-summary{min-width:0;text-align:center;overflow-wrap:anywhere}.simple-detail-summary b{margin-right:4px;color:#f4d36c}.simple-detail-meta{position:relative;z-index:1;display:flex;height:0;align-items:center;justify-content:space-between;padding:0 4px;transform:translateY(-4px);pointer-events:none}.simple-detail-period{padding:1px 5px;color:#d7bd6a;font-size:15px;font-weight:900;white-space:nowrap}.simple-detail-result{min-width:50px;padding:4px 8px;border-radius:999px;text-align:center;white-space:nowrap;font-size:12px;font-weight:900}.simple-detail-result.hit{background:#124c2a;color:#6bec93}.simple-detail-result.miss{background:#511d1d;color:#ff7777}.simple-detail-result.pending{background:#333;color:#bbb}.simple-detail-token.matched{color:#ff5050}.simple-detail-item .period-draw{margin:0;padding:10px 0 0;border-top:0}.simple-detail-item .period-draw-label{display:none}.simple-detail-item .period-draw-balls{margin:0 auto}@media(max-width:430px){.simple-detail-item{padding:8px 7px 10px}.simple-yixiao-row{min-height:34px;padding-bottom:6px;font-size:14px}.simple-detail-summary b{margin-right:3px}.simple-detail-meta{padding:0 2px;transform:translateY(-3px)}.simple-detail-period{font-size:13px}.simple-detail-result{min-width:46px;padding:3px 6px;font-size:11px}.simple-detail-item .period-draw{padding-top:9px}}';
    style.textContent+='.triple-detail-row{display:grid;grid-template-columns:86px minmax(0,1fr) 58px;min-height:88px;border-bottom:1px solid #3a321f;background:#101112}.triple-detail-row:nth-child(even){background:#141516}.triple-detail-period,.triple-detail-result{display:grid;place-items:center;padding:8px;color:#edcc68;font-size:18px;font-weight:900}.triple-detail-period{border-right:1px solid #3a321f;white-space:nowrap}.triple-detail-result{border-left:1px solid #3a321f}.triple-detail-result.hit{color:#67e58c}.triple-detail-result.miss{color:#ff6b6b}.triple-detail-result.pending{color:#aaa;font-size:12px}.triple-detail-center{display:grid;grid-template-rows:1fr 1fr;min-width:0;text-align:center}.triple-detail-picks,.triple-detail-draw{display:flex;align-items:center;justify-content:center;min-width:0;padding:7px 8px;overflow-wrap:anywhere}.triple-detail-picks{color:#f0cf69;font-size:16px;font-weight:800}.triple-detail-picks .matched{color:#ff5050}.triple-detail-draw{gap:4px;border-top:1px solid #3a321f;color:#aaa;font-size:13px}.triple-draw-ball{display:grid;width:25px;height:25px;place-items:center;border-radius:50%;color:#fff;font-size:11px;line-height:1;box-shadow:inset 0 -2px 0 rgba(0,0,0,.28),0 1px 3px rgba(0,0,0,.35)}.triple-draw-ball.color-1{background:#c13a35}.triple-draw-ball.color-2{background:#3982c5}.triple-draw-ball.color-3{background:#399a58}.triple-draw-plus{color:#e4c45f;font-style:normal;font-weight:900}@media(max-width:430px){.triple-detail-row{grid-template-columns:72px minmax(0,1fr) 48px;min-height:80px}.triple-detail-period,.triple-detail-result{padding:5px;font-size:16px}.triple-detail-result.pending{font-size:10px}.triple-detail-picks{padding:6px 4px;font-size:14px}.triple-detail-draw{gap:2px;padding:6px 2px;font-size:11px;white-space:nowrap}.triple-draw-ball{width:22px;height:22px;font-size:10px}}@media(max-width:359px){.triple-detail-row{grid-template-columns:62px minmax(0,1fr) 42px}.triple-detail-period,.triple-detail-result{font-size:14px}.triple-draw-ball{width:20px;height:20px;font-size:9px}.triple-detail-draw{gap:1px}}';
    style.textContent+='.pingte-detail-picks b{margin-right:3px;color:#f4d36c}.pingte-zodiac-draw{gap:5px}.pingte-draw-zodiac{display:grid;width:25px;height:25px;place-items:center;border:1px solid #6b5724;border-radius:50%;background:#211b0e;color:#f2d36e;font-size:12px;line-height:1}.pingte-draw-zodiac.special{border-color:#247443;background:#123c24;color:#75eb9a}@media(max-width:430px){.pingte-zodiac-draw{gap:3px}.pingte-draw-zodiac{width:23px;height:23px;font-size:11px}}@media(max-width:359px){.pingte-zodiac-draw{gap:2px}.pingte-draw-zodiac{width:20px;height:20px;font-size:10px}}';
    document.head.appendChild(style);
  }
  function ensureThreeStyles(){
    if(document.getElementById('threeNumberStyles'))return;
    const style=document.createElement('style');style.id='threeNumberStyles';
    style.textContent='.material-empty{padding:30px 12px;text-align:center;color:#8f8f8f;font-weight:700}.number-value{display:block;width:100%}.number-list-row{display:flex!important;flex-direction:column;align-items:stretch!important;gap:9px!important}.number-list-row .inner-name{display:block;width:100%;font-weight:800}.number-list-row .row-side{width:100%;align-items:stretch!important;gap:8px}.number-list-row .accuracy-badge{align-self:flex-start}.number-record-row{grid-template-columns:minmax(0,1fr) 32px!important;row-gap:9px!important}.number-record-row .period{grid-column:1/-1;grid-row:1}.number-record-row .value{grid-column:1;grid-row:2;width:100%;min-width:0}.number-record-row .ok{grid-column:2;grid-row:2;align-self:center}.three-number-row{display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-start;width:100%}.three-ball{position:relative;width:31px;height:31px;display:grid;place-items:center;border-radius:50%;background:#151515!important;border:2px solid #c9a643;color:#f2cf68;font-size:13px;font-style:normal;font-weight:900;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.35)}.three-ball.matched{background:#d93636!important;border-color:#ff7878;color:#fff;box-shadow:0 0 0 2px rgba(217,54,54,.18)}.number-hit-check{position:absolute;right:-5px;top:-6px;width:15px;height:15px;display:grid;place-items:center;border-radius:50%;background:#f5f5f5;border:1px solid #d93636;color:#d93636;font:900 10px/1 Arial,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.4)}.zodiac-pick-value{display:block;width:100%}.zodiac-pick-row{display:flex;flex-wrap:wrap;gap:7px}.zodiac-pick{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 7px;border:1px solid #5a4a27;border-radius:15px;background:#1b170f;color:#f1cc61;font-size:15px;font-weight:800}.zodiac-pick.matched{border-color:#ff7878;background:#d93636;color:#fff}.zodiac-hit-check{position:absolute;right:-5px;top:-6px;width:15px;height:15px;display:grid;place-items:center;border-radius:50%;background:#fff;border:1px solid #d93636;color:#d93636;font:900 10px/1 Arial,sans-serif}.draw-record-row{grid-template-columns:90px minmax(0,1fr) 32px;row-gap:11px}.period-draw{grid-column:1/-1;display:flex;align-items:center;gap:9px;padding-top:10px;border-top:1px solid #302b20;min-width:0}.period-draw-label{flex:0 0 auto;color:#cdb86f;font-size:12px;font-weight:800}.period-draw-balls{display:grid;grid-template-columns:repeat(6,30px) 13px 30px;gap:3px;align-items:start;margin-left:auto}.period-draw-ball{width:30px;text-align:center}.period-draw-number{display:grid;width:30px;height:30px;place-items:center;border-radius:50%;color:#fff;font-size:12px;box-shadow:inset 0 -2px 0 rgba(0,0,0,.28)}.period-draw-number.color-1{background:#c13a35}.period-draw-number.color-2{background:#3982c5}.period-draw-number.color-3{background:#399a58}.period-draw-ball small{display:block;margin-top:3px;color:#ddd;font-size:11px;line-height:1}.period-draw-plus{width:13px;color:#e4c45f;font-weight:900;text-align:center;line-height:30px}.period-draw-pending{margin-left:auto;color:#aaa;font-size:13px}@media(max-width:430px){.number-list-row{gap:8px!important}.three-number-row{gap:6px}.three-ball{width:28px;height:28px;font-size:12px}.number-hit-check{right:-5px;top:-5px;width:14px;height:14px;font-size:9px}.zodiac-pick-row{gap:6px}.zodiac-pick{min-width:28px;height:28px;padding:0 6px;font-size:14px}.draw-record-row{grid-template-columns:78px minmax(0,1fr) 28px;padding:11px 8px}.period-draw{display:block}.period-draw-label{display:block;margin-bottom:7px}.period-draw-balls{grid-template-columns:repeat(6,minmax(0,1fr)) 11px minmax(0,1fr);gap:2px;width:100%;margin:0}.period-draw-ball,.period-draw-number{width:27px}.period-draw-number{height:27px;font-size:11px}.period-draw-ball small{font-size:10px}.period-draw-plus{width:11px;line-height:27px}}@media(max-width:359px){.period-draw-ball,.period-draw-number{width:24px}.period-draw-number{height:24px;font-size:10px}.period-draw-balls{gap:1px}.period-draw-plus{line-height:24px}}';
    document.head.appendChild(style);
  }
  function makeAd(position,label){
    const ad=document.createElement('a'); ad.className='banner-ad'; ad.href='#'; ad.dataset.adPosition=position; ad.setAttribute('aria-label',label);
    const image=document.createElement('img'); image.src='ad-placeholder.svg'; image.alt=label; image.loading='lazy'; ad.appendChild(image);
    ad.addEventListener('click',event=>{if(ad.dataset.active!=='1')event.preventDefault();}); return ad;
  }
  function sendAdEvent(position,event){
    const body=new URLSearchParams({position_key:position,event_type:event,device:/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||innerWidth<760?'mobile':'desktop',page_path:location.pathname});
    if(event==='click'&&navigator.sendBeacon){navigator.sendBeacon('api/track-ad.php',body);return;}
    fetch('api/track-ad.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),keepalive:true}).catch(()=>{});
  }
  function showPopupAd(item){
    if(!item||!item.image)return;
    const mode=item.displayMode==='always'?'always':'daily';
    const dateKey=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const storageKey='home-popup-seen-'+dateKey;
    try{if(mode==='daily'&&localStorage.getItem(storageKey))return;}catch(e){}
    const delay=Math.max(0,Math.min(10,Number(item.delaySeconds)||0))*1000;
    setTimeout(()=>{
      if(document.querySelector('.popup-ad-overlay'))return;
      const overlay=document.createElement('div');overlay.className='popup-ad-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','广告');
      const box=document.createElement('div');box.className='popup-ad-box';
      const close=document.createElement('button');close.type='button';close.className='popup-ad-close';close.setAttribute('aria-label','关闭广告');close.textContent='×';
      const link=document.createElement('a');link.className='popup-ad-link';
      if(item.link){link.href=item.link;link.target='_blank';link.rel='noopener noreferrer';link.addEventListener('click',()=>sendAdEvent('popup','click'));}else link.addEventListener('click',event=>event.preventDefault());
      const image=document.createElement('img');image.alt='首页弹窗广告';image.addEventListener('load',()=>sendAdEvent('popup','view'),{once:true});image.src=item.image;
      const dismiss=()=>overlay.remove();close.addEventListener('click',dismiss);overlay.addEventListener('click',event=>{if(event.target===overlay)dismiss();});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&overlay.isConnected)dismiss();},{once:true});
      link.appendChild(image);box.append(close,link);overlay.appendChild(box);document.body.appendChild(overlay);close.focus();
      if(mode==='daily')try{localStorage.setItem(storageKey,'1');}catch(e){}
    },delay);
  }
  function loadAds(){
    fetch('api/ads.php',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{
      document.querySelectorAll('.banner-ad[data-ad-position]').forEach(ad=>{const item=data.ads&&data.ads[ad.dataset.adPosition];if(!item)return;const image=ad.querySelector('img');image.addEventListener('load',()=>sendAdEvent(ad.dataset.adPosition,'view'),{once:true});image.src=item.image;ad.dataset.active='1';if(item.link){ad.href=item.link;ad.target='_blank';ad.rel='noopener noreferrer';}else ad.removeAttribute('href');
        ad.addEventListener('click',()=>sendAdEvent(ad.dataset.adPosition,'click'));
      });
      const file=location.pathname.split('/').pop()||'index.html';if(file==='index.html')showPopupAd(data.ads&&data.ads.popup);
    }).catch(()=>{});
  }
  function loadTextAds(){
    const requestedType=currentType();
    fetch('/api/text-ads',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(payload=>{if(currentType()!==requestedType)return;const texts=Array.isArray(payload.texts)?payload.texts:[],domains=Array.isArray(payload.domains)?payload.domains:[];if(!texts.length)return;const shuffle=list=>{const values=[...list];for(let i=values.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[values[i],values[j]]=[values[j],values[i]]}return values},tp=shuffle(texts),dp=shuffle(domains),type=requestedType,names={1:'香港',5:'澳门',8:'天天'},full={1:'香港六合彩',5:'澳门六合彩',8:'天天六合彩'},period=activeMaterialPeriod,fill=value=>String(value||'').replaceAll('{期数}',period||'').replaceAll('{彩种简称}',names[type]||'澳门').replaceAll('{彩种}',full[type]||'澳门六合彩');document.querySelectorAll('.shared-text-ads').forEach(node=>node.remove());document.querySelectorAll('.banner-ad[data-ad-position]').forEach((banner,section)=>{const box=document.createElement('div');box.className='shared-text-ads';for(let offset=0;offset<10;offset++){const item=tp[(section*10+offset)%tp.length],domain=dp.length?dp[(section*10+offset)%dp.length]:null,link=document.createElement('a');link.textContent=fill(item.ad_text);link.href=domain?.domain_url?fill(domain.domain_url):'#';if(domain?.domain_url){link.target='_blank';link.rel='noopener noreferrer'}box.appendChild(link)}banner.after(box)});}).catch(()=>{});
  }
  function boot() {
    ensureThreeStyles();
    const file = location.pathname.split('/').pop() || 'index.html';
    if (file === 'index.html' || file === '') {
      ensureAdStyles();
      document.querySelectorAll('section.card.section').forEach((section,index)=>{
        if(section.nextElementSibling&&section.nextElementSibling.classList.contains('banner-ad'))return;
        section.after(makeAd('home-'+(index+1),'横幅广告位 '+(index+1)));
      });
      if(!document.querySelector('.site-footer')){
        const footer=document.createElement('footer'); footer.className='site-footer';
        const name=document.createElement('strong'); name.textContent='一路发平特资料站';
        const note=document.createElement('p'); note.textContent='资料仅供参考，请理性浏览';
        const copy=document.createElement('p'); copy.textContent='© '+new Date().getFullYear()+' 平特资料站';
        const top=document.createElement('button'); top.type='button'; top.textContent='返回顶部'; top.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
        footer.append(name,note,copy,top); document.body.appendChild(footer);
      }
      track('home');
      loadSiteNetwork();
      renderHomepage();
      document.querySelectorAll('#lotteryMenu button').forEach(button => button.addEventListener('click', () => setTimeout(()=>{updateSiteNetworkTitle(Number(button.dataset.lotteryType));document.documentElement.classList.add('materials-booting');renderHomepage();track('home');}, 0)));
      loadAds();
      return;
    }
    if(file==='history'||file==='history.html'){track('history');return;}
    const match = file.match(/^([a-z]+)(?:-(\d+))?(?:\.html)?$/);
    if (!match || !sectionKeys.includes(match[1])) return;
    if(isNumberSection(match[1])){
      if(match[2])document.querySelectorAll('.record').forEach(row=>row.classList.add('number-record-row'));
      else document.querySelectorAll('.inner-row').forEach(row=>row.classList.add('number-list-row'));
      document.querySelectorAll('.number-row').forEach(row=>{row.classList.add('three-number-row');const value=row.closest('.inner-value,.value');if(value)value.classList.add('number-value');});
      document.querySelectorAll('.mini-ball').forEach(ball=>{ball.classList.add('three-ball');ball.style.removeProperty('background');});
    }
    const pageTitles={yixiao:'平特一肖',erxiao:'平特二肖',sanxiao:'\u5e73\u7279\u4e09\u8096',liuxiao:'\u5e73\u7279\u516d\u8096',weishu:'平特尾数',sanzhongsan:'三中三',erzhonger:'二中二',chengyu:'成语解肖'};
    if(!match[2]&&pageTitles[match[1]]){const heading=document.querySelector('.inner-title');if(heading)heading.textContent=pageTitles[match[1]];document.title=pageTitles[match[1]]+'－一路发平特资料站';}
    ensureAdStyles();
    const list=document.querySelector('.inner-list');
    if(list){const ad=makeAd(match[2]?'detail':'list',match[2]?'内容页广告位':'列表页广告位');match[2]?list.before(ad):document.querySelector('.topbar')?.after(ad);loadAds();}
    track(match[1]);
    match[2] ? renderDetail(match[1]) : renderList(match[1]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
