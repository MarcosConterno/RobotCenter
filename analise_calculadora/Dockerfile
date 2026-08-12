# syntax=docker.io/docker/dockerfile:1

# Etapa base: Usa Node.js como base
FROM node:18-alpine AS base
WORKDIR /app

# Etapa de dependências
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Etapa de build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gera a build padrão do Next.js
RUN npm run build

# Etapa final: Apenas os arquivos necessários para produção
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Criação de usuário seguro para rodar a aplicação
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia os arquivos necessários para rodar a aplicação
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# Define o usuário seguro
USER nextjs

# Expõe a porta padrão do Next.js
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Inicia o servidor Next.js corretamente
CMD ["npm", "run", "start"]
