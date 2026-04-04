import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { QuantumCertVault } from "../target/types/quantum_cert_vault";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("quantum_cert_vault_escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.QuantumCertVault as Program<QuantumCertVault>;
  
  const providerWallet = provider.wallet.publicKey;
  const owner = Keypair.generate(); // Novo owner aleatório para isolamento total
  const receiver = Keypair.generate();
  const oracle = Keypair.fromSeed(new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]));

  // PDAs baseados no novo owner
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_master"), owner.publicKey.toBuffer()],
    program.programId
  );

  const [receiverVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_master"), receiver.publicKey.toBuffer()],
    program.programId
  );

  const [escrowPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_master"), owner.publicKey.toBuffer(), receiver.publicKey.toBuffer()],
    program.programId
  );

  console.log("MASTER TEST: Vault PDA:", vaultPDA.toBase58());
  console.log("MASTER TEST: Escrow PDA:", escrowPDA.toBase58());

  before(async () => {
    // Financiar o RANDOM OWNER, RECEIVER e ORACLE a partir da carteira CLI
    const transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: providerWallet,
        toPubkey: owner.publicKey,
        lamports: 2.1 * LAMPORTS_PER_SOL,
      }),
      anchor.web3.SystemProgram.transfer({
        fromPubkey: providerWallet,
        toPubkey: receiver.publicKey,
        lamports: 0.1 * LAMPORTS_PER_SOL,
      }),
      anchor.web3.SystemProgram.transfer({
        fromPubkey: providerWallet,
        toPubkey: oracle.publicKey,
        lamports: 0.1 * LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(transaction);
  });

  it("Habilita o Neobank Vault V2 com Multi-Sig", async () => {
    await program.methods
      .initVault(oracle.publicKey)
      .accounts({
        vault: vaultPDA,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([owner])
      .rpc();

    const vaultAcc = await program.account.vaultAccount.fetch(vaultPDA);
    expect(vaultAcc.quantumAuthority.toString()).to.equal(oracle.publicKey.toString());
  });

  it("Realiza Depósito no Cofre V2", async () => {
    const amount = new anchor.BN(2 * LAMPORTS_PER_SOL);
    await program.methods
      .deposit(amount)
      .accounts({
        vault: vaultPDA,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([owner])
      .rpc();

    const vaultAcc = await program.account.vaultAccount.fetch(vaultPDA);
    expect(vaultAcc.balance.toNumber()).to.equal(amount.toNumber());
  });

  it("Trava Fundos em Escrow (V2 Seeds)", async () => {
    const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
    const description = "Venda de Ativo Digital";

    await program.methods
      .lockEscrow(amount, description)
      .accounts({
        fromVault: vaultPDA,
        escrow: escrowPDA,
        sender: owner.publicKey,
        receiver: receiver.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([owner])
      .rpc();

    const vaultAcc = await program.account.vaultAccount.fetch(vaultPDA);
    const escrowAcc = await program.account.escrowAccount.fetch(escrowPDA);

    expect(vaultAcc.balance.toNumber()).to.equal(1 * LAMPORTS_PER_SOL);
    expect(escrowAcc.amount.toNumber()).to.equal(amount.toNumber());
    expect(escrowAcc.itemDescription).to.equal(description);
  });

  it("Libera Escrow V2 com Dupla Assinatura", async () => {
    // Inicializamos o cofre do recebedor (V2)
    await program.methods
      .initVault(oracle.publicKey)
      .accounts({
        vault: receiverVaultPDA,
        owner: receiver.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([receiver])
      .rpc();

    // Liberação (Receiver + Oracle)
    await program.methods
      .releaseEscrow()
      .accounts({
        escrow: escrowPDA,
        toVault: receiverVaultPDA,
        sender: owner.publicKey,
        receiver: receiver.publicKey,
        quantumAuthority: oracle.publicKey,
      } as any)
      .signers([receiver, oracle])
      .rpc();

    const receiverVault = await program.account.vaultAccount.fetch(receiverVaultPDA);
    const escrowAcc = await program.account.escrowAccount.fetch(escrowPDA);

    expect(receiverVault.balance.toNumber()).to.equal(1 * LAMPORTS_PER_SOL);
    expect(escrowAcc.isCompleted).to.be.true;
  });
});
