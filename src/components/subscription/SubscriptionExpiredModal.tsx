'use client'

import Link from 'next/link'

interface SubscriptionExpiredModalProps {
  storeName: string
  status: 'trial_expired' | 'suspended' | 'cancelled'
}

export function SubscriptionExpiredModal({ storeName, status }: SubscriptionExpiredModalProps) {
  const getContent = () => {
    switch (status) {
      case 'trial_expired':
        return {
          icon: '⏰',
          title: 'Seu teste grátis acabou!',
          subtitle: 'Mas não se preocupe, você pode continuar usando',
          description: 'Assine agora por apenas R$ 45,90/mês e continue gerenciando sua loja com todas as funcionalidades.',
          buttonText: 'Assinar Agora',
          buttonColor: 'bg-green-600 hover:bg-green-700'
        }
      case 'suspended':
        return {
          icon: '⚠️',
          title: 'Acesso Suspenso',
          subtitle: 'Existe uma pendência no seu pagamento',
          description: 'Regularize sua situação para voltar a usar o sistema. Seus dados estão seguros e serão restaurados após o pagamento.',
          buttonText: 'Regularizar Pagamento',
          buttonColor: 'bg-orange-600 hover:bg-orange-700'
        }
      case 'cancelled':
        return {
          icon: '😢',
          title: 'Assinatura Cancelada',
          subtitle: 'Sentimos sua falta!',
          description: 'Você pode reativar sua assinatura a qualquer momento e voltar a usar todas as funcionalidades.',
          buttonText: 'Reativar Assinatura',
          buttonColor: 'bg-blue-600 hover:bg-blue-700'
        }
    }
  }

  const content = getContent()

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-8 text-center">
          <div className="text-6xl mb-4">{content.icon}</div>
          <h1 className="text-2xl font-bold text-white mb-2">{content.title}</h1>
          <p className="text-white/90">{content.subtitle}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Store name */}
          <div className="text-center">
            <p className="text-gray-500 text-sm">Loja</p>
            <p className="text-xl font-bold text-gray-800">{storeName}</p>
          </div>

          {/* Description */}
          <p className="text-gray-600 text-center">
            {content.description}
          </p>

          {/* Price highlight */}
          {status === 'trial_expired' && (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 text-center">
              <p className="text-gray-600 text-sm mb-1">Investimento mensal</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-sm text-gray-500">R$</span>
                <span className="text-4xl font-bold text-green-600">45</span>
                <span className="text-xl text-green-600">,90</span>
              </div>
              <p className="text-green-600 text-sm mt-1">menos de R$ 1,50 por dia!</p>
            </div>
          )}

          {/* Benefits */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">O que você terá:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                'PDV completo',
                'Controle de estoque',
                'Registro de perdas',
                'Relatórios',
                'Funcionários ilimitados',
                'Suporte WhatsApp'
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-600">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <Link
            href="/assinatura"
            className={`
              block w-full py-4 text-center text-white font-bold text-lg rounded-xl
              ${content.buttonColor} active:scale-[0.98] transition-all shadow-lg
            `}
          >
            {content.buttonText}
          </Link>

          {/* Contact support */}
          <p className="text-center text-sm text-gray-500">
            Dúvidas?{' '}
            <a 
              href="https://wa.me/5511999999999" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-600 font-medium hover:underline"
            >
              Fale conosco no WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
