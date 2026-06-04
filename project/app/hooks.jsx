/* ============================================================
   Cora — hooks de datos (envuelven coraService)
   ============================================================ */
function useAsync(fn, deps = []) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    fnRef.current()
      .then((data) => { if (alive) setState({ status: 'ok', data, error: null }); })
      .catch((e) => { if (alive) setState({ status: 'error', data: null, error: e.message || 'Error' }); });
    return () => { alive = false; };
  }, deps); // eslint-disable-line
  useEffect(() => run(), [run]);
  return { ...state, reload: run, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

Object.assign(window, { useAsync });
