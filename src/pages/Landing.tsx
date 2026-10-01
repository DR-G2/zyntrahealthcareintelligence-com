import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type Question = {
  id: string;
  question_text: string;
  options: string[] | Record<string, string>;
  category: string;
  difficulty: string;
  difficulty_tier: number;
};

type SubmitResult = {
  is_correct: boolean;
  final: boolean;
  next_question?: Question | null;
};

const TOTAL_QUESTIONS = 6;

function normaliseOptions(options: Question["options"]): string[] {
  return Array.isArray(options) ? options : Object.values(options ?? {});
}

function optionKey(index: number) {
  return String.fromCharCode(65 + index);
}

export default function Landing() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerChanges, setAnswerChanges] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [usedIds, setUsedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef(Date.now());
  const firstClickAtRef = useRef<number | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    let active = true;

    const start = async () => {
      const { data, error: rpcError } = await supabase.rpc("get_diagnostic_question", {
        p_previous_correct: null,
        p_previous_difficulty_tier: null,
        p_used_ids: [],
      });

      if (!active) return;

      if (rpcError || !data) {
        setError(rpcError?.message ?? "Unable to load the diagnostic.");
        setLoading(false);
        return;
      }

      setQuestion(data as Question);
      setUsedIds([(data as Question).id]);
      startedAtRef.current = Date.now();
      setLoading(false);
    };

    void start();
    return () => {
      active = false;
    };
  }, []);

  const chooseAnswer = (index: number) => {
    if (submitting || score !== null) return;
    if (firstClickAtRef.current === null) {
      firstClickAtRef.current = Date.now();
    }
    if (selected !== null && selected !== index) {
      setAnswerChanges((value) => value + 1);
    }
    setSelected(index);
  };

  const submitAnswer = async () => {
    if (!question || selected === null || submitting) return;

    setSubmitting(true);
    setError(null);

    const elapsedSeconds = Math.max(
      1,
      Math.round((Date.now() - startedAtRef.current) / 1000)
    );
    const timeToFirstClick = firstClickAtRef.current
      ? Math.max(0, Math.round((firstClickAtRef.current - startedAtRef.current) / 1000))
      : elapsedSeconds;

    const isFinal = questionIndex === TOTAL_QUESTIONS - 1;

    const { data, error: rpcError } = await supabase.rpc("submit_diagnostic_answer", {
      p_question_id: question.id,
      p_selected_answer: optionKey(selected),
      p_time_taken_seconds: elapsedSeconds,
      p_answer_changes_count: answerChanges,
      p_session_id: sessionIdRef.current,
      p_question_position: questionIndex + 1,
      p_previous_question_correct: questionIndex === 0 ? null : undefined,
      p_time_to_first_click: timeToFirstClick,
      p_used_ids: usedIds,
      p_previous_difficulty_tier: question.difficulty_tier,
      p_is_final: isFinal,
    });

    if (rpcError || !data) {
      setError(rpcError?.message ?? "Unable to submit this answer.");
      setSubmitting(false);
      return;
    }

    const result = data as SubmitResult;
    const nextCorrectCount = correctCount + (result.is_correct ? 1 : 0);
    setCorrectCount(nextCorrectCount);

    if (result.final) {
      setScore(Math.round((nextCorrectCount / TOTAL_QUESTIONS) * 10 * 10) / 10);
      setSubmitting(false);
      return;
    }

    if (!result.next_question) {
      setError("The diagnostic could not select the next question.");
      setSubmitting(false);
      return;
    }

    const nextQuestion = result.next_question;
    setQuestion(nextQuestion);
    setUsedIds((ids) => [...ids, nextQuestion.id]);
    setQuestionIndex((value) => value + 1);
    setSelected(null);
    setAnswerChanges(0);
    firstClickAtRef.current = null;
    startedAtRef.current = Date.now();
    setSubmitting(false);
  };

  if (loading) {
    return <main className="min-h-screen bg-[#f6fbfc]" />;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f6fbfc] px-4 py-8 text-slate-950 sm:py-12">
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  if (score !== null) {
    return (
      <main className="min-h-screen bg-[#f6fbfc] px-4 py-8 text-slate-950 sm:py-12">
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="text-xs font-bold uppercase tracking-[.18em] text-[#16858c]">
            Diagnostic score
          </div>
          <div className="mt-3 font-display text-6xl font-bold tracking-tight text-[#0f5f68]">
            {score}<span className="text-2xl text-slate-400">/10</span>
          </div>
        </div>
      </main>
    );
  }

  if (!question) return null;

  const options = normaliseOptions(question.options);

  return (
    <main className="min-h-screen bg-[#f6fbfc] px-4 py-8 text-slate-950 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between text-xs font-bold uppercase tracking-[.16em] text-slate-500">
          <span>Question {questionIndex + 1} of {TOTAL_QUESTIONS}</span>
          <span>{Math.round(((questionIndex + 1) / TOTAL_QUESTIONS) * 100)}%</span>
        </div>

        <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#16858c] transition-all"
            style={{ width: ((questionIndex + 1) / TOTAL_QUESTIONS) * 100 + "%" }}
          />
        </div>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="font-display text-xl font-bold leading-8 tracking-tight sm:text-2xl">
            {question.question_text}
          </h1>

          <div className="mt-7 space-y-3">
            {options.map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={() => chooseAnswer(index)}
                disabled={submitting}
                className={
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-sm font-medium transition-all sm:text-base " +
                  (selected === index
                    ? "border-[#16858c] bg-[#eaf8f8] text-[#0b4f57] ring-2 ring-[#16858c]/10"
                    : "border-slate-200 bg-white hover:border-[#9ccfd1] hover:bg-[#f8fcfc]")
                }
              >
                <span
                  className={
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold " +
                    (selected === index
                      ? "bg-[#0f5f68] text-white"
                      : "bg-slate-100 text-slate-500")
                  }
                >
                  {optionKey(index)}
                </span>
                <span className="pt-1 leading-6">{option}</span>
              </button>
            ))}
          </div>

          <Button
            type="button"
            onClick={submitAnswer}
            disabled={selected === null || submitting}
            className="mt-7 h-12 w-full rounded-xl bg-[#0f5f68] text-base hover:bg-[#0a4b52]"
          >
            {questionIndex === TOTAL_QUESTIONS - 1 ? "Submit" : "Next"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </section>
      </div>
    </main>
  );
}
