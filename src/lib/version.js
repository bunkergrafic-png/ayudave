// Versión de la app (viene de package.json) y fecha de compilación.
/* global __APP_VERSION__, __BUILD_DATE__ */
export const APP_VERSION = __APP_VERSION__
export const BUILD_DATE = __BUILD_DATE__
export const VERSION_LABEL = `v${APP_VERSION} · ${BUILD_DATE}`
