const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('index.html', 'utf8');

function assertContains(haystack, snippet, message) {
  assert(haystack.includes(snippet), message || `Expected source to contain: ${snippet}`);
}

function assertMatches(haystack, pattern, message) {
  assert(pattern.test(haystack), message || `Expected source to match: ${pattern}`);
}

const clickStart = source.indexOf('/* -- Click gestures via raycasting -- */');
const collisionStart = source.indexOf('function resolveCollisions()', clickStart);
assert(clickStart !== -1 && collisionStart !== -1, 'click gesture section exists');
const clickSource = source.slice(clickStart, collisionStart);

const dblclickHandlerStart = clickSource.indexOf("renderer.domElement.addEventListener('dblclick'");
const singleClickHandlerStart = clickSource.indexOf("renderer.domElement.addEventListener('click'");
const menuStart = clickSource.indexOf('let shapeMenu = null;');
const contextMenuHandlerStart = clickSource.indexOf("renderer.domElement.addEventListener('contextmenu'");
assert(dblclickHandlerStart !== -1, 'dblclick handler exists');
assert(singleClickHandlerStart !== -1, 'click handler exists');
assert(menuStart !== -1, 'shape menu helpers exist');
assert(contextMenuHandlerStart !== -1, 'contextmenu handler exists');
assert(dblclickHandlerStart < singleClickHandlerStart, 'dblclick handler still precedes click handler');
assert(singleClickHandlerStart < menuStart, 'shape menu was added after the existing click handler');
assert(menuStart < contextMenuHandlerStart, 'contextmenu handler is wired after menu helpers');

const dblclickSource = clickSource.slice(dblclickHandlerStart, singleClickHandlerStart);
const singleClickSource = clickSource.slice(singleClickHandlerStart, menuStart);
const shapeMenuSource = clickSource.slice(menuStart, collisionStart);
const contextMenuHandlerSource = clickSource.slice(contextMenuHandlerStart, collisionStart);

const expectedDblclickSource = `renderer.domElement.addEventListener('dblclick', (event) => {
    const target = pickShape(event);
    if (target) {
      // Double-click: explode-delete. Capture world position before the
      // shape is removed, burst there, then delete. No keep-one floor.
      const burstPosition = target.getWorldPosition(new THREE.Vector3());
      spawnBurst(burstPosition);
      removeShape(target);
    }
  });

  `;
const expectedSingleClickSource = `renderer.domElement.addEventListener('click', (event) => {
    const target = pickShape(event);
    if (target) {
      // Plain click: freeze toggle.
      intentEngine.toggleFrozen(target);
    }
  });

  `;
assert.strictEqual(dblclickSource, expectedDblclickSource, 'existing dblclick burst+remove handler is byte-for-byte unchanged');
assert.strictEqual(singleClickSource, expectedSingleClickSource, 'existing click freeze handler is byte-for-byte unchanged');

assertContains(shapeMenuSource, "renderer.domElement.addEventListener('contextmenu'", 'contextmenu listener is registered on renderer.domElement');
assertMatches(contextMenuHandlerSource, /event\.preventDefault\(\);[\s\S]*?const target = pickShape\(event\);/, 'contextmenu handler prevents the native menu and reuses pickShape(event)');
assertMatches(contextMenuHandlerSource, /if \(!target\) \{[\s\S]*?closeShapeMenu\(\);[\s\S]*?return;[\s\S]*?\}/, 'empty-space right-click closes/keeps closed instead of opening a menu');
assertContains(contextMenuHandlerSource, 'openShapeMenu(target, event.clientX, event.clientY);', 'contextmenu opens the shape menu at the cursor coordinates');

