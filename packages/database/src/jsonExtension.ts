import { Prisma } from '@prisma/client';

const jsonFieldsMap: Record<string, string[]> = {
  AttendanceRawEvent: ['raw_payload'],
  AttendanceRuleResult: ['input_data'],
  AuditLog: ['before', 'after'],
  ProcessingLog: ['error_details'],
  SecurityAuditLog: ['metadata'],
  AttendanceBatchRecord: ['payload'],
  AttendanceBatchAcknowledgement: ['payload'],
  SapResponse: ['response_payload'],
};

function stringifyJsonFields(modelName: string, data: any) {
  if (!data || typeof data !== 'object') return;
  const fields = jsonFieldsMap[modelName];
  if (!fields) return;

  for (const field of fields) {
    if (data[field] !== undefined && data[field] !== null) {
      if (typeof data[field] !== 'string') {
        data[field] = JSON.stringify(data[field]);
      }
    }
  }
}

export const jsonExtension = Prisma.defineExtension({
  name: 'sqlite-json',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const argsAny = args as any;
        if (argsAny && argsAny.data) {
          if (Array.isArray(argsAny.data)) {
            argsAny.data.forEach((d: any) => stringifyJsonFields(model, d));
          } else {
            stringifyJsonFields(model, argsAny.data);
          }
        }

        // Handle nested create/update
        if (args && (args as any).create) {
           stringifyJsonFields(model, (args as any).create);
        }
        if (args && (args as any).update) {
           stringifyJsonFields(model, (args as any).update);
        }

        const result = await query(args);
        return result;
      },
    },
  },
  result: {
    attendanceRawEvent: {
      raw_payload: {
        compute(data: any) {
          return data.raw_payload ? JSON.parse(data.raw_payload as any) : data.raw_payload;
        },
      },
    },
    attendanceRuleResult: {
      input_data: {
        compute(data: any) {
          return data.input_data ? JSON.parse(data.input_data as any) : data.input_data;
        },
      },
    },
    auditLog: {
      before: {
        compute(data: any) {
          return data.before ? JSON.parse(data.before as any) : data.before;
        },
      },
      after: {
        compute(data: any) {
          return data.after ? JSON.parse(data.after as any) : data.after;
        },
      },
    },
    processingLog: {
      error_details: {
        compute(data: any) {
          return data.error_details ? JSON.parse(data.error_details as any) : data.error_details;
        },
      },
    },
    securityAuditLog: {
      metadata: {
        compute(data: any) {
          return data.metadata ? JSON.parse(data.metadata as any) : data.metadata;
        },
      },
    },
    attendanceBatchRecord: {
      payload: {
        compute(data: any) {
          return data.payload ? JSON.parse(data.payload as any) : data.payload;
        },
      },
    },
    attendanceBatchAcknowledgement: {
      payload: {
        compute(data: any) {
          return data.payload ? JSON.parse(data.payload as any) : data.payload;
        },
      },
    },
    sapResponse: {
      response_payload: {
        compute(data: any) {
          return data.response_payload ? JSON.parse(data.response_payload as any) : data.response_payload;
        },
      },
    },
  }
});
