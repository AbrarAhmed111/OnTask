import { describe, expect, it } from 'vitest'
import {
  SnapshotState,
  authoritativeView,
  initialSnapshot,
  snapshotReducer,
  snapshotView,
} from '@/lib/snapshots/snapshotState'

type List = string[]
const reduce = (
  state: SnapshotState<List>,
  ...actions: Parameters<typeof snapshotReducer<List>>[1][]
) =>
  actions.reduce((current, action) => snapshotReducer(current, action), state)

const fresh = () =>
  reduce(initialSnapshot<List>(null, []), {
    type: 'reset',
    key: 'k1',
    initial: [],
  })

describe('snapshotReducer', () => {
  it('a cache read fills an empty snapshot but marks it as cached, not confirmed', () => {
    const state = reduce(fresh(), {
      type: 'hydrate',
      key: 'k1',
      data: ['cached'],
    })

    expect(state.origin).toBe('cache')
    expect(state.data).toEqual(['cached'])
    expect(authoritativeView(state)).toBeNull()
  })

  it('a server read confirms, and replaces whatever was there', () => {
    const state = reduce(
      fresh(),
      { type: 'hydrate', key: 'k1', data: ['cached'] },
      { type: 'confirm', key: 'k1', data: ['server'] },
    )

    expect(state.origin).toBe('server')
    expect(state.data).toEqual(['server'])
    expect(authoritativeView(state)?.data).toEqual(['server'])
  })

  it('a slow cache read can never overwrite server data', () => {
    const state = reduce(
      fresh(),
      { type: 'confirm', key: 'k1', data: ['server'] },
      { type: 'hydrate', key: 'k1', data: ['older cache'] },
    )

    expect(state.data).toEqual(['server'])
    expect(state.origin).toBe('server')
  })

  it('a slow cache read does not overwrite a change already applied', () => {
    const state = reduce(
      fresh(),
      { type: 'change', key: 'k1', next: cur => [...cur, 'realtime'] },
      { type: 'hydrate', key: 'k1', data: ['cached'] },
    )

    expect(state.data).toEqual(['realtime'])
  })

  it('a change on top of cached data leaves it cached: it is not confirmed until the server answers', () => {
    const state = reduce(
      fresh(),
      { type: 'hydrate', key: 'k1', data: ['a'] },
      { type: 'change', key: 'k1', next: cur => [...cur, 'b'] },
    )

    expect(state.data).toEqual(['a', 'b'])
    expect(state.origin).toBe('cache')
    expect(authoritativeView(state)).toBeNull()
  })

  it('a change on top of server data stays confirmed', () => {
    const state = reduce(
      fresh(),
      { type: 'confirm', key: 'k1', data: ['a'] },
      { type: 'change', key: 'k1', next: cur => [...cur, 'b'] },
    )

    expect(state.origin).toBe('server')
    expect(authoritativeView(state)?.data).toEqual(['a', 'b'])
  })

  it('accepts a plain value as well as an updater function', () => {
    const state = reduce(fresh(), { type: 'change', key: 'k1', next: ['x'] })

    expect(state.data).toEqual(['x'])
  })

  it('drops every action issued for another key', () => {
    let state = reduce(fresh(), { type: 'confirm', key: 'k1', data: ['mine'] })

    state = reduce(
      state,
      { type: 'hydrate', key: 'other', data: ['theirs'] },
      { type: 'confirm', key: 'other', data: ['theirs'] },
      { type: 'change', key: 'other', next: ['theirs'] },
    )

    expect(state.data).toEqual(['mine'])
  })

  it('a late result for the previous key does not land after the key changed', () => {
    let state = reduce(fresh(), {
      type: 'confirm',
      key: 'k1',
      data: ['a-data'],
    })
    state = reduce(state, { type: 'reset', key: 'k2', initial: [] })

    // The old key's fetch resolves only now.
    state = reduce(state, { type: 'confirm', key: 'k1', data: ['a-data'] })

    expect(state.key).toBe('k2')
    expect(state.data).toEqual([])
    expect(state.origin).toBe('empty')
  })

  it('reset discards everything, including confirmation', () => {
    const state = reduce(
      fresh(),
      { type: 'confirm', key: 'k1', data: ['a'] },
      { type: 'reset', key: 'k1', initial: [] },
    )

    expect(state.origin).toBe('empty')
    expect(authoritativeView(state)).toBeNull()
  })
})

describe('snapshotView', () => {
  it("shows nothing of the previous key's data on the render after the key changes", () => {
    const state = reduce(fresh(), {
      type: 'confirm',
      key: 'k1',
      data: ['user A tasks'],
    })

    // The consumer now renders for k2, before any effect has reset the state.
    const view = snapshotView(state, 'k2', [])

    expect(view.data).toEqual([])
    expect(view.origin).toBe('empty')
    expect(authoritativeView(view)).toBeNull()
  })

  it('passes the state through for the matching key', () => {
    const state = reduce(fresh(), { type: 'confirm', key: 'k1', data: ['a'] })

    expect(snapshotView(state, 'k1', [])).toBe(state)
  })
})
