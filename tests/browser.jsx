import React, { useCallback, useContext, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import * as native from "react-native-web";
import * as query from "@tanstack/react-query";
import * as sdk from "@getpaseo/plugin";
import * as zod from "zod";
import * as jsx from "react/jsx-runtime";

const light = {
  surface0: "#ffffff",
  surface1: "#f6f7f8",
  surface2: "#eceef0",
  border: "#dde0e3",
  foreground: "#202226",
  foregroundMuted: "#60656d",
  accent: "#1769aa",
  accentForeground: "#ffffff",
  statusSuccess: "#1a7f37",
  statusWarning: "#9a6700",
  statusDanger: "#cf222e",
};
const dark = {
  surface0: "#191b20",
  surface1: "#22252b",
  surface2: "#2c3038",
  border: "#3a3f48",
  foreground: "#e9ebef",
  foregroundMuted: "#a6acb7",
  accent: "#88bfff",
  accentForeground: "#101820",
  statusSuccess: "#60bf80",
  statusWarning: "#e1bb69",
  statusDanger: "#ff9393",
};
const ThemeContext = React.createContext(light);

// Match the host's row alignment and control geometry: expanding a menu must not resize a row.
function SettingsRow({ label, hint, children, testID }) {
  const colors = useContext(ThemeContext);
  const { width } = native.useWindowDimensions();
  return (
    <native.View
      testID={testID}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        ...(width < 768 ? { flexWrap: "wrap", gap: 12 } : {}),
      }}
    >
      <native.View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 160, marginRight: 12 }}>
        <native.Text style={{ color: colors.foreground, fontSize: 14 }}>{label}</native.Text>
        {hint ? (
          <native.Text style={{ color: colors.foregroundMuted, fontSize: 12, marginTop: 4 }}>
            {hint}
          </native.Text>
        ) : null}
      </native.View>
      <native.View style={{ flexShrink: 1, maxWidth: "100%" }}>{children}</native.View>
    </native.View>
  );
}

function SettingsSelect({ label, value, options, onValueChange, disabled }) {
  const [open, setOpen] = useState(false);
  const colors = useContext(ThemeContext);
  const selected = options.find((option) => option.value === value)?.label ?? value;
  return (
    <SettingsRow label={label}>
      <native.Pressable
        testID={`settings-select-${label}`}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected}`}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={{
          minHeight: 32,
          paddingHorizontal: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          justifyContent: "center",
        }}
      >
        <native.Text style={{ color: colors.foreground, fontSize: 14 }}>
          {selected} {"\u2304"}
        </native.Text>
      </native.Pressable>
      {open
        ? options.map((option) => (
            <native.Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${option.label}`}
              onPress={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
            >
              <native.Text>{option.label}</native.Text>
            </native.Pressable>
          ))
        : null}
    </SettingsRow>
  );
}

