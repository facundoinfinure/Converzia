-- ============================================
-- Migration 019 Part 1: Add Enum Values
-- ============================================
-- Run this FIRST, then run Part 2

-- 1. Update delivery_status enum to include new states
-- Add PARTIAL status if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PARTIAL' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_status')
    ) THEN
        ALTER TYPE delivery_status ADD VALUE 'PARTIAL';
    END IF;
END $$;

-- Add DEAD_LETTER status if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'DEAD_LETTER' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_status')
    ) THEN
        ALTER TYPE delivery_status ADD VALUE 'DEAD_LETTER';
    END IF;
END $$;

-- ============================================
-- IMPORTANT: After running this part, run Part 2
-- ============================================




