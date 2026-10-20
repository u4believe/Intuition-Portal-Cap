-- Wallets linked to accounts that signed in another way (Discord today).
-- A link is created only with proof of both sides: the account's session and
-- a signature from the wallet. One wallet per account, one account per wallet.
CREATE TABLE IF NOT EXISTS account_wallet_links (
  account_ref     TEXT PRIMARY KEY,              -- e.g. 'discord:1234567890'
  wallet_address  TEXT NOT NULL UNIQUE,          -- lowercased 0x address
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
