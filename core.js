/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — NÚCLEO (Supabase + motor de puntajes)
   ===================================================================== */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* estado en memoria */
const APP = {
  user:null, profile:null,
  myPred:null,
  profiles:[], results:{main:{},extra:{},wasabi:{},picada:{}},
  comodines:[], picadaQ:SEED_PICADA, wasabiQs:[...SEED_WASABI],
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
  // preguntas guardadas en results.wasabi meta (si el admin las editó) — simplificado: usamos seeds
}

async function ensureMyPredRow(){
  if(APP.myPred) return APP.myPred;
  const {data,error}=await sb.from('predictions').insert({user_id:APP.user.id}).select().maybeSingle();
  if(error) throw error; APP.myPred=data; return data;
}
async function saveMyPred(patch){
  await ensureMyPredRow();
  const {data,error}=await sb.from('predictions').update(patch).eq('user_id',APP.user.id).select().maybeSingle();
  if(error) throw error; APP.myPred=data; return data;
}
async function lockMyPred(){
  const {data,error}=await sb.from('predictions').update({locked:true}).eq('user_id',APP.user.id).select().maybeSingle();
  if(error) throw error; APP.myPred=data; return data;
}

/* ---------- ADMIN ---------- */
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
  await sb.from('profiles').update({paid}).eq('id',uid); await loadAll();
}

/* ---------- COMODINES ---------- */
async function requestComodin(type, targetUser, phase, jor, kickoff){
  const {error}=await sb.from('comodines').insert({
    type, by_user:APP.user.id, target_user:targetUser||null, phase, jor:jor||null, match_kickoff:kickoff||null
  });
  if(error) throw error; await loadAll();
}

/* =====================================================================
   MOTOR DE PUNTAJES (reglamento 2026)
   ===================================================================== */
function sign(h,a){ if(h==null||a==null||h===""||a==="")return null; h=+h;a=+a; return h>a?"1":h<a?"2":"X"; }

function matchPoints(pred,res,phase){
  if(!pred||!res) return 0;
  if(res.h==null||res.h===""||res.a==null||res.a==="") return 0;
  let pt=0; const ps=sign(pred.h,pred.a), rs=sign(res.h,res.a);
  if(phase==="grupos"){
    if(+pred.h===+res.h&&+pred.a===+res.a) pt+=PTS.grupos.exact;
    else { if(ps&&ps===rs) pt+=PTS.grupos.result;
           if((+pred.h-+pred.a)===(+res.h-+res.a)) pt+=PTS.grupos.gd; }
  } else {
    const exact=(+pred.h===+res.h&&+pred.a===+res.a);
    if(exact) pt+=PTS.ko.exact; else if(ps&&ps===rs) pt+=PTS.ko.result;
    let pAdv=ps==="1"?"h":ps==="2"?"a":(pred.pen==="1"?"h":pred.pen==="0"?"a":null);
    let rAdv=rs==="1"?"h":rs==="2"?"a":(res.pen==="1"?"h":res.pen==="0"?"a":null);
    if(pAdv&&rAdv&&pAdv===rAdv&&!exact) pt+=PTS.ko.advance;
  }
  return pt;
}

/* puntos de la Principal por fecha (sin extras), para un set de predicciones */
function mainPointsByDate(pred, phase, jor){
  const m=(pred&&pred.main)||{}, res=APP.results.main||{}; let pts=0;
  FIXTURE.forEach(mt=>{
    const same = phase==="grupos" ? (mt.phase==="grupos"&&mt.jor===jor) : (mt.phase===phase);
    if(!same) return;
    pts+=matchPoints(m[mt.id],res[mt.id],mt.phase);
  });
  return pts;
}

const ALL_DATES=[{phase:"grupos",jor:1},{phase:"grupos",jor:2},{phase:"grupos",jor:3},
  {phase:"r32"},{phase:"r16"},{phase:"qf"},{phase:"sf"},{phase:"tp"},{phase:"final"}];
function sameDate(c,d){ return c.phase==="grupos"&&d.phase==="grupos" ? c.jor===d.jor : c.phase===d.phase; }

