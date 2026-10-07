import { PrismaClient } from '@timebridge/database';
import { RawAttendanceCollector } from '@timebridge/attendance-engine/dist/collector/RawAttendanceCollector';
import { DeviceAdapterRegistry } from '@timebridge/device-adapters/dist/registry';
import { MockDeviceAdapter } from '@timebridge/device-adapters/dist/adapters/MockDeviceAdapter';
import { OutboxPublisher } from './apps/scheduler/src/OutboxPublisher';
import { QueueService, WorkerService } from '@timebridge/queue';
import { AttendanceNormalizer } from '@timebridge/attendance-engine/dist/normalizer/AttendanceNormalizer';
import { AttendanceCycleEngine } from '@timebridge/attendance-engine/dist/cycle/AttendanceCycleEngine';
import { AttendanceBatchEngine } from '@timebridge/attendance-engine/dist/batch/AttendanceBatchEngine';
import { BatchTransportEngine } from '@timebridge/attendance-engine/dist/transport/BatchTransportEngine';
import { MockSAPProcessingAdapter } from '@timebridge/attendance-engine/dist/processing/MockSAPProcessingAdapter';
import { ReconciliationService } from '@timebridge/attendance-engine/dist/reconciliation/ReconciliationService';

// Basic Mock Transport Adapter for E2E
class E2EMockTransportAdapter {
  async connect() {}
  async disconnect() {}
  async testConnection() {}
  async exists() {
    return false;
  }
  async download() {}
  async checksum() {
    return 'checksum123';
  }
  async upload(request: Record<string, unknown>) {
    return {
      success: true,
      uploadedPath: `/mock-sftp/${request.filename}`,
      bytesWritten: (request.content as string).length,
    };
  }
}

