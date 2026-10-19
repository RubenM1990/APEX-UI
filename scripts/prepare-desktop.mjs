import { cp, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");

await mkdir(path.join(standalone, ".next"), { recursive: true });
await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true, force: true });
await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true, force: true }).catch((error) => {
  if (error.code !== "ENOENT") throw error;
});
const nodeModules = path.join(standalone, "node_modules");
const serverDependencies = path.join(standalone, "server-dependencies");
try {
  await rename(nodeModules, serverDependencies);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  try {
    await cp(serverDependencies, nodeModules, { recursive: true, force: true });
  } catch (copyError) {
    if (copyError.code !== "ENOENT") throw copyError;
    throw new Error("Next.js standalone node_modules directory is missing; rebuild the app before packaging.");
  }
}
const runtimeDirectory = path.join(standalone, "runtime");
await mkdir(runtimeDirectory, { recursive: true });
await cp(process.execPath, path.join(runtimeDirectory, "node.exe"));
console.log("Prepared the standalone Next.js server dependencies and Node runtime for the Apex desktop package.");
