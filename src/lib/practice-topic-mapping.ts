export interface PracticeSubjectLike {
  id: string;
  name: string;
}

export interface PracticeSubtopicLike {
  name: string;
  subject_id: string;
}

export interface PracticeQuestionTopicLike {
  category?: string | null;
  subtopic?: string | null;
  question_text?: string | null;
}

interface SubjectEntry {
  id: string;
  name: string;
  aliases: string[];
}

interface SubtopicEntry {
  name: string;
  subjectId: string;
  subjectName: string;
  aliases: string[];
}

export interface PracticeTopicResolver {
  subjects: SubjectEntry[];
  subtopics: SubtopicEntry[];
}

const SUBJECT_ALIAS_SEEDS: Record<string, string[]> = {
  medicine: [
    'cardiology',
    'cardiovascular',
    'respiratory',
    'gastroenterology',
    'gastrointestinal',
    'renal',
    'nephrology',
    'endocrinology',
    'neurology',
    'haematology',
    'hematology',
    'infectious disease',
    'infectious diseases',
    'psychiatry',
    'dermatology',
    'paediatrics',
    'pediatrics',
    'musculoskeletal',
  ],
  surgery: [
    'surgery',
    'surgical',
    'upper gi',
    'lower gi',
    'colorectal',
    'hepatobiliary',
    'breast',
    'urology',
    'vascular',
    'trauma',
    'neurosurgery',
    'orthopaedics',
    'orthopedics',
    'ent',
    'ophthalmology',
  ],
  acutemedicine: [
    'acute medicine',
    'acute emergency',
    'emergency medicine',
    'emergency',
    'toxicology',
    'critical care',
    'icu',
  ],
  obg: [
    'obg',
    'ob and g',
    'obstetrics',
    'gynaecology',
    'gynecology',
    'obstetrics and gynaecology',
    'obstetrics and gynecology',
    'antenatal care',
    'reproductive medicine',
  ],
  populationhealth: [
    'population health',
    'public health',
    'epidemiology',
    'biostatistics',
    'preventive medicine',
    'indigenous health',
    'ethics',
    'law',
  ],
  basicscience: [
    'basic science',
    'anatomy',
    'physiology',
    'biochemistry',
    'pathology',
    'pharmacology',
    'microbiology',
    'genetics',
    'immunology',
  ],
};

const SUBTOPIC_ALIAS_SEEDS: Record<string, string[]> = {
  gastroenterology: ['gastrointestinal'],
  'emergency medicine': ['acute emergency', 'acute / emergency'],
  gynaecology: ['gynecology'],
  haematology: ['hematology'],
  orthopaedics: ['orthopedics'],
  paediatrics: ['pediatrics'],
  'public health': ['population health'],
  'infectious diseases': ['infectious disease'],
};

export function normalizeTopicLabel(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCanonicalSubjectKey(subjectName: string): string {
  const normalized = normalizeTopicLabel(subjectName);

  if (normalized === 'ob g' || normalized === 'ob and g' || normalized === 'obg') return 'obg';
  if (normalized === 'acute medicine' || normalized === 'acute emergency') return 'acutemedicine';
  if (normalized === 'population health') return 'populationhealth';
  if (normalized === 'basic science') return 'basicscience';

  return normalized.replace(/\s+/g, '');
}

function dedupeAliases(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => normalizeTopicLabel(value)).filter(Boolean)));
}

function aliasMatch(value: string, aliases: string[]): boolean {
  return aliases.some((alias) => value === alias || value.includes(alias) || alias.includes(value));
}

export function buildPracticeTopicResolver(
  subjects: PracticeSubjectLike[],
  subtopics: PracticeSubtopicLike[],
): PracticeTopicResolver {
  const subjectNameById = new Map(subjects.map((subject) => [subject.id, subject.name]));

  const subjectEntries: SubjectEntry[] = subjects.map((subject) => {
    const aliasSeed = SUBJECT_ALIAS_SEEDS[getCanonicalSubjectKey(subject.name)] || [];

    return {
      id: subject.id,
      name: subject.name,
      aliases: dedupeAliases([subject.name, ...aliasSeed]),
    };
  });

  const subtopicEntries: SubtopicEntry[] = subtopics
    .map((subtopic) => {
      const subjectName = subjectNameById.get(subtopic.subject_id);
      if (!subjectName) return null;

      const aliasSeed = SUBTOPIC_ALIAS_SEEDS[normalizeTopicLabel(subtopic.name)] || [];

      return {
        name: subtopic.name,
        subjectId: subtopic.subject_id,
        subjectName,
        aliases: dedupeAliases([subtopic.name, ...aliasSeed]),
      };
    })
    .filter((entry): entry is SubtopicEntry => Boolean(entry))
    .sort((a, b) => b.aliases[0].length - a.aliases[0].length);

  return {
    subjects: subjectEntries,
    subtopics: subtopicEntries,
  };
}

export function resolvePracticeQuestionPlacement(
  question: PracticeQuestionTopicLike,
  resolver: PracticeTopicResolver,
): { subjectName: string | null; subtopicName: string | null } {
  const normalizedSubtopic = normalizeTopicLabel(question.subtopic);
  const normalizedCategory = normalizeTopicLabel(question.category);
  const searchText = normalizeTopicLabel(
    [question.subtopic, question.category, question.question_text].filter(Boolean).join(' '),
  );

  if (normalizedSubtopic) {
    const matchedSubtopic = resolver.subtopics.find((entry) => aliasMatch(normalizedSubtopic, entry.aliases));
    if (matchedSubtopic) {
      return { subjectName: matchedSubtopic.subjectName, subtopicName: matchedSubtopic.name };
    }
  }

  if (normalizedCategory) {
    const matchedSubtopic = resolver.subtopics.find((entry) => aliasMatch(normalizedCategory, entry.aliases));
    if (matchedSubtopic) {
      return { subjectName: matchedSubtopic.subjectName, subtopicName: matchedSubtopic.name };
    }
  }

  if (searchText) {
    const matchedSubtopic = resolver.subtopics.find((entry) => entry.aliases.some((alias) => searchText.includes(alias)));
    if (matchedSubtopic) {
      return { subjectName: matchedSubtopic.subjectName, subtopicName: matchedSubtopic.name };
    }
  }

  if (normalizedCategory) {
    const matchedSubject = resolver.subjects.find((entry) => aliasMatch(normalizedCategory, entry.aliases));
    if (matchedSubject) {
      return { subjectName: matchedSubject.name, subtopicName: null };
    }
  }

  if (searchText) {
    const matchedSubject = resolver.subjects.find((entry) => entry.aliases.some((alias) => searchText.includes(alias)));
    if (matchedSubject) {
      return { subjectName: matchedSubject.name, subtopicName: null };
    }
  }

  return { subjectName: null, subtopicName: null };
}