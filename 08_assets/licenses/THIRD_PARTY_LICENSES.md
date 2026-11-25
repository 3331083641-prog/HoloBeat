# HOLOBEAT 第三方开源组件与字体许可清单

本项目全部前端字体、核心交互库、音频引擎及后端框架均使用开源合规许可并支持完全本地离线运行。

## 一、本地打包字体（零在线 CDN 依赖）
1. **Noto Sans SC** (`@fontsource/noto-sans-sc`, weights 500/700/900)
   - 许可协议：SIL Open Font License 1.1 (OFL-1.1)
   - 用途：全站中文标题、正文、Canvas 标注与高清展板海报文字渲染
2. **Space Grotesk** (`@fontsource/space-grotesk`, weights 500/700)
   - 许可协议：SIL Open Font License 1.1 (OFL-1.1)
   - 用途：品牌主标 `HOLOBEAT` 与稀有度角标
3. **JetBrains Mono** (`@fontsource/jetbrains-mono`, weights 500/700/800)
   - 许可协议：SIL Open Font License 1.1 (OFL-1.1)
   - 用途：BPM、编号、音名与等宽声学参数读数

## 二、核心运行时依赖
- **React & React DOM** — MIT License
- **Vite & TypeScript** — MIT / Apache-2.0 License
- **Tailwind CSS** — MIT License
- **Zustand** — MIT License
- **Tone.js** — MIT License（Web Audio 实时合成与离屏 `Tone.Offline` PCM 渲染）
- **Matter.js** — MIT License（弹珠自由实验物理碰撞）
- **Lucide React** — ISC License（线性界面功能图标）
- **Fastify & @fastify/cors** — MIT License（可选本地归档与只读分享后端）
- **Zod** — MIT License（后端嵌套数据结构运行时校验）

## 三、创意与运动学原理致谢
- **Holo Motion 声音抛物线落点算法**：受开源项目 [Dancing Notes](https://github.com/SyanChen7/dancing-notes)（MIT License）的音乐时钟驱动抛物线落点思想启发，针对 HOLOBEAT 四轨市井声源家族与摇摆（Swing）毫秒时序独立重写为四类形态编码运动系统。
- **音频性质说明**：本项目 16 张声卡及全部导出 WAV 均基于 Web Audio API / Tone.js 程序化合成生成（受中式日常市井声景启发的程序化声音转译），不包含未经授权的商业录音采样，也不冒称实地田野录音或非遗原声采样。
