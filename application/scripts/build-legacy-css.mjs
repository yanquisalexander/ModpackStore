import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { transform } from "lightningcss";

const distDir = join(process.cwd(), "dist");
const assetsDir = join(distDir, "assets");

// ─── Step 1: Strip @layer from CSS ───────────────────────────────────────────
// Tailwind v4 wraps all rules in @layer blocks. We need to unwrap them
// while preserving the rule order (which determines cascade priority).
function stripLayers(css) {
  // Remove @layer ordering declaration: @layer theme, base, components, utilities;
  let result = css.replace(/@layer\s+[\w,\s]+;/g, "");

  // Now unwrap each @layer block by finding @layer xxx{ and extracting content
  // until the matching closing brace
  let output = "";
  let i = 0;

  while (i < result.length) {
    // Look for @layer at current position
    const layerMatch = result.slice(i).match(/^@layer\s+\w+\s*\{/);

    if (layerMatch) {
      // Skip past "@layer xxx{"
      i += layerMatch[0].length;

      // Count braces to find the matching closing }
      let depth = 1;
      const contentStart = i;

      while (i < result.length && depth > 0) {
        if (result[i] === "{") depth++;
        else if (result[i] === "}") depth--;
        if (depth > 0) i++;
      }

      // Extract the content between the @layer braces
      const content = result.slice(contentStart, i);
      output += content;

      // Skip past the closing }
      i++;
    } else {
      output += result[i];
      i++;
    }
  }

  return output;
}

// ─── Step 1.5: Color compatibility helpers ───────────────────────────────────
// Old WKWebView (macOS Big Sur / Safari <16.2) does not understand color-mix()
// oklch()/oklab()/lab()/lch() or color(display-p3). Tailwind v4 generates those
// functions plus a fallback declaration and a @supports(color:color-mix(...))
// guard, which works in modern browsers but makes opacity utilities like
// `border-border/50` fall back to full opacity (or nothing) on old WebKit.
// Here we resolve the CSS variables at build time so the legacy stylesheet
// contains concrete rgba() values instead.

// Parse top-level "{...}" groups of a minified stylesheet, keeping their order.
function topLevelGroups(css) {
  const groups = [];
  let depth = 0;
  let start = -1;
  let preludeStart = -1;
  let lastTokenEnd = -1;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      if (depth === 0) {
        preludeStart = lastTokenEnd + 1;
        start = i;
      }
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        groups.push({
          prelude: css.slice(preludeStart, start).trim(),
          body: css.slice(start + 1, i),
          bodyStart: start + 1,
          index: i,
        });
        start = -1;
      }
      lastTokenEnd = i;
    } else if (depth === 0 && ch === ";") {
      lastTokenEnd = i;
    }
  }

  return groups;
}

function varDecls(body) {
  const decls = [];
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(body))) {
    decls.push({ name: m[1].trim(), value: m[2].trim() });
  }
  return decls;
}

