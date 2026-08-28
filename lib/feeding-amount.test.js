'use strict';

const { expect } = require('chai');
const {
	SIZE_CLASSES,
	WEIGHT_DEFAULTS,
	PERCENT_DEFAULTS,
	totalFishWeight,
	feedPercentForTemp,
	dailyFeedGrams,
} = require('./feeding-amount');

// arrays are index-aligned to SIZE_CLASSES = [15, 20, 30, 40, 50, 60]
describe('feeding-amount: totalFishWeight', () => {
	it('sums count × default weight over the classes', () => {
		// 2×60 (15cm) + 1×350 (30cm) + 1×2000 (50cm) = 2470
		expect(totalFishWeight([2, 0, 1, 0, 1, 0])).to.equal(2470);
	});
	it('uses custom weights when given', () => {
		expect(totalFishWeight([3, 0, 0, 0, 0, 0], [100, 0, 0, 0, 0, 0])).to.equal(300);
	});
	it('falls back to the manual weight for classes without a custom value', () => {
		// only 1 fish of 60 cm, custom weights array too short -> default weight for 60 cm
		expect(totalFishWeight([0, 0, 0, 0, 0, 1], [99])).to.equal(WEIGHT_DEFAULTS[60]);
	});
	it('ignores missing/invalid counts', () => {
		expect(totalFishWeight([])).to.equal(0);
		expect(totalFishWeight([0, -5, 'x', null, undefined, NaN])).to.equal(0);
	});
});

describe('feeding-amount: feedPercentForTemp (default tiers)', () => {
	const cases = [
		[10, 0],
		[14.9, 0],
		[15, 1],
		[17.9, 1],
		[18, 1.5],
		[20.9, 1.5],
		[21, 2],
		[23, 2],
		[23.1, 3],
		[30, 3],
	];
	cases.forEach(([t, pct]) => {
		it(`${t} °C -> ${pct} %`, () => {
			expect(feedPercentForTemp(t)).to.equal(pct);
		});
	});
	it('returns null for unknown temperature', () => {
		expect(feedPercentForTemp(null)).to.equal(null);
		expect(feedPercentForTemp(undefined)).to.equal(null);
		expect(feedPercentForTemp(NaN)).to.equal(null);
	});
	it('honours custom tier percentages', () => {
		expect(feedPercentForTemp(22, { ...PERCENT_DEFAULTS, t21: 2.5 })).to.equal(2.5);
	});
});

describe('feeding-amount: dailyFeedGrams', () => {
	it('computes weight × percent / 100', () => {
		expect(dailyFeedGrams(5000, 2)).to.equal(100);
		expect(dailyFeedGrams(2470, 1.5)).to.equal(37); // 37.05 -> 37
	});
	it('is null when the percentage is unknown', () => {
		expect(dailyFeedGrams(5000, null)).to.equal(null);
	});
	it('handles zero weight', () => {
		expect(dailyFeedGrams(0, 3)).to.equal(0);
	});
});

describe('feeding-amount: constants', () => {
	it('exposes the manual size classes and weights', () => {
		expect(SIZE_CLASSES).to.deep.equal([15, 20, 30, 40, 50, 60]);
		expect(WEIGHT_DEFAULTS[40]).to.equal(1000);
		expect(PERCENT_DEFAULTS.above23).to.equal(3);
	});
});
