'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mesh=require('../aircraft-mesh.js');
const close=(a,b)=>Math.abs(a-b)<1e-6;
test('F-16C visual envelope matches published approximate dimensions',()=>{
  assert.equal(mesh.dimensions.length,14.8);
  assert.equal(mesh.dimensions.wingspan,9.8);
  assert.equal(mesh.dimensions.height,4.8);
  assert.ok(close(mesh.bounds.max[0]-mesh.bounds.min[0],14.8));
  assert.ok(close(mesh.bounds.max[1]-mesh.bounds.min[1],9.8));
  assert.ok(close(mesh.bounds.max[2]-mesh.bounds.min[2],4.8));
});
test('polygon mesh topology is finite and references valid vertices',()=>{
  assert.ok(mesh.faces.length>=300&&mesh.faces.length<650);
  assert.ok(mesh.triangleEstimate>=mesh.faces.length);
  mesh.vertices.forEach(v=>assert.ok(v.every(Number.isFinite)));
  mesh.faces.forEach(face=>{
    assert.ok(face.ids.length>=3);
    face.ids.forEach(i=>assert.ok(Number.isInteger(i)&&i>=0&&i<mesh.vertices.length));
    assert.ok(face.normal.every(Number.isFinite));
    assert.ok(close(Math.hypot(...face.normal),1));
    assert.ok(mesh.palette[face.material]);
  });
});
test('untextured polygon components cover aircraft silhouette and gear',()=>{
  ['fuselage','radome','canopy','intake','wing-inner','wing-outer','lerx',
   'vertical-tail','stabilator','nozzle-petals','gear'].forEach(p=>assert.ok(mesh.parts[p],p));
  assert.equal(mesh.faces.some(f=>f.gear),true);
  assert.equal(mesh.faces.some(f=>f.texture||f.uv),false);
});
test('mirror symmetry within wing and stabilizer sections',()=>{
  const positive=mesh.vertices.filter(v=>Math.abs(v[1]-4.90)<1e-5).length;
  const negative=mesh.vertices.filter(v=>Math.abs(v[1]+4.90)<1e-5).length;
  assert.ok(positive>0&&positive===negative);
});
