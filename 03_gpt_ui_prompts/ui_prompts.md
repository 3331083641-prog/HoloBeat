# 《声卡造物局（HoloBeat Studio）》逐页 GPT 高保真 UI 生图提示词 & 1:1 可交互控件清单

> **使用建议（保证 4 张图 100% 风格锁死）**：
> 1. 请在 **同一个 GPT 对话窗口** 中依次发送以下 4 段提示词；生成第 2、3、4 张时，可在提示词开头附带一句“严格沿用上一张图的顶部导航栏、粗描边、硬投影与暖奶油白底色风格”；
> 2. 为杜绝生图文字乱码，画面内界面文字全部精简为极短潮玩英文/数字代码（如 `HOLOBEAT`、`BPM 120`、`PULL`、`MINT`），后续进入 `05_web_app` 代码开发时可 1:1 渲染完美清晰的中英双语界面；
> 3. 请将生成好的 4 张 16:9 效果图统一存入 `04_ui_mockups/`，建议命名为：
>    - `01_gacha.jpg`
>    - `02_beat_deck.jpg`
>    - `03_pinball_synth.jpg`
>    - `04_card_forge.jpg`

---

## 零、 全站共享顶部导航栏 1:1 交互映射（4 页通用 · 零死按钮）

| 画面区域 | 效果图可见控件 | 代码 1:1 交互实现方式 |
| :--- | :--- | :--- |
| 顶栏左侧 | `HOLOBEAT` 迷你全息闪卡 Logo 徽标 | 点击回到 `01 盲盒抽卡机`，Hover 触发微弱彩虹流光扫过与轻快机械键帽音效 |
| 顶栏居中 | 4 段式实体切换键：`01 GACHA` / `02 BEAT` / `03 PINBALL` / `04 FORGE` | 切换路由/活跃工作台，选中态立即切换对应主题高饱和色块并播放 `useHoloSfx('tab')`；后台音序器跨页保持连贯不断音 |
| 顶栏右侧-1 | 收集计数胶囊 `12/16` | 实时读取 Zustand `collection.length`，点击展开右侧快捷声卡抽屉或直达卡册 |
| 顶栏右侧-2 | 深炭黑 OLED 迷你条 `BPM 120` + 实时电平条 | 实时响应 `Tone.Analyser` 振幅跳动；点击可快速步进切换常用 BPM（90 / 110 / 120 / 140） |
| 顶栏右侧-3 | 方形静音开关按钮（扬声器图标） | 控制 `Tone.Destination.mute`，一键静音/唤醒全站音频，按下执行 `translate(3px, 3px)` 硬阴影压缩 |

---

## 页面 01：盲盒抽卡机（`01 盲盒抽卡机 · GACHA`）

### 🎨 GPT UI 生图提示词（可直接复制发送）

