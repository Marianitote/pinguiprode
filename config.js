/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — CONFIGURACIÓN
   ---------------------------------------------------------------------
   👉 PEGÁ ACÁ TUS DOS CLAVES DE SUPABASE (ver la guía, paso 3).
      Las encontrás en: Supabase → Project Settings → API
   ===================================================================== */
const SUPABASE_URL  = "https://TU-PROYECTO.supabase.co";   // ← reemplazá
const SUPABASE_ANON = "TU-CLAVE-ANON-PUBLIC";              // ← reemplazá

/* ---------------------------------------------------------------------
   Reglamento 2026 (resumen mostrado dentro de la app)
   --------------------------------------------------------------------- */
const REGLAMENTO_2026 = {
  bono: 3000,
  premio: "Copa y camiseta de la selección",
  tarjetas: [
    {n:"PICADA",   pts:18,  desc:"Una sola pregunta que se disputa ANTES del comienzo del Mundial. Fecha límite: 8/11."},
    {n:"PRINCIPAL",pts:289, desc:"Todos los partidos del Mundial (1ª y 2ª fase) + cuadro de honor (botas y balón de oro/plata/bronce). 144 pts en grupos + 145 en eliminatorias. Fecha límite: 18/11."},
    {n:"WASABI",   pts:null,desc:"Las preguntas que hacen único a este prode. Al lado de cada una se indica cuánto vale. Fecha límite: 18/11."},
  ],
  sanguijuela: [
    "3 sanguijuelas por fase para succionar puntos a un rival.",
    "Se piden en la ventana de 6:00 a 12:00 (hora argentina) del día del primer partido de cada fase.",
    "Solo se puede retar a quien esté hasta 3 posiciones por encima. El 1º no puede retar.",
    "Se juegan SOLO los puntos de la Tarjeta Principal (sin los de la última fecha: mejor jugador, goleador, etc.).",
    "Si el retador hace MÁS puntos que el retado: se lleva todos sus puntos y el retado suma cero esa fecha.",
    "Si el retador hace MENOS: pierde el 50% de los puntos que sacó el retado.",
    "Un jugador no puede ser retado por dos a la vez (vale el primer aviso).",
    "No se puede retar más de dos veces a la misma persona en una fase.",
    "No son acumulables entre fases.",
  ],
  nitro: [
    "2 nitros por fase.",
    "Se piden en la ventana de 6:00 a 12:00 (hora argentina) del día del primer partido de cada fase.",
    "Multiplica por 3 los puntos de la Tarjeta Principal de esa fecha.",
    "El 1° y el 2° no pueden usar nitro.",
    "No son acumulables entre fases.",
  ],
  interaccion: [
    "Nitros y Sanguijuelas no pueden interceder entre sí.",
    "Un jugador no puede usar Sanguijuela y Nitro en la misma fecha (si pide ambas, pierde la 2ª que pida).",
    "Un jugador retado no puede usar su Nitro (si lo pide igual, lo pierde).",
    "Quien pidió Nitro no puede ser retado (quien lo rete pierde su sanguijuela).",
  ],
  ventanaComodines: "6:00 a 12:00 (hora argentina) del día del primer partido de cada fase",
  nahuelito: [
    "Hay un participante que nadie conoce, pero ahí está: El Nahuelito.",
    "Es un BOT que completa sus tarjetas con una fórmula random.",
    "No pelea por el premio; su única motivación es que alguien termine por debajo de él.",
    "Usa sus sanguijuelas en las fechas 3, 6 y 8 contra quien esté justo por encima. Si va primero, las usa en la primera fecha que pierda esa posición.",
    "No avisa: su aviso es 'ahora' y siempre tiene prioridad.",
    "Usa sus nitros solo cuando está en la Zona de Pobreza y tenga nitros disponibles.",
    "Los demás SÍ pueden usar sus sanguijuelas contra El Nahuelito.",
  ],
};

/* ---------------------------------------------------------------------
   Equipos (48) y grupos del Mundial 2026
   --------------------------------------------------------------------- */
