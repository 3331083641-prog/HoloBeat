# 2026-11-26 定点复审修复与真实验证

基线：e9ad983772c18aac6c39f3b2afb2abc94fa68023。开始与同步前均实际查询 GitHub main，没有新提交。根目录无磁盘 AGENTS.md，遵循对话提供的规则。旧 worktree、真实 SQLite、个人浏览器数据、图片内容均未修改。源码备份位于本机 .cache/review-baseline-e9ad983.zip。

## 受测版本与方法

- 产品代码：4820a617ee74de4727bda3b57661fb2812b9f6c2。
- Production preview：4820a617ee74de4727bda3b57661fb2812b9f6c2，与定点E2E相同。
- 录音恢复回归：4de723ee85d48122cbf22e7681228ad2586973fa；此后只修改归档客户端的canonical父编号核对，没有变更录音/存储/音频引擎。
- 最终交付在这些提交上增加报告、截图、README及CI运行时配置；main 启动验证另见下方记录。
- 本机 Node 24.15.0；GitHub Actions 配置与本机一致的 Node 24.15.0。
- Windows 安装版 Chrome 158.0.8127.89 / Edge 158.0.4370.33，Playwright headless 自动操作，使用临时浏览器上下文及临时 SQLite。
- 顺序：后端 /health=200、/generate=404（HoloBeat 没有此路由）→ 前端 → 浏览器。两浏览器 JS 错误均为0。没有人工听音结论。

## 定点修复与验证

| 问题 | 根因与修复 | 真实验证 |
|---|---|---|
| V2 覆盖有效草稿 | 非空快照转换失败原先变成null；现在明确拒绝，转换后统一当前Schema，存储再次验证；保存前不修改草稿/选择/编号/卡册 | broken snapshot、非法pinballEvents/scene/remixOrigin；失败后刷新恢复原作；合法空草稿、速度与零力度保留 |
| Forge 取消后仍响起 | 请求身份原先在渲染后建立；现在点击时建立，覆盖缓存、渲染、解码、播放，换卡/隐藏/卸载仅清理所属会话 | 冷缓存播放→暂停/换卡/切页/A停B；原生AudioBufferSourceNode stop/disconnect、旧onended清空 |
| 原录音/量化/Beat叠播 | 不同入口只停止部分音源；入口现在同步取消其他作品会话及准备任务，停止按钮停止全部作品试听 | 四种切换及停止；检查原录音timer、buffer音源、释放声部；跨过最后原音符时间观察旧回调不再执行 |
| 卡册编号冲突 | 全库serial/code唯一；SQLite user_version=3改为libraryId+本地编号唯一；旧数据使用legacy命名空间 | 两独立浏览器各自#MY-01成功；v0/v2备份升级、重复迁移、保留旧分享 |
| 归档恢复身份 | 导入后的本地ID被当成冲突；现在返回canonicalId和业务结果，客户端验证完整内容再分享 | 下载→另一卡册导入→归档/分享返回原归档；原作和重混均重新导入、父编号变化后也正确恢复；异内容复用requestId仍409；去重收据绑定请求 |
| 本地重混分享 | 子作品先归档被父约束拒绝；现在祖先→子作品顺序归档 | 本地原作→重混→一次分享；MISSING_PARENT/PARENT_METADATA_CONFLICT；不伪造祖先或清空来源 |
| 分享音高与清理 | MIDI少一个八度、缺升降号、零力度被默认值覆盖；修正公式与零力度，停止/隐藏/离开关闭节点和上下文 | C4=261.625565、A4=440、F#4=369.994423、Bb4=466.163762，误差<0.0001Hz；脚本断言及真实页面播放停止 |
| 来源与速度 | 剧场使用后来变化的编辑器来源；来源不持久化；Pinball拆封未恢复速度 | 冻结snapshot同时复制来源；来源随编辑器保存；A剧场不受B影响；编辑刷新后父/代数保留；150→84 BPM |
| 历史裁剪下载 | 不完整归档仍标成V3完整工程 | 下载前当前ProjectSchema验证；缺音乐信息仅raw-archive下载；受保护修复接口验证完整原件和留存字段、保存原始JSON审计；SQLite迁移→修复→实际下载→前端导入通过 |
| 键盘与子路径 | 打击垫/按住FX只支持指针；资源写死根路径 | Enter/Space打击垫、按下/松开/失焦释放FX；统一Vite BASE_URL；production根路径和/holobeat/验证 |

## 身份与数据策略

