# Dnevnik restorana: potpuno brisanje (Faza 6B.2)

Brisanje restorana radi se po aplikacijskom `places.id` i uvijek je ograničeno na prijavljenog korisnika. Prije DB brisanja aplikacija učitava posjete restorana i iz privatnog bucketa `moment-photos` uklanja samo kanonske putanje oblika `userId/restaurants/visitId/...`. Brisanje owner-scoped `places` retka zatim koristi postojeći owner-aware `ON DELETE CASCADE` za njegove posjete.

## Stanje nakon greške

- Ako Storage cleanup vrati grešku, restoran i posjeti se ne brišu. Storage zahtjev je mogao djelomično ukloniti neke datoteke prije prijave greške, pa UI to izričito kaže i korisnik može ponoviti brisanje.
- Ako Storage cleanup uspije, a DB brisanje ne uspije, restoran i posjeti ostaju, ali njihove fotografije više nisu u Storageu. UI izričito opisuje to stanje i korisnik može ponoviti brisanje.
- Nekanonske, legacy, tuđe i putanje drugog posjeta ne šalju se Storage remove pozivu.

Brisanje tuđeg restorana zaustavlja se prije čitanja njegovih posjeta ili pristupa Storageu. Klijentski owner filteri nadopunjuju postojeći RLS i owner-aware strane ključeve; ne zamjenjuju ih.
