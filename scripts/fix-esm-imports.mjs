import { promises as fs } from "node:fs";
import path from "node:path";

const targetDirArg = process.argv[2];

if (!targetDirArg) {
  console.error("Usage: node fix-esm-imports.mjs <dist-directory>");
  process.exit(1);
}

const projectDir = process.cwd();
const targetDir = path.resolve(projectDir, targetDirArg);
const handledExtensions = new Set([".js", ".mjs", ".cjs", ".json"]);

const appendJsExtension = (specifier) => {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return specifier;
  }

  if (handledExtensions.has(path.extname(specifier))) {
    return specifier;
  }

  return `${specifier}.js`;
};

const rewriteImports = (source) =>
  source
    .replace(/(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g, (_match, prefix, specifier, suffix) => {
      return `${prefix}${appendJsExtension(specifier)}${suffix}`;
    })
    .replace(/(import\s+["'])(\.{1,2}\/[^"']+)(["'])/g, (_match, prefix, specifier, suffix) => {
      return `${prefix}${appendJsExtension(specifier)}${suffix}`;
    });

const visit = async (entryPath) => {
  const stat = await fs.stat(entryPath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(entryPath);
    await Promise.all(entries.map((entry) => visit(path.join(entryPath, entry))));
    return;
  }

  if (!entryPath.endsWith(".js")) {
    return;
  }

  const original = await fs.readFile(entryPath, "utf8");
  const rewritten = rewriteImports(original);
  if (rewritten !== original) {
    await fs.writeFile(entryPath, rewritten, "utf8");
  }
};

await visit(targetDir);