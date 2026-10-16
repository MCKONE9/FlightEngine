const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../obstacle-course.js');
test('fixed and helicopter course have 9 checkpoints and independent envelope',()=>{
 for(const rotor of [true,false]){const s=C.create(rotor);assert.equal(s.objects.length,9);assert.ok(s.objects.every(o=>o.y>0));}
 assert.ok(C.create(true).objects[0].radius<C.create(false).objects[0].radius);
});
test('swept ring passage succeeds at high velocity without tunnelling',()=>{
 const s=C.create();const g=s.objects[0];const e=C.tick(s,{x:g.x,y:g.y-100,z:g.z},
 {x:g.x,y:g.y+100,z:g.z},4.9,10);
 assert.equal(e.length,1);assert.equal(s.passed,1);assert.equal(s.index,1);
});
test('misses ring and detects collision on boundary',()=>{
 const s=C.create(),g=s.objects[0];let x=g.x+g.radius;
 const e=C.tick(s,{x,y:g.y-20,z:g.z},{x,y:g.y+20,z:g.z},5,1);
 assert.equal(s.missed,1);assert.equal(s.collisions,1);assert.equal(e[0].ok,false);
});
test('wrong direction or no plane crossing does not progress',()=>{
 const s=C.create(),g=s.objects[0];assert.equal(C.tick(s,{x:0,y:g.y+1,z:g.z},
 {x:0,y:g.y-1,z:g.z},4,2).length,0);assert.equal(s.index,0);
});
test('correct vs wrong slalom side',()=>{
 const s=C.create(),g=s.objects[1],radius=5;
 assert.equal(C.judge(g,{x:g.x+(g.side<0?-15:15),z:50},radius).ok,true);
 assert.equal(C.judge(g,{x:g.x+(g.side<0?15:-15),z:50},radius).ok,false);
});
