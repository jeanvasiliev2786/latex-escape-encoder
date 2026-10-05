import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeLatex, unescapeLatex, encodeUnicode } from '../src/index.js';

test('escapeLatex escapes all ten special characters', () => {
  const input = '\\{}$&%#_^~';
  const expected = '\\textbackslash{}\\{\\}\\$\\&\\%\\#\\_\\textasciicircum{}\\textasciitilde{}';
  assert.equal(escapeLatex(input), expected);
});

test('escapeLatex leaves non-special characters untouched', () => {
  assert.equal(escapeLatex('Hello, World 123!'), 'Hello, World 123!');
});

test('escapeLatex escapes backslash before other specials to avoid double-escaping inserted backslashes', () => {
  // If backslash were not handled first, the backslash inserted before '$'
  // would itself be escaped again.
  assert.equal(escapeLatex('\\$'), '\\textbackslash{}\\$');
});

test('escapeLatex is idempotent on already-escaped text only in the sense that re-escaping inserts more backslashes; we document and test the actual behaviour', () => {
  // Re-escaping escaped text replaces each backslash with \textbackslash{}
  // because we treat input as literal characters, not LaTeX structure. This
  // is the intended trade-off.
  const once = escapeLatex('50% off');
  assert.equal(once, '50\\% off');
  const twice = escapeLatex(once);
  assert.equal(twice, '50\\textbackslash{}\\% off');
});

test('escapeLatex throws on non-string input', () => {
  assert.throws(() => escapeLatex(42), TypeError);
  assert.throws(() => escapeLatex(null), TypeError);
});

test('unescapeLatex reverses escapeLatex for the special characters', () => {
  const original = 'Cost: 100% & \\50 #1 _test ^x ~y';
  const escaped = escapeLatex(original);
  assert.equal(unescapeLatex(escaped), original);
});

test('unescapeLatex reverses encodeUnicode for mapped characters', () => {
  const original = 'café — résumé — €100';
  const encoded = encodeUnicode(original);
  assert.equal(unescapeLatex(encoded), original);
});

test('unescapeLatex leaves unknown macros untouched', () => {
  // A user-defined macro that this library does not produce should pass
  // through verbatim rather than being mangled.
  assert.equal(unescapeLatex('\\foo{bar}'), '\\foo{bar}');
});

test('unescapeLatex uses greedy longest match so textbackslash is consumed whole', () => {
  // If the matcher tried the short token '\\' first it would stop after the
  // leading backslash and leave 'textbackslash{}' dangling.
  assert.equal(unescapeLatex('\\textbackslash{}'), '\\');
});

test('unescapeLatex throws on non-string input', () => {
  assert.throws(() => unescapeLatex(undefined), TypeError);
});

test('encodeUnicode maps common accented Latin characters', () => {
  assert.equal(encodeUnicode('café'), "caf\\'{e}");
  assert.equal(encodeUnicode('naïve'), "na\\\"{i}ve");
});

test('encodeUnicode maps punctuation and symbols', () => {
  assert.equal(encodeUnicode('€100'), '\\texteuro{}100');
  assert.equal(encodeUnicode('© 2024'), '\\textcopyright{} 2024');
});

test('encodeUnicode leaves unmapped characters unchanged', () => {
  // Emoji and other code points outside the curated map pass through.
  assert.equal(encodeUnicode('😀'), '😀');
});

test('encodeUnicode throws on non-string input', () => {
  assert.throws(() => encodeUnicode({}), TypeError);
});

test('full round-trip through escapeLatex then encodeUnicode then unescapeLatex', () => {
  const original = 'Price: 50% off (café) — €25 & \\more';
  const escaped = escapeLatex(original);
  const encoded = encodeUnicode(escaped);
  const restored = unescapeLatex(encoded);
  assert.equal(restored, original);
});
