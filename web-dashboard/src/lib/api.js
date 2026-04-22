import axios from 'axios'

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL
const fallbackApiBaseUrl =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? '/api'
    : 'https://workpulse-hr.onrender.com/api'

const api = axios.create({
  baseURL: configuredApiBaseUrl || fallbackApiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/#/login'
    }
    return Promise.reject(error)
  }
)

export default api