/* total Principal con nitros + sanguijuelas para un usuario */
function mainTotal(uid){
  const pred=predFor(uid); let total=0;
  ALL_DATES.forEach(d=>{
    let base=mainPointsByDate(pred,d.phase,d.jor);
    if(APP.comodines.some(c=>c.type==="nitro"&&c.by_user===uid&&sameDate(c,d))) base*=3;
    total+=base;
  });
  total+=sangDelta(uid);
  return total;
}
function sangDelta(uid){
  let delta=0;
  APP.comodines.filter(c=>c.type==="sang").forEach(c=>{
    const d=c.phase==="grupos"?{phase:"grupos",jor:c.jor}:{phase:c.phase};
    const pBy=mainPointsByDate(predFor(c.by_user),d.phase,d.jor);
    const pTg=mainPointsByDate(predFor(c.target_user),d.phase,d.jor);
    if(c.by_user===uid){ if(pBy>pTg) delta+=pTg; else if(pBy<pTg) delta-=Math.round(pTg*0.5); }
    if(c.target_user===uid){ if(pBy>pTg) delta-=pTg; }
  });
  return delta;
}
function extraTotal(uid){
  const ex=(predFor(uid).extra)||{}, res=APP.results.extra||{}; let pts=0;
  Object.keys(PTS.extra).forEach(k=>{ if(res[k]&&ex[k]&&norm(ex[k])===norm(res[k])) pts+=PTS.extra[k]; });
  return pts;
}
function wasabiTotal(uid){
  const w=(predFor(uid).wasabi)||{}, res=APP.results.wasabi||{}; let pts=0;
  APP.wasabiQs.forEach(q=>{
    if(q.type==="bonus"){ if(res["bonus_"+q.id]===uid) pts+=q.pts; return; }
    if(res[q.id]==null||res[q.id]==="") return;
    if(w[q.id]!=null&&w[q.id]!==""&&norm(w[q.id])===norm(res[q.id])) pts+=q.pts;
  });
  return pts;
}
function picadaTotal(uid){
  const p=(predFor(uid).picada)||{}, res=APP.results.picada||{}; const q=APP.picadaQ;
  if(res[q.id]==null||res[q.id]==="") return 0;
  return (p[q.id]!=null&&norm(p[q.id])===norm(res[q.id]))?q.pts:0;
}
function grandTotal(uid){ return mainTotal(uid)+extraTotal(uid)+wasabiTotal(uid)+picadaTotal(uid); }
function norm(s){ return String(s).trim().toLowerCase(); }

/* devuelve las predicciones de un uid (admin tiene todas; jugador solo la suya) */
const _predCache={};
function predFor(uid){
  if(uid===APP.user?.id && APP.myPred) return APP.myPred;
  return _predCache[uid]||{main:{},extra:{},wasabi:{},picada:{}};
}

/* tabla de posiciones (con posiciones compartidas) */
function standings(){
  const rows=APP.profiles.map(p=>({
    id:p.id, name:p.display_name, paid:p.paid, isBot:p.is_bot,
    main:mainTotal(p.id), extra:extraTotal(p.id),
    wasabi:wasabiTotal(p.id), picada:picadaTotal(p.id), total:grandTotal(p.id)
  }));
  rows.sort((a,b)=>b.total-a.total);
  let pos=0,last=null,seen=0;
  rows.forEach(r=>{seen++; if(r.total!==last){pos=seen;last=r.total;} r.pos=pos;});
  return rows;
}

/* =====================================================================
   VALIDACIÓN DE COMODINES (reglamento 2026)
   ===================================================================== */
function quotaLeft(uid,type){
  const g=APP.comodines.filter(c=>c.type===type&&c.by_user===uid&&c.phase==="grupos").length;
  const k=APP.comodines.filter(c=>c.type===type&&c.by_user===uid&&c.phase!=="grupos").length;
  return { grupos:Math.max(0,2-g), elim:Math.max(0,2-k) }; // 2 por fase en 2026
}
// kickoff de la "fecha" = primer partido de esa jornada/fase
function kickoffOfDate(phase,jor){
  const ms=FIXTURE.filter(m=> phase==="grupos" ? (m.phase==="grupos"&&m.jor===jor) : m.phase===phase);
  const times=ms.map(m=>m.kickoff).filter(Boolean).map(t=>new Date(t).getTime());
  return times.length?new Date(Math.min(...times)).toISOString():null;
}
// ¿pasó el corte de 1h antes del primer partido de esa fecha?
function pastCutoff(phase,jor){
  const ko=kickoffOfDate(phase,jor); if(!ko) return false; // sin horario cargado, no se bloquea
  return Date.now() > (new Date(ko).getTime() - REGLAMENTO_2026.corteHoras*3600*1000);
}
function dateUsed(uid,phase,jor){ // ¿ya pidió algún comodín en esa fecha?
  return APP.comodines.find(c=>c.by_user===uid&&sameDate(c,{phase,jor}));
}
function wasChallenged(uid,phase,jor){ // ¿fue retado en esa fecha?
  return APP.comodines.find(c=>c.type==="sang"&&c.target_user===uid&&sameDate(c,{phase,jor}));
}
function askedNitro(uid,phase,jor){
  return APP.comodines.find(c=>c.type==="nitro"&&c.by_user===uid&&sameDate(c,{phase,jor}));
}

