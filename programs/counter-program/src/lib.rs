use anchor_lang::prelude::*;

declare_id!("FJKTbA7i4yVJoecGh2w1nmRQgRrVQpaGa1VvBz6Ug2HP");

#[program]
pub mod counter_program {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

// Step 2: Definindo o Estado
// O macro #[account] prepara a struct para serialização automática pelo Anchor.
// space = 8 (discriminador) + 8 (u64) + 32 (Pubkey)
#[account]
pub struct Counter {
    pub count: u64,    // valor atual do contador
    pub owner: Pubkey, // quem criou e controla este contador
}
