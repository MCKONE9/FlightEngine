# FlightEngine v1.1 engineering audit

## What was verified

- JavaScript syntax and browser boot (offline, using local scripts).
- Separate finite profile parameters and polygon meshes for six airframes.
- Rotor power-off descent in approximate model, per-airframe hover trims, grounded-to-airborne behavior of rotorcraft.
- Swept segment ring crossing; passing/missing/colliding with obstacle clearances.
- Existing F-16 tanker, fuel warnings, maneuvers, aerial and fictional ground missions still pass browser regressions.
- Scene and GUI rendering in local Chromium; no external 3D libraries, models, or textures.

## Rendering benchmark (headless Chromium on test machine, not device guarantee)

`python tests/bench_render.py` measured median 3D Canvas draw times:

| View | 1440×900 | 390×844 |
|---|---:|---:|
| Chase | ~0.9 ms | ~0.8 ms |
| Model inspection | ~0.4 ms | ~0.3 ms |
| Ground mission | ~0.7 ms | ~0.7 ms |
| Dogfight | ~0.6 ms | ~0.7 ms |

Not equivalent to fully composed frames, stable FPS, real Android thermals, input latency, or GPU timings. Dashboard is a second Canvas and included in full frame but not isolated above.

## Remaining serious limitations

1. Aerodynamics are illustrative, not tested against F-16, Boeing, SR-71 or rotorcraft manufacturer datasets.
2. Aircraft pitch/bank are rate-based controls, not fully coupled rigid-body 6-DoF equations. No quaternion attitude, high-angle stall/spin, ground-effect/rotor downwash/autorotation or flight control computer.
3. Simplified engine envelopes and fixed-wing fuel volumes do not represent real aircraft systems; tanks use gameplay-calibrated values.
4. Aircraft meshes are faceted approximate proportions, not 1:1 CAD or aerodynamically accurate airfoils.
5. 60 FPS is a target: profiling is local headless Chromium only. Needs repeatable 10-minute in-device thermal/performance runs and dropped-frame tracking.
6. The F-16 scenario logic is limited to F-16. Aircraft-specific avionics, 737 cockpit and helicopter mission systems remain future work.
7. No server or save-state; no online multiplayer, third-party asset pipeline, or production deployment hardening.
8. Canvas 2D painter sorting can fail with intersecting polygons; evaluate WebGL2 only if measured GPU/CPU draw time warrants it.

## Implementation priorities

- Stabilize 6-DoF/force-based physical core with reference trajectory tests before claiming simulator-level accuracy.
- Build deterministic scenario tests for every airframe: takeoff/hover/landing, stall, fuel exhaustion, checkpoint course end-to-end.
- Add in-browser performance telemetry (frame time percentiles), degradation preset and device QA matrix.
- Split cockpit visualization/flight model/game scenarios into maintainable UI modules after behavioral coverage grows.

Reference: FAA Helicopter Flying Handbook, NASA ISA reference, Boeing 737NG specs, USAF SR-71 fact sheets, MDN requestAnimationFrame docs.
