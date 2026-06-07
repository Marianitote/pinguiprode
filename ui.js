// Clones de seguridad reactivos por si ui.js se procesa milisegundos antes que el core
if (typeof standings !== 'function') {
    window.standings = function() { return []; };
}
if (typeof cardSent !== 'function') {
    window.cardSent = function() { return false; };
}

/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — INTERFAZ GENERAL (ui.js)
   ===================================================================== */
const $=s=>document.querySelector(s);
const app=$("#app");
let TAB="inicio";

function toast(m,k){
  const t=$("#toast");
  if(!t) return;
  t.textContent=m;
  t.className="toast show "+(k||"");
  setTimeout(()=>t.className="toast",2600);
}

function esc(s){
  return(s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}

function team(c){
  const t=TEAMS[c];
  return t?`<span class="flag">${t.f}</span><span class="nm">${t.n}</span>`:`<span class="nm" style="color:var(--muted)">—</span>`;
}

function isAdmin(){
  return APP.profile?.is_admin;
}

function modal(html){
  let m=document.createElement("div");
  m.className="modal-bg";
  m.id="modalBg";
  m.innerHTML=`<div class="modal">${html}</div>`;
  m.onclick=e=>{if(e.target===m)closeModal();};
  document.body.appendChild(m);
}

function closeModal(){
  const m=$("#modalBg"); if(m) m.remove();
}

/* ---------- BOOT & INITIALIZATION ---------- */
async function boot(){
  try{
    if(!RECOVERING && /type=recovery/.test(location.hash)){ RECOVERING=true; renderResetPassword(); return; }
    await loadSession();
    if(!APP.user){ renderAuth(); return; }
    if(!APP.profile){ renderCreateProfile(); return; }
    await loadAll();
    render();
  }catch(e){
    console.error(e);
    app.innerHTML=`<div class="auth-wrap"><div class="card"><div class="sec-title">Error de Inicio</div><p class="lead">${esc(e.message||e)}</p></div></div>`;
  }
}
let RECOVERING=false;
sb.auth.onAuthStateChange((event,_s)=>{
  if(event==="PASSWORD_RECOVERY"){ RECOVERING=true; renderResetPassword(); return; }
  if(RECOVERING) return;
  boot();
});

/* ---------- VISTAS DE AUTENTICACIÓN ---------- */
let AUTH_MODE="in"; 
function renderAuth(){
  app.innerHTML=`<div class="auth-wrap">
    <div class="hero" style="text-align:center">
      <div class="logo" style="justify-content:center;font-size:24px"><span class="peng">🐧</span> Pingüi<b>Prode</b></div>
      <h1 style="font-size:34px;margin-top:10px">Mundial <em>2026</em></h1>
      <p class="lead">El prode de las tres tarjetas. Inicia sesión o registrate para competir.</p>
    </div>
    <div class="card">
      <div class="seg" style="margin-bottom:16px">
        <button class="${AUTH_MODE==='in'?'on':''}" onclick="AUTH_MODE='in';renderAuth()">Iniciar sesión</button>
        <button class="${AUTH_MODE==='up'?'on':''}" onclick="AUTH_MODE='up';renderAuth()">Registrarme</button>
      </div>
      <label class="field">Mail institucional o personal registrado</label>
      <input id="email" type="email" placeholder="tucorreo@mail.com" autocomplete="email">
      <label class="field" style="margin-top:12px">Contraseña</label>
      <input id="pass" type="password" placeholder="••••••••" autocomplete="${AUTH_MODE==='up'?'new-password':'current-password'}">
      
      <button class="btn primary full" style="margin-top:16px" onclick="doAuth()">
        ${AUTH_MODE==='in'?'Entrar a la app':'Crear nueva cuenta'}</button>
        
      ${AUTH_MODE==='in'?`<div style="text-align:center;margin-top:14px"><a href="#" onclick="renderRecover();return false;" style="font-size:13px;color:var(--muted)">¿Olvidaste tu contraseña?</a></div>`:''}
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
        <h2>📧 ¡Revisá tu casilla!</h2><p class="lead" style="margin-top:10px">Te enviamos un enlace para confirmar tu registro.</p>
      </div></div>`;
    }else{
      await signIn(email,pass); await boot();
    }
  }catch(e){ toast(e.message,"err"); }
}

