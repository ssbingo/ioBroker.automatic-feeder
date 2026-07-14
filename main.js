'use strict';

/*
 * ioBroker.automatic-feeder
 * Controls up to 5 user selected switches (existing ioBroker states) on a time
 * schedule for a configurable duration ("feeding"). Optionally evaluates air/water
 * temperature and the sun position (so it never feeds at night).
 *
 * Logging levels used (configurable per instance in the ioBroker admin):
 *   error  - failures that need attention (write failed, unexpected exception)
 *   warn   - misconfiguration / recoverable problems (no coordinates, invalid schedule)
 *   info   - operational milestones (startup, a feeding executed/blocked, manual trigger)
 *   debug  - detailed flow (config, scheduling decisions, temperature updates, geocoding)
 *   silly  - very verbose tracing (every timer, every block check, every state change)
 */

const utils = require('@iobroker/adapter-core');
const SunCalc = require('suncalc');
const { translate, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('./lib/messages');
const {
	isInWinterPause,
	reminderDue,
	nextMDDate,
	q10Rate,
	q10IntervalMin,
	q10DurationSec,
	averageOver,
	nextSlotInWindow,
	combineWaterTemp,
	pauseInfo,
	nextPauseBoundary,
} = require('./lib/schedule');

const MAX_SWITCHES = 5;

// --- absolute safety bounds enforced in code (independent of any UI limits) ---
/** Largest delay Node's setTimeout accepts without overflowing (~24.8 days). */
const MAX_TIMEOUT_MS = 2147483647;
/** Upper bound for a single feeding duration (seconds). */
const MAX_DURATION_SEC = 3600;
/** Upper bound for the switching-supervision timeout (seconds). */
const MAX_VERIFY_TIMEOUT_SEC = 300;
/** Upper bound for any feeding interval (minutes) fed into the scheduler. */
const MAX_INTERVAL_MIN = 1440;
/** Timeout for the Nominatim geocoding request (milliseconds). */
const GEOCODE_TIMEOUT_MS = 10000;
/** Timeout for a single HTTP request to an Automatic-Feeder relay board (milliseconds). */
const RELAY_TIMEOUT_MS = 5000;
/** How often the relay boards are polled for their connection status (milliseconds). */
const RELAY_POLL_MS = 60000;
/** Lower/upper bound for a relay-board button feeding time (seconds); enforced by the board too. */
const RELAY_TIME_MIN_SEC = 1;
const RELAY_TIME_MAX_SEC = 600;

/** Read-only status states that live under `switches.<id>.status.*` (used for cleanup of legacy flat states). */
const STATUS_STATE_IDS = [
	'feedingActive',
	'feedingEndsTs',
	'feedingDurationSec',
	'lastFeeding',
	'lastFeedingTs',
	'nextFeeding',
	'nextFeedingTs',
	'blocked',
	'blockReason',
	'blockReasonCode',
	'lastResult',
	'error',
	'winterActive',
	'winterLastStartReminder',
	'winterLastEndReminder',
	'pauseManual',
	'pauseActive',
	'pauseActiveUntil',
	'pauseActiveUntilTs',
	'dynamicAvgTemperature',
	'dynamicRate',
	'dynamicIntervalMin',
	'dynamicDurationSec',
	'airTemperature',
	'waterTemperature',
	'waterTemperatureDeep',
	'waterStratification',
	'oxygen',
	'sunrise',
	'sunriseTs',
	'sunset',
	'sunsetTs',
];

/** Settings mirror entries that are composite/derived and stay read-only (not editable from VIS). */
const SETTINGS_READONLY = new Set(['winterWindow']);

/** Numeric settings that may be null (empty = "no limit"). */
const NULLABLE_SETTINGS = new Set(['waterMin', 'waterMax', 'airMin', 'airMax', 'o2Min']);

/**
 * Absolute [min, max] bounds for non-nullable numeric settings, enforced on the
 * config-write path (applyOneSetting) so values written via the settings.* states
 * from VIS/scripts cannot bypass the UI clamps and stay within a sane range.
 */
const NUMERIC_BOUNDS = {
	durationSec: [0, MAX_DURATION_SEC],
	manualDurationSec: [0, MAX_DURATION_SEC],
	winterDurationSec: [0, MAX_DURATION_SEC],
	dynamicBaseDurationSec: [0, MAX_DURATION_SEC],
	dynamicMinDurationSec: [0, MAX_DURATION_SEC],
	dynamicMaxDurationSec: [0, MAX_DURATION_SEC],
	intervalMin: [0, MAX_INTERVAL_MIN],
	winterIntervalMin: [0, MAX_INTERVAL_MIN],
	dynamicBaseIntervalMin: [0, MAX_INTERVAL_MIN],
	dynamicMinIntervalMin: [0, MAX_INTERVAL_MIN],
	dynamicMaxIntervalMin: [0, MAX_INTERVAL_MIN],
	verifyTimeoutSec: [1, MAX_VERIFY_TIMEOUT_SEC],
	verifyRetries: [1, 10],
	winterReminderHour: [0, 23],
	winterStartReminderDays: [0, 366],
	winterEndReminderDays: [0, 366],
	dynamicBufferHours: [0, 168],
	dynamicHysteresisPct: [0, 100],
	dynamicQ10: [0, 10],
	sunOffsetMorning: [0, 720],
	sunOffsetEvening: [0, 720],
	waterSeasonalThresholdC: [0, 40],
};

/**
 * Per-switch default values (mirrors the admin `createSwitch`, without the id).
 * Switches created by older adapter versions are missing the fields that were
 * added later (e.g. the dynamic-feeding parameters). Those missing fields are
 * backfilled from here on start (see {@link AutomaticFeeder.migrateSwitchDefaults})
 * so an old switch behaves exactly like a freshly created one instead of reading
 * the missing numbers as 0 (which would make dynamic feeding compute a 0 interval).
 */
const SWITCH_DEFAULTS = {
	enabled: true,
	objectId: '',
	onValue: true,
	offValue: false,
	durationSec: 5,
	mode: 'times',
	times: ['08:00'],
	windowStart: '08:00',
	windowEnd: '18:00',
	intervalMin: 60,
	blockWaterEnabled: false,
	waterMin: null,
	waterMax: null,
	blockAirEnabled: false,
	airMin: null,
	airMax: null,
	astroWindowEnabled: false,
	sunOffsetMorning: 0,
	sunOffsetEvening: 0,
	coordinateSource: 'system',
	latitude: '',
	longitude: '',
	address: '',
	manualIgnoresBlocks: false,
	verifyEnabled: true,
	verifyTimeoutSec: 5,
	verifyRetries: 3,
	telegramInstance: '',
	telegramUser: '',
	notifySuccess: false,
	notifyOnFail: true,
	notifyOffFail: true,
	manualDurationSec: 5,
	winterEnabled: false,
	winterStart: '11-01',
	winterEnd: '03-15',
	winterMode: 'suspend',
	winterIntervalMin: 240,
	winterTime: '12:00',
	winterDurationSec: 5,
	winterStartReminderEnabled: false,
	winterStartReminderDays: 7,
	winterEndReminderEnabled: false,
	winterEndReminderDays: 7,
	winterReminderHour: 9,
	pauseNow: false,
	pause1Enabled: false,
	pause1Start: '',
	pause1End: '',
	pause2Enabled: false,
	pause2Start: '',
	pause2End: '',
	pause3Enabled: false,
	pause3Start: '',
	pause3End: '',
	dynamicEnabled: false,
	dynamicSource: 'water',
	dynamicTRef: 20,
	dynamicQ10: 2.2,
	dynamicBaseIntervalMin: 60,
	dynamicMinIntervalMin: 30,
	dynamicMaxIntervalMin: 480,
	dynamicBaseDurationSec: 5,
	dynamicMinDurationSec: 2,
	dynamicMaxDurationSec: 15,
	dynamicBufferHours: 24,
	dynamicHysteresisPct: 15,
	blockO2Enabled: false,
	o2Min: null,
	airTempEnabled: false,
	airTempObjectId: '',
	waterTempEnabled: false,
	waterTempObjectId: '',
	waterTemp2Enabled: false,
	waterTemp2ObjectId: '',
	waterCombineMode: 'shallow',
	waterSeasonalThresholdC: 12,
	o2Enabled: false,
	o2ObjectId: '',
};

/**
 * Formats a recurring "MM-DD" as "DD.MM" for display.
 *
 * @param {string} md - recurring date "MM-DD"
 * @returns {string} "DD.MM" or "" if invalid
 */
function mdToDotMM(md) {
	const m = typeof md === 'string' && md.match(/^(\d{1,2})-(\d{1,2})$/);
	if (!m) {
		return '';
	}
	return `${String(Number(m[2])).padStart(2, '0')}.${String(Number(m[1])).padStart(2, '0')}`;
}

/**
 * Maps a descriptor type string to the matching ioBroker common type (kept as
 * literals so the type checker accepts it without a cast).
 *
 * @param {string} t - descriptor type ("string" | "number" | "boolean")
 * @returns {ioBroker.CommonType} the ioBroker common type
 */
function asCommonType(t) {
	if (t === 'number') {
		return 'number';
	}
	if (t === 'boolean') {
		return 'boolean';
	}
	return 'string';
}

/**
 * Maps a read-only display role to its writable counterpart. The repository
 * checker (E1011) requires `common.write = false` for the read-only roles
 * `value`, `value.temperature` and `indicator`; the editable settings mirror
 * uses the writable equivalents instead (`level`, `level.temperature`, `switch`).
 * `text` and any other role are already write-friendly and stay unchanged.
 *
 * @param {string} role - the descriptor's read-only role
 * @returns {string} the writable role to use for an editable state
 */
function writableRole(role) {
	if (role === 'value.temperature') {
		return 'level.temperature';
	}
	if (role === 'value') {
		return 'level';
	}
	if (role === 'indicator') {
		return 'switch';
	}
	return role;
}

/**
 * Editable mirror of the per-switch configuration, exposed under
 * `switches.<id>.settings.*` so the settings are visible in the object tree / VIS.
 * Writing a value there applies it to the instance config (see the settings-write
 * handling in {@link AutomaticFeeder.onStateChange}); composite/derived entries in
 * {@link SETTINGS_READONLY} stay read-only.
 */
const SWITCH_SETTINGS = [
	{ id: 'name', name: 'Name', type: 'string', role: 'text', get: sw => sw.name || '' },
	{ id: 'enabled', name: 'Active', type: 'boolean', role: 'indicator', get: sw => !!sw.enabled },
	{ id: 'objectId', name: 'Switch object id', type: 'string', role: 'text', get: sw => sw.objectId || '' },
	{ id: 'onValue', name: 'On value', type: 'string', role: 'text', get: sw => String(sw.onValue ?? true) },
	{ id: 'offValue', name: 'Off value', type: 'string', role: 'text', get: sw => String(sw.offValue ?? false) },
	{
		id: 'durationSec',
		name: 'Feeding duration',
		type: 'number',
		role: 'value',
		unit: 's',
		get: sw => Number(sw.durationSec) || 0,
	},
	{ id: 'mode', name: 'Schedule mode', type: 'string', role: 'text', get: sw => sw.mode || 'times' },
	{
		id: 'times',
		name: 'Fixed times',
		type: 'string',
		role: 'text',
		get: sw => (Array.isArray(sw.times) ? sw.times.join(', ') : ''),
	},
	{ id: 'windowStart', name: 'Interval window start', type: 'string', role: 'text', get: sw => sw.windowStart || '' },
	{ id: 'windowEnd', name: 'Interval window end', type: 'string', role: 'text', get: sw => sw.windowEnd || '' },
	{
		id: 'intervalMin',
		name: 'Interval',
		type: 'number',
		role: 'value',
		unit: 'min',
		get: sw => Number(sw.intervalMin) || 0,
	},
	{
		id: 'blockWaterEnabled',
		name: 'Block by water temperature',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.blockWaterEnabled,
	},
	{
		id: 'waterMin',
		name: 'Water temperature min',
		type: 'number',
		role: 'value.temperature',
		unit: '°C',
		get: sw => sw.waterMin ?? null,
	},
	{
		id: 'waterMax',
		name: 'Water temperature max',
		type: 'number',
		role: 'value.temperature',
		unit: '°C',
		get: sw => sw.waterMax ?? null,
	},
	{
		id: 'blockAirEnabled',
		name: 'Block by air temperature',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.blockAirEnabled,
	},
	{
		id: 'airMin',
		name: 'Air temperature min',
		type: 'number',
		role: 'value.temperature',
		unit: '°C',
		get: sw => sw.airMin ?? null,
	},
	{
		id: 'airMax',
		name: 'Air temperature max',
		type: 'number',
		role: 'value.temperature',
		unit: '°C',
		get: sw => sw.airMax ?? null,
	},
	{
		id: 'astroWindowEnabled',
		name: 'Astronomical window (sunrise/sunset)',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.astroWindowEnabled,
	},
	{
		id: 'sunOffsetMorning',
		name: 'Minutes after sunrise',
		type: 'number',
		role: 'value',
		unit: 'min',
		get: sw => Number(sw.sunOffsetMorning) || 0,
	},
	{
		id: 'sunOffsetEvening',
		name: 'Minutes before sunset',
		type: 'number',
		role: 'value',
		unit: 'min',
		get: sw => Number(sw.sunOffsetEvening) || 0,
	},
	{
		id: 'coordinateSource',
		name: 'Location source',
		type: 'string',
		role: 'text',
		get: sw => sw.coordinateSource || 'system',
	},
	{ id: 'latitude', name: 'Latitude', type: 'string', role: 'text', get: sw => sw.latitude || '' },
	{ id: 'longitude', name: 'Longitude', type: 'string', role: 'text', get: sw => sw.longitude || '' },
	{
		id: 'manualIgnoresBlocks',
		name: 'Manual trigger ignores all blocks',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.manualIgnoresBlocks,
	},
	{
		id: 'verifyEnabled',
		name: 'Supervision enabled',
		type: 'boolean',
		role: 'indicator',
		get: sw => sw.verifyEnabled !== false,
	},
	{
		id: 'verifyTimeoutSec',
		name: 'Verification timeout',
		type: 'number',
		role: 'value',
		unit: 's',
		get: sw => Number(sw.verifyTimeoutSec) || 5,
	},
	{
		id: 'verifyRetries',
		name: 'Verification attempts',
		type: 'number',
		role: 'value',
		get: sw => Number(sw.verifyRetries) || 3,
	},
	{
		id: 'telegramInstance',
		name: 'Telegram instance',
		type: 'string',
		role: 'text',
		get: sw => sw.telegramInstance || '',
	},
	{ id: 'telegramUser', name: 'Telegram recipient', type: 'string', role: 'text', get: sw => sw.telegramUser || '' },
	{
		id: 'notifySuccess',
		name: 'Notify on success',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.notifySuccess,
	},
	{
		id: 'notifyOnFail',
		name: 'Notify on could-not-feed',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.notifyOnFail,
	},
	{
		id: 'notifyOffFail',
		name: 'Notify on switch-off fault',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.notifyOffFail,
	},
	{
		id: 'manualDurationSec',
		name: 'Manual feeding duration',
		type: 'number',
		role: 'value',
		unit: 's',
		get: sw => Number(sw.manualDurationSec) || 0,
	},
	{
		id: 'winterEnabled',
		name: 'Winter pause enabled',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.winterEnabled,
	},
	{
		id: 'winterWindow',
		name: 'Winter pause window (dd.mm)',
		type: 'string',
		role: 'text',
		get: sw => (sw.winterStart && sw.winterEnd ? `${mdToDotMM(sw.winterStart)} - ${mdToDotMM(sw.winterEnd)}` : ''),
	},
	{ id: 'winterMode', name: 'Winter mode', type: 'string', role: 'text', get: sw => sw.winterMode || 'suspend' },
	{
		id: 'winterIntervalMin',
		name: 'Winter interval',
		type: 'number',
		role: 'value',
		unit: 'min',
		get: sw => Number(sw.winterIntervalMin) || 0,
	},
	{ id: 'winterTime', name: 'Winter feeding time', type: 'string', role: 'text', get: sw => sw.winterTime || '' },
	{
		id: 'winterDurationSec',
		name: 'Winter feeding duration',
		type: 'number',
		role: 'value',
		unit: 's',
		get: sw => Number(sw.winterDurationSec) || 0,
	},
	{
		id: 'winterStartReminderEnabled',
		name: 'Remind before winter start',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.winterStartReminderEnabled,
	},
	{
		id: 'winterStartReminderDays',
		name: 'Days before winter start',
		type: 'number',
		role: 'value',
		unit: 'd',
		get: sw => Number(sw.winterStartReminderDays) || 0,
	},
	{
		id: 'winterEndReminderEnabled',
		name: 'Remind before winter end',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.winterEndReminderEnabled,
	},
	{
		id: 'winterEndReminderDays',
		name: 'Days before winter end',
		type: 'number',
		role: 'value',
		unit: 'd',
		get: sw => Number(sw.winterEndReminderDays) || 0,
	},
	{
		id: 'winterReminderHour',
		name: 'Winter reminder hour',
		type: 'number',
		role: 'value',
		unit: 'h',
		get: sw => Number(sw.winterReminderHour) || 0,
	},
	{
		id: 'pauseNow',
		name: 'Suspend feeding now (master pause)',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.pauseNow,
	},
	{
		id: 'pause1Enabled',
		name: 'Feeding pause 1 enabled',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.pause1Enabled,
	},
	{ id: 'pause1Start', name: 'Feeding pause 1 start', type: 'string', role: 'text', get: sw => sw.pause1Start || '' },
	{ id: 'pause1End', name: 'Feeding pause 1 end', type: 'string', role: 'text', get: sw => sw.pause1End || '' },
	{
		id: 'pause2Enabled',
		name: 'Feeding pause 2 enabled',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.pause2Enabled,
	},
	{ id: 'pause2Start', name: 'Feeding pause 2 start', type: 'string', role: 'text', get: sw => sw.pause2Start || '' },
	{ id: 'pause2End', name: 'Feeding pause 2 end', type: 'string', role: 'text', get: sw => sw.pause2End || '' },
	{
		id: 'pause3Enabled',
		name: 'Feeding pause 3 enabled',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.pause3Enabled,
	},
	{ id: 'pause3Start', name: 'Feeding pause 3 start', type: 'string', role: 'text', get: sw => sw.pause3Start || '' },
	{ id: 'pause3End', name: 'Feeding pause 3 end', type: 'string', role: 'text', get: sw => sw.pause3End || '' },
	{
		id: 'dynamicEnabled',
		name: 'Dynamic feeding enabled',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.dynamicEnabled,
	},
	{
		id: 'dynamicSource',
		name: 'Dynamic temperature source',
		type: 'string',
		role: 'text',
		get: sw => sw.dynamicSource || 'water',
	},
	{
		id: 'dynamicTRef',
		name: 'Dynamic reference temperature',
		type: 'number',
		role: 'value.temperature',
		unit: '°C',
		get: sw => Number(sw.dynamicTRef) || 0,
	},
	{
		id: 'dynamicQ10',
		name: 'Dynamic Q10 coefficient',
		type: 'number',
		role: 'value',
		get: sw => Number(sw.dynamicQ10) || 0,
	},
	{
		id: 'dynamicBaseIntervalMin',
		name: 'Dynamic base interval',
		type: 'number',
		role: 'value',
		unit: 'min',
		get: sw => Number(sw.dynamicBaseIntervalMin) || 0,
	},
	{
		id: 'dynamicMinIntervalMin',
		name: 'Dynamic min interval',
		type: 'number',
		role: 'value',
		unit: 'min',
		get: sw => Number(sw.dynamicMinIntervalMin) || 0,
	},
	{
		id: 'dynamicMaxIntervalMin',
		name: 'Dynamic max interval',
		type: 'number',
		role: 'value',
		unit: 'min',
		get: sw => Number(sw.dynamicMaxIntervalMin) || 0,
	},
	{
		id: 'dynamicBaseDurationSec',
		name: 'Dynamic base duration',
		type: 'number',
		role: 'value',
		unit: 's',
		get: sw => Number(sw.dynamicBaseDurationSec) || 0,
	},
	{
		id: 'dynamicMinDurationSec',
		name: 'Dynamic min duration',
		type: 'number',
		role: 'value',
		unit: 's',
		get: sw => Number(sw.dynamicMinDurationSec) || 0,
	},
	{
		id: 'dynamicMaxDurationSec',
		name: 'Dynamic max duration',
		type: 'number',
		role: 'value',
		unit: 's',
		get: sw => Number(sw.dynamicMaxDurationSec) || 0,
	},
	{
		id: 'dynamicBufferHours',
		name: 'Dynamic averaging window',
		type: 'number',
		role: 'value',
		unit: 'h',
		get: sw => Number(sw.dynamicBufferHours) || 0,
	},
	{
		id: 'dynamicHysteresisPct',
		name: 'Dynamic hysteresis',
		type: 'number',
		role: 'value',
		unit: '%',
		get: sw => Number(sw.dynamicHysteresisPct) || 0,
	},
	{
		id: 'blockO2Enabled',
		name: 'Block by oxygen',
		type: 'boolean',
		role: 'indicator',
		get: sw => !!sw.blockO2Enabled,
	},
	{ id: 'o2Min', name: 'Oxygen minimum', type: 'number', role: 'value', get: sw => sw.o2Min ?? null },
	{
		id: 'airTempObjectId',
		name: 'Air temperature source',
		type: 'string',
		role: 'text',
		get: sw => (sw.airTempEnabled ? sw.airTempObjectId || '' : ''),
	},
	{
		id: 'waterTempObjectId',
		name: 'Water temperature source',
		type: 'string',
		role: 'text',
		get: sw => (sw.waterTempEnabled ? sw.waterTempObjectId || '' : ''),
	},
	{
		id: 'waterTemp2ObjectId',
		name: 'Water temperature source (deep)',
		type: 'string',
		role: 'text',
		get: sw => (sw.waterTemp2Enabled ? sw.waterTemp2ObjectId || '' : ''),
	},
	{
		id: 'waterCombineMode',
		name: 'Water sensor combine mode',
		type: 'string',
		role: 'text',
		get: sw => sw.waterCombineMode || 'shallow',
	},
	{
		id: 'waterSeasonalThresholdC',
		name: 'Seasonal switch threshold',
		type: 'number',
		role: 'value.temperature',
		unit: '°C',
		get: sw => Number(sw.waterSeasonalThresholdC) || 0,
	},
	{
		id: 'o2ObjectId',
		name: 'Oxygen source',
		type: 'string',
		role: 'text',
		get: sw => (sw.o2Enabled ? sw.o2ObjectId || '' : ''),
	},
];

class AutomaticFeeder extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
	 */
	constructor(options) {
		super({
			...options,
			name: 'automatic-feeder',
		});

		/** next-feeding timer per switch id */
		this.scheduleTimers = new Map();
		this.midnightTimer = null;
		/** hourly tick that sends winter-pause reminders */
		this.reminderTimer = null;
		/** debounced settings writes from VIS: switch id -> { key: { val, type } } */
		this.pendingSettingWrites = new Map();
		this.settingsWriteTimer = null;
		/** per-switch timer that fires at the next feeding-pause boundary (start/end) */
		this.pauseTimers = new Map();
		/** self-rescheduling timer that polls the relay boards for their connection status */
		this.relayTimer = null;
		/** last known "feeding paused" state per switch id (to detect start/end transitions) */
		this.pauseActiveState = new Map();

		/** pending switch-state verifications: objectId -> { expected, resolve, timer } */
		this.verifyWatchers = new Map();
		/** switch ids that currently have an active feeding cycle (overlap guard) */
		this.feedingBusy = new Set();
		/** set during onUnload so in-flight feeding cycles abort cleanly */
		this.terminating = false;

		/** resolved coordinates per switch id -> { lat, lon } (astronomical window). */
		this.switchCoords = new Map();
		/** effective astronomical feeding window per switch id -> { start, end }. */
		this.switchWindows = new Map();
		// sources are per switch; we subscribe to the union of referenced foreign
		// objects and keep the current value (and, for temperatures, a rolling buffer)
		// keyed by object id. null = unknown.
		this.foreignValues = new Map();
		this.foreignBuffers = new Map();
		this.tempObjectIds = new Set();
		this.o2ObjectIds = new Set();
		/** source object ids for which an "ack=false" hint has already been logged (once each) */
		this.unackedSources = new Set();
		// longest sample window we need to keep (ms); set in setupSources
		this.maxBufferMs = 24 * 3600000;
		// last dynamic interval (minutes) applied per switch id (hysteresis reference)
		this.dynamicAppliedInterval = new Map();

		this.switches = [];

		// message language for user-facing texts (lastResult + Telegram);
		// resolved from the ioBroker system language in onReady, English fallback
		this.lang = DEFAULT_LANGUAGE;

		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Readable label for a switch, used in log messages.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {string} formatted label like `"Koi-Teich" (sw-0)`
	 */
	swLabel(sw) {
		return `"${sw.name || sw.id}" (${sw.id})`;
	}

	/**
	 * Friendly local "dd.mm. HH:MM" for a Date (used in debug logs alongside the ISO value).
	 *
	 * @param {Date} date - the date to format
	 * @returns {string} the local time string, or "n/a" for an invalid date
	 */
	localTimeStr(date) {
		if (!(date instanceof Date) || isNaN(date.getTime())) {
			return 'n/a';
		}
		const p = n => String(n).padStart(2, '0');
		return `${p(date.getDate())}.${p(date.getMonth() + 1)}. ${p(date.getHours())}:${p(date.getMinutes())}`;
	}

	/**
	 * Human-readable local timestamp in the system's timezone, "DD.MM.YYYY HH:MM:SS"
	 * (e.g. "01.07.2026 16:20:00") — shown in local time so no mental UTC conversion is
	 * needed. Used for the timestamp data points and for the times in log messages.
	 *
	 * @param {Date} date - the date to format
	 * @returns {string} the local timestamp, or "" for an invalid date
	 */
	localTs(date) {
		if (!(date instanceof Date) || isNaN(date.getTime())) {
			return '';
		}
		const p = n => String(n).padStart(2, '0');
		return `${this.formatLocalDate(date)} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
	}

	/**
	 * Formats a millisecond delay as a compact human string (e.g. "45s", "12min", "3h 05min").
	 *
	 * @param {number} ms - the delay in milliseconds
	 * @returns {string} a compact human-readable duration
	 */
	humanDelay(ms) {
		const s = Math.max(0, Math.round(ms / 1000));
		if (s < 90) {
			return `${s}s`;
		}
		const m = Math.round(s / 60);
		if (m < 90) {
			return `${m}min`;
		}
		return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`;
	}

	/**
	 * Compact, human-readable one-line summary of a switch's effective configuration,
	 * used for a readable per-switch debug line on startup (the full config is still
	 * dumped at silly level as JSON).
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {string} the summary string
	 */
	describeSwitch(sw) {
		const parts = [`enabled=${!!sw.enabled}`, `object=${sw.objectId || '(none)'}`];
		if (sw.dynamicEnabled) {
			parts.push(
				`mode=dynamic(src=${sw.dynamicSource || 'water'}, tRef=${sw.dynamicTRef}, Q10=${sw.dynamicQ10}, ` +
					`interval=${sw.dynamicBaseIntervalMin}[${sw.dynamicMinIntervalMin}-${sw.dynamicMaxIntervalMin}]min, ` +
					`duration=${sw.dynamicBaseDurationSec}[${sw.dynamicMinDurationSec}-${sw.dynamicMaxDurationSec}]s, ` +
					`buffer=${sw.dynamicBufferHours}h, hyst=${sw.dynamicHysteresisPct}%)`,
			);
		} else if ((sw.mode || 'times') === 'interval') {
			parts.push(`mode=interval(every ${sw.intervalMin}min, duration=${sw.durationSec}s)`);
		} else {
			const t = Array.isArray(sw.times) ? sw.times.join(',') : '';
			parts.push(`mode=times(${t || 'none'}, duration=${sw.durationSec}s)`);
		}
		if (sw.astroWindowEnabled) {
			parts.push(`window=astro(+${Number(sw.sunOffsetMorning) || 0}/-${Number(sw.sunOffsetEvening) || 0}min)`);
		} else if (sw.dynamicEnabled || (sw.mode || 'times') === 'interval') {
			parts.push(`window=${sw.windowStart}-${sw.windowEnd}`);
		}
		const blocks = [];
		if (sw.blockWaterEnabled) {
			blocks.push(`water[${sw.waterMin ?? '-'}..${sw.waterMax ?? '-'}]`);
		}
		if (sw.blockAirEnabled) {
			blocks.push(`air[${sw.airMin ?? '-'}..${sw.airMax ?? '-'}]`);
		}
		if (sw.blockO2Enabled) {
			blocks.push(`o2>=${sw.o2Min ?? '-'}`);
		}
		parts.push(`blocks=${blocks.length ? blocks.join('+') : 'none'}`);
		if (sw.winterEnabled) {
			parts.push(`winter=${sw.winterMode}(${mdToDotMM(sw.winterStart)}-${mdToDotMM(sw.winterEnd)})`);
		}
		const src = [];
		if (sw.airTempEnabled && sw.airTempObjectId) {
			src.push(`air=${sw.airTempObjectId}`);
		}
		if (sw.waterTempEnabled && sw.waterTempObjectId) {
			src.push(`water=${sw.waterTempObjectId}`);
		}
		if (sw.o2Enabled && sw.o2ObjectId) {
			src.push(`o2=${sw.o2ObjectId}`);
		}
		if (src.length) {
			parts.push(`sources=${src.join(',')}`);
		}
		parts.push(
			`verify=${sw.verifyEnabled !== false ? `${sw.verifyRetries || 3}x${sw.verifyTimeoutSec || 5}s` : 'off'}`,
		);
		if (sw.telegramInstance) {
			parts.push(`telegram=${sw.telegramInstance}${sw.telegramUser ? `/${sw.telegramUser}` : ''}`);
		}
		return parts.join(' ');
	}

	/**
	 * Reads the ioBroker system language and stores it for user-facing messages.
	 * Falls back to English when the language is unset or not supported.
	 */
	async resolveLanguage() {
		try {
			const sys = await this.getForeignObjectAsync('system.config');
			const lang = sys?.common?.language;
			this.lang = lang && SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
		} catch (e) {
			this.lang = DEFAULT_LANGUAGE;
			this.log.debug(`Could not read system language, using "${DEFAULT_LANGUAGE}": ${e.message}`);
		}
		this.log.debug(`Notification language: ${this.lang}`);
	}

	/**
	 * Localizes a user-facing message (lastResult / Telegram) into the configured
	 * system language, substituting any `{placeholder}` tokens.
	 *
	 * @param {string} key - message key from lib/messages
	 * @param {Record<string, string | number>} [params] - placeholder values
	 * @returns {string} the localized message
	 */
	t(key, params) {
		return translate(key, this.lang, params);
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		this.log.info('Adapter is starting up...');
		try {
			await this.setStateAsync('info.connection', { val: false, ack: true });

			// --- resolve message language from the ioBroker system settings ---
			await this.resolveLanguage();

			// --- read & sanitize switch configuration ---
			const rawSwitches = Array.isArray(this.config.switches) ? this.config.switches : [];
			this.switches = rawSwitches.filter(s => s && s.id).slice(0, MAX_SWITCHES);
			if (rawSwitches.length !== this.switches.length) {
				this.log.warn(
					`Ignored ${rawSwitches.length - this.switches.length} invalid/excess switch entr(ies) (max. ${MAX_SWITCHES}).`,
				);
			}

			// --- one-time migration of the legacy global sources into the switches ---
			if (await this.migrateGlobalSourcesToSwitches()) {
				return; // configuration was rewritten -> the adapter restarts
			}

			// --- Phase 4: move location + sun offsets to a per-switch model ---
			if (await this.migratePhase4()) {
				return; // configuration was rewritten -> the adapter restarts
			}

			// --- backfill defaults for switches created by older versions ---
			if (await this.migrateSwitchDefaults()) {
				return; // configuration was rewritten -> the adapter restarts
			}

			this.log.debug(
				`Configuration: ${JSON.stringify({
					locationMode: this.config.locationMode,
					latitude: this.config.latitude,
					longitude: this.config.longitude,
					switchCount: this.switches.length,
				})}`,
			);
			for (const sw of this.switches) {
				this.log.debug(`Switch ${this.swLabel(sw)}: ${this.describeSwitch(sw)}`);
				this.log.silly(`Switch ${this.swLabel(sw)} full config: ${JSON.stringify(sw)}`);
			}

			// --- resolve per-switch coordinates for the astronomical window ---
			this.log.debug('Resolving geolocation (per switch)...');
			await this.resolveCoordinates();

			// --- create / update / clean up objects ---
			this.log.debug('Ensuring adapter objects (global + per switch)...');
			await this.createGlobalObjects();
			await this.syncSwitchObjects();

			// --- recover from an unclean shutdown: turn off switches still marked active ---
			await this.recoverActiveFeeds();

			// --- per-switch sun windows + daily recalculation ---
			this.recomputeSunWindow();
			this.scheduleMidnightRecalc();

			// --- temperature sources ---
			await this.setupSources();

			// --- switch-state supervision: subscribe to the controlled foreign states ---
			for (const sw of this.switches) {
				if (sw.enabled && sw.objectId && sw.verifyEnabled !== false) {
					this.subscribeForeignStates(sw.objectId);
					this.log.debug(
						`Supervision enabled for ${this.swLabel(sw)} (timeout ${Number(sw.verifyTimeoutSec) || 5}s).`,
					);
				}
			}

			// --- subscribe to our own manual trigger + editable settings states ---
			this.subscribeStates('switches.*.feedNow');
			this.subscribeStates('switches.*.feedFor');
			this.subscribeStates('switches.*.settings.*');
			this.log.silly('Subscribed to switches.*.feedNow, switches.*.feedFor and switches.*.settings.*');

			// --- schedule feeding for every enabled switch ---
			let planned = 0;
			for (const sw of this.switches) {
				// seed the pause state so an already-active pause on start does not send a late "start"
				this.pauseActiveState.set(sw.id, pauseInfo(this.pauseRanges(sw), Date.now()).active);
				// detect a manual master-pause (pauseNow) toggle done while restarting and notify
				await this.checkManualPauseTransition(sw);
				if (sw.enabled && sw.objectId) {
					this.scheduleSwitch(sw);
					planned++;
				} else {
					this.log.debug(
						`Switch ${this.swLabel(sw)} not scheduled (enabled=${!!sw.enabled}, hasObject=${!!sw.objectId}).`,
					);
				}
			}

			// --- winter-pause reminders (initial check + hourly tick) ---
			await this.checkWinterReminders();
			this.scheduleReminderTick();

			// --- relay boards: poll their connection status (only if any switch uses one) ---
			if (this.switches.some(s => s.relayEnabled)) {
				await this.pollRelays();
				this.scheduleRelayPoll();
			}

			await this.setStateAsync('info.connection', { val: true, ack: true });
			this.log.info(`Started. ${this.switches.length} switch(es) configured, ${planned} scheduled.`);
		} catch (e) {
			this.log.error(`Startup failed: ${e.message}`);
			this.log.debug(e.stack || '(no stack)');
			await this.setStateAsync('info.connection', { val: false, ack: true });
		}
	}

	// ----------------------------------------------------------------------------
	// Coordinates & sun
	// ----------------------------------------------------------------------------

	/**
	 * Resolves the coordinates for every switch based on the global locationMode
	 * ("system" = ioBroker system.config, "shared" = the global latitude/longitude,
	 * "individual" = each switch decides on its own tab). Fills {@link switchCoords}.
	 */
	async resolveCoordinates() {
		this.switchCoords.clear();
		let sysCoords = null;
		try {
			const sys = await this.getForeignObjectAsync('system.config');
			const lat = parseFloat(String(sys?.common?.latitude));
			const lon = parseFloat(String(sys?.common?.longitude));
			if (Number.isFinite(lat) && Number.isFinite(lon)) {
				sysCoords = { lat, lon };
			}
		} catch (e) {
			this.log.warn(`Could not read system coordinates: ${e.message}`);
		}
		const mode = this.config.locationMode || 'system';
		const sharedLat = parseFloat(this.config.latitude);
		const sharedLon = parseFloat(this.config.longitude);
		const sharedCoords =
			Number.isFinite(sharedLat) && Number.isFinite(sharedLon) ? { lat: sharedLat, lon: sharedLon } : null;

		for (const sw of this.switches) {
			let coords = null;
			if (mode === 'shared') {
				coords = sharedCoords;
			} else if (mode === 'individual' && sw.coordinateSource === 'specific') {
				const lat = parseFloat(sw.latitude);
				const lon = parseFloat(sw.longitude);
				coords = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
			} else {
				coords = sysCoords; // "system" mode, or individual switch set to "system"
			}
			if (coords) {
				this.switchCoords.set(sw.id, coords);
				this.log.debug(
					`Coordinates for ${this.swLabel(sw)}: lat=${coords.lat}, lon=${coords.lon} (mode=${mode}).`,
				);
			} else if (sw.astroWindowEnabled) {
				this.log.warn(
					`Switch ${this.swLabel(sw)}: the astronomical window is enabled but no valid coordinates are ` +
						`available (locationMode=${mode}). Its window guard stays inactive until coordinates are set.`,
				);
			}
		}
	}

	/**
	 * Astronomical window {start, end} for a switch on the given day, or null if the
	 * switch has no coordinates or sunrise/sunset cannot be computed.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {Date} refDate - the day to compute for
	 * @returns {{ start: Date, end: Date } | null} the window or null
	 */
	sunWindowFor(sw, refDate) {
		const coords = this.switchCoords.get(sw.id);
		if (!coords) {
			return null;
		}
		const times = SunCalc.getTimes(refDate, coords.lat, coords.lon);
		if (
			!times ||
			!times.sunrise ||
			!times.sunset ||
			isNaN(times.sunrise.getTime()) ||
			isNaN(times.sunset.getTime())
		) {
			return null;
		}
		const morning = Number(sw.sunOffsetMorning) || 0;
		const evening = Number(sw.sunOffsetEvening) || 0;
		return {
			start: new Date(times.sunrise.getTime() + morning * 60000),
			end: new Date(times.sunset.getTime() - evening * 60000),
		};
	}

	/** Computes today's astronomical window per switch, writes the per-switch sun states. */
	recomputeSunWindow() {
		this.switchWindows.clear();
		const now = new Date();
		for (const sw of this.switches) {
			if (!sw.astroWindowEnabled) {
				continue;
			}
			const coords = this.switchCoords.get(sw.id);
			if (!coords) {
				continue; // already warned in resolveCoordinates
			}
			const times = SunCalc.getTimes(now, coords.lat, coords.lon);
			if (
				!times ||
				!times.sunrise ||
				!times.sunset ||
				isNaN(times.sunrise.getTime()) ||
				isNaN(times.sunset.getTime())
			) {
				this.log.warn(`Switch ${this.swLabel(sw)}: could not compute sunrise/sunset for its coordinates.`);
				continue;
			}
			const morning = Number(sw.sunOffsetMorning) || 0;
			const evening = Number(sw.sunOffsetEvening) || 0;
			const start = new Date(times.sunrise.getTime() + morning * 60000);
			const end = new Date(times.sunset.getTime() - evening * 60000);
			this.switchWindows.set(sw.id, { start, end });
			this.setStateAsync(`switches.${sw.id}.status.sunrise`, { val: this.localTs(times.sunrise), ack: true });
			this.setStateAsync(`switches.${sw.id}.status.sunriseTs`, { val: times.sunrise.getTime(), ack: true });
			this.setStateAsync(`switches.${sw.id}.status.sunset`, { val: this.localTs(times.sunset), ack: true });
			this.setStateAsync(`switches.${sw.id}.status.sunsetTs`, { val: times.sunset.getTime(), ack: true });
			this.log.debug(
				`Sun times ${this.swLabel(sw)}: sunrise=${this.localTs(times.sunrise)}, sunset=${this.localTs(times.sunset)}; ` +
					`offsets +${morning}/-${evening} min -> window ${this.localTs(start)} ... ${this.localTs(end)}`,
			);
		}
	}

	scheduleMidnightRecalc() {
		const now = new Date();
		const midnight = new Date(now);
		midnight.setHours(24, 0, 30, 0); // 00:00:30 next day
		const delay = midnight.getTime() - now.getTime();
		this.log.debug(
			`Midnight recalculation scheduled for ${this.localTs(midnight)} (in ${Math.round(delay / 1000)}s).`,
		);
		this.midnightTimer = this.setTimeout(() => {
			this.log.debug('Midnight reached: recomputing per-switch sun windows and rescheduling all switches.');
			this.recomputeSunWindow();
			this.scheduleMidnightRecalc();
			// reschedule all switches so the new window is honored
			for (const sw of this.switches) {
				if (sw.enabled && sw.objectId) {
					this.scheduleSwitch(sw);
				}
			}
		}, delay);
	}

	// ----------------------------------------------------------------------------
	// Objects
	// ----------------------------------------------------------------------------

	async createGlobalObjects() {
		this.log.silly('Ensuring global objects: info, airTemperature, waterTemperature, sunrise, sunset');
		// intermediate parent object for info.* (required so every id path segment has an object)
		await this.setObjectNotExistsAsync('info', {
			type: 'channel',
			common: { name: 'Information' },
			native: {},
		});
		await this.setObjectNotExistsAsync('info.connection', {
			type: 'state',
			common: {
				name: 'Adapter running / configuration valid',
				type: 'boolean',
				role: 'indicator.connected',
				read: true,
				write: false,
				def: false,
			},
			native: {},
		});
		// legacy global states that moved per switch (temperature mirrors + sun times): remove them
		for (const legacy of ['airTemperature', 'waterTemperature', 'sunrise', 'sunset']) {
			if (await this.getObjectAsync(legacy)) {
				await this.delObjectAsync(legacy);
				this.log.debug(`Removed obsolete global state "${legacy}" (now per switch).`);
			}
		}
	}

	/** Creates a channel + states for every configured switch and removes obsolete ones. */
	async syncSwitchObjects() {
		const wantedIds = new Set(this.switches.map(s => s.id));
		this.log.silly(`Synchronizing switch objects. Wanted ids: ${[...wantedIds].join(', ') || '(none)'}`);

		// remove channels of switches that no longer exist. Only DIRECT children of
		// "switches." are switch channels - sub-channels like "sw-0.status" must be
		// skipped, otherwise every start wipes the persisted status values.
		const all = await this.getAdapterObjectsAsync();
		const prefix = `${this.namespace}.switches.`;
		for (const id of Object.keys(all)) {
			if (id.startsWith(prefix) && all[id].type === 'channel') {
				const sid = id.substring(prefix.length);
				if (!sid.includes('.') && !wantedIds.has(sid)) {
					await this.delObjectAsync(id, { recursive: true });
					this.log.info(`Removed obsolete switch objects for "${sid}".`);
				}
			}
		}

		// intermediate parent object for switches.* (so every id path segment has an object)
		if (this.switches.length) {
			await this.setObjectNotExistsAsync('switches', {
				type: 'folder',
				common: { name: 'Switches' },
				native: {},
			});
		}

		for (const sw of this.switches) {
			const base = `switches.${sw.id}`;
			this.log.debug(`Ensuring objects for switch ${this.swLabel(sw)} under ${this.namespace}.${base}`);
			await this.setObjectNotExistsAsync(base, {
				type: 'channel',
				common: { name: sw.name || sw.id },
				native: {},
			});
			// keep the channel name in sync with the configured name
			await this.extendObjectAsync(base, { common: { name: sw.name || sw.id } });

			// status sub-channel groups all read-only status states
			await this.setObjectNotExistsAsync(`${base}.status`, {
				type: 'channel',
				common: { name: 'Status' },
				native: {},
			});
			// clean up states that used to live directly under the switch (moved into .status)
			for (const legacy of STATUS_STATE_IDS) {
				if (await this.getObjectAsync(`${base}.${legacy}`)) {
					await this.delObjectAsync(`${base}.${legacy}`);
				}
			}

			await this.setObjectNotExistsAsync(`${base}.status.feedingActive`, {
				type: 'state',
				common: {
					name: 'Feeding active',
					type: 'boolean',
					role: 'indicator.working',
					read: true,
					write: false,
					def: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.feedingEndsTs`, {
				type: 'state',
				common: {
					name: 'End of the running feeding as Unix timestamp in ms (0 = not feeding)',
					type: 'number',
					role: 'value.time',
					read: true,
					write: false,
					def: 0,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.feedingDurationSec`, {
				type: 'state',
				common: {
					name: 'Total duration of the running feeding in seconds (0 = not feeding)',
					type: 'number',
					role: 'value',
					unit: 's',
					read: true,
					write: false,
					def: 0,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.lastFeeding`, {
				type: 'state',
				common: { name: 'Last feeding', type: 'string', role: 'date', read: true, write: false },
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.lastFeedingTs`, {
				type: 'state',
				common: {
					name: 'Last feeding as Unix timestamp in ms (0 = none)',
					type: 'number',
					role: 'value.time',
					read: true,
					write: false,
					def: 0,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.nextFeeding`, {
				type: 'state',
				common: { name: 'Next feeding', type: 'string', role: 'date', read: true, write: false },
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.nextFeedingTs`, {
				type: 'state',
				common: {
					name: 'Next feeding as Unix timestamp in ms (0 = none planned)',
					type: 'number',
					role: 'value.time',
					read: true,
					write: false,
					def: 0,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.blocked`, {
				type: 'state',
				common: {
					name: 'Feeding blocked',
					type: 'boolean',
					role: 'indicator',
					read: true,
					write: false,
					def: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.blockReason`, {
				type: 'state',
				common: { name: 'Block reason', type: 'string', role: 'text', read: true, write: false, def: '' },
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.blockReasonCode`, {
				type: 'state',
				common: {
					name: 'Block reason as stable machine-readable code (empty = not blocked)',
					type: 'string',
					role: 'text',
					read: true,
					write: false,
					def: '',
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.lastResult`, {
				type: 'state',
				common: {
					name: 'Result of the last feeding attempt',
					type: 'string',
					role: 'text',
					read: true,
					write: false,
					def: '',
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.error`, {
				type: 'state',
				common: {
					name: 'Last feeding had a switching fault',
					type: 'boolean',
					role: 'indicator.error',
					read: true,
					write: false,
					def: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.feedNow`, {
				type: 'state',
				common: {
					name: 'Feed now (manual trigger)',
					type: 'boolean',
					role: 'button',
					read: false,
					write: true,
					def: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.feedFor`, {
				type: 'state',
				common: {
					name: 'Feed once for N seconds (write the duration; resets to 0)',
					type: 'number',
					role: 'level',
					unit: 's',
					min: 0,
					max: MAX_DURATION_SEC,
					read: true,
					write: true,
					def: 0,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.winterActive`, {
				type: 'state',
				common: {
					name: 'Winter pause currently active',
					type: 'boolean',
					role: 'indicator',
					read: true,
					write: false,
					def: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.pauseManual`, {
				type: 'state',
				common: {
					name: 'Manual master pause (pauseNow) active',
					type: 'boolean',
					role: 'indicator',
					read: true,
					write: false,
					def: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.pauseActive`, {
				type: 'state',
				common: {
					name: 'Feeding pause currently active',
					type: 'boolean',
					role: 'indicator',
					read: true,
					write: false,
					def: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.pauseActiveUntil`, {
				type: 'state',
				common: {
					name: 'Active feeding pause ends at',
					type: 'string',
					role: 'date',
					read: true,
					write: false,
					def: '',
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.pauseActiveUntilTs`, {
				type: 'state',
				common: {
					name: 'End of the active feeding pause as Unix timestamp in ms (0 = none)',
					type: 'number',
					role: 'value.time',
					read: true,
					write: false,
					def: 0,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.winterLastStartReminder`, {
				type: 'state',
				common: {
					name: 'Date of the last sent winter-start reminder',
					type: 'string',
					role: 'date',
					read: true,
					write: false,
					def: '',
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.winterLastEndReminder`, {
				type: 'state',
				common: {
					name: 'Date of the last sent winter-end reminder',
					type: 'string',
					role: 'date',
					read: true,
					write: false,
					def: '',
				},
				native: {},
			});

			// --- dynamic feeding status (computed from temperature) ---
			await this.setObjectNotExistsAsync(`${base}.status.dynamicAvgTemperature`, {
				type: 'state',
				common: {
					name: 'Dynamic feeding: averaged temperature',
					type: 'number',
					role: 'value.temperature',
					unit: '°C',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.dynamicRate`, {
				type: 'state',
				common: {
					name: 'Dynamic feeding: Q10 rate factor',
					type: 'number',
					role: 'value',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.dynamicIntervalMin`, {
				type: 'state',
				common: {
					name: 'Dynamic feeding: current interval',
					type: 'number',
					role: 'value',
					unit: 'min',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.dynamicDurationSec`, {
				type: 'state',
				common: {
					name: 'Dynamic feeding: current duration',
					type: 'number',
					role: 'value',
					unit: 's',
					read: true,
					write: false,
				},
				native: {},
			});

			// --- per-switch mirrors of this station's own sources ---
			await this.setObjectNotExistsAsync(`${base}.status.airTemperature`, {
				type: 'state',
				common: {
					name: 'Air temperature (this switch)',
					type: 'number',
					role: 'value.temperature',
					unit: '°C',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.waterTemperature`, {
				type: 'state',
				common: {
					name: 'Water temperature (this switch)',
					type: 'number',
					role: 'value.temperature',
					unit: '°C',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.waterTemperatureDeep`, {
				type: 'state',
				common: {
					name: 'Water temperature, deep sensor (this switch)',
					type: 'number',
					role: 'value.temperature',
					unit: '°C',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.waterStratification`, {
				type: 'state',
				common: {
					name: 'Water stratification (shallow − deep)',
					type: 'number',
					role: 'value.temperature',
					unit: '°C',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.oxygen`, {
				type: 'state',
				common: {
					name: 'Dissolved oxygen (this switch)',
					type: 'number',
					role: 'value',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.sunrise`, {
				type: 'state',
				common: {
					name: 'Sunrise (this switch)',
					type: 'string',
					role: 'date.sunrise',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.sunriseTs`, {
				type: 'state',
				common: {
					name: 'Sunrise as Unix timestamp in ms (this switch)',
					type: 'number',
					role: 'value.time',
					read: true,
					write: false,
					def: 0,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.sunset`, {
				type: 'state',
				common: { name: 'Sunset (this switch)', type: 'string', role: 'date.sunset', read: true, write: false },
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.status.sunsetTs`, {
				type: 'state',
				common: {
					name: 'Sunset as Unix timestamp in ms (this switch)',
					type: 'number',
					role: 'value.time',
					read: true,
					write: false,
					def: 0,
				},
				native: {},
			});

			// --- relay board status (only for switches that use a relay board) ---
			if (sw.relayEnabled) {
				await this.setObjectNotExistsAsync(`${base}.relay`, {
					type: 'channel',
					common: { name: 'Relay board' },
					native: {},
				});
				await this.setObjectNotExistsAsync(`${base}.relay.connected`, {
					type: 'state',
					common: {
						name: 'Relay board reachable',
						type: 'boolean',
						role: 'indicator.connected',
						read: true,
						write: false,
						def: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${base}.relay.info`, {
					type: 'state',
					common: {
						name: 'Relay board info (host / IP / firmware)',
						type: 'string',
						role: 'text',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${base}.relay.active`, {
					type: 'state',
					common: {
						name: 'Relay board timer running',
						type: 'boolean',
						role: 'indicator.working',
						read: true,
						write: false,
						def: false,
					},
					native: {},
				});
				await this.setObjectNotExistsAsync(`${base}.relay.remaining`, {
					type: 'state',
					common: {
						name: 'Relay board timer remaining',
						type: 'number',
						role: 'value',
						unit: 's',
						read: true,
						write: false,
						def: 0,
					},
					native: {},
				});
			} else {
				// this switch does not use a relay board -> remove the relay channel and its states
				const relayObj = await this.getObjectAsync(`${base}.relay`);
				if (relayObj) {
					await this.delObjectAsync(`${base}.relay`, { recursive: true });
					this.log.debug(
						`Removed relay objects for switch ${this.swLabel(sw)} (relay board disabled for this switch).`,
					);
				}
			}

			// --- read-only mirror of the configuration (visible in the object tree / VIS) ---
			await this.setObjectNotExistsAsync(`${base}.settings`, {
				type: 'folder',
				common: { name: 'Settings' },
				native: {},
			});
			for (const s of SWITCH_SETTINGS) {
				const writable = !SETTINGS_READONLY.has(s.id);
				// writable states must not carry a read-only role (repochecker E1011)
				const role = writable ? writableRole(s.role) : s.role;
				await this.setObjectNotExistsAsync(`${base}.settings.${s.id}`, {
					type: 'state',
					common: {
						name: s.name,
						type: asCommonType(s.type),
						role,
						read: true,
						write: writable,
						...(s.unit ? { unit: s.unit } : {}),
					},
					native: {},
				});
				// keep role + write flag in sync for objects created by older versions
				await this.extendObjectAsync(`${base}.settings.${s.id}`, { common: { role, write: writable } });
				await this.setStateAsync(`${base}.settings.${s.id}`, { val: s.get(sw), ack: true });
			}
		}
	}

	async recoverActiveFeeds() {
		this.log.silly('Checking for switches left active after an unclean shutdown...');
		for (const sw of this.switches) {
			const st = await this.getStateAsync(`switches.${sw.id}.status.feedingActive`);
			if (st && st.val) {
				this.log.info(`Recovering: switch ${this.swLabel(sw)} was still active, turning it off.`);
				if (sw.objectId) {
					await this.writeSwitch(sw, false);
				}
				await this.setStateAsync(`switches.${sw.id}.status.feedingActive`, { val: false, ack: true });
			}
		}
	}

	// ----------------------------------------------------------------------------
	// Temperatures
	// ----------------------------------------------------------------------------

	/**
	 * One-time migration: copies the legacy global temperature/oxygen sources into
	 * every switch that has none yet, marks the migration done and clears the
	 * legacy globals. Writing the instance config restarts the adapter.
	 *
	 * @returns {Promise<boolean>} true if the configuration was rewritten (restart imminent)
	 */
	async migrateGlobalSourcesToSwitches() {
		const g = this.config;
		if (g.sourcesMigratedToSwitches) {
			return false;
		}
		const hasGlobal =
			(g.airTempEnabled && g.airTempObjectId) ||
			(g.waterTempEnabled && g.waterTempObjectId) ||
			(g.o2Enabled && g.o2ObjectId);
		if (!hasGlobal) {
			return false;
		}
		const objId = `system.adapter.${this.namespace}`;
		let obj;
		try {
			obj = await this.getForeignObjectAsync(objId);
		} catch (e) {
			this.log.warn(`Source migration skipped (could not read ${objId}): ${e.message}`);
			return false;
		}
		if (!obj || !obj.native) {
			return false;
		}
		const switches = Array.isArray(obj.native.switches) ? obj.native.switches : [];
		for (const sw of switches) {
			if (g.airTempEnabled && g.airTempObjectId && !sw.airTempObjectId) {
				sw.airTempEnabled = true;
				sw.airTempObjectId = g.airTempObjectId;
			}
			if (g.waterTempEnabled && g.waterTempObjectId && !sw.waterTempObjectId) {
				sw.waterTempEnabled = true;
				sw.waterTempObjectId = g.waterTempObjectId;
			}
			if (g.o2Enabled && g.o2ObjectId && !sw.o2ObjectId) {
				sw.o2Enabled = true;
				sw.o2ObjectId = g.o2ObjectId;
			}
		}
		obj.native.sourcesMigratedToSwitches = true;
		obj.native.airTempEnabled = false;
		obj.native.waterTempEnabled = false;
		obj.native.o2Enabled = false;
		await this.setForeignObjectAsync(objId, obj);
		this.log.info(
			`Migrated the global temperature/oxygen source(s) into ${switches.length} switch(es); the adapter restarts to apply the new per-switch configuration.`,
		);
		return true;
	}

	/**
	 * One-time Phase-4 migration: turns the former global location + sun offsets into
	 * a per-switch model.
	 *  - each switch gets its own sunOffsetMorning/Evening (copied from the old globals),
	 *  - the old per-switch "respectNight" becomes "astroWindowEnabled" and is removed,
	 *  - each switch gets a default per-switch location source ("system"),
	 *  - the global locationMode is derived from the old coordinateSource
	 *    ("specific" -> "shared", otherwise "system").
	 * Writing the instance config restarts the adapter; idempotent afterwards.
	 *
	 * @returns {Promise<boolean>} true if the configuration was rewritten (restart imminent)
	 */
	async migratePhase4() {
		if (this.config.phase4Migrated) {
			return false;
		}
		const objId = `system.adapter.${this.namespace}`;
		let obj;
		try {
			obj = await this.getForeignObjectAsync(objId);
		} catch (e) {
			this.log.warn(`Phase-4 migration skipped (could not read ${objId}): ${e.message}`);
			return false;
		}
		if (!obj || !obj.native) {
			return false;
		}
		const g = obj.native;
		const switches = Array.isArray(g.switches) ? g.switches : [];
		const hasLegacySwitch = switches.some(sw => sw && typeof sw === 'object' && 'respectNight' in sw);
		const hasLegacyGlobal =
			g.coordinateSource === 'specific' || !!(Number(g.sunOffsetMorning) || Number(g.sunOffsetEvening));
		if (!hasLegacySwitch && !hasLegacyGlobal && g.locationMode) {
			return false; // nothing to migrate (fresh / already per-switch config)
		}
		const gMorning = Number(g.sunOffsetMorning) || 0;
		const gEvening = Number(g.sunOffsetEvening) || 0;
		for (const sw of switches) {
			if (!sw || typeof sw !== 'object') {
				continue;
			}
			if (!('astroWindowEnabled' in sw)) {
				sw.astroWindowEnabled = sw.respectNight !== false; // preserve the old night-protection intent
			}
			if (!('sunOffsetMorning' in sw)) {
				sw.sunOffsetMorning = gMorning;
			}
			if (!('sunOffsetEvening' in sw)) {
				sw.sunOffsetEvening = gEvening;
			}
			if (!('coordinateSource' in sw)) {
				sw.coordinateSource = 'system';
			}
			if (!('latitude' in sw)) {
				sw.latitude = '';
			}
			if (!('longitude' in sw)) {
				sw.longitude = '';
			}
			if (!('address' in sw)) {
				sw.address = '';
			}
			delete sw.respectNight;
		}
		if (!g.locationMode) {
			g.locationMode = g.coordinateSource === 'specific' ? 'shared' : 'system';
		}
		g.phase4Migrated = true;
		await this.setForeignObjectAsync(objId, obj);
		this.log.info(
			`Phase-4 migration: moved the sun offsets and the location choice into a per-switch model ` +
				`(${switches.length} switch(es), locationMode=${g.locationMode}); the adapter restarts to apply it.`,
		);
		return true;
	}

	/**
	 * Backfills per-switch config fields that were added in later adapter versions
	 * and are therefore missing on switches created by an older version. Only fields
	 * that are absent are added (from {@link SWITCH_DEFAULTS}); values the user set
	 * explicitly — including 0/false/null — are kept. Writing the instance config
	 * restarts the adapter; the operation is idempotent (once every field exists,
	 * nothing changes on the next start).
	 *
	 * @returns {Promise<boolean>} true if the configuration was rewritten (restart imminent)
	 */
	async migrateSwitchDefaults() {
		const objId = `system.adapter.${this.namespace}`;
		let obj;
		try {
			obj = await this.getForeignObjectAsync(objId);
		} catch (e) {
			this.log.warn(`Default backfill skipped (could not read ${objId}): ${e.message}`);
			return false;
		}
		if (!obj || !obj.native || !Array.isArray(obj.native.switches)) {
			return false;
		}
		let added = 0;
		let touched = 0;
		for (const sw of obj.native.switches) {
			if (!sw || typeof sw !== 'object') {
				continue;
			}
			let swTouched = false;
			for (const [key, def] of Object.entries(SWITCH_DEFAULTS)) {
				if (!(key in sw)) {
					sw[key] = Array.isArray(def) ? [...def] : def;
					added++;
					swTouched = true;
				}
			}
			if (swTouched) {
				touched++;
			}
		}
		if (!added) {
			return false;
		}
		await this.setForeignObjectAsync(objId, obj);
		this.log.info(
			`Filled in ${added} missing default value(s) on ${touched} switch(es) created by an older version; the adapter restarts to apply them.`,
		);
		return true;
	}

	async setupSources() {
		// keep enough history for the largest configured moving-average window
		const maxHours = Math.max(24, ...this.switches.map(s => Number(s.dynamicBufferHours) || 0));
		this.maxBufferMs = maxHours * 3600000;
		this.log.silly(`Source history window: ${maxHours}h (${this.maxBufferMs}ms).`);

		// collect the union of foreign objects referenced by any switch
		this.tempObjectIds = new Set();
		this.o2ObjectIds = new Set();
		for (const sw of this.switches) {
			const used = [];
			if (sw.airTempEnabled && sw.airTempObjectId) {
				this.tempObjectIds.add(sw.airTempObjectId);
				used.push(`air=${sw.airTempObjectId}`);
			}
			if (sw.waterTempEnabled && sw.waterTempObjectId) {
				this.tempObjectIds.add(sw.waterTempObjectId);
				used.push(`water=${sw.waterTempObjectId}`);
			}
			if (sw.waterTemp2Enabled && sw.waterTemp2ObjectId) {
				this.tempObjectIds.add(sw.waterTemp2ObjectId);
				used.push(`water2=${sw.waterTemp2ObjectId}`);
			}
			if (sw.o2Enabled && sw.o2ObjectId) {
				this.o2ObjectIds.add(sw.o2ObjectId);
				used.push(`o2=${sw.o2ObjectId}`);
			}
			if (used.length) {
				this.log.debug(`Sources for ${this.swLabel(sw)}: ${used.join(', ')}.`);
			}
		}

		const allIds = new Set([...this.tempObjectIds, ...this.o2ObjectIds]);
		for (const id of allIds) {
			this.subscribeForeignStates(id);
			let value = null;
			try {
				const st = await this.getForeignStateAsync(id);
				value = st && st.val !== null && st.val !== undefined ? Number(st.val) : null;
			} catch (e) {
				this.log.warn(`Could not read source ${id}: ${e.message}`);
			}
			this.foreignValues.set(id, value);
			if (this.tempObjectIds.has(id)) {
				this.foreignBuffers.set(id, []);
				if (value !== null) {
					this.pushTempSample(id, value);
				}
			}
			this.log.debug(`Source subscribed: ${id} (initial value: ${value ?? 'unknown'}).`);
		}
		if (!allIds.size) {
			this.log.debug('No per-switch temperature/oxygen sources configured.');
		}
		// initialize the per-switch mirror states
		for (const id of allIds) {
			await this.updateSourceMirrors(id, this.foreignValues.get(id) ?? null);
		}
	}

	/**
	 * Appends a temperature sample to the rolling buffer of a foreign object and
	 * prunes samples older than the retained window.
	 *
	 * @param {string} objectId - the temperature source object id
	 * @param {number} value - the temperature value in °C
	 */
	pushTempSample(objectId, value) {
		if (!Number.isFinite(value)) {
			return;
		}
		let buf = this.foreignBuffers.get(objectId);
		if (!buf) {
			buf = [];
			this.foreignBuffers.set(objectId, buf);
		}
		const now = Date.now();
		buf.push({ t: now, v: value });
		const from = now - this.maxBufferMs;
		while (buf.length && buf[0].t < from) {
			buf.shift();
		}
	}

	/**
	 * Writes the per-switch mirror states (airTemperature / waterTemperature /
	 * oxygen) for every switch that uses the given source object.
	 *
	 * @param {string} objectId - the source object that changed
	 * @param {number | null} value - its current value
	 */
	async updateSourceMirrors(objectId, value) {
		for (const sw of this.switches) {
			if (sw.airTempEnabled && sw.airTempObjectId === objectId) {
				await this.setStateAsync(`switches.${sw.id}.status.airTemperature`, { val: value, ack: true });
			}
			if (sw.waterTempEnabled && sw.waterTempObjectId === objectId) {
				await this.setStateAsync(`switches.${sw.id}.status.waterTemperature`, { val: value, ack: true });
			}
			if (sw.waterTemp2Enabled && sw.waterTemp2ObjectId === objectId) {
				await this.setStateAsync(`switches.${sw.id}.status.waterTemperatureDeep`, { val: value, ack: true });
			}
			// stratification delta (shallow - deep) whenever a switch uses both water sensors
			if (
				sw.waterTempEnabled &&
				sw.waterTemp2Enabled &&
				(sw.waterTempObjectId === objectId || sw.waterTemp2ObjectId === objectId)
			) {
				const shallow = this.foreignValues.get(sw.waterTempObjectId);
				const deep = this.foreignValues.get(sw.waterTemp2ObjectId);
				const delta =
					Number.isFinite(shallow) && Number.isFinite(deep) ? Math.round((shallow - deep) * 10) / 10 : null;
				await this.setStateAsync(`switches.${sw.id}.status.waterStratification`, { val: delta, ack: true });
			}
			if (sw.o2Enabled && sw.o2ObjectId === objectId) {
				await this.setStateAsync(`switches.${sw.id}.status.oxygen`, { val: value, ack: true });
			}
		}
	}

	// ----------------------------------------------------------------------------
	// Scheduling
	// ----------------------------------------------------------------------------

	scheduleSwitch(sw) {
		// clear an existing schedule timer for this switch
		const existing = this.scheduleTimers.get(sw.id);
		if (existing) {
			this.clearTimeout(existing);
			this.scheduleTimers.delete(sw.id);
			this.log.silly(`Cleared existing schedule timer for ${this.swLabel(sw)}.`);
		}

		// manual master pause (pauseNow) overrides every feeding mode and the time-based
		// pauses: while it is on, feeding stays fully suspended until the user turns it off.
		if (sw.pauseNow) {
			this.setStateAsync(`switches.${sw.id}.status.pauseActive`, { val: true, ack: true });
			this.setStateAsync(`switches.${sw.id}.status.pauseActiveUntil`, { val: '', ack: true });
			this.setStateAsync(`switches.${sw.id}.status.pauseActiveUntilTs`, { val: 0, ack: true });
			this.setStateAsync(`switches.${sw.id}.status.nextFeeding`, { val: '', ack: true });
			this.setStateAsync(`switches.${sw.id}.status.nextFeedingTs`, { val: 0, ack: true });
			this.log.debug(
				`Switch ${this.swLabel(sw)}: manual master pause (pauseNow) active - all feeding suspended, nothing planned.`,
			);
			return;
		}

		// absolute feeding pauses take precedence over everything else
		const ranges = this.pauseRanges(sw);
		const pinfo = pauseInfo(ranges, Date.now());
		this.setStateAsync(`switches.${sw.id}.status.pauseActive`, { val: pinfo.active, ack: true });
		this.setStateAsync(`switches.${sw.id}.status.pauseActiveUntil`, {
			val: pinfo.active && pinfo.until ? this.localTs(new Date(pinfo.until)) : '',
			ack: true,
		});
		this.setStateAsync(`switches.${sw.id}.status.pauseActiveUntilTs`, {
			val: pinfo.active && pinfo.until ? pinfo.until : 0,
			ack: true,
		});
		this.armPauseTimer(sw);
		if (pinfo.active) {
			const untilStr = pinfo.until ? this.localTs(new Date(pinfo.until)) : '';
			this.setStateAsync(`switches.${sw.id}.status.nextFeeding`, { val: '', ack: true });
			this.setStateAsync(`switches.${sw.id}.status.nextFeedingTs`, { val: 0, ack: true });
			this.log.debug(`Switch ${this.swLabel(sw)}: feeding paused until ${untilStr} - nothing planned.`);
			return;
		}

		let next = this.computeNextFeeding(sw, new Date());
		// if the next feeding lands inside a (future) pause, skip to after it
		let guard = 0;
		while (next && guard++ < 5) {
			const p = pauseInfo(ranges, next.getTime());
			if (!p.active || !p.until) {
				break;
			}
			next = this.computeNextFeeding(sw, new Date(p.until));
		}
		if (!next) {
			this.setStateAsync(`switches.${sw.id}.status.nextFeeding`, { val: '', ack: true });
			this.setStateAsync(`switches.${sw.id}.status.nextFeedingTs`, { val: 0, ack: true });
			const winterActive = !!sw.winterEnabled && isInWinterPause(sw.winterStart, sw.winterEnd, new Date());
			if (sw.dynamicEnabled && !winterActive) {
				this.log.warn(
					`Switch ${this.swLabel(sw)}: dynamic feeding is enabled but no valid interval could be computed - set a base interval and a max interval > 0 and a valid time window (${sw.windowStart}-${sw.windowEnd}). Nothing planned.`,
				);
				this.setStateAsync(`switches.${sw.id}.status.blockReason`, {
					val: this.t('dynamicNoInterval'),
					ack: true,
				});
				this.setStateAsync(`switches.${sw.id}.status.blockReasonCode`, {
					val: 'dynamicNoInterval',
					ack: true,
				});
			} else {
				this.log.warn(`Switch ${this.swLabel(sw)}: no valid schedule (mode=${sw.mode}), not planned.`);
			}
			return;
		}

		// clear a stale "no valid interval" hint once a schedule exists again
		this.getStateAsync(`switches.${sw.id}.status.blockReason`)
			.then(st => {
				if (st && st.val === this.t('dynamicNoInterval')) {
					this.setStateAsync(`switches.${sw.id}.status.blockReason`, { val: '', ack: true });
					this.setStateAsync(`switches.${sw.id}.status.blockReasonCode`, { val: '', ack: true });
				}
			})
			.catch(() => {});

		this.setStateAsync(`switches.${sw.id}.status.nextFeeding`, { val: this.localTs(next), ack: true });
		this.setStateAsync(`switches.${sw.id}.status.nextFeedingTs`, { val: next.getTime(), ack: true });
		const delay = Math.min(MAX_TIMEOUT_MS, Math.max(0, next.getTime() - Date.now()));
		const windowKind = sw.astroWindowEnabled
			? 'astro'
			: sw.dynamicEnabled || sw.mode === 'interval'
				? 'window'
				: 'times';
		this.log.debug(
			`Switch ${this.swLabel(sw)}: next feeding at ${this.localTs(next)} ` +
				`(in ${this.humanDelay(delay)}; mode=${sw.dynamicEnabled ? 'dynamic' : sw.mode || 'times'}, source=${windowKind}).`,
		);

		const timer = this.setTimeout(async () => {
			this.scheduleTimers.delete(sw.id);
			this.log.debug(`Scheduled feeding timer fired for ${this.swLabel(sw)}.`);
			await this.feed(sw, false);
			this.scheduleSwitch(sw); // plan the following feeding
		}, delay);
		this.scheduleTimers.set(sw.id, timer);
		this.log.silly(`Schedule timer armed for ${this.swLabel(sw)} (delay ${delay}ms).`);
	}

	// ----------------------------------------------------------------------------
	// Feeding pauses (absolute date-time windows, e.g. a quarantine after restocking)
	// ----------------------------------------------------------------------------

	/**
	 * Parses a local "DD.MM.YYYY HH:mm" (time optional) date-time string to epoch ms,
	 * or null if empty/invalid.
	 *
	 * @param {string} str - the date-time string
	 * @returns {number | null} epoch milliseconds, or null
	 */
	parsePauseDateTime(str) {
		if (typeof str !== 'string') {
			return null;
		}
		const m = str.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
		if (!m) {
			return null;
		}
		const day = Number(m[1]);
		const month = Number(m[2]);
		const year = Number(m[3]);
		const hh = m[4] !== undefined ? Number(m[4]) : 0;
		const mm = m[5] !== undefined ? Number(m[5]) : 0;
		if (month < 1 || month > 12 || day < 1 || day > 31 || hh > 23 || mm > 59) {
			return null;
		}
		const d = new Date(year, month - 1, day, hh, mm, 0, 0);
		return isNaN(d.getTime()) ? null : d.getTime();
	}

	/**
	 * Returns the valid, enabled feeding pauses of a switch as absolute {start, end}
	 * epoch-ms ranges (start < end).
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {Array<{start: number, end: number}>} the pause ranges (possibly empty)
	 */
	pauseRanges(sw) {
		const ranges = [];
		for (const i of [1, 2, 3]) {
			if (!sw[`pause${i}Enabled`]) {
				continue;
			}
			const start = this.parsePauseDateTime(sw[`pause${i}Start`]);
			const end = this.parsePauseDateTime(sw[`pause${i}End`]);
			if (start !== null && end !== null && end > start) {
				ranges.push({ start, end });
			} else {
				this.log.silly(
					`Switch ${this.swLabel(sw)}: pause ${i} ignored (empty/invalid start/end or end <= start).`,
				);
			}
		}
		return ranges;
	}

	/**
	 * Arms a per-switch timer that fires at the next feeding-pause boundary (start or end).
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 */
	armPauseTimer(sw) {
		const existing = this.pauseTimers.get(sw.id);
		if (existing) {
			this.clearTimeout(existing);
			this.pauseTimers.delete(sw.id);
		}
		const nb = nextPauseBoundary(this.pauseRanges(sw), Date.now());
		if (nb === null) {
			return;
		}
		const delay = Math.min(MAX_TIMEOUT_MS, Math.max(0, nb - Date.now()));
		const timer = this.setTimeout(() => {
			this.pauseTimers.delete(sw.id);
			this.onPauseBoundary(sw).catch(e => this.log.warn(`Pause boundary handling failed: ${e.message}`));
		}, delay);
		this.pauseTimers.set(sw.id, timer);
		this.log.silly(
			`Switch ${this.swLabel(sw)}: pause boundary timer armed for ${this.localTs(new Date(nb))} (in ${this.humanDelay(delay)}).`,
		);
	}

	/**
	 * Runs at a pause boundary: sends the start/end notification and reschedules the switch.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {Promise<void>}
	 */
	async onPauseBoundary(sw) {
		this.log.debug(`Pause boundary reached for ${this.swLabel(sw)}.`);
		await this.checkPauseTransitions(sw);
		// reschedule (also re-arms the pause timer); armPauseTimer as a fallback
		if (sw.enabled && sw.objectId) {
			this.scheduleSwitch(sw);
		} else {
			this.armPauseTimer(sw);
		}
	}

	/**
	 * Detects a start/end transition of the "feeding paused" state and sends the
	 * corresponding Telegram message once. The previous state is seeded at startup so a
	 * pause that is already active on start does not trigger a late "start" message.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {Promise<void>}
	 */
	async checkPauseTransitions(sw) {
		const info = pauseInfo(this.pauseRanges(sw), Date.now());
		const prev = this.pauseActiveState.get(sw.id);
		if (prev !== undefined && info.active !== prev) {
			if (info.active) {
				const dateStr = info.until ? this.localTs(new Date(info.until)) : '';
				this.log.info(`Feeding pause started for ${this.swLabel(sw)} (until ${dateStr}).`);
				this.notifyPause(sw, 'pauseStart', { date: dateStr });
			} else {
				this.log.info(`Feeding pause ended for ${this.swLabel(sw)}; feeding resumes.`);
				this.notifyPause(sw, 'pauseEnd', {});
			}
		}
		this.pauseActiveState.set(sw.id, info.active);
		await this.setStateAsync(`switches.${sw.id}.status.pauseActive`, { val: info.active, ack: true });
		await this.setStateAsync(`switches.${sw.id}.status.pauseActiveUntil`, {
			val: info.active && info.until ? this.localTs(new Date(info.until)) : '',
			ack: true,
		});
		await this.setStateAsync(`switches.${sw.id}.status.pauseActiveUntilTs`, {
			val: info.active && info.until ? info.until : 0,
			ack: true,
		});
	}

	/**
	 * Detects a change of the manual master pause (pauseNow) across a restart by comparing
	 * the persisted status.pauseManual state against the current config. On a real toggle it
	 * sends the on/off Telegram message once; it always refreshes the persisted state. The
	 * pauseNow switch only ever changes via a config/settings write (which restarts the
	 * adapter), so this startup comparison catches every toggle exactly once.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {Promise<void>}
	 */
	async checkManualPauseTransition(sw) {
		const active = !!sw.pauseNow;
		let prev = null;
		try {
			const st = await this.getStateAsync(`switches.${sw.id}.status.pauseManual`);
			if (st && typeof st.val === 'boolean') {
				prev = st.val;
			}
		} catch {
			/* the state may not exist yet on the very first start */
		}
		if (prev !== null && prev !== active) {
			if (active) {
				this.log.info(`Manual master pause switched ON for ${this.swLabel(sw)}; all feeding suspended.`);
				this.notifyPause(sw, 'pauseManualOn', {});
			} else {
				this.log.info(
					`Manual master pause switched OFF for ${this.swLabel(sw)}; feeding resumes as configured.`,
				);
				this.notifyPause(sw, 'pauseManualOff', {});
			}
		}
		await this.setStateAsync(`switches.${sw.id}.status.pauseManual`, { val: active, ack: true });
	}

	/**
	 * Sends a feeding-pause message to the switch's Telegram instance (if configured).
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {string} key - message key ("pauseStart" | "pauseEnd" | "pauseManualOn" | "pauseManualOff")
	 * @param {Record<string, string | number>} [params] - placeholder values
	 */
	notifyPause(sw, key, params) {
		const instance = sw.telegramInstance;
		if (!instance) {
			this.log.silly(`No Telegram instance configured for ${this.swLabel(sw)}; skipping "${key}" message.`);
			return;
		}
		const text = `${sw.name || sw.id}: ${this.t(key, params)}`;
		const payload = sw.telegramUser ? { text, user: sw.telegramUser } : { text };
		this.log.info(
			`Sending feeding-pause "${key}" via ${instance} to ${sw.telegramUser || 'all'} for ${this.swLabel(sw)}.`,
		);
		try {
			this.sendTo(instance, payload);
		} catch (e) {
			this.log.warn(`Could not send Telegram message via ${instance}: ${e.message}`);
		}
	}

	/**
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {Date} now - reference time
	 * @returns {Date | null} time of the next feeding or null if none can be planned
	 */
	computeNextFeeding(sw, now) {
		const epsilon = 1000; // ignore times that are essentially "now"

		// --- winter pause overrides the normal schedule ---
		const inWinter = !!sw.winterEnabled && isInWinterPause(sw.winterStart, sw.winterEnd, now);
		this.setStateAsync(`switches.${sw.id}.status.winterActive`, { val: inWinter, ack: true });
		if (inWinter) {
			if (sw.winterMode === 'suspend') {
				this.log.debug(`Switch ${this.swLabel(sw)}: winter pause active (suspend) - no feeding planned.`);
				return null; // resumes automatically via the daily midnight recalculation
			}
			if (sw.winterMode === 'onceDaily') {
				const d = this.timeToDate(sw.winterTime, now);
				if (d && d.getTime() <= now.getTime() + epsilon) {
					d.setDate(d.getDate() + 1);
				}
				this.log.debug(`Switch ${this.swLabel(sw)}: winter pause active (once daily at ${sw.winterTime}).`);
				return d || null;
			}
			// reduced: use the winter interval within the normal window
			this.log.debug(`Switch ${this.swLabel(sw)}: winter pause active (reduced, ${sw.winterIntervalMin} min).`);
			return this.nextFromInterval(sw, now, Number(sw.winterIntervalMin) || 0);
		}

		// --- dynamic feeding: temperature-adapted interval within the window ---
		if (sw.dynamicEnabled) {
			return this.planDynamic(sw, now);
		}

		if (sw.mode === 'interval') {
			return this.nextFromInterval(sw, now);
		}
		// fixed times
		const times = Array.isArray(sw.times) ? sw.times : [];
		let best = null;
		for (const t of times) {
			const d = this.timeToDate(t, now);
			if (!d) {
				this.log.silly(`Switch ${this.swLabel(sw)}: ignoring invalid time "${t}".`);
				continue;
			}
			if (d.getTime() <= now.getTime() + epsilon) {
				d.setDate(d.getDate() + 1); // tomorrow
			}
			this.log.silly(`Switch ${this.swLabel(sw)}: candidate time "${t}" -> ${this.localTs(d)}`);
			if (!best || d.getTime() < best.getTime()) {
				best = d;
			}
		}
		return best;
	}

	nextFromInterval(sw, now, intervalMinOverride) {
		const rawIntervalMin = intervalMinOverride !== undefined ? intervalMinOverride : Number(sw.intervalMin) || 0;
		// clamp to a sane maximum so the grid step cannot become absurd
		const intervalMin = Math.min(MAX_INTERVAL_MIN, Math.max(0, Number(rawIntervalMin) || 0));
		const interval = intervalMin * 60000;

		// the feeding window is either fixed (windowStart/windowEnd) or astronomical
		// (sunrise/sunset +/- the per-switch offsets, computed for the given day)
		let start;
		let end;
		if (sw.astroWindowEnabled) {
			const win = this.sunWindowFor(sw, now);
			start = win && win.start;
			end = win && win.end;
		} else {
			start = this.timeToDate(sw.windowStart, now);
			end = this.timeToDate(sw.windowEnd, now);
		}
		if (!start || !end || interval <= 0 || end.getTime() <= start.getTime()) {
			this.log.silly(
				`Switch ${this.swLabel(sw)}: invalid interval config (astro=${!!sw.astroWindowEnabled}, ` +
					`start=${start ? this.localTs(start) : 'n/a'}, end=${end ? this.localTs(end) : 'n/a'}, intervalMin=${intervalMin}).`,
			);
			return null;
		}
		const slot = nextSlotInWindow(start.getTime(), end.getTime(), interval, now.getTime());
		if (slot !== null) {
			const d = new Date(slot);
			this.log.silly(`Switch ${this.swLabel(sw)}: next slot within today's window -> ${this.localTs(d)}.`);
			return d;
		}
		// past the window -> first slot of tomorrow's window
		const tomorrowRef = new Date(now);
		tomorrowRef.setDate(tomorrowRef.getDate() + 1);
		let tomorrowStart;
		if (sw.astroWindowEnabled) {
			const win2 = this.sunWindowFor(sw, tomorrowRef);
			tomorrowStart = win2 && win2.start;
		} else {
			tomorrowStart = new Date(start);
			tomorrowStart.setDate(tomorrowStart.getDate() + 1);
		}
		if (!tomorrowStart) {
			return null;
		}
		this.log.silly(`Switch ${this.swLabel(sw)}: after window -> next is tomorrow ${this.localTs(tomorrowStart)}.`);
		return tomorrowStart;
	}

	/**
	 * Builds a Date for today at "HH:mm".
	 *
	 * @param {string} hhmm - time string in "HH:mm" format
	 * @param {Date} ref - reference date (provides the day)
	 * @returns {Date | null} the resulting date or null if the input is invalid
	 */
	timeToDate(hhmm, ref) {
		if (typeof hhmm !== 'string' || !/^\d{1,2}:\d{2}/.test(hhmm)) {
			return null;
		}
		const [h, m] = hhmm.split(':').map(x => parseInt(x, 10));
		if (h > 23 || m > 59) {
			return null;
		}
		const d = new Date(ref);
		d.setHours(h, m, 0, 0);
		return d;
	}

	// ----------------------------------------------------------------------------
	// Feeding & blocking
	// ----------------------------------------------------------------------------

	/**
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {boolean} ignoreBlocks - if true, temperature/night blocks are skipped
	 * @param {number | null} [durationOverrideSec] - overrides the configured duration (manual button)
	 */
	async feed(sw, ignoreBlocks, durationOverrideSec = null) {
		if (!sw.objectId) {
			this.log.warn(`Switch ${this.swLabel(sw)} has no target object, skipping.`);
			return;
		}
		if (this.feedingBusy.has(sw.id)) {
			this.log.debug(`Switch ${this.swLabel(sw)}: a feeding cycle is already running, ignoring this trigger.`);
			return;
		}

		this.log.debug(`Evaluating feeding for ${this.swLabel(sw)} (ignoreBlocks=${ignoreBlocks}).`);
		const reason = ignoreBlocks ? null : this.getBlockReason(sw);
		const blocked = !!reason;
		const reasonText = reason ? this.t(reason.key, reason.params) : '';
		await this.setStateAsync(`switches.${sw.id}.status.blocked`, { val: blocked, ack: true });
		await this.setStateAsync(`switches.${sw.id}.status.blockReason`, { val: reasonText, ack: true });
		await this.setStateAsync(`switches.${sw.id}.status.blockReasonCode`, {
			val: reason ? reason.key : '',
			ack: true,
		});
		if (reason) {
			// log in English for consistent, language-independent logs
			this.log.info(`Feeding of ${this.swLabel(sw)} blocked: ${translate(reason.key, 'en', reason.params)}`);
			return;
		}

		const verify = sw.verifyEnabled !== false;
		const rawSeconds =
			durationOverrideSec !== undefined &&
			durationOverrideSec !== null &&
			!Number.isNaN(Number(durationOverrideSec))
				? Math.max(0, Number(durationOverrideSec))
				: this.effectiveDurationSec(sw);
		// hard upper bound so a mis-configured value cannot hang the ON phase
		const seconds = Math.min(MAX_DURATION_SEC, Math.max(0, rawSeconds));
		if (seconds !== rawSeconds) {
			this.log.warn(
				`Feeding duration for ${this.swLabel(sw)} clamped from ${rawSeconds}s to ${seconds}s (max ${MAX_DURATION_SEC}s).`,
			);
		}
		this.feedingBusy.add(sw.id);
		try {
			// --- switch ON ---
			this.log.info(`Feeding ${this.swLabel(sw)} for ${seconds}s.`);
			await this.writeSwitch(sw, true);
			await this.setStateAsync(`switches.${sw.id}.status.feedingActive`, { val: true, ack: true });
			await this.setStateAsync(`switches.${sw.id}.status.lastFeeding`, {
				val: this.localTs(new Date()),
				ack: true,
			});
			await this.setStateAsync(`switches.${sw.id}.status.lastFeedingTs`, { val: Date.now(), ack: true });
			// end time and total duration of this feeding (for a live runtime countdown
			// and a progress ring in VIS); both are cleared in finally
			await this.setStateAsync(`switches.${sw.id}.status.feedingEndsTs`, {
				val: Date.now() + seconds * 1000,
				ack: true,
			});
			await this.setStateAsync(`switches.${sw.id}.status.feedingDurationSec`, {
				val: seconds,
				ack: true,
			});

			if (verify) {
				const onConfirmed = await this.verifyState(sw, true);
				if (this.terminating) {
					return;
				}
				if (!onConfirmed) {
					// Scenario 2: the switch never confirmed the ON state
					await this.writeSwitch(sw, false); // safety: try to switch off again
					await this.setStateAsync(`switches.${sw.id}.status.feedingActive`, { val: false, ack: true });
					this.log.error(
						`Feeding of ${this.swLabel(sw)} could not be performed - switch did not confirm ON. Check the switch!`,
					);
					const failMsg = this.t('feedOnFail');
					await this.reportResult(sw, true, failMsg);
					this.notify(sw, 'onFail', failMsg);
					return;
				}
				this.log.debug(`${this.swLabel(sw)}: ON confirmed by target.`);
			}

			// --- keep on for the configured duration (this.delay is cleared on unload) ---
			this.log.debug(`Switch ${this.swLabel(sw)} is ON, will switch OFF in ${seconds}s.`);
			if (seconds > 0) {
				await this.delay(seconds * 1000);
			}
			if (this.terminating) {
				return;
			}

			// --- switch OFF ---
			await this.writeSwitch(sw, false);
			await this.setStateAsync(`switches.${sw.id}.status.feedingActive`, { val: false, ack: true });

			if (verify) {
				const offConfirmed = await this.verifyState(sw, false);
				if (this.terminating) {
					return;
				}
				if (!offConfirmed) {
					// Scenario 3: ON worked, but the switch did not turn OFF again
					this.log.error(
						`Fault: ${this.swLabel(sw)} did not switch OFF as planned (still ON?). Check the switch!`,
					);
					const offFailMsg = this.t('feedOffFail');
					await this.reportResult(sw, true, offFailMsg);
					this.notify(sw, 'offFail', offFailMsg);
					return;
				}
				this.log.debug(`${this.swLabel(sw)}: OFF confirmed by target.`);
			}

			// --- Scenario 1: everything worked ---
			const okMsg = this.t('feedSuccess', { seconds });
			await this.reportResult(sw, false, okMsg);
			this.notify(sw, 'success', okMsg);
			// log in English (language-independent); the localized text goes to the datapoint/Telegram
			this.log.info(`${this.swLabel(sw)}: ${translate('feedSuccess', 'en', { seconds })}`);
		} finally {
			this.feedingBusy.delete(sw.id);
			// clear the runtime countdown end time and duration whichever way the feeding ended
			await this.setStateAsync(`switches.${sw.id}.status.feedingEndsTs`, { val: 0, ack: true });
			await this.setStateAsync(`switches.${sw.id}.status.feedingDurationSec`, { val: 0, ack: true });
		}
	}

	/**
	 * Confirms that the controlled switch reached the expected (acknowledged) value.
	 *
	 * Robust against delayed status feedback (e.g. Homematic radio round-trips):
	 * each attempt first reads back the current acknowledged value and, if it does
	 * not match yet, waits up to `verifyTimeoutSec` for a fresh acknowledged change.
	 * This is repeated `verifyRetries` times (staggered re-checks) before a fault is
	 * reported, with a final read-back afterwards. Only ack=true values count, so
	 * our own command cannot confirm itself.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {boolean} expectOn - true = wait for the on value, false = off value
	 * @returns {Promise<boolean>} true if confirmed, false after all attempts time out
	 */
	async verifyState(sw, expectOn) {
		const expected = coerce(expectOn ? (sw.onValue ?? true) : (sw.offValue ?? false));
		const timeoutMs = Math.min(MAX_VERIFY_TIMEOUT_SEC, Math.max(1, Number(sw.verifyTimeoutSec) || 5)) * 1000;
		const attempts = Math.max(1, Number(sw.verifyRetries) || 3);
		const label = expectOn ? 'ON' : 'OFF';
		this.log.silly(
			`Verification armed for ${this.swLabel(sw)} expecting ${label}=${JSON.stringify(expected)} (${attempts} attempt(s) x ${timeoutMs}ms).`,
		);

		for (let attempt = 1; attempt <= attempts; attempt++) {
			// fast path: a status echo may already have arrived (or been missed as
			// an event) - accept the current acknowledged value if it matches
			if (await this.readConfirmed(sw.objectId, expected)) {
				this.log.debug(
					`Verification CONFIRMED for ${this.swLabel(sw)} expecting ${label} via state read (attempt ${attempt}/${attempts}).`,
				);
				return true;
			}
			// otherwise wait for a fresh acknowledged change within this window
			const confirmed = await this.waitForAck(sw, expected, timeoutMs);
			if (this.terminating) {
				return false;
			}
			if (confirmed) {
				this.log.debug(
					`Verification CONFIRMED for ${this.swLabel(sw)} expecting ${label} via ack event (attempt ${attempt}/${attempts}).`,
				);
				return true;
			}
			this.log.debug(
				`Verification attempt ${attempt}/${attempts} for ${this.swLabel(sw)} expecting ${label} timed out after ${timeoutMs}ms.`,
			);
		}
		// final read-back: the acknowledgement may have arrived right at the end
		if (await this.readConfirmed(sw.objectId, expected)) {
			this.log.debug(`Verification CONFIRMED for ${this.swLabel(sw)} expecting ${label} via final state read.`);
			return true;
		}
		this.log.debug(`Verification FAILED for ${this.swLabel(sw)} expecting ${label} after ${attempts} attempt(s).`);
		return false;
	}

	/**
	 * Reads the current value of a foreign state and checks whether it is an
	 * acknowledged (ack=true) value matching `expected`. Used as the active
	 * read-back that complements the event-based watcher.
	 *
	 * @param {string} objectId - the controlled foreign state id
	 * @param {boolean | number | string} expected - the configured target value
	 * @returns {Promise<boolean>} true if the confirmed current value matches
	 */
	async readConfirmed(objectId, expected) {
		try {
			const st = await this.getForeignStateAsync(objectId);
			return !!st && st.ack === true && this.valuesMatch(st.val, expected);
		} catch (e) {
			this.log.warn(`Could not read ${objectId} for verification: ${e.message}`);
			return false;
		}
	}

	/**
	 * Waits up to `timeoutMs` for an acknowledged change of the switch's state to
	 * the expected value (resolved by onStateChange via the watcher map).
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {boolean | number | string} expected - the configured target value
	 * @param {number} timeoutMs - how long to wait in milliseconds
	 * @returns {Promise<boolean>} true if confirmed within the window, false on timeout
	 */
	waitForAck(sw, expected, timeoutMs) {
		return new Promise(resolve => {
			const timer = this.setTimeout(() => {
				this.verifyWatchers.delete(sw.objectId);
				resolve(false);
			}, timeoutMs);
			this.verifyWatchers.set(sw.objectId, { expected, resolve, timer });
		});
	}

	/**
	 * Loose comparison of an actual state value against the expected value.
	 *
	 * @param {ioBroker.StateValue} actual - the value reported by the switch
	 * @param {boolean | number | string} expected - the configured target value
	 * @returns {boolean} true if they are considered equal
	 */
	valuesMatch(actual, expected) {
		if (typeof expected === 'boolean') {
			return Boolean(actual) === expected;
		}
		if (typeof expected === 'number') {
			return Number(actual) === expected;
		}
		return String(actual) === String(expected);
	}

	/**
	 * Stores the outcome of a feeding attempt in the per-switch status datapoints.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {boolean} isError - true if the attempt had a switching fault
	 * @param {string} message - human readable result text
	 */
	async reportResult(sw, isError, message) {
		await this.setStateAsync(`switches.${sw.id}.status.lastResult`, { val: message, ack: true });
		await this.setStateAsync(`switches.${sw.id}.status.error`, { val: isError, ack: true });
	}

	/**
	 * Sends a supervision message to the switch's configured Telegram instance,
	 * if a recipient is configured and the message type is enabled for this switch.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {'success' | 'onFail' | 'offFail'} type - message category
	 * @param {string} message - the text to send
	 */
	notify(sw, type, message) {
		const instance = sw.telegramInstance;
		if (!instance) {
			this.log.silly(`No Telegram instance configured for ${this.swLabel(sw)}; skipping "${type}" notification.`);
			return;
		}
		const want = type === 'success' ? sw.notifySuccess : type === 'onFail' ? sw.notifyOnFail : sw.notifyOffFail;
		if (!want) {
			this.log.silly(`Notification "${type}" for ${this.swLabel(sw)} is disabled.`);
			return;
		}
		const text = `${sw.name || sw.id}: ${message}`;
		const payload = sw.telegramUser ? { text, user: sw.telegramUser } : { text };
		// English log line; the message body itself (text) is localized for the recipient
		this.log.debug(
			`Sending Telegram "${type}" notification via ${instance} to ${sw.telegramUser || 'all'} for ${this.swLabel(sw)}.`,
		);
		try {
			this.sendTo(instance, payload);
		} catch (e) {
			this.log.warn(`Could not send Telegram message via ${instance}: ${e.message}`);
		}
	}

	// ----------------------------------------------------------------------------
	// Winter pause
	// ----------------------------------------------------------------------------

	/**
	 * Effective feeding duration: the winter duration while a non-suspending winter
	 * pause is active, otherwise the normal duration.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {number} duration in seconds
	 */
	effectiveDurationSec(sw) {
		if (
			sw.winterEnabled &&
			sw.winterMode !== 'suspend' &&
			isInWinterPause(sw.winterStart, sw.winterEnd, new Date())
		) {
			const d = Number(sw.winterDurationSec) || 0;
			this.log.silly(`Duration ${this.swLabel(sw)}: winter (${sw.winterMode}) -> ${d}s.`);
			return d;
		}
		if (sw.dynamicEnabled) {
			const t = this.dynamicTemp(sw);
			const d = q10DurationSec(
				Number(sw.dynamicBaseDurationSec) || 0,
				t,
				Number(sw.dynamicTRef),
				Number(sw.dynamicQ10),
				Number(sw.dynamicMinDurationSec) || 0,
				Number(sw.dynamicMaxDurationSec) || 0,
			);
			this.log.silly(`Duration ${this.swLabel(sw)}: dynamic @ ${t.toFixed(1)}°C -> ${d}s.`);
			return d;
		}
		const d = Number(sw.durationSec) || 0;
		this.log.silly(`Duration ${this.swLabel(sw)}: static -> ${d}s.`);
		return d;
	}

	// ----------------------------------------------------------------------------
	// Dynamic feeding (Q10)
	// ----------------------------------------------------------------------------

	/**
	 * Moving-average temperature for the switch's dynamic source, or the reference
	 * temperature (rate 1) when no samples are available yet.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {number} the temperature to feed into the Q10 model
	 */
	dynamicTemp(sw) {
		const avg = this.dynamicAvg(sw);
		if (avg !== null) {
			return avg;
		}
		const tRef = Number(sw.dynamicTRef);
		return Number.isFinite(tRef) ? tRef : 20;
	}

	/**
	 * Computes the temperature-adapted interval, writes the dynamic status data
	 * points and returns the next feeding time within the configured window.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {Date} now - reference time
	 * @returns {Date | null} the next feeding time or null
	 */
	planDynamic(sw, now) {
		const avg = this.dynamicAvg(sw);
		const tRef = Number(sw.dynamicTRef);
		const q10 = Number(sw.dynamicQ10);
		const t = avg !== null ? avg : Number.isFinite(tRef) ? tRef : 20;
		const interval = q10IntervalMin(
			Number(sw.dynamicBaseIntervalMin) || 0,
			t,
			tRef,
			q10,
			Number(sw.dynamicMinIntervalMin) || 0,
			Number(sw.dynamicMaxIntervalMin) || 0,
		);
		const duration = q10DurationSec(
			Number(sw.dynamicBaseDurationSec) || 0,
			t,
			tRef,
			q10,
			Number(sw.dynamicMinDurationSec) || 0,
			Number(sw.dynamicMaxDurationSec) || 0,
		);
		const rate = q10Rate(t, tRef, q10);
		this.dynamicAppliedInterval.set(sw.id, interval);
		this.setStateAsync(`switches.${sw.id}.status.dynamicAvgTemperature`, { val: avg, ack: true });
		this.setStateAsync(`switches.${sw.id}.status.dynamicRate`, { val: Math.round(rate * 1000) / 1000, ack: true });
		this.setStateAsync(`switches.${sw.id}.status.dynamicIntervalMin`, { val: interval, ack: true });
		this.setStateAsync(`switches.${sw.id}.status.dynamicDurationSec`, { val: duration, ack: true });
		this.log.debug(
			`Dynamic ${this.swLabel(sw)}: avg=${avg === null ? 'n/a' : `${avg.toFixed(1)}°C`} rate=${rate.toFixed(2)} -> interval ${interval} min, duration ${duration}s.`,
		);
		return this.nextFromInterval(sw, now, interval);
	}

	/**
	 * Hourly refresh: re-plans dynamic switches when the newly computed interval
	 * differs from the applied one by more than the hysteresis, so a mid-cycle
	 * temperature change is honored without flapping.
	 */
	refreshDynamicSchedules() {
		for (const sw of this.switches) {
			if (!sw.enabled || !sw.objectId || !sw.dynamicEnabled) {
				continue;
			}
			// winter pause controls the schedule while it is active
			if (sw.winterEnabled && isInWinterPause(sw.winterStart, sw.winterEnd, new Date())) {
				this.log.silly(`Dynamic refresh ${this.swLabel(sw)}: skipped (winter pause active).`);
				continue;
			}
			if (this.feedingBusy.has(sw.id)) {
				this.log.silly(`Dynamic refresh ${this.swLabel(sw)}: skipped (a feeding cycle is running).`);
				continue;
			}
			const applied = Number(this.dynamicAppliedInterval.get(sw.id)) || 0;
			const next = q10IntervalMin(
				Number(sw.dynamicBaseIntervalMin) || 0,
				this.dynamicTemp(sw),
				Number(sw.dynamicTRef),
				Number(sw.dynamicQ10),
				Number(sw.dynamicMinIntervalMin) || 0,
				Number(sw.dynamicMaxIntervalMin) || 0,
			);
			const hyst = Number(sw.dynamicHysteresisPct) || 0;
			if (!applied || (Math.abs(next - applied) / Math.max(1, applied)) * 100 > hyst) {
				this.log.debug(
					`Dynamic ${this.swLabel(sw)}: interval ${applied || 'n/a'} -> ${next} min (beyond ${hyst}% hysteresis), re-planning.`,
				);
				this.scheduleSwitch(sw);
			} else {
				this.log.silly(
					`Dynamic refresh ${this.swLabel(sw)}: interval ${applied} -> ${next} min within ${hyst}% hysteresis, keeping current plan.`,
				);
			}
		}
	}

	/**
	 * Local date as "YYYY-MM-DD" (used to de-duplicate once-per-day reminders).
	 *
	 * @param date
	 */
	localDateKey(date) {
		const mm = String(date.getMonth() + 1).padStart(2, '0');
		const dd = String(date.getDate()).padStart(2, '0');
		return `${date.getFullYear()}-${mm}-${dd}`;
	}

	/**
	 * Local date formatted as "DD.MM.YYYY" for user-facing messages.
	 *
	 * @param date
	 */
	formatLocalDate(date) {
		if (!(date instanceof Date)) {
			return '';
		}
		const mm = String(date.getMonth() + 1).padStart(2, '0');
		const dd = String(date.getDate()).padStart(2, '0');
		return `${dd}.${mm}.${date.getFullYear()}`;
	}

	/**
	 * Sends a winter-pause reminder to the switch's Telegram instance (if configured).
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {string} key - message key from lib/messages
	 * @param {Record<string, string | number>} [params] - placeholder values
	 */
	notifyWinter(sw, key, params) {
		const instance = sw.telegramInstance;
		if (!instance) {
			this.log.debug(`Winter reminder for ${this.swLabel(sw)} not sent: no Telegram instance configured.`);
			return;
		}
		const text = `${sw.name || sw.id}: ${this.t(key, params)}`;
		const payload = sw.telegramUser ? { text, user: sw.telegramUser } : { text };
		// English log line; the reminder body (text) is localized for the recipient
		this.log.info(
			`Sending winter reminder "${key}" via ${instance} to ${sw.telegramUser || 'all'} for ${this.swLabel(sw)}.`,
		);
		try {
			this.sendTo(instance, payload);
		} catch (e) {
			this.log.warn(`Could not send Telegram message via ${instance}: ${e.message}`);
		}
	}

	/** Arms an hourly tick (top of the hour) that dispatches due winter reminders. */
	scheduleReminderTick() {
		if (this.reminderTimer) {
			this.clearTimeout(this.reminderTimer);
			this.reminderTimer = null;
		}
		const now = new Date();
		const next = new Date(now);
		next.setHours(now.getHours() + 1, 0, 15, 0); // 15s past the next full hour
		const delay = Math.max(1000, next.getTime() - now.getTime());
		this.reminderTimer = this.setTimeout(async () => {
			this.reminderTimer = null;
			try {
				await this.checkWinterReminders();
			} catch (e) {
				this.log.warn(`Winter reminder check failed: ${e.message}`);
			}
			try {
				this.refreshDynamicSchedules();
			} catch (e) {
				this.log.warn(`Dynamic schedule refresh failed: ${e.message}`);
			}
			this.scheduleReminderTick();
		}, delay);
		this.log.silly(`Hourly tick armed (in ${Math.round(delay / 1000)}s).`);
	}

	/**
	 * Sends winter start/end reminders that are due today at the configured hour,
	 * at most once per day per switch (de-duplicated via status data points).
	 */
	async checkWinterReminders() {
		const now = new Date();
		const hour = now.getHours();
		const todayKey = this.localDateKey(now);
		for (const sw of this.switches) {
			if (!sw.enabled || !sw.winterEnabled) {
				continue;
			}
			if (hour !== (Number(sw.winterReminderHour) || 0)) {
				continue;
			}
			const reduced = sw.winterMode !== 'suspend';
			// reminder before the winter pause starts
			if (sw.winterStartReminderEnabled) {
				if (reminderDue(sw.winterStart, sw.winterStartReminderDays, now)) {
					const st = await this.getStateAsync(`switches.${sw.id}.status.winterLastStartReminder`);
					if (!st || st.val !== todayKey) {
						const dateStr = this.formatLocalDate(nextMDDate(sw.winterStart, now));
						this.notifyWinter(sw, reduced ? 'winterStartReduced' : 'winterStartSuspend', { date: dateStr });
						await this.setStateAsync(`switches.${sw.id}.status.winterLastStartReminder`, {
							val: todayKey,
							ack: true,
						});
					}
				}
			}
			// reminder before the winter pause ends
			if (sw.winterEndReminderEnabled) {
				if (reminderDue(sw.winterEnd, sw.winterEndReminderDays, now)) {
					const st = await this.getStateAsync(`switches.${sw.id}.status.winterLastEndReminder`);
					if (!st || st.val !== todayKey) {
						const dateStr = this.formatLocalDate(nextMDDate(sw.winterEnd, now));
						this.notifyWinter(sw, reduced ? 'winterEndReduced' : 'winterEndSuspend', { date: dateStr });
						await this.setStateAsync(`switches.${sw.id}.status.winterLastEndReminder`, {
							val: todayKey,
							ack: true,
						});
					}
				}
			}
		}
	}

	/**
	 * Writes the on/off value to the target foreign state.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {boolean} on - true writes the on value, false the off value
	 */
	async writeSwitch(sw, on) {
		const value = coerce(on ? (sw.onValue ?? true) : (sw.offValue ?? false));
		this.log.debug(`Writing ${on ? 'ON' : 'OFF'} value ${JSON.stringify(value)} to ${sw.objectId}.`);
		try {
			await this.setForeignStateAsync(sw.objectId, { val: value, ack: false });
		} catch (e) {
			this.log.error(`Could not write ${sw.objectId}: ${e.message}`);
		}
	}

	/**
	 * Current value of a switch's own air/water/oxygen source, or null.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @param {'air' | 'water' | 'o2'} kind - which source
	 * @returns {number | null} the current value, or null if unknown/disabled
	 */
	sourceValue(sw, kind) {
		let objId = '';
		if (kind === 'air') {
			objId = sw.airTempEnabled ? sw.airTempObjectId : '';
		} else if (kind === 'water') {
			objId = sw.waterTempEnabled ? sw.waterTempObjectId : '';
		} else if (kind === 'o2') {
			objId = sw.o2Enabled ? sw.o2ObjectId : '';
		}
		if (!objId) {
			return null;
		}
		const v = this.foreignValues.get(objId);
		return v === undefined ? null : v;
	}

	/**
	 * Current water temperature used for the water-temperature block: the coldest of the
	 * shallow (feeding-zone) and the optional deep sensor, so a cold layer is never
	 * ignored. Falls back to whichever value is known.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {number | null} the conservative current water temperature, or null
	 */
	blockWaterValue(sw) {
		const shallow = this.sourceValue(sw, 'water');
		if (!sw.waterTemp2Enabled || !sw.waterTemp2ObjectId) {
			return shallow;
		}
		const dv = this.foreignValues.get(sw.waterTemp2ObjectId);
		const deep = dv === undefined ? null : dv;
		return combineWaterTemp('coldest', shallow, deep, 0);
	}

	/**
	 * Moving-average temperature that drives dynamic feeding: the air source, or the
	 * water source combined from the shallow (feeding-zone) and optional deep sensor
	 * according to the switch's waterCombineMode. Returns null when no samples exist yet.
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {number | null} the averaged temperature, or null if unavailable
	 */
	dynamicAvg(sw) {
		const now = Date.now();
		const hours = Number(sw.dynamicBufferHours) || 24;
		const avgOf = objId =>
			objId && this.foreignBuffers.has(objId) ? averageOver(this.foreignBuffers.get(objId), now, hours) : null;
		if (sw.dynamicSource === 'air') {
			return avgOf(sw.airTempEnabled ? sw.airTempObjectId : '');
		}
		// water: combine the shallow (feeding-zone) and optional deep sensor
		const shallowAvg = avgOf(sw.waterTempEnabled ? sw.waterTempObjectId : '');
		if (!sw.waterTemp2Enabled || !sw.waterTemp2ObjectId) {
			return shallowAvg;
		}
		const deepAvg = avgOf(sw.waterTemp2ObjectId);
		return combineWaterTemp(
			sw.waterCombineMode || 'shallow',
			shallowAvg,
			deepAvg,
			Number(sw.waterSeasonalThresholdC) || 0,
		);
	}

	/**
	 * Returns the reason why feeding is blocked, or null if feeding is allowed.
	 * The reason is a message key + params so the caller can render it both
	 * localized (status datapoint) and in English (log).
	 *
	 * @param {ioBroker.AutomaticFeederSwitchConfig} sw - switch configuration
	 * @returns {{ key: string, params?: Record<string, string | number> } | null} block reason or null
	 */
	getBlockReason(sw) {
		// manual master pause (pauseNow) - suspends all feeding, highest priority of all
		if (sw.pauseNow) {
			return { key: 'blockPauseManual' };
		}
		// absolute feeding pause (e.g. quarantine after restocking)
		const pinfo = pauseInfo(this.pauseRanges(sw), Date.now());
		if (pinfo.active) {
			return { key: 'blockPause', params: { date: pinfo.until ? this.localTs(new Date(pinfo.until)) : '' } };
		}
		// astronomical day window (sunrise/sunset +/- per-switch offsets).
		// For interval/dynamic modes the window is already enforced by the scheduler
		// (nextFromInterval only plans slots inside it), so guarding here would only risk a
		// false block on the very last slot due to timer latency. The guard therefore applies
		// to fixed-times mode, where it is what keeps feeding within the daytime window.
		const fixedTimesMode = !sw.dynamicEnabled && (sw.mode || 'times') === 'times';
		if (sw.astroWindowEnabled && fixedTimesMode) {
			const win = this.switchWindows.get(sw.id);
			if (win) {
				const now = Date.now();
				this.log.silly(
					`Block check ${this.swLabel(sw)}: now=${this.localTs(new Date(now))} window=${this.localTs(win.start)}..${this.localTs(win.end)}`,
				);
				if (now < win.start.getTime() || now > win.end.getTime()) {
					return { key: 'blockNight' };
				}
			} else {
				this.log.silly(`Block check ${this.swLabel(sw)}: astro window requested but not available.`);
			}
		}
		// water temperature (this switch's own source). With a second (deep) sensor the
		// block conservatively uses the COLDEST of both layers.
		if (sw.blockWaterEnabled) {
			const water = this.blockWaterValue(sw);
			this.log.silly(
				`Block check ${this.swLabel(sw)}: water=${water ?? 'unknown'}°C (coldest layer), min=${sw.waterMin}, max=${sw.waterMax}`,
			);
			if (water !== null) {
				if (sw.waterMin !== null && sw.waterMin !== undefined && water < sw.waterMin) {
					return { key: 'blockWaterBelow', params: { temp: water, limit: sw.waterMin } };
				}
				if (sw.waterMax !== null && sw.waterMax !== undefined && water > sw.waterMax) {
					return { key: 'blockWaterAbove', params: { temp: water, limit: sw.waterMax } };
				}
			}
		}
		// air temperature (this switch's own source)
		if (sw.blockAirEnabled) {
			const air = this.sourceValue(sw, 'air');
			this.log.silly(
				`Block check ${this.swLabel(sw)}: air=${air ?? 'unknown'}°C, min=${sw.airMin}, max=${sw.airMax}`,
			);
			if (air !== null) {
				if (sw.airMin !== null && sw.airMin !== undefined && air < sw.airMin) {
					return { key: 'blockAirBelow', params: { temp: air, limit: sw.airMin } };
				}
				if (sw.airMax !== null && sw.airMax !== undefined && air > sw.airMax) {
					return { key: 'blockAirAbove', params: { temp: air, limit: sw.airMax } };
				}
			}
		}
		// dissolved oxygen too low (water quality safety, this switch's own source)
		if (sw.blockO2Enabled) {
			const o2 = this.sourceValue(sw, 'o2');
			this.log.silly(`Block check ${this.swLabel(sw)}: o2=${o2 ?? 'unknown'}, min=${sw.o2Min}`);
			if (o2 !== null && sw.o2Min !== null && sw.o2Min !== undefined && o2 < sw.o2Min) {
				return { key: 'blockOxygenLow', params: { value: o2, limit: sw.o2Min } };
			}
		}
		this.log.silly(`Block check ${this.swLabel(sw)}: no block, feeding allowed.`);
		return null;
	}

	// ----------------------------------------------------------------------------
	// Events
	// ----------------------------------------------------------------------------

	/**
	 * @param {string} id - State ID
	 * @param {ioBroker.State | null | undefined} state - the new state or null on deletion
	 */
	async onStateChange(id, state) {
		if (!state) {
			this.log.silly(`State ${id} deleted.`);
			return;
		}
		this.log.silly(`State change: ${id} = ${state.val} (ack=${state.ack})`);

		// per-switch temperature / oxygen sources (foreign states). These are read-only
		// inputs we never write to, so there is no command echo to guard against - the
		// value is accepted on any ack (real sensors send ack=true, but script/userdata
		// sources are commonly ack=false and must still work). The ack flag is logged for
		// transparency, and a persistently un-acknowledged source is surfaced once so a
		// mis-pointed source (e.g. a command/setpoint state) stays diagnosable. The strict
		// ack=true rule remains where it matters: the switch on/off verification.
		if (this.tempObjectIds.has(id) || this.o2ObjectIds.has(id)) {
			if (state.ack !== true && !this.unackedSources.has(id)) {
				this.unackedSources.add(id);
				this.log.debug(
					`Source ${id} delivers un-acknowledged values (ack=false) - using them anyway (e.g. a script/userdata source).`,
				);
			}
			const value = state.val === null ? null : Number(state.val);
			this.foreignValues.set(id, value);
			if (this.tempObjectIds.has(id) && value !== null) {
				this.pushTempSample(id, value);
			}
			await this.updateSourceMirrors(id, value);
			this.log.debug(`Source updated: ${id} = ${value ?? 'unknown'} (ack=${state.ack === true}).`);
			return;
		}

		// switch-state supervision: confirm an acknowledged on/off transition.
		// Only ack=true counts - our own command (ack=false) must not confirm itself.
		const watcher = this.verifyWatchers.get(id);
		if (watcher && state.ack === true && this.valuesMatch(state.val, watcher.expected)) {
			this.clearTimeout(watcher.timer);
			this.verifyWatchers.delete(id);
			this.log.debug(
				`Verification CONFIRMED for ${id}: acknowledged value ${state.val} matches expected ${JSON.stringify(watcher.expected)}.`,
			);
			watcher.resolve(true);
			return;
		}

		// manual trigger (own state, command => ack === false)
		const m = id.match(/switches\.([^.]+)\.feedNow$/);
		if (m && state.ack === false && state.val) {
			const sw = this.switches.find(s => s.id === m[1]);
			if (sw) {
				this.log.info(
					`Manual feeding triggered for ${this.swLabel(sw)} (ignoreBlocks=${!!sw.manualIgnoresBlocks}).`,
				);
				await this.feed(sw, !!sw.manualIgnoresBlocks);
			} else {
				this.log.warn(`Manual trigger for unknown switch id "${m[1]}".`);
			}
			await this.setStateAsync(id, { val: false, ack: true });
			return;
		}

		// manual trigger with a one-off duration in seconds (own state, command => ack === false)
		const fm = id.match(/switches\.([^.]+)\.feedFor$/);
		if (fm && state.ack === false) {
			const sw = this.switches.find(s => s.id === fm[1]);
			const seconds = Math.min(MAX_DURATION_SEC, Math.max(0, Number(state.val) || 0));
			if (sw && seconds > 0) {
				this.log.info(
					`Manual feeding (feedFor) triggered for ${this.swLabel(sw)} for ${seconds}s (ignoreBlocks=${!!sw.manualIgnoresBlocks}).`,
				);
				await this.feed(sw, !!sw.manualIgnoresBlocks, seconds);
			} else if (!sw) {
				this.log.warn(`feedFor trigger for unknown switch id "${fm[1]}".`);
			} else {
				this.log.debug(`feedFor for ${this.swLabel(sw)} ignored (value ${state.val} -> ${seconds}s).`);
			}
			// reset so the state acts like a command and is ready for the next write
			await this.setStateAsync(id, { val: 0, ack: true });
			return;
		}

		// editable settings written from VIS/scripts (command => ack === false)
		const sm = id.match(/switches\.([^.]+)\.settings\.([^.]+)$/);
		if (sm && state.ack === false) {
			this.queueSettingWrite(sm[1], sm[2], state.val);
			await this.setStateAsync(id, { val: state.val, ack: true });
		}
	}

	/**
	 * Queues an editable-setting write from VIS/scripts and debounces the apply so
	 * several quick edits result in a single config change (one restart).
	 *
	 * @param {string} sid - switch id
	 * @param {string} key - setting key (SWITCH_SETTINGS id)
	 * @param {ioBroker.StateValue} val - the written value
	 */
	queueSettingWrite(sid, key, val) {
		if (SETTINGS_READONLY.has(key)) {
			this.log.debug(`Ignoring write to read-only setting "${key}".`);
			return;
		}
		const desc = SWITCH_SETTINGS.find(s => s.id === key);
		if (!desc) {
			this.log.warn(`Write to unknown setting "${key}" ignored.`);
			return;
		}
		if (!this.pendingSettingWrites.has(sid)) {
			this.pendingSettingWrites.set(sid, {});
		}
		this.pendingSettingWrites.get(sid)[key] = { val, type: desc.type };
		this.log.debug(`Queued setting write ${sid}.${key} = ${JSON.stringify(val)}.`);
		if (this.settingsWriteTimer) {
			this.clearTimeout(this.settingsWriteTimer);
		}
		this.settingsWriteTimer = this.setTimeout(() => {
			this.settingsWriteTimer = null;
			this.flushSettingWrites().catch(e => this.log.warn(`Applying setting writes failed: ${e.message}`));
		}, 3000);
	}

	/** Applies all queued setting writes to the instance config in one write (restarts the adapter). */
	async flushSettingWrites() {
		if (!this.pendingSettingWrites.size) {
			return;
		}
		const pending = this.pendingSettingWrites;
		this.pendingSettingWrites = new Map();
		const objId = `system.adapter.${this.namespace}`;
		let obj;
		try {
			obj = await this.getForeignObjectAsync(objId);
		} catch (e) {
			this.log.warn(`Could not read ${objId} to apply setting writes: ${e.message}`);
			return;
		}
		if (!obj || !obj.native) {
			return;
		}
		const switches = Array.isArray(obj.native.switches) ? obj.native.switches : [];
		let changed = 0;
		for (const [sid, edits] of pending) {
			const sw = switches.find(s => s && s.id === sid);
			if (!sw) {
				this.log.warn(`Setting write for unknown switch "${sid}" ignored.`);
				continue;
			}
			for (const key of Object.keys(edits)) {
				this.applyOneSetting(sw, key, edits[key].type, edits[key].val);
				changed++;
			}
		}
		if (!changed) {
			return;
		}
		obj.native.switches = switches;
		await this.setForeignObjectAsync(objId, obj);
		this.log.info(`Applied ${changed} setting change(s) from VIS/states; the adapter restarts to apply them.`);
	}

	/**
	 * Writes one setting value into a switch config object with the right coercion.
	 *
	 * @param {Record<string, unknown>} sw - the switch config object (from native)
	 * @param {string} key - setting key
	 * @param {string} type - descriptor type ("string" | "number" | "boolean")
	 * @param {ioBroker.StateValue} val - the written value
	 */
	applyOneSetting(sw, key, type, val) {
		if (key === 'times') {
			sw.times = String(val ?? '')
				.split(',')
				.map(x => x.trim())
				.filter(x => /^\d{1,2}:\d{2}$/.test(x));
			return;
		}
		if (
			key === 'airTempObjectId' ||
			key === 'waterTempObjectId' ||
			key === 'waterTemp2ObjectId' ||
			key === 'o2ObjectId'
		) {
			const enableField =
				key === 'airTempObjectId'
					? 'airTempEnabled'
					: key === 'waterTempObjectId'
						? 'waterTempEnabled'
						: key === 'waterTemp2ObjectId'
							? 'waterTemp2Enabled'
							: 'o2Enabled';
			const s = String(val ?? '').trim();
			sw[key] = s;
			sw[enableField] = s !== '';
			return;
		}
		if (type === 'boolean') {
			sw[key] = val === true || val === 'true' || val === 1 || val === '1';
		} else if (type === 'number') {
			if (NULLABLE_SETTINGS.has(key)) {
				const n = val === '' || val === null || val === undefined ? NaN : Number(val);
				sw[key] = Number.isNaN(n) ? null : n;
			} else {
				let n = Number(val) || 0;
				const bounds = NUMERIC_BOUNDS[key];
				if (bounds) {
					const clamped = Math.min(bounds[1], Math.max(bounds[0], n));
					if (clamped !== n) {
						this.log.warn(
							`Setting "${key}" value ${n} clamped to ${clamped} (allowed ${bounds[0]}..${bounds[1]}).`,
						);
						n = clamped;
					}
				}
				sw[key] = n;
			}
		} else {
			sw[key] = String(val ?? '');
		}
	}

	// ----------------------------------------------------------------------------
	// Relay board (Automatic-Feeder-Relais, ESP32)
	// ----------------------------------------------------------------------------

	/**
	 * Performs a single HTTP request against an Automatic-Feeder relay board and returns
	 * the parsed JSON body. Throws on missing host, timeout, non-2xx status or invalid JSON.
	 *
	 * @param {string} host - board IP or mDNS host, optionally "host:port" (default port 80)
	 * @param {string} path - request path incl. leading slash and query string
	 * @param {'GET' | 'POST'} [method] - HTTP method (default "GET")
	 * @returns {Promise<unknown>} the parsed JSON response
	 */
	async relayFetch(host, path, method = 'GET') {
		const authority = String(host || '')
			.trim()
			.replace(/^https?:\/\//i, '')
			.replace(/\/+$/, '');
		if (!authority) {
			throw new Error('No board address configured');
		}
		const url = `http://${authority}${path}`;
		const controller = new AbortController();
		const timer = this.setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
		try {
			this.log.silly(`Relay request ${method} ${url}`);
			const res = await fetch(url, { method, signal: controller.signal });
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			return await res.json();
		} catch (e) {
			if (e.name === 'AbortError') {
				throw new Error(`timeout after ${RELAY_TIMEOUT_MS}ms`);
			}
			throw e;
		} finally {
			this.clearTimeout(timer);
		}
	}

	/**
	 * Normalizes a relay board's /api/status (or /api/config) response into the shape the
	 * admin UI and the status datapoints consume. Called only after a successful fetch, so
	 * "connected" is always true here.
	 *
	 * @param {unknown} raw - the raw JSON returned by the board
	 * @returns {{ok: boolean, connected: boolean, host: string, ip: string, fw: string, wifi: string, times: number[], active: boolean, remaining: number, relay: boolean}} normalized status
	 */
	normalizeRelayStatus(raw) {
		const d = raw && typeof raw === 'object' ? raw : {};
		const str = v => (typeof v === 'string' ? v : '');
		const times = Array.isArray(d['times']) ? d['times'].map(n => Number(n) || 0) : [];
		return {
			ok: true,
			connected: true,
			host: str(d['host']),
			ip: str(d['ip']),
			fw: str(d['fw']),
			wifi: str(d['wifi']),
			times,
			active: !!d['active'],
			remaining: Number(d['remaining']) || 0,
			relay: !!d['relay'],
		};
	}

	/**
	 * Polls every switch's relay board once and mirrors the result into the
	 * `switches.<id>.relay.*` status datapoints. Best effort: a switch without a host or an
	 * unreachable board is reported as not connected.
	 */
	async pollRelays() {
		for (const sw of this.switches) {
			if (!sw.relayEnabled) {
				continue;
			}
			const base = `switches.${sw.id}.relay`;
			const host = sw.relayHost;
			if (!host || !String(host).trim()) {
				await this.setStateAsync(`${base}.connected`, { val: false, ack: true }).catch(() => {});
				continue;
			}
			try {
				const st = this.normalizeRelayStatus(await this.relayFetch(host, '/api/status', 'GET'));
				const info = [st.host && `host=${st.host}`, st.ip && `ip=${st.ip}`, st.fw && `fw=${st.fw}`]
					.filter(Boolean)
					.join(' ');
				await this.setStateAsync(`${base}.connected`, { val: true, ack: true }).catch(() => {});
				await this.setStateAsync(`${base}.info`, { val: info, ack: true }).catch(() => {});
				await this.setStateAsync(`${base}.active`, { val: st.active, ack: true }).catch(() => {});
				await this.setStateAsync(`${base}.remaining`, { val: st.remaining, ack: true }).catch(() => {});
				this.log.silly(`Relay ${this.swLabel(sw)} reachable at ${host} (${info}).`);
			} catch (e) {
				await this.setStateAsync(`${base}.connected`, { val: false, ack: true }).catch(() => {});
				await this.setStateAsync(`${base}.active`, { val: false, ack: true }).catch(() => {});
				this.log.debug(`Relay ${this.swLabel(sw)} not reachable at ${host}: ${e.message}`);
			}
		}
	}

	/** Schedules the next relay-board status poll (self-rescheduling, cleared in onUnload). */
	scheduleRelayPoll() {
		if (this.terminating) {
			return;
		}
		this.relayTimer = this.setTimeout(async () => {
			try {
				await this.pollRelays();
			} catch (e) {
				this.log.debug(`Relay poll failed: ${e.message}`);
			}
			this.scheduleRelayPoll();
		}, RELAY_POLL_MS);
	}

	/**
	 * Handles "geocode" requests from the admin UI (address -> coordinates via Nominatim).
	 *
	 * @param {ioBroker.Message} obj - the incoming message
	 */
	async onMessage(obj) {
		if (!obj || typeof obj !== 'object' || !obj.command) {
			return;
		}
		this.log.debug(`Message received: command="${obj.command}" from "${obj.from}".`);
		if (obj.command === 'feedNow') {
			const sid = obj.message && obj.message.switchId;
			const durationSec = obj.message && obj.message.durationSec;
			const sw = this.switches.find(s => s.id === sid);
			if (!sw) {
				this.log.warn(`Manual feed request for unknown switch id "${sid}" (save the configuration first?).`);
				if (obj.callback) {
					this.sendTo(
						obj.from,
						obj.command,
						{ error: 'Switch not found. Please save the configuration first.' },
						obj.callback,
					);
				}
				return;
			}
			this.log.info(`Manual feeding (button) for ${this.swLabel(sw)} for ${Number(durationSec) || 0}s.`);
			// run the feeding asynchronously; answer the UI immediately
			this.feed(sw, !!sw.manualIgnoresBlocks, durationSec).catch(e =>
				this.log.error(`Manual feeding failed: ${e.message}`),
			);
			if (obj.callback) {
				this.sendTo(obj.from, obj.command, { ok: true }, obj.callback);
			}
			return;
		}
		if (obj.command === 'relayGet') {
			const host = obj.message && obj.message.host;
			try {
				const data = await this.relayFetch(host, '/api/status', 'GET');
				const st = this.normalizeRelayStatus(data);
				this.log.debug(`Relay status fetched from "${host}": times=${JSON.stringify(st.times)}.`);
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, st, obj.callback);
				}
			} catch (e) {
				const msg = `Relay board not reachable: ${e.message}`;
				this.log.warn(`${msg} (host="${host}")`);
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { error: msg }, obj.callback);
				}
			}
			return;
		}
		if (obj.command === 'relaySet') {
			const host = obj.message && obj.message.host;
			const clamp = v => Math.min(RELAY_TIME_MAX_SEC, Math.max(RELAY_TIME_MIN_SEC, Math.round(Number(v))));
			const params = [];
			for (const key of ['time1', 'time2', 'time3']) {
				const raw = obj.message && obj.message[key];
				if (raw !== undefined && raw !== null && raw !== '' && Number.isFinite(Number(raw))) {
					params.push(`${key}=${clamp(raw)}`);
				}
			}
			if (!params.length) {
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { error: 'No valid times to set' }, obj.callback);
				}
				return;
			}
			try {
				const data = await this.relayFetch(host, `/api/config?${params.join('&')}`, 'POST');
				const st = this.normalizeRelayStatus(data);
				this.log.info(`Relay button times written to "${host}": ${params.join(', ')}.`);
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, st, obj.callback);
				}
			} catch (e) {
				const msg = `Writing to the relay board failed: ${e.message}`;
				this.log.warn(`${msg} (host="${host}")`);
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { error: msg }, obj.callback);
				}
			}
			return;
		}
		if (obj.command === 'geocode') {
			const query = obj.message && obj.message.query;
			if (!query) {
				this.log.warn('Geocode request without query.');
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { error: 'No query' }, obj.callback);
				}
				return;
			}
			const controller = new AbortController();
			const timeout = this.setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
			try {
				const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
				const version = this.version || '0.0.1';
				this.log.debug(`Geocoding "${query}" via Nominatim (timeout ${GEOCODE_TIMEOUT_MS}ms)...`);
				const res = await fetch(url, {
					headers: { 'User-Agent': `ioBroker.automatic-feeder/${version}` },
					signal: controller.signal,
				});
				const data = await res.json();
				if (Array.isArray(data) && data.length) {
					const hit = data[0];
					this.log.debug(`Geocode result: lat=${hit.lat}, lon=${hit.lon} (${hit.display_name}).`);
					if (obj.callback) {
						this.sendTo(
							obj.from,
							obj.command,
							{ lat: hit.lat, lon: hit.lon, displayName: hit.display_name },
							obj.callback,
						);
					}
				} else {
					this.log.info(`Geocoding "${query}": no location found.`);
					if (obj.callback) {
						this.sendTo(obj.from, obj.command, { error: 'No location found' }, obj.callback);
					}
				}
			} catch (e) {
				const msg =
					e.name === 'AbortError'
						? `Geocoding timed out after ${GEOCODE_TIMEOUT_MS}ms`
						: `Geocoding failed: ${e.message}`;
				this.log.warn(msg);
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { error: msg }, obj.callback);
				}
			} finally {
				this.clearTimeout(timeout);
			}
		}
	}

	/**
	 * @param {() => void} callback - must be called when teardown is done
	 */
	onUnload(callback) {
		try {
			this.terminating = true;
			this.log.debug(
				`Shutting down: clearing ${this.scheduleTimers.size} schedule timer(s) and ${this.verifyWatchers.size} verification(s).`,
			);
			if (this.midnightTimer) {
				this.clearTimeout(this.midnightTimer);
				this.midnightTimer = null;
			}
			if (this.reminderTimer) {
				this.clearTimeout(this.reminderTimer);
				this.reminderTimer = null;
			}
			if (this.settingsWriteTimer) {
				this.clearTimeout(this.settingsWriteTimer);
				this.settingsWriteTimer = null;
			}
			if (this.relayTimer) {
				this.clearTimeout(this.relayTimer);
				this.relayTimer = null;
			}
			for (const t of this.scheduleTimers.values()) {
				this.clearTimeout(t);
			}
			this.scheduleTimers.clear();
			for (const t of this.pauseTimers.values()) {
				this.clearTimeout(t);
			}
			this.pauseTimers.clear();

			for (const w of this.verifyWatchers.values()) {
				this.clearTimeout(w.timer);
				w.resolve(false);
			}
			this.verifyWatchers.clear();

			// turn off switches that are still in an active feeding cycle (best effort)
			for (const sid of this.feedingBusy) {
				const sw = this.switches.find(s => s.id === sid);
				if (sw && sw.objectId) {
					const value = coerce(sw.offValue ?? false);
					this.log.debug(`Turning off still-active switch ${this.swLabel(sw)} during shutdown.`);
					this.setForeignState(sw.objectId, { val: value, ack: false }, () => {});
				}
			}
			this.feedingBusy.clear();

			this.log.info('Adapter stopped.');
			callback();
		} catch (e) {
			this.log.error(`Error during unloading: ${e.message}`);
			callback();
		}
	}
}

/**
 * Coerces a configured on/off value (which may arrive as a string from the UI)
 * into a boolean, number or string.
 *
 * @param {boolean | number | string} value - the configured value
 * @returns {boolean | number | string} the coerced value
 */
function coerce(value) {
	if (typeof value === 'boolean' || typeof value === 'number') {
		return value;
	}
	if (typeof value === 'string') {
		const v = value.trim();
		if (v.toLowerCase() === 'true') {
			return true;
		}
		if (v.toLowerCase() === 'false') {
			return false;
		}
		if (v !== '' && !Number.isNaN(Number(v))) {
			return Number(v);
		}
		return value;
	}
	return value;
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
	 */
	module.exports = options => new AutomaticFeeder(options);
} else {
	// otherwise start the instance directly
	new AutomaticFeeder();
}
