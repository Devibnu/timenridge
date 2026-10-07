import { PrismaClient } from '@timebridge/database';
import { BatchTransportEngine } from '@timebridge/attendance-engine/dist/transport/BatchTransportEngine';
import { SftpAdapter } from '@timebridge/attendance-engine/dist/transport/sftp/SftpAdapter';

import { RawAttendanceCollector } from '@timebridge/attendance-engine/dist/collector/RawAttendanceCollector';
import { DeviceAdapterRegistry } from '@timebridge/device-adapters/dist/registry';
import { MockDeviceAdapter } from '@timebridge/device-adapters/dist/adapters/MockDeviceAdapter';
import { OutboxPublisher } from './apps/scheduler/src/OutboxPublisher';
import { QueueService, WorkerService } from '@timebridge/queue';
import { AttendanceNormalizer } from '@timebridge/attendance-engine/dist/normalizer/AttendanceNormalizer';
import { AttendanceCycleEngine } from '@timebridge/attendance-engine/dist/cycle/AttendanceCycleEngine';
import { AttendanceBatchEngine } from '@timebridge/attendance-engine/dist/batch/AttendanceBatchEngine';
import { MockSAPProcessingAdapter } from '@timebridge/attendance-engine/dist/processing/MockSAPProcessingAdapter';

async function runFinalGates() {
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
  await prisma.shiftRule.deleteMany();
  await prisma.employeeShiftAssignment.deleteMany();
  await prisma.shift.deleteMany();

  console.log('\n--- 1. SEED DATA WITH COMPLETE MAPPINGS AND SHIFTS ---');
  DeviceAdapterRegistry.register('MOCK', MockDeviceAdapter as unknown);

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
    data: {
      device_id: device.id,
      device_employee_id: '100',
      employee_id: employee.id,
      sap_employee_id: 'SAP-100',
      valid_from: new Date('2020-01-01'),
    },
  });

  const shift = await prisma.shift.create({
    data: {
      shift_code: 'MORNING',
      name: 'Morning Shift',
      start_time: '08:00:00',
      end_time: '17:00:00',
    },
  });

  await prisma.shiftRule.create({
    data: {
      shift_id: shift.id,
      late_in_minutes: 15,
    },
  });

  await prisma.employeeShiftAssignment.create({
    data: {
      employee_id: employee.id,
      shift_id: shift.id,
      effective_from: new Date('2020-01-01'),
      effective_to: new Date('2099-12-31'),
    },
  });

  console.log('\n--- 2. COLLECTION & OUTBOX ---');
  await RawAttendanceCollector.collect(device.id);

  console.log('\n--- 3. BULLMQ & WORKER (CANONICAL) ---');
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

  let canonicalEvent = await prisma.attendanceEvent.findFirst();
  canonicalEvent = await prisma.attendanceEvent.update({
    where: { id: canonicalEvent!.id },
    data: { event_type: 'IN' },
  });

  console.log('\n--- 3.3 MAPPING RESOLUTION ---');
  const mappingResolver = new EmployeeMappingResolver();
  await mappingResolver.resolve(canonicalEvent!.id);

  console.log('\n--- 3.5 RULE ENGINE ---');
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

  console.log('\n=======================================');
  console.log('TASK 1 — TRANSPORT RUNTIME (REAL SFTP)');
  console.log('=======================================');
  try {
    const sftpConfig = {
      host: 'localhost',
      port: 2222,
      username: 'testuser',
      password: 'testpassword',
      remoteBasePath: '/upload',
      timeout: 2000,
    };
    const sftpAdapter = new SftpAdapter(sftpConfig);
    const transportEngine = new BatchTransportEngine(prisma, sftpAdapter as unknown);
    await transportEngine.transportBatch(batchIdentity);
  } catch (error: unknown) {
    console.log('TRANSPORT RUNTIME STATUS: NOT_AVAILABLE');
    console.log(`REASON: ${(error as Error).message}`);
  }

  // Fallback to update status since SFTP failed so we can test ACK
  await prisma.attendanceBatch.update({
    where: { batch_identity: batchIdentity },
    data: { status: 'UPLOADED' },
  });

  console.log('\n--- 7. MOCK SAP / ACKNOWLEDGEMENT ---');
  const mockSap = new MockSAPProcessingAdapter();
  const correlationId = `CORR-${Date.now()}`;

  const ack = await mockSap.acknowledge({
    correlationId,
    batchIdentity,
    status: 'PROCESSED',
    timestamp: new Date(),
    recordResults: [
      {
        sapEmployeeId: 'SAP-100',
        status: 'SUCCESS',
      },
    ],
  });

  await prisma.attendanceBatchAcknowledgement.create({
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

  console.log('\n=======================================');
  console.log('TASK 2 — RECONCILIATION EVIDENCE');
  console.log('=======================================');
  const { ReconciliationService } =
    await import('@timebridge/attendance-engine/dist/reconciliation/ReconciliationService');
  try {
    const reconService = new ReconciliationService(prisma);
    const trace = await reconService.getEventTrace(canonicalEvent!.id);
    console.log(JSON.stringify(trace, null, 2));
  } catch (error) {
    console.error('Error fetching reconciliation trace:', (error as Error).message);
  }

  await worker.close();
  await queueService.close();
  await prisma.$disconnect();
}

runFinalGates().catch(console.error);
