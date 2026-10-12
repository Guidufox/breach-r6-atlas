'use strict';
(() => {
 async function refresh(){
  const status=document.getElementById('statsStatus'),button=document.getElementById('refreshStats');button.disabled=true;
  try{const response=await fetch('https://r6-flamingo-team-service.stony-elk-7524.chatgpt.site/api/visit',{credentials:'omit',cache:'no-store',redirect:'error'});if(!response.ok)throw 0;const data=await response.json();const rows=document.getElementById('statsRows');rows.replaceChildren();
   for(const item of data.rows||[]){const row=document.createElement('tr');for(const value of [item.day,item.path,item.language,item.count]){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}rows.append(row);}status.textContent=rows.children.length?'Totales agregados de los últimos 90 días.':'Todavía no hay visitas registradas.';
  }catch{status.textContent='No se pudieron consultar los totales. El atlas sigue funcionando; intentá más tarde.';}finally{button.disabled=false;}
 }
 document.getElementById('refreshStats').onclick=refresh;refresh();
})();
