const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../collab-core.js');
const action=(id,floor=1)=>({id,kind:'line',floor,color:'#f5cf55',points:[[1,2],[3,4]]});
test('five simultaneous players keep distinct drawings and task fields',()=>{
 const data={actions:{bank:[]},teamTasks:{'bank:floor-1':Array.from({length:5},()=>({name:'',task:'',point:null,done:false}))}};
 const start=core.flatten(data,'bank');let shared=start;
 for(let i=0;i<5;i++){
  const local=structuredClone(data);local.actions.bank.push(action('player-'+i));local.teamTasks['bank:floor-1'][i].name='P'+i;local.teamTasks['bank:floor-1'][i].task='Entry '+i;
  shared=core.apply(shared,core.diff(start,core.flatten(local,'bank')),'bank');
 }
 const result=core.inflate(shared,'bank');assert.equal(result.actions.bank.length,5);assert.deepEqual(result.teamTasks['bank:floor-1'].map(x=>x.name),['P0','P1','P2','P3','P4']);
});
test('different task fields merge; last received write wins for same field',()=>{
 const start=core.flatten({teamTasks:{'bank:site-1':[{name:'A',task:'old',done:false}]}},'bank');
 const a=core.flatten({teamTasks:{'bank:site-1':[{name:'A',task:'hold',done:false}]}},'bank');
 const b=core.flatten({teamTasks:{'bank:site-1':[{name:'B',task:'old',done:false}]}},'bank');
 const merged=core.apply(core.apply(start,core.diff(start,a),'bank'),core.diff(start,b),'bank');
 assert.equal(core.inflate(merged,'bank').teamTasks['bank:site-1'][0].task,'hold');assert.equal(core.inflate(merged,'bank').teamTasks['bank:site-1'][0].name,'B');
});
test('delete propagates without removing another player drawing',()=>{
 const start=core.flatten({actions:{bank:[action('a'),action('b')]}},'bank');
 const edited=core.flatten({actions:{bank:[action('b')]}},'bank');
 assert.deepEqual(core.inflate(core.apply(start,core.diff(start,edited),'bank'),'bank').actions.bank.map(x=>x.id),['b']);
});
test('only selected map data is shared, not other maps or preferences',()=>{
 const data={actions:{bank:[action('a')],club:[action('secret')]},notes:{'bank:1':'ok','club:1':'private'},favoriteMaps:['club']};
 const result=core.inflate(core.flatten(data,'bank'),'bank');assert.equal(result.notes['club:1'],undefined);assert.equal(result.actions.club,undefined);assert.equal(result.favoriteMaps,undefined);
});
test('rejects cross-map writes, prototype paths, invalid geometry and oversized content',()=>{
 const start=core.flatten({},'bank');
 for(const op of [{key:'["notes","club:1"]',value:'bad'},{key:'["__proto__","bank:1"]',value:{}},{key:'["actions","bank","a"]',value:{...action('a'),points:[[Infinity,1]]}},{key:'["notes","bank:1"]',value:'a'.repeat(30001)}])assert.throws(()=>core.apply(start,[op],'bank'));
});
test('round-trip all floors, checklist, alias and point reset',()=>{
 const data={actions:{bank:[action('a',0),action('b',2)]},notes:{'bank:0':'Basement','bank:2':'Roof'},siteNotes:{'bank:1':'Site'},aliases:{'bank:1:label':'Team alias'},checklists:{'bank:1':[{id:'check',text:'Drone',done:true}]},teamTasks:{'bank:site-1':[{name:'A',task:'Hold',point:{id:'label',floor:1},done:false}]}};
 const start=core.flatten(data,'bank');data.teamTasks['bank:site-1'][0].point=null;const next=core.apply(start,core.diff(start,core.flatten(data,'bank')),'bank'),result=core.inflate(next,'bank');
 assert.equal(result.teamTasks['bank:site-1'][0].point,null);assert.equal(result.actions.bank.length,2);assert.equal(result.checklists['bank:1'][0].done,true);assert.equal(result.notes['bank:0'],'Basement');
});
