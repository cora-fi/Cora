/**
 * wallet-service.js — abstracción de wallet para Cora.
 *
 * Implementa la misma interfaz para Privy (email/passkey/Google) y Freighter,
 * de modo que el resto del frontend no sabe cuál está activo.
 *
 * Interface pública:
 *   connect(provider, privyUser?)  → Promise<{ address }>
 *   disconnect()
 *   isConnected()                  → boolean
 *   getAddress()                   → string | null
 *   getProvider()                  → 'privy' | 'freighter' | null
 *   signTransaction(xdr)           → Promise<string>
 *   isFreighterAvailable()         → Promise<boolean>
 */

import { Buffer } from 'buffer';
if (typeof window !== 'undefined') window.Buffer = Buffer;

const STORAGE_PREFIX      = 'cora_stellar_kp_';
const TESTNET_PASSPHRASE  = 'Test SDF Network ; September 2015';

let _wallet = null;

function _assertFreighter(result, context) {
  if (result?.error) {
    throw new Error(`Freighter (${context}): ${result.error.message ?? JSON.stringify(result.error)}`);
  }
}

async function _getOrCreateKeypair(userId) {
  const { Keypair } = await import('@stellar/stellar-sdk');
  const key    = STORAGE_PREFIX + userId;
  const stored = localStorage.getItem(key);
  if (stored) return Keypair.fromSecret(stored);
  const kp = Keypair.random();
  localStorage.setItem(key, kp.secret());
  return kp;
}

async function _connectPrivy(privyUser) {
  const kp = await _getOrCreateKeypair(privyUser.id);
  _wallet = {
    provider: 'privy',
    address:  kp.publicKey(),
    signTransaction: async (_xdr) => {
      throw new Error('Firma Soroban con Privy no implementada — usá Freighter para operaciones de escritura.');
    },
  };
  return { address: _wallet.address };
}

async function _connectFreighter() {
  const { isConnected, requestAccess, getNetworkDetails } = await import('@stellar/freighter-api');

  const connResult = await isConnected();
  _assertFreighter(connResult, 'isConnected');
  if (!connResult.isConnected) {
    throw new Error('Freighter no está instalado. Instalalo en https://freighter.app y recargá la página.');
  }

  const netResult = await getNetworkDetails();
  _assertFreighter(netResult, 'getNetworkDetails');
  if (netResult.networkPassphrase !== TESTNET_PASSPHRASE) {
    throw new Error(
      `Freighter está conectado a "${netResult.network}". ` +
      'Cambialo a Testnet en Configuración → Red dentro de la extensión y volvé a intentar.'
    );
  }

  const accessResult = await requestAccess();
  _assertFreighter(accessResult, 'requestAccess');
  if (!accessResult.address) {
    throw new Error('Freighter no devolvió una dirección. ¿Rechazaste el permiso?');
  }

  _wallet = {
    provider: 'freighter',
    address:  accessResult.address,
    signTransaction: async (xdr) => {
      const { signTransaction } = await import('@stellar/freighter-api');
      const result = await signTransaction(xdr, { networkPassphrase: TESTNET_PASSPHRASE });
      _assertFreighter(result, 'signTransaction');
      return result.signedTxXdr;
    },
  };
  return { address: _wallet.address };
}

export async function connect(provider, privyUser = null) {
  if (provider === 'privy') {
    if (!privyUser) throw new Error('Se requiere el objeto user de Privy.');
    return _connectPrivy(privyUser);
  }
  if (provider === 'freighter') return _connectFreighter();
  throw new Error(`Provider desconocido: ${provider}`);
}

export function disconnect()    { _wallet = null; }
export function isConnected()   { return !!_wallet; }
export function getAddress()    { return _wallet?.address ?? null; }
export function getProvider()   { return _wallet?.provider ?? null; }

export async function signTransaction(xdr) {
  if (!_wallet) throw new Error('Wallet no conectada.');
  return _wallet.signTransaction(xdr);
}

/**
 * Detecta si Freighter está instalado sin abrir ningún popup.
 * Reintenta tras 600 ms para dar tiempo a que la extensión se inyecte en el DOM.
 */
export async function isFreighterAvailable() {
  const check = async () => {
    try {
      const { isConnected } = await import('@stellar/freighter-api');
      return (await isConnected())?.isConnected === true;
    } catch { return false; }
  };
  const first = await check();
  if (first) return true;
  return new Promise((resolve) => setTimeout(() => check().then(resolve), 600));
}
