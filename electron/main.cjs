const { app, BrowserWindow, ipcMain, screen, shell, session } = require("electron");
const { execFile, spawn } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

const isDev = !app.isPackaged && process.env.JARVIS_PROD !== "1";
const isLiteMode = process.env.JARVIS_LITE === "1";
const hudWindows = new Set();
let voiceProcess = null;

const allowedApps = {
  steam: { label: "Steam", placement: "secondary", commands: [{ type: "protocol", target: "steam://open/main" }, { type: "path", target: "C:\\Program Files (x86)\\Steam\\steam.exe" }] },
  discord: { label: "Discord", placement: "secondary", commands: [{ type: "protocol", target: "discord://" }, { type: "powershell", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Start-Process Discord"] }] },
  spotify: { label: "Spotify", placement: "secondary", commands: [{ type: "protocol", target: "spotify:" }, { type: "powershell", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Start-Process Spotify"] }] },
  browser: { label: "Browser", placement: "primary", commands: [{ type: "protocol", target: "https://www.google.com" }] },
  opera: { label: "Opera", placement: "primary", commands: [{ type: "powershell", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Start-Process \"$env:LOCALAPPDATA\\Programs\\Opera\\opera.exe\""] }] },
  league: { label: "League of Legends", placement: "primary", commands: [{ type: "path", target: "C:\\Riot Games\\League of Legends\\LeagueClient.exe" }, { type: "powershell", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Start-Process \"LeagueClient\""] }] },
  aion2: { label: "Aion 2", placement: "primary", commands: [{ type: "powershell", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Start-Process \"Aion2\""] }] },
  vscode: { label: "Visual Studio Code", placement: "primary", commands: [{ type: "powershell", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Start-Process code"] }, { type: "path", target: "C:\\Users\\renew\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe" }] },
  chatgpt: { label: "ChatGPT / Codex", placement: "primary", commands: [{ type: "protocol", target: "chatgpt://" }, { type: "protocol", target: "https://chatgpt.com/codex" }, { type: "protocol", target: "https://chatgpt.com" }] }
};

function createHudWindow(display, displayIndex, primaryDisplayId) {
  const { x, y, width, height } = display.bounds;
  const role = display.id === primaryDisplayId ? "primary" : "aux";
  const win = new BrowserWindow({
    x, y, width, height,
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#02070a",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  const query = `?display=${displayIndex}&role=${role}&lite=${isLiteMode ? "1" : "0"}`;
  const url = isDev ? `http://127.0.0.1:5173/${query}` : `file://${path.join(__dirname, "../dist/index.html")}${query}`;
  win.loadURL(url);
  hudWindows.add(win);
  win.on("closed", () => hudWindows.delete(win));
  return win;
}

function broadcast(channel, payload) {
  for (const win of hudWindows) if (!win.isDestroyed()) win.webContents.send(channel, payload);
}

function appIdFromVoiceText(text) {
  const normalized = String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("steam")) return "steam";
  if (normalized.includes("discord")) return "discord";
  if (normalized.includes("spotify")) return "spotify";
  if (normalized.includes("opera")) return "opera";
  if (normalized.includes("league") || normalized.includes("legends")) return "league";
  if (normalized.includes("aion")) return "aion2";
  if (normalized.includes("code") || normalized.includes("visual studio")) return "vscode";
  if (normalized.includes("chatgpt") || normalized.includes("chat gpt") || normalized.includes("codex")) return "chatgpt";
  if (normalized.includes("browser") || normalized.includes("google")) return "browser";
  return null;
}

async function launchAllowedApp(appId) {
  const item = allowedApps[appId];
  if (!item) throw new Error(`App not allowed: ${appId}`);
  let lastError = null;
  for (const command of item.commands) {
    try {
      if (command.type === "protocol") { await shell.openExternal(command.target); return { ok: true, label: item.label }; }
      if (command.type === "path") { await new Promise((resolve, reject) => execFile(command.target, [], (error) => error ? reject(error) : resolve())); return { ok: true, label: item.label }; }
      if (command.type === "powershell") { await new Promise((resolve, reject) => execFile("powershell.exe", command.args, { windowsHide: true }, (error) => error ? reject(error) : resolve())); return { ok: true, label: item.label }; }
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error(`Could not launch ${item.label}`);
}

function getNetworkSummary() {
  const active = Object.entries(os.networkInterfaces()).flatMap(([name, addresses]) => (addresses || []).map((address) => ({ name, ...address }))).filter((address) => !address.internal && address.family === "IPv4");
  return active[0] ? { name: active[0].name, address: active[0].address, online: true } : { name: "Offline", address: "0.0.0.0", online: false };
}

function getCpuLoad() {
  const cpus = os.cpus();
  if (!cpus.length) return 0;
  const totals = cpus.map((cpu) => { const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0); return total > 0 ? 1 - cpu.times.idle / total : 0; });
  return Math.round((totals.reduce((sum, value) => sum + value, 0) / totals.length) * 100);
}

function getDriveSummary() {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object DeviceID,FreeSpace,Size | ConvertTo-Json -Compress"], { windowsHide: true }, (error, stdout) => {
      if (error || !stdout.trim()) return resolve([]);
      try { const parsed = JSON.parse(stdout); const drives = Array.isArray(parsed) ? parsed : [parsed]; resolve(drives.map((drive) => ({ id: drive.DeviceID, free: Number(drive.FreeSpace || 0), size: Number(drive.Size || 0) }))); } catch { resolve([]); }
    });
  });
}

function getThermalSummary() {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -First 1 CurrentTemperature | ConvertTo-Json -Compress"], { windowsHide: true }, (error, stdout) => {
      if (error || !stdout.trim()) return resolve(null);
      try { const raw = Number(JSON.parse(stdout).CurrentTemperature || 0); const celsius = raw ? Math.round(raw / 10 - 273.15) : null; resolve(Number.isFinite(celsius) && celsius > -50 && celsius < 150 ? celsius : null); } catch { resolve(null); }
    });
  });
}

