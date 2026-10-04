import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import "./App.css";
import { AppTopBar } from "./components/AppTopBar";
import { AppDialogs } from "./components/workspace/AppDialogs";
import { AccountsView } from "./components/workspace/AccountsView";
import { useCodexController } from "./hooks/useCodexController";
import { useThemeMode } from "./hooks/useThemeMode";
import { useAppNavigation } from "./hooks/useAppNavigation";
import type { AppTab } from "./types/workspace";
import { AppLayoutProvider } from "./components/layout/AppLayoutProvider";
import { useAppLayout } from "./hooks/useAppLayout";
import { ClassicTopBar } from "./components/classic/ClassicTopBar";
import {
  copyUiDiagnosticReport,
  installUiDiagnostics,
  recordUiDiagnostic,
} from "./utils/uiDiagnostics";

const AnalyticsView = lazy(() =>
  import("./components/workspace/AnalyticsView").then((module) => ({
    default: module.AnalyticsView,
  })),
);
const ProxyView = lazy(() =>
  import("./components/workspace/ProxyView").then((module) => ({
    default: module.ProxyView,
  })),
);
const SettingsView = lazy(() =>
  import("./components/workspace/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
);

class WorkspaceContentBoundary extends Component<
  { children: ReactNode },
  {
    hasError: boolean;
    error: unknown;
    componentStack: string;
    copyStatus: "idle" | "copied" | "failed";
  }
> {
  state: {
    hasError: boolean;
    error: unknown;
    componentStack: string;
    copyStatus: "idle" | "copied" | "failed";
  } = {
    hasError: false,
    error: null,
    componentStack: "",
    copyStatus: "idle",
  };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workspace content render failed", error, info.componentStack);
    recordUiDiagnostic("react-render-error", {
      error:
        error.stack ||
        `${error.name}: ${error.message || "(empty error message)"}`,
      componentStack: info.componentStack ?? "",
    });
    this.setState({ componentStack: info.componentStack ?? "" });
  }

  render() {
    if (this.state.hasError) {
      const { error, componentStack } = this.state;
      const message =
        error instanceof Error
          ? `${error.name}: ${error.message || "(empty error message)"}`
          : String(error ?? "Unknown render error");
      const stack = error instanceof Error ? error.stack : "";
      const details = [message, stack, componentStack]
        .filter(Boolean)
        .join("\n\n");

      return (
        <div
          role="alert"
          style={{
            width: "100%",
            height: "100%",
            overflow: "auto",
            padding: 24,
          }}
        >
          <strong>页面渲染失败</strong>
          <button
            type="button"
            onClick={() => {
              void copyUiDiagnosticReport().then(
                () => this.setState({ copyStatus: "copied" }),
                () => this.setState({ copyStatus: "failed" }),
              );
            }}
            style={{ margin: "16px 0", padding: "8px 12px" }}
          >
            {this.state.copyStatus === "copied"
              ? "诊断信息已复制"
              : this.state.copyStatus === "failed"
                ? "复制失败"
                : "复制诊断信息"}
          </button>
          <pre
            style={{
              width: "100%",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontSize: 12,
            }}
          >
            {details || "The renderer did not provide error details."}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppWorkspace() {
  const { layout } = useAppLayout();
  const [activeTab, setActiveTab] = useState<AppTab>("accounts");
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);
  useEffect(() => {
    recordUiDiagnostic("tab-selected", { activeTab, layout });
  }, [activeTab, layout]);
  const openAccountSearch = useCallback(() => {
    setAccountSearchOpen(true);
    window.requestAnimationFrame(() =>
      document
        .querySelector<HTMLInputElement>("[data-account-search]")
        ?.focus(),
    );
  }, []);
  const closeAccountSearch = () => {
    setAccountSearchOpen(false);
    document.querySelector<HTMLButtonElement>(".accountSearchButton")?.focus();
  };
  const { themeMode, toggleTheme } = useThemeMode();
  const c = useCodexController(activeTab);
  useAppNavigation(activeTab, setActiveTab, c, openAccountSearch);
  const isMacos = /Macintosh|Mac OS X/i.test(navigator.userAgent);
  const quotaOnboardingPlatform = /Windows/i.test(navigator.userAgent)
    ? "windows"
    : isMacos
      ? "macos"
      : null;
  const refresh = () => {
    if (activeTab === "analytics") {
      void c.refreshCostAnalytics(false);
      void c.refreshTokenUsage(true);
    } else if (activeTab === "proxy") void c.loadApiProxyStatus();
    else {
      void c.refreshUsage(false);
      void c.refreshTokenUsage(false);
    }
  };

  return (
    <div
      className={`shell ${layout === "compact" ? "nativeApp" : "classicApp"}${isMacos ? " isMacos" : ""}${c.mainWindowVisible ? "" : " isUiInactive"}`}
    >
      <main className="panel">
        <div className="workspaceMain">
          {layout === "classic" ? (
            <ClassicTopBar
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              themeMode={themeMode}
              onToggleTheme={toggleTheme}
              onRefresh={refresh}
              refreshing={
                activeTab === "analytics"
                  ? c.costAnalyticsLoading
                  : c.refreshing || c.refreshingTokenUsage
              }
              onGoHome={() => setActiveTab("accounts")}
              showRefresh={activeTab !== "settings"}
            />
          ) : (
            <AppTopBar
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              onRefresh={refresh}
              refreshing={
                activeTab === "analytics"
                  ? c.costAnalyticsLoading
                  : c.refreshing || c.refreshingTokenUsage
              }
              showRefresh={activeTab !== "settings"}
              searchOpen={accountSearchOpen}
              onSearch={openAccountSearch}
              onAddAccount={c.onOpenAddDialog}
            />
          )}
          <section
            className="viewStage"
            id="workspace-content"
            aria-label={activeTab}
          >
            <WorkspaceContentBoundary key={activeTab}>
              <Suspense
                fallback={
                  <div className="workspaceLoading" role="status">
                    …
                  </div>
                }
              >
                {activeTab === "accounts" ? (
                  <AccountsView
                    c={c}
                    searchVisible={accountSearchOpen}
                    onCloseSearch={closeAccountSearch}
                    onShowAnalytics={() => setActiveTab("analytics")}
                  />
                ) : activeTab === "analytics" ? (
                  <AnalyticsView c={c} />
                ) : activeTab === "proxy" ? (
                  <ProxyView c={c} />
                ) : (
                  <SettingsView
                    c={c}
                    themeMode={themeMode}
                    toggleTheme={toggleTheme}
                  />
                )}
              </Suspense>
            </WorkspaceContentBoundary>
          </section>
        </div>
        <AppDialogs
          c={c}
          themeMode={themeMode}
          quotaOnboardingPlatform={quotaOnboardingPlatform}
        />
      </main>
    </div>
  );
}

function App() {
  useEffect(() => installUiDiagnostics(), []);

  return (
    <WorkspaceContentBoundary>
      <AppLayoutProvider>
        <AppWorkspace />
      </AppLayoutProvider>
    </WorkspaceContentBoundary>
  );
}

export default App;
