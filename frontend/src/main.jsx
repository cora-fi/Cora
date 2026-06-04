import { Buffer } from 'buffer';
if (typeof window !== 'undefined') window.Buffer = Buffer;

import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './app';
import '../app/tokens.css';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;

const privyConfig = {
  loginMethods: ['email', 'sms', 'google', 'passkey'],
  appearance: {
    theme: 'light',
    accentColor: '#1E4A3C',
    logo: '',
  },
  embeddedWallets: {
    createOnLogin: 'off',
  },
};

const root = createRoot(document.getElementById('root'));

if (privyAppId) {
  root.render(
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      <App />
    </PrivyProvider>
  );
} else {
  root.render(<App />);
}