```text
Flat 2D orthographic desktop web application UI screenshot, 16:9 aspect ratio, full-bleed interface, crisp UI design, zero perspective tilt, no monitor frame, no laptop mockup, no desk background, no human hands.

【设计系统与材质对比 / Design System】
Neo-Brutalism tactile designer-toy synthesizer web app named "HOLOBEAT". Warm matte cream canvas background (#F7F3E9) with subtle oatmeal dot-grid pattern (#DDD6C7). Crisp ivory panels (#FFFDF8), thick solid deep-charcoal borders (3px #1A1A1F), zero-blur hard offset black drop shadows (6px 6px 0 #1A1A1F), rounded 14px corners. High-saturation pop accent colors: Electric Purple (#7C3AED), Persimmon Orange (#FF5C2B), Mint Cyan (#00D4AA), Lemon Yellow (#FFD60A). Strong material contrast between matte tactile hardware panels and gleaming iridescent holographic foil sheen trading cards.

【统一顶部导航栏 / Locked Top Navbar (72px height)】
Full-width #FFFDF8 top bar with 3px solid #1A1A1F bottom border.
- Left: Mini tilted iridescent holographic card icon + bold geometric logo "HOLOBEAT".
- Center: Recessed #EDE7D9 segmented pill bar with 4 crisp chunky buttons: "01 GACHA" (ACTIVE state filled with Electric Purple #7C3AED and white bold text), "02 BEAT", "03 PINBALL", "04 FORGE".
- Right: Card counter badge "12/16", compact dark charcoal OLED pill (#181820) showing "BPM 120" with 5 glowing Mint Cyan mini audio equalizer bars, and a square tactile speaker icon button.

【页面 01 三栏主工作区布局 / Page 01 Three-Column Layout】
1. LEFT PANEL (33% width) — Tactile Designer-Toy Blind-Box Gacha Machine:
   - Chunky Lemon Yellow (#FFD60A) & Ivory (#FFFDF8) neo-brutalist capsule toy machine housing with bold header strip "HOLO GACHA".
   - Clear rectangular display window showing colorful glossy toy capsules and miniature peeking sound card packs inside.
   - Right side of the machine features a prominent physical mechanical pull-lever with a glossy Persimmon Orange (#FF5C2B) round handle knob.
   - Bottom control cluster: oversized Persimmon Orange CTA button "PULL CARD" with thick hard shadow, secondary Mint Cyan pill button "QUICK UNBOX", and a chunky progress bar labeled "SSR PITY 4/5".

2. CENTER STAGE (41% width) — Hero 3D Holographic Sound Card Showcase (MAIN VISUAL FOCAL POINT):
   - Matte deep charcoal display vault (#181820) with subtle corner technical crosshairs and bursting colorful vector confetti shapes (stars, music notes, sparks) behind the card.
   - Centered oversized vertical collectible trading card (thick 3px #1A1A1F border, glowing rainbow border trim) displaying intense iridescent holographic foil sheen, prismatic rainbow light refraction diagonal streaks, sparkling metallic stardust highlights, and glossy specular glare.
   - Card artwork: bold playful flat-vector Chinese urban street-toy mascot illustration (retro arcade coin & glowing street bell motif), crisp top-left badge "SSR", top-right ID "#05", bottom bold card title "STREET BELL", and a subtle peeled silver scratch-off corner cue.
   - Below the dark display vault: 3 chunky tactile action buttons in a neat row: Mint Cyan "PLAY SOUND", Electric Purple "SEND TO BEAT", and Ivory "FLIP INFO".

3. RIGHT PANEL (26% width) — Sound Card Specs & Recent Deck:
   - Top ivory card panel: Rarity badge "SSR · PERC", compact dark OLED sound waveform visualizer showing bright orange wave spikes, 3 mini spec bars ("PUNCH", "SHINE", "VIBE").
   - Bottom ivory card panel titled "RECENT DECK": clean 2x3 grid of 6 miniature collectible sound cards in #EDE7D9 recessed slots, each with colorful borders and tiny diagonal iridescent foil glint strips.

Ultra-clean vector UI precision, crisp legible short uppercase labels, balanced whitespace, award-winning digital product design.
```

### 🕹️ 页面 01 逐控件 1:1 可交互实现清单（零死按钮保障）

