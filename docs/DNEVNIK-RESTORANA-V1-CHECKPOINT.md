# Dnevnik restorana V1 — production checkpoint

## Status checkpointa

- **Datum checkpointa:** 20. 9. 2026.
- **GitHub repository:** `lovran-jpg/evidenceoflife-v2`
- **Produkcijski Vercel deployment:** `https://evidenceoflife-v2.vercel.app`
- **Baseline commit aplikacije:** `58ddb57`
- **Status:** V1 je funkcionalno završen i ručno potvrđen na produkcijskom Vercelu i u iPhone PWA aplikaciji.

Ovaj dokument je referentna točka za završeno V1 stanje. Ne mijenja aplikacijsku logiku, bazu, Supabase, Google Cloud ni Vercel konfiguraciju.

## 1. Funkcionalni opseg V1

Dnevnik restorana V1 podržava:

- Supabase Auth i trajnu korisničku sesiju;
- potpuno privatan i odvojen dnevnik za svakog korisnika;
- namjerno nema zajednički ni family dnevnik;
- dodavanje i uređivanje restorana;
- potpuno brisanje restorana, njegovih posjeta i pripadajućih fotografija;
- više posjeta istom restoranu;
- datum posjeta, podatak „Što sam jeo”, osobnu bilješku/dojam i ocjenu od 1 do 5;
- više fotografija po posjetu;
- client-side optimizaciju fotografija prije uploada;
- dodavanje, zadržavanje, uklanjanje i sigurno brisanje fotografija;
- mjesečni Kalendar s posjetima po datumima;
- Google Maps kartu i Google Places pretragu;
- opcionalnu lokaciju restorana;
- akciju „Prikaži na mapi” koja fokusira restoran po njegovu ID-u;
- hrvatski korisnički UI i hrvatski prikaz datuma bez promjene spremljenog `yyyy-MM-dd` datuma;
- instalaciju kao PWA;
- standalone način na iPhoneu i kompatibilnost s Android PWA instalacijom;
- odjavu iz V1 sučelja.

## 2. Glavne rute

| Ruta | Namjena |
| --- | --- |
| `/` | Glavni ulaz. Prijavljenog korisnika preusmjerava na `/restaurants`, a neprijavljenog na `/auth`. |
| `/auth` | Prijava i postojeći Supabase Auth flow. |
| `/auth/callback` | Povratna ruta postojećeg auth flowa. |
| `/restaurants` | Popis korisnikovih restorana. |
| `/restaurants/new` | Dodavanje restorana. |
| `/restaurants/:restaurantId` | Detalj restorana i njegovi posjeti. |
| `/restaurants/:restaurantId/edit` | Uređivanje restorana i njegove opcionalne lokacije. |
| `/restaurants/:restaurantId/visits/new` | Dodavanje posjeta restoranu. |
| `/restaurants/:restaurantId/visits/:visitId/edit` | Uređivanje postojećeg posjeta i fotografija. |
| `/calendar` | Mjesečni kalendar posjeta. |
| `/map` | Karta restorana koji imaju upotrebljivu lokaciju. |
| `/map?restaurantId=<ID>` | Karta fokusirana na točno određeni Restaurant ID, s otvorenom karticom restorana. |
| `/app` | Privremeni legacy Evidence of Life fallback. Nije dio normalnog V1 korisničkog toka, nije prikazan u V1 navigaciji i još se ne briše. |

Vercelov rewrite svih ruta na `/index.html` omogućuje reload i izravno otvaranje dubokih SPA ruta.

## 3. Arhitektura

### Frontend

- React 18
- TypeScript 5
- Vite 5
- React Router 6
- Tailwind CSS 3 i postojeće shadcn/ui komponente
- vlastiti konzervativni PWA manifest i service worker

### Backend

- Supabase Auth
- Supabase Postgres
- Row Level Security (RLS) i owner-scoped aplikacijski upiti
- owner-aware strani ključevi između roditeljskih i dječjih zapisa
- Supabase Storage za privatne fotografije

### Hosting

- Vercel
- SPA fallback definiran je u `vercel.json`.

### Karte i mjesta

- Google Maps JavaScript API
- Places API (New), preko Places biblioteke u Maps JavaScript SDK-u
- Google Map ID za Advanced Markers

