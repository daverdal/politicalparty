const API_BASE = '/api';

async function fetchApi(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Users
  getUsers: () => fetchApi('/users'),
  getUser: (id) => fetchApi(`/users/${id}`),
  getUserNominations: (id) => fetchApi(`/users/${id}/nominations`),
  getUserEndorsements: (id) => fetchApi(`/users/${id}/endorsements`),

  // Ideas
  getIdeas: () => fetchApi('/ideas'),
  getIdea: (id) => fetchApi(`/ideas/${id}`),

  // Events
  getEvents: () => fetchApi('/events'),
  getEvent: (id) => fetchApi(`/events/${id}`),

  // Votes
  getVotes: () => fetchApi('/votes'),
  getVote: (id) => fetchApi(`/votes/${id}`),

  // Priorities
  getPriorities: () => fetchApi('/priorities'),

  // Health
  getHealth: () => fetchApi('/health'),
};

export default api;

