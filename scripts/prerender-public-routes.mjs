import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const indexPath = path.join(dist, "index.html");
if (!fs.existsSync(indexPath)) throw new Error("Vite build output missing dist/index.html");
const template = fs.readFileSync(indexPath, "utf8");
const origin = "https://www.zyntrahealthcareintelligence.com";

const routes = [
  {
    path: "/", title: "Zyntra | AMC Exam Preparation for International Medical Graduates",
    description: "Prepare for the AMC exams with Zyntra. Practise clinical questions, analyse your answer patterns and build a clearer picture of your exam readiness.",
    heading: "AMC exam preparation that looks beyond right and wrong",
    paragraphs: ["Zyntra helps international medical graduates prepare for the Australian Medical Council examinations with clinical practice and evidence-led feedback.", "Review clinical accuracy, answer stability, time management and confidence calibration to understand how you approach questions. Zyntra is independent of the Australian Medical Council."],
    links: [["AMC exam preparation guide","/amc-exam-preparation"],["AMC Part 1 MCQ preparation","/amc-part-1-mcq"],["AMC Clinical OSCE preparation","/amc-clinical-osce"],["AMC preparation for IMGs","/amc-preparation-for-imgs"],["Features","/features"],["How it works","/how-it-works"],["Pricing","/pricing"],["FAQ","/faq"],["Journal","/blog"]]
  },
  {path:"/amc-exam-preparation",title:"AMC Exam Preparation Guide | Zyntra",description:"Explore a structured approach to AMC exam preparation, clinical question practice and performance review for international medical graduates.",heading:"AMC exam preparation for international medical graduates",paragraphs:["Build your AMC preparation around clinical reasoning, consistent practice and review of the decisions behind each answer.","Zyntra supports practice and performance review. It is an independent educational product and is not affiliated with the Australian Medical Council."],links:[["AMC Part 1 MCQ","/amc-part-1-mcq"],["AMC Clinical OSCE","/amc-clinical-osce"],["Pricing","/pricing"]]},
  {path:"/amc-part-1-mcq",title:"AMC Part 1 MCQ Preparation | Zyntra",description:"Practise original AMC-style multiple-choice questions and review clinical accuracy, timing and answer stability with Zyntra.",heading:"AMC Part 1 MCQ preparation",paragraphs:["Prepare for the AMC CAT MCQ examination with original practice questions and structured review of your clinical reasoning.","Zyntra is an independent preparation tool. It does not provide or reproduce actual recalled examination questions."],links:[["AMC exam preparation","/amc-exam-preparation"],["How Zyntra works","/how-it-works"],["Pricing","/pricing"]]},
  {path:"/amc-clinical-osce",title:"AMC Clinical Exam and OSCE Preparation | Zyntra",description:"Explore AMC Clinical examination preparation with structured OSCE practice and review for international medical graduates.",heading:"AMC Clinical examination and OSCE preparation",paragraphs:["Prepare for clinical stations with deliberate practice, structured feedback and reflection on your approach.","Explore the current product features and their availability before choosing a preparation plan."],links:[["AMC exam preparation","/amc-exam-preparation"],["Features","/features"],["Pricing","/pricing"]]},
  {path:"/amc-preparation-for-imgs",title:"AMC Preparation for International Medical Graduates | Zyntra",description:"A focused overview of AMC exam preparation for international medical graduates, including practice, review and readiness signals.",heading:"AMC preparation for international medical graduates",paragraphs:["Zyntra is designed for international medical graduates preparing for AMC examinations who want to review both clinical knowledge and question-answering behaviour.","Use practice evidence to identify areas to revisit and make preparation more deliberate. Zyntra is independent of the AMC."],links:[["AMC Part 1 MCQ","/amc-part-1-mcq"],["AMC Clinical OSCE","/amc-clinical-osce"],["FAQ","/faq"]]},
  {path:"/features",title:"Zyntra Features | AMC Exam Preparation",description:"Explore Zyntra's AMC preparation features and their current availability, with clear labels for live, beta and coming-soon capabilities.",heading:"Zyntra preparation features",paragraphs:["Zyntra combines clinical question practice with performance signals such as response timing, answer changes and confidence calibration.","Feature availability can vary by release. Review the product directly for current availability."],links:[["How it works","/how-it-works"],["Pricing","/pricing"],["FAQ","/faq"]]},
  {path:"/how-it-works",title:"How PIE Works | Zyntra Healthcare Intelligence",description:"See how Zyntra uses available practice signals and explanations to help you choose what to work on next.",heading:"How Zyntra turns practice into evidence",paragraphs:["Zyntra looks beyond whether an answer is correct. Where recorded, timing, confidence and answer changes add context to performance.","The aim is to identify useful next steps from practice evidence, then review whether performance changes over time."],links:[["Features","/features"],["AMC exam preparation","/amc-exam-preparation"],["Pricing","/pricing"]]},
  {path:"/about",title:"About Zyntra | Built for Doctors Preparing for the AMC",description:"Learn why Zyntra exists, the principles behind its AMC exam preparation tools, and what to expect from a product in beta. Independent of the Australian Medical Council.",heading:"About Zyntra",paragraphs:["Zyntra Healthcare Intelligence builds preparation tools for international medical graduates working toward AMC examinations.","Zyntra is an independent educational product and is not affiliated with or endorsed by the Australian Medical Council."],links:[["Features","/features"],["FAQ","/faq"],["Contact and support","/faq"]]},
  {path:"/faq",title:"FAQ | Zyntra Healthcare Intelligence",description:"Zyntra Full Access pricing: A$39 monthly or A$99 every three months, with a 7-day trial and A$1 card check. Review cancellation terms.",heading:"Frequently asked questions",paragraphs:["Zyntra offers Full Access with monthly or three-month billing. Both options include a 7-day trial and an A$1 card check today.","Review the pricing page and checkout for the selected plan, the subscription charge after the trial, and cancellation terms."],links:[["Pricing and billing","/pricing"],["Features","/features"],["Privacy","/privacy"],["Terms","/terms"]]},
  {path:"/pricing",title:"Pricing | Zyntra Healthcare Intelligence",description:"Zyntra Full Access costs A$39 per month or A$99 every three months after a 7-day trial. An A$1 card check applies today; review cancellation terms.",heading:"Zyntra pricing and subscription terms",paragraphs:["Choose Full Access monthly at A$39 per month or three-month billing at A$99 per three months. Both plans show a 7-day trial and an A$1 card check today.","After the trial, the selected subscription charge applies and renews until cancelled. Cancel during the trial to avoid the plan charge; review the checkout terms before subscribing."],links:[["Frequently asked questions","/faq"],["Sign in","/login"]]},
  {path:"/blog",title:"AMC Exam Prep Blog for IMGs | Zyntra",description:"AMC MCQ and clinical exam preparation for IMGs, with pacing advice and practical preparation guides checked against official AMC sources.",heading:"The exam conditions, not just the medicine",paragraphs:["Read practical guidance on AMC MCQ preparation, clinical exam stations, pacing and performance under exam conditions.","Articles are educational and do not replace official AMC guidance."],links:[["AMC MCQ preparation: train for the one-way exam","/blog/amc-part-1-mcq"],["AMC Clinical exam tips: train for the 8-minute clock","/blog/amc-part-2-osce"],["AMC pass rates: what the AMC publishes","/blog/amc-pass-rates-what-the-amc-publishes"]]},
  {path:"/blog/amc-part-1-mcq",title:"AMC MCQ Preparation: Train for the One-Way Exam | Zyntra",description:"AMC MCQ preparation for IMGs: understand the one-way exam format and train pacing, decision-making and answer changes.",heading:"AMC MCQ preparation: train for the one-way exam",paragraphs:["The AMC MCQ examination asks candidates to make a sequence of clinical decisions under time pressure. Preparation should include both medical knowledge and exam execution.","Use timed practice, review why each option fits or fails, and track whether answer changes help. Confirm current exam rules with the official AMC."],links:[["AMC exam preparation","/amc-exam-preparation"],["AMC Clinical exam tips","/blog/amc-part-2-osce"],["Official AMC MCQ examination page","https://www.amc.org.au/pathways/standard-pathway/amc-assessments/mcq-examination/"]]},
  {path:"/blog/amc-part-2-osce",title:"AMC Clinical Exam Tips: Train for the 8-Minute Clock | Zyntra",description:"AMC clinical exam tips for IMGs: practise station structure, time management, communication and recovery between stations.",heading:"AMC Clinical exam tips: train for the 8-minute clock",paragraphs:["AMC Clinical preparation involves demonstrating clinical reasoning and communication in structured stations, not just recalling facts.","Practise aloud against the station clock, review specific omissions and confirm the current format on the official AMC website."],links:[["AMC Clinical OSCE preparation","/amc-clinical-osce"],["AMC MCQ preparation","/blog/amc-part-1-mcq"],["Official AMC clinical examination page","https://www.amc.org.au/pathways/standard-pathway/amc-assessments/clinical-examination/"]]},
  {path:"/blog/amc-pass-rates-what-the-amc-publishes",title:"AMC Pass Rates: What the AMC Publishes | Zyntra",description:"A careful guide to AMC examination pass rates, official reporting and the limits of what published figures can tell candidates.",heading:"AMC pass rates: what the AMC publishes",paragraphs:["Pass-rate figures need context: examination pathway, candidate group, reporting period and the source of the data all matter.","Use AMC annual reports and official publications as the source of truth. Avoid treating a single rate as a prediction of an individual candidate's outcome."],links:[["AMC exam preparation","/amc-exam-preparation"],["AMC MCQ preparation","/blog/amc-part-1-mcq"],["Official AMC website","https://www.amc.org.au/"]]},
  {path:"/terms",title:"Terms of Use | Zyntra Healthcare Intelligence",description:"Read the terms governing access to Zyntra Healthcare Intelligence, account use, subscriptions and educational content.",heading:"Terms of use",paragraphs:["These terms describe the conditions for using Zyntra Healthcare Intelligence and its educational preparation tools.","For binding terms, subscription conditions and current policies, review the complete terms presented on the site before using the service."],links:[["Privacy policy","/privacy"],["Pricing and subscription terms","/pricing"],["Sign in","/login"]]},
  {path:"/privacy",title:"Privacy Policy | Zyntra Healthcare Intelligence",description:"Review Zyntra Healthcare Intelligence's privacy information and how personal information is handled when using the service.",heading:"Privacy policy",paragraphs:["Privacy information explains how personal information may be collected, used, stored and protected when using Zyntra.","Read the full privacy policy on the site for the applicable details and contact information."],links:[["Terms of use","/terms"],["Pricing","/pricing"],["Contact and support","/faq"]]}
];

