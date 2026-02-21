import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('sqlite.db');
export const db = drizzle(sqlite, { schema });

// Auto-migrate (simple way for development)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS market_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    market_time TEXT NOT NULL,
    index_price REAL,
    trade_volume REAL,
    volume_delta REAL,
    mode TEXT NOT NULL,
    harmonics_json TEXT,
    phases_json TEXT
  )
`);
