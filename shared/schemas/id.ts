import * as v from 'valibot'

/**
 * Identifiant d'une ressource (UUID v7 en pratique). La casse d'un UUID ne
 * compte pas ; la base les stocke en minuscules.
 */
export const IdSchema = v.pipe(v.string(), v.uuid(), v.toLowerCase())
