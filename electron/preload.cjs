const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("apexDesktop", {
  isDesktop: true,
  listFolderShortcuts: () => ipcRenderer.invoke("desktop:list-folder-shortcuts"),
  openFolderShortcut: (shortcutId) => ipcRenderer.invoke("desktop:open-folder-shortcut", shortcutId),
  selectFolder: () => ipcRenderer.invoke("desktop:select-folder"),
  listFolderFiles: (folderId) => ipcRenderer.invoke("desktop:list-folder-files", folderId),
  readFolderFile: (folderId, fileName) => ipcRenderer.invoke("desktop:read-folder-file", folderId, fileName),
  searchPcFiles: (query) => ipcRenderer.invoke("desktop:search-pc-files", query),
  cancelPcSearch: (searchId) => ipcRenderer.invoke("desktop:cancel-pc-search", searchId),
  onPcSearchUpdate: (callback) => {
    const listener = (_event, update) => callback(update);
    ipcRenderer.on("desktop:pc-search-update", listener);
    return () => ipcRenderer.removeListener("desktop:pc-search-update", listener);
  },
  readSearchedFile: (fileId) => ipcRenderer.invoke("desktop:read-searched-file", fileId),
  saveFile: (fileId, content) => ipcRenderer.invoke("desktop:save-file", fileId, content),
  listInstalledApps: () => ipcRenderer.invoke("desktop:list-installed-apps"),
  selectApp: () => ipcRenderer.invoke("desktop:select-app"),
  launchApp: (appId) => ipcRenderer.invoke("desktop:launch-app", appId),
  saveApiKey: (key) => ipcRenderer.invoke("desktop:save-api-key", key),
  saveElevenLabsSettings: (apiKey, voiceId) => ipcRenderer.invoke("desktop:save-elevenlabs-settings", apiKey, voiceId),
  getElevenLabsStatus: () => ipcRenderer.invoke("desktop:elevenlabs-status"),
  transcribeAudio: (audio, mimeType) => ipcRenderer.invoke("desktop:transcribe-audio", audio, mimeType),
  chat: (messages) => ipcRenderer.invoke("desktop:chat", messages),
  speak: (text) => ipcRenderer.invoke("desktop:speak", text),
});
