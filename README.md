# Autobusų tvarkaraščio PWA: diegimo ir naudojimo instrukcija

Šis dokumentas paaiškina, kaip sukonfigūruoti ir įdiegti Next.js pagrindu sukurtą autobusų tvarkaraščių programą.

## Procesas trumpai

Programos paleidimas susideda iš dviejų pagrindinių dalių:
1.  **Konfigūracija**: Vieną kartą atliekami veiksmai, skirti susieti programą su Jūsų „Firebase“ paskyra (duomenų baze, autentifikacija).
2.  **Įdiegimas (Deployment)**: Programos kodo paruošimas ir įkėlimas į hostingo platformą (pvz., Vercel), kad ji būtų pasiekiama internete.

---

## 1. Paruošiamieji darbai (būtina atlikti tik vieną kartą)

Šiuos veiksmus reikia atlikti norint, kad programa naudotų Jūsų asmeninę, o ne kūrimo metu naudotą duomenų bazę.

### A. Firebase projekto sukūrimas

1.  Apsilankykite [Firebase konsolėje](https://console.firebase.google.com/) ir prisijunkite su savo Google paskyra.
2.  Spauskite **„Create a project“** (sukurti projektą).
3.  Sekite instrukcijas, kad sukurtumėte projektą. Galite išjungti „Google Analytics“ šiame etape, jei nenorite jo naudoti.

### B. Reikiamų Firebase paslaugų įjungimas

Jums reikės įjungti dvi pagrindines paslaugas.

#### „Firestore“ duomenų bazė (maršrutams saugoti):
1.  Savo projekto Firebase konsolėje, kairiajame meniu pasirinkite **Build** > **Firestore Database**.
2.  Spauskite **„Create database“**.
3.  Pasirinkite **Start in test mode** (tai leis programai laisvai rašyti ir skaityti duomenis kūrimo metu).
4.  Pasirinkite serverio lokaciją (rekomenduojama `eur3 (europe-west)`).
5.  Spauskite **Enable**.

#### Autentifikacija (administratoriaus prisijungimui):
1.  Kairiajame meniu pasirinkite **Build** > **Authentication**.
2.  Spauskite **„Get started“**.
3.  **Sign-in method** skiltyje pasirinkite **Email/Password** ir įjunkite šį metodą.
4.  **Users** skiltyje spauskite **„Add user“** ir sukurkite vartotoją, kuris bus administratorius (įveskite jo el. paštą ir slaptažodį).

### C. Programos konfigūracijos sukūrimas (.env.local failas)

Šiame žingsnyje sujungsime programos kodą su Jūsų sukurtu Firebase projektu.

1.  Atsidarykite savo projektą kodu ir sukurkite naują failą pagrindinėje direktorijoje pavadinimu `.env.local`.
2.  Į šį failą nukopijuokite visą žemiau esantį turinį:

    ```
    # Client-side (naršyklės) kintamieji
    NEXT_PUBLIC_FIREBASE_API_KEY=<JŪSŲ_API_KEY>
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<JŪSŲ_AUTH_DOMAIN>
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=<JŪSŲ_PROJECT_ID>
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<JŪSŲ_STORAGE_BUCKET>
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<JŪSŲ_MESSAGING_SENDER_ID>
    NEXT_PUBLIC_FIREBASE_APP_ID=<JŪSŲ_APP_ID>

    # Server-side kintamieji (slapti)
    FIREBASE_CLIENT_EMAIL=<JŪSŲ_SERVICE_ACCOUNT_CLIENT_EMAIL>
    FIREBASE_PRIVATE_KEY=<JŪSŲ_SERVICE_ACCOUNT_PRIVATE_KEY>
    ```

3.  Dabar reikia užpildyti `<...>` laukus Jūsų unikaliomis reikšmėmis. Jas rasite Firebase konsolėje.

#### Kur rasti reikšmes?

*   **Client-side kintamieji (vieši):**
    a. Firebase konsolėje, viršuje kairėje spauskite krumpliaratį ir pasirinkite **Project settings**.
    b. **General** skiltyje, apačioje raskite **Your apps** sekciją.
    c. Spauskite **Web app** (`</>`) piktogramą, kad sukurtumėte naują arba pamatytumėte esamą konfigūraciją.
    d. Iššokusiame lange pasirinkite **Config** ir matysite `firebaseConfig` objektą. Nukopijuokite atitinkamas reikšmes (`apiKey`, `authDomain` ir t.t.) į `.env.local` failą.

*   **Server-side kintamieji (slapti):**
    a. Firebase konsolėje, eikite į **Project settings** > **Service accounts**.
    b. Pasirinkite **Firebase Admin SDK** ir **Node.js**.
    c. Spauskite **`Generate new private key`**.
    d. Jums bus atsiųstas JSON failas. Atidarykite jį ir raskite `client_email` ir `private_key` reikšmes.
    e. Nukopijuokite jas į atitinkamus laukus `.env.local` faile. **Svarbu:** `private_key` reikšmę kopijuokite visą, kartu su `-----BEGIN PRIVATE KEY-----` ir `-----END PRIVATE KEY-----\n` dalimis.

Kai baigsite, Jūsų `.env.local` failas atrodys panašiai į pavyzdį, tik su Jūsų unikaliais duomenimis.

---

## 2. Programos įdiegimas į serverį (Deployment)

### Modernus būdas be FTP

Užuot kėlus failus rankiniu būdu per FTP, šiuolaikinės aplikacijos yra diegiamos naudojant **Git pagrįstą procesą**. Tai yra daug paprasčiau, greičiau ir patikimiau.

**Rekomenduojama platforma: [Vercel](https://vercel.com/)**

Vercel yra Next.js kūrėjų platforma, specialiai pritaikyta tokiems projektams. Ji siūlo gausų nemokamą planą.

### Diegimo žingsniai

1.  **Įkelkite kodą į Git repozitoriją**: Jei Jūsų kodas dar nėra Git repozitorijoje (pvz., [GitHub](https://github.com/)), būtinai įkelkite jį. Tai yra būtinas žingsnis automatizuotam diegimui.
2.  **Sukurkite Vercel paskyrą**: Apsilankykite [Vercel](https://vercel.com/) ir užsiregistruokite (patogiausia naudoti savo GitHub, GitLab ar Bitbucket paskyrą).
3.  **Sukurkite naują projektą Vercel**:
    *   Vercel valdymo panelėje spauskite **„Add New...“** > **„Project“**.
    *   Suraskite ir pasirinkite Git repozitoriją, kurioje yra Jūsų programos kodas.
    *   Vercel automatiškai atpažins, kad tai yra Next.js projektas ir pritaikys reikiamus nustatymus.
4.  **Sukonfigūruokite aplinkos kintamuosius (Environment Variables)**:
    *   Projekto nustatymuose raskite **Environment Variables** skiltį.
    *   Jums reikės sukurti visus kintamuosius, kuriuos aprašėte `.env.local` faile. **Vercel aplinkoje `.env.local` failas yra ignoruojamas, todėl kintamuosius būtina suvesti rankiniu būdu į Vercel sąsają.**
    *   Nukopijuokite kiekvieną kintamąjį (pvz., `NEXT_PUBLIC_FIREBASE_API_KEY`) ir jo reikšmę iš savo `.env.local` failo į atitinkamus laukus Vercel platformoje.
5.  **Įdiekite projektą**:
    *   Spauskite **„Deploy“**.
    *   Vercel automatiškai paruoš programą (`npm run build`) ir įdiegs ją. Po kelių minučių Jūsų programa bus pasiekiama unikaliu `.vercel.app` adresu. Vėliau galėsite priskirti ir savo domeną.

Sveikiname! Nuo šiol kiekvieną kartą, kai atliksite pakeitimus kode ir įkelsite juos į savo Git repozitoriją, Vercel automatiškai įdiegs naujausią versiją. Jums daugiau niekada nebereikės naudoti FTP.