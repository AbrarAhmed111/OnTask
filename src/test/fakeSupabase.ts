import { vi } from 'vitest'

// A stand-in for the Supabase browser client, just capable enough to run the
// data hooks for real: tables of rows you can select from (eq / is filters, a
// single-row read), RPCs that are recorded, realtime channels you can fire
// events into, and switches to hold a read open or make it fail -- so a test
// can decide whether the cache or the server "answers first", or whether the
// network is down.

type Row = Record<string, unknown>
type Filter = { column: string; op: 'eq' | 'is'; value: unknown }
type RealtimeHandler = {
  table: string
  callback: (payload: Record<string, unknown>) => void
}
type Held = { promise: Promise<void>; release: () => void }
type RpcResult = { error: unknown; data?: unknown }
type RpcHandler = (
  args: Record<string, unknown>,
) => RpcResult | Promise<RpcResult>

export function createFakeSupabase() {
  const tables = new Map<string, Row[]>()
  const held = new Map<string, Held>()
  const failing = new Set<string>()
  const realtime = new Set<RealtimeHandler>()
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = []
  const reads: { table: string; single: boolean; filters: Filter[] }[] = []
  const rpcHandlers = new Map<string, RpcHandler>()

  const rowsOf = (table: string) => tables.get(table) ?? []

  async function executeRead(
    table: string,
    filters: Filter[],
    single: boolean,
    mustExist: boolean,
  ) {
    reads.push({ table, single, filters })
    const gate = held.get(table)
    if (gate) await gate.promise
    if (failing.has(table)) {
      return { data: null, error: { message: 'Failed to fetch' } }
    }
    const matching = rowsOf(table).filter(row =>
      filters.every(f =>
        f.op === 'is' ? row[f.column] === f.value : row[f.column] === f.value,
      ),
    )
    if (single && mustExist && matching.length === 0) {
      // What PostgREST answers for .single() when no row is visible: the row is
      // gone, or row-level security hides it.
      return {
        data: null,
        error: { code: 'PGRST116', message: 'The result contains 0 rows' },
      }
    }
    return single
      ? { data: matching[0] ?? null, error: null }
      : { data: matching, error: null }
  }

  function query(table: string) {
    const filters: Filter[] = []
    let single = false
    let mustExist = false
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push({ column, op: 'eq', value })
        return builder
      },
      is: (column: string, value: unknown) => {
        filters.push({ column, op: 'is', value })
        return builder
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => {
        single = true
        return builder
      },
      single: () => {
        single = true
        mustExist = true
        return builder
      },
      // Writes are accepted and ignored: these tests are about reads and RPCs.
      insert: () => Promise.resolve({ error: null }),
      update: () => builder,
      delete: () => builder,
      then: (
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => executeRead(table, filters, single, mustExist).then(resolve, reject),
    }
    return builder
  }

  const client = {
    from: (table: string) => query(table),
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      const handler = rpcHandlers.get(name)
      return Promise.resolve(handler ? handler(args) : { error: null })
    },
    channel: () => {
      const channel = {
        on: (
          _type: string,
          filter: { table: string },
          callback: RealtimeHandler['callback'],
        ) => {
          realtime.add({ table: filter.table, callback })
          return channel
        },
        subscribe: () => channel,
      }
      return channel
    },
    removeChannel: () => undefined,
  }

  return {
    client,
    rpcCalls,
    reads,
    setRows: (table: string, rows: Row[]) => tables.set(table, rows),
    rowsOf,
    // Every read of `table` waits until released.
    hold(table: string) {
      let release!: () => void
      const promise = new Promise<void>(resolve => {
        release = resolve
      })
      held.set(table, { promise, release })
      return () => {
        release()
        held.delete(table)
      }
    },
    failReads: (table: string, fail: boolean) =>
      void (fail ? failing.add(table) : failing.delete(table)),
    onRpc: (name: string, handler: RpcHandler) =>
      void rpcHandlers.set(name, handler),
    // A postgres_changes event on `table`.
    emit(table: string, payload: Record<string, unknown>) {
      for (const handler of realtime) {
        if (handler.table === table) handler.callback(payload)
      }
    },
    reset() {
      tables.clear()
      held.clear()
      failing.clear()
      realtime.clear()
      rpcCalls.length = 0
      reads.length = 0
      rpcHandlers.clear()
    },
  }
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>

