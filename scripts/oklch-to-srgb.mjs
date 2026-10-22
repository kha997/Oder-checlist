/**
 * Build-time palette normalisation for PDF export.
 *
 * Tailwind CSS v4 defines its colour palette in `oklch()` and writes gradients
 * with an `in oklab` interpolation hint. html2canvas (used by
 * src/utils/pdfExport.ts for the "Tải File PDF" action) supports neither: it
 * throws `Attempting to parse an unsupported color function "oklch"` — or the
 * same error naming `oklab` for gradients — so every PDF export failed. There is
 * no Tailwind option to emit sRGB instead (verified against the v4 docs), so the
 * two constructs are rewritten here, on the emitted CSS, before it reaches the
 * browser.
 *
 * Nothing a browser does changes: `oklch()` becomes the equivalent `rgb()`, and
 * the `in oklab` hint is the gradient default anyway. The conversion is the
 * OKLCH -> OKLab -> linear sRGB -> sRGB transform from the OKLCH specification,
 * cross-checked against the hex fallbacks Tailwind itself emits for opacity
 * modifiers (see scripts/verify-oklch-palette.mjs).
 */

const O_KLCH_RE = /oklch\(\s*([-\d.]+%?)\s+([-\d.]+%?)\s+([-\d.]+)(?:\s*\/\s*([-\d.]+%?))?\s*\)/g;

/**
 * `linear-gradient(to bottom in oklab, ...)` — the colour-interpolation hint
 * Tailwind v4 hardcodes into every gradient (`--tw-gradient-position: to bottom
 * in oklab`).
 *
 * html2canvas cannot parse it, and not because it lacks OKLab support: its
 * tokenizer treats `in oklab` as a *single* identifier token, which then fails
 * both the `to`-branch and the angle-branch of parseFunctionArgs and is handed
 * to the colour parser as an IDENT, which throws "Attempting to parse an
 * unsupported color function \"oklab\"". Dropping the hint restores the CSS
 * default (`in oklab` is itself the default for gradients), so rendering is
 * unaffected.
 */
const INTERPOLATION_HINT_RE = /\bin\s+(?:oklab|oklch|srgb-linear|srgb|lab|lch|hsl|hwb)\b\s*/g;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** sRGB transfer function (linear -> gamma-encoded). */
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

const inGamut = (linear) => linear.every((c) => c >= -1e-7 && c <= 1 + 1e-7);

/** Whether oklch(L, C, H) is representable in sRGB without clipping. */
export const isInSrgbGamut = (L, C, Hdeg) => inGamut(toLinearRgb(L, C, Hdeg));

/** OKLCH -> linear-light sRGB, with no gamut handling. */
function toLinearRgb(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * Convert the numeric components of oklch() to `{ r, g, b, a }` (0-255, a 0-1).
 *
 * A handful of Tailwind palette entries sit just outside the sRGB gamut. Those
 * are clipped per channel — the same thing browsers do when they rasterise an
 * out-of-gamut `oklch()` colour — which lands within 2/255 of the value
 * colorjs.io computes for Tailwind's hex fallbacks (it reduces chroma instead;
 * see scripts/verify-oklch-palette.mjs, which asserts the tolerance).
 */
export function oklchToSrgb(L, C, Hdeg, alpha) {
  const [r, g, b] = toLinearRgb(L, C, Hdeg).map((c) => Math.round(clamp01(gamma(clamp01(c))) * 255));
  return { r, g, b, a: alpha ?? 1 };
}

const pct = (token) => (token.endsWith('%') ? Number(token.slice(0, -1)) / 100 : Number(token));

/** Convert one `oklch(...)` function to an equivalent `rgb(...)` string. */
export function convertOklchFunction(match, L, C, H, alpha) {
  const { r, g, b, a } = oklchToSrgb(pct(L), pct(C), Number(H), alpha === undefined ? undefined : pct(alpha));
  return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgb(${r}, ${g}, ${b} / ${Number(a.toFixed(3))})`;
}

/** Rewrite every `oklch()` occurrence in a CSS string. Returns null if untouched. */
export function convertOklchInCss(css) {
  if (!css.includes('oklch(') && !/in\s+(?:oklab|oklch|srgb-linear|srgb|lab|lch|hsl|hwb)\b/.test(css)) return null;
  O_KLCH_RE.lastIndex = 0;
  INTERPOLATION_HINT_RE.lastIndex = 0;
  const out = css.replace(INTERPOLATION_HINT_RE, '').replace(O_KLCH_RE, convertOklchFunction);
  return out === css ? null : out;
}

/**
 * Vite plugin: apply the conversion to every emitted stylesheet.
 *
 * Uses `generateBundle` rather than `transform`: Tailwind's Vite plugin compiles
 * the stylesheet in its own `generateBundle` pass, so during `transform` the CSS
 * still contains `@import "tailwindcss"` with none of the palette inlined yet.
 * `enforce: 'post'` + `apply: 'build'` put this after that compile and keep it
 * away from the dev server (where nothing parses the CSS programmatically).
 */
export function oklchToSrgbPlugin() {
  return {
    name: 'oklch-to-srgb',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== 'asset' || !item.fileName.endsWith('.css')) continue;
        const source = typeof item.source === 'string' ? item.source : Buffer.from(item.source).toString('utf8');
        const next = convertOklchInCss(source);
        if (next !== null) item.source = next;
      }
    },
  };
}
