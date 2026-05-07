'use client'

import { useState, useEffect, useCallback } from 'react'

interface Order {
  id: string
  external_code: string
  sender_name: string
  sender_phone: string
  sender_address: string
  receiver_name: string
  receiver_phone: string
  receiver_address: string
  weight: number
  quantity: number
  temp_zone: string
  note: string
  status: string
  created_at: string
}

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const pageSize = 20

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
        dateFrom,
        dateTo,
      })
      const res = await fetch(`/api/orders?${params}`)
      const data = await res.json()
      if (data.success) {
        setOrders(data.rows)
        setTotal(data.total)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, search, dateFrom, dateTo])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const totalPages = Math.ceil(total / pageSize)

  const handleSearch = (val: string) => { setSearch(val); setPage(1) }
  const handleDateFrom = (val: string) => { setDateFrom(val); setPage(1) }
  const handleDateTo = (val: string) => { setDateTo(val); setPage(1) }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="搜索外部编码或收件人姓名..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">提交时间</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => handleDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => handleDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 whitespace-nowrap"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">暂无运单记录</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {[
                    { key: 'external_code', label: '外部编码' },
                    { key: 'sender_name', label: '发件人' },
                    { key: 'receiver_name', label: '收件人' },
                    { key: 'receiver_address', label: '收件地址' },
                    { key: 'weight', label: '重量(kg)' },
                    { key: 'quantity', label: '件数' },
                    { key: 'temp_zone', label: '温层' },
                    { key: 'status', label: '状态' },
                    { key: 'created_at', label: '提交时间' },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500 text-xs">{order.external_code || '-'}</td>
                    <td className="px-3 py-2">{order.sender_name}</td>
                    <td className="px-3 py-2">{order.receiver_name}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={order.receiver_address}>{order.receiver_address}</td>
                    <td className="px-3 py-2">{order.weight}</td>
                    <td className="px-3 py-2">{order.quantity}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs
                        ${order.temp_zone === '冷冻' ? 'bg-blue-100 text-blue-700' :
                          order.temp_zone === '冷藏' ? 'bg-cyan-100 text-cyan-700' :
                          'bg-orange-100 text-orange-700'}`}>
                        {order.temp_zone}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(order.created_at).toLocaleString('zh-CN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">共 {total} 条运单</p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
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
        </>
      )}
    </div>
  )
}
