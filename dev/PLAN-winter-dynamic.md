# Plan: Winterpause & dynamisches Füttern

> Entwickler-Planungsdokument. Liegt in `dev/` und ist **nicht** Teil des npm-Pakets
> (`files` in package.json listet `dev/` nicht). Statusstand siehe unten.

## Getroffene Entscheidungen

| # | Thema | Entscheidung |
|---|---|---|
| D1 | Winter-Datum | **MM-DD**, wiederkehrend (saisonal, keine jährliche Pflege) |
| D2 | „Eingeschränkte Fütterung" | eigenes `winterIntervalMin`; `onceDaily` = `winterTime` |
| D3 | Uhrzeit der Erinnerungen | **konfigurierbar** (`winterReminderHour`) |
| D4 | Eigene Winter-Fütterdauer | **ja** (`winterDurationSec`) |
| D7 | Dynamik verstellt Frequenz + **Amount** (`durationSec`) | ja |
| D8 | Mittelwert | **echter 24-Std.-Puffer** (Ringpuffer) |
| D11 | Neuberechnungs-Takt Dynamik | pro Zyklus **+ optionaler Stundentakt** |
| D12 | O₂/Wasserqualität als 2. Eingang | **mit umsetzen** |
| D13 | Dynamik erzwingt Intervall-Modus | ja (UI blendet feste Zeiten aus) |

Reihenfolge: **Phase 1 = Winterpause**, danach **Phase 2 = dynamisches Füttern**.

---

## Gemeinsame Grundlagen

- Neues, unit-testbares Rechenmodul **`lib/schedule.js`** (+ `lib/schedule.test.js`), analog zu `lib/messages.js`.
- Täglicher Haken bereits vorhanden: **`scheduleMidnightRecalc()`** (main.js) plant jede Nacht alle Schalter neu → Winter-Zustand und Dynamik werden dadurch automatisch täglich neu bewertet.
- **Präzedenz:** Winterpause schlägt dynamisches Füttern.

---

## Phase 1 — Winterpause (per Schalter)

### Konfigurationsfelder (adapter-config.d.ts + createSwitch)
| Feld | Typ | Default |
|---|---|---|
| `winterEnabled` | boolean | `false` |
| `winterStart` | string `"MM-DD"` | `"11-01"` |
| `winterEnd` | string `"MM-DD"` | `"03-15"` |
| `winterMode` | `'suspend'\|'reduced'\|'onceDaily'` | `'suspend'` |
| `winterIntervalMin` | number | `240` |
| `winterTime` | string `"HH:mm"` | `"12:00"` |
| `winterDurationSec` | number | `5` |
| `winterStartReminderEnabled` | boolean | `false` |
| `winterStartReminderDays` | number | `7` |
| `winterEndReminderEnabled` | boolean | `false` |
| `winterEndReminderDays` | number | `7` |
| `winterReminderHour` | number | `9` |

### lib/schedule.js (Phase 1)
- `parseMD("MM-DD") -> {month, day} | null`
- `isInWinterPause(startMD, endMD, now) -> boolean` (Jahreswechsel-Überlauf via `month*100+day`-Vergleich)
- `daysUntilMD(md, now) -> number` (0 = heute, sonst Tage bis zur nächsten Wiederkehr)
- `nextMDDate(md, now) -> Date` (nächste Wiederkehr als Datum, für {date}-Formatierung)

