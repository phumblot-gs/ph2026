# GitHub Actions Configuration

## Workflows

### 1. CI (ci.yml)
Runs on all pushes and PRs to dev, test, and main branches.
- Installs dependencies
- Runs linter
- Builds the application

### 2. Migration Dry-run (migrate-dryrun.yml)
Runs on PRs from test → main.
- Tests database migrations before merging to production
- Validates migrations won't break production database

### 3. Migration Apply (migrate-on-main.yml)
Runs when PRs are merged to main or on direct pushes to main.
- Applies database migrations to production
- Runs dry-run first for safety

## Required GitHub Secrets

Configure these secrets in your repository settings (Settings → Secrets and variables → Actions):

### For Database Migrations:
- `PROD_DB_URL`: Production database connection string from Supabase
  - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
  - Get this from Supabase Dashboard → Settings → Database → Connection string

### Optional (for build process):
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `NEXT_PUBLIC_SITE_URL`: Your production site URL

## Environments

Create a "Production" environment in GitHub (Settings → Environments) with:
- Protection rules as needed
- Required reviewers for production deployments
- Environment secrets specific to production