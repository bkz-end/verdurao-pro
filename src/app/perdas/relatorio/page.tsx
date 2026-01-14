'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loss } from '@/types'
import { PDVHeader } from '@/components/pdv/PDVHeader'
import { LossReportCard } from '@/components/losses/LossReportCard'
import { PeriodSelector, getDateRangeForPeriod, ReportPeriod } from '@/components/losses/PeriodSelector'
import { groupLossesByReason } from '@/lib/losses/loss.service'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

/**
 * Loss Report Page - Displays loss statistics grouped by reason and period
 * Requirements: 7.4
 * 
 * Features:
 * - Period selection (today, week, month)
 * - Loss statistics by reason
 * - Total losses summary
 */

export default function LossReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>('month')
  const [losses, setLosses] = useState<Loss[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [storeName, setStoreName] = useState('')
  const [userName, setUserName] = useState('')

  // Load store data and losses from Supabase
  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      
      // Get current user's store info
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return

      // Get store user info
      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id, name')
        .eq('email', user.email.toLowerCase())
        .single()

      if (!storeUser) return

      setUserName(storeUser.name || '')

      // Get tenant info
      const { data: tenant } = await supabase
        .from('tenants')
        .select('store_name')
        .eq('id', storeUser.tenant_id)
        .single()

      if (tenant) {
        setStoreName(tenant.store_name)
      }

      // Load losses for this tenant (starts empty for new users)
      const { data: lossesData } = await supabase
        .from('losses')
        .select('*')
        .eq('tenant_id', storeUser.tenant_id)
        .order('created_at', { ascending: false })

      if (lossesData) {
        setLosses(lossesData as Loss[])
      }
    }

    loadData()
  }, [])

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Filter losses by period and group by reason
  const reportData = useMemo(() => {
    const { startDate, endDate } = getDateRangeForPeriod(period)
    
    const filteredLosses = losses.filter(loss => {
      const lossDate = new Date(loss.created_at)
      return lossDate >= startDate && lossDate <= endDate
    })

    const byReason = groupLossesByReason(filteredLosses)
    const totalQuantity = filteredLosses.reduce((sum, l) => sum + l.quantity, 0)
    const totalCount = filteredLosses.length

    return {
      byReason,
      totalQuantity,
      totalCount,
      startDate,
      endDate
    }
  }, [losses, period])

  // Format date range for display
  const dateRangeText = useMemo(() => {
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }

    if (period === 'today') {
      return formatDate(reportData.startDate)
    }

    return `${formatDate(reportData.startDate)} - ${formatDate(reportData.endDate)}`
  }, [period, reportData])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <PDVHeader
        storeName={storeName || 'Carregando...'}
        userName={userName || ''}
        isOnline={isOnline}
        onProfileClick={() => {}}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-8">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          {/* Page Title with Back Link */}
          <div className="flex items-center gap-3">
            <Link
              href="/perdas"
              className="w-10 h-10 flex items-center justify-center rounded-full
                         hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Relatório de Perdas</h1>
              <p className="text-gray-500">{dateRangeText}</p>
            </div>
          </div>

          {/* Period Selector */}
          <PeriodSelector value={period} onChange={setPeriod} />

          {/* Summary Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Total de Perdas</p>
              <p className="text-4xl font-bold text-red-600">
                {reportData.totalQuantity.toFixed(2)}
              </p>
              <p className="text-gray-500">
                unidades em {reportData.totalCount} registro{reportData.totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Loss by Reason */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">Por Motivo</h2>
            
            {reportData.byReason.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500">Nenhuma perda registrada neste período</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reportData.byReason.map((group) => (
                  <LossReportCard
                    key={group.reason}
                    reason={group.reason}
                    totalQuantity={group.totalQuantity}
                    count={group.count}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recent Losses List */}
          {reportData.totalCount > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">Registros Recentes</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {reportData.byReason.flatMap(group => group.losses).slice(0, 5).map((loss) => (
                  <div key={loss.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">
                        {loss.quantity.toFixed(2)} unidades
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(loss.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`
                      px-3 py-1 rounded-full text-sm font-medium
                      ${loss.reason === 'expiration' ? 'bg-orange-100 text-orange-700' : ''}
                      ${loss.reason === 'damage' ? 'bg-red-100 text-red-700' : ''}
                      ${loss.reason === 'theft' ? 'bg-purple-100 text-purple-700' : ''}
                      ${loss.reason === 'other' ? 'bg-gray-100 text-gray-700' : ''}
                    `}>
                      {loss.reason === 'expiration' && 'Vencimento'}
                      {loss.reason === 'damage' && 'Dano'}
                      {loss.reason === 'theft' && 'Furto'}
                      {loss.reason === 'other' && 'Outro'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
