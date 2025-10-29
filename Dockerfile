FROM oven/bun:1.3.1-slim

# Deno is only used by yt-dlp as a YouTube JS challenge solver runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        python3 \
        python3-pip \
        unzip \
    && python3 -m pip install --no-cache-dir --break-system-packages --upgrade yt-dlp \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3339

CMD ["bun", "run", "start"]
