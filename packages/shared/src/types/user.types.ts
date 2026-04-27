export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: UserRole
  organizationId: string
  createdAt: string
  updatedAt: string
}
