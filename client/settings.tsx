import { useMemo, useState } from "react";
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
import { isKnownTranslationLanguage, translationLanguages } from "../shared/languages";
import { languageName } from "../shared/locale";
import { useLocale, useMessages, type Messages } from "./i18n";

type Ready = Extract<SettingsState<typeof settingsSchema>, { status: "ready" }>;

const CUSTOM_LANGUAGE = "__custom__";

function providerOptions(m: Messages): readonly { label: string; value: TranslationProvider }[] {
  return [
    { label: m.serviceFree, value: "google-free" },
    { label: m.serviceGoogle, value: "google-cloud" },
    { label: m.serviceMicrosoft, value: "microsoft" },
  ];
}

function versionOptions(m: Messages): readonly { label: string; value: GoogleApiVersion }[] {
  return [
    { label: m.googleV2, value: "v2" },
    { label: m.googleV3, value: "v3" },
  ];
}

function validationMessage(error: ZodError, m: Messages): string {
  const field = String(error.issues[0]?.path[0] ?? "");
  switch (field) {
    case "googleApiKey":
      return m.errorGoogleKey;
    case "googleAccessToken":
      return m.errorGoogleToken;
    case "googleProjectId":
      return m.errorGoogleProject;
    case "microsoftApiKey":
      return m.errorMicrosoftKey;
    case "targetLanguage":
      return m.errorTargetLanguage;
    case "endpoint":
    case "googleEndpoint":
    case "microsoftEndpoint":
      return m.errorEndpoint;
    default:
      return error.issues[0]?.message ?? m.errorInvalid;
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
  const m = useMessages();
  const locale = useLocale();
  const [draft, setDraft] = useState(() => ({ values: state.values, revision: state.revision }));
  const [validation, setValidation] = useState<string | null>(null);
  const [customLanguage, setCustomLanguage] = useState(
    () => !isKnownTranslationLanguage(state.values.targetLanguage),
  );
  const languageOptions = useMemo(
    () => [
      ...translationLanguages
        .map((code) => ({ value: code, label: languageName(code, locale) }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
      { value: CUSTOM_LANGUAGE, label: m.customLanguage },
    ],
    [locale, m.customLanguage],
  );
  function change(values: Ready["values"]) {
    onEdit();
    setValidation(null);
    setDraft((current) => ({ ...current, values }));
  }
  const values = draft.values;
  return (
    <SettingsSection title={m.settingsTitle} info={m.settingsInfo}>
      <SettingsSwitch
        label={m.autoTranslate}
        value={values.enabled}
        disabled={state.saving}
        onValueChange={(enabled) => change({ ...values, enabled })}
      />
      <SettingsSelect
        label={m.service}
        value={values.provider}
        options={providerOptions(m)}
        disabled={state.saving}
        onValueChange={(provider) => change({ ...values, provider })}
      />
      <SettingsSelect
        label={m.targetLanguage}
        hint={m.targetLanguageHint}
        value={customLanguage ? CUSTOM_LANGUAGE : values.targetLanguage}
        options={languageOptions}
        disabled={state.saving}
        onValueChange={(language) => {
          if (language === CUSTOM_LANGUAGE) {
            setCustomLanguage(true);
            return;
          }
          setCustomLanguage(false);
          change({ ...values, targetLanguage: language });
        }}
      />
      {customLanguage ? (
        <SettingsInput
          key="custom-target-language"
          label={m.customLanguage}
          hint={m.customLanguageHint}
          initialValue={values.targetLanguage}
          disabled={state.saving}
          onChangeText={(targetLanguage) => change({ ...values, targetLanguage })}
        />
      ) : null}
      {values.provider === "google-free" ? (
        <SettingsInput
          key="google-free-endpoint"
          label={m.endpoint}
          hint={m.freeEndpointHint}
          initialValue={values.endpoint}
          disabled={state.saving}
          onChangeText={(endpoint) => change({ ...values, endpoint })}
        />
      ) : null}
      {values.provider === "google-cloud" ? (
        <>
          <SettingsSelect
            label={m.googleVersion}
            value={values.googleVersion}
            options={versionOptions(m)}
            disabled={state.saving}
            onValueChange={(googleVersion) => change({ ...values, googleVersion })}
          />
          {values.googleVersion === "v2" ? (
            <SettingsInput
              key="google-v2-key"
              label={m.googleApiKey}
              hint={m.googleApiKeyHint}
              initialValue={values.googleApiKey}
              secureTextEntry
              disabled={state.saving}
              onChangeText={(googleApiKey) => change({ ...values, googleApiKey })}
            />
          ) : (
            <>
              <SettingsInput
                key="google-v3-token"
                label={m.googleToken}
                hint={m.googleTokenHint}
                initialValue={values.googleAccessToken}
                secureTextEntry
                disabled={state.saving}
                onChangeText={(googleAccessToken) => change({ ...values, googleAccessToken })}
              />
              <SettingsInput
                key="google-v3-project"
                label={m.googleProject}
                initialValue={values.googleProjectId}
                disabled={state.saving}
                onChangeText={(googleProjectId) => change({ ...values, googleProjectId })}
              />
            </>
          )}
          <SettingsInput
            key={`google-endpoint-${values.googleVersion}`}
            label={m.googleEndpoint}
            hint={m.googleEndpointHint}
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
            label={m.microsoftKey}
            hint={m.microsoftKeyHint}
            initialValue={values.microsoftApiKey}
            secureTextEntry
            disabled={state.saving}
            onChangeText={(microsoftApiKey) => change({ ...values, microsoftApiKey })}
          />
          <SettingsInput
            key="microsoft-region"
            label={m.microsoftRegion}
            hint={m.microsoftRegionHint}
            initialValue={values.microsoftRegion}
            disabled={state.saving}
            onChangeText={(microsoftRegion) => change({ ...values, microsoftRegion })}
          />
          <SettingsInput
            key="microsoft-endpoint"
            label={m.microsoftEndpoint}
            hint={m.microsoftEndpointHint}
            initialValue={values.microsoftEndpoint}
            disabled={state.saving}
            onChangeText={(microsoftEndpoint) => change({ ...values, microsoftEndpoint })}
          />
        </>
      ) : null}
      <SettingsAction
        label={m.hostSettings}
        actionLabel={state.saving ? m.saving : m.save}
        disabled={state.saving}
        onPress={() => {
          const parsed = settingsSchema.safeParse(values);
          if (!parsed.success) {
            setValidation(validationMessage(parsed.error, m));
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
        label={m.reload}
        actionLabel={m.reloadAction}
        disabled={state.saving}
        onPress={onReload}
      />
    </SettingsSection>
  );
}

export function TranslationSettings({ theme, layout }: PluginSurfaceProps) {
  const m = useMessages();
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
        <SettingsSection title={m.settingsTitle}>
          <Text style={{ color: theme.colors.foreground }}>
            {state.status === "loading" ? m.loading : state.error}
          </Text>
          {state.status !== "loading" ? (
            <SettingsAction label={m.readFailed} actionLabel={m.retry} onPress={state.reload} />
          ) : null}
          {state.status === "invalid" ? (
            <SettingsAction label={m.restoreDefaults} actionLabel={m.reset} onPress={state.reset} />
          ) : null}
        </SettingsSection>
      )}
      {saved ? (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.statusSuccess }}>
          {m.saved}
        </Text>
      ) : null}
    </ScrollView>
  );
}
