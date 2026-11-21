-- The claim endpoint marks a worker 'claiming' while it reserves a run; allow it.
ALTER TABLE bharatsim.workers DROP CONSTRAINT IF EXISTS workers_status_check;
ALTER TABLE bharatsim.workers ADD CONSTRAINT workers_status_check CHECK (status IN ('idle','claiming','running','offline'));
