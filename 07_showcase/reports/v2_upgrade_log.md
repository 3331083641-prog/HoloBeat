# HoloBeat V2.0 — 深度产品升级与设计审计日志

本文档系统记录 **HoloBeat · 声卡造物局** 从 V1.0 到 V2.0 的全部核心架构重构、美学升级、交互机制与闭环打通详情。

---

## 一、核心艺术与产品定位升级

- **V1.0 状态**：四个精致的独立互动页面（抽卡机、16 步节拍台、物理弹珠台、闪卡编辑器），存在跨页状态耦合、试听与导出效果偏差、弹珠录音不可见且空录时回退假样例、查看旧卡会覆盖草稿等工程隐患。
- **V2.0 升级**：统一重塑为一座完整的数字声音造物工坊——**「让声音拥有形状，让节奏拥有生命，让创作成为可以收藏的记忆」（Collect Sound. Play Rhythm. Forge Memories.）**，真正打通：
  `01 GACHA 发现音色 → 02 BEAT 组织节奏与生命跳跃 → 03 PINBALL 自由物理实验 / 编曲剧场演出 ↔ 8s 录音量化回流 → 04 FORGE 真实声纹与声音纹章封印 → 藏品鉴赏 → 拆封重混 (Unseal & Remix) → 衍生谱系再创作`。

---

## 二、P0 级关键工程与音频隐患清零

| 问题编号 | V1.0 原有隐患 | V2.0 根治方案 |
|---|---|---|
| **P0-1** | 铸造草稿直接读取易变的 BeatDeck 实时状态，修改节拍会篡改尚未铸造的草稿 | 引入不可变 `CompositionSnapshot`（深度克隆 `BeatSnapshot` / `PinballSceneSnapshot` 与确定性 `PerformanceEvent[]`），一经捕获彻底冻结 |
| **P0-2** | 离线 WAV 导出缺少 `BitCrusher` / `Street Echo` / `Stutter`，且延迟不随 BPM 同步 | 重写 `wavExporter.ts` 与 `HoloAudioEngine.playCompositionSnapshot()` 共享完全一致的声学链路与 `stepSec * 3` 附点八分延迟，试听与导出 100% 一致 |
| **P0-3** | 空弹珠录音直接静默回退为内置假演示旋律 | 彻底删除伪造回退；`sendPinballToForge` 与 `setForgeSource('pinball')` 对 0 音符显式拦截提示；内置示例卡显式标注 `#DEMO-01` + `DEMO` 徽章 |
| **P0-4** | `mintedCards.length + 1` 生成卡号，删除旧卡后会产生重复 `#MY-xx`；连点铸卡产生重复卡片 | 引入持久化单调递增序列器 `nextMintSerial` + `mintInFlight` 锁 + 确定性 `idempotencyKey` 幂等防重 |
| **P0-5** | 点击右侧卡册旧卡会直接覆盖正在编辑的草稿 | 状态彻底拆分为 `forgeDraft`（编辑态）与 `inspectMintedId`（只读鉴赏态），提供「返回草稿」按钮互不污染 |
| **P0-6** | 所有卡片和缓存仅存 `localStorage`，容量有限且缺少迁移保护 | 新增 `src/storage/holoDb.ts` 封装 `IndexedDB (HoloBeatStudioDB)` 持久存储作品列表、草稿及规范 WAV/PCM 声纹缓存，并在升级前自动创建 `holobeat-backup-pre-v3` 备份 |
| **P0-7** | 默认缺少 `/favicon.ico` 导致控制台报 404 | 在 `index.html` 中内联原创全息四芒星 SVG Favicon，实现 Chrome 与 Edge 双端控制台 0 报错 |

---

## 三、P1 级核心创意与数字媒体艺术升级

