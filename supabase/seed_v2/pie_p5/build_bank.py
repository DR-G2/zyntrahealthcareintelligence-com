"""Builds migrations_v2/0057_pie_p5_qbank_swap.sql (C0 bank swap, C4 ZQ ids canonical).
Inputs (copied from /home/box/zyntra/qbank and branches gale/qbank-batch01..03) in ./sources.
Deterministic: question/concept/LO ids are uuid5 of their keys. Re-run to regenerate.
Writes bank_manifest.csv (included) and bank_excluded.csv (excluded + reason)."""
import json, os, re, uuid, csv, collections
here = os.path.dirname(os.path.abspath(__file__)); src = os.path.join(here, 'sources')
root = os.path.abspath(os.path.join(here, '..', '..', '..'))
NS = uuid.UUID('5a6b1c2d-0000-4000-8000-00000000c0de')
U = lambda k: str(uuid.uuid5(NS, k))
def q(s): return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"
def slug(s, n=48): return re.sub(r'_+', '_', re.sub(r'[^A-Z0-9]+', '_', s.upper())).strip('_')[:n].strip('_')

GROUP = {'Adult Medicine': ('ADULT_MEDICINE', 'Adult Medicine', 'adult-medicine'),
         'Adult Surgery': ('ADULT_SURGERY', 'Adult Surgery', 'adult-surgery'),
         "Women's Health": ('WOMENS_HEALTH', "Women's Health", 'womens-health'),
         'Child Health': ('CHILD_HEALTH', 'Child Health', 'child-health'),
         'Mental Health': ('MENTAL_HEALTH', 'Mental Health', 'mental-health'),
         'Population Health & Ethics': ('POPULATION_HEALTH', 'Population Health & Ethics', 'population-health-ethics')}
TARGET = {'ADULT_MEDICINE': .30, 'ADULT_SURGERY': .20, 'WOMENS_HEALTH': .125, 'CHILD_HEALTH': .125, 'MENTAL_HEALTH': .125, 'POPULATION_HEALTH': .125}
TIER_PRIOR = {'1': -2.0, '2': -1.0, '3': 0.0, '4': 1.0, '5': 2.0}   # same scale as 0050 tier prior (DESIGN DEFAULT)
# Kim P5 clinical review (7 Oct 2026, review_p5/review.json): every KEEP/FIX item is active
# (the former flag_source_check and unverified-calculation exclusions were closed by source checks);
# DROP items are excluded here with their reason.
DROPPED = {'ZQ-0375': 'clinical review DROP: near-duplicate of ZQ-0323 (same perforated-ulcer archetype, source and teaching point)'}

items, excluded = [], []
house = {}
for b in ('01', '02', '03'):
    for h in json.load(open(os.path.join(src, f'batch{b}.json'))):
        house[h['id']] = (b, h)
sources = [('bank170', 'zyntra_mcq_upload_170_tagged.json')] + [(f'batch{b}', f'batch{b}_upload.json') for b in ('01', '02', '03')]
seen = set()
for tag, f in sources:
    for it in json.load(open(os.path.join(src, f))):
        zid = it['zyntra_id']
        assert zid not in seen, zid; seen.add(zid)
        reason = None
        if 'flag_source_check' in it['tags']: reason = 'open flag_source_check'
        hb = house.get(zid)
        if hb and hb[1].get('flag_source_check'): reason = 'open flag_source_check'
        if zid in DROPPED: reason = DROPPED[zid]
        if reason:
            excluded.append({'zyntra_id': zid, 'source': tag, 'reason': reason, 'subtopic': it['subtopic']}); continue
        items.append((tag, it, hb[1] if hb else None))

