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
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortDir = searchParams.get('sortDir') === 'asc' ? 'ASC' : 'DESC'
    const offset = (page - 1) * pageSize

    const allowedSort = ['created_at', 'sender_name', 'receiver_name', 'weight', 'quantity', 'temp_zone', 'status']
    const safeSort = allowedSort.includes(sortBy) ? sortBy : 'created_at'

    let rows, total

    if (search) {
      rows = await sql`
        SELECT * FROM orders
        WHERE sender_name ILIKE ${'%' + search + '%'}
           OR receiver_name ILIKE ${'%' + search + '%'}
           OR external_code ILIKE ${'%' + search + '%'}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `
      const [{ count }] = await sql`
        SELECT COUNT(*) as count FROM orders
        WHERE sender_name ILIKE ${'%' + search + '%'}
           OR receiver_name ILIKE ${'%' + search + '%'}
           OR external_code ILIKE ${'%' + search + '%'}
      `
      total = parseInt(count)
    } else {
      rows = await sql`
        SELECT * FROM orders
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `
      const [{ count }] = await sql`SELECT COUNT(*) as count FROM orders`
      total = parseInt(count)
    }

    return NextResponse.json({ success: true, rows, total, page, pageSize })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
