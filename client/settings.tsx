import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { useSettings, type PluginSurfaceProps, type SettingsState } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsInput,
  SettingsSection,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { settings, settingsSchema } from "../shared/contract";

type Ready = Extract<SettingsState<typeof settingsSchema>, { status: "ready" }>;

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
    setDraft((current) => ({ ...current, values }));
  }
  return (
    <SettingsSection
      title="Thinking 翻译"
      info="思考文本由 daemon 发送至下方 endpoint。Google 免 key 接口可能限流或变更。"
    >
      <SettingsSwitch
        label="自动翻译"
        value={draft.values.enabled}
        disabled={state.saving}
        onValueChange={(enabled) => change({ ...draft.values, enabled })}
      />
      <SettingsInput
        label="目标语言"
        initialValue={draft.values.targetLanguage}
        disabled={state.saving}
        onChangeText={(targetLanguage) => change({ ...draft.values, targetLanguage })}
      />
      <SettingsInput
        label="Endpoint"
        initialValue={draft.values.endpoint}
        disabled={state.saving}
        onChangeText={(endpoint) => change({ ...draft.values, endpoint })}
      />
      <SettingsAction
        label="宿主级设置"
        actionLabel={state.saving ? "保存中…" : "保存"}
        disabled={state.saving}
        onPress={() => {
          const parsed = settingsSchema.safeParse(draft.values);
          if (!parsed.success) {
            setValidation("请填写有效的目标语言和 HTTP(S) endpoint。");
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