| 序号 | 效果图控件名称 | 代码 1:1 交互实现与技术方案 |
| :---: | :--- | :--- |
| 1 | 盲盒机右侧 **拟物机械大摇杆（Pull Lever）** | 支持点击或 `pointerdown` 向下拖拽拉动；拉动过程播放程序化棘轮齿轮音效，拉到底触发盲盒机轻微震动（CSS Keyframes）+ 吐出新卡包动画 |
| 2 | 主行动大键 **`PULL CARD`** | 触发单抽流程（内置保底算法：3 抽保底 `SR+`，5 抽保底 `SSR/UR`），新卡在中央展台以银色刮刮乐涂层覆膜形态弹出 |
| 3 | 辅助按钮 **`QUICK UNBOX`** | 若当前处于刮卡态则一键破膜直出；否则直接跳过刮卡涂层瞬间抽卡展示 + 发射礼花 |
| 4 | 保底进度条 **`SSR PITY 4/5`** | 实时绑定 Zustand `pityCount` 状态，抽中 `SSR/UR` 后闪烁金光并重置计数 |
| 5 | 盲盒橱窗内彩色扭蛋球 | 点击橱窗可触发趣味摇晃晃动动效与清脆塑料碰撞微音效（隐藏小彩蛋） |
| 6 | 中央 **3D 全息声音闪卡（Hero Card）** | 监听 `pointermove` 直接写入 `--pointer-x/y`、`--rotate-x/y` 驱动 3D 倾角 + 4 层 `color-dodge` 彩虹折射 + 3 层矢量视差；新抽卡时上层覆盖 Canvas 刮刮乐涂层，按住擦除 `>=42%` 自动破膜爆礼花（`canvas-confetti`）并自动播放该卡招牌市井音效 |
| 7 | **`PLAY SOUND`** 试听键 | 调用 `HoloAudioEngine.previewCard(cardId)` 实时合成播放该市井声卡原声，同时驱动右侧 OLED 波形跳动与卡面微震 |
| 8 | **`SEND TO BEAT`** 装入节拍台键 | 将当前展示声卡自动装入 `02 插卡节拍台` 对应分类轨道卡槽，播放卡带锁紧音效并弹出 Toast 提示一键跳转 |
| 9 | **`FLIP INFO`** 翻卡键 | 触发 180° `rotateY(180deg)` 3D 翻面动画，卡背展示该音色的程序化合成公式、BPM 推荐与市井灵感故事 |
| 10 | 右上 **OLED 示波器 & 属性条** | 绑定实时 `Tone.Waveform` 节点绘制 Canvas 波形；属性条（`PUNCH / SHINE / VIBE`）随当前选中卡片动态平滑过渡 |
| 11 | 右下 **`RECENT DECK` 2×3 迷你卡槽** | 渲染已抽到的最新 6 张声卡；点击任意卡片立刻将其切换至中央 3D 展示台并试听声音，支持翻页查看全部已收集卡 |

---

## 页面 02：插卡节拍台（`02 插卡节拍台 · BEAT DECK`）

### 🎨 GPT UI 生图提示词（可直接复制发送）

```text
Flat 2D orthographic desktop web application UI screenshot, 16:9 aspect ratio, full-bleed interface, crisp UI design, zero perspective tilt, no monitor frame, no laptop mockup, no desk background, no human hands.

【设计系统与跨页一致规范 / Strict Cross-Page Consistency】
Exact same Neo-Brutalism designer-toy aesthetic as the HOLOBEAT web app: warm matte cream dot-grid canvas (#F7F3E9), crisp ivory hardware panels (#FFFDF8), recessed oatmeal trays (#EDE7D9), thick 3px #1A1A1F borders, zero-blur hard offset shadows (4px–6px #1A1A1F). Exact accent palette: Electric Purple (#7C3AED), Persimmon Orange (#FF5C2B), Mint Cyan (#00D4AA), Lemon Yellow (#FFD60A).

【统一顶部导航栏 / Locked Top Navbar (72px height)】
Identical #FFFDF8 top bar with 3px #1A1A1F bottom border.
- Left: Mini tilted iridescent holographic card icon + bold logo "HOLOBEAT".
- Center: Recessed #EDE7D9 segmented pill bar with 4 chunky buttons: "01 GACHA", "02 BEAT" (ACTIVE state filled with Persimmon Orange #FF5C2B and white bold text), "03 PINBALL", "04 FORGE".
- Right: Badge "12/16", dark charcoal OLED pill (#181820) showing "BPM 120" + Mint Cyan equalizer bars, and square speaker button.

【页面 02 掌机插卡节拍工作台布局 / Page 02 Beat Deck Layout】
1. TOP TRANSPORT & MASTER OLED BAR (14% height, full-width ivory hardware strip):
   - Left transport buttons: Mint Cyan play button "PLAY", Ivory stop button "STOP", Persimmon Orange record-to-forge button "REC CARD".
   - Center wide matte deep-charcoal OLED screen (#181820) rendering real-time multi-color neon frequency bars & pulsing geometric wave, flanked by scale-lock pill "PENTA C".
   - Right tempo & presets cluster: chunky BPM slider/stepper "BPM 120", mini rotary knob "SWING", preset pill buttons "MARKET", "NIGHT", "RAND", "CLEAR".

2. MAIN SEQUENCER CHASSIS (74% height, clean 4-row horizontal track matrix):
   Each of the 4 horizontal tracks has THREE tightly aligned modules from left to right:
   - LEFT: Physical Cartridge Sound-Card Slot (18% width) — Recessed dark charcoal slot (#181820) holding an inserted miniature holographic sound card with unmistakable iridescent holographic foil sheen, rainbow specular diagonal reflection, rarity micro-tag, and short title ("BAMBOO", "BELL", "COIN", "SIZZLE") plus an eject/swap icon.
   - MIDDLE: Compact Track Mixer (16% width) — Small square "M" (mute) and "S" (solo) tactile buttons, 1 chunky round neo-brutalist rotary knob ("TONE") with crisp indicator notch, and 1 thick horizontal volume slider bar ("VOL").
   - RIGHT: 16-Step Glowing Drum Pad Grid (66% width) — 16 crisp square tactile keycap pads arranged in 4 color-grouped beats (columns 1–4, 5–8, 9–12, 13–16). Active lit pads glow with solid high-saturation fills and crisp hard shadows matching each row's accent color:
     * Row 1 (BEAT): Electric Purple (#7C3AED) active pads
     * Row 2 (PERC): Persimmon Orange (#FF5C2B) active pads
     * Row 3 (MELODY): Mint Cyan (#00D4AA) active pads
     * Row 4 (VIBE): Lemon Yellow (#FFD60A) active pads
     Inactive pads are matte oatmeal (#EDE7D9) with 2px #1A1A1F borders. Column 5 features a bright vertical illuminated playhead highlight bar running top-to-bottom across all 4 rows.

3. BOTTOM LIVE FX DECK BAR (12% height):
   - 3 wide tactile DJ performance hold-pads side by side: Electric Purple "BITCRUSH", Persimmon Orange "STREET ECHO", Mint Cyan "STUTTER" with LED dot indicators, plus a right-aligned prominent CTA button "MINT THIS BEAT ->" in Lemon Yellow (#FFD60A).

Razor-sharp orthogonal grid alignment, zero text garbling, Teenage-Engineering meets Neo-Brutalist collectible toy polish.
```

