/* ============================================================
   Cora — configuración de red y direcciones
   Único punto donde vive la config de backend. Las pantallas
   nunca leen esto directo: pasan siempre por coraService.
   ============================================================ */
window.CoraConfig = {
  // Alterná esto para enchufar el backend real más adelante.
  USE_MOCKS: true,

  // Red Stellar / Soroban
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',

  // TODO: conectar a Soroban — reemplazar por direcciones reales
  contracts: {
    pool: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // contrato del fondo
    claims: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // contrato de solicitudes
  },
  tokens: {
    usdc: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // token USDC
  },

  // Parámetros del producto (mock; el backend será la fuente de verdad)
  product: {
    primaMensual: 18,        // $/mes
    techoCobertura: 4000,    // $/evento
    mesesCarencia: 6,        // meses de espera antes de ser elegible
    aprobacionesNecesarias: 2,
  },
};
