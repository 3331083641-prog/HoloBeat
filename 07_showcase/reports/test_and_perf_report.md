# HOLOBEAT · 声卡造物局 — 工程测试、一致性与实测性能报告（V3.0）

- **测试时间**：`2026-11-25 23:45:00`
- **基线提交**：`ab5a0e5`（`feat/huacan-deep-redesign` 深度重构验证）
- **测试环境**：Windows 11 (`AMD64`) · Python `3.12.4` · Node.js `v24.15.0`
- **验证浏览器**：Google Chrome `158.0.8127.89` · Microsoft Edge `158.0.4370.33`
- **原始机器指标文件**：[`e2e_metrics.json`](./e2e_metrics.json)（本文所有数据 100% 与该文件严格一致）

---

## 一、全链路自动化测试总览

| 测试层 | 执行命令 | 结果 | 核心覆盖点 |
| :--- | :--- | :--- | :--- |
| 前端 TypeScript 与打包 | `tsc --noEmit && vite build` | **PASS (0 errors)** | 严格类型检查、本地离线字体打包、分包产物构建 |
| 核心引擎单元测试 | `npm test` (`05_web_app/tests/core.test.ts`) | **9 / 9 PASS** (136.8 ms) | 32 步 A/B 编译、1/2 小节真实时长、16→32 步历史迁移、贴纸位移生成新版本哈希、Swing 精确落点、弹珠量化失真统计、规则变奏、畸形 JSON 拦截、存储失败诚实报错 |
| 本地归档后端接口测试 | `npm test` (`06_backend/tests/api.test.ts`) | **2 / 2 PASS** (371.6 ms) | 幂等保存、谱系图、`/share/:token` 只读 HTML 展页、撤回后 404 失效页、Zod 嵌套畸形数据（非法 BPM / 越界贴纸 / 越界力度）严格 400 拦截 |
| 严格零容忍 Playwright E2E | `python 05_web_app/scripts/verify_and_capture.py` | **23 / 23 PASS** (0 Console/Page Errors) | 四工作台完整闭环、剧场快照防篡改、空弹珠拦截、真实 PCM 峰值与 UI 徽标分离校验、4 格式导出、IndexedDB 刷新留存、拆封重混与单调编号、4 视口零溢出与主按钮可点性、前后端只读分享展页实测 |

---

## 二、10 项核心一致性修复实测验收

1. **持久化失败绝不伪造成功**：单测注入写入失败模式，验证 `holoDb.saveMintedCards` 返回 `failed`，UI 展示错误恢复条并保留草稿、不递增 `#MY-XX` 编号。
2. **贴纸改动生成新版本**：单测与 E2E 均验证调整贴纸后 `buildMintIdempotencyKey` 变化并铸造出独立 `#MY-02`，而连续双击同一状态严格幂等。
3. **编曲剧场直送铸造快照一致**：E2E 验证从编曲台送入剧场后返回清空编曲台，再在剧场点击「送去闪卡铸造」，工坊仍完整保留原剧场 31 音符冻结快照（`pinballShowSnapshotPreserved: true`）。
4. **1 小节 / 2 小节真实时长**：移除强制最小 2 小节限制；实测 2 小节代表作《清晨弄堂》（116 BPM）导出 WAV 时长为 `5.018s`（精确 2 小节 `4.138s` + 真实混响尾音 `0.88s`）。
5. **试听与导出 WAV 100% 同源**：闪卡工坊「原声试听」直接播放缓存的标准离屏 WAV `Blob`（`holoAudio.playAudioBlob`）。
6. **Swing 摇摆与 Holo Motion 毫秒同步**：单测验证摇摆后的奇数步毫秒落点与 `evaluateSequencerTrackOrb` 落点误差为 0ms（基于同一 `getStepTimeMs` 时钟函数）。
7. **动态卡 WebM 完整时长导出与可取消**：移除 7000ms 硬截断，导出完整作品 `hutong-groove-motion.webm`（`1,210,611 B`，EBML 魔数 `0x1A45DFA3` 验证通过）并支持录制中 `AbortSignal` 随时取消。
8. **弹珠量化显式披露失真并支持原/量化试听对比**：E2E 验证量化预览条明确展示重叠合并数、平均/最大毫秒偏移（`pinballQuantizePreviewWithLossStats: true`）。
9. **严格测试门禁**：任何必需项为 `false` 即返回非零退出码；明确分离 `realPcmUiBadgeVisible` 与真实 WAV PCM 振幅峰值校验（实测 `peakAmplitude = 21571 > 120`）。
10. **后端只读分享 HTML 展页**：E2E 启动真实本地后端，同步 `#MY-01` 并实机打开 `/share/:token` 页面，验证「只读作品展页」与作品标题正常渲染（`backendShareHtmlShowcaseVerified: true`）。