### 🕹️ 页面 02 逐控件 1:1 可交互实现清单（零死按钮保障）

| 序号 | 效果图控件名称 | 代码 1:1 交互实现与技术方案 |
| :---: | :--- | :--- |
| 1 | 走带按键 **`PLAY` / `STOP`** | 启停 `Tone.Transport`（同时支持空格键快捷键）；运行中 `PLAY` 键 LED 闪烁并同步驱动第 1–16 列播放头扫光 |
| 2 | 灌录键 **`REC CARD`** / 底部 **`MINT THIS BEAT ->`** | 将当前 4 轨声卡配置、16×4 步进矩阵、BPM 与调式保存为作品快照写入 Zustand `activeComposition`，并无缝跳转至 `04 闪卡铸造屋` 准备铸卡 |
| 3 | 中央 **深炭黑 OLED 频谱屏** | 绑定 `Tone.FFT(32)` 实时分析总输出频谱，Canvas 60fps 绘制多色撞色电平柱与中心脉冲波形 |
| 4 | 调式锁胶囊 **`PENTA C`** | 点击循环切换 `五声 C` / `霓虹小调` / `都市爵士`（底层由 `tonal` 实时切换旋律轨音高映射，确保乱点不跑调） |
| 5 | **`BPM 120` 步进推杆** & **`SWING` 旋钮** | 拖动实时修改 `Tone.Transport.bpm.rampTo(val, 0.05)`（60–180）与 `Tone.Transport.swing`（0–0.6），旋钮支持垂直上下拖拽并配棘轮微音效 |
| 6 | 预设键 **`MARKET` / `NIGHT` / `RAND` / `CLEAR`** | `MARKET`（胡同早市）、`NIGHT`（赛博夜市）一键装载经典市井节奏与对应声卡；`RAND` 智能生成合规好听随机节拍；`CLEAR` 一键清空 16×4 矩阵 |
| 7 | 每轨左侧 **全息声卡插槽（4 个）** | 展示已插入卡片的实时微缩全息镭射反光；点击弹出“换卡抽屉”展示卡库中所有已收集的同类/跨类声卡，替换插入时播放 Switch 卡带式清脆锁紧音效；悬停可预览单音 |
| 8 | 每轨 **`M`（静音）/ `S`（独奏）键** | 立即控制该轨道 `Tone.Channel.mute` 与 `solo` 状态，按键切换高反差着色状态 |
| 9 | 每轨 **`TONE` 旋钮 & `VOL` 音量推子** | 垂直拖拽 `TONE` 旋钮实时调制该轨音高偏移或低通滤波器截止频率（`filter.frequency.rampTo`）；拖动 `VOL` 推子平滑调整通道音量（防拉链噪音） |
| 10 | **4×16 步进发光打击垫（64 键）** | 单击开关单步，支持 **按住连续横向拖动画笔涂抹/擦除**；点击即发轻微预览音；播放头经过活跃步时通过 `Tone.Draw.schedule` 同步触发键帽弹性放大 |
| 11 | 底部 3 个现场特效垫 **`BITCRUSH` / `STREET ECHO` / `STUTTER`** | 支持“按住生效（Momentary Hold）”或双击锁定，实时拉高总线上串联的 `Tone.BitCrusher`、`Tone.FeedbackDelay` 或触发 1/32 拍切拍重复特效 |

