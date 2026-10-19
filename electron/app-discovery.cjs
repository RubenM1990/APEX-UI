const fs = require("node:fs/promises");
const path = require("node:path");

const EXPECTED_FILE_SYSTEM_ERRORS = new Set([
  "EACCES", "EBUSY", "EDQUOT", "EIO", "ELOOP", "EMFILE", "ENFILE", "ENODEV",
  "ENOMEDIUM", "ENOENT", "ENOTDIR", "ENXIO", "EPERM", "ESTALE",
]);

function normalizeAppName(name) {
  return name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function isLaunchableWindowsAppId(appId) {
  if (typeof appId !== "string" || !appId.trim() || /^[a-z][a-z\d+.-]*:/i.test(appId)) return false;
  return !/[\\/]/.test(appId) || /\.exe$/i.test(appId);
}

async function discoverAppShortcuts(roots, { maxApps = 300, maxDirectories = 2_000, maxDepth = 8 } = {}) {
  const shortcuts = [];
  const visitedPaths = new Set();
  const visitedNames = new Set();
  let visitedDirectories = 0;

  for (const root of roots) {
    const queue = [{ directory: root.path, depth: 0 }];
    while (queue.length > 0 && shortcuts.length < maxApps && visitedDirectories < maxDirectories) {
      const current = queue.shift();
      let entries;
      try {
        entries = await fs.readdir(current.directory, { withFileTypes: true });
      } catch (error) {
        if (EXPECTED_FILE_SYSTEM_ERRORS.has(error?.code)) continue;
        throw error;
      }
      visitedDirectories += 1;

      for (const entry of entries) {
        if (shortcuts.length >= maxApps || visitedDirectories >= maxDirectories) break;
        const entryPath = path.join(current.directory, entry.name);
        if (entry.isDirectory() && !entry.isSymbolicLink() && current.depth < maxDepth) {
          let stats;
          try {
            stats = await fs.lstat(entryPath);
          } catch (error) {
            if (EXPECTED_FILE_SYSTEM_ERRORS.has(error?.code)) continue;
            throw error;
          }
          if (stats.isDirectory() && !stats.isSymbolicLink()) {
            queue.push({ directory: entryPath, depth: current.depth + 1 });
          }
          continue;
        }
        if (!entry.isFile() || entry.isSymbolicLink() || path.extname(entry.name).toLowerCase() !== ".lnk") continue;

        let stats;
        try {
          stats = await fs.lstat(entryPath);
        } catch (error) {
          if (EXPECTED_FILE_SYSTEM_ERRORS.has(error?.code)) continue;
          throw error;
        }
        if (!stats.isFile() || stats.isSymbolicLink()) continue;

        const resolvedPath = path.resolve(entryPath);
        const name = path.basename(entry.name, path.extname(entry.name)).trim();
        const normalizedPath = resolvedPath.toLocaleLowerCase();
        const normalizedName = normalizeAppName(name);
        if (!name || visitedPaths.has(normalizedPath) || visitedNames.has(normalizedName)) continue;
        visitedPaths.add(normalizedPath);
        visitedNames.add(normalizedName);
        shortcuts.push({ name, path: resolvedPath, source: root.source });
      }
    }
  }

  return shortcuts;
}

module.exports = { discoverAppShortcuts, isLaunchableWindowsAppId, normalizeAppName };
