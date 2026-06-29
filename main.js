'use strict';

/*
 * ioBroker.futterautomat
 * Controls up to 5 user selected switches (existing ioBroker states) on a time
 * schedule for a configurable duration ("feeding"). Optionally evaluates air/water
 * temperature and the sun position (so it never feeds at night).
 */

const utils = require('@iobroker/adapter-core');
const SunCalc = require('suncalc');

const MAX_SWITCHES = 5;

class Futterautomat extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options] - Adapter options
	 */
	constructor(options) {
		super({
			...options,
			name: 'futterautomat',
		});

		/** next-feeding timer per switch id */
		this.scheduleTimers = new Map();
		/** switch-off timer per switch id */
		this.offTimers = new Map();
		this.midnightTimer = null;

		this.coords = null;
		/** effective feeding window (sun +/- offsets) */
		this.window = null;
		// current temperatures (null = unknown); kept as separate fields so the
		// type checker infers a flexible type and feeds it back as number | null
		this.airTemp = null;
		this.waterTemp = null;

		this.switches = [];

		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		await this.setStateAsync('info.connection', { val: false, ack: true });

		// --- read & sanitize switch configuration ---
		this.switches = (Array.isArray(this.config.switches) ? this.config.switches : [])
			.filter(s => s && s.id)
			.slice(0, MAX_SWITCHES);

		// --- resolve coordinates (mandatory) ---
		await this.resolveCoordinates();
		if (!this.coords) {
			this.log.warn(
				'No geolocation configured. Night protection (sun window) is disabled until coordinates are set.',
			);
		}

		// --- create / update / clean up objects ---
		await this.createGlobalObjects();
		await this.syncSwitchObjects();

		// --- recover from an unclean shutdown: turn off switches still marked active ---
		await this.recoverActiveFeeds();

		// --- sun window + daily recalculation ---
		this.recomputeSunWindow();
		this.scheduleMidnightRecalc();

		// --- temperature sources ---
		await this.setupTemperatureSources();

		// --- subscribe to our own manual trigger states ---
		this.subscribeStates('switches.*.feedNow');

		// --- schedule feeding for every enabled switch ---
		for (const sw of this.switches) {
			if (sw.enabled && sw.objectId) {
				this.scheduleSwitch(sw);
			}
		}

		await this.setStateAsync('info.connection', { val: true, ack: true });
		this.log.info(`Started with ${this.switches.length} switch(es) configured.`);
	}

	// ----------------------------------------------------------------------------
	// Coordinates & sun
	// ----------------------------------------------------------------------------

	async resolveCoordinates() {
		this.coords = null;
		if (this.config.coordinateSource === 'specific') {
			const lat = parseFloat(this.config.latitude);
			const lon = parseFloat(this.config.longitude);
			if (Number.isFinite(lat) && Number.isFinite(lon)) {
				this.coords = { lat, lon };
			}
		} else {
			try {
				const sys = await this.getForeignObjectAsync('system.config');
				const lat = parseFloat(String(sys?.common?.latitude));
				const lon = parseFloat(String(sys?.common?.longitude));
				if (Number.isFinite(lat) && Number.isFinite(lon)) {
					this.coords = { lat, lon };
				}
			} catch (e) {
				this.log.warn(`Could not read system coordinates: ${e.message}`);
			}
		}
	}

	/** Computes today's feeding window from sunrise/sunset and the configured offsets. */
	recomputeSunWindow() {
		if (!this.coords) {
			this.window = null;
			return;
		}
		const now = new Date();
		const times = SunCalc.getTimes(now, this.coords.lat, this.coords.lon);
		if (!times || !times.sunrise || !times.sunset) {
			this.window = null;
			this.log.warn('Could not compute sunrise/sunset for the configured coordinates.');
			return;
		}
		const morning = Number(this.config.sunOffsetMorning) || 0;
		const evening = Number(this.config.sunOffsetEvening) || 0;
		const start = new Date(times.sunrise.getTime() + morning * 60000);
		const end = new Date(times.sunset.getTime() - evening * 60000);
		this.window = { start, end };

		this.setStateAsync('sunrise', { val: times.sunrise.toISOString(), ack: true });
		this.setStateAsync('sunset', { val: times.sunset.toISOString(), ack: true });
		this.log.debug(`Feeding window: ${start.toISOString()} - ${end.toISOString()}`);
	}

	scheduleMidnightRecalc() {
		const now = new Date();
		const midnight = new Date(now);
		midnight.setHours(24, 0, 30, 0); // 00:00:30 next day
		const delay = midnight.getTime() - now.getTime();
		this.midnightTimer = setTimeout(() => {
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
		await this.setObjectNotExistsAsync('airTemperature', {
			type: 'state',
			common: {
				name: 'Air temperature',
				type: 'number',
				role: 'value.temperature',
				unit: '°C',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('waterTemperature', {
			type: 'state',
			common: {
				name: 'Water temperature',
				type: 'number',
				role: 'value.temperature',
				unit: '°C',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('sunrise', {
			type: 'state',
			common: { name: 'Sunrise', type: 'string', role: 'date.sunrise', read: true, write: false },
			native: {},
		});
		await this.setObjectNotExistsAsync('sunset', {
			type: 'state',
			common: { name: 'Sunset', type: 'string', role: 'date.sunset', read: true, write: false },
			native: {},
		});
	}

	/** Creates a channel + states for every configured switch and removes obsolete ones. */
	async syncSwitchObjects() {
		const wantedIds = new Set(this.switches.map(s => s.id));

		// remove channels of switches that no longer exist
		const all = await this.getAdapterObjectsAsync();
		const prefix = `${this.namespace}.switches.`;
		for (const id of Object.keys(all)) {
			if (id.startsWith(prefix) && all[id].type === 'channel') {
				const sid = id.substring(prefix.length);
				if (!wantedIds.has(sid)) {
					await this.delObjectAsync(id, { recursive: true });
					this.log.debug(`Removed obsolete switch objects: ${id}`);
				}
			}
		}

		for (const sw of this.switches) {
			const base = `switches.${sw.id}`;
			await this.setObjectNotExistsAsync(base, {
				type: 'channel',
				common: { name: sw.name || sw.id },
				native: {},
			});
			// keep the channel name in sync with the configured name
			await this.extendObjectAsync(base, { common: { name: sw.name || sw.id } });

			await this.setObjectNotExistsAsync(`${base}.feedingActive`, {
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
			await this.setObjectNotExistsAsync(`${base}.lastFeeding`, {
				type: 'state',
				common: { name: 'Last feeding', type: 'string', role: 'date', read: true, write: false },
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.nextFeeding`, {
				type: 'state',
				common: { name: 'Next feeding', type: 'string', role: 'date', read: true, write: false },
				native: {},
			});
			await this.setObjectNotExistsAsync(`${base}.blocked`, {
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
			await this.setObjectNotExistsAsync(`${base}.blockReason`, {
				type: 'state',
				common: { name: 'Block reason', type: 'string', role: 'text', read: true, write: false, def: '' },
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
		}
	}

	async recoverActiveFeeds() {
		for (const sw of this.switches) {
			const st = await this.getStateAsync(`switches.${sw.id}.feedingActive`);
			if (st && st.val) {
				this.log.info(`Recovering: switch "${sw.name || sw.id}" was still active, turning it off.`);
				if (sw.objectId) {
					await this.writeSwitch(sw, false);
				}
				await this.setStateAsync(`switches.${sw.id}.feedingActive`, { val: false, ack: true });
			}
		}
	}

	// ----------------------------------------------------------------------------
	// Temperatures
	// ----------------------------------------------------------------------------

	async setupTemperatureSources() {
		if (this.config.airTempEnabled && this.config.airTempObjectId) {
			this.subscribeForeignStates(this.config.airTempObjectId);
			const st = await this.getForeignStateAsync(this.config.airTempObjectId);
			if (st && st.val !== null && st.val !== undefined) {
				this.airTemp = Number(st.val);
				await this.setStateAsync('airTemperature', { val: this.airTemp, ack: true });
			}
		}
		if (this.config.waterTempEnabled && this.config.waterTempObjectId) {
			this.subscribeForeignStates(this.config.waterTempObjectId);
			const st = await this.getForeignStateAsync(this.config.waterTempObjectId);
			if (st && st.val !== null && st.val !== undefined) {
				this.waterTemp = Number(st.val);
				await this.setStateAsync('waterTemperature', { val: this.waterTemp, ack: true });
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
			clearTimeout(existing);
			this.scheduleTimers.delete(sw.id);
		}

		const next = this.computeNextFeeding(sw, new Date());
		if (!next) {
			this.setStateAsync(`switches.${sw.id}.nextFeeding`, { val: '', ack: true });
			this.log.warn(`Switch "${sw.name || sw.id}": no valid schedule, not planned.`);
			return;
		}

		this.setStateAsync(`switches.${sw.id}.nextFeeding`, { val: next.toISOString(), ack: true });
		const delay = Math.max(0, next.getTime() - Date.now());
		this.log.debug(
			`Switch "${sw.name || sw.id}": next feeding at ${next.toISOString()} (in ${Math.round(delay / 1000)}s).`,
		);

		const timer = setTimeout(async () => {
			this.scheduleTimers.delete(sw.id);
			await this.feed(sw, false);
			this.scheduleSwitch(sw); // plan the following feeding
		}, delay);
		this.scheduleTimers.set(sw.id, timer);
	}

	/**
	 * @param {ioBroker.FutterautomatSwitchConfig} sw
	 * @param {Date} now
	 * @returns {Date | null}
	 */
	computeNextFeeding(sw, now) {
		const epsilon = 1000; // ignore times that are essentially "now"
		if (sw.mode === 'interval') {
			return this.nextFromInterval(sw, now);
		}
		// fixed times
		const times = Array.isArray(sw.times) ? sw.times : [];
		let best = null;
		for (const t of times) {
			const d = this.timeToDate(t, now);
			if (!d) {
				continue;
			}
			if (d.getTime() <= now.getTime() + epsilon) {
				d.setDate(d.getDate() + 1); // tomorrow
			}
			if (!best || d.getTime() < best.getTime()) {
				best = d;
			}
		}
		return best;
	}

	nextFromInterval(sw, now) {
		const start = this.timeToDate(sw.windowStart, now);
		const end = this.timeToDate(sw.windowEnd, now);
		const interval = (Number(sw.intervalMin) || 0) * 60000;
		if (!start || !end || interval <= 0 || end.getTime() <= start.getTime()) {
			return null;
		}
		if (now.getTime() < start.getTime()) {
			return start;
		}
		if (now.getTime() <= end.getTime()) {
			const elapsed = now.getTime() - start.getTime();
			const steps = Math.floor(elapsed / interval) + 1;
			const candidate = new Date(start.getTime() + steps * interval);
			if (candidate.getTime() <= end.getTime()) {
				return candidate;
			}
		}
		// past the window -> first slot tomorrow
		const tomorrow = new Date(start);
		tomorrow.setDate(tomorrow.getDate() + 1);
		return tomorrow;
	}

	/**
	 * Builds a Date for today at "HH:mm".
	 *
	 * @param {string} hhmm
	 * @param {Date} ref
	 * @returns {Date | null}
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
	 * @param {ioBroker.FutterautomatSwitchConfig} sw
	 * @param {boolean} ignoreBlocks
	 */
	async feed(sw, ignoreBlocks) {
		if (!sw.objectId) {
			this.log.warn(`Switch "${sw.name || sw.id}" has no target object, skipping.`);
			return;
		}

		const reason = ignoreBlocks ? null : this.getBlockReason(sw);
		const blocked = !!reason;
		await this.setStateAsync(`switches.${sw.id}.blocked`, { val: blocked, ack: true });
		await this.setStateAsync(`switches.${sw.id}.blockReason`, { val: reason || '', ack: true });
		if (blocked) {
			this.log.info(`Feeding of "${sw.name || sw.id}" blocked: ${reason}`);
			return;
		}

		this.log.info(`Feeding "${sw.name || sw.id}" for ${sw.durationSec || 0}s.`);
		await this.writeSwitch(sw, true);
		await this.setStateAsync(`switches.${sw.id}.feedingActive`, { val: true, ack: true });
		await this.setStateAsync(`switches.${sw.id}.lastFeeding`, { val: new Date().toISOString(), ack: true });

		const existingOff = this.offTimers.get(sw.id);
		if (existingOff) {
			clearTimeout(existingOff);
		}
		const duration = Math.max(0, Number(sw.durationSec) || 0) * 1000;
		const off = setTimeout(async () => {
			this.offTimers.delete(sw.id);
			await this.writeSwitch(sw, false);
			await this.setStateAsync(`switches.${sw.id}.feedingActive`, { val: false, ack: true });
		}, duration);
		this.offTimers.set(sw.id, off);
	}

	/**
	 * Writes the on/off value to the target foreign state.
	 *
	 * @param {ioBroker.FutterautomatSwitchConfig} sw
	 * @param {boolean} on
	 */
	async writeSwitch(sw, on) {
		const value = coerce(on ? (sw.onValue ?? true) : (sw.offValue ?? false));
		try {
			await this.setForeignStateAsync(sw.objectId, { val: value, ack: false });
		} catch (e) {
			this.log.error(`Could not write ${sw.objectId}: ${e.message}`);
		}
	}

	/**
	 * Returns a human readable block reason or null if feeding is allowed.
	 *
	 * @param {ioBroker.FutterautomatSwitchConfig} sw
	 * @returns {string | null}
	 */
	getBlockReason(sw) {
		// night / sun window
		if (sw.respectNight !== false && this.window) {
			const now = Date.now();
			if (now < this.window.start.getTime() || now > this.window.end.getTime()) {
				return 'outside sun window (night)';
			}
		}
		// water temperature
		if (sw.blockWaterEnabled && this.waterTemp !== null) {
			if (sw.waterMin !== null && sw.waterMin !== undefined && this.waterTemp < sw.waterMin) {
				return `water temperature ${this.waterTemp}°C below ${sw.waterMin}°C`;
			}
			if (sw.waterMax !== null && sw.waterMax !== undefined && this.waterTemp > sw.waterMax) {
				return `water temperature ${this.waterTemp}°C above ${sw.waterMax}°C`;
			}
		}
		// air temperature
		if (sw.blockAirEnabled && this.airTemp !== null) {
			if (sw.airMin !== null && sw.airMin !== undefined && this.airTemp < sw.airMin) {
				return `air temperature ${this.airTemp}°C below ${sw.airMin}°C`;
			}
			if (sw.airMax !== null && sw.airMax !== undefined && this.airTemp > sw.airMax) {
				return `air temperature ${this.airTemp}°C above ${sw.airMax}°C`;
			}
		}
		return null;
	}

	// ----------------------------------------------------------------------------
	// Events
	// ----------------------------------------------------------------------------

	/**
	 * @param {string} id - State ID
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		if (!state) {
			return;
		}

		// temperature sources (foreign states)
		if (this.config.airTempEnabled && id === this.config.airTempObjectId) {
			this.airTemp = state.val === null ? null : Number(state.val);
			await this.setStateAsync('airTemperature', { val: this.airTemp, ack: true });
			return;
		}
		if (this.config.waterTempEnabled && id === this.config.waterTempObjectId) {
			this.waterTemp = state.val === null ? null : Number(state.val);
			await this.setStateAsync('waterTemperature', { val: this.waterTemp, ack: true });
			return;
		}

		// manual trigger (own state, command => ack === false)
		const m = id.match(/switches\.([^.]+)\.feedNow$/);
		if (m && state.ack === false && state.val) {
			const sw = this.switches.find(s => s.id === m[1]);
			if (sw) {
				this.log.info(`Manual feeding triggered for "${sw.name || sw.id}".`);
				await this.feed(sw, !!sw.manualIgnoresBlocks);
			}
			await this.setStateAsync(id, { val: false, ack: true });
		}
	}

	/**
	 * Handles "geocode" requests from the admin UI (address -> coordinates via Nominatim).
	 *
	 * @param {ioBroker.Message} obj
	 */
	async onMessage(obj) {
		if (!obj || typeof obj !== 'object' || !obj.command) {
			return;
		}
		if (obj.command === 'geocode') {
			const query = obj.message && obj.message.query;
			if (!query) {
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { error: 'No query' }, obj.callback);
				}
				return;
			}
			try {
				const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
				const version = this.version || '0.0.1';
				const res = await fetch(url, {
					headers: { 'User-Agent': `ioBroker.futterautomat/${version}` },
				});
				const data = await res.json();
				if (Array.isArray(data) && data.length) {
					const hit = data[0];
					if (obj.callback) {
						this.sendTo(
							obj.from,
							obj.command,
							{ lat: hit.lat, lon: hit.lon, displayName: hit.display_name },
							obj.callback,
						);
					}
				} else if (obj.callback) {
					this.sendTo(obj.from, obj.command, { error: 'No location found' }, obj.callback);
				}
			} catch (e) {
				this.log.warn(`Geocoding failed: ${e.message}`);
				if (obj.callback) {
					this.sendTo(obj.from, obj.command, { error: e.message }, obj.callback);
				}
			}
		}
	}

	/**
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.midnightTimer) {
				clearTimeout(this.midnightTimer);
				this.midnightTimer = null;
			}
			for (const t of this.scheduleTimers.values()) {
				clearTimeout(t);
			}
			this.scheduleTimers.clear();

			// turn off switches that are still feeding (best effort) and clear their timers
			for (const [sid, t] of this.offTimers.entries()) {
				clearTimeout(t);
				const sw = this.switches.find(s => s.id === sid);
				if (sw && sw.objectId) {
					const value = coerce(sw.offValue ?? false);
					this.setForeignState(sw.objectId, { val: value, ack: false }, () => {});
				}
			}
			this.offTimers.clear();

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
 * @param {boolean | number | string} value
 * @returns {boolean | number | string}
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
	module.exports = options => new Futterautomat(options);
} else {
	// otherwise start the instance directly
	new Futterautomat();
}
