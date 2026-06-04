import { useState } from 'react';
import { Icon, Button, Field, inputStyle } from '../components';
import { CoraMark } from '../shell';
import { login } from '../services/mock-service';

export default function Onboarding({ onLogin }) {
  const [step, setStep]     = useState('bienvenida');
  const [mode, setMode]     = useState('email');
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');

  const doLogin = async () => {
    setErr('');
    if (mode === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErr('Escribí un correo válido.'); return;
    }
    setLoading(true);
    try {
      const member = await login();
      onLogin(member);
    } catch {
      setErr('No pudimos ingresar. Probá de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid' }}>
      <div className="cora-onb-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', minHeight: '100vh' }}>
        {/* panel editorial */}
        <div style={{ padding: 'clamp(28px, 5vw, 72px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          borderRight: '1px solid var(--hairline)', position: 'relative' }}>
          <div className="rise" style={{ animationDelay: '.02s' }}><CoraMark size={28} /></div>

          <div style={{ maxWidth: 520 }}>
            <div className="eyebrow rise" style={{ animationDelay: '.06s', marginBottom: 22 }}>Fondo mutual de salud</div>
            <h1 className="rise" style={{ animationDelay: '.1s', fontSize: 'clamp(34px, 4.4vw, 56px)', lineHeight: 1.1 }}>
              Cuando la salud no<br />puede esperar,{' '}
              <span style={{ color: 'var(--forest)' }}>la<br />resolvemos entre todos.</span>
            </h1>
            <p className="rise" style={{ animationDelay: '.16s', marginTop: 32, fontSize: 17.5, color: 'var(--ink-2)', maxWidth: 440, lineHeight: 1.6 }}>
              Aportás una cuota mensual a un fondo común. Cuando llevás demasiado tiempo en lista de espera,
              Cora co-paga tu atención en un hospital privado.
            </p>
          </div>

          <div className="rise" style={{ animationDelay: '.22s', display: 'flex', gap: 28, flexWrap: 'wrap', color: 'var(--ink-2)', fontSize: 13.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="users-three" size={18} color="var(--forest)" /> 154 personas</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="heartbeat" size={18} color="var(--clay)" /> 7 atenciones co-pagadas</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="lock-simple" size={18} color="var(--forest)" /> Fondo transparente</span>
          </div>
        </div>

        {/* panel de ingreso */}
        <div style={{ display: 'grid', placeItems: 'center', padding: 'clamp(28px, 5vw, 56px)' }}>
          <div className="rise" style={{ animationDelay: '.12s', width: '100%', maxWidth: 380 }}>
            {step === 'bienvenida' ? (
              <div>
                <h2 style={{ fontSize: 30 }}>Bienvenida a Cora</h2>
                <p style={{ color: 'var(--ink-2)', margin: '12px 0 28px', lineHeight: 1.55 }}>
                  Tu cuenta, tus aportes y tu cobertura, en un solo lugar. Sin letra chica.
                </p>
                <Button full size="lg" iconRight="arrow-right" onClick={() => setStep('login')}>Quiero unirme</Button>
                <button onClick={() => setStep('login')} style={{ marginTop: 16, width: '100%', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: 14.5 }}>
                  Ya tengo cuenta · <span style={{ color: 'var(--forest)', fontWeight: 600 }}>Ingresar</span>
                </button>
              </div>
            ) : (
              <div>
                <h2 style={{ fontSize: 28 }}>Ingresá a tu cuenta</h2>
                <p style={{ color: 'var(--ink-2)', margin: '10px 0 24px', fontSize: 14.5 }}>
                  Sin contraseñas que recordar. Te enviamos un acceso a tu correo.
                </p>

                <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--canvas)', border: '1px solid var(--hairline)',
                  borderRadius: 'var(--r)', marginBottom: 18 }}>
                  {[['email','Correo','envelope-simple'],['passkey','Llave de acceso','fingerprint']].map(([id,lbl,ic]) => (
                    <button key={id} onClick={() => { setMode(id); setErr(''); }} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 8px',
                      border: 'none', cursor: 'pointer', borderRadius: 'var(--r-sm)', fontFamily: 'var(--sans)',
                      fontSize: 13.5, fontWeight: 600, background: mode === id ? 'var(--surface)' : 'transparent',
                      color: mode === id ? 'var(--ink)' : 'var(--ink-2)', boxShadow: mode === id ? 'var(--shadow-sm)' : 'none' }}>
                      <Icon name={ic} size={16} /> {lbl}
                    </button>
                  ))}
                </div>

                {mode === 'email' ? (
                  <Field label="Tu correo" error={err}>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="vos@correo.com" style={inputStyle(!!err)}
                      onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
                  </Field>
                ) : (
                  <div style={{ textAlign: 'center', padding: '14px 0' }}>
                    <Icon name="fingerprint" size={40} color="var(--forest)" />
                    <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: '12px 0 0' }}>
                      Usá la huella o el rostro de tu dispositivo.
                    </p>
                    {err && <p style={{ color: 'var(--error)', fontSize: 13, marginTop: 8 }}>{err}</p>}
                  </div>
                )}

                <div style={{ marginTop: 20 }}>
                  <Button full size="lg" loading={loading} onClick={doLogin}
                    icon={mode === 'passkey' ? 'fingerprint' : undefined}>
                    {loading ? 'Ingresando…' : mode === 'passkey' ? 'Usar llave de acceso' : 'Continuar'}
                  </Button>
                </div>

                <p style={{ marginTop: 18, fontSize: 12, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.5 }}>
                  Al continuar aceptás los términos del fondo. Tus aportes quedan a tu nombre.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
