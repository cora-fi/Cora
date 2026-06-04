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
 *   signTransaction(xdr)           → Promise<string>  (XDR firmado)
 *   isFreighterAvailable()         → Promise<boolean>
 */

import { Buffer } from 'buffer';
if (typeof window !== 'undefined') window.Buffer = Buffer;

const STORAGE_PREFIX = 'cora_stellar_kp_';
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

let _wallet = null; // { provider, address, signTransaction }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lanza si la respuesta de freighter-api v6 trae error. */
function _assertFreighter(result, context) {
  if (result?.error) {
    throw new Error(`Freighter (${context}): ${result.error.message ?? JSON.stringify(result.error)}`);
  }
}

// ---------------------------------------------------------------------------
// Privy — genera (o recupera) un Keypair ED25519 por userId
// ---------------------------------------------------------------------------
async function _getOrCreateKeypair(userId) {
  const { Keypair } = await import('@stellar/stellar-sdk');
  const key = STORAGE_PREFIX + userId;
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
    address: kp.publicKey(),
    signTransaction: async (_xdr) => {
      // Fase 6: firmar transacción Soroban con kp.secret()
      throw new Error('Firma Soroban no disponible en Fase 5');
    },
  };
  return { address: _wallet.address };
}

// ---------------------------------------------------------------------------
// Freighter v6 — usa la extensión del navegador
//
// API v6 (breaking changes respecto a v4/v5):
//   isConnected()      → { isConnected: boolean, error? }
//   requestAccess()    → { address: string, error? }       ← abre popup permiso
//   getAddress()       → { address: string, error? }       ← si ya tiene permiso
//   getNetworkDetails()→ { network, networkPassphrase, ... , error? }
//   signTransaction()  → { signedTxXdr, signerAddress, error? }
//                         opts: { networkPassphrase?, address? }   ← YA NO acepta { network }
// ---------------------------------------------------------------------------
async function _connectFreighter() {
  const {
    isConnected,
    requestAccess,
    getNetworkDetails,
  } = await import('@stellar/freighter-api');

  // 1. Verificar que la extensión está instalada
  const connResult = await isConnected();
  _assertFreighter(connResult, 'isConnected');
  if (!connResult.isConnected) {
    throw new Error('Freighter no está instalado. Instalalo en https://freighter.app y recargá la página.');
  }

  // 2. Verificar que está en Testnet antes de pedir acceso
  const netResult = await getNetworkDetails();
  _assertFreighter(netResult, 'getNetworkDetails');
  if (netResult.networkPassphrase !== TESTNET_PASSPHRASE) {
    throw new Error(
      `Freighter está conectado a "${netResult.network}". ` +
      'Cambialo a Testnet en Configuración → Red dentro de la extensión y volvé a intentar.'
    );
  }

  // 3. Pedir acceso (abre el popup de Freighter)
  const accessResult = await requestAccess();
  _assertFreighter(accessResult, 'requestAccess');
  const address = accessResult.address;
  if (!address) {
    throw new Error('Freighter no devolvió una dirección. ¿Rechazaste el permiso?');
  }

  _wallet = {
    provider: 'freighter',
    address,
    signTransaction: async (xdr) => {
      const { signTransaction } = await import('@stellar/freighter-api');
      const result = await signTransaction(xdr, { networkPassphrase: TESTNET_PASSPHRASE });
      _assertFreighter(result, 'signTransaction');
      return result.signedTxXdr;
    },
  };
  return { address };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------
export async function connect(provider, privyUser = null) {
  if (provider === 'privy') {
    if (!privyUser) throw new Error('Se requiere el objeto user de Privy.');
    return _connectPrivy(privyUser);
  }
  if (provider === 'freighter') {
    return _connectFreighter();
  }
  throw new Error(`Provider desconocido: ${provider}`);
}

export function disconnect() {
  _wallet = null;
}

export function isConnected() {
  return !!_wallet;
}

export function getAddress() {
  return _wallet?.address ?? null;
}

export function getProvider() {
  return _wallet?.provider ?? null;
}

export async function signTransaction(xdr) {
  if (!_wallet) throw new Error('Wallet no conectada.');
  return _wallet.signTransaction(xdr);
}

/**
 * Comprueba si Freighter está instalado (sin pedir acceso ni abrir popup).
 * Incluye un retry con delay porque la extensión puede no estar inyectada
 * todavía si se llama muy temprano en el ciclo de vida de la página.
 */
export async function isFreighterAvailable() {
  const check = async () => {
    try {
      const { isConnected } = await import('@stellar/freighter-api');
      const result = await isConnected();
      return result?.isConnected === true;
    } catch {
      return false;
    }
  };

  const first = await check();
  if (first) return true;

  // Retry tras 600 ms — da tiempo a que la extensión se inyecte en el DOM
  return new Promise((resolve) => {
    setTimeout(() => check().then(resolve), 600);
  });
}
