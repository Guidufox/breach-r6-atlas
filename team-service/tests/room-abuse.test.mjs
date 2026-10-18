import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomAbuse } from '../lib/room-abuse.js';

function database() {
  const rows=new Map();
  return {rows,prepare(){return {bind(key,expires){return {async first(){const count=(rows.get(key)?.count||0)+1;rows.set(key,{count,expires});return {count};}};}};}};
}

test('create limit is atomic by bucket and D1 sees only keyed hashes',async()=>{
  const db=database(),now=1800000000000;
  for(let i=0;i<6;i++)assert.equal((await RoomAbuse.charge(db,'private-test-secret','create-client','203.0.113.9',now,3600000,6)).allowed,true);
  const blocked=await RoomAbuse.charge(db,'private-test-secret','create-client','203.0.113.9',now,3600000,6);
  assert.equal(blocked.allowed,false);assert(blocked.retryAfter>0);
  assert.equal([...db.rows.keys()].length,1);
  assert.match([...db.rows.keys()][0],/^[a-f0-9]{64}$/);
  assert(!JSON.stringify([...db.rows]).includes('203.0.113.9'));
  assert.equal((await RoomAbuse.charge(db,'private-test-secret','create-client','203.0.113.9',now+3600000,3600000,6)).allowed,true);
});

test('clients and actions have separate counters',async()=>{
  const db=database(),at=1800000000000;
  await RoomAbuse.charge(db,'secret','create-client','203.0.113.1',at,3600000,1);
  assert((await RoomAbuse.charge(db,'secret','join-client','203.0.113.1',at,3600000,1)).allowed);
  assert((await RoomAbuse.charge(db,'secret','create-client','203.0.113.2',at,3600000,1)).allowed);
});

test('authenticated polls receive a short per-isolate brake',()=>{
  const id='poll-test-'+crypto.randomUUID(),at=1800000000000;
  assert(RoomAbuse.poll(id,at,2).allowed);
  assert(RoomAbuse.poll(id,at+1,2).allowed);
  assert.equal(RoomAbuse.poll(id,at+2,2).allowed,false);
  assert(RoomAbuse.poll(id,at+60000,2).allowed);
});
