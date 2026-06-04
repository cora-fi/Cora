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
 */

import { Buffer } from 'buffer';
if (typeof window !== 'undefined') window.Buffer = Buffer;

const STORAGE_PREFIX = 'cora_stellar_kp_';

let _wallet = null; // { provider, address, signTransaction }

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
// Freighter — usa la extensión del navegador
// ---------------------------------------------------------------------------
async function _connectFreighter() {
  const { isConnected, getPublicKey } = await import('@stellar/freighter-api');
  const connected = await isConnected();
  if (!connected) throw new Error('Freighter no está instalado o no está habilitado.');
  const address = await getPublicKey();
  _wallet = {
    provider: 'freighter',
    address,
    signTransaction: async (xdr) => {
      const { signTransaction } = await import('@stellar/freighter-api');
      return signTransaction(xdr, { network: 'TESTNET' });
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

// Comprueba si Freighter está instalado (sin conectar)
export async function isFreighterAvailable() {
  try {
    const { isConnected } = await import('@stellar/freighter-api');
    return isConnected();
  } catch {
    return false;
  }
}
