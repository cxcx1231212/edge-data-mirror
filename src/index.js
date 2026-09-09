import { serveMemberSnapshot, refreshMemberSnapshots } from './member-static.js';
import { handleApi, handleWuqi } from "./public-api.js";
import { runAutomation } from "./automation.js";
import { handleAdmin } from "./admin.js";
import { encryptJsonPayload } from "../shared/crypto.ts";

const encryptedJson = async data => Response.json(await encryptJsonPayload(data), {headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"}});
const wantsEncryption = url => url.searchParams.get("encrypted") === "1";
const pageShell = () => new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title></title><style>html,body{height:100%;margin:0;background:#0d0d0d}#secure-loader{height:100%;display:grid;place-items:center}.spinner{width:34px;height:34px;border:3px solid #342f23;border-top-color:#e7c75f;border-radius:50%;animation:s .8s linear infinite}#secure-loader p{color:#ddd;font:15px system-ui;text-align:center}@keyframes s{to{transform:rotate(360deg)}}</style></head><body><div id="secure-loader" aria-busy="true"><span class="spinner" aria-hidden="true"></span></div><script type="module" src="/assets/secure/client/page-loader.js"></script></body></html>`, {headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});

async function pagePayload(url, env) {
  let path = String(url.searchParams.get("path") || "/");
  if (path === "/") path = "/index.html";
  if (!/^\/[A-Za-z0-9._/-]+\.html$/.test(path) || path.includes("..") || path.startsWith("/admin")) return Response.json({message:"数据加载失败"},{status:404});
  const assetUrl = new URL(path, url.origin);
  const response = await env.STATIC_ASSETS.fetch(new Request(assetUrl, {headers:{accept:"text/html"}}));
  if (!response.ok) return Response.json({message:"数据加载失败"},{status:response.status});
  let html = await response.text();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, "<title></title>");
  html = html.replaceAll("https://6htv70.com/gallerynew/h5/index/lastLotteryRecord?lotteryType=", "/api/lottery.php?lotteryType=");
  html = html.replaceAll("https://6htv70.com/gallerynew/h5/lottery/search?", "/api/history.php?");
  const payload = {html,title};
  return wantsEncryption(url) ? encryptedJson(payload) : Response.json(payload,{headers:{"cache-control":"no-store"}});
}

async function maybeEncrypt(response, url) {
  if (!response || !response.ok || !wantsEncryption(url) || !String(response.headers.get("content-type")||"").includes("application/json")) return response;
  try { return encryptedJson(await response.json()); }
  catch (error) { console.error("public_response_encryption_failed", error); return Response.json({message:"数据加载失败"},{status:500}); }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/cf-assets/")) {
      const object = await env.ASSETS_KV.getWithMetadata(url.pathname.slice(1), "arrayBuffer");
      if (!object.value) return new Response("Not found", {status: 404});
      return new Response(object.value, {headers:{"content-type":object.metadata?.contentType||"application/octet-stream","cache-control":"public, max-age=31536000, immutable"}});
    }
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return handleAdmin(request, env);
    if (request.method === "GET" && url.pathname === "/yixiao-member-preview.html") return serveMemberSnapshot(request, env, ctx);
    if (url.pathname === "/api/page.php") return pagePayload(url, env);
    if (url.pathname === "/wuqi-data.php") return maybeEncrypt(await handleWuqi(url), url);
    if (url.pathname.startsWith("/api/")) {
      try {
        const response = await handleApi(request, env, ctx);
        if (response) return maybeEncrypt(response, url);
      } catch (error) {
        console.error("public_api_failed", url.pathname, error);
        return Response.json({message:"数据加载失败"},{status:500,headers:{"cache-control":"no-store","access-control-allow-origin":"*"}});
      }
    }
    if (request.method === "GET" && (url.pathname === "/" || url.pathname.endsWith(".html"))) return pageShell();
    return env.STATIC_ASSETS.fetch(request);
  },
  async scheduled(_controller, env, ctx) { ctx.waitUntil(Promise.all([runAutomation(env.DB),refreshMemberSnapshots(env)])); }
};
