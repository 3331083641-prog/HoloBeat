# 《声卡造物局》官方演示影片 · 内部制作记录

## 1. 成片概览与拍摄版本

- **对外成片名称**：`声卡造物局`（全片画面、封面、字幕与配音统一对外命名，零英文项目标识、零仓库/分支/提交号、零参赛名与本地路径泄露）
- **拍摄基准版本**：`main` 分支 @ `4be6bd5`（工作区干净；未改动 `05_web_app/` 与 `06_backend/` 业务代码，未清空用户日常卡册数据）
- **成片时长**：`02:36.70`（`156.70 秒`）
- **主成片规格**：`1920×1080`（16:9）、`30 fps` 恒定帧率、`H.264 High Profile (Level 4.1)`、`yuv420p (BT.709 TV-range)`、`AAC-LC 48 kHz 立体声 (256 kbps)`、广电响度 `-14.5 LUFS / -1.2 dBTP`、文件体积 `41.28 MB`、全片 FFmpeg 零解码错误校验通过。
- **拍摄隔离环境**：
  - 前端：`http://127.0.0.1:5173/`（当前 `main` 实时运行源码）
  - 独立本机归档后端：`http://127.0.0.1:3789/`，独立数据库 `07_showcase/film/capture/film-archive.sqlite`
  - 独立浏览器用户目录：Playwright 持久化独立配置，全程无痕隔离
  - 拍摄期内存品牌覆盖层：仅通过 Playwright `addInitScript` 在浏览器内存中将 UI 品牌字样映射为「声卡造物局」，不修改仓库源码

---

## 2. 创意判断与贯穿全片的同源作品线

影片围绕**「发现声音 → 动手编曲 → 弹珠实验与剧场演出 → 闪卡铸造与导出 → 本机展页与拆封重混」**的情感与交互弧线组织，由同一张核心声卡主角与两代同源作品贯穿始终：

| 角色 / 作品 | 关键设定 | 在片中的贯穿角色 |
| :--- | :--- | :--- |
| **核心声卡主角** | `#05 二八大杠车铃`（SSR · 棱镜光带 · 市井脆响） | 从片头起音、盲盒刮膜揭示、单卡试听、插卡编曲反拍、弹珠机关绑定，到两代闪卡主角与片尾收束清脆铃声，全程可辨 |
| **主作品 `#MY-01`** | **《铃响晴巷》** · `118 BPM` · `C 五声` · `32 步独立 A/B 乐句` · `摇摆 18%`<br>四轨：`#01 弄堂竹板梆子` / `#05 二八大杠车铃` / `#11 赛博古筝拨弦`（现场从 `#09 像素街机投币` 换卡升级）/ `#13 夜市铁板滋啦`<br>卡面：`UR` · `温暖金箔`（五材质对比后选定）· 3 枚边角哑光市井贴纸（双片竹板、全息星芒、双连音符） | 从零点亮打击垫、B 段规则变奏「问答」、弹珠量化合并、13 秒无旁白微缩街巷编曲剧场高潮、真实 5 步压印入册、同源 4 格式导出与本机只读展页，全部由同一份不可变快照驱动 |
| **第 1 代重混 `#MY-02`** | **《铃响晴巷 · 夜行版》**（谱系 `#MY-01 → 第 1 代`）<br>改编：氛围轨换 `#15 港风霓虹电流` · `C 小调` · `126 BPM` · B 段规则变奏「加密」· 开启「街巷回声」· `定向激光` 箔面 | 从卡册真实「拆封重混创作」还原 `#MY-01` 后即时改编并铸入本设备卡册，在片尾与 `#MY-01` 并列呼应 |

---

## 3. 完整章节与功能时间码

（详细精确时间码亦存放在 [`timeline_timecodes.json`](./timeline_timecodes.json)）

