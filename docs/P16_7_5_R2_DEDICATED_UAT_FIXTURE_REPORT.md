# P16.7.5-R2 Dedicated Local Employee Mapping UAT Fixture Report

**Final status: READY FOR P16.7.5**
**Scope:** dedicated local fixture creation and verification only. No P16.7.5 mutation UAT, resolver call, or cleanup was performed. P16.7.5 is not declared closed; stop for SA review.

## 1. Objective

Create and verify a dedicated local `Device` + `Employee` + active bounded `EmployeeMapping` + canonical `AttendanceEvent` fixture for later P16.7.5 UAT. Preserve existing attendance and mapping data.

## 2. Environment

- Database target was verified before connecting: PostgreSQL at `127.0.0.1:5432`, database `timebridge_dev`.
- The connection URL was not printed with credentials.
- No production or staging database, production API, remote database, or external SAP endpoint was accessed.
- The fixture was created directly in one serializable Prisma transaction. No API, resolver, rule engine, cycle engine, SAP, reconciliation, or mutation-UAT route was called.
- No source code, Prisma schema, migration, API contract, or architecture file was changed.

## 3. Fixture Design

A new device was created rather than reusing an existing device. This keeps the fixture's events and mapping outside existing device identities and avoids modifying or coupling the fixture to existing attendance records. The fixture is identifiable by its dedicated device code/name, employee internal ID/name, device employee ID, SAP employee ID, event UID, and supported `AttendanceEvent.source` marker.

## 4. Device

| Field | Value |
| --- | --- |
| ID | `4581b3bd-ad45-44aa-a810-dfb65c144ce0` |
| Device code | `P1675-UAT-DEVICE-001` |
| Name | `P16.7.5 UAT Dedicated Local Device` |
| Status / lifecycle | `UNKNOWN` / `REGISTERED` |
| Active | Yes |

## 5. Employee

| Field | Value |
| --- | --- |
| ID | `62a36ed5-c978-4f63-b45c-e479028a1bee` |
| Internal ID | `P1675-UAT-001` |
| Name | `P16.7.5 UAT Dedicated Employee` |

## 6. Employee Mapping

| Field | Value |
| --- | --- |
| Mapping ID | `72ab9833-1465-49fa-8fec-3404411c2161` |
| Device ID | `4581b3bd-ad45-44aa-a810-dfb65c144ce0` |
| Device employee ID | `P1675-UAT-001` |
| Employee ID | `62a36ed5-c978-4f63-b45c-e479028a1bee` |
| SAP employee ID | `P1675-SAP-001` |
| Valid from | `2026-01-01T00:00:00.000Z` |
| Valid to (exclusive) | `2027-01-01T00:00:00.000Z` |
| Active | Yes |

The period is bounded and uses the existing half-open `[valid_from, valid_to)` convention. The new device has no other mappings, so no mapping intervals overlap.

## 7. AttendanceEvent

| Field | Value |
| --- | --- |
| ID | `bb51f9b9-6d90-4995-a406-b67b1aee4e2c` |
| Event UID | `eec8ebfef3ff3546493d243cd43d8b9cac73161cd4d3ecf2803ce2aa79281fa1` |
| Device ID | `4581b3bd-ad45-44aa-a810-dfb65c144ce0` |
| Device employee ID | `P1675-UAT-001` |
| Employee ID | `62a36ed5-c978-4f63-b45c-e479028a1bee` |
| SAP employee ID | `P1675-SAP-001` |
| Timestamp | `2026-10-05T02:00:00.000Z` |
| Event date / time | `2026-10-05` / `09:00:00` (Asia/Jakarta) |
| Event type | `IN` |
| Source marker | `P16.7.5_UAT_FIXTURE` |
| Status | `RECEIVED` |
| Created / updated | `2026-10-06T00:40:55.973Z` / `2026-10-06T00:40:55.973Z` |

The event UID is a unique 64-character lowercase hexadecimal SHA-256 identifier generated using the existing normalizer's device/source-hash identity pattern. The event timestamp is inside the mapping period, and all device, employee, and SAP identities match the active mapping.

## 8. Validity Period

The mapping covers `[2026-01-01T00:00:00.000Z, 2027-01-01T00:00:00.000Z)`. The canonical event timestamp `2026-10-05T02:00:00.000Z` falls within that interval.

## 9. Exclusion Constraint Verification

Before and after fixture creation, `no_overlapping_mapping` existed on `employee_mappings` as a GiST exclusion constraint:

```text
EXCLUDE USING gist (
  device_id WITH =,
  tsrange(valid_from, COALESCE(valid_to, 'infinity'), '[)') WITH &&
)
```

PostgreSQL reported constraint type `x` and `convalidated = true` after creation. No constraint was disabled, bypassed, or changed. A post-creation check found no overlapping mapping pairs for the dedicated device.

## 10. Before/After Existing Data Snapshot

Snapshots contain full-row SHA-256 hashes and sorted IDs. The “after” hash below is calculated over existing rows only, excluding the one expected fixture addition for `AttendanceEvent` and `EmployeeMapping`. Every existing-row hash matched its before value.

