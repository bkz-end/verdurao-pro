'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    storeName: '',
    ownerName: '',
    email: '',
    phone: '',
    cnpj: '',
    address: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validações
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      
      // 1. Criar usuário no Supabase Auth
      // Nota: emailRedirectTo desabilita a confirmação automática de email
      // O email será confirmado quando o admin aprovar o cadastro
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          // Desabilita email de confirmação - admin vai aprovar manualmente
          emailRedirectTo: undefined,
          data: {
            store_name: formData.storeName,
            owner_name: formData.ownerName
          }
        }
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('Este email já está cadastrado')
        } else {
          setError(authError.message)
        }
        return
      }

      // 2. Criar tenant (loja) no banco
      const { error: tenantError } = await supabase
        .from('tenants')
        .insert({
          store_name: formData.storeName,
          owner_name: formData.ownerName,
          owner_email: formData.email.toLowerCase(),
          owner_phone: formData.phone,
          cnpj: formData.cnpj || null,
          address: formData.address || null,
          subscription_status: 'pending'
        })

      if (tenantError) {
        console.error('Tenant error:', tenantError)
        setError('Erro ao criar loja. Tente novamente.')
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro Enviado!</h2>
          <p className="text-gray-600 mb-4">
            Seu cadastro foi recebido e está aguardando aprovação.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="text-blue-800 text-sm">
              <strong>📧 Verifique seu email!</strong><br />
              Enviamos um link de confirmação para o seu email. 
              Clique no link para ativar sua conta.
            </p>
          </div>
          <p className="text-gray-500 text-sm mb-6">
            Após confirmar o email e ser aprovado pelo administrador, 
            você poderá acessar o sistema.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Ir para Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-600">FeiraPro</h1>
          <p className="text-gray-600 mt-2">Cadastre sua loja</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Loja *
              </label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-500 text-gray-900"
                placeholder="Ex: Hortifruti Central"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seu Nome *
              </label>
              <input
                type="text"
                required
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-500 text-gray-900"
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-500 text-gray-900"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone/WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-500 text-gray-900"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CNPJ (opcional)
              </label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-500 text-gray-900"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereço (opcional)
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-500 text-gray-900"
                placeholder="Rua, número, bairro, cidade"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha *
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-500 text-gray-900"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Senha *
              </label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-500 text-gray-900"
                placeholder="Repita a senha"
              />
            </div>

            <div className="bg-green-50 p-3 rounded-lg text-sm text-green-800 border border-green-200">
              <strong>7 dias grátis!</strong> Após o período de teste, a mensalidade é de R$ 45,90/mês.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Cadastrando...' : 'Cadastrar Minha Loja'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Já tem uma conta?{' '}
            <Link href="/login" className="text-green-600 hover:text-green-500 font-medium">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
