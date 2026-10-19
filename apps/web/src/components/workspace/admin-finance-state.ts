import type { AdminSettlementRow } from "@vetralink/shared-types";

export function refreshSelectedSettlements(
  selected: AdminSettlementRow[],
  current: AdminSettlementRow[],
): AdminSettlementRow[] {
  return selected.flatMap((previous) => {
    const latest = current.find((row) => row.id === previous.id);
    return latest ? [latest] : [];
  });
}
