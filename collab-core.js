'use strict';
(function(root) {
  const collections = ['actions', 'notes', 'siteNotes', 'teamTasks', 'checklists', 'aliases'];
  const MAX_BYTES = 2 * 1024 * 1024;
  const clone = value => JSON.parse(JSON.stringify(value));
  const entry = parts => JSON.stringify(parts);
  function flatten(data, map) {
    const doc = Object.create(null);
    for (const collection of collections) for (const [key, value] of Object.entries(data[collection] || {})) {
      if (collection === 'actions') {
        if (key !== map || !Array.isArray(value)) continue;
        for (const action of value) doc[entry([collection, key, action.id])] = clone(action);
      } else if (key.startsWith(map + ':')) {
        if (collection === 'teamTasks') {
          if (Array.isArray(value)) value.slice(0, 5).forEach((task, index) => {
            for (const field of ['name','task','point','done']) {if(field==='point'&&task[field]==null)continue;doc[entry([collection,key,String(index),field])] = clone(task[field] ?? (field === 'done' ? false : ''));}
          });
        } else if (collection === 'checklists') {
          if (Array.isArray(value)) for (const item of value) doc[entry([collection,key,item.id])] = clone(item);
        } else doc[entry([collection,key])] = clone(value);
      }
    }
    validateDoc(doc, map);
    return doc;
  }
  function inflate(doc, map) {
    const data = Object.fromEntries(collections.map(c => [c, Object.create(null)]));
    data.actions[map] = [];
    for (const [key,value] of Object.entries(doc)) {
      const [collection,scope,id,field] = JSON.parse(key);
      if (collection === 'actions') data.actions[map].push(clone(value));
      else if (collection === 'teamTasks') {
        data.teamTasks[scope] ||= Array.from({length:5},()=>({name:'',task:'',point:null,done:false}));
        data.teamTasks[scope][Number(id)][field] = clone(value);
      } else if (collection === 'checklists') (data.checklists[scope] ||= []).push(clone(value));
      else data[collection][scope] = clone(value);
    }
    return data;
  }
  function validValue(key,value,map) {
    let parts;
    try { parts=JSON.parse(key); } catch { return false; }
    if (!Array.isArray(parts) || !parts.every(p => typeof p === 'string' && p.length < 200)) return false;
    const [collection,scope,id,field] = parts;
    if (!collections.includes(collection)) return false;
    if (collection === 'actions') {
      if (parts.length !== 3 || scope !== map || !/^[\w.:-]{1,100}$/.test(id)) return false;
      if (value === null) return true;
      return value && value.id === id && ['pin','line','pen'].includes(value.kind) && Number.isInteger(value.floor) && value.floor >= -1 && value.floor <= 6 && /^#[a-f\d]{6}$/i.test(value.color) && Array.isArray(value.points) && value.points.length > 0 && value.points.length <= 10000 && value.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1e6)) && (value.label === undefined || typeof value.label === 'string' && value.label.length <= 60) && (value.note === undefined || typeof value.note === 'string' && value.note.length <= 300) && (value.site === undefined || typeof value.site === 'string' && /^\d{1,2}$/.test(value.site));
    }
    if (!scope.startsWith(map+':')) return false;
    const suffix=scope.slice(map.length+1);
    if (collection === 'teamTasks') {
      if (parts.length !== 4 || !/^(?:site-\d{1,2}|floor--?\d)$/.test(suffix) || !/^[0-4]$/.test(id) || !['name','task','point','done'].includes(field)) return false;
      if (value === null) return true;
      if (field === 'done') return typeof value === 'boolean';
      if (field === 'point') return value && typeof value.id === 'string' && value.id.length < 100 && Number.isInteger(value.floor) && value.floor >= -1 && value.floor <= 6;
      return typeof value === 'string' && value.length <= (field === 'name' ? 60 : 600);
    }
    if (collection === 'checklists') {
      if (parts.length !== 3 || !/^\d{1,2}$/.test(suffix) || !/^[\w.:-]{1,100}$/.test(id)) return false;
      return value === null || value && value.id === id && typeof value.text === 'string' && value.text.length <= 300 && typeof value.done === 'boolean';
    }
    if (parts.length !== 2 || !(collection === 'aliases' ? /^-?\d:[\w.:-]+$/.test(suffix) : /^-?\d{1,2}$/.test(suffix))) return false;
    return value === null || typeof value === 'string' && value.length <= (collection === 'aliases' ? 80 : 30000);
  }
  function validateDoc(doc,map) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc) || Object.keys(doc).length > 4000 || JSON.stringify(doc).length > MAX_BYTES) throw new Error('roomSize');
    if (!Object.entries(doc).every(([key,value])=>validValue(key,value,map))) throw new Error('roomInvalid');
    const data=inflate(doc,map);
    if (data.actions[map].length > 1500 || Object.values(data.checklists).some(v=>v.length>40)) throw new Error('roomSize');
    return doc;
  }
  function diff(before,after) {
    return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])).map(key=>({key,value:Object.hasOwn(after,key)?clone(after[key]):null}));
  }
  function apply(doc,ops,map) {
    if (!Array.isArray(ops) || ops.length > 4000 || JSON.stringify(ops).length > MAX_BYTES) throw new Error('roomSize');
    const next=Object.assign(Object.create(null),doc);
    for (const op of ops) {
      if (!op || !validValue(op.key,op.value,map)) throw new Error('roomInvalid');
      if (op.value === null) delete next[op.key]; else next[op.key]=clone(op.value);
    }
    return validateDoc(next,map);
  }
  const api={flatten,inflate,diff,apply,validateDoc,MAX_BYTES};
  if(typeof module !== 'undefined' && module.exports) module.exports=api; else root.R6RoomCore=api;
})(typeof window === 'undefined' ? globalThis : window);
