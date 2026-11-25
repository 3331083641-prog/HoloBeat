# HoloBeat V2.0 · 真实展示资产与验收文档库 (`07_showcase`)

本目录收录 **HoloBeat V2.0** 的全部真实运行截图、升级前后对比基准、实际导出成品及自动化验收报告，所有文件均由真实运行环境捕获与生成。

## 目录结构

- **`screenshots/`** — V2.0 1920×1080 真实运行截图（共 8 张，覆盖全部核心创意场景）：
  - `01_gacha.png` — 01 盲盒抽卡工作台（全息 UR 声卡 + 物理出球舱门 + 音色特征面板）
  - `02_beat_deck.png` — 02 插卡节拍台（播放中 + Holo Motion 四轨抛物线跳跃音符实拍）
  - `03_pinball_free_jam.png` — 03 物理弹珠台 Free Jam（动态碰撞涟漪 + 可视化 8s 彩点录音时间轴）
  - `04_card_forge.png` — 04 闪卡铸造屋草稿态（声音纹章 + REAL PCM 声纹 + 贴纸自定义）
  - `05_pinball_performance.png` — 03 弹珠剧场 Choreographed Show（4 轨音高平台 + 同步光球 + 终场纹章预览）
  - `06_card_binder.png` — 04 个人卡册与只读藏品鉴赏态（声学存证表 + DEMO/原创区分 + 拆封重混入口）
  - `07_unseal_remix.png` — 拆封重混（Unseal & Remix）激活态（`REMIX #MY-01·G1` 谱系血统标识）
  - `08_beat_quantize_preview.png` — 弹珠录音量化回流 02 节拍台幽灵预览（虚线发光格 + 合并/替换/取消控制条）
- **`before/`** — V1.0 升级前 1920×1080 真实基准截图（4 张）
- **`exports/`** — 从运行中的前端直接触发下载并完成二进制校验的真实样品：
  - `hutong-groove-gallery-poster.png` — 1200×1600 展板级 3× 全息海报（含声音纹章与真实 PCM 声纹）
  - `hutong-groove.wav` — 48 kHz 立体声 16-bit PCM 离线渲染音频
  - `hutong-groove.holobeat.json` — `holobeat.project.v2` 可导入重混工程文件
- **`reports/`** — 自动化测试、跨浏览器兼容性与性能实测报告：
  - `test_and_perf_report.md`
  - `v2_upgrade_log.md`
  - `e2e_metrics.json`
