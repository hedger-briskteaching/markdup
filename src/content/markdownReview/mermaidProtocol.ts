/** Messages exchanged by the rich view and its sandboxed Mermaid frame. */
export const MERMAID_FRAME_PATH = "mermaidFrame.html";

export type MermaidTheme = "light" | "dark";

export type MermaidRenderRequest = {
  type: "rgm:mermaid:render";
  requestId: string;
  source: string;
  theme: MermaidTheme;
};

export type MermaidFrameReady = {
  type: "rgm:mermaid:ready";
};

export type MermaidFrameMetrics = {
  type: "rgm:mermaid:metrics";
  requestId: string;
  width: number;
  height: number;
};

export type MermaidFrameError = {
  type: "rgm:mermaid:error";
  requestId: string;
  message: string;
};

export type MermaidFrameMessage = MermaidFrameReady | MermaidFrameMetrics | MermaidFrameError;

/** True when a frame payload is one of the messages Markdup accepts. */
export function isMermaidFrameMessage(value: unknown): value is MermaidFrameMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<MermaidFrameMessage>;
  if (message.type === "rgm:mermaid:ready") return true;
  if (message.type === "rgm:mermaid:metrics" && typeof message.requestId === "string") {
    return (
      typeof message.width === "number" &&
      Number.isFinite(message.width) &&
      message.width > 0 &&
      typeof message.height === "number" &&
      Number.isFinite(message.height) &&
      message.height > 0
    );
  }
  return (
    message.type === "rgm:mermaid:error" &&
    typeof message.requestId === "string" &&
    typeof message.message === "string"
  );
}
