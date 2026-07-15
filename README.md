# Claude Traffic Light 🚦

### Deine [Claude-Code](https://claude.com/claude-code)-Session. Als Ampel auf dem Schreibtisch.

Ein kleines rundes Display, das **live zeigt, was Claude gerade tut** – und dir
mit einem Blick verrät, ob du weiterarbeiten kannst oder ob Claude auf **dich**
wartet. Kein Fenster-Wechseln, kein „läuft das noch?". Du siehst es aus dem
Augenwinkel.

Gebaut auf einem **Waveshare RP2040-LCD-1.28** (240×240 Rund-LCD). Einstecken,
einrichten, fertig – kein Löten.

> Inspiriert von [agent-light](https://github.com/eternityspring/agent-light),
> aber auf einem runden LCD statt einer LED-Ampel.

---

## Warum du das willst

- **🟢🟡🔵🔴 Ein Blick genügt.** Grün = fertig, Gelb = denkt, Blau = arbeitet an
  einem Tool, Rot = wartet auf dich. Du merkst *sofort*, wenn Claude hängt und
  eine Freigabe braucht – statt es fünf Minuten später zu bemerken.
- **📊 Exakte Nutzungsanzeige.** Drei Ringe zeigen dein Rest-Kontingent (5h,
  Woche, Woche-Fable) – **die gleichen Prozente wie das Claude-UI**, direkt aus
  Claudes eigenem usage-endpoint. Keine Schätzung, keine Kalibrierung, aktuell
  auch zwischen Sessions. (Details unten.)
- **🏷️ Weiß, woran gearbeitet wird.** Läuft ein Tool, steht sein Name in der
  Mitte – lange Namen laufen als Laufschrift durch.
- **🔌 Plug & Play.** Das Gerät wird automatisch erkannt (macOS, Linux, Windows).
  Ab-/wieder-anstecken? Verbindet sich von selbst neu.
- **🧩 Greift in nichts ein.** Kein Cloud-Dienst, alles lokal über ein winziges
  TCP-Relay. Läuft neben deinem bestehenden Setup.

---

## Was die Ampel anzeigt

```
        ╭───────────────────╮
        │   ▂▃▄  5h-Ring  ▄▃▂ │   Außenring  = Rest 5-Stunden-Kontingent
        │  ╭─── Woche ───╮   │   Innenring  = Rest Wochen-Kontingent
        │  │ ╭─Fable──╮  │   │   Fable-Ring = Rest Wochen-Fable-Kontingent
        │  │ │ ● ● ●  │  │   │   Mitte      = was Claude tut (siehe unten)
        │  │ ╰────────╯  │   │
        │  ╰─────────────╯   │
        │    5h 98%  w 89%   │   Text unten = Rest 5h + Woche in Prozent
        ╰───────────────────╯
```

**Mitte – das Ampellicht:**

| Farbe            | Bedeutung                                         |
|------------------|---------------------------------------------------|
| 🟢 Grün          | Bereit / fertig – Claude wartet auf deinen Prompt |
| 🟡 Gelb (blinkt) | Claude denkt nach                                 |
| 🔵 Blau (fest)   | Claude arbeitet an einem Tool – der **Tool-Name** steht in der Mitte (lange Namen laufen als Laufschrift durch) |
| 🔴 Rot (blinkt)  | **Claude braucht dich** – Rückfrage oder Freigabe. Der **Projektname** steht dabei in der Mitte. |

Rot erscheint **nur**, wenn Claude auf deine Eingabe wartet. Wenn der Schreibtisch
rot blinkt, bist du dran.

**Die drei Ringe** leeren sich, je mehr du verbrauchst. Grün = viel übrig,
gelb = unter 50 %, rot = unter 20 %.

- **Außenring** – dein 5-Stunden-Nutzungsfenster
- **Innenring** – die laufende Woche
- **Fable-Ring** – das Wochen-Kontingent des Fable-Modells (voll, solange du
  Fable nicht nutzt)

---

## Schnellstart

Du hast das fertige Gerät. So bindest du es an deinen Mac/PC:

### 1. Node.js installieren

Falls noch nicht vorhanden: [nodejs.org](https://nodejs.org) (Version 18+).

### 2. Gerät einstecken

Display per USB-C anschließen. Es geht sofort an und zeigt die Ampel grün.

### 3. Software einrichten

```bash
git clone https://github.com/graphics80/claude-traffic-light.git
cd claude-traffic-light
```

Installer starten – je nach System:

- **macOS / Linux:** `./install.sh`
- **Windows (PowerShell):** `powershell -ExecutionPolicy Bypass -File .\install.ps1`
- **überall:** `node install.mjs`

Der Installer holt die Abhängigkeiten und schreibt dir eine fertige
Konfiguration (`claude-settings-generated.json`) mit den richtigen Pfaden.

### 4. In Claude Code aktivieren

Öffne deine Claude-Settings und übernimm den **`"hooks"`**-Block aus
`claude-settings-generated.json`:

- **macOS / Linux:** `~/.claude/settings.json`
- **Windows:** `%USERPROFILE%\.claude\settings.json`

Die **`hooks`** treiben das Ampellicht (grün/gelb/blau/rot). Die drei Ringe
brauchen keine Settings – die Bridge liest die Nutzung selbst aus (siehe unten).

### 5. Hintergrund-Dienst starten (Autostart)

Damit die Ampel immer läuft – auch nach Neustart:

**macOS (launchd):**
```bash
cp com.claude.ampel.plist ~/Library/LaunchAgents/
# Pfade in der Datei an deinen Installationsort anpassen
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

**Fertig.** Öffne ein neues Claude-Code-Fenster – die Ampel reagiert ab sofort.

> 💡 Die Ampel gilt für **alle** deine Claude-Sessions gleichzeitig. Läuft nur
> eine, ist alles eindeutig. Bei mehreren parallelen Sessions teilen sie sich die
> eine Ampel (letztes Ereignis gewinnt).

---

## Die Ringe: exakte Werte, keine Kalibrierung

Die Bridge fragt Claudes eigenen usage-endpoint ab – denselben, den die
`/usage`-Ansicht und die usage-page auf claude.ai nutzen:

```
GET https://api.anthropic.com/api/oauth/usage
```

Die Antwort enthält ein `limits`-array mit den **echten Rest-Prozenten** –
exakt die Zahlen aus dem Claude-UI:

```jsonc
"limits": [
  { "kind": "session",       "percent": 35 },                          // 5h    -> Außenring
  { "kind": "weekly_all",    "percent": 18 },                          // Woche -> Innenring
  { "kind": "weekly_scoped", "percent": 0, "scope": { "model": { "display_name": "Fable" } } }  // Fable -> Fable-Ring
]
```

[`host/usage-oauth.mjs`](host/usage-oauth.mjs) liest das alle 30 s, rechnet
`Rest = 100 − verbraucht` und schickt `H`/`W`/`F` an die Ampel. **Nichts
einzustellen, keine Token-Budgets, kein Nachjustieren** – und es aktualisiert
auch zwischen Sessions.

**Auth:** Es wird der OAuth-Token verwendet, den Claude Code ohnehin lokal
speichert (macOS-Keychain, sonst `~/.claude/.credentials.json`). Der Token wird
bei jedem Poll frisch gelesen (Refreshes greifen automatisch) und landet nur im
`Authorization`-Header – er wird nie geloggt. Ist kein Token erreichbar, hält
die Ampel den letzten Wert.

<details>
<summary><b>Fallback ohne Token: ccusage-Schätzer</b></summary>

Wo der OAuth-Token nicht erreichbar ist, kann stattdessen der ccusage-Poller
laufen. Er *schätzt* den Verbrauch aus Token-Zahlen (via
[ccusage](https://github.com/ryoppippi/ccusage)), ist deshalb **ungenauer**,
kennt **kein** Fable und braucht plan-spezifische Budgets in
[`host/config.mjs`](host/config.mjs):

```bash
AMPEL_OAUTH_POLLER=0 AMPEL_POLLER=1 node host/serial-bridge.mjs
```

Beide Poller gleichzeitig würden sich bei `H`/`W` gegenseitig überschreiben –
darum immer nur einen.

</details>

---

## Fehlersuche

| Problem                        | Lösung                                                        |
|--------------------------------|--------------------------------------------------------------|
| Display bleibt dunkel          | USB-Kabel prüfen (muss Daten führen, nicht nur Strom).       |
| Ampellicht reagiert nicht      | Läuft die Bridge? `node host/serial-bridge.mjs` und Log ansehen. Neue Session öffnen (Hooks laden bei Session-Start). |
| Ringe aktualisieren sich nicht | Läuft die Bridge? Log auf `[usage] token unavailable` / `poll failed` prüfen. OAuth-Token muss lesbar sein (Keychain / `~/.claude/.credentials.json`). |
| Falscher serieller Port (mac)  | `AMPEL_SERIAL_PORT=/dev/cu.usbmodemXXXX node host/serial-bridge.mjs` |
| Falscher serieller Port (Win)  | `set AMPEL_SERIAL_PORT=COM5 && node host\serial-bridge.mjs`   |
| Log ansehen (mac, launchd)     | `~/Library/Logs/claude-ampel.log`                            |
| Windows: `npm install` bricht bei `@serialport/bindings-cpp` ab | Build-Tools für die native Erweiterung fehlen. Meist liegt ein Prebuild bereit; falls nicht, die *Visual Studio Build Tools* (mit „Desktop development with C++") installieren, dann erneut. |

Das Gerät wird normalerweise automatisch erkannt (über die RP2040-USB-Kennung),
egal ob es als `usbmodem…` (macOS), `ttyACM…` (Linux) oder `COMx` (Windows)
erscheint.

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
Claude Code ── hooks ──▶ hook-client.mjs ──┐
                                            ├─TCP :7654─▶ serial-bridge.mjs ──USB──▶ RP2040
   /api/oauth/usage ──▶ usage-oauth.mjs ────┘
                          (H / W / F, exakt)

              (fallback) usage.mjs ── ccusage-Schätzer ─┘
```

- **`host/serial-bridge.mjs`** – Dauerprozess. TCP-Server auf `127.0.0.1:7654`,
  leitet jede Zeile ans Gerät weiter, cached für Reconnect/Replay, startet den
  Usage-Poller.
- **`host/hook-client.mjs`** – winziger TCP-Client, den die Hooks aufrufen.
  Setzt Ampelfarbe + Mitten-Label (Tool- bzw. Projektname).
- **`host/usage-oauth.mjs`** – Usage-Poller. Fragt `/api/oauth/usage` mit dem
  lokalen OAuth-Token ab und schickt `H`/`W`/`F` (5h / Woche / Fable) an die
  Bridge. Primärquelle.
- **`host/usage.mjs`** – ccusage-Fallback-Schätzer (nur mit `AMPEL_POLLER=1`,
  kein Fable).

## Serielles Protokoll (115200 Baud, zeilenweise)

| Zeile          | Bedeutung                               |
|----------------|-----------------------------------------|
| `C idle`       | Mitte grün                              |
| `C think`      | Mitte gelb, blinkt                      |
| `C tool`       | Mitte blau, fest                        |
| `C input`      | Mitte rot, blinkt (wartet auf Eingabe)  |
| `N <text>`     | Mitten-Label (Tool-Name bzw. Projektname) |
| `H <0..100>`   | Außenring = 5h-Rest in %                |
| `W <0..100>`   | Innenring = Wochen-Rest in %            |
| `F <0..100>`   | Fable-Ring = Wochen-Fable-Rest in %     |
| `B <0..100>`   | Helligkeit                              |
| `P`            | Ping → Antwort `ampel ok`               |

## Konfiguration

Firmware-Optik in [`firmware/include/config.h`](firmware/include/config.h):
`ROTATION`, Ringradien/-breiten, Blink-Intervall, Farbschwellen, Textgrößen.

Host-Verhalten in [`host/config.mjs`](host/config.mjs): Ports, serieller Pfad,
optionaler Fallback-Poller.

## Hook-Zuordnung

| Hook               | Zustand                                            |
|--------------------|----------------------------------------------------|
| SessionStart, Stop | `idle` (grün)                                      |
| UserPromptSubmit, PostToolUse | `think` (gelb)                          |
| PreToolUse (Tools) | `tool` (blau fest, Tool-Name)                      |
| PreToolUse `AskUserQuestion` | `input` (rot blinkt)                     |
| Notification       | `input` (rot blinkt – Freigabe/Idle)               |

## Lizenz / Herkunft

Display- und Grafik-Code abgeleitet vom coffeetimer-Projekt (WaveShare-Demo,
MIT). Rest wie im Repository.
