use anchor_lang::prelude::*;

declare_id!("CnxgAWYAFCNQPE9g1SFGyTVqKaVVVmPXYG5eXT9EjqxN");

#[program]
pub mod quantum_cert_vault {
    use super::*;

    pub fn init_vault(ctx: Context<InitVault>, quantum_authority: Pubkey) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.quantum_authority = quantum_authority;
        vault.balance = 0;
        vault.is_frozen = false;
        vault.pq_enabled = true;
        msg!("Quantum Vault Initialized. Owner: {}, Authority: {}", vault.owner, vault.quantum_authority);
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;
        vault.balance = vault.balance.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require_keys_eq!(ctx.accounts.quantum_authority.key(), vault.quantum_authority, ErrorCode::UnauthorizedAuthority);
        if vault.is_frozen { return err!(ErrorCode::VaultFrozen); }
        if vault.balance < amount { return err!(ErrorCode::InsufficientFunds); }
        
        vault.balance = vault.balance.checked_sub(amount).ok_or(ErrorCode::Underflow)?;
        **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;
        Ok(())
    }

    pub fn lock_escrow(ctx: Context<LockEscrow>, amount: u64, item_description: String) -> Result<()> {
        let from_vault = &mut ctx.accounts.from_vault;
        let escrow = &mut ctx.accounts.escrow;

        if from_vault.is_frozen { return err!(ErrorCode::VaultFrozen); }
        if from_vault.balance < amount { return err!(ErrorCode::InsufficientFunds); }

        from_vault.balance = from_vault.balance.checked_sub(amount).ok_or(ErrorCode::Underflow)?;
        
        escrow.sender = ctx.accounts.sender.key();
        escrow.receiver = ctx.accounts.receiver.key();
        escrow.amount = amount;
        escrow.item_description = item_description;
        escrow.is_completed = false;
        escrow.quantum_authority = from_vault.quantum_authority;

        **from_vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **escrow.to_account_info().try_borrow_mut_lamports()? += amount;

        msg!("Escrow Locked: {} lamports for {}", amount, escrow.item_description);
        Ok(())
    }

    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let to_vault = &mut ctx.accounts.to_vault;

        require_keys_eq!(ctx.accounts.receiver.key(), escrow.receiver, ErrorCode::UnauthorizedReceiver);
        require_keys_eq!(ctx.accounts.quantum_authority.key(), escrow.quantum_authority, ErrorCode::UnauthorizedAuthority);

        if escrow.is_completed { return err!(ErrorCode::EscrowAlreadyCompleted); }

        let amount = escrow.amount;
        to_vault.balance = to_vault.balance.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        escrow.is_completed = true;

        **escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
        **to_vault.to_account_info().try_borrow_mut_lamports()? += amount;

        msg!("Escrow Released: {} lamports to {}", amount, to_vault.owner);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(
        init, 
        payer = owner, 
        space = 8 + 32 + 32 + 8 + 1 + 1, 
        seeds = [b"vault_v2", owner.key().as_ref()], 
        bump
    )]
    pub vault: Account<'info, VaultAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, seeds = [b"vault_v2", owner.key().as_ref()], bump)]
    pub vault: Account<'info, VaultAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [b"vault_v2", owner.key().as_ref()], bump)]
    pub vault: Account<'info, VaultAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub quantum_authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(amount: u64, item_description: String)]
pub struct LockEscrow<'info> {
    #[account(mut, seeds = [b"vault_v2", sender.key().as_ref()], bump)]
    pub from_vault: Account<'info, VaultAccount>,
    #[account(
        init,
        payer = sender,
        space = 8 + 32 + 32 + 8 + 4 + item_description.len() + 1 + 32,
        seeds = [b"escrow_v2", sender.key().as_ref(), receiver.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: Target receiver
    pub receiver: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(mut, seeds = [b"escrow_v2", sender.key().as_ref(), receiver.key().as_ref()], bump)]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(mut, seeds = [b"vault_v2", receiver.key().as_ref()], bump)]
    pub to_vault: Account<'info, VaultAccount>,
    /// CHECK: Sender pubkey for PDA seed
    pub sender: UncheckedAccount<'info>,
    pub receiver: Signer<'info>,
    pub quantum_authority: Signer<'info>,
}

#[account]
pub struct VaultAccount {
    pub owner: Pubkey,
    pub quantum_authority: Pubkey,
    pub balance: u64,
    pub is_frozen: bool,
    pub pq_enabled: bool,
}

#[account]
pub struct EscrowAccount {
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub item_description: String,
    pub is_completed: bool,
    pub quantum_authority: Pubkey,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Cálculo resultou em overflow.")]
    Overflow,
    #[msg("Cálculo resultou em underflow.")]
    Underflow,
    #[msg("Saldo insuficiente.")]
    InsufficientFunds,
    #[msg("O cofre está congelado por segurança pós-quântica.")]
    VaultFrozen,
    #[msg("Autoridade Quantum não autorizada.")]
    UnauthorizedAuthority,
    #[msg("Recebedor não autorizado.")]
    UnauthorizedReceiver,
    #[msg("Este Escrow já foi finalizado.")]
    EscrowAlreadyCompleted,
}
