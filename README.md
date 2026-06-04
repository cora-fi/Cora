# Cora

Fondo mutual de salud sobre Stellar (Soroban). Los miembros aportan una prima mensual en USDC a una bolsa común; el capital ocioso genera rendimiento en Blend. Cuando un miembro cumple condiciones de cobertura (carencia mínima + tiempo en lista de espera pública), el contrato libera fondos directamente al hospital verificado — nunca a la billetera del usuario. MVP sobre testnet.

## Estructura

```
/frontend      diseño y lógica de UI (React, design system)
/contracts     contratos Soroban en Rust
/scripts       herramientas de testnet y seed
```

## Correr el frontend

```bash
cd frontend
npm install
npm run dev
```

La UI consume `frontend/src/services/mock-service.js` por defecto. Las funciones tienen la misma firma que los contratos reales — cuando los contratos estén desplegados solo hay que swapear la implementación.

## Setup de testnet

Requiere [stellar CLI](https://developers.stellar.org/docs/tools/stellar-cli).

```bash
bash scripts/setup-testnet.sh
```

El script genera cuenta admin, 3 validadores, emite USDC de prueba via SAC y guarda las direcciones en `.env.example`. Copia ese archivo como `.env` y agrega las direcciones de los contratos cuando los despliegues.

## Interfaz del contrato

| Función | Descripción |
|---|---|
| `init(admin, token_usdc, techo, carencia, validadores)` | Inicializa el fondo |
| `join(miembro)` | Registra un nuevo miembro |
| `contribute(miembro, monto)` | Aporta prima mensual en USDC |
| `get_member(miembro)` | Estado del miembro |
| `get_pool_status()` | Reservas y rendimiento del fondo |
| `submit_claim(miembro, ref, fecha, hospital, monto)` | Envía solicitud de cobertura |
| `attest_claim(validador, claim_id, aprobar)` | Firma validación multisig |
| `execute_claim(claim_id)` | Libera fondos al hospital si hay quórum |
| `deposit_to_yield / withdraw_from_yield` | Gestión del yield en Blend |
