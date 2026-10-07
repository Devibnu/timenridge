# Database Backup & Recovery Plan (P15)

## Objectives

- **RPO (Recovery Point Objective):** <= 15 minutes. Data loss in the event of failure should not exceed 15 minutes.
- **RTO (Recovery Time Objective):** <= 1 hour. The system should be fully operational within an hour following a disaster declaration.

## 1. Backup Strategy (PostgreSQL)

To achieve an RPO of 15 minutes, we implement a combination of Base Backups and WAL (Write-Ahead Logging) Archiving.

### 1.1 Base Backups (Daily)

A full snapshot of the database is taken once every 24 hours.

```bash
pg_basebackup -h <db-host> -U backup_user -D /var/backups/timebridge/base -F t -z -P
```

### 1.2 WAL Archiving (Continuous / <= 15 mins)

Enable WAL archiving in `postgresql.conf`:

```ini
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/backups/timebridge/wal/%f' # In cloud environments, use an S3 upload script here (e.g. WAL-G)
archive_timeout = 900 # 15 minutes (Forces a switch and archive every 15 mins)
```

## 2. Disaster Recovery Procedure

### Scenario: Complete Database Corruption or Failure

1. **Stop the Application**
   - Scale down API and Worker instances to 0 to stop incoming writes.

2. **Restore Base Backup**
   - Stop the PostgreSQL service.
   - Extract the last known good Base Backup to the PostgreSQL data directory.

   ```bash
   tar -xzvf /var/backups/timebridge/base/base.tar.gz -C /var/lib/postgresql/data/
   ```

3. **Apply WAL Archives (Point-In-Time Recovery - PITR)**
   - Create a `recovery.signal` file in the data directory.
   - Configure `postgresql.conf` with the restore command:

   ```ini
   restore_command = 'cp /var/backups/timebridge/wal/%f %p'
   # Optional: recovery_target_time = '2026-09-24 07:00:00'
   ```
   - Start the PostgreSQL service. The database will replay the WAL files up to the point of failure.

4. **Verify Consistency**
   - Run a query against the `SecurityAuditLog` to verify the latest transactions are present.
   - Ensure the database exits recovery mode (the `recovery.signal` file is deleted automatically).

5. **Resume Application**
   - Scale the API and Worker instances back to their desired operational capacities.

## 3. Redis Backup

Redis holds the BullMQ queues. In standard operation, jobs in BullMQ are transient. However, for durability across restarts:

- Enable `appendonly yes` (AOF) in `redis.conf`.
- Configure `appendfsync everysec` to limit data loss to 1 second.