async function getSystemMetrics() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const drives = await getDriveSummary();
  const temperature = await getThermalSummary();
  return { cpu: { model: os.cpus()[0]?.model || "CPU", load: getCpuLoad(), cores: os.cpus().length }, memory: { total: totalMemory, used: totalMemory - freeMemory, percent: totalMemory ? Math.round(((totalMemory - freeMemory) / totalMemory) * 100) : 0 }, drives, network: getNetworkSummary(), uptime: os.uptime(), sensors: { temperature, note: temperature === null ? "Hardware temperature sensor adapter pending" : "ACPI thermal zone" } };
}

function getMediaSummary() {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-Process Spotify -ErrorAction SilentlyContinue | Select-Object -First 1 ProcessName,MainWindowTitle | ConvertTo-Json -Compress"], { windowsHide: true }, (error, stdout) => {
      if (error || !stdout.trim()) return resolve({ active: false, app: "Spotify", title: "No active session" });
      try { const parsed = JSON.parse(stdout); resolve({ active: true, app: "Spotify", title: parsed.MainWindowTitle && parsed.MainWindowTitle !== "Spotify Premium" ? parsed.MainWindowTitle : "Spotify active" }); } catch { resolve({ active: true, app: "Spotify", title: "Spotify active" }); }
    });
  });
}

function getDiscordSummary() {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-Process Discord -ErrorAction SilentlyContinue | Select-Object -First 1 ProcessName,MainWindowTitle | ConvertTo-Json -Compress"], { windowsHide: true }, (error, stdout) => {
      if (error || !stdout.trim()) return resolve({ active: false, app: "Discord", title: "Discord offline", event: "No voice session detected" });
      try { const parsed = JSON.parse(stdout); resolve({ active: true, app: "Discord", title: parsed.MainWindowTitle || "Discord active", event: "Voice overlay bridge pending" }); } catch { resolve({ active: true, app: "Discord", title: "Discord active", event: "Voice overlay bridge pending" }); }
    });
  });
}

function sendMediaKey(keyCode) {
  return new Promise((resolve, reject) => {
    const script = `Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);'; [Win32.NativeMethods]::keybd_event(${keyCode}, 0, 0, 0); [Win32.NativeMethods]::keybd_event(${keyCode}, 0, 2, 0);`;
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true }, (error) => error ? reject(error) : resolve({ ok: true }));
  });
}

function startVoiceListener() {
  if (voiceProcess) return { ok: true, running: true };
  voiceProcess = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "..", "scripts", "voice-listener.ps1")], { windowsHide: true });
  voiceProcess.stdout.on("data", (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
      try { const event = JSON.parse(line); if (event.type === "recognized") { const appId = appIdFromVoiceText(event.text); if (appId) launchAllowedApp(appId).catch((error) => broadcast("jarvis:voice-event", { type: "error", message: error.message })); } broadcast("jarvis:voice-event", event); }
      catch { broadcast("jarvis:voice-event", { type: "log", message: line }); }
    }
  });
  voiceProcess.stderr.on("data", (chunk) => broadcast("jarvis:voice-event", { type: "error", message: chunk.toString().trim() }));
  voiceProcess.on("exit", (code) => { broadcast("jarvis:voice-event", { type: "stopped", code }); voiceProcess = null; });
  return { ok: true, running: true };
}

function stopVoiceListener() { if (voiceProcess) { voiceProcess.kill(); voiceProcess = null; } return { ok: true, running: false }; }

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === "media"));
  const primaryDisplay = screen.getPrimaryDisplay();
  const displays = screen.getAllDisplays().sort((a, b) => { if (a.id === primaryDisplay.id) return -1; if (b.id === primaryDisplay.id) return 1; return a.bounds.x - b.bounds.x; });
  displays.forEach((display, index) => createHudWindow(display, index, primaryDisplay.id));
  ipcMain.handle("jarvis:launch-app", async (_event, appId) => launchAllowedApp(appId));
  ipcMain.handle("jarvis:get-apps", async () => Object.entries(allowedApps).map(([id, value]) => ({ id, label: value.label, placement: value.placement })));
  ipcMain.handle("jarvis:get-system-metrics", async () => getSystemMetrics());
  ipcMain.handle("jarvis:get-media-summary", async () => getMediaSummary());
  ipcMain.handle("jarvis:get-discord-summary", async () => getDiscordSummary());
  ipcMain.handle("jarvis:media-control", async (_event, action) => sendMediaKey({ previous: 0xb1, playPause: 0xb3, next: 0xb0 }[action]));
  ipcMain.handle("jarvis:start-voice", async () => startVoiceListener());
  ipcMain.handle("jarvis:stop-voice", async () => stopVoiceListener());
  ipcMain.handle("jarvis:set-autostart", async (_event, enabled) => { app.setLoginItemSettings({ openAtLogin: Boolean(enabled), path: process.execPath }); return app.getLoginItemSettings(); });
  ipcMain.handle("jarvis:get-autostart", async () => app.getLoginItemSettings());
});

app.on("window-all-closed", () => app.quit());
