use anchor_lang::prelude::*;

declare_id!("FJKTbA7i4yVJoecGh2w1nmRQgRrVQpaGa1VvBz6Ug2HP");

#[program]
pub mod counter_program {
    use super::*;

    // Step 3: Instrução Initialize
    // Cada instrução recebe um Context com as Accounts já validadas pelo Anchor.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        counter.owner = ctx.accounts.user.key();
        Ok(())
    }
}

// Step 3: Contexto de validação para Initialize
// #[derive(Accounts)] valida todas as accounts antes da execução.
// `init` cria a account; `payer = user` define quem paga o rent.
// space = 8 (discriminador Anchor) + 8 (u64) + 32 (Pubkey)
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8 + 32)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Step 2: Estado
#[account]
pub struct Counter {
    pub count: u64,
    pub owner: Pubkey,
}
