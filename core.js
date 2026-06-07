/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — NÚCLEO SIN REDECLARACIONES
   ===================================================================== */
// Conectamos Supabase usando las constantes globales que ya existen
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

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
    
    await loadGlobalData();
    
    if (APP.user) {
      await loadMyPrediction();
    }
    
    console.log("PingüiProde: Inicializado correctamente.", APP);
  } catch (error) {
    console.error("¡ERROR CRÍTICO!:", error);
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
  const resP = await sb.from('profiles').select('id,display_name');
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

/* Cargar predicciones */
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

/* ---------- LÓGICA AUXILIAR ---------- */
function stageSent(stage) {
  if (!APP.myPred) return false;
  return !!(APP.myPred.sent_at || {})[stage];
}

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
  return tabla;
}
