const hex = value => [...new Uint8Array(value)].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest = async value => hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const schema = 'CREATE TABLE IF NOT EXISTS business_entry_tickets (token_hash TEXT PRIMARY KEY, session_hash TEXT NOT NULL, expires_at INTEGER NOT NULL)';
export async function issueEntryTicket(env, session, origin) {
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));
  const now=Math.floor(Date.now()/1000);
  // Persistent SQL state makes consumption atomic across Worker instances.
  await env.DB.batch([
    env.DB.prepare(schema),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS business_entry_tickets_expiry ON business_entry_tickets(expires_at)'),
    env.DB.prepare('DELETE FROM business_entry_tickets WHERE expires_at <= ?').bind(now),
    env.DB.prepare('INSERT INTO business_entry_tickets(token_hash,session_hash,expires_at) VALUES(?,?,?)').bind(await digest(token),await digest(origin+'\0'+session),now+86400)
  ]);
  return token;
}
export async function consumeEntryTicket(env, token, session, origin) {
  if(!session||!/^[a-f0-9]{64}$/.test(token||''))return false;
  const result=await env.DB.prepare('DELETE FROM business_entry_tickets WHERE token_hash = ? AND session_hash = ? AND expires_at > ?')
    .bind(await digest(token),await digest(origin+'\0'+session),Math.floor(Date.now()/1000)).run();
  return result.meta.changes===1;
}
