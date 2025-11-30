# Fix for ltree Path Generation Error

## Problem
The database trigger `set_node_path()` is failing because node names contain spaces and special characters, which are not allowed in ltree paths.

## Solution
Run the SQL script to update the trigger function to sanitize node names before creating ltree paths.

## Steps to Apply Fix

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `fix_ltree_trigger.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute

### Option 2: Using psql
```bash
psql "postgresql://postgres:Krishna%40529@db.aksbirmlkbkmtmriogct.supabase.co:5432/postgres" -f fix_ltree_trigger.sql
```

## What the Fix Does
- Sanitizes node names by:
  - Converting to lowercase
  - Replacing spaces and special characters with underscores
  - Ensuring paths start with a letter (ltree requirement)
- Maintains all original functionality of the trigger

## After Applying
Restart your backend server:
```bash
npm run dev
```

Then try creating projects/tasks again in the frontend.