function renderRecover(){
  app.innerHTML=`<div class="auth-wrap"><div class="card">
    <div class="sec-title">Recuperar Acceso</div>
    <p class="note" style="margin-bottom:12px">Escribí tu mail y te enviaremos un link de reconfiguración.</p>
    <input id="recEmail" type="email" placeholder="tucorreo@mail.com">
    <button class="btn primary full" style="margin-top:14px" onclick="doRecover()">Enviar enlace de recuperación</button>
    <button class="btn ghost full" style="margin-top:8px" onclick="renderAuth()">Volver atrás</button>
  </div></div>`;
}

async function doRecover(){
  const email=$("#recEmail").value.trim(); if(!email) return toast("Escribí tu mail","err");
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error) toast(error.message,"err");
  else modal(`<h3>Enlace Enviado</h3><p class="note">Revisá tu mail en los próximos minutos.</p><button class="btn primary full" onclick="location.reload()">Entendido</button>`);
}

function renderResetPassword(){
  app.innerHTML=`<div class="auth-wrap"><div class="card">
    <div class="sec-title">Nueva Contraseña</div>
    <input id="newPass" type="password" placeholder="Escribí tu nueva contraseña">
    <button class="btn primary full" style="margin-top:14px" onclick="doResetPassword()">Actualizar contraseña</button>
  </div></div>`;
}

async function doResetPassword(){
  const p=$("#newPass").value; if(p.length<6) return toast("Mínimo 6 caracteres","err");
  const {error}=await sb.auth.updateUser({password:p});
  if(error) toast(error.message,"err");
  else { RECOVERING=false; modal(`<h3>Contraseña Cambiada</h3><button class="btn primary full" onclick="location.href=location.origin+location.pathname">Ir al Login</button>`); }
}

function renderCreateProfile(){
  app.innerHTML=`<div class="auth-wrap"><div class="card">
    <div class="sec-title">Creá tu Jugador</div>
    <label class="field">Nombre público en la tabla</label>
    <input id="dname" placeholder="Ej: Scaloneta99" maxlength="24">
    <button class="btn primary full" style="margin-top:16px" onclick="doCreateProfile()">Confirmar Perfil →</button>
  </div></div>`;
}

async function doCreateProfile(){
  const n=$("#dname").value.trim(); if(!n) return toast("Escribí un nombre","err");
  try{ await createProfile(n); await loadAll(); render(); toast("¡Perfil creado con éxito!","ok"); }
  catch(e){ toast(e.message,"err"); }
}

/* ---------- ESTRUCTURA BASE Y NAVEGACIÓN ---------- */
function render(){
  app.innerHTML=topbar()+tabsBar()+`<div class="wrap" id="view"></div><div id="toast" class="toast"></div>`;
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{TAB=b.dataset.tab;render();window.scrollTo(0,0);});
  const v=$("#view");
  ({inicio:renderInicio,principal:renderPrincipal,wasabi:renderWasabi,tabla:renderTabla,reglamento:renderReglamento,admin:renderAdmin}[TAB]||renderInicio)(v);
}

function topbar(){
  return `<div class="topbar"><div class="inner">
    <div class="logo"><span class="peng">🐧</span> Pingüi<b>Prode</b></div>
    <div class="whoami"><span class="chip" onclick="menuUser()">${esc(APP.profile?.display_name)} ▾</span></div>
  </div></div>`;
}

function tabsBar(){
  const tabs=[["inicio","Inicio"],["principal","Principal"],["wasabi","Wasabi"],["tabla","Tabla"],["reglamento","Reglamento"]];
  if(isAdmin()) tabs.push(["admin","🔧 Admin"]);
  return `<div class="tabs">`+tabs.map(([k,l])=>`<button class="tab ${TAB===k?'active':''}" data-tab="${k}">${l}</button>`).join("")+`</div>`;
}

function menuUser(){
  modal(`<h3>Mi Cuenta</h3><p class="note" style="margin-bottom:12px">${esc(APP.user?.email)}</p>
    <button class="btn ghost full" onclick="closeModal();signOut()">Cerrar sesión de forma segura</button>`);
}

