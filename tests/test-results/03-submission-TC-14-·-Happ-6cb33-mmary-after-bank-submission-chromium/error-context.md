# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03-submission.spec.js >> TC-14 · Happy path submission – bank transfer >> confirmation receipt appears with correct summary after bank submission
- Location: e2e\03-submission.spec.js:36:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#address')
    - locator resolved to <input type="text" id="address" name="address" autocomplete="off" placeholder="Begynn å skrive adresse..."/>
    - fill("Testgate 1, 1234 Testby")
  - attempting fill action
    2 × waiting for element to be visible, enabled and editable
      - element is not visible
    - retrying fill action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and editable
      - element is not visible
    - retrying fill action
      - waiting 100ms
    49 × waiting for element to be visible, enabled and editable
       - element is not visible
     - retrying fill action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Hopp til hovedinnhold" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - link "Bjørkvang forsamlingslokale Helgøens Vel" [ref=e6] [cursor=pointer]:
        - /url: /
        - img [ref=e8]
        - generic [ref=e15]:
          - generic [ref=e16]: Bjørkvang forsamlingslokale
          - generic [ref=e17]: Helgøens Vel
      - navigation "Hovedmeny" [ref=e18]:
        - list [ref=e19]:
          - listitem [ref=e20]:
            - link "Hjem" [ref=e21] [cursor=pointer]:
              - /url: /
          - listitem [ref=e22]:
            - link "Våre lokaler" [ref=e23] [cursor=pointer]:
              - /url: lokaler
          - listitem [ref=e24]:
            - link "Kalender" [ref=e25] [cursor=pointer]:
              - /url: booking#calendar
          - listitem [ref=e26]:
            - link "Lei lokalet" [ref=e27] [cursor=pointer]:
              - /url: booking
          - listitem [ref=e28]:
            - link "Medlemskap" [ref=e29] [cursor=pointer]:
              - /url: medlemskap
          - listitem [ref=e30]:
            - link "Nyheter" [ref=e31] [cursor=pointer]:
              - /url: nyheter
          - listitem [ref=e32]:
            - link "Støtt oss" [ref=e33] [cursor=pointer]:
              - /url: stott-oss
          - listitem [ref=e34]:
            - link "Kontakt" [ref=e35] [cursor=pointer]:
              - /url: kontakt
  - region "Lei Bjørkvang forsamlingslokale" [ref=e36]:
    - generic [ref=e37]:
      - heading "Lei Bjørkvang forsamlingslokale" [level=1] [ref=e38]
      - paragraph [ref=e39]: Sjekk kalenderen for ledige datoer og send inn forespørsel. Styret svarer innen 2 virkedager.
  - main [ref=e40]:
    - region "Finn ledige datoer" [ref=e41]:
      - generic [ref=e42]:
        - generic [ref=e43]:
          - generic [ref=e44]:
            - heading "Finn ledige datoer" [level=2] [ref=e45]
            - paragraph [ref=e46]: Klikk på en ledig dato for å starte forespørselen.
          - generic [ref=e47]:
            - generic [ref=e48]:
              - generic [ref=e49]:
                - generic [ref=e50]:
                  - button "" [disabled] [ref=e51]:
                    - generic [ref=e52]: 
                  - button "" [ref=e53] [cursor=pointer]:
                    - generic [ref=e54]: 
                - button "today" [disabled] [ref=e55]
              - heading "april 2026" [level=2] [ref=e57]
              - generic [ref=e59]:
                - button "month" [pressed] [ref=e60] [cursor=pointer]
                - button "week" [ref=e61] [cursor=pointer]
                - button "day" [ref=e62] [cursor=pointer]
            - generic "april 2026" [ref=e63]:
              - grid [ref=e65]:
                - rowgroup [ref=e66]:
                  - row "søndag mandag tirsdag onsdag torsdag fredag lørdag" [ref=e70]:
                    - columnheader "søndag" [ref=e71]:
                      - generic "søndag" [ref=e73]: søn.
                    - columnheader "mandag" [ref=e74]:
                      - generic "mandag" [ref=e76]: man.
                    - columnheader "tirsdag" [ref=e77]:
                      - generic "tirsdag" [ref=e79]: tir.
                    - columnheader "onsdag" [ref=e80]:
                      - generic "onsdag" [ref=e82]: ons.
                    - columnheader "torsdag" [ref=e83]:
                      - generic "torsdag" [ref=e85]: tor.
                    - columnheader "fredag" [ref=e86]:
                      - generic "fredag" [ref=e88]: fre.
                    - columnheader "lørdag" [ref=e89]:
                      - generic "lørdag" [ref=e91]: lør.
                - rowgroup [ref=e92]:
                  - generic [ref=e95]:
                    - row "3. april 2026 4. april 2026" [ref=e97]:
                      - gridcell [ref=e98]
                      - gridcell [ref=e101]
                      - gridcell [ref=e104]
                      - gridcell [ref=e107]
                      - gridcell [ref=e110]
                      - gridcell "3. april 2026" [ref=e113]:
                        - generic "3. april 2026" [ref=e116]: "3."
                      - gridcell "4. april 2026" [ref=e118]:
                        - generic "4. april 2026" [ref=e121]: "4."
                    - row "5. april 2026 6. april 2026 7. april 2026 8. april 2026 9. april 2026 10. april 2026 11. april 2026" [ref=e123]:
                      - gridcell "5. april 2026" [ref=e124]:
                        - generic "5. april 2026" [ref=e127]: "5."
                      - gridcell "6. april 2026" [ref=e129]:
                        - generic "6. april 2026" [ref=e132]: "6."
                      - gridcell "7. april 2026" [ref=e134]:
                        - generic "7. april 2026" [ref=e137]: "7."
                      - gridcell "8. april 2026" [ref=e139]:
                        - generic "8. april 2026" [ref=e142]: "8."
                      - gridcell "9. april 2026" [ref=e144]:
                        - generic "9. april 2026" [ref=e147]: "9."
                      - gridcell "10. april 2026" [ref=e149]:
                        - generic "10. april 2026" [ref=e152]: "10."
                      - gridcell "11. april 2026" [ref=e154]:
                        - generic "11. april 2026" [ref=e157]: "11."
                    - row "12. april 2026 13. april 2026 14. april 2026 15. april 2026 16. april 2026 17. april 2026 18. april 2026" [ref=e159]:
                      - gridcell "12. april 2026" [ref=e160]:
                        - generic "12. april 2026" [ref=e163]: "12."
                      - gridcell "13. april 2026" [ref=e165]:
                        - generic "13. april 2026" [ref=e168]: "13."
                      - gridcell "14. april 2026" [ref=e170]:
                        - generic "14. april 2026" [ref=e173]: "14."
                      - gridcell "15. april 2026" [ref=e175]:
                        - generic "15. april 2026" [ref=e178]: "15."
                      - gridcell "16. april 2026" [ref=e180]:
                        - generic "16. april 2026" [ref=e183]: "16."
                      - gridcell "17. april 2026" [ref=e185]:
                        - generic "17. april 2026" [ref=e188]: "17."
                      - gridcell "18. april 2026" [ref=e190]:
                        - generic "18. april 2026" [ref=e193]: "18."
                    - row "19. april 2026 20. april 2026 21. april 2026 22. april 2026 23. april 2026 24. april 2026 25. april 2026" [ref=e195]:
                      - gridcell "19. april 2026" [ref=e196]:
                        - generic "19. april 2026" [ref=e199]: "19."
                      - gridcell "20. april 2026" [ref=e201]:
                        - generic "20. april 2026" [ref=e204]: "20."
                      - gridcell "21. april 2026" [ref=e206]:
                        - generic "21. april 2026" [ref=e209]: "21."
                      - gridcell "22. april 2026" [ref=e211]:
                        - generic "22. april 2026" [ref=e214]: "22."
                      - gridcell "23. april 2026" [ref=e216]:
                        - generic "23. april 2026" [ref=e219]: "23."
                      - gridcell "24. april 2026" [ref=e221]:
                        - generic "24. april 2026" [ref=e224]: "24."
                      - gridcell "25. april 2026" [ref=e226]:
                        - generic "25. april 2026" [ref=e229]: "25."
                    - row "26. april 2026 27. april 2026 28. april 2026 29. april 2026 30. april 2026 1. mai 2026 2. mai 2026" [ref=e231]:
                      - gridcell "26. april 2026" [ref=e232]:
                        - generic "26. april 2026" [ref=e235]: "26."
                      - gridcell "27. april 2026" [ref=e237]:
                        - generic "27. april 2026" [ref=e240]: "27."
                      - gridcell "28. april 2026" [ref=e242]:
                        - generic "28. april 2026" [ref=e245]: "28."
                      - gridcell "29. april 2026" [ref=e247]:
                        - generic "29. april 2026" [ref=e250]: "29."
                      - gridcell "30. april 2026" [ref=e252]:
                        - generic "30. april 2026" [ref=e255]: "30."
                      - gridcell "1. mai 2026" [ref=e257]:
                        - generic "1. mai 2026" [ref=e260]: "1."
                      - gridcell "2. mai 2026" [ref=e262]:
                        - generic "2. mai 2026" [ref=e265]: "2."
                    - row "3. mai 2026 4. mai 2026 5. mai 2026 6. mai 2026 7. mai 2026 8. mai 2026 9. mai 2026" [ref=e267]:
                      - gridcell "3. mai 2026" [ref=e268]:
                        - generic "3. mai 2026" [ref=e271]: "3."
                      - gridcell "4. mai 2026" [ref=e273]:
                        - generic "4. mai 2026" [ref=e276]: "4."
                      - gridcell "5. mai 2026" [ref=e278]:
                        - generic "5. mai 2026" [ref=e281]: "5."
                      - gridcell "6. mai 2026" [ref=e283]:
                        - generic "6. mai 2026" [ref=e286]: "6."
                      - gridcell "7. mai 2026" [ref=e288]:
                        - generic "7. mai 2026" [ref=e291]: "7."
                      - gridcell "8. mai 2026" [ref=e293]:
                        - generic "8. mai 2026" [ref=e296]: "8."
                      - gridcell "9. mai 2026" [ref=e298]:
                        - generic "9. mai 2026" [ref=e301]: "9."
        - complementary "Slik leser du kalenderen" [ref=e303]:
          - heading "Slik leser du kalenderen" [level=3] [ref=e304]
          - list [ref=e305]:
            - listitem [ref=e306]:
              - generic [ref=e308]: Ledig dato
            - listitem [ref=e309]:
              - generic [ref=e311]: Venter bekreftelse
            - listitem [ref=e312]:
              - generic [ref=e314]: Reservert
          - generic [ref=e315]:
            - heading "Spørsmål?" [level=4] [ref=e316]
            - paragraph [ref=e317]: Kontakt styret hvis du trenger hjelp med bookingen eller har spesielle behov.
            - link "Send e-post til styret@bjørkvang.no" [ref=e318] [cursor=pointer]:
              - /url: mailto:styret@bjørkvang.no
              - text: Send e-post
    - region "Send leieforespørsel" [ref=e319]:
      - generic [ref=e320]:
        - generic [ref=e321]:
          - heading "Send leieforespørsel" [level=2] [ref=e322]
          - paragraph [ref=e323]: Fyll ut skjemaet så tar styret kontakt for bekreftelse og signering av leieavtale.
        - generic [ref=e324]:
          - group "Kontaktinformasjon" [ref=e325]:
            - generic [ref=e326]: Kontaktinformasjon
            - generic [ref=e327]:
              - generic [ref=e328]:
                - generic [ref=e329]: Navn *
                - textbox "Navn *" [ref=e330]: Ole Nordmann
              - generic [ref=e331]:
                - generic [ref=e332]: E-post *
                - textbox "E-post *" [ref=e333]: ole@example.com
              - generic [ref=e334]:
                - generic [ref=e335]: Telefon *
                - textbox "Telefon *" [active] [ref=e336]:
                  - /placeholder: +47 000 00 000
                  - text: "91234567"
              - generic [ref=e338]: Adresse
          - group "Når og hva?" [ref=e340]:
            - generic [ref=e341]: Når og hva?
            - generic [ref=e342]:
              - generic [ref=e343]:
                - generic [ref=e344]: Dato *
                - textbox "Dato *" [ref=e345] [cursor=pointer]
              - generic [ref=e346]:
                - generic [ref=e347]: Starttid *
                - textbox "Starttid *" [ref=e348]
              - generic [ref=e349]:
                - generic [ref=e350]: Varighet (timer) *
                - spinbutton "Varighet (timer) *" [ref=e351]: "4"
              - generic [ref=e352]:
                - generic [ref=e353]: Formål med leie *
                - combobox "Formål med leie *" [ref=e354]:
                  - option "Hva skal du bruke lokalet til?" [disabled] [selected]
                  - option "Bursdag, jubileum eller annen familiefeiring"
                  - option "Bryllup"
                  - option "Møte, kurs eller seminar"
                  - option "Konsert, teater eller kulturarrangement"
                  - option "Begravelse, minnestund eller samling"
                  - option "Dugnad eller nærmiljøtreff"
                  - option "Annet"
          - group "Hvilket lokale trenger du? *" [ref=e355]:
            - generic [ref=e356]: Hvilket lokale trenger du? *
            - paragraph [ref=e357]: Velg én pakke. «Hele lokalet» og «Bryllupspakke» dekker begge rom. For bryllup anbefaler vi bryllupspakken.
            - generic [ref=e358]:
              - generic [ref=e359] [cursor=pointer]:
                - checkbox "Peisestue (1 500 kr)" [ref=e360]
                - generic [ref=e361]: Peisestue (1 500 kr)
              - generic [ref=e362] [cursor=pointer]:
                - checkbox "Sal (3 000 kr)" [ref=e363]
                - generic [ref=e364]: Sal (3 000 kr)
              - generic [ref=e365] [cursor=pointer]:
                - checkbox "Hele lokalet (4 000 kr)" [ref=e366]
                - generic [ref=e367]: Hele lokalet (4 000 kr)
              - generic [ref=e368] [cursor=pointer]:
                - checkbox "🎊 Bryllupspakke – fra torsdag kveld (6 000 kr)" [ref=e369]
                - generic [ref=e370]: 🎊 Bryllupspakke – fra torsdag kveld (6 000 kr)
              - generic [ref=e371] [cursor=pointer]:
                - checkbox "Lite møte/minnestund (30 kr/pers, min. 10 pers)" [ref=e372]
                - generic [ref=e373]: Lite møte/minnestund (30 kr/pers, min. 10 pers)
          - group "Tillegg (valgfritt)" [ref=e374]:
            - generic [ref=e375]: Tillegg (valgfritt)
            - generic [ref=e376]:
              - generic [ref=e377] [cursor=pointer]:
                - checkbox "Projektor (500 kr)" [ref=e378]
                - generic [ref=e379]: Projektor (500 kr)
              - generic [ref=e380] [cursor=pointer]:
                - checkbox "Annet teknisk utstyr" [ref=e381]
                - generic [ref=e382]: Annet teknisk utstyr
              - generic [ref=e383] [cursor=pointer]:
                - checkbox "Riggehjelp" [ref=e384]
                - generic [ref=e385]: Riggehjelp
            - paragraph [ref=e386]: Leietaker rydder og vasker selv etter arrangementet. Ved behov for ekstra vask vil dette faktureres i tillegg.
          - generic [ref=e387]:
            - generic [ref=e388]: 🌟
            - paragraph [ref=e389]:
              - text: Medlemmer av Helgøens Vel får
              - strong [ref=e390]: 500 kr rabatt
              - text: på «Hele lokalet» og «Bryllupspakke».
              - link "Bli medlem for 250 kr/år →" [ref=e391] [cursor=pointer]:
                - /url: medlemskap
          - generic [ref=e392]:
            - generic [ref=e393]:
              - generic [ref=e394]: Antall deltakere (ca.)
              - spinbutton "Antall deltakere (ca.)" [ref=e395]
            - generic [ref=e396]:
              - generic [ref=e397]: Tilleggsinformasjon
              - textbox "Tilleggsinformasjon" [ref=e398]:
                - /placeholder: Har du spesielle behov eller spørsmål?
          - group "Catering" [ref=e399]:
            - generic [ref=e400]: Catering
            - generic [ref=e401]:
              - generic [ref=e402]:
                - img "Spekemat fra Næs Mat og Event" [ref=e403]
                - img "Smørbrød fra Næs Mat og Event" [ref=e404]
                - img "Smørbrød fra Næs Mat og Event" [ref=e405]
                - img "Dessert fra Næs Mat og Event" [ref=e406]
              - generic [ref=e407]:
                - paragraph [ref=e408]: Næs Mat og Event
                - paragraph [ref=e409]:
                  - text: Et lokalt cateringselskap som kan hjelpe deg med mat og drikke til arrangementet.
                  - strong [ref=e410]: Næs Mat og Event er et uavhengig selskap og er ikke tilknyttet Bjørkvang eller Helgøens Vel.
                - generic [ref=e411] [cursor=pointer]:
                  - checkbox "Jeg ønsker å bli kontaktet av Næs Mat og Event med tilbud på catering" [ref=e412]
                  - generic [ref=e413]: Jeg ønsker å bli kontaktet av Næs Mat og Event med tilbud på catering
          - group "Betaling" [ref=e414]:
            - generic [ref=e415]: Betaling
            - generic [ref=e416]:
              - paragraph [ref=e417]: "Estimert pris: Velg lokaler"
              - paragraph [ref=e418]:
                - text: ℹ️
                - strong [ref=e419]: Ingen betaling nå.
                - text: Etter at styret har godkjent forespørselen, vil du motta en betalingsforespørsel for 50 % depositum via den metoden du velger nedenfor. Restbeløpet faktureres etter arrangementet.
              - generic [ref=e420]:
                - generic [ref=e421] [cursor=pointer]:
                  - radio "Vipps – du mottar en Vipps-betalingslenke for depositum (50 %) etter godkjenning" [checked] [ref=e422]
                  - generic [ref=e423]:
                    - strong [ref=e424]: Vipps
                    - text: – du mottar en Vipps-betalingslenke for depositum (50 %) etter godkjenning
                - generic [ref=e425] [cursor=pointer]:
                  - radio "Bankinnbetaling – du mottar kontonummer og betalingsinformasjon for depositum (50 %) etter godkjenning" [ref=e426]
                  - generic [ref=e427]:
                    - strong [ref=e428]: Bankinnbetaling
                    - text: – du mottar kontonummer og betalingsinformasjon for depositum (50 %) etter godkjenning
          - generic [ref=e429]:
            - button "Send bookingforespørsel" [ref=e430] [cursor=pointer]
            - status
    - region "Priser og pakker" [ref=e431]:
      - generic [ref=e432]:
        - generic [ref=e433]:
          - heading "Priser og pakker" [level=2] [ref=e434]
          - paragraph [ref=e435]:
            - text: Medlemmer sparer opptil 500 kr per leie.
            - link "Bli medlem for 250 kr/år" [ref=e436] [cursor=pointer]:
              - /url: medlemskap
            - text: .
        - generic [ref=e437]:
          - article [ref=e438]:
            - heading "Peisestue" [level=3] [ref=e439]
            - paragraph [ref=e440]: 1 500 kr
            - paragraph [ref=e441]: Intim stue med peis – ideell for små møter og minnesamvær.
          - article [ref=e442]:
            - heading "Salen" [level=3] [ref=e443]
            - paragraph [ref=e444]: 3 000 kr
            - paragraph [ref=e445]: Romslig sal med scene, god takhøyde og plass til dansegulv.
          - article [ref=e446]:
            - heading "Hele lokalet" [level=3] [ref=e447]
            - paragraph [ref=e448]: 4 000 kr
            - paragraph [ref=e449]: Eksklusiv tilgang til både sal og peisestue. Passer for store arrangementer.
          - article [ref=e450]:
            - heading "Bryllupspakke" [level=3] [ref=e451]
            - paragraph [ref=e452]: 6 000 kr
            - paragraph [ref=e453]: Fra torsdag kveld til søndag. Romslig tid til pynting, feiring og nedrigg.
          - article [ref=e454]:
            - heading "Små møter" [level=3] [ref=e455]
            - paragraph [ref=e456]: 30 kr / pers
            - paragraph [ref=e457]: For små møter og minnesamvær. Gjelder bruk av peisestue/kaffestue.
    - region "Se lokalene" [ref=e458]:
      - generic [ref=e459]:
        - generic [ref=e460]:
          - heading "Se lokalene" [level=2] [ref=e461]
          - paragraph [ref=e462]: Klikk på et rom for å se større bilder og detaljer.
        - list [ref=e463]:
          - listitem [ref=e464] [cursor=pointer]:
            - generic [ref=e465]:
              - img "Storsalen på Bjørkvang" [ref=e466]
              - generic: 7 bilder
            - generic [ref=e467]:
              - heading "Salen" [level=3] [ref=e468]
              - paragraph [ref=e469]: Romslig sal med scene og plass til både langbord og dansegulv. Ca. 100 personer.
          - listitem [ref=e470] [cursor=pointer]:
            - generic [ref=e471]:
              - img "Peisestua på Bjørkvang" [ref=e472]
              - generic: 2 bilder
            - generic [ref=e473]:
              - heading "Peisestua" [level=3] [ref=e474]
              - paragraph [ref=e475]: Intim stue med peis som passer til mindre selskap og møter. Ca. 30–40 personer.
          - listitem [ref=e476] [cursor=pointer]:
            - generic [ref=e477]:
              - img "Kjøkkenet på Bjørkvang" [ref=e478]
              - generic: 4 bilder
            - generic [ref=e479]:
              - heading "Kjøkken" [level=3] [ref=e480]
              - paragraph [ref=e481]: Fullt utstyrt storkjøkken med servise til 100 personer. Inkludert i leien.
  - contentinfo [ref=e482]:
    - generic [ref=e483]:
      - generic [ref=e484]:
        - heading "Bjørkvang forsamlingslokale og Helgøens Vel" [level=2] [ref=e485]
        - paragraph [ref=e486]: Et inkluderende forsamlingshus på Helgøya som rommer møter, feiringer og fellesskap.
      - generic [ref=e487]:
        - heading "Snarveier" [level=2] [ref=e488]
        - list [ref=e489]:
          - listitem [ref=e490]:
            - link "Våre lokaler" [ref=e491] [cursor=pointer]:
              - /url: lokaler
          - listitem [ref=e492]:
            - link "Lei lokalet" [ref=e493] [cursor=pointer]:
              - /url: booking
          - listitem [ref=e494]:
            - link "Medlemskap" [ref=e495] [cursor=pointer]:
              - /url: medlemskap
          - listitem [ref=e496]:
            - link "Nyheter" [ref=e497] [cursor=pointer]:
              - /url: nyheter
          - listitem [ref=e498]:
            - link "Salgsvilkår" [ref=e499] [cursor=pointer]:
              - /url: vilkaar
          - listitem [ref=e500]:
            - button "Kopier lenke til denne siden" [ref=e501] [cursor=pointer]:
              - img [ref=e502]
              - generic [ref=e504]: Del siden
      - generic [ref=e505]:
        - heading "Kontakt" [level=2] [ref=e506]
        - list [ref=e507]:
          - listitem [ref=e508]:
            - link "Send e-post til styret@bjørkvang.no" [ref=e509] [cursor=pointer]:
              - /url: mailto:styret@bjørkvang.no
              - text: styret@bjørkvang.no
          - listitem [ref=e510]:
            - link "Ring +47 480 60 273" [ref=e511] [cursor=pointer]:
              - /url: tel:+4748060273
              - text: +47 480 60 273
          - listitem [ref=e512]: Helgøyvegen 219, 2350 Nes på Hedmarken
    - paragraph [ref=e513]: © 2025 Bjørkvang forsamlingslokale og Helgøens Vel.
