# Caddy + HTTPS deploy (VPS)

Serves the UTM converter over HTTPS with an auto-renewing Let's Encrypt cert.
Caddy serves the static `dist/` files directly and replaces the plain `nginx` container
(both can't hold port 80, so Caddy takes over 80 **and** 443).

## Target
- VPS: `<vps>` → `<VPS_IP>`, user `<user>`
- Deployed files already at: `/home/<user>/sites/utm-converter`
- Caddy config on server: `/home/<user>/caddy/Caddyfile`
- Cert/data persisted in docker named volumes `caddy_data` + `caddy_config`

## Prerequisites (you do these once)
1. **Point DNS:** create an `A` record for your (sub)domain → `<VPS_IP>`.
   e.g. `utm.yourdomain.com  A  <VPS_IP>`
2. **Give the group + firewall access** (run in your Claude Code session; `-t` lets you type the sudo password):
   ```
   ! ssh -t <vps> 'sudo usermod -aG docker <user> && sudo ufw allow 443/tcp'
   ```
   Then **re-login once** (open a fresh SSH session) so the docker-group membership takes effect.

## Deploy (Claude runs these over SSH once the above is done)
```bash
# 1. Write the Caddyfile with your real domain (DOMAIN substituted in)
# 2. Swap the plain nginx container for Caddy on 80+443:
docker rm -f utm-converter          # release port 80
docker run -d --name caddy --restart unless-stopped \
  -p 80:80 -p 443:443 \
  -v /home/<user>/sites/utm-converter:/srv:ro \
  -v /home/<user>/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy_data:/data -v caddy_config:/config \
  caddy:2-alpine
```
Caddy fetches the certificate within a few seconds of the DNS resolving. Site is then live at
`https://<your-domain>/`.

## Updating the demo later (after a new build)
```bash
# locally:
npm run build && rsync -avz --delete dist/ <vps>:/home/<user>/sites/utm-converter/
# no container restart needed — Caddy serves the mounted files live.
```

## Rollback to plain HTTP (if DNS/cert isn't ready)
```bash
docker rm -f caddy
docker run -d --name utm-converter --restart unless-stopped -p 80:80 \
  -v /home/<user>/sites/utm-converter:/usr/share/nginx/html:ro nginx:alpine
```
