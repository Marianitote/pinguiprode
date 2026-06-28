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
    // Si venimos del link de reseteo de contraseña, el evento puede haberse
    // disparado antes de registrar el listener. Lo detectamos por la URL.
    if(!RECOVERING && /type=recovery/.test(location.hash)){ RECOVERING=true; renderResetPassword(); return; }
    await loadSession();
    if(!APP.user){ renderAuth(); return; }
    // logueado pero sin perfil → crear perfil
    if(!APP.profile){ renderCreateProfile(); return; }
    await loadAll();
    render();
  }catch(e){ console.error(e); app.innerHTML=`<div class="auth-wrap"><div class="card"><div class="sec-title">Error</div><p class="lead">${esc(e.message||e)}</p><p class="note" style="margin-top:10px">Si recién configuraste Supabase, revisá que las claves en config.js sean correctas.</p></div></div>`; }
}
// flag para no re-renderizar la app encima de la pantalla de nueva contraseña
let RECOVERING=false;
// re-cargar cuando cambia la sesión (ej: al volver del mail de confirmación)
let _firstAuthEvent=true;
sb.auth.onAuthStateChange((event,_s)=>{
  // si el usuario entró desde el link de "recuperar contraseña", mostramos la
  // pantalla para escribir la clave nueva en vez de entrar normal a la app
  if(event==="PASSWORD_RECOVERY"){ RECOVERING=true; renderResetPassword(); return; }
  if(RECOVERING) return; // ya está en la pantalla de nueva clave, no pisar
  // El primer evento (INITIAL_SESSION, que Supabase dispara al cargar) se ignora:
  // el arranque ya llama boot() una vez al final del archivo. Evita doble carga.
  if(_firstAuthEvent){ _firstAuthEvent=false; return; }
  boot();
});

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
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin});
  if(error) toast(traduceError(error),"err"); else toast("Te mandamos un mail para resetear","ok");
}

