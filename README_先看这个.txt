SHOWROOM AI COACH V6 PRO

这版已经改成：
- 美式 / 英式自己选择
- 女声 / 男声自己选择
- 固定 4 个 Azure Neural Voice，不会随机出现俄语
  美式女：Ava
  美式男：Andrew
  英式女：Sonia
  英式男：Ryan
- 完整 Section 一次录音、一次真实评分
- 真实 Accuracy / Fluency / Completeness
- 美式 en-US：Azure 真实 Prosody（重音、语调、节奏）
- 英式 en-GB：Azure 目前不会返回 Prosody，因此系统明确显示“—”，不会伪造分数
- Weak Words
- Training History
- Print / Save PDF
- 课程进度和平均分

第一次使用：
1. 安装 Node.js LTS
2. 双击 1_配置Azure.command
3. 输入 Azure Speech Key 与 Region
4. 双击 2_启动系统.command

以后只需双击 2_启动系统.command。

重要：
没有连接 Azure 时，V6 不会给任何“模拟分数”。
