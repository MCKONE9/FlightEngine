const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../combat-missions.js');
const V=require('../combat-visuals.js');
const F16=()=>({x:0,y:0,z:1.8,vx:0,vy:0,vz:0,heading:0,pitch:0,onGround:true,armed:false});
function align(s,t){const dx=t.x-s.x,dy=t.y-s.y,dz=t.z-s.z;s.heading=Math.atan2(dx,dy);s.pitch=Math.atan2(dz,Math.hypot(dx,dy));}
function lock(m,s){m.lockRequested=true;for(let i=0;i<40;i++)M.tick(m,s,1/30);assert.equal(m.locked,true);}
function hit(m,s,t){align(s,t);m.selectedId=t.id;lock(m,s);const res=M.fire(m,s,m.type);assert.equal(res.ok,true,JSON.stringify(res));
  for(let i=0;i<500&&t.health>0;i++)M.tick(m,s,1/30);}
test('ground sortie has fixed local coordinate targets and return objective',()=>{
 const m=M.createGround();assert.equal(m.phase,'TAKEOFF');assert.equal(m.targets.length,4);
 assert.deepEqual(m.targets.filter(t=>t.required).map(t=>t.kind),['building','radar','vehicle']);
 assert.equal(m.agm,6);assert.equal(m.score,0);
});
test('ground start cannot complete on runway, transitions after takeoff',()=>{
 const m=M.createGround(),s=F16();for(let i=0;i<30;i++)M.tick(m,s,1/30);assert.equal(m.phase,'TAKEOFF');
 s.onGround=false;s.z=400;M.tick(m,s,1/30);assert.equal(m.phase,'STRIKE');
});
test('lock gate enforces explicit radar request, airborne position and boresight',()=>{
 const m=M.createGround(),s=F16(),t=m.targets[0];s.armed=true;align(s,t);
 m.lockRequested=true;M.tick(m,s,1);assert.equal(m.locked,false); // invalid timestep ignored
 for(let i=0;i<60;i++)M.tick(m,s,1/30);assert.equal(m.locked,false);
 s.onGround=false;s.z=500;align(s,t);m.lockRequested=false;
 for(let i=0;i<60;i++)M.tick(m,s,1/30);assert.equal(m.locked,false);
 m.lockRequested=true;s.heading+=Math.PI;
 for(let i=0;i<60;i++)M.tick(m,s,1/30);assert.equal(m.locked,false);
 align(s,t);lock(m,s);
});
test('weapon interlocks: master arm, min altitude, lock, cooldown, wrong type',()=>{
 const m=M.createGround(),s=F16();s.onGround=false;s.z=400;align(s,m.targets[0]);
 assert.match(M.fire(m,s,'ground').reason,/ARM/);s.armed=true;
 assert.match(M.fire(m,s,'ground').reason,/KİLİDİ/);
 lock(m,s);assert.match(M.fire(m,s,'air').reason,/DOGFIGHT/);
 s.z=20;assert.match(M.fire(m,s,'ground').reason,/40 M/);
 s.z=400;align(s,m.targets[0]);assert.equal(M.fire(m,s,'ground').ok,true);
 assert.match(M.fire(m,s,'ground').reason,/HAZIR/);
 assert.equal(m.agm,5);
});
test('AGM hit only tracked designated target, two-hit hangar, then RTB and runway success',()=>{
 const m=M.createGround(),s=F16();s.onGround=false;s.armed=true;s.z=350;s.x=500;s.y=3200;
 M.tick(m,s,1/30);
 let t=m.targets[0];hit(m,s,t);assert.equal(t.health,1);assert.equal(m.phase,'STRIKE');
 for(let i=0;i<50;i++)M.tick(m,s,1/30);
 hit(m,s,t);assert.equal(t.health,0);
 for(const t of m.targets.filter(t=>t.required&&t.health>0)){
   for(let i=0;i<50;i++)M.tick(m,s,1/30);
   hit(m,s,t);assert.equal(t.health,0);
 }
 assert.equal(m.phase,'RTB');assert.ok(m.score>=750);
 s.onGround=true;s.x=200;s.y=0;s.vx=3;s.vy=2;M.tick(m,s,1/30);assert.equal(m.phase,'RTB');
 s.x=0;s.y=400;s.vx=10;s.vy=0;M.tick(m,s,1/30);assert.equal(m.phase,'COMPLETE');
 assert.equal(m.score,1250); // 3 required *150, RTB+300, landing +500
});
test('missiles not launched without true lock; exact expiry kills projectile',()=>{
 const m=M.createGround(),s=F16();s.onGround=false;s.z=500;s.armed=true;align(s,m.targets[0]);lock(m,s);
 const before=m.targets[0].health;assert.equal(M.fire(m,s,'ground').ok,true);
 m.missiles[0].ttl=.01;M.tick(m,s,1/30);
 assert.equal(m.targets[0].health,before);assert.equal(m.missiles.length,0);
});
test('dogfight is separate airborne mission and lock requires aiming',()=>{
 const m=M.createDogfight(),s=F16();assert.equal(m.phase,'DOGFIGHT');assert.equal(m.aam,4);
 s.onGround=false;s.z=1700;s.armed=true;align(s,m.enemy);
 lock(m,s);assert.equal(M.fire(m,s,'air').ok,true);
 assert.equal(m.aam,3);
});
test('AAM shots can defeat moving enemy; victory only on zero enemy health',()=>{
 const m=M.createDogfight(),s=F16();s.onGround=false;s.z=1740;s.armed=true;s.y=0;
 m.enemy.cooldown=1e5;
 align(s,m.enemy);lock(m,s);assert.equal(M.fire(m,s,'air').ok,true);
 for(let i=0;i<250;i++)M.tick(m,s,1/30);
 assert.ok(m.enemy.health<2,JSON.stringify({e:m.enemy,p:m.missiles}));
 assert.equal(m.phase,'DOGFIGHT');
 m.enemy.x=s.x+220;m.enemy.y=s.y+900;m.enemy.z=s.z+90;m.enemy.heading=Math.PI;
 align(s,m.enemy);lock(m,s);assert.equal(M.fire(m,s,'air').ok,true);
 for(let i=0;i<250;i++)M.tick(m,s,1/30);
 assert.equal(m.enemy.health,0);assert.equal(m.phase,'VICTORY');
});
test('hostile missile is decoyed by flare during threat window',()=>{
 const m=M.createDogfight(),s=F16();s.onGround=false;s.z=1700;s.vy=120;
 m.enemy.x=0;m.enemy.y=850;m.enemy.z=1700;m.enemy.heading=Math.PI;m.enemy.cooldown=0;
 M.tick(m,s,1/30);assert.equal(m.threats.length,1);
 M.deployFlare(m);m.threats[0].x=0;m.threats[0].y=300;m.threats[0].z=1700;
 M.tick(m,s,1/30);assert.equal(m.threats.length,0);assert.equal(m.health,100);
});
test('unprotected missile hit reduces health and eventually fails',()=>{
 const m=M.createDogfight(),s=F16();s.onGround=false;s.z=1500;m.enemy.cooldown=1e5;
 for(let n=0;n<3;n++){
   m.threats.push({x:s.x,y:s.y+9,z:s.z,ttl:5,speed:230});M.tick(m,s,1/30);
 }
 assert.equal(m.phase,'FAILED');assert.equal(m.health,0);
});
test('target cycling resets lock, ignores destroyed enemies and preserves not-allowed target',()=>{
 const m=M.createGround();m.lockRequested=true;m.locked=true;
 const t=M.cycleTarget(m);assert.equal(t.id,'G2');assert.equal(m.locked,false);assert.equal(m.lockRequested,false);
 t.health=0;const n=M.cycleTarget(m);assert.equal(n.id,'G3');
});
test('event ring bounded, pending step events survive >20 events',()=>{
 const m=M.createGround();for(let i=0;i<25;i++)M.cycleTarget(m);
 assert.equal(m.events.length,20);
 const s=F16(),events=M.tick(m,s,1/30);assert.ok(events.length>=25);
 assert.equal(M.tick(m,s,1/30).length,0);
});
test('nonfinite or invalid timestep is ignored',()=>{
 const m=M.createGround(),s=F16();for(const dt of [0,-.1,NaN,1])M.tick(m,s,dt);
 assert.equal(m.time,0);assert.equal(m.phase,'TAKEOFF');
});
test('polygon geometry contains ground assets, low-face count, and no texture references',()=>{
 const m=M.createGround(),meshes=V.makeGround(m.targets);
 assert.equal(Object.keys(meshes).length,4);
 for(const faces of Object.values(meshes)){
   assert.ok(faces.length>0&&faces.length<70);
   assert.ok(faces.every(f=>f.points.length>=3&&f.rgb.length===3));
 }
 assert.ok(V.makeBase().length<50);
 assert.ok(V.fighterFaces(M.createDogfight().enemy).length<=16);
 assert.equal(V.missileFaces({x:0,y:0,z:10},false).length,2);
});