/* ---------- PESTAÑA: INICIO ---------- */
function renderInicio(v){
  const tb=standings();
  const meRow=tb.find(r=>r.id===APP.user.id);
  const mSent=cardSent('main'), wSent=cardSent('wasabi');
  
  v.innerHTML=`
    <div class="hero" style="padding-top:22px">
      <h1>Hola, <em>${esc(APP.profile?.display_name)}</em></h1>
      <p class="lead">Bienvenido a la central oficial de predicciones del torneo.</p>
    </div>
    
    <div class="card">
      <div class="sec-title" style="letter-spacing: 0.5px;">ESTADO DE TUS TARJETAS</div>
      <div style="display:grid; gap:16px; margin-top:20px;">
        
        <!-- Tarjeta Principal -->
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:16px; border-radius:12px; border:1px solid var(--line);">
          <div style="padding-right: 10px;">
            <strong style="font-size:16px; color:var(--snow); display:block; margin-bottom:4px;">Tarjeta Principal (Cuadro Completo)</strong>
            <span style="font-size:12px; color:var(--muted)">Grupos + Llaves Eliminatorias</span>
          </div>
          <div style="flex-shrink: 0;">
            <span class="chip ${mSent?'on':''}" style="font-size:12px; font-weight:bold; padding:6px 12px; display:inline-block;">
              ${mSent?'ENVIADA':'PENDIENTE'}
            </span>
          </div>
        </div>
        
        <!-- Tarjeta Wasabi -->
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:16px; border-radius:12px; border:1px solid var(--line);">
          <div style="padding-right: 10px;">
            <strong style="font-size:16px; color:var(--snow); display:block; margin-bottom:4px;">Tarjeta Wasabi</strong>
            <span style="font-size:12px; color:var(--muted)">Preguntas únicas del mundial</span>
          </div>
          <div style="flex-shrink: 0;">
            <span class="chip ${wSent?'on':''}" style="font-size:12px; font-weight:bold; padding:6px 12px; display:inline-block;">
              ${wSent?'ENVIADA':'PENDIENTE'}
            </span>
          </div>
        </div>

      </div>
    </div>
  `;
}

/* ---------- INPUTS DINÁMICOS ---------- */
const _COLLATOR = new Intl.Collator("es", {sensitivity:"base", ignorePunctuation:true});
function sortByName(arr, key){ return arr.slice().sort((a,b)=> _COLLATOR.compare(key?a[key]:a, key?b[key]:b)); }
function playersOnly(){ return APP.profiles.filter(p=>!p.is_admin); }

function inputFor(q,val,card,locked){
  const dis=locked?"disabled":"";
  const onCh=`onchange="setPred('${card}','${q.id}',this.value)"`;
  if(q.type==="num") return `<input type="number" value="${esc(val)}" ${dis} ${onCh} style="width:90px;text-align:center">`;
  if(q.type==="yesno") return `<select ${dis} ${onCh}><option value="">— elegir —</option>${["Sí","No"].map(o=>`<option ${val===o?'selected':''}>${o}</option>`).join("")}</select>`;
  if(q.type==="choice" && Array.isArray(q.options)) return `<select ${dis} ${onCh}><option value="">— elegir —</option>${sortByName(q.options).map(o=>`<option ${val===o?'selected':''}>${esc(o)}</option>`).join("")}</select>`;
  if(q.type==="player") return `<select ${dis} ${onCh}><option value="">— elegir —</option>${sortByName(PLANTEL_ARG).map(p=>`<option ${val===p?'selected':''}>${esc(p)}</option>`).join("")}</select>`;
  if(q.type==="participant") return `<select ${dis} ${onCh}><option value="">— elegir —</option>${sortByName(playersOnly(),'display_name').map(p=>`<option ${val===p.display_name?'selected':''}>${esc(p.display_name)}</option>`).join("")}</select>`;
  if(q.type==="team"){
    const teams=Object.keys(TEAMS).map(c=>({c,n:TEAMS[c].n,f:TEAMS[c].f}));
    return `<select ${dis} ${onCh}><option value="">— elegir —</option>${sortByName(teams,'n').map(t=>`<option ${val===t.n?'selected':''} value="${t.n}">${t.f} ${t.n}</option>`).join("")}</select>`;
  }
  return `<input value="${esc(val)}" ${dis} ${onCh}>`;
}

