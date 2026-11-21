-- Personal laptop workers: a signed-in user can connect their own machine. Each personal worker has
-- an owner and a SHA-256 hash of its key (the key itself is never stored). Additive and nullable:
-- existing team workers keep owner_id NULL.
ALTER TABLE bharatsim.workers ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE bharatsim.workers ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE bharatsim.workers ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE bharatsim.workers ADD COLUMN IF NOT EXISTS created_at text;
ALTER TABLE bharatsim.workers ADD COLUMN IF NOT EXISTS revoked_at text;
CREATE INDEX IF NOT EXISTS workers_owner_id_idx ON bharatsim.workers (owner_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workers_label_size_check') THEN
    ALTER TABLE bharatsim.workers ADD CONSTRAINT workers_label_size_check CHECK (label IS NULL OR length(label) <= 40);
  END IF;
END $$;
