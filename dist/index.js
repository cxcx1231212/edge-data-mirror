var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/public-api.js
var json = /* @__PURE__ */ __name((data, status = 200) => Response.json(data, { status, headers: { "access-control-allow-origin": "*", "cache-control": "no-store" } }), "json");
var validTypes = /* @__PURE__ */ new Set([1, 5, 8]);
async function handleApi(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if ((path === "/api/data.php" || path === "/api/materials.php") && request.method === "GET") return materials(url, env.DB, path.endsWith("data.php") ? 500 : 100);
  if (path === "/api/ads.php" && request.method === "GET") return ads(env.DB, env);
  if (path === "/api/site-links" && request.method === "GET") return siteLinks(env);
  if (path === "/api/text-ads" && request.method === "GET") return textAds(env);
  if (path === "/api/track.php" && request.method === "POST") return track(request, env.DB);
  if (path === "/api/track-ad.php" && request.method === "POST") return trackAd(request, env.DB);
  if (path === "/api/wuqi.php" && request.method === "GET") return handleWuqi(url);
  if (path === "/api/lottery.php" && request.method === "GET") return lottery(url);
  if (path === "/api/history.php" && request.method === "GET") return history(url);
  if (path === "/api/chat/v1" && (request.method === "GET" || request.method === "POST")) return serviceChat(request, env.LIUHE_CHAT);
  return null;
}
__name(handleApi, "handleApi");
async function upstreamJson(target) {
  try {
    const response = await fetch(target, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return json(payload);
  } catch (error) {
    console.error("public_upstream_failed", target, error?.message || error);
    return json({ message: "\u6570\u636E\u52A0\u8F7D\u5931\u8D25" }, 502);
  }
}
__name(upstreamJson, "upstreamJson");
async function lottery(url) {
  const type = Number(url.searchParams.get("lotteryType") || 1);
  if (!validTypes.has(type)) return json({ message: "\u6570\u636E\u52A0\u8F7D\u5931\u8D25" }, 422);
  return upstreamJson(`https://6htv70.com/gallerynew/h5/index/lastLotteryRecord?lotteryType=${type}`);
}
__name(lottery, "lottery");
async function history(url) {
  const type = Number(url.searchParams.get("lotteryType") || 1), page = Math.min(100, Math.max(1, Number(url.searchParams.get("pageNum") || 1))), year = Math.min(2100, Math.max(2e3, Number(url.searchParams.get("year") || (/* @__PURE__ */ new Date()).getUTCFullYear())));
  if (!validTypes.has(type)) return json({ message: "\u6570\u636E\u52A0\u8F7D\u5931\u8D25" }, 422);
  return upstreamJson(`https://6htv70.com/gallerynew/h5/lottery/search?pageNum=${page}&year=${year}&sort=1&lotteryType=${type}`);
}
__name(history, "history");
async function siteLinks(env) {
  try {
    const response = await env.CENTRAL_LINKS.fetch(new Request("https://123-liuhe-site/api/public/recommended-sites", { headers: { accept: "application/json", "cache-control": "no-cache" } })), payload = await response.json();
    if (response.ok && payload.success && Array.isArray(payload.data)) return json({ success: true, central: true, links: payload.data.map((item, index) => ({ slot: item.id || index + 1, label: item.name, url: item.site_url })) });
  } catch (error) {
    console.error("central_links_failed", error?.message || error);
  }
  const db = env.DB;
  await db.prepare("CREATE TABLE IF NOT EXISTS site_links(slot INTEGER PRIMARY KEY,label TEXT NOT NULL DEFAULT '',url TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  const { results = [] } = await db.prepare("SELECT slot,label,url FROM site_links WHERE enabled=1 ORDER BY slot").all();
  return json({ success: true, central: false, links: results });
}
__name(siteLinks, "siteLinks");
async function textAds(env) {
  try {
    const response = await env.CENTRAL_LINKS.fetch(new Request("https://123-liuhe-site/api/public/text-ads", { headers: { accept: "application/json", "cache-control": "no-cache" } })), payload = await response.json();
    if (response.ok && payload.success) return json(payload);
  } catch (error) {
    console.error("central_text_ads_failed", error?.message || error);
  }
  return json({ success: false, texts: [], domains: [] }, 502);
}
__name(textAds, "textAds");
async function serviceChat(request, service) {
  const target = new URL(request.url);
  target.pathname = "/v1/chat";
  return service.fetch(new Request(target.toString(), request));
}
__name(serviceChat, "serviceChat");
async function handleWuqi(url) {
  const map = { 1: "xg", 5: "xam", 8: "tt" }, type = Number(url.searchParams.get("lotteryType") || 1), page = Math.min(100, Math.max(1, Number(url.searchParams.get("page") || 1)));
  if (!map[type]) return json({ success: false, message: "\u5F69\u79CD\u9519\u8BEF" }, 422);
  try {
    const body = new URLSearchParams({ page: String(page), type: map[type] }), response = await fetch("https://lhw.235-from.com/index/wuqiapi/getwuqibizhong", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "accept": "application/json", "user-agent": "Mozilla/5.0" }, body });
    if (!response.ok) throw new Error(String(response.status));
    return new Response(response.body, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" } });
  } catch {
    return json({ success: false, message: "\u4E94\u671F\u5FC5\u4E2D\u63A5\u53E3\u6682\u65F6\u4E0D\u53EF\u7528" }, 502);
  }
}
__name(handleWuqi, "handleWuqi");
async function materials(url, db, cap) {
  const type = Number(url.searchParams.get("lotteryType") || 1), section = (url.searchParams.get("section") || "").trim(), limit = Math.min(cap, Math.max(1, Number(url.searchParams.get("limit") || 30)));
  if (!validTypes.has(type)) return json({ success: false, message: "\u5F69\u79CD\u9519\u8BEF" }, 422);
  let sql = "SELECT id,lottery_type,section_key,source_name,period,content,result_special,hit_status,updated_at FROM materials WHERE lottery_type=? AND published=1", args = [type];
  if (section) {
    sql += " AND section_key=?";
    args.push(section);
  }
  sql += " ORDER BY CAST(period AS INTEGER) DESC,source_name ASC,id DESC LIMIT ?";
  args.push(limit);
  const { results = [] } = await db.prepare(sql).bind(...args).all(), stats = {};
  for (const row of results) {
    const s = stats[row.source_name] ??= { settled: 0, hits: 0, accuracy: 0 };
    if (row.hit_status !== "pending") {
      s.settled++;
      if (row.hit_status === "hit") s.hits++;
    }
  }
  for (const s of Object.values(stats)) s.accuracy = s.settled ? Math.round(s.hits / s.settled * 100) : 0;
  return json({ success: true, records: results, stats });
}
__name(materials, "materials");
async function ads(db, env) {
  try {
    const response = await env.CENTRAL_LINKS.fetch(new Request("https://123-liuhe-site/api/public/ads", { headers: { accept: "application/json", "cache-control": "no-cache" } })), payload = await response.json();
    if (response.ok && payload.success && Array.isArray(payload.data)) {
      const out2 = {}, banner = payload.data.find((item) => item.position_key === "banner"), popup = payload.data.find((item) => item.position_key === "popup");
      if (banner) {
        const value = { position: "banner", image: banner.image_url, link: banner.link_url, displayMode: banner.display_mode, delaySeconds: Number(banner.delay_seconds) };
        for (let index = 1; index <= 20; index++) out2[`home-${index}`] = value;
        out2.list = value;
        out2.detail = value;
      }
      if (popup) out2.popup = { position: "popup", image: popup.image_url, link: popup.link_url, displayMode: popup.display_mode, delaySeconds: Number(popup.delay_seconds) };
      return json({ success: true, central: true, ads: out2 });
    }
  } catch (error) {
    console.error("central_ads_failed", error?.message || error);
  }
  const now2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " "), { results = [] } = await db.prepare("SELECT position_key,image_path,link_url,display_mode,delay_seconds FROM ads WHERE enabled=1 AND image_path<>'' AND (start_at IS NULL OR start_at<=?) AND (end_at IS NULL OR end_at>=?)").bind(now2, now2).all(), out = {};
  for (const row of results) out[row.position_key] = { position: row.position_key, image: row.image_path, link: row.link_url, displayMode: row.display_mode, delaySeconds: Number(row.delay_seconds) };
  return json({ success: true, central: false, ads: out });
}
__name(ads, "ads");
async function track(request, db) {
  const form = await request.formData(), type = Number(form.get("lottery_type")), section = String(form.get("section_key") || ""), device = String(form.get("device") || "");
  if (!validTypes.has(type) || !["home", "history", "yixiao", "erxiao", "sanxiao", "liuxiao", "tema", "weishu", "sanzhongsan", "erzhonger", "chengyu"].includes(section) || !["mobile", "desktop"].includes(device)) return json({ success: false }, 422);
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), now2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " "), ip = request.headers.get("CF-Connecting-IP") || "", country = request.cf?.country || "\u672A\u77E5", region = request.cf?.region || "\u672A\u77E5", city = request.cf?.city || "\u672A\u77E5";
  await db.prepare("INSERT INTO analytics_daily VALUES(?,?,?,?,1) ON CONFLICT(visit_date,lottery_type,section_key,device) DO UPDATE SET views=views+1").bind(today, type, section, device).run();
  if (ip) await db.prepare("INSERT INTO analytics_visitors VALUES(?,?,?,?,?,?,1) ON CONFLICT(ip_address) DO UPDATE SET country=excluded.country,region_name=excluded.region_name,city=excluded.city,last_seen=excluded.last_seen,views=views+1").bind(ip, country, region, city, now2, now2).run();
  return json({ success: true });
}
__name(track, "track");
async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
async function trackAd(request, db) {
  const form = await request.formData(), position = String(form.get("position_key") || ""), event = String(form.get("event_type") || ""), positions = [...Array.from({ length: 9 }, (_, i) => `home-${i + 1}`), "popup", "list", "detail"];
  if (!positions.includes(position) || !["view", "click"].includes(event)) return json({ success: false }, 422);
  if (event === "view") {
    await db.prepare("INSERT INTO ad_stats(position_key,impressions) VALUES(?,1) ON CONFLICT(position_key) DO UPDATE SET impressions=impressions+1").bind(position).run();
    return json({ success: true });
  }
  const ip = request.headers.get("CF-Connecting-IP") || "", hash2 = await sha256(ip || "unknown"), now2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " "), cutoff = new Date(Date.now() - 864e5).toISOString().slice(0, 19).replace("T", " "), prior = await db.prepare("SELECT 1 ok FROM ad_clicks WHERE position_key=? AND ip_hash=? AND clicked_at>? LIMIT 1").bind(position, hash2, cutoff).first(), valid = !prior, visitor = ip ? await db.prepare("SELECT country,region_name,city FROM analytics_visitors WHERE ip_address=?").bind(ip).first() : null, region = visitor ? [visitor.country, visitor.region_name, visitor.city].filter(Boolean).join(" / ") : "\u672A\u77E5";
  await db.batch([db.prepare("INSERT INTO ad_stats(position_key,total_clicks,valid_clicks,last_clicked_at) VALUES(?,1,?,?) ON CONFLICT(position_key) DO UPDATE SET total_clicks=total_clicks+1,valid_clicks=valid_clicks+excluded.valid_clicks,last_clicked_at=excluded.last_clicked_at").bind(position, valid ? 1 : 0, now2), db.prepare("INSERT INTO ad_clicks(position_key,ip_hash,ip_address,region_name,device,page_path,clicked_at) VALUES(?,?,?,?,?,?,?)").bind(position, hash2, ip, region, String(form.get("device") || "unknown").slice(0, 12), String(form.get("page_path") || "").slice(0, 255), now2)]);
  return json({ success: true, valid });
}
__name(trackAd, "trackAd");

