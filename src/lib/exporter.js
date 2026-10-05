// Exportar a Excel y PDF (las librerías se cargan solo cuando se usan).
import { pad, money, dateTime } from './format'
import { orderStatus, ORDER_LABEL } from './raffle'

const METHOD = { cash: 'Efectivo', pm: 'Pago móvil', transfer: 'Transferencia', binance: 'Binance' }
export const methodLabel = m => METHOD[m] || m

function rowsOrders(raffle, orders) {
  return orders.flatMap(o => o.numbers.map(n => ({
    Número: pad(n, raffle.size),
    Estado: ORDER_LABEL[orderStatus(o)],
    Comprador: o.buyer?.name || '',
    Teléfono: o.buyer?.phone || '',
    Cédula: o.buyer?.ci || '',
    Ciudad: o.buyer?.city || '',
    Correo: o.buyer?.email || '',
    Vendedor: o.sellerName || 'Sin asignar',
    'Total orden': o.total,
    'Pagado verificado': o.paidVerified,
    'Por verificar': o.paidPending,
    Origen: o.source === 'public' ? 'Página pública' : 'Vendedor',
    Fecha: dateTime(o.createdAt)
  }))).sort((a, b) => a.Número.localeCompare(b.Número))
}

function rowsPayments(raffle, payments) {
  return payments.map(p => ({
    Fecha: dateTime(p.createdAt),
    Números: (p.numbers || []).map(n => pad(n, raffle.size)).join(' '),
    Comprador: p.buyerName,
    Vendedor: p.sellerName,
    Método: methodLabel(p.method),
    Monto: p.amount,
    Moneda: p.currency,
    Tasa: p.rate || '',
    [`Equivalente (${raffle.currency})`]: p.amountBase,
    Banco: p.bank, 'Teléfono pago': p.phone, 'Cédula pago': p.ci, Referencia: p.ref || p.payId,
    Estado: p.status === 'verified' ? 'Verificado' : p.status === 'pending' ? 'Por verificar' : 'Rechazado',
    'Posible duplicado': p.duplicate ? 'Sí' : '',
    'Registrado por': p.createdByName,
    'Verificado por': p.verifiedByName || ''
  }))
}

export async function exportExcel(raffle, { orders, payments, accounts, board }) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const all = []
  for (let n = 1; n <= raffle.size; n++) {
    const e = board[String(n)]
    all.push({ Número: pad(n, raffle.size), Estado: e ? { r: 'Apartado', v: 'Por pagar', p: 'Pagado' }[e.s] : 'Disponible', Vendedor: e?.sl ? raffle.team?.[e.sl]?.name || '' : '' })
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsOrders(raffle, orders)), 'Ventas')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsPayments(raffle, payments)), 'Pagos')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accounts.map(a => ({
    Vendedor: a.name, Números: a.numbers, 'Números pagados': a.paidNumbers, Vendido: a.sold, Verificado: a.verified,
    'Por verificar': a.pending, 'Efectivo cobrado': a.cash, Entregado: a.delivered, Comisión: a.commission, 'Debe entregar': a.balance
  }))), 'Vendedores')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(all), 'Tablero')
  XLSX.writeFile(wb, `${raffle.slug || 'rifa'}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export async function exportPdf(raffle, { orders, stats, accounts }) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  pdf.setFillColor(76, 29, 149)
  pdf.rect(0, 0, 612, 70, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18); pdf.text(raffle.title, 40, 32)
  pdf.setFontSize(10); pdf.text(`Reporte generado ${dateTime(new Date())} · Rifalo`, 40, 52)
  pdf.setTextColor(30, 30, 30)
  pdf.setFontSize(11)
  pdf.text(`Números: ${raffle.size} · Vendidos: ${stats.sold} · Pagados: ${stats.p} · Libres: ${stats.free}`, 40, 96)
  const recaudado = accounts.reduce((s, a) => s + a.verified, 0)
  pdf.text(`Precio: ${money(raffle.price, raffle.currency)} · Recaudado verificado: ${money(recaudado, raffle.currency)}`, 40, 112)
  autoTable(pdf, {
    startY: 128,
    head: [['Vendedor', 'Números', 'Verificado', 'Por verificar', 'Comisión', 'Debe entregar']],
    body: accounts.map(a => [a.name, a.numbers, money(a.verified, raffle.currency), money(a.pending, raffle.currency), money(a.commission, raffle.currency), money(a.balance, raffle.currency)]),
    headStyles: { fillColor: [109, 40, 217] }, styles: { fontSize: 9 }
  })
  autoTable(pdf, {
    startY: pdf.lastAutoTable.finalY + 20,
    head: [['N°', 'Comprador', 'Teléfono', 'Vendedor', 'Estado']],
    body: rowsOrders(raffle, orders).map(r => [r.Número, r.Comprador, r.Teléfono, r.Vendedor, r.Estado]),
    headStyles: { fillColor: [109, 40, 217] }, styles: { fontSize: 8 }
  })
  pdf.save(`${raffle.slug || 'rifa'}-reporte.pdf`)
}
