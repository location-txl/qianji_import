import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, parseAppConfig } from "./config";
import { readAppConfig, writeAppConfig } from "./config-store";

describe("本地配置存储", () => {
  it("文件不存在时提供默认映射，并能原子保存自定义配置", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "qianji-config-"));
    const configPath = path.join(directory, "data", "config.json");
    const initial = await readAppConfig(configPath);
    const saved = await writeAppConfig(
      {
        ...initial,
        accounts: [...initial.accounts, "招商信用卡"],
        paymentMethodMappings: { ...initial.paymentMethodMappings, "招商银行信用卡(1113)": "招商信用卡" },
        categoryRules: [
          {
            id: "breakfast",
            source: "wechat",
            keyword: "便利店",
            startTime: "06:00",
            endTime: "10:00",
            category: "三餐",
          },
        ],
      },
      configPath,
    );

    expect(initial.paymentMethodMappings.余额宝).toBe("支付宝");
    expect((await readAppConfig(configPath)).paymentMethodMappings["招商银行信用卡(1113)"]).toBe("招商信用卡");
    expect(saved.categoryRules[0].category).toBe("三餐");
    expect((await readdir(path.dirname(configPath))).every((name) => !name.endsWith(".tmp"))).toBe(true);
  });

  it("拒绝没有目标分类的规则", () => {
    expect(() =>
      parseAppConfig({
        ...DEFAULT_CONFIG,
        categoryRules: [{ id: "bad", source: "all", keyword: "", startTime: "", endTime: "", category: "" }],
      }),
    ).toThrow("必须设置目标分类");
  });
});