---

## 页面 03：物理弹珠琴（`03 物理弹珠琴 · PINBALL SYNTH`）

### 🎨 GPT UI 生图提示词（可直接复制发送）

```text
Flat 2D orthographic desktop web application UI screenshot, 16:9 aspect ratio, full-bleed interface, crisp UI design, zero perspective tilt, no monitor frame, no laptop mockup, no desk background, no human hands.

【设计系统与跨页一致规范 / Strict Cross-Page Consistency】
Exact same Neo-Brutalism designer-toy aesthetic as the HOLOBEAT web app: warm matte cream dot-grid canvas (#F7F3E9), crisp ivory panels (#FFFDF8), recessed oatmeal canvas (#EDE7D9), thick 3px #1A1A1F borders, zero-blur hard offset shadows. Exact accent palette: Electric Purple (#7C3AED), Persimmon Orange (#FF5C2B), Mint Cyan (#00D4AA), Lemon Yellow (#FFD60A).

【统一顶部导航栏 / Locked Top Navbar (72px height)】
Identical #FFFDF8 top bar with 3px #1A1A1F bottom border.
- Left: Mini tilted iridescent holographic card icon + bold logo "HOLOBEAT".
- Center: Recessed #EDE7D9 segmented pill bar with 4 chunky buttons: "01 GACHA", "02 BEAT", "03 PINBALL" (ACTIVE state filled with Mint Cyan #00D4AA and deep charcoal bold text), "04 FORGE".
- Right: Badge "12/16", dark charcoal OLED pill (#181820) showing "BPM 120" + Mint Cyan equalizer bars, and square speaker button.

【页面 03 物理弹珠音乐沙盒三栏布局 / Page 03 Pinball Synth Layout】
1. LEFT TOOLBELT PANEL (22% width, crisp ivory #FFFDF8 panel):
   - Section "BLOCKS" with 4 bold icon tool buttons in a 2x2 grid: "BLOCK" (tilted sound bar, ACTIVE Mint Cyan highlight), "BUMPER" (round spring peg), "SPINNER" (4-blade pinwheel), "PORTAL" (loop teleport pad).
   - Section "BIND CARD": vertical stack of 4 miniature collectible sound cards showing shimmering iridescent holographic foil sheen stripes in Purple, Orange, Mint, and Yellow — the active card is framed with a bold glow ring.
   - Bottom "PRESETS" row: 3 compact pill buttons "LOOP", "CASCADE", "CLEAR".

2. CENTER 2D PHYSICS STAGE (56% width — MAIN PLAYABLE CANVAS):
   - Large recessed warm oatmeal (#EDE7D9) blueprint dot-grid arena framed by a heavy 3px #1A1A1F border and hard shadow.
   - Top horizontal rail holding a chunky sliding mechanical ball emitter ("DROPPER") painted Lemon Yellow & Charcoal, releasing glossy high-contrast marbles (Persimmon Orange, Electric Purple, Mint Cyan with thick black outlines).
   - Inside the gravity canvas: playful arrangement of musical physics toys:
     * 4 tilted neo-brutalist Sound-Card Blocks skinned with glowing iridescent holographic foil sheen strips and short note badges ("C5", "D5", "G5", "A5").
     * 2 round chunky Persimmon Orange & Electric Purple Bumper Springs with concentric ring graphics.
     * 1 rotating Mint Cyan 4-blade Spinner Wheel in the middle.
     * 1 glowing Purple-Mint Portal Pad near the bottom catching balls to loop back to the top.
   - Active collision moment clearly illustrated in crisp 2D vector style: a falling marble strikes a holographic sound block, triggering concentric thick-outlined geometric shockwave rings, vector star bursts, and floating musical note glyphs right at the contact point.

3. RIGHT CONTROL & RECORDING POD (22% width, crisp ivory #FFFDF8 panel):
   - Top primary action buttons: oversized Mint Cyan button "DROP BALL", toggle button "AUTO ON" in Persimmon Orange.
   - Middle tactile physics sliders & knobs: "GRAVITY" slider, "RATE" slider, "BOUNCE" rotary knob, and scale selector pill "PENTA C".
   - Bottom dark charcoal OLED mini-display (#181820) labeled "HIT LOG" showing live combo counter "COMBO x18" and colorful scrolling note dots, followed by a chunky Lemon Yellow CTA button "REC TO FORGE ->".

Clean flat 2D vector art clarity, zero 3D perspective camera tilt on the UI frame, playful kinetic musical toy energy.
```

