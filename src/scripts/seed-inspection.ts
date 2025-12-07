import { DataSource } from 'typeorm';
import { dataSource } from '../data-source';
import { InspectionDetailEntity, ActiveStatus, PartStatus, SupplierEditStatus } from '../inspection-detail/entities/inspection-detail.entity';
import { InspectionItemEntity } from '../inspection-detail/entities/inspection-item.entity';
import { InspectionSpecialRequestEntity, SpecialRequestStatus } from '../inspection-detail/entities/inspection-special-request.entity';
import { SampleDataSheetEntity } from '../sample-data-sheet/entities/sample-data-sheet.entity';
import { SampleDataSheetRowEntity } from '../sample-data-sheet/entities/sample-data-sheet-row.entity';
import { SampleDataSheetRowSampleEntity } from '../sample-data-sheet/entities/sample-data-sheet-row-sample.entity';
import { SampleDataSheetApprovalEntity, SdsApprovalAction, SdsApprovalRole, SdsDocumentType } from '../sample-data-sheet/entities/sample-data-sheet-approval.entity';

function randomFrom<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomString(len = 6) { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'; return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
function randomWord() { const words = ['Bolt', 'Nut', 'Washer', 'Gear', 'Shaft', 'Valve', 'Seal', 'Bracket', 'Clamp', 'Cover', 'Plate', 'Hub']; return randomFrom(words); }

async function seedInspections(ds: DataSource, count: number): Promise<InspectionDetailEntity[]> {
  console.log(`Seeding ${count} inspection details (with items & special requests)...`);
  const detailRepo = ds.getRepository(InspectionDetailEntity);
  const itemRepo = ds.getRepository(InspectionItemEntity);
  const specialRepo = ds.getRepository(InspectionSpecialRequestEntity);

  const createdDetails: InspectionDetailEntity[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const supplierCode = `SUP-${randomString(4)}`;
    const partNo = `PN-${randomString(8)}`;

    // Random due date: 40% past (delayed), 30% near future, 30% far future
    const daysOffset = Math.random() < 0.4 
      ? -randomInt(1, 30)  // Past (delayed)
      : Math.random() < 0.5
        ? randomInt(1, 7)   // Near future
        : randomInt(8, 60); // Far future
    
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + daysOffset);

    const detail = detailRepo.create({
      supplierCode,
      supplierName: `Supplier ${randomString(3)}`,
      partNo,
      partName: `${randomWord()} ${randomWord()}`,
      model: `M-${randomString(4)}`,
      partStatus: PartStatus.Active,
      supplierEditStatus: SupplierEditStatus.Locked,
      dueDate,
      activeRow: ActiveStatus.YES,
      sdsCreated: false,
    });

    const savedDetail = await detailRepo.save(detail);
    createdDetails.push(savedDetail);

    // Items
    const items: InspectionItemEntity[] = [];
    const itemCount = randomInt(5, 15);
    // const itemCount = 100;
    for (let j = 0; j < itemCount; j++) {
      const item = itemRepo.create({
        inspectionDetailId: savedDetail.id,
        no: j + 1,
        measuringItem: `Measuring ${j + 1}`,
        specification: (10 + Math.random() * 90).toFixed(2),
        tolerancePlus: (Math.random() * 2).toFixed(2),
        toleranceMinus: (Math.random() * 2).toFixed(2),
        inspectionInstrument: randomFrom(['Caliper', 'Micrometer', 'Gauge', 'CMM']),
        rank: randomFrom(['A', 'B', 'C']) as any,
      });
      items.push(item);
    }
    await itemRepo.save(items);

    // Optional special request per detail
    if (Math.random() < 0.4) {
      const chosenItemIds = items.filter(() => Math.random() < 0.4).map(it => it.id);
      const special = specialRepo.create({
        inspectionDetailId: savedDetail.id,
        specialRequestItems: JSON.stringify(chosenItemIds),
        qty: randomInt(1, 10),
        cpCpk: '1.33',
        dueDate: new Date(now.getFullYear(), now.getMonth(), 28),
        status: SpecialRequestStatus.Pending,
        comments: 'Auto-generated special request',
        activeRow: ActiveStatus.YES,
        createdBy: null,
        updatedBy: null,
      });
      await specialRepo.save(special);
    }

    if ((i + 1) % 10 === 0) {
      console.log(`Inspection ${i + 1}/${count} created`);
    }
  }

  return createdDetails;
}

