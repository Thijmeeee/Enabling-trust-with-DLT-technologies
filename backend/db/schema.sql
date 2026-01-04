-- Identities (Managed by Identity Service)
CREATE TABLE identities (
    did VARCHAR(255) PRIMARY KEY,
    scid VARCHAR(255) UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    owner VARCHAR(255),  -- DID of the current owner
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Anchoring Events (Managed by Witness Service)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    did VARCHAR(255) REFERENCES identities(did),
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT NOT NULL,
    leaf_hash VARCHAR(66) NOT NULL,
    version_id VARCHAR(100) NOT NULL,
    timestamp BIGINT NOT NULL,
    witness_proofs JSONB, -- Array of witness signatures
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merkle Batches (Managed by Witness Service)
CREATE TABLE batches (
    batch_id INTEGER PRIMARY KEY,
    merkle_root VARCHAR(66) NOT NULL,
    tx_hash VARCHAR(66),
    block_number INTEGER,
    status VARCHAR(50) DEFAULT 'pending', -- pending, anchored, confirmed
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Watcher Audits (Managed by Watcher Service)
CREATE TABLE audits (
    id SERIAL PRIMARY KEY,
    did VARCHAR(255) REFERENCES identities(did),
    check_type VARCHAR(50), -- 'hash_chain' or 'merkle_proof'
    status VARCHAR(20),     -- 'valid' or 'invalid'
    details TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
