# HOLOBEAT · GPT Image 2 全套高精素材生图提示词包

本提示词包专为 **GPT Image 2（OpenAI Image Generation）** 调优，严格对齐项目 16 张声卡（`05_web_app/src/data/artBriefs.ts`）、12 枚市井贴纸与编曲剧场舞台背景。

---

## 一、GPT Image 2 生成参数与画风锁死流程（必看）

1. **分批生成策略（最稳的系列一致性方法）**：
   - **第 1 步（先出 4 张标杆）**：先生成 `01 弄堂竹板`（`bamboo-cat.png`），确认线稿粗细、哑光实体塑料/木纹/黄铜质感、留白安全区完全满意后，把这张图作为 **参考图（Reference Image）** 附在后续对话里，并加上一句：`Match the exact outline weight, matte designer-toy material finish, studio lighting, and framing of the reference image.` 再依次生成其余 3 张标杆与剩下 12 张！
2. **推荐输出规格与保存路径**：
   - **16 张声卡角色**：竖版 **2:3 / `1024×1536`**，**Transparent background（透明背景 PNG）** → 保存至 `D:\HoloBeat\08_assets\source\cards\<artId>.png`
   - **12 枚哑光贴纸**：方形 **1:1 / `1024×1024`**，**Transparent background（透明背景 PNG）** → 保存至 `D:\HoloBeat\08_assets\source\stickers\<stickerId>.png`
   - **1 张编曲剧场背景**：横版 **3:2 / `1536×1024`**，纯深炭黑底 `#14151B` → 保存至 `D:\HoloBeat\08_assets\source\scenes\pinball_stage_bg.png`
3. **构图铁律（避免裁切遮挡）**：
   - 所有声卡主体只占画布中央 **62%–68%**，**顶部至少留空 18%**（给 `SSR/UR` 角标与编号），**底部至少留空 24%**（给声纹条与中文铭牌），**画面内严禁出现任何文字、数字、字母或水印**。

---

## 二、首批 4 张视觉标杆主角卡（优先生成！）

### 1. `#01 弄堂竹板梆子` → `08_assets/source/cards/bamboo-cat.png`
```text
Contemporary Chinese designer toy figurine illustration of a playful street bamboo clapper percussion character ("Nongtang Bamboo Clappers"). Two warm polished natural bamboo wooden slats with subtle bamboo-node joints, tied at the top with a crisp vermilion-orange (#FF5C2B) braided cord knot and tiny brass rivets; the front cream-bamboo slat has minimal cute black dot eyes and a tiny cheeky smile while the back slat is anodized electric violet (#7C3AED). Clean bold uniform charcoal ink outlines (#1A1A1F), tactile matte vinyl and satin wood-grain finish, soft cel-shaded studio lighting, subtle mint (#00D4AA) and warm gold (#FFD60A) accents. Front-facing centered hero composition occupying 64% of frame with generous empty margin on top (18%) and bottom (24%) for trading card overlays. Pure transparent background, crisp edges, zero text, zero letters, zero watermark.
```

### 2. `#05 二八大杠车铃` → `08_assets/source/cards/street-bell.png`
```text
Contemporary Chinese designer toy illustration of a vintage hutong bicycle brass dome bell character ("Vintage Street Bell"). Glossy-satin golden yellow (#FFD60A) hemispherical metal bell dome with a vermilion-orange (#FF5C2B) rim base, a side mint-green (#00D4AA) thumb striker lever, and a matte charcoal handlebar clamp bracket underneath; minimal cute friendly eyes and smile cleanly integrated on the dome without hiding the iconic bell silhouette. Three delicate minimalist geometric sound-wave arcs floating lightly above the dome. Bold uniform #1A1A1F charcoal ink outlines, tactile matte enamel and brushed satin brass designer-toy texture, studio lighting. Centered hero composition with generous empty top margin (18%) and bottom margin (24%) for card UI. Pure transparent background, zero text, zero letters, zero watermark.
```

