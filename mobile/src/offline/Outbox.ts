import { openDatabaseSync } from 'expo-sqlite';

const db = openDatabaseSync('outbox.db');

export interface OutboxEntry {
  id: number;
  mutationKey: string;
  payload: string;
  timestamp: number;
  retries: number;
  userId: number | null;
}

export const Outbox = {
  init() {
    db.execSync(`CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mutationKey TEXT NOT NULL,
      payload TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      retries INTEGER DEFAULT 0,
      userId INTEGER
    )`);
    const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(outbox)');
    if (!columns.some((column) => column.name === 'userId')) {
      db.execSync('ALTER TABLE outbox ADD COLUMN userId INTEGER');
    }
  },

  enqueue(mutationKey: string, payload: unknown, userId: number) {
    this.init();
    db.runSync(
      'INSERT INTO outbox (mutationKey, payload, timestamp, userId) VALUES (?, ?, ?, ?)',
      [mutationKey, JSON.stringify(payload), Date.now(), userId]
    );
  },

  getAll(userId: number): OutboxEntry[] {
    this.init();
    return db.getAllSync('SELECT * FROM outbox WHERE userId = ? ORDER BY timestamp ASC', [userId]);
  },

  updatePayload(id: number, payload: unknown) {
    this.init();
    db.runSync('UPDATE outbox SET payload = ? WHERE id = ?', [JSON.stringify(payload), id]);
  },

  remove(id: number) {
    this.init();
    db.runSync('DELETE FROM outbox WHERE id = ?', [id]);
  },

  incrementRetries(id: number) {
    this.init();
    db.runSync('UPDATE outbox SET retries = retries + 1 WHERE id = ?', [id]);
  },

  clear() {
    this.init();
    db.runSync('DELETE FROM outbox');
  },
};