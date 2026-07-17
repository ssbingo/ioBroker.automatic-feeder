'use strict';

/*
 * Generates the German user handbook as a styled PDF:  doc/de/Handbuch.pdf
 *
 * Pure JS (pdfmake, no system tools). Run with:  npm run doc:handbook
 * IMPORTANT: keep the content in sync with the adapter on every change
 * (see the project rules – documentation is mandatory).
 */

const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'doc', 'de', 'Handbuch.pdf');
const VERSION = require(path.join(ROOT, 'io-package.json')).common.version;

// --- fonts (Roboto, bundled with pdfmake as base64) ---
const rawVfs = require('pdfmake/build/vfs_fonts');
const vfs = rawVfs.vfs || (rawVfs.pdfMake && rawVfs.pdfMake.vfs) || rawVfs;
const fonts = {
	Roboto: {
		normal: Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'),
		bold: Buffer.from(vfs['Roboto-Medium.ttf'], 'base64'),
		italics: Buffer.from(vfs['Roboto-Italic.ttf'], 'base64'),
		bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64'),
	},
};
const printer = new PdfPrinter(fonts);

// --- colour palette (modern, pond/garden green + orange accent) ---
const C = {
	primary: '#0F766E',
	primaryDark: '#0B5952',
	accent: '#F97316',
	text: '#1F2937',
	muted: '#6B7280',
	infoBg: '#ECFDF5',
	infoBar: '#0F766E',
	tipBg: '#FFF7ED',
	tipBar: '#F97316',
	warnBg: '#FEF2F2',
	warnBar: '#DC2626',
	tableHead: '#0F766E',
	tableAlt: '#F3F4F6',
	line: '#D1D5DB',
};

const PAGE_W = 595.28; // A4 width (pt)
const PAGE_H = 841.89; // A4 height (pt)

// --- adapter icon for the cover (optional) ---
let coverIcon = null;
try {
	const png = fs.readFileSync(path.join(ROOT, 'admin', 'automatic-feeder.png'));
	coverIcon = `data:image/png;base64,${png.toString('base64')}`;
} catch {
	coverIcon = null;
}

const DATE = new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });

// ----------------------------------------------------------------------------
// content helpers
// ----------------------------------------------------------------------------
let sectionNo = 0;

/**
 * Numbered top-level section heading (starts a new page, appears in the TOC).
 *
 * @param title
 */
function section(title) {
	sectionNo += 1;
	return {
		stack: [
			{
				text: [
					{ text: `${sectionNo}   `, color: C.accent, bold: true },
					{ text: title, color: C.primary, bold: true },
				],
				fontSize: 19,
				tocItem: true,
				tocStyle: { color: C.text, fontSize: 11 },
				tocNumberStyle: { color: C.accent, bold: true },
			},
			{
				canvas: [{ type: 'line', x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 2, lineColor: C.accent }],
				margin: [0, 4, 0, 10],
			},
		],
		pageBreak: 'before',
	};
}

/**
 * Sub-heading.
 *
 * @param title
 */
function sub(title) {
	return { text: title, color: C.primaryDark, bold: true, fontSize: 14, margin: [0, 12, 0, 4] };
}

/**
 * Sub-sub-heading.
 *
 * @param title
 */
function subsub(title) {
	return { text: title, color: C.text, bold: true, fontSize: 11.5, margin: [0, 8, 0, 2] };
}

/**
 * Body paragraph.
 *
 * @param text
 */
function p(text) {
	return { text, margin: [0, 0, 0, 6], lineHeight: 1.25 };
}

/**
 * Bullet list. Rich items (arrays of runs) are wrapped so they render inline.
 *
 * @param items
 */
function ul(items) {
	return {
		ul: items.map(it => (Array.isArray(it) ? { text: it } : it)),
		margin: [0, 0, 0, 8],
		lineHeight: 1.2,
	};
}

/**
 * Coloured call-out box (kind: info | tip | warn).
 *
 * @param kind
 * @param title
 * @param body
 */
