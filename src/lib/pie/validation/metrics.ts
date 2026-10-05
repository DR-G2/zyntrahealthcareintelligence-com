export interface RankedPair { x: number; y: number }

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return mean(values.map(v => (v - m) ** 2));
}

export function rmse(predicted: number[], actual: number[]): number {
  if (!predicted.length || predicted.length !== actual.length) return Infinity;
  return Math.sqrt(mean(predicted.map((p, i) => (p - actual[i]) ** 2)));
}

function ranks(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const out = Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i + 1;
    while (j < indexed.length && indexed[j].value === indexed[i].value) j++;
    const rank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) out[indexed[k].index] = rank;
    i = j;
  }
  return out;
}

export function spearman(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const rx = ranks(x);
  const ry = ranks(y);
  const mx = mean(rx);
  const my = mean(ry);
  const numerator = rx.reduce((s, v, i) => s + (v - mx) * (ry[i] - my), 0);
  const dx = Math.sqrt(rx.reduce((s, v) => s + (v - mx) ** 2, 0));
  const dy = Math.sqrt(ry.reduce((s, v) => s + (v - my) ** 2, 0));
  return dx && dy ? numerator / (dx * dy) : 0;
}

export function brierScore(probabilities: number[], outcomes: number[]): number {
  if (probabilities.length !== outcomes.length || !probabilities.length) return Infinity;
  return mean(probabilities.map((p, i) => (p - outcomes[i]) ** 2));
}

export function calibrationBins(
  probabilities: number[],
  outcomes: number[],
  binCount = 10,
): Array<{ bin: number; meanPredicted: number; observedRate: number; count: number }> {
  const bins = Array.from({ length: binCount }, (_, bin) => ({ bin, p: [] as number[], y: [] as number[] }));
  probabilities.forEach((p, i) => {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor(p * binCount)));
    bins[index].p.push(p);
    bins[index].y.push(outcomes[i]);
  });
  return bins.map(b => ({
    bin: b.bin,
    meanPredicted: mean(b.p),
    observedRate: mean(b.y),
    count: b.p.length,
  }));
}

export function uncertaintyWidth(lower: number, upper: number): number {
  return Math.max(0, upper - lower);
}
