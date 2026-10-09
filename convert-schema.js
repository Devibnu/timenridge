const fs = require('fs');

let schema = fs.readFileSync('packages/database/prisma/schema.prisma', 'utf8');

// Provider
schema = schema.replace('provider = "postgresql"', 'provider = "sqlite"');

// Remove Enums
schema = schema.replace(/enum \w+ \{[\s\S]*?\}/g, '');

// Replace Enum types
const enums = [
  'DeviceStatus', 'DeviceLifecycleStatus', 'EventType', 'EventStatus',
  'CycleStatus', 'BatchStatus', 'FileStatus', 'UserRole', 'UserStatus',
  'AuditAction', 'BatchRecordStatus'
];
for (const e of enums) {
  const regex = new RegExp(`\\b${e}\\b`, 'g');
  schema = schema.replace(regex, 'String');
}

// Replace Json types
schema = schema.replace(/\bJson\b/g, 'String');

// Remove @db.Date
schema = schema.replace(/@db\.Date/g, '');

// Save back
fs.writeFileSync('packages/database/prisma/schema.prisma', schema);
console.log('Schema converted');