async function setPred(card,qid,value){
  if(cardSent(card)){ toast("Tarjeta bloqueada","err"); return; }
  const obj={...(APP.myPred?.[card]||{})}; obj[qid]=value;
  try{ await saveMyPred({[card]:obj}); }catch(e){ toast(e.message,"err"); }
}

/* ---------- PESTAÑA: PRINCIPAL ---------- */
let PR_PHASE="grupos";
function renderPrincipal(v){
  let header=`<div class="card" style="margin-top:18px">
    <div class="sec-title">Tarjeta Principal (Cuadro de Honor)</div>
    <div class="stages-bar">${STAGES.map((s,i)=>{
      const done=stageSent(s);
      const active=!done&&canEnterStage(s);
      return `<button class="${done?'done':active?'active':''}" data-stage="${s}"><span class="num">${i+1}</span><span class="lbl">${STAGE_LABEL[s]}</span></button>`;
    }).join("")}</div>
  </div><div id="prArea"></div>`;
  v.innerHTML = header;
  document.querySelectorAll(".stages-bar button").forEach(b=>{
    b.onclick = ()=>{ PR_PHASE=b.dataset.stage; renderPrincipal(v); };
  });
  prStageArea();
}

function prStageArea(){
  const area=$("#prArea"); if(!area) return;
  if(PR_PHASE==="grupos"){ prAreaGrupos(area); } else { prAreaElim(area, PR_PHASE); }
}

function matchRow(m, pred, sent){
  const dis = sent ? "disabled" : "";
  const hVal = pred ? (pred.h !== undefined ? pred.h : "") : "";
  const aVal = pred ? (pred.a !== undefined ? pred.a : "") : "";
  return `<div class="match">
    <div class="teams">
      <div class="t">${team(m.home)}</div>
      <div class="t">${team(m.away)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <input class="score-in" type="number" value="${hVal}" ${dis} onchange="setGroupMatchRowScore(${m.id}, 'h', this.value)">
      <span class="vs">vs</span>
      <input class="score-in" type="number" value="${aVal}" ${dis} onchange="setGroupMatchRowScore(${m.id}, 'a', this.value)">
    </div>
  </div>`;
}

async function setGroupMatchRowScore(matchId, side, value){
  if(stageSent('grupos')) return;
  const main = { ...(APP.myPred?.main || {}) };
  if(!main[matchId]) main[matchId] = { h: "", a: "" };
  if (value === "") {
    main[matchId][side] = "";
  } else {
    main[matchId][side] = parseInt(value, 10);
  }
  try {
    await saveMyPred({ main });
  } catch(e) { toast(e.message, "err"); }
}

function prAreaGrupos(area){
  const sent=stageSent("grupos");
  let html="";
  GROUPS.forEach(g=>{
    const gm=FIXTURE.filter(m=>m.phase==="grupos"&&m.grp===g);
    html+=`<div class="group-block" style="margin-bottom:20px;">
      <div class="group-head" style="background:var(--frost);padding:8px 12px;border-radius:8px;font-weight:bold;margin-bottom:10px">Grupo ${g}</div>
      <div class="group-body" style="display:grid;gap:8px">${gm.map(m=>matchRow(m, APP.myPred?.main?.[m.id], sent)).join("")}</div>
    </div>`;
  });
  if(!sent) {
    html+=`<div style="margin-top:20px"><button class="btn primary full" onclick="confirmSendStage('grupos')">Confirmar y Guardar Fase de Grupos</button></div>`;
  } else {
    html+=`<div class="card" style="text-align:center;color:var(--ok);font-weight:bold;margin-top:15px">✓ Fase de grupos guardada y bloqueada.</div>`;
  }
  area.innerHTML=html;
}

