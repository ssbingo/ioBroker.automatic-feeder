![Logo](../../admin/automatic-feeder.png)
# ioBroker.automatic-feeder

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

## automatic-feeder Adapter für ioBroker

Dieser Adapter macht aus einem beliebigen, bereits vorhandenen ioBroker-Schalter (einer
Steckdose, einem Relais, einem GPIO-Ausgang …) einen **zeitgesteuerten Futterautomaten**. Er
schaltet den Ausgang zu den von dir festgelegten Zeiten für eine definierte Anzahl Sekunden ein
und kann dabei Temperatur sowie den Tag-/Nacht-Wechsel berücksichtigen, damit nie zur falschen
Zeit gefüttert wird.

Dieses Dokument ist eine vollständige Anleitung. Wenn du den Adapter noch nie benutzt hast,
lies es von oben nach unten – der **Schnellstart** bringt dich in wenigen Minuten zur ersten
Fütterung, der Rest erklärt jede Einstellung im Detail.

---

## Inhaltsverzeichnis

1. [Was der Adapter macht](#1-was-der-adapter-macht)
2. [Voraussetzungen](#2-voraussetzungen)
3. [Installation](#3-installation)
4. [Schnellstart](#4-schnellstart--die-erste-fütterung)
5. [Die Einstellungsseite im Detail](#5-die-einstellungsseite-im-detail)
6. [Objekte / Datenpunkte](#6-objekte--datenpunkte)
7. [Beispiele / Rezepte](#7-beispiele--rezepte)
8. [Telegram-Benachrichtigungen](#8-telegram-benachrichtigungen)
9. [Fehlerbehebung & FAQ](#9-fehlerbehebung--faq)
10. [Logging & Fehlersuche](#10-logging--fehlersuche)

---

## 1. Was der Adapter macht

Eine „Fütterung" ist im Kern ganz einfach: **Ausgang EIN → eine einstellbare Anzahl Sekunden
warten → wieder AUS**. Bei einem umgebauten Futterautomaten läuft in dieser Zeit der Motor und
gibt Futter aus.

Der Adapter verwaltet **bis zu 5 Schalter**, jeder völlig unabhängig und mit einem eigenen
Konfigurations-Tab, der nach dem Schalter benannt ist. Pro Schalter legst du fest:

* **wann** gefüttert wird – entweder zu **festen Zeiten** (z. B. 08:00 und 18:00) oder im
  **Intervall** innerhalb eines Zeitfensters (z. B. alle 60 Minuten zwischen 08:00 und 18:00);
* **wie lange** der Ausgang eingeschaltet bleibt (Fütterungsdauer in Sekunden);
* **ob blockiert** wird, wenn Wasser- oder Lufttemperatur zu niedrig/hoch ist;
* **ob nachts** nicht gefüttert wird (basierend auf dem echten Sonnenauf-/-untergang für deinen
  Standort);
* **ob der Schaltvorgang überwacht** wird (Prüfung, ob wirklich ein- und ausgeschaltet wurde)
  und optional eine **Telegram**-Nachricht zum Ergebnis gesendet wird;
* **ob während einer wiederkehrenden Wintersaison reduziert oder pausiert** wird – optional mit
  Telegram-Erinnerungen vor Beginn und Ende;
* **ob Intervall und Portion automatisch an die Wasser-/Lufttemperatur angepasst** werden
  (**dynamisches Füttern**, Q10-Modell);
* **ob blockiert** wird, wenn der gelöste **Sauerstoff** (O₂) zu niedrig ist.

Du kannst eine Fütterung jederzeit **manuell** auslösen – direkt auf der Einstellungsseite
(Button mit frei wählbarer Dauer) oder über einen Datenpunkt (z. B. ein Button in einer
VIS-Ansicht).

> Wichtig: Der Adapter legt den Schalter nicht selbst an. Er **steuert ein bereits vorhandenes
> Objekt** in deinem ioBroker. Dieses Objekt wählst du in der Konfiguration aus.

---

## 2. Voraussetzungen

| Du brauchst | Details |
|-------------|---------|
| **ioBroker** mit aktuellem **admin** (≥ 7) | Die Konfigurationsseite ist mit React umgesetzt. |
| **Ein Schalter-Objekt** | Ein beschreibbarer ioBroker-Datenpunkt, der den Futterautomaten ein-/ausschaltet – z. B. eine Steckdose (`shelly.0.…`, `sonoff.0.…`, `zigbee.0.…`), ein Relais oder eine Skriptvariable. |
| **Geokoordinaten** | Für die Berechnung von Sonnenauf-/-untergang. Entweder aus den ioBroker-Systemeinstellungen oder per Adresse/Karte. **Verpflichtend.** |
| *(optional)* Temperatur-Objekte | Vorhandene Datenpunkte mit Luft- und/oder Wassertemperatur, für temperaturabhängiges Sperren oder dynamisches Füttern. **Pro Schalter** im Schalter-Tab zugewiesen. |
| *(optional)* **Sauerstoff-Objekte (O₂)** | Vorhandene Datenpunkte mit dem gelösten Sauerstoff, um die Fütterung zu sperren, wenn er zu niedrig wird. **Pro Schalter** zugewiesen. |
| *(optional)* Eine **Telegram**-Instanz | Der offizielle `telegram`-Adapter, eingerichtet und gestartet, falls du Push-Benachrichtigungen möchtest. |
| Internetzugang auf dem ioBroker-Host | Nur für Adresssuche/Karte in der Konfiguration. Der normale Betrieb läuft offline. |

---

## 3. Installation

1. Im ioBroker-**admin** den Reiter **Adapter** öffnen.
2. In der Adapter-Liste **automatic-feeder** suchen und auf **Installieren** klicken.
3. Eine **Instanz** des Adapters anlegen.
4. Die Instanz-Einstellungen öffnen (Zahnrad-Symbol) – es sollte die Konfigurationsseite mit dem
   Tab **Grundeinstellungen** erscheinen. Bleibt sie leer, siehe [Fehlerbehebung](#9-fehlerbehebung--faq).

---

## 4. Schnellstart – die erste Fütterung

Ziel: Ein Schalter soll – sofort, zum Test – 5 Sekunden lang füttern.

1. **Einstellungen öffnen** der automatic-feeder-Instanz.
2. Auf dem Tab **Grundeinstellungen**:
   * Unter **Standort** *Systemeinstellungen übernehmen* lassen, wenn dein ioBroker bereits
     Koordinaten hat. Andernfalls *Standort spezifisch festlegen* wählen, Adresse eingeben,
     **Suchen** klicken und den Marker auf der Karte bestätigen.
   * Nach unten zu **Schalter** scrollen und **Schalter hinzufügen** klicken.
   * Einen **Namen** vergeben (z. B. `Koi-Teich`). Dieser Name wird zum Titel eines eigenen Tabs.
   * Neben **Schalter-Objekt** das Listen-Symbol anklicken und den Datenpunkt wählen, der deinen
     Automaten schaltet (z. B. deine Steckdose). Der Schalter muss **aktiv** sein (Häkchen links).
3. **Speichern** (Diskette/Haken unten). Ein neuer Tab mit deinem Schalternamen erscheint.
4. Diesen **Schalter-Tab** öffnen. Ganz oben unter **Manuelle Fütterung** eine Dauer einstellen
   (z. B. `5` Sekunden) und **Jetzt füttern** klicken. Der Ausgang sollte 5 Sekunden ein- und
   dann wieder ausschalten.
5. Im selben Tab den echten Zeitplan unter **Fütterungsplan** einrichten (z. B. feste Zeiten
   08:00 und 18:00) und die **Fütterungsdauer** unter **Fütterungsvorgang** setzen, dann
   **Speichern**.

Fertig – ab jetzt füttert der Adapter automatisch. Alles Weitere erklärt die Optionen im Detail.

---

## 5. Die Einstellungsseite im Detail

Die Konfiguration hat einen Tab **Grundeinstellungen** sowie **einen Tab pro Schalter** (wird
automatisch angelegt, sobald ein Schalter einen Namen hat). Falls eine Seite nicht scrollt, das
Fenster vergrößern oder die Scrollleiste rechts nutzen – alle Abschnitte sind erreichbar.

### 5.1 Tab „Grundeinstellungen"

#### Standort (verpflichtend)

Der Adapter benötigt deine geografische Position, um Sonnenauf- und -untergang zu berechnen (für
die Nachtsperre). Zwei Möglichkeiten:

* **Systemeinstellungen übernehmen** – nimmt Breiten-/Längengrad aus der ioBroker-Systemkonfiguration
  (empfohlen, wenn dort bereits gesetzt). Die aktuellen Werte werden angezeigt.
* **Standort spezifisch festlegen** – Position selbst bestimmen:
  * Eine **Adresse** eingeben und **Suchen** drücken. Der Adapter löst sie auf (über
    OpenStreetMap / Nominatim) und setzt einen Marker.
  * Oder **auf die Karte klicken** / den **Marker ziehen**, um die genaue Stelle zu wählen.
  * Breiten-/Längengrad können auch direkt eingetragen werden; die Karte folgt.

> Die Adresssuche läuft im Adapter-Backend, daher muss die **Instanz laufen**. Karte und Suche
> benötigen Internetzugang.

#### Sonnenfenster (keine Fütterung nachts)

Legt das Zeitfenster fest, in dem gefüttert werden darf:

* **Minuten nach Sonnenaufgang** – erst so viele Minuten *nach* Sonnenaufgang füttern.
* **Minuten vor Sonnenuntergang** – so viele Minuten *vor* Sonnenuntergang aufhören.

Beispiel: Bei Sonnenaufgang 06:30, Sonnenuntergang 21:00 und Offsets 30 / 30 ist Fütterung nur
zwischen **07:00 und 20:30** erlaubt. Jeder Schalter kann dieses Fenster einzeln beachten oder
ignorieren (siehe *Einschränkungen* im Schalter-Tab). Die berechneten Zeiten stehen außerdem in
den Datenpunkten `sunrise` / `sunset` und werden jede Nacht automatisch neu berechnet.

#### Schalter

Die Liste der Futterautomaten (bis zu 5). Pro Eintrag:

* **Aktiv** (Häkchen) – nur aktive Schalter werden geplant.
* **Name** – freier Text; wird zum Tab-Titel des Schalters und zum Kanalnamen im Objektbaum.
* **Schalter-Objekt** – der vorhandene ioBroker-Datenpunkt, der gesteuert wird. Über das
  Listen-Symbol auswählen, über das Kreuz leeren.

Mit **Schalter hinzufügen** legst du einen weiteren an (max. 5), mit dem Papierkorb-Symbol
entfernst du einen. Beim Entfernen werden auch dessen Datenpunkte gelöscht.

### 5.2 Schalter-Tabs

Jeder konfigurierte Schalter erhält einen eigenen Tab mit seinem Namen. Er enthält folgende
Abschnitte.

#### Manuelle Fütterung

* **Dauer der manuellen Fütterung (Sekunden)** – die vom Button verwendete Dauer.
* **Jetzt füttern** – löst sofort eine Fütterung mit dieser Dauer aus. Praktisch zum Testen oder
  für eine Extraportion. (Ob Sperren ignoriert werden, hängt von *Manueller Auslöser ignoriert
  alle Sperren* unter *Einschränkungen* ab.)
* Für den Button muss die Instanz laufen und die Konfiguration **gespeichert** sein.

#### Fütterungsplan

**Einen** Modus wählen:

* **Feste Zeiten** – eine Liste von Uhrzeiten (`HH:mm`). Beliebig viele hinzufügen; der Automat
  läuft täglich zu jeder davon. Beispiel: `08:00` und `18:00`.
* **Intervall innerhalb eines Zeitraums** – wiederholt innerhalb eines Fensters füttern:
  * **Beginn Zeitraum** / **Ende Zeitraum** – z. B. 08:00 bis 18:00.
  * **Intervall (Minuten)** – z. B. 60 → füttert täglich um 08:00, 09:00, … bis zum Fensterende.

Die nächste geplante Zeit steht jederzeit im Datenpunkt `status.nextFeeding`.

#### Fütterungsvorgang

* **Fütterungsdauer (Sekunden)** – wie lange der Ausgang bei einer geplanten Fütterung EIN bleibt.
* **Ein-Wert** / **Aus-Wert** – die Werte, die in das Schalter-Objekt geschrieben werden.
  Standard sind `true` und `false`, was zu den meisten Steckdosen/Relais passt. Erwartet dein
  Gerät Zahlen oder Text, hier z. B. `1` / `0` oder `ON` / `OFF` eintragen.

#### Temperatur- & Sauerstoffquellen

Jeder Schalter (Futterstation) hat **seine eigenen** Sensoren – verschiedene Teiche/Becken können unterschiedliche Objekte verwenden:

* **Lufttemperatur** – Häkchen setzen und den Datenpunkt wählen, der die Lufttemperatur dieser Station enthält.
* **Wassertemperatur** – Häkchen setzen und den Datenpunkt wählen, der die Wassertemperatur dieser Station enthält.
* **Sauerstoff (O₂)** – Häkchen setzen und den Datenpunkt wählen, der den gelösten Sauerstoff enthält.

Sinnvoll sind nur Zahl-Datenpunkte. Die aktuellen Werte werden in die Datenpunkte `status.airTemperature`,
`status.waterTemperature` und `status.oxygen` dieses Schalters gespiegelt. Die Schwellen werden weiter unten
eingestellt (*Temperatursperre*), und die Temperaturen steuern außerdem das *Dynamische Füttern*.

#### Temperatursperre

Wird nur für die oben aktivierten Temperaturquellen angezeigt (*Temperatur- & Sauerstoffquellen*). Pro Schalter:

* **Nach Wassertemperatur sperren** – *Sperren wenn unter* und/oder *Sperren wenn über* (°C).
* **Nach Lufttemperatur sperren** – dasselbe für die Luft.

Liegt die aktuelle Temperatur außerhalb des erlaubten Bereichs, wird die Fütterung übersprungen
und der Grund in `status.blockReason` geschrieben. (Ist ein Temperaturwert unbekannt, sperrt diese
Quelle nicht.)

#### Einschränkungen

* **Nachts nicht füttern** – beachtet das Sonnenfenster (inkl. der Offsets). Ausschalten, wenn
  dieser Schalter rund um die Uhr füttern darf.
* **Manueller Auslöser ignoriert alle Sperren** – wenn aktiv, füttern der Button und der
  Datenpunkt `feedNow` auch bei aktiver Temperatur-/Nachtsperre.

#### Dynamisches Füttern

Optional: passt **Intervall und Dauer der Fütterung an die Temperatur** an (Q10-Modell – der Stoffwechsel verdoppelt sich grob pro +10 °C). Benötigt eine aktive Temperaturquelle; feste Zeiten werden dann durch ein Intervall innerhalb des Fensters ersetzt.

* **Aktivieren / Quelle** – einschalten und Wasser- oder Lufttemperatur wählen.
* **Referenz / Q10** – Basis-Intervall und -Dauer gelten bei der Referenztemperatur (z. B. 20 °C); Q10 typischerweise 2–2,5.
* **Intervall / Dauer (Basis, Min, Max)** – Grenzen für das berechnete Intervall (Minuten) und die Dauer (Sekunden). Das **Basis-Intervall und das Max-Intervall müssen größer als 0 sein**, sonst kann keine Fütterung geplant werden.
* **Mittelungsfenster / Hysterese** – ein gleitender Mittelwert (z. B. 24 h) glättet Ausreißer; die Hysterese vermeidet Neuplanung bei winzigen Änderungen.

Die aktuellen Werte stehen in `status.dynamicAvgTemperature`, `status.dynamicRate`, `status.dynamicIntervalMin` und `status.dynamicDurationSec`. Eine optionale **Sauerstoff-Quelle (O₂)** kann die Fütterung sperren, wenn der Sauerstoffgehalt unter einen Schwellwert fällt. Die Winterpause hat Vorrang vor dem dynamischen Füttern.

> Ist das dynamische Füttern aktiviert, kann aber kein gültiges Intervall berechnet werden (Basis- oder Max-Intervall ist 0 oder ein ungültiges Zeitfenster), wird nichts geplant: `status.nextFeeding` bleibt leer und `status.blockReason` zeigt einen Hinweis. Setze ein Basis-Intervall und ein Max-Intervall größer als 0.

#### Winterpause

Pro Schalter lässt sich eine wiederkehrende **Winterpause** definieren (saisonal, als `MM-TT`-Daten, die sich jährlich wiederholen und über den Jahreswechsel reichen können).

* **Winterpause aktivieren** – die Pause einschalten.
* **Winterbeginn / Winterende** – Tag und Monat aus einem Kalender wählen (Anzeige als tt.mm), z. B. 01.11 bis 15.03.
* **Modus** – während der Pause entweder **Fütterung aussetzen**, mit **eingeschränktem** eigenem Intervall füttern oder **einmal täglich** zu einer festen Zeit; es gilt eine eigene **Winter-Fütterdauer**.
* **Erinnerungen (Telegram)** – in den Tagen vor Beginn und vor Ende wird täglich (letztmalig am Stichtag) zur eingestellten Uhrzeit eine Erinnerung gesendet. Benötigt eine Telegram-Instanz (siehe unten).

Der aktuelle Zustand steht im Datenpunkt `status.winterActive`. Nach Ende der Pause läuft die Fütterung automatisch wieder an.

#### Schaltüberwachung

Nach dem Schalten kann der Adapter prüfen, ob der Schalter den Ein- und Aus-Zustand
**tatsächlich** erreicht hat, und meldet je Fütterung eines von drei Ergebnissen:

| Ergebnis | Bedeutung | Meldung |
|----------|-----------|---------|
| ✅ Erfolg | Schalter hat wie erwartet ein- und ausgeschaltet | „Fütterung für x s ausgelöst." |
| ❌ Einschalten fehlgeschlagen | der Schalter hat den EIN-Zustand nie bestätigt | „Fütterung konnte nicht durchgeführt werden. Schalter prüfen!" |
| ❌ Ausschalten fehlgeschlagen | er ging an, schaltete aber nicht wieder aus | „Störung: Futterautomat hat nicht abgeschaltet!" |

> Die Meldung wird in der eingestellten ioBroker-Systemsprache gesendet (standardmäßig Englisch).


* **Prüfen, ob der Schalter tatsächlich ein- und ausschaltet** – aktiviert die Überwachung.
* **Überwachungs-Timeout (Sekunden)** – wie lange auf die Bestätigung gewartet wird.
* **Überwachungs-Versuche** – wie viele zeitversetzte Nachprüfungen vor einer Störungsmeldung erfolgen (Standard 3). Jeder Versuch fragt zusätzlich den Ist-Wert aktiv ab, sodass verzögerte Rückmeldungen (z. B. Homematic-Funk) keine Fehlmeldung mehr auslösen.

> **Wichtig:** Die Überwachung funktioniert nur, wenn der Schalter seinen **Ist-Zustand
> zurückmeldet**, d. h. das Zielobjekt wird mit `ack=true` aktualisiert (typisch für
> Steckdosen/Relais mit Statusrückmeldung). Ein einfacher Hilfs-Boolean, den niemand bestätigt,
> würde immer eine Störung melden – dann die Überwachung für diesen Schalter ausschalten.

Das Ergebnis steht außerdem in den Datenpunkten `status.lastResult` (Text) und `status.error` (boolean),
sodass du darauf reagieren kannst (z. B. eine eigene Benachrichtigung auslösen).

#### Telegram-Benachrichtigungen

Sendet die Meldungen der Schaltüberwachung an Telegram – **pro Schalter** konfiguriert:

* **Telegram-Instanz** – eine der installierten `telegram.*`-Instanzen wählen (oder *Keine*, um
  Telegram für diesen Schalter zu deaktivieren). Ist keine installiert, weist das Feld darauf hin.
* **Telegram-Empfänger (optional)** – ein bestimmter Benutzer/Chat-Name, wie im telegram-Adapter
  konfiguriert; leer lassen, um an alle konfigurierten Empfänger zu senden.
* **Checkboxen** – auswählen, welche Meldungen gesendet werden: erfolgreiche Fütterung, nicht
  durchführbar und/oder Störung der Abschaltung.

Die **Winterpause-Erinnerungen** (falls aktiviert, siehe *Winterpause*) werden an dieselbe
Telegram-Instanz gesendet, unabhängig von diesen Überwachungs-Checkboxen.

Die vollständige Einrichtung steht unter [Telegram-Benachrichtigungen](#8-telegram-benachrichtigungen).

---

## 6. Objekte / Datenpunkte

Der Adapter legt folgende Datenpunkte in seinem Namespace an
(`automatic-feeder.<instanz>.`).

**Global**

| Datenpunkt | Typ | Bedeutung |
|------------|-----|-----------|
| `info.connection` | boolean (ro) | Adapter läuft und die Konfiguration ist gültig. |
| `sunrise` / `sunset` | string (ro) | Berechneter Sonnenauf-/-untergang für heute. |

**Pro Schalter unter `switches.<id>.`** (`<id>` ist eine interne ID wie `sw-0`)

Direkt unter dem Schalter liegen der manuelle Auslöser und zwei Unterrubriken:

* **`status`** (`switches.<id>.status.*`) – die schreibgeschützten Status-Datenpunkte, die unten aufgeführt sind.
* **`settings`** (`switches.<id>.settings.*`) – eine **beschreibbare** Spiegelung der Konfiguration dieses
  Schalters. Wird dort ein neuer Wert geschrieben (aus VIS oder einem Skript), ändert das die Konfiguration
  und startet die Instanz neu, damit die Änderung wirksam wird. Einige abgeleitete Felder sind
  schreibgeschützt (z. B. `winterWindow`).

| Datenpunkt | Typ | Bedeutung |
|------------|-----|-----------|
| `feedNow` | boolean (rw) | `true` schreiben, um manuell zu füttern. |
| `status.feedingActive` | boolean (ro) | Gerade läuft eine Fütterung. |
| `status.lastFeeding` | string (ro) | Zeitpunkt der letzten Fütterung. |
| `status.nextFeeding` | string (ro) | Zeitpunkt der nächsten geplanten Fütterung. |
| `status.blocked` | boolean (ro) | Der letzte Versuch war blockiert. |
| `status.blockReason` | string (ro) | Grund der Blockierung (Nacht / Temperatur / Sauerstoff). |
| `status.lastResult` | string (ro) | Ergebnistext des letzten Fütterungsversuchs. |
| `status.error` | boolean (ro) | Der letzte Versuch hatte eine Schaltstörung. |
| `status.winterActive` | boolean (ro) | Die Winterpause ist gerade aktiv. |
| `status.winterLastStartReminder` | string (ro) | Datum der zuletzt gesendeten „Winter beginnt"-Erinnerung. |
| `status.winterLastEndReminder` | string (ro) | Datum der zuletzt gesendeten „Winter endet"-Erinnerung. |
| `status.dynamicAvgTemperature` | number (ro) | Vom dynamischen Füttern verwendete gemittelte Temperatur. |
| `status.dynamicRate` | number (ro) | Aktuell vom dynamischen Füttern angewendeter Q10-Ratenfaktor. |
| `status.dynamicIntervalMin` | number (ro) | Aktuell berechnetes dynamisches Intervall (Minuten). |
| `status.dynamicDurationSec` | number (ro) | Aktuell berechnete dynamische Dauer (Sekunden). |
| `status.airTemperature` | number (ro) | Wert der eigenen Lufttemperatur-Quelle dieses Schalters. |
| `status.waterTemperature` | number (ro) | Wert der eigenen Wassertemperatur-Quelle dieses Schalters. |
| `status.oxygen` | number (ro) | Wert der eigenen Sauerstoff-Quelle dieses Schalters. |

Diese Datenpunkte lassen sich in VIS, Skripten oder anderen Adaptern nutzen – z. B. `status.nextFeeding`
auf einem Dashboard anzeigen oder bei `status.error = true` einen eigenen Alarm auslösen.

---

## 7. Beispiele / Rezepte

**Koi-Teich, zweimal täglich, nur bei genug Wärme**
* Modus *Feste Zeiten* → `08:00`, `18:00`; Dauer `6` s.
* Im Schalter-Tab unter *Temperatur- & Sauerstoffquellen* *Wassertemperatur* aktivieren und den
  Sensor wählen; dann *Nach Wassertemperatur sperren* → *Sperren wenn unter* `8` °C (keine
  Fütterung bei zu kaltem Wasser).
* *Nachts nicht füttern* ein.

**Voliere, häufige kleine Portionen tagsüber**
* Modus *Intervall innerhalb eines Zeitraums* → 07:00–19:00, Intervall `90` min; Dauer `3` s.

**Koi-Teich, temperaturangepasst (dynamisches Füttern)**
* Im Schalter-Tab unter *Temperatur- & Sauerstoffquellen* *Wassertemperatur* aktivieren und den Sensor wählen.
* Dann *Dynamisches Füttern* öffnen, aktivieren, Quelle *Wassertemperatur*.
* Referenz `20` °C, Q10 `2,2`, Basis-Intervall `60` min (Min `30`, Max `480`), Basis-Dauer `5` s
  (Min `2`, Max `15`). Es füttert dann bei Wärme häufiger und etwas mehr und bei Kälte weniger.

**Winterpause für den Teich**
* Im Schalter-Tab *Winterpause* öffnen, aktivieren, *Winterbeginn* `01.11` und *Winterende*
  `15.03` setzen, Modus *Fütterung aussetzen*.
* Optional die Erinnerungen ankreuzen, damit du ein paar Tage vor Beginn/Ende eine
  Telegram-Nachricht bekommst.

**Manuelle Extraportion per VIS-Button**
* In VIS einen Button anlegen, der `true` auf `automatic-feeder.0.switches.sw-0.feedNow` schreibt.
* Optional *Manueller Auslöser ignoriert alle Sperren* aktivieren, damit immer gefüttert wird.

---

## 8. Telegram-Benachrichtigungen

1. Den **telegram**-Adapter installieren und einrichten (Bot mit @BotFather erstellen, Token
   eintragen, Chat mit dem Bot starten). Die Telegram-Instanz muss **laufen**.
2. In einem automatic-feeder-**Schalter-Tab** den Abschnitt **Telegram-Benachrichtigungen** öffnen:
   * Die **Telegram-Instanz** im Dropdown auswählen (z. B. `telegram.0`).
   * Optional einen **Empfänger** eintragen (der im telegram-Adapter angezeigte Benutzer/Chat-Name);
     leer lassen, um alle zu benachrichtigen.
   * Die gewünschten Meldungen ankreuzen: *erfolgreiche Fütterung*, *nicht durchführbar*,
     *Störung Abschaltung*.
3. Speichern. Ab jetzt werden die gewählten Überwachungs-Ergebnisse an Telegram gesendet (mit dem
   Schalternamen davor). Voraussetzung ist, dass die *Schaltüberwachung* für diesen Schalter
   aktiviert ist.
4. Die **Winterpause-Erinnerungen** nutzen dieselbe Telegram-Instanz und denselben Empfänger. Sie
   werden im Abschnitt *Winterpause* gesteuert (Tage vor Beginn/Ende und die Erinnerungs-Uhrzeit)
   und benötigen **keine** aktivierte Überwachung.

---

## 9. Fehlerbehebung & FAQ

**Die Einstellungsseite ist leer / weiß.**
Den Browser mit **Strg+Shift+R** neu laden. Bleibt die Seite leer, die Instanz neu starten und
die Einstellungen erneut öffnen.

**Das neue Icon / eine Änderung erscheint nicht.**
Browser-Cache. Mit **Strg+Shift+R** hart neu laden.

**Es wird gar nicht gefüttert.**
Der Reihe nach prüfen: Schalter **Aktiv**; ein **Schalter-Objekt** ausgewählt; **Zeitplan**
gültig (`status.nextFeeding` zeigt eine Zeit); nicht **blockiert** (`status.blocked` / `status.blockReason` ansehen);
das **Sonnenfenster** schließt die Zeit nicht aus; das **Log-Level** der Instanz auf `debug`
setzen und das Log beobachten.

**Es wird nie nachts gefüttert, obwohl ich das möchte.**
Entweder *Nachts nicht füttern* für diesen Schalter deaktivieren oder die Sonnen-Offsets
anpassen. Ohne gültige Koordinaten ist die Nachtsperre deaktiviert (und es wird eine Warnung
geloggt).

**Die Überwachung meldet immer eine Störung.**
Dein Schalter-Objekt meldet vermutlich seinen Ist-Zustand nicht zurück (`ack=true`). Entweder
einen Schalter mit Statusrückmeldung verwenden oder die *Schaltüberwachung* für diesen Schalter
deaktivieren.

**Das dynamische Füttern ändert nichts.**
Stelle sicher, dass die gewählte Temperaturquelle (Wasser oder Luft) im Schalter-Tab
(*Temperatur- & Sauerstoffquellen*) aktiviert ist und Werte liefert. Direkt nach einem Neustart füllt sich der gleitende Mittelwert
erst, daher startet es mit den Basiswerten. Beobachte `status.dynamicAvgTemperature` und
`status.dynamicIntervalMin`.

**Das dynamische Füttern ist aktiviert, aber es wird nie gefüttert (`status.nextFeeding` ist leer).**
Das **Basis-Intervall oder das Max-Intervall ist 0** (oder das Zeitfenster ist ungültig), sodass kein Intervall berechnet werden kann – `status.blockReason` zeigt dann einen Hinweis. Setze ein Basis-Intervall und ein Max-Intervall größer als 0 (und ein gültiges Fenster). Hinweis: Bleiben *sowohl* Min- als auch Max-Intervall auf 0, wird das Ergebnis ebenfalls auf 0 gezwungen.

**Es wird nicht gefüttert, obwohl kein Winter ist (oder es füttert, obwohl es pausieren sollte).**
Prüfe die *Winterpause*-Daten (`Winterbeginn` / `Winterende`, Format tt.mm) und den Modus. Der
Datenpunkt `status.winterActive` zeigt, ob die Pause gerade aktiv ist.

**Die Adresssuche sagt, die Instanz müsse laufen.**
Die automatic-feeder-Instanz starten – das Geocoding läuft im Backend.

**Telegram-Nachrichten kommen nicht an.**
Ist im Schalter-Tab eine Telegram-Instanz ausgewählt? Ist der telegram-Adapter eingerichtet und
gestartet? Ist mindestens eine Meldungsart angekreuzt und die *Schaltüberwachung* aktiviert?

---

## 10. Logging & Fehlersuche

Der Adapter loggt auf den üblichen ioBroker-Stufen. Für detaillierte Meldungen das Log-Level der
Instanz (Instanzen → automatic-feeder.x → Log-Level) auf **debug** oder **silly** anheben:

* **error** – Fehler, die Aufmerksamkeit brauchen (z. B. Schreiben auf den Schalter
  fehlgeschlagen).
* **warn** – Fehlkonfiguration (keine Koordinaten, ungültiger Zeitplan …).
* **info** – Meilensteine (Start, eine Fütterung ausgeführt oder blockiert, manueller Auslöser).
* **debug** – detaillierter Ablauf (Planungsentscheidungen, Temperatur-Updates, Geocoding,
  Ein-/Aus-Werte, Verifikation bestätigt/Timeout).
* **silly** – sehr ausführliches Tracing (jeder Timer, jede Sperrprüfung, jede Zustandsänderung).

---

📖 [Hauptdokumentation (Englisch)](../../README.md)