async function seedSds(ds: DataSource, inspectionDetails: InspectionDetailEntity[], maxSheetsPerDetail: number) {
  console.log(`Seeding SDS data (sheets, rows, samples, approvals)...`);
  const sheetRepo = ds.getRepository(SampleDataSheetEntity);
  const rowRepo = ds.getRepository(SampleDataSheetRowEntity);
  const sampleRepo = ds.getRepository(SampleDataSheetRowSampleEntity);
  const approvalRepo = ds.getRepository(SampleDataSheetApprovalEntity);

  const now = new Date();

  for (const detail of inspectionDetails) {
    const sheetCount = randomInt(0, maxSheetsPerDetail);
    
    // 30% chance to skip SDS creation entirely (will show as delayed if past due_date)
    const skipSds = Math.random() < 0.3;
    if (skipSds) continue;
    
    for (let i = 0; i < sheetCount; i++) {
      // Random SDR date: can be before or after due_date
      const sdrDaysOffset = Math.random() < 0.5
        ? -randomInt(1, 15)  // Before due date (early submission)
        : randomInt(1, 20);   // After due date (delayed submission)
      
      const sdrDate = new Date(detail.dueDate);
      sdrDate.setDate(sdrDate.getDate() + sdrDaysOffset);

      const sheet = sheetRepo.create({
        supplier: detail.supplierCode,
        partNo: detail.partNo,
        partName: detail.partName,
        model: detail.model,
        inspectionDetailId: detail.id,
        production082025: randomFrom(['Yes', 'No'] as const),
        sdrDate,
        aisFile: null,
        sdrFile: null,
        sdrReportFile: null,
        loop: 1,
        remark: 'Auto-generated SDS',
      });
      const savedSheet = await sheetRepo.save(sheet);

      // Mark inspection detail as having SDS created
      await ds.getRepository(InspectionDetailEntity).update(detail.id, {
        sdsCreated: true,
        partStatus: PartStatus.Active,
        supplierEditStatus: SupplierEditStatus.Locked,
      });

      // rows
      const rows: SampleDataSheetRowEntity[] = [];
        const rowCount = randomInt(5, 15);
        // const rowCount = 100;
      for (let r = 0; r < rowCount; r++) {
        const row = rowRepo.create({
          sampleDataSheetId: savedSheet.id,
          no: r + 1,
          measuringItem: `Characteristic ${r + 1}`,
          specification: (10 + Math.random() * 90).toFixed(2),
          rank: randomFrom(['A', 'B', 'C']),
          inspectionInstrument: randomFrom(['Caliper', 'Micrometer', 'Gauge', 'CMM']),
          remark: null,
          tolerancePlus: randomInt(1, 3),
          toleranceMinus: randomInt(1, 3),
          sampleQty: 5,
          judgement: randomFrom(['OK', 'NG']),
          xBar: null,
          r: null,
          cp: null,
          cpk: null,
        });
        rows.push(row);
      }
      const savedRows = await rowRepo.save(rows);

      // samples per row
      const allSamples: SampleDataSheetRowSampleEntity[] = [];
      for (const row of savedRows) {
        for (let s = 0; s < row.sampleQty; s++) {
          const sample = sampleRepo.create({
            sampleDataSheetRowId: row.id,
            no: s + 1,
            value: Number((10 + Math.random() * 90).toFixed(2)),
          });
          allSamples.push(sample);
        }
      }
      await sampleRepo.save(allSamples);

      // approvals: 70% approved, 30% skip approval (pending)
      if (Math.random() < 0.7) {
        // Random approval date: can be same day or few days after sdr_date
        const approvalDate = new Date(savedSheet.sdrDate);
        approvalDate.setDate(approvalDate.getDate() + randomInt(0, 5));
        
        const approval = approvalRepo.create({
          sampleDataSheetId: savedSheet.id,
          loop: savedSheet.loop,
          action: SdsApprovalAction.APPROVED,
          role: SdsApprovalRole.APPROVER,
          documentType: SdsDocumentType.SDS,
          actionByUserId: 1,
          remark: 'Auto-approved for seed',
          reSubmitDate: null,
          partNo: detail.partNo,
          sdsMonthYear: `${String(savedSheet.sdrDate.getMonth() + 1).padStart(2, '0')}-${savedSheet.sdrDate.getFullYear()}`,
        });
        approval.actionDate = approvalDate;
        await approvalRepo.save(approval);
      }
    }
  }
}

async function run() {
  await dataSource.initialize();
  try {
    const inspectionCount = Number(process.env.SEED_INSPECTION_COUNT || 100);
    const maxSheetsPerDetail = Number(process.env.SEED_MAX_SHEETS_PER_DETAIL || 5);

    const details = await seedInspections(dataSource, inspectionCount);
    await seedSds(dataSource, details, maxSheetsPerDetail);

    console.log('All seed tasks completed.');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await dataSource.destroy();
  }
}

run();
