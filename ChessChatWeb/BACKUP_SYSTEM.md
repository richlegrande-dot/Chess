# Wall-E Knowledge Base Backup System

## 🛡️ Automatic Backups

Wall-E's training data is protected with multiple backup systems:

### 1. **Manual Backup**
```bash
npm run db:backup
```
Creates timestamped backup in `backups/knowledge-[timestamp]/`

### 2. **Automated Daily Backups** (GitHub Actions)
- Runs daily at 3 AM UTC
- Automatically commits to git
- Stores artifacts for 90 days
- Triggers after deployments

### 3. **Local Auto-Backup** (Windows Task Scheduler)
```powershell
# Run this once to set up scheduled backup
powershell -ExecutionPolicy Bypass -File scripts/auto-backup.ps1
```

Then create a Windows Task Scheduler task:
- Program: `powershell.exe`
- Arguments: `-ExecutionPolicy Bypass -File "C:\Users\richl\LLM vs Me\ChessChatWeb\scripts\auto-backup.ps1"`
- Trigger: Daily at preferred time
- Start in: `C:\Users\richl\LLM vs Me\ChessChatWeb`

## 📦 Backup Contents

Each backup includes:
- `full-backup.json` - Complete database export
- `metadata.json` - Backup statistics
- Individual source files (e.g., `chess-tactics.json`)

## 🔄 Restore From Backup

### Restore latest backup:
```bash
npm run db:restore
```

### Restore specific backup:
```bash
npm run db:restore backups/knowledge-2025-12-19/full-backup.json
```

## 📁 Backup Locations

1. **Local backups**: `backups/knowledge-[timestamp]/`
2. **Latest backup**: `backups/latest/` (always current)
3. **Git repository**: Committed to version control
4. **GitHub Artifacts**: 90-day retention
5. **Source files**: `knowledge_seed/*.md` (original data)

## 🔒 Data Safety Guarantees

✅ **Multiple backup copies** - Local + Git + Artifacts  
✅ **Automated daily backups** - Never forget  
✅ **Version history** - Git tracks all changes  
✅ **Long-term retention** - 90-day artifact storage  
✅ **Easy restoration** - One command to restore  
✅ **Original sources preserved** - Markdown files tracked

## 🚨 Disaster Recovery

If the database is lost:

1. **Check latest backup**:
   ```bash
   cat backups/latest/metadata.json
   ```

2. **Restore from backup**:
   ```bash
   npm run db:restore
   ```

3. **Or restore from seed files**:
   ```bash
   npm run import:knowledge
   ```

4. **Or use GitHub artifact**:
   - Go to Actions → Backup Wall-E Knowledge Base
   - Download latest artifact
   - Extract and restore

## ⚙️ Configuration

### GitHub Actions (Required for automated backups)

Add these secrets to GitHub repository:
- `DATABASE_URL` - Production database connection string

### Environment Variables

Set in `.env`:
```env
DATABASE_URL="your_database_url_here"
```

## 📊 Monitoring

Check backup status:
- **Local**: Look in `backups/latest/metadata.json`
- **GitHub**: Check Actions tab for workflow runs
- **Logs**: Check workflow logs for any errors

## 🔄 Update Schedule

- **Daily**: Automated backup at 3 AM UTC
- **After deployment**: Automatic backup
- **On-demand**: Run `npm run db:backup` anytime

---

**Your Wall-E training data is now protected! 🤖✨**
