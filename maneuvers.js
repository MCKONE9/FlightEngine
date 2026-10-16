/* FlightEngine 0.8 — deterministic, attitude-command maneuver director.
   Arcade flight-path assistance, NOT an F-16 flight-control law or certified autopilot.
   Pure calculations: no DOM, timing, I/O or physics state mutation. */
(function(root){
  "use strict";
  const RAD=Math.PI/180;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const smoothstep=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  const definitions=Object.freeze([
    null,
    Object.freeze({id:1,name:"SOL DÖNÜŞ",detail:"32° bank · yumuşak dönüş",duration:8,minAlt:120,minSpeed:65}),
    Object.freeze({id:2,name:"SAĞ DÖNÜŞ",detail:"32° bank · yumuşak dönüş",duration:8,minAlt:120,minSpeed:65}),
    Object.freeze({id:3,name:"TIRMANIŞ",detail:"+12° burun · kontrollü",duration:9,minAlt:120,minSpeed:75}),
    Object.freeze({id:4,name:"BURUN AŞAĞI",detail:"−8° pitch · alçalma girişimi",duration:8,minAlt:380,minSpeed:65}),
    Object.freeze({id:5,name:"S DÖNÜŞÜ",detail:"Sol/sağ 30° dönüş",duration:16,minAlt:180,minSpeed:75}),
    Object.freeze({id:6,name:"TIRMANAN DÖNÜŞ",detail:"28° bank · +10° burun",duration:11,minAlt:220,minSpeed:80}),
    Object.freeze({id:7,name:"KESKİN SOL",detail:"52° bank · yüksek G",duration:10,minAlt:280,minSpeed:85}),
    Object.freeze({id:8,name:"KESKİN SAĞ",detail:"52° bank · yüksek G",duration:10,minAlt:280,minSpeed:85}),
    Object.freeze({id:9,name:"DÜZELT / TOPARLA",detail:"Kanatları ve burnu düzelt",duration:6,minAlt:0,minSpeed:0})
  ]);
  function definition(id){return Number.isInteger(id)&&id>=1&&id<=9?definitions[id]:null;}
  function assess(id,state){
    const def=definition(id);
    if(!def)return {ok:false,reason:"Bilinmeyen manevra"};
    if(state.onGround)return {ok:false,reason:"Manevra için önce kalkış yap"};
    const speed=Math.hypot(state.vx,state.vy,state.vz);
    if(id!==9){
      if(speed<def.minSpeed)return {ok:false,reason:`Hız düşük (${Math.round(speed)} < ${def.minSpeed} m/s)`};
      if(state.z<def.minAlt)return {ok:false,reason:`İrtifa düşük (${Math.round(state.z)} < ${def.minAlt} m)`};
      if(state.stall)return {ok:false,reason:"Stall durumunda yalnızca NUM9 toparlama kullanılabilir"};
      if(state.loadFactorG>=8.2)return {ok:false,reason:"G yükü yüksek; manevra başlatılmadı"};
    }
    if(!Number.isFinite(speed)||!Number.isFinite(state.pitch)||!Number.isFinite(state.bank))return {ok:false,reason:"Geçersiz uçuş durumu"};
    return {ok:true,reason:""};
  }
  function profile(id,elapsed){
    const d=definition(id);if(!d)throw new RangeError("Invalid maneuver number");
    const t=clamp(elapsed,0,d.duration), out=smoothstep(t/1.8)*smoothstep((d.duration-t)/2.4);
    let bank=0,pitch=0;
    switch(id){
      case 1:bank=-32;pitch=5;break;
      case 2:bank=32;pitch=5;break;
      case 3:pitch=12;break;
      case 4:pitch=-8;break;
      case 5:{
        // Smooth zero crossing, avoids instantaneous reversal and control spikes.
        const sign=t<d.duration/2?-1:1;
        const half=t<d.duration/2?t:d.duration-t;
        bank=sign*30*smoothstep(half/1.7);
        pitch=5;break;
      }
      case 6:bank=28;pitch=10;break;
      case 7:bank=-52;pitch=8;break;
      case 8:bank=52;pitch=8;break;
      case 9:pitch=3;break;
    }
    return {bank:bank*RAD*out,pitch:pitch*RAD*out,progress:t/d.duration,finished:elapsed>=d.duration};
  }
  function guidance(desired,actual){
    // The existing engine maps pitch input to 0.55 rad/s, roll input to 2.2 rad/s.
    // Use proportional *rate* commands with saturation, not attitude teleportation.
    const kp=2.8,kr=2.7;
    return {
      pitch:clamp(kp*(desired.pitch-actual.pitch)/.55,-1,1),
      roll:clamp(kr*(desired.bank-actual.bank)/2.2,-1,1),
      yaw:0
    };
  }
  if(typeof module!=="undefined"&&module.exports)module.exports={definitions,definition,assess,profile,guidance};
  root.FlightManeuvers={definitions,definition,assess,profile,guidance};
})(typeof window!=="undefined"?window:globalThis);
