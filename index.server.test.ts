import { describe, expect, it } from "vitest";
import { translationConfig } from "./index.server";
import { settingsSchema } from "./shared/contract";

function values(overrides: Record<string, unknown>) {
  return settingsSchema.parse(overrides);
}

describe("translationConfig", () => {
  it("maps the free Google provider", () => {
    expect(
      translationConfig(
        values({ provider: "google-free", targetLanguage: "ja", endpoint: "http://local/free" }),
      ),
    ).toEqual({ provider: "google-free", language: "ja", endpoint: "http://local/free" });
  });
  it("maps Google Cloud v2 and v3", () => {
    expect(
      translationConfig(
        values({
          provider: "google-cloud",
          googleVersion: "v2",
          googleApiKey: "key",
          googleEndpoint: "http://local/google",
        }),
      ),
    ).toEqual({
      provider: "google-v2",
      language: "zh-CN",
      endpoint: "http://local/google",
      apiKey: "key",
    });
    expect(
      translationConfig(
        values({
          provider: "google-cloud",
          googleVersion: "v3",
          googleAccessToken: "token",
          googleProjectId: "project",
          googleEndpoint: "http://local/google",
        }),
      ),
    ).toEqual({
      provider: "google-v3",
      language: "zh-CN",
      endpoint: "http://local/google",
      accessToken: "token",
      projectId: "project",
    });
  });
  it("maps Microsoft Translator settings", () => {
    expect(
      translationConfig(
        values({
          provider: "microsoft",
          targetLanguage: "zh-TW",
          microsoftApiKey: "key",
          microsoftRegion: "eastasia",
          microsoftEndpoint: "http://local/microsoft",
        }),
      ),
    ).toEqual({
      provider: "microsoft",
      language: "zh-TW",
      endpoint: "http://local/microsoft",
      apiKey: "key",
      region: "eastasia",
    });
  });
});
