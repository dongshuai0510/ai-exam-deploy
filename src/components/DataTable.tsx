'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { OrderRow, STANDARD_FIELDS, TEMP_ZONE_VALUES } from '@/types/order'
import { validateRow } from '@/lib/excelParser'
import { exportToExcel } from '@/lib/excelParser'

interface DataTableProps {
  rows: OrderRow[]
  onChange: (rows: OrderRow[]) => void
  onSubmit: () => void
  submitting: boolean
  submitProgress: number
}

const PAGE_SIZE = 50

export function DataTable({ rows, onChange, onSubmit, submitting, submitProgress }: DataTableProps) {
  const [page, setPage] = useState(1)
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof OrderRow } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [dbDuplicates, setDbDuplicates] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Detect in-batch duplicates
  const batchDuplicateCodes = new Set<string>()
  const codeCounts: Record<string, number> = {}
  rows.forEach(r => {
    if (r.externalCode?.trim()) {
      codeCounts[r.externalCode.trim()] = (codeCounts[r.externalCode.trim()] || 0) + 1
    }
  })
  Object.entries(codeCounts).forEach(([code, count]) => {
    if (count > 1) batchDuplicateCodes.add(code)
  })

  // Check DB duplicates on mount and when external codes change
  useEffect(() => {
    const codes = rows
      .map(r => r.externalCode?.trim())
      .filter((c): c is string => !!c && !batchDuplicateCodes.has(c))
    if (codes.length === 0) { setDbDuplicates(new Set()); return }

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkDuplicates', codes }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setDbDuplicates(new Set(data.duplicates))
      })
      .catch(() => {})
  }, [rows.map(r => r.externalCode).join(',')])

  const getDuplicateError = (row: OrderRow): string => {
    const code = row.externalCode?.trim()
    if (!code) return ''
    if (batchDuplicateCodes.has(code)) {
      const firstIdx = rows.findIndex(r => r.externalCode?.trim() === code)
      const thisIdx = rows.indexOf(row)
      if (thisIdx !== firstIdx) return `与第 ${rows[firstIdx]._rowIndex} 行重复`
    }
    if (dbDuplicates.has(code)) return '与数据库已有记录重复'
    return ''
  }

  const allErrors = rows.flatMap(row => {
    const errs = Object.entries(row._errors).map(([field, msg]) => ({
      rowIndex: row._rowIndex,
      field: STANDARD_FIELDS.find(f => f.key === field)?.label || field,
      msg,
    }))
    const dupErr = getDuplicateError(row)
    if (dupErr) errs.push({ rowIndex: row._rowIndex, field: '外部编码', msg: dupErr })
    return errs
  })

  const hasErrors = allErrors.length > 0

  const startEdit = useCallback((rowId: string, field: keyof OrderRow, value: string) => {
    setEditingCell({ rowId, field })
    setEditValue(value)
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingCell) return
    const { rowId, field } = editingCell
    const updated = rows.map(row => {
      if (row.id !== rowId) return row
      const newRow = { ...row, [field]: editValue }
      newRow._errors = validateRow(newRow)
      return newRow
    })
    onChange(updated)
    setEditingCell(null)
  }, [editingCell, editValue, rows, onChange])

  const deleteRow = useCallback((rowId: string) => {
    onChange(rows.filter(r => r.id !== rowId))
  }, [rows, onChange])

  const addEmptyRow = useCallback(() => {
    const newRow: OrderRow = {
      id: crypto.randomUUID(),
      externalCode: '', senderName: '', senderPhone: '', senderAddress: '',
      receiverName: '', receiverPhone: '', receiverAddress: '',
      weight: '', quantity: '', tempZone: '', note: '',
      _rowIndex: rows.length + 1,
      _errors: {},
    }
    newRow._errors = validateRow(newRow)
    const updated = [...rows, newRow]
    onChange(updated)
    setPage(Math.ceil(updated.length / PAGE_SIZE))
  }, [rows, onChange])

  useEffect(() => {
    if (editingCell && inputRef.current) inputRef.current.focus()
  }, [editingCell])

  const fields = STANDARD_FIELDS.map(f => f.key) as (keyof OrderRow)[]

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, fieldIdx: number) => {
    if (e.key === 'Enter') {
      commitEdit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      const nextFieldIdx = e.shiftKey ? fieldIdx - 1 : fieldIdx + 1
      if (nextFieldIdx >= 0 && nextFieldIdx < fields.length) {
        const row = rows.find(r => r.id === rowId)
        if (row) startEdit(rowId, fields[nextFieldIdx], String(row[fields[nextFieldIdx]] ?? ''))
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Error summary */}
      {allErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h4 className="text-red-700 font-semibold mb-2">
            发现 {allErrors.length} 个错误，请修复后再提交：
          </h4>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {allErrors.map((e, i) => (
              <p key={i} className="text-sm text-red-600">
                第 {e.rowIndex} 行 · {e.field}：{e.msg}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-500">共 {rows.length} 条数据</p>
          <button
            onClick={addEmptyRow}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增行
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportToExcel(rows)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出 Excel
          </button>
          <button
            onClick={onSubmit}
            disabled={hasErrors || submitting}
            className={`px-4 py-1.5 text-sm text-white rounded-lg flex items-center gap-2
              ${hasErrors || submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                提交中 {submitProgress}%
              </>
            ) : '提交下单'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {submitting && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${submitProgress}%` }}
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-12">#</th>
              {STANDARD_FIELDS.map(f => (
                <th key={f.key} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  {f.label}
                  {f.required && <span className="text-red-400 ml-0.5">*</span>}
                </th>
              ))}
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-16">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageRows.map(row => {
              const dupError = getDuplicateError(row)
              const rowHasError = Object.keys(row._errors).length > 0 || !!dupError
              return (
                <tr key={row.id} className={`hover:bg-gray-50 ${rowHasError ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2 text-gray-400 text-xs">{row._rowIndex}</td>
                  {STANDARD_FIELDS.map((f, fieldIdx) => {
                    const isEditing = editingCell?.rowId === row.id && editingCell?.field === f.key
                    const fieldError = row._errors[f.key] || (f.key === 'externalCode' ? dupError : '')
                    const hasError = !!fieldError
                    const value = String(row[f.key] ?? '')

                    return (
                      <td
                        key={f.key}
                        className={`px-2 py-1.5 min-w-[100px] max-w-[200px] ${hasError ? 'bg-red-100' : ''}`}
                      >
                        {isEditing ? (
                          f.key === 'tempZone' ? (
                            <select
                              ref={inputRef as React.RefObject<HTMLSelectElement>}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={e => handleKeyDown(e, row.id, fieldIdx)}
                              className="w-full border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none"
                            >
                              <option value="">-- 选择 --</option>
                              {TEMP_ZONE_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          ) : (
                            <input
                              ref={inputRef as React.RefObject<HTMLInputElement>}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={e => handleKeyDown(e, row.id, fieldIdx)}
                              className="w-full border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none"
                            />
                          )
                        ) : (
                          <div
                            onClick={() => startEdit(row.id, f.key, value)}
                            className={`cursor-text truncate px-1 py-0.5 rounded hover:bg-blue-50 min-h-[24px]
                              ${hasError ? 'text-red-700' : 'text-gray-700'}`}
                            title={hasError ? fieldError : value}
                          >
                            {value || <span className="text-gray-300 italic text-xs">空</span>}
                          </div>
                        )}
                        {hasError && !isEditing && (
                          <p className="text-xs text-red-500 mt-0.5 leading-tight">{fieldError}</p>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            上一页
          </button>
          <span className="text-sm text-gray-600">第 {page} / {totalPages} 页</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
