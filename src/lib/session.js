// Estado de la sesión: usuario de Firebase + perfil en /users.
import { reactive, computed } from 'vue'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInAnonymously, updatePassword } from 'firebase/auth'
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, LOGIN_DOMAIN } from '../firebase'

export const session = reactive({
  ready: false,
  user: null,      // usuario de Firebase
  profile: null,   // documento /users/{uid}
  org: null
})

let unsubProfile = null
let unsubOrg = null
let resolveReady
export const sessionReady = new Promise(r => { resolveReady = r })

onAuthStateChanged(auth, user => {
  session.user = user
  unsubProfile?.(); unsubOrg?.()
  session.profile = null
  session.org = null
  if (!user || user.isAnonymous) {
    session.ready = true
    resolveReady()
    return
  }
  unsubProfile = onSnapshot(doc(db, 'users', user.uid), snap => {
    session.profile = snap.exists() ? { id: snap.id, ...snap.data() } : null
    const orgId = session.profile?.orgId
    if (orgId && session.org?.id !== orgId) {
      unsubOrg?.()
      unsubOrg = onSnapshot(doc(db, 'orgs', orgId), s => {
        session.org = s.exists() ? { id: s.id, ...s.data() } : null
      }, () => {})
    }
    session.ready = true
    resolveReady()
  }, () => { session.ready = true; resolveReady() })
})

export const role = computed(() => session.profile?.role || null)
export const isSuper = computed(() => role.value === 'super')
export const isOwner = computed(() => role.value === 'owner' || role.value === 'super')

/** Persona que realiza una acción (para registros e historial). */
export function actorFor(raffle) {
  const p = session.profile
  return {
    uid: session.user?.uid,
    mid: p?.mid,
    name: p?.name || '',
    isAdmin: isRaffleAdmin(raffle)
  }
}

export function isRaffleAdmin(raffle) {
  const p = session.profile
  if (!p || !raffle) return false
  if (p.role === 'super') return true
  if (p.role === 'owner' && p.orgId === raffle.orgId) return true
  return p.orgId === raffle.orgId && (raffle.coadmins || []).includes(p.mid)
}
export function isRaffleSeller(raffle) {
  const p = session.profile
  return !!p && !!raffle && p.orgId === raffle.orgId && (raffle.sellers || []).includes(p.mid)
}

export function usernameToKey(u) {
  return String(u || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '')
}

export async function login(username, password) {
  const key = usernameToKey(username)
  if (!key) throw new Error('Escribe tu usuario')
  let email = `${key}@${LOGIN_DOMAIN}`
  try {
    const snap = await getDoc(doc(db, 'usernames', key))
    if (snap.exists()) email = snap.data().email
  } catch { /* si no se puede leer, probamos con el correo por defecto */ }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const p = await getDoc(doc(db, 'users', cred.user.uid))
    if (!p.exists() || p.data().active !== true) {
      await signOut(auth)
      throw new Error('Tu acceso está desactivado. Habla con el administrador.')
    }
    updateDoc(doc(db, 'users', cred.user.uid), { lastLogin: serverTimestamp() }).catch(() => {})
    return p.data()
  } catch (e) {
    if (String(e.code || '').includes('auth/')) throw new Error('Usuario o clave incorrectos')
    throw e
  }
}

export async function logout() { await signOut(auth) }

export async function ensureAnonymous() {
  if (auth.currentUser) return auth.currentUser
  const c = await signInAnonymously(auth)
  return c.user
}

export async function changeMyPassword(newPass) {
  await updatePassword(auth.currentUser, newPass)
  await updateDoc(doc(db, 'users', auth.currentUser.uid), { mustChangePassword: false })
}
