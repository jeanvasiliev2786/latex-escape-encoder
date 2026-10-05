/**
 * LaTeX Escape Encoder
 *
 * Escapes and unescapes LaTeX special characters and maps a small set of
 * common Unicode code points to LaTeX command sequences.
 *
 * Design decisions (stated plainly so the behaviour is predictable):
 *
 * 1. Escaping is purely character-based. We do NOT attempt to parse LaTeX
 *    structure, so a backslash already present in the input is treated as a
 *    literal backslash and escaped to `\textbackslash{}`. This means escaping
 *    is idempotent-safe on plain text but will double-escape text that already
 *    contains LaTeX commands. That is the intended trade-off: a structural
 *    parser is far larger in scope and out of bounds for this library.
 *
 * 2. `unescapeLatex` reverses ONLY the exact sequences produced by
 *    `escapeLatex` plus the Unicode mappings from `encodeUnicode`. It is not a
 *    general-purpose LaTeX-to-Unicode converter; arbitrary user macros are
 *    left untouched. Keeping the round-trip closed is more valuable than
 *    partial coverage of the LaTeX macro universe.
 *
 * 3. `encodeUnicode` maps a curated set of Unicode characters to LaTeX
 *    commands. It does not attempt to be exhaustive. Unmapped characters are
 *    returned unchanged so the caller can decide whether to strip or substitute
 *    them.
 */

/**
 * Characters that have special meaning in LaTeX normal text mode and the
 * sequences we replace them with. Order matters: backslash must be escaped
 * first, otherwise we would escape the backslashes we just inserted.
 *
 * `~` is mapped to `\textasciitilde{}` rather than `\~{}` because the latter
 * is the accent macro and would render as a tilde over the following base
 * character, not a standalone tilde.
 */
const ESCAPE_MAP = [
  ['\\', '\\textbackslash{}'],
  ['{', '\\{'],
  ['}', '\\}'],
  ['$', '\\$'],
  ['&', '\\&'],
  ['%', '\\%'],
  ['#', '\\#'],
  ['_', '\\_'],
  ['^', '\\textasciicircum{}'],
  ['~', '\\textasciitilde{}'],
];

/**
 * Curated Unicode-to-LaTeX mapping. Covers the characters most likely to
 * appear in Western prose. Exhaustive coverage of every Unicode code point is
 * explicitly out of scope.
 */
const UNICODE_MAP = {
  'À': '\\`{A}',
  'Á': "\\'{A}",
  'Â': '\\^{A}',
  'Ã': '\\~{A}',
  'Ä': '\\"{A}',
  'Å': '\\AA{}',
  'Æ': '\\AE{}',
  'Ç': '\\c{C}',
  'È': '\\`{E}',
  'É': "\\'{E}",
  'Ê': '\\^{E}',
  'Ë': '\\"{E}',
  'Ì': '\\`{I}',
  'Í': "\\'{I}",
  'Î': '\\^{I}',
  'Ï': '\\"{I}',
  'Ñ': '\\~{N}',
  'Ò': '\\`{O}',
  'Ó': "\\'{O}",
  'Ô': '\\^{O}',
  'Õ': '\\~{O}',
  'Ö': '\\"{O}',
  'Ø': '\\O{}',
  'Ù': '\\`{U}',
  'Ú': "\\'{U}",
  'Û': '\\^{U}',
  'Ü': '\\"{U}',
  'Ý': "\\'{Y}",
  'Þ': '\\TH{}',
  'ß': '\\ss{}',
  'à': '\\`{a}',
  'á': "\\'{a}",
  'â': '\\^{a}',
  'ã': '\\~{a}',
  'ä': '\\"{a}',
  'å': '\\aa{}',
  'æ': '\\ae{}',
  'ç': '\\c{c}',
  'è': '\\`{e}',
  'é': "\\'{e}",
  'ê': '\\^{e}',
  'ë': '\\"{e}',
  'ì': '\\`{i}',
  'í': "\\'{i}",
  'î': '\\^{i}',
  'ï': '\\"{i}',
  'ñ': '\\~{n}',
  'ò': '\\`{o}',
  'ó': "\\'{o}",
  'ô': '\\^{o}',
  'õ': '\\~{o}',
  'ö': '\\"{o}',
  'ø': '\\o{}',
  'ù': '\\`{u}',
  'ú': "\\'{u}",
  'û': '\\^{u}',
  'ü': '\\"{u}',
  'ý': "\\'{y}",
  'þ': '\\th{}',
  'ÿ': '\\"{y}',
  '«': '\\guillemotleft{}',
  '»': '\\guillemotright{}',
  '—': '\\textemdash{}',
  '–': '\\textendash{}',
  '‘': '`',
  '’': "'",
  '“': '``',
  '”': "''",
  '…': '\\ldots{}',
  '°': '\\textdegree{}',
  '±': '\\textpm{}',
  '×': '\\texttimes{}',
  '÷': '\\textdiv{}',
  '€': '\\texteuro{}',
  '£': '\\textsterling{}',
  '©': '\\textcopyright{}',
  '®': '\\textregistered{}',
  '™': '\\texttrademark{}',
  '§': '\\S{}',
  '¶': '\\P{}',
  '†': '\\dag{}',
  '‡': '\\ddag{}',
  '•': '\\textbullet{}',
};

