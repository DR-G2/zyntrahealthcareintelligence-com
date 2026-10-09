# P13 Production PIE Shadow Integration

P13 connects the learner-facing Performance Intelligence dashboard to the certified P12 shadow inference without exposing protected PIE tables or changing authoritative adaptation.

## Runtime path

```
pie.pie_observation
  -> pie-infer-state v9 / P12
  -> pie.inference_shadow
  -> pie-shadow-read (authenticated P13 application boundary)
  -> p13-shadow-client
  -> P13ShadowInferencePanel
```

The browser never queries `pie.inference_shadow` directly.

## P12 contract preservation

P13 does not calculate inference. The certified P12 response remains authoritative for the six-dimensional numerical contract:

- capability
- decision
- timing
- calibration
- sustained_performance
- learning

Each dimension is rendered with estimate, uncertainty, lower, upper, evidence_count, and evidence_quality exactly as supplied by P12.

The persisted `pie.inference_shadow` table is used for provenance and persisted-run correlation. That table does not persist per-dimension `evidence_quality`, so P13 never reconstructs that field from another signal.

## Shadow boundary

The panel is explicitly labelled SHADOW / P13 and displays that the state is diagnostic only. It does not feed scoring, question selection, readiness promotion, or adaptive decisions.

## Security

`pie-shadow-read` authenticates the bearer token, resolves the authenticated user with Supabase Auth, and scopes the service-role read to that user's UUID. The service-role key remains server-side. No browser grant is added to the `pie` schema.

## Presentation transform

The dashboard multiplies the raw 0..1 estimate by 100 only for visual percentage display. Raw inference values are retained in the typed application model.

## Regression

P12 certification remains an independent gate and must continue to report PASS=13 FAIL=0. P13 does not modify `pie-infer-state` v9 or the P12 certification script.
