const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jarvis", {
  launchApp: (appId) => ipcRenderer.invoke("jarvis:launch-app", appId),
  getApps: () => ipcRenderer.invoke("jarvis:get-apps"),
  getSystemMetrics: () => ipcRenderer.invoke("jarvis:get-system-metrics"),
  getMediaSummary: () => ipcRenderer.invoke("jarvis:get-media-summary"),
  getDiscordSummary: () => ipcRenderer.invoke("jarvis:get-discord-summary"),
  mediaControl: (action) => ipcRenderer.invoke("jarvis:media-control", action),
  startVoice: () => ipcRenderer.invoke("jarvis:start-voice"),
  stopVoice: () => ipcRenderer.invoke("jarvis:stop-voice"),
  onVoiceEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("jarvis:voice-event", listener);
    return () => ipcRenderer.removeListener("jarvis:voice-event", listener);
  },
  setAutostart: (enabled) => ipcRenderer.invoke("jarvis:set-autostart", enabled),
  getAutostart: () => ipcRenderer.invoke("jarvis:get-autostart")
});
