import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)
    try {
      const data = await api.post('/login', { email, password })
      if (data?.token) {
        localStorage.setItem('token', data.token)
        if (data?.tenant?.slug) localStorage.setItem('tenantSlug', data.tenant.slug)
        navigate('/dashboard')
      } else {
        setErrorMessage('Invalid server response')
      }
    } catch (error) {
      const message = error?.data?.error || error?.message || 'Login failed'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="centered">
      <div className="panel">
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0, marginBottom: 8 }}>Sign in</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
          {errorMessage && <div style={{ color: '#f87171' }}>{errorMessage}</div>}
        </form>
      </div>
    </div>
  )
}


