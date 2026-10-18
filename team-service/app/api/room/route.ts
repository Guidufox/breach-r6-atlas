import { env } from 'cloudflare:workers';
import { RoomCore } from '../../../lib/room-core';
import { RoomAbuse } from '../../../lib/room-abuse';
const ORIGIN='https://guidufox.github.io';
const MAX=1024*1024, TTL=2*60*60*1000, LEASE=5*60*1000;
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const response=(body:unknown,status=200,retryAfter?:number)=>Response.json(body,{status,headers:{...cors,...(retryAfter?{'Retry-After':String(retryAfter)}:{})}});
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const validToken=(v:unknown):v is string=>typeof v==='string'&&/^[a-f\d]{64}$/.test(v);
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/.test(v);
const fail=(code:string,status=400,retryAfter?:number):never=>{throw Object.assign(new Error(code),{status,retryAfter});};
const nickname=(value:unknown)=>{
 if(value!==undefined&&typeof value!=='string')fail('roomInvalid');
 return ((value as string|undefined)||'Jugador').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').trim().slice(0,30)||'Jugador';
};
const allow=(result:{allowed:boolean;retryAfter:number})=>{if(!result.allowed)fail('roomRate',429,result.retryAfter);};
export async function OPTIONS(){return new Response(null,{status:204,headers:cors});}
export async function GET(){return response({service:'r6-team',status:'ok'});}
export async function POST(request:Request){
 try{
  if(request.headers.get('Origin')!==ORIGIN)return response({error:'roomOrigin'},403);
  if(!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('Content-Type')||''))return response({error:'roomInvalid'},415);
  if(Number(request.headers.get('Content-Length')||0)>MAX+20000)return response({error:'roomSize'},413);
  const bytes=await request.arrayBuffer();if(bytes.byteLength>MAX+20000)return response({error:'roomSize'},413);
  let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('roomInvalid');}
  const db=env.DB,now=Date.now();
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.action!=='string')fail('roomInvalid');
  if(!['create','join','poll','edit','leave'].includes(input.action))fail('roomInvalid');
  if(!db||!env.ROOM_RATE_SECRET)return response({error:'roomNetwork'},503);
  const client=request.headers.get('cf-connecting-ip')||'unknown';
  const limit=(scope:string,identity:string,windowMs:number,count:number)=>RoomAbuse.charge(db,env.ROOM_RATE_SECRET!,scope,identity,now,windowMs,count).then(allow);
  if(input.action==='create'){
   await limit('create-client',client,3600000,6);
   await limit('create-global','all',3600000,40);
   const {meta,doc}=input;if(!meta||typeof meta!=='object'||Array.isArray(meta)||Object.keys(meta).sort().join(',')!=='id,revision,sourceSha256'||typeof meta.id!=='string'||!(/^[a-z]{2,32}$/).test(meta.id)||!Number.isSafeInteger(meta.revision)||meta.revision<0||meta.revision>1000000||typeof meta.sourceSha256!=='string'||!(/^[a-f\d]{64}$/).test(meta.sourceSha256)||!Number.isInteger(input.floor)||input.floor<-1||input.floor>6)fail('roomInvalid');
   RoomCore.validateDoc(doc,meta.id);const encoded=JSON.stringify(doc);if(new TextEncoder().encode(encoded).length>MAX)fail('roomSize',413);
   const id=crypto.randomUUID(),key=token(),member=crypto.randomUUID(),memberToken=token(),name=nickname(input.name);
   const results=await db.batch([
    db.prepare('DELETE FROM rooms WHERE id IN (SELECT id FROM rooms WHERE expires<? LIMIT 100)').bind(now),
    db.prepare('DELETE FROM room_limits WHERE key IN (SELECT key FROM room_limits WHERE expires<? LIMIT 100)').bind(now),
    db.prepare('INSERT INTO rooms (id,invite_hash,meta,floor,doc,version,expires) SELECT ?,?,?,?,?,0,? WHERE (SELECT COUNT(*) FROM rooms)<100').bind(id,await hash(key),JSON.stringify(meta),input.floor,encoded,now+TTL),
    db.prepare('INSERT INTO members (id,room,token_hash,name,host,seen) SELECT ?,?,?,?,1,? WHERE EXISTS(SELECT 1 FROM rooms WHERE id=?)').bind(member,id,await hash(memberToken),name,now,id),
   ]);
   if(!results[2].meta.changes)fail('roomBusy',503);
   return response({id,key,member,token:memberToken,expires:now+TTL});
  }
  if(input.action==='join')await limit('join-client',client,600000,30);
  if(!validId(input.id))fail('roomInvalidInvite');
  const room=await db.prepare('SELECT id,invite_hash,meta,floor,version,expires FROM rooms WHERE id=? AND expires>?').bind(input.id,now).first<{id:string;invite_hash:string;meta:string;floor:number;version:number;expires:number}>();
  if(!room)fail('roomExpired',404);
  if(input.action==='join'){
   if(!validToken(input.key)||await hash(input.key)!==room!.invite_hash)fail('roomInvalidInvite',403);
   const member=crypto.randomUUID(),memberToken=token(),name=nickname(input.name);
   const results=await db.batch([
    db.prepare('DELETE FROM members WHERE room=? AND seen<?').bind(input.id,now-LEASE),
    db.prepare('INSERT INTO members (id,room,token_hash,name,host,seen) SELECT ?,?,?,?,0,? WHERE (SELECT COUNT(*) FROM members WHERE room=?)<5').bind(member,input.id,await hash(memberToken),name,now,input.id),
   ]);
   if(!results[1].meta.changes)fail('roomFull',409);
   return response({id:input.id,member,token:memberToken,expires:room!.expires});
  }
  if(!validId(input.member)||!validToken(input.token))fail('roomDisconnected',401);
  const actorHash=await hash(input.token);
  const actor=await db.prepare('SELECT id FROM members WHERE id=? AND room=? AND token_hash=? AND seen>?').bind(input.member,input.id,actorHash,now-LEASE).first();
  if(!actor)fail('roomDisconnected',401);
  if(input.action==='poll')allow(RoomAbuse.poll(actorHash,now));
  if(input.action==='edit')await limit('edit-member',input.member,60000,30);
  if(input.action==='leave'){
   await db.prepare('DELETE FROM members WHERE id=?').bind(input.member).run();return response({left:true});
  }
  await db.prepare('UPDATE members SET seen=? WHERE id=? AND seen<?').bind(now,input.member,now-30000).run();
  const meta=JSON.parse(room!.meta);
  if(input.action==='edit'){
   const current=await db.prepare('SELECT doc FROM rooms WHERE id=?').bind(input.id).first<{doc:string}>();
   RoomCore.apply(JSON.parse(current!.doc),input.ops,meta.id);
   const patch:Record<string,unknown>={};for(const op of input.ops)patch[op.key]=op.value;
   const encoded=JSON.stringify(patch);
   const sql=`UPDATE rooms SET doc=json_patch(doc,?),version=version+1 WHERE id=? AND expires>? AND length(CAST(json_patch(doc,?) AS BLOB))<=? AND (SELECT COUNT(*) FROM json_each(json_patch(doc,?)))<=4000 AND (SELECT COUNT(*) FROM json_each(json_patch(doc,?)) WHERE json_extract(key,'$[0]')='actions')<=1500 AND NOT EXISTS (SELECT 1 FROM json_each(json_patch(doc,?)) WHERE json_extract(key,'$[0]')='checklists' GROUP BY json_extract(key,'$[1]') HAVING COUNT(*)>40)`;
   const result=await db.prepare(sql).bind(encoded,input.id,now,encoded,MAX,encoded,encoded,encoded).run();
   if(!result.meta.changes)fail('roomSize',413);
  }else if(input.action!=='poll')fail('roomInvalid');
  const version=Number.isInteger(input.version)?input.version:-1;
  const data=await db.prepare('SELECT meta,floor,version,expires,CASE WHEN version!=? THEN doc ELSE NULL END AS doc FROM rooms WHERE id=?').bind(version,input.id).first<{meta:string;floor:number;version:number;expires:number;doc:string|null}>();
  const members=await db.prepare('SELECT id,name,host FROM members WHERE room=? AND seen>? ORDER BY host DESC,seen ASC').bind(input.id,now-LEASE).all();
  return response({meta:JSON.parse(data!.meta),floor:data!.floor,version:data!.version,expires:data!.expires,doc:data!.doc?JSON.parse(data!.doc):null,members:members.results});
 }catch(error){const e=error as Error & {status?:number;retryAfter?:number};return response({error:/^room[A-Z]/.test(e.message)?e.message:'roomNetwork',...(e.retryAfter?{retryAfter:e.retryAfter}:{})},e.status||503,e.retryAfter);}
}
