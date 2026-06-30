import { useEffect, useState } from "react";

const KEY = "sopra_pm_actor_id";

export function getActorId() {
  return localStorage.getItem(KEY) || "";
}

export function setActorId(id) {
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("actor-changed"));
}

export function useActorId() {
  const [id, setId] = useState(getActorId());
  useEffect(() => {
    const handler = () => setId(getActorId());
    window.addEventListener("actor-changed", handler);
    return () => window.removeEventListener("actor-changed", handler);
  }, []);
  return id;
}
