ALTER TABLE revisions ADD COLUMN request_key text UNIQUE;
ALTER TABLE documents ADD COLUMN reused_from text REFERENCES documents(id);
