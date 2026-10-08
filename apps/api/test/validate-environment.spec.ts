import { describe, expect, it } from 'vitest'
import { validateEnvironment } from '../src/config/validate-environment.js'

describe('validateEnvironment', () => {
  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnvironment({})).toThrow('DATABASE_URL is required')
  })

  it.each(['', '   ', '\t\n'])('rejects a blank DATABASE_URL', (databaseUrl) => {
    expect(() => validateEnvironment({ DATABASE_URL: databaseUrl })).toThrow(
      'DATABASE_URL is required',
    )
  })

  it('rejects an invalid DATABASE_URL', () => {
    expect(() => validateEnvironment({ DATABASE_URL: 'not a URL' })).toThrow(
      'DATABASE_URL must be a valid URL',
    )
  })

  it.each(['http://localhost/ledger', 'mysql://localhost/ledger'])(
    'rejects a non-PostgreSQL DATABASE_URL protocol',
    (databaseUrl) => {
      expect(() => validateEnvironment({ DATABASE_URL: databaseUrl })).toThrow(
        'DATABASE_URL must use postgres:// or postgresql://',
      )
    },
  )

  it.each([
    'postgres:ledger',
    'postgres://',
    'postgresql:///ledger',
    'postgres://localhost',
    'postgresql://localhost/',
  ])('rejects a structurally invalid PostgreSQL DATABASE_URL', (databaseUrl) => {
    expect(() => validateEnvironment({ DATABASE_URL: databaseUrl })).toThrow(
      'DATABASE_URL must be a valid URL',
    )
  })

  it('does not expose the password or complete DATABASE_URL in validation errors', () => {
    const password = 'do-not-leak-this-password'
    const databaseUrl = `mysql://ledger:${password}@db.example.com:3306/ledger`

    let thrown: unknown
    try {
      validateEnvironment({ DATABASE_URL: databaseUrl })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    const message = (thrown as Error).message
    expect(message).not.toContain(password)
    expect(message).not.toContain(databaseUrl)
  })

  it.each([
    'postgres://ledger:secret@localhost:5432/ledger',
    'postgresql://ledger:secret@localhost:5432/ledger?sslmode=require',
    'POSTGRES://localhost/ledger',
    'POSTGRESQL://localhost/ledger',
  ])('returns a valid PostgreSQL DATABASE_URL unchanged', (databaseUrl) => {
    expect(validateEnvironment({ DATABASE_URL: databaseUrl })).toEqual({
      DATABASE_URL: databaseUrl,
    })
  })
})
