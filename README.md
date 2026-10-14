# LaTeX Escape Encoder

Escapes and unescapes LaTeX special characters and maps a curated set of Unicode code points to LaTeX command sequences. Ships as zero-dependency ESM.

```js
import { escapeLatex, unescapeLatex, encodeUnicode } from 'latex-escape-encoder';

escapeLatex('50% off & \\more');
// => '50\\% off \\& \\textbackslash{}more'

encodeUnicode('café — €25');
// => "caf\\'{e} \\textemdash{} \\texteuro{}25"

unescapeLatex('50\\% off \\& \\textbackslash{}more');
// => '50% off & \\more'
```

## Why this exists

Embedding arbitrary text in a LaTeX document means escaping the ten characters that have special meaning in normal text mode (`\ { } $ & % # _ ^ ~`). Doing this by hand is error-prone, and many Unicode characters also need translation to LaTeX commands for legacy engines that lack native UTF-8 support.

The trade-off: this library treats input as literal characters, not LaTeX structure. `escapeLatex` will happily escape a backslash that is already part of a macro, so `\foo` becomes `\textbackslash{}foo`. That is wrong if your input is already LaTeX, but correct if your input is plain user text that must never be interpreted as LaTeX. A structural parser would be a much larger project and is out of scope.

`unescapeLatex` reverses only the exact sequences this library produces. It is not a general LaTeX-to-Unicode converter; arbitrary user macros pass through untouched.

## The awkward edge

`escapeLatex` is not idempotent. Running it twice on the same string doubles every backslash, because the backslashes inserted on the first pass are themselves literal characters on the second pass. If you need to escape text that may already be partially escaped, escape exactly once at the boundary where untrusted text enters your document.

`encodeUnicode` maps a curated set of Western punctuation and accented Latin characters. Unmapped characters (including emoji and most non-Latin scripts) are returned unchanged. If you need exhaustive Unicode coverage, pair this with a dedicated fontspec/XeTeX setup instead.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

