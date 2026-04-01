import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CounterProgram } from "../target/types/counter_program";
import { assert } from "chai";

describe("counter-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.CounterProgram as Program<CounterProgram>;
  const counterKeypair = anchor.web3.Keypair.generate();

  it("Can initialize", async () => {
    await program.methods
      .initialize()
      .accounts({
        counter: counterKeypair.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([counterKeypair])
      .rpc();

    const account = await program.account.counter.fetch(counterKeypair.publicKey);
    assert.ok(account.count.toNumber() === 0, "count deve ser 0");
    assert.ok(account.owner.equals(provider.wallet.publicKey), "owner deve ser o provider");
  });

  it("Can increment", async () => {
    await program.methods
      .increment()
      .accounts({ counter: counterKeypair.publicKey, user: provider.wallet.publicKey })
      .rpc();

    const account = await program.account.counter.fetch(counterKeypair.publicKey);
    assert.ok(account.count.toNumber() === 1);
  });

  it("Can decrement", async () => {
    await program.methods
      .decrement()
      .accounts({ counter: counterKeypair.publicKey, user: provider.wallet.publicKey })
      .rpc();

    const account = await program.account.counter.fetch(counterKeypair.publicKey);
    assert.ok(account.count.toNumber() === 0);
  });

  it("Cannot go below zero (saturating_sub)", async () => {
    await program.methods
      .decrement()
      .accounts({ counter: counterKeypair.publicKey, user: provider.wallet.publicKey })
      .rpc();

    const account = await program.account.counter.fetch(counterKeypair.publicKey);
    assert.ok(account.count.toNumber() === 0, "saturating_sub deve parar em 0");
  });

  it("Can reset", async () => {
    await program.methods.increment()
      .accounts({ counter: counterKeypair.publicKey, user: provider.wallet.publicKey }).rpc();
    await program.methods.increment()
      .accounts({ counter: counterKeypair.publicKey, user: provider.wallet.publicKey }).rpc();

    await program.methods.reset()
      .accounts({ counter: counterKeypair.publicKey, user: provider.wallet.publicKey }).rpc();

    const account = await program.account.counter.fetch(counterKeypair.publicKey);
    assert.ok(account.count.toNumber() === 0);
  });
});
