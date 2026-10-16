/* Dependency-free, textureless educational low-poly fleet. +X forward, +Y right, +Z up.
 * These are silhouettes scaled to published aircraft envelopes, NOT certified CAD.
 */
(function(root){
'use strict';
function build(spec){
  const vertices=[],faces=[],rotors=[];
  const palette=spec.palette||[[146,159,165],[105,119,128],[192,202,208],[58,73,81],[29,48,62],[35,42,47],[89,102,107]];
  function v(x,y,z){const id=vertices.length;vertices.push([x,y,z]);return id;}
  function face(ids,material=0,part='body',gear=false){
    if(ids.length<3)return;
    const [a,b,c]=ids.map(id=>vertices[id]);
    const ab=b.map((x,i)=>x-a[i]),ac=c.map((x,i)=>x-a[i]);
    const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    const size=Math.hypot(...n);if(size<1e-7)return;
    faces.push({ids,normal:n.map(x=>x/size),material,part,gear});
  }
  function plate(coords,thickness,mat=0,part='surface',gear=false){
    const top=coords.map(p=>v(...p)),bottom=coords.map(p=>v(p[0],p[1],p[2]-thickness));
    face(top,mat,part,gear);face([...bottom].reverse(),3,part,gear);
    for(let k=0;k<top.length;k++)face([top[k],top[(k+1)%top.length],bottom[(k+1)%top.length],bottom[k]],1,part,gear);
    return [...top,...bottom];
  }
  function ring(x,ry,rz,cz=0,n=10){const a=[];for(let i=0;i<n;i++){const t=2*Math.PI*i/n;a.push(v(x,ry*Math.cos(t),cz+rz*Math.sin(t)));}return a;}
  function tube(stations,mat=0,part='fuselage',n=10){const rings=stations.map(q=>ring(...q,n));for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++)face([rings[i][j],rings[i+1][j],rings[i+1][(j+1)%n],rings[i][(j+1)%n]],typeof mat==='function'?mat(i,j):mat,part);face([...rings[0]].reverse(),mat instanceof Function?0:mat,part);face(rings.at(-1),5,part);}
  function pod(x,y,z,l,r,part){tube([[x+l*.5,.05,.05,z],[x+l*.4,r,r,z],[x-l*.30,r,r,z],[x-l*.5,r*.65,r*.65,z]].map(q=>[q[0],q[1],q[2],q[3]]),1,part,10); // centered using coordinates translated after tube below
  }
  function enginePod(x,y,z,l,r){
    const rings=[];
    for(const [dx,rr] of [[l/2,.75*r],[l*.37,r],[-l*.38,r],[-l/2,.75*r]]){
      const rIds=[];for(let k=0;k<10;k++){const t=k*Math.PI*2/10;rIds.push(v(x+dx,y+Math.cos(t)*rr,z+Math.sin(t)*rr));}rings.push(rIds);
    }
    for(let i=0;i<3;i++)for(let j=0;j<10;j++)face([rings[i][j],rings[i+1][j],rings[i+1][(j+1)%10],rings[i][(j+1)%10]],i===2?6:1,'engine-pod');
    face(rings[0],5,'engine-intake');face([...rings[3]].reverse(),5,'engine-exhaust');
  }
  function vertical(coords,mat=0,part='tail'){const l=coords.map(([x,z])=>v(x,-.10,z)),r=coords.map(([x,z])=>v(x,.10,z));face(l,mat,part);face([...r].reverse(),2,part);for(let i=0;i<l.length;i++)face([l[i],l[(i+1)%l.length],r[(i+1)%r.length],r[i]],1,part);}
  function rotor(cx,cy,cz,r,count=4,axis='z',rate=28){
    const ids=[];
    const pivot=[cx,cy,cz];
    for(let k=0;k<count;k++){
      const a=k*2*Math.PI/count,u=[Math.cos(a),Math.sin(a)];
      if(axis==='z'){
        ids.push(...plate([[cx+u[0]*.3,cy+u[1]*.3,cz],[cx+u[0]*r,cy+u[1]*r,cz+.10],
          [cx+u[0]*r-u[1]*.19,cy+u[1]*r+u[0]*.19,cz+.10],[cx+u[0]*.3-u[1]*.27,cy+u[1]*.3+u[0]*.27,cz]],.055,2,'rotor'));
      }else{
        ids.push(...plate([[cx+u[0]*.15,cy,cz+u[1]*.15],[cx+u[0]*r,cy,cz+u[1]*r],
          [cx+u[0]*r-u[1]*.10,cy,cz+u[1]*r+u[0]*.10],[cx+u[0]*.15-u[1]*.10,cy,cz+u[1]*.15+u[0]*.10]],.04,2,'tail-rotor'));
      }
    }
    rotors.push({indices:ids,pivot,axis,rate});
  }
  function skid(y){
    plate([[1.8,y, -1.1],[2.1,y,-1.2],[-2.3,y,-1.2],[-2.6,y,-1.1]],.08,1,'skids',true);
    for(const x of [1.35,-1.6])plate([[x-.06,y,-.20],[x+.06,y,-.20],[x+.06,y,-1.16],[x-.06,y,-1.16]],.06,2,'skids',true);
  }
  if(spec.id==='B737'){
    tube([[19.75,.06,.08,0],[18.8,.95,.95,0],[16.4,1.75,1.72,0],[12.2,1.89,1.85,0],
      [-13.5,1.89,1.85,0],[-17.3,1.64,1.60,.12],[-19.75,.14,.16,.3]],(i,j)=>j>=4&&j<=7?3:0,'pressurized-fuselage',14);
    for(const side of [-1,1]){
      const p=(x,y,z)=>[x,side*y,z];
      plate([p(4,1.6,.08),p(.8,7.0,.15),p(-3.3,17.9,.55),p(-6,17.9,.55),p(-6.9,7,.1),p(-4.5,1.55,.1)],.20,0,'main-wing');
      plate([p(-14.5,1.45,.45),p(-16.1,7.3,.62),p(-18.8,7.3,.62),p(-19.1,1.35,.45)],.15,1,'horizontal-stab');
      enginePod(.1,side*6.1,-1.55,4.0,1.05);
    }
    vertical([[-12.8,1.1],[-15.3,9.2],[-18.6,10.6],[-18.5,1.0]],1,'fin');
    // Faceted dark cockpit glass, no decals or textures.
    plate([[18.45,-1.12,1.24],[18.45,1.12,1.24],[16.7,.82,1.78],[16.7,-.82,1.78]],.04,4,'windscreen');
  } else if(spec.id==='SR71'){
    tube([[16.365,.03,.03,0],[14,.42,.35,0],[10,.75,.47,0],[4,1.05,.62,0],[-5,1.10,.60,0],[-12,.75,.42,0],[-16.365,.25,.15,0]],1,'chined-fuselage');
    for(const side of [-1,1]){
      const p=(x,y,z)=>[x,side*y,z];
      plate([p(12,.4,.02),p(7,2.15,.23),p(-3,8.47,.12),p(-12,8.47,.15),p(-13.4,1,.18)],.18,1,'delta-wing');
      enginePod(-5.4,side*4.8,-.04,10.5,1.15);
      plate([p(-9.6,4.45,.9),p(-12.7,4.3,2.85),p(-15.0,4.1,2.3),p(-15,4.1,.8)],.2,0,'canted-fin');
    }
    plate([[8.2,-.43,.50],[8.2,.43,.50],[3.8,.63,.75],[3.8,-.63,.75]],.06,4,'tandem-canopy');
  } else {
    // Attack rotorcraft have slim tandem cabins; the AH-6 has a spherical bubble and light tail boom.
    const little=spec.id==='AH6',apache=spec.id==='AH64';
    const len=spec.dimensions.length,radius=little?.92:apache?1.05:.70;
    const n=little?9:11;
    const nose=little?2.5:apache?3.8:3.6;
    const aft=little?-2.4:apache?-4.3:-3.5;
    tube([[nose,.02,.04,.02],[nose*.78,radius*.85,.75,.08],[nose*.38,radius,.85,.10],
      [0,radius,.88,.1],[aft,radius*.75,.70,.12],[aft-1.2,.30,.28,.25],[-len*.49,.19,.20,.30]],
      (i,j)=>i<3&&j>=3&&j<=8?4:(i<3&&j===2?2:apache?1:0),'cabin',n);
    // Raised engine housing, rotor mast, tail boom, prominent fin.
    plate([[.35,-radius*.58,1.05],[.35,radius*.58,1.05],[-2.5,radius*.55,1.30],[-2.5,-radius*.55,1.30]],.25,1,'engine-cowl');
    vertical([[-len*.38,.2],[-len*.42,1.35],[-len*.49,1.85],[-len*.5,.2]],0,'tail-fin');
    if(little){skid(-.85);skid(.85);}else{
      for(const side of [-1,1]){
        plate([[.65,side*radius,.15],[-2.2,side*radius,.15],[-2.4,side*radius*1.4,-.12],[.55,side*radius*1.4,-.12]],.09,1,'stub-wing');
        skid(side*1.05);
      }
      if(apache){plate([[1.9,-.75,-.9],[1.9,.75,-.9],[1.1,.75,-1.02],[1.1,-.75,-1.02]],.13,5,'chin-sensor');}
    }
    plate([[.35,-.18,1.38],[.35,.18,1.38],[-.25,.18,2.15],[-.25,-.18,2.15]],.15,2,'rotor-mast');
    const cz=2.15,rotorR=spec.dimensions.rotorDiameter/2;
    rotor(-.25,0,cz,rotorR,little?6:apache?4:2,'z',little?40:apache?27:32);
    rotor(-len*.48,-.36,1.05,little?.56:1.05,4,'y',44);
  }
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  vertices.forEach(p=>p.forEach((val,i)=>{bounds.min[i]=Math.min(bounds.min[i],val);bounds.max[i]=Math.max(bounds.max[i],val);}));
  return {vertices,faces,palette,rotors,dimensions:spec.dimensions,bounds,parts:{},triangleEstimate:faces.reduce((n,f)=>n+f.ids.length-2,0),id:spec.id};
}
const SPECS=Object.freeze({
  B737:{id:'B737',name:'Boeing 737-800 · Yolcu',kind:'fixed',dimensions:{length:39.5,wingspan:35.8,height:12.5},mass:58000,wing:124.6,thrust:2.8,takeoff:70,cruise:90,fuelCapacity:26000},
  AH1:{id:'AH1',name:'AH-1F Cobra',kind:'rotor',dimensions:{length:13.6,wingspan:13.4,height:4.1,rotorDiameter:13.4},mass:3500,wing:0,thrust:0,takeoff:0,cruise:30,fuelCapacity:900},
  AH64:{id:'AH64',name:'AH-64 Apache',kind:'rotor',dimensions:{length:17.7,wingspan:14.63,height:4.7,rotorDiameter:14.63},mass:7000,wing:0,thrust:0,takeoff:0,cruise:35,fuelCapacity:1400},
  AH6:{id:'AH6',name:'AH-6 Little Bird',kind:'rotor',dimensions:{length:9.8,wingspan:8.3,height:3.1,rotorDiameter:8.3},mass:1050,wing:0,thrust:0,takeoff:0,cruise:28,fuelCapacity:400},
  SR71:{id:'SR71',name:'SR-71 Blackbird · Keşif',kind:'fixed',dimensions:{length:32.73,wingspan:16.94,height:5.63},mass:30000,wing:155,thrust:4.0,takeoff:90,cruise:165,fuelCapacity:46000},
});
const meshes=Object.fromEntries(Object.entries(SPECS).map(([key,s])=>[key,build(s)]));
const PROFILES=Object.freeze({F16:{id:'F16',name:'F-16C Fighting Falcon',kind:'fixed',dimensions:{length:14.8,wingspan:9.8,height:4.8},mass:8573,wing:27.87,thrust:1,takeoff:55,cruise:110,fuelCapacity:300},...SPECS});
const api=Object.freeze({meshes,profiles:PROFILES});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.FlightFleet=api;
})(typeof globalThis!=='undefined'?globalThis:this);
