-- Versioned developer reports (deterministic evidence + Gemini analysis) per run. Additive.
CREATE TABLE IF NOT EXISTS bharatsim.run_reports (
  id text PRIMARY KEY,
  run_id text NOT NULL,
  owner_id uuid,
  created_at text NOT NULL,
  version integer NOT NULL,
  model text,
  report_json text NOT NULL CHECK (length(report_json) <= 400000)
);
CREATE INDEX IF NOT EXISTS run_reports_run_id_idx ON bharatsim.run_reports (run_id, version DESC);
ALTER TABLE bharatsim.run_reports ENABLE ROW LEVEL SECURITY;
