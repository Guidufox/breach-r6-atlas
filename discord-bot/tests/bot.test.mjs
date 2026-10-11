import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {catalog,ROOT,LANGUAGES,resolveMap,suggestMaps,resolveFloor,suggestFloors,floorLabel} from '../src/catalog.mjs';
import {commands,registerCommands} from '../src/commands.mjs';
import {controls,parseControl,payloads,createHandler} from '../src/handler.mjs';
import {loadConfig,safeError} from '../src/config.mjs';
const owner='123456789012345678',guildId='234567890123456789',config={guildId,defaultLanguage:'es',website:''},bank=resolveMap('bank');
function fake({command='mapa',values={},customId='',user=owner,autocomplete=null}={}){
 const trace=[],i={trace,guildId,user:{id:user},locale:'es-AR',attachmentSizeLimit:8*1024*1024,appPermissions:{has:()=>true},channel:{isThread:()=>false},commandName:command,customId,values:values.selected||[],
 options:{getString:name=>values[name]??null,getFocused:()=>autocomplete},isAutocomplete:()=>!!autocomplete,isChatInputCommand:()=>!customId&&!autocomplete,isButton:()=>!!customId,isStringSelectMenu:()=>false,
 reply:async value=>{trace.push(['reply',value]);i.replied=true;},respond:async value=>trace.push(['respond',value]),deferReply:async()=>{trace.push(['deferReply']);i.deferred=true;},deferUpdate:async()=>{trace.push(['deferUpdate']);i.deferred=true;},editReply:async value=>trace.push(['editReply',value]),followUp:async value=>trace.push(['followUp',value])};return i;
}
test('29 maps, source-equivalent labels, three languages and all floor files',async()=>{
 assert.equal(catalog.maps.length,29);assert.equal(catalog.maps.reduce((n,m)=>n+m.labelCount,0),2943);
 const audit=JSON.parse(await fs.readFile(path.join(ROOT,'tools/render-audit.json'),'utf8'));
 for(const m of catalog.maps){assert(m.floors.length>0);assert.equal(m.floors.reduce((n,f)=>n+f.labelCount,0),m.labelCount);for(const f of m.floors)for(const l of LANGUAGES){const file=await fs.readFile(path.join(ROOT,'assets',f.images[l]));assert.equal(file[0],255);assert.equal(file[1],216);assert(file.length<8*1024*1024);const row=audit.find(a=>a.map===m.id&&a.floor===f.value&&a.language===l);assert(row);assert.equal(row.localized,f.labelCount);}}
 assert.equal(resolveMap('District').floors[0].labelCount,0);assert.equal(floorLabel(resolveMap('district'),1,'es'),'Vista general');
});
test('accent-insensitive map aliases and autocomplete reaches every map',()=>{
 assert.equal(resolveMap('Residência').id,'house');assert.equal(resolveMap('BANCO').id,'bank');assert.equal(resolveMap('../bank'),undefined);assert(suggestMaps('','es').length<=25);
 for(const m of catalog.maps)assert(suggestMaps(m.id,'es').some(x=>x.value===m.id));
 assert.equal(resolveFloor(bank,'B'),0);assert.equal(resolveFloor(bank,'f1'),1);assert.equal(resolveFloor(bank,'todos'),null);assert.equal(resolveFloor(bank,'f99'),undefined);
 assert(suggestFloors(bank,'','pt-br').some(x=>x.name.includes('Porão')));
});
test('commands have autocomplete, three languages and preserve unrelated commands',async()=>{
 const definitions=commands();assert.deepEqual(definitions.map(x=>x.name),['mapa','bot','ayuda']);assert(definitions[0].options[0].autocomplete);assert.equal(definitions[0].options[1].choices.length,3);
 const events=[],routes={applicationGuildCommands:()=>'/guild',applicationGuildCommand:(a,g,id)=>'/guild/'+id},rest={get:async()=>[{name:'other',type:1,id:'keep'},{name:'mapa',type:1,id:'map'}],patch:async(r,b)=>events.push(['patch',r,b]),post:async(r,b)=>events.push(['post',r,b])};
 await registerCommands(rest,routes,config);assert.equal(events.length,3);assert.equal(events[0][0],'patch');assert(events.every(e=>!e[1].includes('keep')));
});
test('images and controls cover all floors, ownership and changed language',async()=>{
 const batches=await payloads(bank,'es',null,owner,8*1024*1024);assert.equal(batches.flatMap(x=>x.files).length,bank.floors.length);for(const p of batches){assert.deepEqual(p.allowedMentions,{parse:[]});assert(p.files.length<=10);p.components.forEach(r=>r.toJSON());p.embeds.forEach(e=>assert(e.toJSON().image.url.startsWith('attachment://')));}
 const id=controls(bank,'es',1,owner)[0].toJSON().components[1].custom_id,state=parseControl(id);assert(state);assert.equal(state.owner,owner);
 assert.equal(parseControl('br1:lang:bank:es:1:'+owner,['pt-br']).lang,'pt-br');assert.equal(parseControl('br1:page:bank:es:999:'+owner),null);
 await assert.rejects(payloads(bank,'es',0,owner,10),/IMAGE_LIMIT/);
});
test('slash command defers first and sends all floors without network',async()=>{
 const i=fake({values:{mapa:'Banco',idioma:'es',piso:'todos'}});await createHandler(config)(i);assert.equal(i.trace[0][0],'deferReply');assert.equal(i.trace[1][0],'editReply');assert.equal(i.trace.flatMap(e=>e[1]?.files||[]).length,bank.floors.length);
 const pt=fake({command:'bot',values:{mapa:'Bank',idioma:'pt-br',piso:'f0'}});await createHandler(config)(pt);assert(pt.trace[1][1].embeds[0].toJSON().title.includes('Porão'));
});
test('buttons update original, protect owner, work in threads and rate-limit',async()=>{
 const id='br1:page:bank:es:0:'+owner,handler=createHandler(config,{clock:()=>1000}),i=fake({customId:id});i.channel.isThread=()=>true;await handler(i);assert.equal(i.trace[0][0],'deferUpdate');assert.equal(i.trace[1][0],'editReply');
 const twice=fake({customId:id});await handler(twice);assert.equal(twice.trace[0][0],'reply');assert(twice.trace[0][1].content.includes('Esperá'));
 const other=fake({customId:id,user:'345678901234567890'});await handler(other);assert.equal(other.trace[0][0],'reply');assert(other.trace[0][1].content.includes('controles'));
});
test('invalid inputs and missing permissions respond before sending',async()=>{
 for(const values of [{mapa:'invalid'},{mapa:'bank',piso:'f99'}]){const i=fake({values});await createHandler(config)(i);assert.equal(i.trace[0][0],'reply');assert.equal(i.trace.length,1);}
 const missing=fake({values:{mapa:'bank'}});missing.appPermissions.has=()=>false;await createHandler(config)(missing);assert(missing.trace[0][1].content.includes('permiso'));
 const auto=fake({autocomplete:{name:'mapa',value:'banc'}});await createHandler(config)(auto);assert.equal(auto.trace[0][0],'respond');assert(auto.trace[0][1].some(x=>x.value==='bank'));
});
test('failed send reports error after defer; no raw secrets in diagnostics',async()=>{
 const i=fake({values:{mapa:'bank',piso:'f0'}});i.editReply=async()=>{throw {code:50013,requestBody:{token:'fake_secret'}};};let seen=0;await createHandler(config,{onError:()=>seen++})(i);assert.equal(seen,1);assert.equal(i.trace.at(-1)[0],'followUp');assert(!JSON.stringify(i.trace).includes('fake_secret'));
 assert.equal(safeError({code:50013,token:'fake_secret'}),'Código 50013');
 assert.throws(()=>loadConfig({}),/Configurá/);assert.throws(()=>loadConfig({DISCORD_TOKEN:'x',DISCORD_APPLICATION_ID:owner,DISCORD_GUILD_ID:guildId,ATLAS_URL:'http://example.com'}),/HTTPS/);
 const c=loadConfig({DISCORD_TOKEN:'fake_secret',DISCORD_APPLICATION_ID:owner,DISCORD_GUILD_ID:guildId});assert.equal(c.defaultLanguage,'es');
});

test('attachment limit failure clears the initial loading reply',async()=>{
 const i=fake({values:{mapa:'bank',piso:'f0'}});i.attachmentSizeLimit=10;await createHandler(config)(i);assert.equal(i.trace[0][0],'deferReply');assert.equal(i.trace.at(-1)[0],'editReply');assert(i.trace.at(-1)[1].content.includes('límite'));assert.deepEqual(i.trace.at(-1)[1].attachments,[]);
});
