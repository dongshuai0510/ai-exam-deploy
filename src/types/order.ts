export interface OrderRow {
  id: string
  externalCode: string
  senderName: string
  senderPhone: string
  senderAddress: string
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  weight: string
  quantity: string
  tempZone: string
  note: string
  _rowIndex: number
  _errors: Record<string, string>
}

export interface ColumnMapping {
  externalCode: string
  senderName: string
  senderPhone: string
  senderAddress: string
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  weight: string
  quantity: string
  tempZone: string
  note: string
}

export interface SavedTemplate {
  id: string
  headerKey: string
  mapping: ColumnMapping
  createdAt: string
}

export interface ImportResult {
  rows: OrderRow[]
  headers: string[]
  mapping: ColumnMapping
  templateId?: string
  dataStartRow: number
}

export const STANDARD_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'externalCode', label: '外部编码', required: false },
  { key: 'senderName', label: '发件人姓名', required: true },
  { key: 'senderPhone', label: '发件人电话', required: true },
  { key: 'senderAddress', label: '发件人地址', required: true },
  { key: 'receiverName', label: '收件人姓名', required: true },
  { key: 'receiverPhone', label: '收件人电话', required: true },
  { key: 'receiverAddress', label: '收件人地址', required: true },
  { key: 'weight', label: '重量(kg)', required: true },
  { key: 'quantity', label: '件数', required: true },
  { key: 'tempZone', label: '温层', required: true },
  { key: 'note', label: '备注', required: false },
]

export const TEMP_ZONE_VALUES = ['常温', '冷藏', '冷冻']
