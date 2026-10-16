const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../maneuvers.js');
const state=()=>({onGround:false,z:700,vx:0,vy:130,vz:0,pitch:0,bank:0,stall:false,loadFactorG:2});
test('all nine unique, defined, timed maneuvers',()=>{
  assert.equal(M.definitions.length,10);
  assert.equal(new Set(M.definitions.slice(1).map(x=>x.name)).size,9);
  for(let id=1;id<=9;id++){
    const d=M.definition(id);
    assert.equal(d.id,id);assert.ok(d.duration>4&&d.duration<=20);
    assert.ok(M.assess(id,state()).ok);
    const a=M.profile(id,0),m=M.profile(id,d.duration/2),f=M.profile(id,d.duration);
    assert.ok(Math.abs(a.bank)<1e-10);
    assert.ok(Math.abs(f.bank)<1e-10);
    assert.ok(Math.abs(f.pitch)<1e-10 || id===9); // recovery target returns to zero at end
    assert.ok(Object.values(m).every(v=>typeof v==='boolean'||Number.isFinite(v)));
  }
});
test('correct turn directions and different maneuvers',()=>{
  assert.ok(M.profile(1,4).bank<0);
  assert.ok(M.profile(2,4).bank>0);
  assert.ok(M.profile(5,3).bank<0);
  assert.ok(M.profile(5,13).bank>0);
  assert.ok(M.profile(7,5).bank<M.profile(1,4).bank);
  assert.ok(M.profile(8,5).bank>M.profile(2,4).bank);
  assert.ok(M.profile(3,4).pitch>0);
  assert.ok(M.profile(4,4).pitch<0);
});
test('reject ground, low speed, low altitude, stall and excess G',()=>{
  const s=state();s.onGround=true;assert.equal(M.assess(1,s).ok,false);
  s.onGround=false;s.vy=20;assert.equal(M.assess(1,s).ok,false);
  s.vy=130;s.z=70;assert.equal(M.assess(1,s).ok,false);
  s.z=700;s.stall=true;assert.equal(M.assess(1,s).ok,false);
  assert.equal(M.assess(9,s).ok,true);
  s.stall=false;s.loadFactorG=8.6;assert.equal(M.assess(6,s).ok,false);
  assert.equal(M.assess(42,s).ok,false);
});
test('guidance is bounded and does not teleport state',()=>{
  const s=state(), command=M.guidance({bank:1.2,pitch:.4},s);
  assert.ok(Math.abs(command.pitch)<=1&&Math.abs(command.roll)<=1);
  assert.equal(command.yaw,0);
  assert.equal(s.pitch,0);
  assert.equal(s.bank,0);
});
