/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — NÚCLEO (Supabase + motor de puntajes)
   ===================================================================== */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* estado en memoria */
const APP = {
  user:null, profile:null,
  myPred:null,
  profiles:[], results:{main:{},extra:{},wasabi:{}},
  comodines:[], wasabiQs: (typeof window.SEED_WASABI !== 'undefined') ? [...window.SEED_WASABI] : [],
};

/* ---------- FUNCIÓN GLOBAL DE INICIALIZACIÓN ---------- */
async function loadAll() {
  try {
    console.log("1. Iniciando loadAll()...");
    await loadSession();
    console.log("2. Sesión cargada:", APP.user);
    
    await loadGlobalData();
    console.log("3. Datos globales cargados:", APP.profiles, APP.comodines);
    
    if (APP.user) {
      console.log("4. Cargando predicción para el usuario...");
      await loadMyPrediction();
      console.log("5. Predicción cargada:", APP.myPred);
    }
    
    console.log("PingüiProde: Núcleo e inicialización cargados con éxito.", APP);
  } catch (error) {
    console.error("¡ERROR CRÍTICO ENCONTRADO!:", error);
    alert("Error crítico al cargar: " + error.message);
    throw error;
  }
}

/* ---------- AUTH ---------- */
async function signUp(email, pass) {
  const { data, error } = await sb.auth.signUp({ email, password: pass });
  if (error) throw error; 
  return data;
}

async function signIn(email, pass) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) throw error; 
  return data;
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

/* ---------- PERFIL ---------- */
async function createProfile(displayName){
  const {error}=await sb.from('profiles').insert({ id:APP.user.id, display_name:displayName });
  if(error) throw error;
  const {data:prof}=await sb.from('profiles').select('*').eq('id',APP.user.id).maybeSingle();
  APP.profile=prof||null;
}

/* ---------- DATOS GLOBALES ---------- */
async function loadGlobalData(){
  const resP = await sb.from('profiles').select('id,display_name,is_admin,created_at');
  const resR = await sb.from('results').select('*');
  const resC = await sb.from('comodines').select('*');

  APP.profiles = (!resP.error && resP.data) ? resP.data : [];
  APP.comodines = (!resC.error && resC.data) ? resC.data : [];
  
  const rData = (!resR.error && resR.data) ? resR.data : [];

  APP.results = {main:{}, extra:{}, wasabi:{}};
  rData.forEach(row => {
    if(row.type === 'main') APP.results.main[row.item_id] = {h:row.h, a:row.a, pen:row.pen};
    if(row.type === 'extra') APP.results.extra[row.item_id] = row.value;
    if(row.type === 'wasabi') APP.results.wasabi[row.item_id] = row.value;
  });
}

/* Cargar la predicción del usuario o crear una vacía */
async function loadMyPrediction(){
  if(!APP.user) return null;
  const {data, error} = await sb.from('predictions').select('*').eq('user_id', APP.user.id).maybeSingle();
  if(error) throw error;

  if(data){
    APP.myPred = data;
  } else {
    const init = {
      user_id: APP.user.id,
      main: {}, extra: {}, wasabi: {},
      bracket: { r32:{}, r16:{}, qf:{}, sf:{}, final:{}, tp:{} },
      sent_at: {}
    };
    const {data:newRow, error:err2} = await sb.from('predictions').insert(init).select().maybeSingle();
    if(err2) throw err2;
    APP.myPred = newRow;
  }
  return APP.myPred;
}

/* ---------- LÓGICA DE JUEGO Y POSICIONES ---------- */
function stageSent(stage){
  if(!APP.myPred) return false;
  return !!(APP.myPred.sent_at || {})[stage];
}

function cardSent(card){
  if(!APP.myPred) return false;
  if(card === 'wasabi') return stageSent('wasabi');
  if(card === 'main') return stageSent('grupos') && stageSent('r32') && stageSent('r16') && stageSent('qf') && stageSent('sf') && stageSent('tpfinal');
  return false;
}

