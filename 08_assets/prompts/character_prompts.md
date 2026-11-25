# HOLOBEAT · 声卡角色视觉设定与位图生成提示词库

所有外部高精度位图（如后续使用手绘或 AI 绘图工具产出透明底 PNG 存入 `08_assets/source/cards/`）均须遵循以下统一美术规范：
- **构图比例**：竖版 5:7（导出 `1000×1400` 或 `1000×1150` 透明底 PNG），主体居中偏下，**顶部预留 16% 角标安全区**，**底部预留 22% 波形与铭牌安全区**。
- **风格基调**：当代中国市井潮玩器物插画，厚重干脆的 `#1A1A1F` 炭黑轮廓线，柔和哑光实体塑料/珐琅/黄铜微颗粒质感，局部高光克制，严禁画面中出现文字或水印。
- **角色人格规则**：以「真实市井发声器物本体」为第一识别锚点，表情与手脚克制点缀，拒绝通用卡通大眼猫脸掩盖器物轮廓。

---

## 一、四张标杆主角卡（V3.0 已在矢量层重构完毕）

### 01-竹板猫 (`bamboo-cat`, `#01 · 街头律动`)
> Contemporary designer toy illustration of a cute mischievous Chinese street bamboo clapper percussion character, two polished warm bamboo wooden slats with red knotted cord and subtle brass rivets, minimal expressive eyes, chunky bold #1A1A1F ink outlines, tactile matte vinyl and wood grain finish, warm cream #F7F3E9 studio lighting, electric violet #7C3AED and vermilion #FF5C2B accents, centered composition with generous top and bottom margins for trading card layout, no text, no watermark, clean transparent background

### 02-胡同车铃 (`street-bell`, `#05 · 市井脆响`)
> Designer toy character illustration of a vintage Chinese bicycle brass dome bell with thumb striker lever and handlebar clamp, crisp concentric sound-wave arcs radiating playfully, bold #1A1A1F outline, warm satin brass and enamel finish, mint #00D4AA and golden yellow #FFD60A accents, clean editorial vector-vinyl toy style, centered silhouette, generous margin at top and bottom, no text, no watermark

### 03-街机金币 (`lucky-coin`, `#09 · 霓虹旋律`)
> Designer toy illustration of a chunky retro arcade brass token coin half-inserted into a glowing mint-green metal coin slot, embossed musical note relief, tiny crisp pixel star sparkles, bold #1A1A1F outline, matte anodized metal texture, vermilion #FF5C2B and mint #00D4AA accents, clean flat-shaded tactile toy aesthetic, centered with card safe margins, no text, no letters

### 04-铁板夜市 (`night-sizzle`, `#13 · 烟火氛围`)
> Designer toy illustration of a lively Chinese night-market cast-iron sizzling griddle stove with crossed twin metal spatulas and three curling warm stylized steam ribbons, warm amber glow from stove vent, bold #1A1A1F outline, matte cast-iron and warm enamel texture, golden yellow #FFD60A and vermilion #FF5C2B accents on deep night indigo accent backdrop, clean tactile editorial toy art, centered with safe margins, no text

---

## 二、其余 12 张声卡完整 Art Brief（与 `05_web_app/src/data/artBriefs.ts` 严格对应）

| 编号 | 名称 | 核心发声器物 | 视觉主色与动效意象 |
| :--- | :--- | :--- | :--- |
| `#02` | 街机猛击 | 内凹街机重击大按键 | 电光紫 + 脆击像素脉冲 |
| `#03` | 炒栗爆响 | 黑铁炒锅与爆裂开口板栗 | 焦糖褐 + 金黄脆壳炸裂 |
| `#04` | 鼓楼低音 | 红漆双面大鼓与黄铜鼓钉 | 朱红 + 深沉低频波纹 |
| `#06` | 汽水开盖 | 玻璃汽水瓶与锯齿撬盖气泡 | 薄荷绿 + 升腾气泡星 |
| `#07` | 冰糖碎响 | 冰糖葫芦糖壳与竹签 | 亮朱红 + 玻璃糖晶碎芒 |
| `#08` | 弄堂木屐 | 红漆木屐双鞋与青石砖 | 暖木色 + 交替木质节拍 |
| `#10` | 糖画转盘 | 倾斜铜勺与金黄旋转糖丝 | 流金黄 + 弧线流淌光丝 |
| `#11` | 拨弦琴音 | 迷你中式月琴与拨片 | 薄荷青 + 弦振动波弧 |
| `#12` | 八音风铃 | 彩绘玻璃风铃与垂坠风签 | 冰湖蓝 + 柔和摇摆泛音 |
| `#14` | 廊檐雨滴 | 波纹铁皮雨棚与垂落雨珠 | 深海青 + 细密涟漪云雾 |
| `#15` | 磁带微醺 | 双卷轴复古老式透明磁带 | 暖琥珀 + 匀速旋转胶带 |
| `#16` | 夏夜蝉鸣 | 半透明叶脉蝉翼与月轮 | 琉璃青 + 轻颤泛光环 |
