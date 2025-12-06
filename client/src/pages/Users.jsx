import { useState, useEffect } from 'react'
import api from '../api'

function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await api.getUsers()
        setUsers(data)
      } catch (error) {
        console.error('Failed to load users:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUsers()
  }, [])

  function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Members</h1>
        <p className="page-subtitle">{users.length} community members</p>
      </header>

      <div className="cards-grid">
        {users.map(user => (
          <div key={user.id} className="card">
            <div className="user-card">
              <div className="avatar lg">{getInitials(user.name)}</div>
              <div className="user-info">
                <h3 className="card-title">{user.name}</h3>
                <p className="card-subtitle">{user.bio}</p>
                <div className="user-meta">
                  <span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    {user.region}
                  </span>
                </div>
              </div>
            </div>
            {user.skills && user.skills.length > 0 && (
              <div className="skills-list">
                {user.skills.map((skill, i) => (
                  <span key={i} className="tag">{skill}</span>
                ))}
              </div>
            )}
            {user.interests && user.interests.length > 0 && (
              <div className="card-footer">
                {user.interests.map((interest, i) => (
                  <span key={i} className="tag accent">{interest}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Users