// The bits of the browser the data hooks touch (window/document events and
// timers), so they can run under Node.
export function stubBrowser() {
  const listeners = new Map<string, Set<() => void>>()
  const eventTarget = {
    addEventListener: (type: string, handler: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(handler)
    },
    removeEventListener: (type: string, handler: () => void) =>
      void listeners.get(type)?.delete(handler),
  }
  vi.stubGlobal('window', {
    ...eventTarget,
    // Looked up at call time, so they follow whatever timers the test faked.
    setInterval: (...args: Parameters<typeof setInterval>) =>
      setInterval(...args),
    clearInterval: (id: Parameters<typeof clearInterval>[0]) =>
      clearInterval(id),
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (id: Parameters<typeof clearTimeout>[0]) => clearTimeout(id),
  })
  vi.stubGlobal('document', { ...eventTarget, visibilityState: 'visible' })
  return {
    // The tab becomes visible again / the network comes back.
    fire(type: 'online' | 'visibilitychange') {
      for (const handler of listeners.get(type) ?? []) handler()
    },
  }
}

// The one instance the mocked `@/lib/supabase/client` hands out, so a test can
// script the server that the hooks under test talk to.
export const fakeSupabase = createFakeSupabase()

// A database that has not had migration 0043 applied: PostgREST answers PGRST202
// ("could not find the function") for the guarded completion.
export function omitGuardedCompletion(fake: FakeSupabase) {
  fake.onRpc('auto_complete_workspace_task', () => ({
    error: {
      code: 'PGRST202',
      message:
        'Could not find the function public.auto_complete_workspace_task',
    },
  }))
}

// The rules of migration 0043's auto_complete_workspace_task, over the fake's
// `workspace_tasks` rows (the SQL itself is checked in
// supabase/tests/0043_guarded_task_auto_completion.sql): completes only a task
// that is working, is the run the caller named (to the millisecond) and is out
// of time on the DATABASE's clock -- which `clockOffsetMs` lets a test set apart
// from the browser's. Otherwise nothing changes and the current row comes back.
export function serveGuardedCompletion(
  fake: FakeSupabase,
  {
    clockOffsetMs = 0,
    failTimes = 0,
  }: { clockOffsetMs?: number; failTimes?: number } = {},
) {
  let calls = 0
  fake.onRpc('auto_complete_workspace_task', args => {
    calls += 1
    // The network fails the first `failTimes` requests.
    if (calls <= failTimes) return { error: { message: 'Failed to fetch' } }
    const row = fake
      .rowsOf('workspace_tasks')
      .find(r => r.id === args.p_task_id)
    if (!row) return { error: null, data: { outcome: 'not_found', task: null } }
    const refused = (outcome: string) => ({
      error: null,
      data: { outcome, task: { ...row } },
    })
    if (row.status !== 'working') return refused('not_running')

    const startedMs = row.started_at ? Date.parse(String(row.started_at)) : null
    const expectedMs = args.p_expected_started_at
      ? Date.parse(String(args.p_expected_started_at))
      : null
    const sameRun =
      startedMs === null
        ? expectedMs === null
        : expectedMs !== null && Math.abs(startedMs - expectedMs) <= 1
    if (!sameRun) return refused('different_run')

    const serverNow = Date.now() + clockOffsetMs
    const worked =
      Number(row.actual_seconds) +
      (startedMs === null ? 0 : Math.max(0, serverNow - startedMs) / 1000)
    if (worked < Number(row.planned_seconds)) return refused('not_due')

    row.status = 'completed'
    row.started_at = null
    row.actual_seconds = Math.round(worked)
    row.completed_at = new Date(serverNow).toISOString()
    return { error: null, data: { outcome: 'completed', task: { ...row } } }
  })
}
