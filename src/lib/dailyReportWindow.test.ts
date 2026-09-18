import { describe, expect, it } from 'vitest'
import {
  formatBoundary,
  formatTimeOfDay,
  mostRecentReportTime,
  nextReportTime,
  parseTimeOfDay,
  roundToQuarterHour,
  type TimeOfDay,
} from './dailyReportWindow'

const NOON: TimeOfDay = { hour: 12, minute: 0 }

const ZONES = [
  'Asia/Karachi', // UTC+5, no DST
  'America/New_York', // UTC-5/-4, observes DST
  'Europe/London', // UTC+0/+1, observes DST
  'Asia/Dubai', // UTC+4, no DST
]

describe('mostRecentReportTime', () => {
  it.each(ZONES)('report_start is exactly 24h before report_end (%s)', zone => {
    const now = new Date('2026-09-18T15:00:00Z')
    const { reportStart, reportEnd } = mostRecentReportTime(zone, NOON, now)
    expect(reportEnd.getTime() - reportStart.getTime()).toBe(
      24 * 60 * 60 * 1000,
    )
  })

  it("picks TODAY's local occurrence when now is already past it", () => {
    // 2026-09-18 12:30 PM in Asia/Karachi (UTC+5) == 2026-09-18T07:30:00Z
    const now = new Date('2026-09-18T07:30:00Z')
    const { reportEnd } = mostRecentReportTime('Asia/Karachi', NOON, now)
    // Expected local noon: 2026-09-18T12:00:00+05:00 == 2026-09-18T07:00:00Z
    expect(reportEnd.toISOString()).toBe('2026-09-18T07:00:00.000Z')
  })

  it("picks YESTERDAY's local occurrence when now is before today's", () => {
    // 2026-09-18 09:00 AM in Asia/Karachi == 2026-09-18T04:00:00Z
    const now = new Date('2026-09-18T04:00:00Z')
    const { reportEnd } = mostRecentReportTime('Asia/Karachi', NOON, now)
    // Expected local noon: 2026-09-17T12:00:00+05:00 == 2026-09-17T07:00:00Z
    expect(reportEnd.toISOString()).toBe('2026-09-17T07:00:00.000Z')
  })

  it('matches the documented Asia/Karachi example exactly', () => {
    // "Report generated: September 18, 12:00 PM" -- report period
    // Sep 17 12:00 PM -> Sep 18 12:00 PM, Asia/Karachi (UTC+5, no DST).
    const now = new Date('2026-09-18T07:00:00Z') // exactly local noon
    const { reportStart, reportEnd } = mostRecentReportTime(
      'Asia/Karachi',
      NOON,
      now,
    )
    expect(reportEnd.toISOString()).toBe('2026-09-18T07:00:00.000Z')
    expect(reportStart.toISOString()).toBe('2026-09-17T07:00:00.000Z')
  })

  it('handles the America/New_York DST-transition day (spring forward, 2026-03-08)', () => {
    // Clocks skip 2:00 AM -> 3:00 AM on 2026-03-08; noon itself is unaffected,
    // but the offset used for the 24h-earlier boundary differs (EST -05:00
    // the day before, EDT -04:00 on/after the transition).
    const now = new Date('2026-03-08T16:00:00Z') // 12:00 PM EDT (UTC-4) on transition day
    const { reportStart, reportEnd } = mostRecentReportTime(
      'America/New_York',
      NOON,
      now,
    )
    expect(reportEnd.toISOString()).toBe('2026-03-08T16:00:00.000Z')
    // report_start is a pure 24h subtraction, landing at 11:00 AM EST the
    // previous day (not "yesterday's local noon") -- this is intentional
    // per spec: report_start = report_end - 24 hours, always.
    expect(reportStart.toISOString()).toBe('2026-03-07T16:00:00.000Z')
  })

  it('handles the Europe/London DST-transition day (clocks forward, 2026-03-29)', () => {
    const now = new Date('2026-03-29T12:00:00Z') // 12:00 PM BST (UTC+1) on transition day
    const { reportStart, reportEnd } = mostRecentReportTime(
      'Europe/London',
      NOON,
      now,
    )
    expect(reportEnd.toISOString()).toBe('2026-03-29T11:00:00.000Z')
    expect(reportEnd.getTime() - reportStart.getTime()).toBe(
      24 * 60 * 60 * 1000,
    )
  })

  it('Asia/Dubai (UTC+4, no DST) has a stable offset year-round', () => {
    const now = new Date('2026-07-01T09:00:00Z') // 1:00 PM Dubai time
    const { reportEnd } = mostRecentReportTime('Asia/Dubai', NOON, now)
    expect(reportEnd.toISOString()).toBe('2026-07-01T08:00:00.000Z')
  })

  it('respects a non-noon configured report time (9:30 AM)', () => {
    const nineThirty: TimeOfDay = { hour: 9, minute: 30 }
    // 2026-09-18 10:00 AM in Asia/Karachi (UTC+5) == 2026-09-18T05:00:00Z
    const now = new Date('2026-09-18T05:00:00Z')
    const { reportStart, reportEnd } = mostRecentReportTime(
      'Asia/Karachi',
      nineThirty,
      now,
    )
    // 9:30 AM has already passed today -> today's 9:30 AM == 2026-09-18T04:30:00Z
    expect(reportEnd.toISOString()).toBe('2026-09-18T04:30:00.000Z')
    expect(reportEnd.getTime() - reportStart.getTime()).toBe(
      24 * 60 * 60 * 1000,
    )
  })
})