### 🕹️ 页面 03 逐控件 1:1 可交互实现清单（零死按钮保障）

| 序号 | 效果图控件名称 | 代码 1:1 交互实现与技术方案 |
| :---: | :--- | :--- |
| 1 | 工具坞 4 大机关选择键 **`BLOCK` / `BUMPER` / `SPINNER` / `PORTAL`** | 切换画布放置笔刷模式；选中后点击中央物理画布空白处即可生成对应 Matter.js 刚体机关（同时支持直接拖拽放置） |
| 2 | **`BIND CARD` 迷你全息声卡列表** | 读取用户卡库中已解锁的声卡；选中后新放置的机关或当前画布选中机关立即绑定该声卡音色、主题色与全息斜纹贴膜 |
| 3 | 预设场景按钮 **`LOOP` / `CASCADE` / `CLEAR`** | `LOOP` 一键搭建永动循环八音盒机关阵；`CASCADE` 搭建多层瀑布弹珠台；`CLEAR` 清空画布所有刚体与弹珠 |
| 4 | 顶部导轨 **弹珠发射器（DROPPER）** | 支持水平鼠标拖拽改变发射口 X 坐标，发射口实时指示弹珠落点垂直虚线 |
| 5 | **Matter.js 物理画布交互** | 1) 点击空白处放置新机关；2) 拖拽已有机关自由移动位置；3) 选中已有机关弹出悬浮微操作栏（顺/逆时针旋转 15°、切换五声音阶音高 `C4–A5`、删除机关）；4) 右键或点击删除键快捷移除 |
| 6 | **碰撞发声与几何动效** | 监听 `Matter.Events.on(engine, 'collisionStart')`，经 `90ms` 防抖与最小速度过滤后，按碰撞速度映射力度调用 `HoloAudioEngine` 触发对应声卡 + 音高发声，同时在 Canvas 粒子对象池生成扩散波纹、星芒与方块果冻缩放 |
| 7 | **`DROP BALL`** 手动发球键 | 立即在 `DROPPER` 当前坐标生成一颗带微弱随机初速的彩色高弹性弹珠（同屏上限 24 颗防卡顿） |
| 8 | **`AUTO ON`** 自动连发开关 | 按右侧 `RATE` 速率（支持节拍对齐）自动定时发射弹珠，营造永动物理音乐盒效果 |
| 9 | **`GRAVITY` / `RATE` 滑块 & `BOUNCE` 旋钮** | 实时更新 `engine.gravity.y`（0.2–2.2）、自动发球间隔（250ms–1600ms）与全局弹性系数 `restitution`（0.5–1.35） |
| 10 | 调式选择器 **`PENTA C`** | 切换所有画布机关的自动和声映射调式（五声大调 / 霓虹小调 / 宫商角徵羽），彻底避免不和谐碰撞音 |
| 11 | **`HIT LOG` 连击屏 & `REC TO FORGE ->`** | 实时统计碰撞连击并环形缓冲记录最近 8 秒的物理碰撞音符时间戳序列；点击 **`REC TO FORGE ->`** 将这段物理弹珠旋律封装为可回放作品快照，直接跳转 `04 闪卡铸造屋` 铸造专属弹珠音乐闪卡 |