// src/automation.js
var TYPES = [1, 5, 8];
var ZODIACS = ["\u9F20", "\u725B", "\u864E", "\u5154", "\u9F99", "\u86C7", "\u9A6C", "\u7F8A", "\u7334", "\u9E21", "\u72D7", "\u732A"];
var NAMES = {
  yixiao: ["\u8D22\u795E\u70B9\u91D1", "\u9E3F\u8FD0\u5F53\u5934", "\u91D1\u724C\u795E\u7B97", "\u8001\u5F20\u5BC6\u62A5", "\u963F\u65FA\u5FC3\u6C34", "\u798F\u53D4\u624B\u8BB0", "\u91D1\u5E93\u5BC6\u7B3A", "\u987A\u98CE\u5FEB\u8BAF", "\u8001\u9648\u7384\u673A", "\u5FB7\u53D4\u89E3\u7801", "\u65FA\u8D22\u79D8\u7B08", "\u9E3F\u8FD0\u5929\u5E08", "\u4E00\u8DEF\u957F\u7EA2", "\u53D1\u8D22\u4F7F\u8005", "\u91D1\u699C\u9AD8\u4EBA", "\u6C11\u95F4\u9AD8\u624B", "\u9E3F\u8FD0\u795E\u7B97", "\u5BCC\u8D35\u638C\u67DC", "\u91D1\u724C\u8001\u674E", "\u6FB3\u95E8\u8D22\u53D4", "\u6E2F\u6FB3\u795E\u624B", "\u738B\u724C\u963F\u53D4", "\u8D22\u795E\u5BC6\u62A5", "\u91D1\u9F99\u795E\u7B97", "\u5927\u80DC\u53C2\u8003", "\u798F\u661F\u89E3\u7801", "\u8001\u8857\u5BC6\u63A2", "\u65FA\u89D2\u9AD8\u4EBA", "\u9E3F\u8FD0\u5148\u950B", "\u91D1\u724C\u6599\u738B"],
  erxiao: ["\u6865\u5934\u963F\u4F2F", "\u5357\u95E8\u8001\u674E", "\u7965\u8BB0\u6863\u6848", "\u6625\u98CE\u8336\u9986", "\u9E3F\u8FD0\u963F\u6210", "\u5FB7\u53D4\u7B14\u8BB0", "\u65FA\u89D2\u5C0F\u54E5", "\u91D1\u798F\u6D88\u606F", "\u8001\u53CB\u6765\u6599", "\u987A\u53D1\u963F\u4E1C"],
  sanxiao: ["\u4E1C\u53D4\u8336\u8BDD", "\u963F\u6D77\u624B\u672D", "\u8001\u949F\u79D8\u7B08", "\u798F\u6765\u5C0F\u7AD9", "\u5927\u80DC\u53C2\u8003", "\u4E5D\u8BB0\u5FEB\u62A5", "\u8363\u53D4\u7CBE\u9009", "\u767E\u6C47\u6D88\u606F", "\u987A\u610F\u8336\u5BA4", "\u7965\u54E5\u624B\u8BB0"],
  liuxiao: ["\u5BCC\u8D35\u4EBA\u5BB6", "\u957F\u4E50\u574A", "\u987A\u666F\u697C", "\u91D1\u7389\u5802", "\u9E3F\u8FD0\u574A", "\u65FA\u6765\u9601", "\u6EE1\u5802\u5F69", "\u597D\u666F\u8336\u5BA4", "\u798F\u8FD0\u7AD9", "\u8001\u53CB\u6C47"],
  weishu: ["\u5C3E\u6570\u8001\u738B", "\u963F\u57CE\u770B\u5C3E", "\u8001\u83AB\u5C3E\u6570", "\u4E1C\u53D4\u53CC\u5C3E", "\u963F\u6770\u770B\u5C3E", "\u5927\u6D77\u5C3E\u6570", "\u798F\u5AC2\u53CC\u5C3E", "\u5C0F\u9A6C\u770B\u5C3E", "\u8001\u53F6\u5C3E\u6570", "\u65FA\u94FA\u53CC\u5C3E"],
  sanzhongsan: ["\u8001\u5175\u770B\u76D8", "\u963F\u6CF0\u7CBE\u9009", "\u4E09\u54E5\u5FC3\u6C34", "\u8001\u4E25\u7A33\u6599", "\u4E1C\u95E8\u5FEB\u62A5", "\u963F\u52C7\u63A8\u8350", "\u91D1\u624B\u6307", "\u8001\u6881\u5BC6\u62A5", "\u4E5D\u53D4\u624B\u8BB0", "\u65FA\u4ED4\u53C2\u8003"],
  erzhonger: ["\u8001\u5434\u770B\u53F7", "\u963F\u68EE\u7CBE\u9009", "\u798F\u6EE1\u5802", "\u8001\u8857\u5BC6\u62A5", "\u5174\u65FA\u53C2\u8003", "\u963F\u5764\u624B\u8BB0", "\u987A\u53D1\u63A8\u8350", "\u4E1C\u53D4\u770B\u76D8", "\u805A\u5B9D\u76C6", "\u963F\u6770\u5FC3\u6C34"],
  chengyu: ["\u8857\u574A\u6210\u8BED", "\u8001\u9648\u89E3\u8BED", "\u798F\u53D4\u6210\u8BED", "\u963F\u660E\u89E3\u8BED", "\u987A\u98CE\u6210\u8BED", "\u65FA\u54E5\u89E3\u8BED", "\u91D1\u724C\u6210\u8BED", "\u8001\u53CB\u89E3\u8BED", "\u9E3F\u8FD0\u6210\u8BED", "\u559C\u6765\u89E3\u8BED"]
};
var IDIOMS = ["\u9F20\u76EE\u5BF8\u5149", "\u4E5D\u725B\u4E00\u6BDB", "\u864E\u864E\u751F\u5A01", "\u5B88\u682A\u5F85\u5154", "\u9F99\u98DE\u51E4\u821E", "\u753B\u86C7\u6DFB\u8DB3", "\u9A6C\u5230\u6210\u529F", "\u4EA1\u7F8A\u8865\u7262", "\u6C90\u7334\u800C\u51A0", "\u95FB\u9E21\u8D77\u821E", "\u72D7\u5C3E\u7EED\u8C82", "\u732A\u670B\u72D7\u53CB"];
var PROFILES = [[1.3, 0.5, 0.2, 1.1, -0.1], [0.5, 1, 0.5, 0.6, 0.1], [0.2, 0.5, 1.2, 0.4, 0.05], [1, 0.7, 0.3, 1.2, 0.15], [0.4, 0.8, 0.5, 0.5, 0.7], [1.1, 0.4, 0.4, 0.9, -0.25], [0.5, 0.9, 0.7, 0.5, 0.25], [0.8, 0.5, 0.7, 1, -0.1], [0.7, 0.8, 0.4, 0.7, 0.35], [0.7, 0.7, 0.7, 0.7, 0.1]];
var ts = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " "), "ts");
async function getJson(url) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`\u5F00\u5956\u63A5\u53E3 HTTP ${r.status}`);
  return r.json();
}
__name(getJson, "getJson");
async function source(type) {
  const year = (/* @__PURE__ */ new Date()).getUTCFullYear(), pages = [];
  for (let p = 1; p <= 6; p++) {
    const d = await getJson(`https://6htv70.com/gallerynew/h5/lottery/search?pageNum=${p}&year=${year}&sort=1&lotteryType=${type}`), batch = d?.data?.recordList || [];
    if (!batch.length) break;
    pages.push(...batch);
  }
  const latest = await getJson(`https://6htv70.com/gallerynew/h5/index/lastLotteryRecord?lotteryType=${type}`);
  if (latest?.code !== 1e4 || pages.length < 30) throw new Error(`${type} \u5386\u53F2\u6570\u636E\u4E0D\u8DB3`);
  return { records: pages.slice(0, 60), latest: latest.data };
}
__name(source, "source");
function rank(records, items, extract, profile) {
  const f10 = new Map(items.map((x) => [x, 0])), f30 = new Map(f10), f60 = new Map(f10), recent = new Map(f10), gap = new Map(items.map((x) => [x, 60]));
  records.forEach((r, i) => {
    for (const x of new Set(extract(r))) {
      if (!f10.has(x)) continue;
      if (i < 10) f10.set(x, f10.get(x) + 1);
      if (i < 30) f30.set(x, f30.get(x) + 1);
      f60.set(x, f60.get(x) + 1);
      recent.set(x, recent.get(x) + Math.exp(-i / 12));
      if (gap.get(x) === 60) gap.set(x, i);
    }
  });
  const [a, b, c, d, e] = profile;
  return [...items].sort((x, y) => f10.get(y) * a + f30.get(y) * b + f60.get(y) * c + recent.get(y) * d + Math.min(gap.get(y), 12) * e - (f10.get(x) * a + f30.get(x) * b + f60.get(x) * c + recent.get(x) * d + Math.min(gap.get(x), 12) * e));
}
__name(rank, "rank");
var balls = /* @__PURE__ */ __name((r) => (r.numberList || []).slice(0, 7), "balls");
var numbers = /* @__PURE__ */ __name((r) => balls(r).map((b) => Number(b.number)).filter((n) => n >= 1 && n <= 49), "numbers");
var zodiacs = /* @__PURE__ */ __name((r) => balls(r).map((b) => String(b.shengXiao || "")).filter(Boolean), "zodiacs");
async function upsert(db, type, section, name, period, content) {
  await db.prepare("INSERT INTO materials(lottery_type,section_key,source_name,period,content,result_special,hit_status,published,created_at,updated_at) VALUES(?,?,?,?,?,NULL,'pending',1,?,?) ON CONFLICT(lottery_type,section_key,source_name,period) DO NOTHING").bind(type, section, name, period, content, ts(), ts()).run();
}
__name(upsert, "upsert");
async function settle(db, type, latest) {
  const period = String(latest.period || ""), bs = (latest.numberList || []).slice(0, 7);
  if (!period || bs.length < 7) return 0;
  const nums = bs.map((x) => String(x.number).padStart(2, "0")), zs = [...new Set(bs.map((x) => String(x.shengXiao || "")))], tails = nums.map((x) => x.at(-1)), special = nums[6], { results = [] } = await db.prepare("SELECT id,section_key,content FROM materials WHERE lottery_type=? AND period=? AND hit_status='pending'").bind(type, period).all();
  let updated = 0;
  for (const row of results) {
    const tokens = row.content.trim().split(/[\s,，、·・｜：:]+/u).filter(Boolean);
    let hit = false;
    if (["yixiao", "erxiao", "sanxiao", "liuxiao"].includes(row.section_key)) hit = tokens.some((x) => zs.includes(x));
    else if (row.section_key === "tema") hit = tokens.includes(special);
    else if (row.section_key === "weishu") hit = tokens.some((x) => x.endsWith("\u5C3E") && tails.includes(x[0]));
    else if (row.section_key === "sanzhongsan") hit = tokens.filter((x) => nums.includes(x)).length >= 3;
    else if (row.section_key === "erzhonger") hit = tokens.filter((x) => nums.includes(x)).length >= 2;
    else if (row.section_key === "chengyu") hit = zs.some((x) => row.content.includes(x));
    await db.prepare("UPDATE materials SET result_special=?,hit_status=?,updated_at=? WHERE id=?").bind(special, hit ? "hit" : "miss", ts(), row.id).run();
    updated++;
  }
  return updated;
}
__name(settle, "settle");
async function generate(db, type, records, period) {
  for (const name of NAMES.yixiao) await upsert(db, type, "yixiao", name, period, ZODIACS[Math.floor(Math.random() * ZODIACS.length)]);
  for (const [section, size] of [["erxiao", 2], ["sanxiao", 3], ["liuxiao", 6]]) for (let i = 0; i < 10; i++) {
    const ranked = rank(records, ZODIACS, zodiacs, PROFILES[i]), group = [];
    for (let j = 0; j < size; j++) group.push(ranked[(i + j) % ranked.length]);
    await upsert(db, type, section, NAMES[section][i], period, group.join(" "));
  }
  const tails = rank(records, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], (r) => numbers(r).map((n) => n % 10), PROFILES[0]);
  for (let i = 0; i < 10; i++) await upsert(db, type, "weishu", NAMES.weishu[i], period, `${tails[i]}\u5C3E ${tails[(i + 5) % 10]}\u5C3E`);
  const nums = Array.from({ length: 49 }, (_, i) => i + 1);
  for (let i = 0; i < 10; i++) {
    const ranked = rank(records, nums, numbers, PROFILES[i]);
    const three = ranked.slice(i % 4, i % 4 + 10).sort((a, b) => a - b).map((n) => String(n).padStart(2, "0"));
    const pair = ranked.slice(i % 3, i % 3 + 16).sort((a, b) => a - b).map((n) => String(n).padStart(2, "0"));
    await upsert(db, type, "sanzhongsan", NAMES.sanzhongsan[i], period, three.join(" "));
    await upsert(db, type, "erzhonger", NAMES.erzhonger[i], period, pair.join(" "));
    const idiom = IDIOMS[(Number(period) + i) % IDIOMS.length], zs = ZODIACS.filter((x) => idiom.includes(x));
    await upsert(db, type, "chengyu", NAMES.chengyu[i], period, `${idiom}\uFF5C\u89E3\u8096\uFF1A${zs.join("\u30FB")}`);
  }
}
__name(generate, "generate");
async function runAutomation(db) {
  const started = ts(), run = await db.prepare("INSERT INTO automation_runs(task_key,status,started_at) VALUES('cloudflare-auto','running',?)").bind(started).run(), id = run.meta.last_row_id, summary = {};
  try {
    for (const type of TYPES) {
      const { records, latest } = await source(type), updated = await settle(db, type, latest), period = String(latest.nextLotteryNumber || "");
      if (!period) throw new Error(`${type} \u7F3A\u5C11\u4E0B\u671F\u671F\u53F7`);
      await generate(db, type, records, period);
      summary[type] = { success: true, settled: updated, period };
    }
    await db.prepare("UPDATE automation_runs SET status='success',summary=?,finished_at=? WHERE id=?").bind(JSON.stringify(summary), ts(), id).run();
    return { success: true, summary };
  } catch (error) {
    await db.prepare("UPDATE automation_runs SET status='failed',error_message=?,finished_at=? WHERE id=?").bind(String(error?.message || error), ts(), id).run();
    return { success: false, error: String(error?.message || error) };
  }
}
__name(runAutomation, "runAutomation");

