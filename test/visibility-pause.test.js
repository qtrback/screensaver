const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('index.html', 'utf8');

function assertMatches(pattern, message) {
  assert(pattern.test(source), message || `Expected index.html to match: ${pattern}`);
}

// Fact 1: paused is seeded from document.hidden at init.
assertMatches(
  /let\s+paused\s*=\s*document\.hidden\s*;/,
  'paused flag is seeded from document.hidden at init'
);

// Fact 2: the visibilitychange listener sets paused = true when document.hidden.
assertMatches(
  /addEventListener\s*\(\s*['"]visibilitychange['"]\s*,\s*\(\s*\)\s*=>\s*\{\s*if\s*\(\s*document\.hidden\s*\)\s*\{\s*paused\s*=\s*true\s*;/,
  'visibilitychange listener sets paused = true when document.hidden is true'
);

// Fact 3: the `if (paused) return;` guard sits inside animate(), before the dt line.
const animateStart = source.search(/function\s+animate\s*\(\s*\)\s*\{/);
assert(animateStart !== -1, 'animate() function exists');
const animateBody = source.slice(animateStart);

const guardPattern = /if\s*\(\s*paused\s*\)\s*return\s*;/;
const dtPattern = /const\s+dt\s*=\s*Math\.min\s*\(\s*clock\.getDelta\s*\(\s*\)\s*,\s*0\.1\s*\)/;

const guardIndex = animateBody.search(guardPattern);
const dtIndex = animateBody.search(dtPattern);

assert(guardIndex !== -1, 'if (paused) return; guard exists inside animate()');
assert(dtIndex !== -1, 'dt cap line exists inside animate()');
assert(
  guardIndex < dtIndex,
  'the paused guard precedes the dt line inside animate(), so a hidden frame advances no scene state'
);

// Fact 4: the resume (visible) branch calls clock.getDelta() as a bare, discarded statement.
assertMatches(
  /else\s*\{\s*clock\.getDelta\s*\(\s*\)\s*;[\s\S]*?paused\s*=\s*false\s*;/,
  'resume branch calls clock.getDelta() as a bare statement, discarding the accumulated hidden span, before clearing paused'
);

// Fact 5: the first live frame's dt is capped via Math.min(clock.getDelta(), 0.1).
assertMatches(
  /=\s*Math\.min\s*\(\s*clock\.getDelta\s*\(\s*\)\s*,\s*0\.1\s*\)/,
  'dt is capped via Math.min(clock.getDelta(), 0.1)'
);

console.log('visibility pause/resume static checks passed');
