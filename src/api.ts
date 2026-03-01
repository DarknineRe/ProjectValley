// src/api.ts
// Helper for constructing API URLs. In development we usually proxy
// requests to the local backend, so the default base string is empty.
// When deploying the frontend to a separate host, set the environment
// variable `VITE_API_BASE` to the full backend origin (e.g.
// "https://farmvalley.onrender.com").

// Allow either VITE_API_URL or legacy VITE_API_BASE for the backend origin
export const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '';
