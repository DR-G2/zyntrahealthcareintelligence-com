const steps = [
  ["Practice.", "Answer AMC-style questions."],
  ["Observe.", "Timing, confidence and answer changes are captured."],
  ["Understand.", "Patterns emerge across those signals."],
  ["Adapt.", "Training focuses on what needs work."],
  ["Progress.", "Performance Intelligence develops over time."],
] as const;

export default function HowItWorks() {
  const jumpToTraining = () => document.getElementById("trains")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section id="how" className="dark-section how-section">
      <div className="shell">
        <p className="section-kicker">THE LOOP</p>
        <h2>How Zyntra works</h2>
        <div className="how-timeline">
          {steps.map(([title, text], index) => (
            <button type="button" className="timeline-step" key={title} onClick={jumpToTraining}>
              <div className="timeline-marker"><span>{String(index + 1).padStart(2, "0")}</span></div>
              <div className="timeline-copy"><h3>{title}</h3><p>{text}</p></div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
