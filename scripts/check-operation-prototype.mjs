// #24 interaction proof only. No package publishing, production API or screenshots.
import { preview } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
let server, browser;
try {
  const root = resolve("examples/voucher-operation-prototype");
  server = await preview({
    root,
    configFile: resolve(root, "vite.config.ts"),
    preview: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== "string");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const button = (name) => page.getByRole("button", { name, exact: true });
  const status = (text) =>
    page.getByRole("status").filter({ hasText: text }).waitFor();
  await page.goto(`http://127.0.0.1:${address.port}`);
  await button("准备作废").click();
  await page.getByRole("dialog", { name: "完整办理预览" }).waitFor();
  await page.getByText("9007199254740993.0100", { exact: true }).waitFor();
  await button("取消预览").click();
  await status("未发送写入");
  assert.equal(
    await page.getByRole("listitem").filter({ hasText: "execute:" }).count(),
    0,
  );
  await page.getByLabel("合成情景").selectOption("save-failure");
  await button("准备作废").click();
  await button("确认作废").click();
  await status("本次未发送写入");
  assert.equal(
    await page.getByRole("listitem").filter({ hasText: "execute:" }).count(),
    0,
  );
  await page.getByLabel("合成情景").selectOption("unknown");
  await button("重试恢复").click();
  await button("准备作废").click();
  await button("确认作废").click();
  await status("结果未知");
  const requestText = await page
    .locator('section[aria-label="办理契约原型"] > p')
    .filter({ hasText: "原请求：" })
    .textContent();
  const requestId = requestText.match(/原请求：([^ ]+)/)[1];
  await button("普通读取").click();
  assert.ok(await button("准备作废").isDisabled());
  await button("卸载演示").click();
  await button("恢复演示").click();
  await status(`已恢复原请求 ${requestId}`);
  await page.reload();
  await status(`已恢复原请求 ${requestId}`);
  await page.getByLabel("操作者").selectOption("synthetic-b");
  await status("可以准备办理");
  assert.ok(await button("准备作废").isEnabled());
  await page.getByLabel("操作者").selectOption("synthetic-a");
  await status(`已恢复原请求 ${requestId}`);
  await page.getByLabel("合成情景").selectOption("wrong-proof");
  await button("核实原请求").click();
  await status("证据不匹配");
  assert.ok(await button("准备作废").isDisabled());
  await page.getByLabel("合成情景").selectOption("success");
  await button("核实原请求").click();
  await status("可显式开始新请求");
  assert.equal(
    await page.getByRole("listitem").filter({ hasText: "execute:" }).count(),
    0,
  );
  await page.getByLabel("合成情景").selectOption("seal-failure");
  await button("准备作废").click();
  await button("确认作废").click();
  await status("必须封存原请求");
  await button("封存原请求").click();
  await status("封存失败");
  assert.ok(await button("准备作废").isDisabled());
  await page.getByLabel("合成情景").selectOption("not-applied");
  await button("封存原请求").click();
  await status("可显式开始新请求");
  await page.getByLabel("合成情景").selectOption("refresh-failure");
  await button("准备作废").click();
  await button("确认作废").click();
  await status("只允许重读");
  await page.reload();
  await status("已恢复原请求");
  await button("重试读取").click();
  await status("可显式开始新请求");
  assert.equal(
    await page.getByRole("listitem").filter({ hasText: "execute:" }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      prototype: "#24",
      checks: [
        "preview/cancel",
        "durable-before-send",
        "full-page reload exact original recovery",
        "operator isolation",
        "ordinary read cannot unlock",
        "wrong proof stays locked",
        "seal before new request",
        "refresh-only retry",
      ],
      exitCode: 0,
    }),
  );
} finally {
  if (browser) await browser.close();
  if (server)
    await new Promise((resolve, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : resolve())),
    );
}
