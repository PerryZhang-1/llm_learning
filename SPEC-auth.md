# Spec: auth — 认证与会话

> 对齐：开发文档 §2.1 / §6.3 / §7.1；PRD 公理5（零摩擦开局）
> 现状：🟡 开发档可用

## Objective

新用户 30 秒内完成注册并进入测评；老用户回访自动恢复会话、直达学习总览，进度零丢失。无密码体系，降低泄露面。

## 现状核对（2026-08-28）

- ✅ `/api/auth/send-code`、`/api/auth/login`、会话 Cookie（`src/lib/session.ts`）
- ✅ middleware IP 限流：send-code 5 次/分、其余 API 120 次/分
- ✅ 未登录访问受保护 API 返回 401，前端统一跳 `/login`
- ⛔ 真实发信（Resend）、6 位随机验证码、60 秒重发频控、验证码有效期
- ⛔ 会话过期时间与 Cookie 安全属性（HttpOnly / SameSite / Secure）复查
- ⛔ 生产环境 `devCode` 字段泄漏检查（当前逻辑已按 NODE_ENV 隐藏，需验收确认）

## Commands

```
Dev:    npm run dev
Lint:   npm run lint
Build:  npm run build
DB:     npx prisma migrate dev && npx prisma db seed
```

## Project Structure

```
llm-platform/src/lib/session.ts      → 会话签发与校验（唯一权威数据源）
llm-platform/src/app/api/auth/*      → send-code / login
llm-platform/src/app/login/page.tsx  → 登录页
llm-platform/src/middleware.ts       → IP 级限流兜底（内存滑动窗口）
```

## Code Style

沿用现有约定：服务端强校验优先，用户可见文案温和、不指责。

```ts
if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  return NextResponse.json({ ok: false, message: "邮箱格式不正确" }, { status: 400 });
}
```

## Testing Strategy

- Vitest 单元：验证码频控与有效期逻辑、会话签发/过期（将纯逻辑从路由中抽出后测）
- 生产档上线前手测清单：发送→收到→登录→回访保持→过期重登

## Boundaries

- **Always**：服务端校验邮箱格式与验证码；会话 Cookie 设 HttpOnly + SameSite=Lax
- **Ask first**：更换发信供应商；调整会话有效期；修改限流阈值
- **Never**：存储任何形式密码；验证码写入日志；`devCode` 出现在生产响应

## Success Criteria

- [ ] 生产环境验证码为 6 位随机值，60 秒内不可重发，10 分钟过期
- [ ] Cookie 未过期时回访，首页直达学习总览（记住状态，零重复摩擦）
- [ ] 生产环境任何响应不出现 `devCode`；断网重进不丢进度

## Open Questions

- 发信供应商是否确定 Resend？国内到达率需验证，备选阿里云邮件推送。
- 生产会话有效期定多久（建议 30 天滑动过期，减少重复登录摩擦）。
