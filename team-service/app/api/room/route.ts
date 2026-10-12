import { env } from 'cloudflare:workers';
import { RoomCore } from '../../../lib/room-core';
const ORIGIN='https://guidufox.github.io';
const MAX=1024*1024, TTL=2*60*60*1000, LEASE=5*60*1000;
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store','Vary':'Origin'};
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const validToken=(v:unknown):v is string=>typeof v==='string'&&/^[a-f\d]{64}$/.test(v);
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f\d-]{36}$/.test(v);
const fail=(code:string,status=400):never=>{throw Object.assign(new Error(code),{status});};
export async function OPTIONS(){return new Response(null,{status:204,headers:cors});}
export async function GET(){return response({service:'r6-team',status:'ok'});}
export async function POST(request:Request){
 try{
  if(request.headers.get('Origin')!==ORIGIN)return response({error:'roomOrigin'},403);
  if(Number(request.headers.get('Content-Length')||0)>MAX+20000)return response({error:'roomSize'},413);
  const bytes=await request.arrayBuffer();if(bytes.byteLength>MAX+20000)return response({error:'roomSize'},413);
  const input=JSON.parse(new TextDecoder().decode(bytes));const db=env.DB,now=Date.now();
  if(!db)return response({error:'roomNetwork'},503);
  await db.prepare('DELETE FROM rooms WHERE id IN (SELECT id FROM rooms WHERE expires<? LIMIT 100)').bind(now).run();
  if(input.action==='create'){
   const {meta,doc}=input;if(!meta||!(/^[a-z]+$/).test(meta.id)||!Number.isInteger(meta.revision)||typeof meta.sourceSha256!=='string'||!(/^[a-f\d]{64}$/).test(meta.sourceSha256)||!Number.isInteger(input.floor)||input.floor<-1||input.floor>6)fail('roomInvalid');
   RoomCore.validateDoc(doc,meta.id);const encoded=JSON.stringify(doc);if(new TextEncoder().encode(encoded).length>MAX)fail('roomSize',413);
   const id=crypto.randomUUID(),key=token(),member=crypto.randomUUID(),memberToken=token(),name=String(input.name||'Jugador').slice(0,30);
   const results=await db.batch([
    db.prepare('DELETE FROM rooms WHERE id IN (SELECT id FROM rooms WHERE expires<? LIMIT 100)').bind(now),
    db.prepare('INSERT INTO rooms (id,invite_hash,meta,floor,doc,version,expires) SELECT ?,?,?,?,?,0,? WHERE (SELECT COUNT(*) FROM rooms)<100').bind(id,await hash(key),JSON.stringify(meta),input.floor,encoded,now+TTL),
    db.prepare('INSERT INTO members (id,room,token_hash,name,host,seen) SELECT ?,?,?,?,1,? WHERE EXISTS(SELECT 1 FROM rooms WHERE id=?)').bind(member,id,await hash(memberToken),name,now,id),
   ]);
   if(!results[1].meta.changes)fail('roomBusy',503);
   return response({id,key,member,token:memberToken,expires:now+TTL});
  }
  if(!validId(input.id))fail('roomInvalidInvite');
  const room=await db.prepare('SELECT id,invite_hash,meta,floor,version,expires FROM rooms WHERE id=? AND expires>?').bind(input.id,now).first<{id:string;invite_hash:string;meta:string;floor:number;version:number;expires:number}>();
  if(!room)fail('roomExpired',404);
  if(input.action==='join'){
   if(!validToken(input.key)||await hash(input.key)!==room!.invite_hash)fail('roomInvalidInvite',403);
   const member=crypto.randomUUID(),memberToken=token(),name=String(input.name||'Jugador').slice(0,30);
   const results=await db.batch([
    db.prepare('DELETE FROM members WHERE room=? AND seen<?').bind(input.id,now-LEASE),
    db.prepare('INSERT INTO members (id,room,token_hash,name,host,seen) SELECT ?,?,?,?,0,? WHERE (SELECT COUNT(*) FROM members WHERE room=?)<5').bind(member,input.id,await hash(memberToken),name,now,input.id),
   ]);
   if(!results[1].meta.changes)fail('roomFull',409);
   return response({id:input.id,member,token:memberToken,expires:room!.expires});
  }
  if(!validId(input.member)||!validToken(input.token))fail('roomDisconnected',401);
  const actor=await db.prepare('SELECT id FROM members WHERE id=? AND room=? AND token_hash=? AND seen>?').bind(input.member,input.id,await hash(input.token),now-LEASE).first();
  if(!actor)fail('roomDisconnected',401);
  if(input.action==='leave'){
   await db.prepare('DELETE FROM members WHERE id=?').bind(input.member).run();return response({left:true});
  }
  await db.prepare('UPDATE members SET seen=? WHERE id=?').bind(now,input.member).run();
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
 }catch(error){const e=error as Error & {status?:number};return response({error:/^room[A-Z]/.test(e.message)?e.message:'roomNetwork'},e.status||400);}
}
