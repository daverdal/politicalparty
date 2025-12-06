import { useState, useEffect } from 'react'
import api from '../api'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const [users, ideas, events, votes] = await Promise.all([
          api.getUsers(),
          api.getIdeas(),
          api.getEvents(),
          api.getVotes()
        ])
        setStats({
          users: users.length,
          ideas: ideas.length,
          events: events.length,
          votes: votes.length
        })
      } catch (error) {
        console.error('Failed to load stats:', error)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

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
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your community platform</p>
      </header>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Members</div>
          <div className="stat-value">{stats?.users || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ideas</div>
          <div className="stat-value">{stats?.ideas || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Events</div>
          <div className="stat-value">{stats?.events || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Votes</div>
          <div className="stat-value">{stats?.votes || 0}</div>
        </div>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Welcome to Speakeasy</h3>
              <p className="card-subtitle">Community engagement platform</p>
            </div>
          </div>
          <div className="card-body">
            <p>This platform enables democratic participation through:</p>
            <ul style={{ marginTop: '12px', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
              <li>Member nominations and endorsements</li>
              <li>Idea submissions and community support</li>
              <li>Assembly events and participation</li>
              <li>Transparent voting sessions</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Quick Actions</h3>
              <p className="card-subtitle">Get started</p>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <a href="/users" className="btn btn-secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
              Browse Members
            </a>
            <a href="/ideas" className="btn btn-secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
              Explore Ideas
            </a>
            <a href="/events" className="btn btn-primary" style={{ textDecoration: 'none', justifyContent: 'center' }}>
              View Upcoming Events
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

