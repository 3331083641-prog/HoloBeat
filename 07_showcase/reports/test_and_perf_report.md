# HoloBeat V2.0 — 自动化测试、兼容性与性能验收报告

> **测试时间**：2026-11-25 13:54  
> **验收标准**：全部数据均由本地真实构建、自动化测试与 Playwright 无头浏览器实测生成（原始结构化指标留存于 [e2e_metrics.json](./e2e_metrics.json)），严禁任何虚构或估算数据。

---

## 1. 构建与静态类型检查

| 工程模块 | 命令 | 结果 | 产物指标 |
|---|---|---|---|
| Web 前端 (`05_web_app`) | `npm run build` (`tsc --noEmit && vite build`) | **PASS (0 errors)** | `vendor-react` 4.73 kB gzip · `vendor-matter` 27.49 kB gzip · `vendor-tone` 67.33 kB gzip · `index` 165.25 kB gzip · CSS 22.81 kB gzip · 构建耗时 5.10s |
| 可选本地后端 (`06_backend`) | `npm run typecheck` (`tsc --noEmit`) | **PASS (0 errors)** | Fastify 5 + Zod + Node 24 内置 `node:sqlite` |

---

## 2. 自动化单元测试与接口测试

### 2.1 前端核心逻辑单元测试 (`05_web_app/tests/core.test.ts`)
执行命令：`npm test`（`node --experimental-strip-types --test tests/core.test.ts`）

- ✔ `Beat compiler respects Mute/Solo, Stutter doubling, and deterministic sorting` (1.43 ms)
- ✔ `CompositionSnapshot deep-clones BeatSnapshot for strict immutability` (1.52 ms)
- ✔ `Pinball quantization maps events onto 16 steps while preserving original recording` (0.30 ms)
- ✔ `Holo Motion parabolic trajectory hits exact anchor points at phase=0 and phase=1` (0.38 ms)
- ✔ `Sound Sigil seed and Mint idempotency keys are strictly deterministic` (0.43 ms)
- **结果**：**5 / 5 PASS**（总耗时 102.5 ms）

### 2.2 可选本地归档后端 API 测试 (`06_backend/tests/api.test.ts`)
执行命令：`npm test`（`node --experimental-strip-types --test tests/api.test.ts`）

- ✔ `HoloBeat Archive Backend: health, idempotent save, lineage & share lifecycle` (87.37 ms)
  - 覆盖：`/api/health`、`POST /api/cards` 首次创建 (`201`) 与同 `idempotencyKey` 幂等去重 (`200`)、父子变奏 `/api/lineage/:id` 血统溯源、`POST /api/shares` 生成只读令牌、`GET /api/shares/:token` 读取与 `DELETE /api/shares/:token` 吊销后返回 `404`。
- **结果**：**1 / 1 PASS**（总耗时 309.5 ms）

---

## 3. 端到端闭环验收（Playwright 真实浏览器）

执行脚本：[05_web_app/scripts/verify_and_capture.py](../../05_web_app/scripts/verify_and_capture.py)

| 验收链路 | 状态 | 实测观测结果 |
|---|---|---|
| 音频启动唤醒 (`POWER ON`) | **PASS** | 顺利解锁 Web Audio 并自动关闭待机条 |
| 01 GACHA 抽卡 + 刮膜/秒开 + 3D 全息悬停 | **PASS** | 成功触发出球舱门动效并揭晓 `UR #16 CICADA MOON` |
| 01 → 02 选轨装槽 (`SEND TO BEAT`) | **PASS** | 弹窗选轨并飞卡装入 `BEAT` 音轨，轨道真实替换 |
| 02 BEAT 播放 + Holo Motion 音符跳跃 | **PASS** | 4 轨发光音符球按 `Tone.Transport` 时钟沿抛物线实时跳跃 |
| 02 → 03 编曲剧场演出 (`PERFORM IN PINBALL`) | **PASS** | 冻结 38 个确定性事件送入剧场，4 轨光球与平台涟漪音画同步，零物理杂音 |
| 03 PINBALL 自由模式碰撞 + 8 秒时间轴录制 | **PASS** | 实测真实录制 `8S REC · 43 音符 (4.4s)`，彩点时间轴可见 |
| 03 → 02 弹珠量化幽灵预览 (`送节拍台`) | **PASS** | 出现 `QUANTIZE PREVIEW` 预览横幅与虚线幽灵格，支持对比原录音后合并/替换/取消 |
| 空弹珠录音防伪校验 (`emptyPinballGuard`) | **PASS** | 清空录音后点击 `REC TO FORGE` 明确提示拦截并停留在弹珠台，**绝不静默伪造样例音频** |
| 作品快照不可变性 (`snapshotImmutability`) | **PASS** | 捕获 `BEAT · 116 BPM · 74 音符` 至铸造草稿后，返回 02 清空节拍台，草稿仍保持 `74 音符` |
| 04 FORGE 真实 PCM 声纹提取 | **PASS** | 离线 `Tone.Offline` 渲染完成后左栏点亮 `REAL PCM` 与 `PCM VERIFIED +`（见实拍截图 `04_card_forge.png`） |
| 7 阶段铸卡仪式 + 编号 `#MY-01` | **PASS** | 真实等待渲染与 IndexedDB 落盘完成后落印，进入只读鉴赏态，不污染草稿 |
| 刷新页面持久化 (`IndexedDB + localStorage`) | **PASS** | `page.reload()` 后 `#MY-01 HUTONG GROOVE` 与声卡收藏完整恢复 |
| 拆封重混与血统追踪 (`UNSEAL & REMIX`) | **PASS** | 拆封 `#MY-01` 自动进入 02 BEAT 并点亮 `REMIX #MY-01·G1` 徽章，原藏品保持只读完好 |
| 删除后单调递增编号 (`monotonicSerialAfterDelete`) | **PASS** | 删除 `#MY-01` 后再次铸卡分配 `#MY-02`，永不产生编号复用冲突 |

