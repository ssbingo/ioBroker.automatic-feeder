'use strict';

/**
 * Pure, side-effect-free scheduling helpers so they can be unit tested.
 *
 * Winter pause dates are stored as recurring "MM-DD" (season repeats every year,
 * no yearly maintenance). Comparisons use a month*100+day key so a window that
 * wraps around New Year (start month > end month) is handled correctly.
 */

/**
 * Parses a recurring "MM-DD" date into month/day numbers.
 *
 * @param {string} md - date in the form "MM-DD" (e.g. "11-01")
 * @returns {{ month: number, day: number } | null} parsed parts or null if invalid
 */
function parseMD(md) {
	if (typeof md !== 'string') {
		return null;
	}
	const m = md.match(/^(\d{1,2})-(\d{1,2})$/);
	if (!m) {
		return null;
	}
	const month = Number(m[1]);
	const day = Number(m[2]);
	if (month < 1 || month > 12 || day < 1 || day > 31) {
		return null;
	}
	return { month, day };
}

// Comparable key for a date (ignores the year): month*100 + day.
function mdKey(month, day) {
	return month * 100 + day;
}

/**
 * Returns true if `now` falls inside the recurring winter window [startMD, endMD].
 * Both bounds are inclusive. Handles windows that wrap around New Year.
 *
 * @param {string} startMD - window start "MM-DD"
 * @param {string} endMD - window end "MM-DD"
 * @param {Date} now - reference date/time
 * @returns {boolean} true if inside the (possibly year-wrapping) window
 */
function isInWinterPause(startMD, endMD, now) {
	const s = parseMD(startMD);
	const e = parseMD(endMD);
	if (!s || !e || !(now instanceof Date)) {
		return false;
	}
	const c = mdKey(now.getMonth() + 1, now.getDate());
	const start = mdKey(s.month, s.day);
	const end = mdKey(e.month, e.day);
	if (start <= end) {
		return c >= start && c <= end;
	}
	// wraps New Year (e.g. 11-01 .. 03-15)
	return c >= start || c <= end;
}

/**
 * Date (local, midnight) of the next occurrence of a recurring "MM-DD",
 * counting today as a valid occurrence.
 *
 * @param {string} md - recurring date "MM-DD"
 * @param {Date} now - reference date
 * @returns {Date | null} the next occurrence at local midnight, or null if invalid
 */
function nextMDDate(md, now) {
	const p = parseMD(md);
	if (!p || !(now instanceof Date)) {
		return null;
	}
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	let target = new Date(now.getFullYear(), p.month - 1, p.day);
	if (target.getTime() < today.getTime()) {
		target = new Date(now.getFullYear() + 1, p.month - 1, p.day);
	}
	return target;
}

/**
 * Whole days from today until the next occurrence of a recurring "MM-DD".
 * 0 means the target is today.
 *
 * @param {string} md - recurring date "MM-DD"
 * @param {Date} now - reference date
 * @returns {number | null} number of days (>= 0) or null if invalid
 */
