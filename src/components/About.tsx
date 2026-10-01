function PracticeWindow() {
  return (
    <div className="practice-window" aria-label="Zyntra AMC question engine preview">
      <div className="practice-bar">
        <div className="practice-brand"><span>Z</span> Practice</div>
        <div className="practice-status">MCQ <i /></div>
      </div>
      <div className="practice-body">
        <div className="practice-meta">QUESTION 042 <span>01:18</span></div>
        <div className="practice-question">A patient presents with a new clinical finding. Which interpretation is most appropriate?</div>
        <div className="practice-answer"><b>A</b><span>Read the pattern and context</span></div>
        <div className="practice-answer selected"><b>B</b><span>Prioritise the strongest signal</span><i>✓</i></div>
        <div className="practice-answer"><b>C</b><span>Choose the first plausible alternative</span></div>
        <div className="practice-answer"><b>D</b><span>Wait for another clue</span></div>
      </div>
      <div className="practice-footer"><span>CONFIDENCE <b>7/10</b></span><span>TIMING <b>72s</b></span><span>CHANGES <b>0</b></span></div>
    </div>
  );
}

export default function About() {
  return (
    <section id="about" className="dark-section about-section">
      <div className="shell split-section">
        <div className="section-copy">
          <p className="section-kicker">ABOUT ZYNTRA</p>
          <h2>About Zyntra</h2>
          <p>Zyntra is for medical students, medical graduates and doctors preparing for AMC examinations. A conventional bank marks the option. Zyntra also keeps timing, confidence and answer changes, then uses those signals in Performance Intelligence and the Study Plan.</p>
        </div>
        <PracticeWindow />
      </div>
    </section>
  );
}