---

## 三、四视口响应式与实测性能数据

### 1. 四档标准桌面视口（Chrome 158，零溢出 + 核心按钮视口内可点）

| 视口分辨率 | 01 声卡盲盒 | 02 插卡编曲 | 03 弹珠剧场 | 04 闪卡铸造 |
| :--- | :---: | :---: | :---: | :---: |
| **1920 × 1080** | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 |
| **1440 × 900** | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 |
| **1366 × 768** | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 |
| **1280 × 720** | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 | 无溢出 · 主按钮可点 |

### 2. 实测性能指标（2 秒连续 `requestAnimationFrame` 采样）

| 指标项 | 实测值 | 说明 |
| :--- | :--- | :--- |
| 首屏冷加载时间 | **1835.3 ms** | 本地 Vite 开发服务下含全套离线中文字体加载 |
| 盲盒页 Hero Card 舞台高度占比 (1080p) | **66.3%** | `ResizeObserver` 动态自适应 |
| 工坊页 Hero Card 舞台高度占比 (1080p) | **60.5%** | 兼顾上下按钮与 3D 倾斜安全边距 |
| 02 插卡编曲 Holo Motion 帧率 | **148.8 FPS** | 平均帧耗时 `6.72 ms`，最大帧耗时 `18.2 ms`（298 帧 / 2002 ms） |
| 03 弹珠剧场自由实验帧率 | **158.0 FPS** | 平均帧耗时 `6.33 ms`，最大帧耗时 `18.2 ms`（峰值 8 球 / 上限 20 球，峰值 7 粒子） |
| Chrome / Edge 控制台报错数 | **0 / 0** | 零 `console.error`，零未捕获 `pageerror` |

---

## 四、同源代表作导出产物校验（《清晨弄堂》 `#MY-01`）

| 导出文件 | 大小 | 实测校验结果 |
| :--- | :---: | :--- |
| [`hutong-groove-gallery-poster.png`](../exports/hutong-groove-gallery-poster.png) | `876,922 B` | PNG 魔数合法，精确 `1200 × 1600` 像素，含声音纹章与真实声纹 |
| [`hutong-groove.wav`](../exports/hutong-groove.wav) | `963,500 B` | `RIFF/WAVE` 合法，`48,000 Hz` 立体声 16-bit PCM，时长 `5.018 s`，峰值振幅 `21,571`（非静音） |
| [`hutong-groove.holobeat.json`](../exports/hutong-groove.holobeat.json) | `40,227 B` | `schema: "holobeat.project.v3"`，`kind: "minted-card"`，`code: "#MY-01"`，可重新导入并拆封重混 |
| [`hutong-groove-motion.webm`](../exports/hutong-groove-motion.webm) | `1,210,611 B` | EBML WebM 魔数 `0x1A45DFA3` 合法，按真实作品完整时长录制 |

---

## 五、如实披露的当前边界与局限
1. **视频容器格式**：浏览器原生 `MediaRecorder` 导出真实 `.webm` 动态卡；本机未预装 `ffmpeg`，因此不强行伪装或改后缀为 `.mp4`。
2. **高精位图资产状态**：当前 16 张声卡与 12 枚贴纸均为高质量原生 SVG 矢量渲染（离线零依赖、无缩放锯齿）；`08_assets/manifest.json` 已建立完整的外部高精度位图接入清单与 Prompt 规范，尚未落盘的外部位图均如实标注为 `external-raster-pending`。
3. **音画同步度量说明**：节拍台与编曲剧场通过共享 Web Audio 毫秒时钟（`getStepTimeMs` / `getSnapshotPlaybackMs`）实现算法级零漂移落点；实际端到端声卡输出延迟仍受操作系统与蓝牙音频设备硬件缓冲影响。
