const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  discoverAppShortcuts,
  isLaunchableWindowsAppId,
  normalizeAppName,
} = require("../electron/app-discovery.cjs");

test("discovers pinned shortcuts before Start menu shortcuts and ignores duplicate names", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "apex-apps-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const pinned = path.join(root, "taskbar");
  const startMenu = path.join(root, "start");
  await fs.mkdir(path.join(startMenu, "Utilities"), { recursive: true });
  await fs.mkdir(pinned);
  await fs.writeFile(path.join(pinned, "Browser.lnk"), "shortcut");
  await fs.writeFile(path.join(startMenu, "Browser.lnk"), "duplicate");
  await fs.writeFile(path.join(startMenu, "Utilities", "Editor.lnk"), "shortcut");
  await fs.writeFile(path.join(startMenu, "Notes.txt"), "not an app shortcut");

  const result = await discoverAppShortcuts([
    { path: pinned, source: "Taskbar" },
    { path: startMenu, source: "Start menu" },
  ]);

  assert.deepEqual(result.map(({ name, source }) => ({ name, source })), [
    { name: "Browser", source: "Taskbar" },
    { name: "Editor", source: "Start menu" },
  ]);
  assert.equal(result[0].path, path.join(pinned, "Browser.lnk"));
});

test("limits the number of discovered shortcuts", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "apex-apps-limit-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await Promise.all(["One.lnk", "Two.lnk", "Three.lnk"].map((name) => fs.writeFile(path.join(root, name), "")));

  const result = await discoverAppShortcuts([{ path: root, source: "Start menu" }], { maxApps: 2 });
  assert.equal(result.length, 2);
});

test("normalizes punctuation and casing in app names for voice matching", () => {
  assert.equal(normalizeAppName("Outlook (classic)"), normalizeAppName("Outlook Classic"));
});

test("filters registered app entries that are documents or web links", () => {
  assert.equal(isLaunchableWindowsAppId("Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"), true);
  assert.equal(isLaunchableWindowsAppId("{GUID}\\Program Files\\Editor.exe"), true);
  assert.equal(isLaunchableWindowsAppId("https://example.test"), false);
  assert.equal(isLaunchableWindowsAppId("C:\\Users\\me\\Documents\\guide.pdf"), false);
});