/* ---------- NUEVA CONTRASEÑA (al entrar desde el link de reseteo) ---------- */
function renderResetPassword(){
  app.innerHTML=`<div class="auth-wrap">
    <div class="hero" style="text-align:center">
      <div class="logo" style="justify-content:center;font-size:24px"><span class="peng">🐧</span> Pingüi<b>Prode</b></div>
      <div class="big" style="font-size:42px;margin-top:8px">🔑</div>
      <h1 style="font-size:30px;margin-top:6px">Nueva contraseña</h1>
      <p class="lead">Elegí tu contraseña nueva (mínimo 6 caracteres).</p>
    </div>
    <div class="card">
      <label class="field">Contraseña nueva</label>
      <input id="np1" type="password" placeholder="••••••••" autocomplete="new-password">
      <label class="field" style="margin-top:12px">Repetir contraseña</label>
      <input id="np2" type="password" placeholder="••••••••" autocomplete="new-password">
      <button class="btn primary full" style="margin-top:16px" onclick="doResetPassword()">Guardar contraseña</button>
    </div>
  </div>`;
}
async function doResetPassword(){
  const p1=$("#np1").value, p2=$("#np2").value;
  if(!p1||p1.length<6) return toast("La contraseña debe tener al menos 6 caracteres","err");
  if(p1!==p2) return toast("Las contraseñas no coinciden","err");
  try{
    const {error}=await sb.auth.updateUser({password:p1});
    if(error) throw error;
    RECOVERING=false;
    toast("¡Contraseña actualizada! 🐧","ok");
    await boot(); // ya queda logueado con la nueva clave
  }catch(e){ toast(traduceError(e),"err"); }
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
  ({inicio:renderInicio,principal:renderPrincipal,wasabi:renderWasabi,rewasabi:renderRewasabi,
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
  const tabs=[["inicio","Inicio"],["principal","Principal"],["wasabi","Wasabi"],["rewasabi","Re-Wasabi"],
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
const AVATAR_MAP = {
  'Penk': 'penk',
  'Lagarto_Juancho': 'lagarto_juancho',
  'Damián': 'damian',
  'Toro': 'toro',
  'Canario': 'canario',
  'Morsa': 'morsa',
  'Pato': 'pato',
  'Dani': 'dani',
  'Reicho': 'reicho',
  'Yanko': 'yanko',
  'Campeón 2014 (Frankie nunca pagó el asado)': 'campeon2014',
  'Truman': 'truman',
};
const AVATAR_BASE = 'https://vbkiqqbybiitsljummpp.supabase.co/storage/v1/object/public/avatars/';
function avatarUrl(name){ const k=AVATAR_MAP[name]; return k?`${AVATAR_BASE}${k}.jpg`:null; }
function renderInicio(v){
  const tb=standings();
  // ---- VISTA DEL ADMIN: tabla completa + accesos rápidos al panel ----
  if(isAdmin()){
    v.innerHTML=`
    <div class="hero" style="padding-top:22px">
      <div class="pill">⚙ Panel del COMIPRO</div>
      <h1>Hola, <em>${esc(APP.profile.display_name)}</em></h1>
      <p class="lead">Sos el COMIPRO. Acá tenés la tabla en vivo y los accesos al panel de gestión.</p>
    </div>
    <div class="kpi">
      <div class="k"><div class="n">${tb.length}</div><div class="l">Jugadores</div></div>
      <div class="k"><div class="n">${APP.comodines.length}</div><div class="l">Comodines pedidos</div></div>
      <div class="k"><div class="n">${tb.filter(r=>r.paid).length}</div><div class="l">Pagaron</div></div>
    </div>
    ${(()=>{
      const _tz='America/Argentina/Buenos_Aires';
      const _hoyFifa=todayFifaDate();
      const _tm=FIXTURE.filter(m=>fifaDateOf(m)===_hoyFifa)
        .sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
      if(!_tm.length) return '';
      const _res=APP.results?.main||{};
      let _rows='';
      _tm.forEach(m=>{
        const r=_res[m.id];
        const ht=TEAMS[m.home];const at=TEAMS[m.away];
        const hora=new Date(m.kickoff).toLocaleTimeString('es-AR',{timeZone:_tz,hour:'2-digit',minute:'2-digit'});
        const hasRes=r&&r.h!=null&&r.h!=='';
        _rows+=`<div style="padding:8px 0;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px"><span style="flex:1;font-size:13px">${ht?.f||''} ${ht?.n||m.home} vs ${at?.n||m.away} ${at?.f||''}</span><span>${hasRes?`<span style="color:#22c55e;font-weight:700">✅ ${r.h}-${r.a}</span>`:`<span style="color:var(--muted)">${hora}</span>`}</span></div>`;
      });
      return `<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div class="sec-title" style="margin:0">⚽ Partidos de hoy · <span style="font-weight:400;color:var(--muted);font-size:13px">${new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date(_hoyFifa+'T12:00:00'))}</span></div><button class="btn sm primary" onclick="syncESPN()">🔄 Sincronizar ESPN</button></div>${_rows}</div>`;
    })()}
    <div class="card"><div class="sec-title">Tabla de posiciones</div>
      <p class="note">Vista en vivo de las posiciones.</p>
      ${standingsTableHTML({inline:false})}
    </div>
    ${(()=>{
      const _last=standings()[standings().length-1];
      if(!_last) return '';
      const _av=avatarUrl(_last.name);
      return `<div style="margin:16px 0;border:2px solid var(--gold);border-radius:16px;padding:16px;text-align:center;background:rgba(255,206,71,0.06)">
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:var(--gold);margin-bottom:10px">🥴 EL PELELA DEL MOMENTO</div>
        ${_av?`<img src="${_av}" alt="${esc(_last.name)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--gold);margin-bottom:8px">`:''}
        <div style="font-size:16px;font-weight:700">${esc(_last.name)}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px">${_last.total} pts · Puesto #${_last.pos}</div>
      </div>`;
    })()}
    <div class="card"><div class="sec-title">Accesos rápidos · gestión</div>
      <div class="row" style="flex-direction:column;gap:8px;margin-top:10px">
        <button class="btn sm primary full" onclick="TAB='admin';ADM='resultados';render()">⚽ Cargar resultados</button>
        <button class="btn sm primary full" onclick="TAB='admin';ADM='wasabi';render()">🌶️ Result. Wasabi</button>
        <button class="btn sm full" onclick="TAB='admin';ADM='tarjetas';render()">🔎 Ver tarjetas</button>
        <button class="btn sm full" onclick="TAB='admin';ADM='jugadores';render()">👥 Jugadores · pagos</button>
        <button class="btn sm full" onclick="TAB='admin';ADM='mails';render()">📧 Mails habilitados</button>
        <button class="btn sm gold full" onclick="TAB='admin';ADM='export';render()">📤 Exportar respaldo</button>
      </div>
    </div>`;
    return;
  }
  // ---- VISTA DEL JUGADOR ----
  const meRow=tb.find(r=>r.id===APP.user.id);
  const myPred=APP.myPred||{};
  // estados de cada tarjeta
  const wasabiSent = cardSent('wasabi');
  const principalSent = cardSent('main');
  const rewasabiSent = !!(myPred.sent_at||{}).rewasabi;
  // contador Wasabi
  const wasabiNonBonus = APP.wasabiQs.filter(q=>q.type!=="bonus");
  const wa = wasabiNonBonus.filter(q=>{const v=(myPred.wasabi||{})[q.id]; return v!=null && v!=="";}).length;
  const waTotal = wasabiNonBonus.length;
  // progreso de Principal
  const stagesDone = STAGES.filter(s=>stageSent(s)).length;
  const principalProgress = principalSent
    ? "✓ Todas las etapas enviadas"
    : `Etapa ${stagesDone+1}/${STAGES.length}: ${STAGE_LABEL[currentStage()]||"—"}`;
  // ventana R32 abierta?
  const r32WindowOpen = canEnterStage("r32");
  const elimStageOpen = ELIM_STAGES.find(s=>canEnterStage(s));
  // Re-Wasabi ventana abierta (misma que R32)
  const rwWindowOpen = r32WindowOpen;
  // status badge
  const statusBadge = (sent, pending) => sent
    ? `<span style="color:var(--gold);font-weight:700">🔒 Enviada</span>`
    : pending
      ? `<span style="color:#ef4444;font-weight:700">⚠️ Pendiente</span>`
      : `<span style="color:var(--muted)">(Sin enviar)</span>`;
  v.innerHTML=`
  <div class="hero" style="padding-top:22px">
    <div class="pill">⚽ 48 selecciones · 104 partidos · 11 jun – 19 jul</div>
    <h1>Hola, <em>${esc(APP.profile.display_name)}</em></h1>
    <p class="lead">Completá tus 2 tarjetas antes de la fecha límite. Una vez enviadas, quedan cerradas con candado.</p>
  </div>
  <div class="kpi">
    <div class="k"><div class="n">#${meRow?.pos||'—'}</div><div class="l">Tu posición</div></div>
    <div class="k"><div class="n">${meRow?.total||0}</div><div class="l">Tus puntos</div></div>
    <div class="k"><div class="n">${tb.length}</div><div class="l">Jugadores</div></div>
  </div>
  <div class="card">
    <div class="sec-title">Tus tarjetas</div>
    <table style="width:100%">
      <tr>
        <td class="name">⚽ Principal</td>
        <td style="text-align:right;font-size:12px;color:var(--muted)">${principalProgress}</td>
        <td style="text-align:right;min-width:110px">${statusBadge(principalSent, elimStageOpen&&!stageSent(elimStageOpen))}</td>
      </tr>
      <tr>
        <td class="name">🌶️ Wasabi</td>
        <td style="text-align:right;font-size:12px;color:var(--muted)">${wa}/${waTotal}</td>
        <td style="text-align:right">${statusBadge(wasabiSent, false)}</td>
      </tr>
      ${rwWindowOpen||rewasabiSent ? `<tr>
        <td class="name">🎲 Re-Wasabi</td>
        <td style="text-align:right;font-size:12px;color:var(--muted)">${rwWindowOpen&&!rewasabiSent?'Ventana abierta':rewasabiSent?'Completada':''}</td>
        <td style="text-align:right">${statusBadge(rewasabiSent, rwWindowOpen&&!rewasabiSent)}</td>
      </tr>` : ''}
    </table>
    <div class="row" style="margin-top:14px;gap:8px;flex-wrap:wrap">
      ${elimStageOpen&&!stageSent(elimStageOpen)?`<button class="btn danger sm" onclick="TAB='principal';PR_PHASE='${elimStageOpen}';render()">⚽ Cargar ${STAGE_LABEL[elimStageOpen]||elimStageOpen}</button>`:''}
      ${rwWindowOpen&&!rewasabiSent?`<button class="btn danger sm" onclick="TAB='rewasabi';render()">🎲 Cargar Re-Wasabi</button>`:''}
      ${!principalSent&&!elimStageOpen?`<button class="btn primary sm" onclick="TAB='principal';render()">⚽ Ir a Principal</button>`:''}
      ${!wasabiSent?`<button class="btn primary sm" onclick="TAB='wasabi';render()">🌶️ Ir a Wasabi</button>`:''}
      ${(wasabiSent&&principalSent&&(!rwWindowOpen||rewasabiSent))?'<span class="note">Todo al día ✓ Seguí la tabla y usá tus comodines.</span>':''}
    </div>
    ${(elimStageOpen&&!stageSent(elimStageOpen))||(rwWindowOpen&&!rewasabiSent)?'<p class="note" style="margin-top:10px">⏰ Hay tarjetas pendientes con ventana abierta. ¡No te olvides de confirmarlas antes de que cierren!</p>':''}
    ${(!wasabiSent||(!principalSent&&!elimStageOpen))?'<p class="note" style="margin-top:10px">Podés volver y seguir cargando cada tarjeta. Cuando estés listo, tocá <b>Confirmar y enviar</b>.</p>':''}
  </div>
  ${(()=>{
    // Splash de pendientes — solo si hay ventana abierta y algo sin enviar
    const pendingElim = elimStageOpen && !stageSent(elimStageOpen);
    const pendingRw = rwWindowOpen && !rewasabiSent;
    if(!pendingElim && !pendingRw) return '';
    // Solo mostrar una vez por sesión
    const splashKey = 'splash_'+Date.now().toString().slice(0,-5); // cada 10min como máximo
    const sessionKey = 'splashSeen_'+(elimStageOpen||'rw');
    if(sessionStorage.getItem(sessionKey)) return '';
    sessionStorage.setItem(sessionKey,'1');
    const items = [];
    if(pendingElim) items.push(`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
      <span style="font-size:24px">⚽</span>
      <div style="flex:1"><div style="font-weight:700">Principal · ${esc(STAGE_LABEL[elimStageOpen]||elimStageOpen)}</div><div style="font-size:12px;color:var(--muted)">La ventana de carga está abierta. Confirmá antes de que cierre.</div></div>
      <button class="btn danger sm" onclick="closeModal();TAB='principal';PR_PHASE='${elimStageOpen}';render()">Cargar</button>
    </div>`);
    if(pendingRw) items.push(`<div style="display:flex;align-items:center;gap:10px;padding:10px 0">
      <span style="font-size:24px">🎲</span>
      <div style="flex:1"><div style="font-weight:700">Re-Wasabi</div><div style="font-size:12px;color:var(--muted)">La ventana de carga está abierta. Completá tus respuestas.</div></div>
      <button class="btn danger sm" onclick="closeModal();TAB='rewasabi';render()">Cargar</button>
    </div>`);
    setTimeout(()=>modal(`
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:36px">⚠️</div>
        <div style="font-size:18px;font-weight:700;margin-top:8px">¡Tarjetas pendientes!</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px">Tenés tarjetas sin enviar con ventana abierta</div>
      </div>
      ${items.join('')}
      <button class="btn ghost full" style="margin-top:16px" onclick="closeModal()">Cerrar, lo hago después</button>
    `), 800);
    return '';
  })()}
  ${(()=>{
    // Partidos por día FIFA (hoy abierto + fechas anteriores colapsadas)
    const tz='America/Argentina/Buenos_Aires';
    const res=APP.results?.main||{};
    const myMain=APP.myPred?.main||{};

    function renderDayMatches(dia){
      const matches=FIXTURE.filter(m=>fifaDateOf(m)===dia)
        .sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
      if(!matches.length) return '';
      let rows='';
      matches.forEach(m=>{
        const r=res[m.id]; const p=myMain[m.id]||{};
        const hora=new Date(m.kickoff).toLocaleTimeString('es-AR',{timeZone:tz,hour:'2-digit',minute:'2-digit'});
        const homeTeam=TEAMS[m.home]; const awayTeam=TEAMS[m.away];
        const hasRes = r&&r.h!=null&&r.h!=='';
        const resultStr = hasRes
          ? `<span style="color:#22c55e;font-weight:700">✅ ${r.h}-${r.a}</span>`
          : `<span style="color:var(--muted)">${hora}</span>`;
        const predStr=p.h!=null&&p.h!==''?`${p.h}-${p.a}`:`<span style="color:var(--muted)">—</span>`;
        let acertaronStr='';
        if(hasRes){
          const players=(APP.profiles||[]).filter(pl=>!pl.is_admin);
          const exact=[],suman=[];
          players.forEach(pl=>{
            const preds=APP.allPreds?.[pl.id]?.main||(pl.id===APP.user?.id?APP.myPred?.main:null)||{};
            const pred2=preds[m.id]; if(!pred2) return;
            if(+pred2.h===+r.h&&+pred2.a===+r.a){ exact.push(pl.display_name); return; }
            const rWin=+r.h>+r.a?'h':+r.a>+r.h?'a':'x';
            const pWin=+pred2.h>+pred2.a?'h':+pred2.a>+pred2.h?'a':'x';
            if(rWin===pWin) suman.push(pl.display_name);
          });
          acertaronStr=`<div class="acertaron" style="margin-top:4px">
            <span style="color:var(--aqua)">✅ Exacto: ${exact.length?exact.join(', '):'nadie'}</span><br>
            <span style="color:var(--gold)">👍 Suman puntos: ${suman.length?suman.join(', '):'nadie'}</span>
          </div>`;
        }
        rows+=`<div style="padding:8px 0;border-bottom:1px solid var(--line)">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:13px">${homeTeam?.f||''} ${homeTeam?.n||m.home} vs ${awayTeam?.n||m.away} ${awayTeam?.f||''}</span>
            <span style="font-size:13px;font-weight:700;color:var(--aqua)">· Tu pred: ${predStr}</span>
            <span style="margin-left:auto;font-size:13px">${resultStr}</span>
          </div>${acertaronStr}
        </div>`;
      });
      return rows;
    }

    // días con partidos, ordenados (más reciente primero)
    const diasConPartidos=[...new Set(FIXTURE.filter(m=>fifaDateOf(m)).map(m=>fifaDateOf(m)))].sort().reverse();
    const hoyFifa=todayFifaDate();
    const rowsHoy=renderDayMatches(hoyFifa);
    // días anteriores que ya tienen al menos un resultado cargado o ya pasaron
    const anteriores=diasConPartidos.filter(d=>d<hoyFifa);
    let prevHtml='';
    anteriores.forEach(d=>{
      const r=renderDayMatches(d);
      if(r) prevHtml+=`<div style="margin-top:14px"><div style="font-size:12px;font-weight:700;color:var(--aqua);margin-bottom:6px">📅 ${d}</div>${r}</div>`;
    });

    if(!rowsHoy && !prevHtml) return '';
    return `<div class="card"><div class="sec-title">⚽ Partidos de hoy · <span style="font-weight:400;color:var(--muted);font-size:13px">${new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date(hoyFifa+'T12:00:00'))}</span></div>
      ${rowsHoy || '<p class="note">No hay partidos hoy.</p>'}
      ${prevHtml ? `<details class="fold" style="margin-top:14px"><summary style="cursor:pointer;font-size:13px;color:var(--muted);padding:6px 0">📂 Fechas anteriores (${anteriores.length})<span class="arr">›</span></summary><div style="margin-top:8px">${prevHtml}</div></details>` : ''}
    </div>`;
  })()}
  ${(()=>{
    // ── Sanguijuelas frente a frente: hoy abierto + fechas anteriores colapsadas ──
    const resMain = APP.results?.main||{};
    const preds = APP.allPreds||{};

    // Renderiza la tabla completa de un día (sangDay = fecha FIFA del bloque)
    function renderFFTable(sangDay){
      const sangs = APP.comodines.filter(c=>c.type==='sang'&&c.day===sangDay);
      if(!sangs.length) return '';
      const matches = FIXTURE.filter(m=>fifaDateOf(m)===sangDay)
        .sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
      if(!matches.length) return '';

      // columnas: una por jugador único
      const playerOrder=[]; const playerSangs={};
      sangs.forEach(c=>{
        [c.by_user,c.target_user].forEach((uid,i)=>{
          const role=i===0?'by':'tg';
          if(!playerSangs[uid]){ playerSangs[uid]=[]; playerOrder.push(uid); }
          playerSangs[uid].push({c,role});
        });
      });

      const ptsByUid={};
      sangs.forEach(c=>{
        ptsByUid[c.by_user]=ptsByUid[c.by_user]??mainPointsByDay(preds[c.by_user]||{},sangDay);
        ptsByUid[c.target_user]=ptsByUid[c.target_user]??mainPointsByDay(preds[c.target_user]||{},sangDay);
      });

      function sangBg(sang,uid){
        const pBy=ptsByUid[sang.by_user], pTg=ptsByUid[sang.target_user];
        const isByUser=uid===sang.by_user;
        if(pBy===pTg) return 'rgba(100,149,237,0.18)';
        const won=isByUser?pBy>pTg:pTg>pBy;
        return won?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)';
      }

      let thead=`<tr><th style="text-align:left;font-size:12px;min-width:100px;padding:4px 6px">Partido</th>`;
      playerOrder.forEach(uid=>{
        const name=APP.profiles.find(p=>p.id===uid)?.display_name||'?';
        const roles=playerSangs[uid];
        const isBy=roles.some(r=>r.role==='by'), isTg=roles.some(r=>r.role==='tg');
        const badge=(isBy&&isTg)?'💉🩸':isBy?'💉':'🩸';
        thead+=`<th style="font-size:11px;text-align:center;padding:4px 8px">${esc(name)} ${badge}</th>`;
      });
      thead+=`<th style="font-size:11px;text-align:center;padding:4px 8px">Resultado</th></tr>`;

      let tbody='';
      matches.forEach(m=>{
        const ht=TEAMS[m.home],at=TEAMS[m.away];
        const r=resMain[m.id];
        const hasRes=r&&r.h!=null&&r.h!=='';
        let rowHtml=`<td style="font-size:12px;padding:5px 6px">${ht?.f||''} ${ht?.n||m.home} vs ${at?.n||m.away} ${at?.f||''}</td>`;
        playerOrder.forEach(uid=>{
          const roles=playerSangs[uid];
          const pred=(preds[uid]?.main||{})[m.id];
          const predStr=pred&&pred.h!=null&&pred.h!==''?`${pred.h}-${pred.a}`:'—';
          const bgs=[...new Set(roles.map(rr=>sangBg(rr.c,uid)))];
          if(bgs.length<=1){
            rowHtml+=`<td style="text-align:center;font-size:13px;font-weight:600;background:${bgs[0]||''};padding:5px 8px">${predStr}</td>`;
          } else {
            const franjas=bgs.map((bg,i)=>`<div style="flex:1;padding:5px 4px;background:${bg};${i>0?'border-left:1px solid rgba(255,255,255,0.15)':''}">${predStr}</div>`).join('');
            rowHtml+=`<td style="padding:0;text-align:center;font-size:13px;font-weight:600"><div style="display:flex;height:100%">${franjas}</div></td>`;
          }
        });
        const resStr=hasRes?`<b>${r.h}-${r.a}</b>`:`<span style="color:var(--muted)">—</span>`;
        rowHtml+=`<td style="text-align:center;font-size:13px;padding:5px 8px">${resStr}</td>`;
        tbody+=`<tr style="border-bottom:1px solid rgba(127,29,29,0.2)">${rowHtml}</tr>`;
      });

      let tfoot=`<tr style="border-top:2px solid rgba(127,29,29,0.4)"><td style="font-size:11px;font-weight:700;color:var(--muted);padding:6px 6px">Pts generados</td>`;
      playerOrder.forEach(uid=>{
        const roles=playerSangs[uid];
        const pts=ptsByUid[uid];
        if(roles.length===1){
          const sang=roles[0].c;
          const pBy=ptsByUid[sang.by_user], pTg=ptsByUid[sang.target_user];
          const isByUser=uid===sang.by_user;
          const won=isByUser?pBy>pTg:pTg>pBy;
          const tied=pBy===pTg;
          const col=tied?'cornflowerblue':won?'#22c55e':'#ef4444';
          tfoot+=`<td style="text-align:center;font-size:12px;padding:6px 8px">
            <div style="font-weight:700">${pts} pts</div>
            <div style="font-size:11px;color:${col}">${tied?'Empate':won?'Ganó 🏆':'Perdió'}</div>
          </td>`;
        } else {
          const parts=roles.map(({c,role})=>{
            const pBy=ptsByUid[c.by_user], pTg=ptsByUid[c.target_user];
            const isByUser=uid===c.by_user;
            const won=isByUser?pBy>pTg:pTg>pBy;
            const tied=pBy===pTg;
            const col=tied?'cornflowerblue':won?'#22c55e':'#ef4444';
            const icon=isByUser?'💉':'🩸';
            return `<span style="color:${col}">${icon}${tied?'=':won?'✓':'✗'}</span>`;
          }).join(' ');
          tfoot+=`<td style="text-align:center;font-size:12px;padding:6px 8px">
            <div style="font-weight:700">${pts} pts</div>
            <div style="font-size:13px">${parts}</div>
          </td>`;
        }
      });
      tfoot+=`<td></td></tr>`;

      return `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
        <thead style="border-bottom:2px solid #7f1d1d">${thead}</thead>
        <tbody>${tbody}</tbody>
        <tfoot>${tfoot}</tfoot>
      </table></div>`;
    }

    // todos los días con sanguijuelas
    const diasConSang=[...new Set(APP.comodines.filter(c=>c.type==='sang').map(c=>c.day))].sort().reverse();
    if(!diasConSang.length) return '';
    const hoy=todayFifaDate();

    // tabla de hoy
    const tablaHoy=renderFFTable(hoy);
    // tablas de días anteriores
    const anteriores=diasConSang.filter(d=>d!==hoy);
    let prevHtml='';
    anteriores.forEach(d=>{
      const t=renderFFTable(d);
      if(t) prevHtml+=`<div style="margin-top:16px"><div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:8px">📅 ${d}</div>${t}</div>`;
    });

    if(!tablaHoy && !prevHtml) return '';

    return `<div class="card" style="border-color:#7f1d1d;background:rgba(127,29,29,0.08)">
      <div class="sec-title" style="color:#ef4444">🩸 Sanguijuelas · frente a frente · <span style="font-weight:400;color:rgba(239,68,68,0.7);font-size:13px">${new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date(hoy+'T12:00:00'))}</span></div>
      <p class="note" style="margin-bottom:6px">Retos de hoy. <span style="color:#22c55e;font-weight:600">Verde = ganó</span> · <span style="color:#ef4444;font-weight:600">Rojo = perdió</span> · <span style="color:cornflowerblue;font-weight:600">Azul = empate</span>.</p>
      <p class="note" style="margin-bottom:10px;font-size:11.5px">💉 Retador &nbsp;·&nbsp; 🩸 Retado</p>
      ${tablaHoy || '<p class="note">No hay retos activos hoy.</p>'}
      ${prevHtml ? `<details class="fold" style="margin-top:14px"><summary style="cursor:pointer;font-size:13px;color:var(--muted);padding:6px 0">📂 Fechas anteriores (${anteriores.length})<span class="arr">›</span></summary><div style="margin-top:8px">${prevHtml}</div></details>` : ''}
    </div>`;
  })()}
  ${(()=>{
    // ── Historial de comodines: hoy abierto, días anteriores colapsados ──
    const byBlock={};
    APP.comodines.forEach(c=>{
      const k=c.day||'sin-fecha';
      if(!byBlock[k]) byBlock[k]=[];
      byBlock[k].push(c);
    });
    const blocks=Object.keys(byBlock).sort().reverse();
    if(!blocks.length) return '';
    const hoy = todayFifaDate();

    function renderBlock(block){
      let blockRows='';
      byBlock[block].forEach(c=>{
        const byName=APP.profiles.find(p=>p.id===c.by_user)?.display_name||'?';
        const tgName=c.target_user?APP.profiles.find(p=>p.id===c.target_user)?.display_name||'?':'-';
        if(c.type==='nitro'){
          const pts=mainPointsByDay(APP.allPreds?.[c.by_user]||{},block);
          blockRows+=`<div style="padding:8px;border-radius:8px;background:var(--card2);margin-bottom:6px;display:flex;align-items:center;gap:8px">
            <span>🔥</span><div style="flex:1;font-size:13px"><b>${esc(byName)}</b> usó Nitro</div>
            <span style="color:var(--gold);font-weight:700;font-size:12px">x3 → ${pts*3} pts</span>
          </div>`;
        } else if(c.type==='sang'){
          const pBy=mainPointsByDay(APP.allPreds?.[c.by_user]||{},block);
          const pTg=mainPointsByDay(APP.allPreds?.[c.target_user]||{},block);
          let resultado='',color='var(--muted)',ptsBadge='';
          if(pBy>pTg){resultado=`${esc(byName)} ganó`;color='var(--aqua)';ptsBadge=`+${pTg} pts`;}
          else if(pBy<pTg){resultado=`${esc(byName)} perdió`;color='#ef4444';ptsBadge=`-${pBy*0.5} pts`;}
          else{resultado='Empate';color='var(--muted)';ptsBadge='Sin transferencia';}
          blockRows+=`<div style="padding:8px;border-radius:8px;background:var(--card2);margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:8px">
              <span>🩸</span><div style="flex:1;font-size:13px"><b>${esc(byName)}</b> retó a <b>${esc(tgName)}</b></div>
              <span style="color:${color};font-weight:700;font-size:12px">${resultado}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);padding-left:22px;margin-top:2px">${esc(byName)}: ${pBy} pts · ${esc(tgName)}: ${pTg} pts · ${ptsBadge}</div>
          </div>`;
        }
      });
      return blockRows;
    }

    // bloque de hoy (abierto, sin colapsar)
    let html = '';
    if(byBlock[hoy]){
      html += `<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--aqua);font-weight:700;margin-bottom:6px">📅 Hoy</div>${renderBlock(hoy)}</div>`;
    }
    // días anteriores (colapsados en <details>)
    const anteriores = blocks.filter(b=>b!==hoy);
    if(anteriores.length){
      let prevHtml='';
      anteriores.forEach(block=>{
        const rows=renderBlock(block);
        if(rows) prevHtml+=`<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--muted);font-weight:600;margin-bottom:6px">📅 ${block}</div>${rows}</div>`;
      });
      if(prevHtml){
        html += `<details class="fold"><summary style="cursor:pointer;font-size:13px;color:var(--muted);padding:6px 0">📂 Fechas anteriores (${anteriores.length})<span class="arr">›</span></summary><div style="margin-top:10px">${prevHtml}</div></details>`;
      }
    }
    if(!html) return '';
    return `<div class="card" style="margin-top:16px"><div class="sec-title">📊 Historial de comodines · <span style="font-weight:400;color:var(--muted);font-size:13px">${new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date(hoy+'T12:00:00'))}</span></div>${html}</div>`;
  })()}
  <div class="card"><div class="sec-title">Tabla de posiciones</div>
    ${(()=>{
      const ua = APP.results?.updated_at;
      if(!ua) return '';
      const d = new Date(ua);
      const pad = n => String(n).padStart(2,'0');
      const fecha = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
      const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return `<p class="note" style="margin-bottom:8px">🕐 Actualizado el ${fecha} a las ${hora}hs</p>`;
    })()}
    <p class="note">Desde acá podés tirar 🔥 nitro (en tu fila) o 🩸 sanguijuela a un rival reteable.</p>
    ${standingsTableHTML({inline:true})}
  ${(()=>{
      const wOpen2=windowOpenNow(); const hasMatches2=dayHasMatches(todayFifaDate());
      const tb2=standings(); const meRow2=tb2.find(r=>r.id===APP.user?.id);
      const reteables=tb2.filter(r=>r.id!==APP.user?.id && meRow2 && meRow2.pos!==1 && (meRow2.pos-r.pos)>0 && (meRow2.pos-r.pos)<=3);
      const yaSang = !!askedSangToday(APP.user?.id) || !!wasChallengedToday(APP.user?.id);
      const enabled = reteables.length>0 && hasMatches2 && wOpen2 && !yaSang;
      const opts2 = reteables.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
      const disabledReason = yaSang ? (wasChallengedToday(APP.user?.id)?'Fuiste sanguijueleado en este bloque':'Ya aplicaste sanguijuela hoy') : !hasMatches2||!wOpen2 ? 'Ventana cerrada (6-12hs con partidos)' : reteables.length===0 ? 'No tenés rivales reteables ahora' : '';
      return `<div style="margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:15px">🩸 Aplicar sanguijuela a:</span>
        <select id="sangTarget" ${!enabled?'disabled':''} style="flex:1;min-width:150px;opacity:${enabled?1:0.5}">
          <option value="">— elegí un rival —</option>
          ${opts2}
        </select>
        <button class="btn sm primary" ${!enabled?'disabled':''} title="${disabledReason}" onclick="(function(){if(!windowOpenNow()||!dayHasMatches(todayFifaDate())){toast('Ventana cerrada (6-12hs con partidos)','err');return;}const sel=document.getElementById('sangTarget');if(!sel.value)return;openSangTo(sel.value);})()" >Aplicar 🩸</button>
      </div>`;
    })()}
  </div>
    ${(()=>{
    const tb3=standings();
    const last=tb3[tb3.length-1];
    if(!last) return '';
    const av=avatarUrl(last.name);
    return `<div style="margin:16px 0;border:2px solid var(--gold);border-radius:16px;padding:16px;text-align:center;background:rgba(255,206,71,0.06)">
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:var(--gold);margin-bottom:10px">🥴 EL PELELA DEL MOMENTO</div>
      ${av?`<img src="${av}" alt="${esc(last.name)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--gold);margin-bottom:8px">`:``}
      <div style="font-size:16px;font-weight:700">${esc(last.name)}</div>
      <div style="font-size:13px;color:var(--muted);margin-top:4px">${last.total} pts · Puesto #${last.pos}</div>
    </div>`;
  })()}
  ${(()=>{
    const myPens=(APP.myPred?.penalties||[]);
    const myBonuses=(APP.bonuses||[]).filter(b=>b.user_id===APP.user?.id);
    let html='';
    // ── Tus penalizaciones ──────────────────────────────────────────
    if(myPens.length){
      const total=myPens.reduce((s,p)=>s+(+p.pts||0),0);
      const rows=myPens.map(pen=>{
        const fecha=new Date(pen.date).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:13px">
          <span style="color:#ef4444;font-weight:700;flex-shrink:0">⚡ -${pen.pts}pts</span>
          <span style="flex:1">${esc(pen.reason)}</span>
          <span style="color:var(--muted);font-size:11px">${fecha}</span>
        </div>`;
      }).join('');
      html+=`<div class="card" style="border-color:#ef4444;background:rgba(239,68,68,.06)">
        <div class="sec-title" style="color:#ef4444">⚡ Tus penalizaciones</div>
        <p class="note" style="margin-bottom:10px">Total descontado: <b style="color:#ef4444">-${total}pts</b></p>
        ${rows}
      </div>`;
    }
    // ── Tus bonificaciones ──────────────────────────────────────────
    if(myBonuses.length){
      const total=myBonuses.reduce((s,b)=>s+(+b.pts||0),0);
      const rows=myBonuses.map(b=>{
        const fecha=new Date(b.date).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:13px">
          <span style="color:#22c55e;font-weight:700;flex-shrink:0">✨ +${b.pts}pts</span>
          <span style="flex:1">${esc(b.reason)}</span>
          <span style="color:var(--muted);font-size:11px">${fecha}</span>
        </div>`;
      }).join('');
      html+=`<div class="card" style="border-color:#22c55e;background:rgba(34,197,94,.06);margin-top:12px">
        <div class="sec-title" style="color:#22c55e">✨ Tus bonificaciones</div>
        <p class="note" style="margin-bottom:10px">Total bonificado: <b style="color:#22c55e">+${total}pts</b></p>
        ${rows}
      </div>`;
    }
    // ── Resumen de penalizaciones y bonificaciones de todos ─────────
    const players = APP.profiles.filter(p=>!p.is_admin);
    const allPens = players.filter(p=>(APP.allPreds?.[p.id]?.penalties||[]).length>0 || (APP.bonuses||[]).some(b=>b.user_id===p.id));
    if(allPens.length){
      let resRows='';
      players.forEach(p=>{
        const pens=(APP.allPreds?.[p.id]?.penalties||[]);
        const bons=(APP.bonuses||[]).filter(b=>b.user_id===p.id);
        if(!pens.length && !bons.length) return;
        const totalPen=pens.reduce((s,x)=>s+(+x.pts||0),0);
        const totalBon=bons.reduce((s,x)=>s+(+x.pts||0),0);
        const net=totalBon-totalPen;
        // Mezclar penalizaciones y bonificaciones, ordenar por fecha desc (más reciente primero)
        // Normalizar fechas: las penalizaciones pueden tener date como ISO o como string raro
        function parseDate(d){
          if(!d) return new Date(0);
          const t = new Date(d);
          return isNaN(t.getTime()) ? new Date(0) : t;
        }
        const allItems = [
          ...pens.map(x=>({type:'pen', pts:x.pts, reason:x.reason, date:x.date||'', ts:parseDate(x.date)})),
          ...bons.map(x=>({type:'bon', pts:x.pts, reason:x.reason, date:x.date||'', ts:parseDate(x.date)}))
        ].sort((a,b)=> b.ts - a.ts); // más reciente primero
        const allDetail=allItems.map(x=>{
          const fecha=x.ts>new Date(0)?x.ts.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'}):'—';
          const isPen=x.type==='pen';
          return `<div style="font-size:11px;color:var(--muted);padding:3px 0 3px 12px;border-left:2px solid rgba(${isPen?'239,68,68':'34,197,94'},0.3);display:flex;gap:6px;align-items:baseline">
            <span style="color:${isPen?'#ef4444':'#22c55e'};font-weight:600;flex-shrink:0">${isPen?'⚡ -':'✨ +'}${x.pts}pts</span>
            <span style="flex:1">${esc(x.reason)}</span>
            <span style="flex-shrink:0;color:rgba(255,255,255,0.25);font-size:10px">${fecha}</span>
          </div>`;
        }).join('');
        resRows+=`<div style="padding:8px 0;border-bottom:1px solid var(--line)">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:${allItems.length?'6px':'0'}">
            <span style="flex:1;font-weight:600">${esc(p.display_name)}${p.id===APP.user?.id?' <span class="note">(vos)</span>':''}</span>
            ${totalPen>0?`<span style="color:#ef4444;font-size:12px">⚡ -${totalPen}pts</span>`:''}
            ${totalBon>0?`<span style="color:#22c55e;font-size:12px">✨ +${totalBon}pts</span>`:''}
            <span style="font-weight:700;color:${net>=0?'#22c55e':'#ef4444'};font-size:12px">${net>=0?'+'+net:net} neto</span>
          </div>
          ${allDetail}
        </div>`;
      });
      html+=`<div class="card" style="margin-top:12px">
        <div class="sec-title">📊 Penalizaciones y bonificaciones</div>
        <p class="note" style="margin-bottom:10px">Resumen de descuentos y puntos extra aplicados por el COMIPRO.</p>
        ${resRows}
      </div>`;
    }
    return html;
  })()}
  <div class="card flat"><div class="sec-title">Comodines · resumen</div>
    <p class="note" style="line-height:1.7"><b>🩸 Sanguijuela:</b> 3 por fase. Retás hasta 3 puestos arriba; el 1º no retá. Si hacés más puntos que el retado en su día, te llevás los suyos; si hacés menos, perdés el 50% de lo que él sacó; si empatan, no pasa nada.<br>
    <b>🔥 Nitro:</b> 2 por fase, multiplica x3 tus puntos de Principal del día. No lo usan 1º ni 2°.<br>
    <span style="color:var(--muted)">Se piden cualquier día de la fase entre las 6 y las 12 (hora argentina) y valen para los partidos de ese día. Ojo: no podés usar ambos en el mismo día.</span></p></div>`;
}

/* helper input según tipo */
/* Helpers reutilizables para listas ordenadas */
// ordena strings respetando acentos y ñ (Á va antes de B; ñ va entre n y o)
const _COLLATOR = new Intl.Collator("es", {sensitivity:"base", ignorePunctuation:true});
function sortByName(arr, key){
  return arr.slice().sort((a,b)=> _COLLATOR.compare(key?a[key]:a, key?b[key]:b));
}
// devuelve los perfiles de JUGADORES (no admins, no bots) — para tabla, desplegables, exportación
function playersOnly(){
  return APP.profiles.filter(p=>{
    if(p.is_admin) return false;
    const email = (p.email||"").toLowerCase();
    const name = (p.display_name||"").toLowerCase();
    if(email.includes("nahuelito") || name.includes("nahuelito")) return false;
    if(email.includes("bot") && email.includes("pinguiprode")) return false;
    return true;
  });
}

function inputFor(q,val,card,locked){
  const dis=locked?"disabled":"";
  const onCh=`onchange="setPred('${card}','${q.id}',this.value)"`;
  // Aproximación / numérico: único caso que NO es desplegable
  if(q.type==="num") return `<input type="number" inputmode="numeric" value="${esc(val)}" ${dis} ${onCh}>`;
  // Sí / No
  if(q.type==="yesno") return `<select ${dis} ${onCh}><option value="">— elegir —</option>${["Sí","No"].map(o=>`<option ${val===o?'selected':''}>${o}</option>`).join("")}</select>`;
  // Opciones custom — se ordenan alfabéticamente
  if(q.type==="choice" && Array.isArray(q.options))
    return `<select ${dis} ${onCh}><option value="">— elegir —</option>${sortByName(q.options).map(o=>`<option ${val===o?'selected':''}>${esc(o)}</option>`).join("")}</select>`;
  // Jugador argentino (26) — alfabético
  if(q.type==="player") return `<select ${dis} ${onCh}><option value="">— elegir —</option>${sortByName(PLANTEL_ARG).map(p=>`<option ${val===p?'selected':''}>${esc(p)}</option>`).join("")}</select>`;
  // Otro participante del prode — sin admins, alfabético
  if(q.type==="participant") return `<select ${dis} ${onCh}><option value="">— elegir —</option>${sortByName(playersOnly(),'display_name').map(p=>`<option ${val===p.display_name?'selected':''}>${esc(p.display_name)}</option>`).join("")}</select>`;
  // Selección del Mundial (48 equipos) — alfabético por nombre
  if(q.type==="team"){
    const teams=Object.keys(TEAMS).map(c=>({c,n:TEAMS[c].n,f:TEAMS[c].f}));
    return `<select ${dis} ${onCh}><option value="">— elegir —</option>${sortByName(teams,'n').map(t=>`<option ${val===t.n?'selected':''} value="${t.n}">${t.f} ${t.n}</option>`).join("")}</select>`;
  }
  // Fallback (no debería usarse): texto libre
  return `<input value="${esc(val)}" placeholder="Respuesta" ${dis} ${onCh}>`;
}
function lockMsg(){return `<div class="lock-banner">🔒 Tarjeta cerrada. No se puede editar.</div>`;}
function adminHint(ic,txt){return `<div class="card"><div class="empty"><div class="big">${ic}</div>${txt}</div></div>`;}

async function setPred(card,qid,value){
  if(cardSent(card)){ toast("Esta tarjeta ya fue enviada","err"); return; }
  const obj={...(APP.myPred?.[card]||{})}; obj[qid]=value;
  try{ await saveMyPred({[card]:obj}); render(); }catch(e){ toast(e.message,"err"); }
}

/* =====================================================================
   PESTAÑA · PRINCIPAL
   ===================================================================== */
let PR_PHASE="grupos";
let _prepopulatedDefaults=false;
async function ensureDefaults(){
  if(_prepopulatedDefaults) return;
  if(stageSent('grupos')) { _prepopulatedDefaults=true; return; }
  const main=APP.myPred?.main||{};
  // si el jugador ya tocó al menos un partido, no sobreescribimos nada
  const hasAny = Object.keys(main).some(id=>{const m=main[id]; return m && m.h!=="" && m.h!=null;});
  if(hasAny){ _prepopulatedDefaults=true; return; }
  // poblar TODOS los partidos de grupos con 0-0
  const filled = {...main};
  FIXTURE.filter(m=>m.phase==="grupos").forEach(m=>{
    if(!filled[m.id] || filled[m.id].h==="" || filled[m.id].h==null){
      filled[m.id] = {h:0, a:0, pen:""};
    }
  });
  try{
    await saveMyPred({main:filled});
    _prepopulatedDefaults = true;
  }catch(e){ console.warn("No se pudieron poblar defaults:", e.message); }
}

function renderPrincipal(v){
  if(isAdmin()){ v.innerHTML=adminHint("⚽","Los resultados reales de los partidos se cargan en <b>⚙ Admin → Resultados</b>."); return; }
  // header con barra de etapas
  let header=`<div class="card" style="margin-top:18px">
    <div class="sec-title">Tarjeta Principal</div>
    <p class="note">Cargás los grupos y las eliminatorias por etapa a medida que avanza el torneo. Cada fase se habilita cuando el COMIPRO abre la ventana de carga.</p>
    <p class="note" style="font-style:italic;font-size:12px">💡 Tip: los partidos de grupos arrancan en <b>0-0</b>. Solo cambiá los que querés predecir distinto.</p>
    <div class="stages-bar">${STAGES.map((s,i)=>{
      const done=stageSent(s);
      const open=canEnterStage(s);
      const cls=done?"done":open?"active":"pending";
      const num=i+1;
      return `<button class="${cls}" data-stage="${s}" ${done||open?'':'disabled'}><span class="num">${done?'✓':num}</span><span class="lbl">${STAGE_LABEL[s].replace('Fase de ','').replace(' de Final','').replace('3er Puesto y ','3°+')}</span></button>`;
    }).join("")}</div>
  </div>`;
  v.innerHTML = header + `<div id="prArea"></div>`;
  document.querySelectorAll(".stages-bar button").forEach(b=>{
    b.onclick = ()=>{ PR_PHASE=b.dataset.stage; renderPrincipal(v); };
  });
  if(!PR_PHASE || !STAGES.includes(PR_PHASE)) PR_PHASE = currentStage() || "grupos";
  ensureDefaults().then(()=>prStageArea());
}

/* Render del área activa según la etapa seleccionada */
function prStageArea(){
  const area=$("#prArea"); if(!area) return;
  if(PR_PHASE==="grupos") return prAreaGrupos(area);
  return prAreaElimNew(area, PR_PHASE);
}

/* ETAPA GRUPOS: 12 grupos siempre visibles (no colapsan) — se pintan de verde al completarse */
function prAreaGrupos(area){
  const sent=stageSent("grupos"); const main=APP.myPred?.main||{};
  let html="";
  let totalMatches=0, totalDone=0;
  GROUPS.forEach(g=>{
    const gm=FIXTURE.filter(m=>m.phase==="grupos"&&m.grp===g);
    const done=gm.filter(m=>{const p=main[m.id]; return p&&p.h!==""&&p.h!=null;}).length;
    const full = done===gm.length;
    totalMatches+=gm.length; totalDone+=done;
    html+=`<div class="group-block ${full?'group-full':''}">
      <div class="group-head"><span class="gtag">${g}</span> Grupo ${g}
        <span class="badge ${full?'g':'w'}" style="margin-left:6px">${done}/${gm.length}</span></div>
      <div class="group-body">${[1,2,3].map(j=>`<div class="meta">Jornada ${j} · ${GROUP_DATES[j]}</div>`+
        gm.filter(m=>m.jor===j).map(m=>matchRow(m,main[m.id],sent)).join("")).join("")}</div>
    </div>`;
  });
  let footer="";
  if(sent){
    footer=`<div class="lock-banner" style="margin-top:18px">🔒 Grupos enviados. Ahora pasá a la Ronda de 32 (tab arriba).</div>`;
  } else {
    const all = totalDone>=totalMatches;
    footer=`<div class="card" style="margin-top:18px;text-align:center">
      <p class="note" style="margin-bottom:12px">${all?'✓ Cargaste todos los partidos de grupos. Podés confirmar la fase y pasar a R32.':`Te faltan <b>${totalMatches-totalDone}</b> partidos por cargar.`}</p>
      <button class="btn gold sm" ${all?'':'disabled'} onclick="confirmSendStage('grupos')">✉️ Confirmar grupos y armar R32</button>
      <p class="note" style="margin-top:10px;font-size:11.5px">Una vez confirmados, la app calcula los clasificados (2 primeros + 8 mejores 3ros) y arma tu Ronda de 32. No vas a poder editar grupos.</p>
    </div>`;
  }
  area.innerHTML=`<div class="card">${html}</div>${footer}`;
}

/* ── NUEVA área de eliminatorias (Opción B: fixture oficial FIFA) ───── */
function prAreaElimNew(area, stage){
  if(!canEnterStage(stage)){
    const w = ELIM_WINDOWS[stage];
    const ov = (APP.results?.elim_overrides||{})[stage]||null;
    const now = Date.now();
    const i = STAGES.indexOf(stage);
    const prevSent = i>0 ? stageSent(STAGES[i-1]) : true;
    if(!prevSent){
      area.innerHTML=`<div class="card"><div class="empty"><div class="big">⏳</div>
        <p>Primero confirmá la etapa anterior.</p>
      </div></div>`;
    } else if(ov==="closed"){
      area.innerHTML=`<div class="card"><div class="empty"><div class="big">🔒</div>
        <p>Esta fase está cerrada por el COMIPRO.</p>
      </div></div>`;
    } else if(w && now < new Date(w.open).getTime()){
      // Aún no abrió — mostrar countdown
      const abre = new Date(w.open);
      const diff = abre - now;
      const hh = Math.floor(diff/3600000);
      const mm = Math.floor((diff%3600000)/60000);
      const apertura = abre.toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
      area.innerHTML=`<div class="card"><div class="empty"><div class="big">⏳</div>
        <p style="font-weight:700;font-size:15px">Ventana de carga aún no abierta</p>
        <p class="note" style="margin-top:8px">Abre el <b>${apertura}</b></p>
        <p class="note" style="margin-top:4px">Faltan ${hh>0?hh+'h ':''} ${mm}min</p>
      </div></div>`;
    } else if(w && now > new Date(w.close).getTime()){
      area.innerHTML=`<div class="card"><div class="empty"><div class="big">🔒</div>
        <p>La ventana de carga para esta fase ya cerró.</p>
        <p class="note">Los pronósticos fueron bloqueados automáticamente.</p>
      </div></div>`;
    } else {
      area.innerHTML=`<div class="card"><div class="empty"><div class="big">⏳</div>
        <p>Esta fase todavía no está habilitada.</p>
      </div></div>`;
    }
    return;
  }
  const sent = stageSent(stage);
  const myElim = APP.myPred?.elim||{};
  // partidos de esta fase del fixture oficial
  const matches = FIXTURE.filter(m=>m.phase===(stage==="tpfinal"?"tp":stage)||
    (stage==="tpfinal"&&m.phase==="final")).sort((a,b)=>a.slot-b.slot);
  // para tpfinal: tp + final + cuadro de honor
  const isTpFinal = stage==="tpfinal";
  if(isTpFinal) matches.push(...FIXTURE.filter(m=>m.phase==="final"));

  // verificar que los equipos estén cargados
  const allHaveTeams = matches.every(m=>m.home&&m.away);
  if(!allHaveTeams){
    area.innerHTML=`<div class="card"><div class="empty"><div class="big">⏳</div>
      <p>El COMIPRO está cargando los equipos clasificados.</p>
      <p class="note">Volvé en unos minutos.</p>
    </div></div>`;
    return;
  }

  let html="";
  // cuadro de honor VA PRIMERO en r32
  if(stage==="r32") html += extrasBlock(stageSent("tpfinal"));

  html+=`<div class="card"><div class="sec-title">${STAGE_LABEL[stage]||stage}</div>
    <p class="note">Estos son los cruces reales del Mundial. Cargá tu predicción para cada partido. Si hay empate, elegí quién avanza por penales.</p>`;

  // agrupar por fecha FIFA
  const byDay={};
  matches.forEach(m=>{
    const d=m.fifaDate||m.date||"?";
    if(!byDay[d]) byDay[d]=[];
    byDay[d].push(m);
  });
  Object.keys(byDay).sort().forEach(day=>{
    const tz='America/Argentina/Buenos_Aires';
    const dayLabel = new Intl.DateTimeFormat('es-AR',{timeZone:tz,weekday:'long',day:'numeric',month:'long'}).format(new Date(day+'T12:00:00'));
    html+=`<div class="meta" style="margin-top:14px;text-transform:capitalize">${dayLabel}</div>`;
    byDay[day].forEach(m=>{
      const pred = myElim[m.slot]||{};
      html += elimMatchRow(m, pred, sent, stage);
    });
  });
  html+=`</div>`;

  // footer confirmar
  const allDone = matches.every(m=>{
    const p=myElim[m.slot]||{};
    if(p.h==null||p.h===""||p.a==null||p.a==="") return false;
    if(+p.h===+p.a) return p.pen==="0"||p.pen==="1";
    return true;
  });
  let footer="";
  if(sent){
    footer=`<div class="lock-banner" style="margin-top:18px">🔒 ${STAGE_LABEL[stage]||stage} enviada.${stage==="tpfinal"?' ¡Terminaste la Principal! 🎉':' Cuando el COMIPRO habilite la siguiente fase, podrás cargarla.'}</div>`;
  } else {
    footer=`<div class="card" style="margin-top:18px;text-align:center">
      <p class="note" style="margin-bottom:12px">${allDone?'✓ Listo. Podés confirmar.':'Cargá todos los marcadores.'}</p>
      <button class="btn gold sm" ${allDone?'':'disabled'} onclick="confirmSendElimStage('${stage}')">✉️ Confirmar ${STAGE_LABEL[stage]||stage}</button>
    </div>`;
  }
  area.innerHTML = html+footer;
}

function elimMatchRow(m, pred, sent, stage){
  const dis = sent?"disabled":"";
  const ht=TEAMS[m.home], at=TEAMS[m.away];
  const hora = m.kickoff ? new Date(m.kickoff).toLocaleTimeString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hour:'2-digit',minute:'2-digit'}) : "";
  const tie = pred.h!=null&&pred.a!=null&&pred.h!==""&&pred.a!==""&&(+pred.h===+pred.a);
  const answered = pred.h!=null&&pred.h!==""&&pred.a!=null&&pred.a!==""&&(!tie||pred.pen==="0"||pred.pen==="1");
  const res = (APP.results?.elim||{})[m.slot];
  const hasRes = res&&res.h!=null&&res.h!=="";
  // acertaron
  let acertaronStr="";
  if(hasRes){
    const pts=matchPointsElim(pred,res);
    acertaronStr=`<div class="acertaron" style="margin-top:4px">
      <span style="color:${pts>0?'var(--aqua)':'var(--muted)'}">Pts: <b>${pts>0?'+'+pts:'0'}</b></span>
      ${hasRes?`<span style="color:var(--muted)"> · Real: ${res.h}-${res.a}${+res.h===+res.a?(res.pen==='1'?' (av: local)':' (av: visita)'):''}
      </span>`:''}
    </div>`;
  }
  return `<div class="match ${answered?'match-answered':''}" style="flex-wrap:wrap">
    <div class="teams">
      <div class="t">${ht?`<span class="flag">${ht.f}</span><span class="nm">${ht.n}</span>`:`<span class="nm">${esc(m.home)}</span>`}</div>
      <div class="t">${at?`<span class="flag">${at.f}</span><span class="nm">${at.n}</span>`:`<span class="nm">${esc(m.away)}</span>`}</div>
    </div>
    <input class="score-in" type="number" min="0" value="${pred.h??''}" ${dis} onchange="setElimScore(${m.slot},'h',this.value)">
    <span class="vs">–</span>
    <input class="score-in" type="number" min="0" value="${pred.a??''}" ${dis} onchange="setElimScore(${m.slot},'a',this.value)">
    ${!sent&&hora?`<span style="font-size:11px;color:var(--muted);margin-left:6px">${hora}</span>`:''}
    ${tie?`<div class="pen" style="width:100%">⚽ Avanza: <select ${dis} style="width:auto;display:inline-block" onchange="setElimScore(${m.slot},'pen',this.value)">
      <option value="">—</option>
      <option ${pred.pen==='1'?'selected':''} value="1">${ht?.n||m.home}</option>
      <option ${pred.pen==='0'?'selected':''} value="0">${at?.n||m.away}</option>
    </select></div>`:''}
  </div>${acertaronStr}`;
}

async function setElimScore(slot, key, val){
  const myElim = {...(APP.myPred?.elim||{})};
  myElim[slot] = {...(myElim[slot]||{}), [key]:val};
  // si cambia h o a y ya no es empate, limpiar pen
  if((key==='h'||key==='a')){
    const p=myElim[slot];
    if(p.h!=null&&p.a!=null&&+p.h!==+p.a) p.pen="";
  }
  try{
    await saveElimPred(slot, myElim[slot].h, myElim[slot].a, myElim[slot].pen||"");
    // re-render solo el área activa
    prAreaElimNew($("#prArea"), PR_PHASE);
  }catch(e){ toast(e.message,"err"); }
}

function confirmSendElimStage(stage){
  modal(`<h3>✉️ Confirmar ${STAGE_LABEL[stage]||stage}</h3>
    <p class="lead">Una vez confirmada, no vas a poder cambiar los marcadores de esta fase. ¿Seguro?</p>
    <div class="row" style="margin-top:18px">
      <button class="btn gold full" onclick="doSendElimStage('${stage}')">Sí, confirmar</button>
      <button class="btn ghost full" onclick="closeModal()">Cancelar</button>
    </div>`);
}
async function doSendElimStage(stage){
  try{
    await sendStageElimNew(stage);
    closeModal();
    PR_PHASE = currentStage()||stage;
    render();
    toast(`${STAGE_LABEL[stage]||stage} enviada 🔒`,"ok");
  }catch(e){ closeModal(); toast(e.message,"err"); }
}

/* ETAPA ELIMINATORIA (r32, r16, qf, sf, tpfinal) */
function prAreaElim(area, stage){
  if(!canEnterStage(stage)){
    area.innerHTML=`<div class="card"><p class="note">Primero confirmá las etapas anteriores. Volvé a "${STAGE_LABEL[STAGES[STAGES.indexOf(stage)-1]]}".</p></div>`;
    return;
  }
  const sent=stageSent(stage);
  const bracket=APP.myPred?.bracket||{};
  let html="", footer="", matchesToShow=[];
  if(stage==="tpfinal"){
    // 3er puesto + final + cuadro de honor
    const tp=bracket.tp, fn=bracket.final;
    if(!tp||!fn){ area.innerHTML=`<div class="card"><p class="note">Primero confirmá Semifinales.</p></div>`; return; }
    html=`<div class="card"><div class="sec-title">${STAGE_LABEL[stage]}</div>
      <p class="note">Tus dos finalistas según tu cuadro. Marcá los marcadores (con definición por penales si hay empate).</p>
      <div class="meta" style="margin-top:12px">🥉 3er puesto</div>
      ${bracketMatchRow(tp,"tpfinal",sent)}
      <div class="meta" style="margin-top:12px">🏆 Final</div>
      ${bracketMatchRow(fn,"tpfinal",sent)}
    </div>
    ${extrasBlock(sent)}`;
    matchesToShow=[tp,fn];
  } else {
    matchesToShow = bracket[stage]||[];
    if(!matchesToShow.length){
      area.innerHTML=`<div class="card"><p class="note">Esta etapa se arma cuando confirmes la anterior.</p></div>`;
      return;
    }
    const r32note = stage==="r32" ? `<p class="note" style="margin-top:6px;font-size:12px;color:var(--muted)">💡 El combo <b>"Avanza"</b> aparece solo cuando ponés empate en el marcador.</p>` : "";
    html=`<div class="card"><div class="sec-title">${STAGE_LABEL[stage]}</div>
      <p class="note">Estos son los cruces que se arman con TU cuadro (los equipos que vos hiciste clasificar). Marcá los marcadores; si va empate, definí quién pasa por penales.</p>
      ${r32note}
      ${matchesToShow.map(m=>bracketMatchRow(m,stage,sent)).join("")}
    </div>`;
  }
  const allDone = matchesToShow.every(m=>m.h!=null&&m.h!==""&&m.a!=null&&m.a!==""&&(+m.h!==+m.a||m.pen==="0"||m.pen==="1"));
  if(sent){
    footer=`<div class="lock-banner" style="margin-top:18px">🔒 ${STAGE_LABEL[stage]} enviada. ${stage==="tpfinal"?'Terminaste la Principal 🎉':'Pasá a la siguiente etapa (tab arriba).'}</div>`;
  } else {
    footer=`<div class="card" style="margin-top:18px;text-align:center">
      <p class="note" style="margin-bottom:12px">${allDone?'✓ Listo. Podés confirmar y pasar a la siguiente etapa.':'Cargá todos los marcadores (y definí ganador por penales si hay empate).'}</p>
      <button class="btn gold sm" ${allDone?'':'disabled'} onclick="confirmSendStage('${stage}')">✉️ Confirmar ${STAGE_LABEL[stage]}</button>
    </div>`;
  }
  area.innerHTML=html+footer;
}

/* Render de un cruce de eliminatoria con equipos REALES (los del jugador) */
function bracketMatchRow(m,stage,sent){
  const dis=sent?"disabled":"";
  const tie = m.h!=null&&m.a!=null&&m.h!==""&&m.a!==""&&(+m.h===+m.a);
  const answered = m.h!=null&&m.h!==""&&m.a!=null&&m.a!==""&&(!tie||m.pen==="0"||m.pen==="1");
  return `<div class="match ${answered?'match-answered':''}" style="flex-wrap:wrap">
    <div class="teams">
      <div class="t">${teamByCode(m.home)}</div>
      <div class="t">${teamByCode(m.away)}</div>
    </div>
    <input class="score-in" type="number" min="0" value="${m.h??""}" ${dis} onchange="setBScore('${stage}','${m.id}','h',this.value)">
    <span class="vs">–</span>
    <input class="score-in" type="number" min="0" value="${m.a??""}" ${dis} onchange="setBScore('${stage}','${m.id}','a',this.value)">
    ${tie?`<div class="pen" style="width:100%">⚽ Avanza: <select ${dis} style="width:auto;display:inline-block" onchange="setBScore('${stage}','${m.id}','pen',this.value)">
      <option value="">—</option><option ${m.pen==='1'?'selected':''} value="1">${TEAMS[m.home]?.n||m.home}</option><option ${m.pen==='0'?'selected':''} value="0">${TEAMS[m.away]?.n||m.away}</option></select></div>`:""}
  </div>`;
}
function teamByCode(c){
  const t=TEAMS[c]; if(!t) return `<span class="flag">⬜</span><span class="nm">${esc(c)}</span>`;
  return `<span class="flag">${t.f}</span><span class="nm">${esc(t.n)}</span>`;
}

/* Cuadro de honor (solo se muestra en tpfinal) — puntos ajustados a tu planilla */
function extrasBlock(locked){
  const ex=APP.myPred?.extra||{}; const dis=locked?"disabled":"";
  const tsel=(id)=>`<select ${dis} onchange="setExtra('${id}',this.value)"><option value="">—</option>${sortByName(Object.keys(TEAMS).map(c=>({c,n:TEAMS[c].n,f:TEAMS[c].f})),'n').map(t=>`<option ${ex[id]===t.c?'selected':''} value="${t.c}">${t.f} ${t.n}</option>`).join("")}</select>`;
  const isel=(id,ph)=>`<input ${dis} value="${esc(ex[id]||'')}" placeholder="${ph}" onchange="setExtra('${id}',this.value)">`;
  return `<div class="card"><div class="sec-title">Cuadro de honor</div>
    <p class="note">Bonus por aciertos finales. Las botas y balones son texto libre — escribí el nombre del jugador.</p>
    <div class="grid2" style="margin-top:10px">
      <div><label class="field">🏆 Campeón (+4)</label>${tsel('champion')}</div>
      <div><label class="field">🥈 Subcampeón (+3)</label>${tsel('runnerup')}</div>
      <div><label class="field">🥉 3er puesto (+2)</label>${tsel('third')}</div>
      <div><label class="field">4° puesto</label>${tsel('fourth')}</div>
      <div><label class="field">👟 Bota de Oro (+3) <span class="note">máximo goleador</span></label>${isel('boot_gold','Nombre del jugador')}</div>
      <div><label class="field">👟 Bota de Plata (+2) <span class="note">2º máximo goleador</span></label>${isel('boot_silver','Nombre del jugador')}</div>
      <div><label class="field">👟 Bota de Bronce (+1) <span class="note">3º máximo goleador</span></label>${isel('boot_bronze','Nombre del jugador')}</div>
      <div><label class="field">⚽ Balón de Oro (+3) <span class="note">mejor jugador</span></label>${isel('ball_gold','Nombre del jugador')}</div>
      <div><label class="field">⚽ Balón de Plata (+2) <span class="note">2º mejor jugador</span></label>${isel('ball_silver','Nombre del jugador')}</div>
      <div><label class="field">⚽ Balón de Bronce (+1) <span class="note">3º mejor jugador</span></label>${isel('ball_bronze','Nombre del jugador')}</div>
    </div></div>`;
}

/* Helpers: cargar marcadores en grupos y en bracket */
function acertaronPublic(m){
  const r = (APP.results?.main||{})[m.id];
  if(!r||r.h==null||r.h===""||r.a==null||r.a==="") return "";
  const players = (APP.profiles||[]).filter(p=>!p.is_admin);
  const exact=[], suman=[];
  players.forEach(p=>{
    const preds = APP.allPreds?.[p.id]?.main || (p.id===APP.user?.id ? APP.myPred?.main : null) || {};
    const pred = preds[m.id];
    if(!pred) return;
    if(+pred.h===+r.h && +pred.a===+r.a){ exact.push(p.display_name); return; }
    const rWin = +r.h>+r.a?'h':+r.a>+r.h?'a':'x';
    const pWin = +pred.h>+pred.a?'h':+pred.a>+pred.h?'a':'x';
    if(rWin===pWin) suman.push(p.display_name);
  });
  return `<div class="acertaron">
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Resultado final: <b style="color:white">${r.h} – ${r.a}</b></div>
    <span style="color:var(--aqua)">✅ Exacto: ${exact.length?exact.join(', '):'nadie'}</span><br>
    <span style="color:var(--gold)">👍 Suman puntos: ${suman.length?suman.join(', '):'nadie'}</span>
  </div>`;
}
function matchRow(m,p,locked){p=p||{};const dis=locked?"disabled":"";
  const answered = p.h!=null && p.h!=="" && p.a!=null && p.a!=="";
  return `<div class="match ${answered?'match-answered':''}"><div class="teams"><div class="t">${team(m.home)}</div><div class="t">${team(m.away)}</div></div>
    <input class="score-in" type="number" min="0" value="${p.h??""}" ${dis} onchange="setScore(${m.id},'h',this.value)">
    <span class="vs">–</span>
    <input class="score-in" type="number" min="0" value="${p.a??""}" ${dis} onchange="setScore(${m.id},'a',this.value)"></div>${acertaronPublic(m)}`;
}
async function setScore(id,k,val){
  if(stageSent('grupos')) return toast("Grupos ya enviados","err");
  const main={...(APP.myPred?.main||{})}; if(!main[id])main[id]={h:0,a:0,pen:""};
  main[id]={...main[id],[k]:val};
  try{
    await saveMyPred({main});
    // refrescar SOLO el área de grupos (no toda la Principal) para mantener scroll
    if(PR_PHASE==="grupos") prAreaGrupos($("#prArea"));
  }
  catch(e){ toast(e.message,"err"); }
}
async function setBScore(stage,slotId,key,val){
  try{
    await setBracketScore(stage,slotId,key,val);
    // refrescar SOLO el área eliminatoria activa
    prAreaElim($("#prArea"), stage);
  }
  catch(e){ toast(e.message,"err"); }
}

/* Confirmación de envío de etapa */
function confirmSendStage(stage){
  const lbl = STAGE_LABEL[stage];
  if(stage==="grupos"){
    // Mostrar preview de clasificados antes de confirmar
    const mainPreds = APP.myPred?.main||{};
    const b = computeBracket(mainPreds);
    // Armar tabla por grupo: 1ro, 2do, 3ro (no clasif), 4to (no clasif)
    let gruposHtml = "";
    const posLabels = ["🥇 1°","🥈 2°","3°","4°"];
    const posColors = ["#16a34a","#2563eb","#64748b","#64748b"];
    const bestThirdIds = new Set(b.bestThirds.map(t=>t.team));
    GROUPS.forEach(g=>{
      const rows = b.groupTable[g]||[];
      gruposHtml+=`<div style="margin-bottom:10px">
        <div style="font-weight:800;font-size:12px;letter-spacing:.05em;color:var(--muted);margin-bottom:4px">GRUPO ${g}</div>
        ${rows.map((r,i)=>{
          let badge="", bcolor=posColors[i]||"#64748b";
          if(i<2){ badge=" ✅ Clasifica"; }
          else if(i===2&&bestThirdIds.has(r.team)){ badge=" ✅ Clasifica (mejor 3ro)"; bcolor="#0891b2"; }
          else { badge=" ❌ Eliminado"; }
          const tn=TEAMS[r.team]?.n||r.team, tf=TEAMS[r.team]?.f||"";
          return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--line)">
            <span style="font-size:12px;font-weight:700;color:${bcolor};width:28px">${posLabels[i]}</span>
            <span style="font-size:15px">${tf}</span>
            <span style="flex:1;font-weight:600;font-size:13px">${tn}</span>
            <span style="font-size:11px;font-weight:600;color:${bcolor}">${badge}</span>
            <span style="font-size:11px;color:var(--muted);width:50px;text-align:right">${r.pts}pts · ${r.dg>=0?"+":""}${r.dg}</span>
          </div>`;
        }).join("")}
      </div>`;
    });
    modal(`<h3>📊 Clasificados según tu cuadro</h3>
      <p class="lead" style="margin-bottom:12px">Así quedan las posiciones con los marcadores que cargaste. Revisá y confirmá si está bien.</p>
      <div style="max-height:60vh;overflow-y:auto;padding-right:4px">${gruposHtml}</div>
      <p class="note" style="margin-top:10px;font-size:11.5px">Una vez confirmado, <b>no vas a poder editar los partidos de grupos</b>.</p>
      <div class="row" style="margin-top:14px">
        <button class="btn gold full" onclick="doSendStage('grupos')">✅ Confirmar y armar R32</button>
        <button class="btn ghost full" onclick="closeModal()">Volver a editar</button>
      </div>`);
    return;
  }
  const extra = stage==="tpfinal"
    ? "Esto termina la Tarjeta Principal."
    : `Después de confirmar, la app arma la siguiente etapa con los equipos que ganaron tus cruces.`;
  modal(`<h3>✉️ Confirmar ${lbl}</h3>
    <p class="lead">${extra} Una vez confirmada esta etapa, <b>no vas a poder cambiar los marcadores</b>. ¿Seguro?</p>
    <div class="row" style="margin-top:18px">
      <button class="btn gold full" onclick="doSendStage('${stage}')">Sí, confirmar y avanzar</button>
      <button class="btn ghost full" onclick="closeModal()">Cancelar</button>
    </div>`);
}
async function doSendStage(stage){
  try{
    if(stage==="grupos") await sendStageGrupos();
    else await sendStageElim(stage);
    closeModal();
    // pasar a la siguiente etapa automáticamente
    const next = currentStage(); if(next) PR_PHASE = next;
    render(); toast(`${STAGE_LABEL[stage]} enviada 🔒`,"ok");
  }catch(e){ toast(e.message,"err"); }
}

