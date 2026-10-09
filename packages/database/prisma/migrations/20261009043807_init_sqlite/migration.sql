-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "host" TEXT,
    "port" INTEGER,
    "protocol" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lifecycle_status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "encrypted_credential" TEXT,
    "last_seen_at" DATETIME,
    "last_successful_sync_at" DATETIME,
    "last_error_at" DATETIME,
    "last_error_message" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "employee_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "device_employee_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "sap_employee_id" TEXT,
    "valid_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "employee_mappings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "employee_mappings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shift_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "crosses_midnight" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "shift_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shift_id" TEXT NOT NULL,
    "early_in_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_in_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_out_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_out_minutes" INTEGER NOT NULL DEFAULT 0,
    "duplicate_window_seconds" INTEGER NOT NULL DEFAULT 300,
    "break_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_checkout_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "shift_rules_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employee_shift_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "effective_from" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "employee_shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendance_raw_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL,
    "device_employee_id" TEXT NOT NULL,
    "event_timestamp" DATETIME NOT NULL,
    "raw_payload" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_raw_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendance_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_uid" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_employee_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "sap_employee_id" TEXT,
    "event_date" DATETIME NOT NULL,
    "event_time" TEXT NOT NULL,
    "event_timestamp" DATETIME NOT NULL,
    "event_type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ATTENDANCE_DEVICE',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "attendance_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "attendance_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendance_cycles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "sap_employee_id" TEXT,
    "business_date" DATETIME NOT NULL,
    "shift_id" TEXT,
    "cycle_sequence" INTEGER NOT NULL DEFAULT 1,
    "check_in_event_id" TEXT,
    "check_out_event_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "attendance_cycles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendance_rule_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendance_event_id" TEXT NOT NULL,
    "rule_code" TEXT NOT NULL,
    "input_data" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_rule_results_attendance_event_id_fkey" FOREIGN KEY ("attendance_event_id") REFERENCES "attendance_events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integration_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "generated_at" DATETIME,
    "uploaded_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "integration_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "sha256" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "generated_at" DATETIME,
    "uploaded_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "integration_files_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "integration_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sap_responses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "sap_status" TEXT NOT NULL,
    "response_payload" TEXT,
    "processed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sap_responses_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "integration_files" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "processing_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference_id" TEXT,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "error_details" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AttendanceBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_identity" TEXT NOT NULL,
    "correlation_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AttendanceBatchRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "attendance_cycle_id" TEXT NOT NULL,
    "sap_employee_id" TEXT,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "AttendanceBatchRecord_attendance_cycle_id_fkey" FOREIGN KEY ("attendance_cycle_id") REFERENCES "attendance_cycles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceBatchRecord_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "AttendanceBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendance_batch_acknowledgements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "correlation_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" TEXT,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_batch_acknowledgements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "AttendanceBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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

-- CreateIndex
CREATE INDEX "outbox_events_status_idx" ON "outbox_events"("status");

-- CreateIndex
CREATE INDEX "outbox_events_created_at_idx" ON "outbox_events"("created_at");
