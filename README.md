# ImageGen Workflow

AI 设计迭代工作流（网页）：

**Prompt 或传图 → 得到本轮图片 → VLM 评审与新方案 → 再迭代**

浏览器只请求本站 `/api/*`。`VAPI_KEY` 只存在服务端环境变量，不会下发到前端。

## 云端地址

- 生产站：https://imagegen-workflow.vercel.app  
- 若配置了 `ACCESS_CODE`，先打开站点输入访问码再使用

会话与图片存在 **Vercel Blob**；模型调用经 Vercel 服务端转发到你的兼容 API。

## 本地开发

```bash
cp .env.example .env.local
# 填写 VAPI_KEY / VAPI_BASE / IMAGE_MODEL / VLM_MODEL
# 本地可不设 BLOB_READ_WRITE_TOKEN（默认写本地 data/sessions）
npm install
npm run dev
```

## 重新部署到 Vercel

```bash
npx vercel --prod --yes
```

环境变量在 Vercel 项目设置里维护：`VAPI_KEY`、`VAPI_BASE`、`IMAGE_MODEL`、`VLM_MODEL`、`BLOB_READ_WRITE_TOKEN`、可选 `ACCESS_CODE`。

## Docker（自有服务器时）

见 `docker-compose.yml`。镜像构建需 `DOCKER_BUILD=1`（Dockerfile 已设置）。
