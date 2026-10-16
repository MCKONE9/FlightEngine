"""Reproducible *local* Chromium CPU-side Canvas benchmark (not a GPU/FPS guarantee).
Run after installing Playwright and Chromium: python tests/bench_render.py
"""
from pathlib import Path
from statistics import median
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'knox-falcon-sim.html').read_text(encoding='utf-8')
for name in ('flight-math.js','aircraft-mesh.js','maneuvers.js','air-refueling.js','tanker-mesh.js','combat-missions.js','combat-visuals.js','fleet-mesh.js','flight-models.js','obstacle-course.js'):
    original=f'<script src="{name}"></script>'
    if original not in html:
        raise RuntimeError(f'Missing dependency {name}')
    html=html.replace(original, '<script>'+(ROOT / name).read_text(encoding='utf-8')+'</script>')

with sync_playwright() as pw:
    options={"headless":True,"args":["--no-sandbox"]}
    if Path("/usr/bin/chromium").is_file():
        options["executable_path"]="/usr/bin/chromium"
    browser = pw.chromium.launch(**options)
    for width, height in ((1440,900),(390,844)):
        page=browser.new_page(viewport={'width':width,'height':height})
        page.set_content(html,wait_until='load')
        measurements=page.evaluate('''() => {
          if(S.running)togglePause();
          const out={};
          startFuelEmergency();
          if(S.running)togglePause();
          for(const mode of ['chase','model']){
            sceneView=mode;updViewLabel();
            for(let i=0;i<15;i++)drawScene();
            const samples=[];
            for(let i=0;i<160;i++){
              const before=performance.now();drawScene();
              samples.push(performance.now()-before);
            }
            out[mode]={samples, visible:flightPerf.drawnFaces, total:flightPerf.faces};
          }
          startGroundMission();
          if(S.running)togglePause();
          Object.assign(S,{x:620,y:3320,z:240,pitch:-.30,heading:0,onGround:false});
          sceneView='chase';updViewLabel();
          for(let i=0;i<15;i++)drawScene();
          const samples=[];
          for(let i=0;i<160;i++){const before=performance.now();drawScene();samples.push(performance.now()-before);}
          out.combat_ground={samples,visible:combatGroundMeshes.G1.length,total:combatBaseFaces.length};
          startDogfightMission();if(S.running)togglePause();
          Object.assign(S,{x:0,y:0,z:1700,heading:0,pitch:0,onGround:false});
          Object.assign(combat.enemy,{x:10,y:260,z:1710});
          for(let i=0;i<15;i++)drawScene();
          const dogSamples=[];
          for(let i=0;i<160;i++){const before=performance.now();drawScene();dogSamples.push(performance.now()-before);}
          out.combat_air={samples:dogSamples,visible:FlightCombatVisuals.fighterFaces(combat.enemy).length,total:combat.threats.length};
          return out;
        }''')
        for mode,data in measurements.items():
            samples=sorted(data['samples'])
            print(f'{width}x{height}, {mode}: '
                  f'median {median(samples):.2f}ms, p95 {samples[int(len(samples)*.95)]:.2f}ms, '
                  f'{data["visible"]}/{data["total"]} faces submitted')
        page.close()
    browser.close()
