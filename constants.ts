import { DBState } from "./types";

export const SPP = 54; // Sacos Por Palet

export const GEN_PALETS = [
  "0301 - SACO DE GRAVA N.0 Y 2 (CORTE)",
  "0310 - SACO DE GRAVILLA 0/2 ( TALCO)",
  "0308 - SACO DE GRAVILLA N.0/2 (MOLINO)",
  "3035 - ENSACADO",
  "0307 - SACO DE ARENA",
  "0303 - SACO DE GRAVILLA N.0/3 (CORTE)",
  "0306 - SACO DE GRAVILLA N.00 Y 2 (MOLINO)",
  "0304 - SACO DE GRAVILLA N.1",
  "0305 - SACO DE GRAVILLA N.2",
  "0300 - SACO DE PICADIS N.0",
  "0302 - SACO DE PICADIS N.2",
  "0309 - SACO DE PICADIS Y GRAVA N.0/3",
  "3030 - SACO GRAVILLA N.0/3 (MOLINO)"
];

export const GEN_CHIB = [
  "PICADIS 0",
  "GRAVA 0 DE CORTE",
  "GRAVA 1",
  "GRAVA 2",
  "GRAVA 0 Y 2 CORTE",
  "GRAVA 0 Y PICADIS",
  "ARENA"
];

export const GEN_SACAS = [
  "0535 - BIG BAG TURBA RUBIA 0/20MM 5KLPH6.5",
  "0517 - LLENAR SACA ARENA",
  "0527 - LLENAR SACA ARENA BLANCA",
  "0522 - LLENAR SACA DE ARENA NEGRA",
  "0520 - LLENAR SACA DE ARENA NEGRA Y TIERRA",
  "2300500 - LLENAR SACA DE GRAVA CERAMICA N.0",
  "2300501 - LLENAR SACA DE GRAVA CERAMICA N.1",
  "2300502 - LLENAR SACA DE GRAVA CERAMICA N.2",
  "0523 - LLENAR SACA DE GRAVA N.00",
  "0530 - LLENAR SACA ECO-GRAVA",
  "0524 - LLENAR SACA GRAVILLA 0 Y 1 (CORTE)",
  "0529 - LLENAR SACA GRAVILLA 0/2 ***TALCO***",
  "0525 - LLENAR SACA GRAVILLA N. 0/2 (MOLINO)",
  "5130 - LLENAR SACA GRAVILLA N. 0/3 (MOLINO)",
  "0526 - LLENAR SACA GRAVILLA N.0 Y 2 (CORTE)",
  "0516 - LLENAR SACA GRAVILLA N.0 Y 2 (MOLINO)",
  "0513 - LLENAR SACA GRAVILLA N.0/3 (CORTE)",
  "0514 - LLENAR SACA GRAVILLA N.1",
  "0515 - LLENAR SACA GRAVILLA N.2",
  "0519 - LLENAR SACA GRAVILLA N.3",
  "0521 - LLENAR SACA GRAVILLA N.4",
  "5101 - LLENAR SACA PICADIS BLANCO",
  "0510 - LLENAR SACA PICADIS N.0",
  "5131 - LLENAR SACA PICADIS N.1",
  "0512 - LLENAR SACA PICADIS N.2",
  "0528 - LLENAR SACA PICADIS N.3",
  "5100 - LLENAR SACA PICADIS ROIG",
  "0511 - LLENAR SACA PICADIS Y GRAVA 0/3",
  "0518 - LLENAR SACA TIERRA",
  "2300300 - SACO DE GRAVA CERAMICA N.0"
];

export const GEN_BIG_BAGS_VACIAS = [
  "75X75X80",
  "80X80X80",
  "80X80X90",
  "80X80X90 C/TUBO"
];

export const GEN_PLASTICOS = [
  "Transparente Sin Publicidad",
  "Con Publicidad - BigMat",
  "Con Publicidad - BdB"
];

export const MAQUINAS: Record<string, { n: string; c: string }> = {
  cv2080: { n: "M2 (CV2080)", c: "M2" },
  cv05: { n: "M1 (CV05)", c: "M1" },
  general: { n: "General", c: "PLNT" },
  tosa95: { n: "Flejadora Tosa95", c: "TOSA" },
  stock: { n: "Stock", c: "STK" }
};

export const GAS_MAQUINAS: Record<string, { n: string; s: string; m: string; c: string }> = {
  n1: { n: "N1 - H45D01/600", s: "H21204N00763", m: "H45D01/600", c: "Victor" },
  n2: { n: "N2 - H45D02", s: "H2X394J02829", m: "H45D02", c: "Juan M." },
  n3: { n: "N3 - H45D02", s: "H2X394X51287", m: "H45D02", c: "Alberto" },
  n4: { n: "N4 - H25D", s: "H2X392T01123", m: "H25D", c: "Joao" },
  n5: { n: "N5 - H25D", s: "H2X392R00501", m: "H25D", c: "Reserva" },
  n6: { n: "N6 - S20 Barredora", s: "B012018", m: "S20", c: "General" },
  dep_gen: { n: "📦 Depósito Principal (Gasoil - 2.000 L)", s: "Capacidad: 2.000 L", m: "Depósito Gasoil", c: "Suministro General" },
  otro: { n: "Otro", s: "", m: "", c: "" }
};

