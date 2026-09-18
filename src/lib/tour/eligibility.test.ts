import { describe, expect, it } from 'vitest'
import { shouldAutoStartInitialTour } from '@/lib/tour/eligibility'

describe('shouldAutoStartInitialTour', () => {
  it('starts the initial tour for a new personal workspace user', () => {
    expect(
      shouldAutoStartInitialTour({
        isPersonal: true,
        initialTourDue: true,
        alreadyOpened: false,
      }),
    ).toBe(true)
  })

  it('does not start again after completion or skipping', () => {
    for (const initialTourDue of [false, null]) {
      expect(
        shouldAutoStartInitialTour({
          isPersonal: true,
          initialTourDue,
          alreadyOpened: false,
        }),
      ).toBe(false)
    }
  })

  it('does not start automatically in a shared workspace', () => {
    expect(
      shouldAutoStartInitialTour({
        isPersonal: false,
        initialTourDue: true,
        alreadyOpened: false,
      }),
    ).toBe(false)
  })

  it('does not reopen during the same visit', () => {
    expect(
      shouldAutoStartInitialTour({
        isPersonal: true,
        initialTourDue: true,
        alreadyOpened: true,
      }),
    ).toBe(false)
  })
})