// node_modules/.pnpm/bcryptjs@3.0.3/node_modules/bcryptjs/index.js
import nodeCrypto from "crypto";
var randomFallback = null;
function randomBytes(len) {
  try {
    return crypto.getRandomValues(new Uint8Array(len));
  } catch {
  }
  try {
    return nodeCrypto.randomBytes(len);
  } catch {
  }
  if (!randomFallback) {
    throw Error(
      "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
    );
  }
  return randomFallback(len);
}
__name(randomBytes, "randomBytes");
function setRandomFallback(random) {
  randomFallback = random;
}
__name(setRandomFallback, "setRandomFallback");
function genSaltSync(rounds, seed_length) {
  rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof rounds !== "number")
    throw Error(
      "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
    );
  if (rounds < 4) rounds = 4;
  else if (rounds > 31) rounds = 31;
  var salt = [];
  salt.push("$2b$");
  if (rounds < 10) salt.push("0");
  salt.push(rounds.toString());
  salt.push("$");
  salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
  return salt.join("");
}
__name(genSaltSync, "genSaltSync");
function genSalt(rounds, seed_length, callback) {
  if (typeof seed_length === "function")
    callback = seed_length, seed_length = void 0;
  if (typeof rounds === "function") callback = rounds, rounds = void 0;
  if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
  else if (typeof rounds !== "number")
    throw Error("illegal arguments: " + typeof rounds);
  function _async(callback2) {
    nextTick(function() {
      try {
        callback2(null, genSaltSync(rounds));
      } catch (err) {
        callback2(err);
      }
    });
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(genSalt, "genSalt");
function hashSync(password, salt) {
  if (typeof salt === "undefined") salt = GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof salt === "number") salt = genSaltSync(salt);
  if (typeof password !== "string" || typeof salt !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof salt);
  return _hash(password, salt);
}
__name(hashSync, "hashSync");
function hash(password, salt, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password === "string" && typeof salt === "number")
      genSalt(salt, function(err, salt2) {
        _hash(password, salt2, callback2, progressCallback);
      });
    else if (typeof password === "string" && typeof salt === "string")
      _hash(password, salt, callback2, progressCallback);
    else
      nextTick(
        callback2.bind(
          this,
          Error("Illegal arguments: " + typeof password + ", " + typeof salt)
        )
      );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(hash, "hash");
function safeStringCompare(known, unknown) {
  var diff = known.length ^ unknown.length;
  for (var i = 0; i < known.length; ++i) {
    diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
  }
  return diff === 0;
}
__name(safeStringCompare, "safeStringCompare");
function compareSync(password, hash2) {
  if (typeof password !== "string" || typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof hash2);
  if (hash2.length !== 60) return false;
  return safeStringCompare(
    hashSync(password, hash2.substring(0, hash2.length - 31)),
    hash2
  );
}
__name(compareSync, "compareSync");
function compare(password, hashValue, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password !== "string" || typeof hashValue !== "string") {
      nextTick(
        callback2.bind(
          this,
          Error(
            "Illegal arguments: " + typeof password + ", " + typeof hashValue
          )
        )
      );
      return;
    }
    if (hashValue.length !== 60) {
      nextTick(callback2.bind(this, null, false));
      return;
    }
    hash(
      password,
      hashValue.substring(0, 29),
      function(err, comp) {
        if (err) callback2(err);
        else callback2(null, safeStringCompare(comp, hashValue));
      },
      progressCallback
    );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(compare, "compare");
function getRounds(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  return parseInt(hash2.split("$")[2], 10);
}
__name(getRounds, "getRounds");
function getSalt(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  if (hash2.length !== 60)
    throw Error("Illegal hash length: " + hash2.length + " != 60");
  return hash2.substring(0, 29);
}
__name(getSalt, "getSalt");
function truncates(password) {
  if (typeof password !== "string")
    throw Error("Illegal arguments: " + typeof password);
  return utf8Length(password) > 72;
}
__name(truncates, "truncates");
var nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function utf8Length(string) {
  var len = 0, c = 0;
  for (var i = 0; i < string.length; ++i) {
    c = string.charCodeAt(i);
    if (c < 128) len += 1;
    else if (c < 2048) len += 2;
    else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
      ++i;
      len += 4;
    } else len += 3;
  }
  return len;
}
__name(utf8Length, "utf8Length");
function utf8Array(string) {
  var offset = 0, c1, c2;
  var buffer = new Array(utf8Length(string));
  for (var i = 0, k = string.length; i < k; ++i) {
    c1 = string.charCodeAt(i);
    if (c1 < 128) {
      buffer[offset++] = c1;
    } else if (c1 < 2048) {
      buffer[offset++] = c1 >> 6 | 192;
      buffer[offset++] = c1 & 63 | 128;
    } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
      c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
      ++i;
      buffer[offset++] = c1 >> 18 | 240;
      buffer[offset++] = c1 >> 12 & 63 | 128;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    } else {
      buffer[offset++] = c1 >> 12 | 224;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    }
  }
  return buffer;
}
__name(utf8Array, "utf8Array");
var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
var BASE64_INDEX = [
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  1,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  -1,
  -1,
  -1,
  -1,
  -1
];
function base64_encode(b, len) {
  var off = 0, rs = [], c1, c2;
  if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
  while (off < len) {
    c1 = b[off++] & 255;
    rs.push(BASE64_CODE[c1 >> 2 & 63]);
    c1 = (c1 & 3) << 4;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 4 & 15;
    rs.push(BASE64_CODE[c1 & 63]);
    c1 = (c2 & 15) << 2;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 6 & 3;
    rs.push(BASE64_CODE[c1 & 63]);
    rs.push(BASE64_CODE[c2 & 63]);
  }
  return rs.join("");
}
__name(base64_encode, "base64_encode");
function base64_decode(s, len) {
  var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
  if (len <= 0) throw Error("Illegal len: " + len);
  while (off < slen - 1 && olen < len) {
    code = s.charCodeAt(off++);
    c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    code = s.charCodeAt(off++);
    c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c1 == -1 || c2 == -1) break;
    o = c1 << 2 >>> 0;
    o |= (c2 & 48) >> 4;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1) break;
    o = (c2 & 15) << 4 >>> 0;
    o |= (c3 & 60) >> 2;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o = (c3 & 3) << 6 >>> 0;
    o |= c4;
    rs.push(String.fromCharCode(o));
    ++olen;
  }
  var res = [];
  for (off = 0; off < olen; off++) res.push(rs[off].charCodeAt(0));
  return res;
}
__name(base64_decode, "base64_decode");
var BCRYPT_SALT_LEN = 16;
var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
var BLOWFISH_NUM_ROUNDS = 16;
var MAX_EXECUTION_TIME = 100;
var P_ORIG = [
  608135816,
  2242054355,
  320440878,
  57701188,
  2752067618,
  698298832,
  137296536,
  3964562569,
  1160258022,
  953160567,
  3193202383,
  887688300,
  3232508343,
  3380367581,
  1065670069,
  3041331479,
  2450970073,
  2306472731
];
var S_ORIG = [
  3509652390,
  2564797868,
  805139163,
  3491422135,
  3101798381,
  1780907670,
  3128725573,
  4046225305,
  614570311,
  3012652279,
  134345442,
  2240740374,
  1667834072,
  1901547113,
  2757295779,
  4103290238,
  227898511,
  1921955416,
  1904987480,
  2182433518,
  2069144605,
  3260701109,
  2620446009,
  720527379,
  3318853667,
  677414384,
  3393288472,
  3101374703,
  2390351024,
  1614419982,
  1822297739,
  2954791486,
  3608508353,
  3174124327,
  2024746970,
  1432378464,
  3864339955,
  2857741204,
  1464375394,
  1676153920,
  1439316330,
  715854006,
  3033291828,
  289532110,
  2706671279,
  2087905683,
  3018724369,
  1668267050,
  732546397,
  1947742710,
  3462151702,
  2609353502,
  2950085171,
  1814351708,
  2050118529,
  680887927,
  999245976,
  1800124847,
  3300911131,
  1713906067,
  1641548236,
  4213287313,
  1216130144,
  1575780402,
  4018429277,
  3917837745,
  3693486850,
  3949271944,
  596196993,
  3549867205,
  258830323,
  2213823033,
  772490370,
  2760122372,
  1774776394,
  2652871518,
  566650946,
  4142492826,
  1728879713,
  2882767088,
  1783734482,
  3629395816,
  2517608232,
  2874225571,
  1861159788,
  326777828,
  3124490320,
  2130389656,
  2716951837,
  967770486,
  1724537150,
  2185432712,
  2364442137,
  1164943284,
  2105845187,
  998989502,
  3765401048,
  2244026483,
  1075463327,
  1455516326,
  1322494562,
  910128902,
  469688178,
  1117454909,
  936433444,
  3490320968,
  3675253459,
  1240580251,
  122909385,
  2157517691,
  634681816,
  4142456567,
  3825094682,
  3061402683,
  2540495037,
  79693498,
  3249098678,
  1084186820,
  1583128258,
  426386531,
  1761308591,
  1047286709,
  322548459,
  995290223,
  1845252383,
  2603652396,
  3431023940,
  2942221577,
  3202600964,
  3727903485,
  1712269319,
  422464435,
  3234572375,
  1170764815,
  3523960633,
  3117677531,
  1434042557,
  442511882,
  3600875718,
  1076654713,
  1738483198,
  4213154764,
  2393238008,
  3677496056,
  1014306527,
  4251020053,
  793779912,
  2902807211,
  842905082,
  4246964064,
  1395751752,
  1040244610,
  2656851899,
  3396308128,
  445077038,
  3742853595,
  3577915638,
  679411651,
  2892444358,
  2354009459,
  1767581616,
  3150600392,
  3791627101,
  3102740896,
  284835224,
  4246832056,
  1258075500,
  768725851,
  2589189241,
  3069724005,
  3532540348,
  1274779536,
  3789419226,
  2764799539,
  1660621633,
  3471099624,
  4011903706,
  913787905,
  3497959166,
  737222580,
  2514213453,
  2928710040,
  3937242737,
  1804850592,
  3499020752,
  2949064160,
  2386320175,
  2390070455,
  2415321851,
  4061277028,
  2290661394,
  2416832540,
  1336762016,
  1754252060,
  3520065937,
  3014181293,
  791618072,
  3188594551,
  3933548030,
  2332172193,
  3852520463,
  3043980520,
  413987798,
  3465142937,
  3030929376,
  4245938359,
  2093235073,
  3534596313,
  375366246,
  2157278981,
  2479649556,
  555357303,
  3870105701,
  2008414854,
  3344188149,
  4221384143,
  3956125452,
  2067696032,
  3594591187,
  2921233993,
  2428461,
  544322398,
  577241275,
  1471733935,
  610547355,
  4027169054,
  1432588573,
  1507829418,
  2025931657,
  3646575487,
  545086370,
  48609733,
  2200306550,
  1653985193,
  298326376,
  1316178497,
  3007786442,
  2064951626,
  458293330,
  2589141269,
  3591329599,
  3164325604,
  727753846,
  2179363840,
  146436021,
  1461446943,
  4069977195,
  705550613,
  3059967265,
  3887724982,
  4281599278,
  3313849956,
  1404054877,
  2845806497,
  146425753,
  1854211946,
  1266315497,
  3048417604,
  3681880366,
  3289982499,
  290971e4,
  1235738493,
  2632868024,
  2414719590,
  3970600049,
  1771706367,
  1449415276,
  3266420449,
  422970021,
  1963543593,
  2690192192,
  3826793022,
  1062508698,
  1531092325,
  1804592342,
  2583117782,
  2714934279,
  4024971509,
  1294809318,
  4028980673,
  1289560198,
  2221992742,
  1669523910,
  35572830,
  157838143,
  1052438473,
  1016535060,
  1802137761,
  1753167236,
  1386275462,
  3080475397,
  2857371447,
  1040679964,
  2145300060,
  2390574316,
  1461121720,
  2956646967,
  4031777805,
  4028374788,
  33600511,
  2920084762,
  1018524850,
  629373528,
  3691585981,
  3515945977,
  2091462646,
  2486323059,
  586499841,
  988145025,
  935516892,
  3367335476,
  2599673255,
  2839830854,
  265290510,
  3972581182,
  2759138881,
  3795373465,
  1005194799,
  847297441,
  406762289,
  1314163512,
  1332590856,
  1866599683,
  4127851711,
  750260880,
  613907577,
  1450815602,
  3165620655,
  3734664991,
  3650291728,
  3012275730,
  3704569646,
  1427272223,
  778793252,
  1343938022,
  2676280711,
  2052605720,
  1946737175,
  3164576444,
  3914038668,
  3967478842,
  3682934266,
  1661551462,
  3294938066,
  4011595847,
  840292616,
  3712170807,
  616741398,
  312560963,
  711312465,
  1351876610,
  322626781,
  1910503582,
  271666773,
  2175563734,
  1594956187,
  70604529,
  3617834859,
  1007753275,
  1495573769,
  4069517037,
  2549218298,
  2663038764,
  504708206,
  2263041392,
  3941167025,
  2249088522,
  1514023603,
  1998579484,
  1312622330,
  694541497,
  2582060303,
  2151582166,
  1382467621,
  776784248,
  2618340202,
  3323268794,
  2497899128,
  2784771155,
  503983604,
  4076293799,
  907881277,
  423175695,
  432175456,
  1378068232,
  4145222326,
  3954048622,
  3938656102,
  3820766613,
  2793130115,
  2977904593,
  26017576,
  3274890735,
  3194772133,
  1700274565,
  1756076034,
  4006520079,
  3677328699,
  720338349,
  1533947780,
  354530856,
  688349552,
  3973924725,
  1637815568,
  332179504,
  3949051286,
  53804574,
  2852348879,
  3044236432,
  1282449977,
  3583942155,
  3416972820,
  4006381244,
  1617046695,
  2628476075,
  3002303598,
  1686838959,
  431878346,
  2686675385,
  1700445008,
  1080580658,
  1009431731,
  832498133,
  3223435511,
  2605976345,
  2271191193,
  2516031870,
  1648197032,
  4164389018,
  2548247927,
  300782431,
  375919233,
  238389289,
  3353747414,
  2531188641,
  2019080857,
  1475708069,
  455242339,
  2609103871,
  448939670,
  3451063019,
  1395535956,
  2413381860,
  1841049896,
  1491858159,
  885456874,
  4264095073,
  4001119347,
  1565136089,
  3898914787,
  1108368660,
  540939232,
  1173283510,
  2745871338,
  3681308437,
  4207628240,
  3343053890,
  4016749493,
  1699691293,
  1103962373,
  3625875870,
  2256883143,
  3830138730,
  1031889488,
  3479347698,
  1535977030,
  4236805024,
  3251091107,
  2132092099,
  1774941330,
  1199868427,
  1452454533,
  157007616,
  2904115357,
  342012276,
  595725824,
  1480756522,
  206960106,
  497939518,
  591360097,
  863170706,
  2375253569,
  3596610801,
  1814182875,
  2094937945,
  3421402208,
  1082520231,
  3463918190,
  2785509508,
  435703966,
  3908032597,
  1641649973,
  2842273706,
  3305899714,
  1510255612,
  2148256476,
  2655287854,
  3276092548,
  4258621189,
  236887753,
  3681803219,
  274041037,
  1734335097,
  3815195456,
  3317970021,
  1899903192,
  1026095262,
  4050517792,
  356393447,
  2410691914,
  3873677099,
  3682840055,
  3913112168,
  2491498743,
  4132185628,
  2489919796,
  1091903735,
  1979897079,
  3170134830,
  3567386728,
  3557303409,
  857797738,
  1136121015,
  1342202287,
  507115054,
  2535736646,
  337727348,
  3213592640,
  1301675037,
  2528481711,
  1895095763,
  1721773893,
  3216771564,
  62756741,
  2142006736,
  835421444,
  2531993523,
  1442658625,
  3659876326,
  2882144922,
  676362277,
  1392781812,
  170690266,
  3921047035,
  1759253602,
  3611846912,
  1745797284,
  664899054,
  1329594018,
  3901205900,
  3045908486,
  2062866102,
  2865634940,
  3543621612,
  3464012697,
  1080764994,
  553557557,
  3656615353,
  3996768171,
  991055499,
  499776247,
  1265440854,
  648242737,
  3940784050,
  980351604,
  3713745714,
  1749149687,
  3396870395,
  4211799374,
  3640570775,
  1161844396,
  3125318951,
  1431517754,
  545492359,
  4268468663,
  3499529547,
  1437099964,
  2702547544,
  3433638243,
  2581715763,
  2787789398,
  1060185593,
  1593081372,
  2418618748,
  4260947970,
  69676912,
  2159744348,
  86519011,
  2512459080,
  3838209314,
  1220612927,
  3339683548,
  133810670,
  1090789135,
  1078426020,
  1569222167,
  845107691,
  3583754449,
  4072456591,
  1091646820,
  628848692,
  1613405280,
  3757631651,
  526609435,
  236106946,
  48312990,
  2942717905,
  3402727701,
  1797494240,
  859738849,
  992217954,
  4005476642,
  2243076622,
  3870952857,
  3732016268,
  765654824,
  3490871365,
  2511836413,
  1685915746,
  3888969200,
  1414112111,
  2273134842,
  3281911079,
  4080962846,
  172450625,
  2569994100,
  980381355,
  4109958455,
  2819808352,
  2716589560,
  2568741196,
  3681446669,
  3329971472,
  1835478071,
  660984891,
  3704678404,
  4045999559,
  3422617507,
  3040415634,
  1762651403,
  1719377915,
  3470491036,
  2693910283,
  3642056355,
  3138596744,
  1364962596,
  2073328063,
  1983633131,
  926494387,
  3423689081,
  2150032023,
  4096667949,
  1749200295,
  3328846651,
  309677260,
  2016342300,
  1779581495,
  3079819751,
  111262694,
  1274766160,
  443224088,
  298511866,
  1025883608,
  3806446537,
  1145181785,
  168956806,
  3641502830,
  3584813610,
  1689216846,
  3666258015,
  3200248200,
  1692713982,
  2646376535,
  4042768518,
  1618508792,
  1610833997,
  3523052358,
  4130873264,
  2001055236,
  3610705100,
  2202168115,
  4028541809,
  2961195399,
  1006657119,
  2006996926,
  3186142756,
  1430667929,
  3210227297,
  1314452623,
  4074634658,
  4101304120,
  2273951170,
  1399257539,
  3367210612,
  3027628629,
  1190975929,
  2062231137,
  2333990788,
  2221543033,
  2438960610,
  1181637006,
  548689776,
  2362791313,
  3372408396,
  3104550113,
  3145860560,
  296247880,
  1970579870,
  3078560182,
  3769228297,
  1714227617,
  3291629107,
  3898220290,
  166772364,
  1251581989,
  493813264,
  448347421,
  195405023,
  2709975567,
  677966185,
  3703036547,
  1463355134,
  2715995803,
  1338867538,
  1343315457,
  2802222074,
  2684532164,
  233230375,
  2599980071,
  2000651841,
  3277868038,
  1638401717,
  4028070440,
  3237316320,
  6314154,
  819756386,
  300326615,
  590932579,
  1405279636,
  3267499572,
  3150704214,
  2428286686,
  3959192993,
  3461946742,
  1862657033,
  1266418056,
  963775037,
  2089974820,
  2263052895,
  1917689273,
  448879540,
  3550394620,
  3981727096,
  150775221,
  3627908307,
  1303187396,
  508620638,
  2975983352,
  2726630617,
  1817252668,
  1876281319,
  1457606340,
  908771278,
  3720792119,
  3617206836,
  2455994898,
  1729034894,
  1080033504,
  976866871,
  3556439503,
  2881648439,
  1522871579,
  1555064734,
  1336096578,
  3548522304,
  2579274686,
  3574697629,
  3205460757,
  3593280638,
  3338716283,
  3079412587,
  564236357,
  2993598910,
  1781952180,
  1464380207,
  3163844217,
  3332601554,
  1699332808,
  1393555694,
  1183702653,
  3581086237,
  1288719814,
  691649499,
  2847557200,
  2895455976,
  3193889540,
  2717570544,
  1781354906,
  1676643554,
  2592534050,
  3230253752,
  1126444790,
  2770207658,
  2633158820,
  2210423226,
  2615765581,
  2414155088,
  3127139286,
  673620729,
  2805611233,
  1269405062,
  4015350505,
  3341807571,
  4149409754,
  1057255273,
  2012875353,
  2162469141,
  2276492801,
  2601117357,
  993977747,
  3918593370,
  2654263191,
  753973209,
  36408145,
  2530585658,
  25011837,
  3520020182,
  2088578344,
  530523599,
  2918365339,
  1524020338,
  1518925132,
  3760827505,
  3759777254,
  1202760957,
  3985898139,
  3906192525,
  674977740,
  4174734889,
  2031300136,
  2019492241,
  3983892565,
  4153806404,
  3822280332,
  352677332,
  2297720250,
  60907813,
  90501309,
  3286998549,
  1016092578,
  2535922412,
  2839152426,
  457141659,
  509813237,
  4120667899,
  652014361,
  1966332200,
  2975202805,
  55981186,
  2327461051,
  676427537,
  3255491064,
  2882294119,
  3433927263,
  1307055953,
  942726286,
  933058658,
  2468411793,
  3933900994,
  4215176142,
  1361170020,
  2001714738,
  2830558078,
  3274259782,
  1222529897,
  1679025792,
  2729314320,
  3714953764,
  1770335741,
  151462246,
  3013232138,
  1682292957,
  1483529935,
  471910574,
  1539241949,
  458788160,
  3436315007,
  1807016891,
  3718408830,
  978976581,
  1043663428,
  3165965781,
  1927990952,
  4200891579,
  2372276910,
  3208408903,
  3533431907,
  1412390302,
  2931980059,
  4132332400,
  1947078029,
  3881505623,
  4168226417,
  2941484381,
  1077988104,
  1320477388,
  886195818,
  18198404,
  3786409e3,
  2509781533,
  112762804,
  3463356488,
  1866414978,
  891333506,
  18488651,
  661792760,
  1628790961,
  3885187036,
  3141171499,
  876946877,
  2693282273,
  1372485963,
  791857591,
  2686433993,
  3759982718,
  3167212022,
  3472953795,
  2716379847,
  445679433,
  3561995674,
  3504004811,
  3574258232,
  54117162,
  3331405415,
  2381918588,
  3769707343,
  4154350007,
  1140177722,
  4074052095,
  668550556,
  3214352940,
  367459370,
  261225585,
  2610173221,
  4209349473,
  3468074219,
  3265815641,
  314222801,
  3066103646,
  3808782860,
  282218597,
  3406013506,
  3773591054,
  379116347,
  1285071038,
  846784868,
  2669647154,
  3771962079,
  3550491691,
  2305946142,
  453669953,
  1268987020,
  3317592352,
  3279303384,
  3744833421,
  2610507566,
  3859509063,
  266596637,
  3847019092,
  517658769,
  3462560207,
  3443424879,
  370717030,
  4247526661,
  2224018117,
  4143653529,
  4112773975,
  2788324899,
  2477274417,
  1456262402,
  2901442914,
  1517677493,
  1846949527,
  2295493580,
  3734397586,
  2176403920,
  1280348187,
  1908823572,
  3871786941,
  846861322,
  1172426758,
  3287448474,
  3383383037,
  1655181056,
  3139813346,
  901632758,
  1897031941,
  2986607138,
  3066810236,
  3447102507,
  1393639104,
  373351379,
  950779232,
  625454576,
  3124240540,
  4148612726,
  2007998917,
  544563296,
  2244738638,
  2330496472,
  2058025392,
  1291430526,
  424198748,
  50039436,
  29584100,
  3605783033,
  2429876329,
  2791104160,
  1057563949,
  3255363231,
  3075367218,
  3463963227,
  1469046755,
  985887462
];
var C_ORIG = [
  1332899944,
  1700884034,
  1701343084,
  1684370003,
  1668446532,
  1869963892
];
function _encipher(lr, off, P, S) {
  var n, l = lr[off], r = lr[off + 1];
  l ^= P[0];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[1];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[2];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[3];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[4];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[5];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[6];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[7];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[8];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[9];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[10];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[11];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[12];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[13];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[14];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[15];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[16];
  lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
  lr[off + 1] = l;
  return lr;
}
__name(_encipher, "_encipher");
function _streamtoword(data, offp) {
  for (var i = 0, word = 0; i < 4; ++i)
    word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
  return { key: word, offp };
}
__name(_streamtoword, "_streamtoword");
function _key(key, P, S) {
  var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
  for (i = 0; i < plen; i += 2)
    lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
__name(_key, "_key");
function _ekskey(data, key, P, S) {
  var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
  offp = 0;
  for (i = 0; i < plen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
__name(_ekskey, "_ekskey");
function _crypt(b, salt, rounds, callback, progressCallback) {
  var cdata = C_ORIG.slice(), clen = cdata.length, err;
  if (rounds < 4 || rounds > 31) {
    err = Error("Illegal number of rounds (4-31): " + rounds);
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.length !== BCRYPT_SALT_LEN) {
    err = Error(
      "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
    );
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  rounds = 1 << rounds >>> 0;
  var P, S, i = 0, j;
  if (typeof Int32Array === "function") {
    P = new Int32Array(P_ORIG);
    S = new Int32Array(S_ORIG);
  } else {
    P = P_ORIG.slice();
    S = S_ORIG.slice();
  }
  _ekskey(salt, b, P, S);
  function next() {
    if (progressCallback) progressCallback(i / rounds);
    if (i < rounds) {
      var start = Date.now();
      for (; i < rounds; ) {
        i = i + 1;
        _key(b, P, S);
        _key(salt, P, S);
        if (Date.now() - start > MAX_EXECUTION_TIME) break;
      }
    } else {
      for (i = 0; i < 64; i++)
        for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
      var ret = [];
      for (i = 0; i < clen; i++)
        ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
      if (callback) {
        callback(null, ret);
        return;
      } else return ret;
    }
    if (callback) nextTick(next);
  }
  __name(next, "next");
  if (typeof callback !== "undefined") {
    next();
  } else {
    var res;
    while (true) if (typeof (res = next()) !== "undefined") return res || [];
  }
}
__name(_crypt, "_crypt");
function _hash(password, salt, callback, progressCallback) {
  var err;
  if (typeof password !== "string" || typeof salt !== "string") {
    err = Error("Invalid string / salt: Not a string");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var minor, offset;
  if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
    err = Error("Invalid salt version: " + salt.substring(0, 2));
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.charAt(2) === "$") minor = String.fromCharCode(0), offset = 3;
  else {
    minor = salt.charAt(2);
    if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
      err = Error("Invalid salt revision: " + salt.substring(2, 4));
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else throw err;
    }
    offset = 4;
  }
  if (salt.charAt(offset + 2) > "$") {
    err = Error("Missing salt rounds");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
  password += minor >= "a" ? "\0" : "";
  var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
  function finish(bytes) {
    var res = [];
    res.push("$2");
    if (minor >= "a") res.push(minor);
    res.push("$");
    if (rounds < 10) res.push("0");
    res.push(rounds.toString());
    res.push("$");
    res.push(base64_encode(saltb, saltb.length));
    res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
    return res.join("");
  }
  __name(finish, "finish");
  if (typeof callback == "undefined")
    return finish(_crypt(passwordb, saltb, rounds));
  else {
    _crypt(
      passwordb,
      saltb,
      rounds,
      function(err2, bytes) {
        if (err2) callback(err2, null);
        else callback(null, finish(bytes));
      },
      progressCallback
    );
  }
}
__name(_hash, "_hash");
function encodeBase64(bytes, length) {
  return base64_encode(bytes, length);
}
__name(encodeBase64, "encodeBase64");
function decodeBase64(string, length) {
  return base64_decode(string, length);
}
__name(decodeBase64, "decodeBase64");
var bcryptjs_default = {
  setRandomFallback,
  genSaltSync,
  genSalt,
  hashSync,
  hash,
  compareSync,
  compare,
  getRounds,
  getSalt,
  truncates,
  encodeBase64,
  decodeBase64
};

// src/admin.js
var TYPES2 = { 1: "\u9999\u6E2F", 5: "\u6FB3\u95E8", 8: "\u5929\u5929" };
var SECTIONS = { yixiao: "\u5E73\u7279\u4E00\u8096", erxiao: "\u5E73\u7279\u4E8C\u8096", sanxiao: "\u5E73\u7279\u4E09\u8096", liuxiao: "\u5E73\u7279\u4E00\u8096", tema: "\u4E94\u671F\u5FC5\u4E2D\xB7\u7279\u7801", weishu: "\u5E73\u7279\u5C3E\u6570", sanzhongsan: "\u4E09\u4E2D\u4E09", erzhonger: "\u4E8C\u4E2D\u4E8C", chengyu: "\u6210\u8BED\u89E3\u8096" };
var AD_POSITIONS = { popup: "\u9996\u9875\u5F39\u7A97\u5E7F\u544A", ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`home-${i + 1}`, `\u9996\u9875\u6A2A\u5E45\u5E7F\u544A\u4F4D ${i + 1}`])), list: "\u5217\u8868\u9875\u5E7F\u544A\u4F4D", detail: "\u5185\u5BB9\u9875\u5E7F\u544A\u4F4D" };
var enc = new TextEncoder();
var esc = /* @__PURE__ */ __name((v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "esc");
var now = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " "), "now");
var redirect = /* @__PURE__ */ __name((to, headers = {}) => new Response(null, { status: 303, headers: { location: to, ...headers } }), "redirect");
async function mac(secret, value) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(mac, "mac");
async function session(request, env) {
  const raw = (request.headers.get("cookie") || "").match(/(?:^|;\s*)cf_admin=([^;]+)/)?.[1];
  if (!raw) return null;
  const [id, exp, csrf, sig] = raw.split(".");
  if (!id || Number(exp) < Date.now() / 1e3 || await mac(env.SESSION_SECRET, `${id}.${exp}.${csrf}`) !== sig) return null;
  return { id: Number(id), csrf };
}
__name(session, "session");
async function cookie(env, id) {
  const exp = Math.floor(Date.now() / 1e3) + 1800, csrf = crypto.randomUUID().replaceAll("-", "");
  const base = `${id}.${exp}.${csrf}`, sig = await mac(env.SESSION_SECRET, base);
  return { value: `cf_admin=${base}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800`, csrf };
}
__name(cookie, "cookie");
function shell(title, body) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#0d0d0d;color:#eee;font:14px system-ui}.top{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:14px 4%;background:#171717;border-bottom:1px solid #39301b}.top a{color:#edcc64;margin-left:12px}.wrap{max-width:1180px;margin:auto;padding:18px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.card{background:#171717;border:1px solid #353128;border-radius:9px;padding:16px}.wide{grid-column:1/-1}h1,h2{margin-top:0;color:#f0ce68}label{display:grid;gap:5px;margin:9px 0}input,select,textarea,button{font:inherit;border-radius:6px;border:1px solid #4a4333;background:#101010;color:#eee;padding:9px}textarea{min-height:82px}button{cursor:pointer;background:#6d5418;color:#fff1b5;font-weight:700}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:9px;border-bottom:1px solid #2c2c2c;text-align:left}.scroll{overflow:auto}.actions{display:flex;gap:6px}.actions button{padding:6px}.danger{background:#681f1f}.ok{color:#69dc88}.bad{color:#ff7676}.muted{color:#999}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.stats b{font-size:23px;color:#f0ce68}.login{max-width:390px;margin:12vh auto}.notice{padding:10px;background:#21381f;border-radius:6px}@media(max-width:760px){.grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}.top{align-items:flex-start}.top nav{display:grid;gap:4px}}</style></head><body>${body}</body></html>`;
}
__name(shell, "shell");
function csrfInput(s) {
  return `<input type="hidden" name="csrf" value="${esc(s.csrf)}">`;
}
__name(csrfInput, "csrfInput");
function nav() {
  return `<nav><a href="/admin/">\u8D44\u6599</a><a href="/admin/ads">\u5E7F\u544A</a><a href="/admin/links">\u7F51\u7AD9\u63A8\u8350</a><a href="/admin/analytics">\u7EDF\u8BA1</a><a href="/admin/export">\u5BFC\u51FA</a><a href="/admin/logout">\u9000\u51FA</a></nav>`;
}
__name(nav, "nav");
async function ensureSiteLinks(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS site_links(slot INTEGER PRIMARY KEY,label TEXT NOT NULL DEFAULT '',url TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  const defaults = [[1, "123\u516D\u5408\u7F51", "https://123lh.668870.cc/"], [2, "\u516D\u5408\u738B", "https://lhw.235-from.com/"], [3, "\u8DD1\u72D7\u8BBA\u575B", "https://paogt06.h6sdeg6.com/"], [4, "\u66F4\u591A\u7F51\u7AD9", ""]];
  await db.batch(defaults.map(([slot, label, url]) => db.prepare("INSERT OR IGNORE INTO site_links(slot,label,url,enabled) VALUES(?,?,?,1)").bind(slot, label, url)));
}
__name(ensureSiteLinks, "ensureSiteLinks");
async function handleAdmin(request, env) {
  const url = new URL(request.url), s = await session(request, env);
  if (url.pathname === "/admin/login") return login(request, env, s);
  if (url.pathname === "/admin/logout") return redirect("/admin/login", { "set-cookie": "cf_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict" });
  if (!s) return redirect("/admin/login");
  if (request.method === "POST") {
    const form = await request.formData();
    if (form.get("csrf") !== s.csrf) return new Response("\u9875\u9762\u5DF2\u8FC7\u671F", { status: 419 });
    return action(url.pathname, form, env);
  }
  if (url.pathname === "/admin" || url.pathname === "/admin/") return dashboard(url, env, s);
  if (url.pathname === "/admin/ads") return ads2(env, s);
  if (url.pathname === "/admin/links") return links(env, s);
  if (url.pathname === "/admin/analytics") return analytics(env, s);
  if (url.pathname === "/admin/export") return exportCsv(env.DB);
  return new Response("Not found", { status: 404 });
}
__name(handleAdmin, "handleAdmin");
async function login(request, env, s) {
  if (s) return redirect("/admin/");
  let error = "";
  if (request.method === "POST") {
    const f = await request.formData(), u = String(f.get("username") || ""), p = String(f.get("password") || ""), row = await env.DB.prepare("SELECT id,password_hash FROM admins WHERE username=? LIMIT 1").bind(u).first(), hash2 = String(row?.password_hash || "").replace(/^\$2y\$/, "$2b$");
    if (row && await bcryptjs_default.compare(p, hash2)) {
      const c = await cookie(env, row.id);
      return redirect("/admin/", { "set-cookie": c.value });
    }
    error = "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF";
  }
  return new Response(shell("\u540E\u53F0\u767B\u5F55", `<main class="login card"><h1>Cloudflare \u8D44\u6599\u540E\u53F0</h1>${error ? `<p class="bad">${error}</p>` : ""}<form method="post"><label>\u8D26\u53F7<input name="username" required></label><label>\u5BC6\u7801<input name="password" type="password" required></label><button>\u767B\u5F55</button></form></main>`), { headers: { "content-type": "text/html;charset=utf-8" } });
}
__name(login, "login");
async function dashboard(url, env, s) {
  const page = Math.max(1, Number(url.searchParams.get("page") || 1)), offset = (page - 1) * 30, { results = [] } = await env.DB.prepare("SELECT * FROM materials ORDER BY id DESC LIMIT 30 OFFSET ?").bind(offset).all(), runs = (await env.DB.prepare("SELECT * FROM automation_runs ORDER BY id DESC LIMIT 5").all()).results || [];
  const rows = results.map((r) => `<tr><td>${TYPES2[r.lottery_type] || r.lottery_type}</td><td>${SECTIONS[r.section_key] || r.section_key}</td><td>${esc(r.source_name)}</td><td>${esc(r.period)}</td><td>${esc(r.content)}</td><td class="${r.hit_status === "hit" ? "ok" : r.hit_status === "miss" ? "bad" : ""}">${esc(r.hit_status)}</td><td><div class="actions"><form method="post" action="/admin/toggle">${csrfInput(s)}<input type="hidden" name="id" value="${r.id}"><input type="hidden" name="published" value="${r.published ? 0 : 1}"><button>${r.published ? "\u9690\u85CF" : "\u663E\u793A"}</button></form><form method="post" action="/admin/delete" onsubmit="return confirm('\u786E\u5B9A\u5220\u9664\uFF1F')">${csrfInput(s)}<input type="hidden" name="id" value="${r.id}"><button class="danger">\u5220\u9664</button></form></div></td></tr>`).join("");
  const runRows = runs.map((r) => `<tr><td>${esc(r.task_key)}</td><td>${esc(r.started_at)}</td><td class="${r.status === "success" ? "ok" : "bad"}">${esc(r.status)}</td><td>${esc(r.error_message || "")}</td></tr>`).join("");
  return html(shell("\u8D44\u6599\u540E\u53F0", `<header class="top"><strong>Cloudflare \u8D44\u6599\u540E\u53F0</strong>${nav()}</header><main class="wrap"><div class="grid"><section class="card"><h2>\u53D1\u5E03\u65B0\u8D44\u6599</h2><form method="post" action="/admin/save">${csrfInput(s)}<label>\u5F69\u79CD<select name="lottery_type">${Object.entries(TYPES2).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label><label>\u680F\u76EE<select name="section_key">${Object.entries(SECTIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label><label>\u540D\u79F0<input name="source_name" required></label><label>\u671F\u53F7<input name="period" inputmode="numeric" required></label><label>\u5185\u5BB9<textarea name="content" required></textarea></label><label>\u7ED3\u679C<select name="hit_status"><option value="pending">\u5F85\u5F00\u5956</option><option value="hit">\u547D\u4E2D</option><option value="miss">\u672A\u4E2D</option></select></label><button>\u4FDD\u5B58\u5E76\u53D1\u5E03</button></form></section><section class="card"><h2>\u81EA\u52A8\u4EFB\u52A1</h2><p>Cloudflare \u6BCF\u5C0F\u65F6\u7B2C 10 \u5206\u949F\u81EA\u52A8\u6267\u884C\u3002</p><form method="post" action="/admin/run-auto">${csrfInput(s)}<button>\u7ACB\u5373\u66F4\u65B0\u5168\u90E8\u8D44\u6599</button></form><div class="scroll"><table>${runRows}</table></div></section><section class="card wide"><h2>\u8D44\u6599\u5217\u8868</h2><div class="scroll"><table><thead><tr><th>\u5F69\u79CD</th><th>\u680F\u76EE</th><th>\u540D\u79F0</th><th>\u671F\u53F7</th><th>\u5185\u5BB9</th><th>\u7ED3\u679C</th><th>\u64CD\u4F5C</th></tr></thead><tbody>${rows}</tbody></table></div><p><a href="/admin/?page=${Math.max(1, page - 1)}">\u4E0A\u4E00\u9875</a>\u3000\u7B2C ${page} \u9875\u3000<a href="/admin/?page=${page + 1}">\u4E0B\u4E00\u9875</a></p></section></div></main>`));
}
__name(dashboard, "dashboard");
async function action(path, f, env) {
  const db = env.DB;
  if (path === "/admin/save") {
    const type = Number(f.get("lottery_type")), section = String(f.get("section_key")), name = String(f.get("source_name") || "").trim(), period = String(f.get("period") || "").trim(), content = String(f.get("content") || "").trim(), status = String(f.get("hit_status") || "pending");
    if (!TYPES2[type] || !SECTIONS[section] || !name || !/^\d{1,10}$/.test(period) || !content) return new Response("\u8D44\u6599\u586B\u5199\u4E0D\u5B8C\u6574", { status: 422 });
    await db.prepare("INSERT INTO materials(lottery_type,section_key,source_name,period,content,hit_status,published,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?) ON CONFLICT(lottery_type,section_key,source_name,period) DO UPDATE SET content=excluded.content,hit_status=excluded.hit_status,published=1,updated_at=excluded.updated_at").bind(type, section, name, period, content, status, now(), now()).run();
  } else if (path === "/admin/toggle") await db.prepare("UPDATE materials SET published=? WHERE id=?").bind(Number(f.get("published")), Number(f.get("id"))).run();
  else if (path === "/admin/delete") await db.prepare("DELETE FROM materials WHERE id=?").bind(Number(f.get("id"))).run();
  else if (path === "/admin/run-auto") {
    await runAutomation(db);
  } else if (path === "/admin/save-link") {
    await ensureSiteLinks(db);
    const slot = Number(f.get("slot") || 0), label = String(f.get("label") || "").trim().slice(0, 30), url = String(f.get("url") || "").trim().slice(0, 500), enabled = Number(f.get("enabled") || 0);
    if (!label) return new Response("\u7F51\u7AD9\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A", { status: 422 });
    if (url && !/^https:\/\//i.test(url)) return new Response("\u8DF3\u8F6C\u94FE\u63A5\u5FC5\u987B\u4EE5 https:// \u5F00\u5934", { status: 422 });
    if (slot > 0) await db.prepare("UPDATE site_links SET label=?,url=?,enabled=?,updated_at=? WHERE slot=?").bind(label, url, enabled, now(), slot).run();
    else await db.prepare("INSERT INTO site_links(slot,label,url,enabled,updated_at) SELECT COALESCE(MAX(slot),0)+1,?,?,?,? FROM site_links").bind(label, url, enabled, now()).run();
    return redirect("/admin/links?saved=1");
  } else if (path === "/admin/delete-link") {
    await ensureSiteLinks(db);
    const slot = Number(f.get("slot") || 0);
    if (slot > 0) await db.prepare("DELETE FROM site_links WHERE slot=?").bind(slot).run();
    return redirect("/admin/links?deleted=1");
  } else if (path === "/admin/save-ad") {
    let imagePath = String(f.get("image_path") || ""), file = f.get("image_file"), position = String(f.get("position_key"));
    if (file instanceof File && file.size) {
      if (file.size > 5 * 1024 * 1024) return new Response("\u56FE\u7247\u4E0D\u80FD\u8D85\u8FC7 5MB", { status: 422 });
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return new Response("\u53EA\u5141\u8BB8 JPG\u3001PNG\u3001WebP\u3001GIF", { status: 422 });
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[file.type], key = `cf-assets/ads/${position}-${crypto.randomUUID()}.${ext}`;
      await env.ASSETS_KV.put(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });
      imagePath = `/${key}`;
    }
    await db.prepare("UPDATE ads SET image_path=?,link_url=?,enabled=?,display_mode=?,delay_seconds=?,start_at=?,end_at=?,updated_at=? WHERE position_key=?").bind(imagePath, String(f.get("link_url") || ""), Number(f.get("enabled") || 0), String(f.get("display_mode") || "daily"), Number(f.get("delay_seconds") || 1), String(f.get("start_at") || "") || null, String(f.get("end_at") || "") || null, now(), position).run();
    return redirect("/admin/ads");
  }
  return redirect("/admin/");
}
__name(action, "action");
async function ads2(env, s) {
  await env.DB.batch(Object.keys(AD_POSITIONS).map((key) => env.DB.prepare("INSERT OR IGNORE INTO ads(position_key) VALUES(?)").bind(key)));
  const rows = (await env.DB.prepare("SELECT a.*,COALESCE(s.impressions,0) impressions,COALESCE(s.total_clicks,0) clicks FROM ads a LEFT JOIN ad_stats s USING(position_key) ORDER BY CASE WHEN a.position_key='popup' THEN 0 WHEN a.position_key LIKE 'home-%' THEN CAST(substr(a.position_key,6) AS INTEGER) ELSE 20 END,a.position_key").all()).results || [];
  return html(shell("\u5E7F\u544A\u7BA1\u7406", `<header class="top"><strong>\u5E7F\u544A\u7BA1\u7406</strong>${nav()}</header><main class="wrap"><p class="notice">\u9996\u9875\u5171\u6709 9 \u4E2A\u6A2A\u5E45\u5E7F\u544A\u4F4D\uFF0C\u53E6\u5916\u5305\u542B\u5F39\u7A97\u3001\u5217\u8868\u9875\u548C\u5185\u5BB9\u9875\u5E7F\u544A\u4F4D\u3002</p><div class="grid">${rows.map((r) => `<section class="card"><h2>${esc(AD_POSITIONS[r.position_key] || r.position_key)}</h2><p class="muted">\u4F4D\u7F6E\u7F16\u53F7\uFF1A${esc(r.position_key)}\u3000\u5C55\u793A ${r.impressions}\u3000\u70B9\u51FB ${r.clicks}</p><form method="post" action="/admin/save-ad" enctype="multipart/form-data">${csrfInput(s)}<input type="hidden" name="position_key" value="${esc(r.position_key)}"><input type="hidden" name="image_path" value="${esc(r.image_path)}">${r.image_path ? `<img src="${esc(r.image_path)}" alt="" style="max-width:100%;max-height:120px">` : ""}<label>\u4E0A\u4F20\u65B0\u56FE\u7247\uFF08\u6700\u5927 5MB\uFF09<input type="file" name="image_file" accept="image/jpeg,image/png,image/webp,image/gif"></label><label>\u8DF3\u8F6C\u94FE\u63A5<input name="link_url" value="${esc(r.link_url)}"></label><label>\u663E\u793A\u65B9\u5F0F<select name="display_mode"><option value="daily" ${r.display_mode === "daily" ? "selected" : ""}>\u6BCF\u5929\u4E00\u6B21</option><option value="always" ${r.display_mode === "always" ? "selected" : ""}>\u6BCF\u6B21\u663E\u793A</option></select></label><label>\u5EF6\u8FDF\u79D2\u6570<input name="delay_seconds" type="number" value="${r.delay_seconds}"></label><label><input name="enabled" type="checkbox" value="1" ${r.enabled ? "checked" : ""}> \u542F\u7528</label><button>\u4FDD\u5B58</button></form></section>`).join("")}</div></main>`));
}
__name(ads2, "ads");
async function links(env, s) {
  await ensureSiteLinks(env.DB);
  const rows = (await env.DB.prepare("SELECT * FROM site_links ORDER BY slot").all()).results || [];
  return html(shell("\u7F51\u7AD9\u63A8\u8350\u7BA1\u7406", `<header class="top"><strong>\u7F51\u7AD9\u63A8\u8350\u7BA1\u7406</strong>${nav()}</header><main class="wrap"><p class="notice">\u63A8\u8350\u7F51\u7AD9\u6570\u91CF\u4E0D\u9650\uFF0C\u53EF\u968F\u65F6\u65B0\u589E\u3002\u8FD9\u91CC\u53EA\u7EF4\u62A4\u4E00\u5957\u94FE\u63A5\uFF1B\u524D\u53F0\u6807\u9898\u4F1A\u968F\u5F69\u79CD\u81EA\u52A8\u53D8\u5316\u3002</p><section class="card"><h2>\u65B0\u589E\u63A8\u8350\u7F51\u7AD9</h2><form method="post" action="/admin/save-link">${csrfInput(s)}<label>\u7F51\u7AD9\u540D\u79F0<input name="label" required placeholder="\u7F51\u7AD9\u540D\u79F0"></label><label>\u8DF3\u8F6C\u94FE\u63A5<input name="url" placeholder="https://"></label><label><input type="checkbox" name="enabled" value="1" checked> \u6DFB\u52A0\u540E\u7ACB\u5373\u663E\u793A</label><button>\u65B0\u589E\u7F51\u7AD9</button></form></section><div class="grid" style="margin-top:14px">${rows.map((r) => `<section class="card"><h2>${esc(r.label)}</h2><form method="post" action="/admin/save-link">${csrfInput(s)}<input type="hidden" name="slot" value="${r.slot}"><label>\u7F51\u7AD9\u540D\u79F0<input name="label" value="${esc(r.label)}" required></label><label>\u8DF3\u8F6C\u94FE\u63A5<input name="url" value="${esc(r.url)}" placeholder="https://"></label><label><input type="checkbox" name="enabled" value="1" ${r.enabled ? "checked" : ""}> \u524D\u53F0\u663E\u793A</label><button>\u4FDD\u5B58\u4FEE\u6539</button></form><form method="post" action="/admin/delete-link" onsubmit="return confirm('\u786E\u5B9A\u5220\u9664\u8FD9\u4E2A\u63A8\u8350\u7F51\u7AD9\u5417\uFF1F')" style="margin-top:8px">${csrfInput(s)}<input type="hidden" name="slot" value="${r.slot}"><button class="danger">\u5220\u9664</button></form></section>`).join("")}</div></main>`));
}
__name(links, "links");
async function analytics(env, s) {
  const total = await env.DB.prepare("SELECT COALESCE(SUM(views),0) n FROM analytics_daily").first(), uv = await env.DB.prepare("SELECT COUNT(*) n FROM analytics_visitors").first(), today = await env.DB.prepare("SELECT COALESCE(SUM(views),0) n FROM analytics_daily WHERE visit_date=date('now')").first(), visitors = (await env.DB.prepare("SELECT * FROM analytics_visitors ORDER BY last_seen DESC LIMIT 100").all()).results || [];
  return html(shell("\u8BBF\u95EE\u7EDF\u8BA1", `<header class="top"><strong>\u8BBF\u95EE\u7EDF\u8BA1</strong>${nav()}</header><main class="wrap"><section class="stats"><article class="card">\u7D2F\u8BA1\u8BBF\u95EE<br><b>${total.n}</b></article><article class="card">\u72EC\u7ACB IP<br><b>${uv.n}</b></article><article class="card">\u4ECA\u65E5\u8BBF\u95EE<br><b>${today.n}</b></article></section><section class="card"><h2>\u6700\u8FD1\u8BBF\u5BA2</h2><div class="scroll"><table><tr><th>IP</th><th>\u56FD\u5BB6</th><th>\u5730\u533A</th><th>\u57CE\u5E02</th><th>\u6B21\u6570</th><th>\u6700\u540E\u8BBF\u95EE</th></tr>${visitors.map((v) => `<tr><td>${esc(v.ip_address)}</td><td>${esc(v.country)}</td><td>${esc(v.region_name)}</td><td>${esc(v.city)}</td><td>${v.views}</td><td>${esc(v.last_seen)}</td></tr>`).join("")}</table></div></section></main>`));
}
__name(analytics, "analytics");
async function exportCsv(db) {
  const rows = (await db.prepare("SELECT ip_address,country,region_name,city,views,first_seen,last_seen FROM analytics_visitors ORDER BY last_seen DESC").all()).results || [], q = /* @__PURE__ */ __name((v) => `"${String(v ?? "").replaceAll('"', '""')}"`, "q"), csv = "\uFEFFIP,\u56FD\u5BB6,\u7701\u4EFD/\u5DDE,\u57CE\u5E02,\u8BBF\u95EE\u6B21\u6570,\u9996\u6B21\u8BBF\u95EE\u65F6\u95F4,\u6700\u540E\u8BBF\u95EE\u65F6\u95F4\n" + rows.map((r) => [r.ip_address, r.country, r.region_name, r.city, r.views, r.first_seen, r.last_seen].map(q).join(",")).join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv;charset=utf-8", "content-disposition": "attachment; filename=visitor-statistics.csv" } });
}
__name(exportCsv, "exportCsv");
var html = /* @__PURE__ */ __name((body) => new Response(body, { headers: { "content-type": "text/html;charset=utf-8", "cache-control": "no-store", "x-frame-options": "SAMEORIGIN", "content-security-policy": "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" } }), "html");

// shared/crypto.ts
var KEY_PARTS = [
  "3dda8abdbf1884ac",
  "591469669405c9ac",
  "a3d1823be596b093",
  "91d40066f5666b5c"
];
var KEY_ORDER = [1, 3, 0, 2];
var encoder = new TextEncoder();
var decoder = new TextDecoder();
function keyBytes() {
  const hex = KEY_ORDER.map((index) => KEY_PARTS[index]).join("");
  if (hex.length !== 64) throw new Error("AES key must be exactly 32 bytes");
  const bytes = new Uint8Array(hex.match(/.{2}/g).map((value) => Number.parseInt(value, 16)));
  if (bytes.byteLength !== 32) throw new Error("AES key must be exactly 32 bytes");
  return bytes;
}
__name(keyBytes, "keyBytes");
function toBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}
__name(toBase64, "toBase64");
function inputBytes(value) {
  return typeof value === "string" ? encoder.encode(value) : value;
}
__name(inputBytes, "inputBytes");
function exactBuffer(bytes) {
  return bytes.slice().buffer;
}
__name(exactBuffer, "exactBuffer");
async function importAesKey() {
  const bytes = keyBytes();
  if (bytes.byteLength !== 32) throw new Error("AES key must be exactly 32 bytes");
  return crypto.subtle.importKey("raw", exactBuffer(bytes), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
__name(importAesKey, "importAesKey");
async function encrypt(value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: exactBuffer(iv), tagLength: 128 },
    await importAesKey(),
    exactBuffer(inputBytes(value))
  ));
  if (encrypted.byteLength < 16) throw new Error("AES-GCM output is missing its authentication tag");
  return {
    ciphertext: toBase64(encrypted.subarray(0, -16)),
    iv: toBase64(iv),
    tag: toBase64(encrypted.subarray(-16))
  };
}
__name(encrypt, "encrypt");
function encryptJsonPayload(value) {
  return encrypt(JSON.stringify(value));
}
__name(encryptJsonPayload, "encryptJsonPayload");

