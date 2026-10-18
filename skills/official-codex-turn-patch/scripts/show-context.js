'use strict';

// Print bounded context from a minified bundle; never dump the whole line.
const fs = require('node:fs');
const [file, needle, requestedRadius] = process.argv.slice(2);
const radius = requestedRadius === undefined ? 300 : Number(requestedRadius);
if (!file || !needle || !Number.isInteger(radius) || radius < 0 || radius > 2000) {
  console.error('Usage: node skills/official-codex-turn-patch/scripts/show-context.js <bundle-file> <literal-search-text> [radius-0..2000]');
  process.exit(2);
}
const source = fs.readFileSync(file, 'utf8');
let found = 0;
let from = 0;
while (found < 8) {
  const at = source.indexOf(needle, from);
  if (at < 0) break;
  console.log(`match ${found + 1} at offset ${at}:`);
  console.log(source.slice(Math.max(0, at - radius), Math.min(source.length, at + needle.length + radius)));
  found++;
  from = at + needle.length;
}
if (!found) {
  console.error(`No matches for ${JSON.stringify(needle)} in ${file}`);
  process.exitCode = 1;
} else if (source.indexOf(needle, from) >= 0) {
  console.log('More than 8 matches; narrow the search text.');
}
