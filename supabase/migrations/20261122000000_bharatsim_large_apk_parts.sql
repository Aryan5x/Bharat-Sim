-- APKs up to 500 MB, stored as <=45 MB parts (Supabase Free caps each object at 50 MB).
ALTER TABLE bharatsim.runs DROP CONSTRAINT IF EXISTS runs_apk_size_bytes_check;
ALTER TABLE bharatsim.runs ADD CONSTRAINT runs_apk_size_bytes_check
  CHECK (apk_size_bytes IS NULL OR apk_size_bytes BETWEEN 1 AND 524288000);
