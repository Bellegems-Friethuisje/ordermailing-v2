// Receipt printing via the OS print sheet (AirPrint on iOS), not a direct
// connection to the printer.
//
// The app is served over HTTPS and the thermal printer only speaks plain HTTP /
// raw TCP on the shop LAN. A browser refuses to mix the two, and Safari - which
// is what the shop iPad runs - exposes no per-site exception for it, so no
// amount of client code can open that connection. iOS's own print pipeline has
// no such restriction: it reaches the printer over IPP itself. So we render the
// receipt as HTML and hand it to window.print().
//
// The receipt lives in a hidden element parked directly under <body>, and the
// print stylesheet hides every other top-level element. Printing an <iframe>
// would be the tidier trick, but iOS Safari does not reliably print iframe
// content.

export type ReceiptNode =
  | { type: "title"; text: string }
  | { type: "line"; text: string; bold?: boolean; align?: "left" | "center" }
  | { type: "row"; left: string; right: string; bold?: boolean }
  | { type: "rule" }
  | { type: "spacer" };

// Printable width of an 80 mm roll. The paper is 80 mm; the head covers 72 mm.
const DEFAULT_WIDTH_MM = 72;

const ROOT_ID = "receipt-print-root";
const STYLE_ID = "receipt-print-style";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNode(node: ReceiptNode): string {
  switch (node.type) {
    case "title":
      return `<div class="rp-title">${escapeHtml(node.text)}</div>`;
    case "line": {
      const cls = ["rp-line", node.bold ? "rp-b" : "", node.align === "center" ? "rp-ct" : ""]
        .filter(Boolean)
        .join(" ");
      return `<div class="${cls}">${escapeHtml(node.text)}</div>`;
    }
    case "row":
      return (
        `<div class="rp-row${node.bold ? " rp-b" : ""}">` +
        `<span>${escapeHtml(node.left)}</span>` +
        `<span>${escapeHtml(node.right)}</span>` +
        `</div>`
      );
    case "rule":
      return `<div class="rp-rule"></div>`;
    case "spacer":
      return `<div class="rp-spacer"></div>`;
  }
}

function styleSheet(widthMm: number): string {
  return `
@page { size: ${widthMm}mm auto; margin: 0; }

#${ROOT_ID} {
  display: none;
  width: ${widthMm}mm;
  box-sizing: border-box;
  padding: 3mm 2mm 10mm;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9pt;
  line-height: 1.35;
  color: #000;
  background: #fff;
}

#${ROOT_ID} .rp-title { font-size: 15pt; font-weight: 700; text-align: center; letter-spacing: 0.5px; }
#${ROOT_ID} .rp-line { white-space: pre-wrap; overflow-wrap: anywhere; }
#${ROOT_ID} .rp-ct { text-align: center; }
#${ROOT_ID} .rp-b { font-weight: 700; }
#${ROOT_ID} .rp-rule { border-top: 1px solid #000; margin: 1.5mm 0; }
#${ROOT_ID} .rp-spacer { height: 4mm; }
#${ROOT_ID} .rp-row { display: flex; justify-content: space-between; gap: 3mm; }
#${ROOT_ID} .rp-row > span:first-child { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
#${ROOT_ID} .rp-row > span:last-child { flex: 0 0 auto; text-align: right; font-variant-numeric: tabular-nums; }

@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    height: auto !important;
    overflow: visible !important;
  }
  /* Hide the app (and any teleported dialogs) - print the receipt alone. */
  body > * { display: none !important; }
  body > #${ROOT_ID} { display: block !important; }
}
`;
}

// The root is created once and reused. Tearing it down after printing would
// race the print sheet: iOS Safari does not guarantee an `afterprint` event, and
// removing the element on a timer while the sheet is still open prints a blank
// page. Kept in the DOM it costs nothing - it is `display: none` on screen.
function ensureRoot(widthMm: number): HTMLElement {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  const css = styleSheet(widthMm);
  if (style.textContent !== css) style.textContent = css;

  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("aria-hidden", "true");
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Renders the nodes as an 80 mm receipt and opens the system print sheet.
 *
 * Resolves once printing has been dismissed, or after a short grace period on
 * browsers that never report it - the result only drives the caller's spinner,
 * so resolving early is harmless. It cannot report whether the user actually
 * printed: no browser exposes that.
 */
export function printReceipt(
  nodes: ReceiptNode[],
  options: { widthMm?: number } = {},
): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }

  const root = ensureRoot(options.widthMm ?? DEFAULT_WIDTH_MM);
  root.innerHTML = nodes.map(renderNode).join("");

  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("afterprint", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 3000);
    window.addEventListener("afterprint", done);

    // Let the browser lay the receipt out before it snapshots the page.
    requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        done();
      }
    });
  });
}
