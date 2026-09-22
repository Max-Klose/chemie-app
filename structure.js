(function(){
 'use strict';
 const el=id=>document.getElementById(id),m=new Lewis.Model(),svg=el('drawing');
 let assisted=true,selected=null,palette=null,remove=false,moving=null,gesture=null,history=[],view={x:0,y:0,w:1100,h:680};
 const names={C:'Kohlenstoff',H:'Wasserstoff',O:'Sauerstoff',S:'Schwefel',N:'Stickstoff',Cl:'Chlor',B:'Bor',P:'Phosphor'};
 function save(){history.push(m.snapshot());if(history.length>80)history.shift();el('undo').disabled=false;}
 function status(text){el('drawing-status').textContent=text;}
 function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
 function line(x1,y1,x2,y2,cls,extra=''){return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" ${extra}/>`;}
 function fit(){const rect=svg.getBoundingClientRect(),ratio=(rect.width||1100)/(rect.height||680);if(!m.atoms.length){view={x:0,y:0,w:rect.width||1100,h:rect.height||680};}else{const xs=m.atoms.map(a=>a.x),ys=m.atoms.map(a=>a.y);let w=Math.max(500,Math.max(...xs)-Math.min(...xs)+180),h=Math.max(340,Math.max(...ys)-Math.min(...ys)+180);if(w/h<ratio)w=h*ratio;else h=w/ratio;view={x:(Math.min(...xs)+Math.max(...xs)-w)/2,y:(Math.min(...ys)+Math.max(...ys)-h)/2,w,h};}render();}
 function ensureVisible(){if(m.atoms.some(a=>a.x<view.x+45||a.x>view.x+view.w-45||a.y<view.y+45||a.y>view.y+view.h-45))fit();}
 function render(){
  svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);let html='';const handled=new Set();
  for(const bond of m.bonds){const key=[bond.a,bond.b].sort((a,b)=>a-b).join(':');if(handled.has(key))continue;handled.add(key);const a=m.atom(bond.a),b=m.atom(bond.b),bonds=m.bonds.filter(e=>e.a===a.id&&e.b===b.id||e.a===b.id&&e.b===a.id),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,pad=Math.min(20,len/3);
   bonds.forEach((edge,i)=>{const offset=(i-(bonds.length-1)/2)*8,x1=a.x+ux*pad-uy*offset,y1=a.y+uy*pad+ux*offset,x2=b.x-ux*pad-uy*offset,y2=b.y-uy*pad+ux*offset;html+=`<g data-bond="${edge.id}" tabindex="0" role="button" aria-label="${a.symbol}–${b.symbol}, Bindung lösen">${line(x1,y1,x2,y2,'bond-hit')}${line(x1,y1,x2,y2,'bond-line')}</g>`;});
  }
  for(const a of m.atoms){html+=`<g class="lewis-atom" data-atom="${a.id}" data-symbol="${a.symbol}" tabindex="0" role="button" aria-label="${names[a.symbol]}, antippen zum Drehen, halten zum Bewegen"><circle cx="${a.x}" cy="${a.y}" r="21" fill="${moving===a.id?'#d9f2f7':'#fcfdff'}" stroke="${moving===a.id?'#1588a2':'none'}" stroke-width="2" stroke-dasharray="4 3"/><text x="${a.x}" y="${a.y+9}" text-anchor="middle">${a.symbol}</text></g>`;
   a.slots.forEach((n,s)=>{if(!n||m.used(a.id,s))return;const angle=a.angles[s],x=a.x+Math.cos(angle)*32,y=a.y+Math.sin(angle)*32;if(n===1){const active=selected?.id===a.id&&selected.slot===s;html+=`<g class="electron-hit" data-electron="${a.id}:${s}" tabindex="0" role="button" aria-label="Einzelnes Elektron an ${names[a.symbol]}"><circle cx="${x}" cy="${y}" r="12" class="${active?'selected-electron':''}" fill="transparent"/><circle cx="${x}" cy="${y}" r="3.5" class="electron-dot"/></g>`;}else html+=line(x-Math.sin(angle)*12,y+Math.cos(angle)*12,x+Math.sin(angle)*12,y-Math.cos(angle)*12,'pair-line');});
  }
  svg.innerHTML=html;el('drawing-empty').hidden=m.atoms.length>0;el('undo').disabled=!history.length;el('delete-mode').setAttribute('aria-pressed',String(remove));el('palette').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.symbol===palette));
 }
 function target(e){const electron=e.target.closest('[data-electron]'),atom=e.target.closest('[data-atom]'),bond=e.target.closest('[data-bond]');if(electron){const [id,slot]=electron.dataset.electron.split(':').map(Number);return {kind:'electron',id,slot};}if(atom)return {kind:'atom',id:Number(atom.dataset.atom)};if(bond)return {kind:'bond',id:Number(bond.dataset.bond)};return {kind:'field'};}
 function activate(t,p){
  if(t.kind==='electron'){
   if(remove)return;if(!selected){selected={id:t.id,slot:t.slot};status('Jetzt ein einzelnes Elektron eines anderen Atoms antippen.');}
   else if(selected.id===t.id&&selected.slot===t.slot){selected=null;status('Elektron abgewählt.');}
   else if(selected.id===t.id){selected={id:t.id,slot:t.slot};status('Ein Elektron eines anderen Atoms auswählen.');}
   else{save();const ok=m.connect(selected.id,selected.slot,t.id,t.slot,assisted);if(!ok)history.pop();selected=null;status(ok?'Bindung gebildet. Weitere Punkte verbinden für eine Mehrfachbindung.':'Diese Elektronen können nicht verbunden werden.');ensureVisible();}
  }else if(t.kind==='atom'){
   if(remove){save();m.removeAtom(t.id,assisted);selected=null;moving=null;status('Atom entfernt. Seine Bindungselektronen sind wieder frei.');}
   else if(moving===t.id){moving=null;status('Atom eingerastet.');}
   else {save();m.rotate(t.id);selected=null;status('Freie Elektronen gedreht.');}
  }else if(t.kind==='bond'){
   if(remove){save();m.removeBond(t.id,assisted);selected=null;status('Eine Elektronenpaarbindung gelöst.');}else status('Zum Lösen einer Bindung zuerst „Entfernen“ aktivieren.');
  }else if(palette){save();m.add(palette,p.x,p.y);status(`${names[palette]} eingefügt. Das Element bleibt zum weiteren Einfügen ausgewählt.`);}
  else {selected=null;moving=null;status('Element auswählen oder zwei freie Elektronen verbinden.');}
  render();
 }
 svg.addEventListener('pointerdown',e=>{if(gesture||e.button!==0)return;e.preventDefault();const t=target(e),p=point(e);gesture={pointer:e.pointerId,t,p,startX:e.clientX,startY:e.clientY,drag:false,long:false,saved:false};if(t.kind==='atom'&&!remove){gesture.offset={x:m.atom(t.id).x-p.x,y:m.atom(t.id).y-p.y};gesture.timer=setTimeout(()=>{if(!gesture)return;gesture.long=true;moving=t.id;status('Bewegungsmodus: Atom ziehen, danach zum Einrasten antippen.');render();},450);}svg.setPointerCapture(e.pointerId);});
 svg.addEventListener('pointermove',e=>{const g=gesture;if(!g||g.pointer!==e.pointerId)return;const distance=Math.hypot(e.clientX-g.startX,e.clientY-g.startY);if(distance>7){clearTimeout(g.timer);g.drag=true;}if(g.drag&&g.t.kind==='atom'&&moving===g.t.id&&!remove){if(!g.saved){save();g.saved=true;}const p=point(e),a=m.atom(g.t.id);a.x=p.x+g.offset.x;a.y=p.y+g.offset.y;render();}});
 svg.addEventListener('pointerup',e=>{const g=gesture;if(!g||g.pointer!==e.pointerId)return;clearTimeout(g.timer);gesture=null;if(g.saved){status('Position geändert. Zum Einrasten das Atom antippen.');ensureVisible();}else if(!g.long&&!g.drag)activate(g.t,point(e));else if(g.drag&&!g.long)status('Zum Bewegen das Atom zunächst kurz gedrückt halten.');});
 svg.addEventListener('pointercancel',()=>{if(gesture)clearTimeout(gesture.timer);gesture=null;});
 svg.addEventListener('contextmenu',e=>e.preventDefault());
 svg.addEventListener('keydown',e=>{const t=target(e);if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(t,{x:view.x+view.w/2,y:view.y+view.h/2});}else if(t.kind==='atom'&&e.key.startsWith('Arrow')){e.preventDefault();save();const a=m.atom(t.id);a.x+=e.key==='ArrowRight'?10:e.key==='ArrowLeft'?-10:0;a.y+=e.key==='ArrowDown'?10:e.key==='ArrowUp'?-10:0;render();svg.querySelector(`[data-atom="${a.id}"]`)?.focus();}else if(e.key==='Escape'){selected=null;moving=null;palette=null;remove=false;render();}});
 for(const symbol of Object.keys(Lewis.ELEMENTS)){
  const button=document.createElement('button');button.dataset.symbol=symbol;button.setAttribute('aria-label',`${names[symbol]} einfügen`);button.innerHTML=`${symbol}<small>${Lewis.ELEMENTS[symbol]} VE</small>`;let drag=null,suppressClick=false;
  button.onpointerdown=e=>{if(e.button!==0)return;button.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,ghost:null};};
  button.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;if(!drag.ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8){drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';drag.ghost.textContent=symbol;document.body.append(drag.ghost);}if(drag.ghost){drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';}};
  button.onpointerup=e=>{if(!drag)return;const moved=!!drag.ghost;suppressClick=moved;drag.ghost?.remove();drag=null;if(moved){const r=svg.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){save();const p=point(e);m.add(symbol,p.x,p.y);palette=null;remove=false;status(`${names[symbol]} eingefügt.`);render();}}};
  button.onpointercancel=()=>{drag?.ghost?.remove();drag=null;};
  button.onclick=e=>{if(suppressClick&&e.detail){suppressClick=false;return;}palette=palette===symbol?null:symbol;remove=false;selected=null;status(palette?`${names[symbol]}: auf die gewünschte Stelle tippen.`:'Element abgewählt.');render();};
  button.oncontextmenu=e=>e.preventDefault();el('palette').append(button);
 }
 el('structure-start').onclick=()=>{el('menu').hidden=true;el('structure').hidden=false;if(!m.atoms.length)fit();else render();el('structure-back').focus();};
 el('structure-back').onclick=()=>{el('structure').hidden=true;el('menu').hidden=false;el('structure-start').focus();};
 el('assisted').onchange=e=>{assisted=e.target.checked;el('mode-label').textContent=assisted?'Unterstützt':'Frei';if(assisted){save();m.layoutAll();fit();}status(assisted?'Unterstützt: Bindungen werden automatisch ausgerichtet.':'Frei: Atome bleiben an ihren Positionen.');};
 el('delete-mode').onclick=()=>{remove=!remove;palette=null;selected=null;moving=null;status(remove?'Atom oder Bindung zum Entfernen antippen.':'Entfernen beendet.');render();};
 el('undo').onclick=()=>{if(history.length){m.restore(history.pop());selected=null;moving=null;render();status('Letzte Änderung rückgängig gemacht.');}};
 el('clear-drawing').onclick=()=>{if(!m.atoms.length)return;save();m.atoms=[];m.bonds=[];selected=null;moving=null;fit();status('Fläche geleert. „Zurück“ stellt die Zeichnung wieder her.');};
 el('fit').onclick=fit;
 render();
})();
