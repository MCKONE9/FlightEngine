const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../flight-models.js');
const names=Object.keys(F.profiles);
test('fleet consists of six uniquely tuned airframes',()=>{
 assert.deepEqual([...names].sort(),['AH1','AH6','AH64','B737','F16','SR71'].sort());
 const signatures=names.map(id=>JSON.stringify(F.profiles[id]));
 assert.equal(new Set(signatures).size,6);
 assert.ok(F.profiles.B737.rollRate<F.profiles.F16.rollRate);
 assert.ok(F.profiles.AH6.rollRate>F.profiles.AH64.rollRate);
 assert.equal(F.profiles.B737.afterburner,false);
});
test('fixed wing lift increases with AoA and jet subtypes use different drag',()=>{
 for(const id of ['F16','B737','SR71']){
  const m=F.profiles[id],a=F.aeroForces(m,1,3500,100,.5,false),b=F.aeroForces(m,6,3500,100,.5,false);
  assert.ok(b.lift>a.lift,id);assert.ok(a.drag>0);
 }
 const a=F.aeroForces(F.profiles.B737,5,3500,124,.9,false);
 const b=F.aeroForces(F.profiles.SR71,5,3500,124,.9,false);
 assert.notEqual(a.drag,b.drag);
});
test('AH1 AH64 AH6 hover model and power-off descent',()=>{
 for(const id of ['AH1','AH64','AH6']){
  const m=F.profiles[id];const input={engine:'RUNNING',rotorRPM:1,collective:m.hoverCollective,
   pitch:0,bank:0,heading:0,vx:0,vy:0,vz:0};
  const a=F.rotorAcceleration(m,input);
  assert.ok(Math.abs(a.az)<.0001,id+' '+a.az);
  assert.ok(F.rotorAcceleration(m,{...input,engine:'OFF'}).az < -9);
  assert.equal(F.isReadyForRotorLift(m,'RUNNING',.99,m.hoverCollective+.15),true);
  assert.equal(F.isReadyForRotorLift(m,'RUNNING',.5,.95),false);
 }
 assert.ok(F.profiles.AH6.translateAccel>F.profiles.AH64.translateAccel);
});
test('rotor spool is deterministic and bounded',()=>{
 for(const id of ['AH1','AH64','AH6']){
  const m=F.profiles[id],a=F.rpmNext(0,'RUNNING',.1,m);
  assert.ok(a>0&&a<1);assert.equal(F.rpmNext(1,'OFF',0,m),1);
 }
});