### 3. `#09 像素街机投币` → `08_assets/source/cards/lucky-coin.png`
```text
Contemporary designer toy illustration of a chunky retro Chinese arcade brass token coin character ("Pixel Arcade Coin"). A thick tactile golden-yellow (#FFD60A) embossed metal coin with a square center keyhole motif and tiny cheerful eyes, poised playfully just above a glossy mint-green (#00D4AA) and charcoal (#1A1A1F) retro arcade coin-slot bezel box with a warm vermilion (#FF5C2B) return button and two tiny crisp pixel-star sparkles floating beside it. Bold uniform #1A1A1F ink outlines, matte anodized metal and satin vinyl toy texture, clean studio shading. Centered vertical composition occupying 64% of frame with generous top (18%) and bottom (24%) safe margins. Pure transparent background, zero text, zero numbers, zero watermark.
```

### 4. `#13 夜市铁板滋啦` → `08_assets/source/cards/night-sizzle.png`
```text
Contemporary Chinese designer toy illustration of a lively night-market cast-iron sizzling griddle stove character ("Night Market Sizzle"). A wide rounded matte charcoal cast-iron griddle top with raised rim resting over a vibrant vermilion-orange (#FF5C2B) enamel stove body with minimal cheerful eyes and a warm glowing amber (#FFD60A) stove vent, two tiny stainless steel griddle spatulas angled cheerfully on left and right sides, and three stylized curling warm golden-cream steam ribbons rising smoothly above the hotplate. Bold uniform #1A1A1F charcoal ink outlines, tactile matte cast-iron and satin enamel designer-toy texture, warm night-market rim light. Centered hero composition with generous top (18%) and bottom (24%) margins. Pure transparent background, zero text, zero watermark.
```

---

## 三、其余 12 张声卡全量提示词（附带上述标杆作参考图以锁死画风）

