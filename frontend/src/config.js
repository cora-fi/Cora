export const CoraConfig = {
  network:           'testnet',
  horizonUrl:        'https://horizon-testnet.stellar.org',
  sorobanRpcUrl:     import.meta.env.VITE_STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  contracts: {
    pool:  import.meta.env.VITE_POOL_CONTRACT_ADDRESS  ?? 'CCNJFLHICHXBCRYFKXDWCYLOLSWB66JHUYD53ZIUZCPJYW3NN23KQDUO',
    blend: import.meta.env.VITE_BLEND_MOCK_ADDRESS     ?? 'CBAMMQTGJDACUIPZN442RRRB5SUN2LZIFX72XDHHWCGQK3JOFBRLHVPW',
    token: import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS ?? 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  },
  product: {
    primaMensual:           18,
    techoCobertura:         4000,
    mesesCarencia:          6,
    aprobacionesNecesarias: 2,
  },
};