/**
 * Reverse of ESCAPE_MAP, plus the Unicode command mappings. Built once at
 * module load so `unescapeLatex` does not rebuild it on every call.
 *
 * Longer sequences are placed before shorter ones so that, for example,
 * `\textbackslash{}` is matched as a whole rather than being partially
 * consumed by `\textbackslash` followed by `{}`.
 */
const UNESCAPE_MAP = (() => {
  const entries = [];
  for (const [char, seq] of ESCAPE_MAP) {
    entries.push([seq, char]);
  }
  for (const [char, seq] of Object.entries(UNICODE_MAP)) {
    entries.push([seq, char]);
  }
  // Sort by sequence length, descending, so greedy longest-match works.
  entries.sort((a, b) => b[0].length - a[0].length);
  return entries;
})();

/**
 * Escape LaTeX special characters in a string so the result can be safely
 * embedded in LaTeX normal text mode.
 *
 * Only the ten characters with special meaning in LaTeX are transformed.
 * Everything else, including Unicode, is left as-is. Pair this with
 * `encodeUnicode` if you also need Unicode-to-command conversion.
 *
 * @param {string} input - The text to escape.
 * @returns {string} The escaped text.
 */
export function escapeLatex(input) {
  if (typeof input !== 'string') {
    throw new TypeError('escapeLatex expects a string');
  }
  let out = '';
  for (const ch of input) {
    let replaced = false;
    for (const [char, seq] of ESCAPE_MAP) {
      if (ch === char) {
        out += seq;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      out += ch;
    }
  }
  return out;
}

/**
 * Reverse the exact sequences produced by `escapeLatex` and `encodeUnicode`.
 *
 * Uses a greedy longest-match scan so composite sequences like
 * `\textbackslash{}` are consumed whole rather than being split across
 * `\textbackslash` and `{}`. Sequences not produced by this library are left
 * untouched, which means arbitrary user macros pass through verbatim.
 *
 * @param {string} input - The LaTeX text to unescape.
 * @returns {string} The unescaped text.
 */
export function unescapeLatex(input) {
  if (typeof input !== 'string') {
    throw new TypeError('unescapeLatex expects a string');
  }
  let out = '';
  let i = 0;
  while (i < input.length) {
    let matched = false;
    for (const [seq, char] of UNESCAPE_MAP) {
      if (input.startsWith(seq, i)) {
        out += char;
        i += seq.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += input[i];
      i += 1;
    }
  }
  return out;
}

/**
 * Replace Unicode characters with LaTeX command sequences.
 *
 * Only the curated set in `UNICODE_MAP` is converted; every other character is
 * returned unchanged. This is deliberately conservative: emitting a wrong
 * command is worse than emitting the raw character, and an exhaustive map is
 * far beyond this library's scope.
 *
 * @param {string} input - The text to convert.
 * @returns {string} The text with known Unicode characters replaced.
 */
export function encodeUnicode(input) {
  if (typeof input !== 'string') {
    throw new TypeError('encodeUnicode expects a string');
  }
  let out = '';
  for (const ch of input) {
    out += Object.prototype.hasOwnProperty.call(UNICODE_MAP, ch) ? UNICODE_MAP[ch] : ch;
  }
  return out;
}
