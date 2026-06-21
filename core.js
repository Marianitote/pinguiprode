/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 - NÚCLEO (Supabase + motor de puntajes)
   ===================================================================== */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* estado en memoria */
const APP = {
  user:null, profile:null,
  myPred:null,
  profiles:[], results:{main:{},extra:{},wasabi:{}},
  comodines:[], wasabiQs:[...SEED_WASABI],
};

/* ---------- AUTH ---------- */
async function signUp(email, pass){
  const {data,error}=await sb.auth.signUp({email,password:pass});
  if(error) throw error; return data;
}
async function signIn(email, pass){
  const {data,error}=await sb.auth.signInWithPassword({email,password:pass});
  if(error) throw error; return data;
}
async function signOut(){ await sb.auth.signOut(); location.reload(); }

async function loadSession(){
  // getSession() lee del almacenamiento local (instantáneo), a diferencia de
  // getUser() que valida el token contra el servidor (una ronda de red extra).
  const {data}=await sb.auth.getSession();
  APP.user=data?.session?.user||null;
  if(APP.user){
    const {data:prof}=await sb.from('profiles').select('*').eq('id',APP.user.id).maybeSingle();
    APP.profile=prof||null;
  }
}

/* crear perfil (después de validar el mail). El trigger valida que el mail esté habilitado */
async function createProfile(displayName){
  const {error}=await sb.from('profiles').insert({
    id:APP.user.id, email:APP.user.email, display_name:displayName
  });
  if(error) throw error;
  await loadSession();
}

/* ---------- DATOS ---------- */
async function loadAll(){
  // cargar todo en paralelo para mayor velocidad
  const [profsRes, mpRes, rsRes, cmRes, allPRes] = await Promise.all([
    sb.from('profiles').select('*'),
    sb.from('predictions').select('*').eq('user_id',APP.user.id).maybeSingle(),
    sb.from('results').select('*').eq('id',1).maybeSingle(),
    sb.from('comodines').select('*').order('created_at'),
    sb.from('predictions').select('user_id,main,wasabi,extra,bracket,penalties'),
  ]);
  APP.profiles=profsRes.data||[];
  APP.myPred=mpRes.data||null;
  if(rsRes.data) APP.results=rsRes.data;
  APP.comodines=cmRes.data||[];
  (allPRes.data||[]).forEach(p=>{ _predCache[p.user_id]=p; });
  // poblar APP.allPreds para los paneles de ui.js (comodines, "quién acertó", etc.)
  // el admin lo sobrescribe luego con datos completos vía adminLoadAllPreds()
  if(!APP.profile?.is_admin){
    APP.allPreds={};
    (allPRes.data||[]).forEach(p=>{ APP.allPreds[p.user_id]=p; });
  }
  invalidateStandings();
  const withTimeout = (p, label) => Promise.race([
    p.catch(e => console.warn(label, e?.message||e)),
    new Promise(res => setTimeout(() => { console.warn(label, 'timeout'); res(); }, 12000))
  ]);

  if(APP.profile?.is_admin){
    // admin: syncSnapshots completo + pagos + todas las preds en paralelo
    await Promise.all([
      withTimeout(syncSnapshots(), 'syncSnapshots'),
      withTimeout(loadPayments(), 'loadPayments'),
      withTimeout(adminLoadAllPreds(), 'adminLoadAllPreds'),
    ]);
  } else {
    // jugador: solo el snapshot más reciente (1 fila, sin inserts)
    try{
      const {data:snap} = await sb.from('standings_snapshots')
        .select('date_key,positions')
        .order('date_key',{ascending:false})
        .limit(1)
        .maybeSingle();
      APP.lastSnapshot = snap?.positions||null;
    }catch(e){ APP.lastSnapshot=null; }
  }
}

async function ensureMyPredRow(){
  if(APP.myPred) return APP.myPred;
  const {data,error}=await sb.from('predictions').upsert({user_id:APP.user.id},{onConflict:'user_id',ignoreDuplicates:true}).select().maybeSingle();
  if(error) throw error; APP.myPred=data; return data;
}
async function saveMyPred(patch){
  invalidateStandings();
  await ensureMyPredRow();
  const {data,error}=await sb.from('predictions').update(patch).eq('user_id',APP.user.id).select().maybeSingle();
  if(error) throw error; APP.myPred=data; return data;
}
/* Enviar una tarjeta puntual (wasabi o main). Marca timestamp en sent_at;
   si ambas están enviadas, además marca locked=true. */
async function sendCard(cardKey){
  const current = APP.myPred?.sent_at || {};
  if(current[cardKey]) throw new Error("Esta tarjeta ya fue enviada.");
  const sent_at = {...current, [cardKey]: new Date().toISOString()};
  const bothSent = !!sent_at.wasabi && !!sent_at.main;
  const patch = bothSent ? {sent_at, locked:true} : {sent_at};
  const {data,error}=await sb.from('predictions').update(patch).eq('user_id',APP.user.id).select().maybeSingle();
  if(error) throw error; APP.myPred=data; return data;
}
function cardSent(cardKey){
  if(!APP.myPred) return false;
  const sa = APP.myPred.sent_at||{};
  return !!sa[cardKey] || !!APP.myPred.locked;
}

/* ---------- ADMIN ---------- */
async function adminApplyPenalty(uid, pts, reason){
  const pred = await sb.from('predictions').select('penalties').eq('user_id',uid).maybeSingle();
  const pens = pred.data?.penalties||[];
  pens.push({pts:+pts, reason, date:new Date().toISOString(), by:'comipro'});
  const {error} = await sb.from('predictions').update({penalties:pens}).eq('user_id',uid);
  if(error) throw error;
  // actualizar cache local
  if(APP.preds) { const p=APP.preds.find(p=>p.user_id===uid); if(p) p.penalties=pens; }
  await loadApp();
}
async function adminSaveResults(patch){
  clearApproxCache(); invalidateStandings();
  const {error}=await sb.from('results').update({...patch,updated_at:new Date().toISOString()}).eq('id',1);
  if(error) throw error; await loadAll();
  // si cambió wasabi, guardar snapshot del día para historial por fecha
  if(patch.wasabi){
    const dateKey = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date());
    const wasabiSnap = {...(APP.results.wasabi||{}), ...patch.wasabi};
    sb.from('wasabi_result_snapshots')
      .upsert({date_key:dateKey, results_wasabi:wasabiSnap},{onConflict:'date_key'})
      .then(()=>{}).catch(e=>console.warn('wasabi snapshot:', e.message));
  }
}

// Cargar todos los snapshots de resultados Wasabi por día
async function loadWasabiSnapshots(){
  const {data} = await sb.from('wasabi_result_snapshots').select('date_key,results_wasabi').order('date_key');
  const map = {};
  (data||[]).forEach(s=>{ map[s.date_key]=s.results_wasabi; });
  return map;
}

// Calcular puntos Wasabi de un jugador usando los resultados de un día específico
function wasabiTotalAtDay(uid, wasabiResultsAtDay){
  const w=(predFor(uid).wasabi)||{}; let pts=0;
  const res = wasabiResultsAtDay||{};
  const auto = autoWasabiAnswers(); // aproximación: usamos el estado actual
  APP.wasabiQs.forEach(q=>{
    if(q.type==="bonus"){ if(res["bonus_"+q.id]===uid) pts+=q.pts; return; }
    if(["w5","w6","w7","w8"].includes(q.id)){
      if(!APP.results.auto_wasabi_enabled) return;
      const correctNames = auto[q.id]||[];
      if(!correctNames.length) return;
      const ans = w[q.id];
      if(ans && correctNames.some(n=>norm(n)===norm(ans))) pts+=q.pts;
      return;
    }
    if(q.type==="approx"){
      const resVal=parseFloat(res[q.id]);
      if(isNaN(resVal)) return;
      // ganadores: quien más se acercó
      const entries=APP.profiles.filter(p=>!p.is_admin).map(p=>{
        const ww=(predFor(p.id).wasabi)||{};
        return {uid:p.id, val:parseFloat(ww[q.id])};
      }).filter(e=>!isNaN(e.val));
      if(!entries.length) return;
      const minDist=Math.min(...entries.map(e=>Math.abs(e.val-resVal)));
      if(Math.abs(parseFloat(w[q.id])-resVal)===minDist) pts+=q.pts;
      return;
    }
    if(res[q.id]==null||res[q.id]==="") return;
    if(matchesResult(w[q.id],res[q.id])) pts+=q.pts;
  });
  return pts;
}
async function adminAddEmail(email){
  const {error}=await sb.from('allowed_emails').insert({email:email.toLowerCase().trim()});
  if(error) throw error;
}
async function adminListEmails(){
  const {data}=await sb.from('allowed_emails').select('*').order('email'); return data||[];
}
async function adminSetPaid(uid,paid){
  // upsert en la tabla payments (privada, solo admin)
  await sb.from('payments').upsert({user_id:uid,paid,updated_at:new Date().toISOString()});
  await loadPayments();
}
async function loadPayments(){
  if(!APP.profile?.is_admin){ APP.payments={}; return; }
  const {data}=await sb.from('payments').select('*');
  const map={}; (data||[]).forEach(p=>map[p.user_id]=p.paid);
  APP.payments=map;
}
function hasPaid(uid){ return !!(APP.payments&&APP.payments[uid]); }

/* ---------- ADMIN: ver y editar tarjetas de jugadores (con bitácora) ---------- */
// carga TODAS las predicciones (solo admin tiene permiso por RLS)
async function adminLoadAllPreds(){
  const {data}=await sb.from('predictions').select('*');
  const map={}; (data||[]).forEach(p=>map[p.user_id]=p);
  APP.allPreds=map;
  // llenar el cache para que standings calcule puntos de todos
  Object.keys(map).forEach(uid=>{ _predCache[uid]=map[uid]; });
  return map;
}
// editar un campo de la tarjeta de un jugador y dejar registro en edit_log
async function adminEditPred(targetUid, card, field, newValue){
  const pred=APP.allPreds?.[targetUid]; if(!pred) throw new Error("No se encontró la tarjeta del jugador.");
  const obj={...(pred[card]||{})};
  const oldValue = card==="main" ? JSON.stringify(obj[field]||"") : (obj[field]??"");
  // para 'main' el value es {h,a,pen}; para el resto es string
  obj[field]=newValue;
  await sb.from('predictions').update({[card]:obj}).eq('user_id',targetUid);
  await sb.from('edit_log').insert({
    target_user:targetUid, card, field:String(field),
    old_value:String(oldValue), new_value:typeof newValue==="object"?JSON.stringify(newValue):String(newValue),
    edited_by:APP.user.id
  });
  await adminLoadAllPreds();
}
async function adminLoadEditLog(){
  const {data}=await sb.from('edit_log').select('*').order('created_at',{ascending:false});
  return data||[];
}

/* ---------- COMODINES ---------- */
async function requestComodin(type, targetUser){
  const day = todayFifaDate();
  const phase = phaseOfDay(day);
  if(!phase) throw new Error("No hay partidos hoy.");
  const {error}=await sb.from('comodines').insert({
    type, by_user:APP.user.id, target_user:targetUser||null, phase, jor:null, day, match_kickoff:null
  });
  if(error) throw error; await loadAll();
}

/* =====================================================================
   MOTOR DE PUNTAJES (reglamento 2026)
   =====================================================================
   Para GRUPOS: como antes (exact / result / gd) con FIXTURE+marcadores.
   Para ELIMINATORIAS: usa el BRACKET del jugador (cuadro autocompletado).
     Cada cruce del jugador se compara contra el cruce REAL del Mundial:
       - Si los equipos coinciden 100%: puntos completos (exact/result/advance).
       - Si solo coincide 1 equipo: MITAD de los puntos posibles (opción 3).
       - Si no coincide ninguno: 0.
   ===================================================================== */
function sign(h,a){ if(h==null||a==null||h===""||a==="")return null; h=+h;a=+a; return h>a?"1":h<a?"2":"X"; }

