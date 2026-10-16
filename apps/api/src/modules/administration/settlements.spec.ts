import { VetPayoutLedgerService } from '../consultations/services/vet-payout-ledger.service';
import { PayoutLedgerEntity } from '../consultations/entities/payout-ledger.entity';
describe('Settlement financial contracts', () => {
  const service = new VetPayoutLedgerService({} as never, {} as never, {} as never);
  it.each([NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid minor units %s', (amount) => {
    expect(() => service.calculateSplit(amount)).toThrow();
    expect(() => PayoutLedgerEntity.create({consultationId:'c',vetId:'v',totalFeeCents:amount})).toThrow();
  });
  it.each([NaN, Infinity])('rejects nonfinite rate %s', (rate) => {
    expect(() => service.calculateSplit(100, rate)).toThrow();
  });
});
