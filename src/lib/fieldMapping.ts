import { ColumnMapping } from '@/types/order'

// All known aliases for each standard field
const FIELD_ALIASES: Record<keyof ColumnMapping, string[]> = {
  externalCode: [
    '外部编码', '外部订单号', '客户单号', '订单号', '单号', 'ref code', 'ref_code', 'order_no', 'order no',
    'external code', 'external_code', 'refcode',
  ],
  senderName: [
    '发件人姓名', '发件人', '发货人', '寄件人', '发件人名', '寄件人姓名', 'sender', 'sender name', 'sender_name',
    '发货人姓名', '发件方', '寄方',
  ],
  senderPhone: [
    '发件人电话', '发件人手机', '发货电话', '寄件人电话', '发件人联系方式', 'sender tel', 'sender_tel',
    'sender phone', 'sender_phone', '发货人电话', '发件电话', '寄件电话',
  ],
  senderAddress: [
    '发件人地址', '发货地址', '寄件人地址', '发件人完整地址', 'sender address', 'sender_address',
    '发货人地址', '发件地址', '寄件地址',
  ],
  receiverName: [
    '收件人姓名', '收件人', '收货人', '客收人', '收件人名', '收货人姓名', 'receiver', 'receiver name',
    'receiver_name', '收货人名', '收件人名称', '收方', '收件方',
  ],
  receiverPhone: [
    '收件人电话', '收件人手机', '收货电话', '收件人联系方式', '收货人电话', 'receiver tel', 'receiver_tel',
    'receiver phone', 'receiver_phone', '收货电话', '收件人联系电话', '收件电话',
  ],
  receiverAddress: [
    '收件人地址', '收货地址', '收件人完整地址', '收货人地址', 'receiver address', 'receiver_address',
    '收货人地址', '收件地址',
  ],
  weight: [
    '重量(kg)', '重量', '重量(KG)', '重量kg', '货物重量', 'weight', 'weight(kg)', 'weight_kg',
    '重量（kg）', '重量（KG）', 'weight（kg）',
  ],
  quantity: [
    '件数', '数量', '包裹数量', '件数(件)', 'qty', 'quantity', 'count', '数量(件)', '件数（件）',
  ],
  tempZone: [
    '温层', '温度要求', '冷链类型', '温控', '温区', 'temp zone', 'temp_zone', 'temperature',
    '冷链', '运输方式', '温层要求', '温度', '储运方式',
  ],
  note: [
    '备注', '附言', '附加说明', '备注信息', 'note', 'notes', 'remark', 'remarks', '附注', '说明',
  ],
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {}
  const normalizedHeaders = headers.map(normalize)

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const normalizedAliases = aliases.map(normalize)
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (normalizedAliases.includes(normalizedHeaders[i])) {
        mapping[field as keyof ColumnMapping] = headers[i]
        break
      }
    }
  }

  return mapping
}

export function getMappingCompleteness(mapping: Partial<ColumnMapping>): {
  complete: boolean
  missingRequired: string[]
} {
  const requiredFields: (keyof ColumnMapping)[] = [
    'senderName', 'senderPhone', 'senderAddress',
    'receiverName', 'receiverPhone', 'receiverAddress',
    'weight', 'quantity', 'tempZone',
  ]
  const missingRequired = requiredFields.filter(f => !mapping[f])
  return { complete: missingRequired.length === 0, missingRequired }
}

export function generateHeaderKey(headers: string[]): string {
  return headers
    .map(h => h.trim())
    .filter(Boolean)
    .sort()
    .join('|')
}
