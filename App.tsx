import React, { useState, useEffect, useMemo } from "react";
import Tesseract from "tesseract.js";
import {
  Lock,
  Unlock,
  Settings,
  Plus,
  Calendar,
  Clock,
  User,
  Wrench,
  Sliders,
  CheckSquare,
  Archive,
  RefreshCw,
  Send,
  ChevronRight,
  AlertTriangle,
  FileText,
  Download,
  Share2,
  Layers,
  Fuel,
  Search,
  Check,
  X,
  Trash2,
  FileCode,
  AlertCircle,
  Edit3,
  Upload,
  Camera,
  Sparkles,
  History,
  CheckCircle2,
  ArrowUpCircle
} from "lucide-react";

import {
  Prod,
  Sacas,
  Emb,
  OT,
  Parada,
  PM,
  Repuesto,
  Pedido,
  PalFix,
  Gas,
  Documento,
  Stock,
  DBState,
  CheckList
} from "./types";

import {
  INITIAL_DB_STATE,
  SPP,
  GEN_PALETS,
  GEN_CHIB,
  GEN_SACAS,
  GEN_BIG_BAGS_VACIAS,
  GEN_PLASTICOS,
  MAQUINAS,
  GAS_MAQUINAS,
  CHECKLIST_DIARIO,
  CHECKLIST_SEMANAL,
  CHECKLIST_MENSUAL,
  OPERARIOS_SACAS
} from "./constants";

import {
  listenToFirebase,
  saveToFirebase,
  getFromFirebase,
  pruneOldPhotos
} from "./firebase";
import { CLIENTES } from "./clients";

import { Numpad } from "./components/Numpad";
import { SalidasAlbaranTab } from "./components/SalidasAlbaranTab";
import {
  ProdModal,
  EmbModal,
  SacasModal,
  OTModal,
  ParadaModal,
  RepuestoModal,
  PedidoModal,
  PMModal,
  GasModal,
  StockModal
} from "./components/Modals";

import { CompanyShield } from "./components/CompanyShield";
import { formatStockProductName } from "./utils";

const generateId = (): string => {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
    try {
      return window.crypto.randomUUID();
    } catch {
      // ignore and fallback
    }
  }
  return "id_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36);
};

export function mapGenPaletToChibetli(genName: string): string {
  const norm = (genName || "").toUpperCase();
  if (norm.includes("0300") || norm.includes("PICADIS N.0") || norm.includes("PICADIS 0")) {
    return "PICADIS 0";
  }
  if (norm.includes("0301") || norm.includes("0303") || norm.includes("0 Y 2") || norm.includes("0/3 (CORTE)")) {
    return "GRAVA 0 Y 2 CORTE";
  }
  if (norm.includes("0302") || norm.includes("PICADIS N.2") || norm.includes("PICADIS 2")) {
    return "GRAVA 2";
  }
  if (norm.includes("0305") || norm.includes("N.2") || norm.includes("GRAVILLA N.2") || norm.includes("GRAVILLA 2")) {
    return "GRAVA 2";
  }
  if (norm.includes("0304") || norm.includes("N.1") || norm.includes("GRAVILLA N.1") || norm.includes("GRAVILLA 1")) {
    return "GRAVA 1";
  }
  if (norm.includes("0307") || norm.includes("ARENA")) {
    return "ARENA";
  }
  if (norm.includes("0310") || norm.includes("0/2 ( TALCO)") || norm.includes("0/2 (TALCO)")) {
    return "GRAVA 0 DE CORTE";
  }
  if (norm.includes("0308") || norm.includes("MOLINO") || norm.includes("PICADIS Y GRAVA") || norm.includes("0309") || norm.includes("3030")) {
    return "GRAVA 0 Y PICADIS";
  }
  if (norm.includes("GRAVA") || norm.includes("GRAVILLA")) {
    if (norm.includes("1")) return "GRAVA 1";
    if (norm.includes("2")) return "GRAVA 2";
    return "GRAVA 2";
  }
  return "PICADIS 0";
}

const parseUserDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  
  // Try YYYY-MM-DD
  let match = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day);
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  match = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    return new Date(year, month, day);
  }

  const parsed = new Date(cleanStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
};

const formatDateDMY = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "-";
  const cleanStr = dateStr.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanStr)) return cleanStr;
  
  const parts = cleanStr.split("T")[0].split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (year.length === 4 && month.length <= 2 && day.length <= 2) {
      const d = day.padStart(2, "0");
      const m = month.padStart(2, "0");
      return `${d}/${m}/${year}`;
    }
  }
  
  const parsed = parseUserDate(cleanStr);
  if (parsed && !isNaN(parsed.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
  }
  
  return dateStr;
};

const isStockUpToDate = (lastUpdatedDate: string | undefined): boolean => {
  if (!lastUpdatedDate) return false;
  const stockDate = parseUserDate(lastUpdatedDate);
  if (!stockDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  stockDate.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - stockDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  return diffDays <= 1;
};

interface EditSalidaStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRecord: any) => void;
  record: any;
}

