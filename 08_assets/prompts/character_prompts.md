# HOLOBEAT · 声卡角色视觉设定与位图生成提示词索引

> **完整可直接复制给 GPT Image 2 的 16 张声卡 + 12 枚贴纸 + 舞台背景提示词包，请直接使用**：[`gpt_image_2_pack.md`](./gpt_image_2_pack.md)

## 16 张声卡文件映射表（严格对齐 `05_web_app/src/data/artBriefs.ts`）

| 编号 | 名称 | 轨道 | 源文件落盘路径 (`08_assets/source/cards/`) | 优先级 |
| :--- | :--- | :---: | :--- | :---: |
| `#01` | 弄堂竹板梆子 | 街头律动 | `bamboo-cat.png` | **首批标杆** |
| `#02` | 老式街机拍键 | 街头律动 | `arcade-bot.png` | 第二批 |
| `#03` | 糖炒栗子爆壳 | 街头律动 | `chestnut-pop.png` | 第二批 |
| `#04` | 舞狮咚咚大鼓 | 街头律动 | `lion-drum.png` | 第二批 |
| `#05` | 二八大杠车铃 | 市井脆响 | `street-bell.png` | **首批标杆** |
| `#06` | 冰镇汽水拉环 | 市井脆响 | `soda-frog.png` | 第二批 |
| `#07` | 麻将碰杠脆碰 | 市井脆响 | `mahjong-fox.png` | 第二批 |
| `#08` | 货郎拨浪鼓 | 市井脆响 | `street-rattle.png` | 第二批 |
| `#09` | 像素街机投币 | 霓虹旋律 | `lucky-coin.png` | **首批标杆** |
| `#10` | 糖画铜勺叮当 | 霓虹旋律 | `sugar-spoon.png` | 第二批 |
| `#11` | 赛博古筝拨弦 | 霓虹旋律 | `cyber-zither.png` | 第二批 |
| `#12` | 摩天轮八音盒 | 霓虹旋律 | `ferris-box.png` | 第二批 |
| `#13` | 夜市铁板滋啦 | 烟火氛围 | `night-sizzle.png` | **首批标杆** |
| `#14` | 梅雨铁皮雨棚 | 烟火氛围 | `rain-cloud.png` | 第二批 |
| `#15` | 港风霓虹电流 | 烟火氛围 | `neon-tape.png` | 第二批 |
| `#16` | 晚风胡同蝉鸣 | 烟火氛围 | `cicada-moon.png` | 第二批 |
