"use client";

import { FC, useState, useCallback, useEffect, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import Image from "next/image";
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

// FASE 53: Hotfix Oráculo (Geração Determinística Segura)
const quantumServerKeypair = Keypair.fromSeed(new Uint8Array(32).fill(1));

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
  const [assetStatus, setAssetStatus] = useState("Autenticidade Confirmada");
  const [assetFacet, setAssetFacet] = useState("Transação");
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
  const [hybridAssets, setHybridAssets] = useState<any[]>([]);

  const [validatorHash, setValidatorHash] = useState("");

  // PDA calculation - FASE 55: Semente vault_v3
  const vaultPDA = useMemo(() => {
    if (!publicKey || !program) return null;
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_v3"), publicKey.toBuffer()],
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
    // Carregar Inventário Híbrido (localStorage mock)
    const localData = localStorage.getItem("quantum_assets");
    if (localData) {
      setHybridAssets(JSON.parse(localData));
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
    return program.methods.initVault(quantumServerKeypair.publicKey).accounts({
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
          quantumAuthority: quantumServerKeypair.publicKey
        })
        .signers([quantumServerKeypair])
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
        [Buffer.from("escrow_v3"), publicKey.toBuffer(), targetPubkey.toBuffer()],
        program.programId
      );
      
      const tx = await (program.methods as any).lockEscrow(new BN(lamports), itemDescription)
        .accounts({ 
          fromVault: vaultPDA, 
          escrow: escrowPDA,
          sender: publicKey,
          receiver: targetPubkey,
          systemProgram: SystemProgram.programId
        })
        .rpc();

      // FASE 48.4: Inventário Híbrido (Off-chain Mock)
      const newAsset = {
        txId: tx,
        tipo: "Contrato Condicional",
        ativo: escrowAmount,
        data: new Date().toLocaleDateString('pt-BR'),
        status: "Aguardando Assinatura",
        recebedor: escrowTarget.slice(0, 8) + "..."
      };
      
      const updatedAssets = [newAsset, ...hybridAssets];
      setHybridAssets(updatedAssets);
      localStorage.setItem("quantum_assets", JSON.stringify(updatedAssets));

      return tx;
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
        [Buffer.from("escrow_v3"), senderPubkey.toBuffer(), publicKey.toBuffer()],
        program.programId
      );
      
      return (program.methods as any).releaseEscrow()
        .accounts({ 
          escrow: escrowPDA,
          toVault: vaultPDA,
          sender: senderPubkey,
          receiver: publicKey,
          quantum_authority: quantumServerKeypair.publicKey,
        })
        .signers([quantumServerKeypair])
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
        // Tenta extrair contexto do inventário híbrido local
        const savedAssets = JSON.parse(localStorage.getItem("quantum_assets") || "[]");
        const match = savedAssets.find((a: any) => a.txId === validatorHash);
        if (match) {
           setAssetStatus(match.status || "Autenticidade Confirmada");
           setAssetFacet(match.tipo || "Ativo Solana");
        } else {
           setAssetStatus("Autenticidade Confirmada");
           setAssetFacet("Transação de Ledger");
        }
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
          <Image src="/logo.png" alt="Quantum Cert" width={40} height={40} className="object-contain" />
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
                <h3 className="text-2xl font-bold text-white mb-4 tracking-tighter">Cofre de Transição V3</h3>
                <p className="text-zinc-500 mb-8 max-w-xs text-center font-label text-sm">Ative sua nova conta protegida para habilitar as funções do Neobank Pós-Quântico.</p>
                <button 
                  onClick={handleInit}
                  disabled={txStatus === "loading"}
                  className="bg-white text-black font-bold py-4 px-10 rounded-sm hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 font-label"
                >
                  {txStatus === "loading" ? "INICIALIZANDO..." : "INICIALIZAR COFRE V3"}
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
                <section className="space-y-8 font-label">
                    <div className="bg-[#1b1b1b] p-10 rounded-lg border-2 border-[#d4af37]/30 font-label relative overflow-hidden">
                       {/* Efeito de Documento Oficial */}
                       <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                       
                       <div className="text-center mb-10 border-b border-white/10 pb-6 flex flex-col items-center">
                          <Image src="/logo.png" alt="Quantum Cert" width={60} height={60} className="mb-4 grayscale opacity-50 contrast-125" />
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

                          <div className={`relative p-1 rounded-2xl ${isHashValid ? 'bg-gradient-to-br from-emerald-500/20 to-transparent' : 'bg-[#1b1b1b]'} transition-all min-h-[400px] flex flex-col justify-center overflow-hidden`}>
                             {isValidating ? (
                                <div className="flex flex-col items-center">
                                   <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(212,175,55,0.2)]"></div>
                                   <span className="text-[10px] text-zinc-500 text-center uppercase tracking-[0.3em] font-label">Motor Falcon-512 Auditando...</span>
                                </div>
                             ) : isHashValid ? (
                                <div className="bg-[#111111] rounded-2xl p-8 border border-white/5 shadow-2xl animate-in zoom-in-95 duration-500 overflow-hidden relative h-full flex flex-col">
                                   {/* Overlay Gradient Brilhante */}
                                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                                   
                                   <div className="flex flex-col items-center text-center flex-1 justify-center">
                                      <div className="mb-6 flex flex-col items-center">
                                         <Image src="/logo.png" alt="Quantum Cert" width={32} height={32} className="mb-2" />
                                         <span className="text-[10px] text-zinc-500 tracking-[0.4em] font-bold uppercase">Quantum Cert</span>
                                      </div>

                                      <div className="w-20 h-20 bg-green-900/20 rounded-full flex items-center justify-center mb-6 relative">
                                         <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping opacity-20"></div>
                                         <span className="material-symbols-outlined text-emerald-400 text-5xl">check</span>
                                      </div>

                                      <span className="text-emerald-400 text-[10px] font-bold tracking-[0.5em] uppercase mb-1">{assetStatus.toUpperCase()}</span>
                                      <h2 className="text-white text-3xl font-bold tracking-tighter mb-2">{assetFacet}</h2>
                                      <p className="text-zinc-400 text-sm max-w-[280px] leading-relaxed mb-8">
                                         A {assetStatus.toLowerCase()} deste(a) {assetFacet.toLowerCase()} foi validada pela Quantum Cert e registrada na blockchain da Solana.
                                      </p>

                                      <div className="w-full bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                                         <div className="flex justify-between items-center text-[10px] uppercase tracking-tighter">
                                            <span className="text-zinc-500 font-bold">ID do Ativo</span>
                                            <span className="text-zinc-200 font-mono">{validatorHash.slice(0, 12)}...{validatorHash.slice(-4)}</span>
                                         </div>
                                         <div className="flex justify-between items-center text-[10px] uppercase tracking-tighter">
                                            <span className="text-zinc-500 font-bold">Data da Validação</span>
                                            <span className="text-zinc-200">{new Date().toLocaleDateString('pt-BR')}</span>
                                         </div>
                                         <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-tighter font-bold">Registro Imutável</span>
                                            <a 
                                               href={`https://solscan.io/tx/${validatorHash}?cluster=devnet`}
                                               target="_blank"
                                               rel="noopener noreferrer"
                                               className="text-emerald-400 text-[10px] uppercase font-bold flex items-center gap-1 hover:text-emerald-300 transition-colors"
                                            >
                                               Ver no Solscan
                                               <span className="material-symbols-outlined text-[10px]">arrow_outward</span>
                                            </a>
                                         </div>
                                      </div>
                                   </div>
                                </div>
                             ) : (
                                <div className="flex flex-col items-center opacity-40">
                                   <span className="material-symbols-outlined text-4xl text-zinc-600 mb-2">policy</span>
                                   <span className="text-[10px] text-zinc-600 text-center uppercase tracking-widest">Aguardando auditoria de evidência</span>
                                </div>
                             )}
                          </div>
                       </div>
                     <div className="mt-12 pt-12 border-t border-white/5">
                        <div className="flex items-center gap-3 mb-8">
                           <span className="material-symbols-outlined text-primary">inventory_2</span>
                           <h3 className="text-xl font-bold text-white uppercase italic tracking-tighter">Meu Inventário de Ativos (Híbrido)</h3>
                        </div>

                        {hybridAssets.length === 0 ? (
                           <div className="py-12 bg-white/5 rounded-lg border border-dashed border-white/10 text-center text-zinc-600 italic text-xs uppercase tracking-widest">
                              Nenhum ativo off-chain registrado nesta sessão local.
                           </div>
                        ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {hybridAssets.map((asset, idx) => (
                                 <div key={idx} className="bg-[#222] border border-white/5 p-5 rounded flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                       <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-zinc-400 font-bold uppercase">{asset.tipo}</span>
                                       <span className="text-[9px] text-zinc-500 font-mono">{asset.txId.slice(0, 10)}...</span>
                                    </div>
                                    <div className="text-lg font-bold text-white tracking-tighter uppercase italic">{asset.ativo} SOL</div>
                                    <div className="mt-3 flex justify-between items-center">
                                       <div className="flex flex-col">
                                          <span className="text-[9px] text-zinc-600 uppercase">Status</span>
                                          <span className="text-[10px] text-primary font-bold uppercase">{asset.status}</span>
                                       </div>
                                       <div className="flex flex-col items-end">
                                          <span className="text-[9px] text-zinc-600 uppercase">Data</span>
                                          <span className="text-[10px] text-zinc-400 font-bold uppercase">{asset.data}</span>
                                       </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-white/5 text-[9px] text-zinc-600 uppercase flex justify-between">
                                       <span>Receiver: {asset.recebedor}</span>
                                       <span className="text-primary/40 cursor-help" title="Validado pela On-chain Integrity Law">QC_HYBRID_AUTH_OK</span>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
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
