# Deploying the UTM → Google Maps converter to your VPS

This is a **static site** — `npm run build` produces a `dist/` folder of plain HTML/CSS/JS.
No Node runtime is needed in production; any web server can serve it.

## 1. Build

```bash
cd fieldlog/demo/utm-converter
npm install        # first time only
npm run build      # outputs ./dist
```

## 2. Copy the build to the VPS

```bash
# from your machine (adjust user/host/path)
rsync -avz --delete dist/ user@YOUR_VPS:/var/www/utm-converter/
```

## 3a. Serve with nginx

```nginx
server {
    listen 80;
    server_name utm.yourdomain.com;
    root /var/www/utm-converter;
    index index.html;

    # single-page app: fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Then: `sudo nginx -t && sudo systemctl reload nginx`
Add HTTPS with `sudo certbot --nginx -d utm.yourdomain.com`.

## 3b. Or serve with Caddy (auto-HTTPS, simplest)

```
utm.yourdomain.com {
    root * /var/www/utm-converter
    file_server
    try_files {path} /index.html
}
```

## Notes

- `vite.config.ts` sets `base: "./"`, so it works at a domain root **or** a subpath
  (e.g. `yourdomain.com/tools/utm/`).
- Everything runs client-side — **no coordinates are sent to any server**, which is a
  genuine selling point for a firm handling client site data.
- To preview the production build locally before deploying: `npm run preview`.
- Dev mode (hot reload) while editing: `npm run dev` → http://localhost:5173
