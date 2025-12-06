import { useState, useEffect } from 'react'
import api from '../api'

function Votes() {
  const [votes, setVotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadVotes() {
      try {
        const data = await api.getVotes()
        setVotes(data)
      } catch (error) {
        console.error('Failed to load votes:', error)
      } finally {
        setLoading(false)
      }
    }
    loadVotes()
  }, [])

  function parseResult(resultStr) {
    if (!resultStr) return null
    try {
      return JSON.parse(resultStr)
    } catch {
      return null
    }
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
        <h1 className="page-title">Vote Sessions</h1>
        <p className="page-subtitle">{votes.length} voting sessions</p>
      </header>

      <div className="cards-grid">
        {votes.map(vote => {
          const resultData = vote.result ? parseResult(vote.result.resultData) : null
          
          return (
            <div key={vote.id} className="card">
              <div className="card-header">
                <div>
                  <span className="event-type" style={{ background: 'rgba(0, 212, 170, 0.1)', color: 'var(--accent-primary)' }}>
                    {vote.type}
                  </span>
                  <h3 className="card-title" style={{ marginTop: '8px' }}>{vote.question}</h3>
                </div>
              </div>
              
              {vote.event && (
                <p className="card-subtitle" style={{ marginBottom: '12px' }}>
                  Part of: {vote.event.title}
                </p>
              )}

              {resultData && (
                <div className="card-body">
                  <p style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--text-primary)' }}>Results:</p>
                  {resultData.yes !== undefined ? (
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div className="badge success">✓ Yes: {resultData.yes}</div>
                      <div className="badge" style={{ background: 'rgba(255, 107, 107, 0.15)', color: 'var(--danger)' }}>✗ No: {resultData.no}</div>
                      {resultData.abstain > 0 && (
                        <div className="badge">⊘ Abstain: {resultData.abstain}</div>
                      )}
                    </div>
                  ) : resultData.rankings ? (
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Ranked choice results available
                    </div>
                  ) : (
                    <pre style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {JSON.stringify(resultData, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {!vote.result && (
                <div className="card-body">
                  <div className="badge" style={{ background: 'rgba(255, 179, 71, 0.15)', color: 'var(--warning)' }}>
                    ⏳ Voting in progress
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Votes

