-- Contract migration 001; not run by application, compose or CI. Synthetic tests
-- use memory. A future adapter must apply grants + audit in one DB transaction.
BEGIN;
CREATE TABLE commerce_accounts (id text PRIMARY KEY, auth_issuer text NOT NULL, auth_subject text NOT NULL, active boolean NOT NULL, role text NOT NULL CHECK (role IN ('user','admin')), UNIQUE(auth_issuer,auth_subject));
CREATE TABLE commerce_purchases (id text PRIMARY KEY, account_id text NOT NULL REFERENCES commerce_accounts(id), provider text NOT NULL, provider_purchase_id text NOT NULL, status text NOT NULL CHECK(status IN ('pending','confirmed','reversed')), UNIQUE(provider,provider_purchase_id));
CREATE TABLE commerce_grants (id text PRIMARY KEY, account_id text NOT NULL REFERENCES commerce_accounts(id), scope text NOT NULL, source text NOT NULL CHECK(source IN ('owner','granted','purchased')), issued_at bigint NOT NULL, expires_at bigint, revoked_at bigint, version integer NOT NULL CHECK(version=1), purchase_id text REFERENCES commerce_purchases(id), CHECK(source <> 'owner' OR (scope='*' AND expires_at IS NULL)), CHECK(expires_at IS NULL OR expires_at>issued_at), CHECK(revoked_at IS NULL OR revoked_at>=issued_at), CHECK((source='purchased')=(purchase_id IS NOT NULL)));
CREATE TABLE commerce_audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, operation_id text NOT NULL UNIQUE, actor_id text REFERENCES commerce_accounts(id), operation text NOT NULL, subject_id text NOT NULL, at bigint NOT NULL);
CREATE TABLE commerce_schema_versions (version integer PRIMARY KEY);
INSERT INTO commerce_schema_versions VALUES (1);
COMMIT;
