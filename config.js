/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — CONFIGURACIÓN
   ---------------------------------------------------------------------
   👉 PEGÁ ACÁ TUS DOS CLAVES DE SUPABASE (ver la guía, paso 3).
      Las encontrás en: Supabase → Project Settings → API
   ===================================================================== */
const SUPABASE_URL  = "https://vbkiqqbybiitsljummpp.supabase.co";   // ← reemplazá
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZia2lxcWJ5YmlpdHNsanVtbXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5Nzk0MjQsImV4cCI6MjA5NTU1NTQyNH0.-oigRsAtrpWgEXOJHfawrv-2gXNOwTZUSWxlg9r6QDc";              // ← reemplazá

/* ---------------------------------------------------------------------
   Reglamento 2026 (resumen mostrado dentro de la app)
   --------------------------------------------------------------------- */
const REGLAMENTO_2026 = {
  bono: 50000,
  premio: "Copa y camiseta de la selección",
  tarjetas: [
    {n:"PRINCIPAL",pts:null, desc:"Todos los partidos del Mundial (grupos + eliminatorias) armados como un CUADRO autocompletado: cargás los grupos, la app calcula qué equipos pasan según tus predicciones, y vas armando R32 → Octavos → Cuartos → Semi → Final. Cuadro de honor (Campeón, Sub, 3°, botas y balón). Fecha límite: 11 de junio."},
    {n:"WASABI",   pts:null,desc:"Las preguntas que hacen único a este prode. Al lado de cada una se indica cuánto vale. Fecha límite: 11 de junio."},
  ],
  sanguijuela: [
    "3 sanguijuelas por fase para succionar puntos a un rival.",
    "Se piden en la ventana de 6:00 a 12:00 (hora argentina) de cualquier día con partidos, y valen para los partidos de ESE día. El cupo es por fase (no por día).",
    "Solo se puede retar a quien esté hasta 3 posiciones por encima. El 1º no puede retar.",
    "Se juegan SOLO los puntos de la Tarjeta Principal (sin los de la última fecha: mejor jugador, goleador, etc.).",
    "Si el retador hace MÁS puntos que el retado: se lleva todos los puntos que el retado generó con sus propias predicciones ese día.",
    "Si el retador hace MENOS: pierde el 50% de sus propios puntos del día.",
    "Si empatan en puntos: la sanguijuela se neutraliza, no pasa nada (ninguno gana ni pierde puntos).",
    "En sanguijuelas encadenadas, cada disputa se calcula solo sobre los puntos propios del jugador, sin contar puntos heredados de otras sanguijuelas.",
    "Un jugador no puede ser retado por dos el mismo día (vale el primer aviso).",
    "No se puede retar más de dos veces a la misma persona en una fase.",
    "Una persona no puede recibir más de tres retos en una misma fase.",
    "No son acumulables entre fases.",
  ],
  nitro: [
    "2 nitros por fase.",
    "Se piden en la ventana de 6:00 a 12:00 (hora argentina) de cualquier día con partidos, y valen para los partidos de ESE día. El cupo es por fase (no por día).",
    "Multiplica por 3 los puntos de la Tarjeta Principal del día en que se usa.",
    "El 1° y el 2° no pueden usar nitro.",
    "No son acumulables entre fases.",
  ],
  interaccion: [
    "Nitros y Sanguijuelas no pueden interceder entre sí.",
    "Un jugador no puede usar Sanguijuela y Nitro el mismo día.",
    "Un jugador retado no puede usar su Nitro.",
    "Quien pidió Nitro no puede ser retado.",
  ],
  ventanaComodines: "6:00 a 12:00 (hora argentina) de cualquier día con partidos · valen para ese día",
};

/* ---------------------------------------------------------------------
   Equipos (48) y grupos del Mundial 2026
   --------------------------------------------------------------------- */
