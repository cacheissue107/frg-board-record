// Fox River Grove Board Record. Loads data/meetings.json, then renders four views
// (Meetings / Storylines / Topic map / Votes) with a filter rail. All view state lives
// in the URL query string so any filtered view can be shared and the back button works.
(function(){
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TABS=["meetings","stories","map","votes"];
const DATA_URL="data/meetings.json";

// --- loading
function showError(err){
  const local=location.protocol==="file:";
  $("#view-meetings").setAttribute("aria-busy","false");
  $("#view-meetings").innerHTML=`<div class="status error" role="alert"><h2>The meeting data didn't load</h2>
    <p>${local?"Browsers block this page from reading its data file when it's opened straight from your computer. Start a local preview instead (see the README: <code>python3 -m http.server</code>) and open <code>http://localhost:8000</code>.":"Something went wrong fetching the meeting list. Check your connection and try again."}</p>
    <button type="button" class="btn" id="retry">Try again</button></div>`;
  $("#retry").onclick=()=>{$("#view-meetings").innerHTML=`<div class="status"><span class="spinner" aria-hidden="true"></span>Loading meetings&hellip;</div>`;load()};
  console.error(err);
}
function load(){
  fetch(DATA_URL,{cache:"no-cache"})
    .then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()})
    .then(init,showError);
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",load):load();

function init(DATA){
$("#view-meetings").setAttribute("aria-busy","false");
document.body.classList.remove("is-loading");
const rows=(DATA&&DATA.rows||[]).map((r,i)=>({...r,i,y:String(r.d).slice(0,4),tags:String(r.g||"").split(";").map(t=>t.trim()).filter(Boolean)}));
const about=Object.fromEntries((DATA&&DATA.about||[]).map(a=>[a[0],a[1]]));

// --- board members from "Board (YYYY)" rows
// Minutes name members by surname only, and two different people can share one (Patrick and
// Kirsten Wall). So members are keyed by full name, and notes like "(through April)" or
// "(from May 2)" give each person's dates that year; a surname is resolved per meeting date.
const MONTHS=["january","february","march","april","may","june","july","august","september","october","november","december"];
const members=new Map(); // full name -> {full, sur, years:Set, role, spans:{year:[from,to]}}
Object.entries(about).filter(([k])=>/^Board \(\d{4}\)$/.test(k)).sort().forEach(([k,v])=>{
  const yr=k.match(/\d{4}/)[0];
  const add=(raw,role)=>{const full=raw.replace(/\(.*?\)/g,"").trim();if(!full)return;
    if(!members.has(full))members.set(full,{full,sur:full.split(/\s+/).pop(),years:new Set(),role,spans:{}});
    const m=members.get(full);m.years.add(yr);if(role==="President")m.role=role;
    let from=yr+"-01-01",to=yr+"-12-31";
    (raw.match(/\(([^)]*)\)/)||["",""])[1].replace(/\b(through|from)\s+([A-Za-z]+)(?:\s+(\d{1,2}))?/gi,(_,w,mon,day)=>{
      const mi=MONTHS.indexOf(mon.toLowerCase());if(mi<0)return;const mm=String(mi+1).padStart(2,"0");
      if(w.toLowerCase()==="from")from=`${yr}-${mm}-${String(day||1).padStart(2,"0")}`;else to=`${yr}-${mm}-${String(day||31).padStart(2,"0")}`;});
    m.spans[yr]=[from,to];};
  const pres=v.match(/President\s+([A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+)+)/);if(pres)add(pres[1],"President");
  const tr=v.match(/Trustees?\s+([^;]+)/);if(tr)tr[1].split(",").forEach(n=>add(n,"Trustee"));
});
const bySur={};members.forEach(m=>(bySur[m.sur]=bySur[m.sur]||[]).push(m));
// Label: plain surname when unique, "K. Wall" style when two members share it.
members.forEach(m=>m.label=bySur[m.sur].length>1?m.full[0]+". "+m.sur:m.sur);
function resolve(sur,date){const c=bySur[sur]||[];if(c.length<2)return c[0]&&c[0].label;const y=date.slice(0,4);
  const hit=c.find(m=>m.spans[y]&&date>=m.spans[y][0]&&date<=m.spans[y][1])||c.find(m=>m.years.has(y))||c[0];return hit.label}
const names=Object.keys(bySur);
const NAMES=names.join("|")||"ZZZZ";
const listRe=`((?:\\b(?:${NAMES})\\b(?:\\s*,\\s*|\\s+and\\s+|\\s*&\\s*))*\\b(?:${NAMES})\\b)`;
const noRe=new RegExp(listRe+`\\s*(?:[-\\u2013:]\\s*)?["\\u201c']?no\\b`,"g");
const absRe=new RegExp(listRe+`\\s+(?:was\\s+|were\\s+)?absent`,"g");
const pull=(re,txt)=>{const out=[];let m;re.lastIndex=0;while((m=re.exec(txt))){m[1].split(/\s*,\s*|\s+and\s+|\s*&\s*/).forEach(n=>{n=n.trim();if(names.includes(n))out.push(n)})}return out};
rows.forEach(r=>{
  r.no=pull(noRe,r.o||"").map(n=>resolve(n,r.d));r.abs=[...new Set(pull(absRe,r.o||"").map(n=>resolve(n,r.d)))];
  r.split=r.no.length>0||/\b[1-9]-[1-9](?:-\d)?\b/.test(r.o||"")||/deadlock/i.test(r.o||"")||/\bFAILED\b/.test(r.o||"");
  r.hay=[r.d,r.t,r.s,r.a,r.o,r.p,r.g].join(" ").toLowerCase();
});

// --- state
const S={tab:"meetings",q:"",years:new Set(),topics:new Set(),split:false,hideCancelled:true,pc:false,sort:"desc",quarter:null,member:null,allTopics:false};

// --- URL <-> state. Defaults are left out so plain links stay short.
//   ?tab=votes&q=water&year=2025&topic=Block%20B&split=1&pc=1&cancelled=show&sort=asc&quarter=2025-Q3&no=Knar|absent=Curtiss
function readURL(){
  const p=new URLSearchParams(location.search);
  let tab=p.get("tab");
  if(!TABS.includes(tab)){const h=location.hash.replace("#","");tab=TABS.includes(h)?h:"meetings"}
  S.tab=TABS.includes(tab)?tab:"meetings";
  S.q=(p.get("q")||"").trim();
  S.years=new Set(p.getAll("year").filter(y=>/^\d{4}$/.test(y)));
  S.topics=new Set(p.getAll("topic").filter(Boolean));
  S.split=p.get("split")==="1";S.pc=p.get("pc")==="1";
  S.hideCancelled=p.get("cancelled")!=="show";
  S.sort=p.get("sort")==="asc"?"asc":"desc";
  S.quarter=/^\d{4}-Q[1-4]$/.test(p.get("quarter")||"")?p.get("quarter"):null;
  S.member=p.get("no")?{n:p.get("no"),k:"no"}:p.get("absent")?{n:p.get("absent"),k:"abs"}:null;
}
function urlFor(){
  const p=new URLSearchParams();
  if(S.tab!=="meetings")p.set("tab",S.tab);
  if(S.q)p.set("q",S.q);
  [...S.years].sort().forEach(y=>p.append("year",y));
  [...S.topics].forEach(t=>p.append("topic",t));
  if(S.split)p.set("split","1");if(S.pc)p.set("pc","1");
  if(!S.hideCancelled)p.set("cancelled","show");
  if(S.sort==="asc")p.set("sort","asc");
  if(S.quarter)p.set("quarter",S.quarter);
  if(S.member)p.set(S.member.k==="no"?"no":"absent",S.member.n);
  const qs=p.toString().replace(/\+/g,"%20");
  return location.pathname+(qs?"?"+qs:"");
}
// push = new history entry (filter/tab changes); replace = refine current entry (search typing)
function syncURL(mode){
  const url=urlFor();if(url===location.pathname+location.search&&!location.hash)return;
  try{history[mode==="replace"?"replaceState":"pushState"](null,"",url)}catch(e){}
}
readURL();

// --- header stats
const held=rows.filter(r=>r.s!=="Cancelled");
const yrs=[...new Set(rows.map(r=>r.y))].sort();
$("#stats").innerHTML=[
  [held.length,"meetings held"],[rows.filter(r=>r.split).length,"with split votes"],
  [rows.filter(r=>r.p&&r.p!=="None."&&r.s!=="Cancelled").length,"with public comment"],
  [yrs.length?yrs[0]+"–"+yrs[yrs.length-1].slice(2):"–","years covered"]
].map(([n,l])=>`<div class="stat"><b>${n}</b><small>${l}</small></div>`).join("");
$("#foot-src").innerHTML=`Source: <a href="${esc(about.Source||"#")}" target="_blank" rel="noopener">foxrivergrove.org</a> &middot; Last checked ${esc(about["Last checked"]||"")}${about["Backfill status"]?" &middot; "+esc(about["Backfill status"]):""}`;
if(DATA.updated){const d=new Date(DATA.updated);
  if(!isNaN(d))$("#foot-updated").innerHTML=`Data updated <time datetime="${esc(DATA.updated)}">${d.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}</time>`;}

// --- filter controls
const tagCount={};rows.forEach(r=>r.tags.forEach(t=>tagCount[t]=(tagCount[t]||0)+1));
const tagsSorted=Object.keys(tagCount).sort((a,b)=>tagCount[b]-tagCount[a]||a.localeCompare(b));
function renderChips(){
  $("#years").innerHTML=yrs.slice().reverse().map(y=>{const n=rows.filter(r=>r.y===y&&r.s!=="Cancelled").length;
    return `<button type="button" class="chip" data-year="${y}" aria-pressed="${S.years.has(y)}" aria-label="${y}, ${n} meetings">${y}<span class="n" aria-hidden="true">${n}</span></button>`}).join("");
  const list=S.allTopics?tagsSorted:tagsSorted.slice(0,16).concat([...S.topics].filter(t=>tagsSorted.indexOf(t)>=16));
  $("#topics").innerHTML=list.map(t=>`<button type="button" class="chip" data-topic="${esc(t)}" aria-pressed="${S.topics.has(t)}" aria-label="${esc(t)}, ${tagCount[t]} meetings">${esc(t)}<span class="n" aria-hidden="true">${tagCount[t]}</span></button>`).join("");
  $("#moreTopics").textContent=S.allTopics?"Show fewer topics":`Show all ${tagsSorted.length} topics`;
  $("#moreTopics").setAttribute("aria-expanded",S.allTopics);
  $("#splitOnly").checked=S.split;$("#hideCancelled").checked=S.hideCancelled;$("#pcOnly").checked=S.pc;
  if($("#q").value.trim()!==S.q)$("#q").value=S.q;
}
// Re-rendering the chips replaces the buttons, so put keyboard focus back on the one just pressed.
function refocus(sel){const el=document.querySelector(sel);if(el)el.focus();return !!el}
$("#years").addEventListener("click",e=>{const b=e.target.closest("[data-year]");if(!b)return;const y=b.dataset.year;S.years.has(y)?S.years.delete(y):S.years.add(y);showFiltered();go();refocus(`[data-year="${y}"]`)});
$("#topics").addEventListener("click",e=>{const b=e.target.closest("[data-topic]");if(!b)return;const t=b.dataset.topic;toggleTopic(t);refocus(`#topics [data-topic="${CSS.escape(t)}"]`)});
$("#moreTopics").onclick=()=>{S.allTopics=!S.allTopics;renderChips()};
$("#splitOnly").onchange=e=>{S.split=e.target.checked;showFiltered();go()};
$("#hideCancelled").onchange=e=>{S.hideCancelled=e.target.checked;showFiltered();go()};
$("#pcOnly").onchange=e=>{S.pc=e.target.checked;showFiltered();go()};
$("#reset").onclick=()=>{S.q="";$("#q").value="";S.years.clear();S.topics.clear();S.split=false;S.pc=false;S.hideCancelled=true;S.quarter=null;S.member=null;go()};
// The first keystroke of a search adds a history entry; the rest of the typing refines it.
let qt,typing=false;
$("#q").addEventListener("input",e=>{clearTimeout(qt);qt=setTimeout(()=>{S.q=e.target.value.trim();if(S.q&&S.tab!=="meetings")setTab("meetings");go(typing?"replace":"push");typing=true},120)});
$("#q").addEventListener("blur",()=>{typing=false});
$("#railtoggle").onclick=()=>{const r=$("#rail");r.classList.toggle("collapsed");$("#railtoggle").setAttribute("aria-expanded",!r.classList.contains("collapsed"))};
if(matchMedia("(max-width:860px)").matches){$("#rail").classList.add("collapsed");$("#railtoggle").setAttribute("aria-expanded","false")}
function toggleTopic(t){S.topics.has(t)?S.topics.delete(t):S.topics.add(t);showFiltered();go()}
// Storylines and Topic map don't follow the filters, so changing a filter there jumps to Meetings; Meetings and Votes update in place.
function showFiltered(){if(S.tab==="stories"||S.tab==="map")setTab("meetings")}

// --- tabs (WAI-ARIA tabs pattern: arrow keys move between tabs, only the active tab is in the Tab order)
const tabBtns=[...document.querySelectorAll(".tab")];
tabBtns.forEach(b=>b.onclick=()=>{if(S.tab!==b.dataset.tab){setTab(b.dataset.tab);syncURL("push")}});
$(".tabs").addEventListener("keydown",e=>{
  const i=tabBtns.indexOf(document.activeElement);if(i<0)return;
  const k={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:tabBtns.length-1}[e.key];if(k===undefined)return;
  e.preventDefault();const b=tabBtns[(k+tabBtns.length)%tabBtns.length];b.focus();b.click();
});
function setTab(t){S.tab=t;
  tabBtns.forEach(b=>{const on=b.dataset.tab===t;b.setAttribute("aria-selected",on);b.tabIndex=on?0:-1});
  TABS.forEach(v=>$("#view-"+v).hidden=v!==t);}

// --- filtering
const qOf=r=>{const d=new Date(r.d+"T12:00");return r.y+"-Q"+(Math.floor(d.getMonth()/3)+1)};
function filtered(opts={}){
  const terms=S.q.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(r=>{
    if(S.hideCancelled&&r.s==="Cancelled"&&!terms.length)return false;
    if(S.years.size&&!S.years.has(r.y))return false;
    if(S.topics.size&&![...S.topics].every(t=>r.tags.includes(t)))return false;
    if(S.split&&!r.split)return false;
    if(S.pc&&(!r.p||r.p==="None."))return false;
    if(S.quarter&&qOf(r)!==S.quarter)return false;
    if(S.member&&!opts.anyMember&&!(r.no.includes(S.member.n)&&S.member.k==="no"||r.abs.includes(S.member.n)&&S.member.k==="abs"))return false;
    return terms.every(t=>r.hay.includes(t));
  });
}
// Highlight on the raw text, then escape each piece, so a search like "amp" can't break "&amp;".
function hl(s){s=String(s??"");const terms=S.q.split(/\s+/).filter(t=>t.length>1);if(!terms.length)return esc(s);
  const re=new RegExp("("+terms.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")+")","gi");
  return s.split(re).map((part,i)=>i%2?`<mark>${esc(part)}</mark>`:esc(part)).join("")}

// --- meetings view
function meetingCard(r){
  const d=new Date(r.d+"T12:00");const m=MON[d.getMonth()],day=d.getDate();
  const dates=`<div class="datebox"><div class="m">${m}</div><div class="d">${day}</div><div class="y">${r.y}</div></div>`;
  const label=`${MON[d.getMonth()]} ${day}, ${r.y}`;
  const docs=[["Agenda",r.ag],["Packet",r.pk],["Minutes",r.mn]].filter(x=>x[1]).map(([l,u])=>{const t=r.s==="Cancelled"&&l==="Agenda"?"Notice":l;
    return `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="${t} PDF, ${label} (opens in new tab)">${t}</a>`}).join("");
  if(r.s==="Cancelled")return `<article class="mtg cancelled" aria-label="${label}, cancelled">${dates}<div><div class="mhead"><span class="pill cancel">Cancelled</span><span class="pill">${esc(r.t)}</span></div><div class="docs">${docs}</div></div></article>`;
  const pills=[r.t&&r.t!=="Regular"?`<span class="pill special">${esc(r.t)}</span>`:`<span class="pill">Regular</span>`,
    r.split?`<span class="pill split">Split vote</span>`:"",r.k==="Pending"?`<span class="pill pending">Minutes pending</span>`:""].join("");
  const pc=r.p&&r.p!=="None."&&r.p.trim()?`<details class="sec"${S.q&&r.p.toLowerCase().includes(S.q.toLowerCase())?" open":""}><summary>Public comment</summary><p>${hl(r.p)}</p></details>`:"";
  const dis=r.no.length?`<span class="dissent">No votes: ${esc([...new Set(r.no)].join(", "))}</span>`:"";
  const absn=r.abs.length?`<span class="dissent" style="color:var(--muted)">Absent: ${esc(r.abs.join(", "))}</span>`:"";
  return `<article class="mtg" aria-label="${label} meeting">${dates}<div style="min-width:0">
    <div class="mhead">${pills}${dis}${absn}</div>
    <div class="sec"><h4>On the agenda</h4><p>${hl(r.a)}</p></div>
    ${r.o?`<div class="sec"><h4>What happened</h4><p>${hl(r.o)}</p></div>`:""}
    ${pc}
    <div class="mfoot"><div class="tags">${r.tags.map(t=>`<button type="button" class="tag" data-tag="${esc(t)}" aria-label="Filter by topic: ${esc(t)}">${esc(t)}</button>`).join("")}</div><div class="docs">${docs}</div></div>
  </div></article>`;
}
function renderMeetings(){
  if(!rows.length){$("#view-meetings").innerHTML=`<div class="empty">No meetings in the tracker yet.</div>`;return}
  const list=filtered().sort((a,b)=>S.sort==="desc"?b.d.localeCompare(a.d):a.d.localeCompare(b.d));
  const act=[...[...S.years].map(y=>["year",y,y]),...[...S.topics].map(t=>["topic",t,t]),
    S.quarter?["quarter",S.quarter,S.quarter.replace("-"," ")]:null,S.member?["member",S.member.n,(S.member.k==="no"?"No votes: ":"Absent: ")+S.member.n]:null,
    S.split?["split","","Split votes"]:null,S.pc?["pc","","Public comment"]:null,!S.hideCancelled?["cancelled","","Including cancelled"]:null].filter(Boolean);
  let html=`<div class="resultbar"><div class="active-filters"><span role="status">${list.filter(r=>r.s!=="Cancelled").length} meetings${S.q?` matching “${esc(S.q)}”`:""}</span>${act.map(([k,v,l])=>`<button type="button" class="chip" data-clear="${k}" data-v="${esc(v)}" aria-label="Remove filter: ${esc(l)}">${esc(l)} <span aria-hidden="true">×</span></button>`).join("")}</div>
    <label>Order <select id="sort"><option value="desc"${S.sort==="desc"?" selected":""}>Newest first</option><option value="asc"${S.sort==="asc"?" selected":""}>Oldest first</option></select></label></div>`;
  if(!list.length)html+=`<div class="empty">No meetings match these filters. <button type="button" class="linkbtn" id="reset2">Clear filters</button></div>`;
  let cur="";const groups=[];
  list.forEach(r=>{if(r.y!==cur){cur=r.y;groups.push([cur,[]])}groups[groups.length-1][1].push(r)});
  html+=groups.map(([y,rs])=>`<h2 class="yearhead">${y}<small>${rs.filter(r=>r.s!=="Cancelled").length} held</small></h2><div class="list">${rs.map(meetingCard).join("")}</div>`).join("");
  const v=$("#view-meetings");v.innerHTML=html;
  const so=$("#sort");if(so)so.onchange=e=>{S.sort=e.target.value;renderMeetings();syncURL("push");refocus("#sort")};
  const r2=$("#reset2");if(r2)r2.onclick=()=>$("#reset").click();
}
$("#view-meetings").addEventListener("click",e=>{
  const t=e.target.closest("[data-tag]");if(t){if(!S.topics.has(t.dataset.tag))toggleTopic(t.dataset.tag);return}
  const c=e.target.closest("[data-clear]");if(!c)return;const k=c.dataset.clear,v=c.dataset.v;
  if(k==="year")S.years.delete(v);if(k==="topic")S.topics.delete(v);if(k==="quarter")S.quarter=null;if(k==="member")S.member=null;if(k==="split")S.split=false;if(k==="pc")S.pc=false;if(k==="cancelled")S.hideCancelled=true;go();
  // the chip that had focus is gone; keep keyboard users in the result bar
  refocus("#view-meetings [data-clear]")||refocus("#sort");
});

// --- storylines
function matchTag(name){const n=name.toLowerCase();
  let best=tagsSorted.find(t=>n.includes(t.toLowerCase())&&t.length>3);
  if(!best)best=tagsSorted.find(t=>t.toLowerCase().split(/[\s/]+/).some(w=>w.length>4&&n.includes(w)));return best||null}
function renderStories(){
  const tp=(DATA&&DATA.topics)||[];
  $("#view-stories").innerHTML=`<p class="note" style="margin:0 0 14px">The long-running issues, year by year. Pick one to see every meeting where it came up.</p><div class="stories">${tp.map(([name,what,tl,open])=>{
    const parts=String(tl||"").split(/(?:^|\s)(20\d\d):\s*/).filter(s=>s!=="");const segs=[];
    for(let i=0;i<parts.length;i++){if(/^20\d\d$/.test(parts[i])){segs.push([parts[i],parts[i+1]||""]);i++}else if(parts[i].trim())segs.push(["",parts[i]])}
    const tag=matchTag(name);
    return `<article class="story"><h3>${esc(name)}</h3>${what?`<p class="what">${esc(what)}</p>`:""}
      <div class="tl">${segs.map(([y,t])=>`<div>${y?`<div class="yr">${y}</div>`:""}<ul>${t.split(/;\s+(?=[^)]*(?:\(|$))/).map(s=>s.trim().replace(/\.$/,"")).filter(Boolean).map(s=>`<li>${esc(s)}</li>`).join("")}</ul></div>`).join("")}</div>
      ${open?`<div class="open"><b>Still open</b>${esc(open)}</div>`:""}
      ${tag?`<button type="button" class="chip more" data-story-tag="${esc(tag)}">See ${tagCount[tag]} meetings tagged “${esc(tag)}” <span aria-hidden="true">→</span></button>`:""}
    </article>`}).join("")}</div>`;
}
$("#view-stories").addEventListener("click",e=>{const b=e.target.closest("[data-story-tag]");if(!b)return;S.topics.clear();S.topics.add(b.dataset.storyTag);setTab("meetings");go();window.scrollTo({top:0});focusResults()});

// --- topic map (heatmap). A grid with one tab stop; arrow keys move between cells, Enter/Space opens.
function renderMap(){
  const qs=[];yrs.forEach(y=>[1,2,3,4].forEach(q=>qs.push(y+"-Q"+q)));
  const lastQ=rows.length?qOf(rows.reduce((a,b)=>a.d>b.d?a:b)):null;const qList=qs.slice(0,qs.indexOf(lastQ)+1);
  const top=tagsSorted.slice(0,22);const cnt={};let max=1;
  rows.forEach(r=>{const q=qOf(r);r.tags.forEach(t=>{const k=t+"|"+q;cnt[k]=(cnt[k]||0)+1;max=Math.max(max,cnt[k])})});
  const h=n=>(n/max).toFixed(3);
  let first=true;
  $("#view-map").innerHTML=`<p class="note" id="map-help" style="margin:0 0 14px">When each topic came up, by quarter. Darker means more meetings. Click a square to see those meetings. With a keyboard, Tab into the grid, use the arrow keys to move, and press Enter to open.</p>
  <div class="heatwrap"><table class="heat" role="grid" aria-label="Topics by quarter" aria-describedby="map-help"><thead><tr><th scope="col"><span class="sr-only">Topic</span></th>${qList.map(q=>`<th scope="col" title="${q}" aria-label="${q.replace("-"," ")}">${q.endsWith("Q1")?q.slice(0,4):""}<br>${q.slice(-2)}</th>`).join("")}</tr></thead><tbody>
  ${top.map(t=>`<tr><th class="row" scope="row">${esc(t)}</th>${qList.map(q=>{const n=cnt[t+"|"+q]||0;const lab=`${esc(t)}, ${q.replace("-"," ")}: ${n} meeting${n===1?"":"s"}`;
    const ti=n&&first?(first=false,0):-1;
    return `<td class="${n?"has":""}"${n?` style="--h:${h(n)}"`:""} tabindex="${ti}" data-t="${esc(t)}" data-q="${q}" title="${lab}" aria-label="${lab}"${n?"":` aria-disabled="true"`}>${n||""}</td>`}).join("")}</tr>`).join("")}
  </tbody></table>
  <div class="legend" aria-hidden="true">Fewer <i style="--h:${h(1)}"></i><i style="--h:${h(Math.ceil(max/2))}"></i><i style="--h:1"></i> More &middot; Top ${top.length} topics shown</div></div>`;
}
function openCell(c){if(!c||!c.classList.contains("has"))return;
  S.topics.clear();S.topics.add(c.dataset.t);S.quarter=c.dataset.q;S.years.clear();setTab("meetings");go();window.scrollTo({top:0});focusResults()}
$("#view-map").addEventListener("click",e=>openCell(e.target.closest("td[data-t]")));
$("#view-map").addEventListener("keydown",e=>{
  const c=e.target.closest("td[data-t]");if(!c)return;
  if(e.key==="Enter"||e.key===" "){e.preventDefault();openCell(c);return}
  const tr=c.parentElement,rowsEl=[...tr.parentElement.children],ri=rowsEl.indexOf(tr),cells=[...tr.querySelectorAll("td[data-t]")],ci=cells.indexOf(c);
  let r=ri,k=ci;
  switch(e.key){case"ArrowRight":k++;break;case"ArrowLeft":k--;break;case"ArrowDown":r++;break;case"ArrowUp":r--;break;
    case"Home":k=0;if(e.ctrlKey)r=0;break;case"End":k=cells.length-1;if(e.ctrlKey)r=rowsEl.length-1;break;default:return}
  e.preventDefault();
  r=Math.max(0,Math.min(rowsEl.length-1,r));const row=[...rowsEl[r].querySelectorAll("td[data-t]")];k=Math.max(0,Math.min(row.length-1,k));
  const next=row[k];if(next===c)return;c.tabIndex=-1;next.tabIndex=0;next.focus();
});

// --- votes & attendance
const activeOn=(m,date)=>{const sp=m.spans[date.slice(0,4)];return !!sp&&date>=sp[0]&&date<=sp[1]};
function renderVotes(){
  const vr=filtered({anyMember:true}).filter(r=>r.s!=="Cancelled");
  // members on the board for at least one of these meetings
  const serving=[...members.values()].filter(m=>vr.some(r=>activeOn(m,r.d)));
  const noC={},absC={};serving.forEach(m=>{noC[m.label]=0;absC[m.label]=0});
  vr.forEach(r=>{new Set(r.no).forEach(n=>noC[n]=(noC[n]||0)+1);r.abs.forEach(n=>absC[n]=(absC[n]||0)+1)});
  const bars=(obj,cls,k)=>{const e=Object.entries(obj).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));const mx=Math.max(1,...e.map(x=>x[1]));
    return e.length?e.map(([n,c])=>{const inner=`<span>${esc(n)}</span><span class="track" aria-hidden="true"><span class="fill" style="display:block;width:${100*c/mx}%"></span></span><span class="num" aria-hidden="true">${c}</span>`;
      return c?`<button type="button" class="bar ${cls}" data-member="${esc(n)}" data-kind="${k}" aria-label="${esc(n)}: ${c} meeting${c===1?"":"s"}. Show them.">${inner}</button>`
        :`<div class="bar ${cls} zero" aria-label="${esc(n)}: none">${inner}</div>`}).join(""):`<p class="note">None recorded.</p>`};
  const ms=serving.sort((a,b)=>(a.role==="President"?-1:0)-(b.role==="President"?-1:0)||a.sur.localeCompare(b.sur)||a.full.localeCompare(b.full));
  const splits=vr.filter(r=>r.split).length;
  const scope=[S.years.size?[...S.years].sort().join(", "):"",S.quarter?S.quarter.replace("-"," "):"",...S.topics,
    S.split?"split votes only":"",S.pc?"with public comment":"",S.q?`matching “${esc(S.q)}”`:""].filter(Boolean);
  const scopeLine=`<div class="resultbar"><span role="status">${scope.length?`Counting ${vr.length} meeting${vr.length===1?"":"s"}: ${scope.map(esc).join(" &middot; ")}`:`Counting all ${vr.length} meetings`}</span>${scope.length?`<button type="button" class="linkbtn" data-votes-reset>Clear filters</button>`:""}</div>`;
  if(!vr.length){$("#view-votes").innerHTML=scopeLine+`<div class="empty">No meetings match these filters.</div>`;return}
  $("#view-votes").innerHTML=scopeLine+`<div class="votegrid">
    <div class="card"><h3>Who votes no</h3><p class="sub">Meetings where each member cast at least one recorded no vote. ${splits} of ${vr.length} meetings had a split vote. Click a name to see those meetings.</p>${bars(noC,"","no")}</div>
    <div class="card"><h3>Absences</h3><p class="sub">Meetings where the minutes list each member as absent.</p>${bars(absC,"abs","abs")}</div>
    <div class="card"><h3>The board</h3><p class="sub">Members serving during ${scope.length?"these":"the recorded"} meetings, with the years they appear.</p><div class="roster">${ms.map(m=>`<div><b>${m.role==="President"?"Pres.":"Trustee"}</b><span>${esc(m.full)} <span class="note" style="margin:0">(${[...m.years].sort().join(", ")})</span></span></div>`).join("")}</div></div>
  </div><p class="note">Counts are pulled automatically from the meeting summaries, so treat them as close, not exact. A member voting "present" or abstaining isn't counted as a no.</p>`;
}
$("#view-votes").addEventListener("click",e=>{
  if(e.target.closest("[data-votes-reset]")){$("#reset").click();$("#tab-votes").focus();return}
  const b=e.target.closest("[data-member]");if(!b)return;S.member={n:b.dataset.member,k:b.dataset.kind};S.hideCancelled=true;setTab("meetings");go();window.scrollTo({top:0});focusResults()});

// After jumping from another tab into filtered meetings, move keyboard focus to the Meetings tab.
function focusResults(){$("#tab-meetings").focus({preventScroll:true})}

function go(mode="push"){renderChips();renderMeetings();renderVotes();syncURL(mode)}
// Back/forward: rebuild state from the URL without adding history.
window.addEventListener("popstate",()=>{readURL();setTab(S.tab);renderChips();renderMeetings();renderVotes()});
renderStories();renderMap();renderVotes();setTab(S.tab);renderChips();renderMeetings();
// Turn an old "#votes"-style link into the query-string form.
if(location.hash)syncURL("replace");
}
})();