### 5. `#02 老式街机拍键` → `08_assets/source/cards/arcade-bot.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy character of a chunky concave retro arcade push-button ("Arcade Smash Button"): deep electric violet (#7C3AED) concave circular plunger cap with crisp mint (#00D4AA) inner rim glow, resting on a warm cream (#F7F3E9) stepped housing collar with micro-switch legs underneath, minimal mischievous eyes nestled on the button rim. Bold #1A1A1F ink outlines, centered 64% frame with generous top/bottom margins, pure transparent background, zero text.
```

### 6. `#03 糖炒栗子爆壳` → `08_assets/source/cards/chestnut-pop.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy character of a roasted Chinese street chestnut ("Roasted Chestnut Pop"): plump glossy-satin chestnut shell in warm caramel brown (#9A4A1C) with a crisp jagged popped smile split revealing bright golden-yellow (#FFD60A) roasted flesh inside, perched over a mini matte black cast-iron roasting pan rim with tiny popping ember dots. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text.
```

### 7. `#04 舞狮咚咚大鼓` → `08_assets/source/cards/lion-drum.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy character of a traditional festive Chinese red street drum ("Lion Dance Bass Drum"): chunky vermilion-red (#FF5C2B) lacquered barrel drum ringed with golden brass studs (#FFD60A), warm cream drumhead with subtle concentric impact rings, two crossed wooden drumsticks resting playfully atop with minimal energetic eyes on the drum rim. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text.
```

### 8. `#06 冰镇汽水拉环` → `08_assets/source/cards/soda-frog.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy character of a chilled retro soda can pull-tab ("Fizzy Soda Tab"): cylindrical satin mint-green (#00D4AA) and cream soda can body with a popped silver metallic pull-tab tilted playfully like a little crest on top, tiny condensation beads and three crisp geometric sparkling bubbles floating above, minimal cheerful eyes on the can face. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text, zero brand labels.
```

### 9. `#07 麻将碰杠脆碰` → `08_assets/source/cards/mahjong-fox.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy illustration of two chunky Chinese mahjong tiles clacking mid-air ("Mahjong Crisp Clack"): glossy jade-emerald (#00D4AA) back layer fused to warm ivory-cream (#FFFDF8) rounded block front with an abstract geometric vermilion (#FF5C2B) emblem motif (no real Chinese characters), tilted dynamically at an impact angle with two crisp spark lines at the corner collision point and minimal witty eyes. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text.
```

### 10. `#08 货郎拨浪鼓` → `08_assets/source/cards/street-rattle.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy character of a classic Chinese street peddler's rattle drum ("Street Rattle Drum"): round vermilion-rimmed (#FF5C2B) cream parchment hand drum mounted on a warm wooden stick handle, with two playful golden-yellow (#FFD60A) wooden striker beads swinging symmetrically outward on taut red strings, minimal cheerful eyes centered on the drum skin. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text.
```

### 11. `#10 糖画铜勺叮当` → `08_assets/source/cards/sugar-spoon.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy character of a Chinese street sugar-painting brass ladle ("Sugar Painting Ladle"): tilted long-handled satin brass pouring spoon (#FFD60A & #FF5C2B enamel grip) with minimal sweet eyes on the ladle bowl, pouring a continuous translucent amber-gold swirled sugar ribbon onto a minimalist cream marble slab base below. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text.
```

### 12. `#11 赛博古筝拨弦` → `08_assets/source/cards/cyber-zither.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy object character of a compact neo-cyber guzheng zither ("Cyber Zither Pluck"): sleek angled trapezoidal dark indigo & magenta-rimmed (#FF3D9A) zither soundboard featuring luminous mint (#00D4AA) and gold (#FFD60A) parallel strings over three crisp geometric triangular bridges, accompanied by a floating four-point star sparkle above the plucking point. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text.
```

### 13. `#12 摩天轮八音盒` → `08_assets/source/cards/ferris-box.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy character of a miniature amusement park Ferris-wheel music box ("Ferris Music Box"): crisp dual-ring pastel mint (#00D4AA) and cream wheel with eight tiny colorful toy gondolas (#FFD60A, #FF5C2B, #7C3AED) mounted on a compact wind-up music box base with a golden winding key protruding from the side. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text.
```

### 14. `#14 梅雨铁皮雨棚` → `08_assets/source/cards/rain-cloud.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy diorama character of a Chinese alley corrugated tin rain awning ("Alley Tin Awning Rain"): sloped mint-teal and slate corrugated metal canopy with soft creamy cloud puff resting serenely on top with peaceful closed-eye smile, and five stylized glossy teal-mint (#00D4AA) raindrops hanging delicately below over concentric water ripples. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text.
```

### 15. `#15 港风霓虹电流` → `08_assets/source/cards/neon-tape.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy character of a retro 1990s translucent street audio cassette ("Neon Cassette Hum"): chunky beveled cassette shell in electric violet (#7C3AED) and warm amber-cream with twin spoked tape reels in mint (#00D4AA) and gold (#FFD60A) forming playful expressive eyes, framed by subtle glowing tube rim accents. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text, zero labels.
```

### 16. `#16 晚风胡同蝉鸣` → `08_assets/source/cards/cicada-moon.png`
```text
Match the exact designer-toy outline weight, matte vinyl texture, and card safe margins of the reference. Tactile designer toy character of a summer-evening hutong cicada ("Summer Cicada Breeze"): symmetrical translucent mint-teal (#00D4AA) veined geometric wings spread gracefully from a rounded satin gold (#FFD60A) and charcoal segmented body with minimal calm eyes, floating gently in front of a soft warm cream crescent-moon disk silhouette. Bold #1A1A1F outlines, centered with generous top/bottom margins, pure transparent background, zero text.
```

---

## 四、12 枚市井哑光模切贴纸（`1024×1024` 透明底 PNG）

> **强烈建议**：在 GPT Image 2 中可逐张生成，或按 4 枚一组生成 2×2 网格后切图。核心要求：**厚实纯白 `#FFFDF8` 模切纸边 + `#1A1A1F` 清晰描边 + 哑光质感（禁止加彩虹反光，以与闪卡全息箔拉开材质对比）**。

