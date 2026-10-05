// Genera los íconos PNG y la imagen para redes (og.png) a partir de public/icon.svg.
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
const svg = readFileSync('public/icon.svg', 'utf8')
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
const p = await b.newPage()
for (const size of [192, 512]) {
  await p.setViewportSize({ width: size, height: size })
  await p.setContent(`<html><body style="margin:0;background:#2E1065">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  await p.screenshot({ path: `public/icon-${size}.png`, omitBackground: false })
}
await p.setViewportSize({ width: 1200, height: 630 })
await p.setContent(`<html><body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box;
  background:radial-gradient(900px 500px at 10% 10%,#7C3AED,transparent 60%),radial-gradient(700px 400px at 95% 95%,#F5A50B66,transparent 60%),linear-gradient(160deg,#3B0F8C,#1E0A47);font-family:Arial Black,Arial,sans-serif;color:#fff">
  ${svg.replace('<svg ', '<svg width="260" height="260" ')}
  <div><div style="font-size:96px;font-weight:900;letter-spacing:-3px">Rifalo</div>
  <div style="font-size:38px;font-family:Arial;opacity:.9;margin-top:12px">Escoge tu número y participa 🎟️</div></div></body></html>`)
await p.screenshot({ path: 'public/og.png' })
await b.close()
console.log('ok')
