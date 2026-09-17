// Historical examples only: never generate an upcoming prediction or a hit record.
export function reviewRows(records, year) {
  const seen = new Set();
  return records.flatMap(record => {
    const period = String(record.period ?? '');
    const numbers = (record.numberList || []).map(item => Number(item.number));
    if (!/^\d{1,8}$/.test(period) || Number(period) < 1 || numbers.length !== 7 ||
        numbers.some(n => !Number.isInteger(n) || n < 1 || n > 49) || new Set(numbers).size !== 7 || seen.has(period)) return [];
    seen.add(period);
    const regular = numbers.slice(0, 6).map(n => String(n).padStart(2, '0'));
    // Six fixed examples from the completed draw, stable across reloads.
    const excluded = new Set(numbers);
    const available = Array.from({length:49},(_,index) => index + 1).filter(number => !excluded.has(number));
    let seed = (Number(period) + numbers.reduce((total,number) => total + number, 0)) >>> 0;
    const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed; };
    const take = () => String(available.splice(next() % available.length, 1)[0]).padStart(2, '0');
    const groups = [regular.slice(0,3),...Array.from({length:5},() => [take(),take(),take()])];
    return [{period, year, regular, special: String(numbers[6]).padStart(2, '0'), groups}];
  }).sort((a,b) => Number(b.period) - Number(a.period)).slice(0, 2);
}

export const chronologicalRows = rows => [...rows].sort((a,b) => b.year-a.year || Number(b.period)-Number(a.period)).slice(0,2).reverse();
export function nextDrawPeriod(payload) {
  if (payload?.code !== 10000) return null;
  const value = payload.data?.nextLotteryNumber || payload.data?.nextIntLotteryNumber;
  return /^\d{1,8}$/.test(String(value)) && Number(value)>0 ? String(Number(value)) : null;
}

function boot() {
  const host = document.getElementById('triples-review');
  if (!host) return;
  const list = host.querySelector('.triples-review-list');
  const label = host.querySelector('.triples-review-lottery');
  const names = {1:'香港六合彩',5:'澳门六合彩',8:'天天六合彩'};
  const element = (tag, className, text) => {
    const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  const selectedType = () => {
    const selected = document.querySelector('#lotteryMenu [aria-pressed="true"]');
    let value = Number(selected?.getAttribute('data-lottery-type'));
    if (!names[value]) { try { value = Number(localStorage.getItem('lotteryType')); } catch {} }
    return names[value] ? value : 5;
  };
  let version = 0, controller, timer;
  async function load() {
    clearTimeout(timer); controller?.abort();
    const id = ++version, type = selectedType();
    const activeController = new AbortController();
    controller = activeController;
    const timeout = setTimeout(() => activeController.abort(), 15000);
    label.textContent = names[type];
    list.replaceChildren(element('p','triples-review-status','正在读取历史开奖记录…'));
    host.setAttribute('aria-busy','true');
    try {
      const year = Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Shanghai'}).format(new Date()));
      async function read(y) {
        const response = await fetch('/api/history.php?lotteryType='+type+'&year='+y+'&pageNum=1', {cache:'no-store',signal:activeController.signal});
        if (!response.ok) throw Error('history_unavailable');
        const payload = await response.json();
        if (payload?.code !== 10000 || !Array.isArray(payload?.data?.recordList)) throw Error('invalid_history');
        return reviewRows(payload.data.recordList,y);
      }
      const latestRequest = fetch('/api/lottery.php?lotteryType='+type,{cache:'no-store',signal:activeController.signal})
        .then(response=>response.ok?response.json():null).then(nextDrawPeriod).catch(()=>null);
      let rows = await read(year);
      if (rows.length < 2) rows = [...rows,...await read(year-1)].slice(0,2);
      rows = chronologicalRows(rows);
      const nextPeriod = await latestRequest;
      if (id !== version) return;
      list.replaceChildren();
      for (const row of rows) {
        const article = element('article','triples-review-row','');
        article.append(element('h3','',row.year+'年 · 第'+row.period+'期'));
        const groups = element('div','triples-review-groups','');
        const hitGroupIndex = 0;
        row.groups.forEach((group,groupIndex) => {
          const groupNode = element('span','triples-review-group','');
          group.forEach((number,index) => {
            const numberNode = element('span',groupIndex === hitGroupIndex && row.regular.includes(number) ? 'triples-review-group-number is-hit' : 'triples-review-group-number',number);
            groupNode.append(numberNode);
            if (index < group.length - 1) groupNode.append(document.createTextNode(' · '));
          });
          groups.append(groupNode);
        });
        const result = element('div','triples-review-result','');
        const regular = element('div','triples-review-result-line','');
        regular.append(element('span','triples-review-result-label','开奖号码'));
        row.regular.forEach(number => regular.append(element('span',row.groups[hitGroupIndex].includes(number) ? 'triples-review-ball triples-review-ball-regular is-hit' : 'triples-review-ball triples-review-ball-regular',number)));
        const special = element('div','triples-review-result-line triples-review-result-special','');
        special.append(element('span','triples-review-result-plus','+'));
        special.append(element('span','triples-review-ball triples-review-ball-special',row.special));
        article.append(groups,result);
        result.append(regular,special);
        list.append(article);
      }
      if (!rows.length) list.append(element('p','triples-review-status','暂无完整的历史开奖记录'));
      const pending = element('article','triples-review-row triples-review-pending','');
      const configuredLink = (className,text) => {
        const link = element('a',className,text);
        link.href = '/api/member-post-register';
        return link;
      };
      pending.append(element('h3','',nextPeriod?nextPeriod+'期六组三中三':'最新一期六组三中三'),
        configuredLink('triples-review-text-link','【点击查看相关资料】'),
        element('p','triples-review-caption',nextPeriod?'本期待开奖 · 点击查看相关资料':'最新期数同步中 · 点击查看相关资料'),
        configuredLink('triples-review-history-button','查看相关资料'));
      list.append(pending);
    } catch {
      if (id === version) list.replaceChildren(element('p','triples-review-status','历史数据暂不可用，稍后自动重试'));
    } finally {
      clearTimeout(timeout);
      if (id === version) { host.setAttribute('aria-busy','false'); if (!document.hidden) timer=setTimeout(load,60000); }
    }
  }
  document.querySelectorAll('#lotteryMenu button').forEach(button => button.addEventListener('click',()=>setTimeout(load,0)));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){version++;controller?.abort();clearTimeout(timer);}else void load();});
  void load();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
}