function callout(kind, title, body) {
	const map = {
		info: { bg: C.infoBg, bar: C.infoBar, label: 'HINWEIS' },
		tip: { bg: C.tipBg, bar: C.tipBar, label: 'TIPP' },
		warn: { bg: C.warnBg, bar: C.warnBar, label: 'ACHTUNG' },
	};
	const m = map[kind] || map.info;
	const lines = [];
	if (title) {
		lines.push({
			text: [
				{ text: `${m.label}   `, bold: true, color: m.bar, fontSize: 8, characterSpacing: 1 },
				{ text: title, bold: true, color: m.bar },
			],
			margin: [0, 0, 0, 2],
		});
	}
	(Array.isArray(body) ? body : [body]).forEach(t => lines.push({ text: t, color: C.text, lineHeight: 1.2 }));
	return {
		table: { widths: ['*'], body: [[{ stack: lines, margin: [8, 6, 8, 6] }]] },
		layout: {
			fillColor: () => m.bg,
			hLineWidth: () => 0,
			vLineWidth: i => (i === 0 ? 3 : 0),
			vLineColor: () => m.bar,
		},
		margin: [0, 2, 0, 10],
	};
}

/**
 * Data-point / options table with a coloured header row.
 *
 * @param headers
 * @param rows
 * @param widths
 */
function table(headers, rows, widths) {
	const head = headers.map(h => ({
		text: h,
		bold: true,
		color: 'white',
		fillColor: C.tableHead,
		margin: [3, 3, 3, 3],
	}));
	const body = [head].concat(
		rows.map((r, ri) =>
			r.map(cell => ({
				text: cell,
				fillColor: ri % 2 ? C.tableAlt : null,
				margin: [3, 2, 3, 2],
				fontSize: 9,
			})),
		),
	);
	return {
		table: { headerRows: 1, widths: widths || headers.map(() => '*'), body },
		layout: {
			hLineWidth: () => 0.5,
			vLineWidth: () => 0,
			hLineColor: () => C.line,
		},
		fontSize: 9,
		margin: [0, 2, 0, 10],
	};
}

const code = t => ({ text: t, font: 'Roboto', color: C.primaryDark, bold: true });

// ----------------------------------------------------------------------------
// document content
// ----------------------------------------------------------------------------
const content = [];

// ---- cover (page 1) ----
content.push(
	{ text: '', margin: [0, 150, 0, 0] },
	coverIcon
		? { image: coverIcon, width: 110, alignment: 'center', margin: [0, 0, 0, 24] }
		: { text: '', margin: [0, 0, 0, 0] },
	{ text: 'Automatic Feeder', color: 'white', bold: true, fontSize: 40, alignment: 'center' },
	{ text: 'ioBroker-Adapter', color: 'white', fontSize: 16, alignment: 'center', margin: [0, 6, 0, 0] },
	{
		canvas: [{ type: 'line', x1: 187, y1: 0, x2: 407, y2: 0, lineWidth: 2, lineColor: '#FFFFFF' }],
		margin: [0, 18, 0, 18],
	},
	{ text: 'Benutzerhandbuch', color: 'white', fontSize: 22, alignment: 'center' },
	{ text: `Version ${VERSION}`, color: '#D1FAE5', fontSize: 12, alignment: 'center', margin: [0, 40, 0, 0] },
	{ text: `Stand: ${DATE}`, color: '#D1FAE5', fontSize: 11, alignment: 'center', margin: [0, 2, 0, 0] },
	{
		text: 'Zeitgesteuerter Futterautomat für Teich & Aquarium',
		color: '#A7F3D0',
		fontSize: 11,
		alignment: 'center',
		italics: true,
		margin: [0, 80, 0, 0],
	},
);

// ---- table of contents (page 2) ----
content.push({
	toc: {
		title: { text: 'Inhaltsverzeichnis', color: C.primary, bold: true, fontSize: 20, margin: [0, 0, 0, 12] },
	},
	pageBreak: 'before',
});

