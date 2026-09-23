import { and, count, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import type { Database } from '../database/client'
import { users } from '../database/schema'
import type { User } from '../database/schema'

/** Ce que le provider affirme d'une personne, une fois l'`id_token` vérifié. */
export interface OidcIdentity {
  issuer: string
  subject: string
  email: string | null
  name: string | null
}

/**
 * Identité de la session factice d'`AUTH_DEV_BYPASS`. L'émetteur est une URN
 * qu'aucun provider réel ne peut émettre : ce compte ne se confond jamais
 * avec une vraie connexion.
 */
export const DEV_BYPASS_IDENTITY: OidcIdentity = {
  issuer: 'urn:araponga:dev-bypass',
  subject: 'dev',
  email: null,
  name: 'Développement',
}

/**
 * Enregistre une connexion : met à jour le compte `(issuer, subject)` ou le
 * crée. Le tout premier compte d'une instance vierge est `admin`, les
 * suivants `user`.
 *
 * « La table est vide » est évalué dans la transaction qui insère, prise en
 * écriture dès son ouverture (`immediate`) : deux premières connexions
 * simultanées ne peuvent pas lire toutes deux une table vide.
 */
export function recordLogin(db: Database, identity: OidcIdentity, now: number = Date.now()): User {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(users)
      .where(and(eq(users.issuer, identity.issuer), eq(users.subject, identity.subject)))
      .get()

    if (existing) {
      return tx
        .update(users)
        .set({ email: identity.email, name: identity.name, lastLoginAt: now })
        .where(eq(users.id, existing.id))
        .returning()
        .get()
    }

    const { total } = tx.select({ total: count() }).from(users).get() ?? { total: 0 }

    return tx
      .insert(users)
      .values({
        id: uuidv7(),
        ...identity,
        role: total === 0 ? 'admin' : 'user',
        createdAt: now,
        lastLoginAt: now,
      })
      .returning()
      .get()
  }, { behavior: 'immediate' })
}

/**
 * Connexion de la session factice : le compte de développement est remis
 * `admin` à chaque fois, quel que soit le nombre de comptes existants.
 */
export function recordDevBypassLogin(db: Database, now: number = Date.now()): User {
  const user = recordLogin(db, DEV_BYPASS_IDENTITY, now)

  if (user.role === 'admin') {
    return user
  }

  return db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id)).returning().get()
}

export function findUser(db: Database, id: string): User | undefined {
  return db.select().from(users).where(eq(users.id, id)).get()
}
