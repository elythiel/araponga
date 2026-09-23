/**
 * Répertoire du volume : base SQLite et médias. `DATA_DIR` est le nom
 * documenté (.env.example, déploiement) ; il doit être relu à l'exécution et
 * pas seulement au build, sinon la même image ne peut pas changer de volume.
 * `NUXT_DATA_DIR` reste possible via runtimeConfig.
 */
export function resolveDataDir(): string {
  return process.env.DATA_DIR ?? useRuntimeConfig().dataDir
}