## 4. Podatkovni model

V1 namjerno ponovno koristi postojeći Evidence of Life model:

- tablica `places` predstavlja **Restaurant**;
- tablica `visits` predstavlja **RestaurantVisit**.

### Restaurant (`places`)

| Polje | V1 značenje |
| --- | --- |
| `id` | UUID i jedini aplikacijski identitet restorana. Restorani se ne identificiraju imenom ni Google Place ID-em. |
| `user_id` | Vlasnik zapisa; temelj privatnosti i RLS-a. |
| `name` | Naziv restorana. |
| `category` | Za V1 restoran koristi se kategorija `restaurant`. |
| `address` | Opcionalna adresa koju korisnik sprema. |
| `google_place_id` | Opcionalni trajno spremljeni Google Place ID. |
| `city_id` | Opcionalna veza na postojeći `cities` zapis. |
| `lat`, `lng` | Nullable postojeće ili ručno spremljene koordinate. Google-derived koordinate dohvaćaju se za prikaz karte i ne spremaju se trajno ovim flowom. |
| `created_at` | Vrijeme nastanka zapisa. |

### RestaurantVisit (`visits`)

| Polje | V1 značenje |
| --- | --- |
| `id` | UUID posjeta; koristi se i u kanonskoj putanji novih fotografija. |
| `user_id` | Vlasnik posjeta. |
| `place_id` | ID pripadajućeg restorana. Owner-aware FK zahtijeva istog vlasnika. |
| `date` | Kalendarski datum spremljen kao tekst `yyyy-MM-dd`; UI ga prikazuje na hrvatski način, npr. `20. 9. 2026.`. |
| `what_i_ate` | Opcionalni tekst „Što sam jeo”. |
| `note` | Opcionalna osobna bilješka/dojam. |
| `rating` | Opcionalna cjelobrojna ocjena 1–5, zaštićena DB `CHECK` ograničenjem. |
| `photos` | Niz kanonskih Storage putanja; ne sadrži signed URL-ove. |
| `moment_id` | Nullable legacy veza na `moments`; novi V1 RestaurantVisit ne mora je koristiti. |
| `created_at` | Vrijeme nastanka zapisa. |

## 5. Relevantne Supabase migracije

Sljedeće stvarne migracije čine bazu i transformaciju modela u Dnevnik restorana:

| Migracija | Svrha | Aditivna? |
| --- | --- | --- |
| `20260225021952_c74016bf-d2f5-42f1-a93b-a2adcd05fa7d.sql` | Stvara bucket `moment-photos` te početne upload/read/delete Storage politike. Kasnija hardening migracija bucket čini privatnim. | Da za bucket i politike; početna javna read politika više nije završno V1 stanje. |
| `20260308184934_d8d14cd3-930a-4d90-9053-28a0726a52e8.sql` | Stvara `cities`, `places` i `visits`, njihove početne FK veze te owner RLS politike za CRUD. | Da; stvara nove tablice, veze i politike. |
| `20260730020000_harden_storage_and_calendar_tokens.sql` | Postavlja `moment-photos` na private, uklanja javni read i dodaje owner-only Storage read politiku. | Ne u strogom smislu; sigurnosno mijenja postojeću politiku i privatnost bucketa, bez brisanja korisničkih podataka. |
| `20260919120000_harden_place_visit_ownership.sql` | Provjerava postojeće ownership odnose i dodaje složene owner-aware FK veze i indekse za `city → place`, `place → visit` i `moment → visit`. | Da za constraints/indekse, ali prije primjene namjerno prekida migraciju ako pronađe neusklađene postojeće retke. |
| `20260919180000_add_visit_v1_fields.sql` | Dodaje `what_i_ate`, `rating`, raspon ocjene 1–5 i indeks `visits(user_id, date)`. | Da; nova polja su nullable i postojeći posjeti ostaju valjani. |
| `20260919190000_allow_places_without_location.sql` | Omogućuje restoran samo s imenom tako da `city_id`, `lat` i `lng` postaju nullable. | Nedestruktivna promjena, ali nije strogo aditivna jer mijenja postojeća `NOT NULL` ograničenja. |
| `20260920120000_add_restaurant_address_and_google_place_id.sql` | Dodaje opcionalna polja `address` i `google_place_id`; izričito ne sprema Google-derived koordinate. | Da; oba polja su nullable. |

