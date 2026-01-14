'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function AssinaturaPage() {
  const [loading, setLoading] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('')

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return

      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id')
        .eq('email', user.email.toLowerCase())
        .single()

      if (!storeUser) return

      const { data: tenant } = await supabase
        .from('tenants')
        .select('store_name, trial_ends_at, subscription_status')
        .eq('id', storeUser.tenant_id)
        .single()

      if (tenant) {
        setStoreName(tenant.store_name)
        setTrialEndsAt(tenant.trial_ends_at)
        setSubscriptionStatus(tenant.subscription_status)
      }
    }
    loadData()
  }, [])

  const getDaysLeft = () => {
    if (!trialEndsAt) return null
    const trialEnd = new Date(trialEndsAt)
    const now = new Date()
    const diffTime = trialEnd.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const daysLeft = getDaysLeft()
  const isTrialActive = daysLeft !== null && daysLeft > 0

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (data.checkoutUrl) {
        // Redirect to Mercado Pago checkout
        window.location.href = data.checkoutUrl
      } else {
        alert(data.error || 'Erro ao criar checkout. Tente novamente.')
        setLoading(false)
      }
    } catch (error) {
      alert('Erro ao processar. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href="/pdv"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Assinatura</h1>
            <p className="text-sm text-gray-500">{storeName}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Status atual */}
        <div className={`
          rounded-2xl p-6 text-center
          ${isTrialActive 
            ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
            : subscriptionStatus === 'active'
              ? 'bg-gradient-to-br from-green-500 to-green-600'
              : 'bg-gradient-to-br from-orange-500 to-orange-600'
          }
        `}>
          <div className="text-5xl mb-3">
            {isTrialActive ? '🎁' : subscriptionStatus === 'active' ? '✅' : '⏰'}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isTrialActive 
              ? 'Período de Teste' 
              : subscriptionStatus === 'active'
                ? 'Assinatura Ativa'
                : 'Teste Encerrado'
            }
          </h2>
          {isTrialActive && daysLeft !== null && (
            <div className="bg-white/20 rounded-xl px-4 py-2 inline-block">
              <span className="text-white font-bold text-lg">
                {daysLeft === 1 ? '1 dia restante' : `${daysLeft} dias restantes`}
              </span>
            </div>
          )}
          {subscriptionStatus === 'active' && !isTrialActive && (
            <p className="text-white/90">Você tem acesso completo ao sistema</p>
          )}
        </div>

        {/* Plano */}
        <div className="bg-white rounded-2xl border-2 border-green-500 overflow-hidden shadow-lg">
          {/* Badge */}
          <div className="bg-green-500 text-white text-center py-2 text-sm font-bold">
            PLANO ÚNICO - TUDO INCLUSO
          </div>

          <div className="p-6 space-y-6">
            {/* Preço */}
            <div className="text-center">
              <p className="text-gray-500 text-sm mb-1">Investimento mensal</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-xl text-gray-500">R$</span>
                <span className="text-6xl font-bold text-green-600">45</span>
                <span className="text-2xl text-green-600">,90</span>
              </div>
              <p className="text-green-600 font-medium mt-2">
                💰 Menos de R$ 1,50 por dia!
              </p>
            </div>

            {/* Benefícios */}
            <div className="space-y-3">
              {[
                { icon: '🛒', text: 'PDV completo e fácil de usar' },
                { icon: '📦', text: 'Controle de estoque em tempo real' },
                { icon: '📉', text: 'Registro e relatório de perdas' },
                { icon: '📊', text: 'Relatórios de vendas detalhados' },
                { icon: '👥', text: 'Funcionários ilimitados' },
                { icon: '📱', text: 'Funciona no celular (offline)' },
                { icon: '💬', text: 'Suporte via WhatsApp' },
                { icon: '🔄', text: 'Atualizações gratuitas' },
              ].map((benefit, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-2xl">{benefit.icon}</span>
                  <span className="text-gray-700 font-medium">{benefit.text}</span>
                </div>
              ))}
            </div>

            {/* Botão de assinar - mostra durante trial ou se não estiver ativo */}
            {(isTrialActive || subscriptionStatus !== 'active') && (
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-4 bg-green-600 text-white font-bold text-lg rounded-xl
                           hover:bg-green-700 active:scale-[0.98] transition-all shadow-lg
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processando...
                  </span>
                ) : (
                  '🚀 Assinar Agora'
                )}
              </button>
            )}

            {subscriptionStatus === 'active' && !isTrialActive && (
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <p className="text-green-700 font-medium">
                  ✅ Sua assinatura está ativa!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Formas de pagamento */}
        <div className="bg-white rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-gray-800 text-center">Formas de Pagamento</h3>
          <div className="flex justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💳</span>
              </div>
              <span className="text-xs text-gray-600">Cartão</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📱</span>
              </div>
              <span className="text-xs text-gray-600">Pix</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
              <span className="text-xs text-gray-600">Boleto</span>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500">
            Pagamento seguro via Mercado Pago
          </p>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-gray-800">Perguntas Frequentes</h3>
          
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-3 border-b border-gray-100">
              <span className="font-medium text-gray-700">Posso cancelar quando quiser?</span>
              <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <p className="py-3 text-gray-600 text-sm">
              Sim! Você pode cancelar a qualquer momento. Não há fidelidade ou multa.
            </p>
          </details>

          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-3 border-b border-gray-100">
              <span className="font-medium text-gray-700">Meus dados ficam salvos?</span>
              <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <p className="py-3 text-gray-600 text-sm">
              Sim! Seus dados ficam guardados por 90 dias após o cancelamento. Você pode reativar e continuar de onde parou.
            </p>
          </details>

          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer py-3 border-b border-gray-100">
              <span className="font-medium text-gray-700">Preciso de internet?</span>
              <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <p className="py-3 text-gray-600 text-sm">
              O sistema funciona offline! Você pode vender mesmo sem internet. Quando voltar online, tudo sincroniza automaticamente.
            </p>
          </details>
        </div>

        {/* Contato */}
        <div className="text-center space-y-3 pb-8">
          <p className="text-gray-600">Ainda tem dúvidas?</p>
          <a
            href="https://wa.me/5511999999999?text=Olá! Tenho dúvidas sobre o VerdurãoPro"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Falar no WhatsApp
          </a>
        </div>
      </main>
    </div>
  )
}
