const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('index.html', 'utf8');

function assertContains(snippet, message) {
  assert(source.includes(snippet), message || `Expected index.html to contain: ${snippet}`);
}

// Isolate the spawnBurst function body (and specifically its inner tick()).
const spawnBurstStart = source.indexOf('function spawnBurst(');
const clickHandlerStart = source.indexOf("renderer.domElement.addEventListener('click'", spawnBurstStart);
assert(spawnBurstStart !== -1 && clickHandlerStart !== -1, 'spawnBurst helper is defined before the click handler');
const spawnBurstSource = source.slice(spawnBurstStart, clickHandlerStart);

const tickStart = spawnBurstSource.indexOf('function tick(now) {');
assert(tickStart !== -1, 'spawnBurst defines an inner tick(now) function');
const tickSource = spawnBurstSource.slice(tickStart);

// 1. An `if (paused)` gate appears before `elapsed += dt`.
const pausedGateIndex = tickSource.indexOf('if (paused)');
const elapsedAdvanceIndex = tickSource.indexOf('elapsed += dt');
assert(pausedGateIndex !== -1, 'tick contains an `if (paused)` gate');
assert(elapsedAdvanceIndex !== -1, 'tick advances elapsed via `elapsed += dt`');
assert(pausedGateIndex < elapsedAdvanceIndex, 'the paused gate appears before elapsed is advanced');

// 2. The paused branch reschedules via requestAnimationFrame and returns (soft pause).
const pausedBranchEnd = tickSource.indexOf('}', pausedGateIndex);
const pausedBranch = tickSource.slice(pausedGateIndex, pausedBranchEnd);
assert(pausedBranch.includes('requestAnimationFrame(tick)'), 'the paused branch keeps the burst scheduled via requestAnimationFrame(tick)');
assert(pausedBranch.includes('return'), 'the paused branch returns early rather than advancing the frame');

// 3. No cancelAnimationFrame anywhere in the burst (soft pause, never a hard pause).
assert(!spawnBurstSource.includes('cancelAnimationFrame'), 'spawnBurst never calls cancelAnimationFrame (soft pause only)');

// 4. The Math.min((now - lastTime) / 1000, 0.1) dt clamp is preserved.
assertContains('Math.min((now - lastTime) / 1000, 0.1)', 'the dt clamp that discards hidden wall-clock time is preserved');

// 5. `lastTime = now;` still appears only after the dt computation, not inside the paused branch.
assert(!pausedBranch.includes('lastTime = now'), 'the paused branch does not update lastTime');
const lastTimeUpdateIndex = tickSource.indexOf('lastTime = now;');
assert(lastTimeUpdateIndex !== -1, 'tick still updates lastTime on the non-paused path');
assert(lastTimeUpdateIndex > pausedGateIndex, 'lastTime is updated after the paused gate, not before/inside it');
const dtComputeIndex = tickSource.indexOf('Math.min((now - lastTime) / 1000, 0.1)');
assert(dtComputeIndex !== -1 && lastTimeUpdateIndex > dtComputeIndex, 'lastTime is updated after dt is computed from the prior lastTime');

console.log('visibility burst checks passed');
