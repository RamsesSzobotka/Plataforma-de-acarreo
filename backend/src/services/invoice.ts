import PDFDocument from 'pdfkit'
import path from 'path'
import { User } from '../models/user'
import { Driver } from '../models/driver'

export async function generateInvoicePDF(ride: any): Promise<Buffer> {
  const invoiceNumber = `INV-${ride._id.toString().slice(-8).toUpperCase()}`

  const [clientUser, driverUser, driverProfile] = await Promise.all([
    User.findOne({ clerkId: ride.clientId }),
    ride.driverId ? User.findOne({ clerkId: ride.driverId }) : null,
    ride.driverId ? Driver.findOne({ userId: ride.driverId }) : null,
  ])

  const price = ride.finalPrice || ride.estimatedPrice
  const platformFee = price * 0.10
  const driverAmount = price * 0.90
  const paidDate = new Date(ride.paidAt || ride.updatedAt).toLocaleDateString('es-PA')

  const buffers: Buffer[] = []
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: { Title: `Factura ${invoiceNumber}`, Author: 'Carglyn' },
  })

  const pdf = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => buffers.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)
  })

  const logoPath = path.join(import.meta.dir, '../../../frontend/public/logos/Carglylogo.png')
  try {
    const logoFile = Bun.file(logoPath)
    const logoBuffer = await logoFile.arrayBuffer()
    doc.image(Buffer.from(logoBuffer), 50, 50, { width: 60 })
  } catch {
    // logo file not available — skip
  }

  doc.fontSize(24).fillColor('#0D9488').font('Helvetica-Bold')
  doc.text('Carglyn', 125, 58)

  doc.fontSize(12).fillColor('#334155').font('Helvetica')
  doc.text(invoiceNumber, 450, 50, { align: 'right' })
  doc.fontSize(18).fillColor('#0F172A').font('Helvetica-Bold')
  doc.text('Factura', 50, 110)
  doc.fontSize(10).fillColor('#64748B').font('Helvetica')
  doc.text(`Fecha: ${paidDate}`, 50, 135)

  const infoY = 170
  doc.moveTo(50, infoY - 5).lineTo(545, infoY - 5).stroke('#E2E8F0')

  const leftX = 50
  const rightX = 320

  doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
  doc.text('Cliente', leftX, infoY + 10)
  doc.fontSize(10).fillColor('#334155').font('Helvetica')
  const clientName = clientUser
    ? [clientUser.firstName, clientUser.lastName].filter(Boolean).join(' ').trim() || '—'
    : '—'
  const clientEmail = clientUser?.email || '—'
  doc.text(clientName, leftX, infoY + 30)
  doc.text(clientEmail, leftX, infoY + 48)

  doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
  doc.text('Conductor', rightX, infoY + 10)
  doc.fontSize(10).fillColor('#334155').font('Helvetica')
  const driverName = driverUser
    ? [driverUser.firstName, driverUser.lastName].filter(Boolean).join(' ').trim() || '—'
    : '—'
  doc.text(driverName, rightX, infoY + 30)
  if (driverProfile) {
    doc.text(`${driverProfile.vehicleType} — ${driverProfile.plate}`, rightX, infoY + 48)
  }

  const detailsY = infoY + 85
  doc.moveTo(50, detailsY - 5).lineTo(545, detailsY - 5).stroke('#E2E8F0')

  doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
  doc.text('Detalles del Acarreo', 50, detailsY + 10)

  doc.fontSize(10).fillColor('#334155').font('Helvetica')
  const descTruncated =
    ride.description.length > 100
      ? ride.description.slice(0, 97) + '...'
      : ride.description

  doc.text(`Título: ${ride.title}`, 50, detailsY + 30)
  doc.text(`Tipo: ${ride.type}`, 50, detailsY + 48)
  doc.text(`Descripción: ${descTruncated}`, 50, detailsY + 66)
  doc.text(`Recogida: ${ride.pickupLocation?.address || '—'}`, 50, detailsY + 88)
  doc.text(`Destino: ${ride.dropoffLocation?.address || '—'}`, 50, detailsY + 106)

  const priceY = detailsY + 145
  doc.moveTo(50, priceY - 5).lineTo(545, priceY - 5).stroke('#E2E8F0')

  const priceLeftX = 350
  const priceRightX = 500

  const fmtPrice = (n: number) =>
    `$${n.toFixed(2).toLocaleString('es-PA')}`

  doc.fontSize(10).fillColor('#334155').font('Helvetica')
  doc.text('Precio Final:', priceLeftX, priceY + 10)
  doc.text(fmtPrice(price), priceRightX, priceY + 10, { align: 'right' })

  doc.text('Comisión (10%):', priceLeftX, priceY + 28)
  doc.fillColor('#EF4444').text(`-${fmtPrice(platformFee)}`, priceRightX, priceY + 28, { align: 'right' })

  doc.fillColor('#334155').text('Monto Conductor:', priceLeftX, priceY + 46)
  doc.fillColor('#22C55E').text(fmtPrice(driverAmount), priceRightX, priceY + 46, { align: 'right' })

  doc.moveTo(priceLeftX, priceY + 62).lineTo(545, priceY + 62).stroke('#E2E8F0')

  doc.fontSize(12).fillColor('#0F172A').font('Helvetica-Bold')
  doc.text('Total Pagado:', priceLeftX, priceY + 68)
  doc.text(fmtPrice(price), priceRightX, priceY + 68, { align: 'right' })

  // ponytail: flat footer, no page-break logic — single-page invoices only
  doc.fontSize(12).fillColor('#0D9488').font('Helvetica-Bold')
  doc.text('Gracias por usar Carglyn', 50, 700)
  doc.fontSize(10).fillColor('#64748B').font('Helvetica')
  doc.text('soporte@carglyn.com', 50, 718)

  doc.fontSize(8).fillColor('#94A3B8').font('Helvetica')
  doc.text(`Generado el ${new Date().toLocaleDateString('es-PA')} por Carglyn`, 50, 780)

  doc.end()

  return pdf
}
