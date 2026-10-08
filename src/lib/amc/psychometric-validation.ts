/**
 * Independent AMC psychometric validation harness.
 *
 * This implementation is intentionally separate from PIE and the CAT simulator.
 * It is a validation implementation, not AMC's proprietary scoring algorithm.
 *
 * Model: Rasch/1PL item calibration with independent Newton updates.
 * Validation: candidate-level holdout metrics for a synthetic/approved dataset.
 */

export interface ValidationAttempt {
  candidateId: string;
  questionId: string;
  response: 0 | 1;
  itemStatus?: "CALIBRATED" | "NEW";
}

export interface CalibrationResult {
  theta: Record<string, number>;
  difficulty: Record<string, number>;
  iterations: number;
  converged: boolean;
}

export interface HoldoutMetrics {
  n: number;
  spearmanThetaVsTruth: number | null;
  brier: number;
  auc: number | null;
  ece: number;
  logLoss: number;
}

export interface ValidationDataset {
  datasetId: string;
  approvedForValidation: boolean;
  independentCalibration: boolean;
  attempts: ValidationAttempt[];
  candidateTruth: Record<string, { theta: number; passed: boolean }>;
}

export interface PromotionCriteria {
  minCandidates: number;
  minHoldoutCandidates: number;
  minSpearman: number;
  maxBrier: number;
  minAuc: number;
  maxEce: number;
  maxLogLoss: number;
}

export const DEFAULT_PROMOTION_CRITERIA: PromotionCriteria = {
  minCandidates: 1000,
  minHoldoutCandidates: 200,
  minSpearman: 0.75,
  maxBrier: 0.18,
  minAuc: 0.75,
  maxEce: 0.05,
  maxLogLoss: 0.60,
};

const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
const sigmoid=(x:number)=>1/(1+Math.exp(-clamp(x,-35,35)));

function rank(values:number[]):number[]{
  const order=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v);
  const out=Array(values.length);
  let i=0;
  while(i<order.length){
    let j=i+1;
    while(j<order.length && order[j].v===order[i].v)j++;
    const r=(i+j-1)/2+1;
    for(let k=i;k<j;k++)out[order[k].i]=r;
    i=j;
  }
  return out;
}

function pearson(a:number[],b:number[]):number|null{
  if(a.length<2)return null;
  const ma=a.reduce((s,x)=>s+x,0)/a.length, mb=b.reduce((s,x)=>s+x,0)/b.length;
  let num=0,da=0,db=0;
  for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;num+=x*y;da+=x*x;db+=y*y;}
  return da&&db?num/Math.sqrt(da*db):null;
}

export function spearman(a:number[],b:number[]):number|null{
  if(a.length!==b.length||a.length<2)return null;
  return pearson(rank(a),rank(b));
}

/** Independent Rasch calibration. Missing adaptive cells are simply omitted. */
export function calibrateRasch(
  attempts: ValidationAttempt[],
  options:{maxIterations?:number;tol?:number}={}
):CalibrationResult{
  const maxIterations=options.maxIterations??80,tol=options.tol??1e-4;
  const candidates=[...new Set(attempts.map(a=>a.candidateId))];
  const items=[...new Set(attempts.map(a=>a.questionId))];
  const theta=Object.fromEntries(candidates.map(id=>[id,0])) as Record<string,number>;
  const difficulty=Object.fromEntries(items.map(id=>[id,0])) as Record<string,number>;
  let converged=false,iterations=0;

  for(iterations=1;iterations<=maxIterations;iterations++){
    let maxDelta=0;
    for(const cid of candidates){
      const rows=attempts.filter(a=>a.candidateId===cid);
      if(rows.length<3)continue;
      let score=rows.reduce((s,a)=>s+a.response,0);
      let t=theta[cid];
      for(let k=0;k<4;k++){
        let pSum=0,info=0;
        for(const a of rows){const p=sigmoid(t-difficulty[a.questionId]);pSum+=p;info+=p*(1-p);}
        const step=(score-pSum)/Math.max(info,0.05);
        t=clamp(t+step,-4,4);
      }
      maxDelta=Math.max(maxDelta,Math.abs(t-theta[cid]));theta[cid]=t;
    }
    for(const qid of items){
      const rows=attempts.filter(a=>a.questionId===qid);
      if(rows.length<10)continue;
      const score=rows.reduce((s,a)=>s+a.response,0);
      let b=difficulty[qid];
      for(let k=0;k<4;k++){
        let pSum=0,info=0;
        for(const a of rows){const p=sigmoid(theta[a.candidateId]-b);pSum+=p;info+=p*(1-p);}
        const step=(pSum-score)/Math.max(info,0.05);
        b=clamp(b+step,-4,4);
      }
      maxDelta=Math.max(maxDelta,Math.abs(b-difficulty[qid]));difficulty[qid]=b;
    }
    const mean=items.reduce((s,q)=>s+difficulty[q],0)/Math.max(items.length,1);
    for(const qid of items)difficulty[qid]-=mean;
    if(maxDelta<tol){converged=true;break;}
  }
  return {theta,difficulty,iterations,converged};
}

