// Fake login: kaun sa user select hai, wo yaad rakhta hai
export function getUserId() {
  return localStorage.getItem("userId") || "";
}
export function setUserId(id) {
  localStorage.setItem("userId", id);
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