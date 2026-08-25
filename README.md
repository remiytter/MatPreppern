# MatPreppern

MatPreppern er en rammeverksfri Progressive Web App for å finne og registrere
meal prep-oppskrifter, planlegge måltider og lage handleliste.

## Dette er på plass

- Oppskrifter hentes fra og lagres i Supabase
- Søk i navn, beskrivelse, ingredienser og kategorier
- Filtrering på kalorier, protein, tid og kategori
- Sortering på dato, navn, kalorier, protein, tid og porsjoner
- Porsjonsskalering, måltidsplan og automatisk handleliste
- Lokal lesecache av oppskrifter når databasen er utilgjengelig
- Tastaturnavigasjon, synlige fokusmarkeringer, statusmeldinger og redusert bevegelse
- Installerbar PWA

De gamle standardoppskriftene og lokal lagring av egendefinerte oppskrifter er
fjernet. `localStorage` brukes fortsatt til måltidsplan, avkrysset handleliste og
en frakoblet kopi av oppskrifter som allerede er hentet fra Supabase.

## Supabase-prosjekt

Prosjektet er koblet til det separate Supabase-prosjektet `MatPreppern` i
EU-regionen `eu-central-1`. Databaseskjemaet ligger i
[`supabase/schema.sql`](supabase/schema.sql), og den aktive publishable key-en
ligger i `js/supabase-config.js`.

Start frontendprosjektet med Live Server eller en annen lokal webserver.
ES-moduler fungerer ikke når HTML-filen åpnes direkte fra filsystemet.

Publishable key er laget for bruk i nettleseren. Ikke legg inn secret key eller
`service_role`-nøkkel i frontend-koden. Databasetilgangen begrenses av RLS og
egne `GRANT`-rettigheter i skjemaet: besøkende kan lese og sende inn oppskrifter,
men kan ikke endre eller slette dem.

## Tester

Krever Node.js 22 eller nyere.

```bash
npm test
```

## Teknologi

- HTML5
- CSS3
- JavaScript-moduler
- Supabase/Postgres med Row Level Security
- Service Worker og Web App Manifest
