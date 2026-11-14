import assert from "node:assert/strict";
export async function directModelSmoke(page) {
  await page.getByText("合成业务示例", { exact: true }).first().waitFor();
  await page.getByText("概览", { exact: true }).first().waitFor();
  await page.getByText("合成客户甲", { exact: true }).first().waitFor();
  const links = await page.getByRole("link").allTextContents();
  assert.ok(
    !links.includes("客户"),
    "nested collection must not become global navigation",
  );
  return { directBusinessModel: true, aggregateProjection: true };
}
