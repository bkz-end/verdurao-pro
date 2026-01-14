'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const WHATSAPP_NUMBER = '5599981796540'

const tutorialSteps = [
  {
    id: 1,
    title: 'Bem-vindo ao FeiraPro! 🥬',
    description: 'O sistema completo para gerenciar sua feira ou verdurão. Vamos te mostrar como usar cada funcionalidade.',
    icon: '👋',
    details: [
      'Sistema de PDV rápido e fácil',
      'Controle de perdas e estoque',
      'Relatórios detalhados',
      'Gestão de funcionários'
    ]
  },
  {
    id: 2,
    title: 'PDV - Ponto de Venda',
    description: 'Registre suas vendas de forma rápida e prática.',
    icon: '🛒',
    details: [
      'Busque produtos pelo nome ou código',
      'Clique no produto para adicionar ao carrinho',
      'Ajuste a quantidade se necessário',
      'Finalize a venda com um clique',
      'Funciona mesmo sem internet!'
    ],
    path: '/pdv'
  },
  {
    id: 3,
    title: 'Controle de Perdas',
    description: 'Registre produtos perdidos para ter controle total do seu estoque.',
    icon: '📉',
    details: [
      'Selecione o produto que foi perdido',
      'Informe a quantidade e o motivo',
      'Motivos: vencimento, dano, furto, outros',
      'Acompanhe o histórico de perdas',
      'Veja relatórios para reduzir desperdícios'
    ],
    path: '/perdas'
  },
  {
    id: 4,
    title: 'Relatórios',
    description: 'Acompanhe o desempenho da sua loja com relatórios detalhados.',
    icon: '📊',
    details: [
      'Vendas por período (dia, semana, mês)',
      'Produtos mais vendidos',
      'Análise de perdas',
      'Faturamento e lucro',
      'Exporte para Excel'
    ],
    path: '/relatorios'
  },
  {
    id: 5,
    title: 'Funcionários',
    description: 'Gerencie sua equipe e controle quem pode acessar o sistema.',
    icon: '👥',
    details: [
      'Cadastre seus funcionários',
      'Defina níveis de acesso (dono, gerente, caixa)',
      'Ative ou desative acessos',
      'Cada funcionário tem seu próprio login',
      'Acompanhe vendas por funcionário'
    ],
    path: '/funcionarios'
  },
  {
    id: 6,
    title: 'Pronto para começar!',
    description: 'Você já sabe o básico. Agora é só usar!',
    icon: '🚀',
    details: [
      'Comece cadastrando seus produtos',
      'Faça sua primeira venda no PDV',
      'Qualquer dúvida, chama no WhatsApp!',
      'Boas vendas! 💚'
    ]
  }
]

export default function TutorialPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const router = useRouter()

  const markTutorialAsSeen = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      localStorage.setItem(`tutorial_seen_${user.email}`, 'true')
    }
  }

  const handleFinish = async () => {
    await markTutorialAsSeen()
    router.push('/dashboard')
  }

  const handleSkip = async () => {
    await markTutorialAsSeen()
    router.push('/dashboard')
  }

  const step = tutorialSteps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === tutorialSteps.length - 1

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              Passo {currentStep + 1} de {tutorialSteps.length}
            </span>
            <button onClick={handleSkip} className="text-sm text-green-600 hover:text-green-700">
              Pular tutorial →
            </button>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div 
              className="h-2 bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="text-center mb-6">
            <span className="text-6xl">{step.icon}</span>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">
            {step.title}
          </h1>
          
          <p className="text-gray-600 text-center mb-8">
            {step.description}
          </p>

          <ul className="space-y-3 mb-8">
            {step.details.map((detail, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <span className="text-gray-700">{detail}</span>
              </li>
            ))}
          </ul>

          {isLastStep && (
            <div className="text-center mb-4">
              <a 
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Preciso de ajuda com o FeiraPro`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium"
              >
                <span>📱</span> Falar no WhatsApp
              </a>
            </div>
          )}

          {step.path && (
            <div className="text-center mb-4">
              <Link 
                href={step.path}
                className="text-green-600 hover:text-green-700 font-medium"
              >
                Ir para {step.title} →
              </Link>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={isFirstStep}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isFirstStep
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ← Anterior
          </button>

          {isLastStep ? (
            <button
              onClick={handleFinish}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              Começar a usar! 🎉
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              Próximo →
            </button>
          )}
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {tutorialSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentStep ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
