import { useState, useEffect } from 'react'
import api from '../api'

function Ideas() {
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadIdeas() {
      try {
        const data = await api.getIdeas()
        setIdeas(data)
      } catch (error) {
        console.error('Failed to load ideas:', error)
      } finally {
        setLoading(false)
      }
    }
    loadIdeas()
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
        <h1 className="page-title">Ideas</h1>
        <p className="page-subtitle">{ideas.length} community proposals</p>
      </header>

      <div className="cards-grid">
        {ideas.map(idea => (
          <div key={idea.id} className="card idea-card">
            <div className="card-header">
              <div>
                <h3 className="card-title">{idea.title}</h3>
                <p className="card-subtitle">
                  {idea.author ? `by ${idea.author.name}` : 'Anonymous'} • {idea.region}
                </p>
              </div>
              <div className="support-count">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                </svg>
                {idea.supportCount}
              </div>
            </div>
            <div className="card-body">
              <p>{idea.description}</p>
            </div>
            {idea.tags && idea.tags.length > 0 && (
              <div className="card-footer">
                {idea.tags.map((tag, i) => (
                  <span key={i} className="tag accent">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Ideas

