/* FlightEngine F-16C polygon silhouette — SI metres, no textures or dependencies.
 * Coordinate system: +X nose, +Y starboard, +Z up. Approximate visual geometry,
 * NOT a CAD model, aerodynamic surface definition, or licensed manufacturing data.
 * Reference envelope: US Air Force F-16C 14.8m length, 9.8m span, 4.8m height.
 */
(function(root){
  'use strict';
  const DIMENSIONS=Object.freeze({length:14.8,wingspan:9.8,height:4.8});
  const PALETTE=Object.freeze([
    [151,166,174], // 0 upper grey
    [112,127,137], // 1 dark grey
    [183,193,197], // 2 leading edges
    [87,101,113],  // 3 lower body
    [38,65,83],    // 4 blue-tinted glass (opaque polygon)
    [55,91,109],   // 5 lit canopy panels
    [23,29,34],    // 6 intake/nozzle interiors
    [75,81,85],    // 7 metal engine ring
    [99,111,121],  // 8 slightly dark wing panel
    [34,39,43],    // 9 tires / seams
    [194,197,193], // 10 struts
  ]);
  const v=[],faces=[],named={};
  function vertex(x,y,z){
    if(![x,y,z].every(Number.isFinite))throw Error('Nonfinite aircraft coordinate');
    const id=v.length;v.push([x,y,z]);return id;
  }
  function normal(ids){
    const a=v[ids[0]],b=v[ids[1]],c=v[ids[2]];
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
    const vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
    const d=Math.hypot(x,y,z);
    if(d<1e-8) return null;
    return [x/d,y/d,z/d];
  }
  function face(ids,material,part='airframe',gear=false){
    if(ids.length<3)throw Error('Face has fewer than three vertices');
    const n=normal(ids);if(!n)return; // avoid zero-area triangles at tapered ends
    faces.push({ids,normal:n,material,part,gear});
    named[part]=(named[part]||0)+1;
  }
  function ring(x,ry,rz,cz,count=12){
    const r=[];
    for(let i=0;i<count;i++){
      const t=i*Math.PI*2/count;
      r.push(vertex(x,Math.cos(t)*ry,cz+Math.sin(t)*rz));
    }
    return r;
  }
  function connect(a,b,material,part){
    for(let i=0;i<a.length;i++)face([a[i],b[i],b[(i+1)%a.length],a[(i+1)%a.length]],
      typeof material==='function'?material(i):material,part);
  }
  // The distinct faceted radome, fuselage shoulder, engine spine and aft taper.
  const stations=[
    [7.40,.025,.025,.18],[7.04,.11,.12,.18],[6.25,.24,.22,.18],
    [5.30,.37,.30,.17],[4.45,.44,.36,.15],[3.25,.59,.45,.14],
    [2.05,.70,.51,.10],[.75,.81,.57,.12],[-.60,.85,.59,.14],
    [-2.15,.84,.63,.18],[-3.40,.74,.57,.20],[-4.65,.66,.51,.23],
    [-5.68,.57,.47,.22],[-6.75,.46,.43,.18],[-7.15,.44,.39,.17]
  ];
  const rings=stations.map(s=>ring(...s));
  for(let i=0;i<rings.length-1;i++)
    connect(rings[i],rings[i+1],sector=>{
      // upper facets lighter, lower fuselage a shade darker
      const angle=(sector+.5)*2*Math.PI/12;
      return Math.sin(angle)>.05?(sector%4===0?2:0):3;
    },'fuselage');
  face([...rings[0]].reverse(),2,'radome');
  face(rings.at(-1),7,'nozzle');

  // Single-seat bubble canopy: half-ellipse rings, geometric pane colors only.
  const canopy=[
    [5.00,.055,.045,.48],[4.58,.27,.28,.48],[4.10,.37,.44,.50],
    [3.48,.45,.53,.52],[2.83,.49,.57,.54],[2.22,.48,.46,.57],
    [1.64,.34,.22,.62],[1.39,.12,.045,.67]
  ];
  const canopyRings=canopy.map(([x,ry,h,base])=>{
    const r=[];for(let i=0;i<=8;i++){
      const t=Math.PI*i/8;
      r.push(vertex(x,Math.cos(t)*ry,base+Math.sin(t)*h));
    }return r;
  });
  for(let i=0;i<canopyRings.length-1;i++)for(let j=0;j<8;j++)
    face([canopyRings[i][j],canopyRings[i+1][j],canopyRings[i+1][j+1],canopyRings[i][j+1]],
      (i+j)%5===0?5:4,'canopy');
  // Dark canopy transverse frames are narrow physical polygon strips.
  for(const i of [1,6])for(let j=0;j<8;j++){
    const p=v[canopyRings[i][j]],q=v[canopyRings[i][j+1]];
    const a=vertex(p[0]-.025,p[1],p[2]+.012),b=vertex(p[0]+.025,p[1],p[2]+.012);
    const c=vertex(q[0]+.025,q[1],q[2]+.012),d=vertex(q[0]-.025,q[1],q[2]+.012);
    face([a,b,c,d],9,'canopy-frame');
  }

  // Multi-section low-profile, single chin inlet under the cockpit.
  const intakeOuter=[
    [2.65,-.52,-.39],[2.65,.52,-.39],[2.65,.49,-.90],[2.65,-.49,-.90]
  ].map(c=>vertex(...c));
  const intakeInner=[
    [2.48,-.43,-.48],[2.48,.43,-.48],[2.48,.39,-.80],[2.48,-.39,-.80]
  ].map(c=>vertex(...c));
  for(let j=0;j<4;j++)face([intakeOuter[j],intakeOuter[(j+1)%4],intakeInner[(j+1)%4],intakeInner[j]],2,'intake-lip');
  face(intakeInner,6,'intake');
  const inletBack=[[-.3,-.58,-.40],[-.3,.58,-.40],[-.3,.47,-.84],[-.3,-.47,-.84]].map(c=>vertex(...c));
  for(let j=0;j<4;j++)face([intakeOuter[j],inletBack[j],inletBack[(j+1)%4],intakeOuter[(j+1)%4]],3,'intake-duct');

  // Plate with sealed edge and lower skin (polygon sections; no textures).
  function plate(outline,thickness,topMat,bottomMat,part){
    const a=outline.map(c=>vertex(...c));
    const b=outline.map(c=>vertex(c[0],c[1],c[2]-thickness));
    face(a,topMat,part);
    face([...b].reverse(),bottomMat,part);
    for(let j=0;j<a.length;j++)face([a[j],a[(j+1)%a.length],b[(j+1)%a.length],b[j]],
      j%2?1:2,part);
  }
  for(const side of [-1,1]){
    const at=(x,y,z)=>[x,y*side,z];
    // Leading edge root extensions (LERX), a recognizable F-16 planform feature.
    plate([at(2.90,.51,.44),at(1.42,1.06,.33),at(.22,1.54,.23),
           at(-.62,1.12,.20),at(.80,.72,.54)],.07,2,3,'lerx');
    // Inboard and outboard wing panels together span exactly 9.8m.
    plate([at(1.15,.78,.18),at(.24,1.45,.19),at(-.72,2.70,.18),
           at(-3.08,2.70,.15),at(-3.32,.82,.18)],.10,0,3,'wing-inner');
    plate([at(-.72,2.70,.18),at(-2.19,4.90,.20),at(-3.16,4.90,.20),
           at(-3.08,2.70,.15)],.09,8,3,'wing-outer');
    // Geometric trailing-edge flaperons; tiny height offset avoids coplanar fighting.
    plate([at(-2.72,2.73,.202),at(-3.06,2.73,.201),at(-3.15,4.72,.211),
           at(-2.94,4.72,.212)],.026,1,1,'flaperon');
    // Swept all-moving horizontal stabilizers.
    plate([at(-4.17,.57,.39),at(-5.03,2.28,.34),at(-6.50,2.26,.33),
           at(-6.62,.54,.40)],.12,0,3,'stabilator');
    // Wingtip station: slim rail rather than a missile / textured object.
    plate([at(-2.02,4.84,.23),at(-1.90,4.9,.23),at(-3.32,4.9,.20),
           at(-3.39,4.84,.20)],.10,2,1,'wingtip-rail');
  }
  // Single swept vertical stabilizer, 3m above fuselage reference.
  const finOutline=[[-3.78,.54],[-4.48,1.03],[-5.04,2.94],[-5.93,3.00],
                    [-6.54,2.61],[-6.60,.52]];
  const left=finOutline.map(([x,z])=>vertex(x,-.085,z));
  const right=finOutline.map(([x,z])=>vertex(x,.085,z));
  face(left,0,'vertical-tail');face([...right].reverse(),2,'vertical-tail');
  for(let i=0;i<left.length;i++)face([left[i],left[(i+1)%left.length],right[(i+1)%right.length],right[i]],1,'vertical-tail');
  // Root fillet under the fin.
  for(const sg of [-1,1]){
    const a=vertex(-3.12,.30*sg,.57),b=vertex(-5.15,.23*sg,.79),
      c=vertex(-6.60,.11*sg,.59),d=vertex(-4.00,.08*sg,1.05);
    face([a,b,c,d],0,'dorsal-spine');
  }
  // Exhaust: alternating faceted external petals and black inner orifice.
  const nozzleOuter=ring(-7.15,.45,.40,.17,12);
  const nozzleRear=ring(-7.40,.38,.34,.17,12);
  connect(nozzleOuter,nozzleRear,i=>i%2?7:1,'nozzle-petals');
  face([...nozzleRear].reverse(),6,'nozzle-interior');

  // Simplified retractable tricycle landing gear. 4.8m total vertical envelope.
  function box(cx,cy,cz,hx,hy,hz,material,part='gear'){
    const corners=[];
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])
      corners.push(vertex(cx+x*hx,cy+y*hy,cz+z*hz));
    const sides=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
    for(const ids of sides)face(ids.map(i=>corners[i]),material,part,true);
  }
  function wheel(cx,cy,cz,r,halfWidth){
    // Low-poly wheel disk, axis Y: octagonal circumference and 8 dark side panels.
    const l=[],rSide=[];
    for(let i=0;i<8;i++){
      const theta=i*2*Math.PI/8;
      l.push(vertex(cx+Math.sin(theta)*r,cy-halfWidth,cz+Math.cos(theta)*r));
      rSide.push(vertex(cx+Math.sin(theta)*r,cy+halfWidth,cz+Math.cos(theta)*r));
    }
    face(l,9,'gear',true);face([...rSide].reverse(),9,'gear',true);
    for(let i=0;i<8;i++)face([l[i],rSide[i],rSide[(i+1)%8],l[(i+1)%8]],9,'gear',true);
  }
  box(4.18,0,-1.04,.065,.065,.47,10);
  wheel(4.18,0,-1.46,.34,.15); // bottom -1.80m
  for(const side of [-1,1]){
    box(-1.55,side*1.10,-1.05,.08,.075,.43,10);
    wheel(-1.55,side*1.10,-1.46,.34,.18);
  }
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  v.forEach(p=>p.forEach((x,i)=>{bounds.min[i]=Math.min(x,bounds.min[i]);bounds.max[i]=Math.max(x,bounds.max[i]);}));
  const mesh={vertices:v,faces,palette:PALETTE,dimensions:DIMENSIONS,bounds,parts:named,
              triangleEstimate:faces.reduce((a,f)=>a+f.ids.length-2,0)};
  if(typeof module!=='undefined'&&module.exports)module.exports=mesh;
  root.FlightAircraft=mesh;
})(typeof globalThis!=='undefined'?globalThis:this);
