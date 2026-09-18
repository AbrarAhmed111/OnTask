// Automatic onboarding is user-level: the Personal Workspace is the one
// initial-tour checkpoint. Shared-workspace tours remain available through an
// explicit replay request, but a new workspace never makes a tour due.
export function shouldAutoStartInitialTour({
  isPersonal,
  initialTourDue,
  alreadyOpened,
}: {
  isPersonal: boolean
  initialTourDue: boolean | null
  alreadyOpened: boolean
}) {
  return isPersonal && initialTourDue === true && !alreadyOpened
}
