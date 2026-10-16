/* FlightEngine fictional arcade combat missions. Not operational weapons guidance.
   Deterministic fixed-step state machine; no DOM, renderer, network or dependencies. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FlightCombat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PI=Math.PI;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const point=(p)=>({x:p.x,y:p.y,z:p.z});
  const forward=s=>({x:Math.sin(s.heading)*Math.cos(s.pitch),y:Math.cos(s.heading)*Math.cos(s.pitch),z:Math.sin(s.pitch)});
  const norm=(d)=>{const n=Math.hypot(d.x,d.y,d.z)||1;return {x:d.x/n,y:d.y/n,z:d.z/n};};
  const toward=(a,b)=>norm({x:b.x-a.x,y:b.y-a.y,z:b.z-a.z});
  const angularError=(s,target)=>{
    const a=toward(s,target),f=forward(s);
    return Math.acos(clamp(a.x*f.x+a.y*f.y+a.z*f.z,-1,1));
  };
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const emit=(m,message)=>{m.events.push(message);m.pending.push(message);m.lastEvent=message;if(m.events.length>20)m.events.shift();};
  const createBase=(type)=>({type,phase:type==='ground'?'TAKEOFF':'DOGFIGHT',time:0,score:0,selectedId:null,
    lockId:null,lockSeconds:0,locked:false,lockRequested:false,missiles:[],threats:[],effects:[],events:[],pending:[],lastEvent:'',
    agm:6,aam:4,cooldown:0,flareSeconds:0,health:100,shots:0,hits:0,enemy:null,targets:[],lastEnemyFire:0,
    home:{x:0,y:0},destroyed:0});
  const createGround=()=>{
    const m=createBase('ground');
    m.targets=[
      {id:'G1',name:'KIRMIZI HANGAR',kind:'building',x:620,y:3700,z:22,health:2,maxHealth:2,radius:38,required:true},
      {id:'G2',name:'RADAR İSTASYONU',kind:'radar',x:920,y:3960,z:14,health:1,maxHealth:1,radius:30,required:true},
      {id:'G3',name:'ARAÇ KONVOYU',kind:'vehicle',x:580,y:4130,z:5,health:1,maxHealth:1,radius:25,required:true},
      {id:'G4',name:'DEVRİYE BİRLİĞİ',kind:'troops',x:790,y:3840,z:2,health:1,maxHealth:1,radius:16,required:false}
    ];
    m.selectedId='G1';emit(m,'KURGUSAL GÖREV: üsten kalk, kırmızı hedefleri etkisizleştir, piste dön.');return m;
  };
  const createDogfight=()=>{
    const m=createBase('air');
    m.enemy={id:'AIR1',name:'KIZIL AV ÖNLEYİCİ',kind:'fighter',x:270,y:1400,z:1800,
      heading:PI,pitch:0,speed:145,health:2,maxHealth:2,radius:19,cooldown:3};
    m.selectedId='AIR1';emit(m,'DOGFIGHT: kurgusal kırmızı avcıyı kilitle; gelen füzeyi flare ile şaşırt.');return m;
  };
  const targets=m=>m.type==='ground'?m.targets:m.enemy?[m.enemy]:[];
  const selected=m=>targets(m).find(t=>t.id===m.selectedId&&t.health>0)||null;
  const cycleTarget=m=>{
    const all=targets(m),alive=all.filter(t=>t.health>0);
    if(!alive.length)return null;
    const old=all.findIndex(t=>t.id===m.selectedId);
    let next=null;
    for(let offset=1;offset<=all.length;offset++){
      const candidate=all[(old+offset+all.length)%all.length];
      if(candidate.health>0){next=candidate;break;}
    }
    m.selectedId=next.id;
    m.lockId=null;m.lockSeconds=0;m.locked=false;m.lockRequested=false;
    emit(m,'HEDEF: '+selected(m).name);return selected(m);
  };
  const lockEligibility=(m,s,t)=>{
    if(!t||s.onGround||!Number.isFinite(s.z)||s.z<30)return false;
    const r=distance(s,t);
    return r>=70&&r<=(m.type==='ground'?6800:4600)&&angularError(s,t)<(m.type==='ground'?0.49:0.55);
  };
  const updateLock=(m,s,dt)=>{
    const t=selected(m),ok=m.lockRequested&&lockEligibility(m,s,t);
    if(!ok){m.locked=false;m.lockId=null;m.lockSeconds=0;return;}
    if(m.lockId!==t.id){m.lockId=t.id;m.lockSeconds=0;m.locked=false;}
    if(!m.locked){m.lockSeconds+=dt;
      if(m.lockSeconds>=0.8){m.locked=true;emit(m,'KİLİT TAMAM: '+t.name);}}
  };
  const fire=(m,s,type)=>{
    if(!m||m.phase==='COMPLETE'||m.phase==='VICTORY'||m.phase==='FAILED')return {ok:false,reason:'AKTİF GÖREV YOK'};
    if(m.type!==type)return {ok:false,reason:type==='ground'?'YER GÖREVİ GEREKLİ':'DOGFIGHT GEREKLİ'};
    if(!s.armed)return {ok:false,reason:'MASTER ARM KAPALI'};
    if(s.onGround||s.z<40)return {ok:false,reason:'HAVADA / 40 M ÜZERİNDE OL'};
    if(m.cooldown>0)return {ok:false,reason:'FÜZE HAZIR DEĞİL'};
    if(!m.locked||m.lockId!==m.selectedId||!lockEligibility(m,s,selected(m)))return {ok:false,reason:'ÖNCE HEDEF KİLİDİ'};
    const ammo=type==='ground'?'agm':'aam';
    if(m[ammo]<=0)return {ok:false,reason:'FÜZE BİTTİ'};
    m[ammo]--;m.shots++;m.cooldown=1.3;
    const t=selected(m);
    m.missiles.push({x:s.x,y:s.y,z:s.z-1,targetId:t.id,type,ttl:22,speed:type==='ground'?330:410});
    m.locked=false;m.lockSeconds=0;
    emit(m,(type==='ground'?'AGM':'AAM')+' FIRLATILDI → '+t.name);
    return {ok:true,reason:'FÜZE FIRLATILDI'};
  };
  const deployFlare=m=>{if(m&&m.type==='air'&&m.phase==='DOGFIGHT'){
    m.flareSeconds=3.2;emit(m,'FLARE: kızılötesi karşı tedbir aktif (oyun modeli)');return true;
  }return false;};
  const moveMissile=(p,target,dt)=>{
    const dx=target.x-p.x,dy=target.y-p.y,dz=target.z-p.z;
    const range=Math.hypot(dx,dy,dz);
    if(range<=p.speed*dt+Math.min(target.radius||0,18)){
      p.x=target.x;p.y=target.y;p.z=target.z;return true;
    }
    const k=p.speed*dt/Math.max(range,.01);
    p.x+=dx*k;p.y+=dy*k;p.z+=dz*k;return false;
  };
  const updateEnemy=(m,s,dt)=>{
    const e=m.enemy;if(!e||e.health<=0)return;
    // Toy pursuit AI: deliberately limited turning and constant speed; not real combat logic.
    const bearing=Math.atan2(s.x-e.x,s.y-e.y);
    const desired=wrap(bearing+ (distance(s,e)<230?.8:0));
    e.heading+=clamp(wrap(desired-e.heading),-.34*dt,.34*dt);
    e.pitch=clamp((s.z-e.z)/1100,-.12,.12);
    e.x+=Math.sin(e.heading)*e.speed*dt;
    e.y+=Math.cos(e.heading)*e.speed*dt;
    e.z+=clamp(s.z-e.z,-120,120)*.12*dt;
    e.cooldown=Math.max(0,e.cooldown-dt);
    // Periodic, forgiving game threat: allow the player time to see a warning and flare.
    const r=distance(e,s);
    if(r<1750&&r>160&&e.cooldown<=0&&m.threats.length===0){
      const dir=toward(e,s);const facing=Math.sin(e.heading)*dir.x+Math.cos(e.heading)*dir.y;
      if(facing>.30){
        m.threats.push({x:e.x,y:e.y,z:e.z,ttl:12,speed:230});
        e.cooldown=18;emit(m,'TEHDİT: düşman füzesi yaklaşıyor! F ile FLARE.');
      }
    }
  };
  const tick=(m,s,dt)=>{
    if(!m||!Number.isFinite(dt)||dt<=0||dt>.25)return [];
    if(['COMPLETE','VICTORY','FAILED'].includes(m.phase))return m.pending.splice(0);
    m.time+=dt;m.cooldown=Math.max(0,m.cooldown-dt);m.flareSeconds=Math.max(0,m.flareSeconds-dt);
    if(m.type==='ground'){
      if(m.phase==='TAKEOFF'&&!s.onGround){m.phase='STRIKE';emit(m,'HAVALANDIN: kırmızı hedef bölgesine ilerle. X hedef değiştir.');}
    } else updateEnemy(m,s,dt);
    updateLock(m,s,dt);
    for(let i=m.missiles.length-1;i>=0;i--){
      const p=m.missiles[i],t=targets(m).find(t=>t.id===p.targetId&&t.health>0);
      p.ttl-=dt;
      if(p.ttl<=0||!t){m.missiles.splice(i,1);continue;}
      if(moveMissile(p,t,dt)){
        m.missiles.splice(i,1);t.health=Math.max(0,t.health-1);m.hits++;
        emit(m,t.health?'HEDEF İSABET: '+t.name:'HEDEF ETKİSİZ: '+t.name);
        m.effects.push({x:t.x,y:t.y,z:t.z,ttl:.9});
        if(t.health===0){m.score+=t.required===false?50:150;m.destroyed++;
          if(m.selectedId===t.id){m.selectedId=null;const next=targets(m).find(v=>v.health>0);if(next)m.selectedId=next.id;}
        }
      }
    }
    if(m.type==='ground'){
      if(m.phase==='STRIKE'&&m.targets.filter(t=>t.required).every(t=>t.health<=0)){
        m.phase='RTB';m.score+=300;emit(m,'GÖREV TAMAM: ÜSSE DÖN (RTB), PİSTE İN VE YAVAŞLA.');
      }
      if(m.phase==='RTB'&&s.onGround&&Math.abs(s.x)<45&&s.y>=-220&&s.y<=2700&&Math.hypot(s.vx,s.vy)<30){
        m.phase='COMPLETE';m.score+=500;emit(m,'GÖREV BAŞARILI: piste geri dönüş.');
      }
    }else{
      for(let i=m.threats.length-1;i>=0;i--){
        const p=m.threats[i];p.ttl-=dt;
        if(m.flareSeconds>0&&distance(p,s)<550){m.threats.splice(i,1);m.score+=40;emit(m,'FLARE BAŞARILI: düşman füzesi saptırıldı.');continue;}
        if(p.ttl<=0){m.threats.splice(i,1);continue;}
        if(moveMissile(p,{...s,radius:14},dt)){
          m.threats.splice(i,1);m.health=Math.max(0,m.health-34);
          emit(m,'FÜZE İSABETİ: uçak hasarı, bütünlük %'+m.health);
          if(m.health<=0){m.phase='FAILED';emit(m,'GÖREV BAŞARISIZ: uçak kaybedildi.');}
        }
      }
      if(m.enemy&&m.enemy.health<=0&&m.phase!=='FAILED'){
        m.phase='VICTORY';m.score+=400;emit(m,'DOGFIGHT BAŞARILI: hava tehdidi etkisizleştirildi.');
      }
    }
    for(let i=m.effects.length-1;i>=0;i--){m.effects[i].ttl-=dt;if(m.effects[i].ttl<=0)m.effects.splice(i,1);}
    return m.pending.splice(0);
  };
  const guidance=(m,s)=>{
    if(!m)return null;
    const t=selected(m);
    // Return coordinates are fictional, relative to runway origin (x=0, y=0).
    const dest=m.phase==='RTB'?{x:0,y:0,z:0}:t;
    if(!dest)return {target:'TAMAMLANDI',range:0,bearing:0,angle:0,locked:false};
    const dx=dest.x-s.x,dy=dest.y-s.y;
    return {target:m.phase==='RTB'?'ANA ÜS':dest.name,range:Math.round(distance(s,dest)),
      bearing:((Math.atan2(dx,dy)*180/PI)%360+360)%360,
      angle:angularError(s,dest)*180/PI,locked:!!m.locked,lockProgress:clamp(m.lockSeconds/.8,0,1)};
  };
  return {createGround,createDogfight,tick,fire,cycleTarget,selected,updateLock,lockEligibility,angularError,
    deployFlare,guidance,distance};
});
