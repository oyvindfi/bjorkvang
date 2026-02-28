# 🗂 UX Backlog — Bjørkvang

> Opprettet: 2026-02-27  
> Mål: Redusere "bank-følelsen" og gjøre nettsiden varmere og mer fellesskapsorientert.

---

## 🔴 Høy prioritet — Rotårsaker til "bank-følelsen"

### UX-01 · Colour system overhaul
**Problem:** Den nåværende blåfargen (#0e5285) er ugjenkjennelig fra DNB/Nordea-branding. Ren blå-på-hvitt er kjerneproblemet.  
**Forslag:** Varm off-white bakgrunn + havsblå primærfarge + jordnær amber/sand som sterkere aksent brukt mer aktivt.  
**Impact:** 🔴 Høy | **Effort:** Medium  
**Status:** `[x] Fullført`

---

### UX-02 · First impression (hero-seksjonen)
**Problem:** Heroen leser som et B2B-utleieskjema. "Selskapslokale midt i Mjøsa" + to CTA-knapper er transaksjonelt — ikke inviterende.  
**Forslag:** Led med atmosfære og historie: "Et sted for Helgøyas folk", større herobildet, mykere tekst før CTA-er, kanskje en tagline om fellesskap.  
**Impact:** 🔴 Høy | **Effort:** Medium  
**Status:** `[x] Fullført`

---

### UX-03 · Forsidekortet ser ut som et produkt-/prisbilde
**Problem:** "Lei lokalet — Bli medlem — Priser fra 1 500 kr" side om side leser som en banks tjenestebrikker. Det signaliserer transaksjon før fellesskap.  
**Forslag:** Flytt priskortet til bookingsiden. Erstatt med en varm "Om oss"-seksjon, kommende arrangementer, eller et fotokollasj.  
**Impact:** 🔴 Høy | **Effort:** Lav  
**Status:** `[x] Fullført`

---

## 🟡 Medium prioritet — Layout og navigasjonsfølelse

### UX-04 · Navigasjonen har ingen personlighet
**Problem:** 7 flate navigasjonspunkter uten visuell gruppering. En foreningsside bør føles som en oppslagstavle, ikke en SaaS-app.  
**Forslag:** Grupper eller differensier "Lei lokalet" som en primær CTA-knapp i navigasjonen, reduser visuell vekt på resten.  
**Impact:** 🟡 Medium | **Effort:** Lav  
**Status:** `[x] Fullført`

---

### UX-05 · Ingen varme kommer inn på siden ved scrolling
**Problem:** Seksjoner har alle det samme hvite kort + skygge-mønsteret. Det er ingen teksturvariasjon, fotografipauser eller fellesskapsfølelsesinnhold.  
**Forslag:** Alternate seksjonsbakgrunner (varm krem, lett bildebakgrunn), legg til en "Kommende arrangementer"-forhåndsvisning på forsiden.  
**Impact:** 🟡 Medium | **Effort:** Medium  
**Status:** `[x] Fullført`

---

### UX-06 · Logoen føles som et fintech-ikon
**Problem:** En blå sirkel med "BV"-initialer i sans-serif er det alle fintech-startups bruker.  
**Forslag:** Vurder et ikon som fremkaller sted — et enkelt hus, tre eller fjordsilhuett, gjerne som SVG.  
**Impact:** 🟡 Medium | **Effort:** Høy  
**Status:** `[x] Fullført`

---

## 🟢 Lavere prioritet — Tekst og mikrodetaljer

### UX-07 · Knappteksten er transaksjonell
**Problem:** "Se tilgjengelighet" og "Bli medlem" er oppgaveorienterte. For en forening passer mykere alternativer bedre.  
**Forslag:**
- "Se tilgjengelighet" → "Planlegg ditt arrangement"
- "Bli medlem" → "Støtt Bjørkvang"

**Impact:** 🟢 Lav | **Effort:** Lav  
**Status:** `[x] Fullført`

---

### UX-08 · Bunnteksten er kald og teksttett
**Problem:** Mørk footer med små lenker ser ut som en bedriftspersonvern-footer.  
**Forslag:** En forenings-footer kan vise en adresse på kart, et bilde, eller en vennlig avslutningslinje.  
**Impact:** 🟢 Lav | **Effort:** Lav  
**Status:** `[x] Fullført`

---

### UX-09 · Ingen sosialt bevis eller felleskaps-signaler
**Problem:** Ingen bilder fra faktiske arrangementer, ingen "X medlemmer", ingen sitater fra brukere. Et felleskapslokale lever og dør på atmosfæren — nettsiden viser ingen nå.  
**Forslag:** Legg til bilder fra arrangementer, et membercount, eller et sitat fra en fornøyd leietaker.  
**Impact:** 🟢 Lav | **Effort:** Høy  
**Status:** `[ ] Ikke startet`

---

---

# 📋 Backlog fra tilbakemeldingsmøte — 28. februar 2026

---

## 🔴 Høy prioritet

### BK-01 · Hindre dobbelbooking og varsling
**Problem:** Det er ingen serverside-validering som forhindrer overlappende bookinger for samme lokale.  
**Forslag:** Implementer dobbelbookingsjekk i `bookingRequest`-funksjonen. Send varsel til admin ved nye bookingforespørsler som grenser til eksisterende.  
**Impact:** 🔴 Høy | **Effort:** Høy  
**Status:** `[x] Fullført`

---

### BK-02 · Salgsvilkår (Vipps-krav) og leieavtale
**Problem:** Vipps krever publiserte salgsvilkår for å aktivere betalingsløsningen. Leieavtalen må også ferdigstilles.  
**Forslag:** Skriv og publiser salgsvilkår på nettsiden. Ferdigstill leieavtalemalen som sendes ut ved bekreftet booking.  
**Impact:** 🔴 Høy | **Effort:** Medium  
**Status:** `[x] Fullført` *(utkast publisert — beløpsgrenser og frister merket [STYRET] må bekreftes av styret)*

---

### BK-03 · E-post for signering av leieavtale
**Problem:** Det sendes ikke ut signeringse-post til leietaker etter bekreftet booking.  
**Forslag:** Implementer automatisk utsending av leieavtale for signering (e-post med lenke) når en booking godkjennes av admin.  
**Impact:** 🔴 Høy | **Effort:** Høy  
**Status:** `[x] Fullført`

---

## 🟡 Medium prioritet

### BK-04 · Oppdater priser og pakker
**Problem:** Prisene i bookingskjema og på nettsiden er utdaterte og stemmer ikke med vedtatte priser.  
**Forslag:** Oppdater til følgende:
- **Hele lokalet:** 4 000 kr — Eksklusiv tilgang til både sal og peisestue. Passer for store arrangementer.
- **Bryllupspakke:** 6 000 kr — Torsdag til søndag. Inkluderer ekstra tid til pynting og nedrigg.

**Impact:** 🟡 Medium | **Effort:** Lav  
**Status:** `[x] Fullført`

---

### BK-05 · Medlemsrabatt på booking
**Problem:** Betalende medlemmer får ikke den avtalte rabatten ved booking.  
**Forslag:** Legg til et "Er du medlem?"-valg i bookingskjemaet. Ved bekreftelse: trekk 500 kr fra prisen på "Hele lokalet" og "Bryllupspakke".  
**Impact:** 🟡 Medium | **Effort:** Medium  
**Status:** `[x] Fullført`

---

### BK-06 · Vask som tilleggstjeneste
**Problem:** Vask er ikke synlig som en valgfri tilleggstjeneste i bookingflyten.  
**Forslag:** Legg til avkrysningsboks for vask i bookingskjemaet med tilhørende pris. Inkluder i e-postbekreftelse og leieavtale.  
**Impact:** 🟡 Medium | **Effort:** Lav  
**Status:** `[x] Fullført`

---

### BK-07 · Begrens til én booking per lokale om gangen
**Problem:** Det er mulig å booke delvis overlappende lokaler (f.eks. bare peisestue mens sal allerede er booket som del av "Hele lokalet").  
**Forslag:** Implementer logikk som blokkerer overlappende romreservasjoner. Kun ett lokale kan bookes per tidsrom.  
**Impact:** 🟡 Medium | **Effort:** Medium  
**Status:** `[x] Fullført`

---

### BK-08 · Admin kan registrere booking manuelt (telefon-inn)
**Problem:** Når noen ringer og ønsker å booke, finnes det ingen admin-flyt for å registrere bookingen på vegne av leietaker.  
**Forslag:** Legg til et admin-skjema i `admin.html` der styret kan opprette bookinger manuelt med kundens kontaktinfo.  
**Impact:** 🟡 Medium | **Effort:** Medium  
**Status:** `[x] Fullført`

---

### BK-09 · Norsk kalender (locale)
**Problem:** Kalenderen i bookingskjemaet viser ukedager og måneder på engelsk.  
**Forslag:** Sett FullCalendar-locale til `nb` (norsk bokmål) slik at alle datovisninger er på norsk.  
**Impact:** 🟡 Medium | **Effort:** Lav  
**Status:** `[x] Fullført`

---

## 🟢 Lavere prioritet

### BK-10 · Oppdater kontaktsiden og kalendermelding
**Problem:** Kontaktsiden manglet navn på kontaktperson i styret. Kalendermelding var uklar.  
**Forslag:**
- Legg til Trond Bjørnstad som kontaktperson på kontaktsiden (oppdateres videre av styret).
- Legg til informasjonstekst øverst på booking-/kalendervisningen: *«For leieforrespørsler bruker du bookingskjemaet. Kontaktperson i styret oppdateres snart.»*

**Impact:** 🟢 Lav | **Effort:** Lav  
**Status:** `[x] Fullført`

---

### BK-11 · Oppdater branding — navn og fargepalett
**Problem:** Navn og fargevalg gjenspeiler ikke Helgøens Vel-identiteten som ble spesifisert i møtet.  
**Forslag:**
- Fullt navn i footer/om-seksjon: *"Bjørkvang forsamlingslokale — Helgøens Vel"*
- Fargepalett: havsblå som primærfarge (ref. Facebook-siden), varm off-white bakgrunn. Vekk fra "Sparebankfølelsen".

**Impact:** 🟢 Lav | **Effort:** Medium  
**Status:** `[x] Fullført`

---

## Sammendrag

| ID     | Område              | Impact      | Effort | Status         |
|--------|---------------------|-------------|--------|----------------|
| UX-01  | Fargesystem         | 🔴 Høy      | Medium | Fullført       |
| UX-02  | Hero / førsteinntrykk | 🔴 Høy    | Medium | Fullført       |
| UX-03  | Forsidekort         | 🔴 Høy      | Lav    | Fullført       |
| UX-04  | Navigasjon          | 🟡 Medium   | Lav    | Fullført       |
| UX-05  | Seksjonsvariasjon   | 🟡 Medium   | Medium | Fullført       |
| UX-06  | Logo                | 🟡 Medium   | Høy    | Fullført       |
| UX-07  | Knapptekst          | 🟢 Lav      | Lav    | Fullført       |
| UX-08  | Footer              | 🟢 Lav      | Lav    | Fullført       |
| UX-09  | Sosialt bevis       | 🟢 Lav      | Høy    | Ikke startet   |
| BK-01  | Dobbelbooking       | 🔴 Høy      | Høy    | Fullført       |
| BK-02  | Salgsvilkår / leieavtale | 🔴 Høy | Medium | Fullført (utkast)  |
| BK-03  | E-post for signering | 🔴 Høy     | Høy    | Fullført       |
| BK-04  | Priser og pakker    | 🟡 Medium   | Lav    | Fullført       |
| BK-05  | Medlemsrabatt       | 🟡 Medium   | Medium | Fullført       |
| BK-06  | Vask som tillegg    | 🟡 Medium   | Lav    | Fullført       |
| BK-07  | Én booking per lokale | 🟡 Medium | Medium | Fullført       |
| BK-08  | Admin manuell booking | 🟡 Medium | Medium | Fullført       |
| BK-09  | Norsk kalender      | 🟡 Medium   | Lav    | Fullført       |
| BK-10  | Kontaktside         | 🟢 Lav      | Lav    | Fullført       |
| BK-11  | Branding / navn     | 🟢 Lav      | Medium | Fullført       |
| UX-09  | Sosialt bevis       | 🟢 Lav      | Høy    | Ikke startet   |
| FAK-01 | Faktura – admin-UI  | 🔴 Høy      | Medium | Fullført       |
| FAK-02 | Faktura – e-post    | 🔴 Høy      | Medium | Fullført       |
| FAK-03 | Faktura – PDF       | 🟡 Medium   | Høy    | Ikke startet   |
| DEP-01 | Depositum – sporing | 🔴 Høy      | Lav    | Fullført       |
| DEP-02 | Depositum – varsel  | 🟡 Medium   | Medium | Ikke startet   |
| VIP-01 | Vipps – depositum 50% | 🔴 Høy    | Medium | Fullført       |
| VIP-02 | Vipps – obligatorisk | 🔴 Høy     | Lav    | Fullført       |
| VIP-03 | Sluttfaktura – Vipps | 🟡 Medium  | Høy    | Fullført (Alt A) |

---

## 📱 Vipps-flyt — depositum + sluttfaktura

**Overordnet flyt:**
```
Booking-søknad → Vipps 50% depositum → Booking bekreftet →
Arrangement gjennomført → Admin sender sluttfaktura (50%)
```

> Merk: Backend-infrastruktur (Vipps API, token, redirect, callback) er allerede implementert.
> Nåværende flyt tar fullt beløp og betaling er valgfritt. Disse oppgavene justerer det.

### VIP-01 · Endre til 50% depositum ved booking
**Problem:** `vippsInitiateBooking` tar fullt beløp. Korrekt modell er halvparten ved bestilling, resten etter arrangement.  
**Forslag:** Del beregnet totalbeløp på 2 i `vippsInitiateBooking/index.js`. Lagre `totalAmount` og `depositAmount` på booking-objektet i Cosmos. Betalingsbeskrivelsen til Vipps merkes «Depositum – 50%».  
**Impact:** 🔴 Høy | **Effort:** Lav  
**Status:** `[x] Fullført`

---

### VIP-02 · Gjør Vipps-betaling obligatorisk i booking-skjemaet
**Problem:** Brukeren kan nå velge «betal senere» og sende inn forespørsel uten å betale. Booking bør ikke opprettes uten at depositum er bekreftet.  
**Forslag:** Fjern «betal senere»-alternativet i `booking.html`. Booking-knappen starter alltid Vipps-flyten. Booking-objektet opprettes i Cosmos *etter* Vipps bekrefter betaling (allerede tilfellet for Vipps-banen, behold det).  
**Notater:** Telefonbooking via admin er unntaket — admin kan fortsatt opprette uten Vipps.  
**Impact:** 🔴 Høy | **Effort:** Lav  
**Status:** `[x] Fullført`

---

### VIP-03 · Sluttfaktura — resterende 50% etter arrangement
**Problem:** Ingen flyt for å kreve inn restbeløpet etter arrangementet.  
**Forslag (to alternativer, velg ett):**

**Alt A – Bankoverføring (enklest):**  
Admin klikker «Send sluttfaktura» i admin-panelet etter arrangementet. En e-post sendes til leietaker med restbeløp, kontonummer og betalingsfrist 14 dager. Løses med FAK-01/FAK-02.

**Alt B – Vipps eCom charge (mer seamless):**  
Bruk Vipps [ePayment reserve/capture-mønster](https://developer.vippsmobilepay.com/docs/APIs/epayment-api/): reserver fullt beløp ved booking, capture 50% med det samme, capture resterende 50% manuelt fra admin etter arrangement. Krever at Vipps-avtalen støtter delvis capture.

**Anbefaling:** Start med Alt A (banker på eksisterende e-postinfrastruktur). Alt B er mer elegant men mer komplekst og krever at Vipps-avtalen er riktig satt opp.  
**Impact:** 🟡 Medium | **Effort:** Høy (Alt B) / Medium (Alt A)  
**Status:** `[x] Fullført (Alt A — bankoverføring via e-post)`

---

## 💳 Faktura-flyt

### FAK-01 · «Send faktura»-knapp i admin-panelet
**Problem:** Admin har ingen måte å markere at faktura er sendt eller trigge utsendelse. Det skjer manuelt utenfor systemet og spores ikke.  
**Forslag:** Legg til en «Send faktura»-knapp på godkjente/gjennomførte bookinger i admin. Knappen setter status `invoiced` og logger tidspunkt.  
**Impact:** 🔴 Høy | **Effort:** Medium  
**Status:** `[x] Fullført`

---

### FAK-02 · Fakturamail med betalingsinformasjon
**Problem:** Ingen automatisk e-post med fakturainfo sendes til leietaker etter arrangementet.  
**Forslag:** Ved klikk på «Send faktura» sendes en e-post med arrangement, beløp, kontonummer og betalingsfrist (f.eks. 14 dager). Bruker eksisterende Plunk-integrasjon.  
**Avhengigheter:** FAK-01  
**Notater:** Kontonummer / betalingsinfo må legges inn av styret (miljøvariabel eller hardkodes).  
**Impact:** 🔴 Høy | **Effort:** Medium  
**Status:** `[x] Fullført` *(kontonummer 1822.40.12345 og Vipps 104631 satt via miljøvariabler)*

---

### FAK-03 · PDF-faktura
**Problem:** Leietaker kan ha behov for en fakturakvittering for regnskap (lag/forening).  
**Forslag:** Generer en enkel PDF-faktura (via `@react-pdf` eller HTML-til-print) som vedlegges fakturamailen eller kan lastes ned fra admin.  
**Notater:** Kan løses enkelt med en print-vennlig HTML-side tilsvarende leieavtalen, med fakturanummer og betalingsinfo.  
**Impact:** 🟡 Medium | **Effort:** Høy  
**Status:** `[ ] Ikke startet`

---

## 💰 Depositumsflyt

### DEP-01 · Sporing av depositum i admin-panelet
**Problem:** Signeringssiden har checkbox «depositum er betalt», men dette er leietakers egenerklæring og spores ikke i admin. For telefonbooking finnes ingenting.  
**Forslag:** Legg til et lite «Depositum mottatt»-kryss/knapp i admin-kortet for godkjente bookinger. Lagres på bookingen og vises som badge. Admin bekrefter manuelt etter at betalingen er sjekket.  
**Impact:** 🔴 Høy | **Effort:** Lav  
**Status:** `[x] Fullført`

---

### DEP-02 · Automatisk purrevarsel for depositum
**Problem:** Hvis leietaker ikke betaler depositum, er det ingen automatikk som minner dem på det.  
**Forslag:** Dersom depositum ikke er markert som mottatt X dager etter signering (f.eks. 7 dager), sendes en automatisk påminnelse på e-post. Kan utløses av en Azure timer-funksjon eller manuelt fra admin.  
**Avhengigheter:** DEP-01  
**Impact:** 🟡 Medium | **Effort:** Medium  
**Status:** `[ ] Ikke startet`

---

## Anbefalt rekkefølge (etter effort/impact)

1. **DEP-01** — Depositum-sporing i admin: Lav effort, høy verdi, ingen avhengigheter
2. **FAK-01** — «Send faktura»-knapp i admin: Grunnmuren for fakturaflyt
3. **FAK-02** — Fakturamail med betalingsinfo: Direkte verdi for leietaker, bygger på FAK-01
4. **DEP-02** — Purrevarsel depositum: Bygger på DEP-01, krever litt mer infrastruktur
5. **FAK-03** — PDF-faktura: Nice-to-have, høyest effort
