# Dnevnik restorana: Google Maps i Places (Faza 6B)

Google je opcionalan. Restoran se i dalje može spremiti samo s imenom. Aplikacijski identitet ostaje `places.id`; odabir Google rezultata ne spaja zapise istog imena.

## Baza

Prije objave primijeniti `supabase/migrations/20260920120000_add_restaurant_address_and_google_place_id.sql` na Supabase projekt. Migracija dodaje samo nullable `places.address` i `places.google_place_id`. Stari redci, `places.city_id`, `lat`, `lng` i `visits` ostaju nepromijenjeni. Kopiju sheme/podataka provjeriti prije primjene prema postojećem backup postupku projekta. Nakon primjene provjeriti da oba polja postoje i da postojeći restorani i posjeti ostaju čitljivi.

Google Place ID se može trajno spremiti. Naziv i adresu dobivene iz Placesa prikazujemo samo tijekom odabira. Trajno se spremaju isključivo naziv i adresa koje korisnik sam unese. Koordinate Google rezultata dohvaćaju se tek pri prikazu karte i čuvaju samo u memoriji; `places.lat` i `places.lng` ostaju za postojeće ili ručno unesene koordinate. Time se izbjegava trajno spremanje Google Places sadržaja. Odabir Google rezultata zato **ne popunjava trajni naziv, adresu i koordinate automatski**.

## Google Cloud — ručna konfiguracija

1. Otvoriti [Google Cloud Console](https://console.cloud.google.com/), izabrati ili kreirati projekt i povezati billing račun u **Billing**. Prije uključivanja provjeriti cijene i besplatne pragove za vlastiti billing račun.
2. U **APIs & Services → Library** pronaći i uključiti **Maps JavaScript API** i **Places API (New)**.
3. U **Google Maps Platform → Map Management → Create Map ID** stvoriti Map ID za **JavaScript** kartu. Zabilježiti ID.
4. U **APIs & Services → Credentials → Create credentials → API key** stvoriti novi browser ključ. U **Application restrictions** odabrati **Websites (HTTP referrers)** i dodati točne domene koje će koristiti aplikaciju, npr. `https://evidenceoflife-v2.vercel.app/*` i eventualnu vlastitu domenu. Za lokalni razvoj dodati `http://localhost:8080/*` ili koristiti poseban razvojni ključ. Ne dopustiti široko `*.vercel.app`.
5. U **API restrictions** odabrati **Restrict key** i dopustiti samo **Maps JavaScript API** i **Places API (New)**. Spremiti ograničenja i provjeriti da karta i pretraga rade na dopuštenoj domeni, a ne rade na drugoj.
6. U **APIs & Services → Enabled APIs & services → [svaki API] → Quotas** postaviti razumne dnevne i minutne granice za početni promet; posebno paziti na Autocomplete i Place Details pozive. U **Billing → Budgets & alerts** postaviti niski početni budžet i upozorenja. Budžet upozorava, ali sam po sebi ne zaustavlja trošak; kvote služe za ograničenje poziva.

## Vercel i lokalni razvoj

U **Vercel → projekt evidenceoflife-v2 → Settings → Environment Variables** dodati:

| Varijabla | Vrijednost |
| --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | Ograničeni browser API key iz Google Clouda |
| `VITE_GOOGLE_MAPS_MAP_ID` | JavaScript Map ID |

Odabrati **Production** (i **Preview** samo uz posebno dopuštene preview domene), spremiti te pokrenuti novi deployment. Vite ugrađuje `VITE_` vrijednosti u browser bundle: ključ nije tajna, zato su referrer/API ograničenja i kvote obavezni. Ne upisivati stvarni ključ u Git ni u `.env.example`. Lokalno ga staviti u netrackirani `.env.local`.

Prije uključivanja Google funkcije na javnoj domeni objaviti javno dostupne Uvjete korištenja i Politiku privatnosti koji uključuju poveznice na Googleove uvjete i politiku privatnosti. Postojeći `PRIVACY.md` u repozitoriju nije gotova javna politika. Provjeriti i primjenjive [EEA uvjete](https://cloud.google.com/terms/maps-platform/eea) za billing adresu u EGP-u.

## Ručna provjera

- Kreirati restoran samo s imenom; trebao bi se spremiti bez Googlea i bez pina.
- U pretrazi odabrati Google prijedlog: prikazati privremeni Google naziv/adresu, a spremiti vlastiti naziv/adresu i Place ID. Na `/map` očekivati pin nakon dohvaćanja lokacije.
- Urediti restoran i potvrditi da isti `places.id` ostaje; dva restorana istog imena imaju odvojene pinove i detalje.
- Kliknuti pin i otvoriti ispravan detalj restorana. Provjeriti broj i zadnji datum posjeta.
- Prijaviti drugog korisnika i potvrditi da ne vidi prve restorane ni na karti.

Google dokumentacija: [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview), [Place Autocomplete Data API](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data), [Google Maps policies](https://developers.google.com/maps/documentation/javascript/policies), [API key security](https://developers.google.com/maps/api-security-best-practices), [cost controls](https://developers.google.com/maps/billing-and-pricing/manage-costs).
