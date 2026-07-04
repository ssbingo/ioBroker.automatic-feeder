// This file extends the AdapterConfig type from "@iobroker/types"
// with the actual configuration properties of this adapter
// in order to provide typings for adapter.config properties.

declare global {
	namespace ioBroker {
		interface AutomaticFeederSwitchConfig {
			/** Stable internal id used for the datapoint path (e.g. "sw-0"). Never derived from the name. */
			id: string;
			/** User defined name, used as tab label and as common.name of the channel. */
			name: string;
			enabled: boolean;
			/** Foreign object/state id that is switched (feeding). */
			objectId: string;
			/** Value written to activate the switch (default true). */
			onValue: boolean | number | string;
			/** Value written to deactivate the switch (default false). */
			offValue: boolean | number | string;
			/** Feeding duration in seconds. */
			durationSec: number;
			/** "times" = discrete clock times, "interval" = every N minutes inside a window. */
			mode: 'times' | 'interval';
			/** Mode "times": list of "HH:mm" clock times. */
			times: string[];
			/** Mode "interval": window start "HH:mm". */
			windowStart: string;
			/** Mode "interval": window end "HH:mm". */
			windowEnd: string;
			/** Mode "interval": interval in minutes. */
			intervalMin: number;
			/** Block feeding based on water temperature thresholds. */
			blockWaterEnabled: boolean;
			waterMin: number | null;
			waterMax: number | null;
			/** Block feeding based on air temperature thresholds. */
			blockAirEnabled: boolean;
			airMin: number | null;
			airMax: number | null;
			/**
			 * Restrict feeding to the astronomical day window (sunrise + morning offset ..
			 * sunset − evening offset). For interval/dynamic modes this becomes the feeding
			 * window; for fixed times it acts as a day/night guard. Replaces the former
			 * global sun window + per-switch "respectNight".
			 */
			astroWindowEnabled: boolean;
			/** Minutes after sunrise before feeding may start (only used when astroWindowEnabled). */
			sunOffsetMorning: number;
			/** Minutes before sunset after which feeding stops (only used when astroWindowEnabled). */
			sunOffsetEvening: number;
			/** Per-switch location source, only used when the global locationMode is "individual". */
			coordinateSource: 'system' | 'specific';
			/** Per-switch latitude (string), used when coordinateSource is "specific". */
			latitude: string;
			/** Per-switch longitude (string), used when coordinateSource is "specific". */
			longitude: string;
			/** Per-switch last resolved address (display only). */
			address: string;
			/** Manual trigger ignores temperature/night blocks. */
			manualIgnoresBlocks: boolean;
			/** Verify (read back) that this switch actually turned on and off. */
			verifyEnabled: boolean;
			/** Timeout in seconds to wait for the acknowledged on/off confirmation (per attempt). */
			verifyTimeoutSec: number;
			/** Number of staggered re-checks before a switching fault is reported (default 3). */
			verifyRetries: number;
			/** Telegram instance id used for this switch, e.g. "telegram.0" (empty = off). */
			telegramInstance: string;
			/** Optional Telegram recipient (user/chat name) for this switch; empty = all. */
			telegramUser: string;
			/** Send a Telegram message when a feeding completed successfully. */
			notifySuccess: boolean;
			/** Send a Telegram message when feeding could not be performed (no ON). */
			notifyOnFail: boolean;
			/** Send a Telegram message when the switch did not turn OFF again. */
			notifyOffFail: boolean;
			/** Duration in seconds used by the manual "feed now" button. */
			manualDurationSec: number;
			/** Winter pause: suspend or change the feeding rhythm during a recurring season. */
			winterEnabled: boolean;
			/** Winter pause start as recurring "MM-DD" (e.g. "11-01"). */
			winterStart: string;
			/** Winter pause end as recurring "MM-DD" (e.g. "03-15"). */
			winterEnd: string;
			/** What happens during the winter pause. */
			winterMode: 'suspend' | 'reduced' | 'onceDaily';
			/** Mode "reduced": feeding interval in minutes during winter. */
			winterIntervalMin: number;
			/** Mode "onceDaily": the single "HH:mm" feeding time during winter. */
			winterTime: string;
			/** Feeding duration in seconds used during winter (reduced/onceDaily). */
			winterDurationSec: number;
			/** Send a Telegram reminder in the days leading up to the winter pause. */
			winterStartReminderEnabled: boolean;
			/** How many days before the start the daily reminder is sent (last on the start day). */
			winterStartReminderDays: number;
			/** Send a Telegram reminder in the days leading up to the end of the winter pause. */
			winterEndReminderEnabled: boolean;
			/** How many days before the end the daily reminder is sent (last on the end day). */
			winterEndReminderDays: number;
			/** Hour of day (0-23, local) at which winter reminders are sent. */
			winterReminderHour: number;
			/**
			 * Manual master pause: while true, ALL feeding for this switch is suspended
			 * immediately and indefinitely, overriding the time-based pauses and every
			 * feeding mode. Setting it back to false resumes feeding as configured.
			 * Toggling it sends a Telegram message.
			 */
			pauseNow: boolean;
			/**
			 * Up to 3 absolute feeding pauses (e.g. a quarantine window after restocking):
			 * while "now" is within an enabled pause, feeding is completely suspended
			 * (highest priority, overrides everything). Start/end are local date-time strings
			 * "DD.MM.YYYY HH:mm" (empty = unset). A Telegram message is sent at start and end.
			 */
			pause1Enabled: boolean;
			pause1Start: string;
			pause1End: string;
			pause2Enabled: boolean;
			pause2Start: string;
			pause2End: string;
			pause3Enabled: boolean;
			pause3Start: string;
			pause3End: string;
			/** Dynamic feeding: adapt interval and duration to temperature (Q10 model). */
			dynamicEnabled: boolean;
			/** Which temperature drives the dynamic model. */
			dynamicSource: 'water' | 'air';
			/** Reference temperature (°C) at which the base interval/duration apply. */
			dynamicTRef: number;
			/** Q10 coefficient (metabolic rate factor per 10 °C, typically 2..2.5). */
			dynamicQ10: number;
			/** Interval in minutes at the reference temperature. */
			dynamicBaseIntervalMin: number;
			/** Lower clamp for the dynamic interval (minutes). */
			dynamicMinIntervalMin: number;
			/** Upper clamp for the dynamic interval (minutes). */
			dynamicMaxIntervalMin: number;
			/** Feeding duration in seconds at the reference temperature. */
			dynamicBaseDurationSec: number;
			/** Lower clamp for the dynamic duration (seconds). */
			dynamicMinDurationSec: number;
			/** Upper clamp for the dynamic duration (seconds). */
			dynamicMaxDurationSec: number;
			/** Moving-average window in hours used to smooth the temperature (inertia). */
			dynamicBufferHours: number;
			/** Hysteresis in percent to avoid re-planning on tiny interval changes. */
			dynamicHysteresisPct: number;
			/** Block feeding when the dissolved oxygen drops below o2Min. */
			blockO2Enabled: boolean;
			/** Minimum oxygen (in the source object's unit) required to feed. */
			o2Min: number | null;
			/** Per-switch air-temperature source (this feeding station's own sensor). */
			airTempEnabled: boolean;
			airTempObjectId: string;
			/** Per-switch water-temperature source (the primary "feeding zone" / shallow sensor). */
			waterTempEnabled: boolean;
			waterTempObjectId: string;
			/** Optional second water-temperature source (the deep / bottom sensor). */
			waterTemp2Enabled: boolean;
			waterTemp2ObjectId: string;
			/**
			 * How the two water sensors are combined into the temperature that drives dynamic
			 * feeding: "shallow" = only the feeding-zone sensor (default), "average" = mean of
			 * both, "coldest" = the colder layer, "seasonal" = feeding-zone while it is at or
			 * above waterSeasonalThresholdC, otherwise the deep sensor.
			 */
			waterCombineMode: 'shallow' | 'average' | 'coldest' | 'seasonal';
			/** Threshold (°C) for the "seasonal" combine mode. */
			waterSeasonalThresholdC: number;
			/** Per-switch dissolved-oxygen source. */
			o2Enabled: boolean;
			o2ObjectId: string;
		}

		interface AdapterConfig {
			/**
			 * Where the switches take their coordinates from (for the astronomical window):
			 * "system" = ioBroker system.config for all, "shared" = the latitude/longitude
			 * below for all, "individual" = each switch decides on its own tab.
			 */
			locationMode: 'system' | 'shared' | 'individual';
			/** Shared latitude (used when locationMode is "shared"). */
			latitude: string;
			/** Shared longitude (used when locationMode is "shared"). */
			longitude: string;
			/** Last resolved address (display only, for the shared location). */
			address: string;
			/** @deprecated Legacy global coordinate source; kept only for the one-time Phase-4 migration. */
			coordinateSource: 'system' | 'specific';
			/** @deprecated Legacy global sun offsets; migrated into the per-switch offsets. */
			sunOffsetMorning: number;
			/** @deprecated Legacy global sun offsets; migrated into the per-switch offsets. */
			sunOffsetEvening: number;
			/** @deprecated Legacy global sources; kept only for the one-time migration to per-switch sources. */
			airTempEnabled: boolean;
			airTempObjectId: string;
			waterTempEnabled: boolean;
			waterTempObjectId: string;
			o2Enabled: boolean;
			o2ObjectId: string;
			/** Set to true once the legacy global sources have been migrated into the switches. */
			sourcesMigratedToSwitches: boolean;
			/** Set to true once the Phase-4 location/astro-window migration has run. */
			phase4Migrated: boolean;
			switches: AutomaticFeederSwitchConfig[];
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
