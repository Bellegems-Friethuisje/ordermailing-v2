import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const distDir = path.resolve("node_modules", "@photonjs", "vercel", "dist");
const fileName = readdirSync(distDir).find((entry) => /^original-request-.*\.js$/.test(entry));

if (!fileName) {
  console.warn("[patch-photon-vercel] No original-request bundle found, skipping patch.");
  process.exit(0);
}

const filePath = path.join(distDir, fileName);
const source = readFileSync(filePath, "utf8");

if (source.includes('duplex: "half"')) {
  console.log("[patch-photon-vercel] Adapter already patched.");
  process.exit(0);
}

const target = "\t\tintegrity: request.integrity\n\t});";
if (!source.includes(target)) {
  console.warn("[patch-photon-vercel] Expected Request init block not found, skipping patch.");
  process.exit(0);
}

const patched = source.replace(target, '\t\tintegrity: request.integrity,\n\t\tduplex: "half"\n\t});');

writeFileSync(filePath, patched, "utf8");
console.log(`[patch-photon-vercel] Patched ${fileName}`);