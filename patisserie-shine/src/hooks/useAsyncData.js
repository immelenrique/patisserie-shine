// src/hooks/useAsyncData.js
"use client";

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook pour gérer les appels asynchrones avec état loading/error
 * @param {Function} asyncFn - Fonction asynchrone à exécuter
 * @param {Array} deps - Dépendances (comme useEffect)
 * @returns {Object} { data, loading, error, refetch }
 */
export function useAsyncData(asyncFn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await asyncFn()
      setData(result)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    let ignore = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await asyncFn()
        if (!ignore) {
          setData(result)
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Une erreur est survenue')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      ignore = true
    }
  }, deps)

  return { data, loading, error, refetch: fetchData }
}

export default useAsyncData
