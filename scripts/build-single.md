# Build the single-file index.html
```bash
cd app
npx vite build
node -e '
const fs = require("fs");
let html = fs.readFileSync("dist/index.html", "utf8");
html = html.replace(/<script type="module"[^>]*src="\/(assets\/[^"]+)"[^>]*><\/script>/, (m, p) => "<script type=\"module\">" + fs.readFileSync("dist/" + p, "utf8").replace(/<\/script>/g, "<\\/script>") + "</script>");
html = html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+)"[^>]*>/, (m, p) => "<style>" + fs.readFileSync("dist/" + p, "utf8") + "</style>");
fs.writeFileSync("../index.html", html);'
```
