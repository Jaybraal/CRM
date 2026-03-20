import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const app = initializeApp({
  credential: cert({
    projectId:   'crm-f8133',
    clientEmail: 'firebase-adminsdk-fbsvc@crm-f8133.iam.gserviceaccount.com',
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDNfmpH5vOIF43A
KZovVO1kJIjLB3lJrtyPnv20N3j/hKzn2tuK+cl6QhvK0fRK3JU6PwrGbW6rsyCf
uOQ4A7Zhdf7u/wx5GyY28PSaY5ldPKW6Di3+SXyxT+DIQU9WiZDR4jWDvMrNKeOM
FYxmU3JBGfhyVddh3eRSQZtMz40tx1zlHUZYGnDbfOX3Ou/a8cniu5y8M6bg9MyB
IDLchbQbqoNaRkHNuSiNZdfAS2PnxXAgzK0iwovXEvP8H86iz5+BCO2AlOvj75QP
9rIIptEGzuNRMDGTP3h7VKWaZ0k81ipkyurX1ekfxT3DTd63vPvz7vRoTTdPCJcE
Fbkl9ZAXAgMBAAECggEACpqXNb5OBdFKqsZazaN2cTWja2/8yxe/YO064/BS3u3u
lYjzzZrwfHhp17r4KLQeQo2wlXxd0CAOXb+cOI8Ue7iriZNWsO8njIE9lglFXOF9
dHmOglyHbIeV2Vo+vlVF8wFXHUUCOrkKeWw+kk8vClCimJUjvUnxIhTURI/slevn
3Bva8eJED3unhBM+qQH/IYIPriXW5ZoWmbhp7s1IhV5FQVB8EmxCN6se7cvWhG5j
jX6Tvt+55VOAD29PVXqbtcz2MGXjio3qnNtCU7YPde48w0nAnm/fyHdVcU+cgAzK
5Gh4VpH38vc4QsUheazHnxdZ8dktxRp+AoqwpqbzhQKBgQDvUg67xFOmhp4Iq9FD
KX6k7AnMvywAS7Bx2Ls6JSzGgDAjARwOT/nqh73rPST4zjJ9E+zghLL1OvzL2Mz+
VHyfSbqrOMuiZnb98aintTDK8meUIXFKuOaVJQMkZ1LwXatJGYKnZnaBM30YgVdd
jjpL1WA+DHQIT97MvTWHZe6eVQKBgQDb0NK8QVmcqpux04MA0CI5hzBKYI81/GHZ
QL/WCuO/Xof+Je/FOwgUNEK7lFaz87geXw94ojBIRTR+yuRjEEsqElbThM5Z0fD1
sUIUJNOcrsacn82+6Fbgw02JlBiDIx9nSmWdqO/9IT7UgCuM+SUgl40VBHHr+DEW
IwrmI6BIuwKBgEIeD4f8k4e8RUjr/yJpAl4aABMa9dMXFiY91GwZ/SbSH3psQg4K
Nmd/HQ8yk1ZR0U0RBi55Ot/ZbiH7QZc6TDvNqm7JICk72cAK1aePvW00Tz1zh9M3
Bi1KTnXuPdG+byYA8EHDYxYK3ZK5mSN1udFdn/tEgYISXuF9nJ5NoQEJAoGBANkV
43keBPUPHNJC9AbShmpQE6XwtJ55UN0w8APgH0n4fs/FAYXEJddmQV1lQzdXA8ei
0/GsI4jMJ+rsTx9ykPjMwckFSJE2IAVU+NBSClab2PQHcjcO1/YDi0jK5GZmQnZM
6AwLMm/H7HgK2HfR+hO0+BUAnc2QAFI/a10bZAlPAoGBAKeBeQG9AOyfkM2ovL1N
V70hrxDZKP0K/c4U0IqeOIsb/18zG1bw+INvizlWTAsqgehYOOcflxsELNf055bo
VohhF8TVOVhNfT5OF1ClwtAKW9Ln5B/TFhFb6COwoJfec3xQk6wjCwANeGsplvf0
wU6pONUAaUF5miTv7Hy+0eLJ
-----END PRIVATE KEY-----
`,
  }),
})

const db = getFirestore(app)
const snap = await db.collection('organizations').get()

if (snap.empty) {
  console.log('No hay organizaciones en Firestore todavía.')
  console.log('Inicia sesión en el CRM primero para crear una.')
} else {
  console.log('\n──── Organizaciones encontradas ────')
  snap.forEach(doc => {
    const d = doc.data()
    console.log(`\nID:     ${doc.id}`)
    console.log(`Nombre: ${d.name || '(sin nombre)'}`)
    console.log(`Plan:   ${d.plan || '(sin plan)'}`)
  })
  console.log('\n────────────────────────────────────')
  console.log('Copia el ID de tu organización y pégalo en baileys-server/.env como ORG_ID=...\n')
}

process.exit(0)
