/* Independent Lewis model. Each bond owns exactly one single-electron slot per atom. */
(function(root){
 'use strict';
 const TAU=Math.PI*2;
 const ELEMENTS={C:4,H:1,O:6,S:6,N:5,Cl:7,B:3,P:5};
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
  component(id){const seen=new Set([id]),queue=[id];for(const current of queue)for(const g of this.groups(current))if(!seen.has(g.other)){seen.add(g.other);queue.push(g.other);}return seen;}
  connect(a,sa,b,sb,assisted){if(a===b||!this.atom(a)||!this.atom(b)||this.used(a,sa)||this.used(b,sb)||this.atom(a).slots[sa]!==1||this.atom(b).slots[sb]!==1)return false;
   if(this.groups(a).find(g=>g.other===b)?.bonds.length>=3)return false;
   const ca=this.component(a),cb=this.component(b);const anchor=ca.size>=cb.size?a:b,slot=anchor===a?sa:sb;
   const fixed=this.atom(anchor);fixed.phase=fixed.angles[slot];
   this.bonds.push({id:this.nextId++,a,sa,b,sb});if(assisted)this.layout(anchor);else {this.orient(a);this.orient(b);}return true;
  }
  removeAtom(id,assisted){this.bonds=this.bonds.filter(b=>b.a!==id&&b.b!==id);this.atoms=this.atoms.filter(a=>a.id!==id);this.atoms.forEach(a=>this.orient(a.id));if(assisted)this.layoutAll();}
  removeBond(id,assisted){this.bonds=this.bonds.filter(b=>b.id!==id);this.atoms.forEach(a=>this.orient(a.id));if(assisted)this.layoutAll();}
  domains(id){const a=this.atom(id),d=this.groups(id).map(g=>({...g,slot:Math.min(...g.slots)}));a.slots.forEach((n,s)=>{if(n&&!this.used(id,s))d.push({slot:s,slots:[s]});});return d.sort((x,y)=>x.slot-y.slot);}
  orient(id){const a=this.atom(id),groups=this.groups(id);if(!groups.length){a.angles=[-Math.PI/2,0,Math.PI/2,Math.PI];return;}const domains=this.domains(id),count=4-groups.reduce((sum,g)=>sum+g.bonds.length-1,0),lead=groups.reduce((x,y)=>x.bonds.length>=y.bonds.length?x:y),other=this.atom(lead.other),idx=domains.findIndex(d=>d.other===other.id),start=Math.atan2(other.y-a.y,other.x-a.x)-idx*TAU/count;domains.forEach((d,i)=>d.slots.forEach(s=>a.angles[s]=start+i*TAU/count));}
  length(a,b,branched){return a.symbol==='C'&&b.symbol==='C'&&branched?112:64;}
  layout(rootId){
   const root=this.atom(rootId);if(!root)return;const component=this.component(rootId);
   const branched=[...component].some(id=>this.atom(id).symbol==='C'&&this.groups(id).filter(g=>this.atom(g.other).symbol==='C').length>=3);
   const seen=new Set([rootId]),queue=[{id:rootId,parent:null,back:0}];
   for(const item of queue){const a=this.atom(item.id),domains=this.domains(a.id),count=4-this.groups(a.id).reduce((sum,g)=>sum+g.bonds.length-1,0);if(!domains.length)continue;const parentIndex=domains.findIndex(d=>d.other===item.parent);let start=a.phase;
    if(parentIndex>=0)start=item.back-parentIndex*TAU/count;
    else {const prior=domains.findIndex(d=>d.other);if(prior>=0)start=a.angles[domains[prior].slot]-prior*TAU/count;}
    // Four, three and two electron groups yield 90°, 120° and 180°.
    domains.forEach((d,i)=>{const angle=start+i*TAU/count;d.slots.forEach(s=>a.angles[s]=angle);if(d.other&&!seen.has(d.other)){const b=this.atom(d.other),len=this.length(a,b,branched);b.x=a.x+Math.cos(angle)*len;b.y=a.y+Math.sin(angle)*len;seen.add(b.id);queue.push({id:b.id,parent:a.id,back:angle+Math.PI});}});
   }
  }
  layoutAll(){const seen=new Set();for(const a of this.atoms)if(!seen.has(a.id)){const component=this.component(a.id);component.forEach(id=>seen.add(id));if(component.size>1)this.layout(a.id);}}
  snapshot(){return JSON.stringify({atoms:this.atoms,bonds:this.bonds,nextId:this.nextId});}
  restore(s){Object.assign(this,JSON.parse(s));}
 }
 const api={Model,pattern,ELEMENTS};if(typeof module!=='undefined')module.exports=api;else root.Lewis=api;
})(globalThis);