function prAreaElim(area, stage){
  const sent=stageSent(stage);
  const bracket=APP.myPred?.bracket||{};
  const matchesToShow = bracket[stage] ? Object.values(bracket[stage]) : [];
  
  let html=`<div class="card"><div class="sec-title">${STAGE_LABEL[stage]}</div>`;
  if (matchesToShow.length === 0) {
    html += `<p class="note" style="text-align:center;padding:20px">Primero debés completar y enviar las fases anteriores para calcular los clasificados de esta llave.</p>`;
  } else {
    html+=`<div style="display:grid;gap:12px;margin-top:12px">${matchesToShow.map(m=>bracketMatchRow(m, stage, sent)).join("")}</div>`;
  }
  html+=`</div>`;
  
  if(!sent && matchesToShow.length > 0) {
    html+=`<button class="btn primary full" style="margin-top:14px" onclick="confirmSendStage('${stage}')">Confirmar y Enviar ${STAGE_LABEL[stage]}</button>`;
  } else if (sent) {
    html+=`<div class="card" style="text-align:center;color:var(--ok);font-weight:bold;">✓ Etapa enviada de forma correcta.</div>`;
  }
  area.innerHTML=html;
}

function bracketMatchRow(m, stage, sent){
  const dis=sent?"disabled":"";
  const hVal = m.h !== undefined ? m.h : "";
  const aVal = m.a !== undefined ? m.a : "";
  
  let penSelect = "";
  if (hVal !== "" && aVal !== "" && parseInt(hVal,10) === parseInt(aVal,10)) {
    penSelect = `
      <select ${dis} onchange="setBScore('${stage}','${m.id}','pen',this.value)" style="margin-left:10px;font-size:12px;padding:4px">
        <option value="">— ¿Quién avanza por penales? —</option>
        <option value="1" ${m.pen==='1'?'selected':''}>Avanza Local</option>
        <option value="2" ${m.pen==='2'?'selected':''}>Avanza Visitante</option>
      </select>
    `;
  }

  return `<div class="match" style="border-bottom:1px solid var(--line);padding-bottom:8px">
    <div class="teams">
      <div class="t">${team(m.home)}</div>
      <div class="t">${team(m.away)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <input class="score-in" type="number" value="${hVal}" ${dis} onchange="setBScore('${stage}','${m.id}','h',this.value)">
      <input class="score-in" type="number" value="${aVal}" ${dis} onchange="setBScore('${stage}','${m.id}','a',this.value)">
      ${penSelect}
    </div>
  </div>`;
}

async function setBScore(stage, slotId, key, value){
  try{
    await setBracketScore(stage, slotId, key, value === "" ? "" : value);
    if(key !== 'pen') { prStageArea(); } // Refrescar por si se habilitan penales
  }catch(e){ toast(e.message,"err"); }
}

async function confirmSendStage(stage){
  if(!confirm(`⚠️ ¿Estás seguro de cerrar y guardar la etapa "${STAGE_LABEL[stage]}"?\nEsta acción es irreversible y bloqueará los partidos.`)) return;
  try{
    await saveStageCard(stage);
    render();
    toast("Etapa guardada y procesada con éxito","ok");
  }catch(e){ toast(e.message,"err"); }
}

/* ---------- PESTAÑA: WASABI ---------- */
function renderWasabi(v){
  const sent=stageSent("wasabi");
  v.innerHTML=`<div class="card"><div class="sec-title">Tarjeta Wasabi</div>
    <p class="note" style="margin-bottom:14px">Respondé las consignas exclusivas. Recordá que una vez enviadas no se pueden modificar.</p>
    <div style="display:grid;gap:16px">${APP.wasabiQs.map(q=>`
      <div class="wq" style="display:flex;justify-content:between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px">
        <div class="qt" style="max-width:70%"><b>${q.t}</b>${q.ac?`<br><span style="font-size:11px;color:var(--muted)">${q.ac}</span>`:''}</div>
        <div>${inputFor(q, APP.myPred?.wasabi?.[q.id]||"", 'wasabi', sent)}</div>
      </div>`).join("")}
    </div>
    ${!sent?`<button class="btn primary full" style="margin-top:20px" onclick="confirmSendStage('wasabi')">Enviar Tarjeta Wasabi Oficial</button>`:
    `<div class="card" style="text-align:center;color:var(--ok);font-weight:bold;margin-top:15px">✓ Tarjeta Wasabi enviada y sellada.</div>`}
  </div>`;
}