function standings() {
  const tabla = APP.profiles.map(p => {
    return { id: p.id, display_name: p.display_name, total: 0, pos: 1, paid: true };
  });
  tabla.sort((a, b) => b.total - a.total);
  tabla.forEach((row, idx) => {
    if (idx > 0 && row.total === tabla[idx - 1].total) { row.pos = tabla[idx - 1].pos; } 
    else { row.pos = idx + 1; }
  });
  return tabla;
}

function setGroupMatchScore(matchId, hVal, aVal){
  if(stageSent('grupos')) return;
  if(!APP.myPred) return;
  if(!APP.myPred.main) APP.myPred.main = {};
  if(hVal==="" || aVal==="") { delete APP.myPred.main[matchId]; } 
  else { APP.myPred.main[matchId] = { h: parseInt(hVal,10), a: parseInt(aVal,10) }; }
}

function setExtraValue(id, val){
  if(stageSent('wasabi')) return; 
  if(!APP.myPred) return;
  if(!APP.myPred.extra) APP.myPred.extra = {};
  if(val==="") delete APP.myPred.extra[id];
  else APP.myPred.extra[id] = val;
}

function setWasabiValue(id, val){
  if(stageSent('wasabi')) return;
  if(!APP.myPred) return;
  if(!APP.myPred.wasabi) APP.myPred.wasabi = {};
  if(val==="") delete APP.myPred.wasabi[id];
  else APP.myPred.wasabi[id] = val;
}

async function saveStageCard(stage){
  if(stageSent(stage)) throw new Error("Esta etapa ya fue enviada y se encuentra bloqueada.");
  let patch = {};
  if(stage === 'grupos') {
    patch.main = APP.myPred.main || {};
    patch.extra = APP.myPred.extra || {};
  } else if(stage === 'wasabi') {
    patch.wasabi = APP.myPred.wasabi || {};
  }
  const sent_at = { ...(APP.myPred.sent_at || {}), [stage]: new Date().toISOString() };
  patch.sent_at = sent_at;
  if(stage === 'wasabi' && sent_at.tpfinal) { patch.locked = true; }

  const {data, error} = await sb.from('predictions').update(patch).eq('user_id', APP.user.id).select().maybeSingle();
  if(error) throw error;
  APP.myPred = data;
  return data;
}

/* =====================================================================
   MATRIZ OFICIAL DE ASIGNACIÓN DE TERCEROS — FIFA 2026
   ===================================================================== */
const TABLA_TERCEROS_FIFA = {
  "ABCDEFGH": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3G', '1F':'3H', '1G':'3A', '1H':'3B' },
  "ABCDEFGI": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3G', '1F':'3I', '1G':'3A', '1H':'3B' },
  "ABCDEFGJ": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3G', '1F':'3J', '1G':'3A', '1H':'3B' },
  "ABCDEFGK": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3G', '1F':'3K', '1G':'3A', '1H':'3B' },
  "ABCDEFGL": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3G', '1F':'3L', '1G':'3A', '1H':'3B' }
};

function resolverAsignacionTerceros(letrasTerceros) {
  if (TABLA_TERCEROS_FIFA[letrasTerceros]) return TABLA_TERCEROS_FIFA[letrasTerceros];
  const asignacion = {};
  const pool = letrasTerceros.split('');
  const primerosConTerceros = ['E', 'I', 'A', 'L', 'D', 'G', 'B', 'K'];
  const ordenPreferidoTerceros = {
    'E': ['A','B','C','D','F'], 'I': ['C','D','F','G','H'], 'A': ['C','E','F','H','I'], 'L': ['E','H','I','J','K'],
    'D': ['B','E','F','I','J'], 'G': ['A','E','H','I','J'], 'B': ['E','F','G','I','J'], 'K': ['D','E','I','J','L']
  };
  let usados = new Set();
  primerosConTerceros.forEach(p => {
    let elegido = ordenPreferidoTerceros[p].find(t => pool.includes(t) && !usados.has(t));
    if (!elegido) elegido = pool.find(t => !usados.has(t));
    asignacion[`1${p}`] = `3${elegido}`;
    usados.add(elegido);
  });
  return asignacion;
}

