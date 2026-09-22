-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'publish';
ALTER TYPE "AuditAction" ADD VALUE 'assign';
ALTER TYPE "AuditAction" ADD VALUE 'close';

-- DropIndex
DROP INDEX "attendance_days_company_employee_date_idx";

-- DropIndex
DROP INDEX "audit_logs_company_entity_idx";

-- DropIndex
DROP INDEX "candidates_email_trgm_idx";

-- DropIndex
DROP INDEX "candidates_full_name_trgm_idx";

-- DropIndex
DROP INDEX "candidates_resume_text_trgm_idx";

-- DropIndex
DROP INDEX "courses_title_trgm_idx";

-- DropIndex
DROP INDEX "employees_company_hired_at_idx";

-- DropIndex
DROP INDEX "employees_company_terminated_at_idx";

-- DropIndex
DROP INDEX "employees_document_number_trgm_idx";

-- DropIndex
DROP INDEX "employees_email_trgm_idx";

-- DropIndex
DROP INDEX "employees_full_name_trgm_idx";

-- DropIndex
DROP INDEX "kb_articles_title_trgm_idx";

-- DropIndex
DROP INDEX "tickets_subject_trgm_idx";

-- DropIndex
DROP INDEX "wiki_articles_title_trgm_idx";

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
