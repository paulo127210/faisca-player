/** Abre o banco do aparelho uma única vez e aplica as migrações */
import * as SQLite from 'expo-sqlite';
import { migrar, type Banco } from './banco';

let promessa: Promise<Banco> | null = null;

export function obterBanco(): Promise<Banco> {
  if (!promessa) {
    promessa = (async () => {
      const db = (await SQLite.openDatabaseAsync('faisca.db')) as unknown as Banco;
      await migrar(db);
      return db;
    })().catch((e) => {
      promessa = null; // permite tentar de novo
      throw e;
    });
  }
  return promessa;
}
