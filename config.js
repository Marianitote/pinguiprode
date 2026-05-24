/* =====================================================================
   PINGÜIPRODE · MUNDIAL 2026 — CONFIGURACIÓN
   ---------------------------------------------------------------------
   👉 PEGÁ ACÁ TUS DOS CLAVES DE SUPABASE (ver la guía, paso 3).
      Las encontrás en: Supabase → Project Settings → API
   ===================================================================== */
const SUPABASE_URL  = "https://fbhbanxbylevmgbtftvj.supabase.co";   // ← reemplazá
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiaGJhbnhieWxldm1nYnRmdHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODEzNDksImV4cCI6MjA5NTE1NzM0OX0.VG8aUZT0iF_Rs0QV26uRTyyXtB3RQWFNwu5Y2Q-n56Q";              // ← reemplazá

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
    "2 sanguijuelas por fase para succionar puntos a un rival.",
    "Se avisa el día anterior; vale para la fecha siguiente.",
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
    "Se avisa el día anterior; vale para la fecha siguiente.",
    "Multiplica por 3 los puntos de la Tarjeta Principal de esa fecha.",
    "No son acumulables entre fases.",
  ],
  interaccion: [
    "Nitros y Sanguijuelas no pueden interceder entre sí.",
    "Un jugador no puede usar Sanguijuela y Nitro en la misma fecha (si pide ambas, pierde la 2ª que pida).",
    "Un jugador retado no puede usar su Nitro (si lo pide igual, lo pierde).",
    "Quien pidió Nitro no puede ser retado (quien lo rete pierde su sanguijuela).",
  ],
  corteHoras: 1, // los comodines se pueden pedir hasta 1 hora antes del partido
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

/* Construcción del fixture (72 grupos + 32 eliminatorias = 104) */
function buildFixture(){
  const M=[]; let id=1;
  GROUPS.forEach(g=>{ const t=GROUP_TEAMS[g];
    [1,2,3].forEach(jor=> RR[jor-1].forEach(pair=>
      M.push({id:id++,phase:"grupos",jor,grp:g,home:t[pair[0]],away:t[pair[1]],label:`Grupo ${g} · J${jor}`,date:GROUP_DATES[jor]})));
  });
  [["r32",16,"Ronda de 32","28 jun–3 jul",4],["r16",8,"Octavos","4–7 jul",5],
   ["qf",4,"Cuartos","9–11 jul",6],["sf",2,"Semifinales","14–15 jul",7],
   ["tp",1,"3er puesto","18 jul",8],["final",1,"FINAL","19 jul",8]
  ].forEach(([phase,n,label,date,jor])=>{
    for(let i=0;i<n;i++) M.push({id:id++,phase,jor,grp:null,home:null,away:null,ko:true,label:label+(n>1?` · #${i+1}`:""),date});
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
