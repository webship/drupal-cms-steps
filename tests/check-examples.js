#!/usr/bin/env node
'use strict';

// Checks this step pack's documentation and features against its definitions,
// without a browser:
//
//   1. every step definition in tests/step-definitions carries a JSDoc block
//      with at least five single-line "Example #n:" phrasings,
//   2. every example matches its own definition and no other definition loaded
//      with it (this pack, webship-js's built-in steps and any other pack
//      cucumber.js requires), so a phrasing that drifts or turns ambiguous
//      fails the build,
//   3. every step in tests/features matches exactly one definition.
//
// Usage: node tests/check-examples.js   (npm run test:examples)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACK_DIR = path.join(ROOT, 'tests', 'step-definitions');
const FEATURES_DIR = path.join(ROOT, 'tests', 'features');
// The other step definitions cucumber.js loads next to this pack's own.
const SHARED_DIRS = [
  path.join(ROOT, 'node_modules', '@webship-js', 'drupal-core-steps', 'tests', 'step-definitions'),
  path.join(ROOT, 'node_modules', 'webship-js', 'tests', 'step-definitions'),
];
const MIN_EXAMPLES = 5;

function cucumberExpressionToRegex(expression) {
  let s = expression.replace(/[.*+?^$|[\]\\]/g, '\\$&');
  s = s.replace(/\(([^)]*)\)/g, '(?:$1)?');
  s = s.replace(/\b(\w+(?:\/\w+)+)\b/g, (m) => '(?:' + m.split('/').join('|') + ')');
  s = s.replace(/\{string\}/g, '(?:"[^"]*"|\'[^\']*\')');
  s = s.replace(/\{int\}/g, '-?\\d+');
  s = s.replace(/\{float\}/g, '-?\\d*\\.?\\d+');
  s = s.replace(/\{word\}/g, '[^\\s]+');
  s = s.replace(/\{\}/g, '.*');
  return new RegExp('^' + s + '$');
}

function extractDefinitions(source, file) {
  const definitions = [];
  const re = /(?:^|\n)[ \t]*(Given|When|Then|defineStep)\(\s*(?:\/((?:\\\/|[^/\n])+)\/([a-z]*)|'((?:\\'|[^'\n])*)'|"((?:\\"|[^"\n])*)"|`([^`\n]*)`)/g;
  let m;
  while ((m = re.exec(source))) {
    const index = m.index + (m[0].startsWith('\n') ? 1 : 0);
    const line = source.slice(0, index).split('\n').length;
    let regex = null;
    let text;
    if (m[2] !== undefined) {
      text = '/' + m[2] + '/' + m[3];
      try { regex = new RegExp(m[2], m[3]); } catch (e) { regex = null; }
    } else {
      text = m[4] !== undefined ? m[4] : (m[5] !== undefined ? m[5] : m[6]);
      try { regex = cucumberExpressionToRegex(text); } catch (e) { regex = null; }
    }
    const before = source.slice(0, index);
    const docEnd = before.lastIndexOf('*/');
    let doc = null;
    if (docEnd !== -1 && /^\s*$/.test(before.slice(docEnd + 2))) {
      const docStart = before.lastIndexOf('/**', docEnd);
      if (docStart !== -1) doc = before.slice(docStart, docEnd + 2);
    }
    const examples = [];
    if (doc) {
      for (const l of doc.split('\n')) {
        const em = l.match(/Example\s*#?\d*\s*:\s*(.*)$/);
        if (em) examples.push(em[1].trim());
      }
    }
    definitions.push({ file, line, keyword: m[1], text, regex, doc, examples });
  }
  return definitions;
}

function loadDir(dir, label) {
  if (!fs.existsSync(dir)) return [];
  let defs = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    defs = defs.concat(extractDefinitions(fs.readFileSync(path.join(dir, f), 'utf8'), label + f));
  }
  return defs;
}

function stripKeyword(s) {
  return s.replace(/^(Given|When|Then|And|But|\*)\s+/, '').trim();
}

const packDefs = loadDir(PACK_DIR, '');
const sharedDefs = SHARED_DIRS.reduce((all, dir) => all.concat(loadDir(dir, path.basename(path.dirname(path.dirname(dir))) + '/')), []);
const allDefs = packDefs.concat(sharedDefs).filter((d) => d.regex);
const problems = [];

for (const d of packDefs) {
  const where = `${d.file}:${d.line}`;
  if (!d.regex) problems.push(`${where}  step pattern did not compile: ${d.text}`);
  if (!d.doc) {
    problems.push(`${where}  no JSDoc block above the definition`);
  } else if (d.examples.length < MIN_EXAMPLES) {
    problems.push(`${where}  only ${d.examples.length} "Example #n:" line(s); ${MIN_EXAMPLES} are required`);
  }
  for (const example of d.examples) {
    const body = stripKeyword(example);
    const hits = allDefs.filter((o) => o.regex.test(body));
    if (!d.regex || !d.regex.test(body)) {
      problems.push(`${where}  example does not match its own definition: "${example}"`);
    }
    const others = hits.filter((o) => o !== d);
    if (others.length) {
      problems.push(`${where}  example is ambiguous, also matched by ${others.map((o) => o.file + ':' + o.line).join(', ')}: "${example}"`);
    }
  }
}

let featureSteps = 0;
if (fs.existsSync(FEATURES_DIR)) {
  for (const f of fs.readdirSync(FEATURES_DIR).filter((f) => f.endsWith('.feature'))) {
    const lines = fs.readFileSync(path.join(FEATURES_DIR, f), 'utf8').split('\n');
    lines.forEach((l, i) => {
      const m = l.match(/^\s*(Given|When|Then|And|But|\*)\s+(.*)$/);
      if (!m) return;
      featureSteps++;
      const body = m[2].trim();
      const hits = allDefs.filter((d) => d.regex.test(body));
      if (hits.length === 0) problems.push(`${f}:${i + 1}  undefined step: ${l.trim()}`);
      else if (hits.length > 1) problems.push(`${f}:${i + 1}  ambiguous step (${hits.map((h) => h.file + ':' + h.line).join(' | ')}): ${l.trim()}`);
    });
  }
}

const exampleCount = packDefs.reduce((n, d) => n + d.examples.length, 0);
console.log(`${packDefs.length} step definitions, ${exampleCount} examples, ${featureSteps} feature steps checked against ${allDefs.length} definitions.`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('All examples match their own definition only; all feature steps resolve to exactly one definition.');
