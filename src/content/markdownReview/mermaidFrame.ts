import Panzoom, { type PanzoomObject } from "@panzoom/panzoom";
import mermaid from "mermaid";
import type { MermaidRenderRequest } from "./mermaidProtocol";

const host = document.getElementById("app");
if (!host) throw new Error("Mermaid frame is missing its app host.");

const style = document.createElement("style");
style.textContent = `
  :root { color-scheme: light dark; }
  html, body, #app { width: 100%; height: 100%; margin: 0; overflow: hidden; }
  body { background: transparent; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .rgm-mermaid-canvas { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; user-select: none; }
  .rgm-mermaid-graphic { display: block; width: 90%; height: auto; margin: 0 auto; }
  .rgm-mermaid-controls { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; z-index: 1; }
  .rgm-mermaid-controls button { width: 28px; height: 28px; border: 1px solid #d0d7de; border-radius: 6px; background: #fff; color: #24292f; font-size: 17px; line-height: 1; cursor: pointer; box-shadow: 0 1px 2px rgb(31 35 40 / 12%); }
  .rgm-mermaid-controls button:hover { background: #f6f8fa; }
  :root[data-rgm-theme="dark"] .rgm-mermaid-controls button { border-color: #3d444d; background: #21262d; color: #f0f6fc; }
  :root[data-rgm-theme="dark"] .rgm-mermaid-controls button:hover { background: #30363d; }
`;
document.head.appendChild(style);

const canvas = document.createElement("div");
canvas.className = "rgm-mermaid-canvas";
canvas.setAttribute("aria-live", "polite");
host.appendChild(canvas);

let panzoom: PanzoomObject | null = null;

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window.parent || !isRenderRequest(event.data)) return;
  void render(event.data);
});

window.parent.postMessage({ type: "rgm:mermaid:ready" }, "*");

function isRenderRequest(value: unknown): value is MermaidRenderRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<MermaidRenderRequest>;
  return (
    request.type === "rgm:mermaid:render" &&
    typeof request.requestId === "string" &&
    typeof request.source === "string" &&
    (request.theme === "light" || request.theme === "dark")
  );
}

async function render(request: MermaidRenderRequest): Promise<void> {
  panzoom?.destroy();
  canvas.replaceChildren();
  document.documentElement.dataset.rgmTheme = request.theme;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: request.theme === "dark" ? "dark" : "default",
  });

  try {
    const { svg } = await mermaid.render(`rgm-mermaid-${request.requestId}`, request.source);
    const fragment = document.createRange().createContextualFragment(svg);
    const graphic = fragment.querySelector("svg");
    if (!graphic) throw new Error("Mermaid did not return an SVG.");

    graphic.classList.add("rgm-mermaid-graphic");
    graphic.setAttribute("preserveAspectRatio", "xMidYMid meet");
    canvas.appendChild(graphic);
    const metrics = svgMetrics(graphic);
    installControls(graphic);
    panzoom = Panzoom(graphic, {
      minScale: 1,
      maxScale: 6,
      cursor: "grab",
      panOnlyWhenZoomed: false,
    });
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.parent.postMessage(
      { type: "rgm:mermaid:metrics", requestId: request.requestId, ...metrics },
      "*",
    );
  } catch (error) {
    window.parent.postMessage(
      {
        type: "rgm:mermaid:error",
        requestId: request.requestId,
        message: errorMessage(error),
      },
      "*",
    );
  }
}

function svgMetrics(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox.baseVal;
  if (viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }
  const width = Number.parseFloat(svg.getAttribute("width") ?? "");
  const height = Number.parseFloat(svg.getAttribute("height") ?? "");
  if (!(width > 0) || !(height > 0)) {
    throw new Error("Mermaid returned a diagram without dimensions.");
  }
  return { width, height };
}

function installControls(graphic: SVGSVGElement): void {
  const controls = document.createElement("div");
  controls.className = "rgm-mermaid-controls panzoom-exclude";
  controls.setAttribute("aria-label", "Diagram controls");
  const zoomIn = controlButton("+", "Zoom in");
  const zoomOut = controlButton("−", "Zoom out");
  const reset = controlButton("↺", "Reset view");
  controls.append(zoomIn, zoomOut, reset);
  canvas.appendChild(controls);

  zoomIn.addEventListener("click", () => panzoom?.zoomIn());
  zoomOut.addEventListener("click", () => panzoom?.zoomOut());
  reset.addEventListener("click", () => panzoom?.reset());
  graphic.setAttribute("aria-label", "Mermaid diagram. Drag to pan.");
}

function controlButton(label: string, ariaLabel: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  return button;
}

function onWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  panzoom?.zoomWithWheel(event);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Mermaid error.";
}
