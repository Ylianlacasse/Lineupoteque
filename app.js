const $=id=>document.getElementById(id);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const opts=(s,list,first)=>{s.innerHTML="";if(first){const o=el("option",null,first);o.value="";s.appendChild(o)}list.forEach(v=>{const o=el("option",null,v);o.value=v;s.appendChild(o)})};
const warn=m=>{$("warn").textContent=m||"";$("warn").hidden=!m};
const showErr=m=>{$("err").textContent=m||""};
let data=[],imgs=[],editId=null,pending=0;

/* Stockage IndexedDB (beaucoup plus de place que localStorage) */
const idb=new Promise((res,rej)=>{const r=indexedDB.open("lineupoteque",1);r.onupgradeneeded=()=>r.result.createObjectStore("l",{keyPath:"id"});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
idb.catch(()=>{});
const tx=(mode,fn)=>idb.then(d=>new Promise((res,rej)=>{const t=d.transaction("l",mode),r=fn(t.objectStore("l"));t.oncomplete=()=>res(r.result);t.onerror=t.onabort=()=>rej(t.error)}));
const persist=async l=>{try{await tx("readwrite",s=>s.put(l));return true}catch(e){warn("Stockage impossible : cette lineup ne sera pas conservée après fermeture. Exporte tes données.");return false}};
const norm=x=>{if(x.img){x.imgs=(x.imgs||[]).concat(x.img);delete x.img}x.imgs=x.imgs||[];return x};
const ts=l=>l.ts||parseInt(l.id,36)||0;

async function init(){
 try{
  data=(await tx("readonly",s=>s.getAll())).map(norm);
  const old=JSON.parse(localStorage.getItem("valo_lineups")||"[]"); // ancien stockage
  for(const l of old)if(!data.some(x=>x.id===l.id)){norm(l);if(await persist(l))data.push(l)}
  if(old.length)localStorage.removeItem("valo_lineups");
 }catch(e){warn("Stockage indisponible : les lineups ne seront pas conservées après fermeture.")}
 render();
}

opts($("fType"),TYPES,"Type : tous");opts($("fAgent"),AGENTS,"Agent : tous");
opts($("fMap"),MAPS,"Map : toutes");opts($("fSite"),["A","B","C"],"Site : tous");
opts($("eType"),TYPES);opts($("eMap"),MAPS);
AGENTS.forEach(a=>{const l=el("label");const c=document.createElement("input");c.type="checkbox";c.value=a;l.style.borderLeft="3px solid "+AGENT_COLORS[a];l.append(c,a);$("eAgents").appendChild(l)});
$("eMap").onchange=()=>opts($("eSite"),SITES[$("eMap").value]);

function render(){
 const f={t:$("fType").value,a:$("fAgent").value,m:$("fMap").value,s:$("fSite").value,q:$("q").value.toLowerCase()};
 const list=data.filter(l=>(!f.t||l.type===f.t)&&(!f.a||l.agents.includes(f.a))&&(!f.m||l.map===f.m)&&(!f.s||l.site===f.s)&&(!f.q||(l.title+" "+l.note).toLowerCase().includes(f.q))).sort((a,b)=>ts(b)-ts(a));
 const out=$("out");out.innerHTML="";
 if(!list.length){out.appendChild(el("div","empty",data.length?"Aucune lineup avec ces filtres.":"Aucune lineup pour l'instant. Clique sur « Ajouter une lineup »."));return}
 out.appendChild(el("h3",null,list.length+(list.length>1?" lineups":" lineup")));
 const gr=el("div","grid");list.forEach(l=>gr.appendChild(card(l)));out.appendChild(gr);
}

function card(l){
 const c=el("div","card");const st=el("div","stripe");l.agents.forEach(a=>{const x=el("span");x.style.background=AGENT_COLORS[a];st.appendChild(x)});c.appendChild(st);
 c.appendChild(el("h4",null,l.title));
 const b=el("div");
 b.appendChild(el("span","b t",l.type));
 l.agents.forEach(a=>{const x=el("span","b",a);x.style.color=x.style.borderColor=AGENT_COLORS[a];b.appendChild(x)});
 b.appendChild(el("span","b",l.map+" · "+l.site));
 b.appendChild(el("span","b"+(l.jump?" j":""),l.jump?"Jump Boost":"Sans Jump Boost"));
 c.appendChild(b);
 if(l.imgs.length){const g=el("div","gal"+(l.imgs.length===1?" one":""));l.imgs.forEach((s,i)=>{const im=el("img");im.src=s;im.alt=l.title+" "+(i+1);im.onclick=()=>{$("lb").firstElementChild.src=s;$("lb").hidden=false};g.appendChild(im)});c.appendChild(g)}
 if(l.note)c.appendChild(el("div","n",l.note));
 if(/^https?:\/\//i.test(l.link||"")){const a=el("a",null,"Voir la vidéo / le lien");a.href=l.link;a.target="_blank";a.rel="noopener";c.appendChild(a)}
 const act=el("div","act");
 const e=el("button",null,"Modifier");e.onclick=()=>openForm(l);
 const d=el("button",null,"Supprimer");d.onclick=async()=>{if(confirm("Supprimer cette lineup ?")){data=data.filter(x=>x.id!==l.id);try{await tx("readwrite",s=>s.delete(l.id))}catch(_){}render()}};
 act.append(e,d);c.appendChild(act);return c;
}
$("lb").onclick=()=>$("lb").hidden=true;

/* Images : plusieurs fichiers, glisser-déposer, coller */
function shrink(f){return new Promise((res,rej)=>{const u=URL.createObjectURL(f),im=new Image();
 im.onload=()=>{const s=Math.min(1,1000/Math.max(im.width,im.height)),cv=document.createElement("canvas");cv.width=Math.round(im.width*s);cv.height=Math.round(im.height*s);cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);URL.revokeObjectURL(u);res(cv.toDataURL("image/jpeg",.72))};
 im.onerror=()=>{URL.revokeObjectURL(u);rej()};im.src=u})}
function thumbs(){const t=$("thumbs");t.innerHTML="";imgs.forEach((s,i)=>{const w=el("div","th");const im=el("img");im.src=s;const x=el("button",null,"×");x.type="button";x.onclick=()=>{imgs.splice(i,1);thumbs()};w.append(im,x);t.appendChild(w)})}
async function addFiles(fs){
 const list=[...fs].filter(f=>f.type.startsWith("image/"));
 pending+=list.length;
 for(const f of list){try{imgs.push(await shrink(f));showErr("")}catch(_){showErr("Image illisible : "+(f.name||"fichier"))}pending--;thumbs()}
}
$("eImg").onchange=e=>{addFiles(e.target.files);e.target.value=""};
$("drop").ondragover=e=>{e.preventDefault();$("drop").classList.add("over")};
$("drop").ondragleave=()=>$("drop").classList.remove("over");
$("drop").ondrop=e=>{e.preventDefault();$("drop").classList.remove("over");addFiles(e.dataTransfer.files)};
$("dlg").addEventListener("paste",e=>{const fs=[...(e.clipboardData?e.clipboardData.files:[])];if(fs.length){e.preventDefault();addFiles(fs)}});

/* Formulaire */
function openForm(l){
 editId=l?l.id:null;imgs=l?l.imgs.slice():[];showErr("");thumbs();
 $("fTitle").value=l?l.title:"";$("eType").value=l?l.type:TYPES[0];
 document.querySelectorAll("#eAgents input").forEach(c=>c.checked=!!l&&l.agents.includes(c.value));
 $("eMap").value=l?l.map:MAPS[0];opts($("eSite"),SITES[$("eMap").value]);if(l)$("eSite").value=l.site;
 $("eJump").checked=!!l&&!!l.jump;$("eNote").value=l?l.note:"";$("eLink").value=l?l.link||"":"";
 $("dlg").showModal();
}
$("add").onclick=()=>openForm(null);
$("cancel").onclick=()=>$("dlg").close();
$("save").onclick=async()=>{
 const agents=[...document.querySelectorAll("#eAgents input:checked")].map(c=>c.value);
 const title=$("fTitle").value.trim();
 if(!title)return showErr("Ajoute un titre.");
 if(!agents.length)return showErr("Choisis au moins un agent.");
 if(pending)return showErr("Images en cours de traitement, réessaie dans un instant.");
 const old=data.find(x=>x.id===editId);
 const o={id:editId||Date.now().toString(36),ts:old?ts(old):Date.now(),title,type:$("eType").value,agents,map:$("eMap").value,site:$("eSite").value,jump:$("eJump").checked,note:$("eNote").value.trim(),link:$("eLink").value.trim(),imgs:imgs.slice()};
 data=editId?data.map(x=>x.id===editId?o:x):[o,...data];
 await persist(o);
 $("dlg").close();
 if(!editId){["fType","fAgent","fMap","fSite"].forEach(i=>$(i).value="");$("q").value="";window.scrollTo(0,0)} // la nouvelle lineup reste visible malgré les filtres
 render();
};

/* Filtres, export, import */
["fType","fAgent","fMap","fSite"].forEach(i=>$(i).onchange=render);
$("q").oninput=render;
$("rst").onclick=()=>{["fType","fAgent","fMap","fSite"].forEach(i=>$(i).value="");$("q").value="";render()};
$("exp").onclick=()=>{const a=el("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:"application/json"}));a.download="lineups-valorant.json";a.click()};
$("imp").onclick=()=>$("impf").click();
$("impf").onchange=e=>{
 const f=e.target.files[0];if(!f)return;const r=new FileReader();
 r.onload=async()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d))throw 0;
  const ids=new Set(data.map(x=>x.id));
  for(const x of d)if(x&&x.id&&!ids.has(x.id)&&TYPES.includes(x.type)&&Array.isArray(x.agents)){norm(x);data.push(x);await persist(x)}
  render()}catch(_){alert("Fichier invalide.")}};
 r.readAsText(f);e.target.value="";
};
init();