function EditSalidaStockModal({ isOpen, onClose, onSave, record }: EditSalidaStockModalProps) {
  const [fecha, setFecha] = useState("");
  const [usuario, setUsuario] = useState("");
  const [cliente, setCliente] = useState("");
  const [numAlbaran, setNumAlbaran] = useState("");
  const [obs, setObs] = useState("");
  const [lineas, setLineas] = useState<any[]>([]);

  useEffect(() => {
    if (record) {
      setFecha(record.fecha || "");
      setUsuario(record.usuario || "");
      setCliente(record.cliente || "");
      setNumAlbaran(record.numAlbaran || "");
      setObs(record.obs || "");
      setLineas(JSON.parse(JSON.stringify(record.lineas || [])));
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const productSelectorList = [
    ...GEN_PALETS.map(p => ({ k: p, c: "paletGen" as const, label: `Palets - ${p}` })),
    ...GEN_CHIB.map(p => ({ k: p, c: "paletGenChibetli" as const, label: `Son Chibetli - ${p}` })),
    ...GEN_SACAS.map(p => ({ k: p, c: "sacasGen" as const, label: `Sacas Big Bags - ${p}` })),
    ...GEN_BIG_BAGS_VACIAS.map(p => ({ k: p, c: "bigBagsVacias" as const, label: `Bags Vacías - ${p}` }))
  ];

  const handleAddLine = () => {
    setLineas([
      ...lineas,
      {
        productoOriginal: "Añadido manualmente",
        categoriaStock: "paletGen",
        productoMatch: GEN_PALETS[0] || "",
        cantidad: 1,
        stockPrevio: 0,
        stockNuevo: 0
      }
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLineas(lineas.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, val: any) => {
    const newL = [...lineas];
    if (field === "productoMatch") {
      const match = productSelectorList.find(x => x.k === val);
      if (match) {
        newL[idx] = {
          ...newL[idx],
          productoMatch: match.k,
          categoriaStock: match.c
        };
      } else if (val === "none") {
        newL[idx] = {
          ...newL[idx],
          productoMatch: "",
          categoriaStock: "desconocido"
        };
      }
    } else {
      newL[idx] = { ...newL[idx], [field]: val };
    }
    setLineas(newL);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim()) {
      alert("Por favor, introduce el operario.");
      return;
    }
    onSave({
      ...record,
      fecha,
      usuario,
      operario: usuario,
      cliente,
      numAlbaran,
      albaranNum: numAlbaran,
      obs,
      lineas
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#121318] border border-white/10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-md shadow-2xl animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white font-mono">
              Editar Salida de Stock
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form Scrollable */}
        <form onSubmit={handleSaveSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
            {/* Fecha */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-extrabold block">
                Fecha del Albarán
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="w-full bg-black/60 border border-white/15 px-3 py-2 text-white font-semibold focus:outline-none focus:border-orange-500 rounded"
              />
            </div>

            {/* Operador / Usuario */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-extrabold block">
                Operario Autorizante
              </label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                placeholder="Ej. OPERARIO DEMO"
                className="w-full bg-black/60 border border-white/15 px-3 py-2 text-white font-semibold focus:outline-none focus:border-orange-500 rounded"
              />
            </div>

            {/* Cliente */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-extrabold block">
                Cliente
              </label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre del Cliente"
                className="w-full bg-black/60 border border-white/15 px-3 py-2 text-white font-semibold focus:outline-none focus:border-orange-500 rounded"
              />
            </div>

            {/* Num Albaran */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-extrabold block">
                Nº Albarán / Factura
              </label>
              <input
                type="text"
                value={numAlbaran}
                onChange={(e) => setNumAlbaran(e.target.value)}
                placeholder="Código de Albarán"
                className="w-full bg-black/60 border border-white/15 px-3 py-2 text-white font-semibold focus:outline-none focus:border-orange-500 rounded"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-1 font-mono text-xs">
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-extrabold block">
              Observaciones / Notas
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Notas aclaratorias sobre esta salida..."
              className="w-full bg-black/60 border border-white/15 px-3 py-2 text-white font-semibold focus:outline-none focus:border-orange-500 rounded"
            />
          </div>

          {/* Lines Table Editor */}
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-[10px] text-orange-400 uppercase tracking-widest font-black">
                Líneas de Descuento de Stock
              </h4>
              <button
                type="button"
                onClick={handleAddLine}
                className="bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500 hover:text-black transition text-orange-400 px-2 py-1 text-[10px] font-bold uppercase flex items-center gap-1 rounded"
              >
                <Plus className="w-3 h-3" /> Añadir Línea
              </button>
            </div>

            {lineas.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-[11px] uppercase border border-dashed border-white/10 rounded">
                No hay líneas en este registro. Pulsa "Añadir Línea" para agregar una.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {lineas.map((line, idx) => (
                  <div
                    key={idx}
                    className="bg-black/30 border border-white/10 p-3 rounded-md space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      {/* Raw original reference */}
                      <div className="flex-1 w-full sm:w-auto">
                        <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">
                          Texto / Producto Leído
                        </div>
                        <input
                          type="text"
                          value={line.productoOriginal || ""}
                          onChange={(e) => handleLineChange(idx, "productoOriginal", e.target.value)}
                          placeholder="Ref origen"
                          className="w-full bg-black/40 border border-white/10 px-2 py-1 text-[11px] text-white/70 focus:outline-none focus:border-orange-500 rounded"
                        />
                      </div>

                      {/* Matching product selector */}
                      <div className="w-full sm:w-56">
                        <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">
                          Vincular a Stock DB
                        </div>
                        <select
                          value={line.productoMatch || "none"}
                          onChange={(e) => handleLineChange(idx, "productoMatch", e.target.value)}
                          className="w-full bg-black/40 border border-white/10 px-2 py-1 text-[11px] text-white focus:outline-none focus:border-orange-500 rounded"
                        >
                          <option value="none">-- NO VINCULAR / REGISTRO SÓLO TEXTO --</option>
                          {productSelectorList.map((p, pIdx) => (
                            <option key={pIdx} value={p.k}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity field */}
                      <div className="w-full sm:w-20">
                        <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5 text-center sm:text-left">
                          Cantidad
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={line.cantidad}
                          onChange={(e) => handleLineChange(idx, "cantidad", Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full text-center bg-black/40 border border-white/10 px-2 py-1 text-[11px] text-white focus:outline-none focus:border-orange-500 rounded animate-none"
                        />
                      </div>

                      {/* Delete Line Action */}
                      <div className="shrink-0 mt-3 sm:mt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition cursor-pointer"
                          title="Eliminar esta línea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Display palet fraction helper */}
                    {(line.categoriaStock === "paletGen" || line.categoriaStock === "paletGenChibetli") && (
                      <div className="text-[10px] text-orange-400 font-mono bg-orange-400/5 border border-orange-400/10 px-2.5 py-1 rounded inline-block">
                        💡 Equivale a <span className="font-bold">{(line.cantidad / 54).toFixed(3)} palets</span> (con el factor de conversión: 1 palet = 54 sacos)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-zinc-500 leading-normal">
              💡 Al guardar los cambios, el stock de los productos desvinculados se devolverá, y el stock de los nuevos productos vinculados y sus cantidades se descontará en tiempo real automáticamente.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 hover:bg-neutral-800 border border-white/10 text-white hover:border-white text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-orange-500 hover:bg-white text-black font-extrabold uppercase text-xs tracking-widest px-6 py-2.5 flex items-center gap-1.5 transition cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 text-black" /> GUARDAR CAMBIOS
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  // DB State
  const [dbState, setDbState] = useState<DBState>(() => {
    const cached = localStorage.getItem("cas_vilafranquer_state");
    return cached ? JSON.parse(cached) : INITIAL_DB_STATE;
  });

  // Client statuses
  const [isUnlocked, setIsUnlocked] = useState(false);
  const isStockCurrent = isStockUpToDate(dbState.stock?.lastUpdatedDate);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("synced");
  const [dbError, setDbError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Navigation
  const [activeTab, setActiveTab ] = useState<
    "inicio" | "prod_palets" | "prod_sacas" | "rep_palets" | "stock" | "salidas" | "mant" | "gas" | "pedidos" | "config"
  >("inicio");

  // Maintenance Subtabs
  const [mantSubtab, setMantSubtab] = useState<"ots" | "paradas" | "pm" | "repuestos" | "docs" | "checklist">("ots");

  // Production Palets Subtabs
  const [prodSubTab, setProdSubTab] = useState<"registros" | "diario" | "semanal" | "mensual" | "anual">("registros");

  // Production Sacas Subtabs
  const [sacasSubTab, setSacasSubTab] = useState<"registros" | "diario" | "semanal" | "mensual" | "anual">("registros");

  // Pedidos Subtabs
  const [pedidosSubTab, setPedidosSubTab] = useState<"registros" | "mensual" | "anual">("registros");

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMaq, setFilterMaq] = useState("all");

  // Modals visibility and active records
  const [modalOpen, setModalOpen] = useState<{
    numpad: boolean;
    prod: boolean;
    sacas: boolean;
    emb: boolean;
    ot: boolean;
    parada: boolean;
    repuesto: boolean;
    pedido: boolean;
    pm: boolean;
    gas: boolean;
    stock: boolean;
  }>({
    numpad: false,
    prod: false,
    sacas: false,
    emb: false,
    ot: false,
    parada: false,
    repuesto: false,
    pedido: false,
    pm: false,
    gas: false,
    stock: false
  });

  const [activeEditRecord, setActiveEditRecord] = useState<{
    type: "prod" | "sacas" | "emb" | "ot" | "parada" | "repuesto" | "pedido" | "pm" | "gas" | null;
    data: any;
  }>({ type: null, data: null });

  // Quick action panel drawer
  const [quickActionOpen, setQuickActionOpen] = useState(false);

  // Albarán Stock Exit OCR & AI states
  const [albaranImageB64, setAlbaranImageB64] = useState<string | null>(null);
  const [useTestAPI, setUseTestAPI] = useState(false);
  const [geminiModel, setGeminiModel] = useState<"flash" | "pro">("flash");
  const [isAnalyzingAlbaran, setIsAnalyzingAlbaran] = useState(false);
  const [isExtractingLocalOCR, setIsExtractingLocalOCR] = useState(false);
  const [localOcrProgress, setLocalOcrProgress] = useState(0);
  const [localOcrStatusText, setLocalOcrStatusText] = useState("");
  const [albaranError, setAlbaranError] = useState<string | null>(null);
  const [albaranResult, setAlbaranResult] = useState<{
    cliente: string;
    numAlbaran: string;
    lineas: Array<{
      rawName: string;
      matchedProduct: string;
      category: "paletGen" | "paletGenChibetli" | "sacasGen" | "bigBagsVacias" | "desconocido";
      quantity: number;
    }>;
    isLeidoCorrectamente: boolean;
    resumen: string;
  } | null>(null);
  const [albaranOperator, setAlbaranOperator] = useState("");
  const [albaranStep, setAlbaranStep] = useState<"upload" | "review" | "success">("upload");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [albaranObs, setAlbaranObs] = useState("");
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState("");
  const [albaranSubTab, setAlbaranSubTab] = useState<"scan" | "manual" | "historial">("scan");
  const [viewSelectedAlbaranPhoto, setViewSelectedAlbaranPhoto] = useState<string | null>(null);
  const [editingSalidaStock, setEditingSalidaStock] = useState<any | null>(null);

  // Checklist state variables (temporary inside the UI view)
  const [chkDate, setChkDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [chkMaq, setChkMaq] = useState("cv05");
  const [chkFreq, setChkFreq] = useState<"diaria" | "semanal" | "mensual">("diaria");

  // Document addition panel states
  const [newDocData, setNewDocData] = useState({
    maq: "cv05",
    cat: "Manual de maquina",
    nombre: "",
    desc: "",
    b64: "" as string | null,
    tamano: "" as string | null
  });
  const [showDocForm, setShowDocForm] = useState(false);

  // PalFix inline edit states
  const [palFixDate, setPalFixDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [palFixTurn, setPalFixTurn] = useState("Manana");
  const [palFixOp, setPalFixOp] = useState("Alberto");
  const [palFixDob, setPalFixDob] = useState<number | "">("");
  const [palFixM10, setPalFixM10] = useState<number | "">("");
  const [palFixM120, setPalFixM120] = useState<number | "">("");
  const [palFixTri, setPalFixTri] = useState<number | "">("");
  const [palFixHistTab, setPalFixHistTab] = useState<"individual" | "daily" | "weekly" | "monthly" | "yearly">("individual");

  // Live Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Firebase Real-time listeners
  useEffect(() => {
    setSyncStatus("syncing");
    const unsubscribe = listenToFirebase(
      (updatedState) => {
        if (updatedState) {
          // Verify required fields exist before commit
          const cleanState = { 
            ...INITIAL_DB_STATE, 
            ...updatedState, 
            salidasStock: updatedState.salidasStock || [] 
          };
          setDbState(cleanState);
          localStorage.setItem("cas_vilafranquer_state", JSON.stringify(cleanState));
          setSyncStatus("synced");
          setDbError(null);
        }
      },
      () => {
        // Seeding database when no document is found on a freshly provisioned database
        const cached = localStorage.getItem("cas_vilafranquer_state");
        const stateToSeed = cached ? JSON.parse(cached) : INITIAL_DB_STATE;
        saveToFirebase(stateToSeed)
          .then(() => {
            setSyncStatus("synced");
            setDbError(null);
          })
          .catch((err) => {
            console.error("Firebase seeding error:", err);
            setSyncStatus("error");
            setDbError(err.message || String(err));
          });
      },
      (err) => {
        console.error("Firebase sync error:", err);
        setSyncStatus("error");
        setDbError(err.message || String(err));
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync / write database with state updates
  const updateDB = async (newState: DBState) => {
    const prunedState = pruneOldPhotos(newState);
    setDbState(prunedState);
    localStorage.setItem("cas_vilafranquer_state", JSON.stringify(prunedState));
    setSyncStatus("syncing");
    try {
      await saveToFirebase(prunedState);
      setSyncStatus("synced");
      setDbError(null);
    } catch (e: any) {
      console.error("Firebase save error:", e);
      setSyncStatus("error");
      setDbError(e.message || String(e));
    }
  };

  // Safe checks for validation authentication before updates
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireUnlock = (action: () => void) => {
    if (isUnlocked) {
      action();
    } else {
      setPendingAction(() => action);
      setModalOpen((prev) => ({ ...prev, numpad: true }));
    }
  };

  const handleVerifyPIN = (pin: string): boolean => {
    const pinCorrect = pin === (dbState.cfg?.pwd || "1972");
    if (pinCorrect) {
      setIsUnlocked(true);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    }
    return pinCorrect;
  };

  // Multi-model Record saves / modifications
  const handleSaveRecord = (type: string, data: any) => {
    const id = activeEditRecord.data?.id || generateId();
    const isNew = !activeEditRecord.data?.id;

    const newState = { ...dbState };

    if (type === "prod") {
      const record: Prod = { id, ...data };
      if (isNew) {
        newState.prod = [record, ...dbState.prod];
      } else {
        newState.prod = dbState.prod.map((r) => (r.id === id ? record : r));
      }

      // INTEGRATE PRODUCTION WITH STOCK (PROD - PALETGEN)
      const updatedStock = JSON.parse(JSON.stringify(newState.stock || {}));
      if (!updatedStock.paletGen) updatedStock.paletGen = {};
      if (!updatedStock.paletGenChibetli) updatedStock.paletGenChibetli = {};

      if (!isNew) {
        // Subtract OLD quantity from OLD product
        const oldRecord = dbState.prod.find((r) => r.id === id);
        if (oldRecord) {
          const oldGen = oldRecord.gen;
          const oldQty = oldRecord.palets || 0;
          if (oldGen) {
            if (oldRecord.pub === "GRAVILLERA SON CHIBETLI S.L") {
              const chibProd = mapGenPaletToChibetli(oldGen);
              updatedStock.paletGenChibetli[chibProd] = parseFloat(((updatedStock.paletGenChibetli[chibProd] || 0) - oldQty).toFixed(4));
            } else {
              updatedStock.paletGen[oldGen] = parseFloat(((updatedStock.paletGen[oldGen] || 0) - oldQty).toFixed(4));
            }
          }
        }
      }

      // Add NEW quantity to NEW product
      const newGen = data.gen;
      const newQty = data.palets || 0;
      if (newGen) {
        if (data.pub === "GRAVILLERA SON CHIBETLI S.L") {
          const chibProd = mapGenPaletToChibetli(newGen);
          updatedStock.paletGenChibetli[chibProd] = parseFloat(((updatedStock.paletGenChibetli[chibProd] || 0) + newQty).toFixed(4));
        } else {
          updatedStock.paletGen[newGen] = parseFloat(((updatedStock.paletGen[newGen] || 0) + newQty).toFixed(4));
        }
      }
      updatedStock.lastUpdatedDate = new Date().toLocaleDateString("es-ES");
      newState.stock = updatedStock;

    } else if (type === "sacas") {
      const record: Sacas = { id, ...data };
      if (isNew) {
        newState.sacas = [record, ...dbState.sacas];
      } else {
        newState.sacas = dbState.sacas.map((r) => (r.id === id ? record : r));
      }

      // INTEGRATE PRODUCTION WITH STOCK (SACAS - SACASGEN)
      const updatedStock = JSON.parse(JSON.stringify(newState.stock || {}));
      if (!updatedStock.sacasGen) updatedStock.sacasGen = {};

      if (!isNew) {
        // Subtract OLD quantity from OLD product
        const oldRecord = dbState.sacas.find((r) => r.id === id);
        if (oldRecord) {
          const oldGen = oldRecord.gen;
          const oldQty = oldRecord.palets || 0;
          if (oldGen) {
            updatedStock.sacasGen[oldGen] = parseFloat(((updatedStock.sacasGen[oldGen] || 0) - oldQty).toFixed(4));
          }
        }
      }

      // Add NEW quantity to NEW product
      const newGen = data.gen;
      const newQty = data.palets || 0;
      if (newGen) {
        updatedStock.sacasGen[newGen] = parseFloat(((updatedStock.sacasGen[newGen] || 0) + newQty).toFixed(4));
      }
      updatedStock.lastUpdatedDate = new Date().toLocaleDateString("es-ES");
      newState.stock = updatedStock;
    } else if (type === "emb") {
      const record: Emb = { id, ...data };
      if (isNew) {
        newState.emb = [record, ...dbState.emb];
      } else {
        newState.emb = dbState.emb.map((r) => (r.id === id ? record : r));
      }
    } else if (type === "ot") {
      const nextNum = isNew ? `OT-${String(dbState.meta?.otN || 1).padStart(3, "0")}` : activeEditRecord.data.num;
      const record: OT = { id, num: nextNum, ...data };
      if (isNew) {
        newState.ots = [record, ...dbState.ots];
        newState.meta = { ...dbState.meta, otN: (dbState.meta?.otN || 1) + 1 };
      } else {
        newState.ots = dbState.ots.map((r) => (r.id === id ? record : r));
      }
    } else if (type === "parada") {
      const nextNum = isNew ? `PAR-${String(dbState.meta?.parN || 1).padStart(3, "0")}` : activeEditRecord.data.num;
      const record: Parada = { id, num: nextNum, ...data };
      if (isNew) {
        newState.paradas = [record, ...dbState.paradas];
        newState.meta = { ...dbState.meta, parN: (dbState.meta?.parN || 1) + 1 };
      } else {
        newState.paradas = dbState.paradas.map((r) => (r.id === id ? record : r));
      }
    } else if (type === "repuesto") {
      const record: Repuesto = { id, ...data };
      if (isNew) {
        newState.rep = [record, ...dbState.rep];
      } else {
        newState.rep = dbState.rep.map((r) => (r.id === id ? record : r));
      }
    } else if (type === "pedido") {
      const record: Pedido = { id, ...data };
      if (isNew) {
        newState.ped = [record, ...dbState.ped];
      } else {
        newState.ped = dbState.ped.map((r) => (r.id === id ? record : r));
      }
    } else if (type === "pm") {
      const record: PM = { id, ...data };
      if (isNew) {
        newState.pm = [record, ...dbState.pm];
      } else {
        newState.pm = dbState.pm.map((r) => (r.id === id ? record : r));
      }
    } else if (type === "gas") {
      const record: Gas = { id, ...data };
      if (isNew) {
        newState.gas = [record, ...dbState.gas];
      } else {
        newState.gas = dbState.gas.map((r) => (r.id === id ? record : r));
      }
    }

    updateDB(newState);
    setActiveEditRecord({ type: null, data: null });
    setModalOpen((prev) => ({ ...prev, [type]: false }));
  };

  const handleDeleteRecord = (category: "prod" | "sacas" | "emb" | "ot" | "parada" | "pm" | "repuesto" | "pedido" | "gas" | "documento" | "palfix" | "salidaStock", id: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar permanentemente este registro?")) return;

    requireUnlock(() => {
      const newState = { ...dbState };
      if (category === "prod") {
        const origRecord = dbState.prod.find((r) => r.id === id);
        if (origRecord) {
          const updatedStock = JSON.parse(JSON.stringify(newState.stock || {}));
          if (!updatedStock.paletGen) updatedStock.paletGen = {};
          if (!updatedStock.paletGenChibetli) updatedStock.paletGenChibetli = {};
          const oldGen = origRecord.gen;
          const oldQty = origRecord.palets || 0;
          if (oldGen) {
            if (origRecord.pub === "GRAVILLERA SON CHIBETLI S.L") {
              const chibProd = mapGenPaletToChibetli(oldGen);
              updatedStock.paletGenChibetli[chibProd] = parseFloat(((updatedStock.paletGenChibetli[chibProd] || 0) - oldQty).toFixed(4));
            } else {
              updatedStock.paletGen[oldGen] = parseFloat(((updatedStock.paletGen[oldGen] || 0) - oldQty).toFixed(4));
            }
            updatedStock.lastUpdatedDate = new Date().toLocaleDateString("es-ES");
            newState.stock = updatedStock;
          }
        }
        newState.prod = dbState.prod.filter((r) => r.id !== id);
      } else if (category === "sacas") {
        const origRecord = dbState.sacas.find((r) => r.id === id);
        if (origRecord) {
          const updatedStock = JSON.parse(JSON.stringify(newState.stock || {}));
          if (!updatedStock.sacasGen) updatedStock.sacasGen = {};
          const oldGen = origRecord.gen;
          const oldQty = origRecord.palets || 0;
          if (oldGen) {
            updatedStock.sacasGen[oldGen] = parseFloat(((updatedStock.sacasGen[oldGen] || 0) - oldQty).toFixed(4));
            updatedStock.lastUpdatedDate = new Date().toLocaleDateString("es-ES");
            newState.stock = updatedStock;
          }
        }
        newState.sacas = dbState.sacas.filter((r) => r.id !== id);
      }
      else if (category === "emb") newState.emb = dbState.emb.filter((r) => r.id !== id);
      else if (category === "ot") newState.ots = dbState.ots.filter((r) => r.id !== id);
      else if (category === "parada") newState.paradas = dbState.paradas.filter((r) => r.id !== id);
      else if (category === "pm") newState.pm = dbState.pm.filter((r) => r.id !== id);
      else if (category === "repuesto") newState.rep = dbState.rep.filter((r) => r.id !== id);
      else if (category === "pedido") newState.ped = dbState.ped.filter((r) => r.id !== id);
      else if (category === "gas") newState.gas = dbState.gas.filter((r) => r.id !== id);
      else if (category === "documento") newState.docs = dbState.docs.filter((r) => r.id !== id);
      else if (category === "palfix") newState.palfix = dbState.palfix.filter((r) => r.id !== id);
      else if (category === "salidaStock") {
        const origRecord = dbState.salidasStock?.find(x => x.id === id);
        if (origRecord) {
          const updatedStock = JSON.parse(JSON.stringify(newState.stock || {}));
          if (!updatedStock.paletGen) updatedStock.paletGen = {};
          if (!updatedStock.paletGenChibetli) updatedStock.paletGenChibetli = {};
          if (!updatedStock.sacasGen) updatedStock.sacasGen = {};
          if (!updatedStock.bigBagsVacias) updatedStock.bigBagsVacias = {};

          for (const line of origRecord.lineas || []) {
            const cat = line.categoriaStock || line.category;
            const originalMatch = line.productoMatch || line.matchedProduct;
            const qty = line.cantidad;
            if (cat && cat !== "desconocido" && originalMatch) {
              const rFactor = (cat === "paletGen" || cat === "paletGenChibetli") ? 54 : 1;
              const revertVal = parseFloat((qty / rFactor).toFixed(4));
              if (cat === "paletGen") {
                updatedStock.paletGen[originalMatch] = parseFloat(((updatedStock.paletGen[originalMatch] || 0) + revertVal).toFixed(4));
              } else if (cat === "paletGenChibetli") {
                updatedStock.paletGenChibetli[originalMatch] = parseFloat(((updatedStock.paletGenChibetli[originalMatch] || 0) + revertVal).toFixed(4));
              } else if (cat === "sacasGen") {
                updatedStock.sacasGen[originalMatch] = parseFloat(((updatedStock.sacasGen[originalMatch] || 0) + revertVal).toFixed(4));
              } else if (cat === "bigBagsVacias") {
                updatedStock.bigBagsVacias[originalMatch] = parseFloat(((updatedStock.bigBagsVacias[originalMatch] || 0) + revertVal).toFixed(4));
              }
            }
          }
          newState.stock = {
            ...updatedStock,
            lastUpdatedDate: new Date().toLocaleDateString("es-ES")
          };
        }
        newState.salidasStock = (dbState.salidasStock || []).filter((r) => r.id !== id);
      }
      updateDB(newState);
    });
  };

  // Albarán Stock Exit OCR & AI Handlers
  const handleAlbaranImageUpload = (file: File) => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 640;
        const MAX_HEIGHT = 640;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Convert to highly compact JPEG quality to dramatically limit size to 15kb-25kb
          const compressedB64 = canvas.toDataURL("image/jpeg", 0.4);
          setAlbaranImageB64(compressedB64);
          setAlbaranError(null);
        } else {
          setAlbaranError("Error de contexto al optimizar el tamaño de la foto.");
        }
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        setAlbaranError("No se pudo procesar la foto de la cámara para compresión de red.");
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    } catch (err: any) {
      console.error(err);
      setAlbaranError("Error al iniciar el procesamiento de la imagen.");
    }
  };

  const handleLoadDemoAlbaran = (type: string = "mallorca") => {
    // Escoge un operario para pre-llenar obligatoriamente
    setAlbaranError(null);

    let cliente = "GRUPO CONSTRUCTOR MALLORCA";
    let numAlbaran = "TRABAJO-VERIFY-104";
    let operator = "OPERARIO DEMO";
    let desc = "Albarán de prueba generado para verificación de stock";
    let lineas: any[] = [];
    let resumen = "";
    let svgTitle = "ALBARAN AUTOMATA DEMO";

    if (type === "can-pinso") {
      cliente = "CONSTRUCCIONES CAN PINSO S.L.";
      numAlbaran = "ALB-PINSO-9521";
      operator = "OPERARIO CAN PINSO";
      desc = "Verificación de descuento mixto: Palets Generales, Son Chibetli y Sacas.";
      svgTitle = "CAN PINSO DEMO";
      lineas = [
        {
          rawName: "Picadis 2 en palet (Sacos)",
          matchedProduct: "Picadis 2",
          category: "paletGen",
          quantity: 162
        },
        {
          rawName: "Picadis 0 Son Chibetli",
          matchedProduct: "PICADIS 0",
          category: "paletGenChibetli",
          quantity: 54
        },
        {
          rawName: "Saca Grande de Grava N2",
          matchedProduct: "GRAVA Nº2",
          category: "sacasGen",
          quantity: 2
        },
        {
          rawName: "Sacas vacias de 80x80x90",
          matchedProduct: "80X80X90",
          category: "bigBagsVacias",
          quantity: 5
        }
      ];
      resumen = "Demostración de Can Pinso S.L.: Se han cargado 3 palets de Picadis 2 (162 sacos), 1 palet de PICADIS 0 de Son Chibetli (54 sacos), 2 Big Bags de Grava Nº2 y 5 Sacas vacías de 80x80x90 para simulador.";
    } else if (type === "jardineria") {
      cliente = "JARDINERÍA ES RECÓ S.L.";
      numAlbaran = "ALB-RECO-4022";
      operator = "OPERARIO JARDIN";
      desc = "Demostración enfocada en stock de Sacas y Sacas Vacías.";
      svgTitle = "ES RECO - JARDINES";
      lineas = [
        {
          rawName: "Saca Arena Blanca Fina",
          matchedProduct: "ARENA BLANCA",
          category: "sacasGen",
          quantity: 8
        },
        {
          rawName: "Saca de Tierra Cribada",
          matchedProduct: "TIERRA",
          category: "sacasGen",
          quantity: 3
        },
        {
          rawName: "Sacas vacias medianas (75x75x80)",
          matchedProduct: "75X75X80",
          category: "bigBagsVacias",
          quantity: 15
        }
      ];
      resumen = "Demostración de Jardinería Es Recó S.L.: Se han cargado 8 Big Bags de Arena Blanca, 3 Big Bags de Tierra y 15 Sacas vacías medianas de 75x75x80.";
    } else {
      // Default: mallorca
      cliente = "GRUPO CONSTRUCTOR MALLORCA";
      numAlbaran = "TRABAJO-VERIFY-104";
      operator = "OPERARIO MALLORCA";
      desc = "Albarán mixto con picadis general y grava de cantera de Son Chibetli.";
      svgTitle = "MALLORCA CONST.";
      lineas = [
        {
          rawName: "Picadis 0 General",
          matchedProduct: "Picadis 0",
          category: "paletGen",
          quantity: 5
        },
        {
          rawName: "GRAVA 2 Son Chibetli",
          matchedProduct: "GRAVA 2",
          category: "paletGenChibetli",
          quantity: 3
        },
        {
          rawName: "PICADIS Nº 1 (Sacas Big Bag)",
          matchedProduct: "PICADIS Nº 1",
          category: "sacasGen",
          quantity: 10
        },
        {
          rawName: "Big Bag vacio de 80x80x90 con tubo",
          matchedProduct: "80X80X90 C/TUBO",
          category: "bigBagsVacias",
          quantity: 6
        }
      ];
      resumen = "Demostración de Grupo Constructor Mallorca: Se han cargado 5 sacos sueltos de Picadis 0 general, 3 palets de Grava 2 de Son Chibetli (162 sacos), 10 Big Bags de PICADIS Nº 1 y 6 sacas vacías de 80X80X90 C/TUBO.";
    }

    setAlbaranOperator(operator);
    setAlbaranObs(desc);
    
    // Generar un lindo SVG indicativo como preview
    const demoSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="100%" height="100%" fill="%231a1a1a"/><rect x="15" y="15" width="370" height="470" rx="4" fill="none" stroke="%23f97316" stroke-width="2" stroke-dasharray="8 4"/><text x="40" y="65" fill="%23f97316" font-family="monospace" font-size="18" font-weight="bold">${svgTitle}</text><text x="40" y="115" fill="%23a3a3a3" font-family="monospace" font-size="12">Cliente: ${cliente}</text><text x="40" y="145" fill="%23a3a3a3" font-family="monospace" font-size="12">Albaran N: ${numAlbaran}</text><line x1="40" y1="175" x2="360" y2="175" stroke="%233f3f46" stroke-width="2"/>${lineas.map((l, i) => `<text x="40" y="${215 + i*35}" fill="%23e4e4e7" font-family="monospace" font-size="11">${i + 1}. ${l.rawName.slice(0, 20)} -- ${l.quantity}u</text>`).join("")}<line x1="40" y1="365" x2="360" y2="365" stroke="%233f3f46" stroke-width="1"/><text x="40" y="405" fill="%23ef4444" font-family="monospace" font-size="11" font-weight="bold">TEST AUTOMATICO COINCIDENCIA DE STOCK</text><text x="40" y="430" fill="%2371717a" font-family="monospace" font-size="10">Simulacion instantanea de descuento</text></svg>`;
    
    setAlbaranImageB64(demoSvg);
    
    setAlbaranResult({
      cliente: cliente,
      numAlbaran: numAlbaran,
      lineas: lineas,
      isLeidoCorrectamente: true,
      resumen: resumen || "Ejecución automatizada de prueba: Se ha generado un albarán ficticio simulando una compra real de material. Puedes verificar cómo se asocian a tu stock actual, modificar valores si lo deaseas y pulsar en Confirmar para que se descuenten en tiempo real."
    });
    
    setAlbaranStep("review");
  };

  const [customOcrText, setCustomOcrText] = useState("");

  const handleParseCustomTextAlbaran = (inputText: string) => {
    if (!inputText.trim()) {
      setAlbaranError("Por favor, escribe o pega el texto del albarán.");
      return;
    }
    setAlbaranError(null);

    // Heuristics to detect client and lines
    const lines = inputText.split("\n").map(l => l.trim()).filter(Boolean);
    let cliente = "CLIENTE DETECTADO (TEXTO)";
    let numAlbaran = "ALB-TEXT-" + Math.floor(1000 + Math.random() * 9000);
    const parsedLineas: any[] = [];

    // Try to find client keyword
    const clientKeywordIdx = lines.findIndex(l => l.toLowerCase().includes("cliente:") || l.toLowerCase().includes("para:"));
    if (clientKeywordIdx !== -1) {
      cliente = lines[clientKeywordIdx].replace(/cliente:/i, "").replace(/para:/i, "").trim();
    } else if (lines.length > 0) {
      const potentialClient = lines[0];
      if (!/\d/.test(potentialClient) || potentialClient.length > 5) {
        cliente = potentialClient;
      }
    }

    // Try to find albarán number
    const noKeywordIdx = lines.findIndex(l => l.toLowerCase().includes("albarán") || l.toLowerCase().includes("nº") || l.toLowerCase().includes("num:"));
    if (noKeywordIdx !== -1) {
      const match = lines[noKeywordIdx].match(/(?:albarán|nº|num:)\s*([a-zA-Z0-9\-_]+)/i);
      if (match && match[1]) {
        numAlbaran = match[1];
      }
    }

    // Parse product lines
    for (const lineText of lines) {
      if (lineText.toLowerCase().includes("cliente:") || lineText.toLowerCase().includes("albarán")) continue;
      if (lineText === cliente) continue;

      // Extract quantity: first numbers in line
      const qtyMatch = lineText.match(/(\d+)/);
      const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

      let rawName = lineText.replace(/\b\d+\b/g, "").replace(/^[.\-\s*]+/, "").trim();
      if (!rawName || rawName.length < 2) continue;

      let matchedProduct = "";
      let category: "paletGen" | "paletGenChibetli" | "sacasGen" | "bigBagsVacias" | "desconocido" = "desconocido";

      const textLower = rawName.toLowerCase();

      // Check big bags vacias
      if (textLower.includes("75x75") || textLower.includes("vacia") || textLower.includes("vacía") || textLower.includes("80x80")) {
        category = "bigBagsVacias";
        if (textLower.includes("tubo")) {
          matchedProduct = "80X80X90 C/TUBO";
        } else if (textLower.includes("75")) {
          matchedProduct = "75X75X80";
        } else {
          matchedProduct = "80X80X90";
        }
      }
      // Check Palets Son Chibetli
      else if (textLower.includes("chibetli") || textLower.includes("chib") || textLower.includes("son chl")) {
        category = "paletGenChibetli";
        if (textLower.includes("0")) {
          matchedProduct = "PICADIS 0";
        } else if (textLower.includes("1")) {
          matchedProduct = "GRAVA 1";
        } else if (textLower.includes("2")) {
          matchedProduct = "GRAVA 2";
        } else if (textLower.includes("arena")) {
          matchedProduct = "ARENA";
        } else {
          matchedProduct = "PICADIS 0";
        }
      }
      // Check Palets General
      else if (textLower.includes("palet") || textLower.includes("saco") || textLower.includes("picadis 0") || textLower.includes("picadis 2") || textLower.includes("cero")) {
        category = "paletGen";
        if (textLower.includes("picadis 0") || textLower.includes("0")) {
          matchedProduct = "Picadis 0";
        } else if (textLower.includes("picadis 2") || textLower.includes("2")) {
          matchedProduct = "Picadis 2";
        } else if (textLower.includes("arena")) {
          matchedProduct = "Arena";
        } else if (textLower.includes("cero")) {
          matchedProduct = "Cero y Picadis";
        } else {
          matchedProduct = "Picadis 2";
        }
      }
      // Check Sacas / Big Bags
      else {
        category = "sacasGen";
        if (textLower.includes("picadis 0") || textLower.includes("nº 0") || textLower.includes("nº0")) {
          matchedProduct = textLower.includes("rojo") ? "PICADIS Nº 0 (ROJO)" : "PICADIS Nº 0";
        } else if (textLower.includes("picadis 1") || textLower.includes("nº 1") || textLower.includes("nº1")) {
          matchedProduct = "PICADIS Nº 1";
        } else if (textLower.includes("picadis 2") || textLower.includes("nº 2") || textLower.includes("nº2")) {
          matchedProduct = "PICADIS Nº 2";
        } else if (textLower.includes("grava 1") || textLower.includes("grava nº1")) {
          matchedProduct = "GRAVA Nº1";
        } else if (textLower.includes("grava 2") || textLower.includes("grava nº2")) {
          matchedProduct = "GRAVA Nº2";
        } else if (textLower.includes("tierra")) {
          matchedProduct = "TIERRA";
        } else if (textLower.includes("blanca")) {
          matchedProduct = "ARENA BLANCA";
        } else if (textLower.includes("arena")) {
          matchedProduct = "ARENA";
        } else {
          matchedProduct = "PICADIS Nº 1";
        }
      }

      parsedLineas.push({
        rawName: rawName,
        matchedProduct: matchedProduct,
        category: category,
        quantity: quantity
      });
    }

    if (parsedLineas.length === 0) {
      parsedLineas.push({
        rawName: inputText.slice(0, 30),
        matchedProduct: "Picadis 2",
        category: "paletGen",
        quantity: 1
      });
    }

    setAlbaranOperator(albaranOperator || "OPERARIO TEXTO MANUAL");
    if (!albaranObs) {
      setAlbaranObs("Procesado por simulación mediante texto manual.");
    }

    const demoSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="100%" height="100%" fill="%231a1a1a"/><rect x="15" y="15" width="370" height="470" rx="4" fill="none" stroke="%233b82f6" stroke-width="2" stroke-dasharray="8 4"/><text x="40" y="65" fill="%233b82f6" font-family="monospace" font-size="18" font-weight="bold">TEXTO MANUAL PROCESADO</text><text x="40" y="115" fill="%23a3a3a3" font-family="monospace" font-size="12">Cliente: ${cliente}</text><text x="40" y="145" fill="%23a3a3a3" font-family="monospace" font-size="12">Albaran N: ${numAlbaran}</text><line x1="40" y1="175" x2="360" y2="175" stroke="%233f3f46" stroke-width="2"/>${parsedLineas.slice(0, 5).map((l, i) => `<text x="40" y="${215 + i*35}" fill="%23e4e4e7" font-family="monospace" font-size="11">${i + 1}. ${l.rawName.slice(0, 20)} -- ${l.quantity}u</text>`).join("")}<line x1="40" y1="365" x2="360" y2="365" stroke="%233f3f46" stroke-width="1"/><text x="40" y="405" fill="%233b82f6" font-family="monospace" font-size="11" font-weight="bold">MIGRACION DE COMPRA SATISFACTORIA</text><text x="40" y="430" fill="%2371717a" font-family="monospace" font-size="10">Texto manual parsed successfully</text></svg>`;

    setAlbaranImageB64(demoSvg);
    setAlbaranResult({
      cliente: cliente,
      numAlbaran: numAlbaran,
      lineas: parsedLineas,
      isLeidoCorrectamente: true,
      resumen: `Texto simulado procesado correctamente. Encontradas ${parsedLineas.length} líneas de compra.`
    });
    setAlbaranStep("review");
  };

  const analyzeAlbaranWithLocalOCR = async () => {
    if (!albaranImageB64) {
      setAlbaranError("Por favor, selecciona o toma una foto del albarán de venta primero.");
      return;
    }
    setIsExtractingLocalOCR(true);
    setLocalOcrProgress(0);
    setLocalOcrStatusText("Inicializando motor de lectura OCR local (Gratuito)...");
    setAlbaranError(null);

    try {
      let imageToAnalyze: any = albaranImageB64;

      // Pre-decode base64 image on the main thread to avoid worker-side decoding crashes
      if (typeof albaranImageB64 === "string" && albaranImageB64.startsWith("data:")) {
        setLocalOcrStatusText("Decodificando imagen en navegador...");
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const element = new Image();
          element.onload = () => resolve(element);
          element.onerror = () => reject(new Error("Error al convertir la imagen para lectura OCR. Intenta con otra imagen o entrada manual."));
          element.src = albaranImageB64;
        });
        imageToAnalyze = img;
      }

      setLocalOcrStatusText("Cargando modelo de lectura en español...");
      const result = await Tesseract.recognize(imageToAnalyze, 'spa', {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setLocalOcrProgress(Math.floor(m.progress * 100));
            setLocalOcrStatusText(`Procesando imagen: ${Math.floor(m.progress * 100)}% leído`);
          } else {
            setLocalOcrStatusText(`Iniciando motor: ${m.status}`);
          }
        }
      });

      const extractedText = result.data.text;
      if (!extractedText || !extractedText.trim() || extractedText.length < 5) {
        throw new Error("No se ha podido extraer texto reconocible de la foto. Intenta con una imagen más enfocada o introduce el texto manualmente.");
      }

      setLocalOcrProgress(100);
      setLocalOcrStatusText("¡Lector finalizado con éxito! Extrayendo productos...");
      setCustomOcrText(extractedText);
      handleParseCustomTextAlbaran(extractedText);

    } catch (err: any) {
      console.error("Tesseract local OCR error, attempting default english fallback...", err);
      // Try fallback to 'eng' in case 'spa' pack could not be loaded from CDN
      try {
        setLocalOcrStatusText("Intentando lectura con diccionario secundario...");
        const resultFallback = await Tesseract.recognize(albaranImageB64, 'eng', {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setLocalOcrProgress(Math.floor(m.progress * 100));
              setLocalOcrStatusText(`Procesando alternativa eng: ${Math.floor(m.progress * 100)}%`);
            }
          }
        });
        const fallbackText = resultFallback.data.text;
        if (fallbackText && fallbackText.trim().length >= 5) {
          setLocalOcrProgress(100);
          setLocalOcrStatusText("¡Lectura alternativa completada!");
          setCustomOcrText(fallbackText);
          handleParseCustomTextAlbaran(fallbackText);
          return;
        }
      } catch (innerErr) {
        console.error("Tesseract fallback failed", innerErr);
      }

      setAlbaranError(
        `Error al intentar leer la imagen: ${err.message || err}. Recomenda: introduce el texto del albarán manualmente usando el botón 'Entrada Manual' de la derecha.`
      );
    } finally {
      setIsExtractingLocalOCR(false);
    }
  };

  const analyzeAlbaranWithGemini = async () => {
    if (!albaranImageB64) {
      setAlbaranError("Por favor, selecciona o toma una foto del albarán de venta primero.");
      return;
    }
    setIsAnalyzingAlbaran(true);
    setAlbaranError(null);
    try {
      const res = await fetch("/api/analyze-albaran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageB64: albaranImageB64,
          imageMime: albaranImageB64.split(";")[0].split(":")[1] || "image/jpeg",
          selectedModel: geminiModel
        })
      });
      const parsed = await res.json();
      if (!parsed.success) {
        throw new Error(parsed.error || "No se ha podido procesar el albarán con la IA.");
      }
      setAlbaranResult(parsed.data);
      setAlbaranStep("review");
    } catch (err: any) {
      console.error(err);
      setAlbaranError(err.message || "Error al conectar con la IA de reconocimiento.");
    } finally {
      setIsAnalyzingAlbaran(false);
    }
  };

  const confirmAlbaranDeduction = async () => {
    if (!albaranResult) return;
    if (!albaranOperator.trim()) {
      setAlbaranError("Introduce el nombre del operador que autoriza la salida.");
      return;
    }

    const id = "salida_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    const fecha = new Date().toISOString().split("T")[0]; // yyyy-mm-dd format

    // deep copy
    const updatedStock = JSON.parse(JSON.stringify(dbState.stock || {}));
    if (!updatedStock.paletGen) updatedStock.paletGen = {};
    if (!updatedStock.paletGenChibetli) updatedStock.paletGenChibetli = {};
    if (!updatedStock.sacasGen) updatedStock.sacasGen = {};
    if (!updatedStock.bigBagsVacias) updatedStock.bigBagsVacias = {};

    const lineasConStock: any[] = [];
    const isChibetliClient = albaranResult.cliente?.toUpperCase().includes("554") || albaranResult.cliente?.toUpperCase().includes("SON CHIBETLI");

    for (const line of albaranResult.lineas) {
      const { category, matchedProduct, quantity, rawName } = line;
      let stockPrevio = 0;
      let stockNuevo = 0;

      let effectiveCategory = category;
      if (isChibetliClient && category === "paletGen") {
        effectiveCategory = "paletGenChibetli";
      }

      if (effectiveCategory && effectiveCategory !== "desconocido" && matchedProduct) {
        const factor = (effectiveCategory === "paletGen" || effectiveCategory === "paletGenChibetli") ? 54 : 1;
        const discountQty = parseFloat((quantity / factor).toFixed(4));

        if (effectiveCategory === "paletGen") {
          stockPrevio = updatedStock.paletGen[matchedProduct] || 0;
          updatedStock.paletGen[matchedProduct] = parseFloat((Math.max(0, stockPrevio - discountQty)).toFixed(4));
          stockNuevo = updatedStock.paletGen[matchedProduct];
        } else if (effectiveCategory === "paletGenChibetli") {
          stockPrevio = updatedStock.paletGenChibetli[matchedProduct] || 0;
          updatedStock.paletGenChibetli[matchedProduct] = parseFloat((Math.max(0, stockPrevio - discountQty)).toFixed(4));
          stockNuevo = updatedStock.paletGenChibetli[matchedProduct];
        } else if (effectiveCategory === "sacasGen") {
          stockPrevio = updatedStock.sacasGen[matchedProduct] || 0;
          updatedStock.sacasGen[matchedProduct] = parseFloat((Math.max(0, stockPrevio - quantity)).toFixed(4));
          stockNuevo = updatedStock.sacasGen[matchedProduct];
        } else if (effectiveCategory === "bigBagsVacias") {
          stockPrevio = updatedStock.bigBagsVacias[matchedProduct] || 0;
          updatedStock.bigBagsVacias[matchedProduct] = parseFloat((Math.max(0, stockPrevio - quantity)).toFixed(4));
          stockNuevo = updatedStock.bigBagsVacias[matchedProduct];
        }
      }

      lineasConStock.push({
        productoOriginal: rawName,
        categoriaStock: effectiveCategory,
        productoMatch: matchedProduct,
        cantidad: quantity,
        stockPrevio,
        stockNuevo
      });
    }

    // Generamos un modelo visual ultraligero (SVG) para simples comprobaciones en el historial posterior,
    // de esta forma la foto real de la cámara de alta resolución NO se almacena nunca en Firebase / historial,
    // evitando saturar el espacio de base de datos o fallos de sincronización con archivos pesados.
    const itemsSvgLines = lineasConStock.map((l: any, i: number) => {
      const prod = l.productoMatch || l.productoOriginal || "Material";
      const q = l.cantidad || 0;
      const cat = l.categoriaStock || "Varios";
      return `<text x="30" y="${210 + i * 25}" fill="%23ffffff" font-family="monospace" font-size="10">${i + 1}. [${cat}] ${prod.slice(0, 32)}: ${q}u</text>`;
    }).join("");

    const clientShort = albaranResult.cliente ? albaranResult.cliente.slice(0, 35) : "CONTADO";
    const albaralShort = albaranResult.numAlbaran || "S/N";

    const svgModel = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="360" height="420" viewBox="0 0 360 420"><rect width="100%" height="100%" fill="%23121214" rx="6"/><rect x="10" y="10" width="340" height="400" rx="4" fill="none" stroke="%23f97316" stroke-width="1.5" stroke-dasharray="6 3"/><text x="30" y="50" fill="%23f97316" font-family="monospace" font-size="14" font-weight="bold">COMPROBACIÓN DE SALIDA</text><text x="30" y="85" fill="%23a1a1aa" font-family="monospace" font-size="10">Fecha: ${fecha}</text><text x="30" y="105" fill="%23a1a1aa" font-family="monospace" font-size="10">Operario: ${albaranOperator}</text><text x="30" y="130" fill="%23ffffff" font-family="monospace" font-size="11" font-weight="bold">Cliente: ${clientShort}</text><text x="30" y="150" fill="%23ffffff" font-family="monospace" font-size="11" font-weight="bold">Núm Albarán: ${albaralShort}</text><line x1="30" y1="175" x2="330" y2="175" stroke="%2327272a" stroke-width="1.5"/>${itemsSvgLines}<line x1="30" y1="345" x2="330" y2="345" stroke="%2327272a" stroke-width="1"/><text x="30" y="375" fill="%2310b981" font-family="monospace" font-size="9" font-weight="bold">ESTADO: STOCK DESCONTADO (OK)</text><text x="30" y="390" fill="%2371717a" font-family="monospace" font-size="8">Foto de cámara omitida de base de datos.</text></svg>`;

    const nuevoRegistro = {
      id,
      fecha,
      usuario: albaranOperator,
      operario: albaranOperator,
      cliente: albaranResult.cliente,
      numAlbaran: albaranResult.numAlbaran,
      albaranNum: albaranResult.numAlbaran,
      fotoB64: svgModel,
      lineas: lineasConStock,
      leidoCorrectamente: albaranResult.isLeidoCorrectamente,
      obs: albaranObs
    };

    const currentSalidas = dbState.salidasStock || [];
    const updatedState: DBState = {
      ...dbState,
      stock: {
        ...updatedStock,
        lastUpdatedDate: new Date().toLocaleDateString("es-ES"),
      },
      salidasStock: [nuevoRegistro, ...currentSalidas]
    };

    try {
      setSyncStatus("syncing");
      const prunedState = pruneOldPhotos(updatedState);
      await saveToFirebase(prunedState);
      setDbState(prunedState);
      localStorage.setItem("cas_vilafranquer_state", JSON.stringify(prunedState));
      setSyncStatus("synced");

      setOcrSuccessMsg(`Salida registrada y stock descontado correctamente para ${albaranResult.cliente}.`);
      setAlbaranStep("success");
    } catch (err: any) {
      console.error(err);
      setAlbaranError(`Error al actualizar la base de datos: ${err.message || err}`);
    }
  };

  const handleSaveEditedSalidaStock = async (updatedRecord: any) => {
    requireUnlock(async () => {
      const origRecord = dbState.salidasStock?.find(x => x.id === updatedRecord.id);
      if (!origRecord) return;

      // Deep copy current stock to revert old line items and apply new line items
      const updatedStock = JSON.parse(JSON.stringify(dbState.stock || {}));
      if (!updatedStock.paletGen) updatedStock.paletGen = {};
      if (!updatedStock.paletGenChibetli) updatedStock.paletGenChibetli = {};
      if (!updatedStock.sacasGen) updatedStock.sacasGen = {};
      if (!updatedStock.bigBagsVacias) updatedStock.bigBagsVacias = {};

      // 1. REVERT OLD DEDUCTION LEVELS
      for (const line of origRecord.lineas || []) {
        const cat = line.categoriaStock || line.category;
        const originalMatch = line.productoMatch;
        const qty = line.cantidad;
        if (cat && cat !== "desconocido" && originalMatch) {
          const revertFactor = (cat === "paletGen" || cat === "paletGenChibetli") ? 54 : 1;
          const revertQty = parseFloat((qty / revertFactor).toFixed(4));
          if (cat === "paletGen") {
            updatedStock.paletGen[originalMatch] = parseFloat(((updatedStock.paletGen[originalMatch] || 0) + revertQty).toFixed(4));
          } else if (cat === "paletGenChibetli") {
            updatedStock.paletGenChibetli[originalMatch] = parseFloat(((updatedStock.paletGenChibetli[originalMatch] || 0) + revertQty).toFixed(4));
          } else if (cat === "sacasGen") {
            updatedStock.sacasGen[originalMatch] = parseFloat(((updatedStock.sacasGen[originalMatch] || 0) + revertQty).toFixed(4));
          } else if (cat === "bigBagsVacias") {
            updatedStock.bigBagsVacias[originalMatch] = parseFloat(((updatedStock.bigBagsVacias[originalMatch] || 0) + revertQty).toFixed(4));
          }
        }
      }

      // 2. APPLY NEW DEDUCTION LEVELS (calculated dynamically according to current state of line items)
      const processedLineas = (updatedRecord.lineas || []).map((line: any) => {
        const cat = line.categoriaStock || line.category || "desconocido";
        const prd = line.productoMatch || line.matchedProduct || "";
        const qty = parseInt(line.cantidad) || 0;

        let stockPrevio = 0;
        let stockNuevo = 0;

        const discountFactor = (cat === "paletGen" || cat === "paletGenChibetli") ? 54 : 1;
        const discountQty = parseFloat((qty / discountFactor).toFixed(4));

        if (cat && cat !== "desconocido" && prd) {
          if (cat === "paletGen") {
            stockPrevio = updatedStock.paletGen[prd] || 0;
            updatedStock.paletGen[prd] = parseFloat((Math.max(0, stockPrevio - discountQty)).toFixed(4));
            stockNuevo = updatedStock.paletGen[prd];
          } else if (cat === "paletGenChibetli") {
            stockPrevio = updatedStock.paletGenChibetli[prd] || 0;
            updatedStock.paletGenChibetli[prd] = parseFloat((Math.max(0, stockPrevio - discountQty)).toFixed(4));
            stockNuevo = updatedStock.paletGenChibetli[prd];
          } else if (cat === "sacasGen") {
            stockPrevio = updatedStock.sacasGen[prd] || 0;
            updatedStock.sacasGen[prd] = parseFloat((Math.max(0, stockPrevio - qty)).toFixed(4));
            stockNuevo = updatedStock.sacasGen[prd];
          } else if (cat === "bigBagsVacias") {
            stockPrevio = updatedStock.bigBagsVacias[prd] || 0;
            updatedStock.bigBagsVacias[prd] = parseFloat((Math.max(0, stockPrevio - qty)).toFixed(4));
            stockNuevo = updatedStock.bigBagsVacias[prd];
          }
        }

        return {
          ...line,
          categoriaStock: cat,
          productoMatch: prd,
          cantidad: qty,
          stockPrevio,
          stockNuevo
        };
      });

      const finalRecord = {
        ...updatedRecord,
        lineas: processedLineas
      };

      const updatedSalidas = dbState.salidasStock?.map(x => x.id === updatedRecord.id ? finalRecord : x) || [];

      const updatedState: DBState = {
        ...dbState,
        stock: {
          ...updatedStock,
          lastUpdatedDate: new Date().toLocaleDateString("es-ES"),
        },
        salidasStock: updatedSalidas
      };

      try {
        setSyncStatus("syncing");
        const prunedState = pruneOldPhotos(updatedState);
        await saveToFirebase(prunedState);
        setDbState(prunedState);
        localStorage.setItem("cas_vilafranquer_state", JSON.stringify(prunedState));
        setSyncStatus("synced");
        setEditingSalidaStock(null);
      } catch (err: any) {
        console.error(err);
        alert(`Error al actualizar la base de datos: ${err.message || err}`);
      }
    });
  };

  // Trigger modal helper
  const openNewRecord = (type: "prod" | "sacas" | "emb" | "ot" | "parada" | "repuesto" | "pedido" | "pm" | "gas") => {
    requireUnlock(() => {
      setActiveEditRecord({ type, data: null });
      setModalOpen((prev) => ({ ...prev, [type]: true }));
      setQuickActionOpen(false);
    });
  };

  // Edit existing
  const openEditRecord = (type: "prod" | "sacas" | "emb" | "ot" | "parada" | "repuesto" | "pedido" | "pm" | "gas", record: any) => {
    requireUnlock(() => {
      setActiveEditRecord({ type, data: record });
      setModalOpen((prev) => ({ ...prev, [type]: true }));
    });
  };

  // Stock update triggered
  const handleSaveStock = (updatedFields: Partial<Stock>) => {
    const freshStock = { ...dbState.stock, ...updatedFields };
    updateDB({ ...dbState, stock: freshStock });
  };

  // Document Upload File Selection Handler
  const handleDocFileObj = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files?.[0];
    if (!fl) return;
    const sizeMB = (fl.size / (1024 * 1024)).toFixed(2) + " MB";
    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewDocData((prev) => ({
        ...prev,
        b64: ev.target?.result as string,
        tamano: sizeMB
      }));
    };
    reader.readAsDataURL(fl);
  };

  const handleSaveDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocData.nombre.trim()) {
      alert("Por favor, introduce el nombre del documento.");
      return;
    }
    requireUnlock(() => {
      const docRecord: Documento = {
        id: generateId(),
        maq: newDocData.maq,
        cat: newDocData.cat,
        nombre: newDocData.nombre,
        fecha: new Date().toISOString().split("T")[0],
        desc: newDocData.desc,
        b64: newDocData.b64,
        tamano: newDocData.tamano
      };
      updateDB({
        ...dbState,
        docs: [docRecord, ...(dbState.docs || [])]
      });
      setNewDocData({
        maq: "cv05",
        cat: "Manual de maquina",
        nombre: "",
        desc: "",
        b64: null,
        tamano: null
      });
      setShowDocForm(false);
    });
  };

  // Checklist updates state
  const checklistKey = `${chkMaq}_${chkDate}_${chkFreq}`;
  const activeChecklistState = useMemo<Record<number, boolean>>(() => {
    return dbState.chk?.[checklistKey] || {};
  }, [dbState.chk, checklistKey]);

  const toggleChecklistItem = (index: number) => {
    requireUnlock(() => {
      const listMap = { ...dbState.chk };
      const currentList = { ...listMap[checklistKey] };
      currentList[index] = !currentList[index];
      listMap[checklistKey] = currentList;

      updateDB({
        ...dbState,
        chk: listMap
      });
    });
  };

  // PalFix Save Handlers
  const handleSavePalFix = () => {
    if (palFixDob === "" && palFixM10 === "" && palFixM120 === "" && palFixTri === "") {
      alert("Por favor, introduce al menos una cantidad a registrar.");
      return;
    }
    requireUnlock(() => {
      const record: PalFix = {
        id: generateId(),
        fecha: palFixDate,
        turno: palFixTurn,
        op: palFixOp,
        dobles: Number(palFixDob) || 0,
        mares10: Number(palFixM10) || 0,
        mares120: Number(palFixM120) || 0,
        triaje: Number(palFixTri) || 0,
        obs: ""
      };

      // Also dynamically modify stock record!
      const currentStock = { ...dbState.stock };
      const fixStock = { ...currentStock.paletsFix };
      fixStock.arreglados = (fixStock.arreglados || 0) + record.dobles + record.mares10 + record.mares120 + record.triaje;
      fixStock.dobles = (fixStock.dobles || 0) + record.dobles;
      fixStock.mares10 = (fixStock.mares10 || 0) + record.mares10;
      fixStock.mares120 = (fixStock.mares120 || 0) + record.mares120;
      fixStock.triaje = (fixStock.triaje || 0) + record.triaje;

      updateDB({
        ...dbState,
        palfix: [record, ...(dbState.palfix || [])],
        stock: { ...currentStock, paletsFix: fixStock }
      });

      setPalFixDob("");
      setPalFixM10("");
      setPalFixM120("");
      setPalFixTri("");
      alert("Registro de palets reparados guardado y stock actualizado.");
    });
  };

  // Calculated Stats
  const globalStats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayPalets = dbState.prod
      .filter((p) => p.fecha === todayStr)
      .reduce((acc, curr) => acc + curr.palets, 0);

    const todaySacas = dbState.sacas
      .filter((s) => s.fecha === todayStr)
      .reduce((acc, curr) => acc + curr.palets, 0);

    const activeAverias = dbState.paradas.filter((p) => p.est !== "Cerrada").length;
    const activeOTs = dbState.ots.filter((o) => o.est !== "Cerrada").length;
    const pendingPedidos = dbState.ped.filter((p) => p.est === "Pendiente").length;

    return {
      todayPalets,
      todaySacas,
      activeAverias,
      activeOTs,
      pendingPedidos
    };
  }, [dbState]);

  // Helpers and memoized statistics for machine downtime analysis
  const getDowntimeMins = (p: Parada): number => {
    if (!p.ini) return 0;
    const start = new Date(p.ini).getTime();
    const end = (p.est === "Abierta" || !p.fin) ? new Date().getTime() : new Date(p.fin).getTime();
    if (isNaN(start) || isNaN(end)) return 0;
    return Math.max(0, (end - start) / 60000);
  };

  const stoppageStats = useMemo(() => {
    let totalMins = 0;
    let activeMins = 0;
    const machineMins: Record<string, number> = {};

    dbState.paradas.forEach((p) => {
      const mins = getDowntimeMins(p);
      totalMins += mins;
      if (p.est !== "Cerrada" || !p.fin) {
        activeMins += mins;
      }
      machineMins[p.maq] = (machineMins[p.maq] || 0) + mins;
    });

    const downtimeByMachine = Object.entries(machineMins)
      .map(([maq, mins]) => ({
        maq,
        mins,
        days: mins / 1440
      }))
      .sort((a, b) => b.mins - a.mins);

    return {
      totalDowntimeDays: totalMins / 1440,
      activeDowntimeDays: activeMins / 1440,
      downtimeByMachine
    };
  }, [dbState.paradas]);

  // Production History Utilities & Memos
  const getWeekNumber = (d: Date) => {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return {
      year: target.getFullYear(),
      week: 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
    };
  };

  const getWeekRange = (year: number, week: number) => {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = new Date(simple);
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    const monday = new Date(ISOweekStart);
    const sunday = new Date(ISOweekStart);
    sunday.setDate(monday.getDate() + 6);
    
    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}`;
    };
    return `${formatDate(monday)} al ${formatDate(sunday)}`;
  };

  const NOMBRES_MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const dailyHistory = useMemo(() => {
    const groups: Record<string, {
      fecha: string;
      palets: number;
      sacos: number;
      hp: number;
      hpar: number;
      turnos: Set<string>;
      generos: Record<string, number>;
      operarios: Set<string>;
    }> = {};

    dbState.prod.forEach((p) => {
      const dateKey = p.fecha || "Sin fecha";
      if (!groups[dateKey]) {
        groups[dateKey] = {
          fecha: dateKey,
          palets: 0,
          sacos: 0,
          hp: 0,
          hpar: 0,
          turnos: new Set(),
          generos: {},
          operarios: new Set()
        };
      }
      const g = groups[dateKey];
      g.palets += p.palets || 0;
      g.sacos += p.sacos || 0;
      g.hp += p.hp || 0;
      g.hpar += p.hpar || 0;
      if (p.turno) g.turnos.add(p.turno);
      if (p.op) g.operarios.add(p.op);
      if (p.gen) {
        g.generos[p.gen] = (g.generos[p.gen] || 0) + (p.palets || 0);
      }
    });

    return Object.values(groups).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [dbState.prod]);

  const weeklyHistory = useMemo(() => {
    const groups: Record<string, {
      semanaKey: string;
      year: number;
      week: number;
      rango: string;
      palets: number;
      sacos: number;
      hp: number;
      hpar: number;
      turnosCount: number;
      generos: Record<string, number>;
    }> = {};

    dbState.prod.forEach((p) => {
      if (!p.fecha) return;
      const d = new Date(p.fecha + "T00:00:00");
      if (isNaN(d.getTime())) return;
      
      const { year, week } = getWeekNumber(d);
      const semKey = `${year}-W${String(week).padStart(2, '0')}`;

      if (!groups[semKey]) {
        groups[semKey] = {
          semanaKey: semKey,
          year,
          week,
          rango: getWeekRange(year, week),
          palets: 0,
          sacos: 0,
          hp: 0,
          hpar: 0,
          turnosCount: 0,
          generos: {}
        };
      }
      const g = groups[semKey];
      g.palets += p.palets || 0;
      g.sacos += p.sacos || 0;
      g.hp += p.hp || 0;
      g.hpar += p.hpar || 0;
      g.turnosCount += 1;
      if (p.gen) {
        g.generos[p.gen] = (g.generos[p.gen] || 0) + (p.palets || 0);
      }
    });

    return Object.values(groups).sort((a, b) => b.semanaKey.localeCompare(a.semanaKey));
  }, [dbState.prod]);

  const monthlyHistory = useMemo(() => {
    const groups: Record<string, {
      mesKey: string;
      año: number;
      mesNum: number;
      nombreMes: string;
      palets: number;
      sacos: number;
      hp: number;
      hpar: number;
      diasActivos: Set<string>;
      generos: Record<string, number>;
    }> = {};

    dbState.prod.forEach((p) => {
      if (!p.fecha || p.fecha.length < 7) return;
      const mesKey = p.fecha.substring(0, 7);
      const parts = p.fecha.split("-");
      const año = parseInt(parts[0]);
      const mesNum = parseInt(parts[1]) - 1;

      if (!groups[mesKey]) {
        groups[mesKey] = {
          mesKey,
          año,
          mesNum,
          nombreMes: NOMBRES_MESES[mesNum] || "Desconocido",
          palets: 0,
          sacos: 0,
          hp: 0,
          hpar: 0,
          diasActivos: new Set(),
          generos: {}
        };
      }
      const g = groups[mesKey];
      g.palets += p.palets || 0;
      g.sacos += p.sacos || 0;
      g.hp += p.hp || 0;
      g.hpar += p.hpar || 0;
      g.diasActivos.add(p.fecha);
      if (p.gen) {
        g.generos[p.gen] = (g.generos[p.gen] || 0) + (p.palets || 0);
      }
    });

    return Object.values(groups).sort((a, b) => b.mesKey.localeCompare(a.mesKey));
  }, [dbState.prod]);

  const annualHistory = useMemo(() => {
    const groups: Record<string, {
      año: string;
      palets: number;
      sacos: number;
      hp: number;
      hpar: number;
      mesesActivos: Set<string>;
      generos: Record<string, number>;
    }> = {};

    dbState.prod.forEach((p) => {
      if (!p.fecha || p.fecha.length < 4) return;
      const año = p.fecha.substring(0, 4);
      const mesKey = p.fecha.substring(0, 7);

      if (!groups[año]) {
        groups[año] = {
          año,
          palets: 0,
          sacos: 0,
          hp: 0,
          hpar: 0,
          mesesActivos: new Set(),
          generos: {}
        };
      }
      const g = groups[año];
      g.palets += p.palets || 0;
      g.sacos += p.sacos || 0;
      g.hp += p.hp || 0;
      g.hpar += p.hpar || 0;
      g.mesesActivos.add(mesKey);
      if (p.gen) {
        g.generos[p.gen] = (g.generos[p.gen] || 0) + (p.palets || 0);
      }
    });

    return Object.values(groups).sort((a, b) => b.año.localeCompare(a.año));
  }, [dbState.prod]);

  const dailySacasHistory = useMemo(() => {
    const groups: Record<string, {
      fecha: string;
      palets: number;
      peso: number;
      hp: number;
      hpar: number;
      turnos: Set<string>;
      generos: Record<string, number>;
      operarios: Set<string>;
    }> = {};

    dbState.sacas.forEach((s) => {
      const dateKey = s.fecha || "Sin fecha";
      if (!groups[dateKey]) {
        groups[dateKey] = {
          fecha: dateKey,
          palets: 0,
          peso: 0,
          hp: 0,
          hpar: 0,
          turnos: new Set(),
          generos: {},
          operarios: new Set()
        };
      }
      const g = groups[dateKey];
      g.palets += s.palets || 0;
      g.peso += s.peso || 0;
      g.hp += s.hp || 0;
      g.hpar += s.hpar || 0;
      if (s.turno) g.turnos.add(s.turno);
      const opName = s.op === "OTRO" ? s.opNombre : s.op;
      if (opName) g.operarios.add(opName);
      if (s.gen) {
        g.generos[s.gen] = (g.generos[s.gen] || 0) + (s.palets || 0);
      }
    });

    return Object.values(groups).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [dbState.sacas]);

  const weeklySacasHistory = useMemo(() => {
    const groups: Record<string, {
      semanaKey: string;
      year: number;
      week: number;
      rango: string;
      palets: number;
      peso: number;
      hp: number;
      hpar: number;
      turnosCount: number;
      generos: Record<string, number>;
    }> = {};

    dbState.sacas.forEach((s) => {
      if (!s.fecha) return;
      const d = new Date(s.fecha + "T00:00:00");
      if (isNaN(d.getTime())) return;

      const { year, week } = getWeekNumber(d);
      const semKey = `${year}-W${String(week).padStart(2, '0')}`;

      if (!groups[semKey]) {
        groups[semKey] = {
          semanaKey: semKey,
          year,
          week,
          rango: getWeekRange(year, week),
          palets: 0,
          peso: 0,
          hp: 0,
          hpar: 0,
          turnosCount: 0,
          generos: {}
        };
      }
      const g = groups[semKey];
      g.palets += s.palets || 0;
      g.peso += s.peso || 0;
      g.hp += s.hp || 0;
      g.hpar += s.hpar || 0;
      g.turnosCount += 1;
      if (s.gen) {
        g.generos[s.gen] = (g.generos[s.gen] || 0) + (s.palets || 0);
      }
    });

    return Object.values(groups).sort((a, b) => b.semanaKey.localeCompare(a.semanaKey));
  }, [dbState.sacas]);

  const monthlySacasHistory = useMemo(() => {
    const groups: Record<string, {
      mesKey: string;
      año: number;
      mesNum: number;
      nombreMes: string;
      palets: number;
      peso: number;
      hp: number;
      hpar: number;
      diasActivos: Set<string>;
      generos: Record<string, number>;
    }> = {};

    dbState.sacas.forEach((s) => {
      if (!s.fecha || s.fecha.length < 7) return;
      const mesKey = s.fecha.substring(0, 7);
      const parts = s.fecha.split("-");
      const año = parseInt(parts[0]);
      const mesNum = parseInt(parts[1]) - 1;

      if (!groups[mesKey]) {
        groups[mesKey] = {
          mesKey,
          año,
          mesNum,
          nombreMes: NOMBRES_MESES[mesNum] || "Desconocido",
          palets: 0,
          peso: 0,
          hp: 0,
          hpar: 0,
          diasActivos: new Set(),
          generos: {}
        };
      }
      const g = groups[mesKey];
      g.palets += s.palets || 0;
      g.peso += s.peso || 0;
      g.hp += s.hp || 0;
      g.hpar += s.hpar || 0;
      g.diasActivos.add(s.fecha);
      if (s.gen) {
        g.generos[s.gen] = (g.generos[s.gen] || 0) + (s.palets || 0);
      }
    });

    return Object.values(groups).sort((a, b) => b.mesKey.localeCompare(a.mesKey));
  }, [dbState.sacas]);

  const annualSacasHistory = useMemo(() => {
    const groups: Record<string, {
      año: string;
      palets: number;
      peso: number;
      hp: number;
      hpar: number;
      mesesActivos: Set<string>;
      generos: Record<string, number>;
    }> = {};

    dbState.sacas.forEach((s) => {
      if (!s.fecha || s.fecha.length < 4) return;
      const año = s.fecha.substring(0, 4);
      const mesKey = s.fecha.substring(0, 7);

      if (!groups[año]) {
        groups[año] = {
          año,
          palets: 0,
          peso: 0,
          hp: 0,
          hpar: 0,
          mesesActivos: new Set(),
          generos: {}
        };
      }
      const g = groups[año];
      g.palets += s.palets || 0;
      g.peso += s.peso || 0;
      g.hp += s.hp || 0;
      g.hpar += s.hpar || 0;
      g.mesesActivos.add(mesKey);
      if (s.gen) {
        g.generos[s.gen] = (g.generos[s.gen] || 0) + (s.palets || 0);
      }
    });

    return Object.values(groups).sort((a, b) => b.año.localeCompare(a.año));
  }, [dbState.sacas]);

  const monthlyPedidosHistory = useMemo(() => {
    const groups: Record<string, {
      mesKey: string;
      año: number;
      mesNum: number;
      nombreMes: string;
      totalPedidos: number;
      pendientes: number;
      recibidos: number;
      cancelados: number;
      altaPrioridad: number;
      mediaPrioridad: number;
      bajaPrioridad: number;
      tiposCount: Record<string, number>;
    }> = {};

    dbState.ped.forEach((p) => {
      if (!p.fecha || p.fecha.length < 7) return;
      const mesKey = p.fecha.substring(0, 7);
      const parts = p.fecha.split("-");
      const año = parseInt(parts[0]);
      const mesNum = parseInt(parts[1]) - 1;

      if (!groups[mesKey]) {
        groups[mesKey] = {
          mesKey,
          año,
          mesNum,
          nombreMes: NOMBRES_MESES[mesNum] || "Desconocido",
          totalPedidos: 0,
          pendientes: 0,
          recibidos: 0,
          cancelados: 0,
          altaPrioridad: 0,
          mediaPrioridad: 0,
          bajaPrioridad: 0,
          tiposCount: {}
        };
      }
      const g = groups[mesKey];
      g.totalPedidos += 1;
      
      if (p.est === "Recibido") {
        g.recibidos += 1;
      } else if (p.est === "Cancelado") {
        g.cancelados += 1;
      } else {
        g.pendientes += 1;
      }

      if (p.prio === "Alta") g.altaPrioridad += 1;
      else if (p.prio === "Media") g.mediaPrioridad += 1;
      else g.bajaPrioridad += 1;

      if (p.tipo) {
        g.tiposCount[p.tipo] = (g.tiposCount[p.tipo] || 0) + 1;
      }
    });

    return Object.values(groups).sort((a, b) => b.mesKey.localeCompare(a.mesKey));
  }, [dbState.ped]);

  const annualPedidosHistory = useMemo(() => {
    const groups: Record<string, {
      año: string;
      totalPedidos: number;
      pendientes: number;
      recibidos: number;
      cancelados: number;
      altaPrioridad: number;
      mediaPrioridad: number;
      bajaPrioridad: number;
      mesesActivos: Set<string>;
      tiposCount: Record<string, number>;
    }> = {};

    dbState.ped.forEach((p) => {
      if (!p.fecha || p.fecha.length < 4) return;
      const año = p.fecha.substring(0, 4);
      const mesKey = p.fecha.substring(0, 7);

      if (!groups[año]) {
        groups[año] = {
          año,
          totalPedidos: 0,
          pendientes: 0,
          recibidos: 0,
          cancelados: 0,
          altaPrioridad: 0,
          mediaPrioridad: 0,
          bajaPrioridad: 0,
          mesesActivos: new Set(),
          tiposCount: {}
        };
      }
      const g = groups[año];
      g.totalPedidos += 1;
      g.mesesActivos.add(mesKey);

      if (p.est === "Recibido") {
        g.recibidos += 1;
      } else if (p.est === "Cancelado") {
        g.cancelados += 1;
      } else {
        g.pendientes += 1;
      }

      if (p.prio === "Alta") g.altaPrioridad += 1;
      else if (p.prio === "Media") g.mediaPrioridad += 1;
      else g.bajaPrioridad += 1;

      if (p.tipo) {
        g.tiposCount[p.tipo] = (g.tiposCount[p.tipo] || 0) + 1;
      }
    });

    return Object.values(groups).sort((a, b) => b.año.localeCompare(a.año));
  }, [dbState.ped]);

  // Filters for DB Lists
  const filteredProd = useMemo(() => {
    return dbState.prod.filter((p) => {
      const matchSearch =
        p.gen.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.op.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMaq = filterMaq === "all" || p.maq === filterMaq;
      return matchSearch && matchMaq;
    });
  }, [dbState.prod, searchTerm, filterMaq]);

  const filteredSacas = useMemo(() => {
    return dbState.sacas.filter((s) => {
      const matchSearch =
        s.gen.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.op.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.opNombre?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [dbState.sacas, searchTerm]);

  const filteredOts = useMemo(() => {
    return dbState.ots.filter((o) => {
      const matchSearch =
        o.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.tec.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.num.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMaq = filterMaq === "all" || o.maq === filterMaq;
      return matchSearch && matchMaq;
    });
  }, [dbState.ots, searchTerm, filterMaq]);

  const filteredParadas = useMemo(() => {
    return dbState.paradas.filter((p) => {
      const matchSearch =
        p.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.acc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.num.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMaq = filterMaq === "all" || p.maq === filterMaq;
      return matchSearch && matchMaq;
    });
  }, [dbState.paradas, searchTerm, filterMaq]);

  const filteredRepuestos = useMemo(() => {
    return dbState.rep.filter((r) => {
      const matchSearch =
        r.pieza.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.tec.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMaq = filterMaq === "all" || r.maq === filterMaq;
      return matchSearch && matchMaq;
    });
  }, [dbState.rep, searchTerm, filterMaq]);

  const filteredPedidos = useMemo(() => {
    return dbState.ped.filter((p) => {
      const matchSearch =
        p.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchMaq = filterMaq === "all" || p.maq === filterMaq;
      return matchSearch && matchMaq;
    });
  }, [dbState.ped, searchTerm, filterMaq]);

  const filteredGas = useMemo(() => {
    return dbState.gas.filter((g) => {
      const matchSearch =
        g.op.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.ref.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [dbState.gas, searchTerm]);

  const gasTankStats = useMemo(() => {
    // Sort from oldest to newest to follow chronological consumption
    const sortedGas = [...dbState.gas].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    let lastRefillIndex = -1;
    for (let i = sortedGas.length - 1; i >= 0; i--) {
      if (sortedGas[i].depositoLleno) {
        lastRefillIndex = i;
        break;
      }
    }
    let lastRefillDate = "No registrada (Se asume depósito lleno al principio)";
    let consumedSinceRefill = 0;
    const historyOfDeductions: Array<{ id: string; fecha: string; turno: string; ref: string; consumo: number; runningLevel: number; op: string }> = [];
    
    let currentLevel = 2000;
    const capacityVal = 2000;

    if (lastRefillIndex !== -1) {
      lastRefillDate = sortedGas[lastRefillIndex].fecha;
      // We start at 2000 L on the last refill
      currentLevel = capacityVal;
      
      // Calculate deductions of all logs registered AFTER the last refill
      for (let i = lastRefillIndex + 1; i < sortedGas.length; i++) {
        const log = sortedGas[i];
        if (!log.depositoLleno) {
          const consumption = Number(log.consumo) || 0;
          consumedSinceRefill += consumption;
          currentLevel = Math.max(0, currentLevel - consumption);
          historyOfDeductions.push({
            id: log.id || `${i}`,
            fecha: log.fecha,
            turno: log.turno === "Manana" ? "Mañana" : "Tarde",
            ref: log.ref,
            consumo: consumption,
            runningLevel: currentLevel,
            op: log.op || "S/O"
          });
        }
      }
    } else {
      // If no refill has ever been marked as full, we subtract from 2000
      currentLevel = capacityVal;
      for (let i = 0; i < sortedGas.length; i++) {
        const log = sortedGas[i];
        const consumption = Number(log.consumo) || 0;
        consumedSinceRefill += consumption;
        currentLevel = Math.max(0, currentLevel - consumption);
        historyOfDeductions.push({
          id: log.id || `${i}`,
          fecha: log.fecha,
          turno: log.turno === "Manana" ? "Mañana" : "Tarde",
          ref: log.ref,
          consumo: consumption,
          runningLevel: currentLevel,
          op: log.op || "S/O"
        });
      }
    }
    
    const estimatedLevel = Math.max(0, currentLevel);
    const estimatedPercent = Math.min(100, Math.max(0, (estimatedLevel / capacityVal) * 105)); // Slight visual padding but capped at 100
    const finalPercent = Math.min(100, (estimatedLevel / capacityVal) * 100);

    return {
      lastRefillDate,
      consumedSinceRefill,
      estimatedLevel,
      estimatedPercent: finalPercent,
      hasRefill: lastRefillIndex !== -1,
      historyOfDeductions: historyOfDeductions.reverse() // Newest first
    };
  }, [dbState.gas]);

  const palFixStats = useMemo(() => {
    const list = dbState.palfix || [];
    
    // Helpers to prevent timezone shifting
    const getMondayOfDate = (dateStr: string) => {
      const parts = dateStr.split("-");
      if (parts.length !== 3) return dateStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      const d = new Date(year, month, day);
      if (isNaN(d.getTime())) return dateStr;
      
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const mon = new Date(year, month, diff);
      
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
    };

    const getWeekFormatted = (monStr: string) => {
      const parts = monStr.split("-");
      if (parts.length !== 3) return monStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      const monday = new Date(year, month, day);
      if (isNaN(monday.getTime())) return monStr;
      
      const sunday = new Date(year, month, day + 6);
      
      const pad = (n: number) => String(n).padStart(2, "0");
      const monFormat = `${pad(monday.getDate())}/${pad(monday.getMonth() + 1)}`;
      const sunFormat = `${pad(sunday.getDate())}/${pad(sunday.getMonth() + 1)}`;
      
      const startOfYear = new Date(monday.getFullYear(), 0, 1);
      const days = Math.floor((monday.getTime() - startOfYear.getTime()) / 86400000);
      const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);

      return `Semana ${weekNumber} (${monFormat} al ${sunFormat} - ${monday.getFullYear()})`;
    };

    const getMonthFormatted = (monthStr: string) => {
      const parts = monthStr.split("-");
      if (parts.length !== 2) return monthStr;
      const y = parts[0];
      const m = parts[1];
      const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];
      const monthIdx = parseInt(m, 10) - 1;
      return `${months[monthIdx] || m} ${y}`;
    };

    const todayObj = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${todayObj.getFullYear()}-${pad(todayObj.getMonth() + 1)}-${pad(todayObj.getDate())}`;
    
    const thisWeekMondayStr = getMondayOfDate(todayStr);
    const thisMonthStr = todayStr.slice(0, 7);
    const thisYearStr = todayStr.slice(0, 4);

    let totalToday = 0;
    let totalThisWeek = 0;
    let totalThisMonth = 0;
    let totalThisYear = 0;

    // Maps for grouping
    const dailyMap: Record<string, { key: string; dobles: number; m10: number; m120: number; triaje: number; total: number; count: number }> = {};
    const weeklyMap: Record<string, { key: string; dobles: number; m10: number; m120: number; triaje: number; total: number; count: number }> = {};
    const monthlyMap: Record<string, { key: string; dobles: number; m10: number; m120: number; triaje: number; total: number; count: number }> = {};
    const yearlyMap: Record<string, { key: string; dobles: number; m10: number; m120: number; triaje: number; total: number; count: number }> = {};

    list.forEach((f) => {
      const d = Number(f.dobles) || 0;
      const m10 = Number(f.mares10) || 0;
      const m120 = Number(f.mares120) || 0;
      const t = Number(f.triaje) || 0;
      const sum = d + m10 + m120 + t;

      const fMonday = getMondayOfDate(f.fecha);
      const fMonth = f.fecha.slice(0, 7);
      const fYear = f.fecha.slice(0, 4);

      // Calculations for metrics cards
      if (f.fecha === todayStr) totalToday += sum;
      if (fMonday === thisWeekMondayStr) totalThisWeek += sum;
      if (fMonth === thisMonthStr) totalThisMonth += sum;
      if (fYear === thisYearStr) totalThisYear += sum;

      // Grouping: Daily
      if (!dailyMap[f.fecha]) {
        dailyMap[f.fecha] = { key: f.fecha, dobles: 0, m10: 0, m120: 0, triaje: 0, total: 0, count: 0 };
      }
      dailyMap[f.fecha].dobles += d;
      dailyMap[f.fecha].m10 += m10;
      dailyMap[f.fecha].m120 += m120;
      dailyMap[f.fecha].triaje += t;
      dailyMap[f.fecha].total += sum;
      dailyMap[f.fecha].count += 1;

      // Grouping: Weekly
      if (!weeklyMap[fMonday]) {
        weeklyMap[fMonday] = { key: fMonday, dobles: 0, m10: 0, m120: 0, triaje: 0, total: 0, count: 0 };
      }
      weeklyMap[fMonday].dobles += d;
      weeklyMap[fMonday].m10 += m10;
      weeklyMap[fMonday].m120 += m120;
      weeklyMap[fMonday].triaje += t;
      weeklyMap[fMonday].total += sum;
      weeklyMap[fMonday].count += 1;

      // Grouping: Monthly
      if (!monthlyMap[fMonth]) {
        monthlyMap[fMonth] = { key: fMonth, dobles: 0, m10: 0, m120: 0, triaje: 0, total: 0, count: 0 };
      }
      monthlyMap[fMonth].dobles += d;
      monthlyMap[fMonth].m10 += m10;
      monthlyMap[fMonth].m120 += m120;
      monthlyMap[fMonth].triaje += t;
      monthlyMap[fMonth].total += sum;
      monthlyMap[fMonth].count += 1;

      // Grouping: Yearly
      if (!yearlyMap[fYear]) {
        yearlyMap[fYear] = { key: fYear, dobles: 0, m10: 0, m120: 0, triaje: 0, total: 0, count: 0 };
      }
      yearlyMap[fYear].dobles += d;
      yearlyMap[fYear].m10 += m10;
      yearlyMap[fYear].m120 += m120;
      yearlyMap[fYear].triaje += t;
      yearlyMap[fYear].total += sum;
      yearlyMap[fYear].count += 1;
    });

    const dailyList = Object.values(dailyMap).sort((a, b) => b.key.localeCompare(a.key));
    const weeklyList = Object.values(weeklyMap).sort((a, b) => b.key.localeCompare(a.key));
    const monthlyList = Object.values(monthlyMap).sort((a, b) => b.key.localeCompare(a.key));
    const yearlyList = Object.values(yearlyMap).sort((a, b) => b.key.localeCompare(a.key));

    return {
      totalToday,
      totalThisWeek,
      totalThisMonth,
      totalThisYear,
      daily: dailyList,
      weekly: weeklyList.map(w => ({ ...w, label: getWeekFormatted(w.key) })),
      monthly: monthlyList.map(m => ({ ...m, label: getMonthFormatted(m.key) })),
      yearly: yearlyList
    };
  }, [dbState.palfix]);

  // Client csv downloader
  const downloadCSV = (type: string) => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = `vilafranquer_${type}.csv`;

    if (type === "production") {
      headers = ["Fecha", "Turno", "Maquina", "Genero", "Palets", "Sacos", "Horas Prod", "Horas Parada", "Operario", "Observaciones"];
      rows = dbState.prod.map((p) => [p.fecha, p.turno, p.maq, p.gen, p.palets, p.sacos, p.hp, p.hpar, p.op, p.obs]);
    } else if (type === "ots") {
      headers = ["OT Num", "Maquina", "Tipo", "Prioridad", "Fecha", "Descripcion", "Tecnico", "Tiempo h", "Estado", "Observaciones"];
      rows = dbState.ots.map((o) => [o.num, o.maq, o.tipo, o.prio, o.fecha, o.desc, o.tec, o.t, o.est, o.obs]);
    } else if (type === "paradas") {
      headers = ["Parada Num", "Maquina", "Tipo", "Turno", "Inicio", "Fin", "Duracion Mins", "Descripcion", "Acciones", "Estado"];
      rows = dbState.paradas.map((p) => [p.num, p.maq, p.tipo, p.turno, p.ini, p.fin || "", p.dur || "", p.desc, p.acc, p.est]);
    } else if (type === "combustible") {
      headers = ["Fecha", "Turno", "Maquina", "Serie", "Modelo", "Med. Inicial", "Med. Final", "Consumo L", "Horas", "Operario", "Observaciones"];
      rows = dbState.gas.map((g) => [g.fecha, g.turno, g.ref, g.serie, g.modelo, g.medIni, g.medFin, g.consumo, g.horas || "", g.op, g.obs]);
    } else {
      return;
    }

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(";"), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp integration helper
  const sendWhatsApp = (msg: string) => {
    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  return (
    <div id="main-app-container" className="min-h-screen bg-[#060606] text-[#f2f2f2] font-sans flex flex-col relative select-none selection:bg-orange-500 selection:text-black">
      {/* Absolute Decorative lines for Brutalist layout */}
      <div className="absolute top-24 left-10 w-px h-64 bg-gradient-to-b from-orange-500/20 to-transparent pointer-events-none hidden md:block"></div>
      <div className="absolute top-48 right-12 w-32 h-px bg-white/5 pointer-events-none hidden lg:block"></div>

      {/* Top Header */}
      <header className="h-20 border-b border-white/10 flex items-center px-6 md:px-12 justify-between shrink-0 bg-[#0c0d0f] z-20">
        <div className="flex items-center gap-4 md:gap-6">
          <CompanyShield size={54} className="shrink-0 drop-shadow-md hover:scale-105 transition-transform duration-200 cursor-pointer" />
          <div className="flex flex-col">
            <span className="text-[9px] tracking-widest uppercase font-bold text-orange-500 font-display">
              CANTERA CA'S VILAFRANQUER // IND
            </span>
            <span className="text-[11px] tracking-wider uppercase font-black text-white/50 font-mono mt-0.5">
              PROD-MANT // 1972
            </span>
          </div>
          <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
          <span className="text-[10px] tracking-widest uppercase opacity-40 font-mono hidden sm:inline-block">
            UNIDAD EXPERIMENTAL // v1.2
          </span>
        </div>

        {/* Sync & Security Badges */}
        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex items-center gap-2 font-mono text-xs">
            {syncStatus === "synced" && (
              <span className="inline-flex items-center gap-1.5 text-emerald-500 font-semibold uppercase text-[9px] tracking-wider px-2 py-0.5 bg-emerald-500/5 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                ONLINE
              </span>
            )}
            {syncStatus === "syncing" && (
              <span className="inline-flex items-center gap-1.5 text-amber-500 font-semibold uppercase text-[9px] tracking-wider px-2 py-0.5 bg-amber-500/5 border border-amber-500/20">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                SYNCING
              </span>
            )}
            {syncStatus === "error" && (
              <span 
                title={dbError || "Error de sincronización con Firebase"}
                className="inline-flex items-center gap-1.5 text-red-500 font-semibold uppercase text-[9px] tracking-wider px-2 py-0.5 bg-red-500/5 border border-red-500/20 cursor-help"
              >
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                ERROR BD
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-white/40 hidden xs:inline" />
            <span className="font-mono text-xs text-white/85 tracking-widest leading-none hidden xs:inline">
              {currentTime.toLocaleTimeString()}
            </span>
          </div>

          <button
            id="padlock-toggle"
            onClick={() => {
              if (isUnlocked) setIsUnlocked(false);
              else setModalOpen((prev) => ({ ...prev, numpad: true }));
            }}
            className={`px-3 py-1.5 border font-bold text-[10px] tracking-widest uppercase transition-all duration-150 flex items-center gap-1.5 ${
              isUnlocked
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black"
                : "bg-red-500/5 border-red-500/30 text-red-500 hover:bg-red-500 hover:text-black"
            }`}
          >
            {isUnlocked ? (
              <>
                <Unlock className="w-3 h-3" />
                EDITANDO
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" />
                BLOQUEADO
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1 flex relative overflow-hidden flex-col md:flex-row">
        {/* Left Vertical Status & Brand Rail */}
        <div className="w-10 border-r border-white/10 hidden md:flex flex-col items-center justify-between py-6 shrink-0 bg-[#080809] z-10" id="brand-status-rail">
          {/* Top Panel: Industrial Indicator LEDs */}
          <div className="flex flex-col items-center gap-5" title="Panel de Estado de Sincronización y Edición">
            {/* 1. Connection LED */}
            <div className="flex flex-col items-center gap-0.5" title="Estado de Conexión de Red">
              <span className="text-[6.5px] font-mono tracking-wider font-extrabold text-slate-400 select-none">NET</span>
              <div className="relative flex h-2 w-2 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.95)]"></span>
              </div>
            </div>

            {/* 2. Sincronizando LED */}
            <div className="flex flex-col items-center gap-0.5" title="Estado de Sincronización en la Nube">
              <span className="text-[6.5px] font-mono tracking-wider font-extrabold text-slate-400 select-none">SYNC</span>
              {syncStatus === "syncing" ? (
                <div className="relative flex h-2 w-2 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.95)]"></span>
                </div>
              ) : syncStatus === "error" ? (
                <div className="relative flex h-2 w-2 items-center justify-center">
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.95)]"></span>
                </div>
              ) : (
                <div className="relative flex h-2 w-2 items-center justify-center">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.5)]"></span>
                </div>
              )}
            </div>

            {/* 3. Permiso de Edición LED */}
            <div className="flex flex-col items-center gap-0.5" title={isUnlocked ? "Edición Permitida" : "Edición Bloqueada"}>
              <span className="text-[6.5px] font-mono tracking-wider font-extrabold text-slate-400 select-none">EDT</span>
              {isUnlocked ? (
                <div className="relative flex h-2 w-2 items-center justify-center">
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.95)]"></span>
                </div>
              ) : (
                <div className="relative flex h-2 w-2 items-center justify-center">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.95)]"></span>
                </div>
              )}
            </div>
          </div>

          {/* Middle: Brand label removed as requested */}

          {/* Bottom Control Link with LED state indicator button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => {
                if (isUnlocked) setIsUnlocked(false);
                else setModalOpen((prev) => ({ ...prev, numpad: true }));
              }}
              className="group flex flex-col items-center justify-center w-7 h-7 bg-white rounded-full border border-slate-300 hover:border-slate-400 hover:shadow-xs focus:outline-none transition-all duration-150"
              title={isUnlocked ? "Haga clic para BLOQUEAR edición" : "Haga clic para DESBLOQUEAR edición"}
            >
              <span className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${isUnlocked ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]'}`} />
            </button>
            <span className="text-[6.5px] font-mono tracking-wider font-extrabold text-slate-400 select-none uppercase">
              {isUnlocked ? "UNLK" : "LOCK"}
            </span>
          </div>
        </div>

        {/* Central Workspace */}
        <div id="central-view-workspace" className="flex-1 flex flex-col p-4 md:p-8 lg:p-12 overflow-y-auto relative min-w-0">
          {/* Subtle background text representation of Bold Typography style */}
          <div className="absolute top-4 left-6 text-[120px] md:text-[230px] font-black leading-none tracking-tighter opacity-[0.02] select-none pointer-events-none uppercase font-display italic">
            {activeTab}
          </div>

          {/* Render Active View Container */}
          {activeTab === "inicio" && (
            <div id="view-tab-inicio" className="space-y-8 relative z-10 w-full max-w-7xl mx-auto">
              {/* Giant Skewed brutalist Title with Embedded Shield Logo */}
              <div className="border-b border-white/15 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-none tracking-tighter uppercase italic transform -skew-x-6 text-orange-500 mb-2.5">
                    CANTERA CA'S
                  </h2>
                  <h1 className="text-5xl sm:text-7xl md:text-8xl font-black leading-[0.8] tracking-tighter uppercase italic transform -skew-x-6 drop-shadow-2xl">
                    VILA<span className="text-orange-500">FRANQUER</span>
                  </h1>
                  <p className="text-sm md:text-base font-light text-white/50 uppercase tracking-widest mt-3">
                    Production Monitor, Maintenance Logistics & Stock Registry
                  </p>
                </div>
                <div className="flex-shrink-0 flex items-center justify-center p-3 bg-white rounded-2xl shadow-md border border-slate-200 max-w-[170px] self-start md:self-center hover:rotate-2 hover:scale-105 transition-all duration-300">
                  <CompanyShield size={130} />
                </div>
              </div>

              {/* Status Counters Bento Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-orange-500 font-bold">Palets Hoy</span>
                    <div className="text-4xl font-black tracking-tight font-display mt-2">
                      {globalStats.todayPalets}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono opacity-40 mt-3">Sacos: {globalStats.todayPalets * SPP}</span>
                </div>

                <div className="border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">Sacas Hoy</span>
                    <div className="text-4xl font-black tracking-tight font-display mt-2">
                      {globalStats.todaySacas}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono opacity-40 mt-3">Estimación Activa</span>
                </div>

                <div className="border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-red-500 font-bold">Averías Activas</span>
                    <div className="text-4xl font-black tracking-tight font-display mt-2 text-red-500">
                      {globalStats.activeAverias}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono opacity-40 mt-3">Mantenimiento Correctivo</span>
                </div>

                <div className="border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">OTs Abiertas</span>
                    <div className="text-4xl font-black tracking-tight font-display mt-2">
                      {globalStats.activeOTs}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono opacity-40 mt-3">Plan de Trabajo</span>
                </div>
              </div>

              {/* Quick Actions & Short Logs Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Shortcuts Column */}
                <div className="border border-white/10 p-6 bg-black/40 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs uppercase font-black tracking-widest text-[#FFF] mb-4">
                      CREAR REGISTRO INDUSTRIAL
                    </h3>
                    <div className="space-y-2 [&>button]:h-11 [&>button]:w-full [&>button]:border [&>button]:border-white/10 [&>button]:px-4 [&>button]:text-left [&>button]:text-[11px] [&>button]:uppercase [&>button]:tracking-wider [&>button]:font-bold hover:[&>button]:border-orange-500/50 hover:[&>button]:bg-white/5 transition-all">
                      <button onClick={() => openNewRecord("prod")}>
                        → Registrar Turno Palets
                      </button>
                      <button onClick={() => openNewRecord("sacas")}>
                        → Registrar Turno Sacas
                      </button>
                      <button onClick={() => openNewRecord("emb")}>
                        → Registrar Consumo Bobinas
                      </button>
                      <button onClick={() => openNewRecord("parada")}>
                        → Registrar Parada / Avería
                      </button>
                      <button onClick={() => openNewRecord("ot")}>
                        → Emitir Nueva OT Trabajo
                      </button>
                      <button onClick={() => setModalOpen((prev) => ({ ...prev, stock: true }))}>
                        🛠️ Actualizar Stock Esplanada
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-white/10 flex items-center gap-2 text-[10px] text-white/30 uppercase font-mono">
                    <AlertCircle className="w-3 h-3 text-orange-500" />
                    Requiere autenticación de operario
                  </div>
                </div>

                {/* Left Live Stock Panel */}
                <div className="border border-white/10 p-6 bg-white/5 lg:col-span-2">
                  <h3 className="text-xs uppercase font-black tracking-widest text-orange-500 mb-4 flex justify-between items-center">
                    <span>Estado del Stock Disponible</span>
                    <button
                      onClick={() => setModalOpen((prev) => ({ ...prev, stock: true }))}
                      className="text-[10px] border border-white/10 bg-white/5 px-2 py-1 text-[#FFF] hover:border-orange-500 transition uppercase"
                    >
                      Editar Stock
                    </button>
                  </h3>

                  {/* Stock Last Updated Indicator */}
                  <div className={`mb-4 border px-3 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[11px] tracking-wider rounded ${
                    isStockCurrent 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          isStockCurrent ? "bg-emerald-400" : "bg-rose-400"
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                          isStockCurrent ? "bg-emerald-500" : "bg-rose-500"
                        }`}></span>
                      </span>
                      <span>
                        {isStockCurrent ? "STOCK ACTUALIZADO:" : "STOCK NO ACTUALIZADO:"}{" "}
                        <strong className={`font-black ${isStockCurrent ? "text-emerald-300" : "text-rose-300"}`}>
                          {dbState.stock?.lastUpdatedWeek ? `SEMANA Nº ${dbState.stock.lastUpdatedWeek}` : "SIN SEMANA"}
                        </strong>{" "}
                        |{" "}
                        <strong className={`font-black ${isStockCurrent ? "text-emerald-300" : "text-rose-300"}`}>
                          {dbState.stock?.lastUpdatedDate ? dbState.stock.lastUpdatedDate : "SIN FECHA"}
                        </strong>
                      </span>
                    </div>
                    <button
                      onClick={() => setModalOpen((prev) => ({ ...prev, stock: true }))}
                      className="text-[9px] uppercase tracking-widest font-bold text-white bg-black/40 hover:bg-white hover:text-black border border-white/10 hover:border-white px-2 py-0.5 transition flex items-center gap-1 rounded"
                    >
                      <Edit3 className="w-2.5 h-2.5" /> Cambiar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 font-mono text-xs">
                    {/* Embalaje */}
                    <div className="bg-black/40 p-4 border border-white/10 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-orange-500 border-b border-white/10 pb-1 mb-2 text-xs uppercase tracking-wider">EMBALAJE</h4>
                        
                        {/* Breakdown Plastics */}
                        <div className="space-y-2 mb-3">
                          <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wide">Plásticos Transparentes:</span>
                          {GEN_PLASTICOS.map((g) => {
                            const item = dbState.stock?.plasticosGen?.[g] || { palets: 0, sueltas: 0, total: 0 };
                            const tot = item.palets * 5 + item.sueltas;
                            return (
                              <div key={g} className="border-b border-white/5 pb-1">
                                <div className="flex justify-between text-[11px] font-bold text-blue-600">
                                  <span className="opacity-75 truncate max-w-[130px] inline-block font-medium" title={g}>
                                    {g === "Transparente Sin Publicidad" ? "S/ Publicidad" : g.replace("Con Publicidad - ", "C/ ")}:
                                  </span>
                                  <span>{tot} bob.</span>
                                </div>
                                <div className="flex justify-between text-[9px] opacity-50 px-1 font-mono">
                                  <span>Palets: {item.palets}</span>
                                  <span>Sueltas: {item.sueltas}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="border-t border-white/10 pt-2 space-y-2">
                        <div className="flex justify-between">
                          <span className="opacity-40">Film estirable:</span>
                          <span className="font-bold text-blue-600">{dbState.stock?.fi || 0} bob.</span>
                        </div>
                        <div className="flex justify-between text-[11px] opacity-60">
                          <span>(Palets):</span>
                          <span className="text-blue-500">{dbState.stock?.fiPal || 0} ({dbState.stock?.fiBob || 0} sueltas)</span>
                        </div>
                      </div>
                    </div>

                    {/* Palets */}
                    <div className="bg-black/40 p-4 border border-white/10">
                      <h4 className="font-bold text-purple-400 border-b border-white/10 pb-1 mb-2">REPARADOS</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="opacity-40">Totales:</span>
                          <span className="font-bold text-purple-400">{dbState.stock?.paletsFix?.arreglados || 0} un.</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-40">Dobles:</span>
                          <span className="font-bold text-purple-300">{dbState.stock?.paletsFix?.dobles || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-40">Mares de 10:</span>
                          <span className="font-bold text-purple-300">{dbState.stock?.paletsFix?.mares10 || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-40">Mares 120x80:</span>
                          <span className="font-bold text-purple-300">{dbState.stock?.paletsFix?.mares120 || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-40">Triaje palets:</span>
                          <span className="font-bold text-purple-300">{dbState.stock?.paletsFix?.triaje || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Palets de géneros */}
                    <div className="bg-black/40 p-4 border border-white/10">
                      <h4 className="font-bold text-emerald-400 border-b border-white/10 pb-1 mb-2 font-display uppercase tracking-widest text-[9px]">
                        Palets Géneros
                      </h4>
                      <div className="space-y-1 text-[11px] max-h-[120px] overflow-y-auto">
                        {GEN_PALETS.map((g) => {
                          const val = dbState.stock?.paletGen?.[g] ?? 0;
                          return (
                            <div key={g} className="flex justify-between border-b border-white/5 py-0.5">
                              <span className="opacity-55 truncate pr-1" title={g}>{formatStockProductName(g)}:</span>
                              <span className="font-bold shrink-0 text-emerald-400">{val} un.</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sacas Big Bags */}
                    <div className="bg-black/40 p-4 border border-white/10">
                      <h4 className="font-bold text-teal-400 border-b border-white/10 pb-1 mb-2 font-display uppercase tracking-widest text-[9px]">
                        Sacas Big Bags
                      </h4>
                      <div className="space-y-1 text-[11px] max-h-[120px] overflow-y-auto">
                        {GEN_SACAS.map((g) => {
                          const val = dbState.stock?.sacasGen?.[g] ?? 0;
                          return (
                            <div key={g} className="flex justify-between border-b border-white/5 py-0.5">
                              <span className="opacity-55 truncate pr-1" title={g}>{formatStockProductName(g)}:</span>
                              <span className="font-bold shrink-0 text-teal-400">{val} un.</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Big Bags Vacías */}
                    <div className="bg-black/40 p-4 border border-white/10">
                      <h4 className="font-bold text-orange-400 border-b border-white/10 pb-1 mb-2 font-display uppercase tracking-widest text-[9px]">
                        Big Bags Vacías
                      </h4>
                      <div className="space-y-1 text-[11px] max-h-[120px] overflow-y-auto">
                        {GEN_BIG_BAGS_VACIAS.map((g) => {
                          const val = dbState.stock?.bigBagsVacias?.[g] ?? 0;
                          return (
                            <div key={g} className="flex justify-between border-b border-white/5 py-0.5">
                              <span className="opacity-55 truncate pr-1" title={g}>{g}:</span>
                              <span className="font-bold shrink-0 text-orange-400">{val} un.</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Son Chibetli */}
                    <div className="bg-black/40 p-4 border border-white/10">
                      <h4 className="font-bold text-rose-400 border-b border-white/10 pb-1 mb-2 font-display uppercase tracking-widest text-[9px]">
                        Son Chibetli
                      </h4>
                      <div className="space-y-1 text-[11px] max-h-[120px] overflow-y-auto">
                        {dbState.stock?.paletGenChibetli &&
                        Object.keys(dbState.stock.paletGenChibetli).length > 0 ? (
                          Object.entries(dbState.stock.paletGenChibetli).map(([k, val]) => (
                            <div key={k} className="flex justify-between border-b border-white/5 py-0.5">
                              <span className="opacity-55 truncate pr-1">{k}:</span>
                              <span className="font-bold text-rose-400">{val} un.</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-white/20 text-center py-4">Sin datos registrados</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View: Produccion Palets */}
          {activeTab === "prod_palets" && (
            <div id="view-tab-prod_palets" className="space-y-6 w-full max-w-7xl mx-auto z-10">
              <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-mega text-orange-500">
                    Historial de Fabricación
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black italic uppercase -skew-x-6">
                    Producción Sacos
                  </h1>
                </div>
                <button
                  onClick={() => openNewRecord("prod")}
                  className="bg-orange-500 hover:bg-white text-black font-bold uppercase text-[11px] tracking-widest px-6 py-3 shrink-0 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  REGISTRAR TURNO
                </button>
              </div>

              {/* Sub-navigation buttons */}
              <div className="flex gap-1 overflow-x-auto border-b border-white/10 pb-2 scrollbar-none font-display">
                <button
                  onClick={() => setProdSubTab("registros")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    prodSubTab === "registros"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  📋 Registros de Turno
                </button>
                <button
                  onClick={() => setProdSubTab("diario")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    prodSubTab === "diario"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  📅 Historial Diario
                </button>
                <button
                  onClick={() => setProdSubTab("semanal")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    prodSubTab === "semanal"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  📆 Historial Semanal
                </button>
                <button
                  onClick={() => setProdSubTab("mensual")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    prodSubTab === "mensual"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  📊 Historial Mensual
                </button>
                <button
                  onClick={() => setProdSubTab("anual")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    prodSubTab === "anual"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  🏆 Historial Anual
                </button>
              </div>

              {/* Production summary indicators for the selected subtab */}
              {prodSubTab !== "registros" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                  {/* Total Palets card */}
                  <div className="border border-zinc-200 bg-white p-4 relative overflow-hidden rounded-md shadow-sm">
                    <span className="text-[11px] text-orange-600 font-black uppercase tracking-wider block mb-1 font-mono">Total Palets Producidos</span>
                    <span className="text-3xl font-black text-black italic font-mono">
                      {dbState.prod.reduce((acc, curr) => acc + (curr.palets || 0), 0)} <span className="text-xs font-bold text-zinc-500">un.</span>
                    </span>
                    <div className="absolute right-2 bottom-0 text-zinc-100 font-black text-5xl -skew-x-6 select-none leading-none">PAL</div>
                  </div>
                  {/* Total Sacos card */}
                  <div className="border border-zinc-200 bg-white p-4 relative overflow-hidden rounded-md shadow-sm">
                    <span className="text-[11px] text-orange-600 font-black uppercase tracking-wider block mb-1 font-mono">Total Sacos Envasados</span>
                    <span className="text-3xl font-black text-black italic font-mono">
                      {dbState.prod.reduce((acc, curr) => acc + (curr.sacos || 0), 0)} <span className="text-xs font-bold text-zinc-500">un.</span>
                    </span>
                    <div className="absolute right-2 bottom-0 text-zinc-100 font-black text-5xl -skew-x-6 select-none leading-none">SAC</div>
                  </div>
                  {/* Total Horas de Producción */}
                  <div className="border border-zinc-200 bg-white p-4 relative overflow-hidden rounded-md shadow-sm">
                    <span className="text-[11px] text-orange-600 font-black uppercase tracking-wider block mb-1 font-mono">Horas Operativas Totales</span>
                    <span className="text-3xl font-black text-black italic font-mono">
                      {dbState.prod.reduce((acc, curr) => acc + (curr.hp || 0), 0).toFixed(1)} <span className="text-xs font-bold text-zinc-500">hs</span>
                    </span>
                    <div className="absolute right-2 bottom-0 text-zinc-100 font-black text-5xl -skew-x-6 select-none leading-none">OPR</div>
                  </div>
                  {/* Eficiencia promedio */}
                  <div className="border border-zinc-200 bg-white p-4 relative overflow-hidden rounded-md shadow-sm">
                    <span className="text-[11px] text-orange-600 font-black uppercase tracking-wider block mb-1 font-mono">Rendimiento Promedio</span>
                    <span className="text-3xl font-black text-black italic font-mono">
                      {(() => {
                        const totalHp = dbState.prod.reduce((acc, curr) => acc + (curr.hp || 0), 0);
                        const totalPalets = dbState.prod.reduce((acc, curr) => acc + (curr.palets || 0), 0);
                        return totalHp > 0 ? (totalPalets / totalHp).toFixed(1) : "0.0";
                      })()} <span className="text-xs font-bold text-zinc-500">pal/h</span>
                    </span>
                    <div className="absolute right-2 bottom-0 text-zinc-100 font-black text-5xl -skew-x-6 select-none leading-none">EFIC</div>
                  </div>
                </div>
              )}

              {prodSubTab === "registros" && (
                <>
                  {/* Table search filters */}
                  {renderSearchFilterBar(true)}

                  {/* List */}
                  <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                    <table className="w-full text-left font-mono text-xs text-zinc-900">
                      <thead>
                        <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                          <th>Fecha</th>
                          <th>Turno</th>
                          <th>Máquina</th>
                          <th>Género</th>
                          <th className="text-right">Palets</th>
                          <th className="text-right">Sacos</th>
                          <th>Horas Prod / Par</th>
                          <th>Operario</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {filteredProd.length > 0 ? (
                          filteredProd.map((p) => (
                            <tr key={p.id} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 text-zinc-800">{formatDateDMY(p.fecha)}</td>
                              <td className="px-4 py-3 uppercase text-orange-600 font-bold">{p.turno}</td>
                              <td className="px-4 py-3 text-zinc-800">{MAQUINAS[p.maq]?.c || p.maq}</td>
                              <td className="px-4 py-3 font-sans font-semibold text-zinc-900">{p.gen}</td>
                              <td className="px-4 py-3 text-right text-orange-600 font-bold">{p.palets}</td>
                              <td className="px-4 py-3 text-right text-zinc-800">{p.sacos}</td>
                              <td className="px-4 py-3 text-zinc-600">
                                {p.hp}h / {p.hpar}h
                              </td>
                              <td className="px-4 py-3 text-zinc-700">{p.op || "-"}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openEditRecord("prod", p)}
                                    className="text-xs text-blue-600 hover:text-zinc-950 font-semibold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRecord("prod", p.id)}
                                    className="text-xs text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                              Sin registros localizados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {prodSubTab === "diario" && (
                <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                  <table className="w-full text-left font-mono text-xs text-zinc-900">
                    <thead>
                      <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                        <th>Fecha</th>
                        <th>Suma de Palets</th>
                        <th>Suma de Sacos</th>
                        <th>Turnos</th>
                        <th>Géneros & Cantidades</th>
                        <th>Horas Prod / Par</th>
                        <th>Operarios</th>
                        <th className="text-right">Rendimiento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {dailyHistory.length > 0 ? (
                        dailyHistory.map((d) => {
                          const arrTurnos = Array.from(d.turnos);
                          const arrOperarios = Array.from(d.operarios);
                          const rend = d.hp > 0 ? (d.palets / d.hp).toFixed(1) : "-";
                          return (
                            <tr key={d.fecha} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 font-bold text-zinc-900">{formatDateDMY(d.fecha)}</td>
                              <td className="px-4 py-3 text-orange-600 font-bold">{d.palets} pal.</td>
                              <td className="px-4 py-3 text-zinc-700">{d.sacos} sac.</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 flex-wrap">
                                  {arrTurnos.map((t) => (
                                    <span key={t} className="bg-zinc-100 text-orange-700 font-bold uppercase text-[9px] px-1.5 py-0.5 border border-zinc-200 rounded">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-sans text-zinc-800 max-w-sm uppercase text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  {Object.entries(d.generos).map(([g, qty]) => (
                                    <span key={g}>
                                      • {g}: <strong className="text-orange-700">{qty}</strong> palets
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-600 font-semibold">
                                {d.hp}h / {d.hpar}h
                              </td>
                              <td className="px-4 py-3 text-zinc-700 uppercase text-[10px]">
                                {arrOperarios.join(", ") || "-"}
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                                {rend !== "-" ? `${rend} pal/h` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                            Sin registros en el historial diario
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {prodSubTab === "semanal" && (
                <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                  <table className="w-full text-left font-mono text-xs text-zinc-900">
                    <thead>
                      <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                        <th>Semana</th>
                        <th>Período</th>
                        <th>Total Palets</th>
                        <th>Total Sacos</th>
                        <th>Prod. por Género</th>
                        <th>Cambio Produt.</th>
                        <th>Horas Prod / Par</th>
                        <th className="text-right">Rendimiento (Pal/h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {weeklyHistory.length > 0 ? (
                        weeklyHistory.map((w) => {
                          const rend = w.hp > 0 ? (w.palets / w.hp).toFixed(1) : "-";
                          return (
                            <tr key={w.semanaKey} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 font-bold text-orange-600 uppercase">
                                <div className="flex items-center gap-2">
                                  <span>{dbState.cfg?.weekOverrides?.[w.semanaKey] || `S${w.week}`}</span>
                                  <button
                                    onClick={() => {
                                      const defaultName = `S${w.week}`;
                                      const currentName = dbState.cfg?.weekOverrides?.[w.semanaKey] || defaultName;
                                      const newName = prompt(
                                        `Editar etiqueta o número de la semana para '${defaultName}':\n(Dejar en blanco para restaurar al predeterminado)`,
                                        currentName
                                      );
                                      if (newName !== null) {
                                        const trimmed = newName.trim();
                                        const updatedOverrides = {
                                          ...(dbState.cfg?.weekOverrides || {})
                                        };
                                        if (trimmed === "") {
                                          delete updatedOverrides[w.semanaKey];
                                        } else {
                                          updatedOverrides[w.semanaKey] = trimmed;
                                        }
                                        const updatedCfg = {
                                          ...dbState.cfg,
                                          weekOverrides: updatedOverrides
                                        };
                                        updateDB({ ...dbState, cfg: updatedCfg });
                                      }
                                    }}
                                    className="p-1 text-zinc-400 hover:text-orange-600 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 transition-all rounded"
                                    title="Editar número/nombre de la semana"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-700">{w.rango}</td>
                              <td className="px-4 py-3 text-zinc-900 font-bold">{w.palets} pal.</td>
                              <td className="px-4 py-3 text-zinc-700">{w.sacos} sac.</td>
                              <td className="px-4 py-3 font-sans text-zinc-800 max-w-sm uppercase text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  {Object.entries(w.generos).map(([g, qty]) => (
                                    <span key={g}>
                                      • {g}: <strong className="text-orange-700">{qty}</strong> palets
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-600">{w.turnosCount} {w.turnosCount === 1 ? 'cambio' : 'cambios'}</td>
                              <td className="px-4 py-3 text-zinc-500 font-semibold">
                                {w.hp}h / {w.hpar}h
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                                {rend !== "-" ? `${rend} pal/h` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                            Sin registros en el historial semanal
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {prodSubTab === "mensual" && (
                <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                  <table className="w-full text-left font-mono text-xs text-zinc-900">
                    <thead>
                      <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                        <th>Mes / Año</th>
                        <th>Días Activos</th>
                        <th>Total Palets</th>
                        <th>Total Sacos</th>
                        <th>Suma de Géneros</th>
                        <th>Horas Totales Prod / Par</th>
                        <th className="text-right">Rendimiento (Pal/h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {monthlyHistory.length > 0 ? (
                        monthlyHistory.map((m) => {
                          const rend = m.hp > 0 ? (m.palets / m.hp).toFixed(1) : "-";
                          return (
                            <tr key={m.mesKey} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 font-bold text-orange-600 uppercase">
                                {m.nombreMes} {m.año}
                              </td>
                              <td className="px-4 py-3 text-zinc-700">{m.diasActivos.size} días func.</td>
                              <td className="px-4 py-3 text-zinc-900 font-bold">{m.palets} pal.</td>
                              <td className="px-4 py-3 text-zinc-700">{m.sacos} sac.</td>
                              <td className="px-4 py-3 font-sans text-zinc-800 max-w-sm uppercase text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  {Object.entries(m.generos).map(([g, qty]) => (
                                    <span key={g}>
                                      • {g}: <strong className="text-orange-700">{qty}</strong> palets
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-500 font-semibold">
                                {m.hp}h / {m.hpar}h
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                                {rend !== "-" ? `${rend} pal/h` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                            Sin registros en el historial mensual
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {prodSubTab === "anual" && (
                <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                  <table className="w-full text-left font-mono text-xs text-zinc-900">
                    <thead>
                      <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                        <th>Año</th>
                        <th>Meses Activos</th>
                        <th>Total Palets</th>
                        <th>Total Sacos</th>
                        <th>Producción por Género</th>
                        <th>Horas Totales Prod / Par</th>
                        <th className="text-right">Rendimiento (Pal/h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {annualHistory.length > 0 ? (
                        annualHistory.map((a) => {
                          const rend = a.hp > 0 ? (a.palets / a.hp).toFixed(1) : "-";
                          return (
                            <tr key={a.año} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 font-bold text-orange-600 uppercase text-lg">{a.año}</td>
                              <td className="px-4 py-3 text-zinc-700">{a.mesesActivos.size} meses func.</td>
                              <td className="px-4 py-3 text-zinc-900 font-bold">{a.palets} pal.</td>
                              <td className="px-4 py-3 text-zinc-700">{a.sacos} sac.</td>
                              <td className="px-4 py-3 font-sans text-zinc-800 max-w-sm uppercase text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  {Object.entries(a.generos).map(([g, qty]) => (
                                    <span key={g}>
                                      • {g}: <strong className="text-orange-700">{qty}</strong> palets
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-500 font-semibold">
                                {a.hp}h / {a.hpar}h
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                                {rend !== "-" ? `${rend} pal/h` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                            Sin registros en el historial anual
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* View: Produccion Sacas Big Bags */}
          {activeTab === "prod_sacas" && (
            <div id="view-tab-prod_sacas" className="space-y-6 w-full max-w-7xl mx-auto z-10">
              <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-mega text-purple-400">
                    Sustentación de Big-Bags
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black italic uppercase -skew-x-6">
                    Producción de Sacas
                  </h1>
                </div>
                <button
                  onClick={() => openNewRecord("sacas")}
                  className="bg-purple-600 hover:bg-white text-white hover:text-black font-bold uppercase text-[11px] tracking-widest px-6 py-3 shrink-0 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  REGISTRAR SACAS
                </button>
              </div>

              {/* Sub-navigation buttons */}
              <div className="flex gap-1 overflow-x-auto border-b border-white/10 pb-2 scrollbar-none font-display">
                <button
                  onClick={() => setSacasSubTab("registros")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    sacasSubTab === "registros"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  📋 Registros de Turno
                </button>
                <button
                  onClick={() => setSacasSubTab("diario")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    sacasSubTab === "diario"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  📅 Historial Diario
                </button>
                <button
                  onClick={() => setSacasSubTab("semanal")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    sacasSubTab === "semanal"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  📆 Historial Semanal
                </button>
                <button
                  onClick={() => setSacasSubTab("mensual")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    sacasSubTab === "mensual"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  📊 Historial Mensual
                </button>
                <button
                  onClick={() => setSacasSubTab("anual")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    sacasSubTab === "anual"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  🏆 Historial Anual
                </button>
              </div>

              {/* Production summary indicators for the selected subtab */}
              {sacasSubTab !== "registros" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                  {/* Total Sacas card */}
                  <div className="border border-zinc-200 bg-white p-4 relative overflow-hidden rounded-md shadow-sm">
                    <span className="text-[11px] text-orange-600 font-black uppercase tracking-wider block mb-1 font-mono">Total Sacas Producidas</span>
                    <span className="text-3xl font-black text-black italic font-mono">
                      {dbState.sacas.reduce((acc, curr) => acc + (curr.palets || 0), 0)} <span className="text-xs font-bold text-zinc-500">un.</span>
                    </span>
                    <div className="absolute right-2 bottom-0 text-zinc-100 font-black text-5xl -skew-x-6 select-none leading-none">SAC</div>
                  </div>
                  {/* Total Peso Neto card */}
                  <div className="border border-zinc-200 bg-white p-4 relative overflow-hidden rounded-md shadow-sm">
                    <span className="text-[11px] text-orange-600 font-black uppercase tracking-wider block mb-1 font-mono">Total Peso Neto Envasado</span>
                    <span className="text-3xl font-black text-black italic font-mono">
                      {dbState.sacas.reduce((acc, curr) => acc + (curr.peso || 0), 0).toLocaleString()} <span className="text-xs font-bold text-zinc-500">kg</span>
                    </span>
                    <div className="absolute right-2 bottom-0 text-zinc-100 font-black text-5xl -skew-x-6 select-none leading-none">KGS</div>
                  </div>
                  {/* Total Horas de Funcionamiento */}
                  <div className="border border-zinc-200 bg-white p-4 relative overflow-hidden rounded-md shadow-sm">
                    <span className="text-[11px] text-orange-600 font-black uppercase tracking-wider block mb-1 font-mono">Horas Operativas Totales</span>
                    <span className="text-3xl font-black text-black italic font-mono">
                      {dbState.sacas.reduce((acc, curr) => acc + (curr.hp || 0), 0).toFixed(1)} <span className="text-xs font-bold text-zinc-500">hs</span>
                    </span>
                    <div className="absolute right-2 bottom-0 text-zinc-100 font-black text-5xl -skew-x-6 select-none leading-none">OPR</div>
                  </div>
                  {/* Eficiencia promedio */}
                  <div className="border border-zinc-200 bg-white p-4 relative overflow-hidden rounded-md shadow-sm">
                    <span className="text-[11px] text-orange-600 font-black uppercase tracking-wider block mb-1 font-mono">Rendimiento Promedio</span>
                    <span className="text-3xl font-black text-black italic font-mono">
                      {(() => {
                        const totalHp = dbState.sacas.reduce((acc, curr) => acc + (curr.hp || 0), 0);
                        const totalSacas = dbState.sacas.reduce((acc, curr) => acc + (curr.palets || 0), 0);
                        return totalHp > 0 ? (totalSacas / totalHp).toFixed(1) : "0.0";
                      })()} <span className="text-xs font-bold text-zinc-500">sac/h</span>
                    </span>
                    <div className="absolute right-2 bottom-0 text-zinc-100 font-black text-5xl -skew-x-6 select-none leading-none">EFIC</div>
                  </div>
                </div>
              )}

              {sacasSubTab === "registros" && (
                <>
                  {/* Table search filters */}
                  {renderSearchFilterBar(false)}

                  {/* List */}
                  <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                    <table className="w-full text-left font-mono text-xs text-zinc-900">
                      <thead>
                        <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                          <th>Fecha</th>
                          <th>Turno</th>
                          <th>Género</th>
                          <th className="text-right">Sacas</th>
                          <th className="text-right">Peso Neto</th>
                          <th>Horas Func / Par</th>
                          <th>Operario</th>
                          <th>Publicidad</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {filteredSacas.length > 0 ? (
                          filteredSacas.map((s) => (
                            <tr key={s.id} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 text-zinc-800">{formatDateDMY(s.fecha)}</td>
                              <td className="px-4 py-3 uppercase text-purple-750 font-bold">{s.turno}</td>
                              <td className="px-4 py-3 font-sans font-semibold text-zinc-900">{s.gen}</td>
                              <td className="px-4 py-3 text-right text-purple-750 font-bold">{s.palets}</td>
                              <td className="px-4 py-3 text-right text-zinc-850">
                                {s.peso ? `${s.peso} kg` : "-"}
                              </td>
                              <td className="px-4 py-3 text-zinc-550">
                                {s.hp}h / {s.hpar}h
                              </td>
                              <td className="px-4 py-3 font-semibold text-zinc-800">
                                {s.op === "OTRO" ? s.opNombre : s.op}
                              </td>
                              <td className="px-4 py-3 text-zinc-600">{s.pub || "Sin marca"}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openEditRecord("sacas", s)}
                                    className="text-xs text-blue-600 hover:text-zinc-950 font-semibold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRecord("sacas", s.id)}
                                    className="text-xs text-red-650 hover:text-red-800"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                              Sin registros de sacas redactados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {sacasSubTab === "diario" && (
                <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                  <table className="w-full text-left font-mono text-xs text-zinc-900">
                    <thead>
                      <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                        <th>Fecha</th>
                        <th>Suma de Sacas</th>
                        <th>Suma de Peso Neto</th>
                        <th>Turnos</th>
                        <th>Géneros & Cantidades</th>
                        <th>Horas Func / Par</th>
                        <th>Operarios</th>
                        <th className="text-right">Rendimiento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {dailySacasHistory.length > 0 ? (
                        dailySacasHistory.map((d) => {
                          const arrTurnos = Array.from(d.turnos);
                          const arrOperarios = Array.from(d.operarios);
                          const rend = d.hp > 0 ? (d.palets / d.hp).toFixed(1) : "-";
                          return (
                            <tr key={d.fecha} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 font-bold text-zinc-900">{formatDateDMY(d.fecha)}</td>
                              <td className="px-4 py-3 text-purple-750 font-bold">{d.palets} sac.</td>
                              <td className="px-4 py-3 text-zinc-700">{d.peso ? `${d.peso.toLocaleString()} kg` : "-"}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 flex-wrap">
                                  {arrTurnos.map((t) => (
                                    <span key={t} className="bg-zinc-100 text-purple-755 font-bold uppercase text-[9px] px-1.5 py-0.5 border border-zinc-200 rounded">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-sans text-zinc-800 max-w-sm uppercase text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  {Object.entries(d.generos).map(([g, qty]) => (
                                    <span key={g}>
                                      • {g}: <strong className="text-purple-755">{qty}</strong> sacas
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-550">
                                {d.hp}h / {d.hpar}h
                              </td>
                              <td className="px-4 py-3 text-zinc-700 uppercase text-[10px]">
                                {arrOperarios.join(", ") || "-"}
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                                {rend !== "-" ? `${rend} sac/h` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                            Sin registros en el historial diario de sacas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {sacasSubTab === "semanal" && (
                <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                  <table className="w-full text-left font-mono text-xs text-zinc-900">
                    <thead>
                      <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                        <th>Semana</th>
                        <th>Período</th>
                        <th>Total Sacas</th>
                        <th>Peso Neto Total</th>
                        <th>Prod. por Género</th>
                        <th>Cambio Produt.</th>
                        <th>Horas Func / Par</th>
                        <th className="text-right">Rendimiento (sac/h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {weeklySacasHistory.length > 0 ? (
                        weeklySacasHistory.map((w) => {
                          const rend = w.hp > 0 ? (w.palets / w.hp).toFixed(1) : "-";
                          return (
                            <tr key={w.semanaKey} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 font-bold text-purple-755 uppercase">
                                <div className="flex items-center gap-2">
                                  <span>{dbState.cfg?.weekOverrides?.[w.semanaKey] || `S${w.week}`}</span>
                                  <button
                                    onClick={() => {
                                      const defaultName = `S${w.week}`;
                                      const currentName = dbState.cfg?.weekOverrides?.[w.semanaKey] || defaultName;
                                      const newName = prompt(
                                        `Editar etiqueta o número de la semana para '${defaultName}':\n(Dejar en blanco para restaurar al predeterminado)`,
                                        currentName
                                      );
                                      if (newName !== null) {
                                        const trimmed = newName.trim();
                                        const updatedOverrides = {
                                          ...(dbState.cfg?.weekOverrides || {})
                                        };
                                        if (trimmed === "") {
                                          delete updatedOverrides[w.semanaKey];
                                        } else {
                                          updatedOverrides[w.semanaKey] = trimmed;
                                        }
                                        const updatedCfg = {
                                          ...dbState.cfg,
                                          weekOverrides: updatedOverrides
                                        };
                                        updateDB({ ...dbState, cfg: updatedCfg });
                                      }
                                    }}
                                    className="p-1 text-zinc-400 hover:text-purple-755 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 transition-all rounded"
                                    title="Editar número/nombre de la semana"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-700">{w.rango}</td>
                              <td className="px-4 py-3 text-zinc-900 font-bold">{w.palets} sac.</td>
                              <td className="px-4 py-3 text-zinc-700">{w.peso ? `${w.peso.toLocaleString()} kg` : "-"}</td>
                              <td className="px-4 py-3 font-sans text-zinc-800 max-w-sm uppercase text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  {Object.entries(w.generos).map(([g, qty]) => (
                                    <span key={g}>
                                      • {g}: <strong className="text-purple-755">{qty}</strong> sacas
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-600">{w.turnosCount} {w.turnosCount === 1 ? 'cambio' : 'cambios'}</td>
                              <td className="px-4 py-3 text-zinc-550">
                                {w.hp}h / {w.hpar}h
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                                {rend !== "-" ? `${rend} sac/h` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                            Sin registros en el historial semanal de sacas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {sacasSubTab === "mensual" && (
                <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                  <table className="w-full text-left font-mono text-xs text-zinc-900">
                    <thead>
                      <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                        <th>Mes / Año</th>
                        <th>Días Activos</th>
                        <th>Total Sacas</th>
                        <th>Peso Neto Total</th>
                        <th>Suma de Géneros</th>
                        <th>Horas Totales Func / Par</th>
                        <th className="text-right">Rendimiento (sac/h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {monthlySacasHistory.length > 0 ? (
                        monthlySacasHistory.map((m) => {
                          const rend = m.hp > 0 ? (m.palets / m.hp).toFixed(1) : "-";
                          return (
                            <tr key={m.mesKey} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 font-bold text-purple-755 uppercase">
                                {m.nombreMes} {m.año}
                              </td>
                              <td className="px-4 py-3 text-zinc-700">{m.diasActivos.size} días func.</td>
                              <td className="px-4 py-3 text-zinc-900 font-bold">{m.palets} sac.</td>
                              <td className="px-4 py-3 text-zinc-700">{m.peso ? `${m.peso.toLocaleString()} kg` : "-"}</td>
                              <td className="px-4 py-3 font-sans text-zinc-800 max-w-sm uppercase text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  {Object.entries(m.generos).map(([g, qty]) => (
                                    <span key={g}>
                                      • {g}: <strong className="text-purple-755">{qty}</strong> sacas
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-550">
                                {m.hp}h / {m.hpar}h
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                                {rend !== "-" ? `${rend} sac/h` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                            Sin registros en el historial mensual de sacas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {sacasSubTab === "anual" && (
                <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                  <table className="w-full text-left font-mono text-xs text-zinc-900">
                    <thead>
                      <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                        <th>Año</th>
                        <th>Meses Activos</th>
                        <th>Total Sacas</th>
                        <th>Peso Neto Total</th>
                        <th>Producción por Género</th>
                        <th>Horas Totales Func / Par</th>
                        <th className="text-right">Rendimiento (sac/h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {annualSacasHistory.length > 0 ? (
                        annualSacasHistory.map((a) => {
                          const rend = a.hp > 0 ? (a.palets / a.hp).toFixed(1) : "-";
                          return (
                            <tr key={a.año} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 font-bold text-purple-755 uppercase text-lg">{a.año}</td>
                              <td className="px-4 py-3 text-zinc-700">{a.mesesActivos.size} meses func.</td>
                              <td className="px-4 py-3 text-zinc-900 font-bold">{a.palets} sac.</td>
                              <td className="px-4 py-3 text-zinc-700">{a.peso ? `${a.peso.toLocaleString()} kg` : "-"}</td>
                              <td className="px-4 py-3 font-sans text-zinc-800 max-w-sm uppercase text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  {Object.entries(a.generos).map(([g, qty]) => (
                                    <span key={g}>
                                      • {g}: <strong className="text-purple-755">{qty}</strong> sacas
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-550">
                                {a.hp}h / {a.hpar}h
                              </td>
                              <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                                {rend !== "-" ? `${rend} sac/h` : "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                            Sin registros en el historial anual de sacas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* View: Reparacion Palets */}
          {activeTab === "rep_palets" && (
            <div id="view-tab-rep_palets" className="space-y-6 w-full max-w-7xl mx-auto z-10">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-bold uppercase tracking-mega text-orange-500">
                  Pallets Log & Restoration Room
                </span>
                <h1 className="text-4xl md:text-5xl font-black italic uppercase -skew-x-6">
                  Reparación de Palets
                </h1>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form to log quick daily repair run directly inline */}
                <div className="border border-white/10 p-6 bg-white/5 self-start">
                  <h3 className="text-xs uppercase font-black tracking-widest text-[#FFF] mb-4">
                    Nueva Hoja de Reparación
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-1">
                        Fecha Reparación
                      </label>
                      <input
                        type="date"
                        className="w-full bg-[#121315] border border-white/10 p-2 text-xs font-mono focus:border-orange-500 outline-none"
                        value={palFixDate}
                        onChange={(e) => setPalFixDate(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-1">
                          Turno
                        </label>
                        <select
                          className="w-full bg-[#121315] border border-white/10 p-2 text-xs focus:border-orange-500 outline-none"
                          value={palFixTurn}
                          onChange={(e) => setPalFixTurn(e.target.value)}
                        >
                          <option value="Manana">Mañana</option>
                          <option value="Tarde">Tarde</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-orange-500 mb-1">
                          Operario
                        </label>
                        <select
                          className="w-full bg-[#121315] border border-white/10 p-2 text-xs focus:border-orange-500 outline-none"
                          value={palFixOp}
                          onChange={(e) => setPalFixOp(e.target.value)}
                        >
                          <option value="Alberto">Alberto</option>
                          <option value="Joao">Joao</option>
                          <option value="Juan Miguel">Juan M.</option>
                          <option value="Rafael">Rafael</option>
                          <option value="Tofol">Tófol</option>
                          <option value="Del Mares">Del Mares</option>
                        </select>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4 space-y-3 font-mono text-xs">
                      <div className="flex justify-between items-center">
                        <span className="opacity-60">Dobles 100x100:</span>
                        <input
                          type="number"
                          placeholder="Dobles"
                          className="w-20 bg-black border border-white/10 p-1 text-center font-bold text-orange-500 outline-none focus:border-orange-500"
                          value={palFixDob}
                          onChange={(e) => setPalFixDob(e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="opacity-60">Mares de 10:</span>
                        <input
                          type="number"
                          placeholder="Mares de 10"
                          className="w-20 bg-black border border-white/10 p-1 text-center font-bold text-orange-500 outline-none focus:border-orange-500"
                          value={palFixM10}
                          onChange={(e) => setPalFixM10(e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="opacity-60">Mares 120x80:</span>
                        <input
                          type="number"
                          placeholder="Mares 120x80"
                          className="w-20 bg-black border border-white/10 p-1 text-center font-bold text-orange-500 outline-none focus:border-orange-500"
                          value={palFixM120}
                          onChange={(e) => setPalFixM120(e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="opacity-60">Triaje:</span>
                        <input
                          type="number"
                          placeholder="Triaje"
                          className="w-20 bg-black border border-white/10 p-1 text-center font-bold text-orange-500 outline-none focus:border-orange-500"
                          value={palFixTri}
                          onChange={(e) => setPalFixTri(e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSavePalFix}
                      className="w-full py-3 bg-orange-500 text-black font-bold uppercase tracking-widest text-[11px] hover:bg-white transition"
                    >
                      REGISTRAR JORNADA REP.
                    </button>
                  </div>
                </div>

                {/* History Database entries */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-xs uppercase font-black tracking-widest text-orange-500 flex items-center justify-between">
                    <span>Control e Historial de Palets Reparados</span>
                    <span className="bg-orange-500/10 text-orange-400 text-[9px] px-2 py-0.5 rounded font-bold font-mono">ESTADÍSTICAS EN TIEMPO REAL</span>
                  </h3>

                  {/* Summary Bento Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-white">
                    <div className="border border-white/10 bg-zinc-950 p-3 rounded-md space-y-1">
                      <span className="text-[9px] uppercase font-bold text-zinc-400">Hoy</span>
                      <div className="text-xl font-black text-orange-500">{palFixStats.totalToday} u</div>
                      <p className="text-[9px] text-zinc-500">Reparados hoy</p>
                    </div>
                    <div className="border border-white/10 bg-zinc-950 p-3 rounded-md space-y-1">
                      <span className="text-[9px] uppercase font-bold text-zinc-400">Esta Semana</span>
                      <div className="text-xl font-black text-amber-500">{palFixStats.totalThisWeek} u</div>
                      <p className="text-[9px] text-zinc-500">Semana en curso</p>
                    </div>
                    <div className="border border-white/10 bg-zinc-950 p-3 rounded-md space-y-1">
                      <span className="text-[9px] uppercase font-bold text-zinc-400">Este Mes</span>
                      <div className="text-xl font-black text-[#6366F1]">{palFixStats.totalThisMonth} u</div>
                      <p className="text-[9px] text-zinc-500">Mes en curso</p>
                    </div>
                    <div className="border border-white/10 bg-zinc-950 p-3 rounded-md space-y-1">
                      <span className="text-[9px] uppercase font-bold text-zinc-400">Este Año</span>
                      <div className="text-xl font-black text-emerald-500">{palFixStats.totalThisYear} u</div>
                      <p className="text-[9px] text-zinc-500">Acumulado anual</p>
                    </div>
                  </div>

                  {/* Tab Selector for different histories */}
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-2 pt-2">
                    <button
                      onClick={() => setPalFixHistTab("individual")}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition font-mono ${
                        palFixHistTab === "individual"
                          ? "bg-orange-500 text-black font-black"
                          : "bg-zinc-900 text-zinc-400 border border-white/5 hover:text-white"
                      }`}
                    >
                      📑 Jornadas
                    </button>
                    <button
                      onClick={() => setPalFixHistTab("daily")}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition font-mono ${
                        palFixHistTab === "daily"
                          ? "bg-orange-500 text-black font-black"
                          : "bg-zinc-900 text-zinc-400 border border-white/5 hover:text-white"
                      }`}
                    >
                      📅 Diario
                    </button>
                    <button
                      onClick={() => setPalFixHistTab("weekly")}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition font-mono ${
                        palFixHistTab === "weekly"
                          ? "bg-orange-500 text-black font-black"
                          : "bg-zinc-900 text-zinc-400 border border-white/5 hover:text-white"
                      }`}
                    >
                      🗓️ Semanal
                    </button>
                    <button
                      onClick={() => setPalFixHistTab("monthly")}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition font-mono ${
                        palFixHistTab === "monthly"
                          ? "bg-orange-500 text-black font-black"
                          : "bg-zinc-900 text-zinc-400 border border-white/5 hover:text-white"
                      }`}
                    >
                      📊 Mensual
                    </button>
                    <button
                      onClick={() => setPalFixHistTab("yearly")}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition font-mono ${
                        palFixHistTab === "yearly"
                          ? "bg-orange-500 text-black font-black"
                          : "bg-zinc-900 text-zinc-400 border border-white/5 hover:text-white"
                      }`}
                    >
                      📈 Anual
                    </button>
                  </div>

                  {/* Sub-tab: Individual Logs */}
                  {palFixHistTab === "individual" && (
                    <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                      <table className="w-full text-left font-mono text-xs text-zinc-900">
                        <thead>
                          <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                            <th>Fecha</th>
                            <th>Turno</th>
                            <th>Operario</th>
                            <th className="text-right font-bold">Dobles</th>
                            <th className="text-right font-bold">Mares de 10</th>
                            <th className="text-right font-bold">Mares 120x80</th>
                            <th className="text-right font-bold">Triaje</th>
                            <th className="text-right font-black">Total</th>
                            <th className="text-center font-bold">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {dbState.palfix && dbState.palfix.length > 0 ? (
                            dbState.palfix.map((f) => {
                              const tot = (f.dobles || 0) + (f.mares10 || 0) + (f.mares120 || 0) + (f.triaje || 0);
                              return (
                                <tr key={f.id} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                                  <td className="px-4 py-3 text-zinc-800">{formatDateDMY(f.fecha)}</td>
                                  <td className="px-4 py-3 uppercase text-zinc-700 font-semibold">{f.turno}</td>
                                  <td className="px-4 py-3 text-zinc-950 font-semibold">{f.op}</td>
                                  <td className="px-4 py-3 text-right text-zinc-700">{f.dobles || 0}</td>
                                  <td className="px-4 py-3 text-right text-zinc-700">{f.mares10 || 0}</td>
                                  <td className="px-4 py-3 text-right text-zinc-700">{f.mares120 || 0}</td>
                                  <td className="px-4 py-3 text-right text-zinc-700">{f.triaje || 0}</td>
                                  <td className="px-4 py-3 text-right text-orange-600 font-black text-sm">{tot}</td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => handleDeleteRecord("palfix", f.id)}
                                      className="text-red-650 hover:text-red-850 p-1 hover:bg-red-50 rounded"
                                      title="Eliminar registro"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={9} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                                No hay reparaciones guardadas
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Sub-tab: Daily Grouped */}
                  {palFixHistTab === "daily" && (
                    <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                      <table className="w-full text-left font-mono text-xs text-zinc-900">
                        <thead>
                          <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                            <th>Día / Fecha</th>
                            <th className="text-right font-bold">Dobles</th>
                            <th className="text-right font-bold">Mares de 10</th>
                            <th className="text-right font-bold">Mares 120x80</th>
                            <th className="text-right font-bold">Triaje</th>
                            <th className="text-right font-black">Total Reparados</th>
                            <th className="text-right font-bold">Jornadas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {palFixStats.daily && palFixStats.daily.length > 0 ? (
                            palFixStats.daily.map((item) => (
                              <tr key={item.key} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                                <td className="px-4 py-3 font-bold text-zinc-800">{formatDateDMY(item.key)}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.dobles}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.m10}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.m120}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.triaje}</td>
                                <td className="px-4 py-3 text-right text-orange-600 font-black text-sm">{item.total}</td>
                                <td className="px-4 py-3 text-right text-zinc-500">{item.count}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                                No hay datos diarios registrados
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Sub-tab: Weekly Grouped */}
                  {palFixHistTab === "weekly" && (
                    <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                      <table className="w-full text-left font-mono text-xs text-zinc-900">
                        <thead>
                          <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                            <th>Rango de Semana</th>
                            <th className="text-right font-bold">Dobles</th>
                            <th className="text-right font-bold">Mares de 10</th>
                            <th className="text-right font-bold">Mares 120x80</th>
                            <th className="text-right font-bold">Triaje</th>
                            <th className="text-right font-black">Total Reparados</th>
                            <th className="text-right font-bold">Jornadas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {palFixStats.weekly && palFixStats.weekly.length > 0 ? (
                            palFixStats.weekly.map((item) => (
                              <tr key={item.key} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                                <td className="px-4 py-3 font-bold text-zinc-800">{item.label}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.dobles}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.m10}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.m120}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.triaje}</td>
                                <td className="px-4 py-3 text-right text-orange-600 font-black text-sm">{item.total}</td>
                                <td className="px-4 py-3 text-right text-zinc-500">{item.count}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                                No hay datos semanales registrados
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Sub-tab: Monthly Grouped */}
                  {palFixHistTab === "monthly" && (
                    <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                      <table className="w-full text-left font-mono text-xs text-zinc-900">
                        <thead>
                          <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                            <th>Mes / Año</th>
                            <th className="text-right font-bold">Dobles</th>
                            <th className="text-right font-bold">Mares de 10</th>
                            <th className="text-right font-bold">Mares 120x80</th>
                            <th className="text-right font-bold">Triaje</th>
                            <th className="text-right font-black">Total Reparados</th>
                            <th className="text-right font-bold">Jornadas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {palFixStats.monthly && palFixStats.monthly.length > 0 ? (
                            palFixStats.monthly.map((item) => (
                              <tr key={item.key} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                                <td className="px-4 py-3 font-bold text-zinc-800 uppercase">{item.label}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.dobles}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.m10}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.m120}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.triaje}</td>
                                <td className="px-4 py-3 text-right text-orange-600 font-black text-sm">{item.total}</td>
                                <td className="px-4 py-3 text-right text-zinc-500">{item.count}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                                No hay datos mensuales registrados
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Sub-tab: Yearly Grouped */}
                  {palFixHistTab === "yearly" && (
                    <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                      <table className="w-full text-left font-mono text-xs text-zinc-900">
                        <thead>
                          <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                            <th>Año</th>
                            <th className="text-right font-bold">Dobles</th>
                            <th className="text-right font-bold">Mares de 10</th>
                            <th className="text-right font-bold">Mares 120x80</th>
                            <th className="text-right font-bold">Triaje</th>
                            <th className="text-right font-black">Total Reparados</th>
                            <th className="text-right font-bold">Jornadas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {palFixStats.yearly && palFixStats.yearly.length > 0 ? (
                            palFixStats.yearly.map((item) => (
                              <tr key={item.key} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                                <td className="px-4 py-3 font-bold text-zinc-800 text-sm">{item.key}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.dobles}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.m10}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.m120}</td>
                                <td className="px-4 py-3 text-right text-zinc-700">{item.triaje}</td>
                                <td className="px-4 py-3 text-right text-orange-600 font-black text-sm">{item.total}</td>
                                <td className="px-4 py-3 text-right text-zinc-500">{item.count}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                                No hay datos anuales registrados
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* View: Stock Module details */}
          {activeTab === "stock" && (
            <div id="view-tab-stock" className="space-y-6 w-full max-w-7xl mx-auto z-10">
              <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-mega text-orange-500">
                    Almacén de Planta
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black italic uppercase -skew-x-6">
                    Ficha de Existencias
                  </h1>
                </div>
                <button
                  onClick={() => requireUnlock(() => setModalOpen((prev) => ({ ...prev, stock: true })))}
                  className="bg-orange-500 hover:bg-white text-black font-bold uppercase text-[11px] tracking-widest px-6 py-3 shrink-0 flex items-center gap-2"
                >
                  🛠️ ACTUALIZAR STOCK ESPLANADA
                </button>
              </div>

              {/* Stock Last Updated Indicator bar */}
              <div className={`border px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-xs tracking-wider rounded ${
                isStockCurrent 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isStockCurrent ? "bg-emerald-400" : "bg-rose-400"
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      isStockCurrent ? "bg-emerald-500" : "bg-rose-500"
                    }`}></span>
                  </span>
                  <span>
                    {isStockCurrent ? "ESTADO ACUMULATIVO DEL STOCK:" : "ESTADO DEL STOCK NO ACTUALIZADO:"}{" "}
                    <strong className={`font-black ${isStockCurrent ? "text-emerald-300" : "text-rose-300"}`}>
                      {dbState.stock?.lastUpdatedWeek 
                        ? (isStockCurrent 
                            ? `ACTUALIZADO SEMANA Nº ${dbState.stock.lastUpdatedWeek}` 
                            : `PNDT. ACTUALIZAR (ÚLTIMA: SEMANA Nº ${dbState.stock.lastUpdatedWeek})`)
                        : "PENDIENTE DE ACTUALIZAR"}
                    </strong>{" "}
                    | FECHA:{" "}
                    <strong className={`font-black ${isStockCurrent ? "text-emerald-300" : "text-rose-300"}`}>
                      {dbState.stock?.lastUpdatedDate ? dbState.stock.lastUpdatedDate : "S/F"}
                    </strong>
                  </span>
                </div>
                <button
                  onClick={() => requireUnlock(() => setModalOpen((prev) => ({ ...prev, stock: true })))}
                  className="text-[10px] uppercase font-bold text-white bg-black/40 hover:bg-white hover:text-black border border-white/10 hover:border-white px-3 py-1 transition flex items-center gap-1.5 rounded"
                >
                  <Edit3 className="w-3 h-3" /> CAMBIAR VALOR / ACTUALIZAR
                </button>
              </div>

              {/* Bento Stock Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Visual Embalaje detailed Card */}
                <div className="border border-white/10 bg-white/5 p-6 space-y-6">
                  <h3 className="text-xs uppercase font-black tracking-widest text-orange-500 border-b border-white/10 pb-2">
                    📦 Existente Material de Embalaje
                  </h3>
                  
                  {/* Detailed breakdown per transparent plastic type */}
                  <div className="space-y-4">
                    <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block border-b border-dashed border-white/5 pb-1">
                      Bobinas de Plástico Transparente
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                      {GEN_PLASTICOS.map((g) => {
                        const item = dbState.stock?.plasticosGen?.[g] || { palets: 0, sueltas: 0, total: 0, galga: "350", prov: "BPM MAYA" };
                        const tot = item.palets * 5 + item.sueltas;
                        return (
                          <div key={g} className="bg-black/40 border border-white/10 p-3 flex flex-col justify-between">
                            <div>
                              <span className="text-[9px] text-white/40 uppercase font-black tracking-wider block truncate" title={g}>
                                {g === "Transparente Sin Publicidad" ? "SIN PUB." : g.replace("Con Publicidad - ", "C/ ")}
                              </span>
                              <div className="text-xl font-black mt-1 text-blue-600">
                                {tot} <span className="text-[10px] text-white/30 font-semibold font-sans">bob.</span>
                              </div>
                            </div>
                            <div className="text-[9px] opacity-60 mt-2 space-y-0.5 border-t border-white/5 pt-1.5 font-sans">
                              <div>Palets: <span className="font-bold text-white">{item.palets}</span> <span className="text-[8px] opacity-50">(x5)</span></div>
                              <div>Sueltas: <span className="font-bold text-white">{item.sueltas}</span></div>
                              <div className="text-[8px] opacity-40 uppercase truncate">G: {item.galga || "350"} | P: {item.prov || "BPM MAYA"}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block border-b border-dashed border-white/5 pb-1 pt-1">
                      Film Estirable
                    </span>
                    <div className="grid grid-cols-1 text-xs font-mono">
                      <div className="bg-black/40 border border-white/10 p-3 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-white/40 uppercase font-black tracking-wider block">FILM ESTIRABLE</span>
                          <div className="text-xl font-black mt-1 text-blue-600">
                            {dbState.stock?.fi || 0} <span className="text-[10px] text-white/30 font-semibold font-sans">bob.</span>
                          </div>
                        </div>
                        <div className="text-[9px] opacity-60 text-right space-y-0.5 font-sans">
                          <div>Palets: <span className="font-bold text-white">{dbState.stock?.fiPal || 0}</span> <span className="text-[8px] opacity-50">(x46)</span></div>
                          <div>Sueltas: <span className="font-bold text-white">{dbState.stock?.fiBob || 0}</span></div>
                          <div className="text-[8px] opacity-40 uppercase">Espesor: <span className="font-bold text-white">{dbState.stock?.fgalga || "N/A"} um</span> | Prov: <span className="font-bold text-white">{dbState.stock?.fprov || "N/A"}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono opacity-40 pt-2 border-t border-white/5">
                    * Conversión automática de peso y bobinado para plásticos Barbier / BPM Maya.
                  </div>
                </div>

                {/* Chibetli details card */}
                <div className="border border-white/10 bg-white/5 p-6 space-y-4">
                  <h3 className="text-xs uppercase font-black tracking-widest text-rose-400 border-b border-white/10 pb-2">
                    🏘️ Stock Son Chibetli
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    {dbState.stock?.paletGenChibetli &&
                    Object.keys(dbState.stock.paletGenChibetli).length > 0 ? (
                      Object.entries(dbState.stock.paletGenChibetli).map(([k, val]) => (
                        <div key={k} className="bg-black/30 border border-white/10 p-2.5 flex justify-between items-center">
                          <span className="text-white/70 truncate pr-1 text-[11px]">{k}</span>
                          <span className="font-bold text-rose-400 shrink-0">{val} un.</span>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-8 text-white/20 uppercase tracking-widest">
                        Ningún stock asignado
                      </div>
                    )}
                  </div>
                </div>

                {/* Palets de géneros card */}
                <div className="col-span-1 md:col-span-2 border border-white/10 bg-white/5 p-6 space-y-4">
                  <h3 className="text-xs uppercase font-black tracking-widest text-emerald-400 border-b border-white/10 pb-2">
                    🪵 Palets de géneros (Almacén Central)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px] font-mono">
                    {GEN_PALETS.map((g) => {
                      const val = dbState.stock?.paletGen?.[g] ?? 0;
                      return (
                        <div key={g} className="bg-black/40 border border-white/5 p-2 flex flex-col justify-between">
                          <span className="text-white/50 text-[10px] truncate" title={g}>{formatStockProductName(g)}</span>
                          <span className="font-black text-emerald-400 text-base mt-1 text-right">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sacas de géneros card */}
                <div className="col-span-1 md:col-span-2 border border-white/10 bg-white/5 p-6 space-y-4">
                  <h3 className="text-xs uppercase font-black tracking-widest text-teal-400 border-b border-white/10 pb-2">
                    🛍️ Stock de Sacas (Big Bags)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px] font-mono">
                    {GEN_SACAS.map((g) => {
                      const val = dbState.stock?.sacasGen?.[g] ?? 0;
                      return (
                        <div key={g} className="bg-black/40 border border-white/5 p-2 flex flex-col justify-between">
                          <span className="text-white/50 text-[10px] truncate" title={g}>{formatStockProductName(g)}</span>
                          <span className="font-black text-teal-400 text-base mt-1 text-right">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Big Bags Vacías card */}
                <div className="col-span-1 md:col-span-2 border border-white/10 bg-white/5 p-6 space-y-4">
                  <h3 className="text-xs uppercase font-black tracking-widest text-orange-400 border-b border-white/10 pb-2">
                    🛍️ Stock de Big Bags Vacías
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono">
                    {GEN_BIG_BAGS_VACIAS.map((g) => {
                      const val = dbState.stock?.bigBagsVacias?.[g] ?? 0;
                      return (
                        <div key={g} className="bg-black/40 border border-white/5 p-3 flex flex-col justify-between">
                          <span className="text-white/50 text-[10px] truncate" title={g}>{g}</span>
                          <span className="font-black text-orange-400 text-lg mt-1 text-right">{val} <span className="text-[10px] text-white/30 font-semibold">un.</span></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>



              {/* Módulo de Salidas de Stock por Albarán (OCR & AI) - Oculto para redirección de pestaña */}
              <div id="salidas-stock-albaran-container" className="hidden">
                <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-black uppercase text-orange-500 tracking-widest flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Módulo Inteligente de Salidas de Almacén
                    </span>
                    <h2 className="text-2xl font-extrabold italic uppercase mt-1">
                      Salida de Stock por Albarán (OCR & AI)
                    </h2>
                    <p className="text-xs text-white/50 mt-1 max-w-2xl">
                      Toma una foto de tu albarán o factura de venta. La Intelgencia Artificial analizará el contenido, identificará los productos comprados y los descontará automáticamente de las existencias.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById('view-tab-stock')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-3.5 py-1.5 uppercase font-black text-orange-500 hover:text-black bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500 transition cursor-pointer flex items-center gap-1.5 rounded text-[11px] font-mono shrink-0"
                      title="Volver arriba a las Fichas de Stock de la Esplanada"
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" /> Volver a Stock Esplanada ⬆️
                    </button>

                    {(albaranImageB64 || albaranStep !== "upload" || albaranResult) && (
                      <button
                        type="button"
                        onClick={() => {
                          setAlbaranImageB64(null);
                          setAlbaranResult(null);
                          setAlbaranStep("upload");
                          setAlbaranError(null);
                        }}
                        className="px-3.5 py-1.5 uppercase font-black bg-red-950/60 hover:bg-red-600 border border-red-500/30 hover:border-red-500 text-red-200 hover:text-white rounded text-[11px] font-mono flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                        title="Cancelar acción actual de lectura, borrar imagen y volver al inicio"
                      >
                        <X className="w-3.5 h-3.5 text-red-400 group-hover:text-white" /> Cancelar Lectura ❌
                      </button>
                    )}

                    <div className="flex bg-black/40 border border-white/10 p-1 font-mono text-[11px] gap-1 rounded">
                      <button
                        onClick={() => setAlbaranSubTab("scan")}
                        className={`px-3 py-1.5 uppercase font-bold flex items-center gap-1.5 transition cursor-pointer ${
                          albaranSubTab === "scan" ? "bg-orange-500 text-black font-black" : "text-white/60 hover:text-white"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" /> Escanear Albarán
                      </button>
                      <button
                        onClick={() => setAlbaranSubTab("historial")}
                        className={`px-3 py-1.5 uppercase font-bold flex items-center gap-1.5 transition cursor-pointer ${
                          albaranSubTab === "historial" ? "bg-orange-500 text-black font-black" : "text-white/60 hover:text-white"
                        }`}
                      >
                        <History className="w-3.5 h-3.5" /> Ver Historial ({dbState.salidasStock?.length || 0})
                      </button>
                    </div>
                  </div>
                </div>

                {albaranSubTab === "scan" && (
                  <div className="space-y-6">
                    {/* Error message */}
                    {albaranError && (
                      <div className="bg-rose-500/15 border border-rose-500/20 text-rose-300 text-xs px-4 py-3 font-mono flex flex-col gap-3 rounded">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                          <div>
                            <strong className="font-extrabold uppercase block text-rose-400 mb-0.5">Error en Operación:</strong>
                            {albaranError}
                          </div>
                        </div>
                        {(albaranError.includes("clave API") || albaranError.includes("Gemini") || albaranError.includes("UNAUTHENTICATED") || albaranError.includes("permisos") || albaranError.includes("Configuración") || albaranError.includes("API key") || albaranError.includes("cuota") || albaranError.includes("limite") || albaranError.includes("límite") || albaranError.includes("429") || albaranError.includes("quota")) && (
                          <div className="border-t border-white/5 pt-2 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <span className="text-[10px] text-zinc-400">💡 ¿Quieres usar un entorno de simulación rápida sin configurar claves?</span>
                            <button
                              type="button"
                              onClick={() => {
                                setUseTestAPI(true);
                                setAlbaranError(null);
                              }}
                              className="bg-orange-500 hover:bg-orange-400 text-black px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded transition cursor-pointer self-start"
                            >
                              Activar Modo API de Prueba
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 1: Upload and operator configuration */}
                    {albaranStep === "upload" && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Configuration fields column */}
                        <div className="lg:col-span-4 bg-black/30 border border-white/5 p-5 space-y-4 rounded">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <h3 className="text-xs uppercase font-black tracking-wider text-orange-400">
                              Configuración de la Salida
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                document.getElementById('view-tab-stock')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="text-[9px] uppercase font-bold text-orange-500 hover:text-white bg-orange-500/10 hover:bg-orange-500 hover:text-black border border-orange-500/20 px-2 py-0.5 rounded transition flex items-center gap-1 shrink-0 cursor-pointer"
                              title="Subir a las fichas de stock de la esplanada"
                            >
                              Subir ⬆️
                            </button>
                          </div>

                          {/* Operator name selector */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                              Operario que Autoriza *
                            </label>
                            <select
                              value={albaranOperator}
                              onChange={(e) => setAlbaranOperator(e.target.value)}
                              className="w-full bg-black/60 border border-white/10 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500 rounded"
                            >
                              <option value="">Selecciona un Operario...</option>
                              {OPERARIOS_SACAS.map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="O escribe otro nombre..."
                              value={albaranOperator}
                              onChange={(e) => setAlbaranOperator(e.target.value)}
                              className="w-full bg-black/60 border border-white/10 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500 rounded mt-1.5"
                            />
                          </div>

                          {/* Observations / Notes */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                              Observaciones Adicionales
                            </label>
                            <textarea
                              rows={3}
                              placeholder="Ej: Entrega por la tarde, transporte propio..."
                              value={albaranObs}
                              onChange={(e) => setAlbaranObs(e.target.value)}
                              className="w-full bg-black/60 border border-white/10 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500 rounded"
                            />
                          </div>

                          <div className="text-[11px] text-zinc-500 space-y-1 leading-relaxed bg-black/20 p-3 border border-white/5 font-mono">
                            <div>• <strong>OCR inteligente:</strong> Extrae texto manuscrito o impreso.</div>
                            <div>• <strong>Coincidencia AI:</strong> Asocia los productos a la base de datos de manera adaptativa.</div>
                          </div>
                        </div>

                        {/* Drag and Drop Upload Image Area */}
                        <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
                          {!albaranImageB64 ? (
                            <>
                              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                              {/* Option 1: Direct Camera Input (Forces device camera opening) */}
                              <div className="border border-white/10 bg-black/30 hover:bg-black/50 hover:border-orange-500/30 p-6 flex flex-col items-center justify-center text-center transition relative rounded-md group min-h-[16rem]">
                                <input
                                  id="albaran-camera-input"
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleAlbaranImageUpload(e.target.files[0]);
                                    }
                                  }}
                                />
                                <div className="bg-orange-500/10 p-4 rounded-full border border-orange-500/20 mb-4 group-hover:scale-110 transition">
                                  <Camera className="w-8 h-8 text-orange-500" />
                                </div>
                                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
                                  Hacer Foto con Cámara
                                </h4>
                                <p className="text-xs text-white/50 mt-1 max-w-[220px]">
                                  Pulsa aquí para abrir directamente la cámara del móvil y tomar una foto del albarán.
                                </p>
                                <span className="text-[8px] uppercase font-mono tracking-widest text-orange-400 mt-4 border border-orange-500/20 bg-orange-500/5 px-2 py-0.5 rounded">
                                  Usar Cámara en vivo
                                </span>
                              </div>

                              {/* Option 2: Gallery / Files Select & drag/drop */}
                              <div className="border border-dashed border-white/10 bg-black/20 hover:border-orange-500/30 p-6 flex flex-col items-center justify-center text-center transition relative rounded-md group min-h-[16rem]">
                                <input
                                  id="albaran-file-input"
                                  type="file"
                                  accept="image/*"
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleAlbaranImageUpload(e.target.files[0]);
                                    }
                                  }}
                                />
                                <div className="bg-white/5 p-4 rounded-full border border-white/5 mb-4 group-hover:scale-110 transition">
                                  <Upload className="w-8 h-8 text-zinc-400" />
                                </div>
                                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
                                  Galería o Archivo
                                </h4>
                                <p className="text-xs text-white/50 mt-1 max-w-[220px]">
                                  Selecciona un documento guardado de tu carrete/archivos o arrastra una imagen.
                                </p>
                                <span className="text-[8px] uppercase font-mono tracking-widest text-zinc-400 mt-4 border border-white/10 bg-white/5 px-2 py-0.5 rounded">
                                  Elegir de Biblioteca
                                </span>
                              </div>

                              {/* Option 3: Manual Text Input Fallback */}
                              <div className="border border-white/10 bg-black/40 hover:border-blue-500/30 p-5 flex flex-col justify-between text-center transition rounded-md min-h-[16rem]">
                                <div className="space-y-1.5 text-left">
                                  <div className="flex justify-center mb-1">
                                    <div className="bg-blue-500/10 p-3 rounded-full border border-blue-500/20">
                                      <FileText className="w-5 h-5 text-blue-400" />
                                    </div>
                                  </div>
                                  <h4 className="text-xs font-extrabold text-white uppercase text-center tracking-wider">
                                    Probar con Texto de Albarán
                                  </h4>
                                  <p className="text-[9px] text-zinc-400 text-center leading-normal">
                                    ¿Tu cámara no enfoca bien? ¡Escribe o pega el texto directamente para procesarlo!
                                  </p>
                                  <textarea
                                    value={customOcrText}
                                    onChange={(e) => setCustomOcrText(e.target.value)}
                                    placeholder="CLIENTE: CONSTRUCCIONES RAMIS S.L.&#10;ALBARAN: ALB-9922&#10;162 sacos Picadis 2&#10;3 palets GRAVA 2 Son Chibetli&#10;5 sacas vacías 80x80x90"
                                    rows={4}
                                    className="w-full bg-black/90 border border-white/10 p-2 text-[10px] font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 rounded resize-none"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleParseCustomTextAlbaran(customOcrText)}
                                  className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold uppercase text-[9px] tracking-widest py-2 rounded-md transition cursor-pointer"
                                >
                                  PROCESAR TEXTO ➔
                                </button>
                              </div>
                            </div>

                            {/* Automated Trial/Demo Box */}
                            <div className="border border-amber-500/30 bg-amber-500/10 p-5 rounded-md space-y-4">
                              <div className="space-y-1 text-left">
                                <h4 className="text-xs uppercase font-black tracking-wider text-amber-400 flex items-center gap-1.5 font-mono">
                                  <Sparkles className="w-4 h-4 text-amber-500" /> SIMULADOR DE PRUEBA (Prueba el Lector gratis antes de suscribirte)
                                </h4>
                                <p className="text-[11px] text-zinc-300 leading-normal">
                                  ¿No tienes el servicio Premium activo todavía o quieres probar la funcionalidad al instante? Selecciona uno de nuestros escenarios ya pre-configurados para simular una factura real. Verás cómo asocia automáticamente la foto a tus productos para descontar el stock en un clic:
                                </p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleLoadDemoAlbaran("can-pinso")}
                                  className="bg-black/50 hover:bg-amber-500 hover:text-black border border-amber-500/20 px-3.5 py-2.5 text-left rounded-md transition duration-200 group flex flex-col justify-between h-full cursor-pointer"
                                >
                                  <div>
                                    <span className="text-[10px] uppercase font-black font-mono text-amber-400 group-hover:text-black block mb-0.5">Escenario A</span>
                                    <strong className="text-xs text-white group-hover:text-black block">CONSTRUCCIONES CAN PINSO</strong>
                                    <span className="text-[9px] text-zinc-400 group-hover:text-black/80 block mt-1 leading-normal font-mono">
                                      • 162 sacos Picadis 2 (Palets Gen)<br />
                                      • 54 sacos Picadis 0 (Son Chibetli)<br />
                                      • 2 sacas Grava Nº2 (Sacas Gen)<br />
                                      • 5 sacas vacías 80x80x90
                                    </span>
                                  </div>
                                  <span className="inline-block mt-3 text-[9px] uppercase font-black tracking-widest text-amber-400 group-hover:text-black self-end">Simular Prueba ➔</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleLoadDemoAlbaran("mallorca")}
                                  className="bg-black/50 hover:bg-amber-500 hover:text-black border border-amber-500/20 px-3.5 py-2.5 text-left rounded-md transition duration-200 group flex flex-col justify-between h-full cursor-pointer"
                                >
                                  <div>
                                    <span className="text-[10px] uppercase font-black font-mono text-amber-400 group-hover:text-black block mb-0.5">Escenario B</span>
                                    <strong className="text-xs text-white group-hover:text-black block">GRUPO CONSTRUCTOR MALLORCA</strong>
                                    <span className="text-[9px] text-zinc-400 group-hover:text-black/80 block mt-1 leading-normal font-mono">
                                      • 5 sacos Picadis 0 (Palets Gen)<br />
                                      • 3 palets Grava 2 (Son Chibetli)<br />
                                      • 10 sacas PICADIS Nº 1 (Sacas Gen)<br />
                                      • 6 sacas vacías 80X80X90 C/TUBO
                                    </span>
                                  </div>
                                  <span className="inline-block mt-3 text-[9px] uppercase font-black tracking-widest text-amber-400 group-hover:text-black self-end">Simular Prueba ➔</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleLoadDemoAlbaran("jardineria")}
                                  className="bg-black/50 hover:bg-amber-500 hover:text-black border border-amber-500/20 px-3.5 py-2.5 text-left rounded-md transition duration-200 group flex flex-col justify-between h-full cursor-pointer"
                                >
                                  <div>
                                    <span className="text-[10px] uppercase font-black font-mono text-amber-400 group-hover:text-black block mb-0.5">Escenario C</span>
                                    <strong className="text-xs text-white group-hover:text-black block">JARDINERÍA ES RECÓ</strong>
                                    <span className="text-[9px] text-zinc-400 group-hover:text-black/80 block mt-1 leading-normal font-mono">
                                      • 8 sacas ARENA BLANCA (Sacas Gen)<br />
                                      • 3 sacas TIERRA (Sacas Gen)<br />
                                      • 15 sacas vacías 75X75X80
                                    </span>
                                  </div>
                                  <span className="inline-block mt-3 text-[9px] uppercase font-black tracking-widest text-amber-400 group-hover:text-black self-end">Simular Prueba ➔</span>
                                </button>
                              </div>
                            </div>
                          </>) : (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-black/20 border border-white/10 p-4 rounded relative">
                              <button
                                onClick={() => setAlbaranImageB64(null)}
                                className="absolute top-2 right-2 bg-black/80 hover:bg-red-600 border border-white/15 hover:border-red-500 text-white p-1 rounded transition z-10 cursor-pointer"
                                title="Quitar imagen"
                              >
                                <X className="w-4 h-4" />
                              </button>

                              <div className="md:col-span-5 h-64 border border-white/10 overflow-hidden relative rounded">
                                <img
                                  src={albaranImageB64}
                                  alt="Albaran"
                                  className="w-full h-full object-contain bg-black/60"
                                />
                              </div>

                              <div className="md:col-span-7 flex flex-col justify-between py-2">
                                <div className="space-y-2">
                                  <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 text-orange-400">
                                    Imagen del Albarán Preparada
                                  </span>
                                  <h4 className="text-sm font-extrabold text-white uppercase">
                                    ¿Todo listo para el análisis?
                                  </h4>
                                  <p className="text-xs text-white/50 leading-relaxed">
                                    Asegúrate de que la foto tenga buena iluminación, enfoque nítido y que los nombres de los productos y cantidades sean claramente legibles para la detección de la Intelgencia Artificial.
                                  </p>
                                </div>

                                <div className="space-y-2.5 pt-4">
                                  {/* OCR Engine Selector Tool */}
                                  <div className="bg-white/5 border border-white/10 rounded p-4 mb-3 space-y-3 text-left">
                                    <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-orange-400 block">
                                        Motor de Reconocimiento por IA
                                      </span>
                                      <p className="text-[11px] text-zinc-400 leading-normal">
                                        Selecciona cómo procesará la IA la imagen de tu albarán:
                                      </p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setGeminiModel("flash");
                                          setUseTestAPI(false);
                                        }}
                                        className={`px-2 py-2.5 rounded border text-left flex flex-col justify-between transition h-16 cursor-pointer ${
                                          geminiModel === "flash" && !useTestAPI
                                            ? "bg-orange-500/10 border-orange-500 text-orange-400"
                                            : "bg-black/40 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                                        }`}
                                      >
                                        <span className="text-[10px] uppercase font-black font-mono">Gratuito</span>
                                        <strong className="text-[11px] font-bold leading-tight">Gemini Flash</strong>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setGeminiModel("pro");
                                          setUseTestAPI(false);
                                        }}
                                        className={`px-2 py-2.5 rounded border text-left flex flex-col justify-between transition h-16 cursor-pointer ${
                                          geminiModel === "pro" && !useTestAPI
                                            ? "bg-amber-500/10 border-amber-500 text-amber-400 font-extrabold"
                                            : "bg-black/40 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                                        }`}
                                      >
                                        <span className="text-[10px] uppercase font-black font-mono flex items-center gap-0.5">
                                          Pro <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                        </span>
                                        <strong className="text-[11px] font-bold leading-tight">Gemini Pro</strong>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setUseTestAPI(true);
                                        }}
                                        className={`px-2 py-2.5 rounded border text-left flex flex-col justify-between transition h-16 cursor-pointer ${
                                          useTestAPI
                                            ? "bg-blue-500/10 border-blue-500 text-blue-400"
                                            : "bg-black/40 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                                        }`}
                                      >
                                        <span className="text-[10px] uppercase font-black font-mono">Simulado</span>
                                        <strong className="text-[11px] font-bold leading-tight">Datos Demo</strong>
                                      </button>
                                    </div>

                                    <div className="p-2.5 bg-black/30 border border-white/5 rounded text-[10px] text-zinc-300 leading-normal font-mono">
                                      {useTestAPI && (
                                        <span className="text-blue-400 block font-bold">
                                          ✓ MODO SIMULADOR: Prueba el flujo al instante con un albarán ficticio pre-cargado. Ideal para demostraciones sin coste ni claves API.
                                        </span>
                                      )}
                                      {geminiModel === "flash" && !useTestAPI && (
                                        <span className="text-orange-400 block font-bold">
                                          ✓ RECOMENDADO PARA PRUEBAS: Permite subir tus albaranes reales del día y leerlos gratis con IA verdadera y sin cuota de cobro. ¡Pruébalo libremente!
                                        </span>
                                      )}
                                      {geminiModel === "pro" && !useTestAPI && (
                                        <span className="text-amber-400 block font-bold">
                                          ⭐ MODELO PREMIUM: Utiliza el motor avanzado Gemini 3.1 Pro de máxima precisión. Requiere haber configurado el plan de facturación de Google Cloud.
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Free local OCR option */}
                                  <div className="space-y-2">
                                    <button
                                      onClick={analyzeAlbaranWithLocalOCR}
                                      disabled={isExtractingLocalOCR || isAnalyzingAlbaran}
                                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold uppercase text-xs tracking-wider py-3.5 flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-40 rounded"
                                      title="Lector gratuito local sin llamadas de API ni costes"
                                    >
                                      {isExtractingLocalOCR ? (
                                        <>
                                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                                          PROCESANDO LECTOR GENERAL GRATIS...
                                        </>
                                      ) : (
                                        <>
                                          <Camera className="w-4 h-4 text-white" />
                                          LECTURA OCR GRATIS (LOCAL WEB)
                                        </>
                                      )}
                                    </button>

                                    {isExtractingLocalOCR && (
                                      <div className="bg-black/60 border border-emerald-500/30 p-4 rounded text-left space-y-2">
                                        <div className="flex items-center justify-between text-xs font-mono">
                                          <span className="text-emerald-400 font-bold">{localOcrStatusText}</span>
                                          <span className="text-white/70">{localOcrProgress}%</span>
                                        </div>
                                        <div className="w-full bg-zinc-800 h-2 rounded overflow-hidden">
                                          <div 
                                            className="bg-emerald-500 h-full transition-all duration-300"
                                            style={{ width: `${localOcrProgress}%` }}
                                          />
                                        </div>
                                        <div className="text-[9px] text-zinc-500 leading-normal">
                                          El motor de lectura procesa la imagen de forma segura y privada dentro de tu propio navegador.
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="relative flex py-2 items-center">
                                    <div className="flex-grow border-t border-white/10"></div>
                                    <span className="flex-shrink mx-4 text-zinc-500 uppercase text-[9px] font-mono tracking-widest">O BIEN CON INTELIGENCIA ARTIFICIAL</span>
                                    <div className="flex-grow border-t border-white/10"></div>
                                  </div>

                                  <button
                                    onClick={analyzeAlbaranWithGemini}
                                    disabled={isAnalyzingAlbaran || isExtractingLocalOCR}
                                    className="w-full bg-orange-500 hover:bg-white text-black font-extrabold uppercase text-xs tracking-mega py-3.5 flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-40"
                                  >
                                    {isAnalyzingAlbaran ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                                        PROCESANDO CON INTELIGENCIA ARTIFICIAL...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-4 h-4 text-black" />
                                        ANALIZAR ALBARÁN CON GEMINI AI
                                      </>
                                    )}
                                  </button>

                                  <button
                                    onClick={() => setAlbaranImageB64(null)}
                                    className="w-full text-center text-white/50 hover:text-white uppercase text-[10px] font-bold font-mono tracking-wider cursor-pointer mt-1"
                                  >
                                    Volver a seleccionar imagen
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Step 2: Review Extraction & Align Products */}
                    {albaranStep === "review" && albaranResult && (() => {
                      const productSelectorList = [
                        ...GEN_PALETS.map(p => ({ k: p, c: "paletGen" as const, label: `Palets - ${p}` })),
                        ...GEN_CHIB.map(p => ({ k: p, c: "paletGenChibetli" as const, label: `Son Chibetli - ${p}` })),
                        ...GEN_SACAS.map(p => ({ k: p, c: "sacasGen" as const, label: `Sacas Big Bags - ${p}` })),
                        ...GEN_BIG_BAGS_VACIAS.map(p => ({ k: p, c: "bigBagsVacias" as const, label: `Bags Vacías - ${p}` }))
                      ];

                      const getStockVal = (category: string, product: string): number => {
                        if (!dbState.stock) return 0;
                        if (category === "paletGen") return dbState.stock.paletGen?.[product] ?? 0;
                        if (category === "paletGenChibetli") return dbState.stock.paletGenChibetli?.[product] ?? 0;
                        if (category === "sacasGen") return dbState.stock.sacasGen?.[product] ?? 0;
                        if (category === "bigBagsVacias") return dbState.stock.bigBagsVacias?.[product] ?? 0;
                        return 0;
                      };

                      return (
                        <div className="space-y-6">
                          <div className="bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-emerald-400 text-xs font-mono rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <span className="flex items-center gap-1.5 uppercase font-bold">
                              <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Lectura IA Completada de forma exitosa
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] opacity-60 hidden md:inline">Revisa la propuesta de bajas y corrige si es necesario</span>
                              <button
                                type="button"
                                onClick={() => {
                                  document.getElementById('view-tab-stock')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-2 py-0.5 text-[9px] font-black uppercase bg-orange-500/20 hover:bg-orange-500 text-orange-400 hover:text-black rounded transition cursor-pointer flex items-center gap-1 border border-orange-500/20"
                                title="Volver arriba a las Fichas de Stock de la Esplanada"
                              >
                                <ArrowUpCircle className="w-3 h-3" /> Ver Stock Esplanada ⬆️
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Left Panel: Preview image */}
                            <div className="lg:col-span-4 space-y-4">
                              <div className="bg-black/30 border border-white/10 p-3 rounded">
                                <h4 className="text-[10px] uppercase font-black text-orange-400 mb-2 border-b border-white/5 pb-1 block">
                                  Foto del Albarán de Origen
                                </h4>
                                <div className="h-96 border border-white/10 overflow-hidden relative bg-black rounded">
                                  <img
                                    src={albaranImageB64 || ""}
                                    alt="Albaran original"
                                    className="w-full h-full object-contain cursor-zoom-in"
                                    onClick={() => setViewSelectedAlbaranPhoto(albaranImageB64)}
                                    title="Hacer clic para ampliar la foto"
                                  />
                                </div>
                                <div className="text-[9px] text-zinc-500 text-center font-mono mt-1.5">
                                  Haz clic en la imagen para ampliar
                                </div>
                              </div>
                            </div>

                            {/* Right Panel: Parsed form and product list mapping */}
                            <div className="lg:col-span-8 space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/40 border border-white/10 p-4 rounded">
                                <div className="space-y-1 relative">
                                  <label className="text-[10px] text-zinc-400 uppercase font-black font-mono block">
                                    Cliente Registrado
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={albaranResult.cliente}
                                      onChange={(e) => {
                                        setAlbaranResult({ ...albaranResult, cliente: e.target.value });
                                        setClientSearchQuery(e.target.value);
                                        setShowClientSuggestions(true);
                                      }}
                                      onFocus={() => {
                                        setClientSearchQuery(albaranResult.cliente || "");
                                        setShowClientSuggestions(true);
                                      }}
                                      placeholder="Seleccionar o buscar cliente..."
                                      className="w-full bg-black/80 border border-white/15 px-3 py-2 text-xs font-semibold focus:outline-none focus:border-orange-500 text-white font-mono rounded"
                                    />
                                    {albaranResult.cliente && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAlbaranResult({ ...albaranResult, cliente: "" });
                                          setClientSearchQuery("");
                                          setShowClientSuggestions(true);
                                        }}
                                        className="absolute right-2 top-2.5 text-zinc-500 hover:text-white text-xs px-1 cursor-pointer"
                                        title="Limpiar"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>

                                  {showClientSuggestions && (() => {
                                    const norm = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                    const query = norm(clientSearchQuery || "");
                                    const filtered = CLIENTES.filter(c => 
                                      norm(c.name).includes(query) || norm(c.code).includes(query)
                                    ).slice(0, 40);

                                    return (
                                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-zinc-950 border border-white/15 rounded shadow-2xl divide-y divide-white/5 font-mono">
                                        <div className="px-3 py-1.5 text-[9px] text-zinc-500 uppercase font-bold sticky top-0 bg-zinc-950 border-b border-white/5 flex justify-between items-center">
                                          <span>Clientes sugeridos ({filtered.length})</span>
                                          <button 
                                            type="button" 
                                            onClick={() => setShowClientSuggestions(false)}
                                            className="text-orange-400 hover:text-white text-xs cursor-pointer font-bold px-1"
                                          >
                                            Cerrar
                                          </button>
                                        </div>
                                        {filtered.length === 0 ? (
                                          <div className="p-3 text-xs text-zinc-500 italic text-center">
                                            Ningún cliente coincide. Puedes escribir uno libremente.
                                          </div>
                                        ) : (
                                          filtered.map((c) => (
                                            <button
                                              key={c.code}
                                              type="button"
                                              onClick={() => {
                                                setAlbaranResult({ ...albaranResult, cliente: `${c.code} - ${c.name}` });
                                                setShowClientSuggestions(false);
                                              }}
                                              className="w-full text-left px-3 py-2 text-[11px] hover:bg-orange-500 hover:text-black transition text-zinc-300 font-semibold flex items-center gap-1.5"
                                            >
                                              <span className="text-orange-500 font-bold bg-white/5 px-1 rounded text-[9px]">[{c.code}]</span>
                                              <span>{c.name}</span>
                                            </button>
                                          ))
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] text-zinc-400 uppercase font-black font-mono block">
                                    Nº de Albarán / Factura
                                  </label>
                                  <input
                                    type="text"
                                    value={albaranResult.numAlbaran}
                                    onChange={(e) => {
                                      setAlbaranResult({ ...albaranResult, numAlbaran: e.target.value });
                                    }}
                                    className="w-full bg-black/80 border border-white/15 px-3 py-2 text-xs font-semibold focus:outline-none focus:border-orange-500 text-white font-mono rounded"
                                  />
                                </div>
                              </div>

                              {/* Products matched list */}
                              <div className="border border-white/10 bg-black/20 rounded overflow-hidden">
                                <div className="bg-black/60 px-4 py-2 text-[10px] uppercase font-black text-orange-400 tracking-wider">
                                  Líneas leídas y mapeado coincidente
                                </div>

                                <div className="divide-y divide-white/5">
                                  {albaranResult.lineas.map((line, idx) => {
                                    const isChibetliClient = albaranResult.cliente?.toUpperCase().includes("554") || albaranResult.cliente?.toUpperCase().includes("SON CHIBETLI");
                                    const effectiveCategory = (isChibetliClient && line.category === "paletGen") ? "paletGenChibetli" : line.category;

                                    const rawStock = getStockVal(effectiveCategory, line.matchedProduct);
                                    const factor = (effectiveCategory === "paletGen" || effectiveCategory === "paletGenChibetli") ? 54 : 1;
                                    const deductQty = parseFloat((line.quantity / factor).toFixed(4));
                                    const nextStock = Math.max(0, parseFloat((rawStock - deductQty).toFixed(4)));
                                    const isPaletUnit = effectiveCategory === "paletGen" || effectiveCategory === "paletGenChibetli";

                                    return (
                                      <div key={idx} className="p-4 hover:bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex-1 space-y-1">
                                          <div className="text-white text-xs font-bold font-mono">
                                            {idx + 1}. "{line.rawName}"
                                          </div>
                                          <div className="text-[10px] text-white/40">
                                            Producto detectado en albarán original
                                          </div>
                                          {isChibetliClient && line.category === "paletGen" && (
                                            <div className="inline-block mt-1 bg-orange-500/20 text-orange-400 text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold border border-orange-500/30">
                                              Saliendo de almacén SON CHIBETLI (Regla del cliente)
                                            </div>
                                          )}
                                        </div>

                                        {/* Matches Select input */}
                                        <div className="w-full md:w-64 space-y-1">
                                          <label className="text-[8px] text-zinc-400 uppercase tracking-widest font-black block">
                                            Vincular a Producto de la DB:
                                          </label>
                                          <select
                                            value={line.matchedProduct || "none"}
                                            onChange={(e) => {
                                              const newLineas = [...albaranResult.lineas];
                                              const sv = e.target.value;
                                              if (sv === "none") {
                                                newLineas[idx].matchedProduct = "";
                                                newLineas[idx].category = "desconocido";
                                              } else {
                                                const matchItem = productSelectorList.find(x => x.k === sv);
                                                if (matchItem) {
                                                  newLineas[idx].matchedProduct = matchItem.k;
                                                  newLineas[idx].category = matchItem.c;
                                                }
                                              }
                                              setAlbaranResult({ ...albaranResult, lineas: newLineas });
                                            }}
                                            className="w-full bg-black/60 border border-white/10 px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-orange-500 text-white rounded"
                                          >
                                            <option value="none">-- NO DESCONTAR / DESCONOCIDO --</option>
                                            {productSelectorList.map((pi, pidx) => (
                                              <option key={pidx} value={pi.k}>
                                                {pi.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* Quantity configuration */}
                                        <div className="w-20 shrink-0 space-y-1">
                                          <label className="text-[8px] text-zinc-400 uppercase tracking-widest font-black block">
                                            {isPaletUnit ? "Sacos:" : "Unidades:"}
                                          </label>
                                          <input
                                            type="number"
                                            value={line.quantity}
                                            min={0}
                                            onChange={(e) => {
                                              const newLineas = [...albaranResult.lineas];
                                              newLineas[idx].quantity = Math.max(0, parseInt(e.target.value) || 0);
                                              setAlbaranResult({ ...albaranResult, lineas: newLineas });
                                            }}
                                            className="w-full text-center bg-black/60 border border-white/10 px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-orange-500 rounded"
                                          />
                                        </div>

                                        {/* Stock levels changes */}
                                        <div className="text-right w-36 shrink-0 font-mono space-y-0.5">
                                          <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest block">
                                            Evolución Stock:
                                          </span>
                                          {line.category !== "desconocido" && line.matchedProduct ? (
                                            <div className="text-xs">
                                              <span className="text-white/40">{rawStock}</span>
                                              <span className="text-orange-500 text-[10px] mx-1">→</span>
                                              <span className="text-emerald-400 font-bold">{nextStock}</span>
                                              <span className="text-[9px] opacity-45 block">
                                                {isPaletUnit 
                                                  ? `-${deductQty.toFixed(2)} palets (1p=54s)` 
                                                  : `-${deductQty} un.`
                                                }
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="text-[10px] text-neutral-500">Mapeo omitido</div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Comment interpretation */}
                              {albaranResult.resumen && (
                                <div className="bg-black/30 border border-white/10 p-3 rounded text-[11px] font-mono text-zinc-400 relative">
                                  <span className="text-[8px] uppercase absolute right-2 top-2 text-white/20 font-sans">Gemini Notes</span>
                                  <strong>Resumen extracción:</strong> {albaranResult.resumen}
                                </div>
                              )}

                              {/* Confirmation / Cancellation actions */}
                              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                                <button
                                  onClick={confirmAlbaranDeduction}
                                  className="w-full sm:w-auto bg-orange-500 hover:bg-white text-black font-extrabold uppercase text-xs tracking-widest px-8 py-3.5 flex items-center justify-center gap-2 cursor-pointer transition"
                                >
                                  <CheckSquare className="w-4 h-4 text-black" /> CONFIRMAR Y DESCONTAR DEL STOCK
                                </button>
                                <button
                                  onClick={() => {
                                    setAlbaranImageB64(null);
                                    setAlbaranResult(null);
                                    setAlbaranStep("upload");
                                    setAlbaranError(null);
                                  }}
                                  className="w-full sm:w-auto bg-red-950/40 hover:bg-red-700 text-red-200 hover:text-white font-extrabold uppercase text-xs tracking-wider px-6 py-3.5 border border-red-500/20 hover:border-red-500 transition cursor-pointer flex items-center justify-center gap-2"
                                  title="Cancelar y descartar la lectura de este albarán por completo"
                                >
                                  <X className="w-4 h-4 text-red-400 group-hover:text-white-500" /> CANCELAR Y DESCARTAR ❌
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Step 3: Success state */}
                    {albaranStep === "success" && (
                      <div className="bg-black/30 border border-dashed border-emerald-500/25 p-8 text-center rounded relative overflow-hidden">
                        <div className="inline-flex bg-emerald-500/10 p-4 rounded-full border border-emerald-500/35 mb-4 animate-bounce">
                          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                        </div>
                        <h3 className="text-2xl font-black uppercase text-white tracking-wide italic">
                          ¡STOCK DESCONTADO CORRECTAMENTE!
                        </h3>
                        <p className="text-sm text-zinc-400 mt-2 max-w-xl mx-auto font-medium leading-relaxed">
                          {ocrSuccessMsg}
                        </p>

                        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                          <button
                            onClick={() => {
                              setAlbaranImageB64(null);
                              setAlbaranResult(null);
                              setAlbaranStep("upload");
                            }}
                            className="bg-orange-500 hover:bg-white text-black font-extrabold uppercase text-xs tracking-widest px-8 py-3.5 transition cursor-pointer"
                          >
                            ESCANEAR OTRO ALBARÁN
                          </button>
                          <button
                            onClick={() => setAlbaranSubTab("historial")}
                            className="text-white hover:bg-neutral-800 border border-white/10 hover:border-white uppercase text-xs tracking-wider font-semibold px-6 py-3.5 transition cursor-pointer"
                          >
                            VER HISTORIAL DE SALIDAS
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {albaranSubTab === "historial" && (
                  <div className="space-y-4">
                    <div className="text-xs uppercase font-mono text-zinc-400">
                      Historial acumulativo de salidas procesadas por albarán
                    </div>

                    {dbState.salidasStock && dbState.salidasStock.length > 0 ? (
                      <div className="border border-white/10 rounded-md overflow-hidden bg-black/20">
                        <table id="table-salidas-albaran" className="w-full border-collapse font-mono text-xs text-left">
                          <thead>
                            <tr className="bg-black/60 text-orange-400 border-b border-white/10 text-[10px] uppercase font-bold">
                              <th className="px-4 py-3">Albarán</th>
                              <th className="px-4 py-3">Fecha</th>
                              <th className="px-4 py-3">Operario</th>
                              <th className="px-4 py-3">Cliente</th>
                              <th className="px-4 py-3">Detalle Productos Eliminados</th>
                              <th className="px-4 py-3 text-center">Foto</th>
                              <th className="px-4 py-3 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {dbState.salidasStock.map((log) => (
                              <tr key={log.id} className="hover:bg-white/[0.02]">
                                <td className="px-4 py-3 font-extrabold text-orange-400">
                                  {log.numAlbaran || "S/N"}
                                </td>
                                <td className="px-4 py-3 text-white/70">
                                  {log.fecha}
                                </td>
                                <td className="px-4 py-3 text-white font-bold">
                                  {log.usuario}
                                </td>
                                <td className="px-4 py-3 text-emerald-300 font-extrabold">
                                  {log.cliente}
                                </td>
                                <td className="px-4 py-3 max-w-xs md:max-w-md">
                                  <div className="space-y-1 text-[11px]">
                                    {log.lineas.map((l, lIdx) => {
                                      const isPalet = l.categoriaStock === "paletGen" || l.categoriaStock === "paletGenChibetli" || l.category === "paletGen" || l.category === "paletGenChibetli";
                                      const qtyValue = parseFloat(l.cantidad) || 0;
                                      return (
                                        <div key={lIdx} className="bg-black/40 border border-white/5 p-1 rounded">
                                          <div className="flex justify-between font-bold text-white/90">
                                            <span>{l.productoMatch || l.productoOriginal}</span>
                                            <span className="text-orange-400 font-extrabold text-right shrink-0 pr-1 select-none">
                                              {isPalet 
                                                ? `-${qtyValue} sacos (-${(qtyValue / 54).toFixed(2)} palet${qtyValue / 54 !== 1 ? 's' : ''})`
                                                : `-${qtyValue} un.`
                                              }
                                            </span>
                                          </div>
                                          <div className="text-[9px] text-white/40 flex justify-between">
                                            <span>Haber pred: {l.stockPrevio} {isPalet ? "palets" : "un."}</span>
                                            <span>Nuevo: {l.stockNuevo} {isPalet ? "palets" : "un."}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {log.obs && (
                                      <div className="text-[10px] italic text-zinc-500 pt-0.5">
                                        Nota: "{log.obs}"
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {log.fotoB64 ? (
                                    <button
                                      onClick={() => setViewSelectedAlbaranPhoto(log.fotoB64)}
                                      className="inline-block hover:scale-105 transition shrink-0 cursor-zoom-in"
                                    >
                                      <img
                                        src={log.fotoB64}
                                        alt="Doc"
                                        className="w-10 h-7 object-cover border border-white/20 bg-black rounded"
                                      />
                                    </button>
                                  ) : (
                                    <span className="text-zinc-650 text-[10px]">Sin foto</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => setEditingSalidaStock(log)}
                                      className="text-[#3B82F6] hover:text-blue-300 p-1 rounded cursor-pointer"
                                      title="Editar registro"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRecord("salidaStock", log.id)}
                                      className="text-red-500 hover:text-red-300 p-1 rounded cursor-pointer"
                                      title="Eliminar registro"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-black/30 border border-white/5 text-center py-12 text-zinc-500 font-mono text-sm uppercase tracking-wider rounded-md">
                        Ninguna salida de stock registrada aún por albarán
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal de visualización de foto detallada de albarán */}
              {viewSelectedAlbaranPhoto && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-55">
                  <div className="bg-neutral-900 border border-white/10 p-4 max-w-4xl w-full flex flex-col justify-between max-h-[90vh] relative rounded-md">
                    <button
                      onClick={() => setViewSelectedAlbaranPhoto(null)}
                      className="absolute top-3 right-3 bg-black hover:bg-neutral-800 text-white border border-white/10 p-2 rounded-full transition z-10 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="overflow-auto max-h-[80vh] flex items-center justify-center">
                      {viewSelectedAlbaranPhoto.startsWith("template_") ? (
                        <div className="w-96 p-8 border border-orange-500/30 bg-orange-950/20 rounded flex flex-col items-center justify-center text-center font-mono">
                          <Sparkles className="w-16 h-16 text-orange-500 mb-2 animate-pulse" />
                          <span className="text-sm font-black uppercase text-white">Modelo de Albarán Real</span>
                          <span className="text-xs text-orange-400 mt-1 uppercase font-bold">({viewSelectedAlbaranPhoto === "template_duran" ? "Guillermo Durán S.A." : "Can Mateu S.L."})</span>
                          <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                            Este registro se generó simulando la recepción del albarán auténtico de la cantera Cas Vilafranquer con coincidencia exacta de catálogo.
                          </p>
                        </div>
                      ) : (
                        <img
                          src={viewSelectedAlbaranPhoto}
                          alt="Zoom albaran"
                          className="max-w-full max-h-[75vh] object-contain"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* View: Intelligent Salidas Tab */}
          {activeTab === "salidas" && (
            <SalidasAlbaranTab
              dbState={dbState}
              setDbState={setDbState}
              albaranImageB64={albaranImageB64}
              setAlbaranImageB64={setAlbaranImageB64}
              useTestAPI={useTestAPI}
              setUseTestAPI={setUseTestAPI}
              isAnalyzingAlbaran={isAnalyzingAlbaran}
              setIsAnalyzingAlbaran={setIsAnalyzingAlbaran}
              isExtractingLocalOCR={isExtractingLocalOCR}
              setIsExtractingLocalOCR={setIsExtractingLocalOCR}
              localOcrProgress={localOcrProgress}
              setLocalOcrProgress={setLocalOcrProgress}
              localOcrStatusText={localOcrStatusText}
              setLocalOcrStatusText={setLocalOcrStatusText}
              albaranError={albaranError}
              setAlbaranError={setAlbaranError}
              albaranResult={albaranResult}
              setAlbaranResult={setAlbaranResult}
              albaranOperator={albaranOperator}
              setAlbaranOperator={setAlbaranOperator}
              albaranStep={albaranStep}
              setAlbaranStep={setAlbaranStep}
              albaranObs={albaranObs}
              setAlbaranObs={setAlbaranObs}
              ocrSuccessMsg={ocrSuccessMsg}
              setOcrSuccessMsg={setOcrSuccessMsg}
              albaranSubTab={albaranSubTab}
              setAlbaranSubTab={setAlbaranSubTab}
              viewSelectedAlbaranPhoto={viewSelectedAlbaranPhoto}
              setViewSelectedAlbaranPhoto={setViewSelectedAlbaranPhoto}
              editingSalidaStock={editingSalidaStock}
              setEditingSalidaStock={setEditingSalidaStock}
              customOcrText={customOcrText}
              setCustomOcrText={setCustomOcrText}
              setActiveTab={setActiveTab}
              analyzeAlbaranWithLocalOCR={analyzeAlbaranWithLocalOCR}
              analyzeAlbaranWithGemini={analyzeAlbaranWithGemini}
              confirmAlbaranDeduction={confirmAlbaranDeduction}
              handleDeleteRecord={handleDeleteRecord}
              handleParseCustomTextAlbaran={handleParseCustomTextAlbaran}
            />
          )}

          {/* View: Mantenimiento & Preventive */}
          {activeTab === "mant" && (
            <div id="view-tab-mant" className="space-y-6 w-full max-w-7xl mx-auto z-10">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-bold uppercase tracking-mega text-orange-500">
                  Industrial Maintenance Room
                </span>
                <h1 className="text-4xl md:text-5xl font-black italic uppercase -skew-x-6">
                  Logística & Mantenimiento
                </h1>
              </div>

              {/* Maintenance Sub-navigation buttons */}
              <div className="flex gap-1 overflow-x-auto border-b border-white/10 pb-2 scrollbar-none font-display">
                <button
                  onClick={() => setMantSubtab("ots")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    mantSubtab === "ots"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  Ficha OTs Trabajo
                </button>
                <button
                  onClick={() => setMantSubtab("paradas")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    mantSubtab === "paradas"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  Paradas & Averías
                </button>
                <button
                  onClick={() => setMantSubtab("pm")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    mantSubtab === "pm"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  Sustentación Preventivos
                </button>
                <button
                  onClick={() => setMantSubtab("repuestos")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    mantSubtab === "repuestos"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  Repuestos Cambiados
                </button>
                <button
                  onClick={() => setMantSubtab("checklist")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    mantSubtab === "checklist"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  Checklists Diarios
                </button>
                <button
                  onClick={() => setMantSubtab("docs")}
                  className={`px-4 py-2 text-[10px] tracking-widest uppercase font-bold transition border shrink-0 ${
                    mantSubtab === "docs"
                      ? "bg-orange-500 text-black border-orange-500"
                      : "border-transparent text-white/50 hover:text-white"
                  }`}
                >
                  Documentación Técnica
                </button>
              </div>

              {/* Renders per subtab */}
              {mantSubtab === "ots" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-2">
                    <h3 className="text-xs uppercase font-black tracking-widest text-orange-500 font-display">
                      Ordenes de Trabajo Existentes
                    </h3>
                    <button
                      onClick={() => openNewRecord("ot")}
                      className="bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-wider text-[11px] px-4 py-2 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Emitir OT Tarea
                    </button>
                  </div>

                  {renderSearchFilterBar(true)}

                  <div className="border border-white/10 bg-black/40 overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="bg-white/5 uppercase text-[10px] border-b border-white/15 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                          <th>OT Num</th>
                          <th>Máquina</th>
                          <th>Tipo</th>
                          <th>Prioridad</th>
                          <th>Fecha</th>
                          <th>Descripción</th>
                          <th>Técnico</th>
                          <th className="text-right">Tiempo</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {filteredOts.length > 0 ? (
                          filteredOts.map((o) => (
                            <tr key={o.id} className="hover:bg-white/5">
                              <td className="px-4 py-3 font-semibold text-orange-400">{o.num}</td>
                              <td className="px-4 py-3 font-semibold text-white/95">
                                {MAQUINAS[o.maq]?.n || o.maq}
                              </td>
                              <td className="px-4 py-3 opacity-80">{o.tipo}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-1.5 py-0.5 font-bold uppercase text-[9px] ${
                                    o.prio === "Alta"
                                      ? "bg-red-500/15 text-red-500 border border-red-500/20"
                                      : o.prio === "Media"
                                      ? "bg-amber-500/10 text-amber-500"
                                      : "bg-white/5 text-white/40"
                                  }`}
                                >
                                  {o.prio}
                                </span>
                              </td>
                              <td className="px-4 py-3">{formatDateDMY(o.fecha)}</td>
                              <td className="px-4 py-3 max-w-[200px] truncate" title={o.desc}>
                                {o.desc}
                              </td>
                              <td className="px-4 py-3">{o.tec || "-"}</td>
                              <td className="px-4 py-3 text-right">{o.t || 0}h</td>
                              <td className="px-4 py-3">
                                <span className={`uppercase font-bold text-[10px] ${o.est === "Cerrada" ? "text-emerald-500" : "text-amber-500"}`}>
                                  {o.est}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => openEditRecord("ot", o)} className="text-blue-400 hover:text-white">
                                    Edit
                                  </button>
                                  <button onClick={() => handleDeleteRecord("ot", o.id)} className="text-red-500 hover:text-white">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={10} className="text-center py-8 text-white/20 uppercase tracking-widest">
                              No hay ordenes registradas
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {mantSubtab === "paradas" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-2">
                    <h3 className="text-xs uppercase font-black tracking-widest text-red-500 font-display">
                      Registro de Paradas de Producción / Averías
                    </h3>
                    <button
                      onClick={() => openNewRecord("parada")}
                      className="bg-red-700 hover:bg-red-600 text-white font-bold uppercase tracking-wider text-[11px] px-4 py-2 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Registrar Parada
                    </button>
                  </div>

                  {renderSearchFilterBar(true)}

                  {/* Summary of Machine Stoppage Days */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-red-500 font-bold font-mono">
                          Días Totales de Parada
                        </span>
                        <div className="text-3xl font-black tracking-tight font-display mt-1 text-black bg-white/90 px-2 py-1 rounded inline-block">
                          {stoppageStats.totalDowntimeDays.toFixed(2)}{" "}
                          <span className="text-xs font-normal text-black/70">días</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono opacity-40 mt-3">
                        Total acumulado de todas las incidencias
                      </span>
                    </div>

                    <div className="border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-orange-400 font-bold font-mono">
                          Días en Parada Activa
                        </span>
                        <div className="text-3xl font-black tracking-tight font-display mt-1 text-orange-400">
                          {stoppageStats.activeDowntimeDays.toFixed(2)}{" "}
                          <span className="text-xs font-normal text-white/50">días</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono opacity-40 mt-3">
                        Pérdida en tiempo real de averías abiertas
                      </span>
                    </div>

                    <div className="border border-white/10 bg-white/5 p-4 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold font-mono">
                          Máquina más afectada
                        </span>
                        {stoppageStats.downtimeByMachine.length > 0 ? (
                          <div className="mt-1">
                            <span className="text-[13px] font-black uppercase text-red-400 truncate block">
                              {MAQUINAS[stoppageStats.downtimeByMachine[0].maq]?.n || stoppageStats.downtimeByMachine[0].maq}
                            </span>
                            <span className="text-[11px] font-mono text-white/70">
                              {stoppageStats.downtimeByMachine[0].days.toFixed(2)} días parados
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs font-mono text-white/30 mt-1">
                            Sin registro
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] font-mono opacity-40 mt-3">
                        Por tiempo de parada total
                      </span>
                    </div>
                  </div>

                  {/* Machine Downtime Breakdown List */}
                  {stoppageStats.downtimeByMachine.length > 0 && (
                    <div className="border border-white/10 bg-black/30 p-3 rounded-sm">
                      <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono font-bold block mb-2">
                        Tiempo de Parada por Máquina (Días acumulados)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 font-mono">
                        {stoppageStats.downtimeByMachine.map(({ maq, days }) => (
                          <div key={maq} className="bg-black/40 border border-white/5 p-2 flex flex-col justify-between">
                            <span className="text-white/50 text-[10px] truncate">
                              {MAQUINAS[maq]?.n || maq}
                            </span>
                            <span className="font-bold text-red-400 text-xs mt-1 text-right">
                              {days.toFixed(2)} d
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                    <table className="w-full text-left font-mono text-xs text-zinc-900">
                      <thead>
                        <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                          <th>Ref</th>
                          <th>Máquina</th>
                          <th>Tipo</th>
                          <th>Turno</th>
                          <th>Inicio</th>
                          <th>Fin / Duración</th>
                          <th>Descripción</th>
                          <th>Acciones inmediata</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {filteredParadas.length > 0 ? (
                          filteredParadas.map((p) => {
                            const isActiva = p.est === "Abierta" || !p.fin;
                            const currentMins = getDowntimeMins(p);
                            const currentDays = currentMins / 1440;
                            return (
                              <tr key={p.id} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                                <td className="px-4 py-3 font-semibold text-red-600">{p.num}</td>
                                <td className="px-4 py-3 font-semibold text-zinc-900">
                                  {MAQUINAS[p.maq]?.n || p.maq}
                                </td>
                                <td className="px-4 py-3 text-zinc-700">{p.tipo}</td>
                                <td className="px-4 py-3 text-[10px] text-zinc-500 uppercase font-bold">{p.turno}</td>
                                <td className="px-4 py-3 text-zinc-700">{p.ini ? p.ini.replace("T", " ") : "-"}</td>
                                <td className="px-4 py-3">
                                  {isActiva ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-red-700 font-bold animate-pulse text-[10px] tracking-wider uppercase bg-red-100 border border-red-200 px-1.5 py-0.5 w-max rounded">
                                        ACTIVA
                                      </span>
                                      <span className="text-red-700 font-bold text-[10px]">
                                        {currentDays.toFixed(2)} días
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-zinc-800">
                                        {p.dur ? `${p.dur} mins` : "Ok"}
                                      </span>
                                      <span className="text-zinc-500 text-[10px] font-semibold">
                                        {p.dur ? `${(p.dur / 1440).toFixed(2)} días` : "0 días"}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 max-w-[150px] truncate text-zinc-800" title={p.desc}>
                                  {p.desc}
                                </td>
                                <td className="px-4 py-3 max-w-[150px] truncate text-zinc-800" title={p.acc}>
                                  {p.acc || "-"}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${p.est === "Cerrada" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-red-100 text-red-800 border border-red-200 animate-pulse"}`}>
                                    {p.est}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center gap-1.5 justify-center">
                                    <button onClick={() => openEditRecord("parada", p)} className="text-blue-600 hover:text-zinc-950 font-semibold">
                                      Edit
                                    </button>
                                    <button onClick={() => handleDeleteRecord("parada", p.id)} className="text-red-650 hover:text-red-800">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={10} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                              No hay averías registradas
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {mantSubtab === "pm" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-2">
                    <h3 className="text-xs uppercase font-black tracking-widest text-orange-500 font-display">
                      Mantenimientos Preventivos Programados (Plan PM)
                    </h3>
                    <button
                      onClick={() => openNewRecord("pm")}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-[11px] px-4 py-2 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Planificar Preventivo
                    </button>
                  </div>

                  <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                    <table className="w-full text-left font-mono text-xs text-zinc-900">
                      <thead>
                        <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                          <th>Máquina / Sector</th>
                          <th>Descripción Tarea Preventiva</th>
                          <th>Frecuencia programada</th>
                          <th>Próxima Ejecución</th>
                          <th className="text-right">Tiempo Est.</th>
                          <th>Técnico Sugerido</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {dbState.pm && dbState.pm.length > 0 ? (
                          dbState.pm.map((p) => {
                            const isOverdue = new Date(p.fecha) < new Date();
                            return (
                              <tr key={p.id} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                                <td className="px-4 py-3 font-semibold text-zinc-950">
                                  {MAQUINAS[p.maq]?.n || p.maq}
                                </td>
                                <td className="px-4 py-3 font-sans font-medium text-zinc-800">{p.desc}</td>
                                <td className="px-4 py-3 text-zinc-700">Cada {p.freq} días</td>
                                <td className="px-4 py-3">
                                  <span className={`font-semibold ${isOverdue ? "text-red-700 animate-pulse font-bold" : "text-emerald-700"}`}>
                                    {formatDateDMY(p.fecha)} {isOverdue && "⚠️ ATRASADO"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right text-zinc-750">{p.t}h</td>
                                <td className="px-4 py-3 text-zinc-700">{p.tec || "-"}</td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center gap-2 justify-center">
                                    <button onClick={() => openEditRecord("pm", p)} className="text-blue-600 hover:text-zinc-950 font-semibold">
                                      Edit
                                    </button>
                                    <button onClick={() => handleDeleteRecord("pm", p.id)} className="text-red-650 hover:text-red-800">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                              No hay tareas preventivas asignadas
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {mantSubtab === "repuestos" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-2">
                    <h3 className="text-xs uppercase font-black tracking-widest text-[#FFF] font-display">
                      Historial de Componentes y Recambios Sustituidos
                    </h3>
                    <button
                      onClick={() => openNewRecord("repuesto")}
                      className="bg-orange-500 hover:bg-white text-black font-bold uppercase tracking-wider text-[11px] px-4 py-2 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Registrar Repuesto
                    </button>
                  </div>

                  {renderSearchFilterBar(true)}

                  <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                    <table className="w-full text-left font-mono text-xs text-zinc-900">
                      <thead>
                        <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                          <th>Fecha</th>
                          <th>Máquina / Sector</th>
                          <th>Tipo Recambio</th>
                          <th>Pieza / Descripción específica</th>
                          <th>Referencia técnica</th>
                          <th>Motivo Cambio</th>
                          <th>Técnico</th>
                          <th>Proveedor</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {filteredRepuestos.length > 0 ? (
                          filteredRepuestos.map((r) => (
                            <tr key={r.id} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                              <td className="px-4 py-3 text-zinc-800">{formatDateDMY(r.fecha)}</td>
                              <td className="px-4 py-3 font-semibold text-zinc-950">
                                {MAQUINAS[r.maq]?.n || r.maq}
                              </td>
                              <td className="px-4 py-3 text-zinc-600 text-[11px]">{r.tipo}</td>
                              <td className="px-4 py-3 font-sans font-semibold text-zinc-900">{r.pieza}</td>
                              <td className="px-4 py-3 font-mono text-[11px] text-orange-600 font-bold">{r.ref || "-"}</td>
                              <td className="px-4 py-3 text-[11px] text-zinc-700">{r.motivo}</td>
                              <td className="px-4 py-3 text-zinc-800">{r.tec || "-"}</td>
                              <td className="px-4 py-3 text-zinc-600">{r.prov || "-"}</td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => handleDeleteRecord("repuesto", r.id)} className="text-red-650 hover:text-red-800">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                              No hay repuestos registrados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {mantSubtab === "checklist" && (
                <div className="space-y-6">
                  <div className="border border-white/10 bg-white/5 p-6 space-y-4">
                    <h3 className="text-xs uppercase font-black tracking-widest text-orange-500">
                      Formulario de Verificación Periódica (Checklist)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                          Fecha Inspección
                        </label>
                        <input
                          type="date"
                          className="w-full bg-black/60 border border-white/10 p-2 text-xs font-mono outline-none focus:border-orange-500"
                          value={chkDate}
                          onChange={(e) => setChkDate(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                          Máquina / Equipo
                        </label>
                        <select
                          className="w-full bg-black/60 border border-white/10 p-2 text-xs outline-none focus:border-orange-500"
                          value={chkMaq}
                          onChange={(e) => setChkMaq(e.target.value)}
                        >
                          <option value="cv05">M1 (CV05)</option>
                          <option value="cv2080">M2 (CV2080)</option>
                          <option value="tosa95">Flejadora Tosa95</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                          Frecuencia
                        </label>
                        <div className="flex gap-1 h-[34px]">
                          {(["diaria", "semanal", "mensual"] as const).map((freq) => (
                            <button
                              key={freq}
                              onClick={() => setChkFreq(freq)}
                              className={`flex-1 py-1 px-2 border text-[9px] uppercase font-bold tracking-wider leading-none transition-colors ${
                                chkFreq === freq
                                  ? "bg-orange-500 border-orange-500 text-black"
                                  : "bg-black/40 border-white/10 text-white/55 hover:text-white"
                              }`}
                            >
                              {freq}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-end">
                        <div className="w-full bg-orange-500/5 text-orange-500 border border-orange-500/20 px-3 py-2 text-[10px] uppercase tracking-wider font-mono text-center">
                          ID: {checklistKey}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Render checklist list checkitems */}
                  <div className="border border-white/10 p-6 bg-black/40 space-y-4">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#FFF] border-b border-white/5 pb-2">
                      Padrón de Inspecciones
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(chkFreq === "diaria"
                        ? CHECKLIST_DIARIO
                        : chkFreq === "semanal"
                        ? CHECKLIST_SEMANAL
                        : CHECKLIST_MENSUAL
                      ).map((item, index) => {
                        const isChecked = !!activeChecklistState[index];
                        return (
                          <div
                            key={index}
                            onClick={() => toggleChecklistItem(index)}
                            className={`flex items-center gap-3 p-3 border cursor-pointer transition-all select-none ${
                              isChecked
                                ? "bg-emerald-500/5 border-emerald-500/40 text-emerald-300"
                                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                            }`}
                          >
                            <div className={`w-5 h-5 flex items-center justify-center border shrink-0 ${isChecked ? "bg-emerald-500 border-emerald-500 text-black" : "border-white/30"}`}>
                              {isChecked && <Check className="w-4 h-4 font-black" />}
                            </div>
                            <span className="text-xs uppercase font-bold tracking-wide font-sans leading-none mt-0.5">
                              {item}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {mantSubtab === "docs" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-2">
                    <h3 className="text-xs uppercase font-black tracking-widest text-orange-500 font-display">
                      Esquemas Eléctricos & Manuales de Máquinas
                    </h3>
                    <button
                      onClick={() => requireUnlock(() => setShowDocForm(!showDocForm))}
                      className="bg-orange-500 hover:bg-white text-black font-bold uppercase tracking-wider text-[11px] px-4 py-2 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Añadir Documento PDF
                    </button>
                  </div>

                  {/* Upload document inline form */}
                  {showDocForm && (
                    <form
                      onSubmit={handleSaveDoc}
                      className="border border-orange-500/30 bg-orange-500/5 p-6 space-y-4 max-w-xl"
                    >
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-orange-500">
                        Sustentación Nuevo Documento
                      </h4>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-white/55 uppercase mb-1">Máquina</label>
                          <select
                            className="w-full bg-black/60 border border-white/10 p-2 text-xs text-white outline-none"
                            value={newDocData.maq}
                            onChange={(e) => setNewDocData((p) => ({ ...p, maq: e.target.value }))}
                          >
                            <option value="cv05">M1 (CV05)</option>
                            <option value="cv2080">M2 (CV2080)</option>
                            <option value="tosa95">Flejadora Tosa95</option>
                            <option value="general">Planta General</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-white/55 uppercase mb-1">Categoría</label>
                          <select
                            className="w-full bg-black/60 border border-white/10 p-2 text-xs text-white outline-none"
                            value={newDocData.cat}
                            onChange={(e) => setNewDocData((p) => ({ ...p, cat: e.target.value }))}
                          >
                            <option value="Manual de maquina">Manual de máquina</option>
                            <option value="Plano mecanico">Plano mecánico</option>
                            <option value="Esquema electrico">Esquema eléctrico</option>
                            <option value="Catalogo de piezas">Catálogo de piezas</option>
                            <option value="Certificado">Certificado técnico</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-white/55 uppercase mb-1">Nombre Documento</label>
                        <input
                          type="text"
                          required
                          className="w-full bg-black/60 border border-white/10 p-2 text-xs text-white outline-none focus:border-orange-500"
                          placeholder="Ej: Esquema Eléctrico CV05 - 2024"
                          value={newDocData.nombre}
                          onChange={(e) => setNewDocData((p) => ({ ...p, nombre: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-white/55 uppercase mb-1">Descripción corta</label>
                        <input
                          type="text"
                          className="w-full bg-black/60 border border-white/10 p-2 text-xs text-white outline-none focus:border-orange-500"
                          placeholder="Notas de revisión, autor..."
                          value={newDocData.desc}
                          onChange={(e) => setNewDocData((p) => ({ ...p, desc: e.target.value }))}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-white/55 uppercase mb-1">Seleccionar Archivo (Pdf, Image, Doc)</label>
                        <input
                          type="file"
                          accept=".pdf,image/*,.doc,.docx"
                          className="w-full text-xs font-mono py-2 text-white/60"
                          onChange={handleDocFileObj}
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setShowDocForm(false)}
                          className="px-4 py-2 border border-white/10 font-bold uppercase text-[10px] tracking-wider text-white/60"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-6 py-2 bg-orange-500 font-bold uppercase text-[10px] tracking-wider text-black"
                        >
                          Guardar Documento
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Documents directory list view */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dbState.docs && dbState.docs.length > 0 ? (
                      dbState.docs.map((docItem) => (
                        <div key={docItem.id} className="border border-white/10 bg-black/40 p-5 flex flex-col justify-between relative overflow-hidden">
                          {/* Accent watermark */}
                          <div className="absolute top-2 right-2 text-white/5 font-bold font-mono text-[9px]">
                            {docItem.tamano || "14 KB"}
                          </div>

                          <div className="space-y-3">
                            <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-orange-500 bg-orange-500/5 px-2 py-0.5 border border-orange-500/10">
                              {docItem.cat}
                            </span>
                            <div>
                              <h4 className="text-sm font-black text-[#FFF] tracking-tight">{docItem.nombre}</h4>
                              <p className="text-xs text-white/40 mt-1">{docItem.desc || "Sin descripción proporcionada"}</p>
                            </div>
                          </div>

                          <div className="border-t border-white/5 pt-4 mt-6 flex justify-between items-center text-xs font-mono">
                            <span className="text-[10px] opacity-40">{formatDateDMY(docItem.fecha)}</span>
                            <div className="flex items-center gap-2">
                              {docItem.b64 && (
                                <a
                                  href={docItem.b64}
                                  download={docItem.nombre}
                                  className="text-orange-400 hover:text-white flex items-center gap-1 uppercase tracking-wider text-[10px] font-bold"
                                >
                                  <Download className="w-3.5 h-3.5" /> Descargar
                                </a>
                              )}
                              <button
                                onClick={() => handleDeleteRecord("documento", docItem.id)}
                                className="text-red-500 hover:text-white"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full border border-dashed border-white/10 text-center py-12 text-white/20 uppercase tracking-widest text-xs">
                        No hay documentación técnica registrada en la base de datos
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* View: Combustible Gasolina direct logs */}
          {activeTab === "gas" && (
            <div id="view-tab-gas" className="space-y-6 w-full max-w-7xl mx-auto z-10">
              <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-mega text-orange-500">
                    Industrial Fuel Room
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black italic uppercase -skew-x-6">
                    Consumo Combustible Gasoil
                  </h1>
                </div>
                <button
                  onClick={() => openNewRecord("gas")}
                  className="bg-orange-500 hover:bg-white text-black font-bold uppercase text-[11px] tracking-widest px-6 py-3 shrink-0 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  REGISTRAR COMBUSTIBLE L
                </button>
              </div>

              {/* Depósito Principal Dashboard Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-950 border border-white/10 p-5 rounded-md font-mono text-white">
                <div className="space-y-2 border-r border-white/5 pr-4 last:border-0 last:pr-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">🏢 DEPÓSITO GENERAL</span>
                    <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${
                      gasTankStats.estimatedPercent >= 50 ? "bg-emerald-500/15 text-emerald-400" :
                      gasTankStats.estimatedPercent >= 20 ? "bg-amber-500/15 text-amber-400" :
                      "bg-rose-500/15 text-rose-400"
                    }`}>
                      {gasTankStats.estimatedPercent >= 50 ? "🟢 SEGURO" :
                       gasTankStats.estimatedPercent >= 20 ? "🟡 BAJO" :
                       "🔴 CRÍTICO / RELLENAR"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-white">{gasTankStats.estimatedLevel.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L</span>
                    <span className="text-zinc-500 text-xs">de 2.000 L</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        gasTankStats.estimatedPercent >= 50 ? "bg-emerald-500" :
                        gasTankStats.estimatedPercent >= 20 ? "bg-amber-500" :
                        "bg-rose-500"
                      }`}
                      style={{ width: `${gasTankStats.estimatedPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Nivel estimado: {gasTankStats.estimatedPercent.toFixed(1)}%</span>
                    <span>Capacidad: 2.000 Litros</span>
                  </div>
                </div>

                <div className="space-y-2 border-r border-white/5 px-0 md:px-4 last:border-0 last:pr-0">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">📅 ÚLTIMO LLENADO DE TANQUE</span>
                  <div className="text-xl font-black text-orange-400">
                    {gasTankStats.hasRefill ? gasTankStats.lastRefillDate : "Sin registro de llenado"}
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    Se calcula desde que marcas <strong className="text-emerald-400">"Depósito Lleno"</strong> en el formulario al recibir el camión de suministro.
                  </p>
                </div>

                <div className="space-y-2 px-0 md:px-4 last:border-0 last:pr-0">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">📉 CONSUMIDO REGISTRADO</span>
                  <div className="text-2xl font-black text-rose-400">
                    {gasTankStats.consumedSinceRefill.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    Suma del combustible extraído y registrado por las carretillas desde el último llenado del depósito principal.
                  </p>
                </div>
              </div>

              {/* Desglose Formula y Historial de Descuentos */}
              <div className="bg-zinc-900 border border-white/10 rounded-md p-4 font-mono text-white text-xs space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-3 gap-2">
                  <div>
                    <h3 className="font-bold uppercase text-orange-400 text-xs flex items-center gap-2">
                      <span>📉 SISTEMA DE DESCUENTO AUTOMÁTICO</span>
                      <span className="bg-orange-500/10 text-orange-400 text-[9px] px-1.5 py-0.5 rounded font-normal">ACTIVO</span>
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Cada repostaje registrado descuenta de los 2.000 L en tiempo real.
                    </p>
                  </div>
                  <div className="bg-zinc-950 border border-white/5 py-1 px-3 rounded text-[11px] flex items-center gap-2 text-zinc-300">
                    <span className="text-zinc-500">CORRECCIÓN AUTOMÁTICA:</span>
                    <span>2.000 L</span>
                    <span className="text-rose-400 font-bold">-</span>
                    <span className="text-rose-400 font-black">{gasTankStats.consumedSinceRefill.toFixed(1)} L</span>
                    <span className="text-zinc-500 font-semibold">=</span>
                    <span className="text-emerald-400 font-black">{gasTankStats.estimatedLevel.toFixed(1)} L Disponibles</span>
                  </div>
                </div>

                {gasTankStats.historyOfDeductions && gasTankStats.historyOfDeductions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-zinc-400 uppercase font-black tracking-wider px-1">
                      <span>Últimos Retiros de Gasoil desde el último llenado (Descontados automáticamente)</span>
                      <span>Nivel Resultante</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-white/5 bg-zinc-950/50 rounded border border-white/5 px-2">
                      {gasTankStats.historyOfDeductions.slice(0, 5).map((ded, index) => {
                        const maqN = GAS_MAQUINAS[ded.ref]?.n || ded.ref || "Máquina";
                        return (
                          <div key={ded.id || index} className="flex items-center justify-between py-2 text-[11px] text-zinc-300 hover:bg-white/5 px-1">
                            <div className="flex flex-wrap items-center gap-x-2">
                              <span className="text-zinc-500 text-[10px]">{formatDateDMY(ded.fecha)} ({ded.turno})</span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase">{maqN}</span>
                              <span className="text-zinc-400">repostó/extrajo:</span>
                              <strong className="text-rose-400 font-black">-{ded.consumo.toFixed(1)} Litros</strong>
                              <span className="text-zinc-500 text-[10px]">por {ded.op}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-emerald-400 font-bold font-mono">{ded.runningLevel.toFixed(1)} L</span>
                            </div>
                          </div>
                        );
                      })}
                      {gasTankStats.historyOfDeductions.length > 5 && (
                        <div className="text-center py-1.5 text-[9px] text-zinc-500 uppercase font-mono">
                          + {gasTankStats.historyOfDeductions.length - 5} retiros anteriores descritos debajo
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-zinc-500 uppercase tracking-widest bg-zinc-950/30 rounded border border-dotted border-white/5">
                    No se han registrado consumos de máquinas desde el último llenado del depósito (Nivel de depósito intacto al 100%)
                  </div>
                )}
              </div>

              {renderSearchFilterBar(false)}

              <div className="border border-zinc-200 bg-white text-zinc-900 overflow-x-auto rounded-lg shadow-sm">
                <table className="w-full text-left font-mono text-xs text-zinc-900">
                  <thead>
                    <tr className="bg-zinc-100 uppercase text-[10px] border-b border-zinc-200 text-zinc-600 [&>th]:px-4 [&>th]:py-3 [&>th]:font-bold [&>th]:tracking-wider">
                      <th>Fecha</th>
                      <th>Turno</th>
                      <th>Máquina (Carretilla)</th>
                      <th>Modelo / Serie</th>
                      <th className="text-right">Med. Inicial</th>
                      <th className="text-right">Med. Final</th>
                      <th className="text-right">Consumo Litros</th>
                      <th className="text-right">Horómetro</th>
                      <th>Operario / Conductor</th>
                      <th>Observaciones</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {filteredGas.length > 0 ? (
                      filteredGas.map((g) => (
                        <tr key={g.id} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                          <td className="px-4 py-3 text-zinc-800">{formatDateDMY(g.fecha)}</td>
                          <td className="px-4 py-3 uppercase text-zinc-700 font-semibold">{g.turno}</td>
                          <td className="px-4 py-3 font-semibold text-zinc-950">
                            {GAS_MAQUINAS[g.ref]?.n || g.ref}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">{g.modelo}</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{g.medIni ? g.medIni.toFixed(2) : "0.00"} L</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{g.medFin ? g.medFin.toFixed(2) : "0.00"} L</td>
                          <td className="px-4 py-3 text-right text-orange-600 font-bold">{g.consumo} L</td>
                          <td className="px-4 py-3 text-right text-zinc-700">{g.horas ? `${g.horas} h` : "-"}</td>
                          <td className="px-4 py-3 text-zinc-900 font-semibold">{g.op || "-"}</td>
                          <td className="px-4 py-3 text-zinc-650 max-w-xs font-sans">
                            <div className="flex flex-col gap-0.5">
                              {g.depositoLleno && (
                                <span className="text-emerald-700 font-bold uppercase text-[9px] font-mono leading-none">
                                  🟢 Depósito Lleno
                                </span>
                              )}
                              {g.depositoTerminado && (
                                <span className="text-red-700 font-bold uppercase text-[9px] font-mono leading-none">
                                  🔴 Depósito Fin
                                </span>
                              )}
                              {g.obs && <span className="text-zinc-700 text-xs font-medium">{g.obs}</span>}
                              {!g.depositoLleno && !g.depositoTerminado && !g.obs && <span className="text-zinc-400">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button onClick={() => openEditRecord("gas", g)} className="text-xs text-blue-650 hover:text-zinc-900 font-bold uppercase tracking-wider">
                                Edit
                              </button>
                              <button onClick={() => handleDeleteRecord("gas", g.id)} className="text-red-650 hover:text-red-800">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={11} className="text-center py-8 text-zinc-400 uppercase tracking-widest font-semibold">
                          Sin resguardos de combustible guardados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* View: Material Pedidos Requests list */}
          {activeTab === "pedidos" && (() => {
            const pendingOrders = dbState.ped.filter(p => p.est !== "Recibido" && p.est !== "Cancelado");
            const pendingCount = pendingOrders.length;
            const oldestOrder = pendingOrders.reduce((oldest, current) => {
              if (!oldest) return current;
              if (!current.fecha) return oldest;
              return new Date(current.fecha) < new Date(oldest.fecha) ? current : oldest;
            }, null as Pedido | null);

            const getPendingDaysHelper = (fechaStr: string) => {
              if (!fechaStr) return 0;
              const orderDate = new Date(fechaStr + "T00:00:00");
              const today = new Date();
              orderDate.setHours(0, 0, 0, 0);
              today.setHours(0, 0, 0, 0);
              const diffTime = today.getTime() - orderDate.getTime();
              return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            };

            const oldestDays = oldestOrder ? getPendingDaysHelper(oldestOrder.fecha) : 0;

            const avgDays = pendingCount > 0 
              ? Math.round(pendingOrders.reduce((sum, p) => sum + getPendingDaysHelper(p.fecha), 0) / pendingCount)
              : 0;

            const getEstadoStyles = (est: string) => {
              switch (est) {
                case "Recibido":
                  return "bg-emerald-600 border border-emerald-400 text-white text-xs font-black uppercase tracking-widest py-3 px-4 text-center rounded block shadow-lg shadow-emerald-950/20";
                case "Cancelado":
                  return "bg-zinc-800 border border-zinc-650 text-zinc-400 text-xs font-bold uppercase tracking-widest py-3 px-4 text-center rounded block";
                case "En camino":
                  return "bg-[#1E3A8A] border border-[#3B82F6] text-[#60A5FA] text-xs font-black uppercase tracking-widest py-3 px-4 text-center rounded block animate-pulse";
                case "Solicitado":
                  return "bg-[#78350F] border border-[#F59E0B] text-[#FBBF24] text-xs font-black uppercase tracking-widest py-3 px-4 text-center rounded block";
                default: // "Pendiente"
                  return "bg-[#581C87] border border-[#A855F7] text-[#E9D5FF] text-xs font-black uppercase tracking-widest py-3 px-4 text-center rounded block";
              }
            };

            return (
              <div id="view-tab-pedidos" className="space-y-6 w-full max-w-7xl mx-auto z-10">
                <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-mega text-purple-400">
                      Material Procurement logistics
                    </span>
                    <h1 className="text-4xl md:text-5xl font-black italic uppercase -skew-x-6">
                      Pedidos y Solicitudes
                    </h1>
                  </div>
                  <button
                    onClick={() => openNewRecord("pedido")}
                    className="bg-purple-600 hover:bg-white text-white hover:text-black font-bold uppercase text-[11px] tracking-widest px-6 py-3 shrink-0 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    SOLICITAR MATERIAL
                  </button>
                </div>

                {/* Tab selector */}
                <div className="flex bg-[#0c0d10] border border-white/10 p-1 rounded max-w-sm font-mono text-[11px] tracking-wider uppercase font-bold text-center">
                  <button
                    onClick={() => setPedidosSubTab("registros")}
                    className={`flex-1 py-1.5 px-3 transition rounded ${
                      pedidosSubTab === "registros" ? "bg-purple-600 text-white" : "text-white/40 hover:text-white"
                    }`}
                  >
                    📋 Registros
                  </button>
                  <button
                    onClick={() => setPedidosSubTab("mensual")}
                    className={`flex-1 py-1.5 px-3 transition rounded ${
                      pedidosSubTab === "mensual" ? "bg-purple-600 text-white" : "text-white/40 hover:text-white"
                    }`}
                  >
                    📅 Mensual
                  </button>
                  <button
                    onClick={() => setPedidosSubTab("anual")}
                    className={`flex-1 py-1.5 px-3 transition rounded ${
                      pedidosSubTab === "anual" ? "bg-purple-600 text-white" : "text-white/40 hover:text-white"
                    }`}
                  >
                    🏆 Anual
                  </button>
                </div>

                {pedidosSubTab === "registros" && (
                  <div className="space-y-6">
                    {/* Dashboard Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                      <div className="border border-white/10 bg-black/40 p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-500" />
                        <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider pl-2">Pedidos en Curso</div>
                        <div className="text-2xl font-black mt-1 text-white pl-2">
                          {pendingCount} <span className="text-[10px] font-normal opacity-50">solicitudes</span>
                        </div>
                      </div>
                      <div className="border border-white/10 bg-black/40 p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-500" />
                        <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider pl-2">Espera Promedio</div>
                        <div className="text-2xl font-black mt-1 text-white pl-2">
                          {avgDays} <span className="text-[10px] font-normal opacity-50">días en total</span>
                        </div>
                      </div>
                      <div className="border border-white/10 bg-black/40 p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500" />
                        <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider pl-2">Pedido más Antiguo</div>
                        <div className="text-2xl font-black mt-1 text-white pl-2">
                          {oldestDays} <span className="text-[10px] font-normal opacity-50">días ({oldestOrder ? formatDateDMY(oldestOrder.fecha) : "-"})</span>
                        </div>
                      </div>
                    </div>

                    {renderSearchFilterBar(true)}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredPedidos.length > 0 ? (
                        filteredPedidos.map((p) => {
                          const days = getPendingDaysHelper(p.fecha);
                          return (
                            <div key={p.id} className="border border-white/10 bg-black/40 p-5 flex flex-col justify-between relative overflow-hidden">
                              {/* Priority strip */}
                              <div className={`absolute top-0 left-0 right-0 h-1 ${p.prio === "Alta" ? "bg-red-500" : p.prio === "Media" ? "bg-amber-500" : "bg-white/10"}`} />

                              <div className="space-y-4">
                                <div className="flex justify-between items-start pt-1 font-mono text-sm">
                                  <span className="text-[#FFF] font-bold text-sm tracking-wide uppercase text-purple-400">{p.tipo}</span>
                                  <span className={`font-semibold text-xs ${p.prio === "Alta" ? "text-red-400 animate-pulse font-extrabold" : "text-white/40 font-bold"}`}>{p.prio} PRIORIDAD</span>
                                </div>

                                <div className="space-y-2">
                                  <h4 className="text-lg md:text-xl font-black text-white leading-snug">{p.desc}</h4>
                                  <p className="font-mono text-sm font-semibold text-zinc-300 mt-2">
                                    Cant: <strong className="text-white text-base">{p.cant}</strong> {p.unidad} // Destino: <strong className="text-purple-300">{MAQUINAS[p.maq]?.c || p.maq}</strong>
                                  </p>
                                  <p className="text-xs text-zinc-400 mt-1 uppercase font-mono tracking-wider font-semibold">Motivo: {p.motivo}</p>
                                  {p.obs && (
                                    <p className="text-xs text-amber-300/80 bg-stone-900/60 p-2 border border-stone-800 rounded font-mono">
                                      Obs: {p.obs}
                                    </p>
                                  )}
                                </div>

                                <div className={getEstadoStyles(p.est)}>
                                  ESTADO: {p.est}
                                </div>

                                <div className="flex justify-between items-center text-xs font-mono opacity-90 pt-1.5 border-t border-white/5">
                                  <span>F. Solicitud: <span className="text-white font-bold">{formatDateDMY(p.fecha)}</span></span>
                                  {p.est !== "Recibido" && p.est !== "Cancelado" ? (
                                    days === 0 ? (
                                      <span className="text-emerald-400 font-extrabold animate-bounce">¡Hoy!</span>
                                    ) : (
                                      <span className={days > 7 ? "text-red-400 font-black animate-pulse" : days > 3 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                                        {days} {days === 1 ? "día" : "días"} de espera
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-emerald-400 font-extrabold uppercase tracking-widest bg-emerald-950/40 px-2 py-0.5 border border-emerald-500/20 rounded">Finalizado</span>
                                  )}
                                </div>
                              </div>

                              <div className="border-t border-white/5 pt-4 mt-6 flex justify-between items-center text-xs font-mono">
                                <div className="space-y-0.5">
                                  <div>Solicitante: <span className="font-bold text-white">{p.sol || "-"}</span></div>
                                  <div>Comprador: <span className="font-bold text-white">{p.comprador || "-"}</span></div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => openEditRecord("pedido", p)} className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white px-2.5 py-1.5 text-blue-400 font-bold uppercase rounded flex items-center gap-1">
                                    <Edit3 className="w-3.5 h-3.5" /> Editar
                                  </button>
                                  <button onClick={() => handleDeleteRecord("pedido", p.id)} className="bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-550 hover:text-white p-1.5 rounded transition">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full border border-dashed border-white/10 text-center py-12 text-white/20 uppercase tracking-widest text-xs">
                          No hay solicitudes de pedidos listadas
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {pedidosSubTab === "mensual" && (
                  <div className="border border-white/10 bg-black/40 overflow-hidden">
                    <div className="p-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-xs uppercase font-mono tracking-widest font-black text-purple-400">
                        Historial Acumulado Mensual - Pedidos
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse font-mono text-sm">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.02] text-white/50 text-xs">
                            <th className="px-4 py-3 uppercase font-black">Mes / Año</th>
                            <th className="px-4 py-3 text-right uppercase font-black">Total Creados</th>
                            <th className="px-4 py-3 text-right uppercase font-black text-amber-400">Pendientes</th>
                            <th className="px-4 py-3 text-right uppercase font-black text-emerald-400">Recibidos</th>
                            <th className="px-4 py-3 text-right uppercase font-black text-rose-500">P. Alta</th>
                            <th className="px-4 py-3 uppercase font-black">Categorías / Materiales</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs sm:text-sm">
                          {monthlyPedidosHistory.length > 0 ? (
                            monthlyPedidosHistory.map((m) => (
                              <tr key={m.mesKey} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 font-bold text-white uppercase text-base">{m.nombreMes} {m.año}</td>
                                <td className="px-4 py-3 text-right font-semibold text-white text-base">{m.totalPedidos}</td>
                                <td className="px-4 py-3 text-right font-bold text-amber-400 text-base">{m.pendientes}</td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-400 text-base">{m.recibidos}</td>
                                <td className="px-4 py-3 text-right font-bold text-rose-500 text-base">{m.altaPrioridad}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(m.tiposCount).map(([t, val]) => (
                                      <span key={t} className="bg-purple-900/40 text-purple-200 border border-purple-500/20 px-2 py-0.5 rounded text-[11px] tracking-wide uppercase font-black">
                                        {t}: {val}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="text-center py-12 text-white/20 uppercase tracking-widest text-xs">
                                No hay datos históricos mensuales disponibles
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {pedidosSubTab === "anual" && (
                  <div className="border border-white/10 bg-black/40 overflow-hidden">
                    <div className="p-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-xs uppercase font-mono tracking-widest font-black text-purple-400">
                        Historial Acumulado Anual - Pedidos
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse font-mono text-sm">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.02] text-white/50 text-xs">
                            <th className="px-4 py-3 uppercase font-black">Año</th>
                            <th className="px-4 py-3 uppercase font-black text-center">Meses Activos</th>
                            <th className="px-4 py-3 text-right uppercase font-black">Total Creados</th>
                            <th className="px-4 py-3 text-right uppercase font-black text-amber-400">Pendientes</th>
                            <th className="px-4 py-3 text-right uppercase font-black text-emerald-400">Recibidos</th>
                            <th className="px-4 py-3 text-right uppercase font-black text-rose-500 font-bold">P. Alta</th>
                            <th className="px-4 py-3 uppercase font-black">Categorías</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs sm:text-sm">
                          {annualPedidosHistory.length > 0 ? (
                            annualPedidosHistory.map((a) => (
                              <tr key={a.año} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 font-bold text-white text-lg">{a.año}</td>
                                <td className="px-4 py-3 text-center text-white/70">{a.mesesActivos.size} meses</td>
                                <td className="px-4 py-3 text-right font-semibold text-white text-base">{a.totalPedidos}</td>
                                <td className="px-4 py-3 text-right font-bold text-amber-400 text-base">{a.pendientes}</td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-400 text-base">{a.recibidos}</td>
                                <td className="px-4 py-3 text-right font-bold text-rose-500 text-base">{a.altaPrioridad}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(a.tiposCount).map(([t, val]) => (
                                      <span key={t} className="bg-purple-900/40 text-purple-200 border border-purple-500/20 px-2 py-0.5 rounded text-[11px] tracking-wide uppercase font-black">
                                        {t}: {val}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="text-center py-12 text-white/20 uppercase tracking-widest text-xs">
                                No hay datos históricos anuales disponibles
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* View: App system configuration */}
          {activeTab === "config" && (
            <div id="view-tab-config" className="space-y-8 w-full max-w-2xl mx-auto z-10">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-bold uppercase tracking-mega text-orange-500">
                  System Administrative Settings
                </span>
                <h1 className="text-4xl md:text-5xl font-black italic uppercase -skew-x-6">
                  Configuración del Sistema
                </h1>
              </div>

              {/* CSV exports controls card */}
              <div className="border border-white/10 p-6 bg-white/5 space-y-4">
                <h3 className="text-xs uppercase font-black tracking-widest text-orange-500 flex items-center gap-2">
                  <Download className="w-4 h-4" /> EXPORTAR BASES DE DATOS CSV
                </h3>
                <p className="text-xs text-white/60 uppercase tracking-wide">
                  Descarga los registros locales compilados en formato CSV directo excel.
                </p>
                <div className="grid grid-cols-2 gap-3 [&>button]:py-3 [&>button]:border [&>button]:border-white/10 [&>button]:text-center [&>button]:text-[10px] [&>button]:uppercase [&>button]:tracking-wider [&>button]:font-bold hover:[&>button]:border-orange-500 hover:[&>button]:bg-white/5 transition-colors">
                  <button onClick={() => downloadCSV("production")}>
                    📥 Descargar Turnos Palets
                  </button>
                  <button onClick={() => downloadCSV("ots")}>
                    📥 Descargar Historial OTs
                  </button>
                  <button onClick={() => downloadCSV("paradas")}>
                    📥 Descargar Historial Paradas
                  </button>
                  <button onClick={() => downloadCSV("combustible")}>
                    📥 Descargar Combustibles Gasoil
                  </button>
                </div>
              </div>

              {/* Password credentials setting */}
              <div className="border border-white/10 p-6 bg-white/5 space-y-6">
                <h3 className="text-xs uppercase font-black tracking-widest text-orange-500">
                  🔐 SEGURIDAD: ACTUALIZAR PIN ACCESO DE EDICIÓN
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-2">
                      Código Pin de Operaciones (Actual en Base: {dbState.cfg?.pwd || "1972"})
                    </label>
                    <input
                      type="text"
                      className="w-full bg-[#121315] border border-white/10 p-3 text-xs font-mono font-bold tracking-widest focus:border-orange-500 outline-none max-w-xs text-orange-500 text-center"
                      placeholder="Nuevo PIN numérico"
                      maxLength={8}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && /^\d+$/.test(val)) {
                          requireUnlock(() => {
                            const updatedCfg = { ...dbState.cfg, pwd: val };
                            updateDB({ ...dbState, cfg: updatedCfg });
                          });
                        }
                      }}
                    />
                  </div>
                  <p className="text-[10px] font-mono opacity-40 uppercase">
                    * El PIN de validación protege las mutaciones accidentales del stock y registros mecánicos.
                  </p>
                </div>
              </div>

              {/* Dangerous destructive clean buttons */}
              <div className="border border-red-500/10 p-6 bg-red-500/5 space-y-4">
                <h3 className="text-xs uppercase font-black tracking-widest text-red-500 flex items-center gap-2">
                  ⚠️ ACCIONES DE DESTRUCCIÓN DE MEMORIA
                </h3>
                <p className="text-xs text-white/60 uppercase">
                  Purgar toda la memoria para reinicio total de temporada industrial.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (!window.confirm("¿Seguro que quieres borrar todos los datos locales y remotos? Esta acción NO SE PUEDE DESHACER.")) return;
                      requireUnlock(() => {
                        updateDB(INITIAL_DB_STATE);
                        alert("Bases de datos vaciadas.");
                      });
                    }}
                    className="px-4 py-2.5 bg-red-950/40 border border-red-500/30 text-red-500 font-bold uppercase text-[9px] tracking-widest hover:bg-red-500 hover:text-black transition"
                  >
                    🗑️ BORRAR BASE DE DATOS TOTAL (FIREBASE)
                  </button>
                </div>
              </div>

              {/* Brand Certification Stamp */}
              <div className="flex flex-col items-center justify-center p-6 border border-white/10 bg-white/5 rounded-none space-y-4">
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <CompanyShield size={90} />
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-mono tracking-wider text-slate-500 uppercase">
                    Software de Control de Planta
                  </p>
                  <p className="text-xs font-bold uppercase text-red-500 font-display mt-0.5">
                    CANTERA CA'S VILAFRANQUER // DESDE 1972
                  </p>
                  <p className="text-[9px] font-mono text-slate-400 uppercase mt-1">
                    Terminal de Registro Autorizado // Licencia Activa
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Plus Action Button Trigger Drawer panel */}
      <button
        id="quick-action-fab"
        onClick={() => setQuickActionOpen(!quickActionOpen)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-orange-500 text-black hover:bg-white flex items-center justify-center border border-transparent hover:border-black/10 shadow-2xl z-30 transition-transform active:scale-95"
      >
        <Plus className={`w-7 h-7 transition-transform ${quickActionOpen ? "rotate-45" : ""}`} />
      </button>

      {/* Quick Action Overlay Drawer Menu */}
      {quickActionOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-20 flex items-end justify-center p-4">
          <div className="bg-white border border-gray-200 w-full max-w-md p-6 pointer-events-auto space-y-4 animate-in slide-in-from-bottom duration-200 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h3 className="text-xs uppercase font-black tracking-widest text-[#C0392B]">
                Acciones Rápidas Operarios
              </h3>
              <button onClick={() => setQuickActionOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors">
                <X className="w-5 h-5 pointer-events-none" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold tracking-wider [&>button]:p-3.5 [&>button]:rounded-xl [&>button]:border [&>button]:border-gray-200 [&>button]:bg-gray-50 [&>button]:text-gray-800 [&>button]:text-left hover:[&>button]:border-[#C0392B] hover:[&>button]:bg-red-50/50 hover:[&>button]:text-[#C0392B] transition-all duration-150">
              <button onClick={() => openNewRecord("prod")}>📝 Turno Palets</button>
              <button onClick={() => openNewRecord("sacas")}>🪵 Turno Sacas</button>
              <button onClick={() => openNewRecord("emb")}>📦 Consumo Embalaje</button>
              <button onClick={() => openNewRecord("parada")}>🚨 Registrar Parada</button>
              <button onClick={() => openNewRecord("ot")}>🛠️ Crear Nueva OT</button>
              <button onClick={() => openNewRecord("pedido")}>🛒 Pedido Material</button>
              <button onClick={() => openNewRecord("pm")}>🗓️ Nuevo Preventivo</button>
              <button onClick={() => openNewRecord("gas")}>⛽ Repostar Gasoil</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Global Navigation Bar */}
      <footer className="h-16 border-t border-white/10 flex items-center justify-between px-2 md:px-12 bg-black shrink-0 z-10 select-none overflow-x-auto overflow-y-hidden gap-6 scrollbar-none font-display text-xs uppercase font-bold tracking-widest">
        <nav className="flex gap-1 md:gap-3 lg:gap-6 shrink-0 h-full items-center">
          {(
            [
              { k: "inicio", n: "Inicio" },
              { k: "prod_palets", n: "Prod. Sacos" },
              { k: "prod_sacas", n: "Prod. Sacas" },
              { k: "rep_palets", n: "Rep. Palets" },
              { k: "stock", n: "Stock Esplanada" },
              { k: "salidas", n: "Salidas Albarán" },
              { k: "mant", n: "Log. Mantenimiento" },
              { k: "gas", n: "Combustible Gas" },
              { k: "pedidos", n: "Material Pedidos" },
              { k: "config", n: "Config" }
            ] as const
          ).map((item) => (
            <button
              key={item.k}
              onClick={() => {
                setActiveTab(item.k);
                setSearchTerm("");
              }}
              className={`h-full px-2.5 md:px-4 border-b-2 text-xs md:text-[13px] lg:text-sm tracking-wider transition-all duration-150 inline-flex items-center ${
                activeTab === item.k
                  ? "border-orange-500 text-orange-500 bg-white/5"
                  : "border-transparent text-white/55 hover:text-white"
              }`}
            >
              {item.n}
            </button>
          ))}
        </nav>

        <div className="text-[10px] uppercase tracking-wider text-white/30 hidden lg:block font-mono">
          © 2026 CANTERA CA'S VILAFRANQUER SYSTEMS S.A.
        </div>
      </footer>

      {/* PIN Authentication dial padlock */}
      <Numpad
        isOpen={modalOpen.numpad}
        onClose={() => {
          setModalOpen((prev) => ({ ...prev, numpad: false }));
          setPendingAction(null);
        }}
        onVerify={handleVerifyPIN}
        correctPin={dbState.cfg?.pwd || "1972"}
      />

      {/* Active Record edit Modals bindings */}
      <ProdModal
        isOpen={modalOpen.prod}
        onClose={() => setModalOpen((prev) => ({ ...prev, prod: false }))}
        onSave={(data) => handleSaveRecord("prod", data)}
        initialData={activeEditRecord.data}
      />

      <SacasModal
        isOpen={modalOpen.sacas}
        onClose={() => setModalOpen((prev) => ({ ...prev, sacas: false }))}
        onSave={(data) => handleSaveRecord("sacas", data)}
        initialData={activeEditRecord.data}
      />

      <EmbModal
        isOpen={modalOpen.emb}
        onClose={() => setModalOpen((prev) => ({ ...prev, emb: false }))}
        onSave={(data) => handleSaveRecord("emb", data)}
        initialData={activeEditRecord.data}
      />

      <OTModal
        isOpen={modalOpen.ot}
        onClose={() => setModalOpen((prev) => ({ ...prev, ot: false }))}
        onSave={(data) => handleSaveRecord("ot", data)}
        initialData={activeEditRecord.data}
      />

      <ParadaModal
        isOpen={modalOpen.parada}
        onClose={() => setModalOpen((prev) => ({ ...prev, parada: false }))}
        onSave={(data) => handleSaveRecord("parada", data)}
        initialData={activeEditRecord.data}
      />

      <RepuestoModal
        isOpen={modalOpen.repuesto}
        onClose={() => setModalOpen((prev) => ({ ...prev, repuesto: false }))}
        onSave={(data) => handleSaveRecord("repuesto", data)}
        initialData={activeEditRecord.data}
      />

      <PedidoModal
        isOpen={modalOpen.pedido}
        onClose={() => setModalOpen((prev) => ({ ...prev, pedido: false }))}
        onSave={(data) => handleSaveRecord("pedido", data)}
        initialData={activeEditRecord.data}
      />

      <PMModal
        isOpen={modalOpen.pm}
        onClose={() => setModalOpen((prev) => ({ ...prev, pm: false }))}
        onSave={(data) => handleSaveRecord("pm", data)}
        initialData={activeEditRecord.data}
      />

      <GasModal
        isOpen={modalOpen.gas}
        onClose={() => setModalOpen((prev) => ({ ...prev, gas: false }))}
        onSave={(data) => handleSaveRecord("gas", data)}
        initialData={activeEditRecord.data}
      />

      <StockModal
        isOpen={modalOpen.stock}
        onClose={() => setModalOpen((prev) => ({ ...prev, stock: false }))}
        onSave={handleSaveStock}
        stockData={dbState.stock}
      />

      <EditSalidaStockModal
        isOpen={editingSalidaStock !== null}
        onClose={() => setEditingSalidaStock(null)}
        onSave={handleSaveEditedSalidaStock}
        record={editingSalidaStock}
      />
    </div>
  );

  // Helper renderers
  function renderSearchFilterBar(showMaqFilter: boolean) {
    return (
      <div className="flex flex-col sm:flex-row gap-2 bg-[#0c0d10] border border-white/10 p-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-2.5" />
          <input
            type="text"
            className="w-full bg-black/60 border border-white/10 p-2 pl-9 text-xs text-white outline-none focus:border-orange-500 font-mono"
            placeholder="Buscar por operario, descripción o referencia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {showMaqFilter && (
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 font-mono text-xs">
            <span className="opacity-45 uppercase text-[10px]">Maq:</span>
            <select
              className="bg-black/60 border border-white/10 p-2 text-xs outline-none focus:border-orange-500 text-white"
              value={filterMaq}
              onChange={(e) => setFilterMaq(e.target.value)}
            >
              <option value="all">Todas</option>
              {Object.entries(MAQUINAS).map(([k, val]) => (
                <option key={k} value={k}>
                  {val.c}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Clear filters trigger */}
        {(searchTerm || filterMaq !== "all") && (
          <button
            onClick={() => {
              setSearchTerm("");
              setFilterMaq("all");
            }}
            className="text-[10px] uppercase font-bold text-red-400 hover:text-white shrink-0 px-2"
          >
            Clear X
          </button>
        )}
      </div>
    );
  }
}