const COLOR_FUNC = /(?:oklch|oklab|[^-\w]lab|lch)\s*\(|color\s*\(/i;
const VAR_FUNC = /var\s*\(/i;

function isLegacySafeColor(value) {
  if (!value) return false;
  if (COLOR_FUNC.test(value) || VAR_FUNC.test(value) || /color-mix/i.test(value)) {
    return false;
  }
  return (
    /^#[0-9a-fA-F]{3,8}$/.test(value) ||
    /^rgb\s*\(/.test(value) ||
    /^rgba\s*\(/.test(value) ||
    /^hsl\s*\(/.test(value) ||
    /^hsla\s*\(/.test(value)
  );
}

function parseColor(value) {
  // Supports #hex (3/4/6/8), rgb(r,g,b), rgba(r,g,b,a) with comma or space/slash syntax.
  const hex = value.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = h.split("").map((c) => c + c).join("");
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  const nums = value.match(/[\d.]+/g);
  if (!nums) return null;
  const isHsl = /^hsl/i.test(value);
  if (isHsl) {
    // Approximate; hsl() values are rarely used as a custom property here.
    return null;
  }
  if (nums.length >= 3) {
    const r = Math.round(parseFloat(nums[0]));
    const g = Math.round(parseFloat(nums[1]));
    const b = Math.round(parseFloat(nums[2]));
    const a = nums.length >= 4 ? parseFloat(nums[3]) : 1;
    return { r, g, b, a };
  }
  return null;
}

function mixWithTransparent(color, fraction) {
  const c = parseColor(color);
  if (!c) return null;
  const alpha = c.a * fraction;
  const rounded = Math.round(alpha * 1000) / 1000;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${rounded})`;
}

function rgbaString(c) {
  const r = Math.round(c.r);
  const g = Math.round(c.g);
  const b = Math.round(c.b);
  const a = Math.round(c.a * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function oklabToSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}

function parseAlpha(tok) {
  if (!tok) return 1;
  tok = tok.trim();
  if (tok === "none") return 0;
  return tok.endsWith("%") ? parseFloat(tok) / 100 : parseFloat(tok);
}

// Convert modern color functions (oklch/oklab/display-p3) to sRGB, so even
// literal colors inside color-mix() can be resolved for legacy WebKit.
function parseColorFns(value) {
  if (!value) return null;

  let m = value.match(
    /^oklch\(\s*([^,/\s()]+)\s+([^,/\s()]+)\s+([^,/\s()]+)(?:\s*\/\s*([^)]+))?\s*\)$/
  );
  if (m) {
    const L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
    const C = parseFloat(m[2]);
    const H = parseFloat(m[3]);
    const rad = (H * Math.PI) / 180;
    const [r, g, b] = oklabToSrgb(L, C * Math.cos(rad), C * Math.sin(rad));
    return { r: r * 255, g: g * 255, b: b * 255, a: parseAlpha(m[4]) };
  }

  m = value.match(
    /^oklab\(\s*([^,/\s()]+)\s+([^,/\s()]+)\s+([^,/\s()]+)(?:\s*\/\s*([^)]+))?\s*\)$/
  );
  if (m) {
    const L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
    const a = m[2] === "none" ? 0 : parseFloat(m[2]);
    const b = m[3] === "none" ? 0 : parseFloat(m[3]);
    const [r, g, bb] = oklabToSrgb(L, a, b);
    return { r: r * 255, g: g * 255, b: bb * 255, a: parseAlpha(m[4]) };
  }

  m = value.match(
    /^color\(\s*display-p3\s+([^/\s()]+)\s+([^/\s()]+)\s+([^/\s()]+)(?:\s*\/\s*([^)]+))?\s*\)$/i
  );
  if (m) {
    const lin = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
    const rp = 1.2249400601 * lin[0] - 0.2249400601 * lin[1];
    const gp = -0.0419918989 * lin[0] + 1.0419918989 * lin[1];
    const bp =
      -0.0196063291 * lin[0] - 0.0785847931 * lin[1] + 1.0980107608 * lin[2];
    const gamma = (c) =>
      c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    const rgb = [
      gamma(clamp01(rp)),
      gamma(clamp01(gp)),
      gamma(clamp01(bp)),
    ];
    return {
      r: rgb[0] * 255,
      g: rgb[1] * 255,
      b: rgb[2] * 255,
      a: parseAlpha(m[4]),
    };
  }

  return null;
}

// Return a legacy-safe color string for any value (rgb/hex or modern functions).
function toLegacyColor(value) {
  if (!value) return null;
  if (isLegacySafeColor(value)) return value;
  const c = parseColorFns(value);
  return c ? rgbaString(c) : null;
}

// Collect custom property values used by the theme. The app forces the `dark`
// class on <html>, so dark scoped values take precedence over :root ones.
function buildVarMaps(css) {
  const scopes = {
    dark: {},
    darkMedia: {},
    root: {},
    light: {},
    lightMedia: {},
  };
  const scopeOrder = ["dark", "darkMedia", "root", "light", "lightMedia"];

  for (const group of topLevelGroups(css)) {
    const prelude = group.prelude;
    let scope = null;
    if (prelude.startsWith("@media")) {
      if (/prefers-color-scheme\s*:\s*dark/i.test(prelude)) {
        scope = "darkMedia";
      } else if (/prefers-color-scheme\s*:\s*light/i.test(prelude)) {
        scope = "lightMedia";
      }
    } else if (/^:root(?:,|$)/.test(prelude)) {
      scope = "root";
    } else if (/^\.dark(?:,|$)/.test(prelude)) {
      scope = "dark";
    } else if (/^\.light(?:,|$)/.test(prelude)) {
      scope = "light";
    }

    if (!scope) continue;

    const decls = varDecls(group.body);
    for (const d of decls) {
      if (isLegacySafeColor(d.value) || parseColorFns(d.value)) {
        scopes[scope][d.name] = d.value;
      }
    }
  }

  return { scopes, scopeOrder };
}

function resolveVar(name, maps, seen) {
  if (!maps || !maps.scopes) return null;
  for (const scope of maps.scopeOrder) {
    const val = maps.scopes[scope] && maps.scopes[scope][name];
    if (val) return resolveColor(val, maps, seen);
  }
  return null;
}

function resolveColor(value, maps, seen) {
  const cycle = seen || new Set();
  const varMatch = value.match(/^var\(\s*(--[\w-]+)(?:\s*,\s*([^)]*))?\s*\)$/);
  if (varMatch) {
    if (cycle.has(varMatch[1])) {
      return varMatch[2] ? resolveColor(varMatch[2].trim(), maps, cycle) : null;
    }
    cycle.add(varMatch[1]);
    const resolved = resolveVar(varMatch[1], maps, cycle);
    if (resolved) return resolved;
    return varMatch[2] ? resolveColor(varMatch[2].trim(), maps, cycle) : null;
  }
  return toLegacyColor(value);
}

const SUPPORTS_COND_RE =
  /@supports\s*\(((?:[^()]|\([^()]*\))*)\)/gi;

const RESOLVABLE_MIX_RE =
  /color-mix\(\s*in\s+[\w-]+\s*,\s*(var\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-z]+\([^)]*\))\s*(\d+(?:\.\d+)?%|var\(--tw-shadow-alpha\))\s*,\s*transparent\s*\)/gi;

// Replace color-mix() declarations whose colors resolve through the theme maps.
// @supports conditions (the color-mix() feature probes Tailwind emits) are masked
// so they are never rewritten; only actual declaration values get replaced.
function resolveColorMixes(css, maps) {
  const masks = [];
  const masked = css.replace(SUPPORTS_COND_RE, (whole) => {
    masks.push(whole);
    return `SUPPORTS_COND_${masks.length}_PLACEHOLDER`;
  });

  const resolved = masked.replace(RESOLVABLE_MIX_RE, (match, colorText, pct) => {
    const color = resolveColor(colorText.trim(), maps, null);
    if (!color) return match;
    const fraction = pct === "var(--tw-shadow-alpha)" ? 1 : parseFloat(pct) / 100;
    const out = mixWithTransparent(color, fraction);
    return out || match;
  });

  return resolved.replace(/SUPPORTS_COND_\d+_PLACEHOLDER/g, () => masks.shift());
}

const GUARD_COND_RE =
  /@supports\s*\(\s*color\s*:\s*color-mix\(\s*in\s+[\w-]+\s*,\s*var\((--[\w-]+)\)\s*(\d+(?:\.\d+)?%)\s*,\s*transparent\s*\)\s*\)\s*\{/;
const GUARD_RULE_RE =
  /([^{}]+)\{\s*([\w-]+)\s*:\s*color-mix\([\s\S]*?\)\s*\}/;

// Tailwind emits `sel{prop:var(--x)}@supports(color:color-mix(...var(--x) P%...)){sel{prop:color-mix(...)}}`.
// Old WebKit cannot enter the @supports block, so it keeps the FULL-opacity
// fallback. Rewrite that fallback to the resolved rgba() so opacity utilities
// actually become translucent on legacy browsers.
function upgradeVarFallbacks(css, maps) {
  const groups = topLevelGroups(css);
  const edits = [];

  groups.forEach((group, idx) => {
    const cond = group.prelude.match(GUARD_COND_RE);
    if (!cond || !/^@supports/.test(group.prelude)) return;

    const varName = cond[1];
    const pct = cond[2];

    const ruleMatch = group.body.match(GUARD_RULE_RE);
    if (!ruleMatch) return;

    const selector = ruleMatch[1].trim();
    const prop = ruleMatch[2].trim();
    const baseColor = resolveVar(varName, maps, null);
    if (!baseColor) return;

    const newValue = mixWithTransparent(baseColor, parseFloat(pct) / 100);
    if (!newValue) return;

    // Find the nearest previous rule with the same selector containing the plain fallback.
    for (let j = idx - 1; j >= 0; j--) {
      const prev = groups[j];
      if (prev.prelude === selector) {
        const declRe = new RegExp(`(${prop}\\s*:\\s*)var\\(${varName}\\);?`);
        const dm = prev.body.match(declRe);
        if (dm) {
          edits.push({
            index: prev.bodyStart + dm.index + dm[1].length,
            length: dm[0].length - dm[1].length,
            text: newValue,
          });
        }
        break;
      }
    }
  });

  // Apply edits from last to first to keep offsets valid.
  edits.sort((a, b) => b.index - a.index);
  let out = css;
  for (const e of edits) {
    out = out.slice(0, e.index) + e.text + out.slice(e.index + e.length);
  }
  return out;
}

// Count modern color functions in declaration VALUES (excluding @supports conditions).
function countModernColorFunctions(css) {
  const withoutConditions = css.replace(
    /@supports\s*\(((?:[^()]|\([^()]*\))*)\)/gi,
    ""
  );
  return {
    colorMix: (withoutConditions.match(/color-mix\s*\(/gi) || []).length,
    oklch: (withoutConditions.match(/\boklch\s*\(/gi) || []).length,
    oklab: (withoutConditions.match(/\boklab\s*\(/gi) || []).length,
    displayP3: (withoutConditions.match(/\bdisplay-p3/g) || []).length,
  };
}

// ─── Step 2: Build legacy CSS ───────────────────────────────────────────────
const cssFiles = readdirSync(assetsDir).filter((f) => f.endsWith(".css"));

if (cssFiles.length === 0) {
  console.error("No CSS files found in dist/assets/");
  process.exit(1);
}

console.log(`Found ${cssFiles.length} CSS file(s): ${cssFiles.join(", ")}`);

let combined = "";
for (const file of cssFiles) {
  combined += readFileSync(join(assetsDir, file), "utf8") + "\n";
}

console.log(`Combined CSS size: ${(combined.length / 1024).toFixed(1)} KB`);

// Strip @layer wrappers
console.log("Stripping @layer wrappers...");
let flatCss = stripLayers(combined);

const layerCount = (combined.match(/@layer\s+\w+/g) || []).length;
const layerCountAfter = (flatCss.match(/@layer\s+\w+/g) || []).length;
console.log(`Removed ${layerCount - layerCountAfter} @layer declarations`);

// Resolve var()-based color-mix() to concrete rgba() values for legacy WebKit
const beforeMixes = (flatCss.match(/color-mix\s*\(/g) || []).length;
const varMaps = buildVarMaps(flatCss);
flatCss = resolveColorMixes(flatCss, varMaps);
flatCss = upgradeVarFallbacks(flatCss, varMaps);
const afterMixes = (flatCss.match(/color-mix\s*\(/g) || []).length;
console.log(`color-mix(): ${beforeMixes} -> ${afterMixes} (after var resolution)`);

// Old WebKit only accepts gradient lines like "to bottom right". Tailwind v4
// appends " in oklab" (the interpolation space), which legacy parsers reject —
// the whole gradient then fails. Strip the interpolation hint so gradients keep
// working with the browser's default (srgb) interpolation.
flatCss = flatCss.replace(
  /--tw-gradient-position:\s*([^;]*) in\s+(?:oklab|oklch|srgb|hsl)\b/g,
  (m, pos) => `--tw-gradient-position:${pos.trim()}`
);

// LightningCSS targets: version = major << 16 | minor << 8 | patch
// Safari 13.0 = no oklch, no nesting
// Chrome 80 = no oklch, no nesting
// Firefox 78 = no oklch, no nesting
console.log("Running LightningCSS for color/nesting downleveling...");
const result = transform({
  code: Buffer.from(flatCss),
  filename: "app.legacy.css",
  minify: true,
  targets: {
    safari: (13 << 16) | (0 << 8),
    chrome: (80 << 16) | (0 << 8),
    firefox: (78 << 16) | (0 << 8),
  },
});

const outputPath = join(distDir, "app.legacy.css");
writeFileSync(outputPath, result.code);

const outputSize = result.code.length || Buffer.byteLength(result.code);
console.log(`Legacy CSS built: ${outputPath}`);
console.log(`Output size: ${(outputSize / 1024).toFixed(1)} KB`);

// ─── Step 3: Validate ───────────────────────────────────────────────────────
// color-mix() may remain only where the mixed color is unresolvable at build
// time (e.g. `currentcolor` or shadow alpha variables). Those are harmless and
// gated behind @supports guards. oklch()/oklab()/display-p3 leftovers only live
// in safe multi-declaration fallbacks (hex first) or guarded @supports blocks.
const legacyCode = Buffer.from(result.code).toString("utf8");
const leftover = countModernColorFunctions(legacyCode);

const colorMixThreshold = 45;

if (leftover.colorMix > colorMixThreshold) {
  console.warn(
    `⚠️  Legacy CSS contains suspicious number of color-mix(): ${leftover.colorMix} ` +
      `(threshold ${colorMixThreshold}). Some opacity utilities may not render ` +
      `correctly on Safari < 16.2.`
  );
} else if (leftover.colorMix > 0) {
  console.log(
    `ℹ️  Legacy CSS keeps ${leftover.colorMix} color-mix() (` +
      `unresolvable / gated by @supports)`
  );
}

console.log(
  `ℹ️  Remaining modern color functions: ` +
    `color-mix=${leftover.colorMix}, oklch=${leftover.oklch}, ` +
    `oklab=${leftover.oklab}, display-p3=${leftover.displayP3}`
);
console.log("Done!");