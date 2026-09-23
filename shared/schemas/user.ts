import * as v from 'valibot'

export const USER_ROLES = ['admin', 'user'] as const

export type UserRole = (typeof USER_ROLES)[number]

export const UserRoleUpdateSchema = v.object({
  role: v.picklist(USER_ROLES),
})