Izvorne migracije i dalje su jedini autoritativni zapis sheme. Ovaj sažetak ih ne zamjenjuje.

## 6. Fotografije

- Fotografije se spremaju u privatni Supabase Storage bucket `moment-photos`.
- Kanonski format novih RestaurantVisit objekata je:

  ```text
  <userId>/restaurants/<visitId>/<random-uuid>.<ekstenzija>
  ```

- `visits.photos` sprema samo Storage putanju. Signed URL se ne zapisuje u bazu.
- Signed URL služi samo za privremeni prikaz fotografije i trenutačno ima TTL od jednog sata.
- Prije uploada browser smanjuje sliku tako da dulja stranica ima najviše 2000 px.
- Encoder prvo pokušava WebP, zatim JPEG fallback, kroz više razina kvalitete.
- Ciljana veličina optimizirane fotografije je približno 2 MB; konačni upload mora biti do 5 MB. Izvor za client-side obradu može biti do 40 MB.
- U ručno potvrđenom produkcijskom primjeru fotografija od približno 4,1 MB smanjena je na približno 0,7 MB.
- V1 dopušta najviše 10 fotografija po posjetu.
- Fotografiju je moguće ukloniti prije spremanja. Kod uređivanja DB se ažurira prije brisanja stare datoteke kako neuspjeli DB request ne bi uništio postojeću fotografiju.
- Kod brisanja posjeta ili restorana brišu se samo ownership-provjerene kanonske putanje. Djelomični Storage cleanup korisniku se ne prikriva.
- Privatne fotografije i njihovi signed URL-ovi nisu dio PWA runtime cachea.

Detalji sigurnog brisanja nalaze se u `docs/DNEVNIK-RESTORANA-BRISANJE.md`.

## 7. Google Maps i Places konfiguracija

Potrebno je uključiti:

- **Maps JavaScript API**;
- **Places API (New)**;
- JavaScript **Google Map ID**.

Vercel varijable za ovaj dio su:

- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_GOOGLE_MAPS_MAP_ID`

Sigurnosna pravila:

- browser API key mora imati **Websites (HTTP referrers)** restriction;
- produkcijska domena `https://evidenceoflife-v2.vercel.app/*` mora biti izričito dopuštena;
- ne treba dopuštati široki wildcard za sve Vercel preview domene;
- API key mora biti ograničen samo na Maps JavaScript API i Places API (New);
- stvarna vrijednost ključa nikada se ne zapisuje u ovaj dokument, Git ili druge javne datoteke.

Google Place ID može se trajno spremiti. Google-derived naziv, adresa, koordinate i drugi sadržaj moraju se koristiti i spremati samo u skladu s Google Maps Platform pravilima. Aktualni V1 trajno čuva Place ID i korisnikov vlastiti naziv/adresu, dok Google-derived koordinate dohvaća za prikaz karte i drži ih samo u memoriji.

Detaljne operativne upute nalaze se u `docs/DNEVNIK-RESTORANA-GOOGLE.md`.

## 8. Vercel environment varijable

Checkpoint bilježi samo nazive, nikada vrijednosti:

| Varijabla | Uloga u V1 |
| --- | --- |
| `VITE_SUPABASE_URL` | URL Supabase projekta; frontend ga izravno koristi za klijent. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Javni/publishable Supabase ključ; frontend ga izravno koristi uz korisnički JWT i RLS. Nije service-role ključ. |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref naveden u `.env.example` i self-hosting postupku; trenutačni browser client ga ne čita izravno, ali služi za projekt/deployment tooling. |
| `VITE_GOOGLE_MAPS_API_KEY` | Browser-visible, HTTP-referrer i API-restricted Google Maps ključ. |
| `VITE_GOOGLE_MAPS_MAP_ID` | JavaScript Map ID za kartu i Advanced Markers. |

Legacy i opcionalni Evidence of Life moduli imaju dodatne varijable, ali nisu potrebne za osnovni Dnevnik restorana V1 flow i nisu dio ovog popisa. Service-role i drugi server secrets nikada ne pripadaju `VITE_` varijablama.

## 9. Security model