| Table | Before → after count | Before IDs → after IDs | Existing rows unchanged (SHA-256) |
| --- | ---: | --- | --- |
| `AttendanceRawEvent` | 1 → 1 | `144c1457-d619-48c4-ae89-0bf9b97f8017` → same | Yes — `8c5d0c439e374e2150b9cb9088b5d9eb91b1d698d6a49bd63b5d210e21ce30eb` |
| `AttendanceEvent` | 1 → 2 | `9ecaadb8-3628-4ad4-bcd8-5bc6ec514682` → same + `bb51f9b9-6d90-4995-a406-b67b1aee4e2c` | Yes — `52a4ae4ac90e3034a3e46f36a911737ed2e4a2e4cae1cdd84f2dafdbfd5a25bb` |
| `AttendanceRuleResult` | 1 → 1 | `e1512c07-b781-4300-a362-506419c73ca5` → same | Yes — `a5cbe9ccb94f066c09e256c8440bcaeb969bf61db61090a6fa43a6efaaeb319c` |
| `AttendanceCycle` | 1 → 1 | `14709c83-0e5c-4a7f-9531-2059269b8866` → same | Yes — `817001d95131de33e6fd5a58828a31b06529f109312b95794cd6abf6f6802773d` |
| `IntegrationBatch` | 0 → 0 | None → None | Yes — `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `IntegrationFile` | 0 → 0 | None → None | Yes — `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `SapResponse` | 0 → 0 | None → None | Yes — `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| `SecurityAuditLog` | 38 → 38 | Same 38 IDs listed below | Yes — `b6550e2ee0560e45d288dc89c8e0ad1a428c25211328ba327d67dc16d59531b3` |
| `EmployeeMapping` | 1 → 2 | `9a0a5f01-800c-4672-98cd-9181c135c542` → same + `72ab9833-1465-49fa-8fec-3404411c2161` | Yes — `25fa5a5f2e52a1e9cc46851a059d5f7594bfb14bb40c3cff55a20ad318ac83e6` |

`SecurityAuditLog` IDs before and after:

```text
08f60eec-c7e7-456b-80f9-a925950ec292
0dff403a-48ec-48af-8f9d-f626a2967c04
171e64f1-86f7-490f-837c-902bba59d877
1adb9ff9-a3e6-4a3c-a7a5-4701aacdabfc
1c958db8-fcf5-495b-8fdc-bab9a305a5f2
389e69db-6ab5-4455-a001-bc58e68cd454
49f6e523-4603-46d5-88cb-523e92cbe190
4ac315d8-0532-41ec-a1f0-70d047b1688c
4f137938-9d63-465a-86ab-a38220445b72
4fdb0c7a-89b9-49e4-b24c-3d78edf16214
508939b3-7352-4139-b279-8e71e6231cf2
542fa186-7a26-40ea-aa8f-dcc5c057123e
5bd8faa2-1285-416f-add4-f73e1471f70c
5d319b08-a599-44b6-83ae-049d5232b72e
61975b30-9796-4149-9a7d-9f432a40056c
6534316f-d2fd-44e9-b459-40f88d9f07fc
686e98b6-acfd-4cde-b9cb-6971deb78ce5
7040c064-823e-4cec-9bf2-0dfa2b876681
7c52ff9f-9f24-43a6-898d-3e03ecb598cd
8a58cb4b-ba7d-4ade-bf05-8ab7927babb9
90501836-1241-4c6b-8e55-477467a73126
9833e806-1c6b-4a15-8702-487f497dcf16
a52c7028-08e2-4627-a8d8-55a0142ba3dd
ac4b17e9-97fd-42fa-a210-d96ac77255d7
afcd48e3-10fa-44b1-b3a2-2f4f83b25ac4
b6dd8ec7-520a-4982-8dd8-4b27a0a42983
ba93932e-317b-410d-90f2-c87f6c21aa9f
bc6f7062-4f41-4e1c-95bb-5bc63f57d2ac
c72e100a-630a-4ba3-aaca-a820fee19b20
cc24cf4c-212d-47d5-a896-c5e3a4da6a33
d3355709-cedd-48fe-b894-424b652ac70f
d4f48dc8-41b9-4b4e-904d-94dbd62b819e
db644248-72e1-473c-b656-586eb954ed0b
e9ea6d13-d632-48ce-9451-c19ddfd9f303
eacdf7cf-2653-4d6b-a127-22d05a5bc5df
ecfa6814-872d-477e-8663-48ed78675176
ed9d7c5c-67e9-4882-ab81-71f864256a4a
ff22a848-8730-4e9b-b70d-277f8572dcb2
```

One dedicated `Device` and one dedicated `Employee` were also added. Their pre-existing rows remained unchanged: the device table went from 4 to 5 rows and the employee table from 4 to 5 rows.

## 11. Fixture IDs

- Device: `4581b3bd-ad45-44aa-a810-dfb65c144ce0`
- Employee: `62a36ed5-c978-4f63-b45c-e479028a1bee`
- EmployeeMapping: `72ab9833-1465-49fa-8fec-3404411c2161`
- AttendanceEvent: `bb51f9b9-6d90-4995-a406-b67b1aee4e2c`

## 12. Security / Isolation

- Fixture device and employee IDs were confirmed unused before insertion.
- A new dedicated device isolates the mapping exclusion scope from existing devices.
- Existing attendance events and mappings were neither updated nor repurposed.
- Existing rows across all snapshotted tables matched their full-row hashes before and after fixture creation.
- `SecurityAuditLog` remained at 38 rows; no API mutation or audit-producing operation was invoked.
- No cleanup was performed; the fixture remains in the local database for its intended UAT use.

## 13. Known Limitations

- This report verifies fixture persistence and preconditions only. It does not establish that the P16.7.5 mutation API/UAT paths work.
- No API call, resolver test, mapping CREATE/UPDATE/DEACTIVATE UAT, or attendance processing was run.
- No build, lint, or regression test was run because no code or schema changed.

## 14. Recommendation

**READY FOR P16.7.5** — the dedicated local fixture exists, is internally consistent, is bounded by an active mapping, and passed isolation and exclusion-constraint checks. Stop here and wait for SA review before running any P16.7.5 mutation UAT. P16.7.5 is not declared closed.