function validateSang(by,target,phase,jor){
  if(by===target) return "No podés retarte a vos mismo.";
  if(pastCutoff(phase,jor)) return "Pasó el límite (1 h antes del primer partido de esa fecha).";
  const tb=standings(); const me=tb.find(r=>r.id===by), tg=tb.find(r=>r.id===target);
  if(me.pos===1) return "El que va primero no puede retar.";
  const diff=me.pos-tg.pos;
  if(diff<=0) return "Solo podés retar a alguien por encima tuyo.";
  if(diff>3) return "Solo podés retar hasta 3 posiciones por encima."; // 2026: 3 posiciones
  const isG=phase==="grupos"; const q=quotaLeft(by,"sang");
  if(isG&&q.grupos<=0) return "Ya usaste tus 2 sanguijuelas de esta fase.";
  if(!isG&&q.elim<=0) return "Ya usaste tus 2 sanguijuelas de esta fase.";
  // interacción 2026: no sang+nitro misma fecha
  if(askedNitro(by,phase,jor)) return "No podés usar Sanguijuela y Nitro en la misma fecha.";
  // no retar a quien pidió nitro
  if(askedNitro(target,phase,jor)) return "No podés retar a quien pidió Nitro en esa fecha (perderías la sanguijuela).";
  // target no retado 2 veces por la misma persona en la fase
  const tgByMe=APP.comodines.filter(c=>c.type==="sang"&&c.target_user===target&&c.by_user===by&&((isG&&c.phase==="grupos")||(!isG&&c.phase!=="grupos")));
  if(tgByMe.length>=2) return "No podés retar más de 2 veces a la misma persona en una fase.";
  // un jugador no puede ser retado por 2 a la vez en la misma fecha
  if(wasChallenged(target,phase,jor)) return "Ese jugador ya fue retado por otro en esa fecha (vale el primer aviso).";
  return null;
}
function validateNitro(by,phase,jor){
  if(pastCutoff(phase,jor)) return "Pasó el límite (1 h antes del primer partido de esa fecha).";
  const isG=phase==="grupos"; const q=quotaLeft(by,"nitro");
  if(isG&&q.grupos<=0) return "Ya usaste tus 2 nitros de esta fase.";
  if(!isG&&q.elim<=0) return "Ya usaste tus 2 nitros de esta fase.";
  if(askedNitro(by,phase,jor)) return "Ya tenés un nitro en esa fecha.";
  // interacción 2026
  const sangSame=APP.comodines.find(c=>c.type==="sang"&&c.by_user===by&&sameDate(c,{phase,jor}));
  if(sangSame) return "No podés usar Nitro y Sanguijuela en la misma fecha.";
  if(wasChallenged(by,phase,jor)) return "Fuiste retado en esa fecha: no podés usar Nitro.";
  const tb=standings(); const me=tb.find(r=>r.id===by);
  if(me.pos===1||me.pos===2) return "El 1° y 2° no pueden usar nitro.";
  return null;
}

/* lista de fechas para el selector */
function dateOptions(){
  const o=[]; [1,2,3].forEach(j=>o.push({label:`Grupos · Jornada ${j}`,phase:"grupos",jor:j}));
  [["r32","Ronda de 32"],["r16","Octavos"],["qf","Cuartos"],["sf","Semifinales"],["tp","3er puesto"],["final","Final"]]
    .forEach(([k,l])=>o.push({label:l,phase:k,jor:null}));
  return o;
}

/* =====================================================================
   EL NAHUELITO (bot)
   - Completa tarjetas con fórmula random (goles 1-3, nombres random de
     los que pusieron los demás).
   - Sanguijuelas en fechas 3,6,8 contra quien esté justo por encima.
   - Nitros solo en "Zona de Pobreza" (mitad inferior de la tabla).
   - El admin lo genera/recalcula desde el panel.
   ===================================================================== */
