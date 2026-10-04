const KEY="valo_lineups";
let data=[];try{data=JSON.parse(localStorage.getItem(KEY)||"[]")}catch(e){}
let editId=null,imgData=null;
const $=id=>document.getElementById(id);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const opts=(s,list,first)=>{s.innerHTML="";if(first){const o=el("option",null,first);o.value="";s.appendChild(o)}list.forEach(v=>{const o=el("option",null,v);o.value=v;s.appendChild(o)})};

opts($("fType"),TYPES,"Type : tous");opts($("fAgent"),AGENTS,"Agent : tous");
opts($("fMap"),MAPS,"Map : toutes");opts($("fSite"),["A","B","C"],"Site : tous");
opts($("eType"),TYPES);opts($("eMap"),MAPS);
AGENTS.forEach(a=>{const l=el("label");const c=document.createElement("input");c.type="checkbox";c.value=a;l.style.borderLeft="3px solid "+AGENT_COLORS[a];l.append(c,a);$("eAgents").appendChild(l)});
$("eMap").onchange=()=>opts($("eSite"),SITES[$("eMap").value]);

function save(){try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch(e){alert("Stockage plein : retire des images ou exporte tes données.");return false}}

function render(){
 const f={t:$("fType").value,a:$("fAgent").value,m:$("fMap").value,s:$("fSite").value,q:$("q").value.toLowerCase(),g:$("grp").value};
 const list=data.filter(l=>(!f.t||l.type===f.t)&&(!f.a||l.agents.includes(f.a))&&(!f.m||l.map===f.m)&&(!f.s||l.site===f.s)&&(!f.q||(l.title+" "+l.note).toLowerCase().includes(f.q)));
 const out=$("out");out.innerHTML="";
 if(!list.length){out.appendChild(el("div","empty",data.length?"Aucune lineup avec ces filtres.":"Aucune lineup pour l'instant. Clique sur « Ajouter une lineup »."));return}
 const ent=[];
 list.forEach(l=>{
  if(f.g==="type")(f.a?[f.a]:l.agents).forEach(a=>ent.push([l.type,a,l]));
  else ent.push([l.map,l.site,l]);
 });
 const o1=f.g==="type"?TYPES:MAPS,o2=f.g==="type"?AGENTS:["A","B","C"];
 const g={};ent.forEach(([a,b,l])=>{((g[a]=g[a]||{})[b]=g[a][b]||[]).push(l)});
 o1.filter(k=>g[k]).forEach(k1=>{
  const n=Object.values(g[k1]).reduce((s,x)=>s+x.length,0);
  out.appendChild(el("h2",null,k1+" ("+n+")"));
  o2.filter(k=>g[k1][k]).forEach(k2=>{
   const h=el("h3",null,f.g==="map"?"Site "+k2:k2);if(f.g==="type")h.style.color=AGENT_COLORS[k2];out.appendChild(h);
   const gr=el("div","grid");g[k1][k2].forEach(l=>gr.appendChild(card(l)));out.appendChild(gr);
  });
 });
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
 if(l.img){const i=el("img");i.src=l.img;i.alt=l.title;i.onclick=()=>{const w=window.open();if(w)w.document.write('<img style="max-width:100%" src="'+l.img+'">')};c.appendChild(i)}
 if(l.note)c.appendChild(el("div","n",l.note));
 if(/^https?:\/\//i.test(l.link||"")){const a=el("a",null,"Voir la vidéo / le lien");a.href=l.link;a.target="_blank";a.rel="noopener";c.appendChild(a)}
 const act=el("div","act");
 const e=el("button",null,"Modifier");e.onclick=()=>openForm(l);
 const d=el("button",null,"Supprimer");d.onclick=()=>{if(confirm("Supprimer cette lineup ?")){data=data.filter(x=>x.id!==l.id);save();render()}};
 act.append(e,d);c.appendChild(act);return c;
}

function openForm(l){
 editId=l?l.id:null;imgData=l?l.img||null:null;
 $("fTitle").value=l?l.title:"";$("eType").value=l?l.type:TYPES[0];
 document.querySelectorAll("#eAgents input").forEach(c=>c.checked=!!l&&l.agents.includes(c.value));
 $("eMap").value=l?l.map:MAPS[0];opts($("eSite"),SITES[$("eMap").value]);if(l)$("eSite").value=l.site;
 $("eJump").checked=!!l&&!!l.jump;$("eNote").value=l?l.note:"";$("eLink").value=l?l.link||"":"";$("eImg").value="";
 $("dlg").showModal();
}
$("add").onclick=()=>openForm(null);
$("cancel").onclick=()=>$("dlg").close();
$("eImg").onchange=e=>{
 const f=e.target.files[0];if(!f)return;
 const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{
  const s=Math.min(1,900/Math.max(im.width,im.height)),cv=document.createElement("canvas");
  cv.width=im.width*s;cv.height=im.height*s;cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);
  imgData=cv.toDataURL("image/jpeg",.7)};im.src=r.result};r.readAsDataURL(f);
};
$("save").onclick=()=>{
 const agents=[...document.querySelectorAll("#eAgents input:checked")].map(c=>c.value);
 const title=$("fTitle").value.trim();
 if(!title)return alert("Ajoute un titre.");
 if(!agents.length)return alert("Choisis au moins un agent.");
 const o={id:editId||Date.now().toString(36),title,type:$("eType").value,agents,map:$("eMap").value,site:$("eSite").value,jump:$("eJump").checked,note:$("eNote").value.trim(),link:$("eLink").value.trim(),img:imgData};
 const bk=data.slice();
 data=editId?data.map(x=>x.id===editId?o:x):[o,...data];
 if(!save()){data=bk;return}
 $("dlg").close();render();
};

["fType","fAgent","fMap","fSite","grp"].forEach(i=>$(i).onchange=render);
$("q").oninput=render;
$("rst").onclick=()=>{["fType","fAgent","fMap","fSite"].forEach(i=>$(i).value="");$("q").value="";render()};
$("exp").onclick=()=>{const a=el("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:"application/json"}));a.download="lineups-valorant.json";a.click()};
$("imp").onclick=()=>$("impf").click();
$("impf").onchange=e=>{
 const f=e.target.files[0];if(!f)return;const r=new FileReader();
 r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d))throw 0;
  const ids=new Set(data.map(x=>x.id));data=data.concat(d.filter(x=>x&&x.id&&!ids.has(x.id)&&TYPES.includes(x.type)&&Array.isArray(x.agents)));save();render()}catch(_){alert("Fichier invalide.")}};
 r.readAsText(f);e.target.value="";
};
render();
