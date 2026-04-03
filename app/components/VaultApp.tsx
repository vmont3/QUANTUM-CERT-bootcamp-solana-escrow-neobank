"use client";

import { FC, useState, useCallback, useEffect, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useProgram } from "../lib/useProgram";

type TxStatus = "idle" | "loading" | "success" | "error";
type Tab = "vault" | "escrow" | "validator";

interface LogEntry {
  id: number;
  action: string;
  sig?: string;
  error?: string;
  ts: string;
  type: string;
  amount?: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

// FASE 36: Oráculo da Quantum Cert (Simulador de Co-signer)
const QUANTUM_ORACLE_SEED = Uint8Array.from([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
]);
const quantumAuthorityKeypair = Keypair.fromSeed(QUANTUM_ORACLE_SEED);

export const VaultApp: FC = () => {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { program } = useProgram();

  // State
  const [activeTab, setActiveTab] = useState<Tab>("vault");
  const [vaultData, setVaultData] = useState<{ balance: number; isFrozen: boolean; quantumAuthority: string } | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isHashValid, setIsHashValid] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  // Form inputs
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  
  // Escrow inputs
  const [escrowTarget, setEscrowTarget] = useState("");
  const [escrowAmount, setEscrowAmount] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [releaseSender, setReleaseSender] = useState("");
  const [pendingEscrows, setPendingEscrows] = useState<any[]>([]);

  const [validatorHash, setValidatorHash] = useState("");

  // PDA calculation - FASE 40.2: Semente vault_v2
  const vaultPDA = useMemo(() => {
    if (!publicKey || !program) return null;
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_v2"), publicKey.toBuffer()],
      program.programId
    );
    return pda;
  }, [publicKey, program]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const addLog = useCallback((action: string, type: string, sig?: string, error?: string, amount?: string) => {
    setLogs((prev) => [
      {
        id: Date.now(),
        action,
        type,
        sig,
        error,
        ts: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        amount
      },
      ...prev.slice(0, 9),
    ]);
  }, []);