| 时间码 | 章节 | 覆盖功能与视听重点 |
| :--- | :--- | :--- |
| `00:00 – 00:07` | **00 片头 · 声卡造物局** | 二八车铃原声起音、16 张街巷声卡群像动态展开、Neo-Brutalism 主标题定版 |
| `00:07 – 00:24` | **01 声卡盲盒** | 机械拉杆扭取、真实手刮银膜揭示 `#05 二八大杠车铃`、全息光带倾转、**旁白退让单卡试听**、翻看卡背档案与程序化合成配方、16 卡图鉴抽屉与策展声景、装入节拍台实体飞卡 |
| `00:24 – 00:43` | **02 插卡编曲（四轨构建）** | 竹板律动→车铃反拍→霓虹旋律→换卡「赛博古筝」→叠加「夜市铁板」；**旁白退让单轨独奏**；音色/摇摆与单步音高/时值微调 |
| `00:43 – 00:56` | **02 插卡编曲（A/B 与演奏）** | 32 步独立 A/B 乐句翻页、复制 `A→B`、`A+B` 循环、规则变奏「问答」；切至「按住生效」现场演奏像素碎音、街巷回声、切拍重复 |
| `00:56 – 01:13` | **03 弹珠剧场 · 自由实验** | 声音斜板/弹簧碰珠/旋转叶轮/传送门组合、绑定车铃、发射连击与重力/弹性调节；8 秒碰撞录制送回节拍台 → **3.5 秒无旁白「听原录音 vs 听量化轨」清晰对比** → 一键合并进编曲 |
| `01:13 – 01:31` | **03 弹珠剧场 · 编曲剧场高潮** | 冻结《铃响晴巷》进入微缩街巷舞台与「展演模式」；**13 秒全程无旁白纯享**四轨专属形态（鼓槌方印/铜铃双环/星芒弦光/烟火云波）精准落点与终场声音纹章绽放 |
| `01:31 – 01:50` | **04 闪卡铸造** | 命名《铃响晴巷》、选主角二八车铃与 UR、五种全息材质（棱镜/星尘/激光/铬银/金箔）实景巡礼对比定选「温暖金箔」、3 枚哑光贴纸边角落位/缩放/旋转、真实 5 步压印仪式入册 `#MY-01` 与 **6.6 秒无旁白真声 PCM 试听** |
| `01:50 – 01:57` | **05 同源四格式成果** | 真实导出的 1200×1600 高清海报 PNG、5:7 原比例动态闪卡 WebM、48 kHz 无损音频 WAV（驱动实景频谱）与可编辑工程文件同框陈列 |
| `01:57 – 02:03` | **05 本机归档 · 只读作品展页** | 本机归档服务生成只读分享链接，打开只读作品展页并留白 **2.6 秒无旁白播放简化音符轮廓试听**（与前段完整无损作品音频清晰区分） |
| `02:03 – 02:27` | **06 工程导入与拆封重混** | 真实导入工程文件、从卡册对 `#MY-01` 执行「拆封重混创作」、切换港风霓虹电流/C 小调/126 BPM/加密变奏/街巷回声（**6 秒纯听夜行重混编曲**）、换定向激光箔面压印入册 `#MY-02《铃响晴巷·夜行版》` 并完整原声试听 |
| `02:27 – 02:36` | **07 片尾定版** | `#MY-01` 与 `#MY-02` 两代同源闪卡并列闪耀，收束至「声卡造物局」主标与单声 `#05 二八大杠车铃` 完整自然尾音 |

---

## 4. 音频与视觉素材来源说明

1. **产品界面与原声**：100% 采集自当前真实运行的「声卡造物局」Web 工作台与本机归档服务（Web Audio API / Tone.js 程序化声音合成，受中国街巷日常声景启发，非田野录音或非遗采样）。采用浏览器原生 `MediaRecorder`（48 kHz）+ CDP 30 fps 同步录屏，确保零卡顿、零爆音。
2. **普通话配音**：使用 Microsoft Edge Neural TTS `zh-CN-XiaoxiaoNeural` 本地脚本批量生成（[`source/generate_vo.py`](../source/generate_vo.py)），经 48 kHz 统一重采样、高通滤波与透明压缩处理。
3. **轻巧过渡音效与衬底**：由 [`source/generate_sfx_and_music.py`](../source/generate_sfx_and_music.py) 原创程序化合成（纸卡划过、箔面微光、潮玩按键弹跳与 118 BPM 柔和木琴衬底），仅用于片头、转场与工坊静默设计阶段，所有产品试听、对比、变奏与剧场段落均完全退让产品真声。
4. **动态包装与封面**：复用项目 `08_assets/optimized/` 官方实绘资产与真实导出的 `#MY-01`/`#MY-02` 海报、WebM 与 WAV 文件，通过 [`source/render_motion_packages.py`](../source/render_motion_packages.py) 逐帧确定性渲染。