const TEAMS = {
  MEX:{n:"México",f:"🇲🇽",g:"A"}, RSA:{n:"Sudáfrica",f:"🇿🇦",g:"A"}, KOR:{n:"Corea del Sur",f:"🇰🇷",g:"A"}, CZE:{n:"Chequia",f:"🇨🇿",g:"A"},
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
  "C|3|BRA-SCO":"2026-06-24T19:00:00-03:00","C|3|HAI-MAR":"2026-06-26T19:00:00-03:00",
  "D|1|PAR-USA":"2026-06-12T22:00:00-03:00","D|1|AUS-TUR":"2026-06-13T01:00:00-03:00",
  "D|2|PAR-TUR":"2026-06-19T01:00:00-03:00","D|2|AUS-USA":"2026-06-19T16:00:00-03:00",
  "D|3|TUR-USA":"2026-06-26T23:00:00-03:00","D|3|AUS-PAR":"2026-06-25T23:00:00-03:00",
  "E|1|CUW-GER":"2026-06-14T14:00:00-03:00","E|1|CIV-ECU":"2026-06-14T20:00:00-03:00",
  "E|2|CIV-GER":"2026-06-20T17:00:00-03:00","E|2|CUW-ECU":"2026-06-20T21:00:00-03:00",
  "E|3|ECU-GER":"2026-06-25T17:00:00-03:00","E|3|CIV-CUW":"2026-06-25T17:00:00-03:00",
  "F|1|JPN-NED":"2026-06-14T17:00:00-03:00","F|1|SWE-TUN":"2026-06-14T23:00:00-03:00",
  "F|2|NED-SWE":"2026-06-20T14:00:00-03:00","F|2|JPN-TUN":"2026-06-20T01:00:00-03:00",
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
function koKey(g,j,a,b){ return g+"|"+j+"|"+[a,b].sort().join("-"); }

/* Construcción del fixture (72 grupos + 32 eliminatorias = 104) */
function buildFixture(){
  const M=[]; let id=1;
  GROUPS.forEach(g=>{ const t=GROUP_TEAMS[g];
    [1,2,3].forEach(jor=> RR[jor-1].forEach(pair=>{
      const home=t[pair[0]], away=t[pair[1]];
      M.push({id:id++,phase:"grupos",jor,grp:g,home,away,label:`Grupo ${g} · J${jor}`,
        date:GROUP_DATES[jor], kickoff:KICKOFFS_GRUPOS[koKey(g,jor,home,away)]||null});
    }));
  });
  [["r32",16,"Ronda de 32","28 jun–3 jul",4],["r16",8,"Octavos","4–7 jul",5],
   ["qf",4,"Cuartos","9–11 jul",6],["sf",2,"Semifinales","14–15 jul",7],
   ["tp",1,"3er puesto","18 jul",8],["final",1,"FINAL","19 jul",8]
  ].forEach(([phase,n,label,date,jor])=>{
    for(let i=0;i<n;i++) M.push({id:id++,phase,jor,grp:null,home:null,away:null,ko:true,
      label:label+(n>1?` · #${i+1}`:""),date, kickoff:KICKOFFS_ELIM[phase]||null});
  });
  return M;
}
const FIXTURE=buildFixture();
const PHASES=[
  {key:"grupos",label:"Fase de grupos",jors:[1,2,3]},
  {key:"r32",label:"Ronda de 32"},{key:"r16",label:"Octavos"},
  {key:"qf",label:"Cuartos"},{key:"sf",label:"Semifinales"},
  {key:"tp",label:"3er puesto"},{key:"final",label:"Final"},
];

/* Puntajes Tarjeta Principal */
const PTS={ grupos:{exact:5,result:3,gd:1}, ko:{exact:7,result:4,advance:3},
  extra:{champion:20,runnerup:12,third:8, boot_gold:12,boot_silver:8,boot_bronze:5, ball_gold:10,ball_silver:6,ball_bronze:4} };

/* Preguntas de ejemplo (editables desde el panel admin) */
const SEED_PICADA = { id:"pic1", t:"¿Cuántos goles se convierten en el partido inaugural (México vs Sudáfrica)?", pts:18, type:"num" };
const SEED_WASABI = [
  {id:"w1", t:"¿Qué jugador argentino comete la primera infracción del Mundial?", pts:50, type:"player"},
  {id:"w2", t:"Cantidad de tarjetas rojas en todo el Mundial", pts:30, type:"num"},
  {id:"w3", t:"Goleador del Mundial (Bota de Oro)", pts:40, type:"player", noComo:true},
  {id:"w4", t:"¿Qué participante sale último (Zona de Pobreza)?", pts:60, type:"participant"},
];
