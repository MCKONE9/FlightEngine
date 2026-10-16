# Changelog

## v1.1.0 — Polygon Fleet, Flight Course & Smoother Animation

- Added six vehicle selections (F-16C, 737-800, AH-1, AH-64, AH-6 and SR-71), with one-time generated polygon meshes and no textures.
- Added per-aircraft flight handling and mass/wing/power/fuel envelopes; helicopters get distinct rotor spool/collective/hover dynamics. Aircraft are not validated replicas.
- Added nine-stage hoop / slalom pole / two-pylon flight course, swept-plane checkpoint testing, scoring, HUD and aircraft-clearance gates.
- Fixed-step simulation updated from 30 Hz to 60 Hz with interpolated camera/airframe poses; target 60 FPS, optional 30 FPS and display-refresh modes.
- Added rotor blade mesh animation, controller UI, reduced-motion styling, and live FPS/scene timing readouts.
- Maintained previous F-16 ground mission, dogfight, tanker contact, telemetry, and numpad functionality.
- Updated time-dependent regression tests to use simulation seconds rather than hardcoded numbers of 30 Hz steps; added aircraft profiles, mesh and course tests.

## v1.0.0 and earlier

See git history/earlier release ZIPs for combat missions, refueling and original F-16 upgrades.