/* ---------- PESTAÑA: TABLA DE POSICIONES (ERROR REPARADO) ---------- */
function renderTabla(v) {
  const jugadores = standings();
  
  let html = `
    <div class="card">
      <div class="sec-title">🏆 Tabla de Posiciones</div>
      <p class="note">Historial en tiempo real de todos los participantes habilitados del Mundial 2026.</p>
      
      <div style="overflow-x: auto; margin-top: 15px;">
        <table class="table-standings" style="width:100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border); color: var(--muted); font-size: 14px;">
              <th style="padding: 8px;">Pos</th>
              <th style="padding: 8px;">Jugador</th>
              <th style="padding: 8px; text-align: right;">Puntos</th>
              <th style="padding: 8px; text-align: center;">Estado</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  if (jugadores.length === 0) {
    html += `<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--muted);">No hay jugadores registrados en la base de datos aún.</td></tr>`;
  } else {
    jugadores.forEach(j => {
      const esPropio = j.id === APP.user?.id ? "font-weight: bold; background-color: rgba(255,255,255,0.06);" : "";
      html += `
        <tr style="border-bottom: 1px solid var(--line); ${esPropio}">
          <td style="padding: 12px 8px;"><b>#${j.pos}</b></td>
          <td style="padding: 12px 8px;">${esc(j.display_name)} ${j.id === APP.user?.id ? "⭐ (Vos)" : ""}</td>
          <td style="padding: 12px 8px; text-align: right; font-weight: bold; color:var(--gold)">${j.total} pts</td>
          <td style="padding: 12px 8px; text-align: center;">
            <span class="chip ${j.paid ? 'on' : ''}" style="font-size: 11px; padding: 2px 6px;">
              ${j.paid ? "Habilitado" : "Pendiente"}
            </span>
          </td>
        </tr>
      `;
    });
  }
  
  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  v.innerHTML = html;
}

/* ---------- PESTAÑA: REGLAMENTO ---------- */
function renderReglamento(v) {
  v.innerHTML = `
    <div class="card">
      <div class="sec-title">📜 Reglamento General 2026</div>
      <p class="lead"><b>Bono de ingreso:</b> $${REGLAMENTO_2026.bono.toLocaleString()}</p>
      <p class="lead"><b>Premio mayor:</b> ${REGLAMENTO_2026.premio}</p>
      
      <h3 style="margin-top: 20px;">Tarjetas del Juego</h3>
      ${REGLAMENTO_2026.tarjetas.map(t => `
        <div style="margin-bottom: 12px; padding: 10px; background: rgba(255,255,255,0.02); border-left: 3px solid var(--primary); border-radius:4px">
          <strong>${t.n}</strong>: ${t.desc}
        </div>
      `).join("")}
      
      <h3 style="margin-top: 20px;">💥 Comodines: Sanguijuelas</h3>
      <ul>${REGLAMENTO_2026.sanguijuela.map(s => `<li style="margin-bottom: 6px; font-size:14px; color:var(--snow)">${s}</li>`).join("")}</ul>
      
      <h3 style="margin-top: 20px;">🚀 Comodines: Nitros</h3>
      <ul>${REGLAMENTO_2026.nitro.map(n => `<li style="margin-bottom: 6px; font-size:14px; color:var(--snow)">${n}</li>`).join("")}</ul>
      
      <p class="note" style="margin-top: 15px;"><b>Ventana de Comodines:</b> ${REGLAMENTO_2026.ventanaComodines}</p>
    </div>
  `;
}

/* ---------- PANEL DE ADMINISTRACIÓN ---------- */
function renderAdmin(v){
  if(!isAdmin()) return v.innerHTML=`<div class="card">Acceso Denegado</div>`;
  v.innerHTML=`<div class="card">
    <div class="sec-title">🔧 Consola de Administración</div>
    <p class="note" style="margin-bottom:15px">Sección exclusiva para la carga de resultados reales e ingresos de caja.</p>
    <div style="display:flex;gap:10px">
       <button class="btn primary" onclick="exportExcel()">📥 Exportar Planilla General (Excel)</button>
    </div>
  </div>`;
}

function exportExcel(){
  toast("Generando Excel estructurado...","ok");
}

// Inicialización automática de la interfaz una vez montado el DOM
document.addEventListener("DOMContentLoaded", boot);
