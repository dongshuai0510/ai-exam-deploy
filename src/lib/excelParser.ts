import * as XLSX from 'xlsx'
import { ColumnMapping, OrderRow, ImportResult, TEMP_ZONE_VALUES } from '@/types/order'
import { autoDetectMapping, generateHeaderKey } from './fieldMapping'
import { getSavedTemplates } from './templateStorage'

function findDataStartRow(rows: string[][]): { headerRowIndex: number; dataStartIndex: number } {
  const knownKeywords = [
    '发件', '收件', '发货', '收货', '寄件', 'sender', 'receiver', 'weight', 'qty',
    '重量', '件数', '温层', '温度', '电话', 'tel', 'phone', 'address', '地址', '姓名', 'name',
    '编码', '单号', 'code', 'order', '备注', 'note', 'remark',
  ]

  let bestRow = -1
  let bestScore = 0
  let firstNonEmptyRow = -1

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    const nonEmpty = row.filter(c => c && String(c).trim()).length
    if (nonEmpty < 2) continue

    if (firstNonEmptyRow === -1) firstNonEmptyRow = i

    const score = row.filter(cell => {
      const lower = String(cell || '').toLowerCase()
      return knownKeywords.some(kw => lower.includes(kw.toLowerCase()))
    }).length

    if (score > bestScore) {
      bestScore = score
      bestRow = i
    }
  }

  // If no keyword match found, use first non-empty row as header
  if (bestRow === -1) bestRow = Math.max(0, firstNonEmptyRow)

  return { headerRowIndex: bestRow, dataStartIndex: bestRow + 1 }
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'number') return String(cell)
  if (typeof cell === 'boolean') return String(cell)
  return String(cell).trim()
}

export async function parseExcelFile(file: File): Promise<ImportResult> {
  let workbook: XLSX.WorkBook
  try {
    const buffer = await file.arrayBuffer()
    workbook = XLSX.read(buffer, { type: 'array' })
  } catch {
    throw new Error('文件解析失败，请确认文件为有效的 Excel 格式（.xlsx / .xls）')
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel 文件中没有找到任何工作表')
  }

  // Find the data sheet (skip instruction sheets)
  let sheetName = workbook.SheetNames[0]
  if (workbook.SheetNames.length > 1) {
    // Try to find a sheet with actual data (not just instructions)
    for (const name of workbook.SheetNames) {
      const ws = workbook.Sheets[name]
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      if (range.e.r > 2) {
        sheetName = name
        break
      }
    }
  }

  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) throw new Error('无法读取工作表')

  const rawRows: string[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as string[][]

  if (!rawRows || rawRows.length === 0) throw new Error('文件内容为空，请检查文件是否有数据')

  const { headerRowIndex, dataStartIndex } = findDataStartRow(rawRows)
  const headers = rawRows[headerRowIndex].map(cellToString)

  if (headers.length === 0) throw new Error('未找到有效的表头行，请确认文件格式正确')

  const dataRows = rawRows.slice(dataStartIndex)
  const validDataRows = dataRows.filter(row => row.filter(cell => cellToString(cell) !== '').length >= 2)
  if (validDataRows.length === 0) {
    throw new Error('文件中没有找到有效数据行，请确认文件内容不为空')
  }

  // Check saved templates first
  const savedTemplates = getSavedTemplates()
  const headerKey = generateHeaderKey(headers)
  const savedTemplate = savedTemplates.find(t => t.headerKey === headerKey)

  let mapping: ColumnMapping
  let templateId: string | undefined

  if (savedTemplate) {
    mapping = savedTemplate.mapping
    templateId = savedTemplate.id
  } else {
    const detected = autoDetectMapping(headers)
    mapping = {
      externalCode: detected.externalCode || '',
      senderName: detected.senderName || '',
      senderPhone: detected.senderPhone || '',
      senderAddress: detected.senderAddress || '',
      receiverName: detected.receiverName || '',
      receiverPhone: detected.receiverPhone || '',
      receiverAddress: detected.receiverAddress || '',
      weight: detected.weight || '',
      quantity: detected.quantity || '',
      tempZone: detected.tempZone || '',
      note: detected.note || '',
    }
  }

  const rows = validDataRows
    .map((row, idx) => {
      const get = (colName: string) => {
        if (!colName) return ''
        const colIdx = headers.indexOf(colName)
        if (colIdx === -1) return ''
        return cellToString(row[colIdx])
      }

      const orderRow: OrderRow = {
        id: crypto.randomUUID(),
        externalCode: get(mapping.externalCode),
        senderName: get(mapping.senderName),
        senderPhone: get(mapping.senderPhone),
        senderAddress: get(mapping.senderAddress),
        receiverName: get(mapping.receiverName),
        receiverPhone: get(mapping.receiverPhone),
        receiverAddress: get(mapping.receiverAddress),
        weight: get(mapping.weight),
        quantity: get(mapping.quantity),
        tempZone: get(mapping.tempZone),
        note: get(mapping.note),
        _rowIndex: dataStartIndex + idx + 1,
        _errors: {},
      }

      orderRow._errors = validateRow(orderRow)
      return orderRow
    })

  return { rows, headers, mapping, templateId, dataStartRow: dataStartIndex }
}

export function validateRow(row: Omit<OrderRow, '_errors'>): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!row.senderName?.trim()) errors.senderName = '发件人姓名不能为空'
  if (!row.senderPhone?.trim()) {
    errors.senderPhone = '发件人电话不能为空'
  } else if (!/^1[3-9]\d{9}$/.test(row.senderPhone.trim())) {
    errors.senderPhone = '发件人电话格式不正确'
  }
  if (!row.senderAddress?.trim()) errors.senderAddress = '发件人地址不能为空'
  if (!row.receiverName?.trim()) errors.receiverName = '收件人姓名不能为空'
  if (!row.receiverPhone?.trim()) {
    errors.receiverPhone = '收件人电话不能为空'
  } else if (!/^1[3-9]\d{9}$/.test(row.receiverPhone.trim())) {
    errors.receiverPhone = '收件人电话格式不正确'
  }
  if (!row.receiverAddress?.trim()) errors.receiverAddress = '收件人地址不能为空'

  if (!row.weight?.trim()) {
    errors.weight = '重量不能为空'
  } else {
    const w = parseFloat(row.weight)
    if (isNaN(w) || w <= 0) errors.weight = '重量必须为正数'
  }

  if (!row.quantity?.trim()) {
    errors.quantity = '件数不能为空'
  } else {
    const q = parseInt(row.quantity)
    if (isNaN(q) || q <= 0 || !Number.isInteger(q)) errors.quantity = '件数必须为正整数'
  }

  if (!row.tempZone?.trim()) {
    errors.tempZone = '温层不能为空'
  } else if (!TEMP_ZONE_VALUES.includes(row.tempZone.trim())) {
    errors.tempZone = `温层必须为：${TEMP_ZONE_VALUES.join('/')}`
  }

  return errors
}

export function exportToExcel(rows: OrderRow[], filename = 'export.xlsx') {
  const headers = ['外部编码', '发件人姓名', '发件人电话', '发件人地址', '收件人姓名', '收件人电话', '收件人地址', '重量(kg)', '件数', '温层', '备注']
  const data = rows.map(r => [
    r.externalCode, r.senderName, r.senderPhone, r.senderAddress,
    r.receiverName, r.receiverPhone, r.receiverAddress,
    r.weight, r.quantity, r.tempZone, r.note,
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, filename)
}
