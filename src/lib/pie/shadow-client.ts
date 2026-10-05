import { supabase } from "@/lib/supabase";

export async function syncPieShadow(): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("pie-shadow-sync", {
      body: {},
    });

    if (error) {
      console.warn("[PIE shadow] sync failed", error);
      return;
    }

    if (!["completed", "no_new_observations", "normalized_inference_pending"].includes(data?.status)) {
      console.warn("[PIE shadow] unexpected response", data?.status);
    }
  } catch (error) {
    console.warn("[PIE shadow] sync failed", error);
  }
}
