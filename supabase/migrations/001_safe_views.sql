-- =============================================================================
-- UBUYBOX SPV Dashboard — Supabase Safe Views Migration 001
-- =============================================================================
-- Apply in Supabase SQL Editor after loading the raw sheet-backed base tables.
--
-- Design rule:
--    Bolt controls access. Emergent controls data.
--
-- These views are the ONLY read surface for user-facing dashboard endpoints.
-- Raw base tables (e.g. main_maps_offers_raw) must never be queried directly
-- by the API for investor-facing responses.
--
-- Universal masking rules enforced by every investor-facing view:
--   * NO exact property addresses (only State, County)
--   * NO ownership addresses
--   * NO seller personally identifiable information
--   * NO agent personally identifiable information
--   * NO internal compliance / ops fields
--   * NO raw release-control internals (e.g. approval notes, internal risk flags)
--
-- Level semantics:
--   LEVEL_1 (teaser):     identity + location + structural facts
--   LEVEL_2 (preview):    + top-line financials, still masked PII
--   LEVEL_3 (operator):   + capital-stack detail, waterfall, risk, orders
--   ADMIN:                + operational signals (release control, diagnostics)
-- =============================================================================


-- Revoke defaults so only intended roles read the views.
-- Adjust role names to match your Supabase project.
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;


-- -----------------------------------------------------------------------------
-- MAIN MAPS (Opportunity identity + financials)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_main_maps_l1 AS
SELECT
    "Deal_ID",
    "SPV_ID",
    "State",
    "County",
    "Status",
    "Partner Updates"         AS "Partner_Updates",
    "UNIT_SIZE",
    "TOTAL_UNITS",
    "UNITS_SOLD",
    "Property_Type",
    "Target_Business_Use"
FROM main_maps_offers_raw;

CREATE OR REPLACE VIEW v_main_maps_l2 AS
SELECT
    "Deal_ID", "SPV_ID", "State", "County", "Status",
    "Partner Updates"         AS "Partner_Updates",
    "UNIT_SIZE", "TOTAL_UNITS", "UNITS_SOLD",
    "Property_Type", "Target_Business_Use",
    "Purchase Price"          AS "Purchase_Price",
    "Monthly Payment To Seller" AS "Monthly_Payment",
    "Seller Carryback"        AS "Seller_Carryback",
    "Cash At Closing To Seller" AS "Cash_At_Closing",
    "TOTAL_CAPITAL_REQUIRED"
FROM main_maps_offers_raw;

CREATE OR REPLACE VIEW v_main_maps_l3 AS
SELECT
    m."Deal_ID", m."SPV_ID", m."State", m."County", m."Status",
    m."Partner Updates"         AS "Partner_Updates",
    m."UNIT_SIZE", m."TOTAL_UNITS", m."UNITS_SOLD",
    m."Property_Type", m."Target_Business_Use",
    m."Purchase Price"          AS "Purchase_Price",
    m."Monthly Payment To Seller" AS "Monthly_Payment",
    m."Seller Carryback"        AS "Seller_Carryback",
    m."Cash At Closing To Seller" AS "Cash_At_Closing",
    m."TOTAL_CAPITAL_REQUIRED",
    m."Agent Commission"        AS "Agent_Commission_Percent", -- percentage only, never agent PII
    m."Net To Seller"           AS "Net_To_Seller"
FROM main_maps_offers_raw m;
-- EXCLUDED from all main_maps views:
--   exact address, seller name, agent name, internal compliance notes.


-- -----------------------------------------------------------------------------
-- SPV REGISTRY
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_spv_registry_l1 AS
SELECT
    "SPV_ID",
    "SPV_Name",
    "State",
    "County",
    "Status",
    "Deal_Count"
FROM spv_registry_raw;

CREATE OR REPLACE VIEW v_spv_registry_l2 AS
SELECT
    "SPV_ID", "SPV_Name", "State", "County", "Status", "Deal_Count",
    "Total_Capital",
    "Avg_Unit_Size",
    "Active_Orders"
