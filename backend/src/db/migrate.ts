import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import mongoose from 'mongoose'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Path to the migrations directory (backend/migrations/)
 */
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Each migration file must export an object (or module) with `up` and `down`.
 *
 * @example
 * ```ts
 * export async function up(db: mongoose.Connection): Promise<void> {
 *   await db.collection('rides').updateMany({ ... }, { ... })
 * }
 *
 * export async function down(db: mongoose.Connection): Promise<void> {
 *   // reverse the up() operation
 * }
 * ```
 */
export interface Migration {
  up: (db: mongoose.Connection) => Promise<void>
  down: (db: mongoose.Connection) => Promise<void>
}

// ---------------------------------------------------------------------------
// Migration Runner
// ---------------------------------------------------------------------------

/**
 * Run all pending migrations that have not yet been applied.
 *
 * 1. Ensures the `migrations/` directory exists.
 * 2. Reads all `.ts` files sorted alphabetically.
 * 3. Filters out already-applied migrations (tracked in `_migrations` collection).
 * 4. Executes each pending migration's `up()` in sequence.
 * 5. On failure, logs the error and exits the process.
 *
 * @returns The number of migrations applied.
 */
export async function runMigrations(): Promise<number> {
  // Ensure migrations directory exists
  if (!existsSync(MIGRATIONS_DIR)) {
    mkdirSync(MIGRATIONS_DIR, { recursive: true })
    console.log('📁 Directorio de migraciones creado')
    return 0
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort()

  if (files.length === 0) {
    console.log('📭 No hay migraciones pendientes')
    return 0
  }

  // Collect already-applied migration filenames
  const db = mongoose.connection.db!
  const applied = await db
    .collection('_migrations')
    .find({})
    .toArray()

  const appliedFilenames = new Set(applied.map((a: any) => a.filename))

  const pending = files.filter((f) => !appliedFilenames.has(f))

  if (pending.length === 0) {
    console.log('✅ Todas las migraciones ya fueron aplicadas')
    return 0
  }

  // Apply each pending migration in order
  for (const file of pending) {
    try {
      const filePath = pathToFileURL(join(MIGRATIONS_DIR, file)).href
      const migrationModule = await import(filePath)
      const migration = migrationModule as Migration

      if (typeof migration.up !== 'function') {
        console.warn(`⚠️ ${file} no exporta una función "up" — saltando`)
        continue
      }

      console.log(`📦 Migración ${file}...`)
      await migration.up(mongoose.connection)

      await mongoose.connection.db!.collection('_migrations').insertOne({
        filename: file,
        appliedAt: new Date(),
      })

      console.log(`✅ Migración ${file} aplicada`)
    } catch (err) {
      console.error(`❌ Error al aplicar migración ${file}:`, err)
      process.exit(1)
    }
  }

  return pending.length
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

/**
 * Revert the most recently applied migration.
 *
 * 1. Queries `_migrations` for the latest entry (sorted by `appliedAt` desc).
 * 2. Calls the migration's `down()` function.
 * 3. Removes the tracking record on success.
 */
export async function migrateDown(): Promise<void> {
  const db = mongoose.connection.db!
  const cursor = await db
    .collection('_migrations')
    .find({})
    .sort({ appliedAt: -1 })
    .limit(1)
    .toArray()

  if (cursor.length === 0) {
    console.log('📭 No hay migraciones para revertir')
    return
  }

  const record = cursor[0] as unknown as { filename: string }
  const { filename } = record

  try {
    const filePath = pathToFileURL(join(MIGRATIONS_DIR, filename)).href
    const migrationModule = await import(filePath)
    const migration = migrationModule as Migration

    if (typeof migration.down !== 'function') {
      console.warn(`⚠️ ${filename} no exporta una función "down" — saltando`)
      return
    }

    console.log(`⏪ Revirtiendo ${filename}...`)
    await migration.down(mongoose.connection)

    await db
      .collection('_migrations')
      .deleteOne({ filename })

    console.log(`✅ Migración ${filename} revertida`)
  } catch (err) {
    console.error(`❌ Error al revertir migración ${filename}:`, err)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Migration Generator
// ---------------------------------------------------------------------------

/**
 * Generate a new migration file with a timestamped name and boilerplate template.
 *
 * @param description Short description used to build the filename (e.g. "add-index-to-rides").
 */
export async function createMigrationFile(description: string): Promise<void> {
  if (!existsSync(MIGRATIONS_DIR)) {
    mkdirSync(MIGRATIONS_DIR, { recursive: true })
  }

  // Timestamp format: YYYYMMDD_HHmmss (e.g. 20260625_190000)
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

  // Sanitize description: lowercase, spaces → hyphens, strip special chars
  const sanitized = description
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const filename = `${ts}-${sanitized}.ts`
  const filePath = join(MIGRATIONS_DIR, filename)

  const template = `import type { Connection } from 'mongoose'

export async function up(db: Connection): Promise<void> {
  // TODO: Write migration logic
  // Example:
  // await db.collection('rides').updateMany(
  //   { /* filter */ },
  //   { /* update */ }
  // )
}

export async function down(db: Connection): Promise<void> {
  // TODO: Write rollback logic
  // Reverse of up()
}
`

  writeFileSync(filePath, template, 'utf-8')
  console.log(`✅ Archivo creado: migrations/${filename}`)
}

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

const command = process.argv[2]

// Only act as CLI when this file is the entry point (not imported as a module)
const isCLI =
  ['up', 'down', 'create'].includes(command ?? '') &&
  (process.argv[1]?.replace(/\\/g, '/').endsWith('migrate.ts') ?? false)

if (isCLI) {
  const { connectDB, disconnectDB } = await import('./mongo')

  switch (command) {
    case 'up': {
      await connectDB()
      const count = await runMigrations()
      console.log(`✅ ${count} migraciones aplicadas`)
      await disconnectDB()
      break
    }

    case 'down': {
      await connectDB()
      await migrateDown()
      await disconnectDB()
      break
    }

    case 'create': {
      const desc = process.argv[3]
      if (!desc) {
        console.error('❌ Debes especificar un nombre para la migración')
        console.log('   Uso: bun run src/db/migrate.ts create <descripción>')
        process.exit(1)
      }
      await createMigrationFile(desc)
      break
    }
  }
}
