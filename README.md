# PWA Autobusų tvarkaraštis — instrukcija (Next.js)

## Trumpai
Ši versija sukurta naudojant Next.js, prideda administravimo panelę ir žemėlapį (Leaflet). Ji siūlo modernią vartotojo sąsają ir patirtį, naudojant ShadCN komponentus ir Tailwind CSS.

## Reikalinga įranga
- Node.js (v18+)
- Firebase paskyra

## 1) Įdiegimas
1.  `npm install`
2.  Susikurk Firebase projektą: https://console.firebase.google.com/
3.  Projekto nustatymuose (`Project settings` -> `General`), rask `Your apps` sekciją ir pridėk naują `Web app`.
4.  Nukopijuok `firebaseConfig` objektą.
5.  Sukurk `.env.local` failą projekto šakninėje direktorijoje.
6.  Pridėk Firebase konfigūracijos raktus į `.env.local` failą, pakeisdamas `<...>` su savo reikšmėmis.

    **Serverio kintamųjų (`FIREBASE_CLIENT_EMAIL` ir `FIREBASE_PRIVATE_KEY`) gavimas:**
    a. Firebase konsolėje, eik į `Project settings` -> `Service accounts`.
    b. Pasirink `Firebase Admin SDK` ir `Node.js`.
    c. Spausk `Generate new private key`.
    d. Atsisiųstame JSON faile rask `client_email` ir `private_key` reikšmes. Nukopijuok jas į atitinkamus laukus `.env.local` faile. `private_key` reikšmę kopijuok su `-----BEGIN PRIVATE KEY-----` ir `-----END PRIVATE KEY-----\n` dalimis.

    ```
    # Client-side variables (from web app config)
    NEXT_PUBLIC_FIREBASE_API_KEY=<YOUR_API_KEY>
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<YOUR_AUTH_DOMAIN>
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=<YOUR_PROJECT_ID>
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<YOUR_STORAGE_BUCKET>
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<YOUR_MESSAGING_SENDER_ID>
    NEXT_PUBLIC_FIREBASE_APP_ID=<YOUR_APP_ID>

    # Server-side variables for Firebase Admin SDK (from service account JSON file)
    FIREBASE_CLIENT_EMAIL=<YOUR_SERVICE_ACCOUNT_CLIENT_EMAIL>
    FIREBASE_PRIVATE_KEY=<YOUR_SERVICE_ACCOUNT_PRIVATE_KEY>
    ```
7.  Firebase konsolėje, eik į `Firestore Database` ir sukurk duomenų bazę. Pradėk `test mode` arba nustatyk atitinkamas saugumo taisykles.
8.  Firebase konsolėje, eik į `Authentication` -> `Sign-in method` ir įjunk `Email/Password` prisijungimo būdą.
9.  `Authentication` -> `Users` skiltyje pridėk naują vartotoją, kuris bus administratorius.

### Firestore struktūra (pavyzdys)

`routes` (collection)
  - `{routeId}` (document)
    - `number`: "10"
    - `name`: "Centras — Stotis"
    - `createdAt`: Timestamp
    - `timetable` (subcollection)
       - `{timetableEntryId}` (document)
          - `stop`: "Stotelė A"
          - `times`: ["08:00","08:30","09:00"]
          - `coords`: [54.6872, 25.2797]  // optional
          - `createdAt`: Timestamp

`roles_admin` (collection)
 - `{userId}` (document)
    - (šis dokumentas yra tuščias, svarbu tik jo egzistavimas)

## 2) Vystymas
`npm run dev` — atidaryti aplikaciją lokaliai. Aplikacija veiks adresu `http://localhost:9002`.

## 3) Build & deploy
`npm run build` — paruošimui deploy.
Deploy: Vercel / Netlify / Firebase Hosting (rekomenduojama HTTPS, kad PWA veiktų pilnai).

```
