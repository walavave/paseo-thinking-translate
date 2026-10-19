import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { useSettings, type PluginSurfaceProps, type SettingsState } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsInput,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import type { ZodError } from "zod";
import {
  settings,
  settingsSchema,
  type GoogleApiVersion,
  type TranslationProvider,
} from "../shared/contract";

type Ready = Extract<SettingsState<typeof settingsSchema>, { status: "ready" }>;

const providers: readonly { label: string; value: TranslationProvider }[] = [
  { label: "Google 免费接口", value: "google-free" },
  { label: "Google Cloud", value: "google-cloud" },
  { label: "微软翻译", value: "microsoft" },
];
const versions: readonly { label: string; value: GoogleApiVersion }[] = [
  { label: "v2（API Key）", value: "v2" },
  { label: "v3（OAuth Access Token）", value: "v3" },
];

function validationMessage(error: ZodError): string {
  const field = String(error.issues[0]?.path[0] ?? "");
  switch (field) {
    case "googleApiKey":
      return "Google Cloud v2 需要 API Key。";
    case "googleAccessToken":
      return "Google Cloud v3 需要 OAuth Access Token。";
    case "googleProjectId":
      return "Google Cloud v3 需要项目 ID。";
    case "microsoftApiKey":
      return "微软翻译需要 API Key。";
    case "targetLanguage":
    case "endpoint":
    case "googleEndpoint":
    case "microsoftEndpoint":
      return "请填写有效的目标语言和 HTTP(S) endpoint。";
    default:
      return error.issues[0]?.message ?? "设置无效。";
  }
}

