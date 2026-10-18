// Fixed-window counters for scarce operations. Only keyed hashes reach D1.
export const RoomAbuse = (() => {
  const encoder = new TextEncoder();
  const local = new Map();
  const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');

  async function key(secret, scope, identity, bucket) {
    const material = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    return hex(await crypto.subtle.sign('HMAC', material, encoder.encode(`${scope}|${identity}|${bucket}`)));
  }

  async function charge(db, secret, scope, identity, now, windowMs, limit) {
    const bucket=Math.floor(now/windowMs), expires=(bucket+1)*windowMs;
    const digest=await key(secret,scope,identity,bucket);
    const row=await db.prepare('INSERT INTO room_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(digest,expires).first();
    return {allowed:Number(row?.count)<=limit,retryAfter:Math.max(1,Math.ceil((expires-now)/1000))};
  }

  // Cheap per-isolate brake for authenticated polls. D1 counters cover writes;
  // this additional limit is intentionally not a distributed accounting system.
  function poll(identity, now, limit=90) {
    if(local.size>10000)for(const [key,value] of local)if(value.until<=now)local.delete(key);
    const prior=local.get(identity);
    const current=prior&&prior.until>now?prior:{count:0,until:now+60000};
    current.count++;local.set(identity,current);
    return {allowed:current.count<=limit,retryAfter:Math.max(1,Math.ceil((current.until-now)/1000))};
  }
  return {charge,poll};
})();
