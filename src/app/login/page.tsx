'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase/config'
import { Icons } from '@/components/ui/icons'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        let errorMessage = authError.message
        if (authError.message === 'Invalid login credentials') {
          errorMessage = 'Email ou senha incorretos'
        } else if (authError.message === 'Email not confirmed') {
          errorMessage = 'Email não confirmado. Verifique sua caixa de entrada.'
        }
        setError(errorMessage)
        setLoading(false)
        return
      }

      // Check super admin, store user, and tenant in parallel for speed
      const [superAdminRes, storeUserRes, tenantRes] = await Promise.all([
        supabase
          .from('super_admin_users')
          .select('id')
          .eq('email', email.toLowerCase())
          .maybeSingle(),
        supabase
          .from('store_users')
          .select('tenant_id')
          .eq('email', email.toLowerCase())
          .maybeSingle(),
        supabase
          .from('tenants')
          .select('subscription_status')
          .eq('owner_email', email.toLowerCase())
          .maybeSingle()
      ])

      // Super admin with store_user goes to dashboard (like normal user)
      // Super admin without store_user goes to admin panel
      if (storeUserRes.data) {
        router.replace('/dashboard')
      } else if (superAdminRes.data) {
        router.replace('/admin')
      } else if (tenantRes.data) {
        // User has tenant but no store_user - pending approval
        router.replace('/aguardando-aprovacao')
      } else {
        // No tenant at all - shouldn't happen but redirect to register
        router.replace('/register')
      }

    } catch (err) {
      setError('Erro de conexão. Tente novamente.')
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4">
      <div className="max-w-sm w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
            <Icons.pdv className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">RetailOS</h1>
          <p className="text-slate-500 mt-1">Sistema de gestão para varejo</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <Icons.losses className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-4 border border-slate-200 rounded-xl
                             text-slate-800 placeholder:text-slate-400
                             focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                             transition-all"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 border border-slate-200 rounded-xl
                             text-slate-800 placeholder:text-slate-400
                             focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                             transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-emerald-600 text-white font-semibold rounded-xl
                         hover:bg-emerald-700 active:scale-[0.98]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all shadow-lg shadow-emerald-500/25
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Icons.loader className="w-5 h-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500">
          Não tem uma conta?{' '}
          <Link href="/register" className="text-emerald-600 hover:text-emerald-700 font-medium">
            Cadastre sua loja
          </Link>
        </p>
      </div>
    </div>
  )
}
