# Domain docs

## 布局与读取规则

本仓库采用 single-context 布局：

- 根目录 GLOSSARY.md：领域术语。
- docs/adr/：架构决策记录。

探索代码前读取 GLOSSARY.md 及相关 ADR。
文件不存在时直接继续；由 domain-modeling 在术语或决策确定后按需创建。

## 使用规则

议题、设计、实现和测试采用 GLOSSARY.md 定义的术语。
遇到术语缺口时，先核对项目现有用语，再交由 domain-modeling 整理。

提议与现有 ADR 冲突时，明确指出 ADR 编号、冲突和重议理由。

正式规格、决策和实施状态仍以 GitHub Issues 为准。
术语及 ADR 引用对应议题，避免维护第二套状态；
发现记录不一致时，明确指出并按对应议题核对。