function matchPointsGrupos(pred,res){
  if(!pred||!res) return 0;
  if(res.h==null||res.h===""||res.a==null||res.a==="") return 0;
  const ph=+pred.h, pa=+pred.a, rh=+res.h, ra=+res.a;
  const ps=sign(ph,pa), rs=sign(rh,ra);
  const dif=ph-pa, rdif=rh-ra;
  // Exacto: marcador idéntico → +5
  if(ph===rh && pa===ra) return PTS.grupos.exact;
  // Resultado correcto (+3), con bonus +1 si además la diferencia es igual y no es empate
  if(ps && ps===rs){
    const bonus = (dif===rdif && rdif!==0) ? PTS.grupos.gd : 0;
    return PTS.grupos.result + bonus;
  }
  // Sin acertar ganador: 0 (aunque la diferencia coincida)
  return 0;
}

/* Evalúa un cruce del bracket del jugador contra el cruce real.
   pCruce: {home, away, h, a, pen} → bracket del jugador
   rCruce: {home, away, h, a, pen} → cruce REAL del Mundial (cargado por COMIPRO)
   Devuelve los puntos según matches de equipos:
     - 2 equipos coinciden → puntos completos
     - 1 equipo coincide  → mitad de los puntos (redondeado hacia arriba)
     - 0 coinciden        → 0
*/
function matchPointsKO(pCruce, rCruce){
  if(!pCruce||!rCruce) return 0;
  if(pCruce.h==null||pCruce.h===""||rCruce.h==null||rCruce.h==="") return 0;
  const matches = teamMatches(pCruce, rCruce);
  if(matches===0) return 0;
  // calcular puntos completos del marcador
  let full=0;
  const ps=sign(pCruce.h,pCruce.a), rs=sign(rCruce.h,rCruce.a);
  const exact=(+pCruce.h===+rCruce.h&&+pCruce.a===+rCruce.a);
  if(exact) full+=PTS.ko.exact;
  else if(ps&&ps===rs) full+=PTS.ko.result;
  // bonus por acertar quién avanza
  let pAdv=ps==="1"?pCruce.home:ps==="2"?pCruce.away:(pCruce.pen==="1"?pCruce.home:pCruce.pen==="0"?pCruce.away:null);
  let rAdv=rs==="1"?rCruce.home:rs==="2"?rCruce.away:(rCruce.pen==="1"?rCruce.home:rCruce.pen==="0"?rCruce.away:null);
  if(pAdv&&rAdv&&pAdv===rAdv) full+=PTS.ko.advance;
  // aplicar escala según equipos acertados (opción 3)
  if(matches===2) return full;
  return Math.ceil(full/2); // 1 equipo: mitad
}
function teamMatches(pCruce, rCruce){
  // ¿cuántos equipos del cruce del jugador coinciden con los del cruce real? (orden no importa)
  const ps = new Set([pCruce.home, pCruce.away]);
  let m=0;
  if(ps.has(rCruce.home)) m++;
  if(ps.has(rCruce.away)) m++;
  return m;
}

/* puntos de la Principal por fecha (sin extras), para un set de predicciones.
   phase: "grupos" + jor 1/2/3 → grupos; "r32"/"r16"/etc → bracket. */
function mainPointsByDate(pred, phase, jor){
  if(!pred) return 0;
  let pts=0;
  if(phase==="grupos"){
    const m=pred.main||{}, res=APP.results.main||{};
    FIXTURE.forEach(mt=>{
      if(mt.phase==="grupos"&&mt.jor===jor) pts+=matchPointsGrupos(m[mt.id],res[mt.id]);
    });
  } else {
    // eliminatoria: comparar el bracket del jugador contra el real
    const pBracket = pred.bracket||{};
    const rBracket = APP.results.bracket||{};
    let pArr, rArr;
    if(phase==="tp" || phase==="final"){
      const pM = phase==="tp" ? pBracket.tp : pBracket.final;
      const rM = phase==="tp" ? rBracket.tp : rBracket.final;
      if(pM && rM) pts += matchPointsKO(pM, rM);
    } else {
      pArr = pBracket[phase]||[]; rArr = rBracket[phase]||[];
      // para cada cruce del jugador, buscar EL cruce real que lo mejor matchea (más equipos en común)
      pArr.forEach(pC=>{
        let best=0;
        rArr.forEach(rC=>{ const p = matchPointsKO(pC, rC); if(p>best) best=p; });
        pts+=best;
      });
    }
  }
  return pts;
}

const ALL_DATES=[{phase:"grupos",jor:1},{phase:"grupos",jor:2},{phase:"grupos",jor:3},
  {phase:"r32"},{phase:"r16"},{phase:"qf"},{phase:"sf"},{phase:"tp"},{phase:"final"}];
function sameDate(c,d){ return c.phase==="grupos"&&d.phase==="grupos" ? c.jor===d.jor : c.phase===d.phase; }

/* puntos extra DEL CUADRO autocompletado (Punto 30):
   - posiciones exactas de cada grupo (1°-4°): +1 cada una
   - equipos clasificados a cada ronda (R32, R16, QF, SF, Final/3°): puntos según ronda
*/
function cuadroExtraPoints(uid){
  const pred=predFor(uid);
  const pBracket = pred.bracket||{};
  const rBracket = APP.results.bracket||{};
  const PB = PTS.cuadro;
  let pts=0;
  // 1) Posiciones exactas de grupos (de pBracket.standings vs rBracket.standings)
  if(pBracket.standings && rBracket.standings){
    GROUPS.forEach(g=>{
      const pG=pBracket.standings[g]||[], rG=rBracket.standings[g]||[];
      for(let i=0;i<4;i++){
        if(pG[i] && rG[i] && pG[i].team===rG[i].team) pts+=PB.pos_grupo;
      }
    });
  }
  // 2) Equipos clasificados a cada ronda — un equipo "está en R32" si aparece en cualquiera de sus 16 cruces.
  // Comparamos los equipos del bracket del jugador contra los del bracket real.
  const stagePts = {r32:PB.clas_r32, r16:PB.clas_r16, qf:PB.clas_qf, sf:PB.clas_sf};
  ["r32","r16","qf","sf"].forEach(stage=>{
    const pTeams = teamsInStage(pBracket[stage]);
    const rTeams = teamsInStage(rBracket[stage]);
    pTeams.forEach(t=>{ if(rTeams.has(t)) pts+=stagePts[stage]; });
  });
  // Final (4 equipos: 2 del 3er puesto + 2 de la final)
  const pFinalsTeams = new Set();
  if(pBracket.tp){ pFinalsTeams.add(pBracket.tp.home); pFinalsTeams.add(pBracket.tp.away); }
  if(pBracket.final){ pFinalsTeams.add(pBracket.final.home); pFinalsTeams.add(pBracket.final.away); }
  const rFinalsTeams = new Set();
  if(rBracket.tp){ rFinalsTeams.add(rBracket.tp.home); rFinalsTeams.add(rBracket.tp.away); }
  if(rBracket.final){ rFinalsTeams.add(rBracket.final.home); rFinalsTeams.add(rBracket.final.away); }
  pFinalsTeams.forEach(t=>{ if(rFinalsTeams.has(t)) pts+=PB.clas_finals; });
  return pts;
}
function teamsInStage(matches){
  const s=new Set();
  (matches||[]).forEach(m=>{ if(m.home) s.add(m.home); if(m.away) s.add(m.away); });
  return s;
}

/* puntos de la Principal de UN DÍA CALENDARIO específico, para un set de predicciones.
   Suma los puntos de los partidos cuyo kickoff cae en ese día (hora AR).
   Para grupos usa los marcadores; para eliminatorias usa el bracket. */
function mainPointsByDay(pred, day){
  if(!pred||!day) return 0;
  let pts=0;
  const matches = FIXTURE.filter(m=>fifaDateOf(m)===day);
  matches.forEach(mt=>{
    if(mt.phase==="grupos"){
      const m=pred.main||{}, res=APP.results.main||{};
      pts+=matchPointsGrupos(m[mt.id],res[mt.id]);
    } else {
      // eliminatoria: se evalúa cuando corresponde (al cierre del día con bracket cargado)
      // por ahora no agregamos nada acá; la evaluación elim ya está en mainPointsByDate por fase
    }
  });
  // para eliminatorias, sumamos los puntos de la fase del día (proporcional al # de cruces de ese día)
  const elimMatches = matches.filter(m=>m.phase!=="grupos");
  if(elimMatches.length){
    const phase = elimMatches[0].phase;
    // por simplicidad: si hoy hay partidos elim de "phase", sumamos los puntos de TODOS los cruces de "phase"
    // que coincidan con el día (1 cruce por día típicamente). Buscamos en el bracket del jugador
    // los cruces cuya posición en el orden del array coincida con la posición del FIXTURE elimMatch.
    const pBracket = pred.bracket||{};
    const rBracket = APP.results.bracket||{};
    elimMatches.forEach((em,idx)=>{
      // matchear por índice dentro del FIXTURE elim de esa fase
      const fxAll = FIXTURE.filter(m=>m.phase===phase);
      const myIdx = fxAll.findIndex(m=>m.id===em.id);
      if(phase==="tp" && pBracket.tp && rBracket.tp) pts += matchPointsKO(pBracket.tp, rBracket.tp);
      else if(phase==="final" && pBracket.final && rBracket.final) pts += matchPointsKO(pBracket.final, rBracket.final);
      else {
        const pArr = pBracket[phase]||[], rArr = rBracket[phase]||[];
        // como las cruces se evalúan por mejor match (ya implementado en mainPointsByDate),
        // acá hacemos lo mismo para el cruce concreto del día:
        if(pArr[myIdx]){
          let best=0;
          rArr.forEach(rC=>{ const p=matchPointsKO(pArr[myIdx],rC); if(p>best) best=p; });
          pts+=best;
        }
      }
    });
  }
  return pts;
}

/* total Principal con nitros + sanguijuelas + extras de cuadro para un usuario.
   En el modelo diario: cada nitro/sang opera sobre los puntos de SU DÍA. */
function mainTotal(uid){
  const pred=predFor(uid); let total=0;
  // mainPointsByDate cubre todas las fases; sumamos base + ajustes diarios
  ALL_DATES.forEach(d=>{
    total+=mainPointsByDate(pred,d.phase,d.jor);
  });
  // nitros: por cada nitro del usuario, multiplicamos x2 (no x3, porque x3 = base+2x extra)
  // → en realidad la base ya está sumada arriba, así que sumamos 2x los puntos del día del nitro
  APP.comodines.filter(c=>c.type==="nitro"&&c.by_user===uid).forEach(c=>{
    const dayPts = mainPointsByDay(pred, c.day);
    total += dayPts*2; // base ya está sumada, agregamos 2x para llegar a 3x total
  });
  total+=sangDelta(uid);
  total+=cuadroExtraPoints(uid);
  return total;
}
function sangDelta(uid){
  let delta=0;
  APP.comodines.filter(c=>c.type==="sang").forEach(c=>{
    const day = c.day;
    if(!day) return;
    const pBy=mainPointsByDay(predFor(c.by_user), day);
    const pTg=mainPointsByDay(predFor(c.target_user), day);
    // EMPATE: no pasa nada (la sang se neutraliza)
    if(c.by_user===uid){
      if(pBy>pTg) delta+=pTg;
      else if(pBy<pTg) delta-=pBy*0.5; // pierde 50% de sus propios puntos
    }
    if(c.target_user===uid){
      if(pBy>pTg) delta-=pTg;
    }
  });
  return delta;
}
function extraTotal(uid){
  const ex=(predFor(uid).extra)||{}, res=APP.results.extra||{}; let pts=0;
  Object.keys(PTS.extra).forEach(k=>{ if(res[k]&&ex[k]&&norm(ex[k])===norm(res[k])) pts+=PTS.extra[k]; });
  return pts;
}
/* Calcula los nombres "correctos" de quién sale 1°/2°/anteúltimo/último,
   determinados con la tabla SIN los puntos de las preguntas 5-8.
   Devuelve un map {w5: [nombres correctos], w6: [...], w7: [...], w8: [...]}.
   Los empates en una posición producen MÚLTIPLES respuestas correctas; si hay
   2 empatados en 1°, NO hay 2° (la siguiente posición es 3°). */
