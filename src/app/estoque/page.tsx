'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, ProductUnit } from '@/types'
import Link from 'next/link'
import { Icons } from '@/components/ui/icons'
import { BottomNav } from '@/components/ui/bottom-nav'

interface ProductForm {
  id?: string
  sku: string
  name: string
  price: string
  cost_price: string
  unit: ProductUnit
  stock: string
  category: string
}

interface FormErrors {
  name?: string
  price?: string
  cost_price?: string
  stock?: string
  sku?: string
}

const emptyProduct: ProductForm = {
  sku: '',
  name: '',
  price: '',
  cost_price: '',
  unit: 'kg',
  stock: '0',
  category: ''
}

const categories = ['Frutas', 'Verduras', 'Legumes', 'Temperos', 'Outros']

export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<ProductForm>(emptyProduct)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [editingStock, setEditingStock] = useState<{id: string, value: string} | null>(null)
  const [autoGenerateSku, setAutoGenerateSku] = useState(true)
  const [margin, setMargin] = useState<number | null>(null)

  useEffect(() => {
    loadTenantAndProducts()
  }, [])

  async function loadTenantAndProducts() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return

      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id')
        .eq('email', user.email.toLowerCase())
        .single()

      if (!storeUser) return
      setTenantId(storeUser.tenant_id)

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', storeUser.tenant_id)
        .eq('is_active', true)
        .order('name')

      setProducts(productsData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  // Função para formatar valor monetário
  function formatCurrency(value: string): string {
    // Remove tudo exceto números, vírgula e ponto
    let cleaned = value.replace(/[^\d,.]/g, '')
    
    // Se tem vírgula, substitui ponto por nada e mantém vírgula
    if (cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }
    
    if (!cleaned) return ''
    
    const num = parseFloat(cleaned)
    if (isNaN(num)) return ''
    
    // Formata sempre com 2 casas decimais
    return num.toFixed(2).replace('.', ',')
  }

  // Função para formatar número decimal
  function formatDecimal(value: string): string {
    // Remove tudo exceto números, vírgula e ponto
    let cleaned = value.replace(/[^\d,.]/g, '')
    
    // Se tem vírgula, substitui ponto por nada e mantém vírgula
    if (cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }
    
    if (!cleaned) return '0'
    
    const num = parseFloat(cleaned)
    if (isNaN(num)) return '0'
    
    // Se o número é inteiro, retorna sem decimais
    if (num % 1 === 0) {
      return num.toString()
    }
    
    // Retorna com vírgula como separador decimal
    return num.toString().replace('.', ',')
  }

  // Gerar SKU automático baseado no nome
  function generateSku(name: string): string {
    if (!name.trim()) return ''
    const words = name.trim().toUpperCase().split(' ')
    const initials = words.map(w => w[0]).join('').slice(0, 3)
    const timestamp = Date.now().toString().slice(-4)
    return `${initials}-${timestamp}`
  }

  // Validar formulário
  function validateForm(): boolean {
    const errors: FormErrors = {}
    
    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório'
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Nome deve ter pelo menos 2 caracteres'
    }

    const price = parseFloat(formData.price.replace(',', '.'))
    if (!formData.price || isNaN(price) || price <= 0) {
      errors.price = 'Preço inválido'
    }

    if (formData.cost_price) {
      const costPrice = parseFloat(formData.cost_price.replace(',', '.'))
      if (isNaN(costPrice) || costPrice < 0) {
        errors.cost_price = 'Custo inválido'
      } else if (costPrice > price) {
        errors.cost_price = 'Custo não pode ser maior que o preço'
      }
    }

    if (formData.stock) {
      const stock = parseFloat(formData.stock.replace(',', '.'))
      if (isNaN(stock) || stock < 0) {
        errors.stock = 'Estoque inválido'
      }
    }

    // Verificar SKU duplicado apenas para novos produtos
    if (!formData.id && formData.sku.trim()) {
      const existingProduct = products.find(p => p.sku.toLowerCase() === formData.sku.trim().toLowerCase())
      if (existingProduct) {
        errors.sku = 'SKU já existe'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Calcular margem de lucro
  useEffect(() => {
    if (formData.price && formData.cost_price) {
      const price = parseFloat(formData.price.replace(',', '.'))
      const costPrice = parseFloat(formData.cost_price.replace(',', '.'))
      if (!isNaN(price) && !isNaN(costPrice) && costPrice > 0) {
        const marginValue = ((price - costPrice) / costPrice) * 100
        setMargin(marginValue)
      } else {
        setMargin(null)
      }
    } else {
      setMargin(null)
    }
  }, [formData.price, formData.cost_price])

  // Auto-gerar SKU quando nome mudar
  useEffect(() => {
    if (autoGenerateSku && !formData.id && formData.name.trim()) {
      const newSku = generateSku(formData.name)
      setFormData(prev => {
        // Só atualiza se o SKU estiver vazio ou se foi gerado automaticamente (começa com iniciais do nome)
        if (!prev.sku || prev.sku.startsWith(formData.name.trim().split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase())) {
          return { ...prev, sku: newSku }
        }
        return prev
      })
    }
  }, [formData.name, autoGenerateSku, formData.id])

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return

    if (!validateForm()) {
      setError('Por favor, corrija os erros no formulário')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const supabase = createClient()

      const price = parseFloat(formData.price.replace(',', '.'))
      const costPrice = formData.cost_price ? parseFloat(formData.cost_price.replace(',', '.')) : null
      const stock = formData.stock ? parseFloat(formData.stock.replace(',', '.')) : 0

      const sku = formData.sku.trim() || generateSku(formData.name)

      // Verificar duplicatas antes de salvar
      if (!formData.id) {
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('sku', sku)
          .eq('is_active', true)
          .single()

        if (existing) {
          setFormErrors({ sku: 'SKU já existe' })
          setError('SKU já cadastrado')
          return
        }
      }

      if (formData.id) {
        await supabase.from('products').update({
          sku, name: formData.name.trim(), price, cost_price: costPrice,
          unit: formData.unit, stock, category: formData.category || null
        }).eq('id', formData.id)
        setSuccess('Produto atualizado!')
      } else {
        await supabase.from('products').insert({
          tenant_id: tenantId, sku, name: formData.name.trim(), price,
          cost_price: costPrice, unit: formData.unit, stock,
          category: formData.category || null, default_quantity: formData.unit === 'un' ? 1 : 0.5
        })
        setSuccess('Produto cadastrado!')
      }

      setFormData(emptyProduct)
      setFormErrors({})
      setMargin(null)
      setAutoGenerateSku(true)
      setShowForm(false)
      await loadTenantAndProducts()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleQuickStockUpdate(productId: string, newStock: number) {
    if (!tenantId || newStock < 0) return
    try {
      const supabase = createClient()
      await supabase.from('products').update({ stock: newStock }).eq('id', productId)
      setProducts(products.map(p => p.id === productId ? { ...p, stock: newStock } : p))
      setEditingStock(null)
    } catch (err) {
      setError('Erro ao atualizar estoque')
    }
  }

  async function handleDeleteProduct(product: Product) {
    if (!confirm(`Excluir "${product.name}"?`)) return
    try {
      const supabase = createClient()
      await supabase.from('products').update({ is_active: false }).eq('id', product.id)
      setProducts(products.filter(p => p.id !== product.id))
    } catch (err) {
      setError('Erro ao excluir')
    }
  }

  const filteredProducts = products.filter(p => 
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const outOfStock = products.filter(p => p.stock === 0).length
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Icons.loader className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Icons.chevronLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="font-semibold text-slate-800">Estoque</h1>
              <p className="text-xs text-slate-500">{products.length} produtos</p>
            </div>
          </div>
          <button
            onClick={() => { 
              setFormData(emptyProduct)
              setFormErrors({})
              setMargin(null)
              setAutoGenerateSku(true)
              setShowForm(true) 
            }}
            className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25"
          >
            <Icons.plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Alerts */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <Icons.losses className="w-4 h-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><Icons.close className="w-4 h-4" /></button>
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-center gap-2">
            <Icons.check className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-slate-800">{products.length}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 border border-red-100 text-center">
            <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
            <p className="text-xs text-red-600">Sem estoque</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-center">
            <p className="text-2xl font-bold text-amber-600">{lowStock}</p>
            <p className="text-xs text-amber-600">Baixo</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-slate-800"
          />
        </div>

        {/* Products */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <Icons.stock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum produto encontrado</p>
            {products.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium"
              >
                Cadastrar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map(product => (
              <div 
                key={product.id} 
                className={`bg-white rounded-xl p-4 border shadow-sm
                  ${product.stock === 0 ? 'border-l-4 border-l-red-500 border-slate-100' : 
                    product.stock <= 10 ? 'border-l-4 border-l-amber-500 border-slate-100' : 'border-slate-100'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.sku} · {product.category || 'Sem categoria'}</p>
                  </div>
                  <p className="text-lg font-bold text-emerald-600">
                    R$ {product.price.toFixed(2).replace('.', ',')}
                    <span className="text-xs text-slate-500 font-normal">/{product.unit}</span>
                  </p>
                </div>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {editingStock?.id === product.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editingStock.value}
                          onChange={e => setEditingStock({ ...editingStock, value: e.target.value })}
                          className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center text-slate-800"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleQuickStockUpdate(product.id, parseFloat(editingStock.value) || 0)
                            if (e.key === 'Escape') setEditingStock(null)
                          }}
                        />
                        <button onClick={() => handleQuickStockUpdate(product.id, parseFloat(editingStock.value) || 0)}>
                          <Icons.check className="w-5 h-5 text-emerald-600" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingStock({ id: product.id, value: product.stock.toString() })}
                        className={`px-3 py-1 rounded-full text-sm font-medium
                          ${product.stock === 0 ? 'bg-red-100 text-red-700' :
                            product.stock <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}
                      >
                        {product.stock} em estoque
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { 
                        setFormData({
                          id: product.id, sku: product.sku, name: product.name,
                          price: product.price.toFixed(2).replace('.', ','),
                          cost_price: product.cost_price?.toFixed(2).replace('.', ',') || '',
                          unit: product.unit, 
                          stock: product.stock % 1 === 0 ? product.stock.toString() : product.stock.toString().replace('.', ','),
                          category: product.category || ''
                        })
                        setFormErrors({})
                        setAutoGenerateSku(false)
                        setShowForm(true) 
                      }}
                      className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center"
                    >
                      <Icons.settings className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product)}
                      className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center"
                    >
                      <Icons.close className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="w-full max-w-lg bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                {formData.id ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button onClick={() => setShowForm(false)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center">
                <Icons.close className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="p-6 space-y-5">
              {/* Nome do Produto */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome do Produto *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => {
                      setFormData({ ...formData, name: e.target.value })
                      setFormErrors({ ...formErrors, name: undefined })
                    }}
                    onBlur={() => validateForm()}
                    placeholder="Ex: Banana Prata"
                    className={`w-full h-12 pl-12 pr-4 border rounded-xl text-slate-800 transition-colors
                      ${formErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}
                      focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                    required
                  />
                  <Icons.stock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                </div>
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <Icons.losses className="w-3 h-3" />
                    {formErrors.name}
                  </p>
                )}
              </div>

              {/* SKU */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    SKU (Código)
                  </label>
                  {!formData.id && (
                    <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoGenerateSku}
                        onChange={e => {
                          setAutoGenerateSku(e.target.checked)
                          if (e.target.checked && formData.name) {
                            setFormData({ ...formData, sku: generateSku(formData.name) })
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Gerar automaticamente
                    </label>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={e => {
                      setFormData({ ...formData, sku: e.target.value.toUpperCase() })
                      setAutoGenerateSku(false)
                      setFormErrors({ ...formErrors, sku: undefined })
                    }}
                    onBlur={() => validateForm()}
                    placeholder="Ex: BAN-1234"
                    className={`w-full h-12 pl-12 pr-4 border rounded-xl text-slate-800 uppercase transition-colors
                      ${formErrors.sku ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}
                      focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                    disabled={autoGenerateSku && !formData.id}
                  />
                  <Icons.scan className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                </div>
                {formErrors.sku && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <Icons.losses className="w-3 h-3" />
                    {formErrors.sku}
                  </p>
                )}
              </div>

              {/* Preço e Unidade */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Preço de Venda (R$) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.price}
                      onChange={e => {
                        const formatted = formatCurrency(e.target.value)
                        setFormData({ ...formData, price: formatted })
                        setFormErrors({ ...formErrors, price: undefined })
                      }}
                      onBlur={() => validateForm()}
                      placeholder="0,00"
                      className={`w-full h-12 pl-12 pr-4 border rounded-xl text-slate-800 font-semibold transition-colors
                        ${formErrors.price ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}
                        focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                      required
                    />
                    <Icons.dollar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600" />
                  </div>
                  {formErrors.price && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <Icons.losses className="w-3 h-3" />
                      {formErrors.price}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Unidade de Medida
                  </label>
                  <select
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value as ProductUnit })}
                    className="w-full h-12 px-4 border border-slate-200 rounded-xl text-slate-800 bg-white
                      focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="kg">kg (Quilograma)</option>
                    <option value="un">un (Unidade)</option>
                    <option value="g">g (Grama)</option>
                    <option value="l">l (Litro)</option>
                  </select>
                </div>
              </div>

              {/* Custo e Estoque */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Custo de Compra (R$)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.cost_price}
                      onChange={e => {
                        const formatted = formatCurrency(e.target.value)
                        setFormData({ ...formData, cost_price: formatted })
                        setFormErrors({ ...formErrors, cost_price: undefined })
                      }}
                      onBlur={() => validateForm()}
                      placeholder="0,00"
                      className={`w-full h-12 pl-12 pr-4 border rounded-xl text-slate-800 transition-colors
                        ${formErrors.cost_price ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}
                        focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                    />
                    <Icons.trendDown className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                  {formErrors.cost_price && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <Icons.losses className="w-3 h-3" />
                      {formErrors.cost_price}
                    </p>
                  )}
                  {margin !== null && !formErrors.cost_price && (
                    <p className={`mt-1 text-xs font-medium ${
                      margin > 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      Margem: {margin > 0 ? '+' : ''}{margin.toFixed(1)}%
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Estoque Inicial
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.stock}
                      onChange={e => {
                        const formatted = formatDecimal(e.target.value)
                        setFormData({ ...formData, stock: formatted })
                        setFormErrors({ ...formErrors, stock: undefined })
                      }}
                      onBlur={() => validateForm()}
                      placeholder="0"
                      className={`w-full h-12 pl-12 pr-4 border rounded-xl text-slate-800 transition-colors
                        ${formErrors.stock ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}
                        focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent`}
                    />
                    <Icons.stock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  </div>
                  {formErrors.stock && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <Icons.losses className="w-3 h-3" />
                      {formErrors.stock}
                    </p>
                  )}
                </div>
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Categoria
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full h-12 px-4 border border-slate-200 rounded-xl text-slate-800 bg-white
                    focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              {/* Resumo de Informações */}
              {formData.price && !formErrors.price && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs font-medium text-slate-600 mb-2">Resumo</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Preço:</span>
                      <span className="font-semibold text-slate-800">
                        R$ {formData.price}/{formData.unit}
                      </span>
                    </div>
                    {formData.cost_price && !formErrors.cost_price && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Custo:</span>
                          <span className="text-slate-800">R$ {formData.cost_price}</span>
                        </div>
                        {margin !== null && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Lucro:</span>
                            <span className={`font-semibold ${margin > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              R$ {(parseFloat(formData.price.replace(',', '.')) - parseFloat(formData.cost_price.replace(',', '.'))).toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {formData.stock && !formErrors.stock && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Estoque:</span>
                        <span className="text-slate-800">{formData.stock} {formData.unit}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botão Salvar */}
              <button
                type="submit"
                disabled={saving}
                className="w-full h-14 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 
                  disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 
                  transition-all shadow-lg shadow-emerald-500/25"
              >
                {saving ? (
                  <>
                    <Icons.loader className="w-5 h-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Icons.check className="w-5 h-5" />
                    {formData.id ? 'Atualizar Produto' : 'Cadastrar Produto'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
