/**
 * Fasad pengaturan toko — Supabase (production) atau in-memory (demo).
 */
import { isDemoMode } from "@/lib/app-mode";
import * as demo from "@/lib/demo/settings";
import * as production from "@/lib/supabase/settings";

export {
  RECEIPT_PAPER_OPTIONS,
  type ReceiptPaper,
  type StoreSettingsRow,
  type StoreSettingsUpdate,
} from "@/lib/supabase/settings";

export function getStoreSettings(): Promise<
  import("@/lib/supabase/settings").StoreSettingsRow
> {
  return isDemoMode() ? demo.getStoreSettings() : production.getStoreSettings();
}

export function updateStoreSettings(
  input: import("@/lib/supabase/settings").StoreSettingsUpdate
): Promise<import("@/lib/supabase/settings").StoreSettingsRow> {
  return isDemoMode()
    ? demo.updateStoreSettings(input)
    : production.updateStoreSettings(input);
}