---

## 4. 真实导出成品二进制校验

所有样品均由 Playwright 监听真实浏览器下载事件保存至 `07_showcase/exports/` 并完成二进制级校验：

| 导出格式 | 实测样品文件 | 文件大小 | 校验详情 |
|---|---|---|---|
| **3× 高清展板海报 PNG** | [hutong-groove-gallery-poster.png](../exports/hutong-groove-gallery-poster.png) | `1,174,137 B` (1.12 MB) | 合法 PNG 头 · 精确 `1200 × 1600` 分辨率 · 含声音纹章与真实 PCM 声纹 |
| **16-bit PCM 音频 WAV** | [hutong-groove.wav](../exports/hutong-groove.wav) | `967,324 B` (945 KB) | 合法 `RIFF/WAVE` 头 · `2 ch` 立体声 · `48000 Hz` · `16-bit PCM` · 实测峰值振幅 `24991 / 32767`（非静音） |
| **可重混工程包 JSON** | [hutong-groove.holobeat.json](../exports/hutong-groove.holobeat.json) | `30,500 B` (29.8 KB) | 合法 `schema: holobeat.project.v2` · 含完整快照、贴纸、声音纹章种子与谱系元数据 |

---

## 5. 跨浏览器与多分辨率兼容性实测

### 5.1 浏览器控制台零报错验收
| 浏览器 | 内核路径 | 控制台 Error 数 | 未捕获 PageError 数 | 四个工作台全遍历 |
|---|---|---|---|---|
| **Google Chrome** | `C:/Program Files/Google/Chrome/Application/chrome.exe` | **0** | **0** | **PASS** |
| **Microsoft Edge** | `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` | **0** | **0** | **PASS** |

### 5.2 四档标准分辨率零溢出矩阵 (`scrollWidth <= innerWidth` & `scrollHeight <= innerHeight`)
| 分辨率 | 01 GACHA | 02 BEAT | 03 PINBALL | 04 FORGE |
|---|---|---|---|---|
| `1920 × 1080` | 无水平/垂直溢出 | 无水平/垂直溢出 | 无水平/垂直溢出 | 无水平/垂直溢出 |
| `1440 × 900` | 无水平/垂直溢出 | 无水平/垂直溢出 | 无水平/垂直溢出 | 无水平/垂直溢出 |
| `1366 × 768` | 无水平/垂直溢出 | 无水平/垂直溢出 | 无水平/垂直溢出 | 无水平/垂直溢出 |
| `1280 × 720` | 无水平/垂直溢出 | 无水平/垂直溢出 | 无水平/垂直溢出 | 无水平/垂直溢出 |

---

## 6. 实时性能实测数据

| 观测指标 | 实测值 | 测试条件说明 |
|---|---|---|
| 首次加载耗时 (Dev Server) | `1829.9 ms` | 本地 Vite 开发服务器冷启 `networkidle` 实测（生产静态包已完成 `vendor-tone`/`vendor-matter`/`vendor-react` 分包） |
| `02 BEAT` + Holo Motion 抛物线跳跃动画 | **`123.1 FPS`** | 2007 ms 采样 247 帧（含 4 轨发光光球、拖尾、碰撞涟漪与频谱示波器） |
| `03 PINBALL` Free Jam 物理碰撞 + VFX | **`132.1 FPS`** | 2007 ms 采样 265 帧（固定步长 `FIXED_DT=16.67ms` + 增量刚体同步 + 对象池粒子） |

---

## 7. 诚实边界与环境说明

1. **动态视频卡导出 (`.webm`)**：已在 `05_web_app/src/utils/exportMotionCard.ts` 中基于浏览器原生 `HTMLCanvasElement.captureStream(30)` + Web Audio `MediaStreamDestination` + `MediaRecorder` 真实实现，并在 UI 中接入实时录制进度百分比；由于无头测试环境中无物理扬声器输出监听，本报告未伪造声画录屏文件，建议在真实桌面 Chrome / Edge 浏览器中现场点击 `04 FORGE` 底部「动态卡」按钮体验含原声 `.webm` 导出。
2. **可选后端 (`06_backend`)**：默认完全解耦，未启动时前端 100% 离线稳定运行且零网络报错；启动后端后可在 `04 FORGE` 藏品鉴赏面板中一键同步并生成局域网/本地只读分享链接。