### main.js
- `require('./lib/schedule')`.
- `computeNextFeeding` winter-bewusst: `isInWinterPause` → `winterActive` setzen; `suspend`→`null` (Mitternachts-Recalc reaktiviert automatisch); `onceDaily`→Einzelzeit `winterTime`; `reduced`→`nextFromInterval(sw, now, winterIntervalMin)`.
- `nextFromInterval(sw, now, intervalMinOverride?)` – Intervall-Parameter optional.
- `feed()` nutzt effektive Dauer: in der Pause (reduced/onceDaily) `winterDurationSec` statt `durationSec` (Helper `effectiveDurationSec`).
- Erinnerungs-Tick: `scheduleReminderTick()` feuert stündlich (hh:00:15); `checkWinterReminders()` sendet je Schalter zur `winterReminderHour`, wenn `daysUntilMD(start|end) <= reminderDays`, dedupliziert über Status-States (max. 1×/Tag), letztmalig am Stichtag (`d=0`).
- `notifyWinter(sw, key, params)` – Telegram-Versand via `sendTo`, gegated durch Winter-Reminder-Settings (unabhängig von Fütter-Benachrichtigungen).
- Neue flache Status-States je Schalter: `winterActive` (boolean), `winterLastStartReminder`, `winterLastEndReminder` (string, ro) in `syncSwitchObjects`.
- `onUnload`: `reminderTimer` clearen.

### lib/messages.js (4 Keys × 11 Sprachen, mit `{date}`)
- `winterStartSuspend`, `winterStartReduced`, `winterEndSuspend`, `winterEndReduced` (Texte laut Spezifikation).

### UI (SwitchTab.jsx) – Sektion „Winter pause"
Aktiv-Checkbox; Start/Ende (MM-DD); Modus-Radio (aussetzen/eingeschränkt/1× täglich); je nach Modus `winterIntervalMin` bzw. `winterTime`; `winterDurationSec`; Reminder-Uhrzeit; zwei Reminder-Blöcke (Aktiv + Tage vorher); Hinweis „benötigt Telegram".

### i18n (11) + Doku (11) + Tests (isInWinterPause inkl. Jahreswechsel, daysUntilMD, Reminder-Fälligkeit).

### Edge Cases
Jahreswechsel-Fenster; 29.02.; Adapter tagsüber offline → dieser Tag entfällt (Dedup verhindert Nachschub); Neustart in der Pause → `winterActive` neu berechnet; DST.

---

## Phase 2 — Dynamisches Füttern (per Schalter) — später

- Felder: `dynamicEnabled`, `dynamicSource ('water'|'air')`, `dynamicTRef` (20), `dynamicQ10` (2.2), `dynamicBaseIntervalMin`, `dynamicMinIntervalMin`, `dynamicMaxIntervalMin`, `dynamicBaseDurationSec`, `dynamicMinDurationSec`, `dynamicMaxDurationSec` (D7: Amount auch), `dynamicBufferHours` (24, D8 echter Ringpuffer), `dynamicHysteresisPct`, plus O₂-Eingang (D12): `o2ObjectId`, `o2MinForFeeding`.
- Algorithmus: `rate = Q10^((T_avg - T_ref)/10)`; `interval = clamp(base/rate, min, max)`; `duration = clamp(base*rate, min, max)`.
- **Echter 24-Std.-Ringpuffer** (D8) globaler Temperatur-Samples (air/water), persistiert; Mittelwert daraus.
- O₂/Wasserqualität (D12): unter Schwelle → Fütterung reduzieren/aussetzen (zweiter Eingang).
- D13: bei `dynamicEnabled` erzwingt Intervall-Modus, UI blendet feste Zeiten aus.
- Nur aktivierbar, wenn gewählte Temperaturquelle aktiv ist.
- Neuberechnung pro Planungszyklus + optionaler Stundentakt (D11).
- Status-States: `dynamicAvgTemperature`, `dynamicIntervalMin`, `dynamicDurationSec`, `dynamicRate`.

---

## Rollout
- Phase 1 → **v0.5.0**, Phase 2 → **v0.6.0** (jeweils bump + changelog + news 11 + build/lint/check/test + commit/tag/push).

## Status
- [x] Phase 1 (Winterpause) released: v0.5.0–0.5.3.
- [x] Phase 2 (dynamisches Füttern + O₂) implementiert (grün); Release als v0.6.0.
- [ ] Phase 3 (Settings aus VIS änderbar) — später, mit Nutzer abzustimmen.