- Svaki korisnik preko RLS-a i owner-scoped upita vidi i mijenja samo svoje `places` restorane.
- Svaki korisnik vidi i mijenja samo svoje `visits` posjete.
- Owner-aware strani ključ `(place_id, user_id) → places(id, user_id)` sprječava vezanje posjeta na restoran drugog korisnika.
- Fotografije su u private bucketu; Storage read dopušten je samo vlasniku mape čiji je prvi segment njegov `auth.uid()`.
- Signed URL je privremen i koristi se samo za prikaz.
- Aplikacija prije rada s fotografijom provjerava kanonsku putanju korisnika, a za RestaurantVisit i pripadnost konkretnom `visitId` direktoriju.
- Brisanje restorana prvo učitava njegov owner-scoped zapis i posjete, zatim uklanja samo kanonske pripadajuće fotografije te briše owner-scoped `places` zapis. Owner-aware `ON DELETE CASCADE` uklanja njegove posjete.
- Brisanje posjeta i fotografija također provjerava vlasnika i pripadnost roditeljskom zapisu.
- Drugi korisnik ne smije čitati, mijenjati ni brisati tuđe restorane, posjete ili fotografije.
- V1 nema shared/family pristup. To je namjerna konačna V1 odluka, a ne nedovršena funkcija.

Klijentske provjere poboljšavaju UX i smanjuju rizik pogrešnog zahtjeva, ali ne zamjenjuju RLS, Storage politike i owner-aware DB constraints.

## 10. PWA checkpoint

Manifest sadrži:

- `name`: `Dnevnik restorana`
- `short_name`: `Dnevnik`
- `start_url`: `/`
- `scope`: `/`
- `display`: `standalone`
- terracotta/cream `theme_color` i `background_color`

Ikone:

- `192×192` standardna ikona;
- `512×512` standardna ikona;
- `512×512` maskable ikona;
- `180×180` Apple touch icon;
- dodatni SVG favicon.

iOS metadata uključuje `viewport-fit=cover`, Apple standalone podršku, naslov `Dnevnik` i `black-translucent` status bar. V1 layout koristi safe-area insetove za notch i Home indicator.

Service worker cacheira samo:

- app shell `/`;
- manifest;
- PWA/Apple ikone;
- same-origin hashed statičke assete ispod `/assets/`.

Namjerno ne cacheira:

- Supabase Auth ili REST odgovore;
- Restaurant/Visit podatke;
- signed URL-ove;
- privatne fotografije;
- Google Maps i Places pozive ili njihove resurse.

Cross-origin zahtjevi potpuno zaobilaze service worker. Navigacija je network-first s fallbackom na spremljeni app shell, a novi worker provjerava se pri svakom svježem otvaranju. V1 nije offline-first CRUD aplikacija: bez mreže ne omogućuje pouzdano stvaranje, uređivanje ni sinkronizaciju privatnih podataka.

## 11. Backup i restore

### Backup prije većih budućih izmjena

1. GitHub repository `lovran-jpg/evidenceoflife-v2` izvor je koda i migracija. Sačuvati potvrđeni commit/tag prije promjena.
2. Prije rizične DB migracije napraviti zaseban SQL dump sheme i podataka, primjerice odgovarajućim Supabase CLI `db dump` postupkom, te provjeriti da je dump čitljiv i pohranjen izvan produkcijskog projekta.
3. Storage datoteke iz `moment-photos` treba backupirati zasebno. Database dump sadrži DB podatke i Storage metadata zapise, ali ne vraća same binarne Storage objekte.
4. Supabase Free plan nema automatske dnevne/scheduled database backupe dostupne kao Pro/Team/Enterprise planovi. Za Free projekt potrebno je redovito ručno izvoziti podatke i čuvati off-site kopiju; vidi službenu dokumentaciju [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).
5. Ne zapisivati produkcijske ključeve, JWT-ove, service-role secrets ni stvarne korisničke podatke u Git ili dokumentaciju.

Postojeće repo upute: `docs/oss/self-hosting.md` opisuje novu instalaciju i primjenu migracija, a `docs/oss/DISPOSABLE_ENV_RUNBOOK.md` opisuje provjeru migracija na lokalnom ili throwaway Supabase okruženju. Prije produkcijske migracije prvo koristiti takvo odvojeno okruženje.

### Recovery scenarij

