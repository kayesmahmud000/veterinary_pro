import { PrescriptionPdfService } from "./prescription-pdf.service";
import {
  MedicationFormulation,
  MedicationRoute,
} from "@vetralink/shared-types";
import { PrescriptionPdfData } from "./prescription-pdf.service.interface";

describe("PrescriptionPdfService", () => {
  let service: PrescriptionPdfService;

  beforeEach(() => {
    service = new PrescriptionPdfService();
  });

  const basePdfData: PrescriptionPdfData = {
    prescriptionId: "presc-uuid-1234",
    consultationId: "consult-uuid-5678",
    clinicName: "VetraLink Pro Clinical",
    vetName: "Dr. Jane Doe",
    vetLicenseNumber: "VET-LIC-998877",
    farmName: "Green Pastures Dairy",
    farmerName: "John Farmer",
    animalTag: "COW-042",
    animalName: "Bessie",
    animalSpecies: "Bovine (Holstein)",
    diagnosis: "Acute Bronchopneumonia Complex",
    notes: "Patient exhibiting 40C fever and labored breathing.",
    medications: [
      {
        name: "Oxytetracycline 200mg/ml",
        formulation: MedicationFormulation.INJECTABLE,
        route: MedicationRoute.INTRAMUSCULAR,
        dosage: "20 mg/kg",
        frequency: "Once daily",
        durationDays: 5,
        withdrawalDays: 21,
        withdrawalDaysMilk: 7,
        withdrawalDaysMeat: 21,
        instructions: "Inject deep IM in the cervical muscular mass.",
      },
      {
        name: "Flunixin Meglumine",
        formulation: MedicationFormulation.INJECTABLE,
        route: MedicationRoute.INTRAVENOUS,
        dosage: "2.2 mg/kg",
        frequency: "Once daily",
        durationDays: 3,
        withdrawalDays: 4,
        withdrawalDaysMilk: 2,
        withdrawalDaysMeat: 4,
        instructions: "Slow IV injection.",
      },
    ],
    withdrawalDays: 21,
    withdrawalDaysMilk: 7,
    withdrawalDaysMeat: 21,
    digitalSignatureHash:
      "mock-rsa-sha256-digital-signature-hash-string-base64-content",
    signedAt: new Date().toISOString(),
    verifyUrl: "https://app.vetralink.com/verify/prescription/consult-uuid-5678",
  };

  it("should generate a valid PDF buffer with %PDF- header magic bytes", async () => {
    const buffer = await service.generatePrescriptionPdf(basePdfData);

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);

    // PDF magic bytes check
    const header = buffer.subarray(0, 5).toString("utf8");
    expect(header).toBe("%PDF-");
  });

  it("should generate PDF when there are no withdrawal days (0 days)", async () => {
    const dataWithoutWithdrawal: PrescriptionPdfData = {
      ...basePdfData,
      withdrawalDays: 0,
      withdrawalDaysMilk: 0,
      withdrawalDaysMeat: 0,
      medications: [
        {
          name: "Electrolyte Hydration Pack",
          formulation: MedicationFormulation.POWDER,
          route: MedicationRoute.ORAL,
          dosage: "1 sachet in 2L water",
          frequency: "Twice daily",
          durationDays: 3,
          withdrawalDays: 0,
          withdrawalDaysMilk: 0,
          withdrawalDaysMeat: 0,
        },
      ],
    };

    const buffer = await service.generatePrescriptionPdf(
      dataWithoutWithdrawal,
    );

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);
    const header = buffer.subarray(0, 5).toString("utf8");
    expect(header).toBe("%PDF-");
  });

  it("should handle long lists of medications and multi-page pagination", async () => {
    const manyMeds = Array.from({ length: 15 }, (_, i) => ({
      name: `Medication Drug ${i + 1}`,
      formulation: MedicationFormulation.INJECTABLE,
      route: MedicationRoute.INTRAMUSCULAR,
      dosage: `${i + 1} ml`,
      frequency: "Once daily",
      durationDays: 5,
      withdrawalDays: 7,
      instructions: `Special administration instruction for line ${i + 1}`,
    }));

    const dataWithManyMeds: PrescriptionPdfData = {
      ...basePdfData,
      medications: manyMeds,
    };

    const buffer = await service.generatePrescriptionPdf(dataWithManyMeds);

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(2000);
    const header = buffer.subarray(0, 5).toString("utf8");
    expect(header).toBe("%PDF-");
  });
});
