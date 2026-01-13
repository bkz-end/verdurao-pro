'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, ProductUnit } from '@/types'
import Link from 'next/link'

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

const emptyProduct: ProductForm = {
  sku: '',
  name: '',
  price: '',
  cost_price: '',
  unit: 'kg',
  stock: '0',
  category: ''
}

const categories = [
  'Frutas',
  'Verduras',
  'Legumes',
  'Temperos',
  'Outros'
]

export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<ProductForm>(emptyProduct)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [editingStock, setEditingStock] = useState<{id: string, value: string} | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name')

  useEffect(() => {
    loadTenantAndProducts()
  }, [])

  async function loadTenantAndProducts() {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('Usuário não autenticado')
        return
      }

      const { data: storeUser } = await supabase
        .from('store_users')
        .select('tenant_id')
        .eq('email', user.email.toLowerCase())
        .single()

      if (!storeUser) {
        setError('Usuário não encontrado')
        return
      }

      setTenantId(storeUser.tenant_id)

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', storeUser.tenant_id)
        .eq('is_active', true)
        .order('name')

      if (productsError) throw productsError

      setProducts(productsData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return

    try {
      setSaving(true)
      setError(null)

      const supabase = createClient()

      const price = parseFloat(formData.price.replace(',', '.'))
      const costPrice = formData.cost_price ? parseFloat(formData.cost_price.replace(',', '.')) : null
      const stock = formData.stock ? parseFloat(formData.stock.replace(',', '.')) : 0

      if (isNaN(price) || price <= 0) {
        setError('Preço de venda inválido')
        return
      }

      if (!formData.name.trim()) {
        setError('Nome do produto é obrigatório')
        return
      }

      // Generate SKU if empty
      const sku = formData.sku.trim() || `PRD-${Date.now()}`

      if (formData.id) {
        // Update existing product
        const { error: updateError } = await supabase
          .from('products')
          .update({
            sku,
            name: formData.name.trim(),
            price,
            cost_price: costPrice,
            unit: formData.unit,
            stock,
            category: formData.category || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.id)
          .eq('tenant_id', tenantId)

        if (updateError) throw updateError
        setSuccess('Produto atualizado!')
      } else {
        // Check if SKU already exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('sku', sku)
          .single()

        if (existing) {
          setError('Código/SKU já existe')
          return
        }

        const { error: insertError } = await supabase
          .from('products')
          .insert({
            tenant_id: tenantId,
            sku,
            name: formData.name.trim(),
            price,
            cost_price: costPrice,
            unit: formData.unit,
            stock,
            category: formData.category || null,
            default_quantity: formData.unit === 'un' ? 1 : 0.5
          })

        if (insertError) throw insertError
        setSuccess('Produto cadastrado!')
      }

      setFormData(emptyProduct)
      setShowForm(false)
      await loadTenantAndProducts()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto')
    } finally {
      setSaving(false)
    }
  }

  async function handleQuickStockUpdate(productId: string, newStock: number) {
    if (!tenantId || newStock < 0) return

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .eq('tenant_id', tenantId)

      if (updateError) throw updateError

      setProducts(products.map(p => 
        p.id === productId ? { ...p, stock: newStock } : p
      ))
      setEditingStock(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar estoque')
    }
  }

  async function handleDeleteProduct(product: Product) {
    if (!confirm(`Excluir "${product.name}"?\n\nEssa ação não pode ser desfeita.`)) return

    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', product.id)
        .eq('tenant_id', tenantId)

      if (deleteError) throw deleteError

      setProducts(products.filter(p => p.id !== product.id))
      setSuccess('Produto excluído')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir produto')
    }
  }

  function handleEditProduct(product: Product) {
    setFormData({
      id: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price.toFixed(2).replace('.', ','),
      cost_price: product.cost_price?.toFixed(2).replace('.', ',') || '',
      unit: product.unit,
      stock: product.stock.toString(),
      category: product.category || ''
    })
    setShowForm(true)
  }

  // Filter and sort products
  let filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = !filterCategory || p.category === filterCategory
    
    const matchesStock = filterStock === 'all' ||
      (filterStock === 'out' && p.stock === 0) ||
      (filterStock === 'low' && p.stock > 0 && p.stock <= 10)

    return matchesSearch && matchesCategory && matchesStock
  })

  // Sort
  filteredProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'stock') return a.stock - b.stock
    if (sortBy === 'price') return a.price - b.price
    return 0
  })

  const outOfStockCount = products.filter(p => p.stock === 0).length
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 10).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando produtos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-2xl">
                ←
              </Link>
              <div>
                <h1 className="text-xl font-bold text-green-600">📦 Estoque</h1>
                <p className="text-sm text-gray-500">{products.length} produtos cadastrados</p>
              </div>
            </div>
            <button
              onClick={() => { setFormData(emptyProduct); setShowForm(true) }}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm"
            >
              + Novo Produto
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            ✓ {success}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{products.length}</p>
          </div>
          <div 
            className={`rounded-lg shadow p-4 cursor-pointer transition-colors ${filterStock === 'out' ? 'bg-red-100 border-2 border-red-400' : 'bg-white hover:bg-red-50'}`}
            onClick={() => setFilterStock(filterStock === 'out' ? 'all' : 'out')}
          >
            <p className="text-sm text-gray-500">Sem Estoque</p>
            <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
          </div>
          <div 
            className={`rounded-lg shadow p-4 cursor-pointer transition-colors ${filterStock === 'low' ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-white hover:bg-yellow-50'}`}
            onClick={() => setFilterStock(filterStock === 'low' ? 'all' : 'low')}
          >
            <p className="text-sm text-gray-500">Estoque Baixo</p>
            <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Valor Total</p>
            <p className="text-2xl font-bold text-green-600">
              R$ {products.reduce((sum, p) => sum + (p.price * p.stock), 0).toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="🔍 Buscar por nome ou código..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
            >
              <option value="">Todas categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'name' | 'stock' | 'price')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
            >
              <option value="name">Ordenar: Nome</option>
              <option value="stock">Ordenar: Estoque</option>
              <option value="price">Ordenar: Preço</option>
            </select>
          </div>
        </div>

        {/* Product Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {formData.id ? '✏️ Editar Produto' : '➕ Novo Produto'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Produto *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Banana Prata"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-lg"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código/SKU
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={e => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="Gerado automaticamente"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoria
                    </label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="">Selecione...</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preço de Venda (R$) *
                    </label>
                    <input
                      type="text"
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0,00"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-lg font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preço de Custo (R$)
                    </label>
                    <input
                      type="text"
                      value={formData.cost_price}
                      onChange={e => setFormData({ ...formData, cost_price: e.target.value })}
                      placeholder="0,00"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unidade de Medida *
                    </label>
                    <select
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value as ProductUnit })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900"
                    >
                      <option value="kg">Quilograma (kg)</option>
                      <option value="un">Unidade (un)</option>
                      <option value="g">Grama (g)</option>
                      <option value="l">Litro (l)</option>
                      <option value="ml">Mililitro (ml)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estoque Inicial
                    </label>
                    <input
                      type="text"
                      value={formData.stock}
                      onChange={e => setFormData({ ...formData, stock: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    {saving ? 'Salvando...' : (formData.id ? 'Salvar Alterações' : 'Cadastrar Produto')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Products List */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            {products.length === 0 ? (
              <>
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum produto cadastrado</h3>
                <p className="text-gray-500 mb-6">Comece cadastrando seus produtos para usar o PDV</p>
                <button
                  onClick={() => { setFormData(emptyProduct); setShowForm(true) }}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Cadastrar Primeiro Produto
                </button>
              </>
            ) : (
              <>
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-gray-500">Nenhum produto encontrado com os filtros selecionados</p>
                <button
                  onClick={() => { setSearchQuery(''); setFilterCategory(''); setFilterStock('all') }}
                  className="mt-4 text-green-600 hover:text-green-700"
                >
                  Limpar filtros
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(product => (
              <div 
                key={product.id} 
                className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow ${
                  product.stock === 0 ? 'border-l-4 border-red-500' : 
                  product.stock <= 10 ? 'border-l-4 border-yellow-500' : ''
                }`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">{product.name}</h3>
                      <p className="text-sm text-gray-500">{product.sku}</p>
                    </div>
                    {product.category && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {product.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        R$ {product.price.toFixed(2).replace('.', ',')}
                      </p>
                      <p className="text-sm text-gray-500">por {product.unit}</p>
                    </div>

                    <div className="text-right">
                      {editingStock?.id === product.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editingStock.value}
                            onChange={e => setEditingStock({ ...editingStock, value: e.target.value })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900 text-center"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                handleQuickStockUpdate(product.id, parseFloat(editingStock.value) || 0)
                              } else if (e.key === 'Escape') {
                                setEditingStock(null)
                              }
                            }}
                          />
                          <button
                            onClick={() => handleQuickStockUpdate(product.id, parseFloat(editingStock.value) || 0)}
                            className="text-green-600 hover:text-green-700"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="cursor-pointer"
                          onClick={() => setEditingStock({ id: product.id, value: product.stock.toString() })}
                        >
                          <p className={`text-2xl font-bold ${
                            product.stock === 0 ? 'text-red-600' : 
                            product.stock <= 10 ? 'text-yellow-600' : 'text-gray-900'
                          }`}>
                            {product.stock}
                          </p>
                          <p className="text-sm text-gray-500">em estoque</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product)}
                      className="flex-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
