import axios from 'axios'

function resolveApiBaseUrl() {
  const electronApiBase = window.electronShell?.apiBaseUrl
  if (electronApiBase) {
    return electronApiBase
  }

  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:8000'
  }

  return '/'
}

function resolveAssetUrl(path) {
  if (!path) {
    return path
  }

  if (/^(https?:|data:|blob:)/.test(path)) {
    return path
  }

  const baseUrl = resolveApiBaseUrl()
  return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString()
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
})

export function useApi() {
  const uploadDocument = async (file, type) => {
    const formData = new FormData()
    formData.append('file', file)
    const endpoint = type === 'pdf' ? '/api/load-pdf' : '/api/load-image'
    const { data } = await api.post(endpoint, formData)
    return data
  }

  const loadLocalDocument = async (filePath, type) => {
    const { data } = await api.post('/api/load-local-document', { path: filePath, type })
    return data
  }

  const runOcr = async (imagePath) => {
    const { data } = await api.post('/api/ocr', { image_path: imagePath })
    return data
  }

  const runRegionOcr = async (imagePath, region) => {
    const { data } = await api.post('/api/ocr-region', {
      image_path: imagePath,
      region,
    })
    return data
  }

  const segmentText = async (text) => {
    const { data } = await api.post('/api/segment', { text })
    return data
  }

  const lookupWord = async (word, lang) => {
    const { data } = await api.get(`/api/lookup/${encodeURIComponent(word)}`, {
      params: { lang },
    })
    return data
  }

  const fetchVocab = async (search = '') => {
    const { data } = await api.get('/api/vocab', { params: { search } })
    return data
  }

  const saveVocab = async (payload) => {
    const { data } = await api.post('/api/vocab', payload)
    return data
  }

  const deleteVocab = async (id) => {
    await api.delete(`/api/vocab/${id}`)
  }

  const exportVocab = async () => {
    const { data } = await api.get('/api/vocab/export', {
      params: { format: 'anki' },
      responseType: 'blob',
    })
    return data
  }

  return {
    uploadDocument,
    loadLocalDocument,
    runOcr,
    runRegionOcr,
    segmentText,
    lookupWord,
    fetchVocab,
    saveVocab,
    deleteVocab,
    exportVocab,
    resolveAssetUrl,
  }
}