let _autoWasabiCache=null;
function autoWasabiAnswers(){
  if(_autoWasabiCache) return _autoWasabiCache;
  // standings sin contar w5-w8 (computamos un "total parcial")
  function partialTotal(uid){
    const pred=predFor(uid);
    let total=mainTotal(uid)+extraTotal(uid);
    // wasabi sin las auto-preguntas
    const w=pred.wasabi||{}, res=APP.results.wasabi||{};
    APP.wasabiQs.forEach(q=>{
      if(["w5","w6","w7","w8"].includes(q.id)) return; // se excluyen
      if(q.type==="bonus"){ if(res["bonus_"+q.id]===uid) total+=q.pts; return; }
      if(res[q.id]==null||res[q.id]==="") return;
      if(matchesResult(w[q.id],res[q.id])) total+=q.pts;
    });
    return total;
  }
  // tabla parcial ordenada
  const rows = APP.profiles.filter(p=>{
    if(p.is_admin) return false;
    const e=(p.email||"").toLowerCase(), n=(p.display_name||"").toLowerCase();
    if(e.includes("nahuelito")||n.includes("nahuelito")) return false;
    if(e.includes("bot")&&e.includes("pinguiprode")) return false;
    return true;
  }).map(p=>({name:p.display_name, total:partialTotal(p.id)}));
  rows.sort((a,b)=> b.total-a.total);
  if(!rows.length){ _autoWasabiCache={}; return {}; }
  // Si el máximo puntaje es 0, no hay posiciones reales todavía
  if(rows[0].total === 0){ _autoWasabiCache={}; return {}; }
  // agrupar por puntaje para detectar empates
  const groups=[]; let cur=null;
  rows.forEach(r=>{
    if(!cur || r.total!==cur.total){ cur={total:r.total, names:[r.name]}; groups.push(cur); }
    else cur.names.push(r.name);
  });
  // grupos[0] = primer puesto (puede tener 1+ nombres)
  // grupos[1] = segundo (a menos que el primer puesto sea múltiple → no hay 2°)
  // grupos[grupos.length-1] = último; -2 = anteúltimo
  const ans = {w5:[], w6:[], w7:[], w8:[]};
  // 1° puesto
  ans.w5 = groups[0]?.names||[];
  // 2° puesto: solo si el 1° fue único (1 solo nombre); si no, no hay 2°
  if(groups[0]?.names.length===1 && groups[1]){ ans.w6 = groups[1].names; }
  // Último (último grupo)
  ans.w7 = groups[groups.length-1]?.names||[];
  // Anteúltimo: solo si el último fue único
  if(groups[groups.length-1]?.names.length===1 && groups.length>=2 && groups[groups.length-2]){
    ans.w8 = groups[groups.length-2].names;
  }
  _autoWasabiCache = ans;
  return ans;
}

function wasabiApproxWinners(qid){
  // devuelve map uid->pts para una pregunta de aproximación
  const res=APP.results.wasabi||{};
  const resVal = parseFloat(res[qid]);
  if(isNaN(resVal)) return {};
  const q = APP.wasabiQs.find(q=>q.id===qid);
  if(!q) return {};
  // recolectar respuestas de todos los jugadores
  const entries = APP.profiles
    .filter(p=>!p.is_admin)
    .map(p=>{ const w=(predFor(p.id).wasabi)||{}; const v=parseFloat(w[qid]); return {uid:p.id, val:v}; })
    .filter(e=>!isNaN(e.val));
  if(!entries.length) return {};
  const minDist = Math.min(...entries.map(e=>Math.abs(e.val-resVal)));
  const winners = entries.filter(e=>Math.abs(e.val-resVal)===minDist);
  const pts = q.pts; // todos los empatados suman puntos completos
  const map={};
  winners.forEach(e=>{ map[e.uid]=pts; });
  return map;
}
// cache de aproximación (se recalcula si cambia results)
let _approxCache={};
function approxPts(uid, qid){
  if(!_approxCache[qid]) _approxCache[qid]=wasabiApproxWinners(qid);
  return _approxCache[qid][uid]||0;
}
function clearApproxCache(){ _approxCache={}; }

function wasabiTotal(uid){
  const w=(predFor(uid).wasabi)||{}, res=APP.results.wasabi||{}; let pts=0;
  // respuestas automáticas de w5-w8 (calculadas con tabla parcial)
  const auto = autoWasabiAnswers();
  APP.wasabiQs.forEach(q=>{
    if(q.type==="bonus"){ if(res["bonus_"+q.id]===uid) pts+=q.pts; return; }
    // preguntas auto (5-8): solo computan si el admin las habilitó
    if(["w5","w6","w7","w8"].includes(q.id)){
      if(!APP.results.auto_wasabi_enabled) return;
      const correctNames = auto[q.id]||[];
      if(!correctNames.length) return;
      const ans = w[q.id];
      if(ans && correctNames.some(n=>norm(n)===norm(ans))) pts+=q.pts;
      return;
    }
    // w1: cantidad de jugadores que acertaron el resultado exacto del partido inaugural (auto)
    if(q.id==="w1"){
      const resMain=APP.results.main||{};
      const r1=resMain["1"];
      if(!r1||r1.h==null||r1.h===""||r1.a==null||r1.a==="") return;
      const exactCount = APP.profiles.filter(p=>!p.is_admin).filter(p=>{
        const m=(predFor(p.id).main)||{};
        const pred=m["1"];
        return pred && +pred.h===+r1.h && +pred.a===+r1.a;
      }).length;
      const playerAns = parseFloat(w["w1"]);
      if(isNaN(playerAns)) return;
      if(playerAns===exactCount) pts+=q.pts;
      return;
    }
    // preguntas de aproximación (minutos)
    if(q.type==="approx"){
      if(res[q.id]==null||res[q.id]==="") return;
      pts+=approxPts(uid, q.id);
      return;
    }
    if(res[q.id]==null||res[q.id]==="") return;
    if(matchesResult(w[q.id],res[q.id])) pts+=q.pts;
  });
  return pts;
}
function penaltyTotal(uid){
  const pred=predFor(uid);
  const pens=pred.penalties||[];
  return pens.reduce((s,p)=>s+(+p.pts||0),0);
}
function grandTotal(uid){ return mainTotal(uid)+extraTotal(uid)+wasabiTotal(uid)-penaltyTotal(uid); }
function norm(s){ return String(s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); }
function matchesResult(playerAns, resultVal){
  if(playerAns==null||playerAns==="") return false;
  const pNorm = norm(playerAns);
  if(String(resultVal).includes(",")){
    return String(resultVal).split(",").map(v=>norm(v.trim())).some(v=>v===pNorm);
  }
  return pNorm===norm(resultVal);
}

/* devuelve las predicciones de un uid (admin tiene todas; jugador solo la suya) */
const _predCache={};
function predFor(uid){
  if(uid===APP.user?.id && APP.myPred) return APP.myPred;
  return _predCache[uid]||{main:{},extra:{},wasabi:{}};
}

/* tabla de posiciones (solo JUGADORES, no admins) — con posiciones compartidas */
let _standingsCache=null;
function invalidateStandings(){ _standingsCache=null; _autoWasabiCache=null; }
function standings(){
  if(_standingsCache) return _standingsCache;
  const rows=APP.profiles.filter(p=>{
    if(p.is_admin) return false;
    const e=(p.email||"").toLowerCase(), n=(p.display_name||"").toLowerCase();
    if(e.includes("nahuelito")||n.includes("nahuelito")) return false;
    if(e.includes("bot")&&e.includes("pinguiprode")) return false;
    return true;
  }).map(p=>({
    id:p.id, name:p.display_name, paid:hasPaid(p.id),
    main:mainTotal(p.id), extra:extraTotal(p.id),
    wasabi:wasabiTotal(p.id), penalty:penaltyTotal(p.id), total:grandTotal(p.id)
  }));
  rows.sort((a,b)=>b.total-a.total);
  let pos=0,last=null,seen=0;
  rows.forEach(r=>{seen++; if(r.total!==last){pos=seen;last=r.total;} r.pos=pos;});
  // zona por tercios: elite / midfield / pobreza (por posición, no índice — maneja empates)
  const n=rows.length, tercio=Math.ceil(n/3);
  // pos del último jugador de cada zona
  const eliteMaxPos = rows[tercio-1]?.pos;
  const midfieldMaxPos = rows[Math.min(tercio*2-1, n-1)]?.pos;
  rows.forEach(r=>{ r.zone = r.pos<=eliteMaxPos?"elite" : r.pos<=midfieldMaxPos?"midfield" : "pobreza"; });
  // flechas: comparar contra el último snapshot guardado
  const prev=APP.lastSnapshot||null;
  rows.forEach(r=>{
    if(prev && prev[r.id]!=null){ r.move = prev[r.id]-r.pos; } // +sube, -baja, 0 igual
    else r.move = null; // sin referencia previa
  });
  _standingsCache=rows;
  return rows;
}

/* ---------- SNAPSHOTS de posiciones (para las flechas ▲▼) ---------- */
// fechas en orden, con su horario de cierre (fin de la fecha)
function allDateKeys(){
  return [
    {key:"grupos-1",phase:"grupos",jor:1},{key:"grupos-2",phase:"grupos",jor:2},{key:"grupos-3",phase:"grupos",jor:3},
    {key:"r32",phase:"r32"},{key:"r16",phase:"r16"},{key:"qf",phase:"qf"},
    {key:"sf",phase:"sf"},{key:"tp",phase:"tp"},{key:"final",phase:"final"},
  ];
}
// kickoff del ÚLTIMO partido de una fecha (cuando se considera "cerrada")
function dateEndKickoff(phase,jor){
  const ms=FIXTURE.filter(m=> phase==="grupos" ? (m.phase==="grupos"&&m.jor===jor) : m.phase===phase);
  const times=ms.map(m=>m.kickoff).filter(Boolean).map(t=>new Date(t).getTime());
  if(!times.length) return null;
  // se considera cerrada 2 horas después del inicio del último partido
  return new Date(Math.max(...times)+2*3600*1000);
}
// snapshot actual de posiciones (id -> pos)
function currentPositions(){
  const map={}; standings().forEach(r=>map[r.id]=r.pos); return map;
}
/* Al cargar la app: si alguna fecha ya cerró y no tiene snapshot, lo crea.
   Guarda como "lastSnapshot" la foto de la última fecha cerrada (para las flechas). */
async function syncSnapshots(){
  try{
    const {data:snaps}=await sb.from('standings_snapshots').select('*');
    const have={}; (snaps||[]).forEach(s=>have[s.date_key]=s.positions);
    const tz='America/Argentina/Buenos_Aires';
    const now=new Date();
    // Usar fecha calendario ARG como date_key
    // Un "día" cierra a las 4am ARG del día siguiente
    const argH=parseInt(new Intl.DateTimeFormat('en-CA',{timeZone:tz,hour:'numeric',hour12:false}).format(now));
    const argDate=new Intl.DateTimeFormat('en-CA',{timeZone:tz}).format(now);
    // obtener todos los días distintos con partidos ya jugados
    const matchDays=[...new Set(FIXTURE.filter(m=>m.kickoff).map(m=>{
      const k=new Date(m.kickoff);
      return new Intl.DateTimeFormat('en-CA',{timeZone:tz}).format(k);
    }))].sort();
    for(const day of matchDays){
      // el día cerró si ya pasaron las 4am ARG del día siguiente
      const nextDay=new Date(day+'T07:00:00Z'); // 4am ARG = 7am UTC
      nextDay.setDate(nextDay.getDate()+1);
      if(now<nextDay) continue; // día todavía no cerró
      if(have[day]) continue; // ya tiene snapshot
      // crear snapshot para este día
      const pos=currentPositions();
      await sb.from('standings_snapshots').insert({date_key:day,positions:pos});
      have[day]=pos;
    }
    // lastSnapshot = el snapshot del día anterior al actual
    const closedDays=matchDays.filter(day=>{
      const nextDay=new Date(day+'T07:00:00Z');
      nextDay.setDate(nextDay.getDate()+1);
      return now>=nextDay && have[day];
    });
    if(closedDays.length>=1) APP.lastSnapshot=have[closedDays[closedDays.length-1]]||null;
    else APP.lastSnapshot=null;
  }catch(e){ console.warn("snapshots:",e.message); APP.lastSnapshot=null; }
}

