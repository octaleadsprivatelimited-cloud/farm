FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
RUN addgroup -S nursery && adduser -S nursery -G nursery
COPY --from=dependencies --chown=nursery:nursery /app/node_modules ./node_modules
COPY --chown=nursery:nursery package.json package-lock.json ./
COPY --chown=nursery:nursery server ./server
COPY --chown=nursery:nursery database ./database
COPY --chown=nursery:nursery public ./public
COPY --chown=nursery:nursery scripts ./scripts
USER nursery
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/index.js"]
