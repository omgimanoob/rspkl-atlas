# SPA History Fallback — Deployment Notes

Many frontend hosts serve static assets and need a rewrite so deep links (e.g., `/reset` or `/account`) return `index.html`, letting the SPA router handle the path.

## Nginx

```
server {
  listen 80;
  server_name example.com;
  root /var/www/app;

  location / {
    try_files $uri /index.html;
  }

  location /assets/ {
    expires 1y;
    add_header Cache-Control public;
  }
}
```

## Apache (.htaccess)

```
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## Netlify (netlify.toml)

```
[[redirects]]
  from = "/reset"
  to = "/index.html"
  status = 200

[[redirects]]
  from = "/account"
  to = "/index.html"
  status = 200

[[redirects]]
  from = "/projects"
  to = "/index.html"
  status = 200
```

Or a catch‑all:

```
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Vercel (vercel.json)

```
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Cloudflare Pages (_routes.json)

```
{
  "version": 1,
  "include": ["/*"],
  "exclude": []
}
```

Ensure your static assets (e.g., `/assets/*`) are not rewritten unintentionally when using a catch‑all. Adjust per host.
