const test=require('node:test'),assert=require('node:assert/strict');
const mesh=require('../fleet-mesh.js');
for(const [id,p] of Object.entries(mesh.profiles)){
 if(id==='F16')continue;
 test(id+' valid untextured model envelope and geometry',()=>{
  const m=mesh.meshes[id];assert.ok(m.faces.length>30&&m.faces.length<500);
  assert.ok(m.faces.every(f=>f.ids.length>=3&&f.ids.every(n=>Number.isInteger(n)&&n>=0&&n<m.vertices.length)));
  assert.ok(m.vertices.every(v=>v.every(Number.isFinite)));
  assert.ok(Math.abs(m.bounds.max[0]-m.bounds.min[0]-p.dimensions.length)<p.dimensions.length*.20);
  if(p.kind==='rotor')assert.ok(m.rotors.length>=2);
 });
}
