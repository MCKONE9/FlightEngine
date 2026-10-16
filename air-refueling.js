/* FlightEngine — deterministic, instructional tanker and fuel management model.
   All distances m, velocities m/s, time s, fuel L. Not certified refueling data.
   KC-135/F-16 boom approach is represented schematically, not a real procedure. */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.FlightRefueling=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const CONTACT=Object.freeze({aft:-45,below:-8,lateral:0,alongTolerance:5,
    lateralTolerance:4,verticalTolerance:3,maxRelativeSpeed:4,maxBankRad:12*Math.PI/180,
    maxHeadingRad:10*Math.PI/180,holdSeconds:2.5,transferLps:12});
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function makeMission(aircraft,{practice=false}={}){
    const h=aircraft.heading;
    const ahead=practice?420:1400;
    const climb=practice?8:90;
    const cruise=practice?110:115;
    return {active:true,practice,status:"RENDEZVOUS",request:false,connected:false,
      hold:0,transferredL:0,disconnects:0,reserveL:1800,contacted:false,
      lastEvent:"TANKER ON STATION",
      tanker:{x:aircraft.x+Math.sin(h)*ahead,y:aircraft.y+Math.cos(h)*ahead,
        z:aircraft.z+climb,heading:h,speed:cruise,vx:Math.sin(h)*cruise,
        vy:Math.cos(h)*cruise,vz:0}};
  }
  function guidance(m,aircraft){
    const T=m.tanker,h=T.heading,dx=aircraft.x-T.x,dy=aircraft.y-T.y;
    const forward=dx*Math.sin(h)+dy*Math.cos(h);
    const right=dx*Math.cos(h)-dy*Math.sin(h);
    const z=aircraft.z-T.z;
    const alongError=forward-CONTACT.aft;
    const lateralError=right-CONTACT.lateral;
    const verticalError=z-CONTACT.below;
    const relativeSpeed=Math.hypot(aircraft.vx-T.vx,aircraft.vy-T.vy,aircraft.vz-T.vz);
    const distance=Math.hypot(alongError,lateralError,verticalError);
    const distanceToTanker=Math.hypot(dx,dy,z);
    const headingError=wrapAngle(aircraft.heading-T.heading);
    const bearingDeg=wrapAngle(Math.atan2(T.x-aircraft.x,T.y-aircraft.y)-aircraft.heading)*180/Math.PI;
    const closureMps=distanceToTanker>1e-6?
      -((aircraft.x-T.x)*(aircraft.vx-T.vx)+(aircraft.y-T.y)*(aircraft.vy-T.vy)+
        (aircraft.z-T.z)*(aircraft.vz-T.vz))/distanceToTanker:0;
    return {forward,right,z,alongError,lateralError,verticalError,relativeSpeed,
      distance,distanceToTanker,headingError,bearingDeg,closureMps,
      contactOk:Math.abs(alongError)<=CONTACT.alongTolerance&&
      Math.abs(lateralError)<=CONTACT.lateralTolerance&&
      Math.abs(verticalError)<=CONTACT.verticalTolerance&&
      relativeSpeed<=CONTACT.maxRelativeSpeed&&
      Math.abs(headingError)<=CONTACT.maxHeadingRad&&
      Math.abs(aircraft.bank)<=CONTACT.maxBankRad};
  }
  function warning(fuel,maxFuel,flowLps){
    const pct=maxFuel>0?100*clamp(fuel/maxFuel,0,1):0;
    const seconds=flowLps>1e-5?fuel/flowLps:Infinity;
    const severity=fuel<=0?"EMPTY":pct<=7||seconds<=70?"CRITICAL":pct<=15||seconds<=150?"BINGO":pct<=30||seconds<=300?"LOW":"NORMAL";
    return {pct,seconds,severity};
  }
  function tick(m,aircraft,dt,maxFuel){
    if(!m||!m.active)return {event:null,addedL:0,guidance:null};
    const T=m.tanker;
    T.x+=T.vx*dt;T.y+=T.vy*dt;T.z+=T.vz*dt;
    const g=guidance(m,aircraft);
    let event=null,addedL=0;
    if(g.distanceToTanker<19){
      m.status="COLLISION";m.active=false;m.connected=false;
      m.request=false;m.hold=0;return {event:"TANKER COLLISION",addedL,guidance:g};
    }
    if(m.status==="COMPLETE")return {event:null,addedL,guidance:g};
    if(m.connected&&!g.contactOk){
      m.connected=false;m.hold=0;m.disconnects++;
      event="BOOM DISCONNECT — ENVELOPE EXIT";
    }
    if(m.connected){
      m.status="TRANSFERRING";
      addedL=Math.min(CONTACT.transferLps*dt,Math.max(0,maxFuel-aircraft.fuel),m.reserveL);
      if(addedL>0){aircraft.fuel+=addedL;m.reserveL-=addedL;m.transferredL+=addedL;}
      if(aircraft.fuel>=maxFuel-1e-6||m.reserveL<=1e-6){
        m.connected=false;m.request=false;m.status="COMPLETE";
        event=m.reserveL<=1e-6?"TANKER FUEL DEPLETED":"TRANSFER COMPLETE";
      }
    }else if(m.request&&g.contactOk&&m.reserveL>0&&aircraft.fuel<maxFuel){
      m.hold+=dt;m.status="STABILIZE";
      if(m.hold+1e-9>=CONTACT.holdSeconds){
        m.connected=true;m.contacted=true;m.status="TRANSFERRING";
        event="BOOM CONNECTED";
      }
    }else{
      m.hold=0;
      m.status=g.distance>300?"RENDEZVOUS":g.distance>25?"APPROACH":m.request?"ALIGN":"WAIT CLEARANCE";
    }
    if(event)m.lastEvent=event;
    return {event,addedL,guidance:g};
  }
  return Object.freeze({CONTACT,makeMission,guidance,warning,tick});
});