// ---- 1 Einleitung ----
content.push(
	section('Einleitung – was der Adapter macht'),
	p([
		'Der Adapter macht aus einem beliebigen bereits vorhandenen ioBroker-Schaltobjekt (z. B. einer WLAN-Steckdose, einem Relais oder einem Skript-Datenpunkt) einen ',
		{ text: 'zeitgesteuerten Futterautomaten', bold: true },
		'. Eine „Fütterung“ ist dabei ganz einfach: ',
		{
			text: 'einen Ausgang einschalten, eine einstellbare Anzahl Sekunden warten, dann wieder ausschalten',
			italics: true,
		},
		'. Bei einem umgebauten Futterautomaten dreht der laufende Motor in dieser Zeit die Futterportion heraus.',
	]),
	p([
		'Der Adapter verwaltet ',
		{ text: 'bis zu 5 Schalter', bold: true },
		' (Fütterungsstellen), jeder völlig unabhängig und mit einem eigenen, frei benannten Konfigurations-Tab. Pro Schalter legst du fest:',
	]),
	ul([
		[
			{ text: 'wann', bold: true },
			' gefüttert wird – zu festen Uhrzeiten (z. B. 08:00 und 18:00) oder in einem Intervall innerhalb eines Zeitfensters;',
		],
		[{ text: 'wie lange', bold: true }, ' der Ausgang eingeschaltet bleibt (Fütterungsdauer in Sekunden);'],
		[{ text: 'ob gesperrt wird', bold: true }, ', wenn die Wasser- oder Lufttemperatur zu niedrig/hoch ist;'],
		[
			{ text: 'ob auf den Tag beschränkt', bold: true },
			' wird (astronomisches Fenster: Sonnenauf-/-untergang mit Offsets – füttert nie nachts);',
		],
		[
			{ text: 'ob überwacht', bold: true },
			' wird, dass der Schalter wirklich ein- und ausschaltet, mit optionaler Meldung per Telegram und/oder Sayit;',
		],
		[{ text: 'ob im Winter', bold: true }, ' reduziert oder pausiert wird – optional mit Telegram-Erinnerungen;'],
		[
			{ text: 'ob dynamisch', bold: true },
			' gefüttert wird – Intervall und Portion passen sich automatisch der Temperatur an (Q10-Modell);',
		],
		[{ text: 'ob bei zu wenig Sauerstoff', bold: true }, ' (O2) gesperrt wird;'],
		[
			{ text: 'bis zu 3 einmalige Fütterungspausen', bold: true },
			' (z. B. Quarantäne nach Neubesatz) sowie ein sofortiger Not-Aus („Jetzt pausieren“).',
		],
	]),
	p([
		'Zusätzlich kannst du jederzeit ',
		{ text: 'manuell', bold: true },
		' füttern – über einen Button auf der Konfigurationsseite oder über einen Datenpunkt (z. B. eine Taste in einer VIS-Ansicht).',
	]),
	callout('info', 'Wichtig', [
		'Der Adapter erzeugt den Schalter niemals selbst. Er steuert ein Objekt, das in deinem ioBroker-System bereits existiert. Dieses Objekt wählst du in der Konfiguration aus.',
	]),
);

// ---- 2 Voraussetzungen ----
content.push(
	section('Voraussetzungen'),
	table(
		['Was', 'Wozu'],
		[
			[
				'Ein Schaltobjekt',
				'Ein beschreibbarer ioBroker-Datenpunkt, der den Automaten ein-/ausschaltet – z. B. eine Smart-Steckdose (shelly.0.…, sonoff.0.…, zigbee.0.…), ein Relais oder eine Skriptvariable.',
			],
			[
				'Koordinaten (Standort)',
				'Für die Berechnung von Sonnenauf-/-untergang (astronomisches Fenster). Aus den ioBroker-Systemeinstellungen, gemeinsam oder je Schalter.',
			],
			[
				'Temperatur-/O2-Quellen (optional)',
				'Vorhandene Datenpunkte (Zahl) für Wasser-/Lufttemperatur bzw. Sauerstoff, falls du Temperatur-/O2-Sperren oder dynamisches Füttern nutzen willst.',
			],
			[
				'Telegram / Sayit (optional)',
				'Eine installierte telegram- bzw. sayit-Instanz, wenn du Benachrichtigungen oder Sprachansagen möchtest.',
			],
		],
		['auto', '*'],
	),
	callout(
		'info',
		'Node.js',
		'Der Adapter benötigt Node.js >= 22 und einen aktuellen js-controller (>= 6.0.11) sowie Admin >= 7.6.20.',
	),
);

