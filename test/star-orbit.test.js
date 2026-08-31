const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('index.html', 'utf8');

function assertContains(snippet, message) {
  assert(source.includes(snippet), message || `Expected index.html to contain: ${snippet}`);
}

function assertMatches(pattern, message) {
  assert(pattern.test(source), message || `Expected index.html to match: ${pattern}`);
}

const intentEngineStart = source.indexOf('class IntentEngine {');
const intentEngineEnd = source.indexOf('/* ══════════════════════════════════════════════════════════════════════════════\n   SECTION 3', intentEngineStart);
assert(intentEngineStart !== -1 && intentEngineEnd !== -1, 'IntentEngine section exists');
const intentEngineSource = source.slice(intentEngineStart, intentEngineEnd);

assertContains("mesh.userData.emojiGlyph === '⭐'", 'IntentEngine.update selects only the star emoji glyph for orbit motion');
assertMatches(/for \(const \[mesh, entry\] of this\._entries\) \{\s*if \(entry\.state\.frozen\) continue;[\s\S]*?if \(mesh\.userData\.emojiGlyph === '⭐'\)/, 'update keeps the frozen guard before the star branch');
assertMatches(/if \(mesh\.userData\.emojiGlyph === '⭐'\) \{[\s\S]*?entry\.state\.orbitAngle \+= dt \* ORBIT_SPEED;[\s\S]*?mesh\.position\.x = ORBIT_RADIUS \* Math\.cos\(entry\.state\.orbitAngle\);[\s\S]*?mesh\.position\.y = ORBIT_RADIUS \* Math\.sin\(entry\.state\.orbitAngle\);[\s\S]*?mesh\.position\.z = 0;[\s\S]*?\} else \{[\s\S]*?integrate\(mesh\.position, entry\.state\.vel, dt\);[\s\S]*?bounce\(mesh\.position, entry\.state\.vel, bounds\);[\s\S]*?enforceMinSpeed\(entry\.state\.vel\);/, 'star branch drives circular position while non-stars keep the ballistic path');

const classSource = intentEngineSource + '\nthis.IntentEngine = IntentEngine;';
const calls = [];
const context = {
  Math,
  IntentRegistry: {
    integrate(pos, vel, dt) {
      calls.push('integrate');
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      pos.z += vel.z * dt;
    },
    bounce(pos, vel) {
      calls.push('bounce');
      vel.bounced = (vel.bounced || 0) + 1;
    },
    enforceMinSpeed(vel) {
      calls.push('enforceMinSpeed');
      vel.enforced = (vel.enforced || 0) + 1;
    },
  },
};
vm.createContext(context);
vm.runInContext(classSource, context);

const engine = new context.IntentEngine();
const starMesh = { position: { x: 3, y: -2, z: 1 }, rotation: { x: 0, y: 0, z: 0 }, userData: { emojiGlyph: '⭐' } };
const nonStarMesh = { position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0 }, userData: {} };
engine.assign(starMesh, 'star');
engine.assign(nonStarMesh, 'non-star');
engine.getState(starMesh).vel = { x: 100, y: 100, z: 100 };
engine.getState(nonStarMesh).vel = { x: 1, y: 0, z: -1 };

const bounds = { x: 8, y: 5, z: 5 };
const dt = 0.1;
const observedStarPositions = [];
calls.length = 0;
for (let tick = 0; tick < 4; tick += 1) {
  engine.update([starMesh, nonStarMesh], bounds, dt);
  const radius = Math.hypot(starMesh.position.x, starMesh.position.y);
  assert(Math.abs(radius - 0.9) < 1e-6, 'star stays on the radius-0.9 circle centered on the origin');
  assert.strictEqual(starMesh.position.z, 0, 'star orbit remains on the z=0 plane');
  observedStarPositions.push({ ...starMesh.position });
}

const planeHalfDiagonal = 1.05 * Math.SQRT2 / 2;
assert(0.9 + planeHalfDiagonal < bounds.y / 3, 'star plane stays within the tight y-axis middle-third half-extent');
assert(observedStarPositions.some((pos, index) => index > 0 && (pos.x !== observedStarPositions[index - 1].x || pos.y !== observedStarPositions[index - 1].y)), 'star position changes as orbitAngle advances');
assert.deepStrictEqual(calls, [
  'integrate', 'bounce', 'enforceMinSpeed',
  'integrate', 'bounce', 'enforceMinSpeed',
  'integrate', 'bounce', 'enforceMinSpeed',
  'integrate', 'bounce', 'enforceMinSpeed',
], 'only the non-star mesh drives integrate → bounce → enforceMinSpeed on each tick');
assert(starMesh.rotation.x > 0, 'star decorative rotation x advances');
assert(starMesh.rotation.y > 0, 'star decorative rotation y advances');
assert(starMesh.rotation.z > 0, 'star decorative rotation z advances');
assert(nonStarMesh.rotation.x > 0 && nonStarMesh.rotation.y > 0 && nonStarMesh.rotation.z > 0, 'non-star decorative rotation still advances');

const frozenEngine = new context.IntentEngine();
const frozenStarMesh = { position: { x: 4, y: 5, z: 6 }, rotation: { x: 0, y: 0, z: 0 }, userData: { emojiGlyph: '⭐' } };
frozenEngine.assign(frozenStarMesh, 'frozen star');
assert.strictEqual(frozenEngine.toggleFrozen(frozenStarMesh), true, 'toggleFrozen freezes a star mesh');
const frozenPosition = { ...frozenStarMesh.position };
const frozenRotation = { ...frozenStarMesh.rotation };
calls.length = 0;
frozenEngine.update([frozenStarMesh], bounds, dt);
assert.deepStrictEqual(frozenStarMesh.position, frozenPosition, 'frozen star position does not change');
assert.deepStrictEqual(frozenStarMesh.rotation, frozenRotation, 'frozen star decorative rotation does not change');
assert.deepStrictEqual(calls, [], 'frozen star does not drive ballistic calls');

console.log('star orbit static and behavior checks passed');
