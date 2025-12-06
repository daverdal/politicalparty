import { useState, useEffect } from 'react'
import api from '../api'

function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await api.getEvents()
        setEvents(data)
      } catch (error) {
        console.error('Failed to load events:', error)
      } finally {
        setLoading(false)
      }
    }
    loadEvents()
  }, [])

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function formatTime(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
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
        <h1 className="page-title">Assembly Events</h1>
        <p className="page-subtitle">{events.length} scheduled events</p>
      </header>

      <div className="cards-grid">
        {events.map(event => (
          <div key={event.id} className="card">
            <div className="card-header">
              <div>
                <span className="event-type">{event.type}</span>
                <h3 className="card-title" style={{ marginTop: '8px' }}>{event.title}</h3>
              </div>
              <div className="badge success">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                {event.participantCount}
              </div>
            </div>
            <div className="event-time">
              📅 {formatDate(event.startTime)} • {formatTime(event.startTime)} - {formatTime(event.endTime)}
            </div>
            <div className="card-body">
              <p>{event.description}</p>
            </div>
            <div className="card-footer">
              <span className="tag">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                {event.region}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Events