/* =====================================================================
   PESTAÑA · WASABI
   ===================================================================== */
/* ══════════════════════════════════════════════════════
   RE-WASABI
   ══════════════════════════════════════════════════════ */
function renderRewasabi(v){
  if(isAdmin()){ v.innerHTML=adminHint("🎲","Los resultados de la RE-WASABI se cargan en <b>⚙ Admin → Result. Wasabi</b>."); return; }

  // Verificar ventana — misma que R32
  const w = ELIM_WINDOWS["r32"];
  const ov = (APP.results?.elim_overrides||{})["r32"]||null;
  const now = Date.now();
  const windowOpen = ov==="open" || (!ov && w && now>=new Date(w.open).getTime() && now<=new Date(w.close).getTime());
  const windowClosed = ov==="closed" || (!ov && w && now>new Date(w.close).getTime());

  if(!windowOpen && !windowClosed){
    // Aún no abrió
    const abre = w ? new Date(w.open) : null;
    const diff = abre ? abre-now : 0;
    const hh=Math.floor(diff/3600000), mm=Math.floor((diff%3600000)/60000);
    const apertura = abre ? abre.toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}) : '—';
    v.innerHTML=`<div class="card" style="margin-top:18px"><div class="empty"><div class="big">⏳</div>
      <p style="font-weight:700">Re-Wasabi todavía no está disponible</p>
      <p class="note" style="margin-top:8px">Abre el <b>${apertura}</b></p>
      ${diff>0?`<p class="note">Faltan ${hh>0?hh+'h ':''} ${mm}min</p>`:''}
    </div></div>`;
    return;
  }

  const rqs = APP.rewasabiQs||[...SEED_REWASABI];
  const sent = !!(APP.myPred?.sent_at||{})["rewasabi"];
  const rw = APP.myPred?.rewasabi||{};
  const resRw = APP.results?.rewasabi||{};
  const dis = sent||windowClosed ? "disabled" : "";

  // Equipos clasificados a R32 (del fixture)
  const r32Teams = FIXTURE.filter(m=>m.phase==="r32"&&m.home&&m.away)
    .flatMap(m=>[m.home,m.away])
    .filter((v,i,a)=>a.indexOf(v)===i).sort();

  let html=`<div class="card" style="margin-top:18px">
    <div class="sec-title">🎲 Re-Wasabi</div>
    <p class="note">Preguntas especiales de la fase eliminatoria. No computan para comodines.</p>
    ${sent||windowClosed?'<div class="lock-banner" style="margin-top:10px">🔒 Re-Wasabi enviada o ventana cerrada.</div>':''}
  </div>`;

  rqs.forEach((q,qi)=>{
    const ans = rw[q.id]||"";
    const res = resRw[q.id];
    const answered = q.type==="bonus" || (q.type==="country_phase" ? !!(rw[q.id+"_pais"]) : !!ans);
    let inputHtml="";

    if(q.type==="country_phase"){
      const ansPais=rw[q.id+"_pais"]||"";
      const ansFase=rw[q.id+"_fase"]||"";
      const resPais=resRw[q.id+"_pais"];
      const resFase=resRw[q.id+"_fase"];
      const paisOk=resPais&&norm(ansPais)===norm(resPais);
      const faseOk=resFase&&norm(ansFase)===norm(resFase);
      inputHtml=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <select style="flex:1;min-width:140px" ${dis} onchange="setRewasabi('${q.id}_pais',this.value)">
          <option value="">— País —</option>
          ${r32Teams.map(t=>{ const td=TEAMS[t]; return `<option value="${t}" ${ansPais===t?'selected':''}>${td?td.f+' '+td.n:t}</option>`; }).join('')}
        </select>
        <select style="flex:1;min-width:140px" ${dis} onchange="setRewasabi('${q.id}_fase',this.value)">
          <option value="">— Fase —</option>
          ${FASES_ELIM_RW.map(f=>`<option value="${f}" ${ansFase===f?'selected':''}>${f}</option>`).join('')}
        </select>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px">
        ✅ País + Fase: <b style="color:white">20pts</b> &nbsp;·&nbsp; ✅ Solo País: <b style="color:white">10pts</b> &nbsp;·&nbsp; ❌ Resto: 0pts
      </div>`;
      if(resPais){
        const pts = (paisOk?(q.ptsPais||10):0)+(paisOk&&faseOk?(q.ptsFase||10):0);
        inputHtml+=`<div class="acertaron" style="margin-top:6px">
          <div style="font-size:11px;color:var(--muted)">Resultado: <b style="color:white">${resPais}${resFase?' · '+resFase:''}</b></div>
          <span style="color:${pts>0?'var(--aqua)':'var(--muted)'}">Pts: <b>${pts>0?'+'+pts:0}</b></span>
        </div>`;
      }
    } else if(q.type==="bonus"){
      const winner = resRw["bonus_"+q.id];
      const winnerName = winner ? (APP.profiles?.find(p=>p.id===winner)?.display_name||winner) : null;
      inputHtml=``;
      if(winnerName) inputHtml+=`<div class="acertaron" style="margin-top:6px"><span style="color:${winner===APP.user?.id?'var(--aqua)':'var(--muted)'}">🏆 Ganador: <b>${esc(winnerName)}</b>${winner===APP.user?.id?' (+'+q.pts+'pts)':''}</span></div>`;
    } else if(q.type==="player"){
      inputHtml=`<select style="width:100%;margin-top:8px" ${dis} onchange="setRewasabi('${q.id}',this.value)">
        <option value="">— elegir jugador —</option>
        ${sortByName(PLANTEL_ARG).map(p=>`<option value="${p}" ${ans===p?'selected':''}>${esc(p)}</option>`).join('')}
      </select>`;
      if(res) inputHtml+=`<div class="acertaron" style="margin-top:6px"><div style="font-size:11px;color:var(--muted)">Resultado: <b style="color:white">${esc(res)}</b></div><span style="color:${matchesResult(ans,res)?'var(--aqua)':'var(--muted)'}">${matchesResult(ans,res)?'✅ +'+q.pts+'pts':'—'}</span></div>`;
    } else if(q.type==="participant"){
      const players = (APP.profiles||[]).filter(p=>!p.is_admin);
      inputHtml=`<select style="width:100%;margin-top:8px" ${dis} onchange="setRewasabi('${q.id}',this.value)">
        <option value="">— elegir participante —</option>
        ${players.map(p=>`<option value="${p.display_name}" ${ans===p.display_name?'selected':''}>${esc(p.display_name)}</option>`).join('')}
      </select>`;
      if(res) inputHtml+=`<div class="acertaron" style="margin-top:6px"><div style="font-size:11px;color:var(--muted)">Resultado: <b style="color:white">${esc(res)}</b></div><span style="color:${matchesResult(ans,res)?'var(--aqua)':'var(--muted)'}">${matchesResult(ans,res)?'✅ +'+q.pts+'pts':'—'}</span></div>`;
    } else if(q.type==="approx"){
      inputHtml=`<input type="number" min="0" style="width:120px;margin-top:8px" ${dis} value="${ans}" onchange="setRewasabi('${q.id}',this.value)" placeholder="Minutos">`;
      if(res!=null&&res!=="") inputHtml+=`<div class="acertaron" style="margin-top:6px"><div style="font-size:11px;color:var(--muted)">Resultado: <b style="color:white">${res} min</b></div></div>`;
    } else {
      inputHtml=`<input type="text" style="width:100%;margin-top:8px" ${dis} value="${esc(ans)}" onchange="setRewasabi('${q.id}',this.value)">`;
    }

    html+=`<div class="card" style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;margin-bottom:2px">${qi+1}. ${esc(q.t)}</div>
          ${q.ac?`<div class="note">${esc(q.ac)}</div>`:''}
        </div>
        <span style="color:var(--gold);font-size:12px;font-weight:700;flex-shrink:0">+${q.pts}pts</span>
      </div>
      ${inputHtml}
    </div>`;
  });

  // Botón confirmar
  if(!sent && !windowClosed){
    html+=`<div class="card" style="margin-top:14px;text-align:center">
      <button class="btn gold sm" onclick="confirmSendRewasabi()">✉️ Confirmar Re-Wasabi</button>
    </div>`;
  }

  v.innerHTML=html;
}

async function setRewasabi(key, val){
  const rewasabi={...(APP.myPred?.rewasabi||{}), [key]:val};
  const {data,error}=await sb.from('predictions').update({rewasabi}).eq('user_id',APP.user.id).select().maybeSingle();
  if(error){ toast(error.message,"err"); return; }
  APP.myPred=data;
  renderRewasabi($("#view"));
}

function confirmSendRewasabi(){
  modal(`<h3>✉️ Confirmar Re-Wasabi</h3>
    <p class="lead">Una vez confirmada no vas a poder cambiar tus respuestas. ¿Seguro?</p>
    <div class="row" style="margin-top:18px">
      <button class="btn gold full" onclick="doSendRewasabi()">Sí, confirmar</button>
      <button class="btn ghost full" onclick="closeModal()">Cancelar</button>
    </div>`);
}

async function doSendRewasabi(){
  try{
    const sent_at={...(APP.myPred?.sent_at||{}), rewasabi:new Date().toISOString()};
    const {data,error}=await sb.from('predictions').update({sent_at}).eq('user_id',APP.user.id).select().maybeSingle();
    if(error) throw error;
    APP.myPred=data;
    closeModal();
    toast("Re-Wasabi enviada 🔒","ok");
    renderRewasabi($("#view"));
  }catch(e){ closeModal(); toast(e.message,"err"); }
}

function renderWasabi(v){
  if(isAdmin()){ v.innerHTML=adminHint("🌶️","Las preguntas Wasabi y sus respuestas se gestionan en <b>⚙ Admin → Preguntas / Resultados</b>."); return; }
  const sent = cardSent('wasabi');
  const w=APP.myPred?.wasabi||{};
  const total=APP.wasabiQs.reduce((a,q)=>a+q.pts,0);
  // contador: solo no-bonus (punto 19)
  const nonBonus = APP.wasabiQs.filter(q=>q.type!=="bonus");
  const answered = nonBonus.filter(q=>{const v=w[q.id]; return v!=null && v!=="";}).length;
  const totalNonBonus = nonBonus.length;
  let html=`<div class="card" style="margin-top:18px"><div class="sec-title">Tarjeta Wasabi · ${total} pts</div>
    <p class="note">Las preguntas que hacen único a este prode. Quién comete la primera infracción, no señor.</p>
    <div class="row" style="margin-top:10px;align-items:center;gap:10px">
      <div class="pill" style="flex:1">📋 Respondidas: <b>${answered}/${totalNonBonus}</b></div>
      ${sent?'<span style="color:var(--gold);font-weight:700">🔒 Enviada</span>':'<span style="color:var(--muted)">(Sin enviar)</span>'}
    </div></div>`;
  // Mapa de IDs → encabezado de sección que se inserta ANTES de esa pregunta
  const SECTION_HEADERS = {
    "w1":  { label:"Preguntas Generales",                  icon:"🌍", color:"#3b82f6" },
    "w21": { label:"Preguntas de la Fase de Grupos",        icon:"🏟️", color:"#8b5cf6" },
    "w27": { label:"Primer Partido de Argentina",           icon:"🇦🇷", color:"#16a34a" },
    "w31": { label:"Segundo Partido de Argentina",          icon:"🇦🇷", color:"#b45309" },
    "w33": { label:"Tercer Partido de Argentina",           icon:"🇦🇷", color:"#dc2626" },
    "w38": { label:"Preguntas Cuartos de Final",            icon:"🏅", color:"#7c3aed" },
    "w47": { label:"Preguntas Absolutas",                   icon:"🌍", color:"#3b82f6" },
  };
  let openSection = false;
  APP.wasabiQs.forEach((q,i)=>{
    const v=w[q.id];
    // Insertar encabezado de sección si corresponde
    if(SECTION_HEADERS[q.id]){
      if(openSection) html+=`</div>`; // cerrar sección anterior
      const s=SECTION_HEADERS[q.id];
      html+=`<div class="wasabi-section" style="--sc:${s.color}">
        <div class="wasabi-section-title">${s.icon} ${s.label}</div>`;
      openSection=true;
    }
    const isAnswered = v!=null && v!=="";
    const isBonus = q.type==="bonus";
    // colores de fondo: verde si respondida, oro si bonus, neutro si pendiente
    const resVal=(APP.results.wasabi||{})[q.id];
    const hasResult = !isBonus && resVal!=null && resVal!=="";
    // puntos que sumó este jugador en esta pregunta
    let myPts=0;
    if(hasResult && q.type==="approx"){
      myPts=approxPts(APP.user.id, q.id);
    } else if(hasResult){
      myPts=matchesResult(v, resVal)?q.pts:0;
    }
    // color de fondo: verde si tiene resultado del admin, amarillo si bonus, verde claro si respondida
    const bgClass = isBonus ? "wq-bonus" : hasResult ? "wq-has-result" : (isAnswered ? "wq-answered" : "");
    html+=`<div class="wq ${bgClass}"><div class="qh"><div class="qn">${i+1}</div>
      <div class="qt">${esc(q.t)}</div><div><span class="badge ${q.noComo?'r':'w'}">${q.pts}</span></div></div>
      ${isBonus
        ? `<div class="note" style="color:var(--gold);font-style:italic">🎁 Se completa de manera automática</div>`
        : sent
          ? (v ? `<div style="font-size:13.5px;font-weight:600;color:var(--text);padding:4px 0">${esc(v)}</div>`
               : `<div style="font-size:12.5px;color:var(--muted);font-style:italic;padding:4px 0">Sin responder</div>`)
          : inputFor(q,v??"","wasabi",sent)}
      ${q.ac?`<p class="note" style="margin-top:8px;font-size:12.5px;font-style:italic">${esc(q.ac)}</p>`:""}
      ${hasResult?`<div style="margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:12.5px;color:var(--muted)">✔️ Respuesta correcta: <b style="color:var(--text)">${esc(resVal)}</b></span>
        <span style="font-size:12.5px;font-weight:700;color:${myPts>0?'var(--aqua)':'#ef4444'}">Sumaste: ${myPts} pts</span>
      </div>`:""}
      ${(()=>{
        if(!hasResult) return "";
        let ganadores=[];
        if(q.type==="approx"){
          const resNum=parseFloat(resVal);
          if(!isNaN(resNum)){
            const entries=APP.profiles.filter(p=>!p.is_admin).map(p=>{
              const w=(APP.allPreds?.[p.id]?.wasabi||(p.id===APP.user?.id?APP.myPred?.wasabi:null)||{});
              return {name:p.display_name, val:parseFloat(w[q.id])};
            }).filter(e=>!isNaN(e.val));
            if(entries.length){
              const minDist=Math.min(...entries.map(e=>Math.abs(e.val-resNum)));
              ganadores=entries.filter(e=>Math.abs(e.val-resNum)===minDist).map(e=>e.name);
            }
          }
        } else {
          ganadores=APP.profiles.filter(p=>!p.is_admin).filter(p=>{
            const w=(APP.allPreds?.[p.id]?.wasabi||(p.id===APP.user?.id?APP.myPred?.wasabi:null)||{});
            return matchesResult(w[q.id], resVal);
          }).map(p=>p.display_name);
        }
        return `<div class="acertaron"><span style="color:var(--aqua)">✅ Acertaron: ${ganadores.length?ganadores.join(', '):'nadie'}</span></div>`;
      })()}
      </div>`;
  });
  if(openSection) html+=`</div>`; // cerrar última sección
  // Botón Confirmar y enviar (punto 17)
  if(sent){
    html+=`<div class="lock-banner" style="margin-top:18px">🔒 Tarjeta Wasabi enviada y cerrada. No se puede editar.</div>`;
  } else {
    const allAnswered = answered>=totalNonBonus;
    html+=`<div class="card" style="margin-top:18px;text-align:center">
      <p class="note" style="margin-bottom:12px">${allAnswered ? '✓ Respondiste todas. Podés enviar la tarjeta.' : `Te faltan <b>${totalNonBonus-answered}</b> preguntas por responder.`}</p>
      <button class="btn gold sm" ${allAnswered?'':'disabled'} onclick="confirmSendCard('wasabi')">✉️ Confirmar y enviar Wasabi</button>
      <p class="note" style="margin-top:10px;font-size:11.5px">Una vez enviada, no se puede editar. Las bonus las asigna el COMIPRO en cada partido.</p>
    </div>`;
  }
  v.innerHTML=html;
}
/* Cartel de confirmación + envío de una tarjeta */
function confirmSendCard(card){
  const labels={wasabi:"Wasabi", main:"Principal"};
  modal(`<h3>✉️ Confirmar y enviar tarjeta ${labels[card]}</h3>
    <p class="lead">Una vez que envíes esta tarjeta al COMIPRO, <b>no vas a poder cambiar las respuestas</b>. ¿Confirmás?</p>
    <div class="row" style="margin-top:18px">
      <button class="btn gold full" onclick="doSendCard('${card}')">Sí, enviar al COMIPRO</button>
      <button class="btn ghost full" onclick="closeModal()">Cancelar</button>
    </div>`);
}
async function doSendCard(card){
  try{ await sendCard(card); closeModal(); render(); toast("Tarjeta enviada y cerrada 🔒","ok"); }
  catch(e){ toast(e.message,"err"); }
}

/* =====================================================================
   PESTAÑA · TABLA  (privacidad: NO muestra respuestas ajenas)
   ===================================================================== */
/* =====================================================================
   TABLA DE POSICIONES reutilizable (portada + pestaña Tabla)
   opts.inline = true → muestra botones de nitro/sanguijuela por fila
   ===================================================================== */
function standingsTableHTML(opts){
  opts=opts||{};
  const tb=standings();
  const me=tb.find(r=>r.id===APP.user.id);
  const ZONE_LABELS={elite:"🏆 La élite",midfield:"⚙️ Midfield",pobreza:"🥶 Zona de pobreza"};
  const day=todayFifaDate(); const phase=APP.comodinPhase||currentComodinPhase()||phaseOfDay(day)||"grupos";
  const qKey = phase==="tp"||phase==="final" ? "finals" : phase;

  // helpers por fase
  function sangRecibidas(uid){ return APP.comodines.filter(c=>c.type==="sang"&&c.target_user===uid&&c.phase===phase).length; }
  function sangAplicadas(uid){ return APP.comodines.filter(c=>c.type==="sang"&&c.by_user===uid&&c.phase===phase).length; }
  function nitrosUsados(uid){
    const ph1 = phase==="tp"||phase==="final" ? ["tp","final"] : [phase];
    return APP.comodines.filter(c=>c.type==="nitro"&&c.by_user===uid&&ph1.includes(c.phase)).length;
  }
  function nitrosQuedan(uid){ return Math.max(0, 2 - nitrosUsados(uid)); }
  function sangQuedan(uid){ return Math.max(0, 3 - sangAplicadas(uid)); }
  function recibioSangHoy(uid){ return APP.comodines.some(c=>c.type==="sang"&&c.target_user===uid&&c.day===todayFifaDate()); }
  function usoNitro(uid){ return APP.comodines.some(c=>c.type==="nitro"&&c.by_user===uid&&c.day===todayFifaDate()); }
  function quienSanguijuelo(uid){ const block=todayFifaDate(); const c=APP.comodines.find(co=>co.type==="sang"&&co.target_user===uid&&co.day===block); return c?APP.profiles?.find(p=>p.id===c.by_user)?.display_name||"alguien":null; }

  // botones inline
  function actions(r){
    if(!opts.inline) return "";
    const wOpen = windowOpenNow(); const hasMatches = dayHasMatches(day);
    const ventanaAbierta = wOpen && hasMatches;
    let btns="";

    // ── Botón NITRO (aparece en la propia fila del jugador) ──────────
    if(r.id===APP.user.id && !isAdmin()){
      const qn = nitrosQuedan(r.id);
      const disabled = qn===0 || !ventanaAbierta || !!wasChallengedToday(r.id) || !!askedSangToday(r.id) || !!askedNitroToday(r.id);
      const tip = usoNitro(r.id) ? "Nitro activado hoy"
        : qn===0 ? "Sin nitros restantes esta fase"
        : !ventanaAbierta ? "Ventana cerrada (6-12hs con partidos)"
        : wasChallengedToday(r.id) ? "Te sanguijuelearon hoy"
        : askedSangToday(r.id) ? "Usaste sanguijuela hoy"
        : askedNitroToday(r.id) ? "Ya usaste nitro hoy" : "Usar nitro";
      if(usoNitro(r.id)){
        btns+=`<span class="btn-mini nitro" title="${tip}" style="cursor:default">🔥 ✅</span>`;
      } else if(disabled){
        btns+=`<span class="btn-mini nitro" title="${tip}" style="cursor:not-allowed;opacity:0.4">🔥 ${qn}</span>`;
      } else {
        btns+=`<button class="btn-mini nitro" title="${tip}" onclick="openNitro()">🔥 ${qn}</button>`;
      }
    }

    // ── Botón NITRO en filas ajenas (solo informativo: cuántos le quedan) ──
    if(r.id!==APP.user.id){
      const qnOtro = nitrosQuedan(r.id);
      const nitroHoyOtro = usoNitro(r.id);
      const tip = nitroHoyOtro ? "Usó nitro hoy" : qnOtro===0 ? "Sin nitros restantes esta fase" : `Le quedan ${qnOtro} nitro${qnOtro!==1?'s':''}`;
      btns+=nitroHoyOtro
        ? `<span class="btn-mini nitro" title="${tip}" style="cursor:default">🔥 ✅</span>`
        : `<span class="btn-mini nitro" title="${tip}" style="cursor:default;${qnOtro===0?'opacity:0.35':''}"">🔥 ${qnOtro}</span>`;
    }

    // ── Botón SANGUIJUELA (solo en filas de otros jugadores) ────────
    if(r.id!==APP.user.id){
      const reteable = me && me.pos!==1 && (me.pos-r.pos)>0 && (me.pos-r.pos)<=3;
      const recibidas = sangRecibidas(r.id);
      const queLeQuedan = Math.max(0, 3 - recibidas); // cuántas más puede recibir
      const yaSangHoy = !!askedSangToday(me?.id) || !!wasChallengedToday(me?.id);
      const targetAgotado = recibidas >= 3;
      const yoAgotado = sangQuedan(me?.id||"") <= 0;
      const tip = targetAgotado ? `${esc(r.name)} ya recibió 3 retos esta fase (máximo)`
        : yoAgotado ? "Agotaste tus sanguijuelas de esta fase"
        : yaSangHoy ? (wasChallengedToday(me?.id) ? "Te sanguijuelearon hoy" : "Ya aplicaste sanguijuela hoy")
        : !ventanaAbierta ? "Ventana cerrada (6-12hs con partidos)"
        : `Retar · puede recibir ${queLeQuedan} reto${queLeQuedan!==1?'s':'' } más esta fase`;
      const disabled = targetAgotado || yoAgotado || yaSangHoy || !ventanaAbierta;
      if(reteable){
        if(disabled){
          btns+=`<span class="btn-mini sang" title="${tip}" style="cursor:not-allowed;opacity:0.4">🩸 ${queLeQuedan}</span>`;
        } else {
          btns+=`<button class="btn-mini sang" title="${tip}" onclick="openSangTo('${r.id}')">🩸 ${queLeQuedan}</button>`;
        }
      } else {
        // no reteable pero igual mostramos cuántas puede recibir
        btns+=`<span class="btn-mini sang" title="${tip}" style="cursor:default;opacity:${targetAgotado?0.35:0.6}">🩸 ${queLeQuedan}</span>`;
      }
    }

    return `<div class="tbl-actions" style="display:flex;gap:4px;align-items:center">${btns}</div>`;
  }
  const allZero = tb.every(r=>r.total===0);
  // Si todos tienen 0, forzamos zona pobreza para todos visualmente
  const displayZone = r => allZero ? "pobreza" : r.zone;
  let lastZone=null, out="";
  // Si todos en 0, mostrar las tres zonas vacías primero excepto pobreza que tiene todos
  if(allZero){
    const emptyRow = '<tr><td colspan="5" style="text-align:center;color:var(--muted);font-size:12px;padding:8px 0;font-style:italic">Sin jugadores aún</td></tr>';
    out+=`<tr class="zone-sep"><td colspan="5"><span class="zone-band elite"></span>${ZONE_LABELS["elite"]}</td></tr>`;
    out+=emptyRow;
    out+=`<tr class="zone-sep"><td colspan="5"><span class="zone-band midfield"></span>${ZONE_LABELS["midfield"]}</td></tr>`;
    out+=emptyRow;
    out+=`<tr class="zone-sep"><td colspan="5"><span class="zone-band pobreza"></span>${ZONE_LABELS["pobreza"]}</td></tr>`;
  }
  tb.forEach(r=>{
    const dz = displayZone(r);
    if(!allZero && dz!==lastZone){
      out+=`<tr class="zone-sep"><td colspan="5"><span class="zone-band ${dz}"></span>${ZONE_LABELS[dz]}</td></tr>`;
      lastZone=dz;
    }
    const arrow = "";
    // ── badges al lado del nombre ──────────────────────────────────────
    const sangBy = quienSanguijuelo(r.id);
    const recvHoyBadge = sangBy ? `<span title="Retado hoy por ${sangBy}" style="margin-left:3px">🩸</span>` : "";
    // sanguijuelas: cuántas aplicó esta fase
    const nSangApl = sangAplicadas(r.id);
    const aplSangBadge = nSangApl > 0
      ? `<span title="Aplicó ${nSangApl} sanguijuela${nSangApl>1?'s':''} esta fase" style="margin-left:4px;font-size:11px;color:#ef4444;font-weight:700">🩸${nSangApl}</span>`
      : "";
    // nitros: cuántos usó esta fase
    const nNitroUs = nitrosUsados(r.id);
    const aplNitroBadge = nNitroUs > 0
      ? `<span title="Usó ${nNitroUs} nitro${nNitroUs>1?'s':''} esta fase" style="margin-left:4px;font-size:11px;color:var(--gold);font-weight:700">🔥${nNitroUs}</span>`
      : "";
    const penBadge = r.penalty>0 ? `<span title="Penalización: -${r.penalty}pts" style="color:#ef4444;font-size:11px;font-weight:700;margin-left:4px">⚡-${r.penalty}</span>` : "";
    const bonTotal = bonusTotal(r.id);
    const bonBadge = bonTotal>0 ? `<span title="Bonificación: +${bonTotal}pts" style="color:#22c55e;font-size:11px;font-weight:700;margin-left:4px">✨+${bonTotal}</span>` : "";
    out+=`<tr class="${r.id===APP.user.id?'me':''} zone-${displayZone(r)}">
      <td><span class="rank ${r.zone==='elite'?'r1':r.zone==='midfield'?'r2':'r3'}">${r.pos}</span>${arrow}</td>
      <td class="name">${esc(r.name)}${recvHoyBadge}${aplSangBadge}${aplNitroBadge}${r.id===APP.user.id?' <span class="note">(vos)</span>':''}${penBadge}${bonBadge}</td>
      <td>${r.main+r.extra}</td><td>${r.wasabi}</td><td class="pts">${r.total}</td>
      ${opts.inline?`<td>${actions(r)}</td>`:""}</tr>`;
  });
  const headLast = opts.inline?'<th style="font-size:10px;text-align:center;line-height:1.5">Comodines<br><span style="font-weight:400;color:var(--muted)">🔥 disponibles / 🩸 por recibir</span></th>':'';
  const zonaRef = allZero ? "" : `<span class="zone-band elite"></span>La élite · <span class="zone-band midfield"></span>Midfield · <span class="zone-band pobreza"></span>Zona de pobreza &nbsp;·&nbsp;`;
  const glos=`<div class="note" style="margin-top:10px;font-size:11.5px;line-height:1.7;border-top:1px solid var(--line);padding-top:10px">
    <b>Referencias:</b> ${zonaRef}
    <span style="color:#ef4444">🩸</span><i>N</i> = sanguijuelas aplicadas esta fase &nbsp;·&nbsp; 🔥<i>N</i> = nitros usados esta fase &nbsp;·&nbsp; ⚡ = penalización &nbsp;·&nbsp; <span style="color:#22c55e">✨</span> = puntos extra</div>`;
  return `<div style="overflow-x:auto;margin-top:10px"><table>
      <tr><th>#</th><th class="name">Jugador <span style="font-size:10px;font-weight:400;color:var(--muted)">(comodines usados)</span></th><th>Princ</th><th>Was</th><th>Total</th>${headLast}</tr>
      ${out}
    </table></div>${glos}`;
}

