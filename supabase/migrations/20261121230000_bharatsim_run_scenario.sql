-- Speak-to-Test scenario and validated test spec stored with a run (additive, nullable).
ALTER TABLE bharatsim.runs ADD COLUMN IF NOT EXISTS scenario_json text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'runs_scenario_json_size_check') THEN
    ALTER TABLE bharatsim.runs ADD CONSTRAINT runs_scenario_json_size_check CHECK (scenario_json IS NULL OR length(scenario_json) <= 6000);
  END IF;
END $$;
