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

module.exports = { parseMD, isInWinterPause, nextMDDate, daysUntilMD, reminderDue };