let snapshot = {
  status: "ready",
  revision: "initial",
  values: {
    enabled: true,
    provider: "google-free",
    targetLanguage: "zh-CN",
    endpoint: new URL("/google", window.location.href).href,
    googleVersion: "v2",
    googleEndpoint: new URL("/google-cloud", window.location.href).href,
    googleApiKey: "",
    googleAccessToken: "",
    googleProjectId: "",
    microsoftEndpoint: new URL("/microsoft", window.location.href).href,
    microsoftApiKey: "",
    microsoftRegion: "",
  },
  saving: false,
  saveError: null,
  async save(values, revision) {
    publish({ saving: true, saveError: null });
    const response = await fetch("/settings", {
      method: "POST",
      body: JSON.stringify({ values, revision }),
    });
    const result = await response.json();
    if (!response.ok) {
      publish({ saving: false, saveError: result.error });
      return false;
    }
    publish({ ...result, saving: false });
    return true;
  },
  async reload() {
    const result = await (await fetch("/settings")).json();
    publish({ ...result, saveError: null });
  },
};
const listeners = new Set();
function publish(update) {
  snapshot = { ...snapshot, ...update };
  listeners.forEach((listener) => listener());
}
function useSettings() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}
function useRpc(contract) {
  return useCallback(
    async (input) => {
      const response = await fetch("/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contract.input.parse(input)),
      });
      return contract.output.parse(await response.json());
    },
    [contract],
  );
}
const modules = {
  react: React,
  "react/jsx-runtime": jsx,
  "react/jsx-dev-runtime": jsx,
  "react-native": native,
  "@tanstack/react-query": query,
  zod,
  "@getpaseo/plugin": sdk,
  "@getpaseo/plugin/client": { useSettings, useRpc },
  "@getpaseo/plugin/client/ui": {
    SettingsRow,
    SettingsSection: ({ title, info, children }) => {
      const colors = useContext(ThemeContext);
      return (
        <native.View style={{ gap: 12, marginBottom: 24 }}>
          <native.View style={{ flexDirection: "row", gap: 8, marginLeft: 4 }}>
            <native.Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>
              {title}
            </native.Text>
            <native.Text accessibilityLabel={info} style={{ color: colors.foregroundMuted }}>
              {"\u24d8"}
            </native.Text>
          </native.View>
          {children}
        </native.View>
      );
    },
    SettingsInput: ({ label, initialValue, onChangeText, disabled }) => {
      const colors = useContext(ThemeContext);
      return (
        <SettingsRow label={label}>
          <native.TextInput
            accessibilityLabel={label}
            defaultValue={initialValue}
            onChangeText={onChangeText}
            editable={!disabled}
            style={{
              color: colors.foreground,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 6,
              paddingHorizontal: 12,
              minWidth: 180,
              height: 32,
            }}
          />
        </SettingsRow>
      );
    },
    SettingsSwitch: ({ label, value, onValueChange, disabled }) => (
      <SettingsRow label={label}>
        <native.Switch
          accessibilityLabel={label}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
        />
      </SettingsRow>
    ),
    SettingsSelect,
    SettingsAction: ({ label, actionLabel, onPress, disabled }) => {
      const colors = useContext(ThemeContext);
      return (
        <SettingsRow label={label}>
          <native.Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onPress}
            disabled={disabled}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              minHeight: 32,
              paddingHorizontal: 12,
              justifyContent: "center",
            }}
          >
            <native.Text style={{ color: colors.foreground, fontSize: 14 }}>
              {actionLabel}
            </native.Text>
          </native.Pressable>
        </SettingsRow>
      );
    },
  },
};
const text = await (await fetch("/plugin.cjs")).text();
const contribution = new Function(`return ${text}`)()((name) => {
  if (!(name in modules)) throw new Error("Unavailable module: " + name);
  return modules[name];
});
let transformer;
let renderer;
let settingsScreen;
contribution.default({
  addTimelineTransformer(value) {
    transformer = value;
  },
  addTimelineRenderer(value) {
    renderer = value;
  },
  addSettingsScreen(value) {
    settingsScreen = value.Component;
  },
});
if (transformer.query.itemType !== "reasoning") throw new Error("Unexpected transformer");
const Component = renderer.Component;
function App() {
  const [state, update] = useState({
    text: "First **bold**.\n\nTail **still",
    phase: "streaming",
    dark: false,
    compact: false,
    identity: 1,
    screen: "thinking",
  });
  window.harness = {
    update: (next) => update((previous) => ({ ...previous, ...next })),
    settings: (values) => {
      publish({ values: { ...snapshot.values, ...values } });
    },
  };
  const colors = state.dark ? dark : light;
  document.body.style.background = colors.surface0;
  const transformed = transformer.transform({
    item: { type: "reasoning", text: state.text },
    phase: state.phase,
  });
  const item = transformed.items[0];
  renderer.schema.parse(item.data);
  const Settings = settingsScreen;
  if (state.screen === "settings")
    return (
      <ThemeContext.Provider value={colors}>
        <native.View style={{ height: "100vh" }}>
          <Settings
            theme={{ colors }}
            layout={{ platform: "web", compact: state.compact }}
            host={{ id: "test", label: "Test host" }}
          />
        </native.View>
      </ThemeContext.Provider>
    );
  return (
    <native.View style={{ padding: state.compact ? 16 : 32, maxWidth: 840, width: "100%" }}>
      <Component
        key={state.identity}
        item={item}
        theme={{ colors }}
        layout={{ platform: "web", compact: state.compact }}
        agentId="test-agent"
        timestamp="2026-10-19T00:00:00Z"
        host={{ id: "test", label: "Test host" }}
      />
    </native.View>
  );
}
createRoot(document.getElementById("root")).render(
  <query.QueryClientProvider client={new query.QueryClient()}>
    <App />
  </query.QueryClientProvider>,
);
