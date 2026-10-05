import {
  generateMissingScenario,
  runMissingDataValidation,
  validateMissingData,
} from "./missing-data";

describe("PIE P2.6 missing-data and false-certainty validation",()=>{
  test("keeps missingness separate from the hidden candidate state",()=>{
    const scenario=generateMissingScenario(101,"MCAR");
    expect(scenario.every(o=>o.trueCapability===0.70)).toBe(true);
    expect(scenario.some(o=>o.missing)).toBe(true);
  });

  test("supports MCAR, MAR and MNAR stress conditions",()=>{
    const results=runMissingDataValidation([11,22]);
    expect(results).toHaveLength(6);
    expect(new Set(results.map(r=>r.mechanism))).toEqual(
      new Set(["MCAR","MAR","MNAR"])
    );
  });

  test("does not convert missing observations into incorrect answers",()=>{
    const scenario=generateMissingScenario(303,"MNAR");
    expect(scenario.filter(o=>o.outcome===null).every(o=>o.missing)).toBe(true);
  });

  test("low evidence cannot silently become high confidence",()=>{
    const result=validateMissingData(404,"MCAR");
    expect(["INSUFFICIENT","PRELIMINARY","SUPPORTED"]).toContain(result.evidenceStatus);
    if(result.evidenceStatus==="INSUFFICIENT"){
      expect(result.falseCertainty).toBe(false);
    }
  });

  test("validation is deterministic and has no composite winner",()=>{
    const a=runMissingDataValidation(505);
    const b=runMissingDataValidation(505);
    expect(a).toEqual(b);
    expect("winner" in a).toBe(false);
    expect("score" in a).toBe(false);
  });
});