function daysUntilMD(md, now) {
	const target = nextMDDate(md, now);
	if (!target) {
		return null;
	}
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/**
 * Whether a "X days before the target, last on the target day" reminder is due
 * today, i.e. 0 <= daysUntil(md) <= days.
 *
 * @param {string} md - recurring target date "MM-DD"
 * @param {number} days - how many days before the target the reminder starts
 * @param {Date} now - reference date
 * @returns {boolean} true if the reminder is due today
 */
function reminderDue(md, days, now) {
	const d = daysUntilMD(md, now);
	return d !== null && d >= 0 && d <= (Number(days) || 0);
}

/**
 * Clamps a number into [min, max]. If min > max, min wins.
 *
 * @param {number} v - value
 * @param {number} min - lower bound
 * @param {number} max - upper bound
 * @returns {number} the clamped value
 */
function clamp(v, min, max) {
	return Math.min(Math.max(min, max), Math.max(Math.min(min, max), v));
}

/**
 * Q10 metabolic rate factor relative to the reference temperature:
 * rate = Q10 ^ ((T - Tref) / 10). Returns 1 (neutral) on invalid input.
 *
 * @param {number} temp - current (averaged) temperature in °C
 * @param {number} tRef - reference temperature in °C
 * @param {number} q10 - Q10 coefficient (typically 2..2.5)
 * @returns {number} the relative rate factor (>0)
 */
function q10Rate(temp, tRef, q10) {
	if (!Number.isFinite(temp) || !Number.isFinite(tRef) || !Number.isFinite(q10) || q10 <= 0) {
		return 1;
	}
	return Math.pow(q10, (temp - tRef) / 10);
}

/**
 * Temperature-adapted feeding interval (minutes): a higher rate feeds more often,
 * so the interval is base / rate, clamped to [min, max] and rounded to whole minutes.
 *
 * @param {number} baseMin - interval at the reference temperature (minutes)
 * @param {number} temp - current (averaged) temperature in °C
 * @param {number} tRef - reference temperature in °C
 * @param {number} q10 - Q10 coefficient
 * @param {number} minMin - lower clamp (minutes)
 * @param {number} maxMin - upper clamp (minutes)
 * @returns {number} the interval in whole minutes
 */
function q10IntervalMin(baseMin, temp, tRef, q10, minMin, maxMin) {
	const rate = q10Rate(temp, tRef, q10);
	const raw = rate > 0 ? baseMin / rate : baseMin;
	return Math.round(clamp(raw, minMin, maxMin));
}

/**
 * Temperature-adapted feeding duration (seconds): a higher rate feeds more, so the
 * duration is base * rate, clamped to [min, max] and rounded to whole seconds.
 *
 * @param {number} baseSec - duration at the reference temperature (seconds)
 * @param {number} temp - current (averaged) temperature in °C
 * @param {number} tRef - reference temperature in °C
 * @param {number} q10 - Q10 coefficient
 * @param {number} minSec - lower clamp (seconds)
 * @param {number} maxSec - upper clamp (seconds)
 * @returns {number} the duration in whole seconds
 */
function q10DurationSec(baseSec, temp, tRef, q10, minSec, maxSec) {
	const rate = q10Rate(temp, tRef, q10);
	return Math.round(clamp(baseSec * rate, minSec, maxSec));
}

/**
 * Mean of the sample values within the last `hours` (real moving-window average).
 * Samples are `{ t: epochMs, v: number }`. Returns null if the window is empty.
 *
 * @param {Array<{t: number, v: number}>} samples - collected samples
 * @param {number} nowMs - current time in epoch milliseconds
 * @param {number} hours - window size in hours
 * @returns {number | null} the average, or null if no sample falls in the window
 */
function averageOver(samples, nowMs, hours) {
	if (!Array.isArray(samples) || !samples.length) {
		return null;
	}
	const from = nowMs - Math.max(0, Number(hours) || 0) * 3600000;
	let sum = 0;
	let n = 0;
	for (const s of samples) {
		if (s && s.t >= from && Number.isFinite(s.v)) {
			sum += s.v;
			n++;
		}
	}
	return n ? sum / n : null;
}

/**
 * Next feeding slot within a window [startMs, endMs], on a grid anchored at
 * startMs with the given interval. Returns startMs when "now" is before the
 * window, the next grid point strictly after "now" while inside the window, or
 * null once the window has passed (or the window/interval is invalid).
 *
 * @param {number} startMs - window start (epoch ms)
 * @param {number} endMs - window end (epoch ms)
 * @param {number} intervalMs - grid interval in ms
 * @param {number} nowMs - reference time (epoch ms)
 * @returns {number | null} the next slot timestamp, or null if none remains today
 */
function nextSlotInWindow(startMs, endMs, intervalMs, nowMs) {
	if (!(intervalMs > 0) || !(endMs > startMs)) {
		return null;
	}
	if (nowMs < startMs) {
		return startMs;
	}
	if (nowMs <= endMs) {
		const steps = Math.floor((nowMs - startMs) / intervalMs) + 1;
		const candidate = startMs + steps * intervalMs;
		if (candidate <= endMs) {
			return candidate;
		}
	}
	return null;
}

/**
 * Combines the two water-temperature layers (shallow "feeding zone" and deep) into the
 * single temperature that drives dynamic feeding. Handles unknown (null) inputs by
 * falling back to whichever layer is known.
 *
 * @param {string} mode - "shallow" | "average" | "coldest" | "seasonal"
 * @param {number | null} shallow - the feeding-zone (primary) temperature, or null
 * @param {number | null} deep - the deep (secondary) temperature, or null
 * @param {number} thresholdC - threshold (°C) for the "seasonal" mode
 * @returns {number | null} the combined temperature, or null if both inputs are null
 */
function combineWaterTemp(mode, shallow, deep, thresholdC) {
	const s = Number.isFinite(shallow) ? shallow : null;
	const d = Number.isFinite(deep) ? deep : null;
	if (s === null && d === null) {
		return null;
	}
	if (d === null) {
		return s;
	}
	if (s === null) {
		return d;
	}
	switch (mode) {
		case 'average':
			return (s + d) / 2;
		case 'coldest':
			return Math.min(s, d);
		case 'seasonal':
			return s >= (Number(thresholdC) || 0) ? s : d;
		case 'shallow':
		default:
			return s;
	}
}

/**
 * Whether "now" falls inside any of the given absolute pause ranges, and until when.
 * Overlapping active pauses extend the resume time to the latest end.
 *
 * @param {Array<{start: number, end: number}>} ranges - pause ranges as epoch ms (start inclusive, end exclusive)
 * @param {number} nowMs - reference time (epoch ms)
 * @returns {{ active: boolean, until: number | null }} whether paused and the latest active end (or null)
 */
function pauseInfo(ranges, nowMs) {
	let active = false;
	let until = null;
	if (Array.isArray(ranges)) {
		for (const r of ranges) {
			if (r && nowMs >= r.start && nowMs < r.end) {
				active = true;
				if (until === null || r.end > until) {
					until = r.end;
				}
			}
		}
	}
	return { active, until };
}

/**
 * The next pause boundary (a start or an end) strictly after "now", used to arm a
 * timer that re-evaluates the schedule and sends the pause start/end notification.
 *
 * @param {Array<{start: number, end: number}>} ranges - pause ranges as epoch ms
 * @param {number} nowMs - reference time (epoch ms)
 * @returns {number | null} the next boundary timestamp, or null if none is ahead
 */
function nextPauseBoundary(ranges, nowMs) {
	let next = null;
	if (Array.isArray(ranges)) {
		for (const r of ranges) {
			if (!r) {
				continue;
			}
			for (const b of [r.start, r.end]) {
				if (b > nowMs && (next === null || b < next)) {
					next = b;
				}
			}
		}
	}
	return next;
}

module.exports = {
	parseMD,
	isInWinterPause,
	nextMDDate,
	daysUntilMD,
	reminderDue,
	clamp,
	q10Rate,
	q10IntervalMin,
	q10DurationSec,
	averageOver,
	nextSlotInWindow,
	combineWaterTemp,
	pauseInfo,
	nextPauseBoundary,
};
