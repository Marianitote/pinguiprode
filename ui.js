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
    // cargar predicciones de todos para acertaronPublic (jugadores no-admin)
    if(!isAdmin()){
      try{
        const {data:allP}=await sb.from('predictions').select('user_id,main,wasabi,extra,bracket,penalties');
        (allP||[]).forEach(p=>{ if(!APP.allPreds) APP.allPreds={}; APP.allPreds[p.user_id]=p; });
      }catch(e){ console.warn('No se pudieron cargar predicciones de todos:',e); }
    }
    render();
  }catch(e){ console.error(e); app.innerHTML=`<div class="auth-wrap"><div class="card"><div class="sec-title">Error</div><p class="lead">${esc(e.message||e)}</p><p class="note" style="margin-top:10px">Si recién configuraste Supabase, revisá que las claves en config.js sean correctas.</p></div></div>`; }
}
// flag para no re-renderizar la app encima de la pantalla de nueva contraseña
let RECOVERING=false;
// re-cargar cuando cambia la sesión (ej: al volver del mail de confirmación)
sb.auth.onAuthStateChange((event,_s)=>{
  // si el usuario entró desde el link de "recuperar contraseña", mostramos la
  // pantalla para escribir la clave nueva en vez de entrar normal a la app
  if(event==="PASSWORD_RECOVERY"){ RECOVERING=true; renderResetPassword(); return; }
  if(RECOVERING) return; // ya está en la pantalla de nueva clave, no pisar
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
  ({inicio:renderInicio,principal:renderPrincipal,wasabi:renderWasabi,
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
  const tabs=[["inicio","Inicio"],["principal","Principal"],["wasabi","Wasabi"],
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
    <div class="card"><div class="sec-title">Tabla de posiciones</div>
      <p class="note">Vista en vivo de las posiciones (incluye flechas ▲▼ y zonas).</p>
      ${standingsTableHTML({inline:false})}
    </div>
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
  // estados de cada tarjeta (punto 17: cierre por tarjeta) — usa cardSent() de core
  const wasabiSent = cardSent('wasabi');
  const principalSent = cardSent('main');
  // contador Wasabi: NO cuenta las bonus (punto 19)
  const wasabiNonBonus = APP.wasabiQs.filter(q=>q.type!=="bonus");
  const wa = wasabiNonBonus.filter(q=>{const v=(myPred.wasabi||{})[q.id]; return v!=null && v!=="";}).length;
  const waTotal = wasabiNonBonus.length;
  // progreso de Principal: por etapas
  const stagesDone = STAGES.filter(s=>stageSent(s)).length;
  const principalProgress = principalSent
    ? "✓ Todas las etapas enviadas"
    : `Etapa ${stagesDone+1}/${STAGES.length}: ${STAGE_LABEL[currentStage()]||"—"}`;
  // status helper
  const statusBadge = sent => sent
    ? `<span style="color:var(--gold);font-weight:700">🔒 Enviada</span>`
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
    <table>
      <tr><td class="name">⚽ Principal</td><td style="text-align:right">${principalProgress}</td><td style="text-align:right;min-width:110px">${statusBadge(principalSent)}</td></tr>
      <tr><td class="name">🌶️ Wasabi</td><td style="text-align:right">${wa}/${waTotal}</td><td style="text-align:right">${statusBadge(wasabiSent)}</td></tr>
    </table>
    <div class="row" style="margin-top:14px;gap:8px;flex-wrap:wrap">
      ${!principalSent?'<button class="btn primary sm" onclick="TAB=\'principal\';render()">⚽ Ir a Principal</button>':''}
      ${!wasabiSent?'<button class="btn primary sm" onclick="TAB=\'wasabi\';render()">🌶️ Ir a Wasabi</button>':''}
      ${(wasabiSent&&principalSent)?'<span class="note">Las dos tarjetas están enviadas. Ahora seguí la tabla y usá tus comodines.</span>':''}
    </div>
    ${(!wasabiSent||!principalSent)?'<p class="note" style="margin-top:10px">Podés volver y seguir cargando cada tarjeta. Cuando estés listo con una, andá adentro y tocá <b>Confirmar y enviar</b> — se cierra esa tarjeta sola.</p>':''}
  </div>
  ${(()=>{
    // Partidos del día (6am Argentina a 6am del día siguiente)
    const tz='America/Argentina/Buenos_Aires';
    const now=new Date();
    // obtener fecha argentina como string YYYY-MM-DD
    const argDateStr=now.toLocaleDateString('en-CA',{timeZone:tz}); // "2026-06-14"
    const argH=parseInt(now.toLocaleTimeString('en-CA',{timeZone:tz,hour:'2-digit',hour12:false}));
    // si antes de las 6am, tomar el día anterior
    let [yy,mm,dd]=argDateStr.split('-').map(Number);
    if(argH<6){ const prev=new Date(Date.UTC(yy,mm-1,dd-1)); yy=prev.getUTCFullYear(); mm=prev.getUTCMonth()+1; dd=prev.getUTCDate(); }
    const pad=n=>String(n).padStart(2,'0');
    const startUTC=new Date(`${yy}-${pad(mm)}-${pad(dd)}T09:00:00Z`); // 6am ARG = UTC-3 = 9am UTC
    const endUTC=new Date(startUTC.getTime()+24*60*60*1000);
    const todayMatches=FIXTURE.filter(m=>{
      if(!m.kickoff) return false;
      const k=new Date(m.kickoff);
      return k>=startUTC && k<endUTC;
    });
    if(!todayMatches.length) return '';
    const res=APP.results?.main||{};
    const myMain=APP.myPred?.main||{};
    let rows='';
    todayMatches.forEach(m=>{
      const r=res[m.id]; const p=myMain[m.id]||{};
      const kickoff=new Date(m.kickoff);
      const hora=kickoff.toLocaleTimeString('es-AR',{timeZone:tz,hour:'2-digit',minute:'2-digit'});
      const homeTeam=TEAMS[m.home]; const awayTeam=TEAMS[m.away];
      const resultStr=r&&r.h!=null&&r.h!==''?`<b>${r.h}-${r.a}</b>`:`<span style="color:var(--muted)">${hora}hs</span>`;
      const predStr=p.h!=null&&p.h!==''?`${p.h}-${p.a}`:`<span style="color:var(--muted)">—</span>`;
      // acertaron si hay resultado
      let acertaronStr='';
      if(r&&r.h!=null&&r.h!==''){
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
        <div style="display:flex;align-items:center;gap:8px">
          <span style="flex:1;font-size:13px">${homeTeam?.f||''} ${homeTeam?.n||m.home} vs ${awayTeam?.n||m.away} ${awayTeam?.f||''}</span>
          <span style="font-size:13px;min-width:40px;text-align:center">${resultStr}</span>
          <span style="font-size:12px;color:var(--muted);min-width:40px;text-align:right">Tu pred: ${predStr}</span>
        </div>${acertaronStr}
      </div>`;
    });
    return `<div class="card"><div class="sec-title">⚽ Partidos de hoy</div>${rows}</div>`;
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
    <p class="note">Las flechas marcan cuánto subiste o bajaste desde la fecha anterior. Desde acá podés tirar 🔥 nitro (en tu fila) o 🩸 sanguijuela a un rival reteable.</p>
    ${standingsTableHTML({inline:true})}
    ${(()=>{
      const wOpen2=windowOpenNow(); const hasMatches2=dayHasMatches(todayDayKey());
      const tb2=standings(); const meRow2=tb2.find(r=>r.id===APP.user?.id);
      const reteables=tb2.filter(r=>r.id!==APP.user?.id && meRow2 && meRow2.pos!==1 && (meRow2.pos-r.pos)>0 && (meRow2.pos-r.pos)<=3);
      const enabled = reteables.length>0 && hasMatches2 && wOpen2;
      const opts2 = reteables.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
      const disabledReason = !hasMatches2||!wOpen2 ? 'Ventana cerrada (6-12hs con partidos)' : reteables.length===0 ? 'No tenés rivales reteables ahora' : '';
      return `<div style="margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:15px">🩸 Aplicar sanguijuela a:</span>
        <select id="sangTarget" ${!enabled?'disabled':''} style="flex:1;min-width:150px;opacity:${enabled?1:0.5}">
          <option value="">— elegí un rival —</option>
          ${opts2}
        </select>
        <button class="btn sm primary" ${!enabled?'disabled':''} title="${disabledReason}" onclick="(function(){if(!windowOpenNow()||!dayHasMatches(todayDayKey())){toast('Ventana cerrada (6-12hs con partidos)','err');return;}const sel=document.getElementById('sangTarget');if(!sel.value)return;openSangTo(sel.value);})()" >Aplicar 🩸</button>
      </div>`;
    })()}
  </div>
  ${(()=>{
    const myPens=(APP.myPred?.penalties||[]);
    if(!myPens.length) return '';
    const total=myPens.reduce((s,p)=>s+(+p.pts||0),0);
    const rows=myPens.map(pen=>{
      const fecha=new Date(pen.date).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:13px">
        <span style="color:#ef4444;font-weight:700;flex-shrink:0">⚡ -${pen.pts}pts</span>
        <span style="flex:1">${esc(pen.reason)}</span>
        <span style="color:var(--muted);font-size:11px">${fecha}</span>
      </div>`;
    }).join('');
    return `<div class="card" style="border-color:#ef4444;background:rgba(239,68,68,.06)">
      <div class="sec-title" style="color:#ef4444">⚡ Penalizaciones aplicadas</div>
      <p class="note" style="margin-bottom:10px">El COMIPRO aplicó descuentos en tus puntos. Total descontado: <b style="color:#ef4444">-${total}pts</b></p>
      ${rows}
    </div>`;
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
  const main=APP.myPred?.main||{};
  const bracket=APP.myPred?.bracket||{};
  // header con barra de etapas
  let header=`<div class="card" style="margin-top:18px">
    <div class="sec-title">Tarjeta Principal · Cuadro autocompletado</div>
    <p class="note">Cargás los grupos, la app calcula qué equipos pasan según tus predicciones, y armás el cuadro etapa por etapa. Si un equipo que pusiste no clasifica, no suma puntos en las siguientes etapas — por eso es importante la Wasabi.</p>
    <p class="note" style="font-style:italic;font-size:12px">💡 Tip: todos los partidos arrancan en <b>0-0</b>. Solo cambiá los marcadores que querés predecir distinto.</p>
    <div class="stages-bar">${STAGES.map((s,i)=>{
      const done=stageSent(s);
      const active=!done&&canEnterStage(s);
      const cls=done?"done":active?"active":"pending";
      const num=i+1;
      return `<button class="${cls}" data-stage="${s}" ${done||active?'':'disabled'}><span class="num">${done?'✓':num}</span><span class="lbl">${STAGE_LABEL[s].replace('Fase de ','').replace(' de Final','').replace('3er Puesto y ','3°+')}</span></button>`;
    }).join("")}</div>
  </div>`;
  v.innerHTML = header + `<div id="prArea"></div>`;
  document.querySelectorAll(".stages-bar button").forEach(b=>{
    b.onclick = ()=>{ PR_PHASE=b.dataset.stage; renderPrincipal(v); };
  });
  if(!PR_PHASE || !STAGES.includes(PR_PHASE)) PR_PHASE = currentStage() || "tpfinal";
  // pre-poblar defaults antes de renderizar (solo la primera vez)
  ensureDefaults().then(()=>prStageArea());
}

/* Render del área activa según la etapa seleccionada */
function prStageArea(){
  const area=$("#prArea"); if(!area) return;
  if(PR_PHASE==="grupos"){ return prAreaGrupos(area); }
  return prAreaElim(area, PR_PHASE);
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
      <div><label class="field">👟 Bota de oro (+3)</label>${isel('boot_gold','Goleador')}</div>
      <div><label class="field">👟 Bota de plata (+2)</label>${isel('boot_silver','2º goleador')}</div>
      <div><label class="field">👟 Bota de bronce (+1)</label>${isel('boot_bronze','3º goleador')}</div>
      <div><label class="field">⚽ Balón de oro (+3)</label>${isel('ball_gold','Mejor jugador')}</div>
      <div><label class="field">⚽ Balón de plata (+2)</label>${isel('ball_silver','2º mejor')}</div>
      <div><label class="field">⚽ Balón de bronce (+1)</label>${isel('ball_bronze','3º mejor')}</div>
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
    const bgClass = isBonus ? "wq-bonus" : (isAnswered ? "wq-answered" : "");
    html+=`<div class="wq ${bgClass}"><div class="qh"><div class="qn">${i+1}</div>
      <div class="qt">${esc(q.t)}</div><div><span class="badge ${q.noComo?'r':'w'}">${q.pts}</span></div></div>
      ${isBonus
        ? `<div class="note" style="color:var(--gold);font-style:italic">🎁 Se completa de manera automática</div>`
        : sent
          ? (v ? `<div style="font-size:13.5px;font-weight:600;color:var(--aqua);padding:4px 0">${esc(v)}</div>`
               : `<div style="font-size:12.5px;color:var(--muted);font-style:italic;padding:4px 0">Sin responder</div>`)
          : inputFor(q,v??"","wasabi",sent)}
      ${q.ac?`<p class="note" style="margin-top:8px;font-size:12.5px;font-style:italic">${esc(q.ac)}</p>`:""}
      ${(()=>{
        if(q.type==="bonus") return "";
        const resVal=(APP.results.wasabi||{})[q.id];
        if(resVal==null||resVal==="") return "";
        let ganadores=[];
        if(q.type==="approx"){
          // para preguntas de aproximación: el/los más cercanos al resultado
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
  // ¿a quién recibió sanguijuela? (en cualquier fecha de la fase actual) → para el ícono
  function recibioSang(uid){ return APP.comodines.some(c=>c.type==="sang"&&c.target_user===uid); }
  function usoNitro(uid){ return APP.comodines.some(c=>c.type==="nitro"&&c.by_user===uid); }
  function quienSanguijuelo(uid){ const c=APP.comodines.find(co=>co.type==="sang"&&co.target_user===uid); return c?APP.profiles?.find(p=>p.id===c.by_user)?.display_name||"alguien":null; }
  // botones inline
  function actions(r){
    if(!opts.inline||isAdmin()) return "";
    let btns="";
    // sanguijuela si es reteable (está arriba mío hasta 3 posiciones y yo no soy 1°)
    const wOpen = windowOpenNow(); const hasMatches = dayHasMatches(todayDayKey());
    if(r.id===APP.user.id){
      if(usoNitro(r.id)){
        btns+=`<span class="btn-mini nitro" title="Nitro activado" style="cursor:default">🔥✅</span>`;
      } else if(!hasMatches||!wOpen){
        btns+=`<span class="btn-mini nitro" title="Ventana cerrada (6-12hs con partidos)" style="cursor:not-allowed;opacity:0.4">🔥</span>`;
      } else {
        btns+=`<button class="btn-mini nitro" title="Usar nitro" onclick="openNitro()">🔥</button>`;
      }
    } else {
      const reteable = me && me.pos!==1 && (me.pos-r.pos)>0 && (me.pos-r.pos)<=3;
      if(reteable) btns+=`<button class="btn-mini sang" title="Retar con sanguijuela" onclick="openSangTo('${r.id}')">🩸</button>`;
    }
    return `<div class="tbl-actions">${btns||'<span style="color:var(--muted)">–</span>'}</div>`;
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
    const arrow = r.move==null ? "" :
      r.move>0 ? `<span class="move up">▲${r.move}</span>` :
      r.move<0 ? `<span class="move down">▼${-r.move}</span>` :
      `<span class="move same">=</span>`;
    const sangBy = quienSanguijuelo(r.id);
    const recv = sangBy?`<span class="recv-sang" title="Sanguijueleado por: ${sangBy}">🩸</span>`:""; 
    const wOpenRow = windowOpenNow(); const hasMatchesRow = dayHasMatches(todayDayKey());
    const nit = usoNitro(r.id)?`<span class="recv-sang" title="Nitro activado">🔥✅</span>`:(!opts.inline||r.id!==APP.user?.id?"":(!hasMatchesRow||!wOpenRow?`<span class="btn-mini nitro" title="Ventana cerrada (6-12hs con partidos)" style="cursor:not-allowed;opacity:0.4;font-size:16px">🔥</span>`:`<button class="btn-mini nitro" title="Usar nitro" onclick="openNitro()" style="background:none;border:none;cursor:pointer;padding:0;font-size:16px">🔥</button>`));
    const penBadge = r.penalty>0 ? `<span title="Penalización: -${r.penalty}pts" style="color:#ef4444;font-size:11px;font-weight:700;margin-left:4px">⚡-${r.penalty}</span>` : "";
    out+=`<tr class="${r.id===APP.user.id?'me':''} zone-${displayZone(r)}">
      <td><span class="rank ${r.zone==='elite'?'r1':r.zone==='midfield'?'r2':'r3'}">${r.pos}</span>${arrow}</td>
      <td class="name">${esc(r.name)}${recv}${r.id===APP.user.id?' <span class="note">(vos)</span>':''}${penBadge}</td>
      <td>${r.main+r.extra}</td><td>${r.wasabi}</td><td class="pts">${r.total}</td>
      ${opts.inline?`<td>${actions(r)}</td>`:""}</tr>`;
  });
  const headLast = opts.inline?'<th>Acción</th>':'';
  const zonaRef = allZero ? "" : `<span class="zone-band elite"></span>La élite · <span class="zone-band midfield"></span>Midfield · <span class="zone-band pobreza"></span>Zona de pobreza &nbsp;·&nbsp;`;
  const glos=`<div class="note" style="margin-top:10px;font-size:11.5px;line-height:1.7;border-top:1px solid var(--line);padding-top:10px">
    <b>Referencias:</b> ${zonaRef}
    <span class="move up">▲</span> subió / <span class="move down">▼</span> bajó posiciones desde la fecha anterior &nbsp;·&nbsp;
    🩸 recibió sanguijuela (no puede recibir otra esa fecha) &nbsp;·&nbsp; 🔥 activar nitro &nbsp;·&nbsp; 🔥✅ nitro activado</div>`;
  return `<div style="overflow-x:auto;margin-top:10px"><table>
      <tr><th>#</th><th class="name">Jugador</th><th>Princ</th><th>Was</th><th>Total</th>${headLast}</tr>
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
  const day=todayDayKey();
  const phase=phaseOfDay(day);
  const dayLbl = new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date());
  const hasMatchesToday = dayHasMatches(day);
  const wOpen = windowOpenNow();
  let html=`<div class="card" style="margin-top:18px"><div class="sec-title">Comodines</div>
    <p class="note">Pedí tus sanguijuelas (3 por fase) y nitros (2 por fase). Se solicitan en la ventana de <b>6:00 a 12:00 (hora argentina)</b> de cualquier día con partidos, y valen para los partidos de ese día.</p>
    <div class="pill" style="margin-top:10px">📅 Hoy: ${dayLbl} ${hasMatchesToday?(wOpen?'· <b style="color:var(--ok)">Ventana abierta</b>':'· <span style="color:var(--bad)">Ventana cerrada (6-12)</span>'):'· Sin partidos'}</div></div>`;
  if(!isAdmin()){
    const qs=quotaLeft(uid,"sang"), qn=quotaLeft(uid,"nitro");
    const phaseLbl = phase ? ({grupos:"grupos",r32:"R32",r16:"octavos",qf:"cuartos",sf:"semis",tp:"finales",final:"finales"}[phase]||phase) : "—";
    const qKey = phase==="tp"||phase==="final" ? "finals" : (phase||"grupos");
    html+=`<div class="como sang"><div class="ic">🩸</div><div class="info"><b>Sanguijuela</b> — robá puntos<br><span class="note">Te quedan ${qs[qKey]||0} sanguijuelas en ${phaseLbl}</span></div><button class="btn sm primary" onclick="openSang()" ${(!hasMatchesToday||!wOpen)?'disabled':''}>Usar hoy</button></div>
    <div class="como nitro"><div class="ic">🔥</div><div class="info"><b>Nitro</b> — x3 tus puntos<br><span class="note">Te quedan ${qn[qKey]||0} nitros en ${phaseLbl}</span></div><button class="btn sm gold" onclick="openNitro()" ${(!hasMatchesToday||!wOpen)?'disabled':''}>Usar hoy</button></div>`;
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
  const day=todayDayKey(); const phase=phaseOfDay(day);
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
  try{ await requestComodin("sang",target); closeModal(); render(); toast("Sanguijuela activada 🩸","ok"); }
  catch(e){ toast(e.message,"err"); }
}
function openNitro(){
  const day=todayDayKey(); const phase=phaseOfDay(day);
  const phaseLbl = phase ? ({grupos:"Fase de Grupos",r32:"Ronda de 32",r16:"Octavos",qf:"Cuartos",sf:"Semifinales",tp:"3er puesto",final:"Final"}[phase]||phase) : "—";
  const dayLbl = new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'numeric',month:'long'}).format(new Date());
  modal(`<h3>🔥 Usar nitro</h3>
    <p class="note">Multiplica x3 tus puntos de Principal de <b>HOY (${dayLbl})</b>. No lo usan 1° ni 2°.</p>
    <div class="pill" style="margin-top:10px">📅 Día: ${dayLbl} · ${phaseLbl}</div>
    <div class="row" style="margin-top:18px"><button class="btn gold full" onclick="confirmNitro()">Activar nitro x3</button><button class="btn ghost full" onclick="closeModal()">Cancelar</button></div>`);
}
async function confirmNitro(){
  const err=validateNitro(APP.user.id); if(err) return toast(err,"err");
  try{ await requestComodin("nitro",null); closeModal(); render(); toast("Nitro activado 🔥","ok"); }
  catch(e){ toast(e.message,"err"); }
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
    <details class="fold" open><summary>⚖️ Reglas de interacción<span class="arr">›</span></summary><div class="body">${list(R.interaccion)}</div></details>`;
}

/* =====================================================================
   PESTAÑA · ADMIN (COMIPRO)
   ===================================================================== */
let ADM="resultados", ADM_PHASE="grupos";
function renderAdmin(v){
  if(!isAdmin()){ v.innerHTML=adminHint("🔒","Solo el COMIPRO."); return; }
  v.innerHTML=`<div class="card" style="margin-top:18px"><div class="sec-title">Panel del COMIPRO</div>
    <div class="seg" style="margin-top:10px" id="admSeg">
      ${[["resultados","⚽ Resultados"],["wasabi","🌶️ Result. Wasabi"],["tarjetas","🔎 Ver tarjetas"],["mails","📧 Mails"],["jugadores","👥 Jugadores"],["penalizaciones","⚡ Penalizaciones"],["export","📤 Exportar"]]
        .map(([k,l])=>`<button class="${ADM===k?'on':''}" data-a="${k}">${l}</button>`).join("")}
    </div></div><div id="admArea"></div>`;
  document.querySelectorAll("#admSeg button").forEach(b=>b.onclick=()=>{ADM=b.dataset.a;renderAdmin(v);});
  ({resultados:admResultados,wasabi:admWasabi,tarjetas:admTarjetas,mails:admMails,jugadores:admJugadores,penalizaciones:admPenalizaciones,export:admExport}[ADM])($("#admArea"));
}
function admPenalizaciones(area){
  const players = APP.profiles.filter(p=>!p.is_admin);
  let html = `<div class="card"><div class="sec-title">⚡ Penalizaciones</div>
    <p class="note" style="margin-bottom:14px">Descuentos manuales de puntos. Se restan del total general del jugador y son visibles para él.</p>
    <div class="grid2" style="gap:10px;margin-bottom:18px">
      <div><label class="field">Jugador</label>
        <select id="penPlayer">${players.map(p=>`<option value="${p.id}">${p.display_name||p.email}</option>`).join('')}</select>
      </div>
      <div><label class="field">Puntos a descontar</label>
        <input id="penPts" type="number" min="1" placeholder="ej: 5" style="width:100%">
      </div>
    </div>
    <div style="margin-bottom:14px"><label class="field">Motivo (obligatorio)</label>
      <input id="penReason" placeholder="ej: Penalización por error en carga" style="width:100%">
    </div>
    <button class="btn gold" onclick="doApplyPenalty()">⚡ Aplicar descuento</button>
    <div style="margin-top:22px;border-top:1px solid var(--line);padding-top:14px">
      <div class="sec-title" style="font-size:13px;margin-bottom:10px">Historial de penalizaciones</div>`;

  // listar todas las penalizaciones existentes
  let hayPenas = false;
  players.forEach(p=>{
    const pred = APP.preds?.find(pr=>pr.user_id===p.id);
    const pens = pred?.penalties||[];
    if(!pens.length) return;
    hayPenas = true;
    html+=`<div style="margin-bottom:10px"><b style="font-size:13px">${p.display_name||p.email}</b>`;
    pens.forEach((pen,i)=>{
      const fecha = new Date(pen.date).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
      html+=`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:12.5px">
        <span style="color:#ef4444;font-weight:700">-${pen.pts}pts</span>
        <span style="flex:1;color:var(--muted)">${esc(pen.reason)}</span>
        <span style="color:var(--muted);font-size:11px">${fecha}</span>
      </div>`;
    });
    html+=`</div>`;
  });
  if(!hayPenas) html+=`<p class="note">No hay penalizaciones aplicadas todavía.</p>`;
  html+=`</div></div>`;
  area.innerHTML=html;
}
async function doApplyPenalty(){
  const uid=$("#penPlayer").value;
  const pts=+($("#penPts").value||0);
  const reason=$("#penReason").value.trim();
  if(!pts||pts<=0){ toast("Ingresá los puntos a descontar","err"); return; }
  if(!reason){ toast("El motivo es obligatorio","err"); return; }
  try{
    await adminApplyPenalty(uid,pts,reason);
    toast("Penalización aplicada","ok");
    admPenalizaciones($("#admArea"));
  }catch(e){ toast(e.message,"err"); }
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
      admResultados(document.getElementById('admArea'));
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
    <div><label class="field">🥉 3ro</label>${tsel('third')}</div><div><label class="field">👟 Bota oro</label>${isel('boot_gold')}</div>
    <div><label class="field">👟 Bota plata</label>${isel('boot_silver')}</div><div><label class="field">👟 Bota bronce</label>${isel('boot_bronze')}</div>
    <div><label class="field">⚽ Balón oro</label>${isel('ball_gold')}</div><div><label class="field">⚽ Balón plata</label>${isel('ball_silver')}</div>
    <div><label class="field">⚽ Balón bronce</label>${isel('ball_bronze')}</div>`;
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
  APP.wasabiQs.forEach((q,i)=>{
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
    html+=`<div class="wq"><div class="qh"><div class="qn">${i+1}</div><div class="qt">${esc(q.t)}</div><div><span class="badge w">${q.pts}</span></div></div>${input}${q.ac?`<p class="note" style="margin-top:8px;font-size:12.5px;font-style:italic">${esc(q.ac)}</p>`:""}${acertaronW}</div>`;
  });
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
  const stateTag = (locked) => locked
    ? `<span style="color:var(--gold);font-weight:600">🔒 Cerrada</span>`
    : `<span style="color:var(--aqua);font-weight:600">✅ Abierta</span>`;
  const unlockBtn = (stage, label) => `<button class="btn sm" style="margin-left:10px" onclick="admUnlockStage('${ADM_VIEWUID}','${stage}')">🔓 Habilitar ${label}</button>`;
  const lockBtn = (stage, label) => `<button class="btn sm" style="margin-left:10px;background:var(--gold);color:#000" onclick="admLockStage('${ADM_VIEWUID}','${stage}')">🔒 Cerrar ${label}</button>`;
  let html=`<div class="card"><div class="sec-title">Ver / corregir tarjetas</div>
    <p class="note">Elegí un jugador. Podés corregir respuestas; <b>cada cambio queda registrado</b> en la bitácora (abajo) y en el Excel.</p>
    <label class="field" style="margin-top:10px">Jugador</label>${sel}
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;gap:8px">🌶️ Wasabi: ${stateTag(wasabiLocked)}${wasabiLocked?unlockBtn('wasabi','Wasabi'):lockBtn('wasabi','Wasabi')}</div>
      <div style="display:flex;align-items:center;gap:8px">⚽ Grupos: ${stateTag(gruposLocked)}${gruposLocked?unlockBtn('grupos','Grupos'):lockBtn('grupos','Grupos')}</div>
    </div>
  </div>`;
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
  html+=`<div class="card flat"><div class="sec-title">⚽ Principal</div>
    <p class="note">${mainCount}/${FIXTURE.length} partidos cargados${sentGroups?' · <b style="color:var(--aqua)">✅ Fase de grupos enviada</b>':' · <span style="color:#f59e0b">⏳ Aún no enviada</span>'}.</p>
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
    const log=await adminLoadEditLog();
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
  // Comodines
  const com=[["Tipo","De","A","Fase","Jornada"]];
  APP.comodines.forEach(c=>com.push([c.type==="sang"?"Sanguijuela":"Nitro",
    APP.profiles.find(x=>x.id===c.by_user)?.display_name||"?",
    c.target_user?(APP.profiles.find(x=>x.id===c.target_user)?.display_name||"?"):"-",c.phase,c.jor||""]));
  // Bitácora
  const bit=[["Fecha","Jugador","Tarjeta","Campo","Valor anterior","Valor nuevo"]];
  (log||[]).forEach(e=>bit.push([fmtTime(e.created_at),APP.profiles.find(x=>x.id===e.target_user)?.display_name||"?",
    e.card,e.field,e.old_value||"",e.new_value||""]));

  const xml=`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheet("Resumen",resumen)}
${sheet("Wasabi",wasabi)}
${sheet("Principal",principal)}
${sheet("Comodines",com)}
${sheet("Bitacora",bit)}
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
