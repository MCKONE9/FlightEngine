"""Headless UI + simulation regression tests.

Use page.set_content to inline the local dependency and avoid file:// permission
restrictions; production HTML itself references the same file relative to the page.
Requires: pip install playwright ; python -m playwright install chromium
"""
from pathlib import Path
import os
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class FlightEngineBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        options = {'headless': True, 'args': ['--no-sandbox']}
        if os.environ.get('FLIGHTENGINE_CHROMIUM'):
            options['executable_path'] = os.environ['FLIGHTENGINE_CHROMIUM']
        elif Path('/usr/bin/chromium').is_file():
            options['executable_path'] = '/usr/bin/chromium'
        cls.browser = cls.pw.chromium.launch(**options)
        html = (ROOT / 'knox-falcon-sim.html').read_text(encoding='utf-8')
        math = (ROOT / 'flight-math.js').read_text(encoding='utf-8')
        mesh = (ROOT / 'aircraft-mesh.js').read_text(encoding='utf-8')
        maneuvers = (ROOT / 'maneuvers.js').read_text(encoding='utf-8')
        cls.html = html.replace('<script src="flight-math.js"></script>', '<script>' + math + '</script>')
        cls.html = cls.html.replace('<script src="aircraft-mesh.js"></script>', '<script>' + mesh + '</script>')
        cls.html = cls.html.replace('<script src="maneuvers.js"></script>', '<script>' + maneuvers + '</script>')
        for dep in ['air-refueling.js','tanker-mesh.js','combat-missions.js','combat-visuals.js','fleet-mesh.js','flight-models.js','obstacle-course.js']:
            source=(ROOT/dep).read_text(encoding='utf-8')
            cls.html=cls.html.replace('<script src="'+dep+'"></script>','<script>'+source+'</script>')
        if '<script src="' in cls.html:
            raise AssertionError('missing inline dependency')

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.errors = []
        self.page = self.browser.new_page(viewport={'width': 1440, 'height': 900})
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.set_content(self.html, wait_until='load')
        # Automatic RAF is paused for deterministic explicit simulation stepping.
        self.page.evaluate('togglePause()')

    def tearDown(self):
        try:
            self.assertEqual([], self.errors, 'Uncaught browser JavaScript errors')
        finally:
            self.page.close()

    def js(self, code):
        return self.page.evaluate(code)

    def test_boot_and_pause(self):
        self.assertEqual(self.js('S.engine'), 'RUNNING')
        self.assertEqual(self.js('S.thrSpool'), 0)
        self.assertFalse(self.js('S.running'))
        self.assertEqual(self.page.locator('#tele td.n').count(), 35)
        self.assertEqual(self.page.locator('#btnPause').get_attribute('aria-pressed'), 'true')
        self.js('step(STEP)')
        self.assertGreater(self.js('S.simTime'), 0)

    def test_takeoff_requires_real_lift_and_not_repeatedly_triggered(self):
        result = self.js('''() => {
          resetSim();togglePause();sliderVal=100;
          key.pitchDown=true;
          for(let i=0;i<15/STEP;i++)step(STEP);
          return {flights:S.stats.flights,z:S.z,ground:S.onGround,speed:S.telemCache.speedMps};
        }''')
        self.assertEqual(result['flights'], 1, result)
        self.assertGreater(result['z'], 2, result)
        self.assertFalse(result['ground'], result)
        self.assertGreater(result['speed'], 50, result)

    def test_stall_and_hard_landing_damage(self):
        stall = self.js('''() => {
          resetSim();togglePause();S.options.arcade=false;
          S.onGround=false;S.z=500;S.vx=0;S.vy=110;S.vz=0;S.pitch=0.45;
          step(STEP);return {stall:S.stall,count:S.stats.stalls};
        }''')
        self.assertTrue(stall['stall'], stall)
        landed = self.js('''() => {
          S.onGround=false;S.z=2;S.vx=0;S.vy=40;S.vz=-20;S.pitch=0;
          step(STEP);return {ground:S.onGround,damage:S.parts.FlightHydraulics,hits:S.stats.hardLandings};
        }''')
        self.assertTrue(landed['ground'], landed)
        self.assertLess(landed['damage'], 100)
        self.assertEqual(landed['hits'], 1)

    def test_recording_samples_and_reset(self):
        result=self.js('''() => {
          resetSim();togglePause();toggleRecord();
          for(let i=0;i<3/STEP;i++)step(STEP);
          const row=S.record.samples.at(-1);
          return {n:S.record.samples.length,delta:Math.abs(row.speedMps-Math.hypot(row.velocityXMps,row.velocityYMps,row.velocityZMps)),status:S.record.on};
        }''')
        self.assertGreaterEqual(result['n'], 5)
        self.assertLess(result['delta'], 1e-6)
        self.assertTrue(result['status'])
        self.js('resetSim()')
        self.assertEqual(self.js('S.record.samples.length'),0)
        self.assertEqual(self.js('S.gunShotRemainder'),0)
        self.assertIsNone(self.js('S.rocketImpactAt'))

    def test_bounded_recording_stops_without_losing_samples(self):
        result=self.js('''() => {
          resetSim();togglePause();toggleRecord();
          S.record.samples=Array(MAX_RECORD_SAMPLES-1).fill({t:0});
          S.record.t=S.record.every;
          step(STEP);
          return {n:S.record.samples.length,on:S.record.on,message:document.getElementById('recInfo').textContent};
        }''')
        self.assertEqual(result['n'],12000)
        self.assertFalse(result['on'])
        self.assertIn('LİMİT',result['message'])

    def test_rocket_uses_sim_time_and_reset_cancels_pending_effect(self):
        result=self.js('''() => {
          resetSim();togglePause();S.armed=true;S.z=100;S.onGround=false;
          fireRocket();const before=S.rocketImpactAt;
          for(let i=0;i<60/30/STEP;i++)step(STEP);
          return {before,after:S.rocketImpactAt,weapon:S.weaponStatus,rockets:S.rockets};
        }''')
        self.assertIsNotNone(result['before'])
        self.assertIsNone(result['after'])
        self.assertEqual(result['weapon'],'ROCKET IMPACT')
        self.assertEqual(result['rockets'],11)
        self.js('resetSim()')
        self.assertIsNone(self.js('S.rocketImpactAt'))

    def test_cannon_is_rate_limited_by_time_and_cannot_overdraw(self):
        result=self.js('''() => {
          resetSim();togglePause();S.armed=true;S.gunRounds=5;key.cannon=true;
          for(let i=0;i<30/30/STEP;i++)step(STEP);
          return {ammo:S.gunRounds,fired:S.stats.gunFired};
        }''')
        self.assertEqual(result['ammo'],0)
        self.assertEqual(result['fired'],5)

    def test_engine_start_stop_and_fuel_inhibit(self):
        result=self.js('''() => {
          resetSim();togglePause();toggleEngine();
          for(let i=0;i<80/30/STEP;i++)step(STEP);
          const off=S.engine;
          S.fuel=0;toggleEngine();const inhibited=S.engine;
          S.fuel=50;toggleEngine();
          for(let i=0;i<80/30/STEP;i++)step(STEP);
          return {off,inhibited,running:S.engine,spool:S.spool};
        }''')
        self.assertEqual(result['off'],'OFF')
        self.assertEqual(result['inhibited'],'OFF')
        self.assertEqual(result['running'],'RUNNING')
        self.assertEqual(result['spool'],1)

    def test_free_and_arcade_assistance_are_functional(self):
        r=self.js('''() => {
          resetSim();togglePause();S.onGround=false;S.z=500;
          S.vx=0;S.vy=100;S.vz=0;S.pitch=0.5;S.bank=1.3;
          S.options.free=false;S.options.arcade=true;
          step(STEP);
          return {bank:S.bank,pitch:S.pitch,aoa:S.aoa};
        }''')
        self.assertLessEqual(abs(r['bank']),0.9)
        self.assertLessEqual(r['pitch'],0.3)

    def test_long_simulation_remains_numerically_finite(self):
        r=self.js('''() => {
          resetSim();togglePause();sliderVal=100;key.pitchDown=true;
          for(let i=0;i<1600/30/STEP;i++)step(STEP);
          return {
            values:Object.values(S.telemCache).every(v=>Number.isFinite(v)),
            fuel:S.fuel,flights:S.stats.flights,
            parts:Object.values(S.parts).every(v=>v>=0&&v<=100)
          };
        }''')
        self.assertTrue(r['values'],r)
        self.assertGreaterEqual(r['fuel'],0)
        self.assertTrue(r['parts'],r)
        self.assertEqual(r['flights'],1)

    def test_keyboard_repeat_and_modal_safety(self):
        self.page.evaluate('''() => window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG',repeat:true,bubbles:true}))''')
        self.assertFalse(self.js('S.armed'))
        self.page.locator('#btnAnalysis').click()
        self.assertIn('open',self.page.locator('#mAnalysis').get_attribute('class'))
        self.page.keyboard.press('Escape')
        self.assertNotIn('open',self.page.locator('#mAnalysis').get_attribute('class'))

    def test_mobile_layout_and_pointer_controls(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.assertEqual(self.page.locator('.touch-controls').evaluate('(e)=>getComputedStyle(e).display'),'flex')
        self.page.locator('#touchPitchDown').scroll_into_view_if_needed()
        self.page.locator('#touchPitchDown').hover()
        self.page.mouse.down()
        self.assertTrue(self.js('key.pitchDown'))
        self.page.mouse.up()
        self.assertFalse(self.js('key.pitchDown'))
        self.assertLess(self.js('document.body.scrollWidth-window.innerWidth'),12)

    def test_polygon_camera_orbit_and_wireframe(self):
        r=self.js("() => ({faces:FlightAircraft.faces.length,triangles:FlightAircraft.triangleEstimate,view:sceneView,dims:FlightAircraft.dimensions})")
        self.assertGreater(r['faces'],200)
        self.assertEqual(r['dims'],{'length':14.8,'wingspan':9.8,'height':4.8})
        self.assertEqual(r['view'],'chase')
        self.page.locator('#btnView').click()
        self.assertEqual(self.js('sceneView'),'cockpit')
        self.page.locator('#btnView').click()
        self.assertEqual(self.js('sceneView'),'model')
        rect=self.page.locator('#scene').bounding_box()
        self.page.mouse.move(rect['x']+120,rect['y']+150)
        self.page.mouse.down()
        self.page.mouse.move(rect['x']+200,rect['y']+180,steps=6)
        self.page.mouse.up()
        self.assertNotEqual(self.js('orbitAz'),0.55)
        self.page.locator('#btnWire').click()
        self.assertTrue(self.js('showWire'))
        self.js('drawScene()')
        self.assertGreater(self.js('flightPerf.drawnFaces'),100)

    def test_render_loop_preserves_canvas_allocation_and_runs_at_full_rate(self):
        result=self.js('''() => {
          drawScene();const initial=flightPerf.resizeCount;
          for(let i=0;i<40;i++)drawScene();
          return {before:initial,after:flightPerf.resizeCount,drawn:flightPerf.drawnFaces,
                  frames:flightPerf.frames,ms:flightPerf.renderAvgMs};
        }''')
        self.assertEqual(result['before'],result['after'])
        self.assertGreater(result['drawn'],100)
        self.assertTrue(0<=result['ms']<100)
        self.assertGreaterEqual(result['frames'],41)

    def test_export_and_analysis(self):
        result=self.js('''() => {
          resetSim();togglePause();toggleRecord();
          for(let i=0;i<80/30/STEP;i++)step(STEP);
          let output=null;
          download=(name,text,mime)=>output={name,text,mime};
          exportCSV();const csv=output;
          exportJSON();const json=JSON.parse(output.text);
          openAnalysis();
          return {csv, jsonCount:json.samples.length, charts:document.querySelectorAll('#anaCharts canvas').length};
        }''')
        self.assertIn('altitudeM',result['csv']['text'])
        self.assertIn('maneuverId',result['csv']['text'])
        self.assertIn('maneuverName',result['csv']['text'])
        self.assertGreater(result['jsonCount'],2)
        self.assertEqual(result['charts'],9)

    def test_numpad_control_panel_and_ground_gate(self):
        self.assertEqual(self.page.locator('#maneuverGrid button').count(),9)
        self.js('S.running=true')
        self.page.keyboard.press('Numpad1')
        self.assertIsNone(self.js('activeManeuver'))
        self.assertIn('RED',self.page.locator('#maneuverStatus').inner_text())
        self.assertTrue(self.js('FlightManeuvers.definitions[8].name'))

    def test_numpad_guides_real_bank_then_returns_to_level(self):
        r=self.js('''() => {
            resetSim();S.running=true;
            S.onGround=false;S.z=1000;S.vy=130;S.vz=0;S.pitch=0;S.bank=0;
            const started=startManeuver(1);
            for(let i=0;i<120/30/STEP;i++)step(STEP);
            const mid={bank:S.bank,heading:S.heading,active:!!activeManeuver};
            for(let i=0;i<220/30/STEP;i++)step(STEP);
            return {started,mid,bank:S.bank,active:activeManeuver,
                z:S.z,speed:Math.hypot(S.vx,S.vy,S.vz),messages:document.querySelectorAll('#logList div').length};
        }''')
        self.assertTrue(r['started'],r)
        self.assertTrue(r['mid']['active'],r)
        self.assertLess(r['mid']['bank'],-0.20,r)
        self.assertLess(r['mid']['heading'],0,r)
        self.assertIsNone(r['active'],r)
        self.assertLess(abs(r['bank']),.20,r)

    def test_numpad_manual_override_escape_and_reset(self):
        r=self.js('''() => {
          S.running=true;S.onGround=false;S.z=1000;S.vy=135;
          const start=startManeuver(2);
          key.rollL=true;step(STEP);
          const override=activeManeuver===null;
          key.rollL=false;
          startManeuver(3);
          window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}));
          const esc=activeManeuver===null;
          startManeuver(9);
          resetSim();
          return {start,override,esc,reset:activeManeuver===null};
        }''')
        self.assertTrue(all(r.values()),r)

    def test_numpad_flight_envelope_and_sample_annotation(self):
        r=self.js('''() => {
          S.running=true;S.onGround=false;S.z=120;S.vy=130;
          const rejectDive=!startManeuver(4);
          S.z=1000;const start=startManeuver(3);
          toggleRecord();step(STEP);
          for(let i=0;i<18/30/STEP;i++)step(STEP);
          const row=S.record.samples.at(-1);
          S.stall=true;step(STEP);
          return {rejectDive,start,sample:row?.maneuverId,cancel:activeManeuver===null};
        }''')
        self.assertTrue(r['rejectDive'],r)
        self.assertTrue(r['start'],r)
        self.assertEqual(r['sample'],3,r)
        self.assertTrue(r['cancel'],r)

    def test_all_nine_commands_complete_without_nonfinite_flight_state(self):
        r=self.js('''() => {
          const samples=[];
          for(let id=1;id<=9;id++){
            resetSim();S.running=true;S.onGround=false;S.z=1200;S.vx=0;S.vy=125;S.vz=0;
            const start=startManeuver(id),duration=FlightManeuvers.definition(id).duration;
            for(let i=0;i<Math.ceil((duration+2)/STEP);i++)step(STEP);
            samples.push({id,start,finished:activeManeuver===null,
              status:lastManeuverMessage,finite:Object.values(S.telemCache).every(Number.isFinite)});
          }
          return samples;
        }''')
        self.assertEqual(len(r),9)
        self.assertTrue(all(v['start'] and v['finished'] and v['finite'] and 'tamamlandı' in v['status'] for v in r),r)

    def test_low_fuel_mission_air_start_and_guidance(self):
        result=self.js('''() => {
          const ok=startFuelEmergency();S.running=false;
          const g=S.refuelGuidance;
          return {ok,onGround:S.onGround,engine:S.engine,fuel:S.fuel,
            warning:S.fuelAlert.severity,range:g.distanceToTanker,bearing:g.bearingDeg,
            tanker:!!S.mission?.active,buttons:!!document.getElementById('btnContact')};
        }''')
        self.assertTrue(result['ok'])
        self.assertFalse(result['onGround'])
        self.assertEqual(result['engine'],'RUNNING')
        self.assertEqual(result['warning'],'BINGO')
        self.assertTrue(result['tanker'])
        self.assertTrue(result['buttons'])
        self.assertLess(result['range'],500)
        self.assertGreater(result['range'],350)
        self.assertAlmostEqual(result['bearing'],0,delta=3)

    def test_tanker_request_does_not_refuel_at_distance(self):
        result=self.js('''() => {
          startFuelEmergency();S.running=false;
          const accepted=requestContact(),before=S.fuel;
          for(let i=0;i<180/30/STEP;i++)step(STEP);
          return {accepted,before,after:S.fuel,added:S.mission.transferredL,
            dock:S.refuelGuidance.distance,status:S.mission.status};
        }''')
        self.assertTrue(result['accepted'])
        self.assertEqual(result['added'],0)
        self.assertLess(result['after'],result['before'])

    def test_refueling_requires_stable_station_and_updates_telemetry(self):
        result=self.js('''() => {
          startFuelEmergency();S.running=false;
          const T=S.mission.tanker;
          Object.assign(S,{x:T.x,y:T.y-45,z:T.z-8,vx:0,vy:110,vz:0,pitch:.065,bank:0,thrSpool:.07});
          sliderVal=7;
          requestContact();toggleRecord();
          for(let i=0;i<125/30/STEP;i++)step(STEP);
          const rec=S.record.samples.at(-1);
          return {connected:S.mission.connected,added:S.mission.transferredL,
            fuel:S.fuel,record:rec,finite:Object.values(S.telemCache).every(Number.isFinite),
            scene:FlightTankerMesh.faces.length};
        }''')
        self.assertTrue(result['connected'],result)
        self.assertGreater(result['added'],10,result)
        self.assertGreater(result['fuel'],42,result)
        self.assertTrue(result['finite'])
        self.assertGreater(result['record']['fuelL'],42)
        self.assertEqual(result['record']['tankerState'],'TRANSFERRING')
        self.assertGreater(result['scene'],50)

    def test_emergency_fuel_starvation_and_engine_start_block(self):
        result=self.js('''() => {
          resetSim();S.running=false;S.fuel=.0001;sliderVal=60;
          step(STEP);
          return {engine:S.engine,fuel:S.fuel,severity:S.fuelAlert.severity,warn:S.warn};
        }''')
        self.assertEqual(result['fuel'],0)
        self.assertEqual(result['engine'],'STOPPING')
        self.assertEqual(result['severity'],'EMPTY')
        self.assertEqual(result['warn'],'FUEL EMPTY')

    def test_tanker_renderer_and_mission_reset(self):
        result=self.js('''() => {
          startFuelEmergency();S.running=false;
          const T=S.mission.tanker;
          S.x=T.x;S.y=T.y-180;S.z=T.z-8;
          drawScene();const faces=flightPerf.tankerFaces;
          const resizes=flightPerf.resizeCount;
          for(let i=0;i<20/30/STEP;i++)drawScene();
          const stable=flightPerf.resizeCount===resizes;
          resetSim();drawScene();
          return {faces,stable,reset:S.mission===null,after:flightPerf.tankerFaces};
        }''')
        self.assertGreater(result['faces'],20,result)
        self.assertTrue(result['stable'])
        self.assertTrue(result['reset'])
        self.assertEqual(result['after'],0)

    def test_mobile_mission_controls_and_keyboard_repeat(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('#btnEmergency').click()
        self.assertIn('YAKIT İHMALİ',self.page.locator('#logList').inner_text())
        self.page.locator('#btnContact').click()
        self.assertEqual(self.page.locator('#btnContact').get_attribute('aria-pressed'),'true')
        self.page.locator('#btnAbortMission').click()
        self.assertIsNone(self.js('S.mission'))
        self.assertLess(self.js('document.body.scrollWidth-window.innerWidth'),12)

    def test_ground_sortie_render_and_armed_launch(self):
        self.page.locator('#btnGroundMission').click()
        result=self.js('''() => {
          S.running=false;drawScene();
          const initial={phase:combat.phase,targets:combat.targets.length,faces:combatGroundMeshes.G1.length};
          S.onGround=false;S.x=350;S.y=3050;S.z=370;
          S.vx=0;S.vy=100;S.vz=0;S.armed=true;
          const t=FlightCombat.selected(combat);
          S.heading=Math.atan2(t.x-S.x,t.y-S.y);
          S.pitch=Math.atan2(t.z-S.z,Math.hypot(t.x-S.x,t.y-S.y));
          combat.lockRequested=true;
          for(let i=0;i<33/30/STEP;i++)FlightCombat.tick(combat,S,STEP);
          const lock=combat.locked;
          const fired=fireCombatMissile('ground');
          for(let i=0;i<500&&t.health===2;i++)FlightCombat.tick(combat,S,STEP);
          drawScene();updateCombatUI();
          return {initial,lock,fired,ammo:combat.agm,hp:t.health,finite:Number.isFinite(S.x),
            hud:document.getElementById('combatGuidance').textContent};
        }''')
        self.assertEqual(result['initial']['phase'],'TAKEOFF')
        self.assertEqual(result['initial']['targets'],4)
        self.assertGreater(result['initial']['faces'],0)
        self.assertTrue(result['lock'],result)
        self.assertTrue(result['fired'],result)
        self.assertEqual(result['ammo'],5)
        self.assertEqual(result['hp'],1)
        self.assertTrue(result['finite'])
        self.assertIn('KOORD X',result['hud'])

    def test_dogfight_lock_flares_and_missile_combat(self):
        self.page.locator('#btnDogfight').click()
        result=self.js('''() => {
          S.running=false;S.armed=true;
          const e=combat.enemy;
          S.heading=Math.atan2(e.x-S.x,e.y-S.y);
          S.pitch=Math.atan2(e.z-S.z,Math.hypot(e.x-S.x,e.y-S.y));
          combat.lockRequested=true;
          // freeze AI to test radar acquisition in isolation
          for(let i=0;i<35/30/STEP;i++)FlightCombat.updateLock(combat,S,STEP);
          const lock=combat.locked;
          const launch=fireCombatMissile('air');
          combat.threats.push({x:S.x,y:S.y+330,z:S.z,ttl:10,speed:235});
          const n=S.flares;fireFlare();
          FlightCombat.tick(combat,S,STEP);
          drawScene();updateCombatUI();
          return {phase:combat.phase,lock,launch,ammo:combat.aam,flared:n-S.flares,
            threats:combat.threats.length,health:combat.health,readout:document.getElementById('combatStatus').textContent};
        }''')
        self.assertEqual(result['phase'],'DOGFIGHT')
        self.assertTrue(result['lock'],result)
        self.assertTrue(result['launch'],result)
        self.assertEqual(result['ammo'],3)
        self.assertEqual(result['flared'],1)
        self.assertEqual(result['threats'],0)
        self.assertEqual(result['health'],100)
        self.assertIn('DOGFIGHT',result['readout'])

    def test_missions_reset_and_mobile_controls(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('#btnGroundMission').click()
        self.assertEqual(self.js('combat.type'),'ground')
        self.page.locator('#btnDogfight').click()
        self.assertEqual(self.js('combat.type'),'air')
        self.page.locator('#btnCycleTarget').click()
        self.page.locator('#btnLockTarget').click()
        self.assertTrue(self.js('combat.lockRequested'))
        self.js('resetSim()')
        self.assertIsNone(self.js('combat'))
        self.assertEqual(self.page.locator('#combatStatus').inner_text(),'GÖREV SEÇİLMEDİ')
        self.assertLess(self.js('document.body.scrollWidth-window.innerWidth'),12)

    def test_combat_telemetry_and_keyboard_repeat(self):
        self.js('startDogfightMission();S.running=false;toggleRecord()')
        self.page.keyboard.press('j')
        self.page.keyboard.press('g')
        self.assertTrue(self.js('combat.lockRequested'))
        self.assertTrue(self.js('S.armed'))
        result=self.js('''() => {
          for(let i=0;i<20/30/STEP;i++)step(STEP);
          const row=S.record.samples.at(-1);
          return {row,phase:combat.phase,missile:combat.aam};
        }''')
        self.assertEqual(result['row']['combatPhase'],'DOGFIGHT')
        self.assertIn('combatScore',result['row'])
        self.assertGreaterEqual(result['row']['combatHealthPct'],0)

    def test_six_models_can_be_selected_without_nan(self):
        r=self.js('''() => {
          const result=[];
          for(const id of ['F16','B737','SR71','AH1','AH64','AH6']){
            if(!chooseAircraft(id))return false;
            S.running=false;
            for(let i=0;i<2/STEP;i++)step(STEP);
            drawScene();
            result.push({id,currentType,faces:AIRCRAFT.faces.length,
              finite:Object.values(S.telemCache).every(Number.isFinite),
              label:document.getElementById('aircraftMode').textContent,
              fuel:S.fuel});
          }
          return result;
        }''')
        self.assertEqual(len(r),6)
        self.assertTrue(all(x['id']==x['currentType'] and x['faces']>30 and x['finite'] and x['fuel']>0 for x in r),r)
        self.assertEqual(len({x['faces'] for x in r}),5)

    def test_distinct_heli_rotor_hover_and_collective(self):
        r=self.js('''() => {
          const a=[];
          for(const id of ['AH1','AH64','AH6']){
            chooseAircraft(id);S.running=false;
            sliderVal=85;
            for(let i=0;i<12/STEP;i++)step(STEP);
            a.push({id,alt:S.z,air:S.onGround===false,rpm:S.rotorRPM,
              verticalSpeed:S.vz});
          }
          return a;
        }''')
        self.assertTrue(all(x['air'] and x['alt']>10 and x['rpm']>.9 for x in r),r)
        self.assertGreater(r[2]['alt'],r[1]['alt'])

    def test_course_gate_crossing_and_user_feedback(self):
        r=self.js('''() => {
          chooseAircraft('AH6');startObstacleCourse();S.running=false;
          const g=course.objects[0];
          const before={x:g.x,y:g.y-10,z:g.z};
          Object.assign(S,{x:g.x,y:g.y+10,z:g.z});
          const events=FlightCourse.tick(course,before,S,4,S.simTime);
          updateCourseUI();drawScene();
          return {events,score:course.score,progress:course.index,
            status:document.getElementById('courseStatus').textContent,
            faces:flightPerf.faces};
        }''')
        self.assertEqual(r['progress'],1,r)
        self.assertGreater(r['score'],0,r)
        self.assertIn('1/9',r['status'])
        self.assertGreater(r['faces'],100)

    def test_passenger_and_recon_cannot_launch_f16_only_missions(self):
        r=self.js('''() => {
          chooseAircraft('B737');const a=startDogfightMission();
          chooseAircraft('SR71');const b=startGroundMission();
          return {a,b,combat:combat};
        }''')
        self.assertFalse(r['a']);self.assertFalse(r['b']);self.assertIsNone(r['combat'])

if __name__=='__main__':
    unittest.main()


