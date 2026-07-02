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
	nextSlotInWindow,
	combineWaterTemp,
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

	describe('nextSlotInWindow (grid anchored at start)', () => {
		const start = 8 * 3600000; // 08:00 as ms offset
		const end = 18 * 3600000; // 18:00
		const int = 50 * 60000; // 50 min

		it('returns the window start when now is before the window', () => {
			expect(nextSlotInWindow(start, end, int, 7 * 3600000)).to.equal(start);
		});
		it('returns the next grid point strictly after now inside the window', () => {
			// 08:00 + 10*50min = 16:20; at 15:35 the next slot is 16:20
			const now = 15 * 3600000 + 35 * 60000;
			expect(nextSlotInWindow(start, end, int, now)).to.equal(start + 10 * int);
		});
		it('returns exactly the next slot when now sits on a grid point', () => {
			const onGrid = start + 3 * int; // exactly a slot
			expect(nextSlotInWindow(start, end, int, onGrid)).to.equal(start + 4 * int);
		});
		it('returns the final slot when it lands exactly on the window end', () => {
			// 08:00 + 12*50min = 18:00 == end, still valid
			expect(nextSlotInWindow(start, end, int, 17 * 3600000 + 50 * 60000)).to.equal(end);
		});
		it('returns null once now is past the window end', () => {
			expect(nextSlotInWindow(start, end, int, 18 * 3600000 + 60000)).to.equal(null);
		});
		it('returns null for an invalid window or interval', () => {
			expect(nextSlotInWindow(end, start, int, start)).to.equal(null); // end <= start
			expect(nextSlotInWindow(start, end, 0, start)).to.equal(null); // interval 0
		});
	});

	describe('combineWaterTemp (shallow/average/coldest/seasonal)', () => {
		it('shallow (default) uses the feeding-zone sensor', () => {
			expect(combineWaterTemp('shallow', 18, 12, 12)).to.equal(18);
			expect(combineWaterTemp('unknownMode', 18, 12, 12)).to.equal(18);
		});
		it('average returns the mean of both layers', () => {
			expect(combineWaterTemp('average', 18, 12, 12)).to.equal(15);
		});
		it('coldest returns the colder layer', () => {
			expect(combineWaterTemp('coldest', 18, 12, 12)).to.equal(12);
			expect(combineWaterTemp('coldest', 6, 9, 12)).to.equal(6); // winter: deep warmer
		});
		it('seasonal uses shallow while it is >= threshold, else deep', () => {
			expect(combineWaterTemp('seasonal', 18, 10, 12)).to.equal(18); // warm season
			expect(combineWaterTemp('seasonal', 8, 5, 12)).to.equal(5); // shallow below threshold -> deep
			expect(combineWaterTemp('seasonal', 12, 6, 12)).to.equal(12); // exactly at threshold -> shallow
		});
		it('falls back to whichever layer is known when one is null', () => {
			expect(combineWaterTemp('coldest', null, 14, 12)).to.equal(14);
			expect(combineWaterTemp('average', 20, null, 12)).to.equal(20);
			expect(combineWaterTemp('seasonal', null, null, 12)).to.equal(null);
		});
	});
});
