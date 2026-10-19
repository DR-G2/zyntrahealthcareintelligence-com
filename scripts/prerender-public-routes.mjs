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
  {path:"/blog",title:"Zyntra Journal | AMC Exam Preparation",description:"Articles and practical guidance on AMC Part 1 MCQ preparation, AMC Clinical OSCE preparation and exam readiness for international medical graduates.",heading:"Zyntra journal",paragraphs:["Read practical articles about AMC exam preparation, the MCQ and Clinical examinations, and how to approach preparation as an international medical graduate.","Articles provide general educational information and do not replace official AMC guidance."],links:[["AMC Part 1 MCQ","/blog/amc-part-1-mcq"],["AMC Part 2 OSCE","/blog/amc-part-2-osce"],["AMC exam preparation","/amc-exam-preparation"]]}
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
  html = html.replace(/<div id="root">[\s\S]*?<\/body>/i, '<div id="root">' + body + '</div></body>');
  return html;
}
for (const route of routes) {
  const dir = route.path === "/" ? dist : path.join(dist, route.path.slice(1));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), makeHtml(route));
}
const login = {path:"/login",title:"Sign In or Create Account | Zyntra",description:"Sign in to Zyntra to continue your AMC exam preparation, or create an account to start practising.",heading:"Sign in to Zyntra",paragraphs:["Sign in or create an account to access your preparation workspace. Practice and account features require authentication."],links:[["Pricing","/pricing"],["Privacy","/privacy"],["Terms","/terms"]]};
const loginDir = path.join(dist, "login");
fs.mkdirSync(loginDir, {recursive:true});
fs.writeFileSync(path.join(loginDir,"index.html"), makeHtml(login));
console.log("Prerendered " + (routes.length + 1) + " public route HTML documents.");
