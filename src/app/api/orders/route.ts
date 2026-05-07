import { NextRequest, NextResponse } from 'next/server'
import { getDb, initDb } from '@/lib/db'
import { z } from 'zod'

const OrderSchema = z.object({
  externalCode: z.string().optional(),
  senderName: z.string().min(1),
  senderPhone: z.string().min(1),
  senderAddress: z.string().min(1),
  receiverName: z.string().min(1),
  receiverPhone: z.string().min(1),
  receiverAddress: z.string().min(1),
  weight: z.string().min(1),
  quantity: z.string().min(1),
  tempZone: z.string().min(1),
  note: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Handle duplicate check request
    if (body.action === 'checkDuplicates') {
      const codes = z.array(z.string()).parse(body.codes)
      await initDb()
      const sql = getDb()
      if (codes.length === 0) return NextResponse.json({ success: true, duplicates: [] })
      const existing = await sql`
        SELECT external_code FROM orders
        WHERE external_code = ANY(${codes})
      `
      return NextResponse.json({
        success: true,
        duplicates: existing.map((r: Record<string, unknown>) => r.external_code as string),
      })
    }

    const rows = z.array(OrderSchema).parse(body)
    await initDb()
    const sql = getDb()

    const results = []
    for (const row of rows) {
      const [inserted] = await sql`
        INSERT INTO orders (
          external_code, sender_name, sender_phone, sender_address,
          receiver_name, receiver_phone, receiver_address,
          weight, quantity, temp_zone, note
        ) VALUES (
          ${row.externalCode || null},
          ${row.senderName}, ${row.senderPhone}, ${row.senderAddress},
          ${row.receiverName}, ${row.receiverPhone}, ${row.receiverAddress},
          ${parseFloat(row.weight)}, ${parseInt(row.quantity)},
          ${row.tempZone}, ${row.note || null}
        )
        RETURNING id, created_at
      `
      results.push(inserted)
    }

    return NextResponse.json({ success: true, count: results.length, ids: results.map(r => r.id) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 400 })
  }
}

export async function GET(req: NextRequest) {
  try {
    await initDb()
    const sql = getDb()
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const search = searchParams.get('search') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const offset = (page - 1) * pageSize

    // Build query with optional filters - use tagged template for safety
    let rows, countResult

    if (search && dateFrom && dateTo) {
      rows = await sql`SELECT * FROM orders WHERE (receiver_name ILIKE ${'%' + search + '%'} OR external_code ILIKE ${'%' + search + '%'}) AND created_at >= ${dateFrom} AND created_at < ${dateTo + 'T23:59:59Z'} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      countResult = await sql`SELECT COUNT(*) as count FROM orders WHERE (receiver_name ILIKE ${'%' + search + '%'} OR external_code ILIKE ${'%' + search + '%'}) AND created_at >= ${dateFrom} AND created_at < ${dateTo + 'T23:59:59Z'}`
    } else if (search && dateFrom) {
      rows = await sql`SELECT * FROM orders WHERE (receiver_name ILIKE ${'%' + search + '%'} OR external_code ILIKE ${'%' + search + '%'}) AND created_at >= ${dateFrom} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      countResult = await sql`SELECT COUNT(*) as count FROM orders WHERE (receiver_name ILIKE ${'%' + search + '%'} OR external_code ILIKE ${'%' + search + '%'}) AND created_at >= ${dateFrom}`
    } else if (search && dateTo) {
      rows = await sql`SELECT * FROM orders WHERE (receiver_name ILIKE ${'%' + search + '%'} OR external_code ILIKE ${'%' + search + '%'}) AND created_at < ${dateTo + 'T23:59:59Z'} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      countResult = await sql`SELECT COUNT(*) as count FROM orders WHERE (receiver_name ILIKE ${'%' + search + '%'} OR external_code ILIKE ${'%' + search + '%'}) AND created_at < ${dateTo + 'T23:59:59Z'}`
    } else if (dateFrom && dateTo) {
      rows = await sql`SELECT * FROM orders WHERE created_at >= ${dateFrom} AND created_at < ${dateTo + 'T23:59:59Z'} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      countResult = await sql`SELECT COUNT(*) as count FROM orders WHERE created_at >= ${dateFrom} AND created_at < ${dateTo + 'T23:59:59Z'}`
    } else if (dateFrom) {
      rows = await sql`SELECT * FROM orders WHERE created_at >= ${dateFrom} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      countResult = await sql`SELECT COUNT(*) as count FROM orders WHERE created_at >= ${dateFrom}`
    } else if (dateTo) {
      rows = await sql`SELECT * FROM orders WHERE created_at < ${dateTo + 'T23:59:59Z'} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      countResult = await sql`SELECT COUNT(*) as count FROM orders WHERE created_at < ${dateTo + 'T23:59:59Z'}`
    } else if (search) {
      rows = await sql`SELECT * FROM orders WHERE receiver_name ILIKE ${'%' + search + '%'} OR external_code ILIKE ${'%' + search + '%'} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      countResult = await sql`SELECT COUNT(*) as count FROM orders WHERE receiver_name ILIKE ${'%' + search + '%'} OR external_code ILIKE ${'%' + search + '%'}`
    } else {
      rows = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      countResult = await sql`SELECT COUNT(*) as count FROM orders`
    }

    const total = parseInt(countResult[0].count)
    return NextResponse.json({ success: true, rows, total, page, pageSize })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