function renderTabla(v){
  const ua2=APP.results?.updated_at;
  const updStr2=ua2?(()=>{const d=new Date(ua2);const pad=n=>String(n).padStart(2,'0');return `🕐 Actualizado el ${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} a las ${pad(d.getHours())}:${pad(d.getMinutes())}hs`;})():'';
  v.innerHTML=`<div class="card" style="margin-top:18px"><div class="sec-title">Tabla general</div>
    ${updStr2?`<p class="note" style="margin-bottom:8px">${updStr2}</p>`:''}
    <p class="note">Posiciones y puntajes de todos. Las flechas muestran cuánto subió o bajó cada uno desde la fecha anterior. Las respuestas de cada jugador son privadas: solo ves las tuyas.</p>
    ${standingsTableHTML({inline:false})}</div>
    <p class="note" style="text-align:center;margin-top:12px">🔒 No se pueden ver los pronósticos de los demás (ni los tuyos los ven ellos).</p>`;
}

/* =====================================================================
   PESTAÑA · COMODINES
   ===================================================================== */
function renderComodines(v){
  const uid=APP.user.id;
  const day=todayFifaDate();
  const phase=phaseOfDay(day);
  const dayLbl = new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date());
  const hasMatchesToday = dayHasMatches(day);
  const wOpen = windowOpenNow();
  let html=`<div class="card" style="margin-top:18px"><div class="sec-title">Comodines</div>
    <p class="note">Pedí tus sanguijuelas (3 por fase) y nitros (2 por fase). Se solicitan en la ventana de <b>6:00 a 12:00 (hora argentina)</b> de cualquier día con partidos, y valen para los partidos de ese día.</p>
    <div class="pill" style="margin-top:10px">📅 Hoy: ${dayLbl} ${hasMatchesToday?(wOpen?'· <b style="color:var(--ok)">Ventana abierta</b>':'· <span style="color:var(--bad)">Ventana cerrada (6-12)</span>'):'· Sin partidos'}</div></div>`;
  if(!isAdmin()){
    const phaseLbl = phase ? ({grupos:"grupos",r32:"R32",r16:"octavos",qf:"cuartos",sf:"semis",tp:"finales",final:"finales"}[phase]||phase) : "—";
    const phaseKey = phase==="tp"||phase==="final" ? ["tp","final"] : [phase||"grupos"];
    const sangUsadasFase = APP.comodines.filter(c=>c.type==="sang"&&c.by_user===uid&&phaseKey.includes(c.phase)).length;
    const nitroUsadosFase = APP.comodines.filter(c=>c.type==="nitro"&&c.by_user===uid&&phaseKey.includes(c.phase)).length;
    const sangRestantes = Math.max(0, 3 - sangUsadasFase);
    const nitroRestantes = Math.max(0, 2 - nitroUsadosFase);
    // sanguijuela recibida (cuántas veces me retaron esta fase)
    const sangRecibidasFase = APP.comodines.filter(c=>c.type==="sang"&&c.target_user===uid&&phaseKey.includes(c.phase)).length;
    const ventana = hasMatchesToday && wOpen;
    const sangDisabled = !ventana || sangRestantes===0 || !!askedSangToday(uid) || !!wasChallengedToday(uid) || !!askedNitroToday(uid);
    const nitroDisabled = !ventana || nitroRestantes===0 || !!askedNitroToday(uid) || !!askedSangToday(uid) || !!wasChallengedToday(uid);
    const sangTip = sangRestantes===0 ? "Agotaste tus sanguijuelas de esta fase"
      : !ventana ? "Ventana cerrada (6-12hs con partidos)"
      : askedSangToday(uid) ? "Ya usaste sanguijuela hoy"
      : wasChallengedToday(uid) ? "Fuiste sanguijueleado hoy"
      : askedNitroToday(uid) ? "Usaste nitro hoy" : "";
    const nitroTip = nitroRestantes===0 ? "Agotaste tus nitros de esta fase"
      : !ventana ? "Ventana cerrada (6-12hs con partidos)"
      : askedNitroToday(uid) ? "Ya usaste nitro hoy"
      : askedSangToday(uid) ? "Usaste sanguijuela hoy"
      : wasChallengedToday(uid) ? "Fuiste sanguijueleado hoy" : "";
    html+=`
    <div class="como sang" style="${sangDisabled?'opacity:0.6':''}" title="${sangTip}">
      <div class="ic">🩸</div>
      <div class="info">
        <b>Sanguijuela</b> — robá puntos<br>
        <span class="note">Restantes esta fase: <b style="color:${sangRestantes===0?'#ef4444':'var(--aqua)'}">${sangRestantes}/3</b>
        ${sangRecibidasFase>0?`· Recibiste: <b style="color:${sangRecibidasFase>=3?'#ef4444':'var(--gold)'}">${sangRecibidasFase}/3</b>`:''}
        </span>
      </div>
      <button class="btn sm primary" onclick="openSang()" ${sangDisabled?'disabled':''}>Usar hoy</button>
    </div>
    <div class="como nitro" style="${nitroDisabled?'opacity:0.6':''}" title="${nitroTip}">
      <div class="ic">🔥</div>
      <div class="info">
        <b>Nitro</b> — x3 tus puntos<br>
        <span class="note">Restantes esta fase: <b style="color:${nitroRestantes===0?'#ef4444':'var(--aqua)'}">${nitroRestantes}/2</b></span>
      </div>
      <button class="btn sm gold" onclick="openNitro()" ${nitroDisabled?'disabled':''}>Usar hoy</button>
    </div>`;
  }
  html+=`<div class="card"><div class="sec-title">Comodines registrados</div>`;
  if(!APP.comodines.length) html+=`<div class="empty"><div class="big">🩸</div>Todavía nadie usó comodines.</div>`;
  else html+=APP.comodines.slice().reverse().map(c=>{
    const byN=nameOf(c.by_user);
    const dLbl = c.day ? new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date(c.day+"T12:00:00")) : "—";
    if(c.type==="sang") return `<div class="como sang"><div class="ic">🩸</div><div class="info"><b>${esc(byN)}</b> retó a <b>${esc(nameOf(c.target_user))}</b><br><span class="note">${dLbl} · ${c.phase}</span></div>${isAdmin()?`<button class="btn sm danger" onclick="delComo('${c.id}')">✕</button>`:''}</div>`;
    return `<div class="como nitro"><div class="ic">🔥</div><div class="info"><b>${esc(byN)}</b> activó nitro x3<br><span class="note">${dLbl} · ${c.phase}</span></div>${isAdmin()?`<button class="btn sm danger" onclick="delComo('${c.id}')">✕</button>`:''}</div>`;
  }).join("");
  html+=`</div>`;
  v.innerHTML=html;
}
function nameOf(uid){ return APP.profiles.find(p=>p.id===uid)?.display_name||"?"; }
async function delComo(id){ await sb.from('comodines').delete().eq('id',id); await loadAll(); render(); toast("Comodín eliminado"); }

