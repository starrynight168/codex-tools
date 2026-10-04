import { useState } from "react";
import { getWorkspaceCopy } from "../../i18n/workspaceCopy";
import {
  PROJECT_CHANGELOG_URL,
  PROJECT_ISSUES_URL,
  PROJECT_RELEASES_URL,
  PROJECT_REPOSITORY_DISPLAY,
  PROJECT_REPOSITORY_URL,
} from "../../constants/externalLinks";
import type { SettingsWorkspace } from "./useSettingsWorkspace";
import { GitHubIcon } from "./GitHubIcon";
import { copyUiDiagnosticReport } from "../../utils/uiDiagnostics";
export function AboutSettings({ workspace }: { workspace: SettingsWorkspace }) {
  const [diagnosticCopyStatus, setDiagnosticCopyStatus] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const {
    developerContent,
    locale,
    checkingUpdate,
    onCheckUpdate,
    onOpenExternalUrl,
    copy,
    versionValue,
  } = workspace;
  return (
    <div className="settingsGroup">
      <div className="settingRow">
        <div className="settingMeta settingMetaInline">
          <strong>{copy.settings.projectInfo.versionLabel}</strong>
          <span className="settingInlineValue">{versionValue}</span>
        </div>
        <div className="settingActionGroup">
          <button
            className="primary"
            onClick={onCheckUpdate}
            disabled={checkingUpdate}
          >
            {checkingUpdate
              ? copy.topBar.checkingUpdate
              : copy.topBar.checkUpdate}
          </button>
        </div>
      </div>

      <div className="settingRow">
        <a
          className="settingLink"
          href={PROJECT_REPOSITORY_URL}
          title={PROJECT_REPOSITORY_DISPLAY}
          onClick={(event) => {
            event.preventDefault();
            onOpenExternalUrl(PROJECT_REPOSITORY_URL);
          }}
        >
          <GitHubIcon />
          <span className="settingLinkLabel">{PROJECT_REPOSITORY_DISPLAY}</span>
        </a>
        <div className="settingActionGroup">
          <button
            className="ghost"
            onClick={() => onOpenExternalUrl(PROJECT_ISSUES_URL)}
          >
            {copy.settings.projectInfo.openIssues}
          </button>
        </div>
      </div>

      <div className="settingRow">
        <div className="settingMeta">
          <strong>{copy.settings.projectInfo.releasesLabel}</strong>
        </div>
        <div className="settingActionGroup">
          <button
            className="ghost"
            onClick={() => onOpenExternalUrl(PROJECT_RELEASES_URL)}
          >
            {copy.settings.projectInfo.openReleases}
          </button>
          <button
            className="ghost"
            onClick={() => onOpenExternalUrl(PROJECT_CHANGELOG_URL)}
          >
            {copy.settings.projectInfo.openChangelog}
          </button>
        </div>
      </div>
      <div className="settingRow">
        <div className="settingMeta">
          <strong>界面故障诊断</strong>
          <span>记录最近的页面尺寸、设置操作和界面错误；不记录账号列表或授权令牌。</span>
        </div>
        <div className="settingActionGroup">
          <button
            className="ghost"
            onClick={() => {
              void copyUiDiagnosticReport().then(
                () => setDiagnosticCopyStatus("copied"),
                () => setDiagnosticCopyStatus("failed"),
              );
            }}
          >
            {diagnosticCopyStatus === "copied"
              ? "诊断信息已复制"
              : diagnosticCopyStatus === "failed"
                ? "复制失败"
                : "复制界面诊断"}
          </button>
        </div>
      </div>
      {developerContent ? (
        <div className="settingRow">
          <div className="settingMeta">
            <strong>{getWorkspaceCopy(locale).developer}</strong>
          </div>
          <div className="settingActionGroup">{developerContent}</div>
        </div>
      ) : null}
    </div>
  );
}
