import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateAgeDetails } from './ageCalculator.js'

describe('calculateAgeDetails', () => {
  it('calculates calendar age and the weekday for an ordinary birth date', () => {
    const result = calculateAgeDetails('1990-06-15', '2026-11-25')

    assert.deepEqual([result.years, result.months, result.days], [36, 5, 10])
    assert.equal(result.weekday, 'Friday')
    assert.equal(result.totalMonths, 437)
    assert.equal(result.totalWeeks, Math.floor(result.totalDays / 7))
  })

  it('uses February 28 for leap-day birthdays in non-leap years', () => {
    const beforeBirthday = calculateAgeDetails('2000-02-29', '2025-02-27')
    assert.deepEqual(
      [beforeBirthday.years, beforeBirthday.months, beforeBirthday.days],
      [24, 11, 29],
    )
    assert.equal(beforeBirthday.nextBirthdayDate, '2025-02-28')
    assert.equal(beforeBirthday.daysUntilNextBirthday, 1)

    const onBirthday = calculateAgeDetails('2000-02-29', '2024-02-29')
    assert.deepEqual([onBirthday.years, onBirthday.months, onBirthday.days], [24, 0, 0])
    assert.equal(onBirthday.daysUntilNextBirthday, 0)
  })

  it('counts down to the next birthday and returns zero on the birthday', () => {
    const upcomingBirthday = calculateAgeDetails('2000-12-31', '2026-11-25')
    assert.equal(upcomingBirthday.nextBirthdayDate, '2026-12-31')
    assert.equal(upcomingBirthday.daysUntilNextBirthday, 36)

    const birthdayToday = calculateAgeDetails('2000-11-25', '2026-11-25')
    assert.equal(birthdayToday.daysUntilNextBirthday, 0)
  })

  it('rejects invalid and future dates', () => {
    assert.throws(() => calculateAgeDetails('2023-02-29', '2026-11-25'), RangeError)
    assert.throws(() => calculateAgeDetails('2027-01-01', '2026-11-25'), RangeError)
  })
})
