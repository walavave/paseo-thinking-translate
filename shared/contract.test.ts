import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENDPOINT,
  DEFAULT_GOOGLE_ENDPOINT,
  DEFAULT_MICROSOFT_ENDPOINT,
  settings,
  settingsSchema,
} from "./contract";

function parse(values: Record<string, unknown>) {
  return settingsSchema.parse(values);
}

describe("translation settings", () => {
  it("defaults to the keyless Google endpoint", () => {
    const values = parse({});
    expect(values.provider).toBe("google-free");
    expect(values.endpoint).toBe(DEFAULT_ENDPOINT);
    expect(values.googleVersion).toBe("v2");
    expect(values.googleEndpoint).toBe(DEFAULT_GOOGLE_ENDPOINT);
    expect(values.microsoftEndpoint).toBe(DEFAULT_MICROSOFT_ENDPOINT);
    expect(values.targetLanguage).toBe("zh-CN");
  });
  it("requires credentials for the selected provider", () => {
    expect(
      settingsSchema.safeParse({ provider: "google-cloud", googleVersion: "v2" }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        provider: "google-cloud",
        googleVersion: "v2",
        googleApiKey: "key",
      }).success,
    ).toBe(true);
    expect(
      settingsSchema.safeParse({ provider: "google-cloud", googleVersion: "v3" }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        provider: "google-cloud",
        googleVersion: "v3",
        googleAccessToken: "token",
      }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        provider: "google-cloud",
        googleVersion: "v3",
        googleAccessToken: "token",
        googleProjectId: "project",
      }).success,
    ).toBe(true);
    expect(settingsSchema.safeParse({ provider: "microsoft" }).success).toBe(false);
    expect(
      settingsSchema.safeParse({ provider: "microsoft", microsoftApiKey: "key" }).success,
    ).toBe(true);
  });
  it("rejects non-HTTP endpoints", () => {
    expect(settingsSchema.safeParse({ endpoint: "ftp://example.com" }).success).toBe(false);
    expect(settingsSchema.safeParse({ endpoint: "not a url" }).success).toBe(false);
  });
  it("migrates version 1 settings to the Google free provider", async () => {
    const migrated = await settings.migrate!(
      { enabled: false, targetLanguage: "ja", endpoint: "http://127.0.0.1:1/translate_a/t" },
      1,
    );
    const values = parse(migrated as Record<string, unknown>);
    expect(values).toMatchObject({
      enabled: false,
      provider: "google-free",
      targetLanguage: "ja",
      endpoint: "http://127.0.0.1:1/translate_a/t",
      googleApiKey: "",
      microsoftApiKey: "",
    });
  });
});