const NAHUELITO_EMAIL="nahuelito@pinguiprode.bot";
function rnd(n){ return Math.floor(Math.random()*n); }
function pick(arr){ return arr.length?arr[rnd(arr.length)]:""; }

// genera predicciones random para el bot (se guardan como las de cualquiera, pero locked)
function buildNahuelitoPreds(){
  const main={};
  FIXTURE.forEach(m=>{ main[m.id]={h:rnd(3)+(m.ko?0:0)===0?0:rnd(4), a:rnd(4), pen:rnd(2)?"1":"0"}; });
  // simplificación de goles 0-3
  FIXTURE.forEach(m=>{ main[m.id]={h:rnd(4), a:rnd(4), pen:rnd(2)?"1":"0"}; });
  const extra={};
  const teamCodes=Object.keys(TEAMS);
  ['champion','runnerup','third'].forEach(k=>extra[k]=pick(teamCodes));
  // para nombres (botas/balón) toma random de lo que pusieron los demás
  const others=APP.profiles.filter(p=>p.email!==NAHUELITO_EMAIL);
  const pool=(field,sub)=>{ const vals=[]; others.forEach(p=>{const v=(predFor(p.id)[field]||{})[sub]; if(v)vals.push(v);}); return vals; };
  ['boot_gold','boot_silver','boot_bronze','ball_gold','ball_silver','ball_bronze'].forEach(k=>extra[k]=pick(pool('extra',k)));
  const wasabi={};
  APP.wasabiQs.forEach(q=>{
    if(q.type==="bonus") return;
    if(q.type==="num") wasabi[q.id]=String(rnd(3)+1);
    else if(q.type==="team") wasabi[q.id]=TEAMS[pick(teamCodes)].n;
    else if(q.type==="participant") wasabi[q.id]=pick(others.map(p=>p.display_name));
    else wasabi[q.id]=pick(pool('wasabi',q.id))||"";
  });
  const picada={}; const pq=APP.picadaQ;
  picada[pq.id]= pq.type==="num"?String(rnd(4)):"";
  return {main,extra,wasabi,picada};
}

// decide y registra los comodines automáticos del bot (lo llama el admin al recalcular)
function nahuelitoComodines(botId){
  const acts=[];
  const tb=standings();
  const botRow=tb.find(r=>r.id===botId); if(!botRow) return acts;
  // SANGUIJUELAS en fechas 3,6,8 contra quien esté justo por encima
  const fechas=[{phase:"grupos",jor:3},{phase:"qf"},{phase:"final"}]; // 3,6,8 aprox según fase
  fechas.forEach(d=>{
    const above=tb.filter(r=>r.pos<botRow.pos).sort((a,b)=>b.pos-a.pos)[0]; // el más cercano arriba
    if(above) acts.push({type:"sang",by_user:botId,target_user:above.id,phase:d.phase,jor:d.jor||null});
  });
  // NITROS si está en zona de pobreza (mitad inferior)
  if(botRow.pos> tb.length/2){
    acts.push({type:"nitro",by_user:botId,phase:"grupos",jor:2});
  }
  return acts;
}

/* crea/actualiza el perfil y predicciones del Nahuelito (solo admin).
   Como el bot no tiene cuenta de auth, se guarda con un id fijo en una tabla aparte
   manejada por el admin. Para simplificar el despliegue, el bot se representa como
   un perfil con is_bot=true cuyo id lo genera el admin una sola vez. */
async function adminCreateNahuelito(){
  // ¿ya existe?
  let bot=APP.profiles.find(p=>p.is_bot);
  if(!bot){
    const botId=crypto.randomUUID();
    const {error}=await sb.from('profiles').insert({
      id:botId, email:NAHUELITO_EMAIL, display_name:"El Nahuelito", is_bot:true, paid:true
    });
    if(error) throw error;
    await loadAll(); bot=APP.profiles.find(p=>p.is_bot);
    // sus predicciones random, ya bloqueadas
    const preds=buildNahuelitoPreds();
    await sb.from('predictions').insert({user_id:bot.id, ...preds, locked:true});
  }
  await loadAll();
  // recalcular sus comodines automáticos
  await sb.from('comodines').delete().eq('by_user',bot.id);
  const acts=nahuelitoComodines(bot.id);
  if(acts.length) await sb.from('comodines').insert(acts);
  await loadAll();
}
