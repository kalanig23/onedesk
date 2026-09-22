const KEY = "onedesk-user";

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function getUserId() {
  const user = getUser();
  if (user?.id) return String(user.id);
  return localStorage.getItem("userId") || "";
}

export function setUser(user) {
  localStorage.setItem(KEY, JSON.stringify(user));
  localStorage.setItem("userId", String(user.id));
}

export function clearUser() {
  localStorage.removeItem(KEY);
  localStorage.removeItem("userId");
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const userId = getUserId();
  if (userId) headers["x-user-id"] = userId;

  let res;
  try {
    res = await fetch("/api" + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is it running?");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.message || "Something went wrong. Please try again.");
  }
  return data;
}
