# 构建镜像：Node 24 自带 node:sqlite，不需要编译原生模块
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

# 先只拷贝依赖清单，利用 Docker 层缓存
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

# 拷贝整个项目（node_modules、data、.env 已由 .dockerignore 排除）
COPY . .

# 以非 root 用户运行；data 目录需要可写
RUN mkdir -p /app/server/data && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/src/index.js"]
