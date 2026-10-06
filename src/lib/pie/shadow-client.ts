import { supabase } from "@/lib/supabase";

export async function syncPieEngine(): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("pie-shadow-sync", {
      body: {},
    });

    if (error) {
      console.warn("[PIE] sync failed", error);
      return;
    }

    if (!["completed", "no_new_observations", "inference_pending"].includes(data?.status)) {
      console.warn("[PIE] unexpected response", data?.status);
    }
  } catch (error) {
    console.warn("[PIE] sync failed", error);
  }
}
