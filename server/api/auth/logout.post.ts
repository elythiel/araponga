import { sendRedirect } from 'h3'

/** La session du provider n'est pas touchée : seule celle d'Araponga se ferme. */
export default defineEventHandler(async (event) => {
  await clearUserSession(event)

  // 303 : le navigateur suit en GET, quelle que soit la méthode d'origine.
  return sendRedirect(event, '/', 303)
})
