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
			/** Do not feed outside the sun window (night). */
			respectNight: boolean;
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
		}

		interface AdapterConfig {
			/** "system" = use coordinates from system.config, "specific" = use latitude/longitude below. */
			coordinateSource: 'system' | 'specific';
			latitude: string;
			longitude: string;
			/** Last resolved address (display only). */
			address: string;
			/** Start feeding only N minutes after sunrise. */
			sunOffsetMorning: number;
			/** Stop feeding N minutes before sunset. */
			sunOffsetEvening: number;
			airTempEnabled: boolean;
			airTempObjectId: string;
			waterTempEnabled: boolean;
			waterTempObjectId: string;
			/** Optional global dissolved-oxygen source (used by per-switch O2 blocking). */
			o2Enabled: boolean;
			o2ObjectId: string;
			switches: AutomaticFeederSwitchConfig[];
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