- id：本地藏品条目ID；首次归档默认成为archive ID。
- workId：导入时保留原作品稳定ID，后续导入继续保留；未设置时以原id作为稳定作品标识。
- libraryId + serialNumber/code：卡册内展示编号，不是全库身份。
- requestId：一次提交的重试身份；服务器收据绑定摘要和归档ID。
- contentHash：规范化完整创作内容（含父作品ID），不含本地编号/请求/存储状态。
- canonicalId：内容验证确认的归档ID；CREATED / UNCHANGED / RESTORED明确业务结果。客户端据此分享。
- 无本地祖先时后端可已有父作品；否则返回恢复错误。谱系采用可重试顺序归档，不是跨全谱系单一事务；失败时已归档祖先保留，不重复创建。

## 实际结果

| 检查 | 结果 |
|---|---|
| 前端 npm test | 57/57，保留原46项 |
| 前端 npm run build | 通过；既有大bundle、静态/动态混合导入提示保留 |
| 后端 npm run typecheck | 通过 |
| 后端 npm test | 52/52，保留原47项 |
| Chrome / Edge定点E2E | 各18/18，JS错误0 |
| SQLite真实进程重启 | 7→7作品（含历史原件） |
| Production root/subpath × Chrome/Edge | 4/4；每组真实解码29项WebP，资源错误0 |
| Production WAV下载 | 4/4 RIFF/WAVE；48kHz、双声道、16bit、dataSize=1080768、5.629秒；非静音，最后10ms峰值0 |
| 上轮自由弹珠录音恢复 | Chrome/Edge各14/14；实际碰撞→切页/刷新→量化→铸卡及8秒窗口 |

[定点机器结果](review_metrics.json) · [生产黑盒](review_preview_metrics.json) · [录音恢复](pinball_recording_metrics.json)。

截图：../screenshots/review-20261126，README展示本轮实际图片。成功标志均由断言产生。原API的“同内容应冲突”向量改成真实伪造内容哈希拒绝，以符合本轮内容恢复契约，没有删掉冲突验证。

修复前证据：将e9ad983原始源码解压至隔离.cache/review-before，运行相同新增存储/谱系回归，9项中8项失败，只有“有效草稿保存失败不修改状态”原先通过；另3项新增归档/分享回归在旧代码失败。原先通过的行为没有重复重写。测试工具本身曾修正undefined到null序列化、对象属性顺序比较、错误列出neon-dj位图、Python临时SQLite连接未关闭；不计作产品修复。

## 历史原件受控修复

只有拥有完整原件时调用POST /api/cards/:id/repair，body是完整MintedCard，携带与普通归档相同的本机写入session header；客户端提供repairArchivedCard(fullOriginal)。拒绝身份、留存字段、哈希冲突。archive_repairs保留原始JSON、修复JSON与时间；升级前另有.pre-v3-*.sqlite备份。修复后原分享令牌下载合法V3。缺少完整音乐原件只能下载.raw-archive.json，不编造随机音色种子、原始录音或场景；原档案行保持不变。

## 修改文件

- .github/workflows/reliability.yml
- 05_web_app/scripts/review_e2e.py
- 05_web_app/scripts/review_preview.py
- 05_web_app/src/assets/assetManifest.ts
- 05_web_app/src/audio/HoloAudioEngine.ts
- 05_web_app/src/components/artwork/CardArtwork.tsx
- 05_web_app/src/data/stickers.ts
- 05_web_app/src/pages/BeatDeckPage.tsx
- 05_web_app/src/pages/ForgePage.tsx
- 05_web_app/src/pages/PinballPage.tsx
- 05_web_app/src/storage/holoDb.ts
- 05_web_app/src/storage/schema.ts
- 05_web_app/src/store/useHoloStore.ts
- 05_web_app/src/types/holo.ts
- 05_web_app/src/utils/assetUrl.ts
- 05_web_app/src/utils/backendClient.ts
- 05_web_app/tests/backendClient.test.ts
- 05_web_app/tests/review.test.ts
- 06_backend/schema.sql
- 06_backend/src/db.ts
- 06_backend/src/server.ts
- 06_backend/tests/api.test.ts
- shared/card-schema.mjs

## 剩余边界

- 服务仍仅127.0.0.1，不提供公网账号或局域网访问。
- 分享试听仅简化振荡器音符轮廓，不是完整原声。
- 真实浏览器音源与解码PCM经过验证；没有物理扬声器听音结论，没有将headless操作写成人工桌面试听。
- 本轮生产WAV为黑盒实测；旧完整WAV/FX/WebM矩阵报告保留，未冒充本轮全部重跑。
- 不覆盖不同机器同时编辑同库、断电级损坏恢复及所有声卡驱动组合。
- 无完整原件的历史音乐缺失保留为原始存档下载，不承诺完整重混。

修复前原生音频复现：隔离e9ad983中，Chrome实际观察到冷缓存暂停后AudioBufferSource仍启动、原录音与快照同时存活、stopTransport后两者仍存活；[修复前机器证据](review_before_metrics.json)。本轮对应双浏览器测试断言这些旧行为已消除。
