'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AguardandoAprovacaoPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  // Verifica periodicamente se foi aprovado
  useEffect(() => {
    const checkApproval = async () => {
      setChecking(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.replace('/login')
        return
      }

      // Check both tenant status AND store_user existence
      const [tenantRes, storeUserRes] = await Promise.all([
        supabase
          .from('tenants')
          .select('subscription_status')
          .eq('owner_email', user.email?.toLowerCase() || '')
          .maybeSingle(),
        supabase
          .from('store_users')
          .select('id')
          .eq('email', user.email?.toLowerCase() || '')
          .maybeSingle()
      ])

      // Only redirect if tenant is active AND store_user exists
      if (storeUserRes.data && 
          (tenantRes.data?.subscription_status === 'active' || tenantRes.data?.subscription_status === 'trial')) {
        router.replace('/dashboard')
      }
      setChecking(false)
    }

    checkApproval()
    const interval = setInterval(checkApproval, 30000) // Verifica a cada 30s
    return () => clearInterval(interval)
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Ícone de relógio/espera */}
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Aguardando Aprovação
        </h1>
        
        <p className="text-gray-600 mb-6">
          Seu cadastro foi recebido e está sendo analisado pela nossa equipe.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            <strong>⏱️ Tempo estimado:</strong> até 24 horas úteis
          </p>
          <p className="text-blue-700 text-xs mt-2">
            Você receberá um email assim que sua conta for aprovada.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-gray-700 text-sm font-medium mb-2">
            Enquanto isso, você pode:
          </p>
          <ul className="text-gray-600 text-sm text-left space-y-2">
            <li className="flex items-start gap-2">
              <span>📚</span>
              <span>Assistir nosso tutorial para conhecer o sistema</span>
            </li>
            <li className="flex items-start gap-2">
              <span>📱</span>
              <span>Preparar a lista de produtos que vai cadastrar</span>
            </li>
            <li className="flex items-start gap-2">
              <span>💬</span>
              <span>Entrar em contato pelo WhatsApp se tiver dúvidas</span>
            </li>
          </ul>
        </div>

        {checking && (
          <p className="text-gray-400 text-xs mb-4 flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Verificando status...
          </p>
        )}

        <div className="flex flex-col gap-3">
          <a
            href="/tutorial"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            📚 Ver Tutorial
          </a>
          
          <button
            onClick={handleLogout}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 text-sm"
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}
