import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Email confirmado com sucesso, redireciona para o dashboard
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Se houver erro, redireciona para login com mensagem
  return NextResponse.redirect(`${origin}/login?error=auth_error`)
}
