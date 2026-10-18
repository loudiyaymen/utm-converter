# Custom Caddy image with the rate-limit plugin (not in the stock Caddy binary).
# Build on the VPS:  docker build -t caddy-ratelimit .
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/mholt/caddy-ratelimit

FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
