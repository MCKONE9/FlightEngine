'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../flight-math.js');
const approx=(actual,expected,tol=1e-4)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected} ± ${tol}`);

test('sea-level ISA is finite and matches expected pressure/density',()=>{
  const a=F.atm(0);
  approx(a.pressure,101325,0.1);approx(a.T,288.15);approx(a.rho,1.225,0.002);
  approx(a.soundSpeed,340.3,0.2);
});
test('atmospheric pressure and density fall with altitude; boundary remains continuous',()=>{
  const a=F.atm(1000),b=F.atm(11000),c=F.atm(15000);
  assert.ok(a.rho> b.rho && b.rho > c.rho);
  approx(F.atm(10999.99).pressure,F.atm(11000.01).pressure,0.2);
});
test('atmosphere is bounded to supported altitude range',()=>{
  assert.deepEqual(F.atm(50000),F.atm(20000));
  assert.deepEqual(F.atm(-600),F.atm(-500));
});
test('interpolation, control limits and rate smoothing',()=>{
  approx(F.interp(5,[0,10],[2,10]),6);
  approx(F.interp(-4,[0,10],[2,10]),2);
  approx(F.interp(14,[0,10],[2,10]),10);
  approx(F.smooth(0,1,2,0.2),0.4);
  approx(F.clamp(-1,0,1),0);
  approx(F.clamp(2,0,1),1);
  assert.ok(F.clOf(10)>F.clOf(-10));
  assert.ok(F.cdOf(40)>F.cdOf(0));
});
test('dry and wet engine thrust respect declared limits',()=>{
  assert.equal(F.engineThrust('OFF',1,1,0,12000),0);
  approx(F.engineThrust('RUNNING',0,0,0,12000),0);
  approx(F.engineThrust('RUNNING',1,0,0,12000),F.MIL_THRUST,0.1);
  approx(F.engineThrust('RUNNING',1,1,0,12000),F.AB_THRUST,0.1);
  assert.ok(F.engineThrust('RUNNING',1,1,5000,12000)<F.AB_THRUST);
  assert.ok(F.engineThrust('RUNNING',1,1,14000,12000)<F.engineThrust('RUNNING',1,1,12000,12000));
  assert.ok(F.engineThrust('RUNNING',5,5,0,12000)<=F.AB_THRUST);
});
test('CSV encodes punctuation and line breaks, protects spreadsheet input',()=>{
  assert.equal(F.csvCell('plain'),'plain');
  assert.equal(F.csvCell('hello,world'),'"hello,world"');
  assert.equal(F.csvCell('a"b'),'"a""b"');
  assert.equal(F.csvCell('a\nb'),'"a\nb"');
  assert.equal(F.csvCell('=SUM(1,2)'), '"\'=SUM(1,2)"');
  assert.equal(F.csvCell('  +2+3'), '"\'  +2+3"');
  assert.equal(F.csvCell('40'), '40');
  assert.equal(F.csvCell(3.141592),'3.142');
  assert.equal(F.csvCell(Infinity),'');
  assert.equal(F.csvCell(null),'');
});
