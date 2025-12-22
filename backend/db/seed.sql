-- ============================================================
-- DPP Trust System - Demo Seed Data (didwebvh-ts compatible)
-- ============================================================
-- Updated for new DID format: did:webvh:{domain}:{scid}
-- Run: Get-Content seed.sql | podman exec -i dpp-postgres psql -U dpp_admin -d dpp_db
-- ============================================================

-- Clear existing data for fresh start
TRUNCATE audits, events, batches, identities CASCADE;

-- ============================================================
-- 1. Demo Window Products
-- ============================================================

-- Window 1: Triple Glass Premium Window
INSERT INTO identities (did, scid, public_key, status, created_at, updated_at)
VALUES (
    'did:webvh:localhost:3000:z-demo-window-001',
    'z-demo-window-001',
    'z7QFeDemoKey001LBZxY6Mv1sFm_s1TrbyEpjYdyOU58YhcA',
    'active',
    NOW() - INTERVAL '7 days',
    NOW()
) ON CONFLICT (did) DO NOTHING;

-- Window 2: Double Glass Standard Window
INSERT INTO identities (did, scid, public_key, status, created_at, updated_at)
VALUES (
    'did:webvh:localhost:3000:z-demo-window-002',
    'z-demo-window-002',
    'z7QFeDemoKey002qRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od',
    'active',
    NOW() - INTERVAL '5 days',
    NOW()
) ON CONFLICT (did) DO NOTHING;

-- Window 3: Smart Window with Sensors
INSERT INTO identities (did, scid, public_key, status, created_at, updated_at)
VALUES (
    'did:webvh:localhost:3000:z-demo-window-003',
    'z-demo-window-003',
    'z7QFeDemoKey003HQo3fRRohk44dsbE76CuiTpBmyMWq2VV',
    'active',
    NOW() - INTERVAL '3 days',
    NOW()
) ON CONFLICT (did) DO NOTHING;

-- ============================================================
-- 2. Demo Glass Components
-- ============================================================

INSERT INTO identities (did, scid, public_key, status, created_at, updated_at)
VALUES (
    'did:webvh:localhost:3000:z-demo-glass-001',
    'z-demo-glass-001',
    'z7QFeDemoKey004ByVyhQM7aLgxQWJzXg4nPo8hgcPqgNz8',
    'active',
    NOW() - INTERVAL '10 days',
    NOW()
) ON CONFLICT (did) DO NOTHING;

-- ============================================================
-- 3. Demo Frame Components
-- ============================================================

INSERT INTO identities (did, scid, public_key, status, created_at, updated_at)
VALUES (
    'did:webvh:localhost:3000:z-demo-frame-001',
    'z-demo-frame-001',
    'z7QFeDemoKey005THR8VNsBxYAAWHut2Geadd9jSwuBV8xR',
    'active',
    NOW() - INTERVAL '12 days',
    NOW()
) ON CONFLICT (did) DO NOTHING;

-- ============================================================
-- 4. Demo Events (Create events for each identity)
-- ============================================================

-- Event for Window 1
INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp)
VALUES (
    'did:webvh:localhost:3000:z-demo-window-001',
    'create',
    '{"type": "window", "model": "Triple Glass Premium Window", "manufacturer": "EcoGlass BV", "dimensions": {"width": 1200, "height": 1500}, "specifications": {"uValue": 0.8, "glassLayers": 3}}',
    'z-demo-sig-window-001',
    '0xabc123window001demo',
    '1',
    EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days')::BIGINT * 1000
) ON CONFLICT DO NOTHING;

-- Event for Window 2
INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp)
VALUES (
    'did:webvh:localhost:3000:z-demo-window-002',
    'create',
    '{"type": "window", "model": "Double Glass Standard Window", "manufacturer": "EcoGlass BV", "dimensions": {"width": 1000, "height": 1200}, "specifications": {"uValue": 1.2, "glassLayers": 2}}',
    'z-demo-sig-window-002',
    '0xdef456window002demo',
    '1',
    EXTRACT(EPOCH FROM NOW() - INTERVAL '5 days')::BIGINT * 1000
) ON CONFLICT DO NOTHING;

-- Event for Window 3
INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp)
VALUES (
    'did:webvh:localhost:3000:z-demo-window-003',
    'create',
    '{"type": "window", "model": "Smart Window with Sensors", "manufacturer": "SmartGlass Tech", "dimensions": {"width": 1400, "height": 1800}, "specifications": {"uValue": 0.6, "glassLayers": 3, "sensors": ["temperature", "humidity", "light"]}}',
    'z-demo-sig-window-003',
    '0xghi789window003demo',
    '1',
    EXTRACT(EPOCH FROM NOW() - INTERVAL '3 days')::BIGINT * 1000
) ON CONFLICT DO NOTHING;

-- Event for Glass 1
INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp)
VALUES (
    'did:webvh:localhost:3000:z-demo-glass-001',
    'create',
    '{"type": "glass", "model": "Triple Layer Tempered Glass", "manufacturer": "Glass Solutions BV", "specifications": {"thickness": 24, "coating": "Low-E", "tint": "clear"}}',
    'z-demo-sig-glass-001',
    '0xjkl012glass001demo',
    '1',
    EXTRACT(EPOCH FROM NOW() - INTERVAL '10 days')::BIGINT * 1000
) ON CONFLICT DO NOTHING;

-- Event for Frame 1
INSERT INTO events (did, event_type, payload, signature, leaf_hash, version_id, timestamp)
VALUES (
    'did:webvh:localhost:3000:z-demo-frame-001',
    'create',
    '{"type": "frame", "model": "Aluminum Thermal Break Frame", "manufacturer": "Frame Masters NV", "specifications": {"material": "aluminum", "thermalBreak": true, "color": "anthracite"}}',
    'z-demo-sig-frame-001',
    '0xmno345frame001demo',
    '1',
    EXTRACT(EPOCH FROM NOW() - INTERVAL '12 days')::BIGINT * 1000
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Summary
-- ============================================================
-- DID format: did:webvh:{domain}:{scid}
-- Run this to verify:
-- SELECT did, scid, status FROM identities;
-- SELECT did, event_type, payload->>'model' as model FROM events;