---

## 页面 04：闪卡铸造屋（`04 闪卡铸造屋 · CARD FORGE`）

### 🎨 GPT UI 生图提示词（可直接复制发送）

```text
Flat 2D orthographic desktop web application UI screenshot, 16:9 aspect ratio, full-bleed interface, crisp UI design, zero perspective tilt, no monitor frame, no laptop mockup, no desk background, no human hands.

【设计系统与跨页一致规范 / Strict Cross-Page Consistency】
Exact same Neo-Brutalism designer-toy aesthetic as the HOLOBEAT web app: warm matte cream dot-grid canvas (#F7F3E9), crisp ivory panels (#FFFDF8), recessed oatmeal trays (#EDE7D9), thick 3px #1A1A1F borders, zero-blur hard offset shadows. Exact accent palette: Electric Purple (#7C3AED), Persimmon Orange (#FF5C2B), Mint Cyan (#00D4AA), Lemon Yellow (#FFD60A).

【统一顶部导航栏 / Locked Top Navbar (72px height)】
Identical #FFFDF8 top bar with 3px #1A1A1F bottom border.
- Left: Mini tilted iridescent holographic card icon + bold logo "HOLOBEAT".
- Center: Recessed #EDE7D9 segmented pill bar with 4 chunky buttons: "01 GACHA", "02 BEAT", "03 PINBALL", "04 FORGE" (ACTIVE state filled with Lemon Yellow #FFD60A and deep charcoal bold text).
- Right: Badge "12/16", dark charcoal OLED pill (#181820) showing "BPM 120" + Mint Cyan equalizer bars, and square speaker button.

【页面 04 闪卡铸造工坊与卡册三栏布局 / Page 04 Card Forge Layout】
1. LEFT CUSTOMIZATION CONSOLE (32% width, crisp ivory #FFFDF8 panel):
   - Block 1 "AUDIO SOURCE": pill toggle tabs "BEAT MIX" (active Persimmon Orange) & "PINBALL", paired with a tiny dark OLED audio-fingerprint strip.
   - Block 2 "CARD TITLE": chunky white input box with thick border reading "NEON NIGHT" + 3 rarity tag pills ("SSR", "UR" active in Magenta/Yellow, "LTD").
   - Block 3 "HOLO FOIL (5)" — HIGHLIGHTED MATERIAL SELECTOR: 5 square tactile swatches in a horizontal row displaying distinct holographic finishes:
     1) "PRISM" (active thick border, rainbow iridescent foil sheen)
     2) "SPARK" (silver stardust glitter foil)
     3) "CYBER" (cyan-violet diagonal laser scanlines)
     4) "CHROME" (liquid metallic silver-cyan swirl)
     5) "GOLD" (embossed molten gold foil)
   - Block 4 "STICKER PACK": clean 4x2 grid of playful neo-brutalist vector stickers (lightning bolt, smiling music note, retro cassette, star burst, pixel heart, lantern, flame, crown) inside crisp clickable cells.

2. CENTER HOLO CARD FORGE STAGE (38% width — MAIN VISUAL FOCAL POINT):
   - Matte deep charcoal forge stage (#181820) with crisp alignment corner brackets and subtle golden grid lines.
   - Centered giant custom collectible holographic trading card (thick 3px #1A1A1F frame, rounded 14px corners) radiating vivid iridescent holographic foil sheen, sweeping diagonal rainbow light reflection, metallic sparkle grain, and gloss flare.
   - Card face showcases: top-left gleaming "UR" badge, top-right "#MY-01", bold central graphic artwork + playful placed vector stickers (lightning bolt & smiling note), embedded colorful waveform fingerprint strip near the bottom, and crisp title "NEON NIGHT".
   - Below the dark forge stage:
     * Primary oversized Persimmon Orange CTA button "MINT TO BINDER" with bold hard shadow.
     * Secondary button row: Mint Cyan "EXPORT PNG", Electric Purple "EXPORT WAV", and Ivory "PLAY".

3. RIGHT COLLECTION BINDER (30% width, crisp ivory #FFFDF8 panel):
   - Header "MY BINDER" with 3 compact filter pills: "ALL" (active), "GACHA", "MINTED".
   - Recessed oatmeal binder page (#EDE7D9) showing a crisp 2x3 grid of 6 collected & self-minted miniature holographic sound cards stored in collectible sleeves, each exhibiting eye-catching diagonal iridescent holographic foil sheen strips, rarity badges ("SR", "SSR", "UR"), and short titles.

Museum-grade collectible toy aesthetic, spotless orthogonal flat UI, dramatic matte-vs-holographic surface contrast.
```