concepts, los, rows = {}, {}, []
for tag, it, h in items:
    gk, gname, gslug = GROUP[it['category']]
    ck = f"{gk}.{slug(it['system_category'])}"
    concepts.setdefault(ck, (it['system_category'], gname))
    lk = f"{ck}.{slug(it['subtopic'])}"
    los.setdefault(lk, {'concept': ck, 'title': it['subtopic'], 'group': gk, 'n': 0}); los[lk]['n'] += 1
    opts = it['options']; assert isinstance(opts, list) and 2 <= len(opts) <= 5, it['zyntra_id']
    key = it['correct_answer'].strip().upper(); assert re.fullmatch('[A-E]', key) and ord(key) - 65 < len(opts), it['zyntra_id']
    if h is not None and h.get('irt_b') is not None:
        b, se, bsrc, note = float(h['irt_b']), 0.5, 'expert_prior', f"author_estimate ({tag})"
    else:
        b, se, bsrc, note = TIER_PRIOR[str(it['difficulty_tier'])], 1.0, 'tier_prior', f"tier={it['difficulty_tier']} ({tag})"
    review = 'owner_approved_2026_09_29' if 'approved_by_owner_2026_09_29' in it['tags'] else (h or {}).get('status', 'draft_pending_owner_review')
    prov = {'source': 'zyntra_qbank', 'source_batch': tag, 'review_status': review, 'tags': it['tags'],
            'clinician_task': next((t[5:] for t in it['tags'] if t.startswith('task_')), None),
            'guideline_reference': it.get('guideline_reference'), 'incorrect_answer_explanations': it.get('incorrect_answer_explanations'),
            'key_takeaways': it.get('key_takeaways'), 'imported_by': '0057'}
    rows.append({'id': U('q:' + it['zyntra_id']), 'zid': it['zyntra_id'], 'gk': gk, 'gslug': gslug, 'gname': gname,
                 'sys': it['system_category'], 'stem': it['question_text'], 'opts': opts, 'key': key,
                 'expl': it['explanation'], 'tier': it['difficulty'], 'b': b, 'se': se, 'bsrc': bsrc, 'note': note,
                 'prov': prov, 'lk': lk, 'ck': ck, 'review': review, 'tag': tag})

groups_n = collections.Counter(r['gk'] for r in rows)
lo_per_group = collections.Counter(v['group'] for v in los.values())
J = lambda o: q(json.dumps(o, ensure_ascii=False))
subj = sorted({(r['gslug'], r['gname'], r['gk']) for r in rows})
subt = sorted({(r['gslug'], r['sys']) for r in rows})
L = []
L.append(f"""-- 0057: P5 C0 bank swap (Mr. G ruling): replace the V2 bank with the reviewed Zyntra qbank.
-- GENERATED by supabase/seed_v2/pie_p5/build_bank.py - do not hand-edit; regenerate.
-- C4: ZQ ids are canonical (public.questions.zyntra_id). Included {len(rows)} items, excluded {len(excluded)}
-- (clinical-review DROPs or any open flag_source_check; see bank_excluded.csv). Kim P5 review 7 Oct 2026. Concept = patient group + system; LO = item subtopic (author metadata,
-- mapping_source 'import'). irt_b: batch author estimates (source expert_prior, se 0.5) or the
-- 0050 tier prior for the 170 bank (tier_prior, se 1.0); all uncalibrated.
-- ZYNTRA-BS rows are RETIRED (status='retired'), never deleted (attempt history keeps its FK).
-- Blueprint AMC_CAT_MCQ: every new LO eligible; coverage_target = group proportion / LOs in group
-- (coverage reporting and tie-break only - never a quota).
""")
L.append("insert into public.subjects(id, name, slug, description) values\n" + ",\n".join(
    f"({q(U('subject:'+s))}::uuid,{q(n)},{q(s)},{q('AMC patient group ' + k)})" for s, n, k in subj) + "\non conflict (slug) do nothing;\n")
L.append("insert into public.subtopics(id, subject_id, name, slug)\nselect v.id, s.id, v.name, v.slug from (values\n" + ",\n".join(
    f"({q(U('subtopic:'+g+':'+n))}::uuid,{q(g)},{q(n)},{q(slug(n).lower().replace('_','-'))})" for g, n in subt) +
    "\n) v(id, subject_slug, name, slug) join public.subjects s on s.slug = v.subject_slug\nwhere not exists (select 1 from public.subtopics t where t.subject_id = s.id and t.slug = v.slug);\n")
L.append("insert into pie.concept(id, concept_key, title, description) values\n" + ",\n".join(
    f"({q(U('concept:'+k))}::uuid,{q(k)},{q(t)},{q('Patient group: '+g)})" for k, (t, g) in sorted(concepts.items())) + "\non conflict (concept_key) do nothing;\n")