// ---- 3 Installation ----
content.push(
	section('Installation'),
	ul([
		'In ioBroker unter „Adapter“ nach „automatic-feeder“ suchen und installieren (bzw. über die eigene GitHub-URL hinzufügen).',
		'Eine Instanz anlegen. Die Konfigurationsseite öffnet sich automatisch.',
		'Standort prüfen, mindestens einen Schalter anlegen und dessen Zeitplan festlegen (siehe Schnellstart).',
	]),
	callout(
		'tip',
		'Tipp',
		'Beginne mit einem Test-Schaltobjekt (z. B. einer Boolean-Variablen) und kurzen Zeiten, um das Verhalten gefahrlos zu beobachten, bevor du den echten Automaten anschließt.',
	),
);

// ---- 4 Schnellstart ----
content.push(
	section('Schnellstart – die erste Fütterung'),
	ul([
		[
			'Tab ',
			{ text: 'Grundeinstellungen', bold: true },
			' öffnen und den ',
			{ text: 'Standort', bold: true },
			' festlegen (System, gemeinsam oder je Schalter).',
		],
		[
			'Im Abschnitt ',
			{ text: 'Schalter', bold: true },
			' auf ',
			{ text: 'Schalter hinzufügen', bold: true },
			' klicken, einen Namen vergeben und das zu schaltende Objekt auswählen.',
		],
		['Den neuen, nach dem Namen benannten ', { text: 'Schalter-Tab', bold: true }, ' öffnen.'],
		[
			'Unter ',
			{ text: 'Fütterungsplan', bold: true },
			' feste Zeiten (z. B. 08:00, 18:00) oder ein Intervall festlegen.',
		],
		['Unter ', { text: 'Fütterungsvorgang', bold: true }, ' die Dauer in Sekunden eintragen.'],
		[
			'Speichern. Fertig – der Adapter plant ab sofort die Fütterungen. Mit ',
			{ text: 'Jetzt füttern', bold: true },
			' lässt sich sofort testen.',
		],
	]),
);

