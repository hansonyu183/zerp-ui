import assert from "node:assert/strict";
export async function voucherOperationSmoke(page) {
  const region = page.getByRole("region", {
    name: "单据办理消费者",
    exact: true,
  });
  const button = (name) => region.getByRole("button", { name, exact: true });
  const status = (text) =>
    region
      .getByRole("status", { name: "状态提示", exact: true })
      .filter({ hasText: text })
      .waitFor();
  await page.getByLabel("单据演示", { exact: true }).selectOption("operation");
  await button("验证合成存储终态").click();
  await region
    .getByText("storage-check:已拒绝封存终态回退并保留原证据", { exact: true })
    .waitFor();
  await button("准备作废").click();
  await region.getByRole("region", { name: "完整办理预览" }).waitFor();
  assert.deepEqual(
    JSON.parse(await region.getByLabel("办理保护状态").textContent()),
    { dirty: true, localPending: false, invalid: false, writeState: "idle" },
  );
  await region
    .getByRole("region", { name: "完整办理预览", exact: true })
    .getByText("9007199254740993.0100", { exact: true })
    .waitFor();
  await button("取消预览").click();
  await status("未发送写入");
  assert.equal(
    await region.getByRole("listitem").filter({ hasText: "execute:" }).count(),
    0,
  );
  await region.getByLabel("合成情景").selectOption("save-failure");
  await button("准备作废").click();
  await button("确认本次办理").click();
  await status("本次未发送写入");
  assert.equal(
    await region.getByRole("listitem").filter({ hasText: "execute:" }).count(),
    0,
  );
  await region.getByLabel("合成情景").selectOption("unknown");
  await button("重试恢复").click();
  await button("准备作废").click();
  await button("确认本次办理").click();
  await status("结果未知");
  assert.equal(
    JSON.parse(await region.getByLabel("办理保护状态").textContent())
      .writeState,
    "unknown",
  );
  const requestText = await page
    .locator('section[aria-label="单据办理"] > p')
    .filter({ hasText: "原请求：" })
    .textContent();
  const requestId = requestText.match(/原请求：([^ ]+)/)[1];
  await button("普通读取").click();
  assert.ok(await button("准备作废").isDisabled());
  await button("卸载演示").click();
  await button("恢复演示").click();
  await region
    .locator('section[aria-label="单据办理"] > p')
    .filter({ hasText: `原请求：${requestId}` })
    .waitFor();
  await page.reload();
  await page.getByLabel("单据演示", { exact: true }).selectOption("operation");
  await region
    .locator('section[aria-label="单据办理"] > p')
    .filter({ hasText: `原请求：${requestId}` })
    .waitFor();
  await region.getByLabel("操作者").selectOption("synthetic-b");
  await status("可以准备办理");
  assert.ok(await button("准备作废").isEnabled());
  await region.getByLabel("操作者").selectOption("synthetic-a");
  await region
    .locator('section[aria-label="单据办理"] > p')
    .filter({ hasText: `原请求：${requestId}` })
    .waitFor();
  await region.getByLabel("合成情景").selectOption("wrong-proof");
  await button("核对原办理回执").click();
  await status("证据不匹配");
  assert.ok(await button("准备作废").isDisabled());
  await region.getByLabel("合成情景").selectOption("no-evidence");
  await button("核对原办理回执").click();
  await status("证据不足");
  assert.ok(await button("准备作废").isDisabled());
  await region.getByLabel("核实资格").uncheck();
  assert.ok(await button("核对原办理回执").isDisabled());
  await region.getByLabel("核实资格").check();
  await region.getByLabel("合成情景").selectOption("success");
  await button("核对原办理回执").click();
  await status("可显式准备新请求");
  assert.equal(
    await region.getByRole("listitem").filter({ hasText: "execute:" }).count(),
    0,
  );
  await region.getByLabel("合成情景").selectOption("seal-failure");
  await button("准备作废").click();
  await button("确认本次办理").click();
  await status("必须封存原请求");
  assert.equal(
    JSON.parse(await region.getByLabel("办理保护状态").textContent())
      .writeState,
    "seal",
  );
  await button("封存未应用办理").click();
  await status("封存失败");
  assert.ok(await button("准备作废").isDisabled());
  await region.getByLabel("合成情景").selectOption("not-applied");
  await button("封存未应用办理").click();
  await status("可显式准备新请求");
  await region.getByLabel("合成情景").selectOption("refresh-failure");
  await button("准备作废").click();
  await button("确认本次办理").click();
  await status("只允许重读");
  assert.equal(
    JSON.parse(await region.getByLabel("办理保护状态").textContent())
      .writeState,
    "refresh",
  );
  await page.reload();
  await page.getByLabel("单据演示", { exact: true }).selectOption("operation");
  await status("已恢复原请求");
  await button("重试读取").click();
  await status("可显式准备新请求");
  assert.equal(
    await region.getByRole("listitem").filter({ hasText: "execute:" }).count(),
    0,
  );
  const other = await page.context().newPage();
  try {
    await other.goto(page.url());
    await other
      .getByLabel("单据演示", { exact: true })
      .selectOption("operation");
    const otherRegion = other.getByRole("region", {
      name: "单据办理消费者",
      exact: true,
    });
    await region.getByLabel("合成情景").selectOption("unknown");
    await Promise.all([
      button("准备作废").click(),
      otherRegion
        .getByRole("button", { name: "准备作废", exact: true })
        .click(),
    ]);
    await button("确认本次办理").click();
    await status("结果未知");
    await otherRegion
      .getByRole("button", { name: "确认本次办理", exact: true })
      .click();
    await otherRegion
      .getByRole("status", { name: "状态提示", exact: true })
      .filter({ hasText: "本次未发送写入" })
      .waitFor();
    assert.equal(
      await otherRegion
        .getByRole("listitem")
        .filter({ hasText: "execute:" })
        .count(),
      0,
    );
  } finally {
    await other.close();
  }
  await region.getByLabel("合成情景").selectOption("success");
  await button("核对原办理回执").click();
  await status("可显式准备新请求");
  const peer = await page.context().newPage();
  try {
    await region.getByLabel("合成情景").selectOption("unknown");
    await button("准备作废").click();
    await button("确认本次办理").click();
    await status("结果未知");
    await peer.goto(page.url());
    await peer
      .getByLabel("单据演示", { exact: true })
      .selectOption("operation");
    const peerRegion = peer.getByRole("region", {
      name: "单据办理消费者",
      exact: true,
    });
    const peerButton = (name) =>
      peerRegion.getByRole("button", { name, exact: true });
    await peerButton("核对原办理回执").waitFor();
    const before = await region
      .getByRole("listitem")
      .filter({ hasText: "refresh:" })
      .count();
    await region.getByLabel("合成情景").selectOption("success");
    await Promise.all([
      button("核对原办理回执").click(),
      peerButton("核对原办理回执").click(),
    ]);
    await status("可显式准备新请求");
    await peerRegion
      .getByRole("status", { name: "状态提示", exact: true })
      .filter({ hasText: "可显式准备新请求" })
      .waitFor();
    const refreshes =
      (await region
        .getByRole("listitem")
        .filter({ hasText: "refresh:" })
        .count()) +
      (await peerRegion
        .getByRole("listitem")
        .filter({ hasText: "refresh:" })
        .count()) -
      before;
    assert.equal(
      refreshes,
      1,
      "same journal recovery must refresh once across pages",
    );
    assert.ok(await button("准备作废").isEnabled());
    assert.ok(await peerButton("准备作废").isEnabled());
    // A late page must resolve its completed original even after a new request owns the slot.
    await region.getByLabel("合成情景").selectOption("unknown");
    await button("准备作废").click();
    await button("确认本次办理").click();
    await status("结果未知");
    await peer.reload();
    await peer
      .getByLabel("单据演示", { exact: true })
      .selectOption("operation");
    await peerButton("核对原办理回执").waitFor();
    await region.getByLabel("合成情景").selectOption("success");
    await button("核对原办理回执").click();
    await status("可显式准备新请求");
    await region.getByLabel("合成情景").selectOption("unknown");
    await button("准备作废").click();
    await button("确认本次办理").click();
    await status("结果未知");
    await peerButton("核对原办理回执").click();
    await peerRegion
      .getByRole("status", { name: "状态提示", exact: true })
      .filter({ hasText: "可显式准备新请求" })
      .waitFor();
    assert.ok(
      await button("准备作废").isDisabled(),
      "completed original must not clear the newer reservation",
    );
    await region.getByLabel("合成情景").selectOption("success");
    await button("核对原办理回执").click();
    await status("可显式准备新请求");
  } finally {
    await peer.close();
  }

  // Content uses the same durable protocol, including a server-assigned result after a real reload.
  await region.getByLabel("办理动作").selectOption("create");
  await region.getByLabel("原输入", { exact: true }).fill("创建的完整内容");
  await region.getByLabel("合成情景").selectOption("unknown");
  await button("准备创建").click();
  await button("确认本次办理").click();
  await status("结果未知");
  const originalCreate = await region
    .locator('section[aria-label="单据办理"] > p')
    .filter({ hasText: "原请求：" })
    .textContent();
  await page.reload();
  await page.getByLabel("单据演示", { exact: true }).selectOption("operation");
  await status("已恢复原请求");
  assert.equal(
    await region
      .locator('section[aria-label="单据办理"] > p')
      .filter({ hasText: "原请求：" })
      .textContent(),
    originalCreate,
  );
  await button("核对原办理回执").click();
  await status("可显式准备新请求");
  const result = region.getByLabel("合成 Adapter 结果", { exact: true });
  await result.filter({ hasText: "创建的完整内容" }).waitFor();
  await result.filter({ hasText: "9007199254740993.0100" }).waitFor();
  const createdId = (await result.textContent()).match(/SYN-created-[\w-]+/)[0];
  assert.equal(
    await region.getByRole("listitem").filter({ hasText: "execute:" }).count(),
    0,
    "reload recovery must not execute content again",
  );
  await button("编辑此结果").click();
  // The next library-owned preparation must use the authoritative result identity.
  await region.getByLabel("原输入", { exact: true }).fill("修改后的完整内容");
  await button("准备保存修改").click();
  await button("确认本次办理").click();
  await status("可显式准备新请求");
  await result.filter({ hasText: "修改后的完整内容" }).waitFor();
  assert.ok((await result.textContent()).includes(createdId));
  await region.getByLabel("目标单据").fill(createdId);
  await region.getByLabel("办理动作").selectOption("delete");
  // The saved result has not been explicitly adopted as a new editing baseline.
  // Changing the ordinary action still needs the page-owned discard decision.
  await page.getByRole("dialog", { name: "未保存修改", exact: true }).waitFor();
  await page.getByRole("button", { name: "放弃本地修改", exact: true }).click();
  await region.getByLabel("合成情景").selectOption("refresh-failure");
  await button("准备删除").click();
  await button("确认本次办理").click();
  await status("只允许重读");
  await page.reload();
  await page.getByLabel("单据演示", { exact: true }).selectOption("operation");
  await status("已恢复原请求");
  await button("重试读取").click();
  await status("可显式准备新请求");
  await result.filter({ hasText: createdId }).waitFor();
  assert.equal(JSON.parse(await result.textContent()).deleted, true);
  assert.equal(await button("编辑此结果").count(), 0);
  assert.equal(
    await region.getByRole("listitem").filter({ hasText: "execute:" }).count(),
    0,
    "deletion refresh retry must not execute again",
  );
  await region.getByLabel("办理动作").selectOption("create");
  await region.getByLabel("合成情景").selectOption("cleanup-failure");
  await button("准备创建").click();
  await button("确认本次办理").click();
  await status("合成清理失败");
  const durableResultId = (await result.textContent()).match(
    /SYN-created-[\w-]+/,
  )[0];
  await page.reload();
  await page.getByLabel("单据演示", { exact: true }).selectOption("operation");
  await result.filter({ hasText: durableResultId }).waitFor();
  await button("重试读取").click();
  await status("可显式准备新请求");
  assert.equal(
    await region.getByRole("listitem").filter({ hasText: "refresh:" }).count(),
    0,
    "result delivery must not repeat a durable completed refresh",
  );
  await page.reload();
  await page.getByLabel("单据演示", { exact: true }).selectOption("operation");
  await result.filter({ hasText: durableResultId }).waitFor();
}
