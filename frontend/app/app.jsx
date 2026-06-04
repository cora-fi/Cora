/* ============================================================
   Cora — App raíz: gate de login + router + layout responsivo
   ============================================================ */
function App() {
  const [member, setMember] = useState(null);
  const [route, setRoute] = useState('dashboard');
  const [validador, setValidador] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);

  useEffect(() => {
    const on = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  // restaurar sesión / ruta de la sesión anterior
  useEffect(() => {
    const saved = sessionStorage.getItem('cora_route');
    if (saved) setRoute(saved);
  }, []);
  const go = (r) => { setRoute(r); sessionStorage.setItem('cora_route', r); window.scrollTo({ top: 0 }); };

  const onLogin = (m) => { setMember(m); go('dashboard'); };
  const onLogout = () => { setMember(null); setRoute('dashboard'); sessionStorage.removeItem('cora_route'); };

  if (!member) return <Onboarding onLogin={onLogin} />;

  const screen = (() => {
    const common = { member, go };
    switch (route) {
      case 'dashboard':   return <Dashboard {...common} />;
      case 'aportar':     return <Aportar member={member} onMemberChange={setMember} />;
      case 'cobertura':   return <Cobertura {...common} />;
      case 'solicitar':   return <Solicitar {...common} />;
      case 'solicitudes': return <Solicitudes {...common} />;
      case 'fondo':       return <Fondo />;
      case 'validador':   return validador ? <Validador /> : <Dashboard {...common} />;
      default:            return <Dashboard {...common} />;
    }
  })();

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', paddingBottom: 78 }}>
        <MobileHeader member={member} onLogout={onLogout} />
        <main key={route} style={{ padding: '22px 18px 28px' }}>{screen}</main>
        <BottomBar route={route} go={go} validador={validador} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar route={route} go={go} member={member} validador={validador}
        setValidador={setValidador} onLogout={onLogout} />
      <main key={route} style={{ flex: 1, minWidth: 0, padding: 'clamp(28px, 4vw, 52px)' }}>{screen}</main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
