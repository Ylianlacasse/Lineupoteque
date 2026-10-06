const $=id=>document.getElementById(id);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const opts=(s,list,first)=>{s.innerHTML="";if(first){const o=el("option",null,first);o.value="";s.appendChild(o)}list.forEach(v=>{const o=el("option",null,v);o.value=v;s.appendChild(o)})};
const warn=m=>{$("warn").textContent=m||"";$("warn").hidden=!m};
const showErr=m=>{$("err").textContent=m||""};
let data=[],imgs=[],vid=null,editId=null,pending=0;

/* Stockage IndexedDB (beaucoup plus de place que localStorage) */
const idb=new Promise((res,rej)=>{const r=indexedDB.open("lineupoteque",1);r.onupgradeneeded=()=>r.result.createObjectStore("l",{keyPath:"id"});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
idb.catch(()=>{});
const tx=(mode,fn)=>idb.then(d=>new Promise((res,rej)=>{const t=d.transaction("l",mode),r=fn(t.objectStore("l"));t.oncomplete=()=>res(r.result);t.onerror=t.onabort=()=>rej(t.error)}));
const newRev=()=>Date.now()+"."+Math.random().toString(36).slice(2);
const isPend=r=>r.deleted||r.synced===undefined||r.synced!==r.rev;
const persist=async l=>{l.rev=newRev();try{await tx("readwrite",s=>s.put(l));return true}catch(e){warn("Stockage impossible : cette lineup ne sera pas conservée après fermeture. Exporte tes données.");return false}};
const norm=x=>{if(x.video&&!(x.video instanceof Blob))delete x.video;if(typeof x.timer==="string"){const m=x.timer.match(/^(\d+):(\d{2})$/);x.timer=m?+m[1]*60+(+m[2]):(parseInt(x.timer)||"")}if(x.img){x.imgs=(x.imgs||[]).concat(x.img);delete x.img}x.imgs=x.imgs||[];return x};
const parseTimer=v=>{v=v.trim().replace(/s$/i,"");if(!v)return"";return/^\d{1,3}$/.test(v)?+v:null};
const agKey=l=>[...l.agents].sort((a,b)=>a.localeCompare(b,"fr")).join(",");
const cmp=(a,b)=>a.map.localeCompare(b.map,"fr")||agKey(a).localeCompare(agKey(b),"fr")||a.site.localeCompare(b.site)||a.title.localeCompare(b.title,"fr")||ts(b)-ts(a);
const ts=l=>l.ts||parseInt(l.id,36)||0;

async function loadShared(){
 const ok=d=>Array.isArray(d)?d.filter(x=>x&&x.id&&TYPES.includes(x.type)&&Array.isArray(x.agents)).map(norm):[];
 if(ghCfg()){try{return ok((await ghRead()).list)}catch(_){}}
 const get=async o=>{const r=await fetch("lineups.json",o);if(!r.ok)throw 0;return r.json()};
 try{return ok(await get({cache:"no-cache"}))}catch(_){try{return ok(await get({cache:"force-cache"}))}catch(__){return[]}}
}
let lastInit=0;
async function init(){
 lastInit=Date.now();
 let loc=[];
 try{
  loc=await tx("readonly",s=>s.getAll());
  const old=JSON.parse(localStorage.getItem("valo_lineups")||"[]"); // ancien stockage
  for(const l of old)if(!loc.some(x=>x.id===l.id)){norm(l);if(await persist(l))loc.push(l)}
  if(old.length)localStorage.removeItem("valo_lineups");
 }catch(e){warn("Stockage indisponible : les modifications ne seront pas conservées après fermeture.")}
 const shared=await loadShared();
 const sh=new Map(shared.map(x=>[x.id,x])),ids=new Set(loc.map(x=>x.id));
 // le dépôt fait foi pour ce qui est déjà synchronisé ; une vidéo locale est conservée
 data=shared.filter(x=>!ids.has(x.id)).concat(loc.filter(x=>!x.deleted).map(r=>norm(r.synced!==undefined&&r.synced===r.rev&&sh.has(r.id)?{...sh.get(r.id),video:r.video}:r)));
 render();
 if(ghCfg()&&loc.some(isPend))schedSync();
}

opts($("fType"),TYPES,"Type : tous");opts($("fAgent"),AGENTS,"Agent : tous");
opts($("fMap"),MAPS,"Map : toutes");opts($("fSite"),["A","B","C"],"Site : tous");
TYPES.forEach(t=>{const l=el("label");const r=document.createElement("input");r.type="radio";r.name="etype";r.value=t;l.style.borderLeft="3px solid "+TYPE_COLORS[t];l.append(r,t);$("eType").appendChild(l)});
const getType=()=>document.querySelector('input[name="etype"]:checked').value;
const setType=t=>document.querySelectorAll('input[name="etype"]').forEach(r=>r.checked=r.value===t);
opts($("eMap"),MAPS);
AGENTS.forEach(a=>{const l=el("label");const c=document.createElement("input");c.type="checkbox";c.value=a;l.style.borderLeft="3px solid "+AGENT_COLORS[a];l.append(c,a);$("eAgents").appendChild(l)});
$("eMap").onchange=()=>opts($("eSite"),SITES[$("eMap").value]);

function render(){
 const f={t:$("fType").value,a:$("fAgent").value,m:$("fMap").value,s:$("fSite").value,q:$("q").value.toLowerCase()};
 const list=data.filter(l=>(!f.t||l.type===f.t)&&(!f.a||l.agents.includes(f.a))&&(!f.m||l.map===f.m)&&(!f.s||l.site===f.s)&&(!f.q||(l.title+" "+l.note).toLowerCase().includes(f.q))).sort(cmp);
 const out=$("out");out.innerHTML="";
 if(!list.length){out.appendChild(el("div","empty",data.length?"Aucune lineup avec ces filtres.":"Aucune lineup pour l'instant. Clique sur « Ajouter une lineup »."));return}
 out.appendChild(el("h3",null,list.length+(list.length>1?" lineups":" lineup")));
 let gr=null,cur=null; // une catégorie par map : agents (ordre alphabétique) puis sites
 list.forEach(l=>{
  if(l.map!==cur){cur=l.map;out.appendChild(el("h2",null,cur+" ("+list.filter(x=>x.map===cur).length+")"));gr=el("div","grid");out.appendChild(gr)}
  gr.appendChild(card(l));
 });
}

const vurls=new Map(); // aperçu des vidéos : fichier local (stocké dans le navigateur) ou lien .mp4
const isMp4=u=>/\.mp4(\?.*)?$/i.test(u||"");
const vsrc=l=>{if(l.video instanceof Blob){const o=vurls.get(l.id);if(!o||o.b!==l.video)vurls.set(l.id,{b:l.video,u:URL.createObjectURL(l.video)});return vurls.get(l.id).u}return l.videoPath?l.videoPath:isMp4(l.link)?l.link:null};
function card(l,big){
 const c=el("div","card"+(big?" big":""));const st=el("div","stripe");l.agents.forEach(a=>{const x=el("span");x.style.background=AGENT_COLORS[a];st.appendChild(x)});c.appendChild(st);
 c.appendChild(el("h4",null,l.title));
 const b=el("div");
 const tb=el("span","b t",l.type);tb.style.background=TYPE_COLORS[l.type];b.appendChild(tb);
 l.agents.forEach(a=>{const x=el("span","b",a);x.style.color=x.style.borderColor=AGENT_COLORS[a];b.appendChild(x)});
 b.appendChild(el("span","b",l.map+" · "+l.site));
 if(l.jump)b.appendChild(el("span","b j","Jump Boost"));
 if(l.speed)b.appendChild(el("span","b j","Speed Boost"));
 if(!l.jump&&!l.speed)b.appendChild(el("span","b","Sans bonus"));
 c.appendChild(b);
 if(l.imgs.length){const g=el("div","gal"+(big?" big":l.imgs.length===1?" one":""));l.imgs.forEach((s,i)=>{const im=el("img");im.src=s;im.alt=l.title+" "+(i+1);if(big)im.onclick=e=>{e.stopPropagation();$("lb").firstElementChild.src=s;$("lb").hidden=false};g.appendChild(im)});c.appendChild(g)}
 const vs=vsrc(l);
 if(vs){const w=el("div","vw"+(big?" big":""));const v=document.createElement("video");v.src=vs+"#t=0.1";v.preload="metadata";v.muted=true;v.playsInline=true;v.className="vid";if(big)v.controls=true;w.appendChild(v);c.appendChild(w)}
 if(l.note)c.appendChild(el("div","n",l.note));
 if(l.timer)c.appendChild(el("div","tm","Time : "+l.timer+"s"));
 if(/^https?:\/\//i.test(l.link||"")&&!isMp4(l.link)){const a=el("a",null,"Voir la vidéo / le lien");a.href=l.link;a.target="_blank";a.rel="noopener";a.onclick=e=>e.stopPropagation();c.appendChild(a)}
 const act=el("div","act");
 const e=el("button",null,"Modifier");e.onclick=ev=>{ev.stopPropagation();closeDetail();openForm(l)};
 const d=el("button",null,"Supprimer");d.onclick=async ev=>{ev.stopPropagation();if(confirm("Supprimer cette lineup ?")){closeDetail();data=data.filter(x=>x.id!==l.id);try{await tx("readwrite",s=>s.put({id:l.id,deleted:true,rev:newRev()}))}catch(_){}render();schedSync()}};
 act.append(e,d);c.appendChild(act);
 if(!big)c.onclick=()=>openDetail(l);
 return c;
}
/* Vue agrandie d'une lineup */
function openDetail(l){const b=$("dvc");b.innerHTML="";b.appendChild(card(l,true));$("dv").hidden=false;$("dv").scrollTop=0;document.body.style.overflow="hidden"}
function closeDetail(){$("dv").hidden=true;$("dvc").innerHTML="";document.body.style.overflow=""}
$("dv").onclick=e=>{if(e.target.id==="dv"||e.target.id==="dvx"||e.target.className==="dvin")closeDetail()};
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(!$("lb").hidden)$("lb").hidden=true;else if(!$("dv").hidden)closeDetail()}});
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
function vinfo(){const t=$("vinfo");t.innerHTML="";if(!vid)return;t.append((vid.name||"vidéo")+" · "+(vid.size/1048576).toFixed(1)+" Mo · stockée sur cet appareil uniquement ");const x=el("button",null,"Retirer");x.type="button";x.onclick=()=>{vid=null;vinfo()};t.appendChild(x)}
$("eVid").onchange=e=>{const f=e.target.files[0];e.target.value="";if(!f)return;if(!/mp4/i.test(f.type)&&!/\.mp4$/i.test(f.name))return showErr("Choisis un fichier .mp4.");if(f.size>80*1048576)return showErr("Vidéo trop lourde (80 Mo max).");showErr("");vid=f;vinfo()};
function openForm(l){
 editId=l?l.id:null;imgs=l?l.imgs.slice():[];showErr("");thumbs();
 $("fTitle").value=l?l.title:"";setType(l?l.type:TYPES[0]);
 document.querySelectorAll("#eAgents input").forEach(c=>c.checked=!!l&&l.agents.includes(c.value));
 $("eMap").value=l?l.map:MAPS[0];opts($("eSite"),SITES[$("eMap").value]);if(l)$("eSite").value=l.site;
 $("eJump").checked=!!l&&!!l.jump;$("eSpeed").checked=!!l&&!!l.speed;vid=l&&l.video instanceof Blob?l.video:null;vinfo();$("eTimer").value=l?l.timer||"":"";$("eNote").value=l?l.note:"";$("eLink").value=l?l.link||"":"";
 $("dlg").showModal();
}
$("add").onclick=()=>openForm(null);
$("cancel").onclick=()=>$("dlg").close();
$("save").onclick=async()=>{
 const agents=[...document.querySelectorAll("#eAgents input:checked")].map(c=>c.value);
 const title=$("fTitle").value.trim();
 if(!title)return showErr("Ajoute un titre.");
 if(!agents.length)return showErr("Choisis au moins un agent.");
 const timer=parseTimer($("eTimer").value);
 if(timer===null)return showErr("Time invalide : écris un nombre de secondes, par exemple 45.");
 if(pending)return showErr("Images en cours de traitement, réessaie dans un instant.");
 const old=data.find(x=>x.id===editId);
 const o={id:editId||Date.now().toString(36),ts:old?ts(old):Date.now(),title,type:getType(),agents,map:$("eMap").value,site:$("eSite").value,jump:$("eJump").checked,speed:$("eSpeed").checked,video:vid,timer,note:$("eNote").value.trim(),link:$("eLink").value.trim(),imgs:imgs.slice()};
 data=editId?data.map(x=>x.id===editId?o:x):[o,...data];
 await persist(o);schedSync();
 $("dlg").close();
 if(!editId){["fType","fAgent","fMap","fSite"].forEach(i=>$(i).value="");$("q").value="";window.scrollTo(0,0)} // la nouvelle lineup reste visible malgré les filtres
 render();
};

