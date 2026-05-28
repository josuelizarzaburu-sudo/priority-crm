-- Migration: Rename roles ADMIN→SUPER_ADMIN, MEMBER→SALES_REP, add OWNER
-- PostgreSQL does not support DROP VALUE on enums, so we recreate the type.

-- 1. Create the new enum type
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'OWNER', 'MANAGER', 'SALES_REP');

-- 2. Drop the column default before changing the type
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- 3. Convert the column using a CASE expression to map old→new values
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING CASE "role"::text
    WHEN 'ADMIN'   THEN 'SUPER_ADMIN'::"UserRole_new"
    WHEN 'MEMBER'  THEN 'SALES_REP'::"UserRole_new"
    ELSE "role"::text::"UserRole_new"
  END;

-- 4. Drop the old enum type and rename the new one
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- 5. Restore the column default
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'SALES_REP'::"UserRole";