assertContains(shapeMenuSource, "addShapeMenuAction(menu, 'delete'", 'delete top-level action exists');
assertContains(shapeMenuSource, "addShapeMenuAction(menu, 'freeze'", 'freeze top-level action exists');
assertContains(shapeMenuSource, "addShapeMenuAction(menu, 'change color'", 'change color top-level action exists');
assert.deepStrictEqual(
  Array.from(shapeMenuSource.matchAll(/addShapeMenuAction\(menu, '([^']+)'/g), match => match[1]),
  ['delete', 'freeze', 'change color'],
  'shape menu presents exactly three top-level actions'
);

assertMatches(shapeMenuSource, /addShapeMenuAction\(menu, 'delete',[\s\S]*?const burstPosition = target\.getWorldPosition\(new THREE\.Vector3\(\)\);[\s\S]*?spawnBurst\(burstPosition\);[\s\S]*?removeShape\(target\);[\s\S]*?closeShapeMenu\(\);/, 'delete action mirrors dblclick burst+remove and closes the menu');
assertMatches(shapeMenuSource, /addShapeMenuAction\(menu, 'freeze',[\s\S]*?intentEngine\.toggleFrozen\(target\);[\s\S]*?closeShapeMenu\(\);/, 'freeze action toggles frozen state and closes the menu');

assertContains(shapeMenuSource, 'const palette = THEMES[activeTheme].palette;', 'change-color reads the active theme palette live');
assertMatches(shapeMenuSource, /palette\.forEach\(hex => \{[\s\S]*?document\.createElement\('button'\)[\s\S]*?swatch\.style\.background = cssColor;[\s\S]*?swatches\.appendChild\(swatch\);[\s\S]*?\}\);/, 'change-color renders one clickable swatch per palette entry');
assertContains(shapeMenuSource, "`#${hex.toString(16).padStart(6, '0')}`", 'swatch colors convert 0xRRGGBB numbers to CSS hex colors');
assertMatches(shapeMenuSource, /swatch\.addEventListener\('click',[\s\S]*?recolorShapeFromMenu\(target, hex\);[\s\S]*?closeShapeMenu\(\);/, 'picking a swatch recolors the target and closes the menu');

assertMatches(shapeMenuSource, /function recolorShapeFromMenu\(obj, hex\) \{[\s\S]*?if \(obj\.isGroup\) \{[\s\S]*?obj\.traverse\(child => \{[\s\S]*?if \(child\.material && child\.material\.color\) \{[\s\S]*?child\.material\.color\.setHex\(hex\);[\s\S]*?\}\);[\s\S]*?\} else if \(obj\.material && obj\.material\.color\) \{[\s\S]*?obj\.material\.color\.setHex\(hex\);[\s\S]*?\}/, 'group recolor traverses guarded child materials while simple recolor uses obj.material.color.setHex');
assert((shapeMenuSource.match(/\.material\.color\.setHex\(hex\)/g) || []).length >= 2, 'menu code has both group and simple setHex paths');

assertContains(shapeMenuSource, "document.addEventListener('click'", 'outside left-click close listener exists');
assertContains(shapeMenuSource, "document.addEventListener('keydown'", 'Escape close listener exists');
assertContains(shapeMenuSource, "window.addEventListener('scroll'", 'scroll close listener exists');
assertMatches(shapeMenuSource, /menu\.addEventListener\('click', \(event\) => event\.stopPropagation\(\)\);/, 'menu interactions stop click propagation');

const recolorStart = source.indexOf('function recolorLiveShapes(theme) {');
const applyThemeStart = source.indexOf('function applyTheme(name) {', recolorStart);
assert(recolorStart !== -1 && applyThemeStart !== -1, 'recolorLiveShapes section exists');
const recolorLiveShapesSource = source.slice(recolorStart, applyThemeStart);
assertContains(recolorLiveShapesSource, 'const idx = obj.userData.colorIndex;', 'recolorLiveShapes still re-derives simple mesh colors from palette slot');
assertContains(recolorLiveShapesSource, 'obj.material.color.setHex(hex);', 'recolorLiveShapes still applies derived theme color');
assert(!/userData\.colorIndex\s*=/.test(shapeMenuSource), 'shape menu color-pick code does not persist manual color via userData.colorIndex');
assert(!/colorIndex\s*=/.test(shapeMenuSource), 'shape menu color-pick code does not assign colorIndex from a swatch');

console.log('shape menu static checks passed');