1. **Holo Motion · 声音生命运动系统 (`src/motion/holoMotion.ts`)**：
   - 借鉴开源项目 **Dancing Notes (`SyanChen7/dancing-notes`, MIT)** 的抛物线音画同步思想，原创重构为适配 4 轨电子律动的实时音乐时钟运动学引擎。
   - 公式 $y(p) = y_{\text{lerp}}(p) - 4 \cdot h \cdot p \cdot (1 - p)$ 由 `Tone.Transport` 真实时钟驱动，在 $p=0$ 与 $p=1$ 时精确落点于打击垫中心，4 条轨道拥有差异化弹跳人格（BEAT 重击、PERC 脆弹、MELODY 灵动高弧、VIBE 漂浮辉光），支持一键开关「音符跳跃」与「演出视图」。
2. **03 PINBALL 双模式演进（FREE JAM + CHOREOGRAPHED SHOW）**：
   - **FREE JAM**：引入固定时间步长 `FIXED_DT = 1000/60`、页面隐藏暂停、单机关拖拽增量更新刚体（零世界重建抖动）、Undo/Redo、按音色家族差异化的碰撞粒子特效，以及可视化的 **8 秒滚动录音时间轴**（支持试听、清空、量化送节拍台、捕获送铸卡）。
   - **CHOREOGRAPHED SHOW**：从 02 BEAT 点击 `PERFORM IN PINBALL` 一键进入暗黑音乐剧场，完全屏蔽 Matter.js 杂音，由冻结快照驱动 4 轨光球沿确定性音高平台跃动，支持「剧场沉浸模式」，并在终场绽放作品专属「声音纹章」。
3. **弹珠录音 → 节拍台幽灵量化 (`Pinball → Beat Ghost Quantize`)**：
   - 在 02 BEAT 以半透明虚线发光格展示弹珠碰撞的 16 步量化预览，可随时试听原版未量化弹珠录音，并自主选择「合并至当前轨」「替换为量化轨」或「取消」。
4. **声音纹章 (`SoundSigil`) + 真实 PCM 声纹 + 7 阶段铸造仪式 + 拆封重混 (`Unseal & Remix`)**：
   - 区分**真实 PCM 声纹**（由离线渲染 `AudioBuffer` 的真实 RMS+Peak 提取）与**生成式声音纹章**（基于作品 FNV-1a 种子、4 轨能量占比与 16 瓣时间密度生成的艺术徽章）。
   - 铸造前真实等待离线音频渲染与 IndexedDB 落盘，再呈现 7 阶段压印仪式。
   - 任何已收藏作品均可点击 `UNSEAL & REMIX` 拆封回到 02 BEAT 或 03 PINBALL 继续创作第 N 代衍生版本（自动记录 `parentCardId`/`parentCode`/`lineageDepth` 血统），原版藏品保持只读完好。

---

## 四、V1.0 vs V2.0 视觉实拍对比索引

| 工作台 | V1.0 升级前基准 | V2.0 升级后实拍 | 核心进化亮点 |
|---|---|---|---|
| **01 GACHA** | [01_gacha_before.png](../before/01_gacha_before.png) | [01_gacha.png](../screenshots/01_gacha.png) | 新增物理出球舱门、克制静止/倾角爆发光学箔层、A/B 选轨装槽与跨页飞卡动效 |
| **02 BEAT** | [02_beat_before.png](../before/02_beat_before.png) | [02_beat_deck.png](../screenshots/02_beat_deck.png) | 新增 4 轨 Holo Motion 抛物线跳跃音符、5 组市井预置、1/2 Bar、重音力度、撤销重做、弹珠演出入口 |
| **03 PINBALL** | [03_pinball_before.png](../before/03_pinball_before.png) | [03_pinball_free_jam.png](../screenshots/03_pinball_free_jam.png) & [05_pinball_performance.png](../screenshots/05_pinball_performance.png) | 升级双模式（自由实验 + 编曲剧场）、可见 8s 彩点时间轴、按音色分化的碰撞视觉与剧场模式 |
| **04 FORGE** | [04_forge_before.png](../before/04_forge_before.png) | [04_card_forge.png](../screenshots/04_card_forge.png) & [06_card_binder.png](../screenshots/06_card_binder.png) | 草稿/鉴赏双态隔离、声音纹章、真实 PCM 校验、7 阶段铸印、拆封重混、PNG/WAV/JSON/WebM 全链路导出 |
