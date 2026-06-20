export interface Prod {
  id: string;
  fecha: string;
  turno: string;
  maq: string;
  gen: string;
  palets: number;
  sacos: number;
  hp: number;
  hpar: number;
  pub: string;
  op: string;
  obs: string;
}

export interface Sacas {
  id: string;
  fecha: string;
  turno: string;
  gen: string;
  palets: number;
  peso: number;
  hp: number;
  hpar: number;
  pub: string;
  op: string;
  opNombre: string;
  obs: string;
}

export interface Emb {
  id: string;
  fecha: string;
  turno: string;
  maq: string;
  pl: number;
  pref: string;
  fi: number;
  fref: string;
  obs: string;
}

export interface OT {
  id: string;
  num: string;
  maq: string;
  tipo: string;
  prio: string;
  desc: string;
  tec: string;
  t: number;
  fecha: string;
  est: string;
  obs: string;
}

export interface Parada {
  id: string;
  num: string;
  maq: string;
  tipo: string;
  turno: string;
  ini: string;
  fin: string | null;
  desc: string;
  acc: string;
  dur: number | null;
  est: string;
}

export interface PM {
  id: string;
  maq: string;
  desc: string;
  freq: number;
  fecha: string;
  t: number;
  tec: string;
}

export interface Repuesto {
  id: string;
  fecha: string;
  maq: string;
  tipo: string;
  pieza: string;
  ref: string;
  motivo: string;
  prov: string;
  tec: string;
}

export interface Pedido {
  id: string;
  fecha: string;
  prio: string;
  tipo: string;
  desc: string;
  cant: number;
  unidad: string;
  maq: string;
  motivo: string;
  sol: string;
  comprador: string;
  est: string;
  obs: string;
}

export interface PalFix {
  id: string;
  fecha: string;
  turno: string;
  op: string;
  dobles: number;
  mares10: number;
  mares120: number;
  triaje: number;
  obs: string;
}

export interface Gas {
  id: string;
  fecha: string;
  turno: string;
  ref: string;
  serie: string;
  modelo: string;
  medIni: number;
  medFin: number;
  consumo: string;
  horas: number | null;
  op: string;
  obs: string;
  depositoLleno?: boolean;
  depositoTerminado?: boolean;
}

export interface Documento {
  id: string;
  maq: string;
  cat: string;
  nombre: string;
  fecha: string;
  desc: string;
  b64: string | null;
  tamano: string | null;
}

export interface Stock {
  pl: number;
  plPal: number;
  plBob: number;
  pgalga: string;
  pprov: string;
  fi: number;
  fiPal: number;
  fiBob: number;
  fgalga: string;
  fprov: string;
  paletGen?: Record<string, number>;
  paletGenChibetli?: Record<string, number>;
  sacasGen?: Record<string, number>;
  bigBagsVacias?: Record<string, number>;
  plasticosGen?: Record<string, { palets: number; sueltas: number; total: number; galga?: string; prov?: string }>;
  paletsFix?: {
    arreglados: number;
    dobles: number;
    mares10: number;
    mares120: number;
    triaje: number;
  };
  lastUpdatedWeek?: string;
  lastUpdatedDate?: string;
}

export interface Config {
  pwd?: string;
  githubToken?: string;
  githubRepo?: string;
  githubPath?: string;
  weekOverrides?: Record<string, string>;
}

export interface Meta {
  otN: number;
  parN: number;
}

export interface CheckItemState {
  [itemIndex: number]: boolean;
}

export interface CheckList {
  [sectionKey: string]: CheckItemState;
}

export interface StockSalidaLinea {
  productoOriginal: string;
  categoriaStock: "paletGen" | "paletGenChibetli" | "sacasGen" | "bigBagsVacias" | "desconocido";
  productoMatch: string;
  cantidad: number;
  stockPrevio: number;
  stockNuevo: number;
}

export interface StockSalida {
  id: string;
  fecha: string;
  usuario: string;
  cliente: string;
  numAlbaran: string;
  fotoB64: string | null;
  lineas: StockSalidaLinea[];
  leidoCorrectamente: boolean;
  obs?: string;
}

export interface DBState {
  prod: Prod[];
  sacas: Sacas[];
  emb: Emb[];
  ots: OT[];
  paradas: Parada[];
  pm: PM[];
  rep: Repuesto[];
  ped: Pedido[];
  docs: Documento[];
  palfix: PalFix[];
  gas: Gas[];
  stock: Stock;
  cfg: Config;
  meta: Meta;
  chk: CheckList;
  salidasStock?: StockSalida[];
}
