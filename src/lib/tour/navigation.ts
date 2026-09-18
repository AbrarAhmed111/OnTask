import type { TourId, TourRun, TourStepDefinition } from '@/lib/tour/types'

// Pure movement through a running tour. The provider owns the React state and
// the side effects (persisting an outcome); everything decidable without a DOM
// lives here so it can be tested directly.

// A tour with nothing to point at doesn't start at all.
export function startRun(
  tourId: TourId,
  steps: TourStepDefinition[],
): TourRun | null {
  if (steps.length === 0) return null
  return { tourId, steps, index: 0, direction: 1 }
}

export type Advance = { run: TourRun } | { done: true }

// Next on the last step finishes the tour.
export function goNext(run: TourRun): Advance {
  if (run.index >= run.steps.length - 1) return { done: true }
  return { run: { ...run, index: run.index + 1, direction: 1 } }
}

// Back on the first step stays where it is.
export function goBack(run: TourRun): TourRun {
  return { ...run, index: Math.max(0, run.index - 1), direction: -1 }
}

// The current step's target has gone (its UI was removed while the tour was
// open). Take the step out and carry on in the direction the user was going:
//  - `null`       nothing is left to show;
//  - `'finished'` it was the last step, so the user has effectively reached
//                 the end;
//  - a run        otherwise.
export function dropCurrentStep(run: TourRun): TourRun | 'finished' | null {
  const steps = run.steps.filter((_, index) => index !== run.index)
  if (steps.length === 0) return null
  if (run.direction === 1) {
    if (run.index >= steps.length) return 'finished'
    return { ...run, steps }
  }
  return { ...run, steps, index: Math.max(0, run.index - 1) }
}
