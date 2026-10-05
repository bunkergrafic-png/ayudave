// Gestión de personas: organizadores, vendedores y co-admins.
import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore'
import { db, createLoginAccount, LOGIN_DOMAIN } from '../firebase'
import { usernameToKey } from './session'

export async function usernameTaken(username) {
  const snap = await getDoc(doc(db, 'usernames', usernameToKey(username)))
  return snap.exists()
}

/**
 * Crea una persona con usuario y clave.
 * role: 'member' (vendedor / co-admin) u 'owner' (organizador, solo super admin).
 */
export async function createPerson({ name, username, password, phone = '', orgId, role = 'member' }) {
  const key = usernameToKey(username)
  if (key.length < 3) throw new Error('El usuario debe tener al menos 3 letras o números')
  if (String(password).length < 6) throw new Error('La clave debe tener al menos 6 caracteres')
  if (await usernameTaken(key)) throw new Error(`El usuario "${key}" ya existe. Prueba con otro.`)
  const email = `${key}@${LOGIN_DOMAIN}`
  const uid = await createLoginAccount(email, password)
  const b = writeBatch(db)
  b.set(doc(db, 'users', uid), {
    mid: uid, name: name.trim(), username: key, phone, orgId, role,
    active: true, mustChangePassword: true, createdAt: serverTimestamp()
  })
  b.set(doc(db, 'usernames', key), { uid, email })
  await b.commit()
  return { uid, mid: uid, username: key }
}

/**
 * Nueva clave para una persona: como desde el navegador no se puede cambiar la clave
 * de otra cuenta, se crea una cuenta de acceso nueva con el mismo usuario y la misma
 * identidad (mid), y la anterior queda desactivada.
 */
export async function resetPassword(person, newPassword) {
  if (String(newPassword).length < 6) throw new Error('La clave debe tener al menos 6 caracteres')
  const n = (person.resets || 0) + 1
  const email = `${person.username}.r${n}@${LOGIN_DOMAIN}`
  const uid = await createLoginAccount(email, newPassword)
  const { id, ...data } = person
  const b = writeBatch(db)
  b.set(doc(db, 'users', uid), { ...data, resets: n, active: true, mustChangePassword: true, createdAt: serverTimestamp() })
  b.update(doc(db, 'users', id), { active: false, replacedBy: uid })
  b.set(doc(db, 'usernames', person.username), { uid, email })
  await b.commit()
  return uid
}

export async function setActive(person, active) {
  await updateDoc(doc(db, 'users', person.id), { active })
}

export async function updatePerson(person, data) {
  await updateDoc(doc(db, 'users', person.id), data)
}

/** Personas activas de una organización (una por identidad). */
export async function listOrgPeople(orgId) {
  const snap = await getDocs(query(collection(db, 'users'), where('orgId', '==', orgId)))
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  // Si una persona tuvo cambio de clave, quedarnos con la cuenta vigente.
  return all.filter(p => !p.replacedBy).sort((a, b) => a.name.localeCompare(b.name))
}

export async function createOrg({ name, owner }) {
  const ref = doc(collection(db, 'orgs'))
  await setDoc(ref, { name, ownerUid: null, active: true, createdAt: serverTimestamp(), brand: { color: '#6D28D9' } })
  const person = await createPerson({ ...owner, orgId: ref.id, role: 'owner' })
  await updateDoc(ref, { ownerUid: person.uid })
  return ref.id
}
