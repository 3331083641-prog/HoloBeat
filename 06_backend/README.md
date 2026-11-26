# HoloBeat 本地归档服务

服务使用 Node.js 24、Fastify 和 SQLite。浏览器的铸卡、创作和导出使用本地存储。启动归档后，可以将收藏保存到本机数据库，读取谱系并生成只读 HTML 作品展页和 JSON 链接。

```sh
cd 06_backend
npm install
npm run typecheck
npm test
node tests/restart.mjs
npm start
```

默认地址为 `http://127.0.0.1:3789`。`PORT` 可以指定其他端口，`HOST` 仅接受 `127.0.0.1`。`HOLOBEAT_DB_PATH` 可以指定独立测试库。服务没有 LAN 或公网模式。

## 本地访问

服务检查 TCP 对端和 Host。浏览器 Origin 限于本机 Vite 的 5173、4173 和服务自己的源。写入时先读取 `GET /api/session` 返回的 `writeToken`，将它放入 `X-HoloBeat-Write-Token` 请求头。该凭据在服务重启时轮换，响应禁止缓存。只读分享 URL 仅含分享令牌。配置 HOLOBEAT_WRITE_TOKEN 后，旧工具可继续通过 X-HoloBeat-Token 写入；获取临时会话同样需要该头。配置的凭据不会出现在任何响应中。写请求限额为每实例每分钟 60 次。

本机进程属于信任范围，同机其他操作系统用户运行的进程也能访问环回服务。多用户主机需要额外的身份认证。`buildApp({ authorizeWrite })` 提供写操作和资源授权接入点。

## 数据库与升级

默认文件为 `data/holobeat-archive.sqlite`。在 Windows 首次创建默认归档目录时，ACL 仅授予当前用户、管理员与 SYSTEM 访问权。已有目录及自定义路径保留管理员配置的 ACL，请检查数据库、升级备份和同目录的 SQLite 日志权限。POSIX 新目录和数据库分别使用 0700、0600 权限。

打开数据库时执行完整性快速检查，开启外键并设置 5 秒写锁等待。单进程本地归档保留 SQLite 默认回滚日志模式。对旧库运行 `VACUUM INTO` 生成同目录、带唯一后缀的 `.pre-v2-*.sqlite` 备份，随后用一个 `BEGIN IMMEDIATE` 事务升级到 `user_version=2`。重复编号、异常 JSON、无效谱系或损坏的 SQLite 会阻止升级，已提交的旧数据保留。应在副本中人工处理冲突再重试。备份包含完整作品和分享记录，应与原库同等保护。

存档不可变。编号、作品代码、卡 ID、幂等键具有唯一约束，新卡的 requestId 和 contentHash 也分别唯一。请求与已存 payload 完全相同返回已有卡。复用身份但内容不同返回 409。子作品须在父作品归档后同步，父作品有子作品时删除返回 409。删除叶子作品会同时删除指向它的分享记录。

## HTTP API

| 方法 | 路径 | 结果 |
| --- | --- | --- |
| GET | /health 或 /api/health | 服务版本及卡片数量 |
| GET | /api/session | 本地写入凭据 |
| GET | /api/cards | 已归档卡片列表 |
| POST | /api/cards | 新卡 201，相同请求 200，约束冲突 409 |
| DELETE | /api/cards/:id | 删除叶子作品，成功 200 |
| GET | /api/lineage/:id | 当前卡、祖先和直接子作品 |
| POST | /api/shares | 接受 cardId 和可选 expiresAt，时间为 Unix 毫秒 |
| GET | /share/:token | HTML 只读作品展页，含轮廓试听与 V3 工程下载 |
| GET | /api/shares/:token | 有效作品 JSON；过期或已撤销返回 404 |
| DELETE | /api/shares/:token | 授权撤销，立即失效 |

创建分享时，相同卡和有效期限复用当前链接并返回 200。变更期限会撤销旧链接并返回新链接和 201。对已过期时间的创建请求返回 400。归档和创建分享是两个独立操作。

校验器同时用于前端工程导入。JSON 请求体上限为 1 MiB，超出返回 413，字段或嵌套结构错误返回 400。支持的作品长度最多 120 秒，每组最多 4096 个音乐事件，贴纸上限为 128 个。音色、插画与贴纸引用项目资源标识。shareUrl 指向 HTML 作品展页，apiUrl 指向 JSON。两者同时到期或撤销，仅本机可访问。