/* Filtres, export, import */
["fType","fAgent","fMap","fSite"].forEach(i=>$(i).onchange=render);
$("q").oninput=render;
$("rst").onclick=()=>{["fType","fAgent","fMap","fSite"].forEach(i=>$(i).value="");$("q").value="";render()};
$("exp").onclick=()=>{if(data.some(l=>l.video))alert("Les vidéos importées depuis cet appareil ne sont pas incluses dans l'export. Pour les partager, mets le .mp4 dans le dossier videos/ du dépôt et écris son chemin (videos/nom.mp4) dans le champ Lien.");const a=el("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,(k,v)=>v instanceof Blob||k==="rev"||k==="synced"?undefined:v)],{type:"application/json"}));a.download="lineups.json";a.click()};
$("imp").onclick=()=>$("impf").click();
$("impf").onchange=e=>{
 const f=e.target.files[0];if(!f)return;const r=new FileReader();
 r.onload=async()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d))throw 0;
  const ids=new Set(data.map(x=>x.id));
  for(const x of d)if(x&&x.id&&!ids.has(x.id)&&TYPES.includes(x.type)&&Array.isArray(x.agents)){norm(x);data.push(x);await persist(x)}
  render();schedSync()}catch(_){alert("Fichier invalide.")}};
 r.readAsText(f);e.target.value="";
};

