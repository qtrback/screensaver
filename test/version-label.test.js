const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('index.html', 'utf8');
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;

// Exactly one element with id="version-label", text equals "v" + package.json version.
const idCount = (source.match(/\bid="version-label"/g) || []).length;
assert.strictEqual(idCount, 1, 'exactly one element with id="version-label" must exist');
const matches = [...source.matchAll(/<(\w+)\b[^>]*\bid="version-label"[^>]*>([^<]*)<\/\1>/g)];
assert.strictEqual(matches.length, 1, 'version-label must be a simple element containing only text');
assert.strictEqual(matches[0][2].trim(), 'v' + version, 'version label text must equal "v" + package.json version');

// Not nested inside #ui (which hides on idle and sits bottom-right).
const markup = source.slice(source.indexOf('<body')).replace(/<script[\s\S]*?<\/script>/g, '');
const uiStart = markup.indexOf('<div id="ui"');
assert(uiStart !== -1, '#ui element exists');
let depth = 0;
let uiEnd = -1;
const tagRe = /<(\/?)div\b[^>]*>/g;
tagRe.lastIndex = uiStart;
let m;
while ((m = tagRe.exec(markup))) {
  depth += m[1] ? -1 : 1;
  if (depth === 0) { uiEnd = tagRe.lastIndex; break; }
}
assert(uiEnd !== -1, '#ui element is closed');
const labelPos = markup.indexOf('id="version-label"');
assert(labelPos !== -1 && (labelPos < uiStart || labelPos >= uiEnd), 'version-label must not be inside #ui');

// CSS rule.
const ruleMatch = source.match(/(?:^|\n)\s*#version-label\s*\{([^}]*)\}/);
assert(ruleMatch, '#version-label CSS rule exists');
const rule = ruleMatch[1];
for (const decl of [
  /position:\s*fixed\s*;/,
  /bottom:\s*24px\s*;/,
  /left:\s*24px\s*;/,
  /pointer-events:\s*none\s*;/,
  /(?:^|[\s;])user-select:\s*none\s*;/,
]) {
  assert(decl.test(rule), '#version-label rule must match ' + decl);
}

// Light theme override.
assert(
  /body\.theme-light\s+#version-label\s*\{[^}]*\}/.test(source),
  'body.theme-light #version-label override exists'
);

// Dark alpha is lower than #btn-labels' alpha.
const alphaOf = (css) => {
  const a = css.match(/(?:^|[\s;])color:\s*rgba\([^)]*,\s*([\d.]+)\s*\)/);
  assert(a, 'color with alpha expected in: ' + css.trim());
  return parseFloat(a[1]);
};
const btnRule = source.match(/#btn-labels,\s*#btn-theme\s*\{([^}]*)\}/);
assert(btnRule, '#btn-labels rule exists');
assert(alphaOf(rule) < alphaOf(btnRule[1]), 'version label alpha must be lower than #btn-labels alpha');

console.log('version-label check passed');
