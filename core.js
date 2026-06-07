/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — NÚCLEO MÍNIMO DE EMERGENCIA
   ===================================================================== */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Evitar que ui.js muera si no encuentra las variables globales
if (typeof STAGES === 'undefined') { var STAGES = {}; }
if (typeof GROUPS === 'undefined') { var GROUPS = {}; }
if (typeof MATCHES === 'undefined') { var MATCHES = []; }

const APP = {
  user: null, profile: null, myPred: null, profiles: [], 
  results: { main: {}, extra: {}, wasabi: {} }, comodines: [], wasabiQs: []
};

async function loadAll() {
  try {
    await loadSession();
    await loadGlobalData();
    if (APP.user) { await loadMyPrediction(); }
    console.log("PingüiProde: Conexión exitosa.", APP);
  } catch (error) {
    console.error("Error crítico:", error);
  }
}

async function loadSession() {
  const { data } = await sb.auth.getUser();
  APP.user = data?.user || null;
  if (APP.user) {
    const { data: prof } = await sb.from('profiles').select('*').eq('id', APP.user.id).maybeSingle();
    APP.profile = prof || null;
  }
}

async function loadGlobalData() {
  const resP = await sb.from('profiles').select('id,display_name');
  APP.profiles = (!resP.error && resP.data) ? resP.data : [];
}

async function loadMyPrediction() {
  if (!APP.user) return null;
  const { data } = await sb.from('predictions').select('*').eq('user_id', APP.user.id).maybeSingle();
  APP.myPred = data || null;
  return APP.myPred;
}

// Stubs para que ui.js no tire error al buscarlos
function stageSent() { return false; }
function cardSent() { return false; }
function standings() { return []; }
