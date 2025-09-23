import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/api'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)
    try {
      await api.post('/signup', { name, email, password })
      navigate('/login')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px', maxWidth: 360, margin: '0 auto' }}>
      <h2>Create account</h2>
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
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
        minLength={6}
      />
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Sign up'}</button>
      {errorMessage && <div style={{ color: '#ff6b6b' }}>{errorMessage}</div>}
    </form>
  )
}