function esc(value) {
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}
function setMeta(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error("Cannot set " + label + " in built HTML");
  return html.replace(pattern, replacement);
}
function makeHtml(route) {
  const canonical = origin + route.path;
  let html = template;
  html = setMeta(html, /<title>[^<]*<\/title>/i, "<title>" + esc(route.title) + "</title>", "title");
  html = setMeta(html, /<meta name="description" content="[^"]*"[^>]*>/i, '<meta name="description" content="' + esc(route.description) + '">', "description");
  html = setMeta(html, /<meta property="og:title" content="[^"]*"[^>]*>/i, '<meta property="og:title" content="' + esc(route.title) + '">', "og:title");
  html = setMeta(html, /<meta property="og:description" content="[^"]*"[^>]*>/i, '<meta property="og:description" content="' + esc(route.description) + '">', "og:description");
  html = setMeta(html, /<meta property="og:url" content="[^"]*"[^>]*>/i, '<meta property="og:url" content="' + esc(canonical) + '">', "og:url");
  html = setMeta(html, /<meta name="twitter:title" content="[^"]*"[^>]*>/i, '<meta name="twitter:title" content="' + esc(route.title) + '">', "twitter:title");
  html = setMeta(html, /<meta name="twitter:description" content="[^"]*"[^>]*>/i, '<meta name="twitter:description" content="' + esc(route.description) + '">', "twitter:description");
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?\s*>/i, '<link rel="canonical" href="' + esc(canonical) + '">');
  if (!html.includes('rel="canonical"')) html = html.replace("</head>", '<link rel="canonical" href="' + esc(canonical) + '"></head>');
  if (route.path === "/login") html = html.replace("</head>", '<meta name="robots" content="noindex, nofollow"></head>');
  const links = route.links.map(([label,href]) => '<li><a href="' + esc(href) + '">' + esc(label) + '</a></li>').join("");
  const paragraphs = route.paragraphs.map(p => "<p>" + esc(p) + "</p>").join("");
  const body = '<div id="crawler-shell"><header><p><strong><a href="/">Zyntra</a></strong></p></header><main><h1>' + esc(route.heading) + "</h1>" + paragraphs + "<nav aria-label=\"Related pages\"><ul>" + links + "</ul></nav></main></div>";
  const rootStart = html.indexOf('<div id="root">');
  const scriptStart = html.indexOf('<script type="module"', rootStart);
  const rootClose = html.lastIndexOf('</div>', scriptStart);
  if (rootStart < 0 || scriptStart < 0 || rootClose < rootStart) {
    throw new Error("Cannot safely replace crawler content while preserving the app entry point for " + route.path);
  }
  html = html.slice(0, rootStart) + '<div id="root">' + body + '</div>' + html.slice(rootClose + '</div>'.length);
  return html;
}
function writeAndValidate(route) {
  const dir = route.path === "/" ? dist : path.join(dist, route.path.slice(1));
  fs.mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, "index.html");
  const html = makeHtml(route);
  fs.writeFileSync(outputPath, html);
  const saved = fs.readFileSync(outputPath, "utf8");
  const checks = [
    ["route title", saved.includes("<title>" + esc(route.title) + "</title>")],
    ["route description", saved.includes('name="description" content="' + esc(route.description) + '"')],
    ["canonical URL", saved.includes('rel="canonical" href="' + esc(origin + route.path) + '"')],
    ["route heading", saved.includes("<h1>" + esc(route.heading) + "</h1>")],
    ["root element", saved.includes('<div id="root">')],
    ["app entry point", /<script type="module"[^>]*src="\/assets\/[^"]+\.js"[^>]*><\/script>/i.test(saved)],
  ];
  const failed = checks.filter((item) => !item[1]).map((item) => item[0]);
  if (failed.length) throw new Error("Prerender validation failed for " + route.path + ": " + failed.join(", "));
}
for (const route of routes) writeAndValidate(route);
const login = {path:"/login",title:"Sign In or Create Account | Zyntra",description:"Sign in to Zyntra to continue your AMC exam preparation, or create an account to start practising.",heading:"Sign in to Zyntra",paragraphs:["Sign in or create an account to access your preparation workspace. Practice and account features require authentication."],links:[["Pricing","/pricing"],["Privacy","/privacy"],["Terms","/terms"]]};
writeAndValidate(login);
console.log("Prerendered and validated " + (routes.length + 1) + " public route HTML documents.");
