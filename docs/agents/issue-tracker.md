# Issue tracker: GitHub

本项目正式规格、决策和工单只维护于本仓库 GitHub Issues。使用 gh CLI；从 git remote 推导仓库。

读取工单须包含正文、评论、标签和原生阻塞关系。创建实施工单时引用父规格，使用 GitHub 原生 dependencies/blocked_by 表示交付前置。下一片的本地实施须等前票本地验收记录回写并核对；解除原生阻塞须等前票远端交付验收完成并关闭。

历史 wayfinder 地图及决策票保留关闭状态作为依据。最新独立仓库边界以实施规格和当前工单为准；历史正文与评论中的 ZERP 同步切换计划已被独立开发、发布后接入的决定替代。

.scratch 仅用于临时推理、迁移备份和检查产物，不维护第二套正式规格或状态。

## Skill 操作约定

- Skill 要求新建工单时，创建 GitHub Issue；实施已有工单时，更新该工单。
- 获取相关工单时，使用 gh CLI 读取正文、评论、标签及原生阻塞关系。
- 多行正文写入临时文件，再通过 --body-file 提交。

## 工单更新操作

- 评论：`gh issue comment <number> --body "..."`；多行评论使用 `--body-file`。
- 添加或移除标签：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`；标签语义见 `docs/agents/triage-labels.md`。
- 关闭工单：`gh issue close <number> --comment "..."`；多行关闭说明先通过 `gh issue comment <number> --body-file <path>` 发布，再执行 `gh issue close <number>`。

## 实施与验收收尾

- 本地实施完成后、向用户报告完成前，将验收结果评论到对应工单：确切源码 SHA、实际验证命令及退出码、tgz SHA-256、审查结论、合成 Adapter 与真实 ZERP API/E2E 的证据边界，以及尚未完成的推送、CI 或发布事项。读取评论确认内容已写入，保留评论链接。
- 前票有上述本地验收记录且对应提交可核对时，可以开始下一片的本地实施；工单保持开放及原生阻塞关系，直到前票提交已推送、对应 SHA 的 CI 通过，且该票要求的远端交付验收完成。届时回写远端证据并关闭前票，再解除后票的原生阻塞。
- 本地验收、远端交付验收及真实 ZERP 接入分别报告；未完成的阶段明确写出，不以本地证据宣称远端或真实应用已通过。

## Pull requests as a triage surface

**PRs as a request surface: no.**