// ---- 5 Einstellungsseite ----
content.push(
	section('Die Einstellungsseite im Detail'),
	sub('5.1  Grundeinstellungen'),
	subsub('Standort (für das astronomische Fenster)'),
	p('Der Standort liefert Sonnenauf- und -untergang. Drei Modi:'),
	ul([
		[
			{ text: 'Systemeinstellungen', bold: true },
			' – die Koordinaten aus den ioBroker-Systemeinstellungen für alle Schalter.',
		],
		[
			{ text: 'Gemeinsamer Standort', bold: true },
			' – ein einmal festgelegter Standort für alle Schalter (Adresssuche + Karte).',
		],
		[
			{ text: 'Je Schalter', bold: true },
			' – jeder Schalter definiert seinen Standort auf seinem eigenen Tab (Fütterungsstellen an verschiedenen Orten).',
		],
	]),
	p(
		'Die Sonnen-Offsets (Minuten nach Sonnenaufgang / vor Sonnenuntergang) werden je Schalter unter „Einschränkungen“ eingestellt.',
	),
	subsub('Schalter'),
	p(
		'Die Liste der Fütterungsstellen (max. 5). Pro Eintrag: Aktiv-Häkchen, Name (wird zum Tab-Titel), zu schaltendes Objekt sowie – wenn diese Fütterungsstelle die optionale Relaisplatine nutzt – der Schalter „Dieser Schalter nutzt die Automatic-Feeder-Relaisplatine“ (blendet den Relais-Tab ein).',
	),

	sub('5.2  Schalter-Tabs'),
	p('Jeder aktive Schalter hat einen eigenen Tab mit den folgenden Abschnitten:'),
	subsub('Manuelle Fütterung'),
	p(
		'Ein Button „Jetzt füttern“ mit frei wählbarer Dauer löst sofort eine Fütterung aus – ideal zum Testen oder für eine Extraportion.',
	),
	subsub('Fütterungsplan'),
	ul([
		[{ text: 'Feste Zeiten', bold: true }, ' – eine Liste von Uhrzeiten (HH:mm), täglich.'],
		[
			{ text: 'Intervall im Zeitfenster', bold: true },
			' – von/bis + Intervall in Minuten (z. B. alle 60 Min. zwischen 08:00 und 18:00).',
		],
	]),
	subsub('Fütterungsvorgang'),
	p(
		'Fütterungsdauer in Sekunden sowie – optional – die Werte für „Ein“ und „Aus“ (Standard true/false, passt für die meisten Steckdosen/Relais; für Zahlen oder Text hier anpassen).',
	),
	subsub('Temperatur- & Sauerstoffquellen'),
	p(
		'Ordne dieser Fütterungsstelle ihre eigenen Sensoren zu (Wasser flach, optional Wasser tief, Luft, Sauerstoff). Sie werden für Temperatursperren und dynamisches Füttern genutzt.',
	),
	subsub('Temperatursperre'),
	p(
		'Blockiert die Fütterung, wenn Wasser- oder Lufttemperatur unter/über frei wählbaren Grenzen liegt. Bei zwei Wassersensoren wird für die Sperre stets die kälteste Schicht verwendet.',
	),
	subsub('Dynamisches Füttern'),
	p(
		'Passt Intervall und Portion automatisch der Temperatur an (Q10-Modell). Mehr dazu in Abschnitt „Dynamisches Füttern – Hintergrund“.',
	),
	subsub('Einschränkungen'),
	p(
		'Astronomisches Fenster (nur tagsüber füttern) mit Sonnen-Offsets; Option, dass der manuelle Auslöser alle Sperren ignoriert.',
	),
	subsub('Winterpause'),
	p(
		'Wiederkehrende Saison, in der die Fütterung ausgesetzt, reduziert oder auf einmal täglich umgestellt wird – optional mit Telegram-Erinnerungen vor Beginn und Ende.',
	),
	subsub('Fütterungspausen'),
	p(
		'Bis zu 3 einmalige, absolute Pausen (z. B. Quarantäne) sowie ein Not-Aus-Schalter „Jetzt pausieren“, der alle Fütterungen sofort und unbegrenzt aussetzt.',
	),
	subsub('Schaltüberwachung'),
	p(
		'Prüft (per Rücklesen mit ack=true), ob der Schalter wirklich ein- und wieder ausschaltet, mit einstellbarem Timeout und mehreren gestaffelten Nachkontrollen. Ergebnis geht an Datenpunkte und – wenn gewählt – an Telegram/Sayit.',
	),
	subsub('Telegram-Benachrichtigungen'),
	p(
		'Instanz-Auswahl, optionaler Empfänger und drei Checkboxen (erfolgreiche Fütterung, nicht durchführbar, Abschaltstörung). Zusätzlich eine Nachrichtensprache, die für alle ausgehenden Texte (Telegram, Sayit, Ansage) gilt.',
	),
	subsub('Sayit-Benachrichtigungen'),
	p(
		'Sprachausgabe über eine sayit-Instanz – dieselben drei Meldungen wie bei Telegram (separat wählbar, beide Kanäle gleichzeitig möglich), optionale Lautstärke sowie ein Button „Ansage testen“ zum sofortigen Prüfen der Sprachausgabe.',
	),
	subsub('Fütterungsansage'),
	p(
		'Kündigt eine bevorstehende Fütterung eine einstellbare Zeit im Voraus an, per Telegram und/oder Sayit – z. B. „Achtung! Die nächste Fütterung beginnt in 5 Minuten. Die Fütterung wird ca. 8 Sekunden dauern.“ Die Ansage wird übersprungen, wenn die Fütterung zu diesem Zeitpunkt gesperrt oder pausiert wäre.',
	),

	sub('5.3  Relaisplatinen-Tab (optional)'),
	p(
		'Erscheint nur, wenn für den Schalter die Relaisplatine aktiviert ist. Hier stellst du die Adresse der Platine (IP oder mDNS, Port 80) ein, testest die Verbindung, liest/schreibst die drei Tasten-Fütterungszeiten S1–S3, kannst die Platine neu starten und siehst unten eine Systemübersicht (Firmware-Version und -Build, IP, WLAN, Signal, MAC, Betriebszeit, freier Speicher, letzter Neustartgrund in Worten).',
	),
);

