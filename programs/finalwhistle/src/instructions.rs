pub mod claim;
pub mod create_market;
pub mod place_position;
pub mod settle;
pub mod void;

// Glob re-exports are required by the `#[program]` macro (it resolves each instruction's
// generated `__client_accounts_*` / `__cpi_client_accounts_*` modules at the crate root).
// Handlers are uniquely named per module so the globs don't collide.
pub use claim::*;
pub use create_market::*;
pub use place_position::*;
pub use settle::*;
pub use void::*;
