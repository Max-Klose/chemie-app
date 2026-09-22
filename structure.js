(function(){
 'use strict';
 const el=id=>document.getElementById(id),m=new Lewis.Model(),svg=el('drawing'),field=svg.parentElement;
 let assisted=false,selected=null,palette=null,remove=false,moving=null,gesture=null,history=[],view={x:0,y:0,w:1100,h:680};
 const names={C:'Kohlenstoff',H:'Wasserstoff',O:'Sauerstoff',S:'Schwefel',N:'Stickstoff',Cl:'Chlor',Br:'Brom',P:'Phosphor'};
 let selecting=false,chosen=new Set(),selectionBox=null,rotationBase=null,rotationLast=0,pinch=null;
 const pointers=new Map();
 function save(){history.push(m.snapshot());if(history.length>80)history.shift();el('undo').disabled=false;}
 function status(text){el('drawing-status').textContent=text;}
 function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
 function camera(){svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);const scale=svg.getScreenCTM()?.a||1;field.style.backgroundSize=`${22*scale}px ${22*scale}px`;field.style.backgroundPosition=`${-view.x*scale}px ${-view.y*scale}px`;}
 function zoom(factor,center=null){const p=center?point(center):{x:view.x+view.w/2,y:view.y+view.h/2},width=Math.max(140,Math.min(12000,view.w/factor)),scale=width/view.w;view={x:p.x+(view.x-p.x)*scale,y:p.y+(view.y-p.y)*scale,w:width,h:view.h*scale};camera();}
 function clearSelection(){chosen.clear();rotationBase=null;rotationLast=0;el('rotate-range').value=0;el('rotation-value').textContent='0°';}
 function choose(ids){clearSelection();chosen=new Set(ids);const s=m.selection(chosen);status(s.error||`${chosen.size} ${chosen.size===1?'Atom':'Atome'} ausgewählt. Mit Regler oder Pfeilen drehen.`);render();}
 function rotateSelection(radians){const s=m.selection(chosen);if(s.error){status(s.error);return;}save();m.rotatePart(chosen,radians);rotationBase=null;el('rotate-range').value=0;el('rotation-value').textContent='0°';status('Auswahl gedreht. Bindungslängen innerhalb der Auswahl bleiben erhalten.');render();}
 function line(x1,y1,x2,y2,cls,extra=''){return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" ${extra}/>`;}
 function fit(){const rect=svg.getBoundingClientRect(),ratio=(rect.width||1100)/(rect.height||680);if(!m.atoms.length){view={x:0,y:0,w:rect.width||1100,h:rect.height||680};}else{const xs=m.atoms.map(a=>a.x),ys=m.atoms.map(a=>a.y);let w=Math.max(500,Math.max(...xs)-Math.min(...xs)+180),h=Math.max(340,Math.max(...ys)-Math.min(...ys)+180);if(w/h<ratio)w=h*ratio;else h=w/ratio;view={x:(Math.min(...xs)+Math.max(...xs)-w)/2,y:(Math.min(...ys)+Math.max(...ys)-h)/2,w,h};}render();}
 function ensureVisible(){if(m.atoms.some(a=>a.x<view.x+45||a.x>view.x+view.w-45||a.y<view.y+45||a.y>view.y+view.h-45))fit();}
 function render(){
  camera();let html='';const handled=new Set();
  for(const id of chosen){const a=m.atom(id);if(a)html+=`<circle cx="${a.x}" cy="${a.y}" r="42" class="selection-halo"/>`;}
  for(const bond of m.bonds){const key=[bond.a,bond.b].sort((a,b)=>a-b).join(':');if(handled.has(key))continue;handled.add(key);const a=m.atom(bond.a),b=m.atom(bond.b),bonds=m.bonds.filter(e=>e.a===a.id&&e.b===b.id||e.a===b.id&&e.b===a.id),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,pad=Math.min(20,len/3);
   bonds.forEach((edge,i)=>{const offset=(i-(bonds.length-1)/2)*8,x1=a.x+ux*pad-uy*offset,y1=a.y+uy*pad+ux*offset,x2=b.x-ux*pad-uy*offset,y2=b.y-uy*pad+ux*offset;html+=`<g data-bond="${edge.id}" tabindex="0" role="button" aria-label="${a.symbol}–${b.symbol}, Bindung lösen">${line(x1,y1,x2,y2,'bond-hit')}${line(x1,y1,x2,y2,'bond-line')}</g>`;});
  }
  for(const a of m.atoms){html+=`<g class="lewis-atom" data-atom="${a.id}" data-symbol="${a.symbol}" tabindex="0" role="button" aria-label="${names[a.symbol]}, antippen zum Drehen, halten zum Bewegen"><circle cx="${a.x}" cy="${a.y}" r="21" fill="${moving===a.id?'#d9f2f7':'#fcfdff'}" stroke="${moving===a.id?'#1588a2':'none'}" stroke-width="2" stroke-dasharray="4 3"/><text x="${a.x}" y="${a.y+9}" text-anchor="middle">${a.symbol}</text></g>`;
   a.slots.forEach((n,s)=>{if(!n||m.used(a.id,s))return;const angle=a.angles[s],x=a.x+Math.cos(angle)*32,y=a.y+Math.sin(angle)*32;if(n===1){const active=selected?.id===a.id&&selected.slot===s;html+=`<g class="electron-hit" data-electron="${a.id}:${s}" tabindex="0" role="button" aria-label="Einzelnes Elektron an ${names[a.symbol]}"><circle cx="${x}" cy="${y}" r="12" class="${active?'selected-electron':''}" fill="transparent"/><circle cx="${x}" cy="${y}" r="3.5" class="electron-dot"/></g>`;}else html+=line(x-Math.sin(angle)*12,y+Math.cos(angle)*12,x+Math.sin(angle)*12,y-Math.cos(angle)*12,'pair-line');});
  }
  if(selectionBox){const {a,b}=selectionBox;html+=`<rect x="${Math.min(a.x,b.x)}" y="${Math.min(a.y,b.y)}" width="${Math.abs(a.x-b.x)}" height="${Math.abs(a.y-b.y)}" class="selection-box"/>`;}
  const selection=m.selection(chosen);if(!selection.error){const {x,y}=selection.pivot;html+=line(x-7,y,x+7,y,'rotation-pivot')+line(x,y-7,x,y+7,'rotation-pivot');}
  svg.innerHTML=html;el('drawing-empty').hidden=m.atoms.length>0;el('undo').disabled=!history.length;el('delete-mode').setAttribute('aria-pressed',String(remove));el('select-mode').setAttribute('aria-pressed',String(selecting));el('selection-tools').hidden=!selecting;el('selection-count').textContent=chosen.size?`${chosen.size} ${chosen.size===1?'Atom':'Atome'}`:'Rahmen ziehen oder Molekül antippen';['rotate-left','rotate-right','rotate-range'].forEach(id=>el(id).disabled=!!selection.error);el('palette').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.symbol===palette));
 }
 function target(e){const electron=e.target.closest('[data-electron]'),atom=e.target.closest('[data-atom]'),bond=e.target.closest('[data-bond]');if(electron){const [id,slot]=electron.dataset.electron.split(':').map(Number);return {kind:'electron',id,slot};}if(atom)return {kind:'atom',id:Number(atom.dataset.atom)};if(bond)return {kind:'bond',id:Number(bond.dataset.bond)};return {kind:'field'};}
 function activate(t,p){
  if(selecting){if(t.kind==='atom'||t.kind==='electron')choose(m.component(t.id));else if(t.kind==='bond')choose(m.component(m.bonds.find(b=>b.id===t.id).a));else choose([]);return;}
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
 function twoFingerState(){const [a,b]=[...pointers.values()];return {distance:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)),center:{clientX:(a.clientX+b.clientX)/2,clientY:(a.clientY+b.clientY)/2}};}
 // Keep native Safari scrolling/viewport zoom out of the drawing surface.
 // These listeners do not synthesize gestures; Pointer Events handle the model.
 function preventNative(e){if(e.cancelable)e.preventDefault();}
 field.addEventListener('touchmove',preventNative,{passive:false});
 ['gesturestart','gesturechange','gestureend'].forEach(type=>field.addEventListener(type,preventNative,{passive:false}));
 svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();pointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});svg.setPointerCapture(e.pointerId);if(pointers.size>=2){if(gesture)clearTimeout(gesture.timer);gesture=null;selectionBox=null;pinch=twoFingerState();svg.querySelector('.selection-box')?.remove();return;}const t=target(e),p=point(e);gesture={pointer:e.pointerId,t,p,startX:e.clientX,startY:e.clientY,drag:false,long:false,saved:false,camera:{...view},scale:svg.getScreenCTM().a};if(t.kind==='atom'&&!remove&&!selecting){gesture.offset={x:m.atom(t.id).x-p.x,y:m.atom(t.id).y-p.y};gesture.timer=setTimeout(()=>{if(!gesture)return;gesture.long=true;moving=t.id;status('Bewegungsmodus: Atom ziehen, danach zum Einrasten antippen.');render();},450);}});
 svg.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;preventNative(e);pointers.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
  if(pinch&&pointers.size>=2){const next=twoFingerState(),before=point(pinch.center),after=point(next.center);view.x+=before.x-after.x;view.y+=before.y-after.y;svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);zoom(next.distance/pinch.distance,next.center);pinch=next;return;}
  const g=gesture;if(!g||g.pointer!==e.pointerId)return;const distance=Math.hypot(e.clientX-g.startX,e.clientY-g.startY);if(distance>7){clearTimeout(g.timer);g.drag=true;}
  if(g.drag&&selecting){selectionBox={a:g.p,b:point(e)};render();}
  else if(g.drag&&!(g.t.kind==='atom'&&moving===g.t.id&&!remove)){view.x=g.camera.x-(e.clientX-g.startX)/g.scale;view.y=g.camera.y-(e.clientY-g.startY)/g.scale;camera();}
  else if(g.drag&&g.t.kind==='atom'&&moving===g.t.id&&!remove){if(!g.saved){save();g.saved=true;}const p=point(e),a=m.atom(g.t.id);a.x=p.x+g.offset.x;a.y=p.y+g.offset.y;render();}
 });
 svg.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(pinch){if(pointers.size<2)pinch=null;gesture=null;return;}const g=gesture;if(!g||g.pointer!==e.pointerId)return;clearTimeout(g.timer);gesture=null;
  if(selectionBox){const {a,b}=selectionBox;selectionBox=null;choose(m.atoms.filter(atom=>atom.x>=Math.min(a.x,b.x)&&atom.x<=Math.max(a.x,b.x)&&atom.y>=Math.min(a.y,b.y)&&atom.y<=Math.max(a.y,b.y)).map(a=>a.id));}
  else if(g.saved){status('Position geändert. Zum Einrasten das Atom antippen.');}
  else if(!g.long&&!g.drag)activate(g.t,point(e));else if(g.drag&&!g.long&&g.t.kind==='atom')status('Zum Bewegen das Atom zunächst kurz gedrückt halten.');
 });
 function cancelGestures(){pointers.clear();if(gesture)clearTimeout(gesture.timer);gesture=null;pinch=null;selectionBox=null;}
 svg.addEventListener('pointercancel',()=>{cancelGestures();render();});
 svg.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId)){cancelGestures();render();}});
 window.addEventListener('blur',cancelGestures);
 svg.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.002),e);},{passive:false});
 svg.addEventListener('contextmenu',e=>e.preventDefault());
 svg.addEventListener('keydown',e=>{const t=target(e);if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(t,{x:view.x+view.w/2,y:view.y+view.h/2});}else if(t.kind==='atom'&&e.key.startsWith('Arrow')){e.preventDefault();save();const a=m.atom(t.id);a.x+=e.key==='ArrowRight'?10:e.key==='ArrowLeft'?-10:0;a.y+=e.key==='ArrowDown'?10:e.key==='ArrowUp'?-10:0;render();svg.querySelector(`[data-atom="${a.id}"]`)?.focus();}else if(e.key==='Escape'){selected=null;moving=null;palette=null;remove=false;selecting=false;clearSelection();render();}});
 for(const symbol of Object.keys(Lewis.ELEMENTS)){
  const button=document.createElement('button');button.dataset.symbol=symbol;button.setAttribute('aria-label',`${names[symbol]} einfügen`);button.textContent=symbol;let drag=null,suppressClick=false;
  button.onpointerdown=e=>{if(e.button!==0)return;selecting=false;clearSelection();button.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,ghost:null};};
  button.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;if(!drag.ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8){drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';drag.ghost.textContent=symbol;document.body.append(drag.ghost);}if(drag.ghost){drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';}};
  button.onpointerup=e=>{if(!drag)return;const moved=!!drag.ghost;suppressClick=moved;drag.ghost?.remove();drag=null;if(moved){const r=svg.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){save();const p=point(e);m.add(symbol,p.x,p.y);palette=null;remove=false;status(`${names[symbol]} eingefügt.`);render();}}};
  button.onpointercancel=()=>{drag?.ghost?.remove();drag=null;};
  button.onclick=e=>{if(suppressClick&&e.detail){suppressClick=false;return;}selecting=false;clearSelection();palette=palette===symbol?null:symbol;remove=false;selected=null;status(palette?`${names[symbol]}: auf die gewünschte Stelle tippen.`:'Element abgewählt.');render();};
  button.oncontextmenu=e=>e.preventDefault();el('palette').append(button);
 }
 el('structure-start').onclick=()=>{document.documentElement.classList.add('drawing-active');el('menu').hidden=true;el('structure').hidden=false;if(!m.atoms.length)fit();else render();el('structure-back').focus({preventScroll:true});};
 el('structure-back').onclick=()=>{cancelGestures();el('structure').hidden=true;document.documentElement.classList.remove('drawing-active');el('menu').hidden=false;el('structure-start').focus({preventScroll:true});};
 el('assisted').checked=false;
 el('assisted').onchange=e=>{assisted=e.target.checked;clearSelection();el('mode-label').textContent=assisted?'Unterstützt':'Frei';if(assisted){save();m.layoutAll();fit();}status(assisted?'Unterstützt: Bindungen werden automatisch ausgerichtet.':'Frei: Atome bleiben an ihren Positionen.');render();};
 el('delete-mode').onclick=()=>{remove=!remove;palette=null;selected=null;moving=null;selecting=false;clearSelection();status(remove?'Atom oder Bindung zum Entfernen antippen.':'Entfernen beendet.');render();};
 el('undo').onclick=()=>{if(history.length){m.restore(history.pop());selected=null;moving=null;clearSelection();render();status('Letzte Änderung rückgängig gemacht.');}};
 el('clear-drawing').onclick=()=>{if(!m.atoms.length)return;save();m.atoms=[];m.bonds=[];selected=null;moving=null;clearSelection();fit();status('Fläche geleert. „Zurück“ stellt die Zeichnung wieder her.');};
 el('fit').onclick=fit;
 el('zoom-in').onclick=()=>zoom(1.25);el('zoom-out').onclick=()=>zoom(.8);
 el('select-mode').onclick=()=>{selecting=!selecting;clearSelection();palette=null;selected=null;moving=null;remove=false;status(selecting?'Rahmen um einen verbundenen Teil ziehen oder ein Atom für das ganze Molekül antippen.':'Auswahl beendet.');render();};
 el('selection-clear').onclick=()=>{selecting=false;clearSelection();render();status('Auswahl beendet.');};
 el('rotate-left').onclick=()=>rotateSelection(-Math.PI/12);el('rotate-right').onclick=()=>rotateSelection(Math.PI/12);
 el('rotate-range').oninput=e=>{if(!rotationBase){const s=m.selection(chosen);if(s.error){status(s.error);return;}save();rotationBase=m.snapshot();rotationLast=0;}const value=Number(e.target.value);m.rotatePart(chosen,(value-rotationLast)*Math.PI/180);rotationLast=value;el('rotation-value').textContent=`${value}°`;render();};
 el('rotate-range').onchange=()=>{rotationBase=null;rotationLast=0;el('rotate-range').value=0;el('rotation-value').textContent='0°';};
 // Preserve zoom and centre when toolbars, rotation or the Safari bars resize the canvas.
 let lastSize=null;
 new ResizeObserver(()=>{const rect=svg.getBoundingClientRect();if(!rect.width||!rect.height)return;const centre={x:view.x+view.w/2,y:view.y+view.h/2},units=lastSize?view.w/lastSize.width:Math.max(view.w/rect.width,view.h/rect.height);view.w=rect.width*units;view.h=rect.height*units;view.x=centre.x-view.w/2;view.y=centre.y-view.h/2;lastSize={width:rect.width,height:rect.height};cancelGestures();camera();}).observe(svg);
 render();
})();


