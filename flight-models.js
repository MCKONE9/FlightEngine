/* Educational distinct handling envelopes, not manufacturer-approved flight data.
   Coordinates: x east, y north, z up; angles radians; speeds m/s; time seconds.
   No model is a certified aircraft simulator.  Pure helpers enable deterministic tests. */
(function(root, factory){
  'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FlightModels=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const g=9.80665;
  const profiles=Object.freeze({
    F16: Object.freeze({name:'F-16C',kind:'jet',pitchRate:.55,rollRate:2.2,yawRate:.50,maxBank:1.45,maxPitch:1.5,
      aeroLift:1,aeroDrag:1,flapLift:1,stallAoA:15.5,transonic:.82,thrust:1,afterburner:true,
      fuelFactor:1,ceiling:12000,hoverCollective:null,rotorResponse:0}),
    B737: Object.freeze({name:'737-800',kind:'airliner',pitchRate:.19,rollRate:.47,yawRate:.17,maxBank:.62,maxPitch:.36,
      aeroLift:1.17,aeroDrag:1.03,flapLift:1.85,stallAoA:13.5,transonic:.75,thrust:2.8,afterburner:false,
      fuelFactor:3.5,ceiling:12500,hoverCollective:null,rotorResponse:0}),
    SR71: Object.freeze({name:'SR-71',kind:'recon',pitchRate:.19,rollRate:.54,yawRate:.12,maxBank:1.05,maxPitch:.65,
      aeroLift:.80,aeroDrag:.76,flapLift:1.15,stallAoA:12,transonic:2.95,thrust:2.4,afterburner:true,
      fuelFactor:6,ceiling:26000,hoverCollective:null,rotorResponse:0}),
    AH1: Object.freeze({name:'AH-1 Cobra',kind:'rotor',pitchRate:.43,rollRate:.72,yawRate:.82,maxBank:.43,maxPitch:.39,
      hoverCollective:.58,rotorResponse:.9,collectiveResponse:1.4,translateAccel:7.0,lateralAccel:6.1,
      linearDamping:.17,verticalDamping:.27,verticalAuthority:1.35,maxSpeed:95,fuelFactor:.56,ceiling:3700}),
    AH64: Object.freeze({name:'AH-64 Apache',kind:'rotor',pitchRate:.29,rollRate:.50,yawRate:.57,maxBank:.36,maxPitch:.31,
      hoverCollective:.62,rotorResponse:1.9,collectiveResponse:1.0,translateAccel:5.7,lateralAccel:4.8,
      linearDamping:.23,verticalDamping:.31,verticalAuthority:1.06,maxSpeed:85,fuelFactor:1.05,ceiling:6100}),
    AH6: Object.freeze({name:'AH-6 Little Bird',kind:'rotor',pitchRate:.74,rollRate:1.24,yawRate:1.35,maxBank:.62,maxPitch:.52,
      hoverCollective:.53,rotorResponse:.55,collectiveResponse:2.1,translateAccel:10.5,lateralAccel:9.4,
      linearDamping:.16,verticalDamping:.21,verticalAuthority:1.75,maxSpeed:80,fuelFactor:.37,ceiling:4100})
  });
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function rotorAcceleration(model,state){
    if(model.kind!=='rotor')throw Error('rotorcraft profile required');
    const rpm=clamp(state.rotorRPM,0,1.05);
    const power=state.engine==='RUNNING'?rpm*rpm:0;
    // collective shifts vertical acceleration around the hover trim; tilted disc
    // loses vertical thrust. Pedals control yaw independently of forward speed.
    const collective=clamp(state.collective,0,1);
    const verticalThrust=power*g*(1+(collective-model.hoverCollective)*model.collectiveResponse);
    const tiltFactor=Math.max(.65,Math.cos(state.pitch)*Math.cos(state.bank));
    const forward=power*(-Math.sin(state.pitch))*model.translateAccel;
    const lateral=power*Math.sin(state.bank)*model.lateralAccel;
    let ax=forward*Math.sin(state.heading)+lateral*Math.cos(state.heading)-state.vx*model.linearDamping;
    let ay=forward*Math.cos(state.heading)-lateral*Math.sin(state.heading)-state.vy*model.linearDamping;
    // Horizontal speed naturally decays towards airframe drag limits.
    const speed=Math.hypot(state.vx,state.vy);
    if(speed>model.maxSpeed){const excess=(speed-model.maxSpeed)*.7;ax-=state.vx/speed*excess;ay-=state.vy/speed*excess;}
    const az=verticalThrust*tiltFactor-g-state.vz*model.verticalDamping;
    return {ax,ay,az,loadFactorG:verticalThrust*tiltFactor/g};
  }
  function aeroForces(model,aoaDeg,q,wing,mach,ground=false){
    if(model.kind==='rotor')return {lift:0,drag:0};
    // Common illustrative coefficient family; aircraft-specific calibration factors.
    const baseCL=Math.max(-.8,Math.min(1.35,.15+.095*aoaDeg));
    const cl=ground?baseCL*model.flapLift:baseCL*model.aeroLift;
    const cd=(.022+.046*cl*cl)*model.aeroDrag*(mach>model.transonic?1+Math.pow(mach-model.transonic,2)*16:1);
    return {lift:q*wing*cl,drag:q*wing*cd,cl,cd};
  }
  function rpmNext(current,engine,dt,model){
    const target=engine==='RUNNING'?1:0;
    return clamp(current+(target-current)*(1-Math.exp(-dt/Math.max(.1,model.rotorResponse||1))),0,1);
  }
  function isReadyForRotorLift(model,engine,rotorRPM,collective){
    return model.kind==='rotor'&&engine==='RUNNING'&&rotorRPM>.83&&collective>model.hoverCollective+.09;
  }
  return Object.freeze({profiles,rotorAcceleration,aeroForces,rpmNext,isReadyForRotorLift});
});
