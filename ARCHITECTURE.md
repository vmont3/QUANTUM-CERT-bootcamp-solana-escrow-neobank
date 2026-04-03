# Documento Técnico de Integração (API/Contract Routes)

## 1. Módulo de Gestão de Ativos (Neobank)

**Instrução:** `init_vault`
- **Trigger UI:** Botão "Connect Wallet" (Verificação automática de conta).
- **Lógica:** Verifica se existe uma PDA para a Pubkey. Se não, inicializa o cofre.

**Instrução:** `deposit`
- **Trigger UI:** Botão "Depositar" no Card de Saldo.
- **Input:** `amount: u64` (Valor convertido de SOL para Lamports).

**Instrução:** `withdraw`
- **Trigger UI:** Botão "Sacar" no Card de Saldo.
- **Requisito Crítico:** Dispara o Overlay Falcon-512 no Frontend antes de enviar.
- **Input:** `amount: u64`, `falcon_auth_proof: String`.

## 2. Módulo de Transações Diretas (P2P & Escrow)

**Instrução:** `transfer_p2p`
- **Trigger UI:** Botão "Transferir" no Bloco P2P.
- **Input:** `receiver_pubkey: Pubkey`, `amount: u64`, `asset_id: String`, `falcon_auth_proof: String`.
- **Resultado:** Movimentação atômica entre PDAs e gravação de Log de Auditoria.

## 3. Módulo de Governança (Multisig - RWA)

**Instrução:** `propose_transaction` (Para ativos como Imóveis/Fundos).
- **Trigger UI:** (Futura aba de Ativos Complexos).
- **Lógica:** Cria uma proposta que aguarda outras assinaturas.

**Instrução:** `approve_transaction`
- **Trigger UI:** Lista de pendências no Dashboard.
- **Requisito:** Verifica se o número de signatários atingiu o limite (M-of-N).

## 4. Módulo de Auditoria (Validador de Ativos - Faceta 4)

**Ação:** `fetch_transaction_logs` (Leitura Direta da Blockchain).
- **Trigger UI:** Botão "Consultar Autenticidade".
- **Input:** `tx_signature: String` (Hash da transação).
- **Processamento Frontend:** Varre os logs em busca de `LOG_QUANTUM_CERT` e exibe o status:
  - **Status: VALIDATED** -> Se o Log e o Hash Falcon coincidirem.
  - **Status: UNSECURED** -> Se a transação existir, mas não tiver assinatura pós-quântica.

// Exemplo de como voce deve entender essa interligação:

```javascript
export const UI_MAPPING = {
  WITHDRAW_BUTTON: {
    instruction: "withdraw",
    pre_condition: "RUN_FALCON_SIMULATION",
    required_inputs: ["amount", "hash_proof"]
  },
  VALIDATOR_INPUT: {
    action: "read_logs",
    filter: "LOG_QUANTUM_CERT"
  }
}
```
