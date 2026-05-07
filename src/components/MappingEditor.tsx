'use client'

import { useState } from 'react'
import { ColumnMapping, STANDARD_FIELDS } from '@/types/order'
import { generateHeaderKey } from '@/lib/fieldMapping'
import { saveTemplate } from '@/lib/templateStorage'

interface MappingEditorProps {
  headers: string[]
  mapping: ColumnMapping
  onConfirm: (mapping: ColumnMapping) => void
  onCancel: () => void
  autoDetected: boolean
}

export function MappingEditor({ headers, mapping, onConfirm, onCancel, autoDetected }: MappingEditorProps) {
  const [current, setCurrent] = useState<ColumnMapping>({ ...mapping })

  const handleChange = (field: keyof ColumnMapping, value: string) => {
    setCurrent(prev => ({ ...prev, [field]: value }))
  }

  const handleConfirm = () => {
    const headerKey = generateHeaderKey(headers)
    saveTemplate(headerKey, current)
    onConfirm(current)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">列名映射配置</h3>
        {autoDetected && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">已自动识别</span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-5">
        请确认或调整 Excel 列名与标准字段的对应关系，确认后系统将自动记忆此映射。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STANDARD_FIELDS.map(({ key, label, required }) => (
          <div key={key} className="flex items-center gap-3">
            <label className="w-28 text-sm text-gray-700 shrink-0">
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <select
              value={current[key]}
              onChange={e => handleChange(key, e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- 不映射 --</option>
              {headers.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-6 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          取消
        </button>
        <button
          onClick={handleConfirm}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          确认映射并继续
        </button>
      </div>
    </div>
  )
}
