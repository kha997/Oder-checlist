/**
 * Cross-validates the OKLCH -> sRGB conversion in oklch-to-srgb.mjs.
 *
 * Tailwind emits two representations of every palette colour in the built CSS:
 * the `oklch()` custom property (`--color-emerald-600`) and, for opacity
 * modifiers, a pre-computed sRGB hex fallback (`.border-emerald-600\/60 ->
 * #00976799`, written outside the `@supports (color-mix())` block). Tailwind
 * computes those hex values itself with colorjs.io, so they are an independent
 * reference implementation: converting the `oklch()` property must reproduce
 * them.
 *
 * Run after a build: node scripts/verify-oklch-palette.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { isInSrgbGamut, oklchToSrgb } from './oklch-to-srgb.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');

const pct = (t) => (t.endsWith('%') ? Number(t.slice(0, -1)) / 100 : Number(t));

/** --color-emerald-600: oklch(59.6% 0.145 163.225) -> { name: { rgb, inGamut } } */
function readPalette() {
  const theme = readFileSync(path.join(repoRoot, 'node_modules/tailwindcss/theme.css'), 'utf8');
  const palette = new Map();
  for (const m of theme.matchAll(/--color-([a-z0-9-]+):\s*oklch\(\s*([-\d.]+%?)\s+([-\d.]+%?)\s+([-\d.]+)\s*\)/g)) {
    const L = pct(m[2]);
    const C = pct(m[3]);
    const H = Number(m[4]);
    const { r, g, b } = oklchToSrgb(L, C, H, 1);
    palette.set(m[1], { rgb: [r, g, b], inGamut: isInSrgbGamut(L, C, H) });
  }
  return palette;
}

/** .border-emerald-600\/60{border-color:#00976799} -> { color: 'emerald-600', rgb: [0,151,103] } */
function readHexFallbacks(css) {
  const out = new Map();
  const re = /\.([a-z]+)-([a-z]+-\d+|white|black)\\\/(\d+)\{[^}]*:#([0-9a-f]{3,8})\}/g;
  for (const m of css.matchAll(re)) {
    let hex = m[4];
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join('');
    out.set(m[2], [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]);
  }
  return out;
}

const distDir = path.join(repoRoot, 'dist/assets');
const cssFile = readdirSync(distDir).find((f) => /^index-.*\.css$/.test(f));
if (!cssFile) {
  console.error(`FAIL: no built stylesheet found in ${distDir} — run \`npm run build\` first.`);
  process.exit(1);
}

const css = readFileSync(path.join(distDir, cssFile), 'utf8');
const converted = (css.match(/oklch\(/g) ?? []).length;
const interpolationHints = (css.match(/\bin\s+(?:oklab|oklch|srgb-linear|srgb|lab|lch|hsl|hwb)\b/g) ?? []).length;

const palette = readPalette();
const fallbacks = readHexFallbacks(css);

// Tailwind writes its hex fallbacks with colorjs.io, which gamut-maps by
// reducing chroma; oklch-to-srgb.mjs clips per channel instead — the same thing
// a browser does when it rasterises an out-of-gamut oklch() colour, so it
// matches what the user actually sees on screen and in the PDF.
//
// In-gamut palette entries must therefore agree exactly. Out-of-gamut ones are
// permitted to drift (rose-500 differs by 3/255, for instance), so they are only
// required to stay close.
const OUT_OF_GAMUT_TOLERANCE = 10;

let checked = 0;
let exact = 0;
let clipped = 0;
const failures = [];

for (const [colorName, expected] of fallbacks) {
  const entry = palette.get(colorName);
  if (!entry) continue; // e.g. --color-white is not defined in oklch
  checked++;
  const delta = Math.max(...entry.rgb.map((c, i) => Math.abs(c - expected[i])));
  if (entry.inGamut) {
    if (delta === 0) exact++;
    else failures.push({ colorName, expected, got: entry.rgb, delta, inGamut: true });
  } else {
    if (delta <= OUT_OF_GAMUT_TOLERANCE) clipped++;
    else failures.push({ colorName, expected, got: entry.rgb, delta, inGamut: false });
  }
}

console.log(`oklch() occurrences left in ${cssFile}: ${converted}`);
console.log(`colour-interpolation hints left in ${cssFile}: ${interpolationHints}`);
console.log(`palette colours cross-checked against Tailwind's own hex fallbacks: ${checked}`);
console.log(`  in gamut, exact match:            ${exact}`);
console.log(`  out of gamut, clipped (<=${OUT_OF_GAMUT_TOLERANCE}):     ${clipped}`);
if (failures.length) {
  console.error('  MISMATCHES:');
  for (const f of failures.slice(0, 10)) {
    console.error(`    --color-${f.colorName}: expected rgb(${f.expected}) got rgb(${f.got}) (delta ${f.delta}${f.inGamut ? ', in gamut — must match exactly' : ''})`);
  }
  process.exit(1);
}
if (converted !== 0) {
  console.error('FAIL: oklch() still present in the built CSS — is the vite plugin wired in?');
  process.exit(1);
}
if (interpolationHints !== 0) {
  console.error('FAIL: gradient interpolation hints still present — html2canvas cannot parse them.');
  process.exit(1);
}
if (checked < 30) {
  console.error(`FAIL: only ${checked} colours cross-checked — the extraction regex likely no longer matches.`);
  process.exit(1);
}
console.log('OK: build palette is plain sRGB and matches Tailwind within rounding.');
