import axios from "axios";
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth is cookie-only (httpOnly, set by the server). We deliberately do
// NOT also keep a copy of the token in localStorage/sessionStorage — that
// would be readable by any JS running on the page (e.g. via an XSS bug),
// which defeats the purpose of using an httpOnly cookie in the first
// place. withCredentials: true is what makes the browser send the cookie
// automatically with every request.
const api = axios.create({ baseURL: API, withCredentials: true });

export default api;

export function formatApiError(detail, fallback = "Something went wrong") {
  if (detail == null) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