1. Checkoutati potvrđeni V1 Git commit `58ddb57` ili odgovarajući potvrđeni tag.
2. Kreirati ili odabrati recovery Supabase projekt te vratiti potrebnu shemu/migracije i DB podatke iz provjerenog SQL backupa.
3. Zasebno vratiti stvarne Storage fotografije u private bucket `moment-photos`, uz iste kanonske putanje koje su spremljene u `visits.photos`.
4. Postaviti potrebne Vercel environment varijable za Supabase i Google integraciju, bez zapisivanja vrijednosti u Git.
5. U Google Cloudu potvrditi dopuštenu produkcijsku domenu, ograničeni API key, potrebne API-je i Google Map ID.
6. Deployati potvrđeni kod na Vercel.
7. Napraviti smoke test: login/session, ownership izolacija, Restaurant/Visit CRUD, fotografije i signed URL, Kalendar, Places, Mapa, `/map?restaurantId=...`, brisanje, logout i PWA ponovno pokretanje.

DB restore i Storage restore dva su odvojena postupka. DB dump sam ne vraća Storage fotografije.

## 12. Test stanje checkpointa

Završno potvrđeno stanje nakon Faze 8A:

- **286/286 unit/integration testova prolazi**;
- TypeScript typecheck prolazi;
- production build prolazi;
- full lint: **0 grešaka i 53 postojeća legacy upozorenja**;
- PWA manifest i service-worker provjere prolaze.

Automatizirani E2E nije mogao krenuti u Work okruženju jer Vite web server nije mogao dohvatiti mrežna sučelja (`uv_interface_addresses returned Unknown system error 1`). To je infrastrukturni problem prije izvođenja browser testova, a ne pad aplikacijskog E2E scenarija. Produkcijski flow ručno je testiran na stvarnom iPhoneu.

## 13. Ručno potvrđene produkcijske funkcije

Na produkcijskom Vercelu i u instaliranoj iPhone PWA potvrđeni su:

- login i očuvanje sesije;
- popis, dodavanje, detalj i uređivanje restorana;
- Visit create/read/update/delete;
- dodavanje, prikaz, uklanjanje i brisanje fotografija;
- client-side optimizacija fotografija;
- mjesečni Kalendar;
- Google Places pretraga;
- Google Maps i pinovi;
- fokus Restaurant detail → `/map?restaurantId=...`;
- potpuno brisanje restorana, posjeta i pripadajućih fotografija;
- instalacija na iPhone Home Screen;
- standalone pokretanje bez Safari adresne trake;
- ponovno otvaranje PWA i nastavak postojeće Supabase Auth sesije;
- logout.

## 14. Poznata ograničenja V1

- `/app` i dalje postoji kao direktno dostupan legacy fallback, ali nije u V1 navigaciji ni normalnom korisničkom toku.
- Legacy Evidence of Life source, CalendarView, MapView, Moments, Todos, AI i stare Google integracije još nisu fizički uklonjeni.
- V1 nema offline CRUD, lokalnu bazu, background sync ni konfliktni sync model.
- Nema shared/family dnevnika; svaki korisnik namjerno ima potpuno odvojene podatke.
- Nema zasebnih Storage thumbnail varijanti; prikaz koristi istu optimiziranu fotografiju.
- Legacy fotografije/podaci koji eventualno još postoje nisu nužno automatski prepisani u novi RestaurantVisit kanonski format. Legacy data-image zapis podržan je samo za čitanje, a ne kao novi upload format.
- Lokacija restorana je opcionalna. Restoran bez upotrebljive lokacije ne prikazuje se kao pin dok korisnik ne doda Google Place ID ili valjane koordinate.
- Google Maps/Places i Supabase podaci zahtijevaju mrežu; PWA cache nije zamjena za mrežni backend.

## 15. Pravilo za budući V1.1 razvoj

**Prije svake veće V1.1 promjene koristiti ovaj checkpoint kao baseline i raditi promjene u zasebnim malim fazama/commitima.**

Svaka promjena koja dira podatke, RLS, Storage ili migracije mora imati zaseban backup, provjeru na odvojenom okruženju, testove i jasan recovery plan. Funkcionalne nadogradnje ne smiju neprimjetno vratiti legacy UI u normalni V1 tok niti oslabiti privatnost po korisniku.
