import type { TranslationResult } from "../shared/contract";

type Call = (input: { texts: string[] }) => Promise<{ results: TranslationResult[] }>;
type Pending = {
  text: string;
  resolve(value: TranslationResult): void;
  reject(error: unknown): void;
};

export function createBatchTranslator(call: Call) {
  let pending: Pending[] = [];
  let scheduled = false;
  function flush() {
    scheduled = false;
    const waiting = pending;
    pending = [];
    while (waiting.length) {
      const group: Pending[] = [];
      let length = 0;
      while (waiting.length && group.length < 32 && length + waiting[0].text.length <= 12000) {
        const item = waiting.shift()!;
        group.push(item);
        length += item.text.length;
      }
      void call({ texts: group.map((item) => item.text) })
        .then(({ results }) => {
          if (results.length !== group.length) throw new Error("Incomplete translation response");
          group.forEach((item, index) => item.resolve(results[index]));
        })
        .catch((error: unknown) => group.forEach((item) => item.reject(error)));
    }
  }
  return (text: string) =>
    new Promise<TranslationResult>((resolve, reject) => {
      pending.push({ text, resolve, reject });
      if (!scheduled) {
        scheduled = true;
        void Promise.resolve().then(flush);
      }
    });
}