function openSang(preTarget){
  const winErr=windowErrorToday(); if(winErr) return toast(winErr,"err");
  const tb=standings(); const me=tb.find(r=>r.id===APP.user.id);
  if(!me) return toast("No estás en la tabla.","err");
  const targets=tb.filter(r=>r.id!==APP.user.id&&(me.pos-r.pos)>0&&(me.pos-r.pos)<=3);
  // info del día actual
  const day=todayFifaDate(); const phase=phaseOfDay(day);
  const phaseLbl = phase ? ({grupos:"Fase de Grupos",r32:"Ronda de 32",r16:"Octavos",qf:"Cuartos",sf:"Semifinales",tp:"3er puesto",final:"Final"}[phase]||phase) : "—";
  const dayLbl = new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date());
  modal(`<h3>🩸 Usar sanguijuela</h3>
    <p class="note">Vale para los partidos de <b>HOY (${dayLbl})</b>. Si hacés más puntos de Principal que el retado en esos partidos, te llevás todos sus puntos.</p>
    <div class="pill" style="margin-top:10px">📅 Día: ${dayLbl} · ${phaseLbl}</div>
    <label class="field" style="margin-top:14px">¿A quién retás?</label>
    <select id="sangT">${targets.length?targets.map(r=>`<option value="${r.id}" ${preTarget===r.id?'selected':''}>#${r.pos} ${esc(r.name)} (${r.total})</option>`).join(""):'<option value="">— no hay rivales válidos —</option>'}</select>
    <div class="row" style="margin-top:18px"><button class="btn primary full" onclick="confirmSang()">Confirmar reto</button><button class="btn ghost full" onclick="closeModal()">Cancelar</button></div>`);
}
function openSangTo(targetId){ openSang(targetId); }
async function confirmSang(){
  const target=$("#sangT").value; if(!target) return toast("No hay rival válido","err");
  const err=validateSang(APP.user.id,target); if(err) return toast(err,"err");
  const btn=document.querySelector(".modal-inner button.btn.primary,.modal-inner button[onclick*=confirmSang]");
  if(btn){ btn.disabled=true; btn.textContent="Activando..."; }
  try{ await requestComodin("sang",target); closeModal(); render(); toast("Sanguijuela activada 🩸","ok"); }
  catch(e){ toast(e.message,"err"); if(btn){ btn.disabled=false; btn.textContent="Confirmar reto"; } }
}
function openNitro(){
  const day=todayFifaDate(); const phase=phaseOfDay(day);
  const phaseLbl = phase ? ({grupos:"Fase de Grupos",r32:"Ronda de 32",r16:"Octavos",qf:"Cuartos",sf:"Semifinales",tp:"3er puesto",final:"Final"}[phase]||phase) : "—";
  const dayLbl = new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date());
  modal(`<h3>🔥 Usar nitro</h3>
    <p class="note">Multiplica x3 tus puntos de Principal de <b>HOY (${dayLbl})</b>. No lo usan 1° ni 2°.</p>
    <div class="pill" style="margin-top:10px">📅 Día: ${dayLbl} · ${phaseLbl}</div>
    <div class="row" style="margin-top:18px"><button class="btn gold full" onclick="confirmNitro()">Activar nitro x3</button><button class="btn ghost full" onclick="closeModal()">Cancelar</button></div>`);
}
async function confirmNitro(){
  const err=validateNitro(APP.user.id); if(err) return toast(err,"err");
  const btn=document.querySelector(".modal-inner button.btn.gold");
  if(btn){ btn.disabled=true; btn.textContent="Activando..."; }
  try{ await requestComodin("nitro",null); closeModal(); render(); toast("Nitro activado 🔥","ok"); }
  catch(e){ toast(e.message,"err"); if(btn){ btn.disabled=false; btn.textContent="Activar nitro x3"; } }
}

/* =====================================================================
   PESTAÑA · REGLAMENTO
   ===================================================================== */
function renderReglamento(v){
  const R=REGLAMENTO_2026;
  const list=(arr)=>arr.map(x=>`<div class="reg-item">${esc(x)}</div>`).join("");
  v.innerHTML=`<div class="card" style="margin-top:18px"><div class="sec-title">Reglamento · PingüiProde 2026</div>
    <p class="lead">Bono de inscripción: $${R.bono.toLocaleString('es-AR')} · Premio: ${esc(R.premio)}</p></div>
    <div class="card flat"><div class="sec-title">Las tres tarjetas</div>
      ${R.tarjetas.map(t=>`<div style="margin-bottom:12px"><b>${t.n}${t.pts?` · ${t.pts} pts`:''}</b><div class="note">${esc(t.desc)}</div></div>`).join("")}</div>
    <details class="fold" open><summary>🃏 Sanguijuelas<span class="arr">›</span></summary><div class="body">${list(R.sanguijuela)}</div></details>
    <details class="fold" open><summary>🔥 Nitros<span class="arr">›</span></summary><div class="body">${list(R.nitro)}</div></details>
    <details class="fold" open><summary>⚖️ Reglas de interacción<span class="arr">›</span></summary><div class="body">${list(R.interaccion)}</div></details>
    <details class="fold" open><summary>⚽ Puntos · Fase de Grupos<span class="arr">›</span></summary><div class="body">
      <p style="margin-bottom:12px;font-size:13px">🎯 <b>Por cada partido (72 en total):</b></p>
      <div class="reg-item">✅ <b>Resultado exacto</b> (mismo marcador) → <b>+5 pts</b><br><span class="note">Ej: predijiste 2-1 y salió 2-1</span></div>
      <div class="reg-item">✅ <b>Acertás el ganador + la diferencia de goles</b> → <b>+4 pts</b><br><span class="note">Ej: predijiste 2-0 y salió 3-1 (gana local, +2 de diferencia en ambos)</span></div>
      <div class="reg-item">✅ <b>Acertás solo el ganador</b> (o el empate) → <b>+3 pts</b><br><span class="note">Ej: predijiste 1-0 y salió 3-0 · predijiste 1-1 y salió 0-0 (empate)</span></div>
      <div class="reg-item">❌ <b>No acertás el ganador</b> → <b>0 pts</b><br><span class="note">Aunque hayas acertado la diferencia de goles. Si predijiste que ganaba uno y ganó el otro, no suma nada.</span></div>
      <p style="margin-top:14px;margin-bottom:8px;font-size:13px">📊 <b>Posición exacta en el grupo:</b></p>
      <div class="reg-item">🥇🥈 Acertás el 1° o 2° del grupo → <b>+1 pt</b> c/u</div>
      <div class="reg-item">🥉4️⃣ Acertás el 3° o 4° del grupo → <b>+1 pt</b> c/u <span class="note">(más difícil de adivinar)</span></div>
      <div style="margin-top:12px;padding:10px 12px;border-radius:8px;background:rgba(255,206,71,0.08);border-left:3px solid var(--gold);font-size:12.5px;line-height:1.7">
        ⚠️ <b>Importante:</b><br>
        • En los <b>empates</b> nunca se suma el +1 extra de diferencia de gol. Acertar un empate siempre vale +3.<br>
        • El +1 de diferencia <b>solo se suma si además acertaste quién gana</b>.
      </div>
    </div></details>
    <details class="fold" open><summary>🏆 Puntos · Eliminatorias<span class="arr">›</span></summary><div class="body">
      <p style="margin-bottom:10px;font-size:13px">Los puntos por partido aplican a todas las fases eliminatorias (R32, Octavos, Cuartos, Semis, 3° Puesto y Final).</p>
      <p style="margin-bottom:8px;font-size:13px">🎯 <b>Por cada partido:</b></p>
      <div class="reg-item">✅ <b>Resultado exacto</b> → <b>+2 pts</b></div>
      <div class="reg-item">✅ <b>Acertás el ganador + la diferencia de goles</b> → <b>+3 pts</b> (2+1)</div>
      <div class="reg-item">✅ <b>Acertás solo el ganador</b> (o quién avanza) → <b>+2 pts</b></div>
      <div class="reg-item">❌ <b>No acertás</b> → <b>0 pts</b></div>
      <p style="margin-top:14px;margin-bottom:8px;font-size:13px">🚀 <b>Puntos por equipo clasificado a cada ronda:</b></p>
      <div class="reg-item">Equipo clasificado a <b>Octavos (R16)</b> → <b>+1 pt</b> <span class="note">× 16 equipos</span></div>
      <div class="reg-item">Equipo clasificado a <b>Cuartos</b> → <b>+3 pts</b> <span class="note">× 8 equipos</span></div>
      <div class="reg-item">Equipo clasificado a <b>Semifinales</b> → <b>+2 pts</b> <span class="note">× 4 equipos</span></div>
      <div class="reg-item">Equipo clasificado a <b>3°/4° Puesto o Final</b> → <b>+3 pts</b> <span class="note">× 4 equipos</span></div>
      <div style="margin-top:12px;padding:10px 12px;border-radius:8px;background:rgba(255,206,71,0.08);border-left:3px solid var(--gold);font-size:12.5px;line-height:1.7">
        ⚠️ Los puntos por clasificados se calculan sobre los equipos reales que pasen cada ronda según el torneo oficial.
      </div>
    </div></details>
    <details class="fold" open><summary>🎖️ Puntos · Cuadro de Honor<span class="arr">›</span></summary><div class="body">
      <p style="margin-bottom:10px;font-size:13px">Se carga al inicio de la fase eliminatoria. Puntos por aciertos al final del torneo.</p>
      <div class="reg-item">🏆 <b>Campeón</b> → <b>+4 pts</b></div>
      <div class="reg-item">🥈 <b>Subcampeón</b> → <b>+3 pts</b></div>
      <div class="reg-item">🥉 <b>3° Clasificado</b> → <b>+2 pts</b></div>
      <div class="reg-item">4️⃣ <b>4° Clasificado</b> → <b>+1 pt</b></div>
      <div class="reg-item">👟 <b>Bota de Oro</b> (máximo goleador) → <b>+3 pts</b></div>
      <div class="reg-item">👟 <b>Bota de Plata</b> (2° máx. goleador) → <b>+2 pts</b></div>
      <div class="reg-item">👟 <b>Bota de Bronce</b> (3° máx. goleador) → <b>+1 pt</b></div>
      <div class="reg-item">⚽ <b>Balón de Oro</b> (mejor jugador) → <b>+3 pts</b></div>
      <div class="reg-item">⚽ <b>Balón de Plata</b> (2° mejor jugador) → <b>+2 pts</b></div>
      <div class="reg-item">⚽ <b>Balón de Bronce</b> (3° mejor jugador) → <b>+1 pt</b></div>
    </div></details>
    ${isAdmin() ? `<details class="fold"><summary>📊 Resumen de máximos<span class="arr">›</span></summary><div class="body">
      <p style="margin-bottom:10px;font-size:13px;font-weight:700">🃏 Tarjeta Principal</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:14px">
        <tr style="border-bottom:1px solid var(--line)"><td style="padding:5px 0">Grupos (72 partidos exactos + posiciones)</td><td style="text-align:right;font-weight:700">408 pts</td></tr>
        <tr style="border-bottom:1px solid var(--line)"><td style="padding:5px 0">Eliminatorias (partidos + clasificados)</td><td style="text-align:right;font-weight:700">220 pts</td></tr>
        <tr style="border-bottom:1px solid var(--line)"><td style="padding:5px 0">Cuadro de Honor</td><td style="text-align:right;font-weight:700">22 pts</td></tr>
        <tr style="font-weight:700;border-top:2px solid var(--line)"><td style="padding:5px 0">TOTAL Principal</td><td style="text-align:right;color:var(--aqua)">650 pts</td></tr>
      </table>
      <p style="margin-bottom:10px;font-size:13px;font-weight:700">🌶️ Tarjeta Wasabi</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:14px">
        <tr style="border-bottom:1px solid var(--line)"><td style="padding:5px 0">Preguntas respondibles (${APP.wasabiQs.filter(q=>q.type!=='bonus').length} preguntas)</td><td style="text-align:right;font-weight:700">${APP.wasabiQs.filter(q=>q.type!=='bonus').reduce((s,q)=>s+q.pts,0)} pts</td></tr>
        <tr style="border-bottom:1px solid var(--line)"><td style="padding:5px 0">Preguntas bonus (asignadas por el COMIPRO)</td><td style="text-align:right;font-weight:700">${APP.wasabiQs.filter(q=>q.type==='bonus').reduce((s,q)=>s+q.pts,0)} pts</td></tr>
        <tr style="font-weight:700;border-top:2px solid var(--line)"><td style="padding:5px 0">TOTAL Wasabi</td><td style="text-align:right;color:var(--aqua)">${APP.wasabiQs.reduce((s,q)=>s+q.pts,0)} pts</td></tr>
      </table>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr style="font-weight:700;border-top:2px solid var(--gold)"><td style="padding:8px 0">TOTAL PRODE (máximo teórico)</td><td style="text-align:right;color:var(--gold)">${650 + APP.wasabiQs.reduce((s,q)=>s+q.pts,0)} pts</td></tr>
      </table>
      <p class="note" style="margin-top:8px">El puntaje máximo si se acierta absolutamente todo.</p>
    </div></details>` : ''}`;
}

/* =====================================================================
   PESTAÑA · ADMIN (COMIPRO)
   ===================================================================== */
let ADM="resultados", ADM_PHASE="grupos";
function renderAdmin(v){
  if(!isAdmin()){ v.innerHTML=adminHint("🔒","Solo el COMIPRO."); return; }
  // Partidos de hoy
  const _tz='America/Argentina/Buenos_Aires';
  const _hoyFifa=todayFifaDate();
  const _todayM=(typeof FIXTURE!=='undefined'?FIXTURE:[]).filter(m=>fifaDateOf(m)===_hoyFifa)
    .sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  const _res=APP.results?.main||{};
  let _rows='';
  _todayM.forEach(m=>{
    const r=_res[m.id];
    const ht=TEAMS[m.home];const at=TEAMS[m.away];
    const hora=new Date(m.kickoff).toLocaleTimeString('es-AR',{timeZone:_tz,hour:'2-digit',minute:'2-digit'});
    const hasRes=r&&r.h!=null&&r.h!=='';
    _rows+=`<div style="padding:8px 0;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px"><span style="flex:1;font-size:13px">${ht?.f||''} ${ht?.n||m.home} vs ${at?.n||m.away} ${at?.f||''}</span><span>${hasRes?`<span style="color:#22c55e;font-weight:700">✅ ${r.h}-${r.a}</span>`:`<span style="color:var(--muted)">${hora}</span>`}</span></div>`;
  });
  const _matchBlock=_todayM.length?`<div class="card" style="margin-top:12px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div class="sec-title" style="margin:0">⚽ Partidos de hoy · <span style="font-weight:400;color:var(--muted);font-size:13px">${new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date(_hoyFifa+'T12:00:00'))}</span></div><button id="espnSyncBtn" class="btn sm primary" onclick="syncESPN()">🔄 Sincronizar ESPN</button></div>${_rows}</div>`:'';
  v.innerHTML=`<div class="card" style="margin-top:18px"><div class="sec-title">Panel del COMIPRO</div>
    <div class="seg" style="margin-top:10px" id="admSeg">
      ${[["resultados","⚽ Resultados"],["wasabi","🌶️ Result. Wasabi"],["rewasabi","🎲 Re-Wasabi"],["elim","🏆 Eliminatorias"],["tarjetas","🔎 Ver tarjetas"],["mails","📧 Mails"],["jugadores","👥 Jugadores"],["penalizaciones","⚡ Penaliz. y Puntos"],["historial","📊 Historial"],["export","📤 Exportar"]]
        .map(([k,l])=>`<button class="${ADM===k?'on':''}" data-a="${k}">${l}</button>`).join("")}
    </div></div>${_matchBlock}<div id="admArea"></div>`;
  document.querySelectorAll("#admSeg button").forEach(b=>b.onclick=()=>{ADM=b.dataset.a;renderAdmin(v);});
  ({resultados:admResultados,wasabi:admWasabi,rewasabi:admRewasabi,elim:admElim,tarjetas:admTarjetas,mails:admMails,jugadores:admJugadores,penalizaciones:admPenalizaciones,historial:admHistorial,export:admExport}[ADM])($("#admArea"));
}
function admPenalizaciones(area){
  const players = APP.profiles.filter(p=>!p.is_admin);
  const playerOpts = `<option value="">— elegí un jugador —</option>`+players.map(p=>`<option value="${p.id}">${esc(p.display_name||p.email)}</option>`).join('');

  let html = `
  <div class="card"><div class="sec-title">⚡ Penalizaciones</div>
    <p class="note" style="margin-bottom:14px">Descuentos manuales de puntos. Son visibles para el jugador.</p>
    <div class="grid2" style="gap:10px;margin-bottom:18px">
      <div><label class="field">Jugador</label><select id="penPlayer">${playerOpts}</select></div>
      <div><label class="field">Puntos a descontar</label><input id="penPts" type="number" min="1" placeholder="ej: 5" style="width:100%"></div>
    </div>
    <div style="margin-bottom:14px"><label class="field">Motivo (obligatorio)</label>
      <input id="penReason" placeholder="ej: Penalización por error en carga" style="width:100%">
    </div>
    <button class="btn gold" onclick="doApplyPenalty()">⚡ Aplicar descuento</button>
    <div style="margin-top:22px;border-top:1px solid var(--line);padding-top:14px">
      <div class="sec-title" style="font-size:13px;margin-bottom:10px">Historial de penalizaciones</div>`;
  let hayPenas = false;
  players.forEach(p=>{
    const pred = APP.allPreds?.[p.id];
    const pens = pred?.penalties||[];
    if(!pens.length) return;
    hayPenas = true;
    html+=`<div style="margin-bottom:10px"><b style="font-size:13px">${esc(p.display_name||p.email)}</b>`;
    pens.forEach((pen,penIdx)=>{
      const fecha = new Date(pen.date).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
      html+=`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:12.5px">
        <span style="color:#ef4444;font-weight:700">-${pen.pts}pts</span>
        <span style="flex:1;color:var(--muted)">${esc(pen.reason)}</span>
        <span style="color:var(--muted);font-size:11px">${fecha}</span>
        <button class="btn sm danger" style="font-size:10px;padding:2px 6px" onclick="doDeletePenalty('${p.id}',${penIdx})">✕</button>
      </div>`;
    });
    html+=`</div>`;
  });
  if(!hayPenas) html+=`<p class="note">No hay penalizaciones aplicadas todavía.</p>`;
  html+=`</div></div>`;

  // ── Bonificaciones ──────────────────────────────────────────────
  html+=`<div class="card" style="margin-top:16px"><div class="sec-title">✨ Bonificaciones</div>
    <p class="note" style="margin-bottom:14px">Suma de puntos manual. Se suman al total del jugador y son visibles para él.</p>
    <div class="grid2" style="gap:10px;margin-bottom:18px">
      <div><label class="field">Jugador</label><select id="bonPlayer">${playerOpts}</select></div>
      <div><label class="field">Puntos a sumar</label><input id="bonPts" type="number" min="1" placeholder="ej: 5" style="width:100%"></div>
    </div>
    <div style="margin-bottom:14px"><label class="field">Motivo (obligatorio)</label>
      <input id="bonReason" placeholder="ej: Bonus por acierto especial" style="width:100%">
    </div>
    <button class="btn primary" onclick="doApplyBonus()">✨ Sumar puntos</button>
    <div style="margin-top:22px;border-top:1px solid var(--line);padding-top:14px">
      <div class="sec-title" style="font-size:13px;margin-bottom:10px">Historial de bonificaciones</div>`;

  const bonuses = APP.bonuses||[];
  if(!bonuses.length){
    html+=`<p class="note">No hay bonificaciones aplicadas todavía.</p>`;
  } else {
    // agrupar por jugador
    const byPlayer={};
    bonuses.forEach(b=>{ if(!byPlayer[b.user_id]) byPlayer[b.user_id]=[]; byPlayer[b.user_id].push(b); });
    Object.keys(byPlayer).forEach(uid=>{
      const pName=APP.profiles.find(p=>p.id===uid)?.display_name||'?';
      html+=`<div style="margin-bottom:10px"><b style="font-size:13px">${esc(pName)}</b>`;
      byPlayer[uid].forEach(b=>{
        const fecha=new Date(b.date).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
        html+=`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:12.5px">
          <span style="color:#22c55e;font-weight:700">+${b.pts}pts</span>
          <span style="flex:1;color:var(--muted)">${esc(b.reason)}</span>
          <span style="color:var(--muted);font-size:11px">${fecha}</span>
          <button class="btn sm danger" style="font-size:10px;padding:2px 6px" onclick="doDeleteBonus('${b.id}')">✕</button>
        </div>`;
      });
      html+=`</div>`;
    });
  }
  html+=`</div></div>`;
  area.innerHTML=html;
}

