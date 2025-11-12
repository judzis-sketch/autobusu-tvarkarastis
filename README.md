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
    **SVARBU:** Failas turi turėti ir `NEXT_PUBLIC_` kintamuosius (kliento pusei) ir kintamuosius be `NEXT_PUBLIC_` (serverio pusei).

    ```
    # Client-side variables
    NEXT_PUBLIC_FIREBASE_API_KEY=<YOUR_API_KEY>
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<YOUR_AUTH_DOMAIN>
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=<YOUR_PROJECT_ID>
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<YOUR_STORAGE_BUCKET>
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<YOUR_MESSAGING_SENDER_ID>
    NEXT_PUBLIC_FIREBASE_APP_ID=<YOUR_APP_ID>

    # Server-side variables
    FIREBASE_API_KEY=<YOUR_API_KEY>
    FIREBASE_AUTH_DOMAIN=<YOUR_AUTH_DOMAIN>
    FIREBASE_PROJECT_ID=<YOUR_PROJECT_ID>
    FIREBASE_STORAGE_BUCKET=<YOUR_STORAGE_BUCKET>
    FIREBASE_MESSAGING_SENDER_ID=<YOUR_MESSAGING_SENDER_ID>
    FIREBASE_APP_ID=<YOUR_APP_ID>
    ```
7.  Firebase konsolėje, eik į `Firestore Database` ir sukurk duomenų bazę. Pradėk `test mode` arba nustatyk atitinkamas saugumo taisykles.

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

## 2) Vystymas
`npm run dev` — atidaryti aplikaciją lokaliai. Aplikacija veiks adresu `http://localhost:9002`.

## 3) Build & deploy
`npm run build` — paruošimui deploy.
Deploy: Vercel / Netlify / Firebase Hosting (rekomenduojama HTTPS, kad PWA veiktų pilnai).
