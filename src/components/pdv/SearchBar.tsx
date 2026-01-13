'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * SearchBar - Mobile-first search input with auto-focus
 * Requirements: 4.1, 12.6
 * 
 * Features:
 * - Auto-focus on mount for quick product search
 * - Always visible on main screen
 * - Real-time search as user types
 * - Clear button for quick reset
 */
export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch?: (query: string) => void
  placeholder?: string
  autoFocus?: boolean
  debounceMs?: number
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Buscar produto...',
  autoFocus = true,
  debounceMs = 300
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = useState(value)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounced search callback
  const debouncedSearch = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      onSearch?.(query)
    }, debounceMs)
  }, [onSearch, debounceMs])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    onChange(newValue)
    debouncedSearch(newValue)
  }

  const handleClear = () => {
    setLocalValue('')
    onChange('')
    onSearch?.('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear()
    }
  }

  return (
    <div className="relative w-full">
      {/* Search Icon */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Input Field - 56px height for WCAG AAA touch target */}
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-14 pl-12 pr-12 text-lg bg-white border-2 border-gray-200 rounded-xl
                   focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:outline-none
                   transition-all duration-200 placeholder:text-gray-400"
        aria-label="Buscar produto"
      />

      {/* Clear Button */}
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full
                     hover:bg-gray-100 active:bg-gray-200 transition-colors"
          aria-label="Limpar busca"
        >
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