function Controls({
  state,
  theme,
  onSaved,
  onEdit,
  onReload,
}: {
  state: Ready;
  theme: PluginSurfaceProps["theme"];
  onSaved(): void;
  onEdit(): void;
  onReload(): void;
}) {
  const [draft, setDraft] = useState(() => ({ values: state.values, revision: state.revision }));
  const [validation, setValidation] = useState<string | null>(null);
  function change(values: Ready["values"]) {
    onEdit();
    setValidation(null);
    setDraft((current) => ({ ...current, values }));
  }
  const values = draft.values;
  return (
    <SettingsSection
      title="Thinking 翻译"
      info="思考文本由 daemon 发送至所选翻译服务。Google 免 key 接口可能限流；密钥明文保存在 daemon 设置文件中（权限 0600）。"
    >
      <SettingsSwitch
        label="自动翻译"
        value={values.enabled}
        disabled={state.saving}
        onValueChange={(enabled) => change({ ...values, enabled })}
      />
      <SettingsSelect
        label="翻译服务"
        value={values.provider}
        options={providers}
        disabled={state.saving}
        onValueChange={(provider) => change({ ...values, provider })}
      />
      <SettingsInput
        label="目标语言"
        hint="Google 使用 zh-CN / zh-TW；微软会自动转换为 zh-Hans / zh-Hant。"
        initialValue={values.targetLanguage}
        disabled={state.saving}
        onChangeText={(targetLanguage) => change({ ...values, targetLanguage })}
      />
      {values.provider === "google-free" ? (
        <SettingsInput
          key="google-free-endpoint"
          label="Endpoint"
          hint="免 key 接口，返回 Google translate_a/t 的 JSON 结构。"
          initialValue={values.endpoint}
          disabled={state.saving}
          onChangeText={(endpoint) => change({ ...values, endpoint })}
        />
      ) : null}
      {values.provider === "google-cloud" ? (
        <>
          <SettingsSelect
            label="Google API 版本"
            value={values.googleVersion}
            options={versions}
            disabled={state.saving}
            onValueChange={(googleVersion) => change({ ...values, googleVersion })}
          />
          {values.googleVersion === "v2" ? (
            <SettingsInput
              key="google-v2-key"
              label="Google API Key"
              hint="在 Google Cloud Console 启用 Cloud Translation API 后创建。"
              initialValue={values.googleApiKey}
              secureTextEntry
              disabled={state.saving}
              onChangeText={(googleApiKey) => change({ ...values, googleApiKey })}
            />
          ) : (
            <>
              <SettingsInput
                key="google-v3-token"
                label="OAuth Access Token"
                hint="v3 不支持 API Key；令牌约 1 小时后过期，需要定期更新。"
                initialValue={values.googleAccessToken}
                secureTextEntry
                disabled={state.saving}
                onChangeText={(googleAccessToken) => change({ ...values, googleAccessToken })}
              />
              <SettingsInput
                key="google-v3-project"
                label="Google Cloud 项目 ID"
                initialValue={values.googleProjectId}
                disabled={state.saving}
                onChangeText={(googleProjectId) => change({ ...values, googleProjectId })}
              />
            </>
          )}
          <SettingsInput
            key={`google-endpoint-${values.googleVersion}`}
            label="Google API Endpoint"
            hint="基础地址，默认 https://translation.googleapis.com；版本路径由插件拼接。"
            initialValue={values.googleEndpoint}
            disabled={state.saving}
            onChangeText={(googleEndpoint) => change({ ...values, googleEndpoint })}
          />
        </>
      ) : null}
      {values.provider === "microsoft" ? (
        <>
          <SettingsInput
            key="microsoft-key"
            label="微软 API Key"
            hint="Azure 翻译资源的密钥。"
            initialValue={values.microsoftApiKey}
            secureTextEntry
            disabled={state.saving}
            onChangeText={(microsoftApiKey) => change({ ...values, microsoftApiKey })}
          />
          <SettingsInput
            key="microsoft-region"
            label="微软区域"
            hint="多区域资源填区域，例如 eastasia；全局资源可留空。"
            initialValue={values.microsoftRegion}
            disabled={state.saving}
            onChangeText={(microsoftRegion) => change({ ...values, microsoftRegion })}
          />
          <SettingsInput
            key="microsoft-endpoint"
            label="微软 Endpoint"
            hint="默认 https://api.cognitive.microsofttranslator.com。"
            initialValue={values.microsoftEndpoint}
            disabled={state.saving}
            onChangeText={(microsoftEndpoint) => change({ ...values, microsoftEndpoint })}
          />
        </>
      ) : null}
      <SettingsAction
        label="宿主级设置"
        actionLabel={state.saving ? "保存中…" : "保存"}
        disabled={state.saving}
        onPress={() => {
          const parsed = settingsSchema.safeParse(values);
          if (!parsed.success) {
            setValidation(validationMessage(parsed.error));
            return;
          }
          setValidation(null);
          void state.save(parsed.data, draft.revision).then((saved) => {
            if (saved) onSaved();
          });
        }}
      />
      {validation || state.saveError ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.statusDanger }}>
          {validation ?? state.saveError}
        </Text>
      ) : null}
      <SettingsAction
        label="重新读取设置并放弃草稿"
        actionLabel="重新读取"
        disabled={state.saving}
        onPress={onReload}
      />
    </SettingsSection>
  );
}

export function TranslationSettings({ theme, layout }: PluginSurfaceProps) {
  const state = useSettings(settings);
  const [generation, setGeneration] = useState(0);
  const [saved, setSaved] = useState(false);
  return (
    <ScrollView
      contentContainerStyle={{ padding: layout.compact ? 16 : 24, gap: 12 }}
      style={{ backgroundColor: theme.colors.surface0 }}
    >
      {state.status === "ready" ? (
        <Controls
          key={generation}
          state={state}
          theme={theme}
          onEdit={() => setSaved(false)}
          onSaved={() => {
            setSaved(true);
            setGeneration((value) => value + 1);
          }}
          onReload={() => {
            setSaved(false);
            void state.reload().then(() => setGeneration((value) => value + 1));
          }}
        />
      ) : (
        <SettingsSection title="Thinking 翻译">
          <Text style={{ color: theme.colors.foreground }}>
            {state.status === "loading" ? "正在读取设置…" : state.error}
          </Text>
          {state.status !== "loading" ? (
            <SettingsAction label="读取失败" actionLabel="重试" onPress={state.reload} />
          ) : null}
          {state.status === "invalid" ? (
            <SettingsAction label="恢复默认设置" actionLabel="重置" onPress={state.reset} />
          ) : null}
        </SettingsSection>
      )}
      {saved ? (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.statusSuccess }}>
          设置已保存
        </Text>
      ) : null}
    </ScrollView>
  );
}