async function doApplyPenalty(){
  const uid=$("#penPlayer").value;
  const pts=+($("#penPts").value||0);
  const reason=$("#penReason").value.trim();
  if(!uid){ toast("Elegí un jugador","err"); return; }
  if(!pts||pts<=0){ toast("Ingresá los puntos a descontar","err"); return; }
  if(!reason){ toast("El motivo es obligatorio","err"); return; }
  try{ await adminApplyPenalty(uid,pts,reason); toast("Penalización aplicada","ok"); admPenalizaciones($("#admArea")); }
  catch(e){ toast(e.message,"err"); }
}
async function doApplyBonus(){
  const uid=$("#bonPlayer").value;
  const pts=+($("#bonPts").value||0);
  const reason=$("#bonReason").value.trim();
  if(!uid){ toast("Elegí un jugador","err"); return; }
  if(!pts||pts<=0){ toast("Ingresá los puntos a sumar","err"); return; }
  if(!reason){ toast("El motivo es obligatorio","err"); return; }
  try{ await adminApplyBonus(uid,pts,reason); toast("Bonificación aplicada ✨","ok"); admPenalizaciones($("#admArea")); }
  catch(e){ toast(e.message,"err"); }
}
async function doDeleteBonus(id){
  if(!confirm("¿Eliminar esta bonificación?")) return;
  try{ await adminDeleteBonus(id); toast("Bonificación eliminada","ok"); admPenalizaciones($("#admArea")); }
  catch(e){ toast(e.message,"err"); }
}
async function syncESPN(){
  const btn = document.getElementById('espnSyncBtn');
  if(btn){ btn.disabled=true; btn.textContent='🔄 Sincronizando...'; }
  try{
    const resp = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
    if(!resp.ok) throw new Error('Error al conectar con ESPN');
    const data = await resp.json();
    const events = data.events||[];
    const main = {...(APP.results.main||{})};
    let updated = 0;
    events.forEach(ev=>{
      const comp = ev.competitions?.[0];
      if(!comp) return;
      const status = comp.status?.type;
      // solo partidos finalizados
      if(!status?.completed) return;
      const home = comp.competitors?.find(c=>c.homeAway==='home');
      const away = comp.competitors?.find(c=>c.homeAway==='away');
      if(!home||!away) return;
      const homeCode = home.team.abbreviation;
      const awayCode = away.team.abbreviation;
      const homeScore = home.score;
      const awayScore = away.score;
      // buscar en fixture
      const match = FIXTURE.find(m=>m.home===homeCode&&m.away===awayCode||m.home===awayCode&&m.away===homeCode);
      if(!match) return;
      const isFlipped = match.home===awayCode;
      const h = isFlipped ? awayScore : homeScore;
      const a = isFlipped ? homeScore : awayScore;
      // solo actualizar si cambió
      const cur = main[match.id]||{};
      if(String(cur.h)===String(h)&&String(cur.a)===String(a)) return;
      main[match.id]={h, a, pen:cur.pen||''};
      updated++;
    });
    if(updated>0){
      await adminSaveResults({main});
      toast(`✅ ${updated} resultado${updated>1?'s':''} actualizado${updated>1?'s':''}`, 'ok');
      const admArea = document.getElementById('admArea');
      if(admArea) admResultados(admArea);
    } else {
      toast('No hay resultados nuevos', 'ok');
    }
  }catch(e){
    toast('Error ESPN: '+e.message, 'err');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='🔄 Sincronizar ESPN'; }
  }
}
function admResultados(area){
  const res=APP.results.main||{};
  area.innerHTML=`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div class="sec-title" style="margin:0">Resultados reales</div><button id="espnSyncBtn" class="btn sm primary" onclick="syncESPN()">🔄 Sincronizar ESPN</button></div><div class="seg" id="arSeg">
    ${PHASES.map(p=>`<button class="${ADM_PHASE===p.key?'on':''}" data-ph="${p.key}">${p.label.replace('Fase de ','').replace('Ronda de ','R')}</button>`).join("")}
    </div><div id="arArea" style="margin-top:12px"></div></div>
    <div class="card flat"><div class="sec-title">Cuadro de honor (real)</div><p class="note" style="margin:4px 0 10px">🥾 <b>Bota de oro/plata/bronce</b>: los tres máximos goleadores del torneo. ⚽ <b>Balón de oro/plata/bronce</b>: los tres mejores jugadores del torneo según FIFA.</p><div class="grid2" id="exReal"></div></div>`;
  document.querySelectorAll("#arSeg button").forEach(b=>b.onclick=()=>{ADM_PHASE=b.dataset.ph;admResultados(area);});
  const a=$("#arArea"); let ms=FIXTURE.filter(m=>m.phase===ADM_PHASE);
  if(ADM_PHASE==="grupos"){
    let html=""; GROUPS.forEach(g=>{const gm=ms.filter(m=>m.grp===g);
      const done=gm.filter(m=>res[m.id]&&res[m.id].h!==""&&res[m.id].h!=null).length;
      html+=`<details class="fold" open><summary><span class="gtag">${g}</span> Grupo ${g}<span class="badge ${done===gm.length?'g':'w'}" style="margin-left:6px">${done}/${gm.length}</span><span class="arr">›</span></summary>
        <div class="body">${[1,2,3].map(j=>`<div class="meta">Jornada ${j}</div>`+gm.filter(m=>m.jor===j).map(m=>admMatch(m,res[m.id])).join("")).join("")}</div></details>`;});
    a.innerHTML=html;
  }else a.innerHTML=`<div class="meta">${ms[0]?.label.split(' · ')[0]||''}</div>${ms.map(m=>admMatchKO(m,res[m.id])).join("")}`;
  // cuadro honor
  const ex=APP.results.extra||{};
  const tsel=(id)=>`<select onchange="setResExtra('${id}',this.value)"><option value="">—</option>${Object.keys(TEAMS).map(c=>`<option ${ex[id]===c?'selected':''} value="${c}">${TEAMS[c].f} ${TEAMS[c].n}</option>`).join("")}</select>`;
  const isel=(id)=>`<input value="${esc(ex[id]||'')}" onchange="setResExtra('${id}',this.value)">`;
  $("#exReal").innerHTML=`
    <div><label class="field">🏆 Campeón</label>${tsel('champion')}</div><div><label class="field">🥈 Subcampeón</label>${tsel('runnerup')}</div>
    <div><label class="field">🥉 3er puesto</label>${tsel('third')}</div><div><label class="field">4° puesto</label>${tsel('fourth')}</div>
    <div><label class="field">👟 Bota de Oro <span class="note">máx. goleador</span></label>${isel('boot_gold')}</div>
    <div><label class="field">👟 Bota de Plata <span class="note">2º goleador</span></label>${isel('boot_silver')}</div>
    <div><label class="field">👟 Bota de Bronce <span class="note">3º goleador</span></label>${isel('boot_bronze')}</div>
    <div><label class="field">⚽ Balón de Oro <span class="note">mejor jugador</span></label>${isel('ball_gold')}</div>
    <div><label class="field">⚽ Balón de Plata <span class="note">2º mejor</span></label>${isel('ball_silver')}</div>
    <div><label class="field">⚽ Balón de Bronce <span class="note">3º mejor</span></label>${isel('ball_bronze')}</div>`;
}
function acertaronMatch(m, r){
  if(!r||r.h==null||r.h===""||r.a==null||r.a==="") return "";
  const players = APP.profiles.filter(p=>!p.is_admin);
  const exact=[], result=[];
  players.forEach(p=>{
    const pred=(APP.allPreds?.[p.id]?.main||{})[m.id];
    if(!pred) return;
    if(+pred.h===+r.h && +pred.a===+r.a){ exact.push(p.display_name); return; }
    const rWin = +r.h>+r.a?'h':+r.a>+r.h?'a':'x';
    const pWin = +pred.h>+pred.a?'h':+pred.a>+pred.h?'a':'x';
    if(rWin===pWin) result.push(p.display_name);
  });
  let html='<div class="acertaron">';
  html+=`<span style="color:var(--aqua)">✅ Exacto: ${exact.length?exact.join(', '):'nadie'}</span><br>`;
  html+=`<span style="color:var(--gold)">👍 Suman puntos: ${result.length?result.join(', '):'nadie'}</span>`;
  html+='</div>';
  return html;
}
function admMatch(m,r){r=r||{};
  return `<div class="match"><div class="teams"><div class="t">${team(m.home)}</div><div class="t">${team(m.away)}</div></div>
    <input class="score-in" type="number" min="0" value="${r.h??""}" onchange="setRes(${m.id},'h',this.value)"><span class="vs">–</span>
    <input class="score-in" type="number" min="0" value="${r.a??""}" onchange="setRes(${m.id},'a',this.value)"></div>${acertaronMatch(m,r)}`;
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

function admRewasabi(area){
  const res=APP.results?.rewasabi||{};
  const rqs=APP.rewasabiQs||[...SEED_REWASABI];
  const r32Teams=FIXTURE.filter(m=>m.phase==="r32"&&m.home&&m.away)
    .flatMap(m=>[m.home,m.away]).filter((v,i,a)=>a.indexOf(v)===i).sort();
  const players=(APP.profiles||[]).filter(p=>!p.is_admin);

  let html=`<div class="card"><div class="sec-title">🎲 Respuestas reales · Re-Wasabi</div>
    <p class="note">Cargá la respuesta correcta de cada pregunta. Para las preguntas de País y Fase, completá ambos campos.</p>
  </div>`;

  rqs.forEach((q,qi)=>{
    let inputHtml="";
    if(q.type==="country_phase"){
      const vp=res[q.id+"_pais"]||"", vf=res[q.id+"_fase"]||"";
      inputHtml=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <select style="flex:1;min-width:140px" onchange="admSetRewasabi('${q.id}_pais',this.value)">
          <option value="">— País —</option>
          ${r32Teams.map(t=>{ const td=TEAMS[t]; return `<option value="${t}" ${vp===t?'selected':''}>${td?td.f+' '+td.n:t}</option>`; }).join('')}
        </select>
        <select style="flex:1;min-width:140px" onchange="admSetRewasabi('${q.id}_fase',this.value)">
          <option value="">— Fase —</option>
          ${FASES_ELIM_RW.map(f=>`<option value="${f}" ${vf===f?'selected':''}>${f}</option>`).join('')}
        </select>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px">
        ✅ País + Fase: <b style="color:white">20pts</b> &nbsp;·&nbsp; ✅ Solo País: <b style="color:white">10pts</b> &nbsp;·&nbsp; ❌ Resto: 0pts
      </div>`;
    } else if(q.type==="bonus"){
      inputHtml=`<select style="width:100%;margin-top:8px" onchange="admSetRewasabi('bonus_${q.id}',this.value)">
        <option value="">— Ganador —</option>
        ${players.map(p=>`<option value="${p.id}" ${res["bonus_"+q.id]===p.id?'selected':''}>${esc(p.display_name)}</option>`).join('')}
      </select>`;
    } else if(q.type==="player"){
      inputHtml=`<select style="width:100%;margin-top:8px" onchange="admSetRewasabi('${q.id}',this.value)">
        <option value="">— elegir —</option>
        ${sortByName(PLANTEL_ARG).map(p=>`<option value="${p}" ${res[q.id]===p?'selected':''}>${esc(p)}</option>`).join('')}
      </select>`;
    } else if(q.type==="participant"){
      inputHtml=`<select style="width:100%;margin-top:8px" onchange="admSetRewasabi('${q.id}',this.value)">
        <option value="">— elegir —</option>
        ${players.map(p=>`<option value="${p.display_name}" ${res[q.id]===p.display_name?'selected':''}>${esc(p.display_name)}</option>`).join('')}
      </select>`;
    } else {
      inputHtml=`<input type="${q.type==='approx'?'number':'text'}" style="width:100%;margin-top:8px" value="${esc(res[q.id]||'')}" onchange="admSetRewasabi('${q.id}',this.value)">`;
    }
    html+=`<div class="card" style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1;font-size:13px;font-weight:600">${qi+1}. ${esc(q.t)}</div>
        <span style="color:var(--gold);font-size:12px;font-weight:700">+${q.pts}pts</span>
      </div>
      ${inputHtml}
    </div>`;
  });
  area.innerHTML=html;
}

async function admSetRewasabi(key, val){
  const rewasabi={...(APP.results?.rewasabi||{}), [key]:val};
  try{
    await adminSaveResults({rewasabi});
    invalidateStandings();
    toast("Guardado","ok");
  }catch(e){ toast(e.message,"err"); }
}

function admWasabi(area){
  const res=APP.results.wasabi||{};
  const AUTOQS=new Set(["w5","w6","w7","w8"]);
  const autoEnabled = !!APP.results.auto_wasabi_enabled;
  let html=`<div class="card"><div class="sec-title">Respuestas reales · Wasabi</div>
    <p class="note">Cargá la respuesta correcta de cada pregunta. Las preguntas 5-8 (¿quién sale primero/segundo/anteúltimo/último?) se calculan automáticamente — podés habilitarlas cuando quieras.</p>
    <div style="margin-top:12px;display:flex;align-items:center;gap:12px">
      <span>🏆 Preguntas 5-8 automáticas:</span>
      <span style="font-weight:600;color:${autoEnabled?'var(--aqua)':'var(--gold)'}">${autoEnabled?'✅ Habilitadas':'🔒 Deshabilitadas'}</span>
      <button class="btn sm" onclick="toggleAutoWasabi()">${autoEnabled?'Deshabilitar':'Habilitar'}</button>
    </div>
  </div>`;
  const SECTION_HEADERS_ADM = {
    "w1":  { label:"Preguntas Generales", icon:"🌍", color:"#3b82f6" },
    "w21": { label:"Preguntas de la Fase de Grupos", icon:"🏟️", color:"#8b5cf6" },
    "w27": { label:"Primer Partido de Argentina", icon:"🇦🇷", color:"#16a34a" },
    "w31": { label:"Segundo Partido de Argentina", icon:"🇦🇷", color:"#b45309" },
    "w33": { label:"Tercer Partido de Argentina", icon:"🇦🇷", color:"#dc2626" },
    "w38": { label:"Preguntas Cuartos de Final", icon:"🏅", color:"#7c3aed" },
    "w47": { label:"Preguntas Absolutas", icon:"🌍", color:"#3b82f6" },
  };
  let openSectionAdm = false;
  APP.wasabiQs.forEach((q,i)=>{
    if(SECTION_HEADERS_ADM[q.id]){
      if(openSectionAdm) html+=`</div>`;
      const s=SECTION_HEADERS_ADM[q.id];
      html+=`<div class="wasabi-section" style="--sc:${s.color}"><div class="wasabi-section-title">${s.icon} ${s.label}</div>`;
      openSectionAdm=true;
    }
    if(AUTOQS.has(q.id)){
      html+=`<div class="wq"><div class="qh"><div class="qn">${i+1}</div><div class="qt">${esc(q.t)}</div><div><span class="badge w">${q.pts}</span></div></div>
        <p class="note" style="font-style:italic">Se completa de manera automática al cierre del Mundial.</p></div>`;
      return;
    }
    const val=q.type==="bonus"?res["bonus_"+q.id]:res[q.id];
    const onCh=q.type==="bonus"?`onchange="setResWas('bonus_${q.id}',this.value)"`:`onchange="setResWas('${q.id}',this.value)"`;
    let input;
    if(q.type==="bonus")
      input=`<select ${onCh}><option value="">— sin asignar —</option>${sortByName(playersOnly(),'display_name').map(p=>`<option ${val===p.id?'selected':''} value="${p.id}">🎁 ${esc(p.display_name)}</option>`).join("")}</select>`;
    else if(q.type==="num")
      input=`<input type="number" value="${esc(val??'')}" ${onCh}>`;
    else if(q.type==="yesno")
      input=`<select ${onCh}><option value="">—</option>${["Sí","No"].map(o=>`<option ${val===o?'selected':''}>${o}</option>`).join("")}</select>`;
    else if(q.type==="choice" && Array.isArray(q.options))
      input=`<select ${onCh}><option value="">—</option>${sortByName(q.options).map(o=>`<option ${val===o?'selected':''}>${esc(o)}</option>`).join("")}</select>`;
    else if(q.type==="player")
      input=`<select ${onCh}><option value="">—</option>${sortByName(PLANTEL_ARG).map(p=>`<option ${val===p?'selected':''}>${esc(p)}</option>`).join("")}</select>`;
    else if(q.type==="participant")
      input=`<select ${onCh}><option value="">—</option>${sortByName(playersOnly(),'display_name').map(p=>`<option ${val===p.display_name?'selected':''}>${esc(p.display_name)}</option>`).join("")}</select>`;
    else if(q.type==="team"){
      const teams=Object.keys(TEAMS).map(c=>({c,n:TEAMS[c].n,f:TEAMS[c].f}));
      input=`<select ${onCh}><option value="">—</option>${sortByName(teams,'n').map(t=>`<option ${val===t.n?'selected':''} value="${t.n}">${t.f} ${t.n}</option>`).join("")}</select>`;
    } else
      input=`<input value="${esc(val??'')}" ${onCh}>`;
    let acertaronW='';
    if(val!=null&&val!==""){
      let ganadores=[];
      if(q.type==="approx"){
        const resNum=parseFloat(val);
        if(!isNaN(resNum)){
          const entries=APP.profiles.filter(p=>!p.is_admin).map(p=>{
            const w=(APP.allPreds?.[p.id]?.wasabi||{});
            return {name:p.display_name, val:parseFloat(w[q.id])};
          }).filter(e=>!isNaN(e.val));
          if(entries.length){
            const minDist=Math.min(...entries.map(e=>Math.abs(e.val-resNum)));
            ganadores=entries.filter(e=>Math.abs(e.val-resNum)===minDist).map(e=>e.name);
          }
        }
      } else {
        ganadores=APP.profiles.filter(p=>!p.is_admin).filter(p=>{
          const w=(APP.allPreds?.[p.id]?.wasabi||{});
          return matchesResult(w[q.id], val);
        }).map(p=>p.display_name);
      }
      acertaronW=`<div class="acertaron">${ganadores.length?`<span style="color:var(--aqua)">✅ Acertaron: ${ganadores.join(', ')}</span>`:'<span style="color:var(--muted)">Nadie acertó</span>'}</div>`;
    }
    html+=`<div class="wq ${val!=null&&val!==""?"wq-has-result":""}"><div class="qh"><div class="qn">${i+1}</div><div class="qt">${esc(q.t)}</div><div><span class="badge w">${q.pts}</span></div></div>${input}${q.ac?`<p class="note" style="margin-top:8px;font-size:12.5px;font-style:italic">${esc(q.ac)}</p>`:""}${acertaronW}</div>`;
  });
  if(openSectionAdm) html+=`</div>`;
  area.innerHTML=html;
}
async function setResWas(id,val){ const wasabi={...(APP.results.wasabi||{})}; wasabi[id]=val; try{ await adminSaveResults({wasabi}); toast("Guardado","ok"); }catch(e){ toast(e.message,"err"); } }
async function toggleAutoWasabi(){
  const cur=!!APP.results.auto_wasabi_enabled;
  try{ await adminSaveResults({auto_wasabi_enabled:!cur}); toast(!cur?"✅ Preguntas 5-8 habilitadas":"🔒 Preguntas 5-8 deshabilitadas","ok"); admWasabi($("#admArea")); }catch(e){ toast(e.message,"err"); }
}

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
  area.innerHTML=`<div class="card"><div class="sec-title">Jugadores · estado de pago</div>
    <p class="note">Marcá quién pagó el bono de $${REGLAMENTO_2026.bono.toLocaleString('es-AR')}. Solo vos (COMIPRO) ves y editás esto.</p>
    <div style="margin-top:12px">${APP.profiles.map(p=>`<div class="match"><div class="teams"><div class="t">${esc(p.display_name)} <span class="note">${esc(p.email||'')}</span></div></div>
      <button class="btn sm ${hasPaid(p.id)?'primary':'ghost'}" onclick="togglePaid('${p.id}',${!hasPaid(p.id)})">${hasPaid(p.id)?'✅ Pagó':'Marcar pago'}</button></div>`).join("")}</div></div>`;
}
async function togglePaid(uid,val){ try{ await adminSetPaid(uid,val); renderAdmin($("#view")); }catch(e){ toast(e.message,"err"); } }

/* ---------- ADMIN: ver/editar tarjetas de jugadores (con bitácora) ---------- */
let ADM_VIEWUID="";
function admTarjetas(area){
  const players=APP.profiles.slice().sort((a,b)=>a.display_name.localeCompare(b.display_name));
  if(!ADM_VIEWUID && players[0]) ADM_VIEWUID=players[0].id;
  const sel=`<select onchange="ADM_VIEWUID=this.value;admTarjetas(document.getElementById('admArea'))">
    ${players.map(p=>`<option value="${p.id}" ${ADM_VIEWUID===p.id?'selected':''}>${esc(p.display_name)}</option>`).join("")}</select>`;
  const pred=APP.allPreds?.[ADM_VIEWUID]||{main:{},extra:{},wasabi:{}};
  const ss = pred.stages_sent||{};
  const sa2 = pred.sent_at||{};
  const wasabiLocked = !!(ss.wasabi || sa2.wasabi || pred.locked);
  const gruposLocked = !!(ss.grupos || sa2.grupos || pred.locked);
  const rewasabiLocked = !!(sa2.rewasabi);
  const stateTag = (locked) => locked
    ? `<span style="color:var(--gold);font-weight:600">🔒 Cerrada</span>`
    : `<span style="color:var(--aqua);font-weight:600">✅ Abierta</span>`;
  const unlockBtn = (stage, label) => `<button class="btn sm" style="margin-left:10px" onclick="admUnlockStage('${ADM_VIEWUID}','${stage}')">🔓 Habilitar ${label}</button>`;
  const lockBtn = (stage, label) => `<button class="btn sm" style="margin-left:10px;background:var(--gold);color:#000" onclick="admLockStage('${ADM_VIEWUID}','${stage}')">🔒 Cerrar ${label}</button>`;
  // Estado de fases elim
  const elimStages = ELIM_STAGES.map(s=>({
    key:s, label:STAGE_LABEL[s]||s,
    sent:!!(sa2[s]), locked:!!(sa2[s])
  }));
  let html=`<div class="card"><div class="sec-title">Ver / corregir tarjetas</div>
    <p class="note">Elegí un jugador. Podés corregir respuestas; <b>cada cambio queda registrado</b> en la bitácora (abajo) y en el Excel.</p>
    <label class="field" style="margin-top:10px">Jugador</label>${sel}
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;gap:8px">🌶️ Wasabi: ${stateTag(wasabiLocked)}${wasabiLocked?unlockBtn('wasabi','Wasabi'):lockBtn('wasabi','Wasabi')}</div>
      <div style="display:flex;align-items:center;gap:8px">🎲 Re-Wasabi: ${stateTag(rewasabiLocked)}${rewasabiLocked?unlockBtn('rewasabi','Re-Wasabi'):''}</div>
      <div style="display:flex;align-items:center;gap:8px">⚽ Grupos: ${stateTag(gruposLocked)}${gruposLocked?unlockBtn('grupos','Grupos'):lockBtn('grupos','Grupos')}</div>
      ${elimStages.filter(s=>s.sent).map(s=>`<div style="display:flex;align-items:center;gap:8px">🏆 ${s.label}: ${stateTag(s.locked)}${s.locked?unlockBtn(s.key,s.label):''}</div>`).join('')}
    </div>
  </div>`;
  // REWASABI resumen
  const rewasabiCount=Object.keys(pred.rewasabi||{}).filter(k=>pred.rewasabi[k]!=null&&pred.rewasabi[k]!=="").length;
  const rwTotal = (APP.rewasabiQs||[...SEED_REWASABI]).filter(q=>q.type!=='bonus').length;
  if(rewasabiLocked||rewasabiCount>0){
    html+=`<div class="card flat"><div class="sec-title">🎲 Re-Wasabi</div>
      <p class="note">${rewasabiCount}/${rwTotal} respondidas${rewasabiLocked?' · <b style="color:var(--aqua)">✅ Enviada</b>':' · <span style="color:#f59e0b">⏳ No enviada</span>'}.</p>
    </div>`;
  }
  // WASABI resumen con botón Ver
  const wasabiCount=Object.keys(pred.wasabi||{}).filter(k=>pred.wasabi[k]!=null&&pred.wasabi[k]!=="").length;
  const sentWasabi=!!(pred.sent_at?.wasabi);
  html+=`<div class="card flat"><div class="sec-title">🌶️ Wasabi</div>
    <p class="note">${wasabiCount}/55 preguntas respondidas${sentWasabi?' · <b style="color:var(--aqua)">✅ Enviada</b>':' · <span style="color:#f59e0b">⏳ No enviada</span>'}.</p>
    <button class="btn sm" style="margin-top:10px" onclick="admVerWasabi('${ADM_VIEWUID}',this)">👁 Ver Wasabi</button>
    <div id="admWasabiArea"></div></div>`;
  // PRINCIPAL (resumen: cantidad cargada + acceso por fase)
  const mainCount=Object.keys(pred.main||{}).filter(k=>{const m=pred.main[k];return m&&m.h!==""&&m.h!=null;}).length;
  const sentGroups=!!(pred.sent_at?.grupos);
  const elimPhasesHtml = elimStages.filter(s=>s.sent||canEnterStage(s.key)).map(s=>{
    const elimCount = Object.keys(pred.elim||{}).filter(k=>{
      const slot=+k; return FIXTURE.find(m=>m.slot===slot&&m.phase===s.key);
    }).length;
    const total = FIXTURE.filter(m=>m.phase===s.key).length;
    return `<div style="margin-top:6px;font-size:12px;color:var(--muted)">
      🏆 ${s.label}: ${elimCount}/${total} cargados${s.sent?' · <b style="color:var(--aqua)">✅ Enviada</b>':''}
    </div>`;
  }).join('');
  html+=`<div class="card flat"><div class="sec-title">⚽ Principal</div>
    <p class="note">${mainCount}/${FIXTURE.filter(m=>m.phase==='grupos').length} partidos grupos cargados${sentGroups?' · <b style="color:var(--aqua)">✅ Fase de grupos enviada</b>':' · <span style="color:#f59e0b">⏳ Aún no enviada</span>'}.</p>
    ${elimPhasesHtml}
    <button class="btn sm" style="margin-top:10px" onclick="admVerGrupos('${ADM_VIEWUID}',this)">👁 Ver fase de grupos</button>
    <div id="admGruposArea"></div></div>`;
  // BITÁCORA
  html+=`<div class="card"><div class="sec-title">📋 Bitácora de correcciones</div><div id="logArea"><p class="note">Cargando…</p></div></div>`;
  area.innerHTML=html;
  adminLoadEditLog().then(log=>{
    const la=$("#logArea"); if(!la) return;
    if(!log.length){ la.innerHTML=`<p class="note">Todavía no hay correcciones registradas.</p>`; return; }
    la.innerHTML=log.map(e=>{
      const who=APP.profiles.find(p=>p.id===e.target_user)?.display_name||"?";
      const when=new Date(e.created_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'});
      return `<div class="reg-item" style="flex-direction:column;gap:2px">
        <span><b>${esc(who)}</b> · ${esc(e.card)}/${esc(e.field)} · ${when}</span>
        <span class="note">"${esc(e.old_value||'—')}" → "${esc(e.new_value||'—')}"</span></div>`;
    }).join("");
  });
}
// campo editable según tipo (reusa la lógica de inputFor pero llamando a adminEditPred)
async function admLockStage(uid, stage){
  try{
    const pred=APP.allPreds?.[uid]; if(!pred) throw new Error("No se encontró al jugador.");
    const ss={...(pred.stages_sent||{})};
    ss[stage]=true;
    const sa={...(pred.sent_at||{})};
    sa[stage]=new Date().toISOString();
    await sb.from("predictions").update({stages_sent:ss, sent_at:sa}).eq("user_id",uid);
    await adminLoadAllPreds();
    toast("🔒 Tarjeta cerrada","ok");
    admTarjetas(document.getElementById("admArea"));
  }catch(e){ toast(e.message,"err"); }
}
async function admUnlockStage(uid, stage){
  try{
    const pred=APP.allPreds?.[uid]; if(!pred) throw new Error("No se encontró al jugador.");
    const ss={...(pred.stages_sent||{})};
    delete ss[stage];
    const sa={...(pred.sent_at||{})};
    delete sa[stage];
    await sb.from("predictions").update({stages_sent:ss, sent_at:sa}).eq("user_id",uid);
    await adminLoadAllPreds();
    toast("✅ Tarjeta habilitada","ok");
    admTarjetas(document.getElementById("admArea"));
  }catch(e){ toast(e.message,"err"); }
}
function admVerWasabi(uid, btn){
  const area = document.getElementById('admWasabiArea');
  if(area.innerHTML){ area.innerHTML=''; btn.textContent='👁 Ver Wasabi'; return; }
  btn.textContent='🔼 Ocultar Wasabi';
  const pred = APP.allPreds?.[uid]||{};
  let html='';
  APP.wasabiQs.forEach((q,i)=>{
    if(q.type==="bonus"){ html+=`<div class="wq"><div class="qt">${i+1}. ${esc(q.t)} <span class="note">(bonus)</span></div></div>`; return; }
    const wv=(pred.wasabi||{})[q.id]??"";
    html+=`<div class="wq"><div class="qt" style="margin-bottom:6px">${i+1}. ${esc(q.t)}</div>${admEditField(uid,'wasabi',q,wv)}</div>`;
  });
  area.innerHTML=html;
}
function admVerGrupos(uid, btn){
  const area = document.getElementById('admGruposArea');
  if(area.innerHTML){ area.innerHTML=''; btn.textContent='👁 Ver fase de grupos'; return; }
  btn.textContent='▲ Ocultar';
  const pred = APP.allPreds?.[uid]||{};
  const main = pred.main||{};
  const grupos = [...new Set(FIXTURE.map(f=>f.group))].sort();
  let html='<div style="margin-top:12px">';
  grupos.forEach(g=>{
    const partidos = FIXTURE.filter(f=>f.group===g);
    html+=`<div style="margin-bottom:10px"><b style="font-size:13px">Grupo ${g}</b><table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:4px">`;
    partidos.forEach(f=>{
      const v=main[f.id]||{};
      const score = (v.h!=null&&v.h!=='') ? `${v.h} - ${v.a}` : '<span style="color:#aaa">sin cargar</span>';
      html+=`<tr style="border-bottom:1px solid var(--line)">
        <td style="padding:3px 4px;text-align:right">${esc(f.home)}</td>
        <td style="padding:3px 8px;text-align:center;font-weight:600">${score}</td>
        <td style="padding:3px 4px">${esc(f.away)}</td>
      </tr>`;
    });
    html+=`</table></div>`;
  });
  html+='</div>';
  area.innerHTML=html;
}

function admEditField(uid,card,q,val){
  const oc=`onchange="doAdminEdit('${uid}','${card}','${q.id}',this.value)"`;
  if(q.type==="num") return `<input type="number" value="${esc(val)}" ${oc}>`;
  if(q.type==="yesno") return `<select ${oc}><option value="">—</option>${["Sí","No"].map(o=>`<option ${val===o?'selected':''}>${o}</option>`).join("")}</select>`;
  if(q.type==="choice"&&Array.isArray(q.options)) return `<select ${oc}><option value="">—</option>${sortByName(q.options).map(o=>`<option ${val===o?'selected':''}>${esc(o)}</option>`).join("")}</select>`;
  if(q.type==="player") return `<select ${oc}><option value="">—</option>${sortByName(PLANTEL_ARG).map(p=>`<option ${val===p?'selected':''}>${esc(p)}</option>`).join("")}</select>`;
  if(q.type==="participant") return `<select ${oc}><option value="">—</option>${sortByName(playersOnly(),'display_name').map(p=>`<option ${val===p.display_name?'selected':''}>${esc(p.display_name)}</option>`).join("")}</select>`;
  if(q.type==="team"){
    const teams=Object.keys(TEAMS).map(c=>({c,n:TEAMS[c].n,f:TEAMS[c].f}));
    return `<select ${oc}><option value="">—</option>${sortByName(teams,'n').map(t=>`<option ${val===t.n?'selected':''} value="${t.n}">${t.f} ${t.n}</option>`).join("")}</select>`;
  }
  return `<input value="${esc(val)}" ${oc}>`;
}
async function doAdminEdit(uid,card,field,value){
  try{ await adminEditPred(uid,card,field,value); toast("Corregido y registrado en bitácora","ok"); admTarjetas($("#admArea")); }
  catch(e){ toast(e.message,"err"); }
}

/* ---------- ADMIN: exportar todo a Excel ---------- */
async function admHistorial(area){
  area.innerHTML=`<div class="card"><div class="empty"><div class="big">⏳</div>Cargando historial…</div></div>`;
  // cargar snapshots de wasabi por día
  const wasabiSnaps = await loadWasabiSnapshots();
  const preds = APP.allPreds||{};
  const players = APP.profiles.filter(p=>!p.is_admin).sort((a,b)=>a.display_name.localeCompare(b.display_name));

  // todos los días con partidos
  const allDays=[...new Set(FIXTURE.filter(m=>fifaDateOf(m)).map(m=>fifaDateOf(m)))].sort();
  // días con resultados cargados (al menos un partido con resultado)
  const daysWithRes = allDays.filter(d=>{
    const matches=FIXTURE.filter(m=>fifaDateOf(m)===d);
    return matches.some(m=>{ const r=(APP.results.main||{})[m.id]; return r&&r.h!=null&&r.h!==""; });
  });

  // puntos acumulados por jugador antes de cada día
  const acumBefore={}; // acumBefore[uid][day] = puntos acumulados ANTES de ese día
  players.forEach(p=>{
    acumBefore[p.id]={};
    let acum=0;
    daysWithRes.forEach(d=>{
      acumBefore[p.id][d]=acum;
      // sumar principal del día
      const ptsPrinc=mainPointsByDay(preds[p.id]||{},d);
      // sumar wasabi con snapshot del día (o el más reciente anterior)
      const snapKeys=Object.keys(wasabiSnaps).filter(k=>k<=d).sort();
      const wasabiSnap=snapKeys.length?wasabiSnaps[snapKeys[snapKeys.length-1]]:null;
      const ptsWas=wasabiSnap?wasabiTotalAtDay(p.id,wasabiSnap):0;
      // wasabi incremental: diferencia con el día anterior
      const prevSnapKeys=Object.keys(wasabiSnaps).filter(k=>k<d).sort();
      const prevSnap=prevSnapKeys.length?wasabiSnaps[prevSnapKeys[prevSnapKeys.length-1]]:null;
      const ptsWasPrev=prevSnap?wasabiTotalAtDay(p.id,prevSnap):0;
      const wasabiDelta=ptsWas-ptsWasPrev;
      // comodines
      let comodDelta=0;
      APP.comodines.filter(c=>c.day===d).forEach(c=>{
        const pBy=mainPointsByDay(preds[c.by_user]||{},d);
        const pTg=mainPointsByDay(preds[c.target_user||""]||{},d);
        if(c.type==="nitro"&&c.by_user===p.id) comodDelta+=pBy*2;
        if(c.type==="sang"){
          if(c.by_user===p.id){ if(pBy>pTg) comodDelta+=pTg; else if(pBy<pTg) comodDelta-=pBy*0.5; }
          if(c.target_user===p.id&&pBy>pTg) comodDelta-=pTg;
        }
      });
      acum+=ptsPrinc+wasabiDelta+comodDelta;
    });
  });

  // función desglose de un día para un jugador (modal)
  window._histDesglose=(uid,day)=>{
    const pred=preds[uid]||{};
    const pName=APP.profiles.find(p=>p.id===uid)?.display_name||"?";
    const snapKeys=Object.keys(wasabiSnaps).filter(k=>k<=day).sort();
    const wasabiSnap=snapKeys.length?wasabiSnaps[snapKeys[snapKeys.length-1]]:{};
    const prevSnapKeys=Object.keys(wasabiSnaps).filter(k=>k<day).sort();
    const prevSnap=prevSnapKeys.length?wasabiSnaps[prevSnapKeys[prevSnapKeys.length-1]]:{};
    // partidos del día
    const matches=FIXTURE.filter(m=>fifaDateOf(m)===day);
    let rows="";
    matches.forEach(m=>{
      const p=(pred.main||{})[m.id]; const r=(APP.results.main||{})[m.id];
      if(!r||r.h==null||r.h==="") return;
      const pts=matchPointsGrupos(p,r);
      const ht=TEAMS[m.home],at=TEAMS[m.away];
      rows+=`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:13px">
        <span style="flex:1">${ht?.f||""} ${ht?.n||m.home} vs ${at?.n||m.away} ${at?.f||""}</span>
        <span style="color:var(--muted)">Pred: ${p?`${p.h}-${p.a}`:"—"}</span>
        <span style="color:var(--muted)">Real: ${r.h}-${r.a}</span>
        <span style="font-weight:700;color:${pts>0?"var(--aqua)":"var(--muted)"};min-width:28px;text-align:right">${pts>0?"+"+pts:"0"}</span>
      </div>`;
    });
    // preguntas wasabi con resultado en ese día
    let wasabiRows="";
    APP.wasabiQs.forEach((q,i)=>{
      if(q.type==="bonus") return;
      const resVal=wasabiSnap[q.id]; if(resVal==null||resVal==="") return;
      const prevVal=prevSnap[q.id];
      if(resVal===prevVal) return; // no cambió ese día
      const ans=(pred.wasabi||{})[q.id];
      const pts=q.type==="approx"?approxPts(uid,q.id):(matchesResult(ans,resVal)?q.pts:0);
      wasabiRows+=`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:12.5px">
        <span style="flex:1;color:var(--muted)">${i+1}. ${esc(q.t.slice(0,50))}</span>
        <span style="color:var(--muted);font-size:11px">R: ${esc(resVal)}</span>
        <span style="font-weight:700;color:${pts>0?"var(--aqua)":"var(--muted)"};min-width:28px;text-align:right">${pts>0?"+"+pts:"0"}</span>
      </div>`;
    });
    modal(`<h3>📊 ${esc(pName)} · ${day}</h3>
      ${rows||""}
      ${wasabiRows?`<div style="margin-top:12px"><div class="sec-title" style="font-size:12px">🌶️ Wasabi resuelto este día</div>${wasabiRows}</div>`:""}
      <button class="btn ghost full" style="margin-top:14px" onclick="closeModal()">Cerrar</button>`);
  };

  // desglose de comodines de un jugador en un día
  window._histComodDesglose=(uid,day)=>{
    const pName=APP.profiles.find(p=>p.id===uid)?.display_name||"?";
    const dayComods=APP.comodines.filter(c=>c.day===day&&(c.by_user===uid||c.target_user===uid));
    if(!dayComods.length){ modal(`<h3>🎮 ${esc(pName)} · ${day}</h3><p class="note">Sin comodines ese día.</p><button class="btn ghost full" style="margin-top:14px" onclick="closeModal()">Cerrar</button>`); return; }

    let rows="";
    dayComods.forEach(c=>{
      const byName=APP.profiles.find(p=>p.id===c.by_user)?.display_name||"?";
      const tgName=c.target_user?APP.profiles.find(p=>p.id===c.target_user)?.display_name||"?":"-";
      const pBy=mainPointsByDay(preds[c.by_user]||{},day);
      const pTg=c.target_user?mainPointsByDay(preds[c.target_user]||{},day):0;

      if(c.type==="nitro"){
        const ptsFinal=pBy*3;
        rows+=`<div style="padding:10px;border-radius:10px;background:var(--card2);margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:18px">🔥</span>
            <b style="flex:1">${esc(byName)} usó Nitro</b>
            <span style="color:var(--gold);font-weight:700">x3</span>
          </div>
          <div style="font-size:12.5px;color:var(--muted);display:flex;flex-direction:column;gap:4px;padding-left:26px">
            <span>Puntos base del día: <b style="color:var(--text)">${pBy} pts</b></span>
            <span>Con nitro (×3): <b style="color:var(--gold)">${ptsFinal} pts</b></span>
            <span style="color:#22c55e;font-weight:600">Bonus aplicado: +${pBy*2} pts</span>
          </div>
        </div>`;
      } else if(c.type==="sang"){
        let resultado="", color="var(--muted)", detalle="";
        if(pBy>pTg){
          resultado=`${byName} ganó`;
          color="var(--aqua)";
          if(c.by_user===uid) detalle=`<span style="color:#22c55e;font-weight:600">+${pTg} pts (puntos del retado)</span>`;
          else detalle=`<span style="color:#ef4444;font-weight:600">-${pTg} pts (te los llevó ${esc(byName)})</span>`;
        } else if(pBy<pTg){
          resultado=`${byName} perdió`;
          color="#ef4444";
          if(c.by_user===uid) detalle=`<span style="color:#ef4444;font-weight:600">-${pBy*0.5} pts (50% de tus puntos)</span>`;
          else detalle=`<span style="color:#22c55e;font-weight:600">Sin efecto (el retador perdió)</span>`;
        } else {
          resultado="Empate";
          detalle=`<span style="color:var(--muted)">Sin transferencia</span>`;
        }
        rows+=`<div style="padding:10px;border-radius:10px;background:var(--card2);margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:18px">🩸</span>
            <b style="flex:1">${esc(byName)} retó a ${esc(tgName)}</b>
            <span style="color:${color};font-weight:700">${resultado}</span>
          </div>
          <div style="font-size:12.5px;color:var(--muted);display:flex;flex-direction:column;gap:4px;padding-left:26px">
            <span>${esc(byName)}: <b style="color:var(--text)">${pBy} pts</b> ese día</span>
            <span>${esc(tgName)}: <b style="color:var(--text)">${pTg} pts</b> ese día</span>
            ${detalle}
          </div>
        </div>`;
      }
    });

    modal(`<h3>🎮 ${esc(pName)} · comodines ${day}</h3>
      ${rows}
      <button class="btn ghost full" style="margin-top:14px" onclick="closeModal()">Cerrar</button>`);
  };

  // ── Render ──────────────────────────────────────────────────────────
  let html=`<div class="card"><div class="sec-title">📊 Historial por día</div>
    <p class="note">Pts antes · generados (Princ+Was) · comodines · total del día. Tocá los puntos generados para ver el desglose.</p>
    <div style="overflow-x:auto;margin-top:12px"><table>
      <tr>
        <th style="position:sticky;left:0;z-index:2;background:var(--card)">Jugador</th>
        ${daysWithRes.map(d=>`<th colspan="4" style="text-align:center;font-size:11px">${d.slice(5)}</th>`).join("")}
      </tr>
      <tr>
        <th style="position:sticky;left:0;z-index:2;background:var(--card)"></th>
        ${daysWithRes.map(()=>`<th style="font-size:10px;color:var(--muted)">Antes</th><th style="font-size:10px;color:var(--muted)">Gen</th><th style="font-size:10px;color:var(--muted)">Comod</th><th style="font-size:10px;color:var(--muted)">Total</th>`).join("")}
      </tr>`;

  players.forEach(p=>{
    html+=`<tr><td class="name" style="font-size:13px;position:sticky;left:0;z-index:1;background:var(--card)">${esc(p.display_name)}</td>`;
    daysWithRes.forEach(d=>{
      const antes=acumBefore[p.id]?.[d]??0;
      const ptsPrinc=mainPointsByDay(preds[p.id]||{},d);
      const snapKeys=Object.keys(wasabiSnaps).filter(k=>k<=d).sort();
      const wasabiSnap=snapKeys.length?wasabiSnaps[snapKeys[snapKeys.length-1]]:null;
      const prevSnapKeys=Object.keys(wasabiSnaps).filter(k=>k<d).sort();
      const prevSnap=prevSnapKeys.length?wasabiSnaps[prevSnapKeys[prevSnapKeys.length-1]]:null;
      const ptsWas=wasabiSnap?wasabiTotalAtDay(p.id,wasabiSnap):0;
      const ptsWasPrev=prevSnap?wasabiTotalAtDay(p.id,prevSnap):0;
      const wasabiDelta=ptsWas-ptsWasPrev;
      const gen=ptsPrinc+wasabiDelta;
      let comodDelta=0;
      APP.comodines.filter(c=>c.day===d).forEach(c=>{
        const pBy=mainPointsByDay(preds[c.by_user]||{},d);
        const pTg=mainPointsByDay(preds[c.target_user||""]||{},d);
        if(c.type==="nitro"&&c.by_user===p.id) comodDelta+=pBy*2;
        if(c.type==="sang"){
          if(c.by_user===p.id){ if(pBy>pTg) comodDelta+=pTg; else if(pBy<pTg) comodDelta-=pBy*0.5; }
          if(c.target_user===p.id&&pBy>pTg) comodDelta-=pTg;
        }
      });
      const total=gen+comodDelta;
      const comodStr=comodDelta===0?"0":(comodDelta>0?"+"+comodDelta:comodDelta);
      html+=`<td style="text-align:right;font-size:12px;color:var(--muted)">${antes}</td>
        <td style="text-align:right;font-size:12px">
          <span style="color:${gen>0?"var(--aqua)":"var(--muted)"};cursor:${gen>0?"pointer":"default"};text-decoration:${gen>0?"underline":"none"}"
            ${gen>0?`onclick="_histDesglose('${p.id}','${d}')"`:""}>${gen>0?"+"+gen:"0"}</span>
        </td>
        <td style="text-align:right;font-size:12px;color:${comodDelta>0?"#22c55e":comodDelta<0?"#ef4444":"var(--muted)"}">
          <span style="cursor:${comodDelta!==0?"pointer":"default"};text-decoration:${comodDelta!==0?"underline":"none"}"
            ${comodDelta!==0?`onclick="_histComodDesglose('${p.id}','${d}')"`:""}>${comodStr}</span>
        </td>
        <td style="text-align:right;font-size:12px;font-weight:700">${total>0?"+"+total:total||0}</td>`;
    });
    html+=`</tr>`;
  });

  html+=`</table></div></div>`;

  // ── Comodines del día (sección existente abajo) ──────────────────
  const byBlock={};
  APP.comodines.forEach(c=>{ const k=c.day||'sin-fecha'; if(!byBlock[k]) byBlock[k]=[]; byBlock[k].push(c); });
  const blocks=Object.keys(byBlock).sort().reverse();
  html+=`<div class="card" style="margin-top:16px"><div class="sec-title">🩸🔥 Detalle de comodines</div>`;
  if(!blocks.length){ html+=`<p class="note">No hay comodines registrados aún.</p>`; }
  blocks.forEach(block=>{
    html+=`<div style="margin-top:14px"><div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px">📅 ${block}</div>`;
    byBlock[block].forEach(c=>{
      const byName=APP.profiles.find(p=>p.id===c.by_user)?.display_name||'?';
      const tgName=c.target_user?APP.profiles.find(p=>p.id===c.target_user)?.display_name||'?':'-';
      if(c.type==='nitro'){
        const pts=mainPointsByDay(preds[c.by_user]||{},block);
        html+=`<div style="padding:8px 10px;border-radius:8px;background:var(--card2);margin-bottom:6px;display:flex;align-items:center;gap:8px">
          <span>🔥</span><div style="flex:1;font-size:13px"><b>${esc(byName)}</b> usó Nitro</div>
          <span style="color:var(--gold);font-weight:700;font-size:12px">x3 → ${pts*3} pts</span></div>`;
      } else if(c.type==='sang'){
        const pBy=mainPointsByDay(preds[c.by_user]||{},block);
        const pTg=mainPointsByDay(preds[c.target_user]||{},block);
        let res='',col='var(--muted)',badge='';
        if(pBy>pTg){res=`${byName} ganó`;col='var(--aqua)';badge=`+${pTg} pts`;}
        else if(pBy<pTg){res=`${byName} perdió`;col='#ef4444';badge=`-${pBy*0.5} pts`;}
        else{res='Empate';badge='Sin transferencia';}
        html+=`<div style="padding:8px 10px;border-radius:8px;background:var(--card2);margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <span>🩸</span><div style="flex:1;font-size:13px"><b>${esc(byName)}</b> retó a <b>${esc(tgName)}</b></div>
            <span style="color:${col};font-weight:700;font-size:12px">${res}</span></div>
          <div style="font-size:11px;color:var(--muted);padding-left:22px;margin-top:2px">${esc(byName)}: ${pBy}pts · ${esc(tgName)}: ${pTg}pts · ${badge}</div>
        </div>`;
      }
    });
    html+=`</div>`;
  });
  html+=`</div>`;
  area.innerHTML=html;
}

function admElim(area){
  const open = APP.results?.elim_phase_open||null;
  const elimFix = APP.results?.elim_fixture||{};
  const PHASES_ELIM = [
    {key:"r32",label:"Ronda de 32",slots:Array.from({length:16},(_,i)=>73+i)},
    {key:"r16",label:"Octavos de Final",slots:Array.from({length:8},(_,i)=>89+i)},
    {key:"qf", label:"Cuartos de Final",slots:Array.from({length:4},(_,i)=>97+i)},
    {key:"sf", label:"Semifinales",slots:[101,102]},
    {key:"tpfinal",label:"3° Puesto y Final",slots:[103,104]},
  ];

  let html=`<div class="card"><div class="sec-title">🏆 Gestión de Eliminatorias</div>
    <p class="note">Desde acá abrís cada fase, cargás los equipos clasificados y cargás los resultados reales.</p>
    <div style="margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--card2)">
      <b>Fase actualmente abierta:</b> <span style="color:var(--aqua);font-weight:700">${open?STAGE_LABEL[open]||open:"Ninguna (solo grupos)"}</span>
    </div>
  </div>`;

  PHASES_ELIM.forEach(({key,label,slots})=>{
    const matches = FIXTURE.filter(m=>slots.includes(m.slot));
    const resElim = APP.results?.elim||{};
    const w = ELIM_WINDOWS[key];
    const now = Date.now();
    const autoOpen = w && now>=new Date(w.open).getTime() && now<=new Date(w.close).getTime();
    const autoClosed = w && now>new Date(w.close).getTime();
    const ov = (APP.results?.elim_overrides||{})[key]||null;
    const effectiveOpen = ov==="open" || (!ov && autoOpen);
    const openLabel = w ? `${new Date(w.open).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'})} ${new Date(w.open).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})} → ${new Date(w.close).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'})} ${new Date(w.close).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}` : '—';
    html+=`<div class="card" style="margin-top:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
        <div class="sec-title" style="margin:0;flex:1">${label}</div>
        <span style="font-size:11px;color:${effectiveOpen?'var(--aqua)':autoClosed?'var(--muted)':'rgba(255,255,255,0.3)'}">${effectiveOpen?'✅ ABIERTA':autoClosed?'🔒 Cerrada':'⏳ No iniciada'}${ov?` (override: ${ov})`:' (auto)'}</span>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">🕐 Ventana automática: ${openLabel}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn sm primary" onclick="admOpenPhase('${key}')">Forzar abrir</button>
        <button class="btn sm danger" onclick="admClosePhase('${key}')">Forzar cerrar</button>
        ${ov?`<button class="btn sm ghost" onclick="admResetPhaseOverride('${key}')">Modo automático</button>`:''}
      </div>`;

    // tabla de equipos + resultados por partido
    html+=`<table style="width:100%;font-size:12px;border-collapse:collapse">
      <tr style="color:var(--muted);font-size:11px"><th style="text-align:left;padding:3px 4px">Partido</th><th>Local</th><th>Visitante</th><th>Resultado real</th></tr>`;
    slots.forEach(slot=>{
      const fx = elimFix[slot]||{};
      const res = resElim[slot]||{};
      const m = matches.find(x=>x.slot===slot);
      const hasRes = res.h!=null&&res.h!=="";
      html+=`<tr style="border-bottom:1px solid var(--line)">
        <td style="padding:4px;color:var(--muted);font-size:11px">${m?.label||'P'+slot}</td>
        <td style="padding:4px"><input style="width:90px;font-size:11px" value="${esc(fx.home||'')}" placeholder="Local" onchange="admSetElimTeam(${slot},'home',this.value)"></td>
        <td style="padding:4px"><input style="width:90px;font-size:11px" value="${esc(fx.away||'')}" placeholder="Visitante" onchange="admSetElimTeam(${slot},'away',this.value)"></td>
        <td style="padding:4px;display:flex;gap:4px;align-items:center">
          <input type="number" style="width:40px;font-size:11px" value="${res.h??''}" placeholder="L" onchange="admSetElimRes(${slot},'h',this.value)">
          <span>-</span>
          <input type="number" style="width:40px;font-size:11px" value="${res.a??''}" placeholder="V" onchange="admSetElimRes(${slot},'a',this.value)">
          ${hasRes&&+res.h===+res.a?`<select style="font-size:11px" onchange="admSetElimRes(${slot},'pen',this.value)">
            <option value="">Pen?</option>
            <option ${res.pen==='1'?'selected':''} value="1">Local</option>
            <option ${res.pen==='0'?'selected':''} value="0">Visita</option>
          </select>`:''}
        </td>
      </tr>`;
    });
    html+=`</table></div>`;
  });

  area.innerHTML=html;
}

async function admOpenPhase(phase){
  try{
    await adminSetElimOverride(phase, "open");
    toast(`✅ ${STAGE_LABEL[phase]||phase} forzada ABIERTA`,"ok");
    admElim($("#admArea"));
    render();
  }catch(e){ toast(e.message,"err"); }
}
async function admClosePhase(phase){
  try{
    await adminSetElimOverride(phase, "closed");
    toast(`🔒 ${STAGE_LABEL[phase]||phase} forzada CERRADA`,"ok");
    admElim($("#admArea"));
    render();
  }catch(e){ toast(e.message,"err"); }
}
async function admResetPhaseOverride(phase){
  try{
    await adminSetElimOverride(phase, null);
    toast(`🔄 ${STAGE_LABEL[phase]||phase} volvió a modo automático`,"ok");
    admElim($("#admArea"));
    render();
  }catch(e){ toast(e.message,"err"); }
}

async function admSetElimTeam(slot, side, val){
  const fix = {...(APP.results?.elim_fixture||{})};
  fix[slot] = {...(fix[slot]||{}), [side]:val.trim()};
  try{
    await adminSaveResults({elim_fixture:fix});
    // actualizar fixture en memoria para que los jugadores vean los equipos
    const m=FIXTURE.find(x=>x.slot===slot);
    if(m){ if(side==='home') m.home=val.trim(); else m.away=val.trim(); }
    toast("Guardado","ok");
  }catch(e){ toast(e.message,"err"); }
}

async function admSetElimRes(slot, key, val){
  const elim = {...(APP.results?.elim||{})};
  elim[slot] = {...(elim[slot]||{}), [key]:val};
  try{
    await adminSaveResults({elim});
    invalidateStandings();
    toast("Resultado guardado","ok");
  }catch(e){ toast(e.message,"err"); }
}

function admExport(area){
  area.innerHTML=`<div class="card"><div class="sec-title">📤 Exportar respaldo</div>
    <p class="note">Descargá una planilla Excel con todo lo que cargó cada jugador (Wasabi y Principal), el estado de pago y la bitácora de correcciones. Sirve como respaldo ante reclamos: es una foto de la base en este momento.</p>
    <button class="btn primary" style="margin-top:14px" onclick="doExport()">📥 Descargar Excel</button>
    <p class="note" style="margin-top:10px">Conviene exportar después de la fecha límite (11/6) para tener la foto definitiva.</p></div>`;
}
async function doExport(){
  try{
    toast("Generando Excel…");
    await adminLoadAllPreds();
    const [log, wasabiSnaps] = await Promise.all([adminLoadEditLog(), loadWasabiSnapshots()]);
    APP._wasabiSnaps = wasabiSnaps;
    buildExcel(log);
  }catch(e){ toast(e.message,"err"); }
}

/* genera y descarga el respaldo en Excel.
   Usa formato SpreadsheetML (XML de Excel) nativo, sin librerías externas:
   funciona offline y lo abren Excel y Google Sheets. Varias hojas en un archivo. */
function buildExcel(log){
  const players=APP.profiles.slice().sort((a,b)=>a.display_name.localeCompare(b.display_name));
  const fmtTime=t=>t?new Date(t).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}):"";
  const xmlEsc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function cell(v){
    const num = typeof v==="number" && isFinite(v);
    return `<Cell><Data ss:Type="${num?'Number':'String'}">${xmlEsc(v)}</Data></Cell>`;
  }
  function sheet(name, rows){
    const safe=name.replace(/[^\w ]/g,"").slice(0,28);
    const body=rows.map(r=>`<Row>${r.map(cell).join("")}</Row>`).join("");
    return `<Worksheet ss:Name="${safe}"><Table>${body}</Table></Worksheet>`;
  }
  const tb=standings();
  // Resumen
  const resumen=[["Jugador","Email","Pago","Tarjeta enviada","Enviada el","Total Principal","Total Wasabi","TOTAL"]];
  players.forEach(p=>{ const pred=APP.allPreds?.[p.id]||{}; const r=tb.find(x=>x.id===p.id)||{};
    resumen.push([p.display_name,p.email||"",hasPaid(p.id)?"SÍ":"NO",pred.locked?"SÍ":"No (borrador)",fmtTime(pred.locked_at),
      (r.main||0)+(r.extra||0),r.wasabi||0,r.total||0]); });
  // Wasabi
  const wasabi=[["Jugador",...APP.wasabiQs.map((q,i)=>`${i+1}. ${q.t.slice(0,40)}`)]];
  players.forEach(p=>{ const pred=APP.allPreds?.[p.id]||{}; wasabi.push([p.display_name,...APP.wasabiQs.map(q=>(pred.wasabi||{})[q.id]??"")]); });
  // Principal
  const principal=[["Jugador",...FIXTURE.map(m=>m.label+(m.grp?` ${TEAMS[m.home]?.n||''} vs ${TEAMS[m.away]?.n||''}`:""))]];
  players.forEach(p=>{ const pred=APP.allPreds?.[p.id]||{};
    principal.push([p.display_name,...FIXTURE.map(m=>{const v=(pred.main||{})[m.id]; return v&&v.h!==""&&v.h!=null?`${v.h}-${v.a}${v.pen?` (av:${v.pen==='1'?'L':'V'})`:''}`:"";})]); });
  // Comodines - con detalle de resultado
  const com=[["Fecha","Tipo","De","A","Fase","Dia","Resultado","Pts transferidos"]];
  APP.comodines.forEach(c=>{
    const byName=APP.profiles.find(x=>x.id===c.by_user)?.display_name||"?";
    const tgName=c.target_user?(APP.profiles.find(x=>x.id===c.target_user)?.display_name||"?"):"-";
    let resultado="", ptsTrans="";
    if(c.type==="sang"&&c.target_user){
      const day=c.day||"";
      const pBy=mainPointsByDay(APP.allPreds?.[c.by_user]||{},day);
      const pTg=mainPointsByDay(APP.allPreds?.[c.target_user]||{},day);
      if(pBy>pTg){ resultado=byName+" gano"; ptsTrans=pTg; }
      else if(pBy<pTg){ resultado=byName+" perdio"; ptsTrans=Math.round(pTg*0.5); }
      else { resultado="Empate"; ptsTrans=0; }
    } else if(c.type==="nitro"){
      const day=c.day||"";
      const pts=mainPointsByDay(APP.allPreds?.[c.by_user]||{},day);
      resultado="Nitro aplicado"; ptsTrans="x3 ("+pts+" pts)";
    }
    com.push([fmtTime(c.created_at),c.type==="sang"?"Sanguijuela":"Nitro",byName,tgName,c.phase,c.day||"",resultado,ptsTrans]);
  });
  // Bitácora
  const bit=[["Fecha","Jugador","Tarjeta","Campo","Valor anterior","Valor nuevo"]];
  (log||[]).forEach(e=>bit.push([fmtTime(e.created_at),APP.profiles.find(x=>x.id===e.target_user)?.display_name||"?",
    e.card,e.field,e.old_value||"",e.new_value||""]));

  // Log por fechas — desglose completo por día
  // necesitamos los snapshots wasabi; como buildExcel es sync, usamos APP._wasabiSnaps si está cargado
  const wasabiSnapsExcel = APP._wasabiSnaps||{};
  const allDaysExcel=[...new Set(FIXTURE.filter(m=>fifaDateOf(m)).map(m=>fifaDateOf(m)))].sort();
  const daysWithResExcel = allDaysExcel.filter(d=>{
    const ms=FIXTURE.filter(m=>fifaDateOf(m)===d);
    return ms.some(m=>{ const r=(APP.results.main||{})[m.id]; return r&&r.h!=null&&r.h!==""; });
  });

  // header fijo por día: Pts antes | Principal | Wasabi | Generados | Comodines | Total día
  const logHeader1=["Jugador"];
  const logHeader2=[""];
  daysWithResExcel.forEach(d=>{
    logHeader1.push(d.slice(5),"","","","","");
    logHeader2.push("Pts antes","Principal","Wasabi","Generados","Comodines","Total día");
  });
  const logRows=[logHeader1,logHeader2];

  const sortedPlayersExcel=tb.slice().sort((a,b)=>a.name.localeCompare(b.name));
  sortedPlayersExcel.forEach(r=>{
    const uid=r.id;
    const pred=APP.allPreds?.[uid]||{};
    const row=[r.name];
    let acum=0;
    daysWithResExcel.forEach(d=>{
      const antes=acum;
      const ptsPrinc=mainPointsByDay(pred,d);
      // wasabi incremental
      const snapKeys=Object.keys(wasabiSnapsExcel).filter(k=>k<=d).sort();
      const prevSnapKeys=Object.keys(wasabiSnapsExcel).filter(k=>k<d).sort();
      const snap=snapKeys.length?wasabiSnapsExcel[snapKeys[snapKeys.length-1]]:null;
      const prevSnap=prevSnapKeys.length?wasabiSnapsExcel[prevSnapKeys[prevSnapKeys.length-1]]:null;
      const ptsWas=snap?wasabiTotalAtDay(uid,snap):0;
      const ptsWasPrev=prevSnap?wasabiTotalAtDay(uid,prevSnap):0;
      const wasabiDelta=ptsWas-ptsWasPrev;
      const gen=ptsPrinc+wasabiDelta;
      // comodines
      let comodDelta=0;
      APP.comodines.filter(c=>c.day===d).forEach(c=>{
        const pBy=mainPointsByDay(APP.allPreds?.[c.by_user]||{},d);
        const pTg=mainPointsByDay(APP.allPreds?.[c.target_user||""]||{},d);
        if(c.type==="nitro"&&c.by_user===uid) comodDelta+=pBy*2;
        if(c.type==="sang"){
          if(c.by_user===uid){ if(pBy>pTg) comodDelta+=pTg; else if(pBy<pTg) comodDelta-=pBy*0.5; }
          if(c.target_user===uid&&pBy>pTg) comodDelta-=pTg;
        }
      });
      const totalDia=gen+comodDelta;
      acum+=totalDia;
      row.push(antes, ptsPrinc, wasabiDelta, gen, comodDelta, totalDia);
    });
    logRows.push(row);
  });

  const xml=`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheet("Resumen",resumen)}
${sheet("Wasabi",wasabi)}
${sheet("Principal",principal)}
${sheet("Comodines",com)}
${sheet("Bitacora",bit)}
${sheet("Log Fechas",logRows)}
</Workbook>`;
  const blob=new Blob([xml],{type:"application/vnd.ms-excel"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`PinguiProde-respaldo-${new Date().toISOString().slice(0,10)}.xls`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast("Excel descargado ✓","ok");
}

/* ---------- ARRANQUE ---------- */
boot();

async function doDeletePenalty(uid, penId){
  if(!confirm("¿Eliminar esta penalización?")) return;
  try{ await adminDeletePenalty(uid, penId); toast("Penalización eliminada","ok"); admPenalizaciones($("#admArea")); }
  catch(e){ toast(e.message,"err"); }
}
