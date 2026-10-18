'use strict';
(() => {
  let catalog;
  const $=id=>document.getElementById(id);
  const markerIntro={es:'Elegí un marcador con el nombre abreviado del operador y colocalo en el plano. Podés arrastrarlo para moverlo y vincularlo a rutas.',en:'Choose a short text marker for an operator and place it on the map. Drag it to move it or link it to routes.','pt-br':'Escolha um marcador de texto para o operador e coloque-o no mapa. Arraste para mover ou vincule-o às rotas.'};
  const t=key=>key==='operatorIntro'?markerIntro[document.documentElement.lang.toLowerCase()]||markerIntro.es:window.BREACH_I18N[document.documentElement.lang.toLowerCase()]?.[key]||window.BREACH_I18N.es[key]||key;
  const load=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});
  const special={gridlock:'GDL',grim:'GRM',sens:'SNS',sentry:'SNT','solid-snake':'SLD',solis:'SLS'};
  function label(id){return special[id]||id.slice(0,3).toUpperCase();}
  const dialog=document.createElement('dialog');dialog.id='operatorDialog';
  dialog.innerHTML='<button class="dialog-close" id="operatorClose">×</button><h2 data-operator-text="operatorSettings"></h2><p data-operator-text="operatorIntro"></p><label class="field-label" for="operatorSelect" data-operator-text="operatorChoose"></label><select id="operatorSelect"></select><div class="operator-preview"><span id="operatorPreview" class="operator-glyph" role="img"></span><span id="operatorCaption"></span></div><label class="field-label" for="operatorInstruction" data-operator-text="operatorInstruction"></label><input id="operatorInstruction" class="text-field" maxlength="300"><label class="attach-option"><input id="operatorRoutes" type="checkbox" checked><span data-operator-text="operatorRoutes"></span></label><p id="operatorStatus" role="status"></p><button id="operatorPlace" class="primary" data-operator-text="operatorPlace"></button>';
  document.body.append(dialog);
  function preview(){
    const id=$('operatorSelect').value;$('operatorPreview').hidden=!id;$('operatorPreview').textContent=id?label(id):'';
    $('operatorPreview').setAttribute('aria-label',id?name(id):'');$('operatorCaption').textContent=id?name(id):'';
  }
  function name(id){return window.R6_OPERATORS?.find(op=>op.id===id)?.name||id.toUpperCase();}
  async function open(){
    catalog ||= load('operators-data.js?v=names-1');await catalog;
    dialog.querySelectorAll('[data-operator-text]').forEach(e=>e.textContent=t(e.dataset.operatorText));$('operatorClose').setAttribute('aria-label',t('close'));
    $('operatorSelect').replaceChildren();const none=document.createElement('option');none.value='';none.textContent=t('operatorNone');$('operatorSelect').append(none);
    for(const operator of window.R6_OPERATORS){const option=document.createElement('option');option.value=operator.id;option.textContent=operator.name;$('operatorSelect').append(option);}
    const current=window.R6OperatorBridge.current();$('operatorSelect').value=current.id;$('operatorInstruction').value=current.note;$('operatorInstruction').placeholder=t('operatorExample');$('operatorRoutes').checked=current.routes;dialog.showModal();preview();
  }
  $('operatorSelect').onchange=preview;$('operatorClose').onclick=()=>dialog.close();
  $('operatorPlace').onclick=()=>{window.R6OperatorBridge.choose($('operatorSelect').value,$('operatorInstruction').value,$('operatorRoutes').checked);dialog.close();};
  window.R6Operators={label,open,name};
})();
