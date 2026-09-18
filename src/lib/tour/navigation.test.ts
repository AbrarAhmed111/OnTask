import { describe, expect, it } from 'vitest'
import {
  dropCurrentStep,
  goBack,
  goNext,
  startRun,
} from '@/lib/tour/navigation'
import type { TourRun, TourStepDefinition } from '@/lib/tour/types'

const step = (target: TourStepDefinition['target']): TourStepDefinition => ({
  target,
  title: target,
  description: `About ${target}`,
})
const steps = [step('goals'), step('resources'), step('settings')]

const run = (overrides: Partial<TourRun> = {}): TourRun => ({
  tourId: 'personal-workspace',
  steps,
  index: 0,
  direction: 1,
  ...overrides,
})

describe('startRun', () => {
  it('starts at the first step', () => {
    expect(startRun('shared-workspace', steps)).toEqual({
      tourId: 'shared-workspace',
      steps,
      index: 0,
      direction: 1,
    })
  })

  it('does not start a tour with nothing to point at', () => {
    expect(startRun('personal-workspace', [])).toBeNull()
  })
})

describe('goNext', () => {
  it('moves forward one step', () => {
    expect(goNext(run({ index: 0 }))).toEqual({
      run: run({ index: 1, direction: 1 }),
    })
  })

  it('finishes on the last step', () => {
    expect(goNext(run({ index: 2 }))).toEqual({ done: true })
  })

  it('finishes a one-step tour at once', () => {
    expect(goNext(run({ steps: [step('goals')], index: 0 }))).toEqual({
      done: true,
    })
  })
})

describe('goBack', () => {
  it('moves back one step', () => {
    expect(goBack(run({ index: 2 }))).toEqual(run({ index: 1, direction: -1 }))
  })

  it('stays on the first step', () => {
    expect(goBack(run({ index: 0 })).index).toBe(0)
  })
})

describe('dropCurrentStep', () => {
  it('removes the step and carries on to the one that followed it', () => {
    expect(dropCurrentStep(run({ index: 1 }))).toEqual(
      run({ steps: [step('goals'), step('settings')], index: 1 }),
    )
  })

  it('treats a missing last step as the end of the tour', () => {
    expect(dropCurrentStep(run({ index: 2 }))).toBe('finished')
  })

  it('carries on backwards when the user was heading back', () => {
    expect(dropCurrentStep(run({ index: 1, direction: -1 }))).toEqual(
      run({
        steps: [step('goals'), step('settings')],
        index: 0,
        direction: -1,
      }),
    )
  })

  it('stays on the first step when the first step is the one that is missing', () => {
    expect(dropCurrentStep(run({ index: 0, direction: -1 }))).toEqual(
      run({
        steps: [step('resources'), step('settings')],
        index: 0,
        direction: -1,
      }),
    )
  })

  it('leaves nothing to show when the only step is missing', () => {
    expect(dropCurrentStep(run({ steps: [step('goals')] }))).toBeNull()
  })
})
