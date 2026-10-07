#!/bin/bash
psql timebridge_test -c "
BEGIN;
INSERT INTO employee_mappings (id, device_id, device_employee_id, employee_id, valid_from, valid_to, is_active, updated_at) VALUES ('MAP-10', 'DEVICE-01', '127', 'EMP-001', '2026-01-01', '2026-12-31', true, now());
SELECT pg_sleep(2);
COMMIT;
" > /tmp/out1.log 2>&1 &
PID1=$!

sleep 0.5

psql timebridge_test -c "
BEGIN;
INSERT INTO employee_mappings (id, device_id, device_employee_id, employee_id, valid_from, valid_to, is_active, updated_at) VALUES ('MAP-11', 'DEVICE-01', '127', 'EMP-002', '2026-01-01', '2026-12-31', true, now());
COMMIT;
" > /tmp/out2.log 2>&1 &
PID2=$!

wait $PID1
wait $PID2

cat /tmp/out1.log
echo "---"
cat /tmp/out2.log
