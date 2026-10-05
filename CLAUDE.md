# Rifalo (repo ayudave) — reglas del proyecto

- App de rifas: Vue 3 + Vite + Firebase (proyecto `ayudave-81546`). Ver README.md.
- **Versión:** en cada cambio que se publique, sube `version` en `package.json`
  (parche `x.y.Z` para arreglos, menor `x.Y.0` para funciones nuevas). Se muestra en el
  login, en la página principal y en el menú como `vX.Y.Z · fecha`. Dile al usuario la
  versión publicada en cada respuesta.
- **Publicación automática:** cada push a `main` corre las pruebas (build + reglas) y
  publica en Firebase con GitHub Actions (secreto `FIREBASE_SERVICE_ACCOUNT`). No hace
  falta que el usuario corra scripts. Verifica que el workflow "Probar y publicar" termine
  en verde antes de decir que está publicado.
- **Nunca** correr `scripts/instalar.ps1` ni `node scripts/admin.mjs wipe` en producción:
  borran todos los datos.
- Textos en español de Venezuela con **tuteo** (tienes, pagas, pides), nunca voseo.
- Antes de publicar: `npx vite build`, `npm run test:rules` y, con emuladores + vite,
  `node tests/e2e.mjs` y `node tests/calc.mjs`.