L.append("insert into pie.learning_objective(id, lo_key, concept_id, title, description) values\n" + ",\n".join(
    f"({q(U('lo:'+k))}::uuid,{q(k)},{q(U('concept:'+v['concept']))}::uuid,{q(v['title'])},{q('qbank subtopic')})" for k, v in sorted(los.items())) + "\non conflict (lo_key) do nothing;\n")
L.append("insert into public.questions(id, zyntra_id, subject_id, subtopic_id, stem, options, correct_answer, explanation, difficulty_tier, status, version, provenance, irt_b, irt_b_se, irt_b_source, irt_b_note)\n"
         "select v.id, v.zid, s.id, t.id, v.stem, v.opts, v.ckey, v.expl, v.tier, 'active', 1, v.prov, v.b, v.se, v.bsrc, v.note from (values\n" + ",\n".join(
    f"({q(r['id'])}::uuid,{q(r['zid'])},{q(r['gslug'])},{q(slug(r['sys']).lower().replace('_','-'))},{q(r['stem'])},{J(r['opts'])}::jsonb,{q(r['key'])},{q(r['expl'])},{q(r['tier'])},{J(r['prov'])}::jsonb,{r['b']},{r['se']},{q(r['bsrc'])},{q(r['note'])})" for r in rows) +
    "\n) v(id, zid, subject_slug, subtopic_slug, stem, opts, ckey, expl, tier, prov, b, se, bsrc, note)\n"
    "join public.subjects s on s.slug = v.subject_slug\nleft join public.subtopics t on t.subject_id = s.id and t.slug = v.subtopic_slug\non conflict (zyntra_id) do nothing;\n")
L.append("insert into pie.question_lo(question_id, lo_id, is_primary, weight, mapping_source)\nselect m.qid, m.lid, true, 1, 'import' from (values\n" + ",\n".join(
    f"({q(r['id'])}::uuid,{q(U('lo:'+r['lk']))}::uuid)" for r in rows) + "\n) m(qid, lid) join public.questions qq on qq.id = m.qid\non conflict (question_id, lo_id) do nothing;\n")
L.append("insert into amc.amc_blueprint_lo(blueprint_id, lo_id, eligible, coverage_target, tie_break_rank)\nselect b.id, v.lid, true, v.ct, null from (values\n" + ",\n".join(
    f"({q(U('lo:'+k))}::uuid,{round(TARGET[v['group']] / lo_per_group[v['group']], 6)})" for k, v in sorted(los.items())) +
    "\n) v(lid, ct) cross join lateral (select id from amc.amc_blueprint where blueprint_key = 'AMC_CAT_MCQ' order by effective_from desc nulls last limit 1) b\non conflict (blueprint_id, lo_id) do nothing;\n")
L.append("""-- Retire the ZYNTRA-BS basic-science bank (deactivate; never delete).
update public.questions set status = 'retired', updated_at = now(),
       provenance = provenance || jsonb_build_object('retired_by', '0057', 'retired_reason', 'C0 bank swap')
 where zyntra_id like 'ZYNTRA-BS-%' and status <> 'retired';
""")
open(os.path.join(root, 'supabase', 'migrations_v2', '0057_pie_p5_qbank_swap.sql'), 'w').write("\n".join(L))
with open(os.path.join(here, 'bank_excluded.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=['zyntra_id', 'source', 'reason', 'subtopic']); w.writeheader(); w.writerows(excluded)
with open(os.path.join(here, 'bank_manifest.csv'), 'w', newline='') as fh:
    w = csv.writer(fh); w.writerow(['zyntra_id', 'source', 'group', 'concept_key', 'lo_key', 'irt_b', 'irt_b_source', 'review_status'])
    for r in rows: w.writerow([r['zid'], r['tag'], r['gk'], r['ck'], r['lk'], r['b'], r['bsrc'], r['review']])
tot = len(rows)
print(f"included={tot} excluded={len(excluded)} concepts={len(concepts)} los={len(los)} by_source={dict(collections.Counter(r['tag'] for r in rows))}")
print("split:", {k: f"{groups_n[k]} ({groups_n[k]/tot:.1%} vs {TARGET[k]:.1%})" for k in TARGET})
print("irt:", dict(collections.Counter(r['bsrc'] for r in rows)), "review:", dict(collections.Counter(r['review'] for r in rows)))
print("excluded:", [(e['zyntra_id'], e['reason'][:30]) for e in excluded])
print("max questions per LO:", max(v['n'] for v in los.values()))
