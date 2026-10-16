'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../air-refueling.js');
const M=require('../tanker-mesh.js');
const sample={x:0,y:0,z:2200,vx:0,vy:110,vz:0,heading:0,bank:0,fuel:40};
function positionReceiver(m,s){
 const t=m.tanker,h=t.heading;
 s.x=t.x+Math.sin(h)*R.CONTACT.aft+Math.cos(h)*R.CONTACT.lateral;
 s.y=t.y+Math.cos(h)*R.CONTACT.aft-Math.sin(h)*R.CONTACT.lateral;
 s.z=t.z+R.CONTACT.below;s.vx=t.vx;s.vy=t.vy;s.vz=t.vz;
}
test('low-poly KC-135 has valid bounds, geometry and no textures',()=>{
 assert.ok(M.faces.length>=30);
 assert.equal(M.dimensions.length,41.5);
 assert.equal(M.dimensions.wingspan,39.9);
 for(const f of M.faces){assert.ok(f.ids.length>=3);assert.ok(f.ids.every(id=>id>=0&&id<M.vertices.length));}
 assert.ok(M.vertices.flat().every(Number.isFinite));
 assert.ok(!Object.keys(M).some(k=>/texture|image|materialMap/i.test(k)));
});
test('tanker spawn is ahead, higher and has independent velocity',()=>{
 const m=R.makeMission(sample,{practice:true});
 assert.ok(m.tanker.y>sample.y+400);
 assert.ok(m.tanker.z>sample.z);
 assert.equal(m.tanker.speed,110);
 const before=m.tanker.y;R.tick(m,{...sample},1,300);
 assert.equal(m.tanker.y-before,110);
});
test('no fuel without request or while outside envelope',()=>{
 const m=R.makeMission(sample),s={...sample};positionReceiver(m,s);
 const start=s.fuel;
 for(let i=0;i<100;i++)R.tick(m,s,1/30,300);
 assert.equal(s.fuel,start);assert.equal(m.connected,false);
 m.request=true;s.x+=9;
 for(let i=0;i<100;i++)R.tick(m,s,1/30,300);
 assert.equal(s.fuel,start);assert.equal(m.connected,false);
});
test('connection requires continuous stable hold and matched velocity',()=>{
 const m=R.makeMission(sample),s={...sample};positionReceiver(m,s);
 m.request=true;
 s.vy+=5;
 for(let i=0;i<90;i++){
  const r=R.tick(m,s,1/30,300);s.x+=s.vx/30;s.y+=s.vy/30;s.z+=s.vz/30;
  assert.equal(r.addedL,0);
 }
 assert.equal(m.connected,false);
 positionReceiver(m,s);
 for(let i=0;i<75;i++){
  const r=R.tick(m,s,1/30,300);s.x+=s.vx/30;s.y+=s.vy/30;s.z+=s.vz/30;
  if(i<74)assert.equal(r.addedL,0);
 }
 assert.equal(m.connected,true);
 const prev=s.fuel;
 const result=R.tick(m,s,1/30,300);
 assert.ok(result.addedL>0&&result.addedL<=.401+1e-9);
 assert.ok(s.fuel>prev);
});
test('out-of-envelope disconnect does not grant further fuel',()=>{
 const m=R.makeMission(sample),s={...sample};positionReceiver(m,s);m.request=true;
 for(let i=0;i<80;i++){R.tick(m,s,1/30,300);s.y+=s.vy/30;}
 assert.equal(m.connected,true);
 s.x+=12;
 const before=s.fuel;
 const r=R.tick(m,s,1/30,300);
 assert.equal(r.addedL,0);assert.equal(m.connected,false);
 assert.match(r.event,/DISCONNECT/);assert.equal(s.fuel,before);
});
test('fuel max and tanker supply clamp transfer and mission finishes',()=>{
 const m=R.makeMission(sample),s={...sample,fuel:299};positionReceiver(m,s);m.request=true;
 for(let i=0;i<76;i++){R.tick(m,s,1/30,300);s.y+=s.vy/30;}
 assert.ok(s.fuel<=300&&s.fuel>=299);
 for(let i=0;i<30;i++){R.tick(m,s,1/30,300);s.y+=s.vy/30;}
 assert.equal(s.fuel,300);assert.equal(m.status,'COMPLETE');
 assert.ok(m.reserveL>=0);
});
test('fuel warning bands, endurance and engine-off infinity',()=>{
 assert.equal(R.warning(300,300,.1).severity,'NORMAL');
 assert.equal(R.warning(80,300,0).severity,'LOW');
 assert.equal(R.warning(40,300,0).severity,'BINGO');
 assert.equal(R.warning(15,300,0).severity,'CRITICAL');
 assert.equal(R.warning(0,300,0).severity,'EMPTY');
 assert.equal(R.warning(250,300,3).severity,'BINGO');
 assert.equal(R.warning(250,300,0).seconds,Infinity);
});
test('tanker collision detected and mission terminates',()=>{
 const m=R.makeMission(sample);const s={...sample,x:m.tanker.x,y:m.tanker.y,z:m.tanker.z};
 const out=R.tick(m,s,1/30,300);
 assert.equal(out.event,'TANKER COLLISION');assert.equal(m.active,false);
});
