# PIE Model Comparison

## P2.2

The validation lab now compares two deliberately separate systems:

1. **Legacy baseline**: a proxy for the existing fixed-score intelligence approach.
2. **PIE development baseline**: a transparent multi-dimension development estimator.

The comparison is not a claim that either implementation is the final production model.

### Metrics

We keep metrics separate:

- capability estimation error
- capability rank correlation
- outcome Brier score
- calibration error

There is no composite winner score.

### Why this matters

PIE must earn its complexity. A more sophisticated model is not automatically better.

The question is:

> Does PIE recover hidden states, preserve uncertainty, and improve decisions better than simpler baselines?

### Current safety boundary

The old production model remains the production baseline.

The PIE development baseline remains experimental.

Neither system is allowed to rewrite production readiness from this validation harness.

### Next

The next validation phase should add controlled train/test splits, repeated seeds, temporal dynamics, question protection, and Pareto comparison across models.
