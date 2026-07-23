# Base Debian slim (não alpine) porque o app também roda Python
# (public/python/*.py geram contratos/propostas com docxtpl/lxml,
# que têm wheels prontas no Debian e são dolorosas no musl/alpine).
FROM node:lts-slim
ENV NODE_ENV=production

# Python + libs de sistema para geração de documentos.
# python-is-python3 cria o alias `python` (o código chama tanto `python` quanto `python3`).
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python-is-python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Dependências Python (cache separado do npm)
COPY requirements.txt ./
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

# Dependências Node (usa o lock para build reprodutível)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Código da aplicação
COPY . .

EXPOSE 3000
RUN chown -R node:node /usr/src/app
USER node
CMD ["npm", "start"]
