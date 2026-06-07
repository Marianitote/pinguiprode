/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — NÚCLEO (Supabase + motor de puntajes)
   ===================================================================== */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Inicialización segura con 'var' para que ui.js encuentre las estructuras
// sin importar el orden de carga, y evitando el SyntaxError por duplicación:
if (typeof STAGES === 'undefined') { var STAGES = {}; }
if (typeof GROUPS === 'undefined') { var GROUPS = {}; }
if (typeof MATCHES === 'undefined') { var MATCHES = []; }

/* estado en memoria */
const APP = {
  user: null, 
  profile: null,
  myPred: null,
  profiles: [], 
  results: { main: {}, extra: {}, wasabi: {} },
  comodines: [], 
  wasabiQs: (typeof window.SEED_WASABI !== 'undefined') ? [...window.SEED_WASABI] : []
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

async function signOut() { 
  await sb.auth.signOut(); 
  location.reload(); 
}

async function loadSession() {
  const { data } = await sb.auth.getUser();
  APP.user = data?.user || null;
  if (APP.user) {
    const { data: prof } = await sb.from('profiles').select('*').eq('id', APP.user.id).maybeSingle();
    APP.profile = prof || null;
  }
}

/* ---------- PERFIL ---------- */
async function createProfile(displayName) {
  const { error } = await sb.from('profiles').insert({ id: APP.user.id, display_name: displayName });
  if (error) throw error;
  const { data: prof } = await sb.from('profiles').select('*').eq('id', APP.user.id).maybeSingle();
  APP.profile = prof || null;
}

/* ---------- DATOS GLOBALES ---------- */
async function loadGlobalData() {
  const resP = await sb.from('profiles').select('id,display_name,is_admin,created_at');
  const resR = await sb.from('results').select('*');
  const resC = await sb.from('comodines').select('*');

  APP.profiles = (!resP.error && resP.data) ? resP.data : [];
  APP.comodines = (!resC.error && resC.data) ? resC.data : [];
  
  const rData = (!resR.error && resR.data) ? resR.data : [];

  APP.results = { main: {}, extra: {}, wasabi: {} };
  rData.forEach(row => {
    if (row.type === 'main') APP.results.main[row.item_id] = { h: row.h, a: row.a, pen: row.pen };
    if (row.type === 'extra') APP.results.extra[row.item_id] = row.value;
    if (row.type === 'wasabi') APP.results.wasabi[row.item_id] = row.value;
  });
}

/* Cargar la predicción del usuario o crear una vacía */
async function loadMyPrediction() {
  if (!APP.user) return null;
  const { data, error } = await sb.from('predictions').select('*').eq('user_id', APP.user.id).maybeSingle();
  if (error) throw error;

  if (data) {
    APP.myPred = data;
  } else {
    const init = {
      user_id: APP.user.id,
      main: {}, extra: {}, wasabi: {},
      bracket: { r32: {}, r16: {}, qf: {}, sf: {}, final: {}, tp: {} },
      sent_at: {}
    };
    const { data: newRow, error: err2 } = await sb.from('predictions').insert(init).select().maybeSingle();
    if (err2) throw err2;
    APP.myPred = newRow;
  }
  return APP.myPred;
}

/* ---------- LÓGICA DE JUEGO Y POSICIONES ---------- */
function stageSent(stage) {
  if (!APP.myPred) return false;
  return !!(APP.myPred.sent_at || {})[stage];
}

/* Verificar si las constantes locales existen antes de usarlas */
function cardSent(card) {
  if (!APP.myPred) return false;
  if (card === 'wasabi') return stageSent('wasabi');
  if (card === 'main') return stageSent('grupos') && stageSent('r32') && stageSent('r16') && stageSent('qf') && stageSent('sf') && stageSent('tpfinal');
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

function setGroupMatchScore(matchId, hVal, aVal) {
  if (stageSent('grupos')) return;
  if (!APP.myPred) return;
  if (!APP.myPred.main) APP.myPred.main = {};
  if (hVal === "" || aVal === "") { delete APP.myPred.main[matchId]; } 
  else { APP.myPred.main[matchId] = { h: parseInt(hVal, 10), a: parseInt(aVal, 10) }; }
}

function setExtraValue(id, val) {
  if (stageSent('wasabi')) return; 
  if (!APP.myPred) return;
  if (!APP.myPred.extra) APP.myPred.extra = {};
  if (val === "") delete APP.myPred.extra[id];
  else APP.myPred.extra[id] = val;
}

function setWasabiValue(id, val) {
  if (stageSent('wasabi')) return;
  if (!APP.myPred) return;
  if (!APP.myPred.wasabi) APP.myPred.wasabi = {};
  if (val === "") delete APP.myPred.wasabi[id];
  else APP.myPred.wasabi[id] = val;
}

async function saveStageCard(stage) {
  if (stageSent(stage)) throw new Error("Esta etapa ya fue enviada y se encuentra bloqueada.");
  let patch = {};
  if (stage === 'grupos') {
    patch.main = APP.myPred.main || {};
    patch.extra = APP.myPred.extra || {};
  } else if (stage === 'wasabi') {
    patch.wasabi = APP.myPred.wasabi || {};
  }
  const sent_at = { ...(APP.myPred.sent_at || {}), [stage]: new Date().toISOString() };
  patch.sent_at = sent_at;
  if (stage === 'wasabi' && sent_at.tpfinal) { patch.locked = true; }

  const { data, error } = await sb.from('predictions').update(patch).eq('user_id', APP.user.id).select().maybeSingle();
  if (error) throw error;
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
async function buildBracket(stage) {
  if (stageSent(stage)) return APP.myPred?.bracket;
  const bracket = { ...(APP.myPred?.bracket || {}) };
  const userPreds = APP.myPred?.main || {};

  const groupStats = {};
  const localGroups = (typeof GROUPS !== 'undefined') ? GROUPS : null;
  const localMatches = (typeof MATCHES !== 'undefined') ? MATCHES : [];

  if (localGroups) {
    Object.keys(localGroups).forEach(g => {
      if (localGroups[g] && localGroups[g].teams) {
        groupStats[g] = {};
        localGroups[g].teams.forEach(t => { groupStats[g][t] = { code: t, pts: 0, gf: 0, gc: 0, dg: 0 }; });
      }
    });
  }

  if (localMatches) {
    localMatches.forEach(m => {
      const pred = userPreds[m.id];
      if (pred && pred.h != null && pred.a != null) {
        const h = parseInt(pred.h, 10); const a = parseInt(pred.a, 10);
        const sH = groupStats[m.g]?.[m.h]; const sA = groupStats[m.g]?.[m.a];
        if (sH && sA) {
          sH.gf += h; sH.gc += a; sA.gf += a; sA.gc += h;
          if (h > a) { sH.pts += 3; } else if (a > h) { sA.pts += 3; } else { sH.pts += 1; sA.pts += 1; }
        }
      }
    });
  }

  const posicionesGrupos = {};
  const listaTodosLosTerceros = [];

  Object.keys(groupStats).forEach(g => {
    const teamsArr = Object.values(groupStats[g]);
    teamsArr.forEach(t => { t.dg = t.gf - t.gc; });
    teamsArr.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dg !== a.dg) return b.dg - a.dg;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.code.localeCompare(b.code);
    });
    posicionesGrupos[g] = teamsArr.map(t => t.code);
    if (teamsArr[2]) {
      listaTodosLosTerceros.push({ grupo: g, code: teamsArr[2].code, pts: teamsArr[2].pts, dg: teamsArr[2].dg, gf: teamsArr[2].gf });
    }
  });

  listaTodosLosTerceros.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.grupo.localeCompare(b.grupo);
  });

  const mejores8Terceros = listaTodosLosTerceros.slice(0, 8);
  const letrasTercerosClasificados = mejores8Terceros.map(t => t.grupo).sort().join('');
  const mapaAsignacionFIFA = resolverAsignacionTerceros(letrasTercerosClasificados);

  function obtenerEquipoTerceroAsignado(codigoTerceroFIFA) {
    if (!codigoTerceroFIFA) return "";
    const letraGrupo = codigoTerceroFIFA.charAt(1);
    const pasoTercero = mejores8Terceros.find(t => t.grupo === letraGrupo);
    return pasoTercero ? pasoTercero.code : "";
  }

  if (stage === 'r32') {
    if (!bracket.r32) bracket.r32 = {};
    const prevR32 = { ...bracket.r32 }; bracket.r32 = {};

    const estructuraR32 = [
      { id: "r32-1",  name: "Partido 73", h: "2A", v: "2B" },
      { id: "r32-2",  name: "Partido 74", h: "1E", v: "TERCERO", ref: "1E" },
      { id: "r32-3",  name: "Partido 75", h: "1F", v: "2C" },
      { id: "r32-4",  name: "Partido 76", h: "1C", v: "2F" },
      { id: "r32-5",  name: "Partido 77", h: "1I", v: "TERCERO", ref: "1I" },
      { id: "r32-6",  name: "Partido 78", h: "2E", v: "2I" },
      { id: "r32-7",  name: "Partido 79", h: "1A", v: "TERCERO", ref: "1A" },
      { id: "r32-8",  name: "Partido 80", h: "1L", v: "TERCERO", ref: "1L" },
      { id: "r32-9",  name: "Partido 81", h: "1D", v: "TERCERO", ref: "1D" },
      { id: "r32-10", name: "Partido 82", h: "1G", v: "TERCERO", ref: "1G" },
      { id: "r32-11", name: "Partido 83", h: "2K", v: "2L" },
      { id: "r32-12", name: "Partido 84", h: "1H", v: "2J" },
      { id: "r32-13", name: "Partido 85", h: "1B", v: "TERCERO", ref: "1B" },
      { id: "r32-14", name: "Partido 86", h: "1J", v: "2H" },
      { id: "r32-15", name: "Partido 87", h: "1K", v: "TERCERO", ref: "1K" },
      { id: "r32-16", name: "Partido 88", h: "2D", v: "2G" }
    ];

    estructuraR32.forEach(p => {
      let homeTeam = p.h === "TERCERO" ? obtenerEquipoTerceroAsignado(mapaAsignacionFIFA[p.ref]) : getTeamFromGroupPos(posicionesGrupos, p.h);
      let awayTeam = p.v === "TERCERO" ? obtenerEquipoTerceroAsignado(mapaAsignacionFIFA[p.ref]) : getTeamFromGroupPos(posicionesGrupos, p.v);
      const viejo = prevR32[p.id] || {};
      bracket.r32[p.id] = {
        id: p.id, name: p.name, home: homeTeam, away: awayTeam,
        h: viejo.h !== undefined ? viejo.h : "", a: viejo.a !== undefined ? viejo.a : "", pen: viejo.pen || ""
      };
    });
  }

  const getWinner = (match) => {
    if (!match || match.h === "" || match.a === "") return "";
    const h = parseInt(match.h, 10); const a = parseInt(match.a, 10);
    if (h > a) return match.home; if (a > h) return match.away;
    return match.pen === '1' ? match.home : (match.pen === '2' ? match.away : "");
  };

  const getLoser = (match) => {
    if (!match || match.h === "" || match.a === "") return "";
    const h = parseInt(match.h, 10); const a = parseInt(match.a, 10);
    if (h > a) return match.away; if (a > h) return match.home;
    return match.pen === '1' ? match.away : (match.pen === '2' ? match.home : "");
  };

  if (stage === 'r16') {
    if (!bracket.r16) bracket.r16 = {};
    const prevR16 = { ...bracket.r16 }; bracket.r16 = {};
    const crucesR16 = [
      { id: "r16-1", name: "Partido 89", h: "r32-2",  v: "r32-5" }, { id: "r16-2", name: "Partido 90", h: "r32-1",  v: "r32-3" },
      { id: "r16-3", name: "Partido 91", h: "r32-4",  v: "r32-6" }, { id: "r16-4", name: "Partido 92", h: "r32-7",  v: "r32-8" },
      { id: "r16-5", name: "Partido 93", h: "r32-11", v: "r32-12" }, { id: "r16-6", name: "Partido 94", h: "r32-9",  v: "r32-10" },
      { id: "r16-7", name: "Partido 95", h: "r32-14", v: "r32-16" }, { id: "r16-8", name: "Partido 96", h: "r32-13", v: "r32-15" }
    ];
    crucesR16.forEach(c => {
      const viejo = prevR16[c.id] || {};
      bracket.r16[c.id] = {
        id: c.id, name: c.name, home: getWinner(bracket.r32?.[c.h]), away: getWinner(bracket.r32?.[c.v]),
        h: viejo.h !== undefined ? viejo.h : "", a: viejo.a !== undefined ? viejo.a : "", pen: viejo.pen || ""
      };
    });
  }

  if (stage === 'qf') {
    if (!bracket.qf) bracket.qf = {};
    const prevQF = { ...bracket.qf }; bracket.qf = {};
    const crucesQF = [
      { id: "qf-1", name: "Partido 97", h: "r16-1", v: "r16-2" }, { id: "qf-2", name: "Partido 98", h: "r16-5", v: "r16-6" },
      { id: "qf-3", name: "Partido 99", h: "r16-3", v: "r16-4" }, { id: "qf-4", name: "Partido 100", h: "r16-7", v: "r16-8" }
    ];
    crucesQF.forEach(c => {
      const viejo = prevQF[c.id] || {};
      bracket.qf[c.id] = {
        id: c.id, name: c.name, home: getWinner(bracket.r16?.[c.h]), away: getWinner(bracket.r16?.[c.v]),
        h: viejo.h !== undefined ? viejo.h : "", a: viejo.a !== undefined ? viejo.a : "", pen: viejo.pen || ""
      };
    });
  }

  if (stage === 'sf') {
    if (!bracket.sf) bracket.sf = {};
    const prevSF = { ...bracket.sf }; bracket.sf = {};
    const crucesSF = [ { id: "sf-1", name: "Partido 101", h: "qf-1", v: "qf-2" }, { id: "sf-2", name: "Partido 102", h: "qf-3", v: "qf-4" } ];
    crucesSF.forEach(c => {
      const viejo = prevSF[c.id] || {};
      bracket.sf[c.id] = {
        id: c.id, name: c.name, home: getWinner(bracket.qf?.[c.h]), away: getWinner(bracket.qf?.[c.v]),
        h: viejo.h !== undefined ? viejo.h : "", a: viejo.a !== undefined ? viejo.a : "", pen: viejo.pen || ""
      };
    });
  }

  if (stage === 'tpfinal') {
    const prevFinal = bracket.final || {}; const prevTP = bracket.tp || {};
    const m101 = bracket.sf?.["sf-1"]; const m102 = bracket.sf?.["sf-2"];
    bracket.final = {
      id: "final-1", name: "Partido 104 - Gran Final", home: getWinner(m101), away: getWinner(m102),
      h: prevFinal.h !== undefined ? prevFinal.h : "", a: prevFinal.a !== undefined ? prevFinal.a : "", pen: prevFinal.pen || ""
    };
    bracket.tp = {
      id: "tp-1", name: "Partido 103 - Tercer Puesto", home: getLoser(m101), away: getLoser(m102),
      h: prevTP.h !== undefined ? prevTP.h : "", a: prevTP.a !== undefined ? prevTP.a : "", pen: prevTP.pen || ""
    };
  }

  const sent_at = { ...(APP.myPred.sent_at || {}), [stage]: new Date().toISOString() };
  let patch = { bracket, sent_at };
  if (stage === "tpfinal") {
    patch.sent_at.main = new Date().toISOString();
    if (sent_at.wasabi) patch.locked = true;
  }
  const { data, error } = await sb.from('predictions').update(patch).eq('user_id', APP.user.id).select().maybeSingle();
  if (error) throw error;
  APP.myPred = data;
  return data;
}

async function setBracketScore(stage, slotId, key, value) {
  if (stageSent(stage)) throw new Error("Esta etapa ya fue enviada.");
  const bracket = { ...(APP.myPred?.bracket || {}) };
  if (stage === "tpfinal") {
    if (slotId.startsWith("tp")) { bracket.tp = { ...(bracket.tp || {}), [key]: value }; } 
    else { bracket.final = { ...(bracket.final || {}), [key]: value }; }
  } else {
    if (!bracket[stage]) bracket[stage] = {};
    if (!bracket[stage][slotId]) bracket[stage][slotId] = {};
    bracket[stage][slotId][key] = value;
  }
  const { data, error } = await sb.from('predictions').update({ bracket }).eq('user_id', APP.user.id).select().maybeSingle();
  if (error) throw error;
  APP.myPred = data;
  return data;
}
