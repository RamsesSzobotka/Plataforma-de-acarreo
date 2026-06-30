import React from 'react'

type AuthRole = 'client' | 'driver' | 'admin'

const STORAGE_KEY = '__e2e_auth_role'
const tokenForE2E = async () => 'e2e-token'
const signedOutToken = async () => null
const mockUsers = {
  client: {
    id: 'client-user',
    primaryEmailAddress: { emailAddress: 'client@e2e.test' },
    firstName: 'Carla',
    lastName: 'E2E',
    fullName: 'Carla E2E',
    imageUrl: '',
    publicMetadata: { role: 'client' },
    unsafeMetadata: { role: 'client' },
  },
  driver: {
    id: 'driver-user',
    primaryEmailAddress: { emailAddress: 'driver@e2e.test' },
    firstName: 'Diego',
    lastName: 'E2E',
    fullName: 'Diego E2E',
    imageUrl: '',
    publicMetadata: { role: 'driver' },
    unsafeMetadata: { role: 'driver' },
  },
  admin: {
    id: 'admin-user',
    primaryEmailAddress: { emailAddress: 'admin@e2e.test' },
    firstName: 'Ana',
    lastName: 'E2E',
    fullName: 'Ana E2E',
    imageUrl: '',
    publicMetadata: { role: 'admin' },
    unsafeMetadata: { role: 'admin' },
  },
} as const

function getRole(): AuthRole | null {
  if (typeof window === 'undefined') return null
  const role = window.localStorage.getItem(STORAGE_KEY)
  return role === 'client' || role === 'driver' || role === 'admin' ? role : null
}

function getUserId(role: AuthRole | null) {
  if (role === 'driver') return 'driver-user'
  if (role === 'admin') return 'admin-user'
  if (role === 'client') return 'client-user'
  return null
}

function getMockUser(role: AuthRole | null) {
  if (!role) return null
  return mockUsers[role]
}

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function useAuth() {
  const role = getRole()
  const userId = getUserId(role)

  return {
    isLoaded: true,
    isSignedIn: Boolean(role),
    userId,
    sessionId: role ? 'e2e-session' : null,
    getToken: role ? tokenForE2E : signedOutToken,
    signOut: async () => {
      window.localStorage.removeItem(STORAGE_KEY)
    },
  }
}

export function useUser() {
  const role = getRole()
  const user = getMockUser(role)

  return {
    isLoaded: true,
    isSignedIn: Boolean(role),
    user,
  }
}

function UserButtonRoot() {
  return <button type="button" aria-label="Cuenta E2E">Cuenta E2E</button>
}

UserButtonRoot.MenuItems = function MenuItems({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

UserButtonRoot.Link = function UserButtonLink() {
  return null
}

UserButtonRoot.Action = function UserButtonAction() {
  return null
}

export const UserButton = UserButtonRoot

export function SignIn() {
  return (
    <div aria-label="Inicio de sesion E2E">
      <p>Inicio de sesion simulado para pruebas E2E.</p>
      <button type="button">Continuar con Google</button>
    </div>
  )
}

export function SignInButton({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function SignUpButton({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
