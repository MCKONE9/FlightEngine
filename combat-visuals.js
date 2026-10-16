/* Low-poly, texture-free mission scenery. Geometry is baked once, never per frame. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FlightCombatVisuals=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const face=(pts,rgb)=>({points:pts,rgb});
  function box(cx,cy,bottom,w,d,h,rgb){
    const a=cx-w/2,b=cx+w/2,c=cy-d/2,e=cy+d/2,z=bottom,t=bottom+h;
    const p=[[a,c,z],[b,c,z],[b,e,z],[a,e,z]],q=p.map(v=>[v[0],v[1],t]);
    const side=rgb.map(x=>Math.max(0,Math.round(x*.70)));
    return [face([p[0],p[1],q[1],q[0]],side),face([p[1],p[2],q[2],q[1]],rgb),
      face([p[2],p[3],q[3],q[2]],side),face([p[3],p[0],q[0],q[3]],rgb),face(q,rgb.map(x=>Math.min(255,x+20)))];
  }
  function makeBase(){
    const faces=[];
    for(const [x,y,w,d,h] of [[-190,220,90,140,15],[192,500,96,150,17],[-170,1050,75,100,11],[220,1460,105,110,18]]){
      faces.push(...box(x,y,0,w,d,h,[89,104,90]));
      // angular aircraft shelter canopy
      faces.push(face([[x-w*.6,y-d*.55,h],[x+w*.6,y-d*.55,h],[x+w*.4,y,h+7],[x-w*.4,y,h+7]],[102,116,109]));
      faces.push(face([[x-w*.4,y,h+7],[x+w*.4,y,h+7],[x+w*.6,y+d*.55,h],[x-w*.6,y+d*.55,h]],[75,90,87]));
    }
    faces.push(...box(-120,-130,0,20,25,42,[95,119,107]));
    faces.push(...box(-120,-130,42,29,29,10,[109,140,144]));
    return faces;
  }
  function makeGround(targets){
    const byId={};
    for(const t of targets){
      const f=[],red=[182,42,47],dark=[106,27,34];
      if(t.kind==='building'){
        f.push(...box(t.x,t.y,0,65,88,35,red));
        f.push(...box(t.x+15,t.y+5,35,20,35,8,dark));
      }else if(t.kind==='radar'){
        f.push(...box(t.x,t.y,0,27,31,15,red));
        f.push(...box(t.x,t.y,15,4,4,17,dark));
        for(let k=0;k<8;k++){
          const a=k*Math.PI/4,b=(k+1)*Math.PI/4;
          f.push(face([[t.x+Math.cos(a)*17,t.y+Math.sin(a)*17,34],
            [t.x+Math.cos(b)*17,t.y+Math.sin(b)*17,34],[t.x,t.y,39]],red));
        }
      }else if(t.kind==='vehicle'){
        for(const [ox,oy] of [[-19,-16],[20,16],[0,55]]){
          f.push(...box(t.x+ox,t.y+oy,1,19,33,5,red));
          f.push(...box(t.x+ox,t.y+oy+7,6,9,8,4,dark));
          for(const w of [-10,10])f.push(...box(t.x+ox+w,t.y+oy-4,0,2,5,3,[31,30,33]));
        }
      }else if(t.kind==='troops'){
        // Fictional small polygon silhouettes, intentionally no realistic persons or textures.
        for(const [ox,oy] of [[-6,-6],[6,-4],[-2,9],[12,9]]){
          f.push(...box(t.x+ox,t.y+oy,0,1.5,2,2.3,dark));
          f.push(...box(t.x+ox,t.y+oy,2.3,2.2,1.4,1.7,red));
          const a=t.x+ox,b=t.y+oy;
          f.push(face([[a-1,b,4.5],[a+1,b,4.5],[a+1.5,b,5.6],[a-1.5,b,5.6]],red));
        }
      }
      byId[t.id]=f;
    }
    return byId;
  }
  // Local fighter coordinates: x = right, y = forward, z = up.
  const JET_VERT=[
    [0,9,0],[0,5,1.0],[-1.4,3,0],[1.4,3,0],[-1.7,-5,0],[1.7,-5,0],
    [-5.8,-1.5,-.25],[5.8,-1.5,-.25],[-2,-8,.1],[2,-8,.1],
    [0,-8,0],[0,-4,3.1],[-.9,-6,0],[.9,-6,0]
  ];
  const JET_FACE=[[0,2,1],[0,1,3],[2,4,6],[3,7,5],[4,8,6],[5,7,9],
    [2,3,5,4],[4,5,10],[8,10,11],[10,9,11],[10,12,11],[13,10,11]];
  const JET_PALETTE=[[210,49,56],[140,23,32],[188,35,45],[104,20,31]];
  function fighterFaces(e){
    const h=e.heading,sn=Math.sin(h),cs=Math.cos(h);
    const verts=JET_VERT.map(([x,y,z])=>[e.x+x*cs+y*sn,e.y+y*cs-x*sn,e.z+z]);
    return JET_FACE.map((ids,i)=>face(ids.map(j=>verts[j]),JET_PALETTE[i%JET_PALETTE.length]));
  }
  function missileFaces(p,isEnemy){
    const red=isEnemy?[255,64,70]:[220,210,110],r=2;
    return [face([[p.x-r,p.y-r,p.z],[p.x+r,p.y-r,p.z],[p.x,p.y+5,p.z+1]],red),
      face([[p.x,p.y+5,p.z+1],[p.x,p.y-r,p.z+2],[p.x,p.y-r,p.z-2]],red)];
  }
  function rubble(t){
    return box(t.x,t.y,0,Math.min(38,t.radius*1.3),Math.min(36,t.radius*1.3),2,[76,41,43]);
  }
  return {makeBase,makeGround,fighterFaces,missileFaces,rubble};
});
