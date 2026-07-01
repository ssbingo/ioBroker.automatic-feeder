'use strict';

const { expect } = require('chai');
const { parseMD, isInWinterPause, nextMDDate, daysUntilMD, reminderDue } = require('./schedule');

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
});