function getTeamFromGroupPos(positions, code) {
  const type = code.charAt(0);
  const group = code.charAt(1);
  const arr = positions[group] || [];
  if (type === '1') return arr[0] || "";
  if (type === '2') return arr[1] || "";
  return ""; 
}

/* =====================================================================
   MOTOR INTEGRAL DE CONSTRUCCIÓN DINÁMICA DEL RECORRIDO DEL BRACKET
   ===================================================================== */
async function buildBracket(stage){
  if(stageSent(stage)) return APP.myPred?.bracket;
  const bracket = { ...(APP.myPred?.bracket || {}) };
  const userPreds = APP.myPred?.main || {};

  const groupStats = {};
  const localGroups = window.GROUPS || null;
  const localMatches = window.MATCHES || [];

  if (localGroups) {
    Object.keys(localGroups).forEach(g => {
      if(localGroups[g] && localGroups[g].teams){
        groupStats[g] = {};
        localGroups[g].teams.forEach(t => { groupStats[g][t] = { code:t, pts:0, gf:0, gc:0, dg:0 }; });
      }
    });
  }

  if (localMatches) {
    localMatches.forEach(m => {
      const pred = userPreds[m.id];
      if(pred && pred.h != null && pred.a != null){
        const h = parseInt(pred.h, 10); const a = parseInt(pred.a, 10);
        const sH = groupStats[m.g]?.[m.h]; const sA = groupStats[m.g]?.[m.a];
        if(sH && sA){
          sH.gf += h; sH.gc += a; sA.gf += a; sA.gc += h;
          if(h > a) { sH.pts += 3; } else if(a > h) { sA.pts += 3; } else { sH.pts += 1; sA.pts += 1; }
        }
      }
    });
  }

  const posicionesGrupos = {};
  const listaTodosLosTerceros = [];

  Object.keys(groupStats).forEach(g => {
    const teamsArr = Object.values(groupStats[g]);
    teamsArr.forEach(t => { t.dg = t.gf - t.gc; });
    teamsArr.sort((a,b) => {
      if(b.pts !== a.pts) return b.pts - a.pts;
      if(b.dg !== a.dg) return b.dg - a.dg;
      if(b.gf !== a.gf) return b.gf - a.gf;
      return a.code.localeCompare(b.code);
    });
    posicionesGrupos[g] = teamsArr.map(t => t.code);
    if(teamsArr[2]) {
      listaTodosLosTerceros.push({ grupo: g, code: teamsArr[2].code, pts: teamsArr[2].pts, dg: teamsArr[2].dg, gf: teamsArr[2].gf });
    }
  });

  listaTodosLosTerceros.sort((a,b) => {
    if(b.pts !== a.pts) return b.pts - a.pts;
    if(b.dg !== a.dg) return b.dg - a.dg;
    if(b.gf !== a.gf) return b.gf - a.gf;
    return a.grupo.localeCompare(b.grupo);
  });

  const mejores8Terceros = listaTodosLosTerceros.slice(0, 8);
  const letrasTercerosClasificados = mejores8Terceros.map(t => t.grupo).sort().join('');
  const mapaAsignacionFIFA = resolverAsignacionTerceros(letrasTercerosClasificados);

  function obtenerEquipoTerceroAsignado(codigoTerceroFIFA) {
    if(!codigoTerceroFIFA) return "";
    const letraGrupo = codigoTerceroFIFA.charAt(1);
    const pasoTercero = mejores8Terceros.find(t => t.grupo === letraGrupo);
    return pasoTercero ? pasoTercero.code : "";
  }

  if(stage === 'r32'){
    if(!bracket.r32) bracket.r32 = {};
    const prevR32 = { ...bracket.r32 }; bracket.r32 = {};

    const estructuraR32 = [
      { id: "r32-1",  name: "Partido 73", h: "2A", v: "2B" },
      { id: "r32-2",  name: "Partido 74", h: "1E", v: "TERCERO", ref: "1E" },
      { id: "r32-3",  name: "Partido 75", h: "1F", v: "2C" },
      { id