1. `clapper.png` — `Single die-cut matte vinyl sticker of Chinese twin bamboo clappers tied with a red cord knot, chunky #1A1A1F ink outline, thick pure cream-white (#FFFDF8) die-cut sticker border, flat tactile toy art, no holographic glare, transparent background, no text`
2. `bell.png` — `Single die-cut matte vinyl sticker of a yellow brass bicycle dome bell with tiny mint sound arc, chunky #1A1A1F ink outline, thick #FFFDF8 die-cut border, flat matte vinyl finish, transparent background, no text`
3. `coin.png` — `Single die-cut matte vinyl sticker of a golden arcade token coin with embossed musical note relief, chunky #1A1A1F ink outline, thick #FFFDF8 die-cut border, flat matte vinyl finish, transparent background, no text`
4. `spoon.png` — `Single die-cut matte vinyl sticker of a Chinese brass sugar-painting ladle dripping a golden amber swirl, chunky #1A1A1F ink outline, thick #FFFDF8 die-cut border, flat matte vinyl finish, transparent background, no text`
5. `spatula.png` — `Single die-cut matte vinyl sticker of crossed street-food steel griddle spatulas with warm orange accent, chunky #1A1A1F ink outline, thick #FFFDF8 die-cut border, flat matte vinyl finish, transparent background, no text`
6. `cassette.png` — `Single die-cut matte vinyl sticker of a retro violet and mint audio cassette tape, chunky #1A1A1F ink outline, thick #FFFDF8 die-cut border, flat matte vinyl finish, transparent background, no text`
7. `raindrop.png` — `Single die-cut matte vinyl sticker of a sleek teal-mint raindrop with concentric ripple ring underneath, chunky #1A1A1F ink outline, thick #FFFDF8 die-cut border, flat matte vinyl finish, transparent background, no text`
8. `cicada.png` — `Single die-cut matte vinyl sticker of a geometric translucent mint cicada wing with gold veins, chunky #1A1A1F ink outline, thick #FFFDF8 die-cut border, flat matte vinyl finish, transparent background, no text`
9. `bolt.png` — `Single die-cut matte vinyl sticker of a chunky golden-yellow lightning bolt badge, bold #1A1A1F outline, thick #FFFDF8 die-cut border, matte vinyl, transparent background, no text`
10. `note.png` — `Single die-cut matte vinyl sticker of a playful beamed double eighth musical note in mint green, bold #1A1A1F outline, thick #FFFDF8 die-cut border, matte vinyl, transparent background, no text`
11. `starburst.png` — `Single die-cut matte vinyl sticker of a crisp four-point starburst sparkle in vermilion orange and gold, bold #1A1A1F outline, thick #FFFDF8 die-cut border, matte vinyl, transparent background, no text`
12. `crown.png` — `Single die-cut matte vinyl sticker of a chunky designer-toy golden crown badge with violet gem dot, bold #1A1A1F outline, thick #FFFDF8 die-cut border, matte vinyl, transparent background, no text`

---

## 五、编曲剧场舞台背景（`1536×1024` 横版，仅边缘装饰，中央 ≥60% 留白）

保存路径：`08_assets/source/scenes/pinball_stage_bg.png`

```text
Minimalist flat architectural graphic backdrop for a 2D musical concert stage, aspect ratio 3:2. The central 65% of the canvas MUST remain completely calm, open, and uncluttered deep obsidian charcoal (#14151B) with only a barely visible micro technical dot grid so animated musical orbs remain 100% legible. Delicate planar Chinese street acoustic apparatus motifs frame ONLY the outermost 12% edges: a fine zigzag corrugated tin rain awning silhouette along the very top border in muted warm gold (#FFD60A at 20% opacity), slender brass bicycle-bell arch pillars along the far left and right margins in muted mint (#00D4AA at 22% opacity), and a minimalist horizontal strip of 16 wooden bamboo-slat boardwalk tiles along the bottom edge in muted violet (#7C3AED at 22% opacity). Clean editorial flat graphic style, zero perspective clutter, zero glowing lens flares, zero text, zero watermark.
```

---

## 六、生图完成后的接入流程
1. 把 GPT Image 2 生成好的图片直接放入 `D:\HoloBeat\08_assets\source\cards\`（及 `stickers/`、`scenes/`），按上方文件名命名。
2. 告诉我「图已放到 `08_assets/source/`，请接入项目」，我会帮你一次性完成：
   - 统一尺寸与 WebP/PNG 体积压缩输出到 `08_assets/optimized/` 与前端运行时目录；
   - 更新 `08_assets/manifest.json`（如实记录每张图的来源、尺寸、安全区与版本号）；
   - 将 `CardArtwork.tsx`、`exportHoloPng.ts` 和 `exportMotionCard.ts` 全部升级为优先渲染高精度位图（保留 SVG 作为瞬时兜底），并重跑 E2E 截图验收！
