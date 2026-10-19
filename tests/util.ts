import { DatabaseSync } from 'node:sqlite';
import type { Banco, Param } from '../src/lib/banco';

/** Adaptador: expõe o SQLite do Node com a mesma interface do expo-sqlite */
export function bancoDeTeste(): Banco {
  const d = new DatabaseSync(':memory:');
  const run = (sql: string, p: Param[]) => {
    const r = d.prepare(sql).run(...p);
    return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
  };
  return {
    execAsync: async (sql) => void d.exec(sql),
    runAsync: async (sql, p) => run(sql, p),
    getAllAsync: async <T>(sql: string, p: Param[]) => d.prepare(sql).all(...p) as T[],
    getFirstAsync: async <T>(sql: string, p: Param[]) => (d.prepare(sql).get(...p) as T) ?? null,
    prepareAsync: async (sql) => {
      const st = d.prepare(sql);
      return {
        executeAsync: async (p) => {
          const r = st.run(...p);
          return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
        },
        finalizeAsync: async () => {},
      };
    },
    withTransactionAsync: async (tarefa) => {
      d.exec('BEGIN');
      try {
        await tarefa();
        d.exec('COMMIT');
      } catch (e) {
        d.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
