![Logo](admin/automatic-feeder.png)
# ioBroker.automatic-feeder

[![NPM version](https://img.shields.io/npm/v/iobroker.automatic-feeder.svg)](https://www.npmjs.com/package/iobroker.automatic-feeder)
[![Downloads](https://img.shields.io/npm/dm/iobroker.automatic-feeder.svg)](https://www.npmjs.com/package/iobroker.automatic-feeder)
![Number of Installations](https://iobroker.live/badges/automatic-feeder-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/automatic-feeder-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.automatic-feeder.png?downloads=true)](https://nodei.co/npm/iobroker.automatic-feeder/)

**Tests:** ![Test and Release](https://github.com/ssbingo/ioBroker.automatic-feeder/workflows/Test%20and%20Release/badge.svg)

---

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

---

## automatic-feeder adapter for ioBroker

This adapter turns any existing ioBroker switch (a smart plug, a relay, a GPIO output …) into a
scheduled **automatic feeder**. It switches the output on for a defined number of seconds at the
times you configure, and can take temperature and the day/night cycle into account so it never
feeds at the wrong moment.

This document is a complete manual. If you have never used the adapter before, read it from top
to bottom – the **Quick start** gets you to your first feeding in a few minutes, the rest
explains every option in detail.

> 🇩🇪 Deutsche Anleitung: [doc/de/README.md](doc/de/README.md) · other languages: see
> [Documentation](#documentation) at the bottom.

---

## Table of contents

1. [What the adapter does](#1-what-the-adapter-does)
2. [Requirements](#2-requirements)
3. [Installation](#3-installation)
4. [Quick start](#4-quick-start--your-first-feeding)
5. [The settings page in detail](#5-the-settings-page-in-detail)
6. [Objects / data points](#6-objects--data-points)
7. [Examples / recipes](#7-examples--recipes)
8. [Telegram notifications](#8-telegram-notifications)
9. [Troubleshooting & FAQ](#9-troubleshooting--faq)
10. [Logging & debugging](#10-logging--debugging)
11. [Dynamic feeding — background & sources](#11-dynamic-feeding--background--sources)

---

## 1. What the adapter does

A "feeding" is simply: **switch an output ON → wait a configurable number of seconds → switch it
OFF again**. For a converted feeder the running motor during those seconds dispenses the food.

The adapter can manage **up to 5 switches**, each completely independent and each with its own
configuration tab named after the switch. Per switch you decide:

* **when** it feeds – either at **fixed times** (e.g. 08:00 and 18:00) or in an **interval**
  inside a time window (e.g. every 60 minutes between 08:00 and 18:00);
* **how long** the output stays on (feeding duration in seconds);
* **whether to block** feeding when the water or air temperature is too low/high;
* **whether to restrict** feeding to the astronomical day window (sunrise/sunset with per-switch
  offsets, from a system, shared or per-switch location);
* **whether to supervise** the switch (check that it really turned on and off) and optionally
  send a **Telegram** message about the result;
* **whether to reduce or pause** feeding during a recurring **winter** season – optionally with
  Telegram reminders before it starts and ends;
* **whether to adapt** the interval and the portion to the water/air temperature automatically
  (**dynamic feeding**, Q10 model);
* **whether to block** feeding when the dissolved **oxygen** (O₂) is too low;
* **up to 3 one-off feeding pauses** (absolute date-time periods, e.g. a quarantine after
  restocking) with a **Telegram** message at the start and end of each;
* a **master pause switch** (*Suspend feeding now*) that instantly suspends **all** feeding
  for a switch until you turn it off again, with a **Telegram** message on each toggle.

You can also trigger a feeding **manually** at any time – from the adapter's settings page
(button with a freely selectable duration) or from a data point (e.g. a button in a VIS view).

> Important: the adapter never creates the switch itself. It **controls an object that already
> exists** in your ioBroker system. You select that object in the configuration.

---

## 2. Requirements

| You need | Details |
|----------|---------|
| **ioBroker** with a recent **admin** (≥ 7) | The configuration page is built with React. |
| **A switch object** | Any writable ioBroker state that turns your feeder on/off – e.g. a smart plug (`shelly.0.…`, `sonoff.0.…`, `zigbee.0.…`), a relay, a script variable. |
| *(optional)* **Geo-coordinates** | Used to calculate sunrise/sunset for the per-switch **astronomical window**. Only needed if a switch uses that window; taken from the ioBroker system settings, one shared position, or configured per switch. |
| *(optional)* Temperature objects | Existing states with air and/or water temperature, for temperature blocking or dynamic feeding. Assigned **per switch** on the switch tab. |
| *(optional)* **Oxygen (O₂)** objects | Existing states with the dissolved oxygen, to block feeding when it drops too low. Assigned **per switch**. |
| *(optional)* A **Telegram** instance | The official `telegram` adapter, configured and running, if you want push notifications. |
| Internet access on the ioBroker host | Only for the address search / map in the configuration. Normal operation works offline. |

---

## 3. Installation

1. In the ioBroker **admin**, open the **Adapters** tab.
2. Find **automatic-feeder** in the list and click **Install**.
3. Create an **instance** of the adapter.
4. Open the instance settings (the gear icon) – you should see the configuration page with the
   **General settings** tab. If it stays blank, see [Troubleshooting](#9-troubleshooting--faq).

---

## 4. Quick start – your first feeding

The goal: make one switch feed for 5 seconds, right now, to prove everything works.

1. **Open the settings** of the automatic-feeder instance.
2. On the **General settings** tab:
   * Under **Location**, leave *Use system settings for all switches* selected (only relevant if
     you later enable the astronomical window). You can also pick a shared location or configure
     it per switch.
   * Scroll down to **Switches** and click **Add switch**.
   * Give it a **Name** (e.g. `Koi pond`). This name becomes the title of its own tab.
   * Click the list icon next to **Switch object** and choose the state that switches your
     feeder (e.g. your smart plug). Make sure the switch is **Active** (checkbox on the left).
3. **Save** (the disk/checkmark at the bottom). A new tab named after your switch appears.
4. Open that **switch tab**. At the top under **Manual feeding**, set a duration (e.g. `5`
   seconds) and click **Feed now**. The output should turn on for 5 seconds and off again.
5. Still on the switch tab, set up the real schedule under **Feeding schedule** (e.g. fixed
   times 08:00 and 18:00) and the **Feeding duration** under **Feeding action**, then **Save**.

That's it – the adapter will now feed automatically. Everything below explains the options in
depth.

---

## 5. The settings page in detail

The configuration has a **General settings** tab plus **one tab per switch** (created
automatically once a switch has a name). If a page does not scroll, drag the window larger or
use the scrollbar on the right – all sections are reachable.

### 5.1 General settings tab

#### Location (for the astronomical window)

The location is used to calculate sunrise/sunset for the **astronomical feeding window** that can
be enabled per switch (see *Restrictions* on the switch tab). It is only needed if at least one
switch uses that window. Three options:

* **Use system settings for all switches** – takes latitude/longitude from the ioBroker system
  configuration (recommended if those are already set). The current values are shown.
* **One shared location for all switches** – set a single position that all switches use:
  * Type an **address** and press **Search**. The adapter resolves it (via OpenStreetMap /
    Nominatim) and places a marker.
  * Or **click on the map** / **drag the marker** to the exact spot.
  * Latitude/longitude can also be typed directly; the map follows.
* **Configure the location individually per switch** – each switch defines its own location on
  its own tab (useful when feeding stations, e.g. ponds, are at different places).

> The address search runs in the adapter backend, so the **instance must be running** for it.
> The map tiles and the search need internet access.

The **sunrise/sunset offsets are configured per switch** (under *Restrictions*), and the
calculated times are published per switch as `status.sunrise` / `status.sunset`, recalculated
automatically every night.

#### Switches

The list of feeders (up to 5). For each entry:

* **Active** (checkbox) – only active switches are scheduled.
* **Name** – free text; becomes the switch's tab title and the channel name in the object tree.
* **Switch object** – the existing ioBroker state to control. Use the list icon to browse, or
  the cross to clear.

Use **Add switch** to create another (max. 5) and the trash icon to remove one. Removing a
switch also deletes its data points.

### 5.2 Switch tabs

Each configured switch gets its own tab, titled with its name. It contains the following
sections.

#### Manual feeding

* **Manual feeding duration (seconds)** – the duration used by the button.
* **Feed now** – triggers a feeding immediately with that duration. Useful for testing or an
  extra portion. (Whether it ignores blocks depends on *Manual trigger ignores all blocks* in
  *Restrictions*.)
* The instance must be running and the configuration **saved** for the button to work.

#### Feeding schedule

Choose **one** mode:

* **Fixed times** – a list of clock times (`HH:mm`). Add as many as you like; the feeder runs
  at each of them every day. Example: `08:00` and `18:00`.
* **Interval within a time window** – feed repeatedly inside a window:
  * **Window start** / **Window end** – e.g. 08:00 to 18:00.
  * **Interval (minutes)** – e.g. 60 → feed at 08:00, 09:00, …, up to the end of the window,
    every day.

If the **astronomical window** is enabled (see *Restrictions*), the fixed window start/end are
replaced by the sunrise/sunset window and are hidden; the interval then runs between sunrise and
sunset. The next planned time is always visible in the `status.nextFeeding` data point.

#### Feeding action

* **Feeding duration (seconds)** – how long the output stays ON during a scheduled feeding.
* **On value** / **Off value** – the values written to the switch object. Defaults are `true`
  and `false`, which fit most smart plugs/relays. If your device expects numbers or text, enter
  e.g. `1` / `0` or `ON` / `OFF` here.

#### Temperature & oxygen sources

Each switch (feeding station) has **its own** sensors – different ponds/tanks can use different
objects:

* **Air temperature** – tick the box and pick the state that holds this station's air temperature.
* **Water temperature** – tick the box and pick the state that holds this station's water temperature.
  This is the primary **feeding-zone** sensor (place it where the fish actually feed, not at the surface).
* **Water temperature (deep)** – *optional second* water sensor (e.g. near the bottom). Only shown once
  the primary water sensor is enabled. With two sensors you choose a **combine mode** for dynamic feeding:
  *Feeding zone (shallow only)* [default], *Average of both*, *Coldest layer*, or *Seasonal* (uses the
  shallow sensor while it is at or above a threshold, otherwise the deep sensor). The temperature **block**
  always uses the **coldest** of the two layers. A second sensor only helps in **deep, unmixed ponds**
  (a running pump mixes the water and removes any stratification) — see *Dynamic feeding — background & sources*.
* **Oxygen (O₂)** – tick the box and pick the state that holds the dissolved oxygen.

Only number states make sense. The current values are mirrored to this switch's `status.airTemperature`,
`status.waterTemperature`, `status.waterTemperatureDeep`, `status.oxygen` (and `status.waterStratification`
= shallow − deep) data points. The thresholds are set below (*Temperature blocking*), and the temperatures
also drive *Dynamic feeding*.

#### Temperature blocking

Only shown for the temperature sources you enabled above (*Temperature & oxygen sources*). Per switch you can:

* **Block by water temperature** – set *Block if below* and/or *Block if above* (°C).
* **Block by air temperature** – same, for air.

If the current temperature is outside the allowed range, the feeding is skipped and the reason
is written to `status.blockReason`. (If a temperature value is unknown, that source does not block.)

#### Restrictions

* **Restrict feeding to the astronomical day window (sunrise/sunset + offsets)** – when on,
  feeding is limited to the daytime window computed from this switch's location. For *Interval*
  and *Dynamic feeding* this window replaces the fixed window start/end; for *Fixed times* it
  acts as a day/night guard (times outside the window are skipped). When enabled you can set:
  * **Minutes after sunrise** – start this many minutes *after* sunrise (default 0).
  * **Minutes before sunset** – stop this many minutes *before* sunset (default 0).
  * **Location for this switch** – only shown when the general *Location* is set to *individual*:
    pick *Use system settings* or *Define specific location* (address search + map) for this
    switch. The computed times appear in `status.sunrise` / `status.sunset`.
* **Manual trigger ignores all blocks** – when on, the manual button and the `feedNow` /
  `feedFor` data points feed even if a temperature/window block is active.

#### Dynamic feeding

Optional: adapt the feeding **interval and duration to temperature** using the Q10 model (metabolism roughly doubles per +10 °C). Requires an active temperature source; fixed times are then replaced by an interval within the window.

* **Enable / source** – turn it on and pick water or air temperature. When a second (deep) water sensor is configured, the water temperature used here is combined from both layers per the chosen combine mode (see *Temperature & oxygen sources*).
* **Reference / Q10** – the base interval and duration apply at the reference temperature (e.g. 20 °C); Q10 is typically 2–2.5 (metabolism roughly doubles per +10 °C — see *Dynamic feeding — background & sources*).
* **Interval / duration (base, min, max)** – bounds for the computed interval (minutes) and duration (seconds). The **base interval and the max interval must be greater than 0**, otherwise no feeding can be planned.
* **Averaging window / hysteresis** – a moving average (e.g. 24 h) smooths spikes; hysteresis avoids re-planning on tiny changes.

The current values are exposed in `status.dynamicAvgTemperature`, `status.dynamicRate`, `status.dynamicIntervalMin` and `status.dynamicDurationSec`. An optional **oxygen (O₂)** source can block feeding when the dissolved oxygen drops below a threshold. The winter pause takes precedence over dynamic feeding.

> If dynamic feeding is enabled but no valid interval can be computed (base or max interval is 0, or an invalid time window), nothing is scheduled: `status.nextFeeding` stays empty and `status.blockReason` shows a hint. Set a base interval and a max interval greater than 0.

#### Winter pause

Per switch you can define a recurring **winter pause** (seasonal, given as `MM-DD` dates that repeat every year and may wrap around New Year).

* **Enable winter pause** – turn the pause on.
* **Winter start / Winter end** – pick the day and month from a calendar (shown as dd.mm), e.g. 01.11 to 15.03.
* **Mode** – during the pause either **suspend feeding**, feed with a **reduced** own interval, or **once daily** at a set time; a separate **winter feeding duration** applies.
* **Reminders (Telegram)** – a daily reminder is sent in the days before the start and before the end (last on the day itself), at the configured hour. Needs a Telegram instance (see below).

The current state is shown in the `status.winterActive` data point. Feeding resumes automatically when the pause ends.

#### Feeding pauses

**Suspend feeding now (master switch).** At the top of this section a single **on/off switch** lets you suspend **all** feeding for the switch **immediately and indefinitely** — it overrides the time-based pauses below **and** every feeding mode (fixed times, interval, dynamic feeding, winter pause). Turn it **off** again and feeding resumes exactly as configured before; nothing else has to be changed. Toggling it sends a **Telegram** message (*on* / *off*). Typical use: a spontaneous interruption (medication, maintenance, water treatment) without touching any schedule. It is editable from the settings page **and from VIS/scripts** via `settings.pauseNow`, and its live state is shown in `status.pauseManual`.

Below the master switch, up to **3 one-off feeding pauses** per switch let you plan absolute date-time periods in which feeding is **completely suspended** (higher priority than every feeding mode). Typical use: a **quarantine after restocking**, when new fish should not be fed for a while.

* **Pause 1 / 2 / 3** – tick to enable, then pick a **Start** and **End** (date + time, shown as `DD.MM.YYYY HH:mm`), e.g. `15.07.2026 08:00` to `22.07.2026 18:00`.
* Feeding stops while *now* is within an enabled pause and resumes automatically at its end.
* A **Telegram** message is sent exactly at the **start** and **end** of each pause (needs a Telegram instance, see below). If the adapter starts while a pause is already active, only the *end* message is sent.
* Editable from the settings page **and from VIS/scripts** via the `settings.*` states (e.g. `settings.pause1Start`).

The current state is shown in `status.pauseActive` and `status.pauseActiveUntil` (the master switch also drives `status.pauseActive`).

#### Switching supervision

After switching, the adapter can verify that the switch **actually** reached the on and off
state, and report one of three results per feeding:

| Result | Meaning | Message |
|--------|---------|---------|
| ✅ success | switch turned on and off as expected | "Feeding triggered for x s." |
| ❌ on failed | the switch never confirmed the ON state | "Feeding could not be performed. Check the switch!" |
| ❌ off failed | it turned on, but did not turn off again | "Fault: the feeder did not switch off!" |

> The message is sent in the configured ioBroker system language (English by default).


* **Verify that the switch actually turns on and off** – enables the supervision.
* **Verification timeout (seconds)** – how long to wait for the confirmation.
* **Verification attempts** – how many staggered re-checks to perform before reporting a fault (default 3). Each attempt also reads the current state back, so delayed status feedback (e.g. Homematic radio) no longer triggers a false fault.

> **Important:** supervision works only if the switch **reports its real state back**, i.e. the
> target object is updated with `ack=true` (typical for smart plugs/relays with status feedback).
> A plain helper boolean that nobody acknowledges would always report a fault – in that case
> turn supervision off for this switch.

The result is also stored in the `status.lastResult` (text) and `status.error` (boolean) data points, so you
can react to it (e.g. trigger a notification of your own).

#### Telegram notifications

Send the supervision messages to Telegram – configured **per switch**:

* **Telegram instance** – pick one of the installed `telegram.*` instances (or *None* to
  disable Telegram for this switch). If none is installed, the field tells you so.
* **Telegram recipient (optional)** – a specific user/chat name as configured in the telegram
  adapter; leave empty to send to all configured recipients.
* **Checkboxes** – choose which messages to send: successful feeding, could-not-feed, and/or
  switch-off fault.

The **winter-pause reminders** (if enabled, see *Winter pause*) are sent to the same Telegram
instance, independently of these supervision checkboxes.

See [Telegram notifications](#8-telegram-notifications) for the full setup.

---

## 6. Objects / data points

> **Note:** All timestamp data points are shown in the **system's local timezone** (format `DD.MM.YYYY HH:MM:SS`, e.g. `01.07.2026 16:20:00`). For VIS and scripts every timestamp additionally has a **numeric twin** ending in `…Ts` (Unix time in **milliseconds**, `0` = none) — ideal for countdowns and time bars without any string parsing, and independent of the display format.

The adapter creates the following states under its namespace
(`automatic-feeder.<instance>.`).

**Global**

| Data point | Type | Meaning |
|------------|------|---------|
| `info.connection` | boolean (ro) | Adapter is running and the configuration is valid. |

**Per switch, under `switches.<id>.`** (`<id>` is an internal id like `sw-0`)

Directly under the switch there is the manual trigger and two sub-channels:

* **`status`** (`switches.<id>.status.*`) – the read-only status data points listed below.
* **`settings`** (`switches.<id>.settings.*`) – an **editable** mirror of this switch's
  configuration. Writing a new value there (from VIS or a script) changes the configuration and
  restarts the instance so the change takes effect. A few derived fields are read-only
  (e.g. `winterWindow`).

| Data point | Type | Meaning |
|------------|------|---------|
| `feedNow` | boolean (rw) | Write `true` to trigger a manual feeding. |
| `feedFor` | number (rw) | Write a duration in **seconds** to trigger **one feeding with exactly that duration** — no configuration change, no restart. Resets to `0` after execution. |
| `status.feedingActive` | boolean (ro) | A feeding is running right now. |
| `status.lastFeeding` | string (ro) | Timestamp of the last feeding. |
| `status.lastFeedingTs` | number (ro) | Last feeding as Unix time in ms (`0` = none yet). |
| `status.nextFeeding` | string (ro) | Timestamp of the next planned feeding. |
| `status.nextFeedingTs` | number (ro) | Next planned feeding as Unix time in ms (`0` = nothing planned). |
| `status.blocked` | boolean (ro) | The last attempt was blocked. |
| `status.blockReason` | string (ro) | Why it was blocked (night / temperature / oxygen), in the system language. |
| `status.blockReasonCode` | string (ro) | The block reason as a **stable machine-readable code** (e.g. `blockNight`, `blockWaterBelow`, `blockPauseManual`; empty = not blocked) — for icon/colour logic in VIS, independent of the language. |
| `status.lastResult` | string (ro) | Result text of the last feeding attempt. |
| `status.error` | boolean (ro) | The last attempt had a switching fault. |
| `status.winterActive` | boolean (ro) | The winter pause is currently active. |
| `status.winterLastStartReminder` | string (ro) | Date of the last sent "winter starts" reminder. |
| `status.winterLastEndReminder` | string (ro) | Date of the last sent "winter ends" reminder. |
| `status.pauseManual` | boolean (ro) | The manual master pause (*Suspend feeding now* / `settings.pauseNow`) is on. |
| `status.pauseActive` | boolean (ro) | A one-off feeding pause is currently active. |
| `status.pauseActiveUntil` | string (ro) | End of the currently active feeding pause (empty if none). |
| `status.pauseActiveUntilTs` | number (ro) | End of the active feeding pause as Unix time in ms (`0` = none). |
| `status.dynamicAvgTemperature` | number (ro) | Averaged temperature used by dynamic feeding. |
| `status.dynamicRate` | number (ro) | Q10 rate factor currently applied by dynamic feeding. |
| `status.dynamicIntervalMin` | number (ro) | Currently computed dynamic interval (minutes). |
| `status.dynamicDurationSec` | number (ro) | Currently computed dynamic duration (seconds). |
| `status.airTemperature` | number (ro) | This switch's own air-temperature source value. |
| `status.waterTemperature` | number (ro) | This switch's own water-temperature source value (feeding-zone / shallow sensor). |
| `status.waterTemperatureDeep` | number (ro) | This switch's optional deep water-temperature sensor value. |
| `status.waterStratification` | number (ro) | Temperature difference shallow − deep (only with two water sensors). |
| `status.oxygen` | number (ro) | This switch's own dissolved-oxygen source value. |
| `status.sunrise` / `status.sunset` | string (ro) | Calculated sunrise/sunset for this switch's location (astronomical window). |
| `status.sunriseTs` / `status.sunsetTs` | number (ro) | Sunrise/sunset as Unix time in ms — e.g. for a day-progress bar in VIS. |

You can use these in VIS, scripts or other adapters – for example show `status.nextFeeding` on a
dashboard, or react on `status.error = true` to send your own alarm.

---

## 7. Examples / recipes

**Koi pond, twice a day, only when warm enough**
* Mode *Fixed times* → `08:00`, `18:00`; duration `6` s.
* On the switch tab, under *Temperature & oxygen sources*, enable *Water temperature* and pick
  the sensor; then *Block by water temperature* → *Block if below* `8` °C (no feeding when cold).
* Under *Restrictions*, enable *Restrict feeding to the astronomical day window* so nothing is
  fed after dark.

**Aviary, only during daylight (astronomical window)**
* Mode *Interval within a time window* → interval `90` min; duration `3` s.
* Under *Restrictions*, enable the astronomical window with offsets `30` / `30` min → feeding
  runs from 30 min after sunrise to 30 min before sunset, following the seasons automatically.

**Koi pond, temperature-adaptive (dynamic feeding)**
* On the switch tab, under *Temperature & oxygen sources*, enable *Water temperature* and pick the sensor.
* Then open *Dynamic feeding*, enable it, source *Water temperature*.
* Reference `20` °C, Q10 `2.2`, base interval `60` min (min `30`, max `480`), base duration `5` s
  (min `2`, max `15`). It then feeds more often and a little more when warm, and less when cold.

**Winter break for the pond**
* On the switch tab open *Winter pause*, enable it, set *Winter start* `01.11` and *Winter end*
  `15.03`, mode *Suspend feeding*.
* Optionally tick the reminders so you get a Telegram note a few days before start/end.

**Quarantine after restocking (feeding pause)**
* On the switch tab open *Feeding pauses*, tick *Pause 1* and set *Start* `15.07.2026 08:00`,
  *End* `22.07.2026 18:00` → no feeding at all in that window, then it resumes automatically.
* With a Telegram instance configured you get a message at the start and the end of the pause.

**Suspend feeding right now (master switch)**
* On the switch tab open *Feeding pauses* and turn on *Suspend feeding now* – or write `true` to
  `automatic-feeder.0.switches.sw-0.settings.pauseNow` from a VIS switch.
* All feeding stops immediately (overriding every mode) until you turn it off again; each toggle
  sends a Telegram message. `status.pauseManual` shows the live state.

**Manual extra portion from a VIS button**
* Put a button in VIS that writes `true` to `automatic-feeder.0.switches.sw-0.feedNow`.
* Or use a slider/number field that writes the **seconds** to
  `automatic-feeder.0.switches.sw-0.feedFor` → feeds **once with exactly that duration**
  (no configuration change, no restart; the state resets to `0` afterwards).
* Optionally set *Manual trigger ignores all blocks* so it always feeds.

---

## 8. Telegram notifications

1. Install and configure the **telegram** adapter (create a bot with @BotFather, enter the
   token, start a chat with your bot). Make sure the telegram instance is **running**.
2. In a automatic-feeder **switch tab**, open **Telegram notifications**:
   * Select your **Telegram instance** from the dropdown (e.g. `telegram.0`).
   * Optionally enter a **recipient** (the user/chat name shown in the telegram adapter); leave
     empty to notify everyone.
   * Tick the messages you want: *successful feeding*, *could-not-feed*, *switch-off fault*.
3. Save. From now on the chosen supervision results are pushed to Telegram (prefixed with the
   switch name). This requires *Switching supervision* to be enabled for that switch.
4. The **winter-pause reminders** use the same Telegram instance and recipient. They are
   controlled in the *Winter pause* section (days before start/end and the reminder hour) and do
   **not** require supervision to be enabled.

---

## 9. Troubleshooting & FAQ

**The settings page is blank / white.**
Reload the browser with **Ctrl+Shift+R** (the admin may have cached an old page). If it
persists, restart the instance and reopen the settings.

**The new icon / a change does not show up.**
Browser cache – hard-reload with **Ctrl+Shift+R**.

**Nothing gets fed.**
Check, in order: the switch is **Active**; a **switch object** is selected; the **schedule** is
valid (`status.nextFeeding` shows a time); it is not **blocked** (look at `status.blocked` / `status.blockReason`);
the **astronomical window** is not excluding the time; set the instance **log level** to `debug`
and watch the log.

**It never feeds at night although I want it to.**
Disable *Restrict feeding to the astronomical day window* for that switch, or adjust its sunrise/
sunset offsets. If the astronomical window is enabled but the switch has no valid coordinates,
its window guard stays inactive and a warning is logged.

**Supervision always reports a fault.**
Your switch object probably does not report its real state back (`ack=true`). Either use a
switch with status feedback, or disable *Switching supervision* for that switch.

**Dynamic feeding does not change anything.**
Make sure the selected temperature source (water or air) is enabled on the switch tab
(*Temperature & oxygen sources*) and delivers values. Right after a restart the moving average is still filling up, so it starts from
the base values. Watch `status.dynamicAvgTemperature` and `status.dynamicIntervalMin`.

**Dynamic feeding is enabled but nothing is ever fed (`status.nextFeeding` is empty).**
The **base interval or the max interval is 0** (or the time window is invalid), so no interval can be computed – `status.blockReason` then shows a hint. Set a base interval and a max interval greater than 0 (and a valid window). Note: leaving *both* the min and max interval at 0 also forces the result to 0.

**Nothing is fed although it is not winter (or it feeds although it should pause).**
Check the *Winter pause* dates (`Winter start` / `Winter end`, format dd.mm) and the mode. The
`status.winterActive` data point shows whether the pause is currently active.

**The address search says the instance must be running.**
Start the automatic-feeder instance – the geocoding runs in the backend.

**Telegram messages do not arrive.**
Is a Telegram instance selected on the switch tab? Is the telegram adapter configured and
running? Is at least one message type ticked, and is *Switching supervision* enabled?

---

## 10. Logging & debugging

The adapter logs on the standard ioBroker levels. To see detailed messages, raise the instance
log level (Instances → automatic-feeder.x → log level) to **debug** or **silly**:

* **error** – failures that need attention (e.g. a write to the switch failed).
* **warn** – misconfiguration (no coordinates, invalid schedule …).
* **info** – milestones (startup, a feeding executed or blocked, manual trigger).
* **debug** – detailed flow (scheduling decisions, temperature updates, geocoding, on/off
  values, verification confirmed/timeout).
* **silly** – very verbose tracing (every timer, every block check, every state change).

---

## 11. Dynamic feeding — background & sources

Fish (koi, goldfish, pond carp) are **poikilothermic (ectothermic)**: their metabolism follows the
water temperature. As a rule of thumb the metabolic rate roughly **doubles for every +10 °C**, which
is exactly the **Q10 coefficient** (typically 2–3) this adapter uses — so feeding more often and a
little more when it is warm, and less when it is cold, is physiologically justified.

**Practical temperature guidance (koi/pond fish):**

* **below ~4–5 °C** – do not feed (use the *Winter pause*).
* **~4–10 °C** – barely active; feed rarely if at all, easily digestible (wheat-germ) food.
* **~10–15 °C** – reduced feeding; the immune system is still weak (~12 °C).
* **~15–25 °C** – optimal growth range, full feeding.
* **above ~28 °C** – dissolved **oxygen** becomes the limiting factor → the O₂ block is useful here.

**Where to measure, and why a second sensor:** the temperature that matters is the water the fish
actually occupy (the **feeding zone**), *not* the surface (which can be several degrees off). In a
pond that is mixed by a running pump, or a shallow pond, one well-placed sensor is enough. Only in a
**deep, unmixed pond** does the water stratify: above 4 °C the warm water sits on top (colder below);
below 4 °C it inverts, leaving a ~4 °C refuge near the bottom. There a **second (deep) sensor** adds
value — for safety (feed by the coldest layer), for a seasonal shallow/deep switch, and to make the
stratification visible (`status.waterStratification`). For most ponds it is optional.

**Sources / further reading:**

* Volkoff H. & Rønnestad I. (2020): *Effects of temperature on feeding and digestive processes in fish.* Temperature 7(4):307–320. <https://pubmed.ncbi.nlm.nih.gov/33251280/>
* K.O.I. – *Water Temperature and Koi.* <https://koiorganisationinternational.org/koi-articles/water-temperature-and-koi>
* K.O.I. – *The Science behind Cold Water in Koi Ponds.* <https://koiorganisationinternational.org/koi-articles/science-behind-cold-water-koi-ponds>
* Pond Informer – *Koi feeding guide.* <https://pondinformer.com/koi-feeding-guide/>

> These figures are general guidance for koi/pond fish, not a substitute for observing your own
> animals. Adjust the reference temperature, Q10, limits and thresholds to your species and setup.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

### 1.4.1 (2026-07-05)
* (ssbingo) Fix: the cleanup of removed switches mistakenly treated the `status` **sub-channel** as an obsolete switch and deleted it on **every adapter start** — the persisted status values (last feeding/result, winter-reminder deduplication, pause state) were lost on each restart (latent since 1.0.0). Only direct children of `switches.` are considered switch channels now; status values survive restarts

### 1.4.0 (2026-07-05)
* (ssbingo) Every timestamp data point now has a **numeric twin** ending in `…Ts` (Unix time in **milliseconds**, `0` = none): `status.lastFeedingTs`, `nextFeedingTs`, `pauseActiveUntilTs`, `sunriseTs`, `sunsetTs` — countdowns and time bars in VIS work without any string parsing and independent of the display format
* (ssbingo) New `status.blockReasonCode`: the block reason as a **stable machine-readable code** (e.g. `blockNight`, `blockWaterBelow`, `blockPauseManual`; empty = not blocked) — language-independent icon/colour logic in VIS next to the localized `status.blockReason`
* (ssbingo) New per-switch command **`feedFor`**: write a duration in **seconds** to trigger **one feeding with exactly that duration** — no configuration change, **no instance restart** (ideal for a VIS slider). Respects the blocks like the manual button (`manualIgnoresBlocks` applies); resets to `0` after execution
* (ssbingo) Documentation updated in all 11 languages

### 1.3.0 (2026-07-04)
* (ssbingo) New per-switch **feeding pauses**. A **master switch** *Suspend feeding now* (`settings.pauseNow`) instantly suspends **all** feeding for a switch until you turn it off again — it overrides every feeding mode (fixed times, interval, dynamic feeding, winter pause) and the date-time pauses. A **Telegram** message is sent on each toggle
* (ssbingo) In addition, up to **3 one-off date-time feeding pauses** per switch (e.g. a **quarantine after restocking**) fully suspend feeding within an absolute period, with a **Telegram** message at the start and end of each. They have the highest priority over all feeding modes
* (ssbingo) New per-switch data points `status.pauseManual`, `status.pauseActive` and `status.pauseActiveUntil`; new editable settings `settings.pauseNow` and `settings.pause1..3Enabled/Start/End` (settings page and VIS/scripts)
* (ssbingo) Documentation updated in all 11 languages

### 1.2.3 (2026-07-02)
* (ssbingo) The local timestamps introduced in 1.2.2 now use a **human-readable format** `DD.MM.YYYY HH:MM:SS` (e.g. `01.07.2026 16:20:00`) instead of local ISO 8601 — consistent with the other date displays and the clearest option for all users

### 1.2.2 (2026-07-02)
* (ssbingo) All timestamp data points (`status.nextFeeding`, `status.lastFeeding`, `status.sunrise`, `status.sunset`) and the times in the log/debug output are now shown in the **system's local timezone** (ISO 8601 with offset, e.g. `2026-07-01T16:20:00+02:00`) instead of UTC — no more mental conversion, and still a correct/sortable/parseable date string

### 1.2.1 (2026-07-02)
* (ssbingo) Admin UI: the OpenStreetMap location map is no longer stretched across the full screen width — it is capped (≈ a third/half) on wider screens and stays full width on small screens (responsive)

### 1.2.0 (2026-07-02)
* (ssbingo) New optional **second (deep) water-temperature sensor** per switch, with a combine mode for dynamic feeding: *feeding zone (shallow)* [default], *average*, *coldest layer* or *seasonal* (shallow while warm enough, otherwise deep). The temperature block always uses the coldest of the two layers. Only useful for deep, unmixed ponds
* (ssbingo) New per-switch data points `status.waterTemperatureDeep` and `status.waterStratification` (shallow − deep)
* (ssbingo) New documentation section **“Dynamic feeding — background & sources”** with the scientific/professional basis (Q10 / metabolism, temperature thresholds, measurement depth, thermal stratification) and references, in all 11 languages

### 1.1.3 (2026-07-02)
* (ssbingo) The Nominatim geocoding request now uses a **10-second timeout** (AbortController) instead of possibly hanging indefinitely
* (ssbingo) User-configurable durations, intervals and the verification timeout are now **clamped to safe absolute maximums in code** (also when written via the `settings.*` states), so they can no longer misbehave
* (ssbingo) Log messages are now always in **English** (three lines that embedded the localized result/reminder text were fixed); the localized text still goes to the data points and Telegram
* (ssbingo) Temperature/oxygen **source values are accepted regardless of the ack flag** (so script / `0_userdata.0` sources keep working); the ack flag is logged and a persistently un-acknowledged source is noted once. The strict ack=true rule stays on the switch on/off verification
* (ssbingo) Housekeeping: removed 6 unused admin translation keys and some dead code (the winter-reminder check reuses a shared helper)

### 1.1.2 (2026-07-01)
* (ssbingo) More detailed **debug/silly logging** for troubleshooting: a readable per-switch configuration summary on start, the next feeding with local time and remaining time, the source of the feeding duration (winter/dynamic/static), the per-switch source assignments, and dynamic re-plan/hysteresis details. No behaviour change; the normal info-level output stays unchanged

### 1.1.1 (2026-07-01)
* (ssbingo) Admin UI: under dynamic feeding the static **Feeding duration** field is now hidden (the duration is computed from temperature there, so the static value only confused); the on/off values stay visible

---

[Older changelogs can be found there](CHANGELOG_OLD.md)

## Documentation

- 🇩🇪 [Deutsche Dokumentation](doc/de/README.md)
- 🇷🇺 [Документация на русском](doc/ru/README.md)
- 🇳🇱 [Nederlandse documentatie](doc/nl/README.md)
- 🇫🇷 [Documentation française](doc/fr/README.md)
- 🇮🇹 [Documentazione italiana](doc/it/README.md)
- 🇪🇸 [Documentación en español](doc/es/README.md)
- 🇵🇱 [Dokumentacja polska](doc/pl/README.md)
- 🇵🇹 [Documentação portuguesa](doc/pt/README.md)
- 🇺🇦 [Документація українською](doc/uk/README.md)
- 🇨🇳 [简体中文文档](doc/zh-cn/README.md)

## License
MIT License

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
