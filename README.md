# Claude Traffic Light 🚦

Eine physische Status-Ampel für [Claude Code](https://claude.com/claude-code),
gebaut auf einem runden **Waveshare RP2040-LCD-1.28** (240×240 Rund-Display).
Sie zeigt live, was Claude gerade tut, wieviel deines Nutzungs-Kontingents übrig
ist – und blinkt rot, sobald Claude auf **dich** wartet.

Inspiriert von [agent-light](https://github.com/eternityspring/agent-light),
aber auf dem runden LCD statt einer LED-Ampel.

---

## Was die Ampel anzeigt

```
        ╭───────────────────╮
        │   ▂▃▄  5h-Ring  ▄▃▂ │   Außenring  = Rest 5-Stunden-Kontingent
        │  ╭─────────────╮   │   Innenring  = Rest Wochen-Kontingent
        │  │             │   │
        │  │    ● ● ●     │   │   Mitte      = was Claude tut (siehe unten)
        │  │             │   │
        │  ╰─────────────╯   │
        │    5h 98%  w 89%   │   Text unten = Rest in Prozent
        ╰───────────────────╯
```

**Mitte (Ampellicht):**

| Farbe            | Bedeutung                                         |
|------------------|---------------------------------------------------|
| 🟢 Grün          | Bereit / fertig – Claude wartet auf deinen Prompt |
| 🟡 Gelb (blinkt) | Claude denkt nach                                 |
| 🔴 Rot (fest)    | Claude arbeitet an einem Tool                     |
| 🔴 Rot (blinkt)  | **Claude braucht dich** – Rückfrage oder Freigabe. Der Projektname steht dabei in der Mitte. |

**Die zwei Ringe** leeren sich, je mehr du verbrauchst. Grün = viel übrig,
gelb = unter 50 %, rot = unter 20 %.

- **Außenring** – dein 5-Stunden-Nutzungsfenster
- **Innenring** – die laufende Woche

---

## Für Anwender – Schnellstart

Du hast das fertige Gerät bekommen. So bindest du es an deinen Mac/PC an:

### 1. Node.js installieren

Falls noch nicht vorhanden: [nodejs.org](https://nodejs.org) (Version 18+).

### 2. Gerät einstecken

Das Display per USB-C anschließen. Es sollte sofort angehen und die Ampel
grün zeigen.

### 3. Software einrichten

```bash
git clone https://github.com/graphics80/claude-traffic-light.git
cd claude-traffic-light
```

Dann den Installer starten – je nach System:

- **macOS / Linux:** `./install.sh`
- **Windows (PowerShell):** `powershell -ExecutionPolicy Bypass -File .\install.ps1`
- **überall (falls du magst):** `node install.mjs`

Der Installer installiert die Abhängigkeiten und erzeugt dir eine fertige
Hook-Konfiguration (`claude-settings-generated.json`) mit den richtigen Pfaden.

### 4. Hooks in Claude Code aktivieren

Öffne deine Claude-Settings und füge den `"hooks"`-Block aus
`claude-settings-generated.json` ein. (Falls die Datei noch keine `"hooks"` hat,
einfach den ganzen Block übernehmen.)

- **macOS / Linux:** `~/.claude/settings.json`
- **Windows:** `%USERPROFILE%\.claude\settings.json`

### 5. Hintergrund-Dienst starten (Autostart)

Damit die Ampel immer läuft – auch nach Neustart:

**macOS (launchd):**
```bash
cp com.claude.ampel.plist ~/Library/LaunchAgents/
# Pfade in der Datei ggf. an deinen Installationsort anpassen
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.claude.ampel.plist
```

**Windows (Aufgabenplanung, einmalig in PowerShell):**
```powershell
schtasks /create /tn ClaudeAmpel /sc onlogon /tr "node \"$PWD\host\serial-bridge.mjs\""
# wieder entfernen:  schtasks /delete /tn ClaudeAmpel /f
```

**Oder manuell (zum Testen, alle Systeme):**
```bash
node host/serial-bridge.mjs
```

### 6. ccusage (für die Ringe)

Die zwei Ringe brauchen [ccusage](https://github.com/ryoppippi/ccusage), um
deinen Verbrauch zu lesen. Wird automatisch per `npx` nachgeladen – oder global
installieren für Tempo:

```bash
npm install -g ccusage
```

**Fertig.** Öffne ein neues Claude-Code-Fenster – die Ampel reagiert ab sofort
auf jede Session.

> 💡 Die Ampel gilt für **alle** deine Claude-Sessions gleichzeitig. Läuft nur
> eine Session, ist alles eindeutig. Bei mehreren parallelen Sessions teilen sie
> sich die eine Ampel (letztes Ereignis gewinnt).

---

## Kontingent-Balken einstellen

Die Ringe zeigen „Rest-Kontingent". Da Claude keine exakte Restmenge liefert,
schätzt die Ampel sie aus deinem Token-Verbrauch (via ccusage). Passe die
Budgets an deinen Plan an – in [`host/config.mjs`](host/config.mjs):

```js
export const FIVE_HOUR_TOKEN_BUDGET = 250_000_000;  // 5h-Fenster
export const WEEKLY_TOKEN_BUDGET    = 2_000_000_000; // Woche
```

Beobachte deine echten Zahlen mit `ccusage blocks --active` und `ccusage daily`
und setze die Budgets so, dass ein volles Fenster ungefähr 100 % ergibt.

---

## Fehlersuche

| Problem                        | Lösung                                                        |
|--------------------------------|--------------------------------------------------------------|
| Display bleibt dunkel          | USB-Kabel prüfen (muss Daten führen, nicht nur Strom).       |
| Ampel reagiert nicht           | Läuft die Bridge? `node host/serial-bridge.mjs` und Log ansehen. Neue Session öffnen (Hooks laden bei Session-Start). |
| Ringe bleiben leer/voll        | ccusage installiert? Budgets in `config.mjs` sinnvoll?       |
| Falscher serieller Port (mac)  | `AMPEL_SERIAL_PORT=/dev/cu.usbmodemXXXX node host/serial-bridge.mjs` |
| Falscher serieller Port (Win)  | `set AMPEL_SERIAL_PORT=COM5 && node host\serial-bridge.mjs`   |
| Log ansehen (mac, launchd)     | `~/Library/Logs/claude-ampel.log`                            |
| Windows: `npm install` bricht bei `@serialport/bindings-cpp` ab | Es fehlen Build-Tools für die native Erweiterung. Meist liegt ein passendes Prebuild bereit; falls nicht, die *Visual Studio Build Tools* (mit „Desktop development with C++") installieren, dann `install` erneut. |

Das Gerät wird normalerweise automatisch erkannt (über die RP2040-USB-Kennung),
egal ob es unter macOS `usbmodem…`, unter Linux `ttyACM…` oder unter Windows
`COMx` heißt.

launchd-Befehle:
```bash
launchctl kickstart -k gui/$(id -u)/com.claude.ampel   # neu starten
launchctl bootout   gui/$(id -u)/com.claude.ampel       # stoppen
```

---
---

# Hardware & Firmware (für Bauende)

Dieser Teil ist nur nötig, wenn du das Gerät **selbst baust oder neu flashst**.
Als reiner Anwender kannst du ihn überspringen.

## Hardware

- **Waveshare RP2040-LCD-1.28** – RP2040 mit rundem 1.28" 240×240 IPS-Display
  (GC9A01A-Controller), USB-C, integrierter QMI8658-IMU (hier ungenutzt).
- Ein USB-C-Datenkabel.

Kein Löten, keine zusätzliche Verkabelung – alles ist auf dem Board.

## Firmware bauen & flashen

Mit [PlatformIO](https://platformio.org) (VS-Code-Erweiterung oder CLI):

```bash
cd firmware
pio run                 # bauen
pio run -t upload       # flashen (bei Erstflash ggf. BOOT-Taste halten)
pio device monitor      # serielles Log
```

Der erste Build lädt die RP2040-Toolchain (dauert einige Minuten).

## Aufbau der Software

```
Claude Code Hooks ──▶ hook-client.mjs ──TCP──▶ serial-bridge.mjs ──USB──▶ RP2040
                                                     ▲
                            usage.mjs (ccusage) ─────┘   (Ring-Werte)
```

- **`host/serial-bridge.mjs`** – Dauerprozess. TCP-Server auf `127.0.0.1:7654`,
  leitet jede Zeile an das Gerät weiter, pollt ccusage.
- **`host/hook-client.mjs`** – winziger TCP-Client, den die Hooks aufrufen.
  Liest das Hook-JSON von stdin, leitet den Session-Namen aus `cwd` ab.
- **`host/usage.mjs`** – ruft ccusage auf, rechnet Rest-Prozente aus.

## Serielles Protokoll (115200 Baud, zeilenweise)

| Zeile          | Bedeutung                               |
|----------------|-----------------------------------------|
| `C idle`       | Mitte grün                              |
| `C think`      | Mitte gelb, blinkt                      |
| `C tool`       | Mitte rot, fest                        |
| `C input`      | Mitte rot, blinkt (wartet auf Eingabe)  |
| `N <text>`     | Session-/Projektname (im Input-Zustand) |
| `H <0..100>`   | Außenring = 5h-Rest in %                |
| `W <0..100>`   | Innenring = Wochen-Rest in %            |
| `B <0..100>`   | Helligkeit                              |
| `P`            | Ping → Antwort `ampel ok`               |

## Konfiguration

Firmware-Optik in [`firmware/include/config.h`](firmware/include/config.h):
`ROTATION`, Ringradien/-breiten, Blink-Intervall, Farbschwellen, Textgrößen.

Host-Verhalten in [`host/config.mjs`](host/config.mjs): Ports, serieller Pfad,
Poll-Intervall, Token-Budgets.

## Hook-Zuordnung

| Hook               | Zustand                                            |
|--------------------|----------------------------------------------------|
| SessionStart, Stop | `idle` (grün)                                      |
| UserPromptSubmit, PostToolUse | `think` (gelb)                          |
| PreToolUse (Tools) | `tool` (rot fest)                                  |
| PreToolUse `AskUserQuestion` | `input` (rot blinkt)                     |
| Notification       | `input` (rot blinkt – Freigabe/Idle)               |

## Lizenz / Herkunft

Display- und Grafik-Code abgeleitet vom coffeetimer-Projekt (WaveShare-Demo,
MIT). Rest wie im Repository.
