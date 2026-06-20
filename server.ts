import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { CLIENTES } from "./src/clients";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size limit to accept base64 image data
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Shared lazy-loaded Gemini client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiInstance) {
    const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("La clave GEMINI_API_KEY no está configurada o es inválida. Por favor, añádela en la pestaña de Configuración o Settings > Secrets del panel de la derecha de AI Studio.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// 1. API route: analyze albarán using Gemini AI Vision OCR
app.post("/api/analyze-albaran", async (req, res) => {
  try {
    const { imageB64, imageMime, selectedModel } = req.body;
    if (!imageB64) {
      return res.status(400).json({ success: false, error: "Falta la imagen codificada en Base64." });
    }

    const ai = getGeminiClient();
    
    // Prepare standard products description for matching
    const prompt = `Analiza la imagen de este albarán de venta, factura o nota de entrega, y extrae la información requerida (nombre del cliente, número de albarán, productos y cantidades vendidas).
Importante para el campo "cliente": Te suministramos a continuación el listado oficial completo de todos nuestros clientes y sus códigos. Debes identificar el nombre o código del cliente en la imagen del albarán y seleccionar la mejor correspondencia de este listado oficial. Como valor final del campo "cliente", pon EXACTAMENTE la cadena en formato "CÓDIGO - NOMBRE_CLIENTE" del cliente coincidente de nuestra lista (por ejemplo, si identificas a "CANTERA CAS VILAFRANQUER S.L.", pon exactamente "557 - CANTERA CAS VILAFRANQUER S.L."). Si no encuentras ninguna coincidencia clara en el listado, pon el nombre literal que aparezca en el albarán.

Listado Oficial de Clientes:
${JSON.stringify(CLIENTES.map(c => `${c.code} - ${c.name}`))}

Importante para los productos: Nuestra base de datos tiene nombres de productos predefinidos con códigos numéricos que los preceden. Debes leer el texto del albarán para buscar códigos de producto (números como 0301, 0535, 5130, etc.) o nombres de material que coincidan.
Sabiendo que si el código detectado en el albarán es, por ejemplo, "0301", este corresponde exactamente al género "0301 - SACO DE GRAVA N.0 Y 2 (CORTE)". Conserva esta lógica para todos los códigos numéricos detectados para realizar un emparejamiento perfecto y robusto entre el texto detectado/códigos leídos en el albarán y nuestra lista estandarizada.

Nuestros productos estandarizados por categorías son:

Categoría 1: "paletGen" (Palets en Esplanada General / Tipo Sacos):
${JSON.stringify([
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
])}

Categoría 2: "paletGenChibetli" (Palets Son Chibetli):
${JSON.stringify(["PICADIS 0", "GRAVA 0 DE CORTE", "GRAVA 1", "GRAVA 2", "GRAVA 0 Y 2 CORTE", "GRAVA 0 Y PICADIS", "ARENA"])}

Categoría 3: "sacasGen" (Stock de Sacas - Big Bags):
${JSON.stringify([
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
  "0516 - LLENAR SACA GRAVILLA N.1",
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
])}

Categoría 4: "bigBagsVacias" (Sacas vacías - Big Bags):
${JSON.stringify(["75X75X80", "80X80X80", "80X80X90", "80X80X90 C/TUBO"])}

Por cada línea de producto identificada en el albarán:
- Extrae el nombre literal ("rawName").
- Intenta encontrar la mejor coincidencia de producto basada tanto en el código de producto numérico (p. ej., "0301", "0535", etc.) como en el nombre del material de las listas de arriba. Si detectas un código de material en el albarán, búscalo primero en los prefijos de las listas estandarizadas (p. ej., el código "0301" coincide perfectamente con "0301 - SACO DE GRAVA N.0 Y 2 (CORTE)").
- Si coincide correctamente con alguno de los productos de las listas de arriba, pon el nombre estandarizado exacto que pasamos en "matchedProduct" (con su prefijo numérico y texto, P. ej., "0301 - SACO DE GRAVA N.0 Y 2 (CORTE)") y pon la categoría correcta en "category". No inventes nombres alternativos.
- Si no encuentras ninguna coincidencia clara de código o nombre, pon "" en "matchedProduct" y "desconocido" en "category".
- Extrae la cantidad numérica vendida ("quantity").
`;

    const mimeType = imageMime || "image/jpeg";
    const base64Data = imageB64.replace(/^data:image\/\w+;base64,/, "");

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    };

    const textPart = {
      text: prompt
    };

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        cliente: {
          type: Type.STRING,
          description: "Nombre del cliente, empresa o destino en el albarán. Si no se indica, pon 'S/N'."
        },
        numAlbaran: {
          type: Type.STRING,
          description: "Código, número identificador o código de barra o número de albarán. Si no se encuentra, poner 'S/N'."
        },
        lineas: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              rawName: {
                type: Type.STRING,
                description: "Nombre del producto literal escrito en el albarán."
              },
              matchedProduct: {
                type: Type.STRING,
                description: "El nombre estandarizado que coincide de nuestra lista, o cadena vacía si no hay coincidencia."
              },
              category: {
                type: Type.STRING,
                description: "Escribe estrictamente una de estas categorías: 'paletGen', 'paletGenChibetli', 'sacasGen', 'bigBagsVacias', o 'desconocido'.",
                enum: ["paletGen", "paletGenChibetli", "sacasGen", "bigBagsVacias", "desconocido"]
              },
              quantity: {
                type: Type.NUMBER,
                description: "Cantidad vendida especificada para el producto en el albarán."
              }
            },
            required: ["rawName", "matchedProduct", "category", "quantity"]
          }
        },
        isLeidoCorrectamente: {
          type: Type.BOOLEAN,
          description: "Indica si se ha podido leer y procesar la información esencial del albarán."
        },
        resumen: {
          type: Type.STRING,
          description: "Resumen humano amigable describiendo lo que se leyó en total."
        }
      },
      required: ["cliente", "numAlbaran", "lineas", "isLeidoCorrectamente", "resumen"]
    };

    let result;
    const modelToUse = selectedModel === "pro" ? "gemini-3.1-pro-preview" : "gemini-3.5-flash";

    try {
      // Execute the requested Gemini model
      result = await ai.models.generateContent({
        model: modelToUse,
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });
    } catch (apiError: any) {
      const isProModel = modelToUse === "gemini-3.1-pro-preview";
      const errMsg = apiError.message || apiError;
      console.warn(`Gemini analysis with ${modelToUse} returned an issue: ${errMsg}`);
      
      if (isProModel) {
        console.log("Automatically falling back to the standard free-tier Gemini 3.5 Flash model...");
        try {
          result = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: { parts: [imagePart, textPart] },
            config: {
              responseMimeType: "application/json",
              responseSchema: responseSchema,
            }
          });
        } catch (fallbackError: any) {
          console.error("Fallback to Gemini 3.5 Flash also failed:", fallbackError);
          throw fallbackError;
        }
      } else {
        throw apiError;
      }
    }

    const parsedData = JSON.parse(result.text || "{}");
    return res.json({ success: true, data: parsedData });

  } catch (error: any) {
    console.error("Error analyzing delivery note with Gemini:", error);
    let userMessage = error.message || "Error al conectar con la IA de reconocimiento.";
    
    // Check for common authentication or credential issues
    const isAuthError = 
      error.status === 401 || 
      (error.message && (
        error.message.includes("401") ||
        error.message.includes("UNAUTHENTICATED") || 
        error.message.includes("auth") || 
        error.message.includes("credentials") ||
        error.message.includes("API key") ||
        error.message.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")
      ));

    const isQuotaError = 
      error.status === 429 ||
      (error.message && (
        error.message.includes("429") ||
        error.message.includes("quota") ||
        error.message.includes("limit") ||
        error.message.includes("exhausted") ||
        error.message.includes("RESOURCE_EXHAUSTED") ||
        error.message.includes("rate limit")
      ));

    if (isAuthError) {
      userMessage = "La clave API de Gemini no está configurada o no tiene permisos. Por favor, ve a la pestaña de 'Settings > Secrets' (barra lateral derecha de AI Studio), crea un secreto llamado GEMINI_API_KEY e introduce tu clave de Google AI Studio (que empiece por 'AIzaSy').";
    } else if (isQuotaError) {
      userMessage = "Se ha superado el límite de cuota (Error 429) en el motor de IA gratuito de este espacio. Para solucionarlo e interactuar con tus documentos reales, puedes añadir tu propia clave de API en 'Settings > Secrets' como GEMINI_API_KEY; o bien, selecciona inmediatamente la opción de 'Datos Demo' (Simulado) para probar todo el flujo de stock al instante.";
    }

    return res.status(500).json({ success: false, error: userMessage });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
