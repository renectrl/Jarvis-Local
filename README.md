# Jarvis Local

Ein lokaler Jarvis-Prototyp fuer Windows: Electron-HUD, Multi-Monitor-Start, Voice-Befehle und App-Launches.

## Features

- Fullscreen-HUD fuer mehrere Monitore
- Voice-Befehle mit `Hey Garmin`
- Prime-Actions fuer Spiele und Tools
- AUX-Screen mit Systemmonitor, Discord und Spotify
- Wetter fuer Dortmund
- Lite-Modus fuer geringeren Ressourcenverbrauch
- Windows-Autostart-Vorbereitung

## Voraussetzungen

Node.js LTS muss installiert sein:

```powershell
winget install OpenJS.NodeJS.LTS
```

PowerShell danach neu oeffnen.

## Starten

```powershell
npm install
npm start
```

Fuer den normalen Alltag ist der sparsamere Modus besser:

```powershell
npm run start:lite
```

## Voice-Befehle

- `Hey Garmin starte Spotify`
- `Hey Garmin starte Discord`
- `Hey Garmin starte Steam`
- `Hey Garmin starte League of Legends`
- `Hey Garmin starte Aion zwei`
- `Hey Garmin starte Opera`
- `Hey Garmin starte Code`
- `Hey Garmin starte Codex`

## Hinweis

Jarvis ist ein lokales Spassprojekt. Manche App-Starts haengen davon ab, ob Windows die jeweilige App im PATH findet oder am erwarteten Ort installiert ist.
