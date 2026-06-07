// src/config.ts

// Si quieres, luego podrás sobreescribir con .env (VITE_API_BASE_URL)
const DEFAULT_API_BASE_URL = `http://${window.location.hostname}:3000`;

export const API_BASE_URL = DEFAULT_API_BASE_URL;
