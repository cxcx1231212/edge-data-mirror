import { consumeEntryTicket } from './entry-tickets.js';
import { navigationHtml } from './navigation.js';

export const SESSION_COOKIE = '__Host-business_access';
export const SESSION_SECONDS = 86400;
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const bytes = value => Uint8Array.from(value.match(/../g)||[], x=>parseInt(x,16));
const importKey = value => crypto.subtle.importKey('raw',encoder.encode(value),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const secretOf = env => typeof env.BUSINESS_ACCESS_TOKEN==='string' && env.BUSINESS_ACCESS_TOKEN.trim().length>=32 && env.BUSINESS_ACCESS_TOKEN.length<=1024 ? env.BUSINESS_ACCESS_TOKEN : null;

async function validToken(value, secret) {
  if (!secret || !value || value.length>1024) return false;
  // Native HMAC verification avoids a data-dependent string comparison.
  const key=await importKey('business-entry-comparison-v1');
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(secret));
  return crypto.subtle.verify('HMAC',key,signature,encoder.encode(value));
}
async function sessionKey(secret) { return importKey('business-session-v1\0'+secret); }
export async function issueSession(secret, origin, now=Date.now()) {
  const expires=Math.floor(now/1000)+SESSION_SECONDS;
  const payload='v1.'+expires+'.'+hex(crypto.getRandomValues(new Uint8Array(16)));
  const signature=await crypto.subtle.sign('HMAC',await sessionKey(secret),encoder.encode(origin+'\0'+payload));
  return payload+'.'+hex(signature);
}
export async function hasSession(request, env, now=Date.now()) {
  const secret=secretOf(env);if(!secret)return false;
  const entries=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(SESSION_COOKIE+'='));
  if(entries.length!==1)return false;
  const value=entries[0].slice(SESSION_COOKIE.length+1);
  const match=/^(v1\.(\d{10})\.[a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value);
  if(!match)return false;
  const expires=Number(match[2]),seconds=Math.floor(now/1000);
  if(expires<=seconds||expires>seconds+SESSION_SECONDS)return false;
  return crypto.subtle.verify('HMAC',await sessionKey(secret),bytes(match[3]),encoder.encode(new URL(request.url).origin+'\0'+match[1]));
}
const response = (body,status=200,type='text/html; charset=utf-8') => new Response(body,{status,headers:{'content-type':type,'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-site-gate':'v1'}});
export function forbidden(url) {
  if(url.pathname.startsWith('/api/')||url.pathname==='/wuqi-data.php')return response(JSON.stringify({success:false,message:'Forbidden'}),403,'application/json; charset=utf-8');
  return response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>403</title><body><h1>403 Forbidden</h1><p>访问凭证无效或已过期。</p><a href="/">返回网址导航</a></body></html>',403);
}
export function isPublicAsset(path) {
  // Only non-HTML presentation assets are public. JSON, aliases and unknown routes require a session.
  return !path.startsWith('/api/') && !path.includes('%') && /\.(?:css|js|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|mp4|webm)$/i.test(path);
}
export function requestSession(request) {
  const entries=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(SESSION_COOKIE+'='));
  return entries.length===1?entries[0].slice(SESSION_COOKIE.length+1):'';
}
export async function accessGate(request,env) {
  const url=new URL(request.url);
  if(url.pathname==='/admin'||url.pathname.startsWith('/admin/'))return {admin:true};
  if(['/index.html','/index','/index/'].includes(url.pathname)) {
    if(url.pathname!=='/index.html'||request.method!=='GET'||url.searchParams.getAll('t').length!==1||!await hasSession(request,env))return {response:forbidden(url)};
    if(!await consumeEntryTicket(env,url.searchParams.get('t'),requestSession(request),url.origin))return {response:forbidden(url)};
    return {};
  }
  if(url.searchParams.has('t')) {
    if(url.pathname!=='/'||!['GET','HEAD'].includes(request.method)||url.searchParams.getAll('t').length!==1||!await validToken(url.searchParams.get('t'),secretOf(env)))return {response:forbidden(url)};
    const session=await hasSession(request,env)?requestSession(request):await issueSession(secretOf(env),url.origin);
    return {cookie:SESSION_COOKIE+'='+session+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+SESSION_SECONDS};
  }
  if(url.pathname==='/') {
    if(!['GET','HEAD'].includes(request.method))return {response:response('Method Not Allowed',405,'text/plain; charset=utf-8')};
    return {response:response(request.method==='HEAD'?null:navigationHtml)};
  }
  if(isPublicAsset(url.pathname))return {asset:true};
  if(!await hasSession(request,env))return {response:forbidden(url)};
  if(!['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin=request.headers.get('origin');
    if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return {response:forbidden(url)};
  }
  return {};
}
export function protectResponse(result,request,cookie) {
  const headers=new Headers(result.headers);
  headers.set('cache-control','private, no-store');headers.set('referrer-policy','no-referrer');headers.set('x-site-gate','v1');
  headers.delete('access-control-allow-origin');headers.delete('access-control-allow-credentials');
  if(cookie)headers.append('set-cookie',cookie);
  return new Response(request.method==='HEAD'?null:result.body,{status:result.status,statusText:result.statusText,headers});
}
