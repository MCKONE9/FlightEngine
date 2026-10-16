/* KC-135-inspired polygon silhouette. NOT a CAD or flight-dynamics model.
   Dimensions approx 41.5 m length, 39.9 m wingspan (USAF fact sheet).
   Coordinates: +X forward, +Y right, +Z up. Zero textures. */
(function(root){
 "use strict";
 const dimensions=Object.freeze({length:41.5,wingspan:39.9,height:12.7});
 const palette=Object.freeze([[184,190,188],[138,149,153],[213,214,204],[76,89,101],[43,51,58],[165,175,177]]);
 const vertices=[],faces=[];
 function v(x,y,z){vertices.push([x,y,z]);return vertices.length-1;}
 function face(ids,material){
  const a=vertices[ids[0]],b=vertices[ids[1]],c=vertices[ids[2]];
  const e=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],f=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const n=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]];
  const d=Math.hypot(...n);if(d>1e-8)faces.push({ids,material,normal:n.map(x=>x/d)});
 }
 const stations=[[20.75,.12,.15],[18,1.0,1.1],[13,1.7,1.9],[8,2.05,2.3],[0,2.0,2.45],[-8,1.8,2.18],[-15,1.35,1.8],[-20.75,.1,.18]];
 const rings=stations.map(([x,w,h])=>[v(x,w,0),v(x,0,h),v(x,-w,0),v(x,0,-h)]);
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<4;j++)face([rings[i][j],rings[i][(j+1)%4],rings[i+1][(j+1)%4],rings[i+1][j]],j===1?2:j===3?3:0);
 function wing(sign){
  const a=v(6,sign*1.9,.3),b=v(1,sign*7,.3),c=v(-5.8,sign*19.95,.1),d=v(-10.2,sign*19.95,.1),e=v(-7,sign*7,.3),f=v(-5.4,sign*2,.3);
  face([a,b,c,d,e,f],0);face([f,e,d,c,b,a],1);
  const tail=[v(-14,sign*1.1,.5),v(-16,sign*3,.5),v(-18.6,sign*8,.5),v(-20.2,sign*8,.5),v(-19,sign*1.0,.5)];
  face(tail,0);face([...tail].reverse(),1);
 }
 wing(-1);wing(1);
 face([v(-12.5,0,2.1),v(-16.2,0,12.0),v(-19.8,0,12.0),v(-20.2,0,1.4)],1);
 face([v(-12.5,0,2.08),v(-20.2,0,1.39),v(-19.8,0,12.0),v(-16.2,0,12.0)],0);
 for(const side of [-1,1])for(const offset of [5.7,11.5]){
  const x=offset>10?-4.5:-0.5,y=side*offset;
  const r0=[],r1=[];
  for(let i=0;i<8;i++){
   const a=2*Math.PI*i/8;r0.push(v(x,y+Math.cos(a)*.65,-1.65+Math.sin(a)*.65));
   r1.push(v(x-2.8,y+Math.cos(a)*.56,-1.65+Math.sin(a)*.56));
  }
  for(let i=0;i<8;i++)face([r0[i],r0[(i+1)%8],r1[(i+1)%8],r1[i]],4);
  face([...r0].reverse(),3);
 }
 // Depicted rigid flying boom; stationary simplified silhouette, not an animated mechanism.
 const b0=v(-14.9,0,-1.25),b1=v(-27,0,-5.5),b2=v(-27.6,.35,-5.75),b3=v(-27.6,-.35,-5.75);
 face([b0,b1,b2],5);face([b0,b3,b1],5);
 const model={dimensions,palette,vertices,faces,triangleEstimate:faces.reduce((n,f)=>n+f.ids.length-2,0)};
 if(typeof module!=="undefined"&&module.exports)module.exports=model;
 else root.FlightTankerMesh=Object.freeze(model);
})(typeof globalThis!=="undefined"?globalThis:this);
