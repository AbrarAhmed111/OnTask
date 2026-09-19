import { act, create, ReactTestRenderer } from 'react-test-renderer'

// Runs a React hook for real -- effects, state, re-renders -- without a DOM, so
// hooks can be tested the way components are used. (renderToStaticMarkup, which
// the component tests use, never runs effects.)
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

export function renderHook<Props, Result>(
  useHook: (props: Props) => Result,
  initialProps: Props,
) {
  // Every value the hook returned, in order: lets a test assert something was
  // NEVER rendered, not just that it isn't there at the end.
  const renders: Result[] = []
  const result = { current: undefined as unknown as Result }

  function Probe({ hookProps }: { hookProps: Props }) {
    result.current = useHook(hookProps)
    renders.push(result.current)
    return null
  }

  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(<Probe hookProps={initialProps} />)
  })

  return {
    result,
    renders,
    rerender: (props: Props) =>
      act(() => {
        renderer.update(<Probe hookProps={props} />)
      }),
    unmount: () =>
      act(() => {
        renderer.unmount()
      }),
  }
}

// Lets pending promises and IndexedDB callbacks finish, inside act().
export async function settle(rounds = 4) {
  await act(async () => {
    for (let i = 0; i < rounds; i++) {
      await new Promise<void>(resolve => setImmediate(resolve))
    }
  })
}

export { act }