export const OPERARIOS_SACAS = [
  "RAFAEL",
  "ALBERTO",
  "JUAN MIGUEL",
  "VICTOR",
  "JOAO",
  "GERARD",
  "TONI MONTILLA",
  "TONI MANACOR"
];

export const REPARACIONES_TIPOS = [
  { k: "dobles", n: "Dobles 100x100" },
  { k: "mares10", n: "Mares de 10" },
  { k: "mares120", n: "Mares 120x80" },
  { k: "triaje", n: "Triaje" }
];

export const REPARACIONES_OPERARIOS = [
  "Alberto",
  "Joao",
  "Juan Miguel",
  "Rafael",
  "Tofol",
  "Del Mares"
];

export const PIEZAS_TIPOS = [
  "Correa / Banda",
  "Rodamiento",
  "Cadena",
  "Engranaje",
  "Cadenas, correas y engranajes",
  "Juntas toricas (O-rings)",
  "Sellos",
  "Filtros",
  "Reguladores",
  "Lubricadores",
  "Electrovalvulas",
  "Cilindros neumaticos",
  "Resistencias electricas",
  "Cintas de teflon",
  "Fotocelulas",
  "Microinterruptores",
  "Finales de carrera",
  "Cojinetes",
  "Reles",
  "Contactores",
  "Disyuntores",
  "Racores",
  "Mangueras de aire",
  "Variador",
  "Motor",
  "Sensor",
  "Valvula neumatica",
  "Filtro",
  "Otro"
];

export const PEDIDOS_TIPOS = [
  "Correa / Banda",
  "Rodamiento",
  "Cadenas, correas y engranajes",
  "Juntas toricas (O-rings) y sellos",
  "Filtros, reguladores y lubricadores",
  "Electrovalvulas",
  "Cilindros neumaticos",
  "Resistencias electricas",
  "Cintas de teflon",
  "Fotocelulas",
  "Microinterruptores y finales de carrera",
  "Cojinetes",
  "Reles, contactores y disyuntores",
  "Racores y mangueras de aire",
  "Motor",
  "Filtro",
  "Lubricante",
  "Herramienta",
  "Otro"
];

export const COMPRADORES = [
  "Rafaela",
  "Cristian",
  "Damian",
  "Pedro",
  "Joao",
  "Guillem"
];

export const DOC_CATEGORIAS = [
  "Manual de maquina",
  "Plano mecanico",
  "Esquema electrico",
  "Catalogo de piezas",
  "Certificado",
  "Otro"
];

export const CHECKLIST_DIARIO = [
  "Limpieza general",
  "Revision fugas aceite/aire",
  "Ruidos o vibraciones",
  "Sensores y seguridades",
  "Cables y conexiones electricas",
  "Nivel de lubricacion",
  "Correas y cadenas visibles",
  "Estado general antes del arranque"
];

export const CHECKLIST_SEMANAL = [
  "Limpieza filtros y ventiladores",
  "Apriete tornillos",
  "Engrase puntos lubricacion",
  "Rodamientos y transmisiones",
  "Sistema neumatico",
  "Alarmas y seguridades"
];

export const CHECKLIST_MENSUAL = [
  "Revision correas y sustitucion",
  "Alineacion ejes y poleas",
  "Limpieza cuadros electricos",
  "Ajuste de tensores",
  "Estructuras y soldaduras",
  "Cilindros neumaticos e hidraulicos",
  "Calibracion sensores"
];

export const INITIAL_DB_STATE: DBState = {
  prod: [],
  sacas: [],
  emb: [],
  ots: [],
  paradas: [],
  pm: [],
  rep: [],
  ped: [],
  docs: [],
  palfix: [],
  gas: [],
  stock: {
    pl: 0,
    plPal: 0,
    plBob: 0,
    pgalga: "",
    pprov: "",
    fi: 0,
    fiPal: 0,
    fiBob: 0,
    fgalga: "",
    fprov: "",
    paletGen: {},
    paletGenChibetli: {},
    sacasGen: {},
    bigBagsVacias: {},
    plasticosGen: {},
    paletsFix: {
      arreglados: 0,
      dobles: 0,
      mares10: 0,
      mares120: 0,
      triaje: 0
    },
    lastUpdatedWeek: "",
    lastUpdatedDate: ""
  },
  cfg: {
    pwd: "1972"
  },
  meta: {
    otN: 1,
    parN: 1
  },
  chk: {},
  salidasStock: []
};
