const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('index.html', 'utf8');

function assertContains(snippet, message) {
  assert(source.includes(snippet), message || `Expected index.html to contain: ${snippet}`);
}

function assertMatches(pattern, message) {
  assert(pattern.test(source), message || `Expected index.html to match: ${pattern}`);
}

const carStart = source.indexOf('function createCar(bounds, carColors) {');
const carEnd = source.indexOf('/* ══════════════════════════════════════════════════════════════════════════════\n   SECTION 4', carStart);
assert(carStart !== -1 && carEnd !== -1, 'createCar factory exists');
const createCarSource = source.slice(carStart, carEnd);

assert(createCarSource.includes('const group = new THREE.Group();'), 'createCar returns a THREE.Group peer');
assert(createCarSource.includes('const cc = carColors || {'), 'createCar has a bare-call fallback palette');
assert(createCarSource.includes('group.scale.set(0.32, 0.32, 0.32);'), 'createCar uses the same 0.32 scale as other specials');
[
  'body',
  'cabin',
  'window',
  'wheel',
  'hub',
  'headlight',
  'taillight',
  'flame',
].forEach(part => {
  assert(new RegExp(`\\.userData\\.carPart\\s*=\\s*'${part}'`).test(createCarSource),
    `car material is tagged for ${part}`);
});
['BoxGeometry', 'CylinderGeometry', 'SphereGeometry', 'ConeGeometry', 'MeshStandardMaterial'].forEach(primitive => {
  assert(createCarSource.includes(`THREE.${primitive}`), `createCar uses THREE.${primitive}`);
});

assertMatches(/dark:\s*\{[\s\S]*?carColors:\s*\{[\s\S]*?body:[\s\S]*?flame:/, 'dark theme defines complete carColors');
assertMatches(/light:\s*\{[\s\S]*?carColors:\s*\{[\s\S]*?body:[\s\S]*?flame:/, 'light theme defines complete carColors');

assertContains('function carActive() {', 'carActive predicate exists');
assertContains("return shapes.some(s => s.userData && s.userData.geoName === 'car');", 'carActive checks car geoName');
assertContains('function spawnCar() {', 'spawnCar exists');
assertContains('if (shapes.length >= MAX_SHAPES || carActive()) return;', 'spawnCar refuses when a car is already active');
assertContains('const group = createCar(BOUNDS, THEMES[activeTheme].carColors);', 'spawnCar builds with the active theme palette');
assertContains("group.userData.intent  = 'car';", 'spawnCar tags intent as car');
assertContains("group.userData.geoName = 'car';", 'spawnCar tags geoName as car');
assertContains("intentEngine.assign(group, 'car');", 'spawnCar registers the car with the generic intent engine');
assertContains("incrementTypeCount('car');", 'spawnCar increments the cumulative car type count');
assertContains('showCarMessage();', 'spawnCar shows the car announcement');

assertContains('function showCarMessage() {', 'showCarMessage exists');
assertMatches(/function showCarMessage\(\) \{[\s\S]*?el\.className = 'cow-message';[\s\S]*?🚗[\s\S]*?3200/, 'showCarMessage mirrors the transient cow-message pattern');

assertMatches(/child\.material\.userData\.carPart[\s\S]*?const part = child\.material\.userData\.carPart;[\s\S]*?const hex = theme\.carColors\[part\];[\s\S]*?child\.material\.color\.setHex\(hex\);/, 'recolorLiveShapes has a carPart branch');

assertContains("if (!carActive())   available.push('car');", 'spawnShape only offers car when no car is active');
assertContains("if (available[0] === 'car')   { spawnCar();   return; }", 'spawnShape dispatches car through the shuffled available list');
assertContains('const COW_CHANCE = 0.12;', 'COW_CHANCE remains unchanged');

const removeShapeStart = source.indexOf('function removeShape(mesh) {');
const removeShapeEnd = source.indexOf('function updateRemoveButton()', removeShapeStart);
assert(removeShapeStart !== -1 && removeShapeEnd !== -1, 'removeShape section exists');
const removeShapeSource = source.slice(removeShapeStart, removeShapeEnd);
assert(!/geoName === 'car'/.test(removeShapeSource), 'removeShape has no car-specific branch');

const raycastStart = source.indexOf('/* -- Click gestures via raycasting -- */');
assert(raycastStart !== -1, 'raycast-freeze section exists');
const raycastSource = source.slice(raycastStart);
assert(!/geoName === 'car'/.test(raycastSource), 'raycast-freeze has no car-specific branch');

const intentEngineStart = source.indexOf('class IntentEngine {');
const intentEngineEnd = source.indexOf('/* ══════════════════════════════════════════════════════════════════════════════\n   SECTION 3', intentEngineStart);
assert(intentEngineStart !== -1 && intentEngineEnd !== -1, 'IntentEngine section exists');
const intentEngineSource = source.slice(intentEngineStart, intentEngineEnd);
assert(!/geoName === 'car'/.test(intentEngineSource), 'IntentEngine has no car-specific branch');

console.log('flying car static checks passed');
