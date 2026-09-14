# 服务端入口与接口保护

项目使用 Cloudflare Workers 和 Static Assets。入口校验在 `src/access-gate.js`，公共网址导航在 `src/navigation.js`。

## 配置

在 Cloudflare → Workers 和 Pages → yilufa-pingte → 设置 → Runtime variables and secrets 中新增 **Secret** `BUSINESS_ACCESS_TOKEN`。使用密码管理器生成至少 32 字符、最多 1024 字符的随机值，建议使用 64 位十六进制字符串。不要将真实值写入仓库、前端、构建变量或本文档。

本地开发可将同名变量写入已被 Git 忽略的 `.dev.vars`。生产 Secret 必须在发布代码前设置；缺失或配置不合要求时业务访问默认拒绝，公共导航仍可访问。

## 访问行为

| 请求 | 结果 |
| --- | --- |
| `/`（没有 t，包括已登录时） | 200，普通网址导航 |
| `/?t=有效值` | 200，外层 iframe 显示现有业务首页 |
| `/?t` 或 `/?t=` | 403 |
| `/?t=无效值` 或重复 t | 403，即使已有会话 |

参数值应经过 URL 编码。成功后服务端签发有效期 24 小时的 HttpOnly、Secure、SameSite=Lax Cookie；浏览器保留带 t 的外层入口地址，外层通过同源 iframe 加载 `/index.html`。内层地址和 HTML 不含入口密钥，使用已签发的 Cookie 验证。页面跳转和同站接口随后使用 Cookie，无须在每个链接中重复 t。Cookie 过期后重新使用带参数入口。更换 Secret 会立即使旧会话失效。

`/index.html`、会员页、其他业务 HTML、无扩展名入口、JSON 数据、`/api/*` 和 `/wuqi-data.php` 都要求有效会话。静态 CSS、JS、图片和字体允许加载。管理后台继续使用原有独立认证。普通导航不会包含业务页面、业务脚本或接口数据。

入口和受保护响应均设置 private/no-store 与 no-referrer。入口 URL 本身属于访问凭证，仍可能记录在反向代理的请求日志中，应按凭证管理其分发和日志权限。

## 路由与上线验证

`assets.run_worker_first` 为 true，确保包括 HTML 别名和接口在内的请求先经过 Worker；`html_handling` 为 none，由 Worker 在认证后处理无扩展名页面，避免静态资源层绕过认证。

检查上游代理是否完整转发查询参数、Cookie 和 Set-Cookie，并遵守 no-store。不要为根路径设置无条件 403 或缓存业务响应。

2026-09-14 控制台显示此 Worker 的路由为 `ylfptcf.668870.cc/*`，另有 workers.dev 地址；`tx168pt.q3665.com` 未直接列在 Worker 域名绑定中，因此该域名前面的代理配置需要单独核对。修改前该域名根路径实测返回 200。不能仅凭 Worker 配置推断其上游代理规则。

验证：`node --test tests/access-gate.test.mjs tests/member-static.test.mjs`；`pnpm run build`。上线后在目标域名重新检查上述四种情况，以及无 Cookie 请求 `/api/page.php?path=/index.html` 和 `/api/lottery.php` 返回 403，持有效会话时业务接口与资源正常。
