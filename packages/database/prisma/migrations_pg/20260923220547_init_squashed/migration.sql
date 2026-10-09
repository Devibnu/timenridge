-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DeviceLifecycleStatus" AS ENUM ('REGISTERED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'MAPPED', 'READY', 'PROCESSING', 'SENT', 'PROCESSED', 'DUPLICATE', 'FAILED', 'SAP_REJECTED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('OPEN', 'COMPLETE', 'MISSING_IN', 'MISSING_OUT', 'AMBIGUOUS', 'REVIEW_REQUIRED', 'READY_FOR_SAP', 'SENT_TO_SAP');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('CREATED', 'READY', 'GENERATED', 'UPLOADED', 'ACKNOWLEDGED', 'PROCESSED', 'PARTIALLY_PROCESSED', 'FAILED', 'SAP_REJECTED');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('GENERATED', 'UPLOADED', 'ACKNOWLEDGED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'INTEGRATION_ADMIN', 'OPERATOR', 'AUDITOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'ACCOUNT_DISABLED', 'ROLE_CHANGED', 'PASSWORD_CHANGED');

-- CreateEnum
CREATE TYPE "BatchRecordStatus" AS ENUM ('VALID', 'INVALID_MISSING_SAP_EMPLOYEE', 'INVALID_MISSING_CHECK_IN', 'INVALID_MISSING_CHECK_OUT', 'INVALID_STATUS', 'INVALID_DATE', 'INVALID_TRACEABILITY');

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "device_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "host" TEXT,
    "port" INTEGER,
    "protocol" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lifecycle_status" "DeviceLifecycleStatus" NOT NULL DEFAULT 'REGISTERED',
    "encrypted_credential" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "last_successful_sync_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error_message" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "internal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_mappings" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_employee_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "sap_employee_id" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "shift_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "crosses_midnight" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_rules" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "early_in_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_in_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_out_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_out_minutes" INTEGER NOT NULL DEFAULT 0,
    "duplicate_window_seconds" INTEGER NOT NULL DEFAULT 300,
    "break_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_checkout_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_shift_assignments" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_raw_events" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_employee_id" TEXT NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "source_hash" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_raw_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_events" (
    "id" TEXT NOT NULL,
    "event_uid" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_employee_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "sap_employee_id" TEXT,
    "event_date" DATE NOT NULL,
    "event_time" TEXT NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "event_type" "EventType" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ATTENDANCE_DEVICE',
    "status" "EventStatus" NOT NULL DEFAULT 'READY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_cycles" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "sap_employee_id" TEXT,
    "business_date" DATE NOT NULL,
    "shift_id" TEXT,
    "cycle_sequence" INTEGER NOT NULL DEFAULT 1,
    "check_in_event_id" TEXT,
    "check_out_event_id" TEXT,
    "status" "CycleStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_rule_results" (
    "id" TEXT NOT NULL,
    "attendance_event_id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "input_data" JSONB NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_rule_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_batches" (
    "id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'CREATED',
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "generated_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_files" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "sha256" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'GENERATED',
    "generated_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sap_responses" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "sap_status" TEXT NOT NULL,
    "response_payload" JSONB,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sap_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_logs" (
    "id" TEXT NOT NULL,
    "reference_id" TEXT,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "error_details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "target" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceBatch" (
    "id" TEXT NOT NULL,
    "batch_identity" TEXT NOT NULL,
    "correlation_id" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'CREATED',
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceBatchRecord" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "attendance_cycle_id" TEXT NOT NULL,
    "sap_employee_id" TEXT,
    "payload" JSONB,
    "status" "BatchRecordStatus" NOT NULL DEFAULT 'VALID',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceBatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_batch_acknowledgements" (
    "id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_batch_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_code_key" ON "devices"("device_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_internal_id_key" ON "employees"("internal_id");

-- CreateIndex
CREATE INDEX "employee_mappings_device_id_device_employee_id_idx" ON "employee_mappings"("device_id", "device_employee_id");

-- CreateIndex
CREATE INDEX "employee_mappings_employee_id_idx" ON "employee_mappings"("employee_id");

-- CreateIndex
CREATE INDEX "employee_mappings_sap_employee_id_idx" ON "employee_mappings"("sap_employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_shift_code_key" ON "shifts"("shift_code");

-- CreateIndex
CREATE INDEX "shift_rules_shift_id_idx" ON "shift_rules"("shift_id");

-- CreateIndex
CREATE INDEX "employee_shift_assignments_employee_id_idx" ON "employee_shift_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "employee_shift_assignments_shift_id_idx" ON "employee_shift_assignments"("shift_id");

-- CreateIndex
CREATE INDEX "attendance_raw_events_device_id_device_employee_id_idx" ON "attendance_raw_events"("device_id", "device_employee_id");

-- CreateIndex
CREATE INDEX "attendance_raw_events_event_timestamp_idx" ON "attendance_raw_events"("event_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_raw_events_device_id_source_hash_key" ON "attendance_raw_events"("device_id", "source_hash");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_events_event_uid_key" ON "attendance_events"("event_uid");

-- CreateIndex
CREATE INDEX "attendance_events_employee_id_event_date_idx" ON "attendance_events"("employee_id", "event_date");

-- CreateIndex
CREATE INDEX "attendance_events_sap_employee_id_idx" ON "attendance_events"("sap_employee_id");

-- CreateIndex
CREATE INDEX "attendance_events_event_timestamp_idx" ON "attendance_events"("event_timestamp");

-- CreateIndex
CREATE INDEX "attendance_events_status_idx" ON "attendance_events"("status");

-- CreateIndex
CREATE INDEX "attendance_cycles_employee_id_business_date_idx" ON "attendance_cycles"("employee_id", "business_date");

-- CreateIndex
CREATE INDEX "attendance_cycles_status_idx" ON "attendance_cycles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_cycles_employee_id_business_date_cycle_sequence_key" ON "attendance_cycles"("employee_id", "business_date", "cycle_sequence");

-- CreateIndex
CREATE INDEX "attendance_rule_results_attendance_event_id_idx" ON "attendance_rule_results"("attendance_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_batches_batch_number_key" ON "integration_batches"("batch_number");

-- CreateIndex
CREATE INDEX "integration_batches_status_idx" ON "integration_batches"("status");

-- CreateIndex
CREATE INDEX "integration_files_batch_id_idx" ON "integration_files"("batch_id");

-- CreateIndex
CREATE INDEX "integration_files_status_idx" ON "integration_files"("status");

-- CreateIndex
CREATE INDEX "sap_responses_batch_id_idx" ON "sap_responses"("batch_id");

-- CreateIndex
CREATE INDEX "sap_responses_file_id_idx" ON "sap_responses"("file_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_idx" ON "audit_logs"("target");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "processing_logs_reference_id_idx" ON "processing_logs"("reference_id");

-- CreateIndex
CREATE INDEX "processing_logs_stage_idx" ON "processing_logs"("stage");

-- CreateIndex
CREATE INDEX "processing_logs_timestamp_idx" ON "processing_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "security_audit_logs_user_id_idx" ON "security_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "security_audit_logs_action_idx" ON "security_audit_logs"("action");

-- CreateIndex
CREATE INDEX "security_audit_logs_timestamp_idx" ON "security_audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceBatch_batch_identity_key" ON "AttendanceBatch"("batch_identity");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceBatch_correlation_id_key" ON "AttendanceBatch"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceBatchRecord_batch_id_attendance_cycle_id_key" ON "AttendanceBatchRecord"("batch_id", "attendance_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_batch_acknowledgements_correlation_id_key" ON "attendance_batch_acknowledgements"("correlation_id");

-- CreateIndex
CREATE INDEX "attendance_batch_acknowledgements_batch_id_idx" ON "attendance_batch_acknowledgements"("batch_id");

-- CreateIndex
CREATE INDEX "attendance_batch_acknowledgements_correlation_id_idx" ON "attendance_batch_acknowledgements"("correlation_id");

-- AddForeignKey
ALTER TABLE "employee_mappings" ADD CONSTRAINT "employee_mappings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_mappings" ADD CONSTRAINT "employee_mappings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_rules" ADD CONSTRAINT "shift_rules_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_raw_events" ADD CONSTRAINT "attendance_raw_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_cycles" ADD CONSTRAINT "attendance_cycles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_rule_results" ADD CONSTRAINT "attendance_rule_results_attendance_event_id_fkey" FOREIGN KEY ("attendance_event_id") REFERENCES "attendance_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_files" ADD CONSTRAINT "integration_files_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "integration_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sap_responses" ADD CONSTRAINT "sap_responses_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "integration_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceBatchRecord" ADD CONSTRAINT "AttendanceBatchRecord_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "AttendanceBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceBatchRecord" ADD CONSTRAINT "AttendanceBatchRecord_attendance_cycle_id_fkey" FOREIGN KEY ("attendance_cycle_id") REFERENCES "attendance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_batch_acknowledgements" ADD CONSTRAINT "attendance_batch_acknowledgements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "AttendanceBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
