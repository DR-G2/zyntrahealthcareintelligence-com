import React, { useRef, type PointerEvent } from "react";
export type IntelligenceStage = "observe" | "diagnose" | "intervene" | "measure" | "adapt";
export const INTELLIGENCE_STAGES = [
 {id:"observe",title:"Observe",description:"Capture answers, timing, confidence and answer changes.",region:"hemispheres",regionLabel:"Cerebral hemispheres"},
 {id:"diagnose",title:"Diagnose",description:"Identify recurring performance and decision-making patterns.",region:"hemispheres",regionLabel:"Cerebral hemispheres"},
 {id:"intervene",title:"Intervene",description:"Select a targeted learning action based on available evidence.",region:"cord",regionLabel:"Brainstem and spinal cord"},
 {id:"measure",title:"Measure",description:"Evaluate subsequent performance and behavioural change.",region:"cord",regionLabel:"Brainstem and spinal cord"},
 {id:"adapt",title:"Adapt",description:"Use new evidence to inform the next training action.",region:"funnel",regionLabel:"Next best action funnel"},
] as const;
type Props={activeStage:IntelligenceStage;onStageSelect:(stage:IntelligenceStage)=>void};
export default function NeuralScene({activeStage,onStageSelect}:Props){
 const assemblyRef=useRef<HTMLDivElement>(null);
 const handlePointerMove=(event:PointerEvent<HTMLDivElement>)=>{
  if(event.pointerType!=="mouse"||!assemblyRef.current||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const r=event.currentTarget.getBoundingClientRect(),x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;
  assemblyRef.current.style.setProperty("--brain-rx",`${(-y*3).toFixed(2)}deg`);
  assemblyRef.current.style.setProperty("--brain-ry",`${(x*4).toFixed(2)}deg`);
 };
 const resetPointer=()=>{assemblyRef.current?.style.setProperty("--brain-rx","0deg");assemblyRef.current?.style.setProperty("--brain-ry","0deg");};
 const region=(activeStage==="observe"||activeStage==="diagnose")?"hemispheres":activeStage==="adapt"?"funnel":"cord";
 const regionName=region==="hemispheres"?"Cerebral hemispheres":region==="cord"?"Brainstem and spinal cord":"Next best action funnel";
 return <div className="zh-living-scene-wrap">
  <div className="zh-living-scene" onPointerMove={handlePointerMove} onPointerLeave={resetPointer}>
   <div className="zh-living-scene-caption"><span>ANATOMICAL INTELLIGENCE</span><span>DEMO</span></div>
   <div className="zh-living-assembly" ref={assemblyRef}>
    <svg viewBox="0 0 560 500" className="zh-living-svg" role="img" aria-labelledby="living-brain-title living-brain-desc">
     <title id="living-brain-title">Zyntra Living Brain</title><desc id="living-brain-desc">Two detailed cerebral hemispheres connect through a brainstem and continuous spinal cord into a translucent glass funnel labelled Next Best Action.</desc>
     <defs><linearGradient id="lb-cortex" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f8fbff"/><stop offset=".52" stopColor="#d4e8ee"/><stop offset="1" stopColor="#a6cbd6"/></linearGradient><linearGradient id="lb-stem" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#27e2ef"/><stop offset=".5" stopColor="#eafcff"/><stop offset="1" stopColor="#36bfe7"/></linearGradient><linearGradient id="lb-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#27e2ef" stopOpacity=".28"/><stop offset=".48" stopColor="#8298ad" stopOpacity=".42"/><stop offset="1" stopColor="#087d7d" stopOpacity=".16"/></linearGradient></defs>
     <g className={`lb-region lb-hemispheres ${region==="hemispheres"?"is-highlighted":""}`} onPointerEnter={() => onStageSelect(activeStage === "diagnose" ? "diagnose" : "observe")}>
      <path className="lb-cortex" d="M278 81C258 54 225 47 202 61C180 43 150 56 146 78C119 73 99 93 105 117C81 132 85 158 105 171C94 195 113 215 136 211C146 235 177 240 194 220C220 238 248 219 254 199L278 178Z"/>
      <path className="lb-cortex" d="M282 81C302 54 335 47 358 61C380 43 410 56 414 78C441 73 461 93 455 117C479 132 475 158 455 171C466 195 447 215 424 211C414 235 383 240 366 220C340 238 312 219 306 199L282 178Z"/>
      <path className="lb-midline" d="M280 63C274 98 286 128 280 171"/>
      <g className="lb-folds"><path d="M135 103C157 85 181 98 177 116S146 137 157 154S191 170 185 192"/><path d="M111 143C132 130 151 144 143 163S124 183 145 198"/><path d="M160 70C179 86 205 77 212 95S194 124 216 136S240 144 233 169"/><path d="M197 59C211 76 228 78 234 94S224 114 245 126"/><path d="M425 103C403 85 379 98 383 116S414 137 403 154S369 170 375 192"/><path d="M449 143C428 130 409 144 417 163S436 183 415 198"/><path d="M400 70C381 86 355 77 348 95S366 124 344 136S320 144 327 169"/><path d="M363 59C349 76 332 78 326 94S336 114 315 126"/></g>
      <g className="lb-fine-folds"><path d="M151 119Q174 104 189 120T216 145M127 174Q149 159 166 178T193 203M192 91Q208 103 199 119M409 119Q386 104 371 120T344 145M433 174Q411 159 394 178T367 203M368 91Q352 103 361 119"/></g>
     </g>
     <g className={`lb-region lb-cord ${region==="cord"?"is-highlighted":""}`} onPointerEnter={() => onStageSelect(activeStage === "measure" ? "measure" : "intervene")}><path className="lb-stem-shape" d="M248 187C249 211 238 225 245 245C250 261 262 271 264 291L264 364Q280 376 296 364L296 291C298 271 310 261 315 245C322 225 311 211 312 187C295 205 265 205 248 187Z"/><path className="lb-cord-core" d="M280 218C276 243 284 262 280 282L280 380"/><path className="lb-cord-edge" d="M267 277C270 301 269 330 270 365M293 277C290 301 291 330 290 365"/><path className="lb-signal" d="M280 112C280 166 280 218 280 267S280 335 280 405"/></g>
     <g className={`lb-region lb-funnel ${region==="funnel"?"is-highlighted":""}`} onPointerEnter={() => onStageSelect("adapt")}><path className="lb-funnel-glass" d="M239 370Q280 389 321 370L303 423Q280 438 257 423Z"/><path className="lb-funnel-rim" d="M239 370Q280 389 321 370"/><path className="lb-funnel-edge" d="M239 370L257 423Q280 438 303 423L321 370"/><path className="lb-funnel-base" d="M257 423Q280 438 303 423"/><text x="280" y="399" textAnchor="middle" className="lb-funnel-label">NEXT BEST</text><text x="280" y="412" textAnchor="middle" className="lb-funnel-label">ACTION</text></g>
     <g className="lb-plate-labels"><path d="M94 112H55V101"/><text x="53" y="91" textAnchor="start">OBSERVE</text><path d="M466 112H505V101"/><text x="507" y="91" textAnchor="end">DIAGNOSE</text><path d="M265 320H202V307"/><text x="198" y="297" textAnchor="end">EVIDENCE</text><path d="M295 400H365V389"/><text x="369" y="380" textAnchor="start">NEXT STEP</text></g>
    </svg>
   </div>
   <div className="zh-living-scene-footer"><span className="zh-living-status-dot"/><span>{regionName}</span><span className="zh-living-footer-sep">·</span><span>Connected evidence pathway</span></div>
  </div><p className="zh-living-scene-help">Select a stage below to follow how evidence moves through the learning loop.</p>
 </div>;
}
