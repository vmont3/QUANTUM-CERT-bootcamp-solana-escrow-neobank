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
