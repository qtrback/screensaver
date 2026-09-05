const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('index.html', 'utf8');

function assertContains(snippet, message) {
  assert(source.includes(snippet), message || `Expected index.html to contain: ${snippet}`);
}

function assertMatches(pattern, message) {
  assert(pattern.test(source), message || `Expected index.html to match: ${pattern}`);
}

function bytes(hex) {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

function assertGreenDominant(hex, label) {
  const { r, g, b } = bytes(hex);
  assert(g > r && g > b, `${label} must be green-dominant; got r=${r} g=${g} b=${b}`);
}

const leafStart = source.indexOf('function createLeaf(bounds, leafColors) {');
const leafEnd = source.indexOf("\n\n/* ─────────────────────────────────────────────────────────────────────────────\n   createTree(bounds, treeColors)", leafStart);
assert(leafStart !== -1 && leafEnd !== -1, 'createLeaf factory is bounded before createTree');
const createLeafSource = source.slice(leafStart, leafEnd);

assert(createLeafSource.includes('const group = new THREE.Group();'), 'createLeaf returns a THREE.Group peer');
assert(createLeafSource.includes('const lc = leafColors || {'), 'createLeaf has a bare-call fallback palette');
assert(createLeafSource.includes('blade: 0x2e8b2e, stem: 0x1f5c1f,'), 'createLeaf fallback colors are fixed greens');
assert(createLeafSource.includes('group.scale.set(0.32, 0.32, 0.32);'), 'createLeaf uses the same 0.32 scale as other specials');
[
  'blade',
  'stem',
].forEach(part => {
  assert(new RegExp(`\\.userData\\.leafPart\\s*=\\s*'${part}'`).test(createLeafSource),
    `leaf material is tagged for ${part}`);
});
['SphereGeometry', 'CylinderGeometry', 'MeshStandardMaterial'].forEach(primitive => {
  assert(createLeafSource.includes(`THREE.${primitive}`), `createLeaf uses THREE.${primitive}`);
});
const allowedThreeUses = new Set(['Group', 'Mesh', 'SphereGeometry', 'CylinderGeometry', 'MeshStandardMaterial']);
[...createLeafSource.matchAll(/THREE\.([A-Za-z0-9_]+)/g)].forEach(match => {
  assert(allowedThreeUses.has(match[1]), `createLeaf uses only permitted THREE primitives/materials; found THREE.${match[1]}`);
});
assert(!/ShapeFactory\._colors|ShapeFactory\._activePalette|_colors|_activePalette/.test(createLeafSource), 'createLeaf does not use ShapeFactory palette internals');

const themeSource = source.slice(source.indexOf('const THEMES = {'), source.indexOf('(function main() {'));
assertMatches(/dark:\s*\{[\s\S]*?leafColors:\s*\{[\s\S]*?blade:\s*0x[0-9a-f]+,[\s\S]*?stem:\s*0x[0-9a-f]+,?[\s\S]*?\}/i, 'dark theme defines complete leafColors');
assertMatches(/light:\s*\{[\s\S]*?leafColors:\s*\{[\s\S]*?blade:\s*0x[0-9a-f]+,[\s\S]*?stem:\s*0x[0-9a-f]+,?[\s\S]*?\}/i, 'light theme defines complete leafColors');

const themeLeafMatches = [...themeSource.matchAll(/leafColors:\s*\{\s*blade:\s*(0x[0-9a-f]+),\s*stem:\s*(0x[0-9a-f]+),?\s*\}/gi)];
assert.strictEqual(themeLeafMatches.length, 2, 'dark and light themes each define one leafColors map');
themeLeafMatches.forEach((match, themeIndex) => {
  const themeName = themeIndex === 0 ? 'dark' : 'light';
  assertGreenDominant(Number(match[1]), `${themeName} leaf blade`);
  assertGreenDominant(Number(match[2]), `${themeName} leaf stem`);
});

assertContains('function leafActive() {', 'leafActive predicate exists');
assertContains("return shapes.some(s => s.userData && s.userData.geoName === 'leaf');", 'leafActive checks leaf geoName');
assertContains('function spawnLeaf() {', 'spawnLeaf exists');
assertContains('if (shapes.length >= MAX_SHAPES || leafActive()) return;', 'spawnLeaf refuses when a leaf is already active');
assertContains('const group = createLeaf(BOUNDS, THEMES[activeTheme].leafColors);', 'spawnLeaf builds with the active theme leaf palette');
assertContains("group.userData.intent  = 'leaf';", 'spawnLeaf tags intent as leaf');
assertContains("group.userData.geoName = 'leaf';", 'spawnLeaf tags geoName as leaf');
assertContains('scene.add(group);', 'spawnLeaf adds the leaf group to the scene');
assertContains('shapes.push(group);', 'spawnLeaf tracks the leaf in shapes');
assertContains("intentEngine.assign(group, 'leaf');", 'spawnLeaf registers the leaf with the generic intent engine');
assertContains("incrementTypeCount('leaf');", 'spawnLeaf increments the cumulative leaf type count');
assertContains('showLeafMessage();', 'spawnLeaf shows the leaf announcement');

assertContains('function showLeafMessage() {', 'showLeafMessage exists');
assertMatches(/function showLeafMessage\(\) \{[\s\S]*?el\.className = 'cow-message';[\s\S]*?🍃[\s\S]*?3200/, 'showLeafMessage mirrors the transient cow-message pattern');

assertMatches(/child\.material\.userData\.leafPart[\s\S]*?const part = child\.material\.userData\.leafPart;[\s\S]*?const hex = theme\.leafColors\[part\];[\s\S]*?child\.material\.color\.setHex\(hex\);/, 'recolorLiveShapes has a leafPart branch');

assertContains("if (!leafActive())  available.push('leaf');", 'spawnShape only offers leaf when no leaf is active');
assertContains("if (available[0] === 'leaf')  { spawnLeaf();  return; }", 'spawnShape dispatches leaf through the shuffled available list');

const shapeFactoryStart = source.indexOf('const ShapeFactory = (() => {');
const shapeFactoryEnd = source.indexOf('function createCow(bounds, cowColors) {', shapeFactoryStart);
assert(shapeFactoryStart !== -1 && shapeFactoryEnd !== -1, 'ShapeFactory section exists');
const shapeFactorySource = source.slice(shapeFactoryStart, shapeFactoryEnd);
assert(!/leaf/i.test(shapeFactorySource), 'leaf is not added to ShapeFactory generic geometry registry');

console.log('leaf static checks passed');
