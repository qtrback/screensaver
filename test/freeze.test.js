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

assertContains('frozen: false,', 'IntentEngine.assign seeds a per-shape frozen flag');
assertMatches(/toggleFrozen\(mesh\) \{[\s\S]*?const entry = this\._entries\.get\(mesh\);[\s\S]*?if \(!entry\) return false;[\s\S]*?entry\.state\.frozen = !entry\.state\.frozen;[\s\S]*?return entry\.state\.frozen;[\s\S]*?\}/, 'toggleFrozen flips only the registered entry state');
assertMatches(/for \(const \[mesh, entry\] of this\._entries\) \{\s*if \(entry\.state\.frozen\) continue;[\s\S]*?integrate\(mesh\.position, entry\.state\.vel, dt\);[\s\S]*?bounce\(mesh\.position, entry\.state\.vel, bounds\);[\s\S]*?enforceMinSpeed\(entry\.state\.vel\);[\s\S]*?mesh\.rotation\.x \+=/, 'update skips frozen entries before motion and spin');
assert(!/state\.vel\s*=/.test(intentEngineSource), 'IntentEngine never replaces or re-randomizes velocity after assignment');

const clickStart = source.indexOf('/* -- Click-to-freeze via raycasting -- */');
const collisionStart = source.indexOf('function resolveCollisions()', clickStart);
assert(clickStart !== -1 && collisionStart !== -1, 'click-to-freeze raycast section exists');
const clickSource = source.slice(clickStart, collisionStart);
assertContains('/* -- Click-to-freeze via raycasting -- */', 'raycast comment reflects freeze behavior');
assertMatches(/if \(intersects\.length > 0\) \{[\s\S]*?let target = intersects\[0\]\.object;[\s\S]*?while \(target\.parent && !shapes\.includes\(target\)\) \{[\s\S]*?target = target\.parent;[\s\S]*?if \(shapes\.includes\(target\)\) \{[\s\S]*?intentEngine\.toggleFrozen\(target\);[\s\S]*?\}/, 'click handler keeps root-shape resolution and toggles frozen state');
assert(!clickSource.includes('removeShape('), 'plain raycast click does not delete shapes');
assert(!clickSource.includes('shapes.length > 1'), 'plain raycast click is not blocked when only one shape remains');

const removeShapeStart = source.indexOf('function removeShape(mesh) {');
const removeShapeEnd = source.indexOf('function updateRemoveButton()', removeShapeStart);
assert(removeShapeStart !== -1 && removeShapeEnd !== -1, 'removeShape section exists');
const removeShapeSource = source.slice(removeShapeStart, removeShapeEnd);
assertContains('intentEngine.remove(mesh);', 'removeShape still unregisters the mesh from IntentEngine');

const removeButtonStart = source.indexOf("document.getElementById('btn-remove').addEventListener('click', () => {");
const removeButtonEnd = source.indexOf('const btnLabels', removeButtonStart);
assert(removeButtonStart !== -1 && removeButtonEnd !== -1, 'btn-remove handler exists');
const removeButtonSource = source.slice(removeButtonStart, removeButtonEnd);
assert(removeButtonSource.includes('if (shapes.length <= 1) return;'), 'btn-remove still keeps one shape');
assert(removeButtonSource.includes('removeShape(shapes[shapes.length - 1]);'), 'btn-remove still removes the most-recently-added shape');

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
const frozenMesh = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
const movingMesh = { position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
engine.assign(frozenMesh, 'frozen');
engine.assign(movingMesh, 'moving');
const frozenState = engine.getState(frozenMesh);
const movingState = engine.getState(movingMesh);
frozenState.vel = { x: 1, y: 2, z: 3 };
movingState.vel = { x: 4, y: 0, z: 0 };
const retainedVelocity = frozenState.vel;

assert.strictEqual(frozenState.frozen, false, 'new shape starts unfrozen');
assert.strictEqual(movingState.frozen, false, 'other shape starts unfrozen');
assert.strictEqual(engine.toggleFrozen(frozenMesh), true, 'toggle freezes the selected shape');

const frozenPosition = { ...frozenMesh.position };
const frozenRotation = { ...frozenMesh.rotation };
const frozenVelocity = { ...frozenState.vel };
calls.length = 0;
engine.update([frozenMesh, movingMesh], { x: 100, y: 100, z: 100 }, 1);

assert.deepStrictEqual(frozenMesh.position, frozenPosition, 'frozen shape position does not change');
assert.deepStrictEqual(frozenMesh.rotation, frozenRotation, 'frozen shape spin does not change');
assert.deepStrictEqual(frozenState.vel, frozenVelocity, 'frozen shape velocity values are retained');
assert.strictEqual(frozenState.vel, retainedVelocity, 'frozen shape velocity object is retained');
assert.deepStrictEqual(calls, ['integrate', 'bounce', 'enforceMinSpeed'], 'only the unfrozen shape is ticked');
assert.notStrictEqual(movingMesh.position.x, 10, 'other shapes keep moving');
assert.strictEqual(movingState.frozen, false, 'freezing one shape does not freeze another');

assert.strictEqual(engine.toggleFrozen(frozenMesh), false, 'second toggle unfreezes the selected shape');
engine.update([frozenMesh, movingMesh], { x: 100, y: 100, z: 100 }, 1);
assert.deepStrictEqual(frozenMesh.position, { x: 1, y: 2, z: 3 }, 'unfrozen shape resumes from retained velocity');
assert.strictEqual(frozenState.vel, retainedVelocity, 'unfreeze does not replace velocity');

console.log('freeze static and behavior checks passed');
