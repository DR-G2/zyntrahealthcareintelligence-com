import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_study_profile",
  title: "Get study profile",
  description:
    "Get the signed-in candidate's AMC study profile: exam stage, exam target, exam date, AMC1 score and declared weak areas.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "name, email, exam_stage, exam_target, exam_date, exam_location, amc1_score, amc2_booking_status, country_of_graduation, medical_college, graduation_year, weak_areas, onboarding_complete",
      )
      .eq("id", ctx.getUserId() ?? "")
      .maybeSingle();

    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("No profile found for this account.");

    const profile = {
      name: data.name ?? null,
      email: data.email ?? null,
      examStage: data.exam_stage ?? null,
      examTarget: data.exam_target ?? null,
      examDate: data.exam_date ?? null,
      examLocation: data.exam_location ?? null,
      amc1Score: data.amc1_score ?? null,
      amc2BookingStatus: data.amc2_booking_status ?? null,
      countryOfGraduation: data.country_of_graduation ?? null,
      medicalCollege: data.medical_college ?? null,
      graduationYear: data.graduation_year ?? null,
      weakAreas: (data.weak_areas ?? []).map((area) => area),
      onboardingComplete: data.onboarding_complete ?? false,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
      structuredContent: { profile },
    };
  },
});
