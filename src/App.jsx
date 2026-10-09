import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, Bell, CloudSun, Cpu, Maximize2, Mic, Music, Pause, Play, Power, Rocket, Settings, Shield, SkipBack, SkipForward } from "lucide-react";
import "./styles.css";

const commandMap = [
  { appId: "steam", label: "Steam", matches: ["starte steam", "oeffne steam", "offne steam", "open steam", "start steam"] },
  { appId: "discord", label: "Discord", matches: ["starte discord", "oeffne discord", "offne discord", "open discord", "start discord"] },
  { appId: "spotify", label: "Spotify", matches: ["starte spotify", "oeffne spotify", "offne spotify", "open spotify", "start spotify"] },
  { appId: "browser", label: "Browser", matches: ["starte browser", "oeffne browser", "offne browser", "open browser", "starte google"] },
  { appId: "opera", label: "Opera", matches: ["starte opera", "oeffne opera", "offne opera", "open opera", "start opera"] },
  { appId: "league", label: "League of Legends", matches: ["starte league", "oeffne league", "starte league of legends", "oeffne league of legends"] },
  { appId: "aion2", label: "Aion 2", matches: ["starte aion", "oeffne aion", "starte aion zwei", "oeffne aion zwei"] },
  { appId: "vscode", label: "Visual Studio Code", matches: ["starte visual studio code", "oeffne visual studio code", "starte code", "oeffne code"] },
  { appId: "chatgpt", label: "ChatGPT / Codex", matches: ["starte chat gpt", "oeffne chat gpt", "starte chatgpt", "oeffne chatgpt", "starte codex", "oeffne codex"] }
];

