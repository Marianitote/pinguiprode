/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — INTERFAZ (ui.js)
   ===================================================================== */
const $=s=>document.querySelector(s);
const app=$("#app");
let TAB="inicio";
function toast(m,k){const t=$("#toast");t.textContent=m;t.className="toast show "+(k||"");setTimeout(()=>t.className="toast",2600);}
function esc(s){return(s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function team(c){const t=TEAMS[c];return t?`<span class="flag">${t.f}</span><span class="nm">${t.n}</span>`:`<span class="nm" style="color:var(--muted)">—</span>`;}
function isAdmin(){return APP.profile?.is_admin;}
function modal(html){let m=document.createElement("div");m.className="modal-bg";m.id="modalBg";m.innerHTML=`<div class="modal">${html}</div>`;m.onclick=e=>{if(e.target===m)closeModal();};document.body.appendChild(m);}
function closeModal(){const m=$("#modalBg");if(m)m.remove();}

/* ---------- BOOT ---------- */
async function boot(){
  try{
    await loadSession();
    if(!APP.user){ renderAuth(); return; }
    // logueado pero sin perfil → crear perfil
    if(!APP.profile){ renderCreateProfile(); return; }
    await loadAll();
    render();
  }catch(e){ console.error(e); app.innerHTML=`<div class="auth-wrap"><div class="card"><div class="sec-title">Error</div><p class="lead">${esc(e.message||e)}</p><p class="note" style="margin-top:10px">Si recién configuraste Supabase, revisá que las claves en config.js sean correctas.</p></div></div>`; }
}
// re-cargar cuando cambia la sesión (ej: al volver del mail de confirmación)
sb.auth.onAuthStateChange((_e,_s)=>{ boot(); });

/* ---------- AUTH ---------- */
let AUTH_MODE="in"; // 'in' | 'up'
function renderAuth(){
  app.innerHTML=`<div class="auth-wrap">
    <div class="hero" style="text-align:center">
      <div class="logo" style="justify-content:center;font-size:24px"><span class="peng">🐧</span> Pingüi<b>Prode</b></div>
      <h1 style="font-size:34px;margin-top:10px">Mundial <em>2026</em></h1>
      <p class="lead">El prode de las tres tarjetas. Iniciá sesión o registrate con tu mail habilitado.</p>
    </div>
    <div class="card">
      <div class="seg" style="margin-bottom:16px">
        <button class="${AUTH_MODE==='in'?'on':''}" onclick="AUTH_MODE='in';renderAuth()">Iniciar sesión</button>
        <button class="${AUTH_MODE==='up'?'on':''}" onclick="AUTH_MODE='up';renderAuth()">Registrarme</button>
      </div>
      <label class="field">Mail</label>
      <input id="email" type="email" placeholder="tucorreo@mail.com" autocomplete="email">
      <label class="field" style="margin-top:12px">Contraseña</label>
      <input id="pass" type="password" placeholder="••••••••" autocomplete="${AUTH_MODE==='up'?'new-password':'current-password'}">
      <button class="btn primary full" style="margin-top:16px" onclick="doAuth()">
        ${AUTH_MODE==='in'?'Entrar':'Crear cuenta'}</button>
      ${AUTH_MODE==='up'?`<p class="note" style="margin-top:12px">Tu mail tiene que estar en la lista de habilitados (la arma el COMIPRO). Te vamos a mandar un correo de confirmación.</p>`:`<p class="note" style="margin-top:12px"><a href="#" onclick="forgotPass();return false" style="color:var(--aqua)">Olvidé mi contraseña</a></p>`}
    </div>
  </div>`;
}
async function doAuth(){
  const email=$("#email").value.trim(), pass=$("#pass").value;
  if(!email||!pass) return toast("Completá mail y contraseña","err");
  try{
    if(AUTH_MODE==='up'){
      await signUp(email,pass);
      app.innerHTML=`<div class="auth-wrap"><div class="card" style="text-align:center">
        <div class="big" style="font-size:42px">📧</div>
        <h3 style="margin:10px 0">Revisá tu mail</h3>
        <p class="lead">Te enviamos un correo a <b>${esc(email)}</b> para confirmar tu cuenta. Tocá el link y volvé acá para crear tu perfil.</p>
      </div></div>`;
    }else{
      await signIn(email,pass); await boot();
    }
  }catch(e){ toast(traduceError(e),"err"); }
}
async function forgotPass(){
  const email=$("#email").value.trim(); if(!email) return toast("Escribí tu mail primero","err");
  const {error}=await sb.auth.resetPasswordForEmail(email);
  if(error) toast(traduceError(error),"err"); else toast("Te mandamos un mail para resetear","ok");
}
function traduceError(e){
  const m=(e.message||"").toLowerCase();
  if(m.includes("not allowed")||m.includes("habilitado")) return "Ese mail no está habilitado. Pedile al COMIPRO que te agregue.";
  if(m.includes("invalid login")) return "Mail o contraseña incorrectos.";
  if(m.includes("already registered")) return "Ese mail ya está registrado. Probá iniciar sesión.";
  if(m.includes("password")) return "La contraseña debe tener al menos 6 caracteres.";
  return e.message||"Algo salió mal";
}

/* ---------- CREAR PERFIL (primera vez tras confirmar mail) ---------- */
function renderCreateProfile(){
  app.innerHTML=`<div class="auth-wrap">
    <div class="hero" style="text-align:center"><div class="big" style="font-size:42px">🎉</div>
      <h1 style="font-size:30px">¡Mail confirmado!</h1>
      <p class="lead">Elegí tu nombre de jugador para el PingüiProde.</p></div>
    <div class="card">
      <label class="field">Nombre de jugador</label>
      <input id="dname" placeholder="Ej: Bartel" maxlength="24">
      <button class="btn primary full" style="margin-top:16px" onclick="doCreateProfile()">Crear mi perfil →</button>
      <p class="note" style="margin-top:10px">Logueado como ${esc(APP.user.email)}. <a href="#" onclick="signOut();return false" style="color:var(--aqua)">Salir</a></p>
    </div>
  </div>`;
}
async function doCreateProfile(){
  const n=$("#dname").value.trim(); if(!n) return toast("Escribí un nombre","err");
  try{ await createProfile(n); await loadAll(); render(); toast("¡Perfil creado! 🐧","ok"); }
  catch(e){ toast(traduceError(e),"err"); }
}

/* ---------- NAV SHELL ---------- */
function render(){
  app.innerHTML=topbar()+tabsBar()+`<div class="wrap" id="view"></div>`;
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{TAB=b.dataset.tab;render();window.scrollTo(0,0);});
  const v=$("#view");
  ({inicio:renderInicio,picada:renderPicada,principal:renderPrincipal,wasabi:renderWasabi,
    comodines:renderComodines,tabla:renderTabla,reglamento:renderReglamento,admin:renderAdmin}[TAB]||renderInicio)(v);
}
function topbar(){
  const me=APP.profile.display_name;
  return `<div class="topbar"><div class="inner">
    <div class="logo"><span class="peng">🐧</span> Pingüi<b>Prode</b></div>
    <div class="whoami"><span class="chip ${isAdmin()?'admin':''}" onclick="menuUser()">${isAdmin()?'👑 ':''}${esc(me)} ▾</span></div>
  </div></div>`;
}
function tabsBar(){
  const tabs=[["inicio","Inicio"],["picada","Picada"],["principal","Principal"],["wasabi","Wasabi"],
    ["comodines","Comodines"],["tabla","Tabla"],["reglamento","Reglamento"]];
  if(isAdmin()) tabs.push(["admin","⚙ Admin"]);
  return `<div class="tabs">`+tabs.map(([k,l])=>`<button class="tab ${TAB===k?'active':''}" data-tab="${k}">${l}</button>`).join("")+`</div>`;
}
function menuUser(){
  modal(`<h3>${esc(APP.profile.display_name)}</h3>
    <p class="note">${esc(APP.user.email)}${isAdmin()?' · 👑 COMIPRO':''}</p>
    <div class="divider"></div>
    <button class="btn ghost full" onclick="closeModal();signOut()">Cerrar sesión</button>
    <button class="btn ghost full" style="margin-top:8px" onclick="closeModal()">Volver</button>`);
}

/* =====================================================================
   PESTAÑA · INICIO
   ===================================================================== */
function renderInicio(v){
  const tb=standings(); const meRow=tb.find(r=>r.id===APP.user.id);
  const locked=APP.myPred?.locked;
  v.innerHTML=`
  <div class="hero" style="padding-top:22px">
    <div class="pill">⚽ 48 selecciones · 104 partidos · 11 jun – 19 jul</div>
    <h1>Hola, <em>${esc(APP.profile.display_name)}</em></h1>
    <p class="lead">${isAdmin()
      ? "Sos el COMIPRO. Cargá resultados, gestioná mails y preguntas desde <b>⚙ Admin</b>."
      : "Completá tus tres tarjetas antes de la fecha límite. Una vez enviadas, quedan cerradas con candado."}</p>
  </div>
  <div class="kpi">
    <div class="k"><div class="n">#${meRow.pos}</div><div class="l">Tu posición</div></div>
    <div class="k"><div class="n">${meRow.total}</div><div class="l">Tus puntos</div></div>
    <div class="k"><div class="n">${tb.length}</div><div class="l">Jugadores</div></div>
  </div>`;
  if(locked){
    v.innerHTML+=`<div class="lock-banner">🔒 <b>Tus tarjetas están enviadas y cerradas.</b> Ya no se pueden editar. Ahora seguí la tabla y usá tus comodines.</div>`;
  } else if(!isAdmin()){
    const pic=Object.keys(APP.myPred?.picada||{}).length;
    const mn=Object.keys(APP.myPred?.main||{}).length;
    const wa=Object.keys(APP.myPred?.wasabi||{}).filter(k=>(APP.myPred.wasabi[k]??"")!=="").length;
    v.innerHTML+=`<div class="card">
      <div class="sec-title">Tus tarjetas (borrador)</div>
      <table>
        <tr><td class="name">🥒 Picada</td><td style="text-align:right">${pic>0?'✓ respondida':'pendiente'}</td></tr>
        <tr><td class="name">⚽ Principal</td><td style="text-align:right">${mn}/${FIXTURE.length} partidos</td></tr>
        <tr><td class="name">🌶️ Wasabi</td><td style="text-align:right">${wa}/${APP.wasabiQs.length}</td></tr>
      </table>
      <div class="row" style="margin-top:14px">
        <button class="btn primary sm" onclick="TAB='picada';render()">Completar tarjetas</button>
        <button class="btn gold sm" onclick="confirmLock()">🔒 Enviar definitivo</button>
      </div>
      <p class="note" style="margin-top:10px">Podés editar cuanto quieras hasta que toques “Enviar definitivo”. Después se cierra.</p>
    </div>`;
  }
  v.innerHTML+=`<div class="card flat"><div class="sec-title">Comodines · resumen</div>
    <p class="note" style="line-height:1.7"><b>🃏 Sanguijuela:</b> 2 por fase. Retás hasta 3 puestos arriba; el 1º no retá. Si hacés más puntos que el retado, te llevás los suyos; si hacés menos, perdés el 50% de lo que él sacó.<br>
    <b>🔥 Nitro:</b> 2 por fase, multiplica x3 tus puntos de Principal. No lo usan 1º ni 2°.<br>
    <span style="color:var(--muted)">Se piden hasta 1 hora antes del partido. Ojo: no podés usar ambos en la misma fecha.</span></p></div>`;
}
function confirmLock(){
  modal(`<h3>🔒 Enviar definitivo</h3>
    <p class="lead">Una vez que envíes, <b>no vas a poder editar</b> tus tarjetas. ¿Confirmás?</p>
    <div class="row" style="margin-top:18px">
      <button class="btn gold full" onclick="doLock()">Sí, enviar y cerrar</button>
      <button class="btn ghost full" onclick="closeModal()">Cancelar</button>
    </div>`);
}
async function doLock(){
  try{ await lockMyPred(); closeModal(); render(); toast("Tarjetas enviadas y cerradas 🔒","ok"); }
  catch(e){ toast(e.message,"err"); }
}

/* =====================================================================
   PESTAÑA · PICADA
   ===================================================================== */
function renderPicada(v){
  if(isAdmin()){ v.innerHTML=adminHint("🥒","La pregunta de la Picada y su resultado se gestionan en <b>⚙ Admin → Preguntas</b>."); return; }
  const locked=APP.myPred?.locked; const q=APP.picadaQ;
  const val=(APP.myPred?.picada||{})[q.id]??"";
  v.innerHTML=`<div class="card" style="margin-top:18px">
    <div class="sec-title">Tarjeta Picada · ${q.pts} pts</div>
    <p class="note">Una sola pregunta, se juega antes del Mundial.</p>
    <div class="wq" style="margin-top:12px"><div class="qh"><div class="qn">🥒</div>
      <div class="qt">${esc(q.t)}</div><div><span class="badge w">${q.pts}</span></div></div>
      ${inputFor(q,val,"picada",locked)}</div>
    ${locked?lockMsg():""}
  </div>`;
}

/* helper input según tipo */
function inputFor(q,val,card,locked){
  const dis=locked?"disabled":"";
  if(q.type==="num") return `<input type="number" inputmode="numeric" value="${esc(val)}" ${dis} onchange="setPred('${card}','${q.id}',this.value)">`;
  if(q.type==="participant") return `<select ${dis} onchange="setPred('${card}','${q.id}',this.value)"><option value="">— elegir —</option>${APP.profiles.map(p=>`<option ${val===p.display_name?'selected':''}>${esc(p.display_name)}</option>`).join("")}</select>`;
  if(q.type==="team") return `<select ${dis} onchange="setPred('${card}','${q.id}',this.value)"><option value="">— elegir —</option>${Object.keys(TEAMS).map(c=>`<option ${val===TEAMS[c].n?'selected':''} value="${TEAMS[c].n}">${TEAMS[c].f} ${TEAMS[c].n}</option>`).join("")}</select>`;
  return `<input value="${esc(val)}" placeholder="Respuesta" ${dis} onchange="setPred('${card}','${q.id}',this.value)">`;
}
function lockMsg(){return `<div class="lock-banner">🔒 Tarjeta cerrada. No se puede editar.</div>`;}
function adminHint(ic,txt){return `<div class="card"><div class="empty"><div class="big">${ic}</div>${txt}</div></div>`;}

async function setPred(card,qid,value){
  if(APP.myPred?.locked){ toast("Tarjeta cerrada","err"); return; }
  const obj={...(APP.myPred?.[card]||{})}; obj[qid]=value;
  try{ await saveMyPred({[card]:obj}); }catch(e){ toast(e.message,"err"); }
}

/* =====================================================================
   PESTAÑA · PRINCIPAL
   ===================================================================== */
let PR_PHASE="grupos";
function renderPrincipal(v){
  if(isAdmin()){ v.innerHTML=adminHint("⚽","Los resultados reales de los partidos se cargan en <b>⚙ Admin → Resultados</b>."); return; }
  const locked=APP.myPred?.locked;
  v.innerHTML=`<div class="card" style="margin-top:18px">
    <div class="sec-title">Tarjeta Principal · 289 pts</div>
    <p class="note">Grupos: exacto +5, acierto 1X2 +3, dif. de gol +1. Eliminatorias: exacto +7, acierto +4, quién avanza +3.</p>
    <div class="seg" style="margin-top:12px" id="prSeg">
      ${PHASES.map(p=>`<button class="${PR_PHASE===p.key?'on':''}" data-ph="${p.key}">${p.label.replace('Fase de ','').replace('Ronda de ','R')}</button>`).join("")}
    </div></div>
    <div id="prArea"></div>${PR_PHASE==="grupos"?extrasBlock(locked):""}`;
  document.querySelectorAll("#prSeg button").forEach(b=>b.onclick=()=>{PR_PHASE=b.dataset.ph;renderPrincipal(v);});
  prArea(locked);
}
function extrasBlock(locked){
  const ex=APP.myPred?.extra||{}; const dis=locked?"disabled":"";
  const tsel=(id)=>`<select ${dis} onchange="setExtra('${id}',this.value)"><option value="">—</option>${Object.keys(TEAMS).map(c=>`<option ${ex[id]===c?'selected':''} value="${c}">${TEAMS[c].f} ${TEAMS[c].n}</option>`).join("")}</select>`;
  const isel=(id,ph)=>`<input ${dis} value="${esc(ex[id]||'')}" placeholder="${ph}" onchange="setExtra('${id}',this.value)">`;
  return `<div class="card"><div class="sec-title">Cuadro de honor</div><div class="grid2">
    <div><label class="field">🏆 Campeón (+20)</label>${tsel('champion')}</div>
    <div><label class="field">🥈 Subcampeón (+12)</label>${tsel('runnerup')}</div>
    <div><label class="field">🥉 3er puesto (+8)</label>${tsel('third')}</div>
    <div><label class="field">👟 Bota de oro (+12)</label>${isel('boot_gold','Goleador')}</div>
    <div><label class="field">👟 Bota de plata (+8)</label>${isel('boot_silver','2º goleador')}</div>
    <div><label class="field">👟 Bota de bronce (+5)</label>${isel('boot_bronze','3º goleador')}</div>
    <div><label class="field">⚽ Balón de oro (+10)</label>${isel('ball_gold','Mejor jugador')}</div>
    <div><label class="field">⚽ Balón de plata (+6)</label>${isel('ball_silver','2º mejor')}</div>
    <div><label class="field">⚽ Balón de bronce (+4)</label>${isel('ball_bronze','3º mejor')}</div>
  </div>${locked?lockMsg():""}</div>`;
}
async function setExtra(k,val){
  if(APP.myPred?.locked) return toast("Tarjeta cerrada","err");
  const ex={...(APP.myPred?.extra||{})}; ex[k]=val;
  try{ await saveMyPred({extra:ex}); }catch(e){ toast(e.message,"err"); }
}
function prArea(locked){
  const area=$("#prArea"); if(!area)return;
  const main=APP.myPred?.main||{};
  let ms=FIXTURE.filter(m=>m.phase===PR_PHASE);
  if(PR_PHASE==="grupos"){
    let html="";
    GROUPS.forEach(g=>{
      const gm=ms.filter(m=>m.grp===g);
      const done=gm.filter(m=>main[m.id]&&main[m.id].h!==""&&main[m.id].h!=null).length;
      html+=`<details class="fold"><summary><span class="gtag">${g}</span> Grupo ${g}
        <span class="badge ${done===gm.length?'g':'w'}" style="margin-left:6px">${done}/${gm.length}</span><span class="arr">›</span></summary>
        <div class="body">${[1,2,3].map(j=>`<div class="meta">Jornada ${j} · ${GROUP_DATES[j]}</div>`+
          gm.filter(m=>m.jor===j).map(m=>matchRow(m,main[m.id],locked)).join("")).join("")}</div></details>`;
    });
    area.innerHTML=`<div class="card">${html}</div>`;
  }else{
    area.innerHTML=`<div class="card"><div class="meta">${ms[0]?.label.split(' · ')[0]||''} · ${ms[0]?.date||''}</div>
      <p class="note" style="margin-bottom:10px">Cargá tu marcador. Si va empate, definí quién avanza por penales.</p>
      ${ms.map(m=>matchRowKO(m,main[m.id],locked)).join("")}</div>`;
  }
}
function matchRow(m,p,locked){p=p||{};const dis=locked?"disabled":"";
  return `<div class="match"><div class="teams"><div class="t">${team(m.home)}</div><div class="t">${team(m.away)}</div></div>
    <input class="score-in" type="number" min="0" value="${p.h??""}" ${dis} onchange="setScore(${m.id},'h',this.value)">
    <span class="vs">–</span>
    <input class="score-in" type="number" min="0" value="${p.a??""}" ${dis} onchange="setScore(${m.id},'a',this.value)"></div>`;
}
function matchRowKO(m,p,locked){p=p||{};const dis=locked?"disabled":"";
  const tie=p.h!=null&&p.a!=null&&p.h!==""&&p.a!==""&&(+p.h===+p.a);
  return `<div class="match" style="flex-wrap:wrap"><div class="teams">
      <div class="t"><span class="flag">🔵</span><span class="nm">${m.label}</span></div>
      <div class="t"><span class="flag">🔴</span><span class="nm">cruce</span></div></div>
    <input class="score-in" type="number" min="0" value="${p.h??""}" ${dis} onchange="setScore(${m.id},'h',this.value)">
    <span class="vs">–</span>
    <input class="score-in" type="number" min="0" value="${p.a??""}" ${dis} onchange="setScore(${m.id},'a',this.value)">
    ${tie?`<div class="pen" style="width:100%">⚽ Avanza: <select ${dis} style="width:auto;display:inline-block" onchange="setScore(${m.id},'pen',this.value)">
      <option value="">—</option><option ${p.pen==='1'?'selected':''} value="1">Local</option><option ${p.pen==='0'?'selected':''} value="0">Visitante</option></select></div>`:''}</div>`;
}
async function setScore(id,k,val){
  if(APP.myPred?.locked) return toast("Tarjeta cerrada","err");
  const main={...(APP.myPred?.main||{})}; if(!main[id])main[id]={h:"",a:"",pen:""};
  main[id]={...main[id],[k]:val};
  try{ await saveMyPred({main}); if(k!=="pen"&&PR_PHASE!=="grupos") prArea(false); }
  catch(e){ toast(e.message,"err"); }
}

/* =====================================================================
   PESTAÑA · WASABI
   ===================================================================== */
function renderWasabi(v){
  if(isAdmin()){ v.innerHTML=adminHint("🌶️","Las preguntas Wasabi y sus respuestas se gestionan en <b>⚙ Admin → Preguntas / Resultados</b>."); return; }
  const locked=APP.myPred?.locked; const w=APP.myPred?.wasabi||{};
  const total=APP.wasabiQs.reduce((a,q)=>a+q.pts,0);
  let html=`<div class="card" style="margin-top:18px"><div class="sec-title">Tarjeta Wasabi · ${total} pts</div>
    <p class="note">Las preguntas que hacen único a este prode. Quién comete la primera infracción, no señor.</p></div>`;
  APP.wasabiQs.forEach((q,i)=>{
    html+=`<div class="wq"><div class="qh"><div class="qn">${i+1}</div>
      <div class="qt">${esc(q.t)}</div><div><span class="badge ${q.noComo?'r':'w'}">${q.pts}</span></div></div>
      ${q.type==="bonus"?`<div class="note" style="color:var(--gold)">🎁 Bonus — lo asigna el COMIPRO.</div>`:inputFor(q,w[q.id]??"","wasabi",locked)}</div>`;
  });
  if(locked) html+=lockMsg();
  v.innerHTML=html;
}

/* =====================================================================
   PESTAÑA · TABLA  (privacidad: NO muestra respuestas ajenas)
   ===================================================================== */
function renderTabla(v){
  const tb=standings();
  v.innerHTML=`<div class="card" style="margin-top:18px"><div class="sec-title">Tabla general</div>
    <p class="note">Posiciones y puntajes de todos. Las respuestas de cada jugador son privadas: solo ves las tuyas.</p>
    <div style="overflow-x:auto;margin-top:10px"><table>
      <tr><th>#</th><th class="name">Jugador</th><th>Pic</th><th>Princ</th><th>Was</th><th>Total</th></tr>
      ${tb.map(r=>`<tr class="${r.id===APP.user.id?'me':''}">
        <td><span class="rank ${r.pos<=3?'r'+r.pos:''}">${r.pos}</span></td>
        <td class="name">${r.isBot?'🤖 ':''}${esc(r.name)}${r.id===APP.user.id?' <span class="note">(vos)</span>':''}</td>
        <td>${r.picada}</td><td>${r.main+r.extra}</td><td>${r.wasabi}</td>
        <td class="pts">${r.total}</td></tr>`).join("")}
    </table></div></div>
    <p class="note" style="text-align:center;margin-top:12px">🔒 No se pueden ver los pronósticos de los demás (ni los tuyos los ven ellos).</p>`;
}

/* =====================================================================
   PESTAÑA · COMODINES
   ===================================================================== */
function renderComodines(v){
  const uid=APP.user.id;
  let html=`<div class="card" style="margin-top:18px"><div class="sec-title">Comodines</div>
    <p class="note">Pedí tus sanguijuelas y nitros respetando las reglas. Se pueden solicitar hasta 1 hora antes del primer partido de la fecha.</p></div>`;
  if(!isAdmin()){
    const qs=quotaLeft(uid,"sang"), qn=quotaLeft(uid,"nitro");
    html+=`<div class="como sang"><div class="ic">🃏</div><div class="info"><b>Sanguijuela</b> — robá puntos<br><span class="note">Quedan: ${qs.grupos} en grupos · ${qs.elim} en eliminatorias</span></div><button class="btn sm primary" onclick="openSang()">Usar</button></div>
    <div class="como nitro"><div class="ic">🔥</div><div class="info"><b>Nitro</b> — x3 tus puntos<br><span class="note">Quedan: ${qn.grupos} en grupos · ${qn.elim} en eliminatorias</span></div><button class="btn sm gold" onclick="openNitro()">Usar</button></div>`;
  }
  html+=`<div class="card"><div class="sec-title">Comodines registrados</div>`;
  if(!APP.comodines.length) html+=`<div class="empty"><div class="big">🃏</div>Todavía nadie usó comodines.</div>`;
  else html+=APP.comodines.slice().reverse().map(c=>{
    const byN=nameOf(c.by_user), date=c.phase==="grupos"?`Grupos J${c.jor}`:PHASES.find(p=>p.key===c.phase)?.label;
    if(c.type==="sang") return `<div class="como sang"><div class="ic">🃏</div><div class="info"><b>${esc(byN)}</b> retó a <b>${esc(nameOf(c.target_user))}</b><br><span class="note">${date}</span></div>${isAdmin()?`<button class="btn sm danger" onclick="delComo('${c.id}')">✕</button>`:''}</div>`;
    return `<div class="como nitro"><div class="ic">🔥</div><div class="info"><b>${esc(byN)}</b> activó nitro x3<br><span class="note">${date}</span></div>${isAdmin()?`<button class="btn sm danger" onclick="delComo('${c.id}')">✕</button>`:''}</div>`;
  }).join("");
  html+=`</div>`;
  v.innerHTML=html;
}
function nameOf(uid){ return APP.profiles.find(p=>p.id===uid)?.display_name||"?"; }
async function delComo(id){ await sb.from('comodines').delete().eq('id',id); await loadAll(); render(); toast("Comodín eliminado"); }

function openSang(){
  const tb=standings(); const me=tb.find(r=>r.id===APP.user.id);
  const targets=tb.filter(r=>r.id!==APP.user.id&&(me.pos-r.pos)>0&&(me.pos-r.pos)<=3);
  const d=dateOptions();
  modal(`<h3>🃏 Usar sanguijuela</h3>
    <p class="note">Retás a alguien hasta 3 puestos arriba. Si en esa fecha hacés más puntos que él (Principal), te llevás todos sus puntos.</p>
    <label class="field" style="margin-top:14px">¿A quién retás?</label>
    <select id="sangT">${targets.length?targets.map(r=>`<option value="${r.id}">#${r.pos} ${esc(r.name)} (${r.total})</option>`).join(""):'<option value="">— no hay rivales válidos —</option>'}</select>
    <label class="field" style="margin-top:12px">¿Para qué fecha?</label>
    <select id="sangD">${d.map((x,i)=>`<option value="${i}">${x.label}</option>`).join("")}</select>
    <div class="row" style="margin-top:18px"><button class="btn primary full" onclick="confirmSang()">Confirmar reto</button><button class="btn ghost full" onclick="closeModal()">Cancelar</button></div>`);
}
async function confirmSang(){
  const target=$("#sangT").value; if(!target) return toast("No hay rival válido","err");
  const d=dateOptions()[+$("#sangD").value];
  const err=validateSang(APP.user.id,target,d.phase,d.jor); if(err) return toast(err,"err");
  try{ await requestComodin("sang",target,d.phase,d.jor,kickoffOfDate(d.phase,d.jor)); closeModal(); render(); toast("Sanguijuela activada 🃏","ok"); }
  catch(e){ toast(e.message,"err"); }
}
function openNitro(){
  const d=dateOptions();
  modal(`<h3>🔥 Usar nitro</h3><p class="note">Multiplica x3 tus puntos de Principal de esa fecha. No lo usan 1° ni 2°.</p>
    <label class="field" style="margin-top:14px">¿Para qué fecha?</label>
    <select id="nitroD">${d.map((x,i)=>`<option value="${i}">${x.label}</option>`).join("")}</select>
    <div class="row" style="margin-top:18px"><button class="btn gold full" onclick="confirmNitro()">Activar nitro x3</button><button class="btn ghost full" onclick="closeModal()">Cancelar</button></div>`);
}
async function confirmNitro(){
  const d=dateOptions()[+$("#nitroD").value];
  const err=validateNitro(APP.user.id,d.phase,d.jor); if(err) return toast(err,"err");
  try{ await requestComodin("nitro",null,d.phase,d.jor,kickoffOfDate(d.phase,d.jor)); closeModal(); render(); toast("Nitro activado 🔥","ok"); }
  catch(e){ toast(e.message,"err"); }
}

/* =====================================================================
   PESTAÑA · REGLAMENTO
   ===================================================================== */
function renderReglamento(v){
  const R=REGLAMENTO_2026;
  const list=(arr)=>arr.map(x=>`<div class="reg-item">${esc(x)}</div>`).join("");
  v.innerHTML=`<div class="card" style="margin-top:18px"><div class="sec-title">Reglamento · PingüiProde 2026</div>
    <p class="lead">Bono contribución: $${R.bono.toLocaleString('es-AR')} · Premio: ${esc(R.premio)}</p></div>
    <div class="card flat"><div class="sec-title">Las tres tarjetas</div>
      ${R.tarjetas.map(t=>`<div style="margin-bottom:12px"><b>${t.n}${t.pts?` · ${t.pts} pts`:''}</b><div class="note">${esc(t.desc)}</div></div>`).join("")}</div>
    <details class="fold" open><summary>🃏 Sanguijuelas<span class="arr">›</span></summary><div class="body">${list(R.sanguijuela)}</div></details>
    <details class="fold"><summary>🔥 Nitros<span class="arr">›</span></summary><div class="body">${list(R.nitro)}</div></details>
    <details class="fold"><summary>⚖️ Reglas de interacción<span class="arr">›</span></summary><div class="body">${list(R.interaccion)}</div></details>
    <details class="fold"><summary>🤖 El Nahuelito<span class="arr">›</span></summary><div class="body">${list(R.nahuelito)}</div></details>`;
}

/* =====================================================================
   PESTAÑA · ADMIN (COMIPRO)
   ===================================================================== */
let ADM="resultados", ADM_PHASE="grupos";
function renderAdmin(v){
  if(!isAdmin()){ v.innerHTML=adminHint("🔒","Solo el COMIPRO."); return; }
  v.innerHTML=`<div class="card" style="margin-top:18px"><div class="sec-title">Panel del COMIPRO</div>
    <div class="seg" style="margin-top:10px" id="admSeg">
      ${[["resultados","⚽ Resultados"],["wasabi","🌶️ Result. Wasabi"],["mails","📧 Mails"],["jugadores","👥 Jugadores"]]
        .map(([k,l])=>`<button class="${ADM===k?'on':''}" data-a="${k}">${l}</button>`).join("")}
    </div></div><div id="admArea"></div>`;
  document.querySelectorAll("#admSeg button").forEach(b=>b.onclick=()=>{ADM=b.dataset.a;renderAdmin(v);});
  ({resultados:admResultados,wasabi:admWasabi,mails:admMails,jugadores:admJugadores}[ADM])($("#admArea"));
}
function admResultados(area){
  const res=APP.results.main||{};
  area.innerHTML=`<div class="card"><div class="seg" id="arSeg">
    ${PHASES.map(p=>`<button class="${ADM_PHASE===p.key?'on':''}" data-ph="${p.key}">${p.label.replace('Fase de ','').replace('Ronda de ','R')}</button>`).join("")}
    </div><div id="arArea" style="margin-top:12px"></div></div>
    <div class="card flat"><div class="sec-title">Cuadro de honor (real)</div><div class="grid2" id="exReal"></div></div>`;
  document.querySelectorAll("#arSeg button").forEach(b=>b.onclick=()=>{ADM_PHASE=b.dataset.ph;admResultados(area);});
  const a=$("#arArea"); let ms=FIXTURE.filter(m=>m.phase===ADM_PHASE);
  if(ADM_PHASE==="grupos"){
    let html=""; GROUPS.forEach(g=>{const gm=ms.filter(m=>m.grp===g);
      const done=gm.filter(m=>res[m.id]&&res[m.id].h!==""&&res[m.id].h!=null).length;
      html+=`<details class="fold"><summary><span class="gtag">${g}</span> Grupo ${g}<span class="badge ${done===gm.length?'g':'w'}" style="margin-left:6px">${done}/${gm.length}</span><span class="arr">›</span></summary>
        <div class="body">${[1,2,3].map(j=>`<div class="meta">Jornada ${j}</div>`+gm.filter(m=>m.jor===j).map(m=>admMatch(m,res[m.id])).join("")).join("")}</div></details>`;});
    a.innerHTML=html;
  }else a.innerHTML=`<div class="meta">${ms[0]?.label.split(' · ')[0]||''}</div>${ms.map(m=>admMatchKO(m,res[m.id])).join("")}`;
  // cuadro honor
  const ex=APP.results.extra||{};
  const tsel=(id)=>`<select onchange="setResExtra('${id}',this.value)"><option value="">—</option>${Object.keys(TEAMS).map(c=>`<option ${ex[id]===c?'selected':''} value="${c}">${TEAMS[c].f} ${TEAMS[c].n}</option>`).join("")}</select>`;
  const isel=(id)=>`<input value="${esc(ex[id]||'')}" onchange="setResExtra('${id}',this.value)">`;
  $("#exReal").innerHTML=`
    <div><label class="field">🏆 Campeón</label>${tsel('champion')}</div><div><label class="field">🥈 Subcampeón</label>${tsel('runnerup')}</div>
    <div><label class="field">🥉 3ro</label>${tsel('third')}</div><div><label class="field">👟 Bota oro</label>${isel('boot_gold')}</div>
    <div><label class="field">👟 Bota plata</label>${isel('boot_silver')}</div><div><label class="field">👟 Bota bronce</label>${isel('boot_bronze')}</div>
    <div><label class="field">⚽ Balón oro</label>${isel('ball_gold')}</div><div><label class="field">⚽ Balón plata</label>${isel('ball_silver')}</div>
    <div><label class="field">⚽ Balón bronce</label>${isel('ball_bronze')}</div>`;
}
function admMatch(m,r){r=r||{};
  return `<div class="match"><div class="teams"><div class="t">${team(m.home)}</div><div class="t">${team(m.away)}</div></div>
    <input class="score-in" type="number" min="0" value="${r.h??""}" onchange="setRes(${m.id},'h',this.value)"><span class="vs">–</span>
    <input class="score-in" type="number" min="0" value="${r.a??""}" onchange="setRes(${m.id},'a',this.value)"></div>`;
}
function admMatchKO(m,r){r=r||{};const tie=r.h!=null&&r.a!=null&&r.h!==""&&r.a!==""&&(+r.h===+r.a);
  return `<div class="match" style="flex-wrap:wrap"><div class="teams"><div class="t"><span class="flag">🔵</span><span class="nm">${m.label}</span></div><div class="t"><span class="flag">🔴</span><span class="nm">cruce</span></div></div>
    <input class="score-in" type="number" min="0" value="${r.h??""}" onchange="setRes(${m.id},'h',this.value)"><span class="vs">–</span>
    <input class="score-in" type="number" min="0" value="${r.a??""}" onchange="setRes(${m.id},'a',this.value)">
    ${tie?`<div class="pen" style="width:100%">⚽ Avanza: <select style="width:auto;display:inline-block" onchange="setRes(${m.id},'pen',this.value)"><option value="">—</option><option ${r.pen==='1'?'selected':''} value="1">Local</option><option ${r.pen==='0'?'selected':''} value="0">Visitante</option></select></div>`:''}</div>`;
}
async function setRes(id,k,val){
  const main={...(APP.results.main||{})}; if(!main[id])main[id]={h:"",a:"",pen:""}; main[id]={...main[id],[k]:val};
  try{ await adminSaveResults({main}); toast("Resultado guardado","ok"); if(k!=="pen"&&ADM_PHASE!=="grupos") admResultados($("#admArea")); }catch(e){ toast(e.message,"err"); }
}
async function setResExtra(k,val){ const extra={...(APP.results.extra||{})}; extra[k]=val; try{ await adminSaveResults({extra}); toast("Guardado","ok"); }catch(e){ toast(e.message,"err"); } }

function admWasabi(area){
  const res=APP.results.wasabi||{};
  let html=`<div class="card"><div class="sec-title">Respuestas reales · Wasabi</div><p class="note">Cargá la respuesta correcta de cada pregunta.</p></div>`;
  APP.wasabiQs.forEach((q,i)=>{
    const val=q.type==="bonus"?res["bonus_"+q.id]:res[q.id];
    let input;
    if(q.type==="bonus") input=`<select onchange="setResWas('bonus_${q.id}',this.value)"><option value="">— sin asignar —</option>${APP.profiles.map(p=>`<option ${val===p.id?'selected':''} value="${p.id}">🎁 ${esc(p.display_name)}</option>`).join("")}</select>`;
    else if(q.type==="num") input=`<input type="number" value="${esc(val??'')}" onchange="setResWas('${q.id}',this.value)">`;
    else if(q.type==="participant") input=`<select onchange="setResWas('${q.id}',this.value)"><option value="">—</option>${APP.profiles.map(p=>`<option ${val===p.display_name?'selected':''}>${esc(p.display_name)}</option>`).join("")}</select>`;
    else if(q.type==="team") input=`<select onchange="setResWas('${q.id}',this.value)"><option value="">—</option>${Object.keys(TEAMS).map(c=>`<option ${val===TEAMS[c].n?'selected':''} value="${TEAMS[c].n}">${TEAMS[c].f} ${TEAMS[c].n}</option>`).join("")}</select>`;
    else input=`<input value="${esc(val??'')}" onchange="setResWas('${q.id}',this.value)">`;
    html+=`<div class="wq"><div class="qh"><div class="qn">${i+1}</div><div class="qt">${esc(q.t)}</div><div><span class="badge w">${q.pts}</span></div></div>${input}</div>`;
  });
  // picada
  const pq=APP.picadaQ, pr=(APP.results.picada||{})[pq.id];
  html+=`<div class="card"><div class="sec-title">Resultado Picada</div><div class="wq"><div class="qh"><div class="qn">🥒</div><div class="qt">${esc(pq.t)}</div></div><input value="${esc(pr??'')}" onchange="setResPicada(this.value)"></div></div>`;
  area.innerHTML=html;
}
async function setResWas(id,val){ const wasabi={...(APP.results.wasabi||{})}; wasabi[id]=val; try{ await adminSaveResults({wasabi}); toast("Guardado","ok"); }catch(e){ toast(e.message,"err"); } }
async function setResPicada(val){ const picada={...(APP.results.picada||{})}; picada[APP.picadaQ.id]=val; try{ await adminSaveResults({picada}); toast("Guardado","ok"); }catch(e){ toast(e.message,"err"); } }

async function admMails(area){
  const list=await adminListEmails();
  area.innerHTML=`<div class="card"><div class="sec-title">Mails habilitados</div>
    <p class="note">Solo estos mails pueden registrarse. Agregalos antes de que cada jugador cree su cuenta.</p>
    <div class="row" style="margin-top:12px"><input id="newMail" placeholder="mail@ejemplo.com" style="flex:1"><button class="btn primary sm" onclick="addMail()">+ Agregar</button></div>
    <div class="divider"></div>
    ${list.length?list.map(e=>`<div class="reg-item">${esc(e.email)}</div>`).join(""):'<div class="note">Todavía no agregaste mails.</div>'}
  </div>`;
}
async function addMail(){ const m=$("#newMail").value.trim(); if(!m)return; try{ await adminAddEmail(m); toast("Mail habilitado","ok"); admMails($("#admArea")); }catch(e){ toast(e.message,"err"); } }

function admJugadores(area){
  const tb=standings(); const hasBot=APP.profiles.some(p=>p.is_bot);
  area.innerHTML=`<div class="card"><div class="sec-title">Jugadores</div>
    <p class="note">Marcá quién pagó el bono de $${REGLAMENTO_2026.bono.toLocaleString('es-AR')}.</p>
    <div style="margin-top:12px">${APP.profiles.map(p=>`<div class="match"><div class="teams"><div class="t">${p.is_bot?'🤖 ':''}${esc(p.display_name)} <span class="note">${esc(p.email||'')}</span></div></div>
      <button class="btn sm ${p.paid?'primary':'ghost'}" onclick="togglePaid('${p.id}',${!p.paid})">${p.paid?'✅ Pagó':'Marcar pago'}</button></div>`).join("")}</div></div>
    <div class="card flat"><div class="sec-title">🤖 El Nahuelito</div>
      <p class="note">El bot que completa tarjetas random y mete sanguijuelas en las fechas 3, 6 y 8. ${hasBot?'Ya está en juego. Podés recalcular sus comodines.':'Todavía no lo creaste.'}</p>
      <button class="btn sm gold" style="margin-top:10px" onclick="doNahuelito()">${hasBot?'🔄 Recalcular Nahuelito':'➕ Crear El Nahuelito'}</button>
    </div>`;
}
async function doNahuelito(){
  try{ toast("Generando al Nahuelito…"); await adminCreateNahuelito(); renderAdmin($("#view")); toast("El Nahuelito está en juego 🤖","ok"); }
  catch(e){ toast(e.message,"err"); }
}
async function togglePaid(uid,val){ try{ await adminSetPaid(uid,val); renderAdmin($("#view")); }catch(e){ toast(e.message,"err"); } }

/* ---------- ARRANQUE ---------- */
boot();
