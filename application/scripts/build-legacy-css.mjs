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
console.log("Done!");