function normalizeSpeech(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function useQueryValue(key, fallback) {
  return useMemo(() => new URLSearchParams(window.location.search).get(key) || fallback, [key, fallback]);
}

function App() {
  const displayRole = useQueryValue("role", "aux");
  const liteMode = useQueryValue("lite", "0") === "1";
  const displayIndex = Number(useQueryValue("display", "0")) + 1;
  const isSecondaryDisplay = displayRole !== "primary";
  const [apps, setApps] = useState([]);
  const [autostart, setAutostart] = useState(false);
  const [voiceOnline, setVoiceOnline] = useState(false);
  const [armed, setArmed] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [metrics, setMetrics] = useState(null);
  const [weather, setWeather] = useState(null);
  const [media, setMedia] = useState(null);
  const [discord, setDiscord] = useState(null);
  const [log, setLog] = useState(["Arc core online.", "Auxiliary launch channels linked.", "Voice channel standing by."]);

  useEffect(() => {
    window.jarvis?.getApps().then(setApps).catch(() => setApps([]));
    window.jarvis?.getAutostart().then((settings) => setAutostart(Boolean(settings.openAtLogin)));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (displayRole !== "primary") return;
    const timer = window.setTimeout(() => speak(`${getTimeGreeting()}. Jarvis Systeme sind online.`), 1200);
    return () => window.clearTimeout(timer);
  }, [displayRole]);

  useEffect(() => {
    const dispose = window.jarvis?.onVoiceEvent?.((event) => {
      if (event.type === "ready") { setVoiceOnline(true); pushLog("Local voice command engine online."); }
      if (event.type === "recognized") { setVoiceOnline(true); setArmed(true); if (displayRole === "primary") speak("Verstanden. Wird gestartet."); }
      if (event.type === "error") { setVoiceOnline(false); pushLog(`Voice engine error: ${event.message}`); }
      if (event.type === "stopped") { setVoiceOnline(false); pushLog("Voice command engine stopped."); }
    });
    window.jarvis?.startVoice?.().catch((error) => pushLog(`Voice engine failed: ${error.message}`));
    return () => dispose?.();
  }, [displayRole]);

  useEffect(() => {
    let mounted = true;
    async function refresh() { try { const next = await window.jarvis?.getSystemMetrics(); if (mounted) setMetrics(next); } catch { if (mounted) setMetrics(null); } }
    refresh();
    const timer = setInterval(refresh, liteMode ? 15000 : 7000);
    return () => { mounted = false; clearInterval(timer); };
  }, [liteMode]);

  useEffect(() => {
    let mounted = true;
    async function refreshWeather() {
      try {
        const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=51.5136&longitude=7.4653&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Europe%2FBerlin&forecast_days=4");
        const next = await response.json();
        if (mounted) setWeather(next);
      } catch { if (mounted) setWeather(null); }
    }
    refreshWeather();
    const timer = setInterval(refreshWeather, liteMode ? 2700000 : 1200000);
    return () => { mounted = false; clearInterval(timer); };
  }, [liteMode]);

  useEffect(() => {
    let mounted = true;
    async function refreshMedia() { try { const next = await window.jarvis?.getMediaSummary(); if (mounted) setMedia(next); } catch { if (mounted) setMedia({ active: false, app: "Spotify", title: "No active session" }); } }
    refreshMedia();
    const timer = setInterval(refreshMedia, liteMode ? 12000 : 6000);
    return () => { mounted = false; clearInterval(timer); };
  }, [liteMode]);

  useEffect(() => {
    let mounted = true;
    async function refreshDiscord() { try { const next = await window.jarvis?.getDiscordSummary(); if (mounted) setDiscord(next); } catch { if (mounted) setDiscord({ active: false, title: "Discord offline", event: "No voice session detected" }); } }
    refreshDiscord();
    const timer = setInterval(refreshDiscord, liteMode ? 20000 : 9000);
    return () => { mounted = false; clearInterval(timer); };
  }, [liteMode]);

  function pushLog(message) { setLog((items) => [message, ...items].slice(0, 9)); }

  function speak(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.voice = pickJarvisVoice();
    utterance.rate = 0.82;
    utterance.pitch = 0.68;
    utterance.volume = 0.28;
    window.speechSynthesis.speak(utterance);
  }

  function pickJarvisVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const german = voices.filter((voice) => voice.lang?.toLowerCase().startsWith("de"));
    return german.find((voice) => /katja|conrad|hedda|german/i.test(voice.name)) || german[0] || voices.find((voice) => /natural|online|neural/i.test(voice.name)) || null;
  }

  function getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return "Guten Morgen";
    if (hour >= 12 && hour < 18) return "Guten Tag";
    return "Guten Abend";
  }

  async function runLaunch(appId, label) {
    pushLog(`Executing launch sequence: ${label}.`);
    try { const result = await window.jarvis.launchApp(appId); pushLog(`${result.label} launch signal sent.`); }
    catch (error) { pushLog(`Launch failed: ${error.message}`); }
  }

  async function toggleAutostart() {
    const settings = await window.jarvis.setAutostart(!autostart);
    setAutostart(Boolean(settings.openAtLogin));
  }

  const visibleApps = apps.filter((app) => isSecondaryDisplay ? app.placement === "secondary" : app.placement === "primary");

  return (
    <main className={`shell ${isSecondaryDisplay ? "secondary-display" : "primary-display"} ${liteMode ? "lite-mode" : ""}`}>
      <div className="scanlines" />
      <section className="topbar">
        <div className="brand"><Power size={18} /><span>{isSecondaryDisplay ? "JARVIS AUX" : "JARVIS PRIME"}</span></div>
        <div className="status"><span className={`pulse ${voiceOnline ? "online" : "attention"}`} /><span>{voiceOnline ? "VOICE ONLINE" : "BOOTING"}</span><span>DISPLAY {displayIndex}</span></div>
      </section>

      <section className="hud-grid">
        <aside className="panel left-panel glass-panel">
          <div className="panel-title"><Cpu size={17} /><span>{isSecondaryDisplay ? "System Monitor" : "Core Matrix"}</span></div>
          {isSecondaryDisplay ? <AuxSystemPanel metrics={metrics} /> : <PrimeReadouts weather={weather} metrics={metrics} />}
        </aside>

        <section className="core-stage" aria-label="Jarvis core">
          <TimeBeacon clock={clock} />
          <ArmorFrame />
          <div className={`core ${armed ? "armed" : ""}`}>
            <div className="ring ring-a" /><div className="ring ring-b" /><div className="ring ring-c" /><div className="ring ring-d" />
            <div className="core-inner"><div className="energy-core" /></div>
          </div>
        </section>

        <aside className="panel right-panel glass-panel">
          <DisplayPanel isSecondaryDisplay={isSecondaryDisplay} visibleApps={visibleApps} runLaunch={runLaunch} autostart={autostart} toggleAutostart={toggleAutostart} media={media} discord={discord} />
        </aside>
      </section>
    </main>
  );
}