describe('nextReportTime', () => {
  it('is always exactly the configured local time, even across a DST boundary', () => {
    const now = new Date('2026-03-07T20:00:00Z') // 3:00 PM EST, day before US spring-forward
    const next = nextReportTime('America/New_York', NOON, now)
    const inZone = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(next)
    expect(inZone).toBe('12:00 PM')
  })

  it("returns tomorrow when now is already past today's occurrence", () => {
    const now = new Date('2026-09-18T07:30:00Z') // 12:30 PM Asia/Karachi
    const next = nextReportTime('Asia/Karachi', NOON, now)
    expect(next.toISOString()).toBe('2026-09-19T07:00:00.000Z')
  })

  it("returns today when now is before today's occurrence", () => {
    const now = new Date('2026-09-18T04:00:00Z') // 9:00 AM Asia/Karachi
    const next = nextReportTime('Asia/Karachi', NOON, now)
    expect(next.toISOString()).toBe('2026-09-18T07:00:00.000Z')
  })
})

describe('parseTimeOfDay / formatTimeOfDay', () => {
  it('round-trips a Postgres time value', () => {
    expect(parseTimeOfDay('09:30:00')).toEqual({ hour: 9, minute: 30 })
    expect(parseTimeOfDay('12:00')).toEqual({ hour: 12, minute: 0 })
  })

  it("formats a configured report time independent of the reader's timezone", () => {
    expect(formatTimeOfDay('12:00:00')).toBe('12:00 PM')
    expect(formatTimeOfDay('09:30:00')).toBe('9:30 AM')
  })
})

describe('roundToQuarterHour', () => {
  it('leaves an already-aligned value unchanged', () => {
    expect(roundToQuarterHour('09:30:00')).toBe('09:30')
    expect(roundToQuarterHour('00:00')).toBe('00:00')
  })

  it('rounds to the nearest quarter hour', () => {
    expect(roundToQuarterHour('09:07:00')).toBe('09:00')
    expect(roundToQuarterHour('09:08:00')).toBe('09:15')
    expect(roundToQuarterHour('09:22:00')).toBe('09:15')
    expect(roundToQuarterHour('09:23:00')).toBe('09:30')
  })

  it('wraps rounding up across the midnight boundary', () => {
    expect(roundToQuarterHour('23:53:00')).toBe('00:00')
  })
})

describe('formatBoundary', () => {
  it('renders the documented example format', () => {
    const reportEnd = new Date('2026-09-18T07:00:00.000Z')
    expect(formatBoundary(reportEnd, 'Asia/Karachi')).toBe('Sep 18, 12:00 PM')
  })
})
