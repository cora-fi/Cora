#![no_std]
//! blend-mock — contrato que imita la interfaz mínima de Blend Protocol.
//!
//! Reemplazá la dirección en init() de PoolContract para apuntar al pool
//! real de Blend en testnet sin modificar la lógica del pool.
//!
//! Interfaz expuesta (idéntica en firma al pool real de Blend):
//!   deposit(from, monto)          — registra un depósito
//!   withdraw(to, monto) → i128    — retira monto + 0.5% de interés simulado
//!   get_balance(address) → i128   — saldo actual depositado
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
enum BlendKey {
    Balance(Address),
}

#[contract]
pub struct BlendMock;

#[contractimpl]
impl BlendMock {
    /// Registra un depósito de `monto` para `from`.
    /// En producción: el pool transfiere USDC al contrato de Blend antes de esta llamada.
    pub fn deposit(env: Env, from: Address, monto: i128) {
        let key = BlendKey::Balance(from);
        let bal: i128 = env.storage().instance().get(&key).unwrap_or(0);
        env.storage().instance().set(&key, &(bal + monto));
    }

    /// Retira `monto` para `to` y aplica 0.5 % de interés simulado.
    /// Devuelve monto + interés (el pool acredita la diferencia como yield).
    pub fn withdraw(env: Env, to: Address, monto: i128) -> i128 {
        let key = BlendKey::Balance(to);
        let bal: i128 = env.storage().instance().get(&key).unwrap_or(0);
        env.storage().instance().set(&key, &bal.saturating_sub(monto));
        let interest = monto / 200; // 0.5 %
        monto + interest
    }

    /// Saldo depositado por `address`.
    pub fn get_balance(env: Env, address: Address) -> i128 {
        env.storage()
            .instance()
            .get(&BlendKey::Balance(address))
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_deposit_y_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let id     = env.register(BlendMock, ());
        let client = BlendMockClient::new(&env, &id);
        let user   = Address::generate(&env);

        client.deposit(&user, &1_000_0000000i128);
        assert_eq!(client.get_balance(&user), 1_000_0000000i128);
    }

    #[test]
    fn test_withdraw_agrega_interes() {
        let env = Env::default();
        env.mock_all_auths();
        let id     = env.register(BlendMock, ());
        let client = BlendMockClient::new(&env, &id);
        let user   = Address::generate(&env);

        client.deposit(&user, &200_0000000i128);
        let received = client.withdraw(&user, &200_0000000i128);
        // 0.5 % de 200_0000000 = 1_000_000
        assert_eq!(received, 201_0000000i128);
    }
}
