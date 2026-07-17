import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, "src");
const output = join(root, "dist");
const assets = join(output, "assets");
const slotTextSource = join(root, "node_modules", "slot-text", "dist");
const slotTextOutput = join(assets, "slot-text");

await rm(output, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
await mkdir(slotTextOutput, { recursive: true });

await Promise.all([
  copyFile(join(source, "index.html"), join(output, "index.html")),
  copyFile(join(source, "styles.css"), join(assets, "styles.css")),
  copyFile(join(source, "app.js"), join(assets, "app.js")),
  copyFile(
    join(root, "node_modules", "slot-text", "style.css"),
    join(assets, "slot-text.css"),
  ),
  ...["constants.js", "dom.js", "index.js", "slotText.js", "text.js", "timing.js"].map(
    (file) => copyFile(join(slotTextSource, file), join(slotTextOutput, file)),
  ),
]);

console.log(`ResearchFlow chat construido en ${output}`);
