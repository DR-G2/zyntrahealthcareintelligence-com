import {describe,expect,test} from "vitest";
import {makeRandomizedPotentialOutcomes} from "./experiment";
import {recoverRandomizedEffect,measurableOutcome} from "./causal";

describe("PIE P6 causal validation",()=>{
 test("randomized potential outcomes recover the treatment contrast",()=>{
  const d=makeRandomizedPotentialOutcomes(101,200);
  const r=recoverRandomizedEffect(d.treated,d.control);
  expect(r.treatedN+r.controlN).toBe(200);
  expect(r.absoluteError).toBeLessThan(.06);
 });
 test("outcome integrity requires a measurable completed outcome",()=>{
  expect(measurableOutcome({
   interventionId:"i",userId:"u",outcomeType:"NOVEL_TRANSFER",
   baselineValue:.5,completed:true,outcomeQuality:1,
   transferValue:.7,measuredAt:new Date().toISOString(),sourceObservationIds:[]
  })).toBe(true);
  expect(measurableOutcome({
   interventionId:"i",userId:"u",outcomeType:"NOVEL_TRANSFER",
   baselineValue:.5,completed:true,outcomeQuality:0,
   measuredAt:new Date().toISOString(),sourceObservationIds:[]
  })).toBe(false);
 });
});