// ---- 6 Objekte / Datenpunkte ----
content.push(
	section('Objekte / Datenpunkte'),
	p([
		'Der Adapter legt seine Datenpunkte unter ',
		code('automatic-feeder.<Instanz>.'),
		' an. Zeitstempel liegen in der lokalen Systemzeitzone vor; zusätzlich gibt es zu jedem Zeitstempel einen numerischen Zwilling mit Endung „…Ts“ (Unix-Zeit in Millisekunden) für VIS/Skripte.',
	]),
	sub('Global'),
	table(
		['Datenpunkt', 'Typ', 'Bedeutung'],
		[['info.connection', 'boolean (ro)', 'Adapter läuft und die Konfiguration ist gültig.']],
		['auto', 'auto', '*'],
	),
	sub('Je Schalter (switches.<id>.)'),
	table(
		['Datenpunkt', 'Typ', 'Bedeutung'],
		[
			['feedNow', 'boolean (rw)', 'true schreiben löst eine manuelle Fütterung aus.'],
			[
				'feedFor',
				'number (rw)',
				'Dauer in Sekunden schreiben löst genau eine Fütterung mit dieser Dauer aus (kein Neustart).',
			],
			['status.feedingActive', 'boolean (ro)', 'Es läuft gerade eine Fütterung.'],
			[
				'status.feedingEndsTs',
				'number (ro)',
				'Endzeit der laufenden Fütterung (ms, 0 = keine) – für Live-Countdown.',
			],
			['status.feedingDurationSec', 'number (ro)', 'Gesamtdauer der laufenden Fütterung (s, 0 = keine).'],
			['status.lastFeeding / …Ts', 'string/number (ro)', 'Zeitpunkt der letzten Fütterung.'],
			['status.nextFeeding / …Ts', 'string/number (ro)', 'Zeitpunkt der nächsten geplanten Fütterung.'],
			['status.blocked', 'boolean (ro)', 'Der letzte Versuch wurde blockiert.'],
			['status.blockReason / …Code', 'string (ro)', 'Grund der Blockade (Klartext bzw. stabiler Code).'],
			['status.lastResult', 'string (ro)', 'Ergebnistext des letzten Versuchs.'],
			['status.error', 'boolean (ro)', 'Der letzte Versuch hatte eine Schaltstörung.'],
			['status.winterActive', 'boolean (ro)', 'Die Winterpause ist gerade aktiv.'],
			['status.pauseManual / pauseActive', 'boolean (ro)', 'Not-Aus bzw. einmalige Pause aktiv.'],
			[
				'status.dynamic… (Rate/Interval/Duration/AvgTemperature)',
				'number (ro)',
				'Aktuelle Werte des dynamischen Fütterns.',
			],
			[
				'status.airTemperature / waterTemperature / …Deep / oxygen',
				'number (ro)',
				'Aktuelle Sensorwerte dieser Fütterungsstelle.',
			],
			['status.sunrise / sunset / …Ts', 'string/number (ro)', 'Berechneter Sonnenauf-/-untergang.'],
			[
				'relay.connected / info / active / remaining',
				'div. (ro)',
				'Status der Relaisplatine (nur wenn der Schalter eine nutzt).',
			],
			['settings.*', 'div. (rw)', 'Bearbeitbares Abbild der Konfiguration (aus VIS/Skript änderbar).'],
		],
		['*', 'auto', '*'],
	),
);

