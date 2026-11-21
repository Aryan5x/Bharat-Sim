-- Custom personas (user-defined device and network) and extracted APK metadata.
ALTER TABLE bharatsim.runs ADD COLUMN IF NOT EXISTS persona_json text;
ALTER TABLE bharatsim.runs ADD COLUMN IF NOT EXISTS apk_meta_json text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'runs_persona_json_size_check') THEN
    ALTER TABLE bharatsim.runs ADD CONSTRAINT runs_persona_json_size_check CHECK (persona_json IS NULL OR length(persona_json) <= 4000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'runs_apk_meta_json_size_check') THEN
    ALTER TABLE bharatsim.runs ADD CONSTRAINT runs_apk_meta_json_size_check CHECK (apk_meta_json IS NULL OR length(apk_meta_json) <= 8000);
  END IF;
END $$;
