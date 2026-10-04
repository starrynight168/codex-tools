const STORAGE_KEY = "codex-tools.ui-diagnostics.v1";
const MAX_EVENTS = 120;

type UiDiagnosticEvent = {
  time: string;
  event: string;
  details: Record<string, string | number | boolean | null>;
  viewport: { width: number; height: number; pixelRatio: number };
  layout: string | null;
  elements: Record<string, unknown>;
};

function redact(value: string) {
  return value
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})\b/g, "[redacted-secret]")
    .replace(
      /(["']?(?:access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|authorization)["']?\s*[:=]\s*["']?)[^,\s"'&}]+/gi,
      "$1[redacted]",
    )
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/([?&](?:api_?key|token|access_token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/([A-Z]:\\Users\\)[^\\]+/gi, "$1[redacted]")
    .slice(0, 5000);
}

function readEvents(): UiDiagnosticEvent[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readElements() {
  const selectors: Record<string, string> = {
    root: "#root",
    shell: ".shell",
    panel: ".panel",
    workspace: ".workspaceMain",
    topbar: ".topbar",
    stage: ".viewStage",
    page: ".viewStage > *",
  };
  const elements: Record<string, unknown> = {};

  for (const [name, selector] of Object.entries(selectors)) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
      elements[name] = null;
      continue;
    }
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    elements[name] = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      display: style.display,
      visibility: style.visibility,
      overflow: style.overflow,
    };
  }
  return elements;
}

function describeReason(reason: unknown) {
  if (reason instanceof Error) {
    return redact(`${reason.name}: ${reason.message}\n${reason.stack ?? ""}`);
  }
  return redact(String(reason ?? "Unknown error"));
}

export function recordUiDiagnostic(
  event: string,
  details: Record<string, unknown> = {},
) {
  try {
    const safeDetails = Object.fromEntries(
      Object.entries(details).map(([key, value]) => [
        key,
        typeof value === "string"
          ? redact(value)
          : typeof value === "number" || typeof value === "boolean" || value === null
            ? value
            : redact(JSON.stringify(value) ?? String(value)),
      ]),
    ) as UiDiagnosticEvent["details"];
    const entry: UiDiagnosticEvent = {
      time: new Date().toISOString(),
      event,
      details: safeDetails,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
      },
      layout: document.documentElement.dataset.layout ?? null,
      elements: readElements(),
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...readEvents(), entry].slice(-MAX_EVENTS)),
    );
  } catch {
  }
}

export function installUiDiagnostics() {
  const onError = (event: ErrorEvent) => {
    recordUiDiagnostic("window-error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      error: describeReason(event.error),
    });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    recordUiDiagnostic("unhandled-rejection", {
      reason: describeReason(event.reason),
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  recordUiDiagnostic("app-started");

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}

export function getUiDiagnosticReport() {
  return JSON.stringify(
    {
      collectedAt: new Date().toISOString(),
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screen: { width: screen.width, height: screen.height },
        visualViewport: {
          width: window.visualViewport?.width ?? null,
          height: window.visualViewport?.height ?? null,
        },
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
      },
      layout: document.documentElement.dataset.layout ?? null,
      elements: readElements(),
      events: readEvents(),
    },
    null,
    2,
  );
}

export async function copyUiDiagnosticReport() {
  const report = getUiDiagnosticReport();
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(report);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = report;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
}
