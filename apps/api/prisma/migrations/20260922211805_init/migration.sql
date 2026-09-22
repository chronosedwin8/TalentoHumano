-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'inactive', 'locked');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other', 'undisclosed');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('pre_hire', 'active', 'on_leave', 'suspended', 'inactive');

-- CreateEnum
CREATE TYPE "WorkModality" AS ENUM ('onsite', 'remote', 'hybrid');

-- CreateEnum
CREATE TYPE "Scope" AS ENUM ('own', 'team', 'area', 'company');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('private', 'company', 'public');

-- CreateEnum
CREATE TYPE "VirusScanStatus" AS ENUM ('pending', 'clean', 'infected', 'skipped');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'read', 'login', 'logout', 'export', 'approve', 'reject', 'impersonate', 'download');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "WorkflowStepMode" AS ENUM ('sequential', 'parallel');

-- CreateEnum
CREATE TYPE "ApproverType" AS ENUM ('direct_manager', 'manager_of_manager', 'hr', 'role', 'user', 'department_manager', 'requester');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email', 'push', 'whatsapp', 'sms');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('queued', 'sent', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'cancelled', 'taken');

-- CreateEnum
CREATE TYPE "ClockType" AS ENUM ('in', 'out', 'break_start', 'break_end');

-- CreateEnum
CREATE TYPE "ClockSource" AS ENUM ('web', 'mobile', 'qr', 'device', 'manual', 'import');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('pending', 'present', 'absent', 'late', 'early_leave', 'leave', 'holiday', 'rest', 'remote');

-- CreateEnum
CREATE TYPE "JustificationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'published', 'fulfilled', 'cancelled');