function TimeBeacon({ clock }) {
  return <div className="time-beacon"><strong>{new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(clock)}</strong><span>{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long" }).format(clock)}</span></div>;
}

function ArmorFrame() {
  return <div className="armor-frame" aria-hidden="true"><div className="armor-head"><span className="visor left" /><span className="visor right" /></div><div className="armor-neck" /><div className="armor-torso"><span className="shoulder left" /><span className="shoulder right" /><span className="chest-line left" /><span className="chest-line right" /></div></div>;
}

function PrimeReadouts({ weather, metrics }) {
  const current = weather?.current;
  const daily = weather?.daily;
  return <div className="prime-readouts"><div className="weather-hero"><CloudSun size={38} /><div><span>DORTMUND WEATHER</span><strong>{current ? `${Math.round(current.temperature_2m)} C` : "-- C"}</strong><small>{current ? `${weatherLabel(current.weather_code)} · ${Math.round(current.wind_speed_10m)} km/h` : "awaiting signal"}</small></div></div><div className="forecast-row">{(daily?.time || Array.from({ length: 4 })).slice(0, 4).map((day, index) => <div key={day || index}><span>{day ? shortDay(day) : "--"}</span><strong>{daily ? `H ${Math.round(daily.temperature_2m_max[index])} C · L ${Math.round(daily.temperature_2m_min[index])} C` : "H -- · L --"}</strong></div>)}</div><div className="bars-panel"><HudBar label="CPU" value={metrics?.cpu?.load ?? 0} /><HudBar label="RAM" value={metrics?.memory?.percent ?? 0} /></div><div className="network-tile"><span>NETWORK</span><strong>{metrics?.network?.online ? "ONLINE" : "STANDBY"}</strong><small>{metrics?.network?.address || "waiting for adapter"}</small></div></div>;
}

function AuxSystemPanel({ metrics }) {
  const uptimeHours = metrics?.uptime ? Math.floor(metrics.uptime / 3600) : 0;
  const uptimeMinutes = metrics?.uptime ? Math.floor((metrics.uptime % 3600) / 60) : 0;
  const drive = metrics?.drives?.[1] || metrics?.drives?.[0];
  const driveUsed = drive?.size ? Math.round(((drive.size - drive.free) / drive.size) * 100) : 0;
  return <div className="aux-system-panel"><div className="thermal-card"><span>THERMAL</span><strong>{metrics?.sensors?.temperature ?? "--"} C</strong><small>{metrics?.sensors?.temperature === null ? "sensor bridge pending" : "Windows ACPI"}</small></div><div className="aux-stat-grid"><div><span>CORES</span><strong>{metrics?.cpu?.cores ?? "--"}</strong></div><div><span>UPTIME</span><strong>{uptimeHours}h {uptimeMinutes}m</strong></div><div><span>{drive?.id || "DISK"}</span><strong>{drive?.size ? `${driveUsed}%` : "--"}</strong></div><div><span>NET</span><strong>{metrics?.network?.online ? "ONLINE" : "OFFLINE"}</strong></div></div><div className="network-line"><span>{metrics?.network?.name || "network"}</span><strong>{metrics?.network?.address || "0.0.0.0"}</strong></div></div>;
}

function HudBar({ label, value }) { return <div className="hud-bar" style={{ "--value": value }}><div><span>{label}</span><strong>{value}%</strong></div><i /></div>; }

function DisplayPanel({ isSecondaryDisplay, visibleApps, runLaunch, autostart, toggleAutostart, media, discord }) {
  if (!isSecondaryDisplay) return <><div className="panel-title"><Rocket size={17} /><span>Prime Actions</span></div><div className="launch-list">{visibleApps.map((app) => <button key={app.id} onClick={() => runLaunch(app.id, app.label)}><span>{app.label}</span><Maximize2 size={16} /></button>)}</div><button className="autostart" onClick={toggleAutostart}><Settings size={16} /><span>{autostart ? "Disable autostart" : "Enable autostart"}</span></button></>;
  return <><div className="panel-title"><Rocket size={17} /><span>Aux Launch Bay</span></div><div className="launch-list">{visibleApps.map((app) => <button key={app.id} onClick={() => runLaunch(app.id, app.label)}><span>{app.label}</span><Maximize2 size={16} /></button>)}</div><DiscordDock discord={discord} /><MediaDock media={media} /></>;
}

function DiscordDock({ discord }) { return <div className={`discord-dock ${discord?.active ? "active" : ""}`}><div className="media-title"><Bell size={16} /><span>Discord Voice</span></div><strong>{discord?.active ? discord.title || "Discord active" : "No channel activity"}</strong><div className="discord-event"><Activity size={15} /><span>{discord?.event || "Join overlay bridge pending"}</span></div></div>; }

function MediaDock({ media }) {
  async function control(action) { await window.jarvis?.mediaControl(action); }
  return <div className="media-dock"><div className="media-title"><Music size={16} /><span>{media?.app || "Spotify"}</span></div><strong>{media?.title || "No active session"}</strong><div className="media-controls"><button onClick={() => control("previous")}><SkipBack size={16} /></button><button onClick={() => control("playPause")}>{media?.active ? <Pause size={16} /> : <Play size={16} />}</button><button onClick={() => control("next")}><SkipForward size={16} /></button></div></div>;
}

function shortDay(value) { return new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(new Date(value)); }
function weatherLabel(code) { if ([0, 1].includes(code)) return "clear"; if ([2, 3].includes(code)) return "clouds"; if ([45, 48].includes(code)) return "fog"; if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "rain"; if ([71, 73, 75, 85, 86].includes(code)) return "snow"; if ([95, 96, 99].includes(code)) return "storm"; return "mixed"; }

createRoot(document.getElementById("root")).render(<App />);
