'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AguardandoAprovacaoPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [debugInfo, setDebugInfo] = useState<string>('')

  const checkApproval = async () => {
    setChecking(true)
    setStatus('Verificando...')
    
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.replace('/login')
        return
      }

      const email = user.email?.toLowerCase() || ''
      setDebugInfo(`Email: ${email}`)

      // Check tenant status
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('subscription_status, store_name')
        .eq('owner_email', email)
        .maybeSingle()

      if (tenantError) {
        setStatus(`Erro ao buscar tenant: ${tenantError.message}`)
        setChecking(false)
        return
      }

      if (!tenant) {
        setStatus('Tenant não encontrado')
        setChecking(false)
        return
      }

      setDebugInfo(prev => `${prev}\nTenant: ${tenant.store_name} (${tenant.subscription_status})`)

      // Check store_user
      const { data: storeUser, error: storeUserError } = await supabase
        .from('store_users')
        .select('id, name')
        .eq('email', email)
        .maybeSingle()

      if (storeUserError) {
        setDebugInfo(prev => `${prev}\nErro store_user: ${storeUserError.message}`)
      }

      setDebugInfo(prev => `${prev}\nStore User: ${storeUser ? storeUser.name : 'NÃO ENCONTRADO'}`)

      // Redirect if approved
      if (storeUser && (tenant.subscription_status === 'active' || tenant.subscription_status === 'trial')) {
        setStatus('Aprovado! Redirecionando...')
        router.replace('/dashboard')
        return
      }

      if (tenant.subscription_status === 'active' && !storeUser) {
        setStatus('Tenant aprovado mas store_user não criado. Contate o suporte.')
      } else if (tenant.subscription_status === 'pending') {
        setStatus('Aguardando aprovação do administrador')
      } else {
        setStatus(`Status: ${tenant.subscription_status}`)
      }
    } catch (err) {
      setStatus(`Erro: ${err instanceof Error ? err.message : 'Desconhecido'}`)
    }
    
    setChecking(false)
  }

  useEffect(() => {
    checkApproval()
    const interval = setInterval(checkApproval, 30000)
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
        
        <p className="text-gray-600 mb-4">
          Seu cadastro foi recebido e está sendo analisado.
        </p>

        {/* Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-blue-800 text-sm font-medium">{status || 'Verificando...'}</p>
        </div>

        {/* Debug Info */}
        {debugInfo && (
          <div className="bg-gray-100 rounded-lg p-3 mb-4 text-left">
            <p className="text-xs text-gray-600 font-mono whitespace-pre-line">{debugInfo}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={checkApproval}
            disabled={checking}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
          >
            {checking ? 'Verificando...' : '🔄 Verificar Agora'}
          </button>
          
          <a href="/tutorial" className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
            📚 Ver Tutorial
          </a>
          
          <button onClick={handleLogout} className="px-6 py-3 text-gray-500 hover:text-gray-700 text-sm">
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}