-- CreateEnum
CREATE TYPE "JobPostingStatus" AS ENUM ('draft', 'published', 'paused', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('active', 'hired', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('scheduled', 'done', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "InterviewRecommendation" AS ENUM ('strong_yes', 'yes', 'neutral', 'no', 'strong_no');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'overdue');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'completed', 'skipped', 'overdue');

-- CreateEnum
CREATE TYPE "TaskOwnerType" AS ENUM ('employee', 'manager', 'hr', 'it', 'buddy', 'other');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('document', 'form', 'course', 'meeting', 'reading', 'equipment', 'system_access', 'generic');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "LessonKind" AS ENUM ('content', 'quiz', 'assignment', 'live_session', 'scorm');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('assigned', 'in_progress', 'completed', 'failed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('single_choice', 'multiple_choice', 'true_false', 'short_text', 'long_text', 'matching', 'numeric');

-- CreateEnum
CREATE TYPE "ObjectiveLevel" AS ENUM ('company', 'department', 'team', 'individual');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('draft', 'active', 'achieved', 'missed', 'cancelled');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('on_track', 'at_risk', 'off_track');

-- CreateEnum
CREATE TYPE "ReviewCycleType" AS ENUM ('ninety', 'one_eighty', 'three_sixty');

-- CreateEnum
CREATE TYPE "ReviewCycleStatus" AS ENUM ('draft', 'self_assessment', 'evaluation', 'calibration', 'feedback_meeting', 'closed');

-- CreateEnum
CREATE TYPE "ReviewerRelation" AS ENUM ('self', 'manager', 'peer', 'direct_report', 'internal_client');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'in_progress', 'submitted', 'declined');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('praise', 'suggestion', 'request', 'general');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'private', 'manager_only');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'scheduled', 'published', 'archived');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('draft', 'scheduled', 'open', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "EthicsStatus" AS ENUM ('received', 'triaged', 'in_investigation', 'closed', 'dismissed');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('new', 'open', 'pending_requester', 'on_hold', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('pending', 'signed', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "MedicalExamKind" AS ENUM ('entry', 'periodic', 'exit', 'post_incapacity', 'special');

-- CreateEnum
CREATE TYPE "MedicalExamResult" AS ENUM ('fit', 'fit_with_restrictions', 'unfit', 'pending');

-- CreateEnum
CREATE TYPE "AccidentKind" AS ENUM ('accident', 'incident', 'occupational_disease');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('queued', 'running', 'success', 'failed');

-- CreateEnum
CREATE TYPE "MovementStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'applied');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('valid', 'expiring', 'expired', 'missing', 'pending_review');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "legal_name" VARCHAR(200),
    "slug" VARCHAR(80) NOT NULL,
    "tax_id" VARCHAR(40),
    "logo_url" VARCHAR(500),
    "favicon_url" VARCHAR(500),
    "primary_color" VARCHAR(9) NOT NULL DEFAULT '#2563eb',
    "accent_color" VARCHAR(9) NOT NULL DEFAULT '#0ea5e9',
    "country" VARCHAR(2) NOT NULL DEFAULT 'CO',
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'America/Bogota',
    "locale" VARCHAR(5) NOT NULL DEFAULT 'es',
    "address" VARCHAR(240),
    "city" VARCHAR(120),
    "phone" VARCHAR(40),
    "email" VARCHAR(160),
    "website" VARCHAR(240),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "privacy_policy" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(180) NOT NULL,
    "password_hash" VARCHAR(255),
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "avatar_url" VARCHAR(500),
    "phone" VARCHAR(40),
    "locale" VARCHAR(5) NOT NULL DEFAULT 'es',
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'America/Bogota',
    "status" "UserStatus" NOT NULL DEFAULT 'invited',
    "is_superadmin" BOOLEAN NOT NULL DEFAULT false,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" VARCHAR(255),
    "two_factor_recovery" TEXT,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6),
    "external_provider" VARCHAR(40),
    "external_id" VARCHAR(180),
    "last_company_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "company_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID,
    "key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "scope" "Scope" NOT NULL DEFAULT 'company',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_assignable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(120) NOT NULL,
    "module" VARCHAR(40) NOT NULL,
    "resource" VARCHAR(60) NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "scope" "Scope" NOT NULL DEFAULT 'company',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "scope" "Scope" NOT NULL DEFAULT 'own',
    "expires_at" TIMESTAMPTZ(6),
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(400),
    "icon" VARCHAR(60),
    "path" VARCHAR(120) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "is_visible" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "company_id" UUID,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "user_agent" VARCHAR(400),
    "ip" VARCHAR(60),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "impersonated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID,
    "actor_id" UUID,
    "actor_email" VARCHAR(180),
    "action" "AuditAction" NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(80),
    "summary" VARCHAR(500),
    "diff" JSONB,
    "ip" VARCHAR(60),
    "user_agent" VARCHAR(400),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_access_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "actor_id" UUID,
    "permission" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(80),
    "reason" VARCHAR(400),
    "ip" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensitive_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "catalog_key" VARCHAR(60) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "color" VARCHAR(9),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "field_type" VARCHAR(30) NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "employee_editable" BOOLEAN NOT NULL DEFAULT false,
    "help_text" VARCHAR(400),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" UUID NOT NULL,
    "value" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID,
    "storage_key" VARCHAR(500) NOT NULL,
    "filename" VARCHAR(300) NOT NULL,
    "mime_type" VARCHAR(160) NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "checksum" VARCHAR(128),
    "visibility" "FileVisibility" NOT NULL DEFAULT 'private',
    "virus_scan_status" "VirusScanStatus" NOT NULL DEFAULT 'skipped',
    "uploaded_by" UUID,
    "is_uploaded" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID,
    "file_id" UUID NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID NOT NULL,
    "role" VARCHAR(60),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID,
    "event_key" VARCHAR(80) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'es',
    "subject" VARCHAR(300),
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_key" VARCHAR(80) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "body" TEXT,
    "url" VARCHAR(500),
    "entity_type" VARCHAR(80),
    "entity_id" UUID,
    "read_at" TIMESTAMPTZ(6),
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'queued',
    "target" VARCHAR(240),
    "error" VARCHAR(1000),
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_key" VARCHAR(80) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "mode" "WorkflowStepMode" NOT NULL DEFAULT 'sequential',
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" VARCHAR(200) NOT NULL,
    "approver_type" "ApproverType" NOT NULL,
    "approver_role_id" UUID,
    "approver_user_id" UUID,
    "condition" JSONB NOT NULL DEFAULT '{}',
    "is_parallel" BOOLEAN NOT NULL DEFAULT false,
    "min_approvals" INTEGER NOT NULL DEFAULT 1,
    "sla_hours" INTEGER,
    "escalate_to_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "summary" VARCHAR(1000),
    "requested_by" UUID,
    "subject_employee_id" UUID,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'pending',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "context" JSONB NOT NULL DEFAULT '{}',
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "step_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" VARCHAR(200) NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'pending',
    "approver_user_id" UUID,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "comment" VARCHAR(2000),
    "delegated_to" UUID,
    "due_at" TIMESTAMPTZ(6),
    "reminded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_step_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(40) NOT NULL,
    "comment" VARCHAR(2000),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "purpose" VARCHAR(60) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "schema" JSONB NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "form_version_id" UUID NOT NULL,
    "entity_type" VARCHAR(80),
    "entity_id" UUID,
    "submitted_by" UUID,
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "key_prefix" VARCHAR(20) NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "secret" VARCHAR(120) NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "webhook_id" UUID NOT NULL,
    "event" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status_code" INTEGER,
    "error" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(30),
    "address" VARCHAR(240),
    "city" VARCHAR(120),
    "state" VARCHAR(120),
    "country" VARCHAR(2) NOT NULL DEFAULT 'CO',
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'America/Bogota',
    "phone" VARCHAR(40),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "description" VARCHAR(400),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(30),
    "parent_id" UUID,
    "manager_id" UUID,
    "cost_center_id" UUID,
    "description" VARCHAR(500),
    "path" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(30),
    "description" TEXT,
    "level" VARCHAR(60),
    "family" VARCHAR(120),
    "department_id" UUID,
    "reports_to_position_id" UUID,
    "salary_range_min" TEXT,
    "salary_range_max" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "employee_code" VARCHAR(40) NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "second_last_name" VARCHAR(80),
    "preferred_name" VARCHAR(80),
    "full_name" VARCHAR(260) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "personal_email" VARCHAR(180),
    "phone" VARCHAR(40),
    "mobile" VARCHAR(40),
    "extension" VARCHAR(20),
    "document_type" VARCHAR(20) NOT NULL DEFAULT 'CC',
    "document_number" VARCHAR(40) NOT NULL,
    "birth_date" DATE,
    "gender" "Gender",
    "nationality" VARCHAR(60),
    "address" VARCHAR(240),
    "city" VARCHAR(120),
    "photo_file_id" UUID,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'active',
    "hired_at" DATE NOT NULL,
    "terminated_at" DATE,
    "exit_reason" VARCHAR(80),
    "position_id" UUID,
    "department_id" UUID,
    "location_id" UUID,
    "cost_center_id" UUID,
    "manager_id" UUID,
    "work_modality" "WorkModality" NOT NULL DEFAULT 'onsite',
    "hide_celebrations" BOOLEAN NOT NULL DEFAULT false,
    "directory_visible" BOOLEAN NOT NULL DEFAULT true,
    "data_consent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_personal_data" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "marital_status" VARCHAR(40),
    "blood_type" VARCHAR(10),
    "eps" VARCHAR(120),
    "arl" VARCHAR(120),
    "pension_fund" VARCHAR(120),
    "severance_fund" VARCHAR(120),
    "bank_name" TEXT,
    "bank_account_type" TEXT,
    "bank_account_number" TEXT,
    "base_salary" TEXT,
    "disability" TEXT,
    "medical_notes" TEXT,
    "shirt_size" VARCHAR(10),
    "pants_size" VARCHAR(10),
    "shoe_size" VARCHAR(10),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "employee_personal_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "relationship" VARCHAR(60) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "alt_phone" VARCHAR(40),
    "address" VARCHAR(240),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "relationship" VARCHAR(60) NOT NULL,
    "birth_date" DATE,
    "document_number" VARCHAR(40),
    "is_beneficiary" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dependents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "level" VARCHAR(60) NOT NULL,
    "institution" VARCHAR(200) NOT NULL,
    "degree" VARCHAR(200),
    "field_of_study" VARCHAR(200),
    "start_date" DATE,
    "end_date" DATE,
    "is_completed" BOOLEAN NOT NULL DEFAULT true,
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_experience" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "position_name" VARCHAR(200) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "description" VARCHAR(2000),
    "reference" VARCHAR(200),
    "reference_phone" VARCHAR(40),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "issuer" VARCHAR(200),
    "issued_at" DATE,
    "expires_at" DATE,
    "credential_id" VARCHAR(120),
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "language" VARCHAR(60) NOT NULL,
    "level" VARCHAR(30) NOT NULL,
    "is_native" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "source" VARCHAR(40) NOT NULL DEFAULT 'manual',
    "validated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "contract_type" VARCHAR(60) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "probation_ends_at" DATE,
    "position_id" UUID,
    "department_id" UUID,
    "location_id" UUID,
    "work_modality" "WorkModality" NOT NULL DEFAULT 'onsite',
    "weekly_hours" INTEGER,
    "base_salary" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(2000),
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "movement_type" VARCHAR(60) NOT NULL,
    "effective_date" DATE NOT NULL,
    "status" "MovementStatus" NOT NULL DEFAULT 'draft',
    "reason" VARCHAR(1000),
    "previous_position_id" UUID,
    "new_position_id" UUID,
    "previous_department_id" UUID,
    "new_department_id" UUID,
    "previous_location_id" UUID,
    "new_location_id" UUID,
    "previous_manager_id" UUID,
    "new_manager_id" UUID,
    "new_work_modality" "WorkModality",
    "applied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "description" VARCHAR(500),
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "has_expiration" BOOLEAN NOT NULL DEFAULT false,
    "expiration_alert_days" INTEGER NOT NULL DEFAULT 30,
    "visible_to_employee" BOOLEAN NOT NULL DEFAULT true,
    "visible_to_manager" BOOLEAN NOT NULL DEFAULT false,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "file_id" UUID,
    "name" VARCHAR(260) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "issued_at" DATE,
    "expires_at" DATE,
    "status" "DocumentStatus" NOT NULL DEFAULT 'valid',
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "due_date" DATE,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "note" VARCHAR(1000),
    "fulfilled_at" TIMESTAMPTZ(6),
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "asset_type" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "serial_number" VARCHAR(120),
    "brand" VARCHAR(120),
    "model" VARCHAR(120),
    "purchase_date" DATE,
    "location_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'available',
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "assigned_at" DATE NOT NULL,
    "returned_at" DATE,
    "condition_out" VARCHAR(300),
    "condition_in" VARCHAR(300),
    "act_file_id" UUID,
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_change_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "changes" JSONB NOT NULL,
    "previous" JSONB NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "color" VARCHAR(9) NOT NULL DEFAULT '#2563eb',
    "description" VARCHAR(1000),
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "affects_balance" BOOLEAN NOT NULL DEFAULT false,
    "counts_business_days" BOOLEAN NOT NULL DEFAULT true,
    "max_days_per_request" INTEGER,
    "min_notice_days" INTEGER NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "requires_coverage" BOOLEAN NOT NULL DEFAULT false,
    "payroll_code" VARCHAR(40),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "days_per_year" DECIMAL(6,2) NOT NULL DEFAULT 15,
    "accrual_mode" VARCHAR(30) NOT NULL DEFAULT 'monthly',
    "counts_business_days" BOOLEAN NOT NULL DEFAULT true,
    "max_carry_over_days" DECIMAL(6,2),
    "alert_threshold_days" DECIMAL(6,2) NOT NULL DEFAULT 30,
    "min_days_per_request" INTEGER NOT NULL DEFAULT 1,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "policy_id" UUID,
    "year" INTEGER NOT NULL,
    "accrued_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "taken_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "pending_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "adjusted_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "carry_over_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "last_accrual_at" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balance_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "balance_id" UUID,
    "days" DECIMAL(8,2) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "leave_balance_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "half_day_start" BOOLEAN NOT NULL DEFAULT false,
    "half_day_end" BOOLEAN NOT NULL DEFAULT false,
    "requested_days" DECIMAL(6,2) NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "reason" VARCHAR(1000),
    "coverage_employee_id" UUID,
    "workflow_instance_id" UUID,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "decision_comment" VARCHAR(1000),
    "cancelled_at" TIMESTAMPTZ(6),
    "exported_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "country" VARCHAR(2) NOT NULL DEFAULT 'CO',
    "location_id" UUID,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" VARCHAR(4000),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "quantity" DECIMAL(10,2),
    "unit" VARCHAR(30),
    "status" VARCHAR(30) NOT NULL DEFAULT 'open',
    "payroll_code" VARCHAR(40),
    "workflow_instance_id" UUID,
    "exported_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinary_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "case_number" VARCHAR(40) NOT NULL,
    "case_type" VARCHAR(60) NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'low',
    "status" VARCHAR(30) NOT NULL DEFAULT 'open',
    "opened_at" DATE NOT NULL,
    "closed_at" DATE,
    "decision" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "disciplinary_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinary_case_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "step_type" VARCHAR(60) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "due_date" DATE,
    "completed_at" TIMESTAMPTZ(6),
    "content" TEXT,
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "disciplinary_case_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_exports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "format" VARCHAR(20) NOT NULL DEFAULT 'csv',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "file_id" UUID,
    "status" "RunStatus" NOT NULL DEFAULT 'queued',
    "error" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "payroll_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "tolerance_minutes" INTEGER NOT NULL DEFAULT 10,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 60,
    "is_working_day" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "color" VARCHAR(9) NOT NULL DEFAULT '#0ea5e9',
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 60,
    "crosses_midnight" BOOLEAN NOT NULL DEFAULT false,
    "min_rest_hours" INTEGER NOT NULL DEFAULT 12,
    "schedule_id" UUID,
    "location_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_swap_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "requester_assignment_id" UUID NOT NULL,
    "target_employee_id" UUID NOT NULL,
    "target_assignment_id" UUID,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'pending',
    "reason" VARCHAR(500),
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radius_meters" INTEGER NOT NULL DEFAULT 150,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clock_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "vendor" VARCHAR(80),
    "serial" VARCHAR(120),
    "location_id" UUID,
    "token_hash" VARCHAR(255) NOT NULL,
    "qr_secret" VARCHAR(120),
    "last_seen_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "clock_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_clock_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" "ClockType" NOT NULL,
    "source" "ClockSource" NOT NULL DEFAULT 'web',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "local_date" DATE NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracy" INTEGER,
    "within_geofence" BOOLEAN,
    "location_id" UUID,
    "device_id" UUID,
    "photo_file_id" UUID,
    "notes" VARCHAR(500),
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_clock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'pending',
    "scheduled_start" VARCHAR(5),
    "scheduled_end" VARCHAR(5),
    "first_in" TIMESTAMPTZ(6),
    "last_out" TIMESTAMPTZ(6),
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "leave_request_id" UUID,
    "notes" VARCHAR(500),
    "computed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_justifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "attendance_day_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "file_id" UUID,
    "status" "JustificationStatus" NOT NULL DEFAULT 'pending',
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "decision_comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_justifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_requisitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "position_id" UUID,
    "department_id" UUID,
    "location_id" UUID,
    "reason" VARCHAR(60) NOT NULL,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "needed_by" DATE,
    "justification" VARCHAR(2000),
    "contract_type" VARCHAR(60),
    "salary_range_min" TEXT,
    "salary_range_max" TEXT,
    "replacing_employee_id" UUID,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'draft',
    "requested_by" UUID,
    "workflow_instance_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "job_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "requisition_id" UUID,
    "code" VARCHAR(40) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "position_id" UUID,
    "department_id" UUID,
    "location_id" UUID,
    "work_modality" "WorkModality" NOT NULL DEFAULT 'onsite',
    "contract_type" VARCHAR(60),
    "openings" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "benefits" TEXT,
    "salary_range_min" TEXT,
    "salary_range_max" TEXT,
    "salary_visible" BOOLEAN NOT NULL DEFAULT false,
    "status" "JobPostingStatus" NOT NULL DEFAULT 'draft',
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "closes_at" DATE,
    "closed_at" TIMESTAMPTZ(6),
    "recruiter_id" UUID,
    "hiring_manager_id" UUID,
    "application_form_id" UUID,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_competencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "job_posting_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "job_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "job_posting_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "color" VARCHAR(9) NOT NULL DEFAULT '#64748b',
    "kind" VARCHAR(30) NOT NULL DEFAULT 'standard',
    "auto_email_template_key" VARCHAR(80),
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "phone" VARCHAR(40),
    "document_number" VARCHAR(40),
    "city" VARCHAR(120),
    "country" VARCHAR(2),
    "linkedin_url" VARCHAR(240),
    "source" VARCHAR(60) NOT NULL DEFAULT 'portal',
    "referred_by_employee_id" UUID,
    "resume_file_id" UUID,
    "resume_text" TEXT,
    "parsed_data" JSONB NOT NULL DEFAULT '{}',
    "rating" INTEGER,
    "notes" TEXT,
    "consent_at" TIMESTAMPTZ(6),
    "retention_until" DATE,
    "anonymized_at" TIMESTAMPTZ(6),
    "hired_employee_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "tag" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'resume',
    "name" VARCHAR(260) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "job_posting_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "stage_id" UUID,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'active',
    "source" VARCHAR(60) NOT NULL DEFAULT 'portal',
    "cover_letter" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "score" INTEGER,
    "rejection_reason" VARCHAR(200),
    "rejected_at" TIMESTAMPTZ(6),
    "keep_in_talent_pool" BOOLEAN NOT NULL DEFAULT true,
    "hired_at" TIMESTAMPTZ(6),
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_stage_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_stage_id" UUID,
    "to_stage_id" UUID NOT NULL,
    "note" VARCHAR(1000),
    "moved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'hr',
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "location_text" VARCHAR(300),
    "meeting_url" VARCHAR(500),
    "status" "InterviewStatus" NOT NULL DEFAULT 'scheduled',
    "blind_until_complete" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "interview_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "interview_id" UUID NOT NULL,
    "reviewer_employee_id" UUID NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "recommendation" "InterviewRecommendation" NOT NULL,
    "strengths" TEXT,
    "concerns" TEXT,
    "notes" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_feedback_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "feedback_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(2000),

    CONSTRAINT "interview_feedback_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'technical',
    "external_url" VARCHAR(500),
    "file_id" UUID,
    "score" DECIMAL(6,2),
    "max_score" DECIMAL(6,2),
    "passed" BOOLEAN,
    "result_notes" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'labor',
    "reference_name" VARCHAR(200) NOT NULL,
    "reference_company" VARCHAR(200),
    "reference_phone" VARCHAR(40),
    "reference_email" VARCHAR(180),
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "file_id" UUID,
    "checked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reference_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "template_id" UUID,
    "status" "OfferStatus" NOT NULL DEFAULT 'draft',
    "position_id" UUID,
    "department_id" UUID,
    "location_id" UUID,
    "contract_type" VARCHAR(60),
    "work_modality" "WorkModality" NOT NULL DEFAULT 'onsite',
    "start_date" DATE,
    "salary" TEXT,
    "benefits" TEXT,
    "body" TEXT,
    "file_id" UUID,
    "sent_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "response_note" VARCHAR(1000),
    "expires_at" DATE,
    "access_token" VARCHAR(120),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "job_posting_id" UUID,
    "status" VARCHAR(40) NOT NULL DEFAULT 'submitted',
    "reward_note" VARCHAR(500),
    "reward_paid_at" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'onboarding',
    "description" VARCHAR(1000),
    "position_id" UUID,
    "department_id" UUID,
    "location_id" UUID,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "onboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_template_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "description" VARCHAR(2000),
    "owner_type" "TaskOwnerType" NOT NULL,
    "owner_user_id" UUID,
    "kind" "TaskKind" NOT NULL DEFAULT 'generic',
    "offset_days" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "depends_on_id" UUID,
    "course_id" UUID,
    "form_id" UUID,
    "document_type_id" UUID,
    "policy_id" UUID,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "onboarding_template_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_processes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "template_id" UUID,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'onboarding',
    "status" "ProcessStatus" NOT NULL DEFAULT 'pending',
    "reference_date" DATE NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "buddy_employee_id" UUID,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "preboarding_token" VARCHAR(120),
    "exit_reason" VARCHAR(80),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "onboarding_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "description" VARCHAR(2000),
    "owner_type" "TaskOwnerType" NOT NULL,
    "assignee_employee_id" UUID,
    "assignee_user_id" UUID,
    "kind" "TaskKind" NOT NULL DEFAULT 'generic',
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "due_date" DATE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "depends_on_id" UUID,
    "course_id" UUID,
    "form_id" UUID,
    "document_type_id" UUID,
    "policy_id" UUID,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "completed_at" TIMESTAMPTZ(6),
    "completed_by" UUID,
    "result" JSONB NOT NULL DEFAULT '{}',
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_interviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "process_id" UUID,
    "interviewed_by" UUID,
    "conducted_at" DATE,
    "exit_reason" VARCHAR(80) NOT NULL,
    "would_recommend" BOOLEAN,
    "nps_score" INTEGER,
    "form_submission_id" UUID,
    "summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exit_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_library" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "folder_id" UUID,
    "file_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "alt_text" VARCHAR(500),
    "caption" VARCHAR(500),
    "kind" VARCHAR(20) NOT NULL DEFAULT 'image',
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "hls_url" VARCHAR(500),
    "transcode_status" VARCHAR(20) NOT NULL DEFAULT 'none',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "media_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_patterns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "category" VARCHAR(80),
    "blocks" JSONB NOT NULL,
    "is_synced" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "content_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embed_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "domain" VARCHAR(160) NOT NULL,
    "oembed_url" VARCHAR(400),
    "iframe_allow" VARCHAR(300),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "embed_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "summary" VARCHAR(2000),
    "category" VARCHAR(120),
    "kind" VARCHAR(20) NOT NULL DEFAULT 'internal',
    "provider" VARCHAR(160),
    "status" "CourseStatus" NOT NULL DEFAULT 'draft',
    "estimated_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "recertification_months" INTEGER,
    "passing_score" INTEGER NOT NULL DEFAULT 70,
    "cover_file_id" UUID,
    "informative_cost" DECIMAL(14,2),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_prerequisites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "prerequisite_course_id" UUID NOT NULL,

    CONSTRAINT "course_prerequisites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(1000),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "kind" "LessonKind" NOT NULL DEFAULT 'content',
    "estimated_minutes" INTEGER NOT NULL DEFAULT 5,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_contents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
    "draft_blocks" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "locked_by" UUID,
    "locked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "lesson_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_content_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "blocks" JSONB NOT NULL,
    "change_note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "lesson_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "lesson_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "passing_score" INTEGER NOT NULL DEFAULT 70,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "time_limit_minutes" INTEGER,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT true,
    "show_answers" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "quiz_id" UUID,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'single_choice',
    "points" INTEGER NOT NULL DEFAULT 1,
    "explanation" VARCHAR(2000),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_bank" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "employee_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "score" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "max_score" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),
    "answers" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments_lms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "instructions" TEXT,
    "due_days" INTEGER,
    "max_score" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assignments_lms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "file_id" UUID,
    "text" TEXT,
    "score" DECIMAL(6,2),
    "feedback" TEXT,
    "graded_by" UUID,
    "graded_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "position_id" UUID,
    "department_id" UUID,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "due_days" INTEGER,

    CONSTRAINT "learning_path_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "path_id" UUID,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'assigned',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "score" DECIMAL(6,2),
    "due_date" DATE,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" DATE,
    "time_spent_minutes" INTEGER NOT NULL DEFAULT 0,
    "assigned_by" UUID,
    "source" VARCHAR(30) NOT NULL DEFAULT 'manual',
    "effectiveness_score" INTEGER,
    "effectiveness_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "block_state" JSONB NOT NULL DEFAULT '{}',
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "course_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "modality" VARCHAR(20) NOT NULL DEFAULT 'onsite',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "location_text" VARCHAR(300),
    "meeting_url" VARCHAR(500),
    "capacity" INTEGER,
    "instructor_employee_id" UUID,
    "external_instructor" VARCHAR(200),
    "attendance_token" VARCHAR(120),
    "status" VARCHAR(30) NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "registered" BOOLEAN NOT NULL DEFAULT true,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "checked_in_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "course_id" UUID,
    "enrollment_id" UUID,
    "title" VARCHAR(240) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "issued_at" DATE NOT NULL,
    "expires_at" DATE,
    "score" DECIMAL(6,2),
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "budget" DECIMAL(14,2),
    "executed_cost" DECIMAL(14,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_needs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "plan_id" UUID,
    "title" VARCHAR(240) NOT NULL,
    "source" VARCHAR(40) NOT NULL DEFAULT 'manual',
    "department_id" UUID,
    "position_id" UUID,
    "competency_id" UUID,
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "estimated_cost" DECIMAL(14,2),
    "course_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'detected',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "training_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xapi_statements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID,
    "lesson_id" UUID,
    "block_id" VARCHAR(80),
    "verb" VARCHAR(120) NOT NULL,
    "object_id" VARCHAR(400),
    "result" JSONB NOT NULL DEFAULT '{}',
    "raw" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xapi_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" VARCHAR(80),
    "description" VARCHAR(2000),
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_levels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "behaviors" VARCHAR(4000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_competencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "required_level" INTEGER NOT NULL DEFAULT 3,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "position_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objective_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "objective_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "parent_id" UUID,
    "title" VARCHAR(240) NOT NULL,
    "description" VARCHAR(4000),
    "level" "ObjectiveLevel" NOT NULL DEFAULT 'individual',
    "owner_employee_id" UUID,
    "department_id" UUID,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'active',
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "progress" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "start_date" DATE,
    "due_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "objective_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "metric" VARCHAR(80),
    "start_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "target_value" DECIMAL(14,2) NOT NULL,
    "current_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "confidence" "Confidence" NOT NULL DEFAULT 'on_track',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kr_checkins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "key_result_id" UUID NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'on_track',
    "comment" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "kr_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "schema" JSONB NOT NULL,
    "scale_min" INTEGER NOT NULL DEFAULT 1,
    "scale_max" INTEGER NOT NULL DEFAULT 5,
    "include_objectives" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "review_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "ReviewCycleType" NOT NULL DEFAULT 'ninety',
    "template_id" UUID,
    "objective_cycle_id" UUID,
    "status" "ReviewCycleStatus" NOT NULL DEFAULT 'draft',
    "self_start" DATE,
    "self_end" DATE,
    "eval_start" DATE,
    "eval_end" DATE,
    "calibration_date" DATE,
    "feedback_deadline" DATE,
    "anonymous_peers" BOOLEAN NOT NULL DEFAULT true,
    "anonymous_reports" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "review_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "subject_employee_id" UUID NOT NULL,
    "reviewer_employee_id" UUID NOT NULL,
    "relation" "ReviewerRelation" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "submitted_at" TIMESTAMPTZ(6),
    "overall_score" DECIMAL(6,2),
    "is_nominated" BOOLEAN NOT NULL DEFAULT false,
    "nomination_approved" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "review_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "question_key" VARCHAR(120) NOT NULL,
    "competency_id" UUID,
    "objective_id" UUID,
    "rating" DECIMAL(6,2),
    "answer" JSONB,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "review_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6),
    "department_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calibration_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nine_box_placements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "performance" INTEGER NOT NULL,
    "potential" INTEGER NOT NULL,
    "box" INTEGER NOT NULL,
    "calibrated_by" UUID,
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "nine_box_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "from_employee_id" UUID,
    "to_employee_id" UUID NOT NULL,
    "kind" "FeedbackKind" NOT NULL DEFAULT 'general',
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "message" TEXT NOT NULL,
    "competency_id" UUID,
    "is_requested" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_on_ones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "lead_employee_id" UUID NOT NULL,
    "member_employee_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'scheduled',
    "agenda" TEXT,
    "notes" TEXT,
    "private_notes" TEXT,
    "agreements" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "one_on_ones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID,
    "department_id" UUID,
    "title" VARCHAR(240) NOT NULL,
    "scope_kind" VARCHAR(30) NOT NULL DEFAULT 'individual',
    "cycle_id" UUID,
    "survey_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "start_date" DATE,
    "due_date" DATE,
    "summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "development_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" VARCHAR(2000),
    "competency_id" UUID,
    "course_id" UUID,
    "responsible_employee_id" UUID,
    "due_date" DATE,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "development_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_paths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "career_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_path_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "requirements" VARCHAR(2000),
    "min_years" DECIMAL(4,1),

    CONSTRAINT "career_path_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "succession_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "incumbent_employee_id" UUID,
    "criticality" VARCHAR(20) NOT NULL DEFAULT 'high',
    "risk_of_loss" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "succession_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "succession_candidates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "readiness" VARCHAR(30) NOT NULL DEFAULT '1_2_years',
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "succession_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "kind" VARCHAR(30) NOT NULL DEFAULT 'news',
    "blocks" JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
    "excerpt" VARCHAR(500),
    "cover_file_id" UUID,
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "requires_ack" BOOLEAN NOT NULL DEFAULT false,
    "allow_comments" BOOLEAN NOT NULL DEFAULT true,
    "allow_reactions" BOOLEAN NOT NULL DEFAULT true,
    "survey_id" UUID,
    "publish_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "author_user_id" UUID,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_audiences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "target_type" VARCHAR(30) NOT NULL,
    "target_id" UUID,

    CONSTRAINT "post_audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_reads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),

    CONSTRAINT "post_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_reactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" VARCHAR(30) NOT NULL DEFAULT 'like',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "body" VARCHAR(4000) NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'general',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "location_text" VARCHAR(300),
    "meeting_url" VARCHAR(500),
    "location_id" UUID,
    "capacity" INTEGER,
    "requires_registration" BOOLEAN NOT NULL DEFAULT false,
    "cover_file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'registered',
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "icon" VARCHAR(60),
    "color" VARCHAR(9) NOT NULL DEFAULT '#2563eb',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "company_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recognitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "from_employee_id" UUID,
    "to_employee_id" UUID NOT NULL,
    "value_id" UUID,
    "message" VARCHAR(2000) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "is_formal" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "certificate_file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "recognitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(60),
    "color" VARCHAR(9) NOT NULL DEFAULT '#f59e0b',
    "points_required" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(500),

    CONSTRAINT "employee_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(80),
    "description" TEXT,
    "provider" VARCHAR(200),
    "contact_info" VARCHAR(300),
    "requires_enrollment" BOOLEAN NOT NULL DEFAULT false,
    "cover_file_id" UUID,
    "valid_from" DATE,
    "valid_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "benefit_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'requested',
    "notes" VARCHAR(1000),
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "benefit_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "parent_id" UUID,
    "icon" VARCHAR(60),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "wiki_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "category_id" UUID,
    "title" VARCHAR(260) NOT NULL,
    "slug" VARCHAR(280) NOT NULL,
    "summary" VARCHAR(1000),
    "blocks" JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "wiki_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "kind" VARCHAR(40) NOT NULL DEFAULT 'climate',
    "schema" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "description" TEXT,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'climate',
    "status" "SurveyStatus" NOT NULL DEFAULT 'draft',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "min_segment_responses" INTEGER NOT NULL DEFAULT 5,
    "opens_at" TIMESTAMPTZ(6),
    "closes_at" TIMESTAMPTZ(6),
    "recurrence" VARCHAR(40),
    "reminder_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "schema" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "label" VARCHAR(1000) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "dimension" VARCHAR(80),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_audiences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "target_type" VARCHAR(30) NOT NULL,
    "target_id" UUID,
    "filters" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "survey_audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "token" VARCHAR(120) NOT NULL,
    "sent_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "segment" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "employee_id" UUID,
    "invitation_id" UUID,
    "segment" JSONB NOT NULL DEFAULT '{}',
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "question_key" VARCHAR(120) NOT NULL,
    "value" JSONB,
    "numeric_value" DECIMAL(10,2),
    "text_value" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ethics_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "sla_days" INTEGER NOT NULL DEFAULT 15,
    "default_severity" "Severity" NOT NULL DEFAULT 'medium',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ethics_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ethics_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "tracking_code" VARCHAR(40) NOT NULL,
    "access_key_hash" VARCHAR(255) NOT NULL,
    "category_id" UUID,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "reporter_name" TEXT,
    "reporter_email" TEXT,
    "reporter_phone" TEXT,
    "relationship" VARCHAR(30) NOT NULL DEFAULT 'employee',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "involved_persons" TEXT,
    "occurred_at" DATE,
    "status" "EthicsStatus" NOT NULL DEFAULT 'received',
    "severity" "Severity" NOT NULL DEFAULT 'medium',
    "due_at" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ethics_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ethics_report_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "author_kind" VARCHAR(20) NOT NULL,
    "author_user_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ethics_report_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ethics_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "case_number" VARCHAR(40) NOT NULL,
    "status" "EthicsStatus" NOT NULL DEFAULT 'triaged',
    "severity" "Severity" NOT NULL DEFAULT 'medium',
    "lead_user_id" UUID,
    "excluded_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "investigation_plan" TEXT,
    "conclusions" TEXT,
    "measures" TEXT,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" DATE,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ethics_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ethics_case_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(40) NOT NULL DEFAULT 'investigator',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ethics_case_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ethics_case_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "detail" TEXT,
    "due_date" DATE,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ethics_case_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ethics_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "file_id" UUID,
    "title" VARCHAR(260) NOT NULL,
    "description" TEXT,
    "added_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ethics_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ethics_access_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "case_id" UUID,
    "report_id" UUID,
    "user_id" UUID,
    "action" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ethics_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'letter',
    "description" VARCHAR(500),
    "blocks" JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
    "body_html" TEXT,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_self_service" BOOLEAN NOT NULL DEFAULT false,
    "requires_signature" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "template_id" UUID,
    "employee_id" UUID,
    "title" VARCHAR(260) NOT NULL,
    "verification_code" VARCHAR(40) NOT NULL,
    "file_id" UUID,
    "content_html" TEXT,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "is_self_service" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "category" VARCHAR(80),
    "summary" VARCHAR(1000),
    "status" "PolicyStatus" NOT NULL DEFAULT 'draft',
    "requires_ack" BOOLEAN NOT NULL DEFAULT true,
    "requires_signature" BOOLEAN NOT NULL DEFAULT false,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
    "file_id" UUID,
    "change_note" VARCHAR(500),
    "published_at" TIMESTAMPTZ(6),
    "effective_from" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "acknowledged_at" TIMESTAMPTZ(6),
    "signature_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "file_id" UUID,
    "employee_id" UUID,
    "user_id" UUID,
    "status" "SignatureStatus" NOT NULL DEFAULT 'pending',
    "provider" VARCHAR(40) NOT NULL DEFAULT 'simple',
    "external_id" VARCHAR(180),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "signature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "signer_name" VARCHAR(200) NOT NULL,
    "signer_user_id" UUID,
    "signed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" VARCHAR(128) NOT NULL,
    "ip" VARCHAR(60),
    "user_agent" VARCHAR(400),
    "method" VARCHAR(40) NOT NULL DEFAULT 'simple',

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "description" VARCHAR(500),
    "parent_id" UUID,
    "sla_policy_id" UUID,
    "default_assignee_employee_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "first_response_minutes" INTEGER NOT NULL DEFAULT 240,
    "resolution_minutes" INTEGER NOT NULL DEFAULT 2880,
    "business_hours_only" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "subject" VARCHAR(260) NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID,
    "status" "TicketStatus" NOT NULL DEFAULT 'new',
    "priority" "TicketPriority" NOT NULL DEFAULT 'normal',
    "requester_employee_id" UUID,
    "requester_user_id" UUID,
    "requester_email" VARCHAR(180),
    "assignee_employee_id" UUID,
    "channel_id" UUID,
    "external_ref" VARCHAR(200),
    "first_response_at" TIMESTAMPTZ(6),
    "first_response_due_at" TIMESTAMPTZ(6),
    "resolution_due_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_user_id" UUID,
    "author_name" VARCHAR(200),
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "channel" VARCHAR(30) NOT NULL DEFAULT 'web',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "macros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "category_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "macros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_articles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "slug" VARCHAR(280) NOT NULL,
    "category_id" UUID,
    "blocks" JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}',
    "summary" VARCHAR(1000),
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "ticket_id" UUID,
    "direction" VARCHAR(10) NOT NULL,
    "external_id" VARCHAR(200),
    "from_address" VARCHAR(200),
    "to_address" VARCHAR(200),
    "body" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csat_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csat_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_exams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kind" "MedicalExamKind" NOT NULL,
    "provider" VARCHAR(200),
    "performed_at" DATE NOT NULL,
    "expires_at" DATE,
    "result" "MedicalExamResult" NOT NULL DEFAULT 'pending',
    "restrictions" TEXT,
    "recommendations" TEXT,
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "medical_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_accidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "kind" "AccidentKind" NOT NULL DEFAULT 'accident',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "reported_at" TIMESTAMPTZ(6),
    "location_id" UUID,
    "place" VARCHAR(300),
    "body_part" VARCHAR(120),
    "severity" "Severity" NOT NULL DEFAULT 'low',
    "description" TEXT NOT NULL,
    "furat_number" VARCHAR(60),
    "lost_days" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_accidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accident_investigations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "accident_id" UUID NOT NULL,
    "rootCause" TEXT,
    "immediate_causes" TEXT,
    "basic_causes" TEXT,
    "action_plan" TEXT,
    "investigated_by" UUID,
    "completed_at" DATE,
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accident_investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_matrix_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "position_id" UUID,
    "department_id" UUID,
    "location_id" UUID,
    "hazard" VARCHAR(260) NOT NULL,
    "hazard_class" VARCHAR(80) NOT NULL,
    "risk" VARCHAR(260) NOT NULL,
    "exposed_count" INTEGER NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 1,
    "consequence" INTEGER NOT NULL DEFAULT 1,
    "risk_level" VARCHAR(30) NOT NULL,
    "controls" TEXT,
    "residual_level" VARCHAR(30),
    "reviewed_at" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "risk_matrix_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ppe_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "ppe_type" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "delivered_at" DATE NOT NULL,
    "replaces_at" DATE,
    "act_file_id" UUID,
    "signed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "ppe_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sst_inspections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "kind" VARCHAR(60) NOT NULL DEFAULT 'general',
    "location_id" UUID,
    "scheduled_at" DATE,
    "performed_at" DATE,
    "inspector_employee_id" UUID,
    "form_submission_id" UUID,
    "findings" TEXT,
    "action_plan" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sst_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "term_start" DATE NOT NULL,
    "term_end" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "committee_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "role" VARCHAR(60) NOT NULL DEFAULT 'member',
    "representation" VARCHAR(30) NOT NULL DEFAULT 'employer',
    "is_principal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_minutes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "committee_id" UUID NOT NULL,
    "number" VARCHAR(40) NOT NULL,
    "meeting_date" DATE NOT NULL,
    "agenda" TEXT,
    "decisions" TEXT,
    "attendees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "committee_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "metric" VARCHAR(60) NOT NULL,
    "dimension" VARCHAR(60) NOT NULL DEFAULT 'total',
    "dimension_value" VARCHAR(160) NOT NULL DEFAULT 'all',
    "value" DECIMAL(16,4) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "dataset" VARCHAR(60) NOT NULL,
    "columns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filters" JSONB NOT NULL DEFAULT '{}',
    "group_by" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chart_type" VARCHAR(30) NOT NULL DEFAULT 'table',
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "cron" VARCHAR(80) NOT NULL,
    "format" VARCHAR(10) NOT NULL DEFAULT 'xlsx',
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ(6),
    "next_run_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "schedule_id" UUID,
    "status" "RunStatus" NOT NULL DEFAULT 'queued',
    "format" VARCHAR(10) NOT NULL DEFAULT 'xlsx',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "file_id" UUID,
    "error" VARCHAR(1000),
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'medium',
    "title" VARCHAR(300) NOT NULL,
    "detail" VARCHAR(2000),
    "entity_type" VARCHAR(80),
    "entity_id" UUID,
    "score" DECIMAL(6,2),
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMPTZ(6),
    "due_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "analytics_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_slug_idx" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "company_users_company_id_deleted_at_idx" ON "company_users"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "company_users_company_id_user_id_key" ON "company_users"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "roles_company_id_deleted_at_idx" ON "roles"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_company_id_key_key" ON "roles"("company_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_company_user_id_role_id_key" ON "user_roles"("company_user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_permission_overrides_company_id_user_id_idx" ON "user_permission_overrides"("company_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_company_id_user_id_permission_id_key" ON "user_permission_overrides"("company_id", "user_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "modules_key_key" ON "modules"("key");

-- CreateIndex
CREATE UNIQUE INDEX "company_modules_company_id_module_id_key" ON "company_modules"("company_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_modules_role_id_module_id_key" ON "role_modules"("role_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_modules_company_id_user_id_module_id_key" ON "user_modules"("company_id", "user_id", "module_id");

-- CreateIndex
CREATE INDEX "delegations_company_id_to_user_id_is_active_idx" ON "delegations"("company_id", "to_user_id", "is_active");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "sensitive_access_logs_company_id_created_at_idx" ON "sensitive_access_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "sensitive_access_logs_entity_type_entity_id_idx" ON "sensitive_access_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "catalog_items_company_id_catalog_key_deleted_at_idx" ON "catalog_items"("company_id", "catalog_key", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_items_company_id_catalog_key_code_key" ON "catalog_items"("company_id", "catalog_key", "code");

-- CreateIndex
CREATE INDEX "custom_field_definitions_company_id_entity_type_idx" ON "custom_field_definitions"("company_id", "entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_company_id_entity_type_key_key" ON "custom_field_definitions"("company_id", "entity_type", "key");

-- CreateIndex
CREATE INDEX "custom_field_values_company_id_entity_type_entity_id_idx" ON "custom_field_values"("company_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_definition_id_entity_id_key" ON "custom_field_values"("definition_id", "entity_id");

-- CreateIndex
CREATE INDEX "files_company_id_deleted_at_idx" ON "files"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "file_links_entity_type_entity_id_idx" ON "file_links"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "file_links_file_id_idx" ON "file_links"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_company_id_event_key_channel_locale_key" ON "notification_templates"("company_id", "event_key", "channel", "locale");

-- CreateIndex
CREATE INDEX "notifications_company_id_user_id_read_at_idx" ON "notifications"("company_id", "user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_company_id_user_id_event_key_chann_key" ON "notification_preferences"("company_id", "user_id", "event_key", "channel");

-- CreateIndex
CREATE INDEX "workflow_definitions_company_id_entity_type_deleted_at_idx" ON "workflow_definitions"("company_id", "entity_type", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_company_id_key_key" ON "workflow_definitions"("company_id", "key");

-- CreateIndex
CREATE INDEX "workflow_steps_definition_id_position_idx" ON "workflow_steps"("definition_id", "position");

-- CreateIndex
CREATE INDEX "workflow_instances_company_id_status_idx" ON "workflow_instances"("company_id", "status");

-- CreateIndex
CREATE INDEX "workflow_instances_entity_type_entity_id_idx" ON "workflow_instances"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "workflow_step_instances_company_id_approver_user_id_status_idx" ON "workflow_step_instances"("company_id", "approver_user_id", "status");

-- CreateIndex
CREATE INDEX "workflow_step_instances_instance_id_position_idx" ON "workflow_step_instances"("instance_id", "position");

-- CreateIndex
CREATE INDEX "workflow_actions_company_id_instance_id_idx" ON "workflow_actions"("company_id", "instance_id");

-- CreateIndex
CREATE INDEX "forms_company_id_deleted_at_idx" ON "forms"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "forms_company_id_key_key" ON "forms"("company_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_form_id_version_key" ON "form_versions"("form_id", "version");

-- CreateIndex
CREATE INDEX "form_submissions_company_id_entity_type_entity_id_idx" ON "form_submissions"("company_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "api_keys_company_id_deleted_at_idx" ON "api_keys"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");

-- CreateIndex
CREATE INDEX "webhooks_company_id_deleted_at_idx" ON "webhooks"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_company_id_status_idx" ON "webhook_deliveries"("company_id", "status");

-- CreateIndex
CREATE INDEX "locations_company_id_deleted_at_idx" ON "locations"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "locations_company_id_name_key" ON "locations"("company_id", "name");

-- CreateIndex
CREATE INDEX "cost_centers_company_id_deleted_at_idx" ON "cost_centers"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_company_id_code_key" ON "cost_centers"("company_id", "code");

-- CreateIndex
CREATE INDEX "departments_company_id_deleted_at_idx" ON "departments"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "departments_company_id_name_key" ON "departments"("company_id", "name");

-- CreateIndex
CREATE INDEX "positions_company_id_deleted_at_idx" ON "positions"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "positions_company_id_name_key" ON "positions"("company_id", "name");

-- CreateIndex
CREATE INDEX "employees_company_id_deleted_at_idx" ON "employees"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "employees_company_id_status_idx" ON "employees"("company_id", "status");

-- CreateIndex
CREATE INDEX "employees_company_id_manager_id_idx" ON "employees"("company_id", "manager_id");

-- CreateIndex
CREATE INDEX "employees_company_id_department_id_idx" ON "employees"("company_id", "department_id");

-- CreateIndex
CREATE INDEX "employees_full_name_idx" ON "employees"("full_name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_employee_code_key" ON "employees"("company_id", "employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_document_number_key" ON "employees"("company_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_personal_data_employee_id_key" ON "employee_personal_data"("employee_id");

-- CreateIndex
CREATE INDEX "employee_personal_data_company_id_idx" ON "employee_personal_data"("company_id");

-- CreateIndex
CREATE INDEX "emergency_contacts_company_id_employee_id_idx" ON "emergency_contacts"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "dependents_company_id_employee_id_idx" ON "dependents"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "education_company_id_employee_id_idx" ON "education"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "work_experience_company_id_employee_id_idx" ON "work_experience"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "certifications_company_id_employee_id_idx" ON "certifications"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "certifications_company_id_expires_at_idx" ON "certifications"("company_id", "expires_at");

-- CreateIndex
CREATE INDEX "languages_company_id_employee_id_idx" ON "languages"("company_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "languages_employee_id_language_key" ON "languages"("employee_id", "language");

-- CreateIndex
CREATE INDEX "skills_company_id_deleted_at_idx" ON "skills"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "skills_company_id_name_key" ON "skills"("company_id", "name");

-- CreateIndex
CREATE INDEX "employee_skills_company_id_skill_id_idx" ON "employee_skills"("company_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_skills_employee_id_skill_id_key" ON "employee_skills"("employee_id", "skill_id");

-- CreateIndex
CREATE INDEX "employment_contracts_company_id_employee_id_idx" ON "employment_contracts"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "employment_contracts_company_id_end_date_idx" ON "employment_contracts"("company_id", "end_date");

-- CreateIndex
CREATE INDEX "employee_movements_company_id_employee_id_idx" ON "employee_movements"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_movements_company_id_effective_date_idx" ON "employee_movements"("company_id", "effective_date");

-- CreateIndex
CREATE INDEX "document_types_company_id_deleted_at_idx" ON "document_types"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_company_id_code_key" ON "document_types"("company_id", "code");

-- CreateIndex
CREATE INDEX "documents_company_id_employee_id_deleted_at_idx" ON "documents"("company_id", "employee_id", "deleted_at");

-- CreateIndex
CREATE INDEX "documents_company_id_expires_at_idx" ON "documents"("company_id", "expires_at");

-- CreateIndex
CREATE INDEX "document_requests_company_id_employee_id_status_idx" ON "document_requests"("company_id", "employee_id", "status");

-- CreateIndex
CREATE INDEX "assets_company_id_deleted_at_idx" ON "assets"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "assets_company_id_code_key" ON "assets"("company_id", "code");

-- CreateIndex
CREATE INDEX "asset_assignments_company_id_employee_id_idx" ON "asset_assignments"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "asset_assignments_company_id_asset_id_idx" ON "asset_assignments"("company_id", "asset_id");

-- CreateIndex
CREATE INDEX "employee_change_requests_company_id_status_idx" ON "employee_change_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "leave_types_company_id_deleted_at_idx" ON "leave_types"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_company_id_code_key" ON "leave_types"("company_id", "code");

-- CreateIndex
CREATE INDEX "leave_policies_company_id_deleted_at_idx" ON "leave_policies"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "leave_balances_company_id_year_idx" ON "leave_balances"("company_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_year_key" ON "leave_balances"("employee_id", "leave_type_id", "year");

-- CreateIndex
CREATE INDEX "leave_balance_adjustments_company_id_employee_id_idx" ON "leave_balance_adjustments"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "leave_requests_company_id_status_idx" ON "leave_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_company_id_employee_id_start_date_idx" ON "leave_requests"("company_id", "employee_id", "start_date");

-- CreateIndex
CREATE INDEX "leave_requests_company_id_start_date_end_date_idx" ON "leave_requests"("company_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "holidays_company_id_date_idx" ON "holidays"("company_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_company_id_date_location_id_key" ON "holidays"("company_id", "date", "location_id");

-- CreateIndex
CREATE INDEX "employee_events_company_id_employee_id_idx" ON "employee_events"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "employee_events_company_id_event_type_start_date_idx" ON "employee_events"("company_id", "event_type", "start_date");

-- CreateIndex
CREATE INDEX "disciplinary_cases_company_id_employee_id_idx" ON "disciplinary_cases"("company_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "disciplinary_cases_company_id_case_number_key" ON "disciplinary_cases"("company_id", "case_number");

-- CreateIndex
CREATE INDEX "disciplinary_case_steps_company_id_case_id_idx" ON "disciplinary_case_steps"("company_id", "case_id");

-- CreateIndex
CREATE INDEX "payroll_exports_company_id_period_from_idx" ON "payroll_exports"("company_id", "period_from");

-- CreateIndex
CREATE INDEX "work_schedules_company_id_deleted_at_idx" ON "work_schedules"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_company_id_name_key" ON "work_schedules"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_rules_schedule_id_weekday_key" ON "schedule_rules"("schedule_id", "weekday");

-- CreateIndex
CREATE INDEX "employee_schedules_company_id_employee_id_start_date_idx" ON "employee_schedules"("company_id", "employee_id", "start_date");

-- CreateIndex
CREATE INDEX "shifts_company_id_deleted_at_idx" ON "shifts"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_company_id_code_key" ON "shifts"("company_id", "code");

-- CreateIndex
CREATE INDEX "shift_assignments_company_id_date_idx" ON "shift_assignments"("company_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_employee_id_date_shift_id_key" ON "shift_assignments"("employee_id", "date", "shift_id");

-- CreateIndex
CREATE INDEX "shift_swap_requests_company_id_status_idx" ON "shift_swap_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "geofences_company_id_location_id_idx" ON "geofences"("company_id", "location_id");

-- CreateIndex
CREATE INDEX "clock_devices_company_id_deleted_at_idx" ON "clock_devices"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "time_clock_entries_company_id_employee_id_local_date_idx" ON "time_clock_entries"("company_id", "employee_id", "local_date");

-- CreateIndex
CREATE INDEX "time_clock_entries_company_id_local_date_idx" ON "time_clock_entries"("company_id", "local_date");

-- CreateIndex
CREATE INDEX "attendance_days_company_id_date_status_idx" ON "attendance_days"("company_id", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_days_employee_id_date_key" ON "attendance_days"("employee_id", "date");

-- CreateIndex
CREATE INDEX "attendance_justifications_company_id_status_idx" ON "attendance_justifications"("company_id", "status");

-- CreateIndex
CREATE INDEX "job_requisitions_company_id_status_deleted_at_idx" ON "job_requisitions"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_requisitions_company_id_code_key" ON "job_requisitions"("company_id", "code");

-- CreateIndex
CREATE INDEX "job_postings_company_id_status_deleted_at_idx" ON "job_postings"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_company_id_slug_key" ON "job_postings"("company_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_company_id_code_key" ON "job_postings"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "job_competencies_job_posting_id_competency_id_key" ON "job_competencies"("job_posting_id", "competency_id");

-- CreateIndex
CREATE INDEX "pipeline_stages_company_id_job_posting_id_position_idx" ON "pipeline_stages"("company_id", "job_posting_id", "position");

-- CreateIndex
CREATE INDEX "candidates_company_id_deleted_at_idx" ON "candidates"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "candidates_company_id_document_number_idx" ON "candidates"("company_id", "document_number");

-- CreateIndex
CREATE INDEX "candidates_full_name_idx" ON "candidates"("full_name");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_company_id_email_key" ON "candidates"("company_id", "email");

-- CreateIndex
CREATE INDEX "candidate_tags_company_id_tag_idx" ON "candidate_tags"("company_id", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_tags_candidate_id_tag_key" ON "candidate_tags"("candidate_id", "tag");

-- CreateIndex
CREATE INDEX "candidate_documents_company_id_candidate_id_idx" ON "candidate_documents"("company_id", "candidate_id");

-- CreateIndex
CREATE INDEX "applications_company_id_status_deleted_at_idx" ON "applications"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "applications_company_id_stage_id_idx" ON "applications"("company_id", "stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_job_posting_id_candidate_id_key" ON "applications"("job_posting_id", "candidate_id");

-- CreateIndex
CREATE INDEX "application_stage_history_company_id_application_id_idx" ON "application_stage_history"("company_id", "application_id");

-- CreateIndex
CREATE INDEX "interviews_company_id_scheduled_at_idx" ON "interviews"("company_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "interviews_company_id_application_id_idx" ON "interviews"("company_id", "application_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_participants_interview_id_employee_id_key" ON "interview_participants"("interview_id", "employee_id");

-- CreateIndex
CREATE INDEX "interview_feedback_company_id_interview_id_idx" ON "interview_feedback"("company_id", "interview_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_feedback_interview_id_reviewer_employee_id_key" ON "interview_feedback"("interview_id", "reviewer_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_feedback_ratings_feedback_id_competency_id_key" ON "interview_feedback_ratings"("feedback_id", "competency_id");

-- CreateIndex
CREATE INDEX "assessments_company_id_application_id_idx" ON "assessments"("company_id", "application_id");

-- CreateIndex
CREATE INDEX "reference_checks_company_id_application_id_idx" ON "reference_checks"("company_id", "application_id");

-- CreateIndex
CREATE INDEX "offers_company_id_status_idx" ON "offers"("company_id", "status");

-- CreateIndex
CREATE INDEX "referrals_company_id_employee_id_idx" ON "referrals"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "onboarding_templates_company_id_kind_deleted_at_idx" ON "onboarding_templates"("company_id", "kind", "deleted_at");

-- CreateIndex
CREATE INDEX "onboarding_template_tasks_company_id_template_id_position_idx" ON "onboarding_template_tasks"("company_id", "template_id", "position");

-- CreateIndex
CREATE INDEX "onboarding_processes_company_id_status_kind_idx" ON "onboarding_processes"("company_id", "status", "kind");

-- CreateIndex
CREATE INDEX "onboarding_processes_company_id_employee_id_idx" ON "onboarding_processes"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "onboarding_tasks_company_id_process_id_position_idx" ON "onboarding_tasks"("company_id", "process_id", "position");

-- CreateIndex
CREATE INDEX "onboarding_tasks_company_id_assignee_employee_id_status_idx" ON "onboarding_tasks"("company_id", "assignee_employee_id", "status");

-- CreateIndex
CREATE INDEX "exit_interviews_company_id_employee_id_idx" ON "exit_interviews"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "media_folders_company_id_deleted_at_idx" ON "media_folders"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "media_library_company_id_deleted_at_idx" ON "media_library"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "media_library_company_id_kind_idx" ON "media_library"("company_id", "kind");

-- CreateIndex
CREATE INDEX "content_patterns_company_id_deleted_at_idx" ON "content_patterns"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "embed_providers_company_id_is_active_idx" ON "embed_providers"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "embed_providers_company_id_domain_key" ON "embed_providers"("company_id", "domain");

-- CreateIndex
CREATE INDEX "courses_company_id_status_deleted_at_idx" ON "courses"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "courses_company_id_slug_key" ON "courses"("company_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "course_prerequisites_course_id_prerequisite_course_id_key" ON "course_prerequisites"("course_id", "prerequisite_course_id");

-- CreateIndex
CREATE INDEX "course_modules_company_id_course_id_position_idx" ON "course_modules"("company_id", "course_id", "position");

-- CreateIndex
CREATE INDEX "lessons_company_id_module_id_position_idx" ON "lessons"("company_id", "module_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_contents_lesson_id_key" ON "lesson_contents"("lesson_id");

-- CreateIndex
CREATE INDEX "lesson_contents_company_id_idx" ON "lesson_contents"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_content_versions_lesson_id_version_key" ON "lesson_content_versions"("lesson_id", "version");

-- CreateIndex
CREATE INDEX "quizzes_company_id_deleted_at_idx" ON "quizzes"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "questions_company_id_quiz_id_position_idx" ON "questions"("company_id", "quiz_id", "position");

-- CreateIndex
CREATE INDEX "question_options_question_id_position_idx" ON "question_options"("question_id", "position");

-- CreateIndex
CREATE INDEX "quiz_attempts_company_id_employee_id_quiz_id_idx" ON "quiz_attempts"("company_id", "employee_id", "quiz_id");

-- CreateIndex
CREATE INDEX "assignments_lms_company_id_lesson_id_idx" ON "assignments_lms"("company_id", "lesson_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_company_id_employee_id_idx" ON "assignment_submissions"("company_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_submissions_assignment_id_employee_id_key" ON "assignment_submissions"("assignment_id", "employee_id");

-- CreateIndex
CREATE INDEX "learning_paths_company_id_deleted_at_idx" ON "learning_paths"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_items_path_id_course_id_key" ON "learning_path_items"("path_id", "course_id");

-- CreateIndex
CREATE INDEX "enrollments_company_id_employee_id_status_idx" ON "enrollments"("company_id", "employee_id", "status");

-- CreateIndex
CREATE INDEX "enrollments_company_id_due_date_idx" ON "enrollments"("company_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_course_id_employee_id_key" ON "enrollments"("course_id", "employee_id");

-- CreateIndex
CREATE INDEX "lesson_progress_company_id_lesson_id_idx" ON "lesson_progress"("company_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_enrollment_id_lesson_id_key" ON "lesson_progress"("enrollment_id", "lesson_id");

-- CreateIndex
CREATE INDEX "training_sessions_company_id_starts_at_idx" ON "training_sessions"("company_id", "starts_at");

-- CreateIndex
CREATE INDEX "session_attendance_company_id_employee_id_idx" ON "session_attendance"("company_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_attendance_session_id_employee_id_key" ON "session_attendance"("session_id", "employee_id");

-- CreateIndex
CREATE INDEX "certificates_company_id_employee_id_idx" ON "certificates"("company_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_company_id_code_key" ON "certificates"("company_id", "code");

-- CreateIndex
CREATE INDEX "course_feedback_company_id_course_id_idx" ON "course_feedback"("company_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_feedback_course_id_employee_id_key" ON "course_feedback"("course_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_plans_company_id_year_key" ON "training_plans"("company_id", "year");

-- CreateIndex
CREATE INDEX "training_needs_company_id_plan_id_idx" ON "training_needs"("company_id", "plan_id");

-- CreateIndex
CREATE INDEX "xapi_statements_company_id_employee_id_lesson_id_idx" ON "xapi_statements"("company_id", "employee_id", "lesson_id");

-- CreateIndex
CREATE INDEX "competencies_company_id_deleted_at_idx" ON "competencies"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_company_id_name_key" ON "competencies"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "competency_levels_competency_id_level_key" ON "competency_levels"("competency_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "position_competencies_position_id_competency_id_key" ON "position_competencies"("position_id", "competency_id");

-- CreateIndex
CREATE INDEX "objective_cycles_company_id_deleted_at_idx" ON "objective_cycles"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "objective_cycles_company_id_name_key" ON "objective_cycles"("company_id", "name");

-- CreateIndex
CREATE INDEX "objectives_company_id_cycle_id_deleted_at_idx" ON "objectives"("company_id", "cycle_id", "deleted_at");

-- CreateIndex
CREATE INDEX "objectives_company_id_owner_employee_id_idx" ON "objectives"("company_id", "owner_employee_id");

-- CreateIndex
CREATE INDEX "key_results_company_id_objective_id_idx" ON "key_results"("company_id", "objective_id");

-- CreateIndex
CREATE INDEX "kr_checkins_company_id_key_result_id_idx" ON "kr_checkins"("company_id", "key_result_id");

-- CreateIndex
CREATE INDEX "review_templates_company_id_deleted_at_idx" ON "review_templates"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "review_cycles_company_id_status_deleted_at_idx" ON "review_cycles"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "review_assignments_company_id_reviewer_employee_id_status_idx" ON "review_assignments"("company_id", "reviewer_employee_id", "status");

-- CreateIndex
CREATE INDEX "review_assignments_company_id_subject_employee_id_idx" ON "review_assignments"("company_id", "subject_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_assignments_cycle_id_subject_employee_id_reviewer_em_key" ON "review_assignments"("cycle_id", "subject_employee_id", "reviewer_employee_id", "relation");

-- CreateIndex
CREATE INDEX "review_responses_company_id_assignment_id_idx" ON "review_responses"("company_id", "assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_responses_assignment_id_question_key_key" ON "review_responses"("assignment_id", "question_key");

-- CreateIndex
CREATE INDEX "calibration_sessions_company_id_cycle_id_idx" ON "calibration_sessions"("company_id", "cycle_id");

-- CreateIndex
CREATE INDEX "nine_box_placements_company_id_cycle_id_idx" ON "nine_box_placements"("company_id", "cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "nine_box_placements_cycle_id_employee_id_key" ON "nine_box_placements"("cycle_id", "employee_id");

-- CreateIndex
CREATE INDEX "feedback_company_id_to_employee_id_deleted_at_idx" ON "feedback"("company_id", "to_employee_id", "deleted_at");

-- CreateIndex
CREATE INDEX "one_on_ones_company_id_lead_employee_id_scheduled_at_idx" ON "one_on_ones"("company_id", "lead_employee_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "one_on_ones_company_id_member_employee_id_idx" ON "one_on_ones"("company_id", "member_employee_id");

-- CreateIndex
CREATE INDEX "development_plans_company_id_employee_id_deleted_at_idx" ON "development_plans"("company_id", "employee_id", "deleted_at");

-- CreateIndex
CREATE INDEX "development_actions_company_id_plan_id_idx" ON "development_actions"("company_id", "plan_id");

-- CreateIndex
CREATE INDEX "career_paths_company_id_deleted_at_idx" ON "career_paths"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "career_path_steps_path_id_position_id_key" ON "career_path_steps"("path_id", "position_id");

-- CreateIndex
CREATE INDEX "succession_plans_company_id_deleted_at_idx" ON "succession_plans"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "succession_plans_company_id_position_id_key" ON "succession_plans"("company_id", "position_id");

-- CreateIndex
CREATE UNIQUE INDEX "succession_candidates_plan_id_employee_id_key" ON "succession_candidates"("plan_id", "employee_id");

-- CreateIndex
CREATE INDEX "posts_company_id_status_published_at_idx" ON "posts"("company_id", "status", "published_at");

-- CreateIndex
CREATE INDEX "post_audiences_company_id_post_id_idx" ON "post_audiences"("company_id", "post_id");

-- CreateIndex
CREATE INDEX "post_reads_company_id_post_id_idx" ON "post_reads"("company_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_reads_post_id_user_id_key" ON "post_reads"("post_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_reactions_post_id_user_id_emoji_key" ON "post_reactions"("post_id", "user_id", "emoji");

-- CreateIndex
CREATE INDEX "post_comments_company_id_post_id_idx" ON "post_comments"("company_id", "post_id");

-- CreateIndex
CREATE INDEX "events_company_id_starts_at_idx" ON "events"("company_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_event_id_employee_id_key" ON "event_registrations"("event_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_values_company_id_name_key" ON "company_values"("company_id", "name");

-- CreateIndex
CREATE INDEX "recognitions_company_id_to_employee_id_deleted_at_idx" ON "recognitions"("company_id", "to_employee_id", "deleted_at");

-- CreateIndex
CREATE INDEX "recognitions_company_id_created_at_idx" ON "recognitions"("company_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "badges_company_id_name_key" ON "badges"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "employee_badges_employee_id_badge_id_key" ON "employee_badges"("employee_id", "badge_id");

-- CreateIndex
CREATE INDEX "benefits_company_id_deleted_at_idx" ON "benefits"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_enrollments_benefit_id_employee_id_key" ON "benefit_enrollments"("benefit_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_categories_company_id_slug_key" ON "wiki_categories"("company_id", "slug");

-- CreateIndex
CREATE INDEX "wiki_articles_company_id_status_deleted_at_idx" ON "wiki_articles"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_articles_company_id_slug_key" ON "wiki_articles"("company_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "survey_templates_company_id_key_key" ON "survey_templates"("company_id", "key");

-- CreateIndex
CREATE INDEX "surveys_company_id_status_deleted_at_idx" ON "surveys"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "survey_versions_survey_id_version_key" ON "survey_versions"("survey_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "survey_questions_version_id_key_key" ON "survey_questions"("version_id", "key");

-- CreateIndex
CREATE INDEX "survey_audiences_company_id_survey_id_idx" ON "survey_audiences"("company_id", "survey_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_invitations_token_key" ON "survey_invitations"("token");

-- CreateIndex
CREATE INDEX "survey_invitations_company_id_survey_id_idx" ON "survey_invitations"("company_id", "survey_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_invitations_survey_id_employee_id_key" ON "survey_invitations"("survey_id", "employee_id");

-- CreateIndex
CREATE INDEX "survey_responses_company_id_survey_id_idx" ON "survey_responses"("company_id", "survey_id");

-- CreateIndex
CREATE INDEX "survey_answers_company_id_question_id_idx" ON "survey_answers"("company_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_answers_response_id_question_id_key" ON "survey_answers"("response_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "ethics_categories_company_id_name_key" ON "ethics_categories"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ethics_reports_tracking_code_key" ON "ethics_reports"("tracking_code");

-- CreateIndex
CREATE INDEX "ethics_reports_company_id_status_idx" ON "ethics_reports"("company_id", "status");

-- CreateIndex
CREATE INDEX "ethics_report_messages_company_id_report_id_idx" ON "ethics_report_messages"("company_id", "report_id");

-- CreateIndex
CREATE UNIQUE INDEX "ethics_cases_report_id_key" ON "ethics_cases"("report_id");

-- CreateIndex
CREATE INDEX "ethics_cases_company_id_status_idx" ON "ethics_cases"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ethics_cases_company_id_case_number_key" ON "ethics_cases"("company_id", "case_number");

-- CreateIndex
CREATE UNIQUE INDEX "ethics_case_members_case_id_user_id_key" ON "ethics_case_members"("case_id", "user_id");

-- CreateIndex
CREATE INDEX "ethics_case_actions_company_id_case_id_idx" ON "ethics_case_actions"("company_id", "case_id");

-- CreateIndex
CREATE INDEX "ethics_evidence_company_id_case_id_idx" ON "ethics_evidence"("company_id", "case_id");

-- CreateIndex
CREATE INDEX "ethics_access_logs_company_id_case_id_idx" ON "ethics_access_logs"("company_id", "case_id");

-- CreateIndex
CREATE INDEX "document_templates_company_id_deleted_at_idx" ON "document_templates"("company_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_company_id_code_key" ON "document_templates"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "generated_documents_verification_code_key" ON "generated_documents"("verification_code");

-- CreateIndex
CREATE INDEX "generated_documents_company_id_employee_id_idx" ON "generated_documents"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "policies_company_id_status_deleted_at_idx" ON "policies"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "policies_company_id_code_key" ON "policies"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_policy_id_version_key" ON "policy_versions"("policy_id", "version");

-- CreateIndex
CREATE INDEX "policy_acknowledgements_company_id_policy_id_idx" ON "policy_acknowledgements"("company_id", "policy_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_acknowledgements_version_id_employee_id_key" ON "policy_acknowledgements"("version_id", "employee_id");

-- CreateIndex
CREATE INDEX "signature_requests_company_id_status_idx" ON "signature_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "signature_requests_entity_type_entity_id_idx" ON "signature_requests"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "signatures_company_id_request_id_idx" ON "signatures"("company_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_categories_company_id_code_key" ON "ticket_categories"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_company_id_name_key" ON "sla_policies"("company_id", "name");

-- CreateIndex
CREATE INDEX "tickets_company_id_status_deleted_at_idx" ON "tickets"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "tickets_company_id_assignee_employee_id_idx" ON "tickets"("company_id", "assignee_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_company_id_number_key" ON "tickets"("company_id", "number");

-- CreateIndex
CREATE INDEX "ticket_messages_company_id_ticket_id_idx" ON "ticket_messages"("company_id", "ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "macros_company_id_name_key" ON "macros"("company_id", "name");

-- CreateIndex
CREATE INDEX "kb_articles_company_id_status_deleted_at_idx" ON "kb_articles"("company_id", "status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "kb_articles_company_id_slug_key" ON "kb_articles"("company_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "channels_company_id_kind_name_key" ON "channels"("company_id", "kind", "name");

-- CreateIndex
CREATE INDEX "channel_messages_company_id_channel_id_idx" ON "channel_messages"("company_id", "channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "csat_responses_ticket_id_key" ON "csat_responses"("ticket_id");

-- CreateIndex
CREATE INDEX "csat_responses_company_id_idx" ON "csat_responses"("company_id");

-- CreateIndex
CREATE INDEX "medical_exams_company_id_employee_id_idx" ON "medical_exams"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "medical_exams_company_id_expires_at_idx" ON "medical_exams"("company_id", "expires_at");

-- CreateIndex
CREATE INDEX "work_accidents_company_id_occurred_at_idx" ON "work_accidents"("company_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_accidents_company_id_code_key" ON "work_accidents"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "accident_investigations_accident_id_key" ON "accident_investigations"("accident_id");

-- CreateIndex
CREATE INDEX "accident_investigations_company_id_idx" ON "accident_investigations"("company_id");

-- CreateIndex
CREATE INDEX "risk_matrix_entries_company_id_deleted_at_idx" ON "risk_matrix_entries"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "ppe_deliveries_company_id_employee_id_idx" ON "ppe_deliveries"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "sst_inspections_company_id_status_idx" ON "sst_inspections"("company_id", "status");

-- CreateIndex
CREATE INDEX "committees_company_id_kind_idx" ON "committees"("company_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "committee_members_committee_id_employee_id_key" ON "committee_members"("committee_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "committee_minutes_committee_id_number_key" ON "committee_minutes"("committee_id", "number");

-- CreateIndex
CREATE INDEX "hr_snapshots_company_id_metric_snapshot_date_idx" ON "hr_snapshots"("company_id", "metric", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "hr_snapshots_company_id_snapshot_date_metric_dimension_dime_key" ON "hr_snapshots"("company_id", "snapshot_date", "metric", "dimension", "dimension_value");

-- CreateIndex
CREATE INDEX "report_definitions_company_id_deleted_at_idx" ON "report_definitions"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "report_schedules_company_id_is_active_idx" ON "report_schedules"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "report_runs_company_id_definition_id_idx" ON "report_runs"("company_id", "definition_id");

-- CreateIndex
CREATE INDEX "analytics_alerts_company_id_kind_is_resolved_idx" ON "analytics_alerts"("company_id", "kind", "is_resolved");

-- AddForeignKey
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_company_user_id_fkey" FOREIGN KEY ("company_user_id") REFERENCES "company_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_instances" ADD CONSTRAINT "workflow_step_instances_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_instances" ADD CONSTRAINT "workflow_step_instances_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_reports_to_position_id_fkey" FOREIGN KEY ("reports_to_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_personal_data" ADD CONSTRAINT "employee_personal_data_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependents" ADD CONSTRAINT "dependents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education" ADD CONSTRAINT "education_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_experience" ADD CONSTRAINT "work_experience_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "languages" ADD CONSTRAINT "languages_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_change_requests" ADD CONSTRAINT "employee_change_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "leave_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_events" ADD CONSTRAINT "employee_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinary_cases" ADD CONSTRAINT "disciplinary_cases_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplinary_case_steps" ADD CONSTRAINT "disciplinary_case_steps_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "disciplinary_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_clock_entries" ADD CONSTRAINT "time_clock_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_justifications" ADD CONSTRAINT "attendance_justifications_attendance_day_id_fkey" FOREIGN KEY ("attendance_day_id") REFERENCES "attendance_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "job_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_competencies" ADD CONSTRAINT "job_competencies_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_competencies" ADD CONSTRAINT "job_competencies_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tags" ADD CONSTRAINT "candidate_tags_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_stage_history" ADD CONSTRAINT "application_stage_history_to_stage_id_fkey" FOREIGN KEY ("to_stage_id") REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_participants" ADD CONSTRAINT "interview_participants_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_participants" ADD CONSTRAINT "interview_participants_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback_ratings" ADD CONSTRAINT "interview_feedback_ratings_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "interview_feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback_ratings" ADD CONSTRAINT "interview_feedback_ratings_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_checks" ADD CONSTRAINT "reference_checks_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_template_tasks" ADD CONSTRAINT "onboarding_template_tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_processes" ADD CONSTRAINT "onboarding_processes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_processes" ADD CONSTRAINT "onboarding_processes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "onboarding_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "onboarding_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_assignee_employee_id_fkey" FOREIGN KEY ("assignee_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_interviews" ADD CONSTRAINT "exit_interviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_library" ADD CONSTRAINT "media_library_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "media_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_library" ADD CONSTRAINT "media_library_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisite_course_id_fkey" FOREIGN KEY ("prerequisite_course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_contents" ADD CONSTRAINT "lesson_contents_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_content_versions" ADD CONSTRAINT "lesson_content_versions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments_lms" ADD CONSTRAINT "assignments_lms_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments_lms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_items" ADD CONSTRAINT "learning_path_items_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_items" ADD CONSTRAINT "learning_path_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_feedback" ADD CONSTRAINT "course_feedback_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_needs" ADD CONSTRAINT "training_needs_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_levels" ADD CONSTRAINT "competency_levels_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_competencies" ADD CONSTRAINT "position_competencies_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_competencies" ADD CONSTRAINT "position_competencies_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "objective_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kr_checkins" ADD CONSTRAINT "kr_checkins_key_result_id_fkey" FOREIGN KEY ("key_result_id") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_cycles" ADD CONSTRAINT "review_cycles_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "review_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_subject_employee_id_fkey" FOREIGN KEY ("subject_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_reviewer_employee_id_fkey" FOREIGN KEY ("reviewer_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "review_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_sessions" ADD CONSTRAINT "calibration_sessions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nine_box_placements" ADD CONSTRAINT "nine_box_placements_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nine_box_placements" ADD CONSTRAINT "nine_box_placements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_from_employee_id_fkey" FOREIGN KEY ("from_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_to_employee_id_fkey" FOREIGN KEY ("to_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_ones" ADD CONSTRAINT "one_on_ones_lead_employee_id_fkey" FOREIGN KEY ("lead_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_ones" ADD CONSTRAINT "one_on_ones_member_employee_id_fkey" FOREIGN KEY ("member_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_actions" ADD CONSTRAINT "development_actions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "development_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_path_steps" ADD CONSTRAINT "career_path_steps_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "career_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_path_steps" ADD CONSTRAINT "career_path_steps_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "succession_candidates" ADD CONSTRAINT "succession_candidates_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "succession_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "succession_candidates" ADD CONSTRAINT "succession_candidates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audiences" ADD CONSTRAINT "post_audiences_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reads" ADD CONSTRAINT "post_reads_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "post_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recognitions" ADD CONSTRAINT "recognitions_from_employee_id_fkey" FOREIGN KEY ("from_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recognitions" ADD CONSTRAINT "recognitions_to_employee_id_fkey" FOREIGN KEY ("to_employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recognitions" ADD CONSTRAINT "recognitions_value_id_fkey" FOREIGN KEY ("value_id") REFERENCES "company_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_badges" ADD CONSTRAINT "employee_badges_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_badges" ADD CONSTRAINT "employee_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_benefit_id_fkey" FOREIGN KEY ("benefit_id") REFERENCES "benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_enrollments" ADD CONSTRAINT "benefit_enrollments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_categories" ADD CONSTRAINT "wiki_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "wiki_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_articles" ADD CONSTRAINT "wiki_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "wiki_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_versions" ADD CONSTRAINT "survey_versions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "survey_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_audiences" ADD CONSTRAINT "survey_audiences_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "survey_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ethics_reports" ADD CONSTRAINT "ethics_reports_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ethics_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ethics_report_messages" ADD CONSTRAINT "ethics_report_messages_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "ethics_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ethics_cases" ADD CONSTRAINT "ethics_cases_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "ethics_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ethics_case_members" ADD CONSTRAINT "ethics_case_members_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "ethics_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ethics_case_actions" ADD CONSTRAINT "ethics_case_actions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "ethics_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ethics_evidence" ADD CONSTRAINT "ethics_evidence_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "ethics_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "signature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_employee_id_fkey" FOREIGN KEY ("requester_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_employee_id_fkey" FOREIGN KEY ("assignee_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csat_responses" ADD CONSTRAINT "csat_responses_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_exams" ADD CONSTRAINT "medical_exams_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_accidents" ADD CONSTRAINT "work_accidents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accident_investigations" ADD CONSTRAINT "accident_investigations_accident_id_fkey" FOREIGN KEY ("accident_id") REFERENCES "work_accidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_deliveries" ADD CONSTRAINT "ppe_deliveries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_minutes" ADD CONSTRAINT "committee_minutes_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "report_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "report_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
