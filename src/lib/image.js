// Comprime una imagen en el navegador y la devuelve como data URL JPEG (≈100–200 KB).
export function compressImage(file, maxSide = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width: w, height: h } = img
      const scale = Math.min(1, maxSide / Math.max(w, h))
      w = Math.round(w * scale); h = Math.round(h * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      let q = quality
      let out = c.toDataURL('image/jpeg', q)
      while (out.length > 380000 && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q) }
      resolve(out)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}
