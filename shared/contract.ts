import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const DEFAULT_ENDPOINT = "https://clients5.google.com/translate_a/t";
export const DEFAULT_GOOGLE_ENDPOINT = "https://translation.googleapis.com";
export const DEFAULT_MICROSOFT_ENDPOINT = "https://api.cognitive.microsofttranslator.com";

export const translationProviders = ["google-free", "google-cloud", "microsoft"] as const;
export type TranslationProvider = (typeof translationProviders)[number];
export const googleApiVersions = ["v2", "v3"] as const;
export type GoogleApiVersion = (typeof googleApiVersions)[number];

const httpUrl = z
  .url()
  .refine((value) => /^https?:\/\//.test(value), "Endpoint must use HTTP or HTTPS");

export const settingsSchema = z
  .object({
    enabled: z.boolean().default(true),
    provider: z.enum(translationProviders).default("google-free"),
    targetLanguage: z.string().trim().min(2).max(20).default("zh-CN"),
    /** Google's keyless `translate_a/t` endpoint. */
    endpoint: httpUrl.default(DEFAULT_ENDPOINT),
    googleVersion: z.enum(googleApiVersions).default("v2"),
    /** Base URL for Cloud Translation v2/v3; the version path is appended by the server. */
    googleEndpoint: httpUrl.default(DEFAULT_GOOGLE_ENDPOINT),
    googleApiKey: z.string().trim().max(500).default(""),
    googleAccessToken: z.string().trim().max(8000).default(""),
    googleProjectId: z.string().trim().max(200).default(""),
    microsoftEndpoint: httpUrl.default(DEFAULT_MICROSOFT_ENDPOINT),
    microsoftApiKey: z.string().trim().max(500).default(""),
    microsoftRegion: z.string().trim().max(40).default(""),
  })
  .superRefine((values, context) => {
    if (values.provider === "microsoft" && !values.microsoftApiKey) {
      context.addIssue({
        code: "custom",
        path: ["microsoftApiKey"],
        message: "Microsoft Translator requires an API key",
      });
    }
    if (values.provider !== "google-cloud") return;
    if (values.googleVersion === "v2" && !values.googleApiKey) {
      context.addIssue({
        code: "custom",
        path: ["googleApiKey"],
        message: "Google Cloud v2 requires an API key",
      });
    }
    if (values.googleVersion === "v3" && !values.googleAccessToken) {
      context.addIssue({
        code: "custom",
        path: ["googleAccessToken"],
        message: "Google Cloud v3 requires an OAuth access token",
      });
    }
    if (values.googleVersion === "v3" && !values.googleProjectId) {
      context.addIssue({
        code: "custom",
        path: ["googleProjectId"],
        message: "Google Cloud v3 requires a project ID",
      });
    }
  });

export const settings = defineSettings({
  id: "thinking",
  scope: "host",
  version: 2,
  schema: settingsSchema,
  migrate: (values, fromVersion) => {
    if (fromVersion >= 2) return values;
    const previous = values && typeof values === "object" ? values : {};
    return {
      provider: "google-free",
      googleVersion: "v2",
      googleEndpoint: DEFAULT_GOOGLE_ENDPOINT,
      googleApiKey: "",
      googleAccessToken: "",
      googleProjectId: "",
      microsoftEndpoint: DEFAULT_MICROSOFT_ENDPOINT,
      microsoftApiKey: "",
      microsoftRegion: "",
      ...previous,
    };
  },
});
export type Settings = z.output<typeof settingsSchema>;

export const failureSchema = z.enum([
  "network",
  "timeout",
  "rate_limit",
  "auth",
  "http",
  "invalid_response",
  "config",
  "disposed",
  "disabled",
]);
export type FailureCode = z.output<typeof failureSchema>;
export const translationResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("translated"),
    text: z.string(),
    sourceLanguage: z.string().nullable(),
  }),
  z.object({ status: z.literal("error"), code: failureSchema }),
]);
export type TranslationResult = z.output<typeof translationResultSchema>;

export const translate = defineRpc({
  name: "thinking.translate",
  input: z
    .object({ texts: z.array(z.string().min(1).max(1500)).min(1).max(32) })
    .refine(({ texts }) => texts.join("").length <= 12000),
  output: z.object({ results: z.array(translationResultSchema) }),
});

export const reasoningSchema = z.object({
  text: z.string(),
  phase: z.enum(["streaming", "complete"]),
});
export type Reasoning = z.output<typeof reasoningSchema>;
