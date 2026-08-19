CREATE TABLE IF NOT EXISTS proofstamp_metrics (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  proofstamps_created INTEGER NOT NULL DEFAULT 0,
  email_app_opened INTEGER NOT NULL DEFAULT 0,
  total_files INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO proofstamp_metrics
  (id, proofstamps_created, email_app_opened, total_files)
VALUES (1, 0, 0, 0);
