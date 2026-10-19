import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const DEFAULT_ENDPOINT = "https://clients5.google.com/translate_a/t";
export const settingsSchema = z.object({
  enabled: z.boolean().default(true),
  targetLanguage: z.string().trim().min(2).max(20).default("zh-CN"),
  endpoint: z
    .url()
    .refine((value) => /^https?:\/\//.test(value))
    .default(DEFAULT_ENDPOINT),
});
export const settings = defineSettings({
  id: "thinking",
  scope: "host",
  version: 1,
  schema: settingsSchema,
});
export type Settings = z.output<typeof settingsSchema>;

export const failureSchema = z.enum([
  "network",
  "timeout",
  "rate_limit",
  "http",
  "invalid_response",
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
