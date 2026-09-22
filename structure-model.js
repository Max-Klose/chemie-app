/* Independent Lewis model. Each bond owns exactly one single-electron slot per atom. */
(function(root){
 'use strict';
 const TAU=Math.PI*2;
 const ELEMENTS={C:4,H:1,O:6,S:6,N:5,Cl:7,Br:7,P:5};
 function pattern(symbol,turn=0){
  const n=ELEMENTS[symbol];
  if(n===6){const pairs=[[0,1],[1,2],[2,3],[3,0],[3,1],[0,2]][turn%6];return Array.from({length:4},(_,i)=>pairs.includes(i)?2:1);}
  const initial=Array.from({length:4},(_,i)=>i<n?1:0);for(let i=0;i<n-4;i++)initial[i]=2;
  return Array.from({length:4},(_,i)=>initial[(i-turn%4+4)%4]);
 }
 class Model{
  constructor(){this.atoms=[];this.bonds=[];this.nextId=1;}
  atom(id){return this.atoms.find(a=>a.id===id);}
  add(symbol,x,y){if(!(symbol in ELEMENTS))throw Error('Unknown element');const a={id:this.nextId++,symbol,x,y,turn:0,slots:pattern(symbol),angles:[-Math.PI/2,0,Math.PI/2,Math.PI],phase:-Math.PI/2};this.atoms.push(a);return a;}
  edges(id){return this.bonds.filter(b=>b.a===id||b.b===id);}
  used(id,s){return this.bonds.some(b=>b.a===id&&b.sa===s||b.b===id&&b.sb===s);}
  groups(id){const groups=[];for(const b of this.edges(id)){const other=b.a===id?b.b:b.a;let g=groups.find(g=>g.other===other);if(!g){g={other,bonds:[],slots:[]};groups.push(g);}g.bonds.push(b);g.slots.push(b.a===id?b.sa:b.sb);}return groups;}
  rotate(id){const a=this.atom(id);if(!this.edges(id).length){a.turn++;a.slots=pattern(a.symbol,a.turn);a.angles=[-Math.PI/2,0,Math.PI/2,Math.PI];}else{const free=a.slots.map((n,s)=>s).filter(s=>!this.used(id,s));if(free.length>1){const values=free.map(s=>a.slots[s]);free.forEach((s,i)=>a.slots[s]=values[(i-1+free.length)%free.length]);}}}
  component(id,cut=null){const seen=new Set([id]),queue=[id];for(const current of queue)for(const g of this.groups(current))if(!(cut&&((current===cut[0]&&g.other===cut[1])||(current===cut[1]&&g.other===cut[0])))&&!seen.has(g.other)){seen.add(g.other);queue.push(g.other);}return seen;}
  connect(a,sa,b,sb,assisted){if(a===b||!this.atom(a)||!this.atom(b)||this.used(a,sa)||this.used(b,sb)||this.atom(a).slots[sa]!==1||this.atom(b).slots[sb]!==1)return false;
   if(this.groups(a).find(g=>g.other===b)?.bonds.length>=3)return false;
   const cut=[a,b],ca=this.component(a,cut),cb=this.component(b,cut);const anchor=ca.size>=cb.size?a:b,slot=anchor===a?sa:sb;
   const fixed=this.atom(anchor);fixed.phase=fixed.angles[slot];
   const existing=new Set(this.bonds.map(edge=>edge.id));
   this.bonds.push({id:this.nextId++,a,sa,b,sb});if(assisted)this.layout(anchor,existing);else {this.orient(a);this.orient(b);}return true;
  }
  removeAtom(id,assisted){this.bonds=this.bonds.filter(b=>b.a!==id&&b.b!==id);this.atoms=this.atoms.filter(a=>a.id!==id);this.atoms.forEach(a=>this.orient(a.id));if(assisted)this.layoutAll();}
  removeBond(id,assisted){this.bonds=this.bonds.filter(b=>b.id!==id);this.atoms.forEach(a=>this.orient(a.id));if(assisted)this.layoutAll();}
  domains(id){const a=this.atom(id),d=this.groups(id).map(g=>({...g,slot:Math.min(...g.slots)}));a.slots.forEach((n,s)=>{if(n&&!this.used(id,s))d.push({slot:s,slots:[s]});});return d.sort((x,y)=>x.slot-y.slot);}
  orient(id){const a=this.atom(id),groups=this.groups(id);if(!groups.length){a.angles=[-Math.PI/2,0,Math.PI/2,Math.PI];return;}const domains=this.domains(id),count=4-groups.reduce((sum,g)=>sum+g.bonds.length-1,0),lead=groups.reduce((x,y)=>x.bonds.length>=y.bonds.length?x:y),other=this.atom(lead.other),idx=domains.findIndex(d=>d.other===other.id),start=Math.atan2(other.y-a.y,other.x-a.x)-idx*TAU/count;domains.forEach((d,i)=>d.slots.forEach(s=>a.angles[s]=start+i*TAU/count));}
  length(a,b,branched){return a.symbol==='C'&&b.symbol==='C'&&branched?112:64;}
  layout(rootId,existing=new Set(this.bonds.map(edge=>edge.id))){
   const root=this.atom(rootId);if(!root)return;const component=this.component(rootId);
   const branched=[...component].some(id=>this.atom(id).symbol==='C'&&this.groups(id).filter(g=>this.atom(g.other).symbol==='C').length>=3);
   const old=new Map(this.atoms.map(a=>[a.id,{x:a.x,y:a.y,angles:[...a.angles]}]));
   const seen=new Set([rootId]),queue=[{id:rootId,parent:null,back:0}];
   for(const item of queue){const a=this.atom(item.id),domains=this.domains(a.id),count=4-this.groups(a.id).reduce((sum,g)=>sum+g.bonds.length-1,0);if(!domains.length)continue;const parentIndex=domains.findIndex(d=>d.other===item.parent);let start=a.phase;
    if(parentIndex>=0)start=item.back-parentIndex*TAU/count;
    else {
     // Preserve the direction toward the largest established branch. Slot indices
     // can change when two singles merge; actual bond directions must not.
     const candidates=domains.map((d,i)=>({d,i,size:d.other&&d.bonds.some(b=>existing.has(b.id))?this.component(d.other,[a.id,d.other]).size:0})).filter(c=>c.size>0).sort((x,y)=>y.size-x.size||x.d.bonds[0].id-y.d.bonds[0].id);
     if(candidates.length){const {d,i}=candidates[0],oa=old.get(a.id),ob=old.get(d.other);start=Math.atan2(ob.y-oa.y,ob.x-oa.x)-i*TAU/count;}
     else {const prior=domains.findIndex(d=>d.other);if(prior>=0)start=old.get(a.id).angles[domains[prior].slot]-prior*TAU/count;}
    }
    // Four, three and two electron groups yield 90°, 120° and 180°.
    domains.forEach((d,i)=>{const angle=start+i*TAU/count;d.slots.forEach(s=>a.angles[s]=angle);if(d.other&&!seen.has(d.other)){const b=this.atom(d.other),len=this.length(a,b,branched);b.x=a.x+Math.cos(angle)*len;b.y=a.y+Math.sin(angle)*len;seen.add(b.id);queue.push({id:b.id,parent:a.id,back:angle+Math.PI});}});
   }
  }
  layoutAll(){const seen=new Set();for(const a of this.atoms)if(!seen.has(a.id)){const component=this.component(a.id);component.forEach(id=>seen.add(id));if(component.size>1)this.layout(a.id);}}
  selection(ids){const chosen=new Set([...ids].filter(id=>this.atom(id)));if(!chosen.size)return {error:'Zuerst einen Molekülteil auswählen.'};const first=[...chosen][0],seen=new Set([first]),queue=[first];for(const id of queue)for(const g of this.groups(id))if(chosen.has(g.other)&&!seen.has(g.other)){seen.add(g.other);queue.push(g.other);}if(seen.size!==chosen.size)return {error:'Bitte einen zusammenhängenden Molekülteil auswählen.'};const boundary=new Set();for(const id of chosen)for(const g of this.groups(id))if(!chosen.has(g.other))boundary.add(g.other);if(boundary.size>1)return {error:'Dieser Teil ist an mehreren Stellen befestigt. Bitte die Auswahl bis zu einer einzigen Anschlussstelle erweitern oder das ganze Molekül auswählen.'};let pivot;if(boundary.size)pivot=this.atom([...boundary][0]);else{const atoms=[...chosen].map(id=>this.atom(id));pivot={x:atoms.reduce((n,a)=>n+a.x,0)/atoms.length,y:atoms.reduce((n,a)=>n+a.y,0)/atoms.length};}return {ids:chosen,pivot:{x:pivot.x,y:pivot.y}};}
  rotatePart(ids,radians){const selection=this.selection(ids);if(selection.error)return selection;const {pivot}=selection,c=Math.cos(radians),s=Math.sin(radians);for(const id of selection.ids){const a=this.atom(id),x=a.x-pivot.x,y=a.y-pivot.y;a.x=pivot.x+x*c-y*s;a.y=pivot.y+x*s+y*c;a.angles=a.angles.map(angle=>angle+radians);a.phase+=radians;}return selection;}
  snapshot(){return JSON.stringify({atoms:this.atoms,bonds:this.bonds,nextId:this.nextId});}
  restore(s){Object.assign(this,JSON.parse(s));}
 }
 const api={Model,pattern,ELEMENTS};if(typeof module!=='undefined')module.exports=api;else root.Lewis=api;
})(globalThis);