/* Synchronisation GitHub : chaque modification est enregistrée dans lineups.json du dépôt */
const ghCfg=()=>{try{return JSON.parse(localStorage.getItem("lineupoteque_gh")||"null")}catch(_){return null}};
const ghSet=s=>{$("sync").textContent=s};
const gh=(path,opt={})=>{const c=ghCfg();return fetch("https://api.github.com/repos/"+c.repo+path,{...opt,headers:{Authorization:"Bearer "+c.token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}})};
const b64=s=>{const b=new TextEncoder().encode(s);let o="";for(let i=0;i<b.length;i+=0x8000)o+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(o)};
const unb64=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,"")),c=>c.charCodeAt(0)));
const blobB64=b=>new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(f.result.split(",")[1]);f.onerror=rej;f.readAsDataURL(b)});
async function ghRead(){
 const c=ghCfg(),r=await gh("/contents/lineups.json?ref="+encodeURIComponent(c.branch));
 if(r.status===404)return{list:[],sha:null};
 if(!r.ok)throw new Error("GitHub "+r.status);
 const m=await r.json();let t=m.content&&m.encoding==="base64"?unb64(m.content):"";
 if(!t){const b=await gh("/git/blobs/"+m.sha);if(!b.ok)throw new Error("GitHub "+b.status);t=unb64((await b.json()).content)}
 let list=[];try{const d=JSON.parse(t);if(Array.isArray(d))list=d}catch(_){}
 return{list,sha:m.sha};
}
async function ghPut(path,content,msg,sha){
 const c=ghCfg();
 if(sha===undefined){const g=await gh("/contents/"+path+"?ref="+encodeURIComponent(c.branch));sha=g.ok?(await g.json()).sha:null}
 const body={message:msg,content,branch:c.branch};if(sha)body.sha=sha;
 return gh("/contents/"+path,{method:"PUT",body:JSON.stringify(body)});
}
let syncT=null,syncing=false,again=false;
function schedSync(){if(!ghCfg())return;ghSet("Modifications en attente…");clearTimeout(syncT);syncT=setTimeout(runSync,1500)}
async function runSync(){
 if(!ghCfg())return;
 if(syncing){again=true;return}
 syncing=true;again=false;ghSet("Synchronisation…");
 try{
  let done=false;
  for(let n=0;n<3&&!done;n++){
   const pend=(await tx("readonly",s=>s.getAll())).filter(isPend);
   const snap=new Map(pend.map(r=>[r.id,String(r.rev)]));
   for(const r of pend)if(!r.deleted&&r.video instanceof Blob&&!r.videoPath){ // vidéo : envoyée dans videos/
    if(r.video.size>25*1048576){warn("Vidéo trop lourde pour l'envoi automatique (25 Mo max) : "+r.title);continue}
    const p="videos/"+r.id+".mp4",res=await ghPut(p,await blobB64(r.video),"Vidéo : "+r.title);
    if(!res.ok)throw new Error("GitHub "+res.status+" (vidéo)");
    r.videoPath=p;const cur=await tx("readonly",s=>s.get(r.id));
    if(cur&&String(cur.rev)===String(r.rev)){cur.videoPath=p;await tx("readwrite",s=>s.put(cur))}
   }
   const {list,sha}=await ghRead();
   const del=new Set(pend.filter(r=>r.deleted).map(r=>r.id));
   const map=new Map(list.filter(x=>x&&x.id&&!del.has(x.id)).map(x=>[x.id,x]));
   pend.filter(r=>!r.deleted).forEach(r=>{const {video,synced,rev,...rest}=r;map.set(r.id,rest)});
   const txt=JSON.stringify([...map.values()]);
   if(txt!==JSON.stringify(list)){
    const res=await ghPut("lineups.json",b64(txt),"Mise à jour des lineups",sha);
    if(res.status===409||res.status===422)continue; // modifié entre-temps ailleurs : on relit et on refusionne
    if(!res.ok)throw new Error("GitHub "+res.status);
   }
   for(const [id,rev] of snap){
    const cur=await tx("readonly",s=>s.get(id));
    if(!cur||String(cur.rev)!==rev)continue; // modifié pendant l'envoi : sera repris au prochain passage
    if(cur.deleted||!(cur.video instanceof Blob))await tx("readwrite",s=>s.delete(id));
    else{cur.synced=cur.rev;await tx("readwrite",s=>s.put(cur))}
   }
   done=true;
  }
  if(!done)throw new Error("conflit répété");
  ghSet("Synchronisé avec GitHub");warn("");
 }catch(e){ghSet("Échec de la synchronisation ("+e.message+"), nouvel essai à la prochaine modification")}
 syncing=false;if(again)schedSync();
}
$("gh").onclick=()=>{const c=ghCfg()||{repo:"Ylianlacasse/Lineupoteque",branch:"main",token:""};$("ghRepo").value=c.repo;$("ghBranch").value=c.branch;$("ghTok").value=c.token;$("ghErr").textContent="";$("dgh").showModal()};
$("ghCancel").onclick=()=>$("dgh").close();
$("ghOff").onclick=()=>{localStorage.removeItem("lineupoteque_gh");ghSet("GitHub : non connecté");$("dgh").close()};
$("ghOn").onclick=async()=>{
 const c={repo:$("ghRepo").value.trim(),branch:$("ghBranch").value.trim()||"main",token:$("ghTok").value.trim()};
 if(!/^[\w.-]+\/[\w.-]+$/.test(c.repo)||!c.token){$("ghErr").textContent="Renseigne le dépôt (utilisateur/nom) et le token.";return}
 localStorage.setItem("lineupoteque_gh",JSON.stringify(c));
 try{
  const r=await gh("");
  if(!r.ok)throw new Error(r.status===401?"token refusé":r.status===404?"dépôt introuvable ou accès refusé":"erreur "+r.status);
  const j=await r.json();if(j.permissions&&j.permissions.push===false)throw new Error("le token n'a pas le droit d'écrire (Contents : Read and write)");
  $("dgh").close();await runSync();await init();
 }catch(e){localStorage.removeItem("lineupoteque_gh");$("ghErr").textContent="Échec : "+e.message}
};
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&ghCfg()&&!syncing&&Date.now()-lastInit>60000)init()});
ghSet(ghCfg()?"Synchronisation GitHub activée":"GitHub : non connecté");
init();
