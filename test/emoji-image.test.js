const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('index.html', 'utf8');

function assertContains(snippet, message) {
  assert(source.includes(snippet), message || `Expected index.html to contain: ${snippet}`);
}

function assertMatches(pattern, message) {
  assert(pattern.test(source), message || `Expected index.html to match: ${pattern}`);
}

const shapeFactoryStart = source.indexOf('const ShapeFactory = (() => {');
const shapeFactoryEnd = source.indexOf('})();', shapeFactoryStart);
assert(shapeFactoryStart !== -1 && shapeFactoryEnd !== -1, 'ShapeFactory section exists');
const shapeFactorySource = source.slice(shapeFactoryStart, shapeFactoryEnd);
assert(!/CanvasTexture|PlaneGeometry|emoji/i.test(shapeFactorySource), 'emoji images are not registered in ShapeFactory');

const emojiFactoryStart = source.indexOf('function createEmojiImage(bounds) {');
const emojiFactoryEnd = source.indexOf('/* COW FACTORY', emojiFactoryStart);
assert(emojiFactoryStart !== -1 && emojiFactoryEnd !== -1, 'createEmojiImage factory exists before specials');
const emojiFactorySource = source.slice(emojiFactoryStart, emojiFactoryEnd);

assertContains("const EMOJI_IMAGE_GLYPHS = ['⭐', '❤️', '🌈', '🍕'];", 'emoji glyph pool is explicit');
const poolMatch = source.match(/const EMOJI_IMAGE_GLYPHS = \[([^\]]+)\];/);
assert(poolMatch, 'emoji glyph pool is declared');
const glyphs = [...poolMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
assert(glyphs.length >= 2, 'emoji glyph pool has at least two entries');
assert.strictEqual(new Set(glyphs).size, glyphs.length, 'emoji glyph pool entries are distinct');
assert(emojiFactorySource.includes('const canvas = document.createElement(\'canvas\');'), 'emoji factory creates a 2D canvas');
assert(emojiFactorySource.includes("const ctx = canvas.getContext('2d');"), 'emoji factory gets the 2D context');
assert(emojiFactorySource.includes('EMOJI_IMAGE_GLYPHS[Math.floor(Math.random() * EMOJI_IMAGE_GLYPHS.length)]'), 'emoji factory picks from the glyph pool');
assert(emojiFactorySource.includes('ctx.fillText(glyph, canvas.width / 2, canvas.height / 2);'), 'emoji factory draws the selected glyph');
assert(emojiFactorySource.includes('const texture = new THREE.CanvasTexture(canvas);'), 'emoji factory builds a CanvasTexture');
assert(emojiFactorySource.includes('texture.needsUpdate = true;'), 'emoji texture is marked dirty');
assert(emojiFactorySource.includes('const geometry = new THREE.PlaneGeometry(1.05, 1.05);'), 'emoji image is a flat PlaneGeometry');
assertMatches(/new THREE\.MeshBasicMaterial\(\{[\s\S]*?map: texture,[\s\S]*?transparent: true,[\s\S]*?\}\)/, 'emoji material is transparent and uses the texture map');
assert(emojiFactorySource.includes('const mesh = new THREE.Mesh(geometry, material);'), 'emoji factory returns a mesh');
assert(emojiFactorySource.includes("const geoName = 'emoji';"), 'emoji factory labels the geoName');
assert(emojiFactorySource.includes('return { mesh, intent, geoName };'), 'emoji factory returns the shared spawn tuple');

const spawnEmojiStart = source.indexOf('function spawnEmojiImage() {');
const spawnEmojiEnd = source.indexOf('/* ── Spawn a shape', spawnEmojiStart);
assert(spawnEmojiStart !== -1 && spawnEmojiEnd !== -1, 'spawnEmojiImage helper exists before spawnShape');
const spawnEmojiSource = source.slice(spawnEmojiStart, spawnEmojiEnd);
assert(spawnEmojiSource.includes('const { mesh, intent, geoName } = createEmojiImage(BOUNDS);'), 'spawnEmojiImage uses createEmojiImage');
assert(spawnEmojiSource.includes('scene.add(mesh);'), 'spawnEmojiImage adds the plane to scene');
assert(spawnEmojiSource.includes('shapes.push(mesh);'), 'spawnEmojiImage tracks the plane in shapes');
assert(spawnEmojiSource.includes('intentEngine.assign(mesh, intent);'), 'spawnEmojiImage registers with IntentEngine');
assert(spawnEmojiSource.includes('createLabel(mesh);'), 'spawnEmojiImage creates a label');
assert(spawnEmojiSource.includes('incrementTypeCount(geoName);'), 'spawnEmojiImage increments the type count');

const spawnShapeStart = source.indexOf('function spawnShape() {');
const spawnCowStart = source.indexOf('function spawnCow() {', spawnShapeStart);
assert(spawnShapeStart !== -1 && spawnCowStart !== -1, 'spawnShape exists before spawnCow');
const spawnShapeSource = source.slice(spawnShapeStart, spawnCowStart);
const specialDispatches = [
  "if (available[0] === 'cow')   { spawnCow();   spawnEmojiImage(); return; }",
  "if (available[0] === 'clown') { spawnClown(); spawnEmojiImage(); return; }",
  "if (available[0] === 'baby')  { spawnBaby();  spawnEmojiImage(); return; }",
  "if (available[0] === 'car')   { spawnCar();   spawnEmojiImage(); return; }",
  "if (available[0] === 'leaf')  { spawnLeaf();  spawnEmojiImage(); return; }",
];
specialDispatches.forEach(snippet => assert(spawnShapeSource.includes(snippet), `paired emoji dispatch exists for ${snippet}`));
assert(spawnShapeSource.includes('const { mesh, intent, geoName } = ShapeFactory.create(BOUNDS);'), 'normal spawn still creates a ShapeFactory 3D object');
assertMatches(/ShapeFactory\.create\(BOUNDS\);[\s\S]*?scene\.add\(mesh\);[\s\S]*?shapes\.push\(mesh\);[\s\S]*?intentEngine\.assign\(mesh, intent\);[\s\S]*?spawnEmojiImage\(\);/, 'normal spawn also creates one emoji image after the 3D object');
assert.strictEqual((spawnShapeSource.match(/spawnEmojiImage\(\)/g) || []).length, 6, 'spawnShape has exactly one emoji call for each special plus normal path');

['function spawnCow() {', 'function spawnClown() {', 'function spawnBaby() {', 'function spawnCar() {', 'function spawnLeaf() {'].forEach((start, index, all) => {
  const begin = source.indexOf(start);
  const end = index + 1 < all.length ? source.indexOf(all[index + 1], begin) : source.indexOf('/* ── Remove a shape', begin);
  assert(begin !== -1 && end !== -1, `${start} section exists`);
  assert(!source.slice(begin, end).includes('spawnEmojiImage();'), `${start} does not hide extra emoji spawning`);
});

console.log('emoji image static checks passed');
