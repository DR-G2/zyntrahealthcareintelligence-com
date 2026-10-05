import { describe, expect, it } from "vitest";
import { generateTemporalTrajectory, runTemporalValidation, validateTemporalTrajectory } from "./temporal";

describe("PIE P2.4 temporal trajectory validation",()=>{
  it("is deterministic",()=>expect(generateTemporalTrajectory(101,"recovery")).toEqual(generateTemporalTrajectory(101,"recovery")));
  it("keeps hidden trajectory truth separate from observed outcomes",()=>{
    const t=generateTemporalTrajectory(202,"gradual_decline");
    expect(t.points.some(p=>p.trueCapability!==Number(p.observedOutcome))).toBe(true);
  });
  it("evaluates all four temporal regimes",()=>{
    const r=runTemporalValidation([11,22]);
    expect(r).toHaveLength(8);
    expect(new Set(r.map(x=>x.kind))).toEqual(new Set(["stable","gradual_decline","sudden_change","recovery"]));
    expect(r.every(x=>Number.isFinite(x.stateRmse)&&x.stateRmse>=0)).toBe(true);
  });
  it("does not manufacture recovery error for non-recovery trajectories",()=>{
    expect(validateTemporalTrajectory(generateTemporalTrajectory(303,"stable")).recoveryFactorError).toBeNull();
  });
  it("keeps change-point detection separate from state estimation",()=>{
    const r=validateTemporalTrajectory(generateTemporalTrajectory(404,"sudden_change"));
    expect(r.changePointAbsoluteError===null||r.changePointAbsoluteError>=0).toBe(true);
  });
  it("does not define a composite temporal winner score",()=>{
    const r=validateTemporalTrajectory(generateTemporalTrajectory(505,"recovery"));
    expect(r).not.toHaveProperty("score"); expect(r).not.toHaveProperty("winner");
  });
});
