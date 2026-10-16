/* Fictional polygon flight parkour, SI coordinates. Pure deterministic state machine.
 * Gate crossing is swept-segment tested, independent from graphics/frame rate.
 */
(function(root,factory){
  const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FlightCourse=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const PATH=Object.freeze([
  ['ring',0,0],['slalom',-16,-1],['ring',20,0],['gate',0,0],
  ['slalom',15,1],['ring',-18,0],['slalom',-16,-1],['gate',6,0],['ring',0,0]
]);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function create(rotor=false){
  const spacing=rotor?125:390,alt=rotor?62:175,radius=rotor?15:38;
  const objects=PATH.map(([type,offset,side],i)=>({
    id:i+1,type,x:offset*(rotor?.5:1),y:(i+1)*spacing,
    z:alt+(i%3-1)*(rotor?7:18),side,
    radius, halfWidth:rotor?16:43,height:rotor?80:220,
    result:'PENDING'
  }));
  return {active:true,finished:false,index:0,score:0,passed:0,missed:0,
    collisions:0,startedAt:0,finishedAt:null,rotor,objects,message:'PARKUR BAŞLADI'};
}
// Crossing plane y=gate.y from the approach side. Interpolation avoids tunnelling.
function crossing(previous,current,y){
  if(previous.y>=y||current.y<y)return null;
  const d=current.y-previous.y;if(d<=0)return null;
  const t=(y-previous.y)/d;
  return {x:previous.x+(current.x-previous.x)*t,
    y,z:previous.z+(current.z-previous.z)*t,t};
}
function judge(gate,cross,clearance){
  const dx=cross.x-gate.x,dz=cross.z-gate.z;
  if(gate.type==='ring'){
    const d=Math.hypot(dx,dz);
    if(d<=gate.radius-clearance)return {ok:true,text:'HALKA',collision:false};
    return {ok:false,text:'HALKA KAÇIRILDI',collision:Math.abs(d-gate.radius)<=clearance+1};
  }
  if(gate.type==='gate'){
    const near=Math.abs(dx);
    const collision=Math.abs(near-gate.halfWidth)<clearance+1&&cross.z<gate.height;
    return {ok:near<gate.halfWidth-clearance&&cross.z>=4&&cross.z<gate.height,
      text:'İKİ DİREK ARASI',collision};
  }
  const near=Math.abs(dx);
  const sideOK=gate.side<0?dx<-clearance-3:dx>clearance+3;
  return {ok:sideOK&&near<gate.halfWidth*1.7&&cross.z>4&&cross.z<gate.height,
    text:gate.side<0?'DİREĞİN SOLU':'DİREĞİN SAĞI',collision:near<clearance+2&&cross.z<gate.height};
}
function tick(state,previous,current,clearance,now){
  if(!state||!state.active||state.finished)return [];
  const events=[];
  // Loop supports crossing more than one checkpoint in one long integration step.
  for(let i=state.index;i<state.objects.length;i++){
    const gate=state.objects[i],hit=crossing(previous,current,gate.y);
    if(!hit)break;
    const result=judge(gate,hit,clearance);
    gate.result=result.ok?'PASS':'MISS';
    if(result.ok){state.passed++;state.score+=gate.type==='ring'?150:100;}
    else{state.missed++;state.score=Math.max(0,state.score-40);}
    if(result.collision){state.collisions++;state.score=Math.max(0,state.score-30);}
    events.push({id:gate.id,type:gate.type,ok:result.ok,collision:result.collision,text:result.text});
    state.index=i+1;
  }
  if(state.index===state.objects.length){state.finished=true;state.finishedAt=now;state.active=false;
    events.push({done:true,ok:state.missed===0,text:state.missed?'PARKUR TAMAMLANDI':'TEMİZ UÇUŞ'});
  }
  return events;
}
return Object.freeze({create,crossing,judge,tick});
});