// ---- 7 Beispiele ----
content.push(
	section('Beispiele / Rezepte'),
	ul([
		[
			'„Nur tagsüber, zweimal täglich“: feste Zeiten 08:00 und 18:00, unter Einschränkungen das astronomische Fenster aktivieren.',
		],
		['„Alle 2 Stunden im Sommerfenster“: Intervall 120 Min. zwischen 08:00 und 20:00.'],
		['„Weniger füttern bei Kälte“: dynamisches Füttern aktivieren, Referenztemperatur und Q10 setzen.'],
		['„Sprachansage 5 Min. vorher“: Fütterungsansage aktivieren, Vorlaufzeit 5, Kanal Sayit.'],
		['„Quarantäne nach Neubesatz“: eine einmalige Fütterungspause über den entsprechenden Zeitraum setzen.'],
	]),
);

// ---- 8 Benachrichtigungen ----
content.push(
	section('Telegram- & Sayit-Benachrichtigungen'),
	p(
		'Beide Kanäle lassen sich je Schalter unabhängig konfigurieren und gleichzeitig nutzen. Die drei Überwachungsmeldungen (erfolgreiche Fütterung, nicht durchführbar, Abschaltstörung) werden getrennt an- oder abgewählt. Die Ausgabesprache legst du je Schalter fest (Systemsprache oder eine bestimmte).',
	),
	callout(
		'info',
		'Sayit-Lautstärke',
		'Die optionale Lautstärke wird in den State tts.volume der gewählten sayit-Instanz geschrieben. Ob sich die Lautstärke tatsächlich ändert, hängt vom Ausgabeziel der sayit-Instanz ab (Browser-Ausgabe berücksichtigt tts.volume je nach sayit-Version nicht).',
	),
);

// ---- 9 Fehlerbehebung ----
content.push(
	section('Fehlerbehebung & FAQ'),
	table(
		['Symptom', 'Ursache / Lösung'],
		[
			[
				'Es wird nicht gefüttert',
				'Schalter aktiv? Objekt gewählt? Konfiguration gespeichert? nextFeeding prüfen. Ggf. Sperre aktiv (blockReason).',
			],
			['„Jetzt füttern“ reagiert nicht', 'Instanz muss laufen und die Konfiguration gespeichert sein.'],
			[
				'Nachts wird gefüttert',
				'Astronomisches Fenster unter „Einschränkungen“ aktivieren; Standort/Koordinaten prüfen.',
			],
			[
				'Keine Telegram/Sayit-Nachricht',
				'Instanz gewählt und die passende Checkbox aktiv? Sprache/Empfänger korrekt?',
			],
			['Relais nicht erreichbar', 'IP/mDNS und Port 80 prüfen; Verbindung im Relais-Tab testen.'],
		],
		['auto', '*'],
	),
);

// ---- 10 Logging ----
content.push(
	section('Logging & Fehlersuche'),
	p(
		'Der Adapter nutzt die üblichen ioBroker-Loglevel. Für die Diagnose die Instanz auf „debug“ oder „silly“ stellen:',
	),
	ul([
		[{ text: 'error', bold: true }, ' – Fehler, die Aufmerksamkeit brauchen.'],
		[{ text: 'warn', bold: true }, ' – Fehlkonfiguration (keine Koordinaten, ungültiger Zeitplan …).'],
		[{ text: 'info', bold: true }, ' – Meilensteine (Start, Fütterung ausgeführt/blockiert, manueller Auslöser).'],
		[
			{ text: 'debug', bold: true },
			' – detaillierter Ablauf (Planung, Temperatur-Updates, Ein-/Aus-Werte, Verifikation).',
		],
		[{ text: 'silly', bold: true }, ' – sehr ausführliches Tracing (jeder Timer, jede Sperrprüfung).'],
	]),
);

