

## Plan: Clean Up Clinical Stations

### Analysis

All 150 clinical stations are **template garbage**. Here's why:

**1. Identical generic content across every station:**
Every single station has the same history clues:
- "symptoms started recently"
- "patient worried about worsening condition"  
- "no major past medical issues reported"

**2. Scenario titles randomly duplicated across unrelated subjects:**

| Title | Copies | Subjects assigned to |
|-------|--------|---------------------|
| Breath Holding Spell | 9 | ENT, General Surgery, Infectious Disease, Mental Health, Nephrology, Neurology, Obstetrics, Orthopaedics, Rheumatology |
| Iron Deficiency Anaemia | 9 | ENT, General Surgery, Mental Health, Neurology, Obstetrics, Orthopaedics, Public Health, Respiratory, Rheumatology |
| Temporal Arteritis Examination | 9 | Cardiology (as "Peripheral Arterial Disease"), ENT, Gastroenterology, Gynaecology, Mental Health, Nephrology, Orthopaedics, Paediatrics, Respiratory |

**3. Titles don't match subjects at all:**
- "Breast Examination" → Cardiology, Dermatology
- "Pelvic Examination Counselling" → Cardiology, Gastroenterology
- "Prostate Cancer Counselling" → Cardiology, Infectious Disease
- "Autism Developmental Concern" → Dermatology, Paediatrics

There are zero legitimate stations. Subject normalization is pointless when the data itself is nonsensical.

### Proposed Action

**Delete all 150 stations** and clean related records:

1. **Database cleanup via SQL migration:**
   - Delete all rows from `clinical_stations` (all 150 are junk)
   - Clean any orphaned `station_attempts` references

2. **Update `QuestionsOSCE.tsx`** to show an appropriate empty state ("No stations available yet — stations will appear here once generated")

3. **No subject normalization needed** — there's nothing worth normalizing

### After Cleanup

The station bank will be empty and ready for proper station generation (via the existing `generate-station` edge function or admin import) with correctly assigned subjects that actually match the `SYSTEMS` list.

### Files Changed

| File | Change |
|------|--------|
| Database migration | Delete all clinical_stations rows |
| `src/pages/QuestionsOSCE.tsx` | Better empty state message |