---

## 5. 复拍、重配与重导出命令

在仓库根目录 `D:\HoloBeat` 下执行（所有缓存与产物均保留在 D 盘）：

```powershell
# 1. 启动隔离测试后端（3789）与前端（5173）
$env:HOST="127.0.0.1"; $env:PORT="3789"; $env:HOLOBEAT_DB_PATH="D:\HoloBeat\07_showcase\film\capture\film-archive.sqlite"
cd D:\HoloBeat\06_backend; npm start
# 另开终端：
$env:VITE_HOLOBEAT_API_URL="http://127.0.0.1:3789"
cd D:\HoloBeat\05_web_app; node .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173 --strictPort

# 2. 全自动实景采集（1080p 30fps 视频 + 48kHz 原声 + 13 张剧照 + 真实 4 格式导出物）
python D:\HoloBeat\07_showcase\film\capture\record_all_scenes.py
python D:\HoloBeat\07_showcase\film\capture\recapture_s07_s08.py

# 3. 合成普通话配音、原创音效衬底、动态包装与高清/480x270 封面
python D:\HoloBeat\07_showcase\film\source\generate_vo.py
python D:\HoloBeat\07_showcase\film\source\generate_sfx_and_music.py
python D:\HoloBeat\07_showcase\film\source\render_motion_packages.py

# 4. 混音出三轨 48kHz 分轨、烧录零遮挡中文字幕、生成 SRT 并封装 1080p 成片
python D:\HoloBeat\07_showcase\film\source\assemble_master_film.py
```

---

## 6. 产物与仓库同步清点

### 已同步至 GitHub 仓库（`origin/main`）
- **可编辑字幕与配音脚本**：`07_showcase/film/subtitles/{sheka_zaowuju_zh.srt, sheka_zaowuju_zh.ass, vo_script.json}`
- **高清与小尺寸封面**：`07_showcase/film/covers/{cover_1920x1080.png, cover_480x270.png, cover_480x270.jpg}`
- **13 张正式拍摄实景剧照**：`07_showcase/film/covers/stills/01_*.png` ～ `13_*.png`
- **两代同源作品真实导出物与工程文件**：
  - `07_showcase/film/source/{main-work-lingxiang-qingxiang.holobeat.json, remix-work-lingxiang-night.holobeat.json}`
  - `07_showcase/film/capture/exports/`（`#MY-01` 海报 PNG / 无损 WAV / 动态卡 WebM / 工程 JSON 与 `#MY-02` 海报 PNG / 无损 WAV / 工程 JSON）
- **可复现拍摄与后期工程脚本**：`07_showcase/film/source/*.py`、`07_showcase/film/capture/{record_all_scenes.py, recapture_s07_s08.py, capture_manifest.json}`
- **制作文档与时间码**：`07_showcase/film/docs/{creative_plan.md, production_notes.md, timeline_timecodes.json}`

### 仅本地保留（按要求不上传 GitHub，已由 `.gitignore` 排除）
- **1080p 正式主成片（含中文字幕）**：`D:\HoloBeat\07_showcase\film\renders\声卡造物局_演示影片_1080p.mp4`（41.28 MB）
- **1080p 纯净无字幕母版**：`D:\HoloBeat\07_showcase\film\renders\声卡造物局_纯净无字幕版_1080p.mp4`（~55 MB）
- **48 kHz 无损三轨分轨与总混音**：`D:\HoloBeat\07_showcase\film\audio/stems/{stem_vo, stem_product, stem_music_sfx}.wav` 与 `audio/master_mix_48k.wav`
- **原始录屏素材与中间动态包装**：`D:\HoloBeat\07_showcase\film\capture/{clips, motion}/`、`audio/{vo, music, sfx}/`
