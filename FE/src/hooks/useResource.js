import { useEffect, useState } from "react";
import { errorMessage } from "../services/api";
export function useResource(loader, dependencies = []) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    Promise.resolve()
      .then(loader)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (active)
          setState({ data: null, loading: false, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
    // Callers provide every value captured by loader as a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, version]);
  return { ...state, reload: () => setVersion((x) => x + 1) };
}
export function useDebounced(value, delay = 300) {
  const [result, setResult] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setResult(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return result;
}
