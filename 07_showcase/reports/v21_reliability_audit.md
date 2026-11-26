# HoloBeat 工程可靠性修复记录

本轮从 Antigravity 的 `feat/huacan-deep-redesign` 提交 `09c622618d833fda11e1aee54b149a8401b4ecbe` 派生。用户最初提供的 `ab5a0e5` 属于 main。V3 已有 32 步 A/B、角色插画、贴纸编辑和只读 HTML 展页。本轮直接验证这些入口，沿用其组件、样式、文案布局和素材。

| 范围 | 查到的问题和修复 | 主要文件 |
| --- | --- | --- |
| 铸造和恢复 | 单看写请求成功无法排除随后事务中止。等事务完成或 localStorage 原文回读匹配后，以同一次收藏写入的结果更新列表、序号和鉴赏选择。草稿仍可在存储故障后重试。分配编号时始终读取持久化的最大已用序号水位。 | `05_web_app/src/storage/holoDb.ts`、`src/store/useHoloStore.ts` |
| 作品身份 | 提交重试沿用独立的 requestId。共享 SHA‑256 算法按属性名排序，将数值规范为六位小数，保留贴纸顺序、位置、层级和旋转，以及乐谱、来源、角色和设计版本。历史作品保留原始 ID 和幂等键。 | `shared/card-content.ts`、`05_web_app/src/types/holo.ts` |
| 本机数据库升级 | IndexedDB 升至 v3。以原始数据备份、显式验证和写入版本记录迁移收藏，保留旧数据，淘汰无法验证的派生音频缓存。使用镜像修订的来源关系识别新旧和分叉。新旧标签页争用升级时返回可恢复错误。导入时按快照 ID 比对音乐，防止新版 FORGE 预览错误复用旧声纹。 | `05_web_app/src/storage/holoDb.ts`、`src/store/useHoloStore.ts` |
| 乐谱和音频 | 以快照已编译的音符事件、有效 A/B 段、BPM 和 Swing 为调度依据。离线 PCM 计入最后一个事件、释放和效果尾音，播放一遍选中的乐段。缓存核验内容摘要、渲染/音色/效果版本、采样参数、WAV 数据和波形。浏览器播放会话独立取消，停止后清理效果链。 | `05_web_app/src/audio/compositionEngine.ts`、`HoloAudioEngine.ts`、`wavExporter.ts`、`src/motion/holoMotion.ts` |
| WebM | 从同一份 WAV 解码出音轨，与新版导出 Canvas 合并录制。检查编码器和有效音视频轨；作品播放到含尾音的终点后停止。用户取消、页面隐藏、编码或绘制失败时释放轨道、计时器和 AudioContext。 | `05_web_app/src/utils/exportMotionCard.ts` |
| 归档校验和 SQL | 前后端共享嵌套 Zod 契约，验证 32 步数据、资源标识、数组大小、时间和谱系。SQLite 先检查原库，备份后在事务中升级；用唯一索引、外键及冲突响应保护作品和分享。已有子作品的父卡不可删除，删除叶子卡会撤销其分享。历史数据重新归档时比较实际已存字段。 | `shared/card-schema.mjs`、`06_backend/schema.sql`、`src/db.ts`、`src/server.ts` |
| 权限和分享 | 仅监听环回，核验 Host、来源和本机写会话。归档确认与创建分享分别反馈。读取 HTML 和 JSON 均检查撤销和有效期，重复分享复用有效链接。断网、取消、超时和 503 进入相应客户端状态。 | `06_backend/src/archiveDirectory.ts`、`src/server.ts`、`05_web_app/src/utils/backendClient.ts` |
| 验收 | 使用本机浏览器、独立测试库和临时浏览器配置运行已提交的新界面。等待真实事务和声纹生产，把缓存 WAV 解码并重新提取波形，将实际 Canvas 绘制时刻与同一 Web Audio 时钟上的音符调度时刻匹配；FFmpeg 分别解码 WebM 的音频和视频。 | `05_web_app/scripts/reliability_e2e.py`、`verify_and_capture.py`、前后端 `tests/` |

一轮真实混音测试发现，渲染器从浮点混音采样提取的声纹与最终 PCM16 解码结果最多相差 0.039。已改为在限幅和量化后从文件采样计算峰值和声纹；不同渲染器的历史“真实 PCM”标记在回读时失效，重新生成后再显示。

历史 main 的文字报告和 PCM 标志曾采用不同判据。V3 已有声纹角标，但角标或文件头单独出现仍无法证明缓存、波形和导出一致。本轮严格验收同时等待角标、读取缓存、解码 WAV 并逐条比较 28 根波形柱。测试运行时由 runner 计算每个布尔结果，所有必需断言和 SQLite 重启验证完成后才写入整体通过状态。

弹珠量化保留原始碰撞，预览、试听、合并与替换共用一个 1/16 时值网格。送入 BEAT 时的提示给出原始数、目标数、合并、移动、无效事件，以及力度、音高和时值调整数。同轨同格取最强碰撞，渲染使用选中格的力度、音高与时值参数。

可重复执行的命令、实际文件测量与已知边界分别见 [测试结果](v21_test_results.md)、[运行边界](v21_known_issues.md)。

## 完整修改路径

- `.gitignore`
- `05_web_app/package-lock.json`
- `05_web_app/package.json`
- `05_web_app/scripts/reliability_e2e.py`
- `05_web_app/scripts/verify_and_capture.py`
- `05_web_app/scripts/vite.reliability.config.ts`
- `05_web_app/src/audio/HoloAudioEngine.ts`
- `05_web_app/src/audio/compositionEngine.ts`
- `05_web_app/src/audio/pcm.ts`
- `05_web_app/src/audio/wavExporter.ts`
- `05_web_app/src/motion/holoMotion.ts`
- `05_web_app/src/storage/holoDb.ts`
- `05_web_app/src/store/useHoloStore.ts`
- `05_web_app/src/types/holo.ts`
- `05_web_app/src/utils/backendClient.ts`
- `05_web_app/src/utils/exportMotionCard.ts`
- `05_web_app/tests/audio-browser.ts`
- `05_web_app/tests/audio.test.ts`
- `05_web_app/tests/backendClient.test.ts`
- `05_web_app/tests/core.test.ts`
- `05_web_app/tests/storage-browser.ts`
- `05_web_app/tests/storage.test.ts`
- `06_backend/README.md`
- `06_backend/schema.sql`
- `06_backend/src/archiveDirectory.ts`
- `06_backend/src/db.ts`
- `06_backend/src/server.ts`
- `06_backend/tests/api.test.ts`
- `06_backend/tests/restart.mjs`
- `06_backend/tests/schema-v0.sql`
- `06_backend/tsconfig.json`
- `07_showcase/reports/e2e_metrics.json`
- `07_showcase/reports/test_and_perf_report.md`
- `07_showcase/reports/v21_known_issues.md`
- `07_showcase/reports/v21_reliability_audit.md`
- `07_showcase/reports/v21_test_results.md`
- `shared/card-content.ts`
- `shared/card-schema.d.mts`
- `shared/card-schema.mjs`
