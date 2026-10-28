import { useEffect, useRef } from "react";
import { getSocket } from "../services/socket";

// Refreshes a screen when the server reports a change to data it shows ("data:changed").
// resources: the BE names this screen depends on, e.g. ["contracts"] or ["invoices", "payments"].
// Bursts of changes (bulk actions) are merged into one refresh.
export function useLiveRefresh(resources, refresh, delay = 400) {
  const latest = useRef(refresh);
  const key = resources.join(",");

  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const wanted = new Set(key.split(","));
    const socket = getSocket();
    let timer = null;
    const onChange = (event) => {
      if (!event?.resources?.some((r) => wanted.has(r))) return;
      clearTimeout(timer);
      timer = setTimeout(() => latest.current?.(), delay);
    };
    socket.on("data:changed", onChange);
    return () => {
      clearTimeout(timer);
      socket.off("data:changed", onChange);
    };
  }, [key, delay]);
}
