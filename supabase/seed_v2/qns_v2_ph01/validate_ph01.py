#!/usr/bin/env python3
"""Validate the PH-01 QNS V2 canonical source before any migration is applied."""
import collections, json
from pathlib import Path
p=Path(__file__).with_name("ph01_screening_upload.json")
items=json.loads(p.read_text(encoding="utf-8"))
assert len(items)==28
assert len({q["zyntra_id"] for q in items})==28
assert len({q["source_question_id"] for q in items})==28
assert collections.Counter(q["correct_answer"] for q in items)=={"A":6,"B":6,"C":6,"D":5,"E":5}
for q in items:
    assert q["lifecycle_status"]=="draft"
    assert len(q["options"])==5
    assert set(q["incorrect_answer_explanations"])==set("ABCDE")
    assert q["correct_answer"] in "ABCDE"
    assert q["question_text"].strip() and q["explanation"].strip()
    assert q["subtopic"].strip() and q["evidence_sources"]
    assert all(e["url"].startswith("https://") for e in q["evidence_sources"])
print("PASS: 28 questions; 5 options each; A-E rationales; balanced keys; unique IDs; all lifecycle_status=draft; evidence URLs present.")
