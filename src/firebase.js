import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut, inMemoryPersistence, setPersistence } from 'firebase/auth'
import { initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

export const firebaseConfig = {
  apiKey: 'AIzaSyDR-rysbz67t3BS_ehHnhmxUy4xvqq6y9I',
  authDomain: 'ayudave-81546.firebaseapp.com',
  projectId: 'ayudave-81546',
  storageBucket: 'ayudave-81546.firebasestorage.app',
  messagingSenderId: '1058881723804',
  appId: '1:1058881723804:web:f1424bf34c8756ff877c59'
}

// En desarrollo/pruebas: VITE_EMULATOR=1 conecta con los emuladores locales.
export const USE_EMULATOR = import.meta.env.VITE_EMULATOR === '1'
const config = USE_EMULATOR ? { ...firebaseConfig, projectId: 'demo-rifalo' } : firebaseConfig

export const app = initializeApp(config)
export const auth = getAuth(app)
export const db = initializeFirestore(app, USE_EMULATOR ? {} : {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
})

if (USE_EMULATOR) {
  const host = location.hostname
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
}

// Dominio interno: los usuarios inician sesión con "usuario" y clave.
export const LOGIN_DOMAIN = 'rifalo.app'

/**
 * Crea una cuenta de acceso sin cerrar la sesión del admin actual,
 * usando una instancia secundaria de Firebase.
 */
export async function createLoginAccount(email, password) {
  const secondary = initializeApp(config, 'secondary-' + Date.now())
  try {
    const sAuth = getAuth(secondary)
    await setPersistence(sAuth, inMemoryPersistence)
    if (USE_EMULATOR) connectAuthEmulator(sAuth, `http://${location.hostname}:9099`, { disableWarnings: true })
    const cred = await createUserWithEmailAndPassword(sAuth, email, password)
    const newUid = cred.user.uid
    await signOut(sAuth)
    return newUid
  } finally {
    await deleteApp(secondary)
  }
}