// src/index.js
var encryptedJson = /* @__PURE__ */ __name(async (data) => Response.json(await encryptJsonPayload(data), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" } }), "encryptedJson");
var wantsEncryption = /* @__PURE__ */ __name((url) => url.searchParams.get("encrypted") === "1", "wantsEncryption");
var pageShell = /* @__PURE__ */ __name(() => new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title></title><style>html,body{height:100%;margin:0;background:#0d0d0d}#secure-loader{height:100%;display:grid;place-items:center}.spinner{width:34px;height:34px;border:3px solid #342f23;border-top-color:#e7c75f;border-radius:50%;animation:s .8s linear infinite}#secure-loader p{color:#ddd;font:15px system-ui;text-align:center}@keyframes s{to{transform:rotate(360deg)}}</style></head><body><div id="secure-loader" aria-busy="true"><span class="spinner" aria-hidden="true"></span></div><script type="module" src="/assets/secure/client/page-loader.js"><\/script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } }), "pageShell");
async function pagePayload(url, env) {
  let path = String(url.searchParams.get("path") || "/");
  if (path === "/") path = "/index.html";
  if (!/^\/[A-Za-z0-9._/-]+\.html$/.test(path) || path.includes("..") || path.startsWith("/admin")) return Response.json({ message: "\u6570\u636E\u52A0\u8F7D\u5931\u8D25" }, { status: 404 });
  const assetUrl = new URL(path, url.origin);
  const response = await env.STATIC_ASSETS.fetch(new Request(assetUrl, { headers: { accept: "text/html" } }));
  if (!response.ok) return Response.json({ message: "\u6570\u636E\u52A0\u8F7D\u5931\u8D25" }, { status: response.status });
  let html2 = await response.text();
  const title = html2.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
  html2 = html2.replace(/<title[^>]*>[\s\S]*?<\/title>/i, "<title></title>");
  html2 = html2.replaceAll("https://6htv70.com/gallerynew/h5/index/lastLotteryRecord?lotteryType=", "/api/lottery.php?lotteryType=");
  html2 = html2.replaceAll("https://6htv70.com/gallerynew/h5/lottery/search?", "/api/history.php?");
  const payload = { html: html2, title };
  return wantsEncryption(url) ? encryptedJson(payload) : Response.json(payload, { headers: { "cache-control": "no-store" } });
}
__name(pagePayload, "pagePayload");
async function maybeEncrypt(response, url) {
  if (!response || !response.ok || !wantsEncryption(url) || !String(response.headers.get("content-type") || "").includes("application/json")) return response;
  try {
    return encryptedJson(await response.json());
  } catch (error) {
    console.error("public_response_encryption_failed", error);
    return Response.json({ message: "\u6570\u636E\u52A0\u8F7D\u5931\u8D25" }, { status: 500 });
  }
}
__name(maybeEncrypt, "maybeEncrypt");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/cf-assets/")) {
      const object = await env.ASSETS_KV.getWithMetadata(url.pathname.slice(1), "arrayBuffer");
      if (!object.value) return new Response("Not found", { status: 404 });
      return new Response(object.value, { headers: { "content-type": object.metadata?.contentType || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" } });
    }
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return handleAdmin(request, env);
    if (url.pathname === "/api/page.php") return pagePayload(url, env);
    if (url.pathname === "/wuqi-data.php") return maybeEncrypt(await handleWuqi(url), url);
    if (url.pathname.startsWith("/api/")) {
      try {
        const response = await handleApi(request, env, ctx);
        if (response) return maybeEncrypt(response, url);
      } catch (error) {
        console.error("public_api_failed", url.pathname, error);
        return Response.json({ message: "\u6570\u636E\u52A0\u8F7D\u5931\u8D25" }, { status: 500, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
      }
    }
    if (request.method === "GET" && (url.pathname === "/" || url.pathname.endsWith(".html"))) return pageShell();
    return env.STATIC_ASSETS.fetch(request);
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runAutomation(env.DB));
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