FROM spv_registry_raw;


-- -----------------------------------------------------------------------------
-- CAPITAL STACK
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_capital_stack_l1 AS
SELECT
    "SPV_ID",
    "Deal_ID",
    "Tranche",
    '—'::text AS "Restricted"  -- teaser only
FROM capital_stack_raw;

CREATE OR REPLACE VIEW v_capital_stack_l2 AS
SELECT
    "SPV_ID", "Deal_ID", "Tranche",
    "Amount",
    "Return_Target"
FROM capital_stack_raw;

CREATE OR REPLACE VIEW v_capital_stack_l3 AS
SELECT
    "SPV_ID", "Deal_ID", "Tranche",
    "Amount", "Return_Target",
    "Priority", "Risk_Level"
FROM capital_stack_raw;


-- -----------------------------------------------------------------------------
-- WATERFALL (L3 only — no preview below operator)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_waterfall_l3 AS
SELECT
    "SPV_ID", "Deal_ID",
    "Step_Order",
    "Tranche",
    "Description"
FROM waterfall_engine_raw;


-- -----------------------------------------------------------------------------
-- DEAL SUMMARY (L3 primary, L1/L2 retain teaser subsets)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_deal_summary_l1 AS
SELECT
    "Deal_ID", "SPV_ID", "Deal_Name", "State",
    "Risk_Summary"
FROM deal_summary_raw;

CREATE OR REPLACE VIEW v_deal_summary_l2 AS
SELECT
    "Deal_ID", "SPV_ID", "Deal_Name", "State",
    "Capital_Stack_Display",
    "Risk_Summary"
FROM deal_summary_raw;

CREATE OR REPLACE VIEW v_deal_summary_l3 AS
SELECT
    "Deal_ID", "SPV_ID", "Deal_Name", "State",
    "Capital_Stack_Display",
    "Waterfall_Display",
    "Risk_Summary"
FROM deal_summary_raw;
-- EXCLUDED: address, seller notes, agent notes, internal compliance flags.


-- -----------------------------------------------------------------------------
-- TRANCHE BREAKDOWN (L3 only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tranche_breakdown_l3 AS
SELECT
    "Deal_ID", "SPV_ID",
    "Tranche_Type",
    "Amount",
    "Return_Target",
    "Priority",
    "Risk_Level"
FROM tranche_breakdown_raw;


-- -----------------------------------------------------------------------------
-- VALIDATION ENGINE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_validation_l1 AS
SELECT
    "SPV_ID", "Deal_ID",
    "Overall_Status"
FROM validation_engine_raw;

CREATE OR REPLACE VIEW v_validation_l2 AS
SELECT
    "SPV_ID", "Deal_ID",
    "Overall_Status",
    "Identity_Status",
    "Location_Status",
    "Financial_Status"
FROM validation_engine_raw;


-- -----------------------------------------------------------------------------
-- OPPORTUNITY RELEASE CONTROL (ADMIN ONLY — never exposed to investors)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_opportunity_release_admin AS
SELECT *
FROM opportunity_release_control_raw;
-- Intentionally full — admin-only. Investor-facing release decisions are
-- projected through application logic in the dashboard endpoint.


-- =============================================================================
-- GRANTS — lock down so only the service role (backend) can read these views.
-- Adjust to your Supabase project policies.
-- =============================================================================
-- GRANT SELECT ON
--     v_main_maps_l1, v_main_maps_l2, v_main_maps_l3,
--     v_spv_registry_l1, v_spv_registry_l2,
--     v_capital_stack_l1, v_capital_stack_l2, v_capital_stack_l3,
--     v_waterfall_l3,
--     v_deal_summary_l1, v_deal_summary_l2, v_deal_summary_l3,
--     v_tranche_breakdown_l3,
--     v_validation_l1, v_validation_l2
-- TO service_role;
--
-- GRANT SELECT ON v_opportunity_release_admin TO service_role;
-- =============================================================================
