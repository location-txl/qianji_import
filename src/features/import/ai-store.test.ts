import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readAISettings, writeAISettings, maskAISettings } from "./ai-store";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "ai-store-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const settingsPath = () => path.join(tempDir, "ai-settings.json");

describe("readAISettings", () => {
  it("returns defaults when file does not exist", async () => {
    const settings = await readAISettings(settingsPath());
    expect(settings.baseUrl).toBe("https://api.openai.com/v1");
    expect(settings.model).toBe("gpt-4o-mini");
    expect(settings.enabled).toBe(false);
    expect(settings.apiKey).toBe("");
  });
});

describe("writeAISettings", () => {
  it("writes and reads back settings", async () => {
    const p = settingsPath();
    const input = { baseUrl: "https://custom.api/v1", apiKey: "sk-abc123", model: "gpt-4o", enabled: true };
    const saved = await writeAISettings(input, p);
    expect(saved.apiKey).toBe("sk-abc123");

    const loaded = await readAISettings(p);
    expect(loaded.apiKey).toBe("sk-abc123");
    expect(loaded.baseUrl).toBe("https://custom.api/v1");

    // Verify file is valid JSON
    const raw = JSON.parse(await readFile(p, "utf8"));
    expect(raw.apiKey).toBe("sk-abc123");
  });

  it("normalizes empty values to defaults", async () => {
    const p = settingsPath();
    const saved = await writeAISettings({ baseUrl: "", model: "" }, p);
    expect(saved.baseUrl).toBe("https://api.openai.com/v1");
    expect(saved.model).toBe("gpt-4o-mini");
  });
});

describe("maskAISettings", () => {
  it("masks apiKey leaving last 4 chars", () => {
    const input = { baseUrl: "", apiKey: "sk-very-long-secret-key", model: "", enabled: false };
    const masked = maskAISettings(input);
    // Last 4 chars should be visible
    expect(masked.apiKey.endsWith("-key")).toBe(true);
    // Total length preserved
    expect(masked.apiKey.length).toBe(input.apiKey.length);
    // First char should be masked
    expect(masked.apiKey[0]).toBe("*");
  });

  it("returns unchanged when apiKey is empty", () => {
    const masked = maskAISettings({ baseUrl: "", apiKey: "", model: "", enabled: false });
    expect(masked.apiKey).toBe("");
  });

  it("handles short keys", () => {
    const masked = maskAISettings({ baseUrl: "", apiKey: "abc", model: "", enabled: false });
    expect(masked.apiKey).toBe("abc");
  });
});
