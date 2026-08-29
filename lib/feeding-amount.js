'use strict';

/**
 * Pure helpers for the (temperature-/weight-based) feeding-amount model.
 *
 * Source: the original feeder manual (see dev/koi-feeding-guidelines.md):
 *   daily food amount [g] = total fish weight [g] × percent(water temperature)
 * The percentage rises with the water temperature; the weight is estimated per
 * fish-size class. All defaults below reproduce the manual and are editable per
 * switch in the adapter.
 */

/** Size classes (fish length in cm) from the manual. */
const SIZE_CLASSES = [15, 20, 30, 40, 50, 60];

/** Default approximate weight (g) per size class (keyed by cm), from the manual. */
const WEIGHT_DEFAULTS = { 15: 60, 20: 125, 30: 350, 40: 1000, 50: 2000, 60: 4000 };

/**
 * Default feeding percentage (% of total weight per day) per water-temperature
 * band, from the manual. Below 15 °C the manual gives no value → 0 % (the winter
 * pause / temperature block handle cold water). Boundaries (half-open, lower
 * inclusive; 21–23 inclusive at the top): T<15, 15..18, 18..21, 21..23, >23.
 */
const PERCENT_DEFAULTS = { below15: 0, t15: 1, t18: 1.5, t21: 2, above23: 3 };

/**
 * A non-negative finite number, or the fallback.
 *
 * @param {unknown} v - candidate value
 * @param {number} fb - fallback when v is not a valid non-negative number
 * @returns {number} v as a non-negative number, else fb
 */
function nn(v, fb) {
	const n = Number(v);
	return Number.isFinite(n) && n >= 0 ? n : fb;
}

/**
 * Total estimated fish weight (g) = Σ over size classes ( count × weight ). Both
 * arrays are aligned to {@link SIZE_CLASSES}; a missing/invalid weight falls back
 * to the manual default for that class.
 *
 * @param {number[]} counts - number of fish per size class (index-aligned to SIZE_CLASSES)
 * @param {number[]} [weights] - weight (g) per size class (index-aligned; defaults to the manual)
 * @returns {number} total weight in grams (rounded, ≥ 0)
 */
function totalFishWeight(counts, weights) {
	let sum = 0;
	for (let i = 0; i < SIZE_CLASSES.length; i++) {
		const c = nn(counts && counts[i], 0);
		const w = nn(weights && weights[i], WEIGHT_DEFAULTS[SIZE_CLASSES[i]]);
		sum += c * w;
	}
	return Math.round(sum);
}

/**
 * Feeding percentage (% of total weight per day) for a water temperature, using
 * the (editable) tier table. Returns null when the temperature is unknown.
 *
 * @param {number|null} tempC - current water temperature in °C
 * @param {Partial<typeof PERCENT_DEFAULTS>} [tiers] - percentages per band (defaults to the manual)
 * @returns {number|null} percentage per day, or null if tempC is unknown
 */
function feedPercentForTemp(tempC, tiers) {
	if (tempC === null || tempC === undefined || Number.isNaN(Number(tempC))) {
		return null;
	}
	const t = Number(tempC);
	const p = { ...PERCENT_DEFAULTS, ...(tiers || {}) };
	if (t < 15) {
		return nn(p.below15, 0);
	}
	if (t < 18) {
		return nn(p.t15, 0);
	}
	if (t < 21) {
		return nn(p.t18, 0);
	}
	if (t <= 23) {
		return nn(p.t21, 0);
	}
	return nn(p.above23, 0);
}

/**
 * Daily food amount (g) = total weight × percent / 100. Null when the percentage
 * is unknown (temperature missing).
 *
 * @param {number} totalWeight - total fish weight in grams
 * @param {number|null} percent - feeding percentage per day
 * @returns {number|null} daily food amount in grams (rounded), or null
 */
function dailyFeedGrams(totalWeight, percent) {
	if (percent === null || percent === undefined) {
		return null;
	}
	return Math.round((nn(totalWeight, 0) * nn(percent, 0)) / 100);
}

// ---------------------------------------------------------------------------
// Phase B — turning grams into motor run-time
// ---------------------------------------------------------------------------

/**
 * Grams limited by an optional daily cap. A cap of null/0/negative means "no
 * limit" and returns the grams unchanged.
 *
 * @param {number|null} grams - recommended daily amount in grams
 * @param {number|null} capGrams - optional maximum grams per day
 * @returns {number|null} the (possibly capped) grams, or null if grams is null
 */
function applyDailyCap(grams, capGrams) {
	if (grams === null || grams === undefined) {
		return null;
	}
	const g = Number(grams);
	const c = Number(capGrams);
	if (Number.isFinite(c) && c > 0) {
		return Math.min(g, c);
	}
	return g;
}

/**
 * Total motor run-time (s) to dispense `grams` at a calibrated `gramsPerSec`
 * rate. Null when either input is not a usable positive number (e.g. the rate
 * has not been calibrated yet, or there is nothing to dispense).
 *
 * @param {number|null} grams - amount to dispense in grams
 * @param {number} gramsPerSec - calibrated dispense rate (g/s)
 * @returns {number|null} total seconds, or null
 */
function dispenseSeconds(grams, gramsPerSec) {
	const g = Number(grams);
	const r = Number(gramsPerSec);
	if (!Number.isFinite(g) || g <= 0 || !Number.isFinite(r) || r <= 0) {
		return null;
	}
	return g / r;
}

/**
 * Per-feeding duration (s) = total daily seconds / feedings per day. Null when
 * there is no daily run-time or no planned feedings.
 *
 * @param {number|null} dailySeconds - total motor run-time for the day
 * @param {number} feedingsPerDay - number of planned feedings today
 * @returns {number|null} seconds per single feeding, or null
 */
function perFeedingSeconds(dailySeconds, feedingsPerDay) {
	if (dailySeconds === null || dailySeconds === undefined) {
		return null;
	}
	const s = Number(dailySeconds);
	const n = Number(feedingsPerDay);
	if (!Number.isFinite(s) || s < 0 || !Number.isFinite(n) || n <= 0) {
		return null;
	}
	return s / n;
}

module.exports = {
	SIZE_CLASSES,
	WEIGHT_DEFAULTS,
	PERCENT_DEFAULTS,
	totalFishWeight,
	feedPercentForTemp,
	dailyFeedGrams,
	applyDailyCap,
	dispenseSeconds,
	perFeedingSeconds,
};
