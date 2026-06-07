/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — NÚCLEO (Supabase + motor de puntajes)
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
  const {data}=await sb.auth.getUser();
  APP.user=data?.user||null;
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
  // perfiles (todos, para la tabla)
  const {data:profs}=await sb.from('profiles').select('*');
  APP.profiles=profs||[];
  // mis predicciones
  const {data:mp}=await sb.from('predictions').select('*').eq('user_id',APP.user.id).maybeSingle();
  APP.myPred=mp||null;
  // resultados
  const {data:rs}=await sb.from('results').select('*').eq('id',1).maybeSingle();
  if(rs) APP.results=rs;
  // comodines
  const {data:cm}=await sb.from('comodines').select('*').order('created_at');
  APP.comodines=cm||[];
  // si es admin: cargar pagos (privados) y todas las predicciones de todos
  if(APP.profile?.is_admin){ await loadPayments(); await adminLoadAllPreds(); }
  // snapshots de posiciones (para las flechas ▲▼) — crea los que falten si ya cerró la fecha
  await syncSnapshots();
}

async function ensureMyPredRow(){
  if(APP.myPred) return APP.myPred;
  const {data,error}=await sb.from('predictions').upsert({user_id:APP.user.id},{onConflict:'user_id',ignoreDuplicates:true}).select().maybeSingle();
  if(error) throw error; APP.myPred=data; return data;
}
async function saveMyPred(patch){
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
  const {error}=await sb.from('results').update({...patch,updated_at:new Date().toISOString()}).eq('id',1);
  if(error) throw error; await loadAll();
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
  const day = todayDayKey();
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
  let pt=0; const ps=sign(pred.h,pred.a), rs=sign(res.h,res.a);
  if(+pred.h===+res.h&&+pred.a===+res.a) pt+=PTS.grupos.exact;
  else { if(ps&&ps===rs) pt+=PTS.grupos.result;
         if((+pred.h-+pred.a)===(+res.h-+res.a)) pt+=PTS.grupos.gd; }
  return pt;
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
  const matches = FIXTURE.filter(m=>m.kickoff && dayKey(m.kickoff)===day);
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
  // sumar puntos por todos los días que tienen partidos
  const allDays = new Set();
  FIXTURE.forEach(m=>{ if(m.kickoff) allDays.add(dayKey(m.kickoff)); });
  // (cálculo "base" por día, sin nitros aún) — pero como mainPointsByDate ya cubre todas
  // las fases en su conjunto, mantenemos el cálculo agregado base + ajustes diarios:
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
      else if(pBy<pTg) delta-=Math.round(pTg*0.5);
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
function autoWasabiAnswers(){
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
      if(w[q.id]!=null&&w[q.id]!==""&&norm(w[q.id])===norm(res[q.id])) total+=q.pts;
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
  if(!rows.length) return {};
  // Si el máximo puntaje es 0, no hay posiciones reales todavía
  if(rows[0].total === 0) return {};
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
  return ans;
}

function wasabiTotal(uid){
  const w=(predFor(uid).wasabi)||{}, res=APP.results.wasabi||{}; let pts=0;
  // respuestas automáticas de w5-w8 (calculadas con tabla parcial)
  const auto = autoWasabiAnswers();
  const profile = APP.profiles.find(p=>p.id===uid);
  APP.wasabiQs.forEach(q=>{
    if(q.type==="bonus"){ if(res["bonus_"+q.id]===uid) pts+=q.pts; return; }
    // preguntas auto (5-8): suman si el jugador respondió alguno de los nombres correctos
    if(["w5","w6","w7","w8"].includes(q.id)){
      const correctNames = auto[q.id]||[];
      if(!correctNames.length) return; // sin respuesta correcta (ej. anuladas por empate)
      const ans = w[q.id];
      if(ans && correctNames.some(n=>norm(n)===norm(ans))) pts+=q.pts;
      return;
    }
    if(res[q.id]==null||res[q.id]==="") return;
    if(w[q.id]!=null&&w[q.id]!==""&&norm(w[q.id])===norm(res[q.id])) pts+=q.pts;
  });
  return pts;
}
function penaltyTotal(uid){
  const pred=predFor(uid);
  const pens=pred.penalties||[];
  return pens.reduce((s,p)=>s+(+p.pts||0),0);
}
function grandTotal(uid){ return mainTotal(uid)+extraTotal(uid)+wasabiTotal(uid)-penaltyTotal(uid); }
function norm(s){ return String(s).trim().toLowerCase(); }

/* devuelve las predicciones de un uid (admin tiene todas; jugador solo la suya) */
const _predCache={};
function predFor(uid){
  if(uid===APP.user?.id && APP.myPred) return APP.myPred;
  return _predCache[uid]||{main:{},extra:{},wasabi:{}};
}

/* tabla de posiciones (solo JUGADORES, no admins) — con posiciones compartidas */
function standings(){
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
  // zona por tercios: elite / midfield / pobreza
  const n=rows.length, tercio=Math.ceil(n/3);
  rows.forEach((r,i)=>{ r.zone = i<tercio?"elite" : i<tercio*2?"midfield" : "pobreza"; });
  // flechas: comparar contra el último snapshot guardado
  const prev=APP.lastSnapshot||null;
  rows.forEach(r=>{
    if(prev && prev[r.id]!=null){ r.move = prev[r.id]-r.pos; } // +sube, -baja, 0 igual
    else r.move = null; // sin referencia previa
  });
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
    const now=Date.now();
    let lastClosedKey=null;
    for(const d of allDateKeys()){
      const end=dateEndKickoff(d.phase,d.jor);
      if(end && now>end.getTime()){
        lastClosedKey=d.key;
        if(!have[d.key]){
          // crear snapshot de esta fecha cerrada
          const pos=currentPositions();
          await sb.from('standings_snapshots').insert({date_key:d.key,positions:pos});
          have[d.key]=pos;
        }
      }
    }
    // la "foto anterior" para las flechas = penúltima fecha cerrada
    const closed=allDateKeys().filter(d=>{const e=dateEndKickoff(d.phase,d.jor);return e&&now>e.getTime();});
    if(closed.length>=2) APP.lastSnapshot=have[closed[closed.length-2].key]||null;
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

// ¿hay partidos hoy de la fase X?
function phaseOfDay(day){
  // miramos qué FIXTURE tiene kickoff en ese día calendario; devolvemos su fase (o null)
  const m = FIXTURE.find(mt=>{ const k=mt.kickoff; return k && dayKey(k)===day; });
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
  return FIXTURE.some(m=>m.kickoff && dayKey(m.kickoff)===day);
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
  const day = todayDayKey();
  if(!dayHasMatches(day)) return "Hoy no hay partidos del Mundial. Los comodines solo se piden los días que se juega.";
  if(!windowOpenNow()) return "La ventana de comodines es de 6:00 a 12:00 (hora argentina). Está cerrada ahora.";
  return null;
}

// ¿el usuario fue retado en partido alguno de hoy?
function wasChallengedToday(uid){
  const day=todayDayKey();
  return APP.comodines.find(c=>c.type==="sang"&&c.target_user===uid&&c.day===day);
}
function askedNitroToday(uid){
  const day=todayDayKey();
  return APP.comodines.find(c=>c.type==="nitro"&&c.by_user===uid&&c.day===day);
}
function askedSangToday(uid){
  const day=todayDayKey();
  return APP.comodines.find(c=>c.type==="sang"&&c.by_user===uid&&c.day===day);
}

function validateSang(by,target){
  if(by===target) return "No podés retarte a vos mismo.";
  const winErr=windowErrorToday(); if(winErr) return winErr;
  const day=todayDayKey(); const phase=phaseOfDay(day);
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
  const day=todayDayKey(); const phase=phaseOfDay(day);
  if(!phase) return "No hay partidos hoy.";
  const q=quotaLeft(by,"nitro");
  const qKey = phase==="tp"||phase==="final" ? "finals" : phase;
  if(q[qKey]<=0) return "Ya usaste tus 2 nitros de esta fase.";
  if(askedNitroToday(by)) return "Ya tenés un nitro pedido para hoy.";
  if(askedSangToday(by)) return "No podés usar Nitro y Sanguijuela el mismo día.";
  if(wasChallengedToday(by)) return "Fuiste retado hoy: no podés usar Nitro.";
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
  thirds.sort((a,b)=> b.pts-a.pts || b.dg-a.dg || b.gf-a.gf || a.team.localeCompare(b.team));
  const bestThirds = thirds.slice(0,8); // los 8 que clasifican
  const droppedThirds = thirds.slice(8); // 4 que quedan eliminados

  // 4) BRACKET de R32 - cruces OFICIALES FIFA 2026
  // Fuente: fixture oficial FIFA (partidos 73-88)
  // Cruces fijos (1° vs 2°): M73,75,76,78,83,84,86,88
  // Cruces 1° vs 3° (Anexo C): M74,77,79,80,81,82,85,87
  // Para los 3ros: asignamos el mejor 3ro disponible cuyo grupo origen
  // esté en la lista permitida para ese slot (sin rematchar contra su propio grupo)

  // Helper: toma el mejor 3ro disponible de una lista de grupos permitidos
  const usedThirds = new Set();
  function pick3rd(allowedGroups){
    // bestThirds ya está ordenado de mejor a peor
    for(const t of bestThirds){
      if(!usedThirds.has(t.from) && allowedGroups.includes(t.from)){
        usedThirds.add(t.from);
        return t;
      }
    }
    // fallback: cualquier 3ro no usado
    for(const t of bestThirds){
      if(!usedThirds.has(t.from)){
        usedThirds.add(t.from);
        return t;
      }
    }
    return bestThirds[0];
  }

  const r32=[];
  // M73: 2A vs 2B
  r32.push({slot:"M73", match:73, home:seconds["A"], away:seconds["B"]});
  // M74: 1E vs 3° de A/B/C/D/F
  r32.push({slot:"M74", match:74, home:firsts["E"], away:pick3rd(["A","B","C","D","F"])});
  // M75: 1F vs 2C
  r32.push({slot:"M75", match:75, home:firsts["F"], away:seconds["C"]});
  // M76: 1C vs 2F
  r32.push({slot:"M76", match:76, home:firsts["C"], away:seconds["F"]});
  // M77: 1I vs 3° de C/D/F/G/H
  r32.push({slot:"M77", match:77, home:firsts["I"], away:pick3rd(["C","D","F","G","H"])});
  // M78: 2E vs 2I
  r32.push({slot:"M78", match:78, home:seconds["E"], away:seconds["I"]});
  // M79: 1A vs 3° de C/E/F/H/I
  r32.push({slot:"M79", match:79, home:firsts["A"], away:pick3rd(["C","E","F","H","I"])});
  // M80: 1L vs 3° de E/H/I/J/K
  r32.push({slot:"M80", match:80, home:firsts["L"], away:pick3rd(["E","H","I","J","K"])});
  // M81: 1D vs 3° de B/E/F/I/J
  r32.push({slot:"M81", match:81, home:firsts["D"], away:pick3rd(["B","E","F","I","J"])});
  // M82: 1G vs 3° de A/E/H/I/J
  r32.push({slot:"M82", match:82, home:firsts["G"], away:pick3rd(["A","E","H","I","J"])});
  // M83: 2K vs 2L
  r32.push({slot:"M83", match:83, home:seconds["K"], away:seconds["L"]});
  // M84: 1H vs 2J
  r32.push({slot:"M84", match:84, home:firsts["H"], away:seconds["J"]});
  // M85: 1B vs 3° de E/F/G/I/J
  r32.push({slot:"M85", match:85, home:firsts["B"], away:pick3rd(["E","F","G","I","J"])});
  // M86: 1J vs 2H
  r32.push({slot:"M86", match:86, home:firsts["J"], away:seconds["H"]});
  // M87: 1K vs 3° de D/E/I/J/L
  r32.push({slot:"M87", match:87, home:firsts["K"], away:pick3rd(["D","E","I","J","L"])});
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
  // armar siguiente etapa (con marcadores por default 0-0)
  const NEXT={r32:"r16", r16:"qf", qf:"sf"};
  if(stage in NEXT){
    const nextKey=NEXT[stage];
    bracket[nextKey] = [];
    for(let i=0;i<winners.length;i+=2){
      bracket[nextKey].push({id:`${nextKey}-${i/2+1}`, home:winners[i], away:winners[i+1], h:0, a:0, pen:""});
    }
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
