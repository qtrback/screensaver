const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('index.html', 'utf8');

// Slice the real animate() definition out of index.html (mirror framecap.test.js:
// locate `function animate() {`, then its trailing `animate();` invocation, and
// take the function definition in between). We run this REAL sliced source in a
// vm against recording stubs and assert on what the loop actually DID.
const animateStart = source.indexOf('function animate() {');
const animateEnd = source.indexOf('animate();', animateStart);
assert(animateStart !== -1 && animateEnd !== -1, 'animate() function and its invocation both exist');
assert(animateStart < animateEnd, 'animate() definition must precede its invocation');
const animateSource = source.slice(animateStart, animateEnd);

// Build a fresh vm context + recording stubs for the free variables animate()
// closes over. `matchMediaMatches` drives reduced-motion ON/OFF; because the
// guard re-reads matchMedia each frame, flipping this between calls proves the
// live flip. `reload()` resets the recorders so each frame is measured clean.
function makeContext(matchMediaState) {
  const calls = { update: 0, render: 0, lookAt: 0, resolveCollisions: 0, setHSL: 0 };
  const context = {
    Math,
    requestAnimationFrame: () => {}, // no-op: must not recurse
    paused: false,                   // paused gate open so we reach the guard
    clock: { getDelta: () => 0.016 },
    camera: { position: { x: 0, y: 0, z: 0 }, lookAt: () => { calls.lookAt++; } },
    intentEngine: { update: () => { calls.update++; } }, // state-advance signal
    resolveCollisions: () => { calls.resolveCollisions++; },
    shapes: [],
    BOUNDS: {},
    showLabels: false,               // label branch skipped
    labels: [],
    moodTime: 0,
    camAngle: 0,
    THEMES: { dark: { fillMoodHSL: { s: 0.5, l: 0.5 } } },
    activeTheme: 'dark',
    fillLight: { color: { setHSL: () => { calls.setHSL++; } } },
    renderer: { render: () => { calls.render++; } }, // render signal
    scene: {},
    // matchMediaState is an object so a single vm context can observe a flipped
    // value on the next frame (proves the guard re-reads, does not cache).
    window: { matchMedia: () => ({ matches: matchMediaState.matches }) },
  };
  vm.createContext(context);
  // Define animate() in the context, then expose a runner.
  vm.runInContext(animateSource + '\nthis.__animate = animate;', context);
  return { context, calls, run: () => context.__animate() };
}

// ── Assertion group 1: reduced-motion ON ────────────────────────────────────
{
  const { calls, run } = makeContext({ matches: true });
  run();
  assert.strictEqual(calls.update, 0, 'reduced-motion ON: intentEngine.update must NOT be called (state must not advance)');
  assert.strictEqual(calls.lookAt, 0, 'reduced-motion ON: camera orbit (lookAt) must not run');
  assert.strictEqual(calls.resolveCollisions, 0, 'reduced-motion ON: resolveCollisions must not run');
  assert.strictEqual(calls.setHSL, 0, 'reduced-motion ON: fillLight mood drift must not run');
  // The render-still-called assertion: this is what catches the black-screen bug.
  assert.strictEqual(calls.render, 1, 'reduced-motion ON: renderer.render MUST still be called once (render-then-hold, not black screen)');
}

// ── Assertion group 2: reduced-motion OFF ───────────────────────────────────
{
  const { calls, run } = makeContext({ matches: false });
  run();
  assert.strictEqual(calls.update, 1, 'reduced-motion OFF: intentEngine.update WAS called (state advances)');
  assert.strictEqual(calls.render, 1, 'reduced-motion OFF: renderer.render was called');
}

// ── Assertion group 3: live-response / both-ways flip (no boot-cache) ────────
// Drive the SAME sliced animate() with a shared, mutable matchMedia state.
// Flipping the reported value between frames must flip the observable behaviour;
// this proves the guard re-reads the preference each frame (does not cache at boot).
{
  const state = { matches: true };
  const { context, calls, run } = makeContext(state);
  // Rebuild window.matchMedia to read the shared `state` live each call.
  context.window.matchMedia = () => ({ matches: state.matches });

  // Frame A: ON → advance suppressed, render present.
  run();
  assert.strictEqual(calls.update, 0, 'flip A (ON): no state advance');
  assert.strictEqual(calls.render, 1, 'flip A (ON): render present');

  // Frame B: flip OFF mid-session → advance resumes.
  state.matches = false;
  run();
  assert.strictEqual(calls.update, 1, 'flip B (OFF): state advance resumes after flipping the setting off with no reload');
  assert.strictEqual(calls.render, 2, 'flip B (OFF): render present');

  // Frame C: flip back ON → advance suppressed again (both ways).
  state.matches = true;
  run();
  assert.strictEqual(calls.update, 1, 'flip C (ON again): no further state advance after flipping back on');
  assert.strictEqual(calls.render, 3, 'flip C (ON again): render still present');
}

// ── Assertion group 3b: matchMedia absent is treated as "no reduced motion" ──
{
  const { context, calls, run } = makeContext({ matches: true });
  context.window = {}; // no matchMedia at all — must not crash, must behave as motion-on
  run();
  assert.strictEqual(calls.update, 1, 'matchMedia absent: treated as no reduced motion (state advances, no crash)');
  assert.strictEqual(calls.render, 1, 'matchMedia absent: render present');
}

console.log('reduced-motion guard checks passed');
