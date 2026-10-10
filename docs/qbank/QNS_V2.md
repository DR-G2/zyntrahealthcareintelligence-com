# QNS V2 — PH-01 Screening Programs, Population Health & Ethics

**Project:** Zyntra Health Intelligence  
**Content pack:** PH-01  
**Inventory:** 28 AMC-style MCQs  
**Reviewer attribution requested:** Dr. GopalaKrishnan SankaraNarayanan  
**Review date:** 10 October 2026  
**Answer-key distribution:** A = 6, B = 6, C = 6, D = 5, E = 5

## QA status

**AI-assisted content preparation complete; independent clinical sign-off pending.**

The canonical source has been normalized into the V2 QBank shape. Structural validation covers 28 items, five options, A–E rationale, balanced answer keys, unique IDs, evidence URLs, and draft-only lifecycle. Targeted wording was tightened for:

- PH-S-18: persistent postcoital bleeding requires diagnostic assessment, co-testing and appropriate specialist follow-up, not routine screening alone.
- PH-S-22: distinguish initial entry into the National Lung Cancer Screening Program from continued screening for people already enrolled.
- PH-S-27: a single first-degree relative diagnosed at age 72 does not automatically establish a high-risk familial ovarian cancer category; assess the full pedigree.

## Guidance references

- [BreastScreen Australia: who should have a breast screen](https://www.health.gov.au/our-work/breastscreen-australia-program/having-a-breast-screen/who-should-have-a-breast-screen)
- [National Bowel Cancer Screening Program: eligibility](https://www.health.gov.au/our-work/national-bowel-cancer-screening-program/doing-a-bowel-screening-test/who-should-do-the-bowel-screening-test-and-who-should-not)
- [National Cervical Screening Program](https://www.health.gov.au/our-work/national-cervical-screening-program)
- [Managing patients with symptoms of cervical cancer](https://www.health.gov.au/our-work/national-cervical-screening-program/providing-cervical-screening/managing-patients-with-symptoms-of-cervical-cancer)
- [National Lung Cancer Screening Program](https://www.health.gov.au/our-work/nlcsp/how-it-works)
- [Cancer Australia: testing for ovarian cancer in asymptomatic women](https://www.canceraustralia.gov.au/publications-and-resources/position-statements/testing-ovarian-cancer-asymptomatic-women/guidance)
- [Cancer Council Australia: prostate cancer policy context](https://www.cancer.org.au/about-us/policy-and-advocacy/early-detection/prostate-cancer/policy-context)
- [Australian Government: skin cancer screening position statement](https://www.health.gov.au/resources/publications/skin-cancer-screening-position-statement)

## QBank integration artifacts

- Canonical source: `supabase/seed_v2/qns_v2_ph01/ph01_screening_upload.json`
- Validator: `supabase/seed_v2/qns_v2_ph01/validate_ph01.py`
- Deterministic PIE migration generator: `supabase/seed_v2/qns_v2_ph01/build_ph01.py`
- Incremental draft-only migration: `supabase/migrations_v2/0081_qns_v2_ph01_draft_import.sql`
- Canonical QBank IDs: `ZQ-0401` through `ZQ-0428`; original source IDs `PH-S-01` through `PH-S-28` are retained in metadata.

## Release gate

This file records content-pack QA metadata and references. It is **not** an independent medical-board certificate. The migration inserts questions as `draft`; the questions are not eligible for learner delivery until an authorised clinical approval and a separately reviewed activation step. This branch does not represent a live database import.

## Question inventory

PH-S-01 through PH-S-28. Preserve the question IDs and answer-key distribution above when updating this pack.
