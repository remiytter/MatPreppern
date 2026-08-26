# MatPreppern

MatPreppern er en rammeverksfri Progressive Web App for oppskrifter, meal prep,
favoritter, ukeplan og handleliste. Prosjektet bruker et eget Supabase-prosjekt
som database, autentisering og bildelagring.

## Funksjoner

- Registrering, e-postbekreftelse, innlogging, utlogging og glemt passord
- Offentlige oppskrifter med egne, delbare URL-er
- Opprette, redigere og slette egne oppskrifter
- Valgfritt oppskriftsbilde i Supabase Storage
- Favoritter som følger den innloggede brukeren
- Måltidsplan som lagres lokalt og synkroniseres med kontoen
- Rapportering og et administratorpanel for moderering
- Egen, tildelbar MatPreppern-adminrolle med databasehåndhevede rettigheter
- Adminstyrt fremheving av oppskrifter
- Egen Community Notes-side med publisering og kladder for administratorer
- Søk i navn, beskrivelse, ingredienser, allergener og kategorier
- Filtrering på kalorier, protein, tid, kategori, kosthold og allergener
- Tastaturnavigasjon, statusmeldinger, synlig fokus, redusert bevegelse og
  semantiske skjemaer/dialoger
- Lokal lesecache for offentlige oppskrifter ved nettverksfeil

## Starte prosjektet

Bruk Live Server eller en annen lokal HTTP-server. ES-moduler og
autentiseringsflyten fungerer ikke når HTML-filene åpnes direkte med `file://`.

```bash
npx serve .
```

Åpne deretter adressen som vises i terminalen.

## Supabase

Prosjektet er koblet til Supabase-prosjektet `MatPreppern` i `eu-central-1`.
Den aktive prosjekt-URL-en og publishable key-en ligger i
`js/supabase-config.js`. En publishable key er beregnet på bruk i nettleseren;
tilgangen begrenses av Postgres-rettigheter og Row Level Security.

- `supabase/schema.sql` er komplett skjema for et nytt prosjekt.
- `supabase/migration-v2.sql` viser migreringen fra den første anonyme versjonen.
- `supabase/migration-v3-admin-content.sql` legger til fremheving og Community Notes.
- Storage-bucketen `recipe-images` er offentlig for visning, men opplasting og
  sletting krever innlogging og riktig eier.

### Auth-innstillinger før publisering

I Supabase Dashboard, åpne **Authentication → URL Configuration**:

1. Sett **Site URL** til den publiserte nettadressen.
2. Legg til lokal utviklingsadresse og produksjonsadresse under tillatte
   redirect-URL-er, inkludert `account.html`.
3. Konfigurer egen SMTP-leverandør før eksterne brukere inviteres. Supabase sin
   innebygde e-posttjeneste er bare beregnet på utprøving og kan være begrenset
   til prosjektteamets adresser.
4. Vurder CAPTCHA og strengere Auth-rate limits før offentlig lansering.

### Opprette første administrator

Opprett først en vanlig konto i MatPreppern og bekreft e-postadressen. Kjør
deretter dette én gang i Supabase SQL Editor med din egen e-postadresse:

```sql
insert into public.admins (user_id)
select id
from auth.users
where email = 'din-epost@eksempel.no'
on conflict (user_id) do nothing;
```

Administratorstatusen ligger i `public.admins`. Den hentes aldri fra
`user_metadata`, fordi brukeren kan endre slike metadata selv.

Rollen kan fjernes igjen med:

```sql
delete from public.admins
where user_id = (
  select id from auth.users where email = 'din-epost@eksempel.no'
);
```

MatPreppern-adminer kan behandle rapporter, skjule oppskrifter, fremheve
oppskrifter og opprette, redigere, publisere eller slette Community Notes.

## Sikkerhetsmodell

- MatPreppern mottar eller lagrer aldri passord i egne tabeller. Supabase Auth
  håndterer registrering, verifisering, passordhashing og sesjoner.
- `service_role`, secret key og databasepassord skal aldri ligge i frontend,
  GitHub-repositoriet eller `supabase-config.js`.
- Anonyme brukere kan bare lese publiserte oppskrifter og modereringsstatus.
- Alle kan lese hvilke synlige oppskrifter som er fremhevet og publiserte
  Community Notes. Kladdene er bare synlige for MatPreppern-adminer.
- Innloggede brukere kan bare endre oppskrifter, favoritter, planer og bilder de
  selv eier. Dette håndheves i databasen med RLS, ikke bare i grensesnittet.
- Brukeren kan ikke endre `user_id`, `is_published` eller opprettelsestid gjennom
  Data API-et.
- Bilder er begrenset til JPEG, PNG og WebP, maksimalt 5 MB og en mappe som
  matcher brukerens ID.
- En Content Security Policy begrenser skript, nettverkskall og bilder til
  prosjektets egne kilder og den versjonslåste Supabase-klienten.
- Alt brukerinnhold HTML-escapes før det vises.

Nettlesersesjonen må lagres lokalt for at brukeren skal forbli innlogget. En
XSS-sårbarhet kan derfor stjele en aktiv sesjon selv om passordet aldri er
tilgjengelig. Unngå usikre tredjepartsskript, hold Supabase-klienten oppdatert,
og kjør sikkerhetskontroller jevnlig.

## Tester

Krever Node.js 22 eller nyere.

```bash
npm test
```

Testene kontrollerer blant annet datanormalisering, filtrering, HTML-escaping,
tilgjengelighetsmekanismer og at skjemaet ikke gir anonyme skriverettigheter.

## Teknologi

- HTML5 og CSS3
- JavaScript-moduler
- Supabase Auth, Postgres, Row Level Security og Storage
- Service Worker og Web App Manifest
