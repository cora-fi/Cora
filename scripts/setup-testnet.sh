#!/usr/bin/env bash
# setup-testnet.sh — genera cuentas y emite USDC de prueba en Stellar Testnet.
# Requiere: stellar CLI instalado (https://developers.stellar.org/docs/tools/stellar-cli)
# Uso: bash scripts/setup-testnet.sh
set -euo pipefail

ENV_FILE=".env.example"

echo "=== Cora — Setup Testnet ==="

# ---------------------------------------------------------------------------
# 1. Generar cuenta admin
# ---------------------------------------------------------------------------
echo "[1/4] Generando cuenta admin..."
ADMIN_SECRET=$(stellar keys generate --no-fund cora-admin 2>/dev/null || stellar keys show cora-admin --secret)
ADMIN_PUBLIC=$(stellar keys show cora-admin)
stellar friendbot fund --network testnet "$ADMIN_PUBLIC"
echo "Admin: $ADMIN_PUBLIC"

# ---------------------------------------------------------------------------
# 2. Generar 3 cuentas validadoras
# ---------------------------------------------------------------------------
echo "[2/4] Generando validadores..."
VALIDATORS=()
for i in 1 2 3; do
  NAME="cora-validator-$i"
  stellar keys generate --no-fund "$NAME" 2>/dev/null || true
  PUB=$(stellar keys show "$NAME")
  stellar friendbot fund --network testnet "$PUB"
  VALIDATORS+=("$PUB")
  echo "Validator $i: $PUB"
done

# ---------------------------------------------------------------------------
# 3. Emitir token USDC de prueba via Stellar Asset Contract (SAC)
# ---------------------------------------------------------------------------
echo "[3/4] Desplegando USDC de prueba..."
USDC_ADDRESS=$(stellar contract asset deploy \
  --network testnet \
  --source cora-admin \
  --asset "USDC:$ADMIN_PUBLIC" \
  2>/dev/null || echo "CXXXXX_ALREADY_DEPLOYED")
echo "USDC SAC: $USDC_ADDRESS"

# ---------------------------------------------------------------------------
# 4. Guardar en .env.example (nunca el .env real)
# ---------------------------------------------------------------------------
echo "[4/4] Guardando en $ENV_FILE..."
cat > "$ENV_FILE" <<EOF
# Stellar Testnet — generado por setup-testnet.sh
# Copia este archivo como .env y completa los valores reales.

STELLAR_NETWORK=testnet
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

ADMIN_PUBLIC=$ADMIN_PUBLIC
# ADMIN_SECRET= (no guardar aquí — usa stellar keys show cora-admin)

VALIDATOR_1=${VALIDATORS[0]:-GVALIDATOR1}
VALIDATOR_2=${VALIDATORS[1]:-GVALIDATOR2}
VALIDATOR_3=${VALIDATORS[2]:-GVALIDATOR3}

USDC_CONTRACT=$USDC_ADDRESS
POOL_CONTRACT=CXXXXX_DEPLOY_PENDING
CLAIMS_CONTRACT=CXXXXX_DEPLOY_PENDING
EOF

echo ""
echo "=== Listo ==="
echo "Archivo generado: $ENV_FILE"
echo "Para ver claves secretas: stellar keys show <nombre> --secret"
