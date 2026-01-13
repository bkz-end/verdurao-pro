'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, ProductUnit } from '@/types'
import Link from 'next/link'

interface NewProduct {
  sku: string
  name: string
  price: string
  cost_price: string
  unit: ProductUnit
  stock: string
  category: string
}

const emptyProduct: NewProduct = {
  sku: '',
  name: '',
  price: '',
  cost_price: '',
  unit: 'kg',
  stock: '',
  category: ''
}

export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newProduct, setNewProduct] = useState<NewProduct>(emptyProduct)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStock, setEditStock] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [tenantId, setTenantId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadTenantAndProducts()
  }, [])

  async function loadTenantAndProducts() {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('Usuário não autenticado')
        return
      }

      // Get tenant_id from store_users
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

      // Load products
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

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return

    try {
      setSaving(true)
      setError(null)

      const price = parseFloat(newProduct.price.replace(',', '.'))
      const costPrice = newProduct.cost_price ? parseFloat(newProduct.cost_price.replace(',', '.')) : null
      const stock = newProduct.stock ? parseFloat(newProduct.stock.replace(',', '.')) : 0

      if (isNaN(price) || price <= 0) {
        setError('Preço inválido')
        return
      }

      // Check if SKU already exists
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('sku', newProduct.sku.trim())
        .single()

      if (existing) {
        setError('SKU já existe')
        return
      }

      const { error: insertError } = await supabase
        .from('products')
        .insert({
          tenant_id: tenantId,
          sku: newProduct.sku.trim(),
          name: newProduct.name.trim(),
          price,
          cost_price: costPrice,
          unit: newProduct.unit,
          stock,
          category: newProduct.category.trim() || null,
          default_quantity: newProduct.unit === 'un' ? 1 : 0.5
        })

      if (insertError) throw insertError

      setSuccess('Produto cadastrado com sucesso!')
      setNewProduct(emptyProduct)
      setShowForm(false)
      await loadTenantAndProducts()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar produto')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateStock(productId: string) {
    if (!tenantId) return

    try {
      const newStock = parseFloat(editStock.replace(',', '.'))
      if (isNaN(newStock) || newStock < 0) {
        setError('Estoque inválido')
        return
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .eq('tenant_id', tenantId)

      if (updateError) throw updateError

      setEditingId(null)
      setEditStock('')
      await loadTenantAndProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar estoque')
    }
  }

  async function handleDeleteProduct(productId: string, productName: string) {
    if (!confirm(`Tem certeza que deseja excluir "${productName}"?`)) return

    try {
      const { error: deleteError } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId)
        .eq('tenant_id', tenantId)

      if (deleteError) throw deleteError

      await loadTenantAndProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir produto')
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              ← Voltar
            </Link>
            <h1 className="text-xl font-bold text-green-600">Estoque</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {showForm ? 'Cancelar' : '+ Novo Produto'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {showForm && (
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Novo Produto</h2>
            <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU/Código *</label>
                <input
                  type="text"
                  value={newProduct.sku}
                  onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda (R$) *</label>
                <input
                  type="text"
                  value={newProduct.price}
                  onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Custo (R$)</label>
                <input
                  type="text"
                  value={newProduct.cost_price}
                  onChange={e => setNewProduct({ ...newProduct, cost_price: e.target.value })}
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
                <select
                  value={newProduct.unit}
                  onChange={e => setNewProduct({ ...newProduct, unit: e.target.value as ProductUnit })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="kg">Quilograma (kg)</option>
                  <option value="un">Unidade (un)</option>
                  <option value="g">Grama (g)</option>
                  <option value="l">Litro (l)</option>
                  <option value="ml">Mililitro (ml)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                <input
                  type="text"
                  value={newProduct.stock}
                  onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <input
                  type="text"
                  value={newProduct.category}
                  onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                  placeholder="Ex: Frutas, Verduras, Legumes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou código..."
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
          />
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">
              {products.length === 0
                ? 'Nenhum produto cadastrado ainda.'
                : 'Nenhum produto encontrado.'}
            </p>
            {products.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Cadastrar Primeiro Produto
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preço</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map(product => (
                  <tr key={product.id} className={product.stock === 0 ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      R$ {product.price.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingId === product.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editStock}
                            onChange={e => setEditStock(e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateStock(product.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditStock('') }}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`cursor-pointer ${product.stock === 0 ? 'text-red-600 font-semibold' : 'text-gray-900'}`}
                          onClick={() => { setEditingId(product.id); setEditStock(product.stock.toString()) }}
                        >
                          {product.stock} {product.unit}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDeleteProduct(product.id, product.name)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          {filteredProducts.length} produto(s) • {filteredProducts.filter(p => p.stock === 0).length} sem estoque
        </div>
      </main>
    </div>
  )
}
