ALTER TABLE revisions ADD COLUMN bank_hash text;
CREATE INDEX revisions_bank_hash ON revisions(bank_hash);
