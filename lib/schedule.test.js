'use strict';

const { expect } = require('chai');
const {
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
} = require('./schedule');

const at = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0); // local noon, month is 1-based here

describe('lib/schedule', () => {
	describe('parseMD', () => {
		it('parses valid MM-DD', () => {
			expect(parseMD('11-01')).to.deep.equal({ month: 11, day: 1 });
			expect(parseMD('3-5')).to.deep.equal({ month: 3, day: 5 });
		});
		it('rejects invalid input', () => {
			expect(parseMD('13-01')).to.equal(null);
			expect(parseMD('11-40')).to.equal(null);
			expect(parseMD('foo')).to.equal(null);
			expect(parseMD(undefined)).to.equal(null);
		});
	});

	describe('isInWinterPause (year-wrapping window 11-01 .. 03-15)', () => {
		const s = '11-01';
		const e = '03-15';
		it('is inside in late autumn / winter / early spring', () => {
			expect(isInWinterPause(s, e, at(2026, 11, 1))).to.equal(true); // start day
			expect(isInWinterPause(s, e, at(2026, 12, 24))).to.equal(true);
			expect(isInWinterPause(s, e, at(2026, 1, 10))).to.equal(true);
			expect(isInWinterPause(s, e, at(2026, 3, 15))).to.equal(true); // end day
		});
		it('is outside in summer', () => {
			expect(isInWinterPause(s, e, at(2026, 6, 15))).to.equal(false);
			expect(isInWinterPause(s, e, at(2026, 3, 16))).to.equal(false);
			expect(isInWinterPause(s, e, at(2026, 10, 31))).to.equal(false);
		});
	});

	describe('isInWinterPause (non-wrapping window 06-01 .. 08-31)', () => {
		it('handles a same-year window', () => {
			expect(isInWinterPause('06-01', '08-31', at(2026, 7, 1))).to.equal(true);
			expect(isInWinterPause('06-01', '08-31', at(2026, 1, 1))).to.equal(false);
			expect(isInWinterPause('06-01', '08-31', at(2026, 9, 1))).to.equal(false);
		});
	});

	describe('daysUntilMD / nextMDDate', () => {
		it('returns 0 on the target day', () => {
			expect(daysUntilMD('11-01', at(2026, 11, 1))).to.equal(0);
		});
		it('counts days to an upcoming target this year', () => {
			expect(daysUntilMD('11-08', at(2026, 11, 1))).to.equal(7);
		});
		it('rolls over to next year when the target has passed', () => {
			const d = nextMDDate('01-05', at(2026, 12, 30));
			expect(d.getFullYear()).to.equal(2027);
			expect(daysUntilMD('01-05', at(2026, 12, 30))).to.equal(6);
		});
	});

	describe('reminderDue', () => {
		it('is due within the window and on the target day, not before', () => {
			expect(reminderDue('11-08', 7, at(2026, 11, 1))).to.equal(true); // 7 days before
			expect(reminderDue('11-08', 7, at(2026, 11, 8))).to.equal(true); // target day
			expect(reminderDue('11-08', 7, at(2026, 10, 31))).to.equal(false); // 8 days before
		});
	});

	describe('clamp', () => {
		it('bounds a value into [min, max]', () => {
			expect(clamp(5, 0, 10)).to.equal(5);
			expect(clamp(-3, 0, 10)).to.equal(0);
			expect(clamp(99, 0, 10)).to.equal(10);
		});
	});

	describe('q10Rate', () => {
		it('is 1 at the reference temperature', () => {
			expect(q10Rate(20, 20, 2)).to.equal(1);
		});
		it('doubles per +10 °C for Q10=2 and halves per -10 °C', () => {
			expect(q10Rate(30, 20, 2)).to.be.closeTo(2, 1e-9);
			expect(q10Rate(10, 20, 2)).to.be.closeTo(0.5, 1e-9);
		});
		it('falls back to 1 on invalid input', () => {
			expect(q10Rate(NaN, 20, 2)).to.equal(1);
			expect(q10Rate(20, 20, 0)).to.equal(1);
		});
	});

	describe('q10IntervalMin / q10DurationSec', () => {
		it('feeds more often (shorter interval) when warmer, clamped and rounded', () => {
			expect(q10IntervalMin(60, 30, 20, 2, 15, 480)).to.equal(30); // 60/2
			expect(q10IntervalMin(60, 20, 20, 2, 15, 480)).to.equal(60); // reference
			expect(q10IntervalMin(60, 0, 20, 2, 15, 480)).to.equal(240); // 60/0.25
			expect(q10IntervalMin(60, 40, 20, 2, 15, 480)).to.equal(15); // 60/4 -> clamped to 15
		});
		it('feeds more (longer duration) when warmer, clamped and rounded', () => {
			expect(q10DurationSec(5, 30, 20, 2, 2, 15)).to.equal(10); // 5*2
			expect(q10DurationSec(5, 40, 20, 2, 2, 15)).to.equal(15); // 5*4 -> clamped to 15
			expect(q10DurationSec(5, 0, 20, 2, 2, 15)).to.equal(2); // 5*0.25 -> clamped to 2
		});
	});

	describe('averageOver', () => {
		const now = 1_000_000_000_000;
		const h = 3600000;
		it('averages only samples within the window', () => {
			const samples = [
				{ t: now - 30 * h, v: 10 }, // outside 24h
				{ t: now - 2 * h, v: 20 },
				{ t: now - 1 * h, v: 30 },
			];
			expect(averageOver(samples, now, 24)).to.equal(25);
		});
		it('returns null when nothing is in the window', () => {
			expect(averageOver([{ t: now - 48 * h, v: 5 }], now, 24)).to.equal(null);
			expect(averageOver([], now, 24)).to.equal(null);
		});
	});
});
