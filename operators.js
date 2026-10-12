'use strict';
(() => {
  const cache=new Map();let catalog;
  const $=id=>document.getElementById(id);
  const t=key=>window.BREACH_I18N[document.documentElement.lang.toLowerCase()]?.[key]||window.BREACH_I18N.es[key]||key;
  const load=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});
  async function asset(id){
    if(!/^[a-z][a-z0-9-]{0,40}$/.test(id))throw new Error('operatorFailed');
    if(Object.hasOwn(window.R6_OPERATOR_IMAGES||{},id)&&typeof window.R6_OPERATOR_IMAGES[id]==='string')return window.R6_OPERATOR_IMAGES[id];
    if(!cache.has(id))cache.set(id,load('assets/operators/'+id+'.js').then(()=>{const source=window.R6_OPERATOR_IMAGES?.[id];if(!source)throw new Error('operatorFailed');document.dispatchEvent(new Event('r6-operator-ready'));return source;}).catch(error=>{cache.delete(id);throw error;}));
    return cache.get(id);
  }
  const dialog=document.createElement('dialog');dialog.id='operatorDialog';
  dialog.innerHTML='<button class="dialog-close" id="operatorClose">×</button><h2 data-operator-text="operatorSettings"></h2><p data-operator-text="operatorIntro"></p><label class="field-label" for="operatorSelect" data-operator-text="operatorChoose"></label><select id="operatorSelect"></select><div class="operator-preview"><img id="operatorPreview" width="72" height="72" alt=""><span id="operatorCaption"></span></div><label class="field-label" for="operatorInstruction" data-operator-text="operatorInstruction"></label><input id="operatorInstruction" class="text-field" maxlength="300"><label class="attach-option"><input id="operatorRoutes" type="checkbox" checked><span data-operator-text="operatorRoutes"></span></label><p id="operatorStatus" role="status"></p><button id="operatorPlace" class="primary" data-operator-text="operatorPlace"></button>';
  document.body.append(dialog);
  let chosen='';
  async function preview(){
    const id=$('operatorSelect').value;chosen=id;$('operatorPlace').disabled=!!id;$('operatorPreview').hidden=!id;$('operatorStatus').textContent='';$('operatorCaption').textContent=name(id);
    if(!id){$('operatorPlace').disabled=false;return;}
    try{const source=await asset(id);if(chosen!==id)return;$('operatorPreview').src=source;$('operatorPreview').alt=name(id);$('operatorPlace').disabled=false;}
    catch{if(chosen===id)$('operatorStatus').textContent=t('operatorFailed');}
  }
  function name(id){return window.R6_OPERATORS?.find(op=>op.id===id)?.name||id.toUpperCase();}
  async function open(){
    catalog ||= load('operators-data.js?v=icons-1');await catalog;
    dialog.querySelectorAll('[data-operator-text]').forEach(e=>e.textContent=t(e.dataset.operatorText));$('operatorClose').setAttribute('aria-label',t('close'));
    $('operatorSelect').replaceChildren();const none=document.createElement('option');none.value='';none.textContent=t('operatorNone');$('operatorSelect').append(none);
    for(const operator of window.R6_OPERATORS){const option=document.createElement('option');option.value=operator.id;option.textContent=operator.name;$('operatorSelect').append(option);}
    const current=window.R6OperatorBridge.current();$('operatorSelect').value=current.id;$('operatorInstruction').value=current.note;$('operatorInstruction').placeholder=t('operatorExample');$('operatorRoutes').checked=current.routes;dialog.showModal();preview();
  }
  $('operatorSelect').onchange=preview;$('operatorClose').onclick=()=>dialog.close();
  $('operatorPlace').onclick=()=>{window.R6OperatorBridge.choose($('operatorSelect').value,$('operatorInstruction').value,$('operatorRoutes').checked);dialog.close();};
  window.R6Operators={asset,open,name};
})();
