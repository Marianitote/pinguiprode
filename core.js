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
async function signUp(email, pass){\n  const {data,error}=await sb.auth.signUp({email,password:pass});
  if(error) throw error; return data;
}
async function signIn(email, pass){\n  const {data,error}=await sb.auth.signInWithPassword({email,password:pass});
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
async function createProfile(displayName){\n  const {error}=await sb.from('profiles').insert({
    id:APP.user.id,
    display_name:displayName
  });
  if(error) throw error;
  const {data:prof}=await sb.from('profiles').select('*').eq('id',APP.user.id).maybeSingle();
  APP.profile=prof||null;
}

/* ---------- DATOS GLOBALES ---------- */
async function loadGlobalData(){
  const [p, r, c] = await Promise.all([
    sb.from('profiles').select('id,display_name,is_admin,created_at'),
    sb.from('results').select('*'),
    sb.from('comodines').select('*')
  ]);
  if(p.error) throw p.error;
  if(r.error) throw r.error;
  if(c.error) throw c.error;

  APP.profiles = p.data || [];
  APP.comodines = c.data || [];

  APP.results = {main:{}, extra:{}, wasabi:{}};
  (r.data || []).forEach(row => {
    if(row.type === 'main') APP.results.main[row.item_id] = {h:row.h, a:row.a, pen:row.pen};
    if(row.type === 'extra') APP.results.extra[row.item_id] = row.value;
    if(row.type === 'wasabi') APP.results.wasabi[row.item_id] = row.value;
  });
}

/* Cargar la predicción del usuario conectado o crear una vacía si no existe */
async function loadMyPrediction(){
  if(!APP.user) return null;
  const {data, error} = await sb.from('predictions').select('*').eq('user_id', APP.user.id).maybeSingle();
  if(error) throw error;

  if(data){
    APP.myPred = data;
  } else {
    // Inicializar estructura limpia
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

/* ---------- LÓGICA DE JUEGO (PRODE) ---------- */

function stageSent(stage){
  if(!APP.myPred) return false;
  return !!(APP.myPred.sent_at || {})[stage];
}

/* Guardar un partido de fase de grupos en memoria local */
function setGroupMatchScore(matchId, hVal, aVal){
  if(stageSent('grupos')) return;
  if(!APP.myPred) return;
  if(!APP.myPred.main) APP.myPred.main = {};
  
  if(hVal==="" || aVal==="") {
    delete APP.myPred.main[matchId];
  } else {
    APP.myPred.main[matchId] = { h: parseInt(hVal,10), a: parseInt(aVal,10) };
  }
}

/* Guardar un comodín extra en memoria local */
function setExtraValue(id, val){
  if(stageSent('wasabi')) return; // se mandan juntos habitualmente
  if(!APP.myPred) return;
  if(!APP.myPred.extra) APP.myPred.extra = {};
  if(val==="") delete APP.myPred.extra[id];
  else APP.myPred.extra[id] = val;
}

/* Guardar una pregunta Wasabi en memoria local */
function setWasabiValue(id, val){
  if(stageSent('wasabi')) return;
  if(!APP.myPred) return;
  if(!APP.myPred.wasabi) APP.myPred.wasabi = {};
  if(val==="") delete APP.myPred.wasabi[id];
  else APP.myPred.wasabi[id] = val;
}

/* Persistir la tarjeta actual (Grupos o Wasabi) en la base de datos */
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

  // Si se envió la última sección eliminatoria y wasabi, bloqueamos por completo la fila
  if(stage === 'wasabi' && sent_at.tpfinal) {
    patch.locked = true;
  }

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
  "ABCDEFGL": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3G', '1F':'3L', '1G':'3A', '1H':'3B' },
  "ABCDEFHI": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3H', '1F':'3I', '1G':'3A', '1H':'3B' },
  "ABCDEFHJ": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3H', '1F':'3J', '1G':'3A', '1H':'3B' },
  "ABCDEFHK": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3H', '1F':'3K', '1G':'3A', '1H':'3B' },
  "ABCDEFHL": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3H', '1F':'3L', '1G':'3A', '1H':'3B' },
  "ABCDEFII": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3I', '1F':'3J', '1G':'3A', '1H':'3B' }, // Salvaguarda duplicado
  "ABCDEFIJ": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3I', '1F':'3J', '1G':'3A', '1H':'3B' },
  "ABCDEFIK": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3I', '1F':'3K', '1G':'3A', '1H':'3B' },
  "ABCDEFIL": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3I', '1F':'3L', '1G':'3A', '1H':'3B' },
  "ABCDEFJK": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3J', '1F':'3K', '1G':'3A', '1H':'3B' },
  "ABCDEFJL": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3J', '1F':'3L', '1G':'3A', '1H':'3B' },
  "ABCDEFKL": { '1A':'3C', '1B':'3D', '1C':'3E', '1D':'3F', '1E':'3K', '1F':'3L', '1G':'3A', '1H':'3B' }
};

/* Algoritmo fallback adaptativo según directrices de asignación por descarte de la FIFA 2026 */
function resolverAsignacionTerceros(letrasTerceros) {
  if (TABLA_TERCEROS_FIFA[letrasTerceros]) {
    return TABLA_TERCEROS_FIFA[letrasTerceros];
  }
  
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

/* Auxiliar para recuperar el código del equipo clasificado */
function getTeamFromGroupPos(positions, code) {
  // code ej: "1A", "2B", "3C"
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

  // 1. CALCULAR TABLAS DE FASE DE GRUPOS EN BASE A LAS PREDICCIONES DEL USUARIO
  const groupStats = {};
  Object.keys(GROUPS).forEach(g => {
    groupStats[g] = {};
    GROUPS[g].teams.forEach(t => { groupStats[g][t] = { code:t, pts:0, gf:0, gc:0, dg:0 }; });
  });

  // Procesar los 72 partidos de grupos
  MATCHES.forEach(m => {
    const pred = userPreds[m.id];
    if(pred && pred.h != null && pred.a != null){
      const h = parseInt(pred.h, 10);
      const a = parseInt(pred.a, 10);
      const sH = groupStats[m.g][m.h];
      const sA = groupStats[m.g][m.a];
      if(sH && sA){
        sH.gf += h; sH.gc += a;
        sA.gf += a; sA.gc += h;
        if(h > a) { sH.pts += 3; }
        else if(a > h) { sA.pts += 3; }
        else { sH.pts += 1; sA.pts += 1; }
      }
    }
  });

  // Ordenar cada grupo (1º, 2º, 3º, 4º)
  const posicionesGrupos = {};
  const listaTodosLosTerceros = [];

  Object.keys(groupStats).forEach(g => {
    const teamsArr = Object.values(groupStats[g]);
    teamsArr.forEach(t => { t.dg = t.gf - t.gc; });
    
    // Criterio general Prode: Puntos -> DG -> GF -> Orden alfabético del código de equipo
    teamsArr.sort((a,b) => {
      if(b.pts !== a.pts) return b.pts - a.pts;
      if(b.dg !== a.dg) return b.dg - a.dg;
      if(b.gf !== a.gf) return b.gf - a.gf;
      return a.code.localeCompare(b.code);
    });

    posicionesGrupos[g] = teamsArr.map(t => t.code);

    // Almacenar el tercero de este grupo
    if(teamsArr[2]) {
      listaTodosLosTerceros.push({
        grupo: g,
        code: teamsArr[2].code,
        pts: teamsArr[2].pts,
        dg: teamsArr[2].dg,
        gf: teamsArr[2].gf
      });
    }
  });

  // 2. FILTRAR Y ORDENAR LOS 8 MEJORES TERCEROS GENERALES
  listaTodosLosTerceros.sort((a,b) => {
    if(b.pts !== a.pts) return b.pts - a.pts;
    if(b.dg !== a.dg) return b.dg - a.dg;
    if(b.gf !== a.gf) return b.gf - a.gf;
    return a.grupo.localeCompare(b.grupo);
  });

  const mejores8Terceros = listaTodosLosTerceros.slice(0, 8);
  const letrasTercerosClasificados = mejores8Terceros.map(t => t.grupo).sort().join('');
  const mapaAsignacionFIFA = resolverAsignacionTerceros(letrasTercerosClasificados);

  // Helper local para buscar qué equipo físico quedó asignado a un puesto condicional (ej: '3C')
  function obtenerEquipoTerceroAsignado(codigoTerceroFIFA) {
    const letraGrupo = codigoTerceroFIFA.charAt(1);
    const pasoTercero = mejores8Terceros.find(t => t.grupo === letraGrupo);
    return pasoTercero ? pasoTercero.code : "";
  }

  // 3. ARMADO SEGÚN LA ETAPA SOLICITADA
  if(stage === 'r32'){
    if(!bracket.r32) bracket.r32 = {};
    
    const prevR32 = { ...bracket.r32 };
    bracket.r32 = {};

    // Definición exacta del Fixture Oficial FIFA 2026 (Partidos 73 al 88)
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
      let homeTeam = "";
      let awayTeam = "";

      // Resolver Local
      if(p.h === "TERCERO") {
        homeTeam = obtenerEquipoTerceroAsignado(mapaAsignacionFIFA[p.ref]);
      } else {
        homeTeam = getTeamFromGroupPos(posicionesGrupos, p.h);
      }

      // Resolver Visitante
      if(p.v === "TERCERO") {
        awayTeam = obtenerEquipoTerceroAsignado(mapaAsignacionFIFA[p.ref]);
      } else {
        awayTeam = getTeamFromGroupPos(posicionesGrupos, p.v);
      }

      const viejo = prevR32[p.id] || {};
      bracket.r32[p.id] = {
        id: p.id,
        name: p.name,
        home: homeTeam,
        away: awayTeam,
        h: viejo.h !== undefined ? viejo.h : "",
        a: viejo.a !== undefined ? viejo.a : "",
        pen: viejo.pen || ""
      };
    });
  }

  // Funciones auxiliares internas para determinar ganadores/perdedores reales en cascada
  const getWinner = (match) => {
    if(!match || match.h === "" || match.a === "") return "";
    const h = parseInt(match.h, 10);
    const a = parseInt(match.a, 10);
    if(h > a) return match.home;
    if(a > h) return match.away;
    return match.pen === '1' ? match.home : (match.pen === '2' ? match.away : "");
  };

  const getLoser = (match) => {
    if(!match || match.h === "" || match.a === "") return "";
    const h = parseInt(match.h, 10);
    const a = parseInt(match.a, 10);
    if(h > a) return match.away;
    if(a > h) return match.home;
    return match.pen === '1' ? match.away : (match.pen === '2' ? match.home : "");
  };

  // 4. OCTAVOS DE FINAL (R16) - ACOPLADOS PERFECTAMENTE AL FIXTURE FIFA
  if(stage === 'r16'){
    if(!bracket.r16) bracket.r16 = {};
    const prevR16 = { ...bracket.r16 };
    bracket.r16 = {};

    const crucesR16 = [
      { id: "r16-1", name: "Partido 89", h: "r32-2",  v: "r32-5" },  // Ganador 74 vs Ganador 77
      { id: "r16-2", name: "Partido 90", h: "r32-1",  v: "r32-3" },  // Ganador 73 vs Ganador 75
      { id: "r16-3", name: "Partido 91", h: "r32-4",  v: "r32-6" },  // Ganador 76 vs Ganador 78
      { id: "r16-4", name: "Partido 92", h: "r32-7",  v: "r32-8" },  // Ganador 79 vs Ganador 80
      { id: "r16-5", name: "Partido 93", h: "r32-11", v: "r32-12" }, // Ganador 83 vs Ganador 84
      { id: "r16-6", name: "Partido 94", h: "r32-9",  v: "r32-10" }, // Ganador 81 vs Ganador 82
      { id: "r16-7", name: "Partido 95", h: "r32-14", v: "r32-16" }, // Ganador 86 vs Ganador 88
      { id: "r16-8", name: "Partido 96", h: "r32-13", v: "r32-15" }  // Ganador 85 vs Ganador 87
    ];

    crucesR16.forEach(c => {
      const viejo = prevR16[c.id] || {};
      bracket.r16[c.id] = {
        id: c.id,
        name: c.name,
        home: getWinner(bracket.r32?.[c.h]),
        away: getWinner(bracket.r32?.[c.v]),
        h: viejo.h !== undefined ? viejo.h : "",
        a: viejo.a !== undefined ? viejo.a : "",
        pen: viejo.pen || ""
      };
    });
  }

  // 5. CUARTOS DE FINAL (QF)
  if(stage === 'qf'){
    if(!bracket.qf) bracket.qf = {};
    const prevQF = { ...bracket.qf };
    bracket.qf = {};

    const crucesQF = [
      { id: "qf-1", name: "Partido 97", h: "r16-1", v: "r16-2" }, // Ganador 89 vs Ganador 90
      { id: "qf-2", name: "Partido 98", h: "r16-5", v: "r16-6" }, // Ganador 93 vs Ganador 94
      { id: "qf-3", name: "Partido 99", h: "r16-3", v: "r16-4" }, // Ganador 91 vs Ganador 92
      { id: "qf-4", name: "Partido 100", h: "r16-7", v: "r16-8" } // Ganador 95 vs Ganador 96
    ];

    crucesQF.forEach(c => {
      const viejo = prevQF[c.id] || {};
      bracket.qf[c.id] = {
        id: c.id,
        name: c.name,
        home: getWinner(bracket.r16?.[c.h]),
        away: getWinner(bracket.r16?.[c.v]),
        h: viejo.h !== undefined ? viejo.h : "",
        a: viejo.a !== undefined ? viejo.a : "",
        pen: viejo.pen || ""
      };
    });
  }

  // 6. SEMIFINALES (SF)
  if(stage === 'sf'){
    if(!bracket.sf) bracket.sf = {};
    const prevSF = { ...bracket.sf };
    bracket.sf = {};

    const crucesSF = [
      { id: "sf-1", name: "Partido 101", h: "qf-1", v: "qf-2" }, // Ganador 97 vs Ganador 98
      { id: "sf-2", name: "Partido 102", h: "qf-3", v: "qf-4" }  // Ganador 99 vs Ganador 100
    ];

    crucesSF.forEach(c => {
      const viejo = prevSF[c.id] || {};
      bracket.sf[c.id] = {
        id: c.id,
        name: c.name,
        home: getWinner(bracket.qf?.[c.h]),
        away: getWinner(bracket.qf?.[c.v]),
        h: viejo.h !== undefined ? viejo.h : "",
        a: viejo.a !== undefined ? viejo.a : "",
        pen: viejo.pen || ""
      };
    });
  }

  // 7. FINALES (TERCER PUESTO Y FINAL)
  if(stage === 'tpfinal'){
    const prevFinal = bracket.final || {};
    const prevTP = bracket.tp || {};

    const m101 = bracket.sf?.["sf-1"];
    const m102 = bracket.sf?.["sf-2"];

    bracket.final = {
      id: "final-1",
      name: "Partido 104 - Gran Final",
      home: getWinner(m101),
      away: getWinner(m102),
      h: prevFinal.h !== undefined ? prevFinal.h : "",
      a: prevFinal.a !== undefined ? prevFinal.a : "",
      pen: prevFinal.pen || ""
    };

    bracket.tp = {
      id: "tp-1",
      name: "Partido 103 - Tercer Puesto",
      home: getLoser(m101),
      away: getLoser(m102),
      h: prevTP.h !== undefined ? prevTP.h : "",
      a: prevTP.a !== undefined ? prevTP.a : "",
      pen: prevTP.pen || ""
    };
  }

  // Guardar en la base de datos el progreso del árbol
  const sent_at = { ...(APP.myPred.sent_at || {}), [stage]: new Date().toISOString() };
  let patch = { bracket, sent_at };
  
  if(stage === "tpfinal"){
    patch.sent_at.main = new Date().toISOString();
    if(sent_at.wasabi) patch.locked = true;
  }

  const { data, error } = await sb.from('predictions').update(patch).eq('user_id', APP.user.id).select().maybeSingle();
  if(error) throw error;
  
  APP.myPred = data;
  return data;
}

/* Cargar un marcador en un cruce de eliminatoria */
async function setBracketScore(stage, slotId, key, value){
  if(stageSent(stage)) throw new Error("Esta etapa ya fue enviada.");
  const bracket = { ...(APP.myPred?.bracket || {}) };
  
  if(stage === "tpfinal"){
    if(slotId.startsWith("tp")){
      bracket.tp = { ...(bracket.tp || {}), [key]: value };
    } else {
      bracket.final = { ...(bracket.final || {}), [key]: value };
    }
  } else {
    if(!bracket[stage]) bracket[stage] = {};
    if(!bracket[stage][slotId]) bracket[stage][slotId] = {};
    bracket[stage][slotId][key] = value;
  }

  // Persistir el cambio inmediato sin mutar directamente sent_at todavía
  const { data, error } = await sb.from('predictions').update({ bracket }).eq('user_id', APP.user.id).select().maybeSingle();
  if(error) throw error;
  APP.myPred = data;
  return data;
}
