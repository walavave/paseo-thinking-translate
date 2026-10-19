import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSettings, type PluginSurfaceProps, type SettingsState } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsInput,
  SettingsRow,
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

function LanguageSelect({
  label,
  hint,
  value,
  options,
  disabled,
  theme,
  onValueChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: readonly { label: string; value: string }[];
  disabled: boolean;
  theme: PluginSurfaceProps["theme"];
  onValueChange(value: string): void;
}) {
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const trigger = useRef<View>(null);
  const optionRefs = useRef(new Map<string, View>());
  const focusedIndex = useRef(0);
  const { width, height } = useWindowDimensions();
  const { colors } = theme;
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const expanded = anchor !== null && !disabled;
  useEffect(() => {
    setAnchor(null);
  }, [width, height, disabled]);

  function close() {
    setAnchor(null);
    trigger.current?.focus();
  }

  // The menu lives outside the settings ScrollView, so it cannot resize or be clipped by a row.
  const menuWidth = Math.min(220, width - 16);
  const below = anchor ? Math.max(0, height - anchor.y - anchor.height - 12) : 0;
  const above = anchor ? Math.max(0, anchor.y - 12) : 0;
  const opensAbove = below < Math.min(320, height * 0.4) && above > below;
  const menuHeight = Math.min(320, height * 0.4, opensAbove ? above : below);
  const left = anchor
    ? Math.max(8, Math.min(width - menuWidth - 8, anchor.x + anchor.width - menuWidth))
    : 8;
  const top = anchor ? (opensAbove ? anchor.y - menuHeight - 4 : anchor.y + anchor.height + 4) : 8;

  function focusOption(index: number) {
    focusedIndex.current = Math.max(0, Math.min(options.length - 1, index));
    optionRefs.current.get(options[focusedIndex.current].value)?.focus();
  }

  const keyboardHandlers = {
    onKeyDown(event: { nativeEvent: { key: string }; preventDefault(): void }) {
      switch (event.nativeEvent.key) {
        case "ArrowDown":
          event.preventDefault();
          focusOption(focusedIndex.current + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          focusOption(focusedIndex.current - 1);
          break;
        case "Home":
          event.preventDefault();
          focusOption(0);
          break;
        case "End":
          event.preventDefault();
          focusOption(options.length - 1);
          break;
      }
    },
  };
  return (
    <SettingsRow label={label} hint={hint} testID="target-language-row">
      <View style={{ maxWidth: "100%" }}>
        <Pressable
          ref={trigger}
          testID="target-language-trigger"
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selectedLabel}`}
          accessibilityState={{ expanded: expanded && !disabled, disabled }}
          aria-expanded={expanded}
          aria-haspopup="menu"
          disabled={disabled}
          onPress={() => {
            if (expanded) {
              close();
              return;
            }
            trigger.current?.measureInWindow((x, y, width, height) => {
              setAnchor({ x, y, width, height });
            });
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            minHeight: 32,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderRadius: 12,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surface2 : "transparent",
            opacity: disabled ? 0.5 : 1,
          })}
        >
          <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 14, flexShrink: 1 }}>
            {selectedLabel}
          </Text>
          <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRightWidth: 1.5,
                borderBottomWidth: 1.5,
                borderColor: colors.foregroundMuted,
                transform: [{ translateY: -2 }, { rotate: "45deg" }],
              }}
            />
          </View>
        </Pressable>
        {expanded ? (
          <Modal
            transparent
            visible
            animationType="none"
            onRequestClose={close}
            onShow={() =>
              focusOption(
                Math.max(
                  0,
                  options.findIndex((option) => option.value === value),
                ),
              )
            }
          >
            <Pressable
              testID="target-language-backdrop"
              accessible={false}
              onPress={close}
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            />
            <View
              {...keyboardHandlers}
              style={{
                position: "absolute",
                top,
                left,
                width: menuWidth,
                height: menuHeight,
                borderWidth: 1,
                borderRadius: 8,
                borderColor: colors.border,
                backgroundColor: colors.surface1,
                overflow: "hidden",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
              }}
            >
              <ScrollView
                testID="target-language-options"
                accessibilityRole="menu"
                accessibilityLabel={label}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingVertical: 4 }}
                style={{ flex: 1 }}
              >
                {options.map((option, index) => (
                  <Pressable
                    key={option.value}
                    ref={(view) => {
                      if (view) optionRefs.current.set(option.value, view);
                      else optionRefs.current.delete(option.value);
                    }}
                    accessibilityRole="menuitem"
                    accessibilityLabel={`${label}: ${option.label}`}
                    accessibilityState={{ selected: option.value === value }}
                    aria-selected={option.value === value}
                    onFocus={() => {
                      focusedIndex.current = index;
                    }}
                    onPress={() => {
                      onValueChange(option.value);
                      close();
                    }}
                    style={({
                      pressed,
                      hovered = false,
                      focused = false,
                    }: {
                      pressed: boolean;
                      hovered?: boolean;
                      focused?: boolean;
                    }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      minHeight: width < 768 ? 40 : 28,
                      marginHorizontal: 4,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderWidth: 1,
                      borderColor: "transparent",
                      borderRadius: 6,
                      gap: 8,
                      backgroundColor:
                        pressed || hovered || focused || option.value === value
                          ? colors.surface2
                          : "transparent",
                    })}
                  >
                    <Text
                      style={{ color: colors.foreground, fontSize: 14, lineHeight: 18, flex: 1 }}
                    >
                      {option.label}
                    </Text>
                    {option.value === value ? (
                      <Text style={{ color: colors.foregroundMuted, fontSize: 14 }}>
                        {"\u2713"}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Modal>
        ) : null}
      </View>
    </SettingsRow>
  );
}

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
      <LanguageSelect
        label={m.targetLanguage}
        hint={m.targetLanguageHint}
        theme={theme}
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
      testID="translation-settings"
      contentContainerStyle={{ padding: layout.compact ? 16 : 24, gap: 12 }}
      style={{ flex: 1, minHeight: 0, backgroundColor: theme.colors.surface0 }}
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
