export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> & { DATABASE_URL: string } {
  const databaseUrl = environment.DATABASE_URL

  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL is required')
  }

  let parsedDatabaseUrl: URL
  try {
    parsedDatabaseUrl = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL must be a valid URL')
  }

  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://')
  }

  if (
    parsedDatabaseUrl.hostname === '' ||
    parsedDatabaseUrl.pathname === '' ||
    parsedDatabaseUrl.pathname === '/'
  ) {
    throw new Error('DATABASE_URL must be a valid URL')
  }

  return { ...environment, DATABASE_URL: databaseUrl }
}