// ---- 11 Dynamisches Füttern ----
content.push(
	section('Dynamisches Füttern – Hintergrund'),
	p(
		'Fische (Koi, Goldfisch, Teichkarpfen) sind wechselwarm: ihr Stoffwechsel folgt der Wassertemperatur. Grob verdoppelt sich die Stoffwechselrate pro +10 °C – genau das ist der Q10-Koeffizient (typisch 2–3), den der Adapter verwendet. Bei Wärme häufiger/etwas mehr, bei Kälte weniger zu füttern ist daher physiologisch begründet.',
	),
	table(
		['Wassertemperatur', 'Empfehlung'],
		[
			['unter ~4–5 °C', 'nicht füttern (Winterpause nutzen).'],
			['~4–10 °C', 'kaum aktiv; selten, leicht verdauliches Futter.'],
			['~10–15 °C', 'reduziert füttern; Immunsystem noch schwach.'],
			['~15–25 °C', 'optimaler Wachstumsbereich, volle Fütterung.'],
			['über ~28 °C', 'Sauerstoff wird limitierend; O2-Sperre nützlich.'],
		],
		['auto', '*'],
	),
	callout(
		'info',
		'Hinweis',
		'Diese Werte sind allgemeine Richtwerte für Koi/Teichfische und kein Ersatz für die Beobachtung der eigenen Tiere. Passe Referenztemperatur, Q10, Grenzen und Schwellwerte an deine Art und dein Setup an.',
	),
);

// ---- 12 Relais-Platine Parallelprojekt ----
content.push(
	section('Feeder-Relais-Platine (Parallelprojekt)'),
	callout('tip', 'Passende Hardware entsteht parallel', [
		'Zur optimalen Nutzung des Adapters entsteht in einem separaten Projekt parallel die „Automatic-Feeder-Relais“-Platine – ein ESP32 mit drei bedienbaren Timer-Tasten (S1–S3), eigener Weboberfläche und einer HTTP-API (Port 80).',
		'Ist die Platine vorhanden, kann sie je Schalter im Relais-Tab eingebunden werden (siehe Abschnitt 5.3): Verbindung testen, Tastenzeiten S1–S3 lesen/schreiben, Platine neu starten und Systemdaten einsehen.',
	]),
	p(
		'Der Adapter funktioniert vollständig auch ohne diese Platine – sie ist eine optionale, komfortable Ergänzung. Da sie eigenständig weiterentwickelt wird, können sich Details der Platine unabhängig vom Adapter ändern.',
	),
);

// ---- 13 Weitere Infos ----
content.push(
	section('Weitere Informationen'),
	p(
		'Ausführliche, stets aktuelle Online-Dokumentation und Changelog findest du im Repository und in den mitgelieferten README-Dateien (in 11 Sprachen). Bei Fragen oder Fehlern hilft das Log der Instanz (Level „debug“).',
	),
	callout(
		'info',
		'Dieses Handbuch',
		`Automatic Feeder – Benutzerhandbuch, Version ${VERSION}. Es wird bei jeder Änderung des Adapters mitgepflegt.`,
	),
);

// ----------------------------------------------------------------------------
// document definition
// ----------------------------------------------------------------------------
const docDefinition = {
	pageSize: 'A4',
	pageMargins: [40, 48, 40, 48],
	info: {
		title: `Automatic Feeder – Handbuch ${VERSION}`,
		author: 'ssbingo',
		subject: 'ioBroker-Adapter automatic-feeder',
	},
	defaultStyle: { font: 'Roboto', fontSize: 10.5, color: C.text, lineHeight: 1.2 },
	background: currentPage =>
		currentPage === 1 ? [{ canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE_W, h: PAGE_H, color: C.primary }] }] : null,
	footer: (currentPage, pageCount) =>
		currentPage === 1
			? null
			: {
					margin: [40, 6, 40, 0],
					stack: [
						{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: C.line }] },
						{
							columns: [
								{ text: 'Automatic Feeder – Handbuch', color: C.muted, fontSize: 8 },
								{
									text: `Seite ${currentPage} / ${pageCount}`,
									color: C.muted,
									fontSize: 8,
									alignment: 'right',
								},
							],
							margin: [0, 4, 0, 0],
						},
					],
				},
	content,
};

const pdf = printer.createPdfKitDocument(docDefinition);
const stream = fs.createWriteStream(OUT);
pdf.pipe(stream);
pdf.end();
stream.on('finish', () => {
	const kb = Math.round(fs.statSync(OUT).size / 1024);
	console.log(`Handbuch erstellt: ${path.relative(ROOT, OUT)} (${kb} KB), Version ${VERSION}`);
});
