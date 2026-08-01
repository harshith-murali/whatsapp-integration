const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "dist", "generated", "prisma");

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
};

const needsExtension = (specifier) =>
  specifier.startsWith(".") &&
  !specifier.endsWith(".js") &&
  !specifier.endsWith(".json") &&
  !specifier.endsWith(".node");

for (const file of walk(root)) {
  if (!file.endsWith(".js")) continue;
  const dir = path.dirname(file);
  const original = fs.readFileSync(file, "utf8");
  const updated = original.replace(
    /(from\s+["'])(\.[^"']+)(["'])/g,
    (match, prefix, specifier, suffix) => {
      if (!needsExtension(specifier)) return match;
      const candidate = path.resolve(dir, `${specifier}.js`);
      return fs.existsSync(candidate) ? `${prefix}${specifier}.js${suffix}` : match;
    }
  );

  if (updated !== original) {
    fs.writeFileSync(file, updated);
  }
}
