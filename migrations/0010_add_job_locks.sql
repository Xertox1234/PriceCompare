-- Migration: Add Job Locks Table
-- Description: Adds distributed locking mechanism for preventing duplicate job execution in multi-server setups
-- Author: Claude
-- Date: 2025-11-16

-- Job locks for distributed job coordination
CREATE TABLE IF NOT EXISTS job_locks (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL UNIQUE,
  locked_by VARCHAR(200) NOT NULL, -- Server instance ID (hostname-pid)
  locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL, -- Lock auto-expires to handle server crashes
  metadata TEXT -- Optional JSON metadata for debugging
);

-- Indexes for efficient lock queries
CREATE INDEX idx_job_locks_name ON job_locks(job_name);
CREATE INDEX idx_job_locks_expires ON job_locks(expires_at);

-- Comments for documentation
COMMENT ON TABLE job_locks IS 'Distributed locks for preventing duplicate scheduled job execution across multiple servers';
COMMENT ON COLUMN job_locks.job_name IS 'Unique identifier for the job (e.g., "price-analytics:weekly-aggregation")';
COMMENT ON COLUMN job_locks.locked_by IS 'Instance ID of the server holding the lock (format: hostname-pid)';
COMMENT ON COLUMN job_locks.expires_at IS 'Lock expiration time - ensures locks are released even if server crashes';
COMMENT ON COLUMN job_locks.metadata IS 'Optional JSON metadata for debugging (job parameters, context, etc.)';
