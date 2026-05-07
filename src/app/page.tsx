'use client'

import { useState, useCallback } from 'react'
import { FileUpload } from '@/components/FileUpload'
import { MappingEditor } from '@/components/MappingEditor'
import { DataTable } from '@/components/DataTable'
import { OrderList } from '@/components/OrderList'
import { parseExcelFile } from '@/lib/excelParser'
import { getMappingCompleteness, generateHeaderKey } from '@/lib/fieldMapping'
import { saveTemplate } from '@/lib/templateStorage'
import { OrderRow, ColumnMapping, ImportResult } from '@/types/order'
import { toast, Toaster } from 'sonner'

type Step = 'upload' | 'mapping' | 'preview'
type Tab = 'import' | 'orders'

export default function Home() {
  const [tab, setTab] = useState<Tab>('import')
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [parseProgress, setParseProgress] = useState(0)
  const [parsedCount, setParsedCount] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [rows, setRows] = useState<OrderRow[]>([])
  const [showMappingEditor, setShowMappingEditor] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState(0)

  const handleFile = useCallback(async (file: File) => {
    setLoading(true)
    setParseProgress(0)

    const progressInterval = setInterval(() => {
      setParseProgress(p => Math.min(p + 10, 85))
    }, 100)

    try {
      // Validate file type before parsing
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        throw new Error('文件格式错误，请上传 .xlsx 或 .xls 格式的文件')
      }
      if (file.size === 0) {
        throw new Error('文件内容为空，请检查文件是否正确')
      }

      const result = await parseExcelFile(file)
      clearInterval(progressInterval)
      setParseProgress(100)
      setParsedCount(result.rows.length)

      setImportResult(result)
      setRows(result.rows)

      const { complete } = getMappingCompleteness(result.mapping)
      if (!complete) {
        setShowMappingEditor(true)
        setStep('mapping')
        toast.info('部分字段未能自动识别，请手动配置映射')
      } else {
        setStep('preview')
        if (result.templateId) {
          toast.success(`已自动应用已记忆的模板映射，共 ${result.rows.length} 条数据`)
        } else {
          toast.success(`解析成功，共 ${result.rows.length} 条数据`)
        }
      }
    } catch (err) {
      clearInterval(progressInterval)
      toast.error(`解析失败：${String(err)}`)
    } finally {
      setLoading(false)
      setParseProgress(0)
    }
  }, [])

  const handleMappingConfirm = useCallback(async (mapping: ColumnMapping) => {
    if (!importResult) return
    const headerKey = generateHeaderKey(importResult.headers)
    saveTemplate(headerKey, mapping)
    setImportResult({ ...importResult, mapping })
    setShowMappingEditor(false)
    setStep('preview')
    toast.success('映射已保存，下次上传相同格式文件将自动应用')
  }, [importResult])

  const handleSubmit = useCallback(async () => {
    const validRows = rows.filter(r => Object.keys(r._errors).length === 0)
    if (validRows.length === 0) {
      toast.error('没有可提交的有效数据')
      return
    }

    setSubmitting(true)
    setSubmitProgress(0)

    const BATCH_SIZE = 50
    const batches: OrderRow[][] = []
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      batches.push(validRows.slice(i, i + BATCH_SIZE))
    }

    let submitted = 0
    let failed = 0

    try {
      for (const batch of batches) {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch.map(r => ({
            externalCode: r.externalCode,
            senderName: r.senderName,
            senderPhone: r.senderPhone,
            senderAddress: r.senderAddress,
            receiverName: r.receiverName,
            receiverPhone: r.receiverPhone,
            receiverAddress: r.receiverAddress,
            weight: r.weight,
            quantity: r.quantity,
            tempZone: r.tempZone,
            note: r.note,
          }))),
        })
        const data = await res.json()
        if (data.success) {
          submitted += data.count
        } else {
          failed += batch.length
        }
        setSubmitProgress(Math.round((submitted + failed) / validRows.length * 100))
      }

      if (failed === 0) {
        toast.success(`提交成功！共写入 ${submitted} 条运单`)
        setStep('upload')
        setRows([])
        setImportResult(null)
        setTab('orders')
      } else {
        toast.warning(`部分提交失败：成功 ${submitted} 条，失败 ${failed} 条`)
      }
    } catch (err) {
      toast.error(`提交失败：${String(err)}`)
    } finally {
      setSubmitting(false)
      setSubmitProgress(0)
    }
  }, [rows])

  const reset = () => {
    setStep('upload')
    setRows([])
    setImportResult(null)
    setShowMappingEditor(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" richColors />

      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">万能导入下单系统</h1>
          </div>
          <nav className="flex gap-1">
            {(['import', 'orders'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors
                  ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {t === 'import' ? '导入下单' : '已导入运单'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === 'import' ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              {[
                { key: 'upload', label: '上传文件' },
                { key: 'mapping', label: '字段映射' },
                { key: 'preview', label: '预览提交' },
              ].map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  {i > 0 && <div className="w-8 h-px bg-gray-300" />}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm
                    ${step === s.key ? 'bg-blue-600 text-white' :
                      ['upload', 'mapping', 'preview'].indexOf(step) > i
                        ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    <span className="font-medium">{i + 1}</span>
                    <span>{s.label}</span>
                  </div>
                </div>
              ))}
              {step !== 'upload' && (
                <button onClick={reset} className="ml-auto text-sm text-gray-400 hover:text-gray-600">
                  重新上传
                </button>
              )}
            </div>

            {loading && parseProgress > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">正在解析 Excel 文件...</span>
                  <span className="text-sm font-medium text-blue-600">
                    {parseProgress}%{parsedCount > 0 ? ` · 已解析 ${parsedCount} 条` : ''}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                    style={{ width: `${parseProgress}%` }}
                  />
                </div>
              </div>
            )}

            {step === 'upload' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4">上传 Excel 文件</h2>
                <FileUpload onFile={handleFile} loading={loading} />
                <p className="text-xs text-gray-400 mt-3 text-center">
                  支持多种模板格式，系统自动识别列名映射
                </p>
              </div>
            )}

            {step === 'mapping' && importResult && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <MappingEditor
                  headers={importResult.headers}
                  mapping={importResult.mapping}
                  onConfirm={handleMappingConfirm}
                  onCancel={reset}
                  autoDetected={false}
                />
              </div>
            )}

            {step === 'preview' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-800">数据预览与编辑</h2>
                  <button
                    onClick={() => setShowMappingEditor(!showMappingEditor)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {showMappingEditor ? '隐藏映射配置' : '查看/修改映射'}
                  </button>
                </div>
                {showMappingEditor && importResult && (
                  <div className="mb-4">
                    <MappingEditor
                      headers={importResult.headers}
                      mapping={importResult.mapping}
                      onConfirm={handleMappingConfirm}
                      onCancel={() => setShowMappingEditor(false)}
                      autoDetected={true}
                    />
                  </div>
                )}
                <DataTable
                  rows={rows}
                  onChange={setRows}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  submitProgress={submitProgress}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">已导入运单列表</h2>
            <OrderList />
          </div>
        )}
      </main>
    </div>
  )
}
