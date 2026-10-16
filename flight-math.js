/* Pure, dependency-free flight and telemetry helpers. Unit contracts: SI unless stated. */
(function(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FlightMath = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  const G=9.80665, STEP=1/60, RHO0=1.225, DEG=180/Math.PI, RAD=Math.PI/180;
  const MIL_THRUST=76000, AB_THRUST=120000;
  const AOA_BK=[-30,-25,-20,-15,-10,-5,0,5,10,15,20,25,30,45,60,90];
  // Sandbox low-AoA trim correction. The older CL(0°)=1.06 created runaway
  // climbs at ~110 m/s with level pitch. These are illustrative coefficients,
  // NOT validated F-16 wind-tunnel/flight-test data.
  const CL_TAB=[-0.72,-0.66,-0.60,-0.52,-0.38,-0.22,0.15,0.65,1.10,1.34,1.18,0.90,0.62,0.27,0.09,0.02];
  const CD_AOA=[-40,-15,0,10,20,30,45,60,90];
  const CD_TAB=[0.24,0.045,0.020,0.040,0.086,0.170,0.310,0.640,1.100];
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const smooth=(c,t,r,dt)=>c+clamp(t-c,-r*dt,r*dt);
  function interp(x,bk,tab){
    if(x<=bk[0])return tab[0];
    for(let i=1;i<bk.length;i++)if(x<=bk[i]){
      const t=(x-bk[i-1])/(bk[i]-bk[i-1]);
      return tab[i-1]+t*(tab[i]-tab[i-1]);
    }
    return tab[tab.length-1];
  }
  const clOf=a=>interp(a,AOA_BK,CL_TAB);
  const cdOf=a=>interp(a,CD_AOA,CD_TAB);
  function atm(h){
    h=clamp(h,-500,20000);
    let T,p;
    if(h<=11000){T=288.15-0.0065*h;p=101325*Math.pow(T/288.15,5.25588);}
    else{T=216.65;p=101325*Math.pow(216.65/288.15,5.25588)*Math.exp(-G*(h-11000)/(287.05287*216.65));}
    return {T,rho:p/(287.05287*T),pressure:p,soundSpeed:Math.sqrt(1.4*287.05287*T)};
  }
  // AB_THRUST is TOTAL wet thrust, not an additional thrust contribution.
  // Both military and AB values describe a simplified sea-level envelope.
  function engineThrust(engine,throttleSpool,afterburnerSpool,altitudeM,ceilingM){
    if(engine!=="RUNNING")return 0;
    const dry=MIL_THRUST*clamp(throttleSpool,0,1);
    const wet=dry+(AB_THRUST-dry)*clamp(afterburnerSpool,0,1);
    let T=wet*(0.35+0.65*Math.min(1,atm(altitudeM).rho/RHO0));
    if(altitudeM>ceilingM)T*=Math.max(0.05,1-(altitudeM-ceilingM)/1500);
    return T;
  }
  // Quote RFC-4180 style text and protect spreadsheet formulas on CSV import.
  function csvCell(value){
    if(typeof value==="number")return Number.isFinite(value)?String(+value.toFixed(3)):"";
    const s=String(value??"");
    const safe=/^[\s]*[=+@-]/.test(s)?"'"+s:s;
    return /[",\r\n]/.test(safe)||safe!==s?'"'+safe.replace(/"/g,'""')+'"':safe;
  }
  return Object.freeze({G,STEP,RHO0,DEG,RAD,MIL_THRUST,AB_THRUST,clamp,smooth,interp,clOf,cdOf,atm,engineThrust,csvCell});
});
