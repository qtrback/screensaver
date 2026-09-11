const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('index.html', 'utf8');

const animateStart = source.indexOf('function animate() {');
const animateEnd = source.indexOf('animate();', animateStart);
assert(animateStart !== -1 && animateEnd !== -1, 'animate() function and its invocation both exist');
assert(animateStart < animateEnd, 'animate() definition must precede its invocation');
const animateSource = source.slice(animateStart, animateEnd);

assert(
  animateSource.includes('Math.min(clock.getDelta(), 0.1)'),
  'animate() must clamp the per-frame delta to 0.1 via Math.min(clock.getDelta(), 0.1)'
);

console.log('framecap delta-clamp check passed');
