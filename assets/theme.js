// Light/dark theme. Loaded in <head> (not deferred) so the saved theme applies before first paint.
// "auto" follows the system setting via prefers-color-scheme; "light"/"dark" override it.
(function(){
const KEY="vb:theme",ORDER=["auto","light","dark"];
const LABEL={auto:"Auto",light:"Light",dark:"Dark"};
const ICON={
  auto:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  light:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>'
};
const get=()=>{try{const v=localStorage.getItem(KEY);return ORDER.includes(v)?v:"auto"}catch(e){return "auto"}};
const apply=t=>{const r=document.documentElement;if(t==="auto")r.removeAttribute("data-theme");else r.setAttribute("data-theme",t)};
let cur=get();apply(cur);
function paint(btn){const t=cur;btn.innerHTML=ICON[t]+`<span>${LABEL[t]}</span>`;
  btn.setAttribute("aria-label",`Color theme: ${LABEL[t]}${t==="auto"?" (follows your device)":""}. Click to change.`)}
document.addEventListener("DOMContentLoaded",()=>{
  const btn=document.getElementById("themebtn");if(!btn)return;paint(btn);
  btn.addEventListener("click",()=>{cur=ORDER[(ORDER.indexOf(cur)+1)%ORDER.length];
    try{localStorage.setItem(KEY,cur)}catch(e){}apply(cur);paint(btn)});
});
})();