```

# Test source

```ts
  1   | // TC-14 to TC-18: Form submission, confirmation receipt and error handling
  2   | const { test, expect } = require('@playwright/test');
  3   | 
  4   | /** Fill the booking form with valid data ready for submission */
  5   | async function fillValidForm(page, { paymentMethod = 'bank' } = {}) {
  6   |   await page.route('**/api/booking/calendar', (route) =>
  7   |     route.fulfill({
  8   |       status: 200,
  9   |       contentType: 'application/json',
  10  |       body: JSON.stringify({ bookings: [] }),
  11  |     })
  12  |   );
  13  | 
  14  |   await page.goto('/booking.html');
  15  |   await page.waitForSelector('#booking-form', { state: 'visible' });
  16  | 
  17  |   await page.locator('#name').fill('Ole Nordmann');
  18  |   await page.locator('#email').fill('ole@example.com');
  19  |   await page.locator('#phone').fill('91234567');
> 20  |   await page.locator('#address').fill('Testgate 1, 1234 Testby');
      |                                  ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  21  |   // Set date via Flatpickr's API to ensure it registers the value
  22  |   await page.evaluate(() => {
  23  |     const el = document.getElementById('date');
  24  |     if (el._flatpickr) el._flatpickr.setDate('2026-09-20', true);
  25  |     else el.value = '2026-09-20';
  26  |   });
  27  |   await page.locator('#time').fill('14:00');
  28  |   await page.locator('#duration').fill('4');
  29  |   await page.locator('#event-type').selectOption('Familiefeiring');
  30  |   await page.locator('input[name="spaces"][value="Peisestue"]').check();
  31  |   await page.locator(`input[name="paymentMethod"][value="${paymentMethod}"]`).check();
  32  | }
  33  | 
  34  | // ─────────────────────────────────────────────────────────────────────────────
  35  | test.describe('TC-14 · Happy path submission – bank transfer', () => {
  36  |   test('confirmation receipt appears with correct summary after bank submission', async ({
  37  |     page,
  38  |   }) => {
  39  |     await fillValidForm(page, { paymentMethod: 'bank' });
  40  | 
  41  |     await page.route('**/api/booking', (route) =>
  42  |       route.fulfill({
  43  |         status: 202,
  44  |         contentType: 'application/json',
  45  |         body: JSON.stringify({ id: 'booking-abc123', status: 'pending', paymentMethod: 'bank' }),
  46  |       })
  47  |     );
  48  | 
  49  |     await page.locator('#submit-btn').click();
  50  | 
  51  |     // Confirmation receipt shown
  52  |     await expect(page.locator('#booking-confirmation')).toBeVisible({ timeout: 8000 });
  53  | 
  54  |     // Form itself is hidden
  55  |     await expect(page.locator('#booking-form')).toBeHidden();
  56  | 
  57  |     // Receipt fields populated
  58  |     await expect(page.locator('#conf-name')).toContainText('Ole Nordmann');
  59  |     await expect(page.locator('#conf-email')).toContainText('ole@example.com');
  60  | 
  61  |     // Payment method label in receipt
  62  |     await expect(page.locator('#conf-payment')).toContainText('Bankinnbetaling');
  63  | 
  64  |     // Reference ID shown
  65  |     await expect(page.locator('#conf-id')).toContainText('booking-abc123');
  66  | 
  67  |     // "Send ny forespørsel" reset button is present and clickable
  68  |     const resetBtn = page.getByRole('button', { name: /Send ny forespørsel/i });
  69  |     await expect(resetBtn).toBeVisible();
  70  |   });
  71  | });
  72  | 
  73  | // ─────────────────────────────────────────────────────────────────────────────
  74  | test.describe('TC-15 · Happy path submission – Vipps', () => {
  75  |   test('confirmation receipt shows Vipps as payment method', async ({ page }) => {
  76  |     await fillValidForm(page, { paymentMethod: 'vipps' });
  77  | 
  78  |     await page.route('**/api/booking', (route) =>
  79  |       route.fulfill({
  80  |         status: 202,
  81  |         contentType: 'application/json',
  82  |         body: JSON.stringify({ id: 'booking-xyz456', status: 'pending', paymentMethod: 'vipps' }),
  83  |       })
  84  |     );
  85  | 
  86  |     await page.locator('#submit-btn').click();
  87  | 
  88  |     await expect(page.locator('#booking-confirmation')).toBeVisible({ timeout: 8000 });
  89  |     await expect(page.locator('#conf-payment')).toContainText('Vipps');
  90  |   });
  91  | 
  92  |   test('success status message appears for Vipps submission', async ({ page }) => {
  93  |     await fillValidForm(page, { paymentMethod: 'vipps' });
  94  | 
  95  |     await page.route('**/api/booking', (route) =>
  96  |       route.fulfill({
  97  |         status: 202,
  98  |         contentType: 'application/json',
  99  |         body: JSON.stringify({ id: 'booking-vipps01', status: 'pending', paymentMethod: 'vipps' }),
  100 |       })
  101 |     );
  102 | 
  103 |     await page.locator('#submit-btn').click();
  104 | 
  105 |     // Confirmation receipt appears (not an error)
  106 |     await expect(page.locator('#booking-confirmation')).toBeVisible({ timeout: 8000 });
  107 |     await expect(page.locator('#booking-status')).not.toHaveClass(/is-error/);
  108 |   });
  109 | });
  110 | 
  111 | // ─────────────────────────────────────────────────────────────────────────────
  112 | test.describe('TC-16 · Double-booking conflict (409)', () => {
  113 |   test('shows unavailable-slot error and keeps form filled', async ({ page }) => {
  114 |     await fillValidForm(page, { paymentMethod: 'bank' });
  115 | 
  116 |     await page.route('**/api/booking', (route) =>
  117 |       route.fulfill({
  118 |         status: 409,
  119 |         contentType: 'application/json',
  120 |         body: JSON.stringify({
```