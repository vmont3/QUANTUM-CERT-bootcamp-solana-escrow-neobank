use anchor_lang::prelude::*;

declare_id!("FJKTbA7i4yVJoecGh2w1nmRQgRrVQpaGa1VvBz6Ug2HP");

#[program]
pub mod counter_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        counter.owner = ctx.accounts.user.key();
        Ok(())
    }

    // Step 4: Increment — aritmética simples
    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count += 1;
        Ok(())
    }

    // Step 4: Decrement — aritmética SEGURA
    // saturating_sub() garante que o valor pare em 0 (sem underflow).
    // No Solana, bugs de underflow/overflow custam dinheiro real!
    pub fn decrement(ctx: Context<Decrement>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.saturating_sub(1);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8 + 32)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Step 4: Contextos para Increment e Decrement
// `mut` na counter = estamos modificando o estado on-chain
#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct Decrement<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}

#[account]
pub struct Counter {
    pub count: u64,
    pub owner: Pubkey,
}
