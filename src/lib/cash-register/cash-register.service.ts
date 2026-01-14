/**
 * Cash Register Service - Sistema de Caixa
 * Gerencia abertura, fechamento, sangrias e suprimentos
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { CashRegisterSession, CashMovement, CashMovementType } from '@/types'

export interface OpenCashRegisterParams {
  tenantId: string
  userId: string
  openingAmount: number
}

export interface CloseCashRegisterParams {
  sessionId: string
  actualAmount: number
  notes?: string
}

export interface CashMovementParams {
  sessionId: string
  userId: string
  type: CashMovementType
  amount: number
  reason: string
}

export interface CashRegisterSummary {
  session: CashRegisterSession
  totalSales: number
  salesByMethod: {
    dinheiro: number
    pix: number
    cartao: number
    fiado: number
  }
  withdrawals: number
  deposits: number
  expectedCash: number
}

export class CashRegisterService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Abre um novo caixa
   */
  async openCashRegister(params: OpenCashRegisterParams): Promise<CashRegisterSession | null> {
    // Verifica se já existe caixa aberto
    const { data: existingSession } = await this.supabase
      .from('cash_register_sessions')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('status', 'open')
      .single()

    if (existingSession) {
      throw new Error('Já existe um caixa aberto. Feche-o antes de abrir outro.')
    }

    const { data, error } = await this.supabase
      .from('cash_register_sessions')
      .insert({
        tenant_id: params.tenantId,
        user_id: params.userId,
        opening_amount: params.openingAmount,
        status: 'open'
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Busca o caixa aberto atual
   */
  async getOpenSession(tenantId: string): Promise<CashRegisterSession | null> {
    const { data } = await this.supabase
      .from('cash_register_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .single()

    return data
  }

  /**
   * Calcula o resumo do caixa
   */
  async getCashRegisterSummary(sessionId: string): Promise<CashRegisterSummary | null> {
    // Busca a sessão
    const { data: session } = await this.supabase
      .from('cash_register_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!session) return null

    // Busca vendas da sessão
    const { data: sales } = await this.supabase
      .from('sales')
      .select('total, payment_method')
      .eq('session_id', sessionId)

    // Busca movimentações
    const { data: movements } = await this.supabase
      .from('cash_movements')
      .select('type, amount')
      .eq('session_id', sessionId)

    // Calcula totais
    const salesByMethod = {
      dinheiro: 0,
      pix: 0,
      cartao: 0,
      fiado: 0
    }

    let totalSales = 0
    sales?.forEach(sale => {
      totalSales += sale.total
      if (sale.payment_method && sale.payment_method in salesByMethod) {
        salesByMethod[sale.payment_method as keyof typeof salesByMethod] += sale.total
      }
    })

    let withdrawals = 0
    let deposits = 0
    movements?.forEach(mov => {
      if (mov.type === 'withdrawal') withdrawals += mov.amount
      else deposits += mov.amount
    })

    // Dinheiro esperado = abertura + vendas em dinheiro + suprimentos - sangrias
    const expectedCash = session.opening_amount + salesByMethod.dinheiro + deposits - withdrawals

    return {
      session,
      totalSales,
      salesByMethod,
      withdrawals,
      deposits,
      expectedCash
    }
  }

  /**
   * Fecha o caixa
   */
  async closeCashRegister(params: CloseCashRegisterParams): Promise<CashRegisterSession | null> {
    const summary = await this.getCashRegisterSummary(params.sessionId)
    if (!summary) throw new Error('Sessão não encontrada')

    const difference = params.actualAmount - summary.expectedCash

    const { data, error } = await this.supabase
      .from('cash_register_sessions')
      .update({
        closed_at: new Date().toISOString(),
        expected_amount: summary.expectedCash,
        actual_amount: params.actualAmount,
        difference,
        notes: params.notes,
        status: 'closed'
      })
      .eq('id', params.sessionId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Registra sangria ou suprimento
   */
  async addCashMovement(params: CashMovementParams): Promise<CashMovement | null> {
    const { data, error } = await this.supabase
      .from('cash_movements')
      .insert({
        session_id: params.sessionId,
        user_id: params.userId,
        type: params.type,
        amount: params.amount,
        reason: params.reason
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Lista movimentações de uma sessão
   */
  async getSessionMovements(sessionId: string): Promise<CashMovement[]> {
    const { data } = await this.supabase
      .from('cash_movements')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    return data || []
  }

  /**
   * Lista histórico de sessões
   */
  async getSessionHistory(tenantId: string, limit = 30): Promise<CashRegisterSession[]> {
    const { data } = await this.supabase
      .from('cash_register_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('opened_at', { ascending: false })
      .limit(limit)

    return data || []
  }
}