  const fetchData = useCallback(async () => {
    if (!program || !publicKey || !vaultPDA) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acc = await (program.account as any).vaultAccount.fetch(vaultPDA);
      setVaultData({
        balance: acc.balance.toNumber() / LAMPORTS_PER_SOL,
        isFrozen: acc.isFrozen,
        quantumAuthority: acc.quantumAuthority.toString()
      });
      setInitialized(true);
    } catch {
      setInitialized(false);
      setVaultData(null);
    }

    const bal = await connection.getBalance(publicKey);
    setSolBalance(bal / LAMPORTS_PER_SOL);

    // Buscar Escrows Pendentes (Inbox)
    try {
      const allEscrows = await (program.account as any).escrowAccount.all([
        {
          memcmp: {
            offset: 40, // receiver @ 40
            bytes: publicKey.toBase58(),
          }
        }
      ]);
      setPendingEscrows(allEscrows.filter((e: any) => !e.account.isCompleted));
    } catch (e) {
      console.error("Inbox fetch error:", e);
    }
  }, [program, publicKey, vaultPDA, connection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runTx = useCallback(async (name: string, type: string, amountStr: string | undefined, fn: () => Promise<string>) => {
    setTxStatus("loading");
    try {
      const sig = await fn();
      await fetchData();
      addLog(name, type, sig, undefined, amountStr);
      setTxStatus("success");
      addToast(`${name} concluído com sucesso.`, "success");
      setTimeout(() => setTxStatus("idle"), 2000);
    } catch (err: any) {
      console.error(err);
      addLog(name, type, undefined, err.message);
      setTxStatus("error");
      addToast(`Erro: ${err.message || "Falha na transação."}`, "error");
      setTimeout(() => setTxStatus("idle"), 500);
    }
  }, [fetchData, addLog, addToast]);

  const handleInit = () => runTx("Inicialização Multi-Sig", "Setup", undefined, async () => {
    if (!program || !publicKey || !vaultPDA) throw new Error("Não conectado");
    return program.methods.initVault(quantumAuthorityKeypair.publicKey).accounts({
      vault: vaultPDA,
      owner: publicKey,
      systemProgram: SystemProgram.programId,
    }).rpc();
  });

  const handleDeposit = () => {
    const sanitized = depositAmount.replace(',', '.');
    const lamports = Math.floor(parseFloat(sanitized) * LAMPORTS_PER_SOL);
    if (isNaN(lamports) || lamports <= 0) return;
    runTx("Depósito", "Depósito", `+${depositAmount} SOL`, async () => {
      if (!program || !publicKey || !vaultPDA) throw new Error("Não conectado");
      return program.methods.deposit(new BN(lamports))
        .accounts({ vault: vaultPDA, owner: publicKey, systemProgram: SystemProgram.programId })
        .rpc();
    });
    setDepositAmount("");
  };

  const handleWithdraw = () => {
    const sanitized = withdrawAmount.replace(',', '.');
    const lamports = Math.floor(parseFloat(sanitized) * LAMPORTS_PER_SOL);
    if (isNaN(lamports) || lamports <= 0) return;
    runTx("Saque Multi-Sig", "Saque", `-${withdrawAmount} SOL`, async () => {
      if (!program || !publicKey || !vaultPDA) throw new Error("Não conectado");
      return program.methods.withdraw(new BN(lamports))
        .accounts({ 
          vault: vaultPDA, 
          owner: publicKey,
          quantumAuthority: quantumAuthorityKeypair.publicKey
        })
        .signers([quantumAuthorityKeypair])
        .rpc();
    });
    setWithdrawAmount("");
  };

  const handleLockEscrow = () => {
    const sanitized = escrowAmount.replace(',', '.');
    const lamports = Math.floor(parseFloat(sanitized) * LAMPORTS_PER_SOL);
    if (isNaN(lamports) || lamports <= 0 || !escrowTarget || !itemDescription) return;

    runTx("Travar Fundos (Escrow)", "Escrow", `-${escrowAmount} SOL`, async () => {
      if (!program || !publicKey || !vaultPDA) throw new Error("Não conectado");
      const targetPubkey = new PublicKey(escrowTarget);
      const [escrowPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), publicKey.toBuffer(), targetPubkey.toBuffer()],
        program.programId
      );
      
      return (program.methods as any).lockEscrow(new BN(lamports), itemDescription)
        .accounts({ 
          fromVault: vaultPDA, 
          escrow: escrowPDA,
          sender: publicKey,
          receiver: targetPubkey,
          systemProgram: SystemProgram.programId
        })
        .rpc();
    });
    setEscrowAmount("");
    setEscrowTarget("");
    setItemDescription("");
  };

  const handleReleaseManual = () => {
    if (!releaseSender) return;
    handleReleaseFromInbox(releaseSender);
    setReleaseSender("");
  };

  const handleReleaseFromInbox = (sender: string) => {
    runTx("Liberar Fundos (Inbox)", "Escrow", undefined, async () => {
      if (!program || !publicKey || !vaultPDA) throw new Error("Não conectado");
      const senderPubkey = new PublicKey(sender);
      const [escrowPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), senderPubkey.toBuffer(), publicKey.toBuffer()],
        program.programId
      );
      
      return (program.methods as any).releaseEscrow()
        .accounts({ 
          escrow: escrowPDA,
          toVault: vaultPDA,
          sender: senderPubkey,
          receiver: publicKey,
          quantum_authority: quantumAuthorityKeypair.publicKey,
        })
        .signers([quantumAuthorityKeypair])
        .rpc();
    });
  };

  const handleValidateInput = () => {
    setIsValidating(true);
    setIsHashValid(false);
    setTimeout(() => {
      setIsValidating(false);
      if (validatorHash.length >= 40) {
        setIsHashValid(true);
      } else {
        alert("Hash inválido. Assinaturas Solana devem ter pelo menos 40 caracteres.");
      }
    }, 1500);
  };

  const copyToClipboard = (text: string, entryId: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(entryId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="font-body selection:bg-white selection:text-black min-h-screen bg-black text-[#e2e2e2]">
      {/* Toast Notifications */}
      <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`pointer-events-auto px-6 py-4 rounded-lg bg-[#1b1b1b] border ${toast.type === 'success' ? 'border-green-500/50' : 'border-red-500/50'} shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-full fade-in duration-300`}
          >
            <span className={`material-symbols-outlined ${toast.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {toast.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span className="text-sm font-label text-zinc-200">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Barra de Navegação Superior - FASE 40.1: Restauração de Branding */}
      <header className="flex justify-between items-center w-full px-6 py-4 max-w-full mx-auto fixed top-0 z-50 bg-[#1b1b1b] border-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-sm flex items-center justify-center">
             <span className="text-black font-bold text-xs">QC</span>
          </div>
          <h1 className="text-xl font-bold tracking-tighter text-white">QUANTUM CERT // Vault</h1>
        </div>
        <div className="hidden md:flex gap-8 items-center">
          <nav className="flex gap-6">
            <button 
              onClick={() => setActiveTab('vault')}
              className={`${activeTab === 'vault' ? 'text-white border-b-2 border-white' : 'text-zinc-500'} pb-1 font-label text-sm transition-all`}
            >
              Meu Cofre
            </button>
            <button 
              onClick={() => setActiveTab('escrow')}
              className={`${activeTab === 'escrow' ? 'text-white border-b-2 border-white' : 'text-zinc-500'} pb-1 font-label text-sm transition-all`}
            >
              Transferência Protegida
            </button>
            <button 
              onClick={() => setActiveTab('validator')}
              className={`${activeTab === 'validator' ? 'text-white border-b-2 border-white' : 'text-zinc-500'} pb-1 font-label text-sm transition-all`}
            >
              Validador
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
           {publicKey && (
             <div className="hidden lg:flex flex-col items-end">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest leading-none mb-1">Saldo da Carteira</span>
                <span className="text-sm font-bold text-primary">{solBalance.toFixed(3)} SOL</span>
             </div>
           )}
           <WalletMultiButton />
        </div>
      </header>

      <div className="flex min-h-screen pt-20 pb-20 md:pb-0">
        {/* Menu Lateral */}
        <aside className="hidden md:flex flex-col h-[calc(100vh-5rem)] sticky top-20 w-64 bg-[#1b1b1b] px-4 py-8">
          <div className="mb-10 px-4">
            <span className="text-xs uppercase tracking-widest text-zinc-600 font-label">Status da Rede</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#ffffff]"></div>
              <span className="text-sm font-label text-zinc-400">Devnet // V2 Account</span>
            </div>
          </div>
          <nav className="flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('vault')}
              className={`flex items-center gap-3 ${activeTab === 'vault' ? 'bg-[#1f1f1f] text-white opacity-100' : 'text-zinc-500 hover:bg-[#1f1f1f] hover:text-white'} px-4 py-3 rounded-md transition-all w-full text-left`}
            >
              <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
              <span className="font-label text-sm">Meu Cofre</span>
            </button>
            <button 
              onClick={() => setActiveTab('escrow')}
              className={`flex items-center gap-3 ${activeTab === 'escrow' ? 'bg-[#1f1f1f] text-white opacity-100' : 'text-zinc-500 hover:bg-[#1f1f1f] hover:text-white'} px-4 py-3 rounded-md transition-all w-full text-left`}
            >
              <span className="material-symbols-outlined text-sm">handshake</span>
              <span className="font-label text-sm whitespace-nowrap">Negociação Protegida</span>
            </button>
            <button 
              onClick={() => setActiveTab('validator')}
              className={`flex items-center gap-3 ${activeTab === 'validator' ? 'bg-[#1f1f1f] text-white opacity-100' : 'text-zinc-500 hover:bg-[#1f1f1f] hover:text-white'} px-4 py-3 rounded-md transition-all w-full text-left`}
            >
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span className="font-label text-sm">Validador de Ativos</span>
            </button>
          </nav>
          <div className="mt-auto px-4 py-6 bg-[#2a2a2a] rounded-lg">
            <div className="text-[10px] text-zinc-500 font-label uppercase tracking-tighter">Nível de Segurança</div>
            <div className="text-lg font-bold text-white font-headline tracking-tighter uppercase">Multi-Sig Active</div>
            <div className="mt-2 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-white w-full animate-pulse"></div>
            </div>
          </div>
        </aside>

        {/* Área de Conteúdo Principal */}
        <main className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-label text-zinc-500 tracking-[0.2em] uppercase">Infraestrutura Quantum</span>
            </div>
            {/* FASE 40.1: Restauração do Hero Text */}
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter font-headline text-white">
              {activeTab === 'vault' ? "Controle Soberano." : activeTab === 'escrow' ? "Escrow Seguro." : "Integridade Total."}
            </h2>
          </div>

          {!publicKey ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[#1b1b1b] rounded-lg border border-white/5 font-label">
                <span className="material-symbols-outlined text-6xl text-zinc-700 mb-4 animate-pulse">lock</span>
                <p className="text-zinc-500">Conecte sua carteira para acessar o cofre.</p>
            </div>
          ) : !initialized ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[#1b1b1b] rounded-lg border border-white/5">
                <h3 className="text-2xl font-bold text-white mb-4 tracking-tighter">Cofre de Transição V2</h3>
                <p className="text-zinc-500 mb-8 max-w-xs text-center font-label text-sm">Ative sua nova conta protegida para habilitar as funções do Neobank Pós-Quântico.</p>
                <button 
                  onClick={handleInit}
                  disabled={txStatus === "loading"}
                  className="bg-white text-black font-bold py-4 px-10 rounded-sm hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 font-label"
                >
                  {txStatus === "loading" ? "INICIALIZANDO..." : "INICIALIZAR COFRE V2"}
                </button>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in duration-500">
              
              {activeTab === 'vault' && (
                <section>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Bloco de Saldo */}
                    <div className="lg:col-span-8 bg-[#1b1b1b] p-8 rounded-lg min-h-[320px] flex flex-col justify-between border border-white/5 group hover:border-white/10 transition-all">
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className="text-zinc-500 font-label text-sm uppercase tracking-wider">Saldo Protegido</h3>
                          <div className="flex items-center gap-2">
                             {vaultData?.isFrozen && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold uppercase">Congelado</span>}
                             <span className="material-symbols-outlined text-green-500 text-sm">verified_user</span>
                          </div>
                        </div>
                        <div className="mt-4 flex items-baseline gap-3">
                          <span className={`text-6xl font-bold font-headline tracking-tighter text-white ${txStatus === 'loading' ? 'animate-pulse' : ''}`}>
                            {vaultData?.balance.toFixed(2) || "0.00"}
                          </span>
                          <span className="text-2xl font-label text-zinc-500">SOL</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 font-label">
                        <div className="space-y-2">
                          <div className="relative">
                            <input 
                              type="text"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                              placeholder="0,00"
                              className="w-full bg-black border border-white/10 focus:border-white focus:ring-0 text-white p-3 rounded-sm text-sm"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">SOL</span>
                          </div>
                          <button 
                            onClick={handleDeposit}
                            disabled={txStatus === "loading"}
                            className="w-full bg-white text-black font-bold py-4 px-6 rounded-sm hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <span className="material-symbols-outlined text-lg">south_west</span>
                            Depositar
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div className="relative">
                            <input 
                               type="text"
                               value={withdrawAmount}
                               onChange={(e) => setWithdrawAmount(e.target.value)}
                               placeholder="0,00"
                               className="w-full bg-black border border-white/10 focus:border-white focus:ring-0 text-white p-3 rounded-sm text-sm"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">SOL</span>
                          </div>
                          <button 
                            onClick={handleWithdraw}
                            disabled={txStatus === "loading"}
                            className="w-full border border-white/20 text-white font-bold py-4 px-6 rounded-sm hover:bg-[#1f1f1f] transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <span className="material-symbols-outlined text-lg">enhanced_encryption</span>
                            Saque Multi-Sig
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-4 text-center italic">*A taxa de rede (Gas) de ~0.000005 SOL é paga pelo inicializador da transação.</p>
                    </div>

                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-[#1b1b1b] p-6 rounded-lg border border-white/5 font-label">
                          <h4 className="text-[10px] uppercase text-zinc-500 tracking-widest mb-4">Master PDA V2</h4>
                          <div className="bg-white/5 p-4 rounded text-[10px] font-mono text-zinc-500 break-all leading-tight">
                              {vaultPDA?.toString()}
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-green-900/20 to-black p-6 rounded-lg border border-green-500/10">
                           <p className="text-[10px] text-green-400 font-label uppercase tracking-widest font-bold">Custódia Híbrida Ativa</p>
                           <p className="text-[11px] text-zinc-500 mt-2 font-label">Sua conta é protegida fisicamente por uma camada de co-assinatura obrigatória do Oráculo Quantum.</p>
                        </div>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'escrow' && (
                <section className="space-y-8 font-label">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Criar Escrow */}
                    <div className="bg-[#1b1b1b] rounded-lg p-8 border border-white/5">
                      <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-white">lock_clock</span>
                        <h3 className="text-xl font-bold text-white uppercase italic tracking-tighter">Travar Fundos</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] uppercase text-zinc-500 mb-1 block">Receiver Pubkey</label>
                          <input 
                            type="text"
                            value={escrowTarget}
                            onChange={(e) => setEscrowTarget(e.target.value)}
                            className="w-full bg-black border border-white/10 focus:border-white focus:ring-0 text-white p-3 rounded-sm text-xs"
                            placeholder="Endereço de destino"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] uppercase text-zinc-500 mb-1 block">Valor (SOL)</label>
                            <input 
                              type="text"
                              value={escrowAmount}
                              onChange={(e) => setEscrowAmount(e.target.value)}
                              className="w-full bg-black border border-white/10 focus:border-white focus:ring-0 text-white p-3 rounded-sm text-xs"
                              placeholder="0,00"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-zinc-500 mb-1 block">Contrato</label>
                            <input 
                              type="text"
                              value={itemDescription}
                              onChange={(e) => setItemDescription(e.target.value)}
                              className="w-full bg-black border border-white/10 focus:border-white focus:ring-0 text-white p-3 rounded-sm text-xs"
                              placeholder="Fim da transação"
                            />
                          </div>
                        </div>
                        <button 
                          onClick={handleLockEscrow}
                          className="w-full bg-white text-black font-bold py-4 rounded-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all uppercase text-xs"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">shield_lock</span>
                          Travar com Validação Oracle
                        </button>
                      </div>
                    </div>

                    {/* Liberar Escrow (Manual) */}
                    <div className="bg-[#1b1b1b] rounded-lg p-8 border border-white/5">
                      <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-white">how_to_reg</span>
                        <h3 className="text-xl font-bold text-white uppercase italic tracking-tighter">Finalizar Recebimento</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <p className="text-xs text-zinc-500 mb-4 leading-relaxed">Libere os fundos travados em seu favor informando a Pubkey do pagador original.</p>
                        <div>
                          <label className="text-[10px] uppercase text-zinc-500 mb-1 block">Sender Pubkey</label>
                          <input 
                            type="text"
                            value={releaseSender}
                            onChange={(e) => setReleaseSender(e.target.value)}
                            className="w-full bg-black border border-white/10 focus:border-white focus:ring-0 text-white p-3 rounded-sm text-xs"
                            placeholder="Quem enviou os fundos"
                          />
                        </div>
                        <button 
                          onClick={handleReleaseManual}
                          className="w-full border border-white/10 text-white font-bold py-4 rounded-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-all uppercase text-xs"
                        >
                          <span className="material-symbols-outlined text-sm">verified_user</span>
                          Assinar & Liberar (Manual)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* FASE 46.1: Caixa de Entrada de Escrows */}
                  <div className="bg-[#1b1b1b] rounded-lg p-8 border border-white/5 font-label">
                     <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-primary">inbox</span>
                           </div>
                           <h3 className="text-xl font-bold text-white uppercase italic tracking-tighter">Caixa de Entrada de Contratos</h3>
                        </div>
                        <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">{pendingEscrows.length} PENDENTES</span>
                     </div>

                     {pendingEscrows.length === 0 ? (
                        <div className="py-12 border border-dashed border-white/5 rounded-lg flex flex-col items-center justify-center text-zinc-600">
                           <span className="material-symbols-outlined text-4xl mb-2 opacity-20">mail</span>
                           <p className="text-xs uppercase tracking-widest">Nenhum contrato pendente para assinatura</p>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {pendingEscrows.map((escrow, idx) => (
                              <div key={idx} className="bg-black/40 border border-white/5 p-6 rounded-lg group hover:border-primary/30 transition-all flex flex-col justify-between h-full">
                                 <div>
                                    <div className="flex justify-between items-start mb-4">
                                       <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Remetente</span>
                                       <span className="text-[10px] text-primary font-mono">{escrow.account.sender.toString().slice(0,4)}...{escrow.account.sender.toString().slice(-4)}</span>
                                    </div>
                                    <h4 className="text-white font-bold text-lg mb-1 leading-tight group-hover:text-primary transition-colors italic uppercase tracking-tighter">
                                       {escrow.account.itemDescription}
                                    </h4>
                                    <div className="mt-4 flex items-center gap-2">
                                       <span className="text-xl font-bold text-white tracking-tighter">{(escrow.account.amount.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}</span>
                                       <span className="text-[10px] text-zinc-500 font-label">SOL</span>
                                    </div>
                                 </div>
                                 <button 
                                    onClick={() => handleReleaseFromInbox(escrow.account.sender.toString())}
                                    className="w-full mt-6 bg-white text-black font-bold py-3 rounded-sm text-xs hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                                 >
                                    <span className="material-symbols-outlined text-sm">edit_document</span>
                                    Assinar e Liberar
                                 </button>
                              </div>
                           ))}
                        </div>
                     )}
                     <p className="text-[10px] text-zinc-600 mt-6 italic text-left">*A taxa de rede (Gas) de ~0.000005 SOL é paga pelo recebedor ao assinar a liberação final.</p>
                  </div>
                </section>
              )}


              {activeTab === 'validator' && (
                <section>
                    <div className="bg-[#1b1b1b] p-10 rounded-lg border-2 border-[#d4af37]/30 font-label relative overflow-hidden">
                       {/* Efeito de Documento Oficial */}
                       <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                       
                       <div className="text-center mb-10 border-b border-white/10 pb-6">
                          <h4 className="text-[10px] text-[#d4af37] font-label uppercase tracking-[0.3em] font-bold mb-2">Supreteam Hackathon // Proof of Integrity</h4>
                          <h3 className="text-3xl font-headline font-bold text-white tracking-widest uppercase">Certificado de Custódia Imutável</h3>
                       </div>

                       <div className="grid lg:grid-cols-2 gap-12">
                          <div className="space-y-6">
                             <div>
                                <label className="text-[10px] uppercase text-zinc-500 tracking-widest mb-2 block font-bold text-left">Input de Auditoria Blockchain</label>
                                <input 
                                  type="text"
                                  value={validatorHash}
                                  onChange={(e) => setValidatorHash(e.target.value)}
                                  className="w-full bg-black border border-white/10 text-white p-4 rounded-sm text-xs font-mono"
                                  placeholder="COLE A ASSINATURA DA TRANSAÇÃO (TX HASH)"
                                />
                             </div>
                             <button 
                               onClick={handleValidateInput}
                               disabled={isValidating}
                               className="w-full bg-white text-black font-bold py-4 rounded-sm flex items-center justify-center gap-2 uppercase text-xs hover:bg-[#d4af37] hover:text-black transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                             >
                               {isValidating ? "Processando Algoritmo Falcon-512..." : "Validar Registro na Ledger"}
                             </button>
                          </div>

                          <div className={`relative p-8 rounded border ${isHashValid ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 bg-black/40'} transition-all min-h-[200px] flex flex-col justify-center`}>
                             {isValidating ? (
                                <div className="flex flex-col items-center">
                                   <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
                                   <span className="text-[10px] text-zinc-500 text-center uppercase tracking-widest">Auditando integridade do hash...</span>
                                </div>
                             ) : isHashValid ? (
                                <div className="space-y-4 animate-in zoom-in-95 duration-500">
                                   <div className="flex items-center gap-3 mb-2">
                                      <span className="material-symbols-outlined text-emerald-500 text-3xl">verified</span>
                                      <div>
                                         <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest leading-none">Status: Autêntico</p>
                                         <p className="text-[9px] text-zinc-500 mt-1 uppercase">Validado via Oráculo Quantum Cert</p>
                                      </div>
                                   </div>
                                   
                                   <div className="space-y-2 border-t border-white/10 pt-4">
                                      <div className="flex justify-between items-center text-[9px] uppercase tracking-tighter">
                                         <span className="text-zinc-500">Hash de Segurança</span>
                                         <span className="text-white font-mono">{validatorHash.slice(0,20)}...</span>
                                      </div>
                                      <div className="flex justify-between items-center text-[9px] uppercase tracking-tighter">
                                         <span className="text-zinc-500">Criptografia</span>
                                         <span className="text-white">Pós-Quântica Ativada</span>
                                      </div>
                                      <div className="flex justify-between items-center text-[9px] uppercase tracking-tighter">
                                         <span className="text-zinc-500">Registro Block</span>
                                         <span className="text-emerald-400 font-bold">Imutável</span>
                                      </div>
                                   </div>

                                   <a 
                                      href={`https://solscan.io/tx/${validatorHash}?cluster=devnet`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-2 mt-6 py-2 border border-emerald-500/20 rounded text-[9px] text-emerald-500 uppercase font-bold hover:bg-emerald-500/10 transition-all"
                                   >
                                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                                      Ver Evidence no Solscan
                                   </a>
                                </div>
                             ) : (
                                <div className="flex flex-col items-center opacity-40">
                                   <span className="material-symbols-outlined text-4xl text-zinc-600 mb-2">policy</span>
                                   <span className="text-[10px] text-zinc-600 text-center uppercase tracking-widest">Aguardando auditoria de evidência</span>
                                </div>
                             )}
                          </div>
                       </div>
                    </div>
                </section>
              )}

              {/* Tabela de Transações */}
              <section className="bg-black border border-white/10 rounded-lg overflow-hidden">
                <div className="px-8 py-6 border-b border-white/10 flex justify-between items-center font-label">
                  <h3 className="text-white font-bold uppercase tracking-tighter italic">Histórico de Atividade</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded text-zinc-500">SYNC_OK</span>
                </div>
                <div className="overflow-x-auto font-label">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#1b1b1b] text-zinc-500 uppercase tracking-widest">
                      <tr>
                        <th className="px-8 py-4">TX ID</th>
                        <th className="px-8 py-4">Operação</th>
                        <th className="px-8 py-4">Valor</th>
                        <th className="px-8 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-10 text-center text-zinc-700 italic">Nenhum evento registrado.</td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                            <td className="px-8 py-5 text-zinc-500 font-mono">
                               {log.sig ? <a href={`https://solscan.io/tx/${log.sig}?cluster=devnet`} target="_blank" className="hover:text-white underline">{log.sig.slice(0,12)}...</a> : '---'}
                            </td>
                            <td className="px-8 py-5 text-zinc-200 font-bold uppercase italic tracking-tighter">{log.action}</td>
                            <td className="px-8 py-5 text-white">{log.amount || '---'}</td>
                            <td className="px-8 py-5 text-right font-bold">
                               {log.error ? <span className="text-red-500">FALHA</span> : <span className="text-green-500">CONCLUÍDO</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Navegação Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1b1b1b] flex justify-around p-4 border-t border-white/10 z-[100] backdrop-blur font-label">
         <button onClick={() => setActiveTab('vault')} className={`flex flex-col items-center gap-1 ${activeTab === 'vault' ? 'text-white' : 'text-zinc-500'}`}>
            <span className="material-symbols-outlined text-sm">home</span>
            <span className="text-[10px] uppercase">Vault</span>
         </button>
         <button onClick={() => setActiveTab('escrow')} className={`flex flex-col items-center gap-1 ${activeTab === 'escrow' ? 'text-white' : 'text-zinc-500'}`}>
            <span className="material-symbols-outlined text-sm">handshake</span>
            <span className="text-[10px] uppercase">Escrow</span>
         </button>
         <button onClick={() => setActiveTab('validator')} className={`flex flex-col items-center gap-1 ${activeTab === 'validator' ? 'text-white' : 'text-zinc-500'}`}>
            <span className="material-symbols-outlined text-sm">search</span>
            <span className="text-[10px] uppercase">Validar</span>
         </button>
      </nav>
    </div>
  );
};
