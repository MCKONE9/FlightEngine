# FlightEngine v1.1.0 — Polygon Fleet & Flight Course

Dependency-free experimental browser flight simulator with six textureless aircraft, a deterministic ring/pylon course, F-16 mission systems, telemetry, and fixed-step physics.

**Important:** The models are educational/arcade approximations, **not** manufacturer-verified aerodynamics, CAD, pilot training equipment, real targeting systems, or validated navigation data. Mission targets/coordinates are entirely fictional.

## Launch

Open `knox-falcon-sim.html` in a recent Chrome, Chromium, Firefox or Edge. Keep every `.js` file beside the HTML. No npm install or texture files. Tests use Node.js and Python Playwright; the game itself does not.

## Airframes / individual handling

| Selection | Class | Distinct approximate characteristics |
|---|---|---|
| F-16C | Fighter jet | Agile pitch/roll, high G, afterburner, refueling and combat missions |
| Boeing 737-800 | Civil passenger jet | Heavy mass, slow control response, airliner wing/power envelope, no afterburner |
| AH-1 Cobra | Helicopter | Moderate rotor acceleration, tandem cabin, collective hover |
| AH-64 Apache | Helicopter | Heavy rotor response, strong damping, slower cyclic/collective response |
| AH-6 Little Bird | Helicopter | Light/fast rotor response, agile cyclic and yaw |
| SR-71 Blackbird | High-speed reconnaissance jet | Fast, high-altitude handling, restricted AoA and sluggish low-speed roll |

Each airframe has independent low-poly geometry and selected physics coefficients. Dimensions are reference-inspired silhouettes, not engineering-accurate CAD. `flight-models.js` contains the independent handling envelopes and deterministic helicopter helpers; `fleet-mesh.js` holds geometry and sizes. Jet models use simplified coefficient-based lift and drag; rotorcraft use approximate rotor/collective/tilt force models. Rotor speed is animated and ramped. **Helicopters cannot autorotate or reproduce rotor vortex states** in this version.

### Basic control

W/S: pitch (W nose down, S nose up); A/D: left/right roll or helicopter cyclic; Q/E: yaw/pedals. Throttle slider: jet engine power or rotor collective. I: engine; P: pause; G: master arm; C: canopy; B: brakes; Shift: afterburner on compatible jet; mouse/touch drag in MODEL view rotates aircraft; mouse wheel zooms. Flares F, air-to-air M, air-to-ground V, target select X, lock J: F-16 mission system. Numpad 1–9 assisted maneuvers remain designed for F-16. Other airframes fly manually using their separate mechanics.

## Ring + pole course (O)

Choose an aircraft and press **O**, or **HALKA / DİREK PARKURU**. A nine-checkpoint test appears:

- Cyan polygon hoops: pass through their empty center at safe clearance.
- Yellow poles: pass on the specified left/right side.
- Twin yellow pylons: fly between them.

A swept segment–plane check avoids misses due purely to a frame advancing past a ring. Scoring considers aircraft wing span or helicopter rotor radius. Contact deducts points and damages wings in this arcade ruleset. The route, score, progress and result are displayed on HUD and sidebar. Press **YENİ PARKUR** to restart, or **PARKURU BİTİR** to exit.

## Existing F-16 systems

Numpad 1–9 assisted maneuver selection, emergency fuel mission, stylized KC-135 tanker/boom contact, telemetry CSV/JSON, local-coordinate fictional strike/return-to-base mission, and a fictional air-to-air encounter remain supported. The passenger jet and SR-71 are not armed in these missions; current F-16 mission scenarios are intentionally F-16-only.

## Rendering / frame rate

The renderer is Canvas 2D with **zero texture downloads** and no 3D engine dependencies. Flight physics runs at a fixed **60 Hz timestep**; interpolation of adjacent simulation poses smooths displayed aircraft/camera movement. The renderer targets 60 FPS by default; the performance selector offers 30 FPS power-saving or panel refresh-rate operation. Cockpit gauges render alongside 3D frames; lower-priority DOM telemetry updates at up to 30 Hz.

**60 FPS is a performance target, not an unconditional guarantee.** Browser VSync, tab throttling, device GPU/CPU, display refresh rate and thermal limits determine actual display rate. See `AUDIT.md` for measured local benchmark and validation gaps.

## Tests

```bash
python tests/check_html_script.py
node --test tests/*.test.cjs
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python -m unittest discover -s tests -p 'test_browser.py' -v
```

Headless Chromium is also used to benchmark the Canvas scene:

```bash
python tests/bench_render.py
```

The CI workflow is `.github/workflows/ci.yml`.

## Grounding and limitations

- Boeing 737-800 dimensions: https://www.boeing.com/commercial/737ng
- SR-71 facts: https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/198054/AFmuseum/lockheed-sr-71a/
- Rotor controls: https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/helicopter_flying_handbook
- Canvas frame timing: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame

Physical constants, fuel tank capacities, thrust envelopes and response rates are deliberately simplified (especially the F-16's 300 L game fuel capacity). This build does not meet a 9/10 scientific accuracy standard; numerical flight calibration and independent flight-test comparisons are future work.
