const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('index.html', 'utf8');

function assertContains(snippet, message) {
  assert(source.includes(snippet), message || `Expected index.html to contain: ${snippet}`);
}

function assertMatches(pattern, message) {
  assert(pattern.test(source), message || `Expected index.html to match: ${pattern}`);
}

const treeStart = source.indexOf('function createTree(bounds, treeColors) {');
const treeEnd = source.indexOf('/* ══════════════════════════════════════════════════════════════════════════════\n   SECTION 4', treeStart);
assert(treeStart !== -1 && treeEnd !== -1, 'createTree factory exists');
const createTreeSource = source.slice(treeStart, treeEnd);

assert(createTreeSource.includes('const group = new THREE.Group();'), 'createTree returns a THREE.Group peer');
assert(createTreeSource.includes('const tc = treeColors || {'), 'createTree has a bare-call fallback palette');
assert(createTreeSource.includes('group.scale.set(0.32, 0.32, 0.32);'), 'createTree uses the same 0.32 scale as other specials');
[
  'trunk',
  'foliageLower',
  'foliageMiddle',
  'foliageTop',
  'crown',
].forEach(part => {
  assert(new RegExp(`\\.userData\\.treePart\\s*=\\s*'${part}'`).test(createTreeSource),
    `tree material is tagged for ${part}`);
});
['CylinderGeometry', 'SphereGeometry', 'ConeGeometry', 'MeshStandardMaterial'].forEach(primitive => {
  assert(createTreeSource.includes(`THREE.${primitive}`), `createTree uses THREE.${primitive}`);
});

assertMatches(/dark:\s*\{[\s\S]*?treeColors:\s*\{[\s\S]*?trunk:[\s\S]*?foliageLower:[\s\S]*?foliageMiddle:[\s\S]*?foliageTop:[\s\S]*?crown:/, 'dark theme defines complete treeColors');
assertMatches(/light:\s*\{[\s\S]*?treeColors:\s*\{[\s\S]*?trunk:[\s\S]*?foliageLower:[\s\S]*?foliageMiddle:[\s\S]*?foliageTop:[\s\S]*?crown:/, 'light theme defines complete treeColors');

assertContains('function treeActive() {', 'treeActive predicate exists');
assertContains("return shapes.some(s => s.userData && s.userData.geoName === 'tree');", 'treeActive checks tree geoName');
assertContains('function spawnTree() {', 'spawnTree exists');
assertContains('if (shapes.length >= MAX_SHAPES || treeActive()) return;', 'spawnTree refuses when a tree is already active');
assertContains('const group = createTree(BOUNDS, THEMES[activeTheme].treeColors);', 'spawnTree builds with the active theme palette');
assertContains("group.userData.intent  = 'tree';", 'spawnTree tags intent as tree');
assertContains("group.userData.geoName = 'tree';", 'spawnTree tags geoName as tree');
assertContains("intentEngine.assign(group, 'tree');", 'spawnTree registers the tree with the generic intent engine');
assertContains('showTreeMessage();', 'spawnTree shows the tree announcement');

assertContains('function showTreeMessage() {', 'showTreeMessage exists');
assertMatches(/function showTreeMessage\(\) \{[\s\S]*?el\.className = 'cow-message';[\s\S]*?🌲[\s\S]*?3200/, 'showTreeMessage mirrors the transient cow-message pattern');

assertMatches(/child\.material\.userData\.treePart[\s\S]*?const part = child\.material\.userData\.treePart;[\s\S]*?const hex = theme\.treeColors\[part\];[\s\S]*?child\.material\.color\.setHex\(hex\);/, 'recolorLiveShapes has a treePart branch');

assertContains("if (!treeActive())  available.push('tree');", 'spawnShape only offers tree when no tree is active');
assertContains("if (available[0] === 'tree')  { spawnTree();  return; }", 'spawnShape dispatches tree through the shuffled available list');
assertContains('const COW_CHANCE = 0.12;', 'COW_CHANCE remains unchanged');

const removeShapeStart = source.indexOf('function removeShape(mesh) {');
const removeShapeEnd = source.indexOf('function updateRemoveButton()', removeShapeStart);
assert(removeShapeStart !== -1 && removeShapeEnd !== -1, 'removeShape section exists');
const removeShapeSource = source.slice(removeShapeStart, removeShapeEnd);
assert(!/geoName === 'tree'/.test(removeShapeSource), 'removeShape has no tree-specific branch');

const raycastStart = source.indexOf('/* -- Click gestures via raycasting -- */');
assert(raycastStart !== -1, 'raycast click/double-click section exists');
const raycastSource = source.slice(raycastStart);
assert(!/geoName === 'tree'/.test(raycastSource), 'raycast-delete has no tree-specific branch');

const intentEngineStart = source.indexOf('class IntentEngine {');
const intentEngineEnd = source.indexOf('/* ══════════════════════════════════════════════════════════════════════════════\n   SECTION 3', intentEngineStart);
assert(intentEngineStart !== -1 && intentEngineEnd !== -1, 'IntentEngine section exists');
const intentEngineSource = source.slice(intentEngineStart, intentEngineEnd);
assert(!/geoName === 'tree'/.test(intentEngineSource), 'IntentEngine has no tree-specific branch');

console.log('tree static checks passed');
