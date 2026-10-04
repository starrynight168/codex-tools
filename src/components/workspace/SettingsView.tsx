import { SettingsPanel } from "../SettingsPanel";
import type { ThemeMode } from "../../types/app";
import type { CodexController } from "../../types/workspace";
import { useI18n } from "../../i18n/I18nProvider";
import { getWorkspaceCopy } from "../../i18n/workspaceCopy";

export function SettingsView({
  c,
  themeMode,
  toggleTheme,
}: {
  c: CodexController;
  themeMode: ThemeMode;
  toggleTheme: () => void;
}) {
  const { locale } = useI18n();
  const text = getWorkspaceCopy(locale);
  const updateSettings = (
    patch: Parameters<typeof c.updateSettings>[0],
    options?: Parameters<typeof c.updateSettings>[1],
  ) => {
    const stage = document.getElementById("workspace-content");
    const page = stage?.firstElementChild as HTMLElement | null;
    const stageScrollTop = stage?.scrollTop ?? 0;
    const pageScrollTop = page?.scrollTop ?? 0;
    const windowScrollX = window.scrollX;
    const windowScrollY = window.scrollY;

    void c.updateSettings(patch, options).finally(() => {
      window.requestAnimationFrame(() => {
        const currentStage = document.getElementById("workspace-content");
        const currentPage = currentStage?.firstElementChild as HTMLElement | null;
        if (currentStage) currentStage.scrollTop = stageScrollTop;
        if (currentPage) currentPage.scrollTop = pageScrollTop;
        window.scrollTo(windowScrollX, windowScrollY);
      });
    });
  };
  return (
    <SettingsPanel
      developerContent={
        import.meta.env.DEV ? (
          <button type="button" onClick={c.openDebugUpdateDialog}>
            {text.debugUpdate}
          </button>
        ) : undefined
      }
      themeMode={themeMode}
      onToggleTheme={toggleTheme}
      checkingUpdate={c.checkingUpdate}
      onCheckUpdate={() => void c.checkForAppUpdate(false)}
      onOpenExternalUrl={(url) => void c.openExternalUrl(url)}
      settings={c.settings}
      accounts={c.accounts}
      installedEditorApps={c.installedEditorApps}
      hasOpencodeDesktopApp={c.hasOpencodeDesktopApp}
      savingSettings={c.savingSettings}
      onUpdateSettings={updateSettings}
    />
  );
}
