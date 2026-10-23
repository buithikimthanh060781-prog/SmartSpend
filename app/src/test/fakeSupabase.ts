/* eslint-disable @typescript-eslint/no-explicit-any */
// Supabase giả lập trong bộ nhớ cho unit test. Hỗ trợ đủ toán tử mà các service Sprint 3 dùng và cho phép mô phỏng lỗi database.
export type Row = Record<string, any>;
export interface FakeDbError {
  code?: string;
  message: string;
}
export interface FakeCall {
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload?: unknown;
}

export function createFakeSupabase() {
  const db: Record<string, Row[]> = {};
  const calls: FakeCall[] = [];
  const failures: Array<{ table: string; op: string; error: FakeDbError }> = [];
  let seq = 0;

  /** Lần gọi kế tiếp của `op` trên `table` sẽ trả về lỗi `error` (mô phỏng CHECK/UNIQUE/FK/trigger của database). */
  function failNext(table: string, op: 'select' | 'insert' | 'update' | 'delete', error: FakeDbError) {
    failures.push({ table, op, error });
  }

  function from(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: any;
    let head = false;
    const orders: Array<{ col: string; asc: boolean }> = [];
    let range: [number, number] | null = null;

    const rows = () => db[table] ?? [];
    const val = (r: Row, col: string) => (r[col] === undefined ? null : r[col]);

    function execute(): { data: any; error: FakeDbError | null; count: number | null } {
      const fi = failures.findIndex((f) => f.table === table && f.op === op);
      if (fi >= 0) {
        const [f] = failures.splice(fi, 1);
        return { data: null, error: f.error, count: null };
      }
      if (op === 'insert') {
        const list: Row[] = Array.isArray(payload) ? payload : [payload];
        const inserted = list.map((r) => ({ id: `gen-${++seq}`, ...r }));
        db[table] = [...rows(), ...inserted];
        calls.push({ table, op, payload });
        return { data: inserted, error: null, count: null };
      }
      const matched = rows().filter((r) => filters.every((f) => f(r)));
      if (op === 'update') {
        matched.forEach((r) => Object.assign(r, payload));
        calls.push({ table, op, payload });
        return { data: matched, error: null, count: matched.length };
      }
      if (op === 'delete') {
        db[table] = rows().filter((r) => !matched.includes(r));
        calls.push({ table, op });
        return { data: matched, error: null, count: matched.length };
      }
      let out = [...matched];
      for (const o of [...orders].reverse()) {
        out.sort((a, b) => {
          const x = val(a, o.col);
          const y = val(b, o.col);
          return (x < y ? -1 : x > y ? 1 : 0) * (o.asc ? 1 : -1);
        });
      }
      if (range) out = out.slice(range[0], range[1] + 1);
      return { data: head ? null : out, error: null, count: matched.length };
    }

    const api: Record<string, any> = {
      select(_cols?: string, opts?: { head?: boolean }) {
        if (opts?.head) head = true;
        return api;
      },
      eq(col: string, v: unknown) { filters.push((r) => val(r, col) === v); return api; },
      neq(col: string, v: unknown) { filters.push((r) => val(r, col) !== v); return api; },
      gt(col: string, v: any) { filters.push((r) => val(r, col) > v); return api; },
      gte(col: string, v: any) { filters.push((r) => val(r, col) >= v); return api; },
      lt(col: string, v: any) { filters.push((r) => val(r, col) < v); return api; },
      lte(col: string, v: any) { filters.push((r) => val(r, col) <= v); return api; },
      in(col: string, vs: unknown[]) { filters.push((r) => vs.includes(val(r, col))); return api; },
      is(col: string, v: null) { filters.push((r) => val(r, col) === v); return api; },
      not(col: string, _operator: string, v: null) { filters.push((r) => val(r, col) !== v); return api; },
      order(col: string, opts?: { ascending?: boolean }) { orders.push({ col, asc: opts?.ascending !== false }); return api; },
      range(from: number, to: number) { range = [from, to]; return api; },
      limit(n: number) { range = [0, n - 1]; return api; },
      returns() { return api; },
      insert(p: Row | Row[]) { op = 'insert'; payload = p; return api; },
      update(p: Row) { op = 'update'; payload = p; return api; },
      delete() { op = 'delete'; return api; },
      maybeSingle() {
        const r = execute();
        return Promise.resolve({ data: r.error ? null : (r.data?.[0] ?? null), error: r.error });
      },
      single() {
        const r = execute();
        const row = r.data?.[0] ?? null;
        return Promise.resolve({ data: row, error: r.error ?? (row ? null : { message: 'no rows' }) });
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(execute()).then(resolve, reject);
      },
    };
    return api;
  }

  return { db, calls, failNext, supabase: { from } };
}

/** Thể hiện dùng chung: `vi.mock('@/lib/supabase')` trả về chính nó để test và code cùng thấy một database giả. */
export const sharedFake = createFakeSupabase();