function auc(labels:boolean[],scores:number[]):number|null{
  const pos=scores.filter((_,i)=>labels[i]).length,neg=labels.length-pos;
  if(!pos||!neg)return null;
  const pairs=scores.map((s,i)=>({s,y:labels[i]})).sort((a,b)=>a.s-b.s);
  let rankSum=0;
  for(let i=0;i<pairs.length;i++)if(pairs[i].y)rankSum+=i+1;
  return (rankSum-pos*(pos+1)/2)/(pos*neg);
}

function ece(labels:boolean[],probs:number[],bins=10):number{
  let total=0;
  for(let b=0;b<bins;b++){
    const lo=b/bins,hi=(b+1)/bins;
    const idx=probs.map((p,i)=>({p,i})).filter(x=>x.p>=lo&&(b===bins-1?x.p<=hi:x.p<hi)).map(x=>x.i);
    if(!idx.length)continue;
    const acc=idx.reduce((s,i)=>s+(labels[i]?1:0),0)/idx.length;
    const conf=idx.reduce((s,i)=>s+probs[i],0)/idx.length;
    total+=(idx.length/labels.length)*Math.abs(acc-conf);
  }
  return total;
}

export function evaluateHoldout(
  calibration:CalibrationResult,
  truth:Record<string,{theta:number;passed:boolean}>,
  holdoutIds:string[],
):HoldoutMetrics{
  const rows=holdoutIds.filter(id=>truth[id]&&calibration.theta[id]!==undefined);
  const trueTheta=rows.map(id=>truth[id].theta);
  const estimated=rows.map(id=>calibration.theta[id]);
  const labels=rows.map(id=>truth[id].passed);
  const probs=estimated.map(sigmoid);
  const brier=probs.reduce((s,p,i)=>s+(p-(labels[i]?1:0))**2,0)/Math.max(rows.length,1);
  const logLoss=-probs.reduce((s,p,i)=>s+(labels[i]?Math.log(Math.max(p,1e-12)):Math.log(Math.max(1-p,1e-12))),0)/Math.max(rows.length,1);
  return {n:rows.length,spearmanThetaVsTruth:spearman(estimated,trueTheta),brier,auc:auc(labels,probs),ece:ece(labels,probs),logLoss};
}

export function evaluatePromotionGate(
  dataset:ValidationDataset,
  metrics:HoldoutMetrics,
  criteria:PromotionCriteria=DEFAULT_PROMOTION_CRITERIA,
):{eligible:boolean;reasons:string[]}{
  const reasons:string[]=[];
  const nCandidates=Object.keys(dataset.candidateTruth).length;
  if(!dataset.approvedForValidation)reasons.push("dataset_not_approved");
  if(!dataset.independentCalibration)reasons.push("independent_calibration_not_recorded");
  if(nCandidates<criteria.minCandidates)reasons.push("insufficient_candidates");
  if(metrics.n<criteria.minHoldoutCandidates)reasons.push("insufficient_holdout");
  if(metrics.spearmanThetaVsTruth===null||metrics.spearmanThetaVsTruth<criteria.minSpearman)reasons.push("rank_recovery_below_threshold");
  if(metrics.brier>criteria.maxBrier)reasons.push("brier_above_threshold");
  if(metrics.auc===null||metrics.auc<criteria.minAuc)reasons.push("auc_below_threshold");
  if(metrics.ece>criteria.maxEce)reasons.push("ece_above_threshold");
  if(metrics.logLoss>criteria.maxLogLoss)reasons.push("log_loss_above_threshold");
  return {eligible:reasons.length===0,reasons};
}
