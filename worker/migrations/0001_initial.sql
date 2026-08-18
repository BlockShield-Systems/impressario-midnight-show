CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL,
  player_name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  elapsed_ms INTEGER,
  deaths INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  checkpoint_order INTEGER NOT NULL DEFAULT 0,
  checkpoint_name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'completed',
        'flagged',
        'abandoned'
      )
    ),
  ranked_ms INTEGER,
  build_version TEXT NOT NULL,
  claim_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_public_ranking
ON runs (
  status,
  ranked_ms,
  deaths,
  hits,
  elapsed_ms,
  finished_at
);

CREATE INDEX IF NOT EXISTS idx_runs_started_at
ON runs (started_at);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id)
    REFERENCES runs(id)
    ON DELETE CASCADE,
  UNIQUE (run_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_submissions_run
ON submissions (run_id, sequence);