### 🕹️ 页面 04 逐控件 1:1 可交互实现清单（零死按钮保障）

| 序号 | 效果图控件名称 | 代码 1:1 交互实现与技术方案 |
| :---: | :--- | :--- |
| 1 | 音源绑定切换 **`BEAT MIX` / `PINBALL`** | 绑定用户在 `02 插卡节拍台` 编排的 4 小节节拍，或 `03 物理弹珠琴` 录制的碰撞旋律；同时根据音源实时生成独一无二的底部 **声纹条形码指纹** 印刻在卡面上 |
| 2 | 卡片标题框 **`NEON NIGHT`** & 稀有度标签 **`SSR` / `UR` / `LTD`** | 受控输入实时同步更新中央 3D 闪卡标题铭文与左上角发光品质徽章 |
| 3 | **5 种全息箔面材质色板（`PRISM` / `SPARK` / `CYBER` / `CHROME` / `GOLD`）** | 一键实时切换中央 3D 闪卡的 CSS 全息光谱层 + 噪点/光栅层配方，并同步更新离屏导出 Canvas 的全息合成材质参数 |
| 4 | **`STICKER PACK` 4×2 潮玩贴纸库** | 点击任意贴纸即添加一枚可交互贴纸至中央闪卡前景图层；在卡面上支持 **直接鼠标拖拽调整坐标、滚轮或双角点缩放/旋转、双击删除** |
| 5 | 中央 **3D 铸造预览大卡（Forge Card）** | 实时响应指针 3D 倾斜与选定全息箔面的彩虹折射反光；切换至“贴纸编辑模式/赏卡倾斜模式”无缝防误触 |
| 6 | 主行动大键 **`MINT TO BINDER`** | 执行“铸造成卡”：播放金属冲压+琶音闪耀音效，触发 `canvas-confetti` 定制礼花，生成唯一 ID 并连同音频序列/箔面材质/贴纸坐标持久写入 Zustand `mintedCards[]`（`localStorage` 永久离线留存），同时高亮刷新右侧卡册 |
| 7 | **`EXPORT PNG`** 高清导卡键 | 调用自研 **原生 Canvas 2D 双通道全息合成器**（使用 `globalCompositeOperation: 'color-dodge' / 'overlay'` 完美保留彩虹镭射光效，彻底避开 `html-to-image` 丢混合模式坑），100% 离线导出 `960×1344px`（3× 超清）带透明圆角的高清 PNG 闪卡图 |
| 8 | **`EXPORT WAV`** 导出音频键 | 调用 `Tone.Offline()` 在浏览器本地离屏高速渲染 4 小节完整混音/弹珠乐段为标准 16-bit PCM `.wav` 文件并触发本地下载 |
| 9 | **`PLAY`** 试听原声键 | 直接播放当前铸造闪卡所封印的完整音乐作品，同时令卡面内嵌的声纹条随音频实时跃动 |
| 10 | 右侧 **`MY BINDER` 过滤标签（`ALL` / `GACHA` / `MINTED`）** | 实时筛选展示“全部声卡 / 盲盒抽到的市井声卡 / 用户亲手铸造的专属作品卡” |
| 11 | **卡册 2×3 收藏卡位网格** | 鼠标移入对应卡位激活轻量斜向全息闪光；点击任意卡立即载入中央铸造台进行 3D 赏卡、原声试听、二次贴纸改装或高清导出（自铸卡支持删除） |
