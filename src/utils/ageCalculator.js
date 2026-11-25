const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

function daysInMonth(year, month) {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    return isLeapYear ? 29 : 28
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null
  }

  return { year, month, day }
}

function compareDates(first, second) {
  return first.year - second.year || first.month - second.month || first.day - second.day
}

function dateToUtc(parts) {
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day)
  return date
}

function daysBetween(start, end) {
  return Math.round((dateToUtc(end).getTime() - dateToUtc(start).getTime()) / DAY_IN_MILLISECONDS)
}

function addMonthsFromBirth(birthDate, months) {
  const absoluteMonth = birthDate.year * 12 + birthDate.month - 1 + months
  const year = Math.floor(absoluteMonth / 12)
  const month = (absoluteMonth % 12) + 1

  return {
    year,
    month,
    day: Math.min(birthDate.day, daysInMonth(year, month)),
  }
}

function toDateString({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function localDateString(date) {
  return toDateString({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  })
}

export function getTodayDateString() {
  return localDateString(new Date())
}

export function calculateAgeDetails(birthDateValue, todayValue = getTodayDateString()) {
  const birthDate = parseDate(birthDateValue)
  const today = parseDate(todayValue)

  if (!birthDate) {
    throw new RangeError('Enter a valid date of birth.')
  }
  if (!today) {
    throw new RangeError('The current date could not be read.')
  }
  if (compareDates(birthDate, today) > 0) {
    throw new RangeError('Date of birth cannot be in the future.')
  }

  let totalMonths = (today.year - birthDate.year) * 12 + today.month - birthDate.month
  if (compareDates(addMonthsFromBirth(birthDate, totalMonths), today) > 0) {
    totalMonths -= 1
  }

  const ageAnchor = addMonthsFromBirth(birthDate, totalMonths)
  const currentYearBirthday = addMonthsFromBirth(
    birthDate,
    (today.year - birthDate.year) * 12,
  )
  const nextBirthday = compareDates(today, currentYearBirthday) <= 0
    ? currentYearBirthday
    : addMonthsFromBirth(birthDate, (today.year - birthDate.year + 1) * 12)
  const totalDays = daysBetween(birthDate, today)
  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(dateToUtc(birthDate))

  return {
    birthDate: birthDateValue,
    calculatedOn: todayValue,
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: daysBetween(ageAnchor, today),
    totalMonths,
    totalWeeks: Math.floor(totalDays / 7),
    totalDays,
    weekday,
    nextBirthdayDate: toDateString(nextBirthday),
    daysUntilNextBirthday: daysBetween(today, nextBirthday),
  }
}
