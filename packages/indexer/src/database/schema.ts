export const SCHEMA_VERSION = 1;

export const CREATE_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  chain TEXT NOT NULL,
  event_type TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  block_hash TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  token_address TEXT,
  token_id TEXT,
  amount TEXT,
  data TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(transaction_hash, log_index)
);
`;

export const CREATE_TRANSACTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_id TEXT,
  amount TEXT,
  l1_tx_hash TEXT,
  l2_tx_hash TEXT,
  initiated_at INTEGER NOT NULL,
  initiated_block INTEGER NOT NULL,
  proven_at INTEGER,
  proven_block INTEGER,
  proven_tx_hash TEXT,
  finalized_at INTEGER,
  finalized_block INTEGER,
  finalized_tx_hash TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
`;

export const CREATE_SYNC_STATE_TABLE = `
CREATE TABLE IF NOT EXISTS sync_state (
  chain TEXT PRIMARY KEY,
  last_synced_block INTEGER NOT NULL,
  last_synced_timestamp INTEGER NOT NULL,
  is_indexing INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
`;

export const CREATE_EVENTS_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_events_chain ON events(chain);`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);`,
  `CREATE INDEX IF NOT EXISTS idx_events_block ON events(block_number);`,
  `CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);`,
  `CREATE INDEX IF NOT EXISTS idx_events_from ON events(from_address);`,
  `CREATE INDEX IF NOT EXISTS idx_events_to ON events(to_address);`,
  `CREATE INDEX IF NOT EXISTS idx_events_token ON events(token_address);`,
  `CREATE INDEX IF NOT EXISTS idx_events_tx ON events(transaction_hash);`,
];

export const CREATE_TRANSACTIONS_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_address);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_token ON transactions(token_address);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_initiated ON transactions(initiated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_l1_tx ON transactions(l1_tx_hash);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_l2_tx ON transactions(l2_tx_hash);`,
];

export const INIT_SYNC_STATE = `
INSERT OR IGNORE INTO sync_state (chain, last_synced_block, last_synced_timestamp, is_indexing)
VALUES
  ('l1', 0, 0, 0),
  ('l2', 0, 0, 0);
`;

export const ALL_SCHEMAS = [
  CREATE_EVENTS_TABLE,
  CREATE_TRANSACTIONS_TABLE,
  CREATE_SYNC_STATE_TABLE,
  ...CREATE_EVENTS_INDEXES,
  ...CREATE_TRANSACTIONS_INDEXES,
  INIT_SYNC_STATE,
];

export interface EventRow {
  id: string;
  chain: string;
  event_type: string;
  block_number: number;
  block_hash: string;
  transaction_hash: string;
  log_index: number;
  timestamp: number;
  from_address: string;
  to_address: string;
  token_address: string | null;
  token_id: string | null;
  amount: string | null;
  data: string | null;
  created_at: number;
}

export interface TransactionRow {
  id: string;
  type: string;
  user_address: string;
  token_address: string;
  token_id: string | null;
  amount: string | null;
  l1_tx_hash: string | null;
  l2_tx_hash: string | null;
  initiated_at: number;
  initiated_block: number;
  proven_at: number | null;
  proven_block: number | null;
  proven_tx_hash: string | null;
  finalized_at: number | null;
  finalized_block: number | null;
  finalized_tx_hash: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface SyncStateRow {
  chain: string;
  last_synced_block: number;
  last_synced_timestamp: number;
  is_indexing: number;
  updated_at: number;
}
