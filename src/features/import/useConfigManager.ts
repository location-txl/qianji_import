import { useEffect, useState } from "react";
import { DEFAULT_CONFIG, parseAppConfig } from "./config";
import type { AppConfig } from "./types";

export function useConfigManager() {
  const [config, setConfig] = useState<AppConfig>(structuredClone(DEFAULT_CONFIG));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message ?? "读取配置失败");
        }
        return parseAppConfig(payload);
      })
      .then((savedConfig) => {
        if (active) {
          setConfig(savedConfig);
        }
      })
      .catch((error: Error) => {
        if (active) {
          setMessage(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function updateConfig(next: AppConfig) {
    setConfig(next);
    setDirty(true);
    setMessage("");
  }

  async function saveConfig() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message ?? "配置保存失败");
      }
      setConfig(parseAppConfig(payload));
      setDirty(false);
      setMessage("配置已写入本机。");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return { config, dirty, saving, message, updateConfig, saveConfig };
}