async function runE2E() {
  DeviceAdapterRegistry.register('MOCK', MockDeviceAdapter as unknown);
  const prisma = new PrismaClient();
  await prisma.$connect();

  console.log('\n--- CLEANUP ---');
  await prisma.attendanceRuleResult.deleteMany();
  await prisma.attendanceBatchRecord.deleteMany();
  await prisma.attendanceBatchAcknowledgement.deleteMany();
  await prisma.attendanceBatch.deleteMany();
  await prisma.attendanceCycle.deleteMany();
  await prisma.attendanceEvent.deleteMany();
  await prisma.attendanceRawEvent.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.employeeMapping.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.device.deleteMany();

  console.log('\n--- 1. SEED DATA ---');
  const device = await prisma.device.create({
    data: {
      device_code: 'P16-E2E-FULL',
      name: 'E2E Full',
      vendor: 'MOCK',
      protocol: 'MOCK',
      host: 'localhost',
      is_active: true,
      status: 'ONLINE',
    },
  });
  const employee = await prisma.employee.create({
    data: { internal_id: '100', name: 'E2E Employee' },
  });
  await prisma.employeeMapping.create({
    data: { device_id: device.id, device_employee_id: '100', employee_id: employee.id },
  });

  console.log('\n--- 2. COLLECTION & OUTBOX ---');
  await RawAttendanceCollector.collect(device.id);
  const rawEvent = await prisma.attendanceRawEvent.findFirst();
  const outboxEvent = await prisma.outboxEvent.findFirst();

  console.log('\n--- 3. BULLMQ & WORKER (CANONICAL + RULE) ---');
  const queueService = new QueueService('attendance-raw-events');
  const publisher = new OutboxPublisher(prisma, queueService);
  await publisher.publishPendingEvents();

  const normalizer = new AttendanceNormalizer();
  let workerProcessed = false;
  const worker = new WorkerService('attendance-raw-events', 'e2e-worker', async (job) => {
    if (job.data?.raw_event_id) {
      await normalizer.normalizeBatch([job.data.raw_event_id]);
      workerProcessed = true;
      return { success: true };
    }
  });

  // Wait for worker to finish
  let retries = 0;
  while (!workerProcessed && retries < 10) {
    await new Promise((r) => setTimeout(r, 500));
    retries++;
  }

  const canonicalEvent = await prisma.attendanceEvent.findFirst({ include: { employee: true } });

  console.log('\n--- 3.5 RULE ENGINE ---');
  const { AttendanceRuleEngine } =
    await import('@timebridge/attendance-engine/dist/rules/AttendanceRuleEngine');
  const ruleEngine = new AttendanceRuleEngine(prisma);
  await ruleEngine.evaluateEvent(canonicalEvent!.id);

  const finalCanonicalEvent = await prisma.attendanceEvent.findFirst({
    include: { rule_results: true },
  });

  console.log('\n--- 4. ATTENDANCE CYCLE ---');
  const cycleEngine = new AttendanceCycleEngine(prisma);
  const businessDate = new Date(finalCanonicalEvent!.event_timestamp);
  businessDate.setHours(0, 0, 0, 0);

  await cycleEngine.generateCycles(employee.id, businessDate, [finalCanonicalEvent as unknown]);
  const cycle = await prisma.attendanceCycle.findFirst();

  console.log('\n--- 5. SAP BATCH PREPARATION ---');
  const batchEngine = new AttendanceBatchEngine(prisma);
  const batchIdentity = `BATCH-E2E-${Date.now()}`;
  const batchResult = await batchEngine.prepareBatch([cycle as unknown], batchIdentity);

  console.log('\n--- 6. TRANSPORT (SFTP/MOCK) ---');
  const transportAdapter = new E2EMockTransportAdapter();
  const transportEngine = new BatchTransportEngine(prisma, transportAdapter as unknown);
  await transportEngine.transportBatch(batchIdentity);
  const batchAfterTransport = await prisma.attendanceBatch.findUnique({
    where: { batch_identity: batchIdentity },
  });

  console.log('\n--- 7. MOCK SAP / ACKNOWLEDGEMENT ---');
  const mockSap = new MockSAPProcessingAdapter();
  const correlationId = `CORR-${Date.now()}`;

  // Simulate SAP processing the payload and replying
  const ack = await mockSap.acknowledge({
    correlationId,
    batchIdentity,
    status: 'PROCESSED',
    timestamp: new Date(),
    recordResults: [
      {
        sapEmployeeId: employee.id, // actually sap_employee_id if exists
        status: 'SUCCESS',
      },
    ],
  });

  // Save ack to DB manually or if there's a service for it
  const dbAck = await prisma.attendanceBatchAcknowledgement.create({
    data: {
      batch_id: batchResult.batchId,
      correlation_id: ack.correlationId,
      status: ack.status,
      payload: ack.rawPayload as Record<string, unknown>,
    },
  });

  await prisma.attendanceBatch.update({
    where: { id: batchResult.batchId },
    data: { status: 'PROCESSED' },
  });

  console.log('\n--- 8. RECONCILIATION ---');
  const reconService = new ReconciliationService(prisma);
  await reconService.getEventTrace(canonicalEvent!.id);

  console.log('\n--- RESULTS SUMMARY ---');
  console.log({
    device_id: device.id,
    raw_event_id: rawEvent?.id,
    outbox_event_id: outboxEvent?.id,
    canonical_event_id: finalCanonicalEvent?.id,
    rule_result_id: finalCanonicalEvent?.rule_results[0]?.id,
    attendance_cycle_id: cycle?.id,
    batch_id: batchResult.batchId,
    batch_identity: batchResult.batchIdentity,
    correlation_id: dbAck.correlation_id,
    acknowledgement_id: dbAck.id,
    transport_status: batchAfterTransport?.status,
    final_batch_status: ack.status,
  });

  console.log('\n--- CLEANUP ---');
  await worker.close();
  await queueService.close();
  await prisma.$disconnect();
}

runE2E().catch(console.error);
