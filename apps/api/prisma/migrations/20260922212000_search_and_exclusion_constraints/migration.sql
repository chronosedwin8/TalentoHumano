-- Search indexes (pg_trgm) and overlap protection (btree_gist).
-- These cannot be expressed in schema.prisma, so they live in a manual
-- migration. See docs/DECISIONS.md (ADR-0004).

-- ---------------------------------------------------------------------------
-- Trigram search: employee and candidate names, CV full text
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS employees_full_name_trgm_idx
  ON employees USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS employees_email_trgm_idx
  ON employees USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS employees_document_number_trgm_idx
  ON employees USING gin (document_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS candidates_full_name_trgm_idx
  ON candidates USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS candidates_email_trgm_idx
  ON candidates USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS candidates_resume_text_trgm_idx
  ON candidates USING gin (resume_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS wiki_articles_title_trgm_idx
  ON wiki_articles USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS kb_articles_title_trgm_idx
  ON kb_articles USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tickets_subject_trgm_idx
  ON tickets USING gin (subject gin_trgm_ops);

CREATE INDEX IF NOT EXISTS courses_title_trgm_idx
  ON courses USING gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Approved leave requests may never overlap for the same employee.
-- Pending overlaps are rejected by the service layer with LEAVE_OVERLAP so the
-- user gets a readable error; this constraint is the database safety net.
-- ---------------------------------------------------------------------------
ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_no_overlap
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
  WHERE (status = 'approved' AND deleted_at IS NULL);

-- ---------------------------------------------------------------------------
-- Helper indexes for the analytics dashboards
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS employees_company_hired_at_idx
  ON employees (company_id, hired_at);

CREATE INDEX IF NOT EXISTS employees_company_terminated_at_idx
  ON employees (company_id, terminated_at);

CREATE INDEX IF NOT EXISTS attendance_days_company_employee_date_idx
  ON attendance_days (company_id, employee_id, date DESC);

CREATE INDEX IF NOT EXISTS audit_logs_company_entity_idx
  ON audit_logs (company_id, entity_type, created_at DESC);
