/**
 * Formats product names by removing the leading numeric code and hyphen.
 * Example: "0518 - LLENAR SACA TIERRA" -> "LLENAR SACA TIERRA"
 *          "0301 - SACO DE GRAVA N.0 Y 2 (CORTE)" -> "SACO DE GRAVA N.0 Y 2 (CORTE)"
 */
export function formatStockProductName(name: string): string {
  if (!name) return "";
  let formatted = name.replace(/^\d+\s*[-–—]\s*/, "").trim();
  // Remove "LLENAR " from the beginning
  formatted = formatted.replace(/^LLENAR\s+/i, "");
  return formatted.trim();
}

/**
 * High-fidelity print tool that isolates and prints a target element.
 * Creates a silent/invisible iframe to avoid viewport styling overrides, 
 * popups being blocked, or clipping contents by container scroll limits.
 */
export function printElement(elId: string) {
  const element = document.getElementById(elId);
  if (!element) return;

  // Create an isolated iframe for printing
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.zIndex = "-1000";
  
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc) {
    // Basic fallback print if iframe write is restricted
    window.print();
    return;
  }

  iframeDoc.open();
  iframeDoc.write("<html><head><title>Comprobante de Salida</title>");

  // Carry over styles and CSS links to retain typography/colors
  const headElements = Array.from(document.head.children);
  headElements.forEach((el) => {
    if (el.tagName === "STYLE" || el.tagName === "LINK") {
      iframeDoc.write(el.outerHTML);
    }
  });

  // Inject additional custom style overrides for optimal receipt printing
  iframeDoc.write(`
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
      body {
        background-color: white !important;
        color: #18181b !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
        margin: 0 !important;
        padding: 40px !important;
      }
      /* Printer performance configurations */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    </style>
  `);

  iframeDoc.write("</head><body>");
  // Wrapper container
  iframeDoc.write(`<div class="w-full">${element.innerHTML}</div>`);
  iframeDoc.write("</body></html>");
  iframeDoc.close();

  // Allow styles to load, then trigger the printing
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    
    // Safely remove the element once printing starts/completes
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1500);
  }, 350);
}

