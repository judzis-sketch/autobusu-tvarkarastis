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

1.  Atsidarykite savo projektą kodu ir sukurkite naują failą **pagrindinėje direktorijoje** (šakniniame aplanke, šalia `package.json` failo) pavadinimu `.env.local`.
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

Užuot kėlus failus rankiniu būdu per FTP, šiuolaikinės aplikacijos yra diegiamos naudojant **Git pagrįstą procesą**. Tai yra daug paprasčiau, greičiau ir patikimiau.

**Rekomenduojama platforma: [Vercel](https://vercel.com/)**

Vercel yra Next.js kūrėjų platforma, specialiai pritaikyta tokiems projektams. Ji siūlo gausų nemokamą planą.

### Diegimo žingsniai

#### A. Kodo įkėlimas į GitHub (būtina atlikti tik vieną kartą)

Kad galėtumėte naudotis Vercel, Jūsų programos kodas turi būti patalpintas Git saugykloje, pavyzdžiui, **GitHub**.

**Jei niekada to nedarėte, sekite šiuos žingsnius:**

1.  **Sukurkite GitHub paskyrą:** Jei dar neturite, užsiregistruokite [github.com](https://github.com).
2.  **Sukurkite naują saugyklą (repository):**
    *   Savo GitHub paskyroje, viršuje dešinėje paspauskite `+` ir pasirinkite **New repository**.
    *   Įveskite pavadinimą (pvz., `autobusu-tvarkarastis`), galite palikti ją **Public** (vieša).
    *   **Nesirinkite** jokių papildomų failų (`README`, `.gitignore`).
    *   Paspauskite **Create repository**.
3.  **Paruoškite projektą ir įkelkite kodą:**
    *   Atsidarykite terminalą (komandinę eilutę) savo kompiuteryje, tame aplanke, kur yra Jūsų projektas.
    *   Įvykdykite šias komandas eilės tvarka (kiekvieną atskirai):

        ```bash
        # Inicializuoja Git Jūsų projekto aplanke
        git init

        # Prideda visus projekto failus įkėlimui
        git add .

        # "Nufotografuoja" dabartinę kodo versiją
        git commit -m "Pirmasis įkėlimas"

        # Susieja Jūsų kompiuteryje esantį projektą su GitHub saugykla
        # Pakeiskite <JŪSŲ_NUORODA> į nuorodą, kurią matote GitHub po saugyklos sukūrimo
        git remote add origin <JŪSŲ_NUORODA>.git

        # Nustato pagrindinę šaką į "main"
        git branch -M main

        # Galiausiai, išsiunčia kodą į GitHub
        git push -u origin main
        ```
    *   Atnaujinę puslapį GitHub, turėtumėte pamatyti visus savo projekto failus.

#### B. Projekto susiejimas su Vercel

1.  **Sukurkite Vercel paskyrą**: Apsilankykite [Vercel](https://vercel.com/) ir užsiregistruokite (patogiausia naudoti savo GitHub paskyrą).
2.  **Sukurkite naują projektą Vercel**:
    *   Vercel valdymo panelėje spauskite **„Add New...“** > **„Project“**.
    *   Suraskite ir **importuokite** Git repozitoriją, kurią ką tik sukūrėte GitHub.
    *   Vercel automatiškai atpažins, kad tai yra Next.js projektas ir pritaikys reikiamus nustatymus.
3.  **Sukonfigūruokite aplinkos kintamuosius (Environment Variables)**:
    *   Projekto nustatymuose raskite **Environment Variables** skiltį.
    *   Jums reikės sukurti visus kintamuosius, kuriuos aprašėte `.env.local` faile. **Vercel aplinkoje `.env.local` failas yra ignoruojamas, todėl kintamuosius būtina suvesti rankiniu būdu į Vercel sąsają.**
    *   Nukopijuokite kiekvieną kintamąjį (pvz., `NEXT_PUBLIC_FIREBASE_API_KEY`) ir jo reikšmę iš savo `.env.local` failo į atitinkamus laukus Vercel platformoje.
4.  **Įdiekite projektą**:
    *   Spauskite **„Deploy“**.
    *   Vercel automatiškai paruoš programą ir įdiegs ją. Po kelių minučių Jūsų programa bus pasiekiama unikaliu `.vercel.app` adresu. Vėliau galėsite priskirti ir savo domeną.

Sveikiname! Nuo šiol kiekvieną kartą, kai atliksite pakeitimus kode ir įkelsite juos į savo GitHub saugyklą (`git push`), Vercel automatiškai įdiegs naujausią versiją. Jums daugiau niekada nebereikės naudoti FTP.

---

### Trikčių diagnostika: Ką daryti, jei `git push` nepavyksta?

Jei vykdant `git push` komandą gaunate klaidą `Authentication failed` arba `Repository not found`, tai beveik visada reiškia vieną iš dviejų dalykų:
1.  Jūsų repozitorija yra privati, o kūrimo aplinka neturi teisių jos pasiekti.
2.  Neteisingai nurodėte repozitorijos nuorodą.

**Sprendimas Nr. 1 (lengviausias): Padarykite repozitoriją viešą (Public).**
*   Eikite į savo GitHub repozitorijos **Settings**.
*   Puslapio apačioje raskite "Danger Zone" ir paspauskite **Change visibility**.
*   Pakeiskite į **Public**.
*   Pabandykite `git push` komandą dar kartą.

**Sprendimas Nr. 2 (jei repozitorija turi būti privati): Naudokite Personal Access Token (PAT).**
Nuo 2021 m. GitHub nebepriima paprasto slaptažodžio per komandinę eilutę. Jums reikia susikurti specialų prieigos raktą (token).

1.  **Sukurkite PAT savo GitHub paskyroje:**
    *   Eikite į **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)**.
    *   Paspauskite **Generate new token (classic)**.
    *   Suteikite jam pavadinimą (pvz., `vercel-deploy`), nustatykite galiojimo laiką (rekomenduojama 30 dienų).
    *   Pažymėkite **`repo`** teisių langelį. Tai leis raktui pasiekti Jūsų repozitorijas.
    *   Paspauskite **Generate token**.
    *   **BŪTINAI** nukopijuokite raktą. Jis bus parodytas tik vieną kartą.

2.  **Panaudokite PAT vykdydami `git push` komandą:**
    *   Kai terminalas paprašys Jūsų slaptažodžio (`Password for 'https://github.com':`), **įklijuokite ne savo slaptažodį, o ką tik nukopijuotą PAT raktą**. Terminale tekstas nebus matomas, bet jis bus įvestas.
    *   Spauskite **Enter**.

Tai turėtų sėkmingai autentifikuoti Jus ir išsiųsti kodą.