const TEAMS = {
  MEX:{n:"México",f:"🇲🇽",g:"A"}, RSA:{n:"Sudáfrica",f:"🇿🇦",g:"A"}, KOR:{n:"Corea del Sur",f:"🇰🇷",g:"A"}, CZE:{n:"República Checa",f:"🇨🇿",g:"A"},
  CAN:{n:"Canadá",f:"🇨🇦",g:"B"}, BIH:{n:"Bosnia y Herz.",f:"🇧🇦",g:"B"}, QAT:{n:"Qatar",f:"🇶🇦",g:"B"}, SUI:{n:"Suiza",f:"🇨🇭",g:"B"},
  BRA:{n:"Brasil",f:"🇧🇷",g:"C"}, MAR:{n:"Marruecos",f:"🇲🇦",g:"C"}, HAI:{n:"Haití",f:"🇭🇹",g:"C"}, SCO:{n:"Escocia",f:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",g:"C"},
  USA:{n:"Estados Unidos",f:"🇺🇸",g:"D"}, PAR:{n:"Paraguay",f:"🇵🇾",g:"D"}, AUS:{n:"Australia",f:"🇦🇺",g:"D"}, TUR:{n:"Türkiye",f:"🇹🇷",g:"D"},
  GER:{n:"Alemania",f:"🇩🇪",g:"E"}, CUW:{n:"Curazao",f:"🇨🇼",g:"E"}, CIV:{n:"Costa de Marfil",f:"🇨🇮",g:"E"}, ECU:{n:"Ecuador",f:"🇪🇨",g:"E"},
  NED:{n:"Países Bajos",f:"🇳🇱",g:"F"}, JPN:{n:"Japón",f:"🇯🇵",g:"F"}, SWE:{n:"Suecia",f:"🇸🇪",g:"F"}, TUN:{n:"Túnez",f:"🇹🇳",g:"F"},
  BEL:{n:"Bélgica",f:"🇧🇪",g:"G"}, EGY:{n:"Egipto",f:"🇪🇬",g:"G"}, IRN:{n:"Irán",f:"🇮🇷",g:"G"}, NZL:{n:"Nueva Zelanda",f:"🇳🇿",g:"G"},
  ESP:{n:"España",f:"🇪🇸",g:"H"}, CPV:{n:"Cabo Verde",f:"🇨🇻",g:"H"}, KSA:{n:"Arabia Saudita",f:"🇸🇦",g:"H"}, URU:{n:"Uruguay",f:"🇺🇾",g:"H"},
  FRA:{n:"Francia",f:"🇫🇷",g:"I"}, SEN:{n:"Senegal",f:"🇸🇳",g:"I"}, IRQ:{n:"Iraq",f:"🇮🇶",g:"I"}, NOR:{n:"Noruega",f:"🇳🇴",g:"I"},
  ARG:{n:"Argentina",f:"🇦🇷",g:"J"}, ALG:{n:"Argelia",f:"🇩🇿",g:"J"}, AUT:{n:"Austria",f:"🇦🇹",g:"J"}, JOR:{n:"Jordania",f:"🇯🇴",g:"J"},
  POR:{n:"Portugal",f:"🇵🇹",g:"K"}, COD:{n:"RD Congo",f:"🇨🇩",g:"K"}, UZB:{n:"Uzbekistán",f:"🇺🇿",g:"K"}, COL:{n:"Colombia",f:"🇨🇴",g:"K"},
  ENG:{n:"Inglaterra",f:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",g:"L"}, CRO:{n:"Croacia",f:"🇭🇷",g:"L"}, GHA:{n:"Ghana",f:"🇬🇭",g:"L"}, PAN:{n:"Panamá",f:"🇵🇦",g:"L"},
};

/* Mapa de código FIFA → ISO 3166-1 alpha-2 para imágenes de banderas (CDN flagcdn.com).
   Escocia (SCO) e Inglaterra (ENG) usan sus propios códigos de subdivisión. */
const FLAG_ISO2 = {
  MEX:'mx',RSA:'za',KOR:'kr',CZE:'cz',
  CAN:'ca',BIH:'ba',QAT:'qa',SUI:'ch',
  BRA:'br',MAR:'ma',HAI:'ht',SCO:'gb-sct',
  USA:'us',PAR:'py',AUS:'au',TUR:'tr',
  GER:'de',CUW:'cw',CIV:'ci',ECU:'ec',
  NED:'nl',JPN:'jp',SWE:'se',TUN:'tn',
  BEL:'be',EGY:'eg',IRN:'ir',NZL:'nz',
  ESP:'es',CPV:'cv',KSA:'sa',URU:'uy',
  FRA:'fr',SEN:'sn',IRQ:'iq',NOR:'no',
  ARG:'ar',ALG:'dz',AUT:'at',JOR:'jo',
  POR:'pt',COD:'cd',UZB:'uz',COL:'co',
  ENG:'gb-eng',CRO:'hr',GHA:'gh',PAN:'pa',
};
/* Retorna un <img> de bandera compatible con todos los sistemas (sin depender de emojis) */
function flagImg(code, size){
  const iso = FLAG_ISO2[code];
  if(!iso) return '';
  const px = size||20;
  return `<img src="https://flagcdn.com/${px}x${Math.round(px*0.75)}/${iso}.png" width="${px}" height="${Math.round(px*0.75)}" style="border-radius:2px;vertical-align:middle;margin-right:3px" alt="${code}">`;
}
const GROUPS="ABCDEFGHIJKL".split("");
const GROUP_TEAMS={}; GROUPS.forEach(g=>GROUP_TEAMS[g]=Object.keys(TEAMS).filter(k=>TEAMS[k].g===g));
const RR=[ [[0,1],[2,3]], [[0,2],[3,1]], [[3,0],[1,2]] ];

/* fechas de referencia por jornada de grupos */
const GROUP_DATES={1:"11–17 jun", 2:"18–23 jun", 3:"24–27 jun"};

/* ---------------------------------------------------------------------
   Horarios oficiales de los 72 partidos de grupos — HORA ARGENTINA (UTC−3)
   Fuente: La Nación (calendario en hora argentina). Clave: grupo|jornada|equipos
   ordenados alfabéticamente. Se usan para cerrar la carga y los comodines
   1 hora antes de cada partido.
   --------------------------------------------------------------------- */
const KICKOFFS_GRUPOS={
  "A|1|MEX-RSA":"2026-06-11T16:00:00-03:00","A|1|CZE-KOR":"2026-06-11T23:00:00-03:00",
  "A|2|CZE-RSA":"2026-06-18T13:00:00-03:00","A|2|KOR-MEX":"2026-06-18T22:00:00-03:00",
  "A|3|CZE-MEX":"2026-06-24T22:00:00-03:00","A|3|KOR-RSA":"2026-06-24T22:00:00-03:00",
  "B|1|BIH-CAN":"2026-06-12T16:00:00-03:00","B|1|QAT-SUI":"2026-06-13T16:00:00-03:00",
  "B|2|BIH-SUI":"2026-06-18T16:00:00-03:00","B|2|CAN-QAT":"2026-06-18T19:00:00-03:00",
  "B|3|CAN-SUI":"2026-06-24T16:00:00-03:00","B|3|BIH-QAT":"2026-06-24T16:00:00-03:00",
  "C|1|BRA-MAR":"2026-06-13T19:00:00-03:00","C|1|HAI-SCO":"2026-06-13T22:00:00-03:00",
  "C|2|MAR-SCO":"2026-06-19T19:00:00-03:00","C|2|BRA-HAI":"2026-06-19T22:00:00-03:00",
  "C|3|BRA-SCO":"2026-06-24T19:00:00-03:00","C|3|HAI-MAR":"2026-06-24T19:00:00-03:00",
  "D|1|PAR-USA":"2026-06-12T22:00:00-03:00","D|1|AUS-TUR":"2026-06-14T01:00:00-03:00",
  "D|2|PAR-TUR":"2026-06-21T01:00:00-03:00","D|2|AUS-USA":"2026-06-19T16:00:00-03:00",
  "D|3|TUR-USA":"2026-06-26T23:00:00-03:00","D|3|AUS-PAR":"2026-06-25T23:00:00-03:00",
  "E|1|CUW-GER":"2026-06-14T14:00:00-03:00","E|1|CIV-ECU":"2026-06-14T20:00:00-03:00",
  "E|2|CIV-GER":"2026-06-20T17:00:00-03:00","E|2|CUW-ECU":"2026-06-20T21:00:00-03:00",
  "E|3|ECU-GER":"2026-06-25T17:00:00-03:00","E|3|CIV-CUW":"2026-06-25T17:00:00-03:00",
  "F|1|JPN-NED":"2026-06-14T17:00:00-03:00","F|1|SWE-TUN":"2026-06-14T23:00:00-03:00",
  "F|2|NED-SWE":"2026-06-20T14:00:00-03:00","F|2|JPN-TUN":"2026-06-22T01:00:00-03:00",
  "F|3|JPN-SWE":"2026-06-25T20:00:00-03:00","F|3|NED-TUN":"2026-06-25T20:00:00-03:00",
  "G|1|IRN-NZL":"2026-06-15T22:00:00-03:00","G|1|BEL-EGY":"2026-06-15T16:00:00-03:00",
  "G|2|BEL-IRN":"2026-06-21T16:00:00-03:00","G|2|EGY-NZL":"2026-06-21T22:00:00-03:00",
  "G|3|EGY-IRN":"2026-06-27T00:00:00-03:00","G|3|BEL-NZL":"2026-06-27T00:00:00-03:00",
  "H|1|CPV-ESP":"2026-06-15T13:00:00-03:00","H|1|KSA-URU":"2026-06-15T19:00:00-03:00",
  "H|2|ESP-KSA":"2026-06-21T13:00:00-03:00","H|2|CPV-URU":"2026-06-21T19:00:00-03:00",
  "H|3|CPV-KSA":"2026-06-26T21:00:00-03:00","H|3|ESP-URU":"2026-06-26T21:00:00-03:00",
  "I|1|FRA-SEN":"2026-06-16T16:00:00-03:00","I|1|IRQ-NOR":"2026-06-16T19:00:00-03:00",
  "I|2|FRA-IRQ":"2026-06-22T18:00:00-03:00","I|2|NOR-SEN":"2026-06-22T21:00:00-03:00",
  "I|3|FRA-NOR":"2026-06-26T16:00:00-03:00","I|3|IRQ-SEN":"2026-06-26T16:00:00-03:00",
  "J|1|ALG-ARG":"2026-06-16T22:00:00-03:00","J|1|AUT-JOR":"2026-06-16T02:00:00-03:00",
  "J|2|ARG-AUT":"2026-06-22T14:00:00-03:00","J|2|ALG-JOR":"2026-06-23T01:00:00-03:00",
  "J|3|ALG-AUT":"2026-06-27T23:00:00-03:00","J|3|ARG-JOR":"2026-06-27T23:00:00-03:00",
  "K|1|COD-POR":"2026-06-17T14:00:00-03:00","K|1|COL-UZB":"2026-06-17T23:00:00-03:00",
  "K|2|POR-UZB":"2026-06-23T14:00:00-03:00","K|2|COD-COL":"2026-06-23T23:00:00-03:00",
  "K|3|COL-POR":"2026-06-27T20:30:00-03:00","K|3|COD-UZB":"2026-06-27T20:30:00-03:00",
  "L|1|CRO-ENG":"2026-06-17T17:00:00-03:00","L|1|GHA-PAN":"2026-06-17T20:00:00-03:00",
  "L|2|ENG-GHA":"2026-06-23T17:00:00-03:00","L|2|CRO-PAN":"2026-06-23T20:00:00-03:00",
  "L|3|ENG-PAN":"2026-06-27T18:00:00-03:00","L|3|CRO-GHA":"2026-06-27T18:00:00-03:00",
};
/* Horarios estimados de eliminatorias (las fechas son oficiales; la hora exacta
   depende de qué equipos clasifiquen). Se usa el inicio del día para el corte. */
const KICKOFFS_ELIM={ r32:"2026-06-28T14:00:00-03:00", r16:"2026-07-04T14:00:00-03:00",
  qf:"2026-07-09T14:00:00-03:00", sf:"2026-07-14T16:00:00-03:00",
  tp:"2026-07-18T16:00:00-03:00", final:"2026-07-19T16:00:00-03:00" };

// Ventanas de carga de predicciones por fase eliminatoria (hora ARG = UTC-3)
const ELIM_WINDOWS = {
  r32:     { open:"2026-06-28T01:00:00-03:00", close:"2026-06-28T15:00:00-03:00" },
  r16:     { open:"2026-07-04T01:30:00-03:00", close:"2026-07-04T13:00:00-03:00" },
  qf:      { open:"2026-07-07T20:00:00-03:00", close:"2026-07-09T16:00:00-03:00" },
  sf:      { open:"2026-07-12T01:00:00-03:00", close:"2026-07-14T15:00:00-03:00" },
  tpfinal: { open:"2026-07-15T19:00:00-03:00", close:"2026-07-18T17:00:00-03:00" },
};
/* ─────────────────────────────────────────────────────────────────────
   FECHAS OFICIALES FIFA por partido (fuente única para "a qué día pertenece").
   Independiente de la hora argentina del kickoff. Resuelve el desfase de
   partidos que en ARG se ven de madrugada pero la FIFA fecha el día anterior.
   ───────────────────────────────────────────────────────────────────── */
const FIFA_DATES_GRUPOS = {
  "A|1|MEX-RSA":"2026-06-11","A|1|CZE-KOR":"2026-06-11",
  "B|1|BIH-CAN":"2026-06-12","D|1|PAR-USA":"2026-06-12",
  "B|1|QAT-SUI":"2026-06-13","C|1|BRA-MAR":"2026-06-13","C|1|HAI-SCO":"2026-06-13","D|1|AUS-TUR":"2026-06-13",
  "E|1|CUW-GER":"2026-06-14","F|1|JPN-NED":"2026-06-14","E|1|CIV-ECU":"2026-06-14","F|1|SWE-TUN":"2026-06-14",
  "H|1|CPV-ESP":"2026-06-15","G|1|BEL-EGY":"2026-06-15","H|1|KSA-URU":"2026-06-15","G|1|IRN-NZL":"2026-06-15",
  "I|1|FRA-SEN":"2026-06-16","I|1|IRQ-NOR":"2026-06-16","J|1|ALG-ARG":"2026-06-16","J|1|AUT-JOR":"2026-06-16",
  "K|1|COD-POR":"2026-06-17","L|1|CRO-ENG":"2026-06-17","L|1|GHA-PAN":"2026-06-17","K|1|COL-UZB":"2026-06-17",
  "A|2|CZE-RSA":"2026-06-18","B|2|BIH-SUI":"2026-06-18","B|2|CAN-QAT":"2026-06-18","A|2|KOR-MEX":"2026-06-18",
  "D|2|AUS-USA":"2026-06-19","C|2|MAR-SCO":"2026-06-19","C|2|BRA-HAI":"2026-06-19","D|2|PAR-TUR":"2026-06-19",
  "F|2|NED-SWE":"2026-06-20","E|2|CIV-GER":"2026-06-20","E|2|CUW-ECU":"2026-06-20","F|2|JPN-TUN":"2026-06-20",
  "H|2|ESP-KSA":"2026-06-21","G|2|BEL-IRN":"2026-06-21","H|2|CPV-URU":"2026-06-21","G|2|EGY-NZL":"2026-06-21",
  "J|2|ARG-AUT":"2026-06-22","I|2|FRA-IRQ":"2026-06-22","I|2|NOR-SEN":"2026-06-22","J|2|ALG-JOR":"2026-06-22",
  "K|2|POR-UZB":"2026-06-23","L|2|ENG-GHA":"2026-06-23","L|2|CRO-PAN":"2026-06-23","K|2|COD-COL":"2026-06-23",
  "B|3|CAN-SUI":"2026-06-24","B|3|BIH-QAT":"2026-06-24","C|3|BRA-SCO":"2026-06-24","C|3|HAI-MAR":"2026-06-24","A|3|CZE-MEX":"2026-06-24","A|3|KOR-RSA":"2026-06-24",
  "E|3|CIV-CUW":"2026-06-25","E|3|ECU-GER":"2026-06-25","F|3|JPN-SWE":"2026-06-25","F|3|NED-TUN":"2026-06-25","D|3|TUR-USA":"2026-06-25","D|3|AUS-PAR":"2026-06-25",
  "I|3|FRA-NOR":"2026-06-26","I|3|IRQ-SEN":"2026-06-26","H|3|CPV-KSA":"2026-06-26","H|3|ESP-URU":"2026-06-26","G|3|EGY-IRN":"2026-06-26","G|3|BEL-NZL":"2026-06-26",
  "L|3|ENG-PAN":"2026-06-27","L|3|CRO-GHA":"2026-06-27","K|3|COL-POR":"2026-06-27","K|3|COD-UZB":"2026-06-27","J|3|ALG-AUT":"2026-06-27","J|3|ARG-JOR":"2026-06-27",
};
// Fechas FIFA de eliminatorias por fase (el día oficial de inicio de cada ronda)
const FIFA_DATES_ELIM = {
  r32:"2026-06-28", r16:"2026-07-04", qf:"2026-07-09", sf:"2026-07-14", tp:"2026-07-18", final:"2026-07-19"
};
function koKey(g,j,a,b){ return g+"|"+j+"|"+[a,b].sort().join("-"); }

/* Construcción del fixture (72 grupos + 32 eliminatorias = 104) */
function buildFixture(){
  const M=[]; let id=1;
  GROUPS.forEach(g=>{ const t=GROUP_TEAMS[g];
    [1,2,3].forEach(jor=> RR[jor-1].forEach(pair=>{
      const home=t[pair[0]], away=t[pair[1]];
      const _kk=koKey(g,jor,home,away);
      M.push({id:id++,phase:"grupos",jor,grp:g,home,away,label:`Grupo ${g} · J${jor}`,
        date:GROUP_DATES[jor], kickoff:KICKOFFS_GRUPOS[_kk]||null,
        fifaDate:FIFA_DATES_GRUPOS[_kk]||null});
    }));
  });
  // ── Eliminatorias: cada partido con su posición oficial FIFA ──────
  // home/away = null hasta que el COMIPRO los cargue desde results.elim_fixture
  // slot = número de partido FIFA (P73-P104)
  const R32_MATCHES = [
    {slot:73,label:"P73 · 2°A vs 2°B",        date:"28 jun", kickoff:"2026-06-28T19:00:00-03:00", fifaDate:"2026-06-28"},
    {slot:74,label:"P74 · 1°E vs 3°(A/B/C/D/F)",date:"29 jun",kickoff:"2026-06-29T15:00:00-03:00", fifaDate:"2026-06-29"},
    {slot:75,label:"P75 · 1°F vs 2°C",          date:"29 jun",kickoff:"2026-06-29T18:00:00-03:00", fifaDate:"2026-06-29"},
    {slot:76,label:"P76 · 1°C vs 2°F",          date:"29 jun",kickoff:"2026-06-29T21:00:00-03:00", fifaDate:"2026-06-29"},
    {slot:77,label:"P77 · 1°I vs 3°(C/D/F/G/H)",date:"30 jun",kickoff:"2026-06-30T16:00:00-03:00", fifaDate:"2026-06-30"},
    {slot:78,label:"P78 · 2°E vs 2°I",          date:"30 jun",kickoff:"2026-06-30T19:00:00-03:00", fifaDate:"2026-06-30"},
    {slot:79,label:"P79 · 1°A vs 3°(C/E/F/H/I)",date:"30 jun",kickoff:"2026-06-30T22:00:00-03:00", fifaDate:"2026-06-30"},
    {slot:80,label:"P80 · 1°L vs 3°(E/H/I/J/K)",date:"1 jul", kickoff:"2026-07-01T15:00:00-03:00", fifaDate:"2026-07-01"},
    {slot:81,label:"P81 · 1°D vs 3°(B/E/F/I/J)",date:"1 jul", kickoff:"2026-07-01T18:00:00-03:00", fifaDate:"2026-07-01"},
    {slot:82,label:"P82 · 1°G vs 3°(A/E/H/I/J)",date:"1 jul", kickoff:"2026-07-01T21:00:00-03:00", fifaDate:"2026-07-01"},
    {slot:83,label:"P83 · 2°K vs 2°L",          date:"2 jul", kickoff:"2026-07-02T18:00:00-03:00", fifaDate:"2026-07-02"},
    {slot:84,label:"P84 · 1°H vs 2°J",          date:"2 jul", kickoff:"2026-07-02T19:00:00-03:00", fifaDate:"2026-07-02"},
    {slot:85,label:"P85 · 1°B vs 3°(E/F/G/I/J)",date:"2 jul", kickoff:"2026-07-02T22:00:00-03:00", fifaDate:"2026-07-02"},
    {slot:86,label:"P86 · 1°J vs 2°H",          date:"3 jul", kickoff:"2026-07-03T15:00:00-03:00", fifaDate:"2026-07-03"},
    {slot:87,label:"P87 · 1°K vs 3°(D/E/I/J/L)",date:"3 jul", kickoff:"2026-07-03T18:00:00-03:00", fifaDate:"2026-07-03"},
    {slot:88,label:"P88 · 2°D vs 2°G",          date:"3 jul", kickoff:"2026-07-03T21:00:00-03:00", fifaDate:"2026-07-03"},
  ];
  const R16_MATCHES = [
    {slot:89,label:"P89 · G74 vs G77",date:"4 jul", kickoff:"2026-07-04T16:00:00-03:00", fifaDate:"2026-07-04"},
    {slot:90,label:"P90 · G73 vs G75",date:"4 jul", kickoff:"2026-07-04T20:00:00-03:00", fifaDate:"2026-07-04"},
    {slot:91,label:"P91 · G76 vs G78",date:"5 jul", kickoff:"2026-07-05T16:00:00-03:00", fifaDate:"2026-07-05"},
    {slot:92,label:"P92 · G79 vs G80",date:"5 jul", kickoff:"2026-07-05T20:00:00-03:00", fifaDate:"2026-07-05"},
    {slot:93,label:"P93 · G83 vs G84",date:"6 jul", kickoff:"2026-07-06T16:00:00-03:00", fifaDate:"2026-07-06"},
    {slot:94,label:"P94 · G81 vs G82",date:"6 jul", kickoff:"2026-07-06T20:00:00-03:00", fifaDate:"2026-07-06"},
    {slot:95,label:"P95 · G86 vs G88",date:"7 jul", kickoff:"2026-07-07T16:00:00-03:00", fifaDate:"2026-07-07"},
    {slot:96,label:"P96 · G85 vs G87",date:"7 jul", kickoff:"2026-07-07T20:00:00-03:00", fifaDate:"2026-07-07"},
  ];
  const QF_MATCHES = [
    {slot:97, label:"P97 · G89 vs G90", date:"9 jul", kickoff:"2026-07-09T20:00:00-03:00", fifaDate:"2026-07-09"},
    {slot:98, label:"P98 · G93 vs G94", date:"10 jul",kickoff:"2026-07-10T20:00:00-03:00", fifaDate:"2026-07-10"},
    {slot:99, label:"P99 · G91 vs G92", date:"11 jul",kickoff:"2026-07-11T16:00:00-03:00", fifaDate:"2026-07-11"},
    {slot:100,label:"P100 · G95 vs G96",date:"11 jul",kickoff:"2026-07-11T20:00:00-03:00", fifaDate:"2026-07-11"},
  ];
  const SF_MATCHES = [
    {slot:101,label:"P101 · G97 vs G98", date:"14 jul",kickoff:"2026-07-14T20:00:00-03:00", fifaDate:"2026-07-14"},
    {slot:102,label:"P102 · G99 vs G100",date:"15 jul",kickoff:"2026-07-15T20:00:00-03:00", fifaDate:"2026-07-15"},
  ];
  // los equipos reales se asignan después de loadAll via refreshElimFixture()
  [...R32_MATCHES,...R16_MATCHES,...QF_MATCHES,...SF_MATCHES].forEach(m=>{
    M.push({id:id++,phase:m.slot<=88?"r32":m.slot<=96?"r16":m.slot<=100?"qf":"sf",
      jor:m.slot<=88?4:m.slot<=96?5:m.slot<=100?6:7,
      grp:null,ko:true,slot:m.slot,label:m.label,date:m.date,
      kickoff:m.kickoff,fifaDate:m.fifaDate,
      home:null,away:null});
  });
  // 3er puesto y final
  [{slot:103,phase:"tp", jor:8,label:"3er puesto",  date:"18 jul",kickoff:"2026-07-18T20:00:00-03:00",fifaDate:"2026-07-18"},
   {slot:104,phase:"final",jor:8,label:"FINAL",      date:"19 jul",kickoff:"2026-07-19T20:00:00-03:00",fifaDate:"2026-07-19"}
  ].forEach(m=>{
    M.push({id:id++,phase:m.phase,jor:m.jor,grp:null,ko:true,slot:m.slot,label:m.label,date:m.date,
      kickoff:m.kickoff,fifaDate:m.fifaDate,home:null,away:null});
  });
  return M;
}
const FIXTURE=buildFixture();
/* Fuente única: a qué día (calendario FIFA) pertenece un partido.
   Si por algún motivo falta la fecha FIFA, cae al día calendario ARG del kickoff. */
function fifaDateOf(m){
  if(!m) return null;
  if(m.fifaDate) return m.fifaDate;
  if(m.kickoff) return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(m.kickoff));
  return null;
}
const PHASES=[
  {key:"grupos",label:"Fase de grupos",jors:[1,2,3]},
  {key:"r32",label:"Ronda de 32"},{key:"r16",label:"Octavos"},
  {key:"qf",label:"Cuartos"},{key:"sf",label:"Semifinales"},
  {key:"tp",label:"3er puesto"},{key:"final",label:"Final"},
];

/* Puntajes Tarjeta Principal */
const PTS={ grupos:{exact:5,result:3,gd:1}, ko:{exact:7,result:4,advance:3}, elim:{exact:2,result:2,gd:1, clas_r16:1,clas_qf:3,clas_sf:2,clas_fin:3},
  // Cuadro de honor (planilla COMIPRO): Campeón +4, Sub +3, 3° +2, Botas +3/+2/+1, Balones +3/+2/+1
  extra:{champion:4,runnerup:3,third:2,fourth:1, boot_gold:3,boot_silver:2,boot_bronze:1, ball_gold:3,ball_silver:2,ball_bronze:1},
  // Puntos extra del cuadro autocompletado (Punto 30)
  cuadro:{ pos_grupo:1, clas_r32:1, clas_r16:1, clas_qf:2, clas_sf:3, clas_finals:4 } };

/* Plantel argentino — lista oficial de 26 confirmada por Scaloni y AFA el 28/5/2026.
   Fuente: La Nación / AFA (https://www.lanacion.com.ar - 28 de mayo de 2026). */
const PLANTEL_ARG = [
  // Arqueros (3)
  "Emiliano Martínez","Gerónimo Rulli","Juan Musso",
  // Defensores (8)
  "Cristian Romero","Facundo Medina","Gonzalo Montiel","Leonardo Balerdi",
  "Lisandro Martínez","Nahuel Molina","Nicolás Otamendi","Nicolás Tagliafico",
  // Volantes (7)
  "Alexis Mac Allister","Enzo Fernández","Exequiel Palacios","Giovani Lo Celso",
  "Leandro Paredes","Rodrigo De Paul","Valentín Barco",
  // Delanteros (8)
  "Giuliano Simeone","José Manuel López","Julián Álvarez","Lautaro Martínez",
  "Lionel Messi","Nicolás González","Nicolás Paz","Thiago Almada",
];

/* (La Tarjeta Picada se eliminó del prode — no había tiempo para definirla bien.) */
const SEED_WASABI = [
  {id:"w1", t:"Cantidad de participantes que aciertan el resultado exacto de México - Sudáfrica", pts:10, type:"num"},
  {id:"w2", t:"Cantidad de participantes que aciertan al campeón", pts:10, type:"num", ac:"Los puntos se dan al finalizar el mundial y NO cuentan para el uso de comodines", noComo:true},
  {id:"w3", t:"Cantidad de rojas en todo el mundial", pts:10, type:"num"},
  {id:"w4", t:"Cantidad de amarillas en todo el mundial", pts:10, type:"num"},
  {id:"w5", t:"¿Qué participante sale primero?", pts:16, type:"participant", ac:"Previo a la contabilización de los puntos de las preguntas 5, 6, 7 y 8", noComo:true},
  {id:"w6", t:"¿Qué participante sale segundo?", pts:10, type:"participant", noComo:true},
  {id:"w7", t:"¿Qué participante sale último?", pts:18, type:"participant", noComo:true},
  {id:"w8", t:"¿Qué participante sale anteúltimo?", pts:12, type:"participant", noComo:true},
  {id:"w9", t:"¿Qué jugador argentino recibe la 1° tarjeta amarilla?", pts:10, type:"player", ac:"Si no hay amarillas no se suman puntos"},
  {id:"w10", t:"¿Qué jugador argentino recibe la 1° tarjeta roja?", pts:16, type:"player", ac:"Si no hay rojas no se suman puntos"},
  {id:"w11", t:"Primer jugador argentino en hacer el lagarto", pts:22, type:"player", ac:"Si ninguno lo hace no se suman puntos"},
  {id:"w12", t:"¿Qué argentino lanza su primer garzo en televisión?", pts:22, type:"player", ac:"Tiene que ser jugador de campo, no vale suplente. Si nadie lo hace no se suman puntos"},
  {id:"w13", t:"Primer participante en alertar sobre garzo argentino x grupo de wapp durante el partido", pts:12, type:"bonus", ac:"Son puntos adicionales — no hay que contestar nada (se completa de manera automática)"},
  {id:"w14", t:"¿Qué argentino es el primero en pedir TARJETA?", pts:10, type:"player", ac:"Gesto inequívoco, con mano levantada simulando tarjeta en la mano. Si nadie lo hace no se suman puntos"},
  {id:"w15", t:"Primer participante en alertar sobre gesto de tarjeta x grupo de wapp durante el partido", pts:12, type:"bonus", ac:"Son puntos adicionales — no hay que contestar nada (se completa de manera automática)"},
  {id:"w16", t:"Equipo con más faltas cometidas", pts:10, type:"team", ac:"Los puntos se dan al finalizar el mundial y NO cuentan para el uso de comodines", noComo:true},
  {id:"w17", t:"Equipo con más amarillas", pts:12, type:"team"},
  {id:"w18", t:"Cantidad de partidos que Argentina juega con camiseta SUPLENTE", pts:10, type:"num"},
  {id:"w19", t:"1er jugador del mundial en levantar/agarrar la Copa del Mundo", pts:10, type:"text", ac:"Cualquier jugador del Mundial (no solo argentinos). Escribí el nombre completo"},
  {id:"w20", t:"Cantidad de Followers en INSTAGRAM con los que finaliza Antonela Roccuzzo el mundial (@antonelaroccuzzo)", pts:10, type:"num", ac:"Gana el más cercano. Formato de respuesta: 39M, 40M, 41M, etc. Los puntos se dan al finalizar el mundial y NO cuentan para el uso de comodines", noComo:true},
  {id:"w21", t:"¿En qué minuto mete Argentina su gol más temprano? Gana el más cercano (s/ pág oficial FIFA)", pts:10, type:"approx", ac:"Los puntos se dan al finalizar la fase. No cuentan para el uso de comodines", noComo:true},
  {id:"w22", t:"¿En qué minuto mete Argentina su gol más tardío? Gana el más cercano (s/ pág oficial FIFA)", pts:10, type:"approx", ac:"Los puntos se dan al finalizar la fase. No cuentan para el uso de comodines", noComo:true},
  {id:"w23", t:"¿Quién patea el primer penal argentino?", pts:16, type:"player", ac:"Si no hay penal no se suman puntos"},
  {id:"w24", t:"Equipo que le convierte el primer gol a Argentina", pts:16, type:"team"},
  {id:"w25", t:"Autor del primer gol a favor de Argentina", pts:16, type:"player", ac:"Si es gol en contra del rival no cuenta"},
  {id:"w26", t:"Autor del segundo gol a favor de Argentina", pts:16, type:"player", ac:"Si es gol en contra del rival no cuenta"},
  {id:"w27", t:"¿En el primer partido de Argentina qué equipo gana el sorteo?", pts:10, type:"choice", options:["Argentina","Argelia"]},
  {id:"w28", t:"¿En el primer partido de Argentina el arquero de qué equipo es el primero en tocar la pelota?", pts:10, type:"choice", options:["Argentina","Argelia"], ac:"El equipo del arquero"},
  {id:"w30", t:"¿En el primer partido de Argentina quién es el jugador de la selección argentina que realiza el primer saque lateral?", pts:10, type:"player"},
  {id:"w31", t:"Argentino que ejecuta el primer tiro libre", pts:10, type:"player"},
  {id:"w32", t:"Primer argentino que queda en offside", pts:10, type:"player"},
  {id:"w33", t:"Primer reemplazo: Sale", pts:16, type:"player"},
  {id:"w34", t:"Primer reemplazo: Entra", pts:16, type:"player"},
  {id:"w35", t:"Primer participante en alertar sobre el reemplazo (entra y sale) x grupo de wapp durante el partido", pts:10, type:"bonus", ac:"Son puntos adicionales — no hay que contestar nada (se completa de manera automática)"},
  {id:"w36", t:"¿Quién recibe la primera infracción?", pts:10, type:"player"},
  {id:"w37", t:"¿En qué minuto mete Argentina su gol más temprano? Gana el más cercano (s/ pág oficial FIFA)", pts:18, type:"approx"},
  {id:"w38", t:"¿En qué minuto mete Argentina su gol más tardío? Gana el más cercano (s/ pág oficial FIFA)", pts:10, type:"approx", ac:"Los puntos se dan al finalizar la fase. No cuentan para el uso de comodines", noComo:true},
  {id:"w39", t:"Primera amarilla argentina", pts:10, type:"player"},
  {id:"w40", t:"Primera roja argentina", pts:10, type:"player", ac:"Si no hay no se suman puntos"},
  {id:"w41", t:"Primer reemplazo: Sale", pts:10, type:"player", ac:"Si no hay rojas no se suman puntos"},
  {id:"w42", t:"Primer reemplazo: Entra", pts:16, type:"player"},
  {id:"w43", t:"Primer participante en alertar sobre el reemplazo (entra y sale) x grupo de wapp durante el partido", pts:16, type:"bonus", ac:"Son puntos adicionales — no hay que contestar nada (se completa de manera automática)"},
  {id:"w44", t:"¿Quién comete la primera infracción?", pts:10, type:"player"},
  {id:"w45", t:"¿Quién recibe la primera infracción?", pts:10, type:"player"},
  {id:"w46", t:"¿Quién patea el primer penal argentino? Los penales de definición por penales cuentan en este punto", pts:18, type:"player"},
  {id:"w47", t:"En todo el mundial, ¿que equipo le convierte el primer gol a Argentina (en los 120')?", pts:10, type:"team", ac:"Si no hay penales no se suman puntos"},
  {id:"w48", t:"En todo el mundial, ¿quién es el autor del primer gol a favor de Argentina", pts:22, type:"player"},
  {id:"w49", t:"En todo el mundial ¿quién es el primer jugador argentino en hacer el lagarto?", pts:16, type:"player", ac:"Si es gol en contra del rival no cuenta"},
  {id:"w50", t:"¿Cuántos goles de tiro libre directo en todo el Mundial?", pts:22, type:"text"},
  {id:"w51", t:"¿Cuántos goles olímpicos (de córner directo) en todo el Mundial?", pts:8, type:"num"},
  {id:"w52", t:"¿Habrá algún partido que termine 0-0 en fase de grupos? (Sí/No)", pts:12, type:"yesno"},
  {id:"w53", t:"Primer árbitro que muestra una roja en todo el Mundial (nacionalidad)", pts:6, type:"text"},
  {id:"w54", t:"¿Cuántas veces se ve a Messi tomando agua/Gatorade en la final si Argentina llega?", pts:8, type:"text", ac:"Si Argentina no juega la final no se suman puntos"},
  {id:"w55", t:"¿Aparece algún streaker (invasor de cancha) durante el torneo? (Sí/No)", pts:10, type:"yesno"},
  {id:"w56", t:"Primer país en quedar eliminado matemáticamente del Mundial", pts:12, type:"team", ac:"Bonus +3 si acertás el partido"},
  {id:"w57", t:"¿En qué minuto del partido inaugural (México vs Sudáfrica) se mete el primer gol?", pts:10, type:"approx"},
  {id:"w58", t:"Cantidad de partidos que se definen por penales en eliminatorias", pts:8, type:"num", ac:"Gana el más cercano. Si no hay gol, todos suman 0"},
  {id:"w59", t:"¿Algún jugador se saca la camiseta para festejar y se come amarilla? (Sí/No)", pts:10, type:"yesno"},
  {id:"w60", t:"¿Qué jugador del PingüiProde pierde más puntos por sanciones del COMIPRO?", pts:6, type:"participant"},
];