/* =====================================================================
   VALIDACIÓN DE COMODINES (reglamento 2026 — modelo diario)
   =====================================================================
   Modelo NUEVO:
   - Una "fecha" del prode = un día CALENDARIO (zona horaria del estadio del partido).
   - El comodín se asocia a un día (ej. "2026-06-15") y vale para todos los partidos
     reales de ese día.
   - Ventana: 6:00 a 12:00 hora argentina del día calendario AR donde se juega el partido.
   - Cupo: 3 sanguijuelas + 2 nitros POR FASE (grupos / r32 / r16 / qf / sf / tp+final).
     Distribuibles en los ~17 días de grupos o los días que dura cada fase elim.
   ===================================================================== */

// Día calendario (YYYY-MM-DD) en hora local del estadio para un kickoff dado.
// Usamos la hora argentina porque la ventana es hora AR, y para el prode entre amigos
// alcanza con asociar el partido al "día calendario AR donde aparece su kickoff".
function dayKey(kickoff){
  if(!kickoff) return null;
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',
    year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(kickoff));
}
function todayDayKey(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',
    year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
// Clave del "bloque de partidos" actual: 8am ARG a 4am ARG del día siguiente
// Si son las 0am-4am ARG, pertenecemos al bloque del día anterior
function todayBlockKey(){
  const tz='America/Argentina/Buenos_Aires';
  const h=parseInt(new Intl.DateTimeFormat('en-CA',{timeZone:tz,hour:'2-digit',hour12:false}).format(new Date()));
  const d=new Date();
  if(h<4){
    // antes de las 4am = bloque del día anterior
    d.setDate(d.getDate()-1);
  }
  return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}

/* Día FIFA "actual": la fecha FIFA de los partidos cuyo kickoff cae en el bloque
   argentino de hoy (8am-4am). Si no hay partidos hoy, usa la fecha ARG actual.
   Esta es la fuente para "Partidos de hoy" y para los comodines. */
function todayFifaDate(){
  const block = todayBlockKey(); // día calendario ARG del bloque actual
  // partidos cuyo kickoff cae en el bloque ARG de hoy
  const tz='America/Argentina/Buenos_Aires';
  function blockOfKickoff(k){
    const d=new Date(k);
    const h=parseInt(new Intl.DateTimeFormat('en-CA',{timeZone:tz,hour:'2-digit',hour12:false}).format(d));
    if(h<4) d.setDate(d.getDate()-1);
    return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }
  const hoy = FIXTURE.filter(m=>m.kickoff && blockOfKickoff(m.kickoff)===block);
  if(hoy.length){
    // devolver la fecha FIFA más común entre los partidos de hoy
    const counts={};
    hoy.forEach(m=>{ const f=fifaDateOf(m); if(f) counts[f]=(counts[f]||0)+1; });
    const best=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
    if(best) return best;
  }
  return block;
}

// ¿hay partidos hoy de la fase X?
function phaseOfDay(day){
  // miramos qué FIXTURE tiene fecha FIFA en ese día; devolvemos su fase (o null)
  const m = FIXTURE.find(mt=>fifaDateOf(mt)===day);
  return m?m.phase:null;
}

// ¿La ventana 6-12 AR del día actual está abierta?
function windowOpenNow(){
  const tz='America/Argentina/Buenos_Aires';
  const hh=Number(new Intl.DateTimeFormat('en-CA',{timeZone:tz,hour:'numeric',hour12:false}).format(new Date()));
  return hh>=6 && hh<12;
}

// ¿día de partidos? (al menos un partido en FIXTURE con ese día calendario)
function dayHasMatches(day){
  return FIXTURE.some(m=>fifaDateOf(m)===day);
}

function quotaLeft(uid,type){
  const max = type==="sang" ? 3 : 2; // 3 sanguijuelas / 2 nitros POR FASE
  const byPhase = {};
  ["grupos","r32","r16","qf","sf","tp","final"].forEach(ph=> byPhase[ph]=0);
  APP.comodines.filter(c=>c.type===type&&c.by_user===uid).forEach(c=>{
    byPhase[c.phase] = (byPhase[c.phase]||0)+1;
  });
  // resumen
  return {
    grupos:Math.max(0,max-byPhase.grupos),
    r32:Math.max(0,max-byPhase.r32),
    r16:Math.max(0,max-byPhase.r16),
    qf:Math.max(0,max-byPhase.qf),
    sf:Math.max(0,max-byPhase.sf),
    finals:Math.max(0,max-(byPhase.tp+byPhase.final)),
  };
}

/* Validación de comodines en el modelo diario.
   No recibimos phase ni jor — se calculan del día actual. */
function windowErrorToday(){
  const day = todayFifaDate();
  if(!dayHasMatches(day)) return "Hoy no hay partidos del Mundial. Los comodines solo se piden los días que se juega.";
  if(!windowOpenNow()) return "La ventana de comodines es de 6:00 a 12:00 (hora argentina). Está cerrada ahora.";
  return null;
}

// ¿el usuario fue retado en partido alguno de hoy?
function wasChallengedToday(uid){
  const day=todayFifaDate();
  return APP.comodines.find(c=>c.type==="sang"&&c.target_user===uid&&c.day===day);
}
function askedNitroToday(uid){
  const day=todayFifaDate();
  return APP.comodines.find(c=>c.type==="nitro"&&c.by_user===uid&&c.day===day);
}
function askedSangToday(uid){
  const day=todayFifaDate();
  return APP.comodines.find(c=>c.type==="sang"&&c.by_user===uid&&c.day===day);
}

function validateSang(by,target){
  if(by===target) return "No podés retarte a vos mismo.";
  const winErr=windowErrorToday(); if(winErr) return winErr;
  const day=todayFifaDate(); const phase=phaseOfDay(day);
  if(!phase) return "No hay partidos hoy.";
  const tb=standings(); const me=tb.find(r=>r.id===by), tg=tb.find(r=>r.id===target);
  if(!me||!tg) return "Jugador no encontrado.";
  if(me.pos===1) return "El que va primero no puede retar.";
  const diff=me.pos-tg.pos;
  if(diff<=0) return "Solo podés retar a alguien por encima tuyo.";
  if(diff>3) return "Solo podés retar hasta 3 posiciones por encima.";
  // cupo de la fase actual
  const q=quotaLeft(by,"sang");
  const qKey = phase==="tp"||phase==="final" ? "finals" : phase;
  if(q[qKey]<=0) return "Ya usaste tus 3 sanguijuelas de esta fase.";
  // interacciones del mismo día
  if(askedSangToday(by)) return "Ya aplicaste una sanguijuela hoy. Solo podés aplicar una por bloque.";
  if(wasChallengedToday(by)) return "Fuiste sanguijueleado en este bloque: no podés aplicar sanguijuela hasta el próximo.";
  if(askedNitroToday(by)) return "No podés usar Sanguijuela y Nitro el mismo día.";
  if(askedNitroToday(target)) return "No podés retar a quien pidió Nitro hoy (perderías la sanguijuela).";
  // máximo 2 veces a la misma persona por fase
  const tgByMeInPhase = APP.comodines.filter(c=>c.type==="sang"&&c.target_user===target&&c.by_user===by&&c.phase===phase);
  if(tgByMeInPhase.length>=2) return "No podés retar más de 2 veces a la misma persona en una fase.";
  // máximo 3 retos recibidos por fase
  const tgRecvPhase = APP.comodines.filter(c=>c.type==="sang"&&c.target_user===target&&c.phase===phase);
  if(tgRecvPhase.length>=3) return "Esa persona ya recibió 3 retos en esta fase (el máximo).";
  // no retar a quien ya fue retado HOY
  if(wasChallengedToday(target)) return "Ese jugador ya fue retado por otro hoy (vale el primer aviso).";
  return null;
}
function validateNitro(by){
  const winErr=windowErrorToday(); if(winErr) return winErr;
  const day=todayFifaDate(); const phase=phaseOfDay(day);
  if(!phase) return "No hay partidos hoy.";
  const q=quotaLeft(by,"nitro");
  const qKey = phase==="tp"||phase==="final" ? "finals" : phase;
  if(q[qKey]<=0) return "Ya usaste tus 2 nitros de esta fase.";
  if(askedNitroToday(by)) return "Ya tenés un nitro pedido para hoy.";
  if(askedSangToday(by)) return "No podés usar Nitro y Sanguijuela el mismo día.";
  if(wasChallengedToday(by)) return "Fuiste sanguijueleado en este bloque: no podés usar Nitro hasta el próximo.";
  const tb=standings(); const me=tb.find(r=>r.id===by);
  if(!me) return "Jugador no encontrado.";
  if(me.pos===1||me.pos===2) return "El 1° y 2° no pueden usar nitro.";
  return null;
}


/* =====================================================================
   MOTOR DE CUADRO AUTOCOMPLETADO (Tarjeta Principal · Mundial 2026)
   =====================================================================
   El jugador carga los marcadores de grupos. Esta función calcula:
   1. La tabla de cada uno de los 12 grupos (puntos, dif. gol, GF) con reglas FIFA.
   2. Los 2 primeros de cada grupo (24 clasificados directos).
   3. Los 8 mejores 3ros (de los 12 terceros) por puntos > dif. gol > GF.
   4. El bracket de R32 con esos 32 equipos, según una asignación determinística.
   Devuelve un objeto con groups[grp], thirds[], bracket{r32,r16,qf,sf,tp,final}.
   ===================================================================== */
function computeBracket(mainPreds){
  // mainPreds: { match_id: {h:n, a:n, pen:?} }
  // 1) calcular tablas por grupo
  const groupTable={}; // groupTable["A"] = [{team, pj, g, e, p, gf, gc, dg, pts}, ...]
  GROUPS.forEach(g=>{
    const teams=GROUP_TEAMS[g];
    const t={};
    teams.forEach(c=>{ t[c]={team:c, pj:0,g:0,e:0,p:0,gf:0,gc:0,dg:0,pts:0}; });
    FIXTURE.filter(m=>m.phase==="grupos"&&m.grp===g).forEach(m=>{
      const pr=mainPreds?.[m.id]; if(!pr||pr.h===""||pr.h==null||pr.a===""||pr.a==null) return;
      const h=+pr.h, a=+pr.a;
      t[m.home].pj++; t[m.away].pj++;
      t[m.home].gf+=h; t[m.home].gc+=a;
      t[m.away].gf+=a; t[m.away].gc+=h;
      if(h>a){ t[m.home].g++; t[m.home].pts+=3; t[m.away].p++; }
      else if(h<a){ t[m.away].g++; t[m.away].pts+=3; t[m.home].p++; }
      else { t[m.home].e++; t[m.away].e++; t[m.home].pts++; t[m.away].pts++; }
    });
    // ordenar: pts > dg > gf > nombre (último desempate alfabético, simple)
    const rows=Object.values(t);
    rows.forEach(r=>r.dg=r.gf-r.gc);
    rows.sort((a,b)=> b.pts-a.pts || b.dg-a.dg || b.gf-a.gf || a.team.localeCompare(b.team));
    rows.forEach((r,i)=>r.pos=i+1);
    groupTable[g]=rows;
  });

  // 2) clasificados directos: 1ros y 2dos
  const firsts={}, seconds={}, thirds=[];
  GROUPS.forEach(g=>{
    firsts[g]=groupTable[g][0];
    seconds[g]=groupTable[g][1];
    thirds.push({...groupTable[g][2], from:g});
  });
  // 3) 8 mejores terceros
  thirds.sort((a,b)=> b.pts-a.pts || b.dg-a.dg || b.gf-a.gf || a.from.localeCompare(b.from));
  const bestThirds = thirds.slice(0,8); // los 8 que clasifican
  const droppedThirds = thirds.slice(8); // 4 que quedan eliminados

  // 4) BRACKET de R32 - cruces OFICIALES FIFA 2026
  // Tabla completa FIFA: qué tercero va a cada slot según combinación de 8 clasificados
  // Slots en orden: M74, M77, M79, M80, M81, M82, M85, M87
  // key = 8 grupos ordenados alfabéticamente; value = [grupo para cada slot]
  const THIRDS_TABLE = {
  "ABCDEFGH":["A","C","F","E","B","H","G","D"],
  "ABCDEFGI":["A","C","F","E","B","I","G","D"],
  "ABCDEFGJ":["A","C","F","E","B","J","G","D"],
  "ABCDEFGK":["A","C","F","K","B","E","G","D"],
  "ABCDEFGL":["B","D","C","E","F","A","G","L"],
  "ABCDEFHI":["A","C","E","H","B","I","F","D"],
  "ABCDEFHJ":["A","C","E","H","B","J","F","D"],
  "ABCDEFHK":["A","C","E","K","B","H","F","D"],
  "ABCDEFHL":["A","D","C","E","B","H","F","L"],
  "ABCDEFIJ":["A","C","E","I","B","J","F","D"],
  "ABCDEFIK":["A","C","E","K","B","I","F","D"],
  "ABCDEFIL":["A","D","C","E","B","I","F","L"],
  "ABCDEFJK":["A","C","E","K","B","J","F","D"],
  "ABCDEFJL":["A","D","C","E","B","J","F","L"],
  "ABCDEFKL":["A","D","C","K","B","E","F","L"],
  "ABCDEGHI":["A","C","E","H","B","I","G","D"],
  "ABCDEGHJ":["A","C","E","H","B","J","G","D"],
  "ABCDEGHK":["A","C","E","K","B","H","G","D"],
  "ABCDEGHL":["A","D","C","E","B","H","G","L"],
  "ABCDEGIJ":["A","C","E","I","B","J","G","D"],
  "ABCDEGIK":["A","C","E","K","B","I","G","D"],
  "ABCDEGIL":["A","D","C","E","B","I","G","L"],
  "ABCDEGJK":["A","C","E","K","B","J","G","D"],
  "ABCDEGJL":["A","D","C","E","B","J","G","L"],
  "ABCDEGKL":["A","D","C","K","B","E","G","L"],
  "ABCDEHIJ":["A","C","E","H","B","I","J","D"],
  "ABCDEHIK":["A","C","E","K","B","H","I","D"],
  "ABCDEHIL":["A","D","C","E","B","H","I","L"],
  "ABCDEHJK":["A","C","E","K","B","H","J","D"],
  "ABCDEHJL":["A","D","C","E","B","H","J","L"],
  "ABCDEHKL":["A","D","C","K","B","H","E","L"],
  "ABCDEIJK":["A","C","E","K","B","I","J","D"],
  "ABCDEIJL":["A","D","C","E","B","I","J","L"],
  "ABCDEIKL":["A","D","C","K","B","E","I","L"],
  "ABCDEJKL":["A","D","C","K","B","E","J","L"],
  "ABCDFGHI":["A","C","F","H","B","I","G","D"],
  "ABCDFGHJ":["A","C","F","H","B","J","G","D"],
  "ABCDFGHK":["A","C","F","K","B","H","G","D"],
  "ABCDFGHL":["B","D","C","H","F","A","G","L"],
  "ABCDFGIJ":["A","C","F","I","B","J","G","D"],
  "ABCDFGIK":["A","C","F","K","B","I","G","D"],
  "ABCDFGIL":["B","D","C","I","F","A","G","L"],
  "ABCDFGJK":["A","C","F","K","B","J","G","D"],
  "ABCDFGJL":["B","D","C","J","F","A","G","L"],
  "ABCDFGKL":["B","D","C","K","F","A","G","L"],
  "ABCDFHIJ":["A","C","F","H","B","I","J","D"],
  "ABCDFHIK":["A","C","F","K","B","H","I","D"],
  "ABCDFHIL":["A","D","C","H","B","I","F","L"],
  "ABCDFHJK":["A","C","F","K","B","H","J","D"],
  "ABCDFHJL":["A","D","C","H","B","J","F","L"],
  "ABCDFHKL":["A","D","C","K","B","H","F","L"],
  "ABCDFIJK":["A","C","F","K","B","I","J","D"],
  "ABCDFIJL":["A","D","C","I","B","J","F","L"],
  "ABCDFIKL":["A","D","C","K","B","I","F","L"],
  "ABCDFJKL":["A","D","C","K","B","J","F","L"],
  "ABCDGHIJ":["A","C","H","I","B","J","G","D"],
  "ABCDGHIK":["A","C","H","K","B","I","G","D"],
  "ABCDGHIL":["A","D","C","H","B","I","G","L"],
  "ABCDGHJK":["A","C","H","K","B","J","G","D"],
  "ABCDGHJL":["A","D","C","H","B","J","G","L"],
  "ABCDGHKL":["A","D","C","K","B","H","G","L"],
  "ABCDGIJK":["A","C","I","K","B","J","G","D"],
  "ABCDGIJL":["A","D","C","I","B","J","G","L"],
  "ABCDGIKL":["A","D","C","K","B","I","G","L"],
  "ABCDGJKL":["A","D","C","K","B","J","G","L"],
  "ABCDHIJK":["A","C","H","K","B","I","J","D"],
  "ABCDHIJL":["A","D","C","H","B","I","J","L"],
  "ABCDHIKL":["A","D","C","K","B","H","I","L"],
  "ABCDHJKL":["A","D","C","K","B","H","J","L"],
  "ABCDIJKL":["A","D","C","K","B","I","J","L"],
  "ABCEFGHI":["A","C","F","E","B","H","G","I"],
  "ABCEFGHJ":["A","C","F","E","B","H","G","J"],
  "ABCEFGHK":["A","C","F","K","B","H","G","E"],
  "ABCEFGHL":["A","C","F","E","B","H","G","L"],
  "ABCEFGIJ":["A","C","F","E","B","I","G","J"],
  "ABCEFGIK":["A","C","F","K","B","E","G","I"],
  "ABCEFGIL":["A","C","F","E","B","I","G","L"],
  "ABCEFGJK":["A","C","F","K","B","E","G","J"],
  "ABCEFGJL":["A","C","F","E","B","J","G","L"],
  "ABCEFGKL":["A","C","F","K","B","E","G","L"],
  "ABCEFHIJ":["A","C","E","H","B","I","F","J"],
  "ABCEFHIK":["A","C","E","K","B","H","F","I"],
  "ABCEFHIL":["A","C","E","H","B","I","F","L"],
  "ABCEFHJK":["A","C","E","K","B","H","F","J"],
  "ABCEFHJL":["A","C","E","H","B","J","F","L"],
  "ABCEFHKL":["A","C","E","K","B","H","F","L"],
  "ABCEFIJK":["A","C","E","K","B","I","F","J"],
  "ABCEFIJL":["A","C","E","I","B","J","F","L"],
  "ABCEFIKL":["A","C","E","K","B","I","F","L"],
  "ABCEFJKL":["A","C","E","K","B","J","F","L"],
  "ABCEGHIJ":["A","C","E","H","B","I","G","J"],
  "ABCEGHIK":["A","C","E","K","B","H","G","I"],
  "ABCEGHIL":["A","C","E","H","B","I","G","L"],
  "ABCEGHJK":["A","C","E","K","B","H","G","J"],
  "ABCEGHJL":["A","C","E","H","B","J","G","L"],
  "ABCEGHKL":["A","C","E","K","B","H","G","L"],
  "ABCEGIJK":["A","C","E","K","B","I","G","J"],
  "ABCEGIJL":["A","C","E","I","B","J","G","L"],
  "ABCEGIKL":["A","C","E","K","B","I","G","L"],
  "ABCEGJKL":["A","C","E","K","B","J","G","L"],
  "ABCEHIJK":["A","C","E","K","B","H","I","J"],
  "ABCEHIJL":["A","C","E","H","B","I","J","L"],
  "ABCEHIKL":["A","C","E","K","B","H","I","L"],
  "ABCEHJKL":["A","C","E","K","B","H","J","L"],
  "ABCEIJKL":["A","C","E","K","B","I","J","L"],
  "ABCFGHIJ":["A","C","F","H","B","I","G","J"],
  "ABCFGHIK":["A","C","F","K","B","H","G","I"],
  "ABCFGHIL":["A","C","F","H","B","I","G","L"],
  "ABCFGHJK":["A","C","F","K","B","H","G","J"],
  "ABCFGHJL":["A","C","F","H","B","J","G","L"],
  "ABCFGHKL":["A","C","F","K","B","H","G","L"],
  "ABCFGIJK":["A","C","F","K","B","I","G","J"],
  "ABCFGIJL":["A","C","F","I","B","J","G","L"],
  "ABCFGIKL":["A","C","F","K","B","I","G","L"],
  "ABCFGJKL":["A","C","F","K","B","J","G","L"],
  "ABCFHIJK":["A","C","F","K","B","H","I","J"],
  "ABCFHIJL":["A","C","F","H","B","I","J","L"],
  "ABCFHIKL":["A","C","F","K","B","H","I","L"],
  "ABCFHJKL":["A","C","F","K","B","H","J","L"],
  "ABCFIJKL":["A","C","F","K","B","I","J","L"],
  "ABCGHIJK":["A","C","H","K","B","I","G","J"],
  "ABCGHIJL":["A","C","H","I","B","J","G","L"],
  "ABCGHIKL":["A","C","H","K","B","I","G","L"],
  "ABCGHJKL":["A","C","H","K","B","J","G","L"],
  "ABCGIJKL":["A","C","I","K","B","J","G","L"],
  "ABCHIJKL":["A","C","H","K","B","I","J","L"],
  "ABDEFGHI":["A","D","F","E","B","H","G","I"],
  "ABDEFGHJ":["A","D","F","E","B","H","G","J"],
  "ABDEFGHK":["A","D","F","K","B","H","G","E"],
  "ABDEFGHL":["A","D","F","E","B","H","G","L"],
  "ABDEFGIJ":["A","D","F","E","B","I","G","J"],
  "ABDEFGIK":["A","D","F","K","B","E","G","I"],
  "ABDEFGIL":["A","D","F","E","B","I","G","L"],
  "ABDEFGJK":["A","D","F","K","B","E","G","J"],
  "ABDEFGJL":["A","D","F","E","B","J","G","L"],
  "ABDEFGKL":["A","D","F","K","B","E","G","L"],
  "ABDEFHIJ":["A","D","E","H","B","I","F","J"],
  "ABDEFHIK":["A","D","E","K","B","H","F","I"],
  "ABDEFHIL":["A","D","E","H","B","I","F","L"],
  "ABDEFHJK":["A","D","E","K","B","H","F","J"],
  "ABDEFHJL":["A","D","E","H","B","J","F","L"],
  "ABDEFHKL":["A","D","E","K","B","H","F","L"],
  "ABDEFIJK":["A","D","E","K","B","I","F","J"],
  "ABDEFIJL":["A","D","E","I","B","J","F","L"],
  "ABDEFIKL":["A","D","E","K","B","I","F","L"],
  "ABDEFJKL":["A","D","E","K","B","J","F","L"],
  "ABDEGHIJ":["A","D","E","H","B","I","G","J"],
  "ABDEGHIK":["A","D","E","K","B","H","G","I"],
  "ABDEGHIL":["A","D","E","H","B","I","G","L"],
  "ABDEGHJK":["A","D","E","K","B","H","G","J"],
  "ABDEGHJL":["A","D","E","H","B","J","G","L"],
  "ABDEGHKL":["A","D","E","K","B","H","G","L"],
  "ABDEGIJK":["A","D","E","K","B","I","G","J"],
  "ABDEGIJL":["A","D","E","I","B","J","G","L"],
  "ABDEGIKL":["A","D","E","K","B","I","G","L"],
  "ABDEGJKL":["A","D","E","K","B","J","G","L"],
  "ABDEHIJK":["A","D","E","K","B","H","I","J"],
  "ABDEHIJL":["A","D","E","H","B","I","J","L"],
  "ABDEHIKL":["A","D","E","K","B","H","I","L"],
  "ABDEHJKL":["A","D","E","K","B","H","J","L"],
  "ABDEIJKL":["A","D","E","K","B","I","J","L"],
  "ABDFGHIJ":["A","D","F","H","B","I","G","J"],
  "ABDFGHIK":["A","D","F","K","B","H","G","I"],
  "ABDFGHIL":["A","D","F","H","B","I","G","L"],
  "ABDFGHJK":["A","D","F","K","B","H","G","J"],
  "ABDFGHJL":["A","D","F","H","B","J","G","L"],
  "ABDFGHKL":["A","D","F","K","B","H","G","L"],
  "ABDFGIJK":["A","D","F","K","B","I","G","J"],
  "ABDFGIJL":["A","D","F","I","B","J","G","L"],
  "ABDFGIKL":["A","D","F","K","B","I","G","L"],
  "ABDFGJKL":["A","D","F","K","B","J","G","L"],
  "ABDFHIJK":["A","D","F","K","B","H","I","J"],
  "ABDFHIJL":["A","D","F","H","B","I","J","L"],
  "ABDFHIKL":["A","D","F","K","B","H","I","L"],
  "ABDFHJKL":["A","D","F","K","B","H","J","L"],
  "ABDFIJKL":["A","D","F","K","B","I","J","L"],
  "ABDGHIJK":["A","D","H","K","B","I","G","J"],
  "ABDGHIJL":["A","D","H","I","B","J","G","L"],
  "ABDGHIKL":["A","D","H","K","B","I","G","L"],
  "ABDGHJKL":["A","D","H","K","B","J","G","L"],
  "ABDGIJKL":["A","D","I","K","B","J","G","L"],
  "ABDHIJKL":["A","D","H","K","B","I","J","L"],
  "ABEFGHIJ":["A","F","E","H","B","I","G","J"],
  "ABEFGHIK":["A","F","E","K","B","H","G","I"],
  "ABEFGHIL":["A","F","E","H","B","I","G","L"],
  "ABEFGHJK":["A","F","E","K","B","H","G","J"],
  "ABEFGHJL":["A","F","E","H","B","J","G","L"],
  "ABEFGHKL":["A","F","E","K","B","H","G","L"],
  "ABEFGIJK":["A","F","E","K","B","I","G","J"],
  "ABEFGIJL":["A","F","E","I","B","J","G","L"],
  "ABEFGIKL":["A","F","E","K","B","I","G","L"],
  "ABEFGJKL":["A","F","E","K","B","J","G","L"],
  "ABEFHIJK":["A","F","E","K","B","H","I","J"],
  "ABEFHIJL":["A","F","E","H","B","I","J","L"],
  "ABEFHIKL":["A","F","E","K","B","H","I","L"],
  "ABEFHJKL":["A","F","E","K","B","H","J","L"],
  "ABEFIJKL":["A","F","E","K","B","I","J","L"],
  "ABEGHIJK":["A","G","E","K","B","H","I","J"],
  "ABEGHIJL":["A","G","E","H","B","I","J","L"],
  "ABEGHIKL":["A","G","E","K","B","H","I","L"],
  "ABEGHJKL":["A","G","E","K","B","H","J","L"],
  "ABEGIJKL":["A","G","E","K","B","I","J","L"],
  "ABEHIJKL":["A","H","E","K","B","I","J","L"],
  "ABFGHIJK":["A","F","H","K","B","I","G","J"],
  "ABFGHIJL":["A","F","H","I","B","J","G","L"],
  "ABFGHIKL":["A","F","H","K","B","I","G","L"],
  "ABFGHJKL":["A","F","H","K","B","J","G","L"],
  "ABFGIJKL":["A","F","I","K","B","J","G","L"],
  "ABFHIJKL":["A","F","H","K","B","I","J","L"],
  "ABGHIJKL":["A","G","H","K","B","I","J","L"],
  "ACDEFGHI":["A","C","E","H","F","I","G","D"],
  "ACDEFGHJ":["A","C","E","H","F","J","G","D"],
  "ACDEFGHK":["A","C","E","K","F","H","G","D"],
  "ACDEFGHL":["A","D","C","E","F","H","G","L"],
  "ACDEFGIJ":["A","C","E","I","F","J","G","D"],
  "ACDEFGIK":["A","C","E","K","F","I","G","D"],
  "ACDEFGIL":["A","D","C","E","F","I","G","L"],
  "ACDEFGJK":["A","C","E","K","F","J","G","D"],
  "ACDEFGJL":["A","D","C","E","F","J","G","L"],
  "ACDEFGKL":["A","D","C","K","F","E","G","L"],
  "ACDEFHIJ":["A","C","E","H","F","I","J","D"],
  "ACDEFHIK":["A","C","E","K","F","H","I","D"],
  "ACDEFHIL":["A","D","C","E","F","H","I","L"],
  "ACDEFHJK":["A","C","E","K","F","H","J","D"],
  "ACDEFHJL":["A","D","C","E","F","H","J","L"],
  "ACDEFHKL":["A","D","C","K","E","H","F","L"],
  "ACDEFIJK":["A","C","E","K","F","I","J","D"],
  "ACDEFIJL":["A","D","C","E","F","I","J","L"],
  "ACDEFIKL":["A","D","C","K","E","I","F","L"],
  "ACDEFJKL":["A","D","C","K","E","J","F","L"],
  "ACDEGHIJ":["A","C","E","H","I","J","G","D"],
  "ACDEGHIK":["A","C","E","K","I","H","G","D"],
  "ACDEGHIL":["A","D","C","E","I","H","G","L"],
  "ACDEGHJK":["A","C","E","K","J","H","G","D"],
  "ACDEGHJL":["A","D","C","E","J","H","G","L"],
  "ACDEGHKL":["A","D","C","K","E","H","G","L"],
  "ACDEGIJK":["A","C","E","K","I","J","G","D"],
  "ACDEGIJL":["A","D","C","E","I","J","G","L"],
  "ACDEGIKL":["A","D","C","K","E","I","G","L"],
  "ACDEGJKL":["A","D","C","K","E","J","G","L"],
  "ACDEHIJK":["A","C","E","K","I","H","J","D"],
  "ACDEHIJL":["A","D","C","E","I","H","J","L"],
  "ACDEHIKL":["A","D","C","K","E","H","I","L"],
  "ACDEHJKL":["A","D","C","K","E","H","J","L"],
  "ACDEIJKL":["A","D","C","K","E","I","J","L"],
  "ACDFGHIJ":["A","C","F","H","I","J","G","D"],
  "ACDFGHIK":["A","C","F","K","I","H","G","D"],
  "ACDFGHIL":["A","D","C","H","F","I","G","L"],
  "ACDFGHJK":["A","C","F","K","J","H","G","D"],
  "ACDFGHJL":["A","D","C","H","F","J","G","L"],
  "ACDFGHKL":["A","D","C","K","F","H","G","L"],
  "ACDFGIJK":["A","C","F","K","I","J","G","D"],
  "ACDFGIJL":["A","D","C","I","F","J","G","L"],
  "ACDFGIKL":["A","D","C","K","F","I","G","L"],
  "ACDFGJKL":["A","D","C","K","F","J","G","L"],
  "ACDFHIJK":["A","C","F","K","I","H","J","D"],
  "ACDFHIJL":["A","D","C","H","F","I","J","L"],
  "ACDFHIKL":["A","D","C","K","F","H","I","L"],
  "ACDFHJKL":["A","D","C","K","F","H","J","L"],
  "ACDFIJKL":["A","D","C","K","F","I","J","L"],
  "ACDGHIJK":["A","C","H","K","I","J","G","D"],
  "ACDGHIJL":["A","D","C","H","I","J","G","L"],
  "ACDGHIKL":["A","D","C","K","I","H","G","L"],
  "ACDGHJKL":["A","D","C","K","J","H","G","L"],
  "ACDGIJKL":["A","D","C","K","I","J","G","L"],
  "ACDHIJKL":["A","D","C","K","I","H","J","L"],
  "ACEFGHIJ":["A","C","E","H","F","I","G","J"],
  "ACEFGHIK":["A","C","E","K","F","H","G","I"],
  "ACEFGHIL":["A","C","E","H","F","I","G","L"],
  "ACEFGHJK":["A","C","E","K","F","H","G","J"],
  "ACEFGHJL":["A","C","E","H","F","J","G","L"],
  "ACEFGHKL":["A","C","E","K","F","H","G","L"],
  "ACEFGIJK":["A","C","E","K","F","I","G","J"],
  "ACEFGIJL":["A","C","E","I","F","J","G","L"],
  "ACEFGIKL":["A","C","E","K","F","I","G","L"],
  "ACEFGJKL":["A","C","E","K","F","J","G","L"],
  "ACEFHIJK":["A","C","E","K","F","H","I","J"],
  "ACEFHIJL":["A","C","E","H","F","I","J","L"],
  "ACEFHIKL":["A","C","E","K","F","H","I","L"],
  "ACEFHJKL":["A","C","E","K","F","H","J","L"],
  "ACEFIJKL":["A","C","E","K","F","I","J","L"],
  "ACEGHIJK":["A","C","E","K","I","H","G","J"],
  "ACEGHIJL":["A","C","E","H","I","J","G","L"],
  "ACEGHIKL":["A","C","E","K","I","H","G","L"],
  "ACEGHJKL":["A","C","E","K","J","H","G","L"],
  "ACEGIJKL":["A","C","E","K","I","J","G","L"],
  "ACEHIJKL":["A","C","E","K","I","H","J","L"],
  "ACFGHIJK":["A","C","F","K","I","H","G","J"],
  "ACFGHIJL":["A","C","F","H","I","J","G","L"],
  "ACFGHIKL":["A","C","F","K","I","H","G","L"],
  "ACFGHJKL":["A","C","F","K","J","H","G","L"],
  "ACFGIJKL":["A","C","F","K","I","J","G","L"],
  "ACFHIJKL":["A","C","F","K","I","H","J","L"],
  "ACGHIJKL":["A","C","H","K","I","J","G","L"],
  "ADEFGHIJ":["A","D","E","H","F","I","G","J"],
  "ADEFGHIK":["A","D","E","K","F","H","G","I"],
  "ADEFGHIL":["A","D","E","H","F","I","G","L"],
  "ADEFGHJK":["A","D","E","K","F","H","G","J"],
  "ADEFGHJL":["A","D","E","H","F","J","G","L"],
  "ADEFGHKL":["A","D","E","K","F","H","G","L"],
  "ADEFGIJK":["A","D","E","K","F","I","G","J"],
  "ADEFGIJL":["A","D","E","I","F","J","G","L"],
  "ADEFGIKL":["A","D","E","K","F","I","G","L"],
  "ADEFGJKL":["A","D","E","K","F","J","G","L"],
  "ADEFHIJK":["A","D","E","K","F","H","I","J"],
  "ADEFHIJL":["A","D","E","H","F","I","J","L"],
  "ADEFHIKL":["A","D","E","K","F","H","I","L"],
  "ADEFHJKL":["A","D","E","K","F","H","J","L"],
  "ADEFIJKL":["A","D","E","K","F","I","J","L"],
  "ADEGHIJK":["A","D","E","K","I","H","G","J"],
  "ADEGHIJL":["A","D","E","H","I","J","G","L"],
  "ADEGHIKL":["A","D","E","K","I","H","G","L"],
  "ADEGHJKL":["A","D","E","K","J","H","G","L"],
  "ADEGIJKL":["A","D","E","K","I","J","G","L"],
  "ADEHIJKL":["A","D","E","K","I","H","J","L"],
  "ADFGHIJK":["A","D","F","K","I","H","G","J"],
  "ADFGHIJL":["A","D","F","H","I","J","G","L"],
  "ADFGHIKL":["A","D","F","K","I","H","G","L"],
  "ADFGHJKL":["A","D","F","K","J","H","G","L"],
  "ADFGIJKL":["A","D","F","K","I","J","G","L"],
  "ADFHIJKL":["A","D","F","K","I","H","J","L"],
  "ADGHIJKL":["A","D","H","K","I","J","G","L"],
  "AEFGHIJK":["A","F","E","K","I","H","G","J"],
  "AEFGHIJL":["A","F","E","H","I","J","G","L"],
  "AEFGHIKL":["A","F","E","K","I","H","G","L"],
  "AEFGHJKL":["A","F","E","K","J","H","G","L"],
  "AEFGIJKL":["A","F","E","K","I","J","G","L"],
  "AEFHIJKL":["A","F","E","K","I","H","J","L"],
  "AEGHIJKL":["A","G","E","K","I","H","J","L"],
  "AFGHIJKL":["A","F","H","K","I","J","G","L"],
  "BCDEFGHI":["B","C","E","H","F","I","G","D"],
  "BCDEFGHJ":["B","C","E","H","F","J","G","D"],
  "BCDEFGHK":["B","C","E","K","F","H","G","D"],
  "BCDEFGHL":["B","D","C","E","F","H","G","L"],
  "BCDEFGIJ":["B","C","E","I","F","J","G","D"],
  "BCDEFGIK":["B","C","E","K","F","I","G","D"],
  "BCDEFGIL":["B","D","C","E","F","I","G","L"],
  "BCDEFGJK":["B","C","E","K","F","J","G","D"],
  "BCDEFGJL":["B","D","C","E","F","J","G","L"],
  "BCDEFGKL":["B","D","C","K","F","E","G","L"],
  "BCDEFHIJ":["B","C","E","H","F","I","J","D"],
  "BCDEFHIK":["B","C","E","K","F","H","I","D"],
  "BCDEFHIL":["B","D","C","E","F","H","I","L"],
  "BCDEFHJK":["B","C","E","K","F","H","J","D"],
  "BCDEFHJL":["B","D","C","E","F","H","J","L"],
  "BCDEFHKL":["B","D","C","K","E","H","F","L"],
  "BCDEFIJK":["B","C","E","K","F","I","J","D"],
  "BCDEFIJL":["B","D","C","E","F","I","J","L"],
  "BCDEFIKL":["B","D","C","K","E","I","F","L"],
  "BCDEFJKL":["B","D","C","K","E","J","F","L"],
  "BCDEGHIJ":["B","C","E","H","I","J","G","D"],
  "BCDEGHIK":["B","C","E","K","I","H","G","D"],
  "BCDEGHIL":["B","D","C","E","I","H","G","L"],
  "BCDEGHJK":["B","C","E","K","J","H","G","D"],
  "BCDEGHJL":["B","D","C","E","J","H","G","L"],
  "BCDEGHKL":["B","D","C","K","E","H","G","L"],
  "BCDEGIJK":["B","C","E","K","I","J","G","D"],
  "BCDEGIJL":["B","D","C","E","I","J","G","L"],
  "BCDEGIKL":["B","D","C","K","E","I","G","L"],
  "BCDEGJKL":["B","D","C","K","E","J","G","L"],
  "BCDEHIJK":["B","C","E","K","I","H","J","D"],
  "BCDEHIJL":["B","D","C","E","I","H","J","L"],
  "BCDEHIKL":["B","D","C","K","E","H","I","L"],
  "BCDEHJKL":["B","D","C","K","E","H","J","L"],
  "BCDEIJKL":["B","D","C","K","E","I","J","L"],
  "BCDFGHIJ":["B","C","F","H","I","J","G","D"],
  "BCDFGHIK":["B","C","F","K","I","H","G","D"],
  "BCDFGHIL":["B","D","C","H","F","I","G","L"],
  "BCDFGHJK":["B","C","F","K","J","H","G","D"],
  "BCDFGHJL":["B","D","C","H","F","J","G","L"],
  "BCDFGHKL":["B","D","C","K","F","H","G","L"],
  "BCDFGIJK":["B","C","F","K","I","J","G","D"],
  "BCDFGIJL":["B","D","C","I","F","J","G","L"],
  "BCDFGIKL":["B","D","C","K","F","I","G","L"],
  "BCDFGJKL":["B","D","C","K","F","J","G","L"],
  "BCDFHIJK":["B","C","F","K","I","H","J","D"],
  "BCDFHIJL":["B","D","C","H","F","I","J","L"],
  "BCDFHIKL":["B","D","C","K","F","H","I","L"],
  "BCDFHJKL":["B","D","C","K","F","H","J","L"],
  "BCDFIJKL":["B","D","C","K","F","I","J","L"],
  "BCDGHIJK":["B","C","H","K","I","J","G","D"],
  "BCDGHIJL":["B","D","C","H","I","J","G","L"],
  "BCDGHIKL":["B","D","C","K","I","H","G","L"],
  "BCDGHJKL":["B","D","C","K","J","H","G","L"],
  "BCDGIJKL":["B","D","C","K","I","J","G","L"],
  "BCDHIJKL":["B","D","C","K","I","H","J","L"],
  "BCEFGHIJ":["B","C","E","H","F","I","G","J"],
  "BCEFGHIK":["B","C","E","K","F","H","G","I"],
  "BCEFGHIL":["B","C","E","H","F","I","G","L"],
  "BCEFGHJK":["B","C","E","K","F","H","G","J"],
  "BCEFGHJL":["B","C","E","H","F","J","G","L"],
  "BCEFGHKL":["B","C","E","K","F","H","G","L"],
  "BCEFGIJK":["B","C","E","K","F","I","G","J"],
  "BCEFGIJL":["B","C","E","I","F","J","G","L"],
  "BCEFGIKL":["B","C","E","K","F","I","G","L"],
  "BCEFGJKL":["B","C","E","K","F","J","G","L"],
  "BCEFHIJK":["B","C","E","K","F","H","I","J"],
  "BCEFHIJL":["B","C","E","H","F","I","J","L"],
  "BCEFHIKL":["B","C","E","K","F","H","I","L"],
  "BCEFHJKL":["B","C","E","K","F","H","J","L"],
  "BCEFIJKL":["B","C","E","K","F","I","J","L"],
  "BCEGHIJK":["B","C","E","K","I","H","G","J"],
  "BCEGHIJL":["B","C","E","H","I","J","G","L"],
  "BCEGHIKL":["B","C","E","K","I","H","G","L"],
  "BCEGHJKL":["B","C","E","K","J","H","G","L"],
  "BCEGIJKL":["B","C","E","K","I","J","G","L"],
  "BCEHIJKL":["B","C","E","K","I","H","J","L"],
  "BCFGHIJK":["B","C","F","K","I","H","G","J"],
  "BCFGHIJL":["B","C","F","H","I","J","G","L"],
  "BCFGHIKL":["B","C","F","K","I","H","G","L"],
  "BCFGHJKL":["B","C","F","K","J","H","G","L"],
  "BCFGIJKL":["B","C","F","K","I","J","G","L"],
  "BCFHIJKL":["B","C","F","K","I","H","J","L"],
  "BCGHIJKL":["B","C","H","K","I","J","G","L"],
  "BDEFGHIJ":["B","D","E","H","F","I","G","J"],
  "BDEFGHIK":["B","D","E","K","F","H","G","I"],
  "BDEFGHIL":["B","D","E","H","F","I","G","L"],
  "BDEFGHJK":["B","D","E","K","F","H","G","J"],
  "BDEFGHJL":["B","D","E","H","F","J","G","L"],
  "BDEFGHKL":["B","D","E","K","F","H","G","L"],
  "BDEFGIJK":["B","D","E","K","F","I","G","J"],
  "BDEFGIJL":["B","D","E","I","F","J","G","L"],
  "BDEFGIKL":["B","D","E","K","F","I","G","L"],
  "BDEFGJKL":["B","D","E","K","F","J","G","L"],
  "BDEFHIJK":["B","D","E","K","F","H","I","J"],
  "BDEFHIJL":["B","D","E","H","F","I","J","L"],
  "BDEFHIKL":["B","D","E","K","F","H","I","L"],
  "BDEFHJKL":["B","D","E","K","F","H","J","L"],
  "BDEFIJKL":["B","D","E","K","F","I","J","L"],
  "BDEGHIJK":["B","D","E","K","I","H","G","J"],
  "BDEGHIJL":["B","D","E","H","I","J","G","L"],
  "BDEGHIKL":["B","D","E","K","I","H","G","L"],
  "BDEGHJKL":["B","D","E","K","J","H","G","L"],
  "BDEGIJKL":["B","D","E","K","I","J","G","L"],
  "BDEHIJKL":["B","D","E","K","I","H","J","L"],
  "BDFGHIJK":["B","D","F","K","I","H","G","J"],
  "BDFGHIJL":["B","D","F","H","I","J","G","L"],
  "BDFGHIKL":["B","D","F","K","I","H","G","L"],
  "BDFGHJKL":["B","D","F","K","J","H","G","L"],
  "BDFGIJKL":["B","D","F","K","I","J","G","L"],
  "BDFHIJKL":["B","D","F","K","I","H","J","L"],
  "BDGHIJKL":["B","D","H","K","I","J","G","L"],
  "BEFGHIJK":["B","F","E","K","I","H","G","J"],
  "BEFGHIJL":["B","F","E","H","I","J","G","L"],
  "BEFGHIKL":["B","F","E","K","I","H","G","L"],
  "BEFGHJKL":["B","F","E","K","J","H","G","L"],
  "BEFGIJKL":["B","F","E","K","I","J","G","L"],
  "BEFHIJKL":["B","F","E","K","I","H","J","L"],
  "BEGHIJKL":["B","G","E","K","I","H","J","L"],
  "BFGHIJKL":["B","F","H","K","I","J","G","L"],
  "CDEFGHIJ":["C","D","E","H","F","I","G","J"],
  "CDEFGHIK":["C","D","E","K","F","H","G","I"],
  "CDEFGHIL":["C","D","E","H","F","I","G","L"],
  "CDEFGHJK":["C","D","E","K","F","H","G","J"],
  "CDEFGHJL":["C","D","E","H","F","J","G","L"],
  "CDEFGHKL":["C","D","E","K","F","H","G","L"],
  "CDEFGIJK":["C","D","E","K","F","I","G","J"],
  "CDEFGIJL":["C","D","E","I","F","J","G","L"],
  "CDEFGIKL":["C","D","E","K","F","I","G","L"],
  "CDEFGJKL":["C","D","E","K","F","J","G","L"],
  "CDEFHIJK":["C","D","E","K","F","H","I","J"],
  "CDEFHIJL":["C","D","E","H","F","I","J","L"],
  "CDEFHIKL":["C","D","E","K","F","H","I","L"],
  "CDEFHJKL":["C","D","E","K","F","H","J","L"],
  "CDEFIJKL":["C","D","E","K","F","I","J","L"],
  "CDEGHIJK":["C","D","E","K","I","H","G","J"],
  "CDEGHIJL":["C","D","E","H","I","J","G","L"],
  "CDEGHIKL":["C","D","E","K","I","H","G","L"],
  "CDEGHJKL":["C","D","E","K","J","H","G","L"],
  "CDEGIJKL":["C","D","E","K","I","J","G","L"],
  "CDEHIJKL":["C","D","E","K","I","H","J","L"],
  "CDFGHIJK":["C","D","F","K","I","H","G","J"],
  "CDFGHIJL":["C","D","F","H","I","J","G","L"],
  "CDFGHIKL":["C","D","F","K","I","H","G","L"],
  "CDFGHJKL":["C","D","F","K","J","H","G","L"],
  "CDFGIJKL":["C","D","F","K","I","J","G","L"],
  "CDFHIJKL":["C","D","F","K","I","H","J","L"],
  "CDGHIJKL":["C","D","H","K","I","J","G","L"],
  "CEFGHIJK":["C","F","E","K","I","H","G","J"],
  "CEFGHIJL":["C","F","E","H","I","J","G","L"],
  "CEFGHIKL":["C","F","E","K","I","H","G","L"],
  "CEFGHJKL":["C","F","E","K","J","H","G","L"],
  "CEFGIJKL":["C","F","E","K","I","J","G","L"],
  "CEFHIJKL":["C","F","E","K","I","H","J","L"],
  "CEGHIJKL":["C","G","E","K","I","H","J","L"],
  "CFGHIJKL":["C","F","H","K","I","J","G","L"],
  "DEFGHIJK":["D","F","E","K","I","H","G","J"],
  "DEFGHIJL":["D","F","E","H","I","J","G","L"],
  "DEFGHIKL":["D","F","E","K","I","H","G","L"],
  "DEFGHJKL":["D","F","E","K","J","H","G","L"],
  "DEFGIJKL":["D","F","E","K","I","J","G","L"],
  "DEFHIJKL":["D","F","E","K","I","H","J","L"],
  "DEGHIJKL":["D","G","E","K","I","H","J","L"],
  "DFGHIJKL":["D","F","H","K","I","J","G","L"],
  "EFGHIJKL":["F","G","E","K","I","H","J","L"]
};

  // Resolver asignación de terceros usando tabla FIFA
  const thirdKey = bestThirds.map(t=>t.from).sort().join("");
  const thirdAssign = THIRDS_TABLE[thirdKey] || [];
  // thirdAssign[i] = grupo del 3ro que va al slot i (orden: M74,M77,M79,M80,M81,M82,M85,M87)
  function pick3rdBySlot(slotIndex){
    const grp = thirdAssign[slotIndex];
    return bestThirds.find(t=>t.from===grp) || bestThirds[0];
  }

  const r32=[];
  // M73: 2A vs 2B
  r32.push({slot:"M73", match:73, home:seconds["A"], away:seconds["B"]});
  // M74: 1E vs 3° de A/B/C/D/F
  r32.push({slot:"M74", match:74, home:firsts["E"], away:pick3rdBySlot(0)});
  // M75: 1F vs 2C
  r32.push({slot:"M75", match:75, home:firsts["F"], away:seconds["C"]});
  // M76: 1C vs 2F
  r32.push({slot:"M76", match:76, home:firsts["C"], away:seconds["F"]});
  // M77: 1I vs 3° de C/D/F/G/H
  r32.push({slot:"M77", match:77, home:firsts["I"], away:pick3rdBySlot(1)});
  // M78: 2E vs 2I
  r32.push({slot:"M78", match:78, home:seconds["E"], away:seconds["I"]});
  // M79: 1A vs 3° de C/E/F/H/I
  r32.push({slot:"M79", match:79, home:firsts["A"], away:pick3rdBySlot(2)});
  // M80: 1L vs 3° de E/H/I/J/K
  r32.push({slot:"M80", match:80, home:firsts["L"], away:pick3rdBySlot(3)});
  // M81: 1D vs 3° de B/E/F/I/J
  r32.push({slot:"M81", match:81, home:firsts["D"], away:pick3rdBySlot(4)});
  // M82: 1G vs 3° de A/E/H/I/J
  r32.push({slot:"M82", match:82, home:firsts["G"], away:pick3rdBySlot(5)});
  // M83: 2K vs 2L
  r32.push({slot:"M83", match:83, home:seconds["K"], away:seconds["L"]});
  // M84: 1H vs 2J
  r32.push({slot:"M84", match:84, home:firsts["H"], away:seconds["J"]});
  // M85: 1B vs 3° de E/F/G/I/J
  r32.push({slot:"M85", match:85, home:firsts["B"], away:pick3rdBySlot(6)});
  // M86: 1J vs 2H
  r32.push({slot:"M86", match:86, home:firsts["J"], away:seconds["H"]});
  // M87: 1K vs 3° de D/E/I/J/L
  r32.push({slot:"M87", match:87, home:firsts["K"], away:pick3rdBySlot(7)});
  // M88: 2D vs 2G
  r32.push({slot:"M88", match:88, home:seconds["D"], away:seconds["G"]});
  // total: 16 cruces ✓

  return { groupTable, firsts, seconds, thirds, bestThirds, droppedThirds, r32 };
}

/* Avanzar bracket: dada una etapa actual y las predicciones del jugador,
   devuelve los cruces de la siguiente etapa. */
function advanceBracket(currentMatches, mainPreds){
  // currentMatches: [{slot, home, away}, ...] con un nro par
  // mainPreds: marcadores cargados (los IDs los manejamos en otra parte)
  // Devuelve la siguiente ronda con [{slot, home:ganador1, away:ganador2}]
  // Esta función auxiliar la usaremos cuando la UI confirme cada etapa.
  const next=[];
  for(let i=0;i<currentMatches.length;i+=2){
    next.push({
      slot:`NEXT-${i/2+1}`,
      home:null, // se llenará con el ganador del cruce i
      away:null, // se llenará con el ganador del cruce i+1
    });
  }
  return next;
}

/* =====================================================================
   FLUJO DE ETAPAS de la Tarjeta Principal
   =====================================================================
   Stages: "grupos" → "r32" → "r16" → "qf" → "sf" → "tpfinal" (3er puesto + final juntos)
   Cada etapa tiene su propio cierre. Una etapa solo se puede cargar si la
   anterior fue confirmada (sent_at.<etapa> != null).
   ===================================================================== */
const STAGES = ["grupos","r32","r16","qf","sf","tpfinal"];
const STAGE_LABEL = {
  grupos:"Fase de Grupos", r32:"Ronda de 32", r16:"Octavos de Final",
  qf:"Cuartos de Final", sf:"Semifinales", tpfinal:"3er Puesto y Final"
};
function stageSent(stage){
  return !!(APP.myPred?.sent_at||{})[stage];
}
// la etapa actualmente "activa" (la que se puede cargar)
function currentStage(){
  for(const s of STAGES){ if(!stageSent(s)) return s; }
  return null; // todas enviadas
}
// ¿la etapa anterior está enviada? (para habilitar la actual)
function canEnterStage(stage){
  const i = STAGES.indexOf(stage);
  if(i<=0) return true;
  return stageSent(STAGES[i-1]);
}

/* Al confirmar GRUPOS: calcular bracket inicial (R32) y guardarlo. */
async function sendStageGrupos(){
  if(stageSent("grupos")) throw new Error("Grupos ya enviado.");
  const main = APP.myPred?.main || {};
  // verificar que todos los partidos de grupos tengan marcador
  const grupos = FIXTURE.filter(m=>m.phase==="grupos");
  for(const m of grupos){
    const p=main[m.id];
    if(!p || p.h===""||p.h==null||p.a===""||p.a==null)
      throw new Error("Faltan partidos de grupos por cargar.");
  }
  // calcular bracket inicial
  const b = computeBracket(main);
  const bracket = {
    r32: b.r32.map((c,i)=>({id:`r32-${i+1}`, home:c.home.team, away:c.away.team, h:0, a:0, pen:""})),
    r16:[], qf:[], sf:[], tp:null, final:null,
    standings: b.groupTable, // útil para puntos extra de cuadro
    bestThirds: b.bestThirds.map(t=>t.team),
  };
  const sent_at = {...(APP.myPred.sent_at||{}), grupos: new Date().toISOString()};
  const {data,error}=await sb.from('predictions').update({bracket, sent_at}).eq('user_id',APP.user.id).select().maybeSingle();
  if(error) throw error; APP.myPred=data; return data;
}

/* Confirmar etapa eliminatoria: tomar ganadores y armar la siguiente. */
async function sendStageElim(stage){
  if(stageSent(stage)) throw new Error("Esta etapa ya fue enviada.");
  if(!canEnterStage(stage)) throw new Error("No podés enviar esta etapa todavía.");
  const bracket = {...(APP.myPred?.bracket||{})};
  const matches = bracket[stage]||[];
  // verificar que cada cruce tenga ganador definido
  const winners=[];
  for(const m of matches){
    if(m.h==null||m.h===""||m.a==null||m.a==="")
      throw new Error("Faltan marcadores por cargar.");
    const h=+m.h, a=+m.a;
    if(h>a) winners.push(m.home);
    else if(h<a) winners.push(m.away);
    else {
      if(m.pen!=="1"&&m.pen!=="0") throw new Error("Hay empates sin definir ganador por penales.");
      winners.push(m.pen==="1"?m.home:m.away);
    }
  }
  // armar siguiente etapa con cruces OFICIALES FIFA
  // R32→R16: M74vsM77, M73vsM75, M76vsM78, M79vsM80, M83vsM84, M81vsM82, M86vsM88, M85vsM87
  // R16→QF:  M89vsM90, M93vsM94, M91vsM92, M95vsM96
  // QF→SF:   M97vsM98, M99vsM100
  const FIFA_PAIRS = {
    r32: [[1,4],[0,2],[3,5],[6,7],[10,11],[8,9],[13,15],[12,14]],
    r16: [[0,1],[4,5],[2,3],[6,7]],
    qf:  [[0,1],[2,3]],
  };
  const NEXT={r32:"r16", r16:"qf", qf:"sf"};
  if(stage in NEXT){
    const nextKey=NEXT[stage];
    const pairs=FIFA_PAIRS[stage];
    bracket[nextKey] = pairs.map((pair,i)=>({
      id:`${nextKey}-${i+1}`,
      home:winners[pair[0]],
      away:winners[pair[1]],
      h:0, a:0, pen:""
    }));
  } else if(stage==="sf"){
    // los GANADORES de SF van a la FINAL; los perdedores al 3er puesto
    const losers=[];
    matches.forEach(m=>{
      const h=+m.h, a=+m.a;
      if(h>a) losers.push(m.away);
      else if(h<a) losers.push(m.home);
      else losers.push(m.pen==="1"?m.away:m.home);
    });
    bracket.final = {id:"final-1", home:winners[0], away:winners[1], h:0, a:0, pen:""};
    bracket.tp = {id:"tp-1", home:losers[0], away:losers[1], h:0, a:0, pen:""};
  }
  // bracket queda actualizado; el "tpfinal" combina 3er puesto + final (se cargan juntos)
  const sent_at = {...(APP.myPred.sent_at||{}), [stage]: new Date().toISOString()};
  // si es la última etapa (tpfinal), marcamos main_sent y locked si wasabi también
  let patch = {bracket, sent_at};
  if(stage==="tpfinal"){
    patch.sent_at.main = new Date().toISOString();
    if(sent_at.wasabi) patch.locked = true;
  }
  const {data,error}=await sb.from('predictions').update(patch).eq('user_id',APP.user.id).select().maybeSingle();
  if(error) throw error; APP.myPred=data; return data;
}

/* Cargar un marcador en un cruce de eliminatoria */
async function setBracketScore(stage, slotId, key, value){
  if(stageSent(stage)) throw new Error("Esta etapa ya fue enviada.");
  const bracket = {...(APP.myPred?.bracket||{})};
  // tpfinal usa 'tp' o 'final' como key
  let arr;
  if(stage==="tpfinal"){
    if(slotId.startsWith("tp")){ bracket.tp = {...bracket.tp, [key]:value}; }
    else { bracket.final = {...bracket.final, [key]:value}; }
  } else {
    arr = (bracket[stage]||[]).map(m=> m.id===slotId ? {...m, [key]:value} : m);
    bracket[stage] = arr;
  }
  const {data,error}=await sb.from('predictions').update({bracket}).eq('user_id',APP.user.id).select().maybeSingle();
  if(error) throw error; APP.myPred=data; return data;
}
