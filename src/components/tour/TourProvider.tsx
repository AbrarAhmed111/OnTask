'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useModalOpen } from '@/components/tour/useModalOpen'
import {
  dropCurrentStep,
  goBack,
  goNext,
  startRun,
} from '@/lib/tour/navigation'
import { resolveTourTarget } from '@/lib/tour/target'
import type {
  TourDefinition,
  TourId,
  TourOutcome,
  TourRun,
} from '@/lib/tour/types'

// The tour engine's state, kept above the workspace pages so it outlives
// moving between them: "Replay tour" is clicked on Settings but the tour runs
// on the Overview, and the request has to survive that navigation. Nothing here
// draws anything -- <TourLayer/> renders the running tour, from inside the
// workspace shell so it inherits the workspace accent.
type TourContextValue = {
  // The tour that is running, if any.
  run: TourRun | null
  // Whether a tour may open on its own right now: none is already running and
  // nothing else is asking for the user's attention (a dialog, or the
  // first-visit welcome the caller reports through `paused`).
  canStart: boolean
  // Begins a tour with the steps that have something on screen to point at.
  // False when none do.
  start: (definition: TourDefinition) => boolean
  next: () => void
  back: () => void
  // Ends the tour as skipped (Skip, Close or Escape) and records it.
  skip: () => void
  // The current step's target disappeared while the tour was open.
  dropStep: () => void
  // Ends the tour without recording anything: the user left the page it was
  // running on, so it is offered again next time.
  cancel: () => void
  // "Replay" on Settings files a request; the Overview, where the targets are,
  // picks it up.
  replayRequest: TourId | null
  requestReplay: (id: TourId) => void
  clearReplayRequest: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour() {
  const value = useContext(TourContext)
  if (!value) throw new Error('useTour must be used within a TourProvider')
  return value
}

export function TourProvider({
  paused = false,
  onOutcome,
  children,
}: {
  // The caller is showing something that should finish first.
  paused?: boolean
  // Called once when a tour ends as completed or skipped.
  onOutcome: (tourId: TourId, outcome: TourOutcome) => void
  children: ReactNode
}) {
  const [run, setRunState] = useState<TourRun | null>(null)
  // The latest run, readable from callbacks that must stay stable and that
  // must not act twice (a double-click on "Done" finishes once).
  const runRef = useRef<TourRun | null>(null)
  const [replayRequest, setReplayRequest] = useState<TourId | null>(null)
  const modalOpen = useModalOpen()

  const onOutcomeRef = useRef(onOutcome)
  useEffect(() => {
    onOutcomeRef.current = onOutcome
  })

  const setRun = useCallback((next: TourRun | null) => {
    runRef.current = next
    setRunState(next)
  }, [])

  const finish = useCallback(
    (outcome: TourOutcome) => {
      const current = runRef.current
      if (!current) return
      setRun(null)
      onOutcomeRef.current(current.tourId, outcome)
    },
    [setRun],
  )

  const start = useCallback(
    (definition: TourDefinition) => {
      if (runRef.current) return false
      const steps = definition.steps.filter(
        step => resolveTourTarget(step.target) !== null,
      )
      const next = startRun(definition.id, steps)
      if (!next) return false
      setRun(next)
      return true
    },
    [setRun],
  )

  const next = useCallback(() => {
    const current = runRef.current
    if (!current) return
    const result = goNext(current)
    if ('done' in result) finish('completed')
    else setRun(result.run)
  }, [finish, setRun])

  const back = useCallback(() => {
    const current = runRef.current
    if (current) setRun(goBack(current))
  }, [setRun])

  const skip = useCallback(() => finish('skipped'), [finish])

  const dropStep = useCallback(() => {
    const current = runRef.current
    if (!current) return
    const result = dropCurrentStep(current)
    if (result === 'finished') finish('completed')
    else setRun(result)
  }, [finish, setRun])

  const cancel = useCallback(() => setRun(null), [setRun])

  const requestReplay = useCallback((id: TourId) => setReplayRequest(id), [])
  const clearReplayRequest = useCallback(() => setReplayRequest(null), [])

  const canStart = run === null && !paused && !modalOpen

  const value = useMemo<TourContextValue>(
    () => ({
      run,
      canStart,
      start,
      next,
      back,
      skip,
      dropStep,
      cancel,
      replayRequest,
      requestReplay,
      clearReplayRequest,
    }),
    [
      run,
      canStart,
      start,
      next,
      back,
      skip,
      dropStep,
      cancel,
      replayRequest,
      requestReplay,
      clearReplayRequest,
    ],
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}
