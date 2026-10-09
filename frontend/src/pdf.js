// Builds the invoice PDF in the browser. Printing through the browser makes some
// phones (iPhone Safari) stamp the date, time and page title at the top of the page,
// and that cannot be switched off from the page — a PDF made here has nothing extra.

const A4_W_MM = 210
const A4_H_MM = 297
const PAGE_W_PX = 794 // A4 width at 96 dpi, so the invoice lays out like on a desktop

export async function downloadInvoicePdf(paper, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(paper, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    // Lay out at desktop width even on a phone, so mobile styles don't apply.
    windowWidth: 1280,
    onclone: (doc, el) => {
      Object.assign(el.style, {
        width: `${PAGE_W_PX}px`,
        maxWidth: 'none',
        padding: '38px 45px',
        border: '0',
        borderRadius: '0',
        boxShadow: 'none',
        margin: '0',
      })
    },
  })

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pageHpx = Math.floor((canvas.width * A4_H_MM) / A4_W_MM)

  if (canvas.height <= pageHpx * 1.12) {
    // Fits on one page (shrinking slightly if it is just over).
    const h = (canvas.height * A4_W_MM) / canvas.width
    const scale = Math.min(1, A4_H_MM / h)
    const w = A4_W_MM * scale
    pdf.addImage(canvas, 'JPEG', (A4_W_MM - w) / 2, 0, w, h * scale, undefined, 'FAST')
  } else {
    // Longer invoices continue on further pages.
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    for (let y = 0, page = 0; y < canvas.height; y += pageHpx, page++) {
      const sliceH = Math.min(pageHpx, canvas.height - y)
      slice.height = sliceH
      const ctx = slice.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, slice.width, sliceH)
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      if (page > 0) pdf.addPage()
      pdf.addImage(slice, 'JPEG', 0, 0, A4_W_MM, (sliceH * A4_W_MM) / canvas.width, undefined, 'FAST')
    }
  }

  pdf.save(filename)
}
