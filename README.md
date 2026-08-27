# MatPreppern

MatPreppern er en rammeverksfri Progressive Web App for oppskrifter, meal prep,
favoritter, ukeplan og handleliste. Prosjektet bruker et eget Supabase-prosjekt
som database, autentisering og bildelagring.

## Funksjoner

- Registrering, e-postbekreftelse, innlogging, utlogging og glemt passord
- Offentlige oppskrifter med egne, delbare URL-er
- Opprette og redigere egne oppskrifter på en egen side, samt arkivere og gjenopprette dem fra Min side
- Valgfritt oppskriftsbilde i Supabase Storage
- Offentlige brukerprofiler med forfatternavn på oppskriftene, uten offentlig e-post
- Favoritter som følger den innloggede brukeren
- Måltidsplan som lagres lokalt og synkroniseres med kontoen
- Rapportering med «Mine rapporter», status, adminsvar og varsler i appen
- Administratorpanel med nye rapporter, behandling og arkiv uten tap av historikk, beskyttet med TOTP-tofaktor
- Egen, tildelbar MatPreppern-adminrolle med databasehåndhevede rettigheter
- Adminstyrt fremheving av oppskrifter
- Egen Community Notes-side med publisering og kladder for administratorer
- Serverbasert, paginert søk i navn, beskrivelse, ingredienser, allergener og kategorier
- Filtrering på kalorier, protein, tid, kategori, kosthold og allergener
- Tastaturnavigasjon, statusmeldinger, synlig fokus, redusert bevegelse og
  semantiske skjemaer/dialoger, samt en tilgjengelig mobilmeny
- Dataeksport og sikker, permanent kontosletting fra Min side
- Personvernerklæring, bruksvilkår og kontaktinformasjon
- Samtykkestyrt Google Analytics og Hotjar/Contentsquare på offentlige sider
- Lokal lesecache, egen offline-side og kontrollert oppdateringsvarsel for PWA-en

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
- `supabase/migration-v4-report-workflow.sql` legger til rapportstatus, adminsvar,
  varsler og arkivering.
- `supabase/migration-v5-launch-hardening.sql` legger til offentlige profiler,
  oppskriftsarkiv, paginert databasesøk og MFA-krav for administratorhandlinger.
- `supabase/migration-v6-mfa-rls-performance.sql` gjør MFA-sjekken effektiv ved
  større datamengder.
- `supabase/migration-v7-account-deletion-integrity.sql` anonymiserer admin-ID-er
  ved kontosletting uten å miste modereringshistorikk.
- `supabase/functions/delete-account` sletter brukerens bilder og Auth-konto på
  serversiden. Service role-nøkkelen leses bare fra Supabase sitt miljø.
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
4. Vurder CAPTCHA og strengere Auth-rate limits dersom tjenesten utsettes for misbruk.
5. Aktiver **Leaked Password Protection** før offentlig lansering, slik at kjente
   kompromitterte passord kan avvises.

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
oppskrifter og opprette, redigere, publisere eller slette Community Notes. Første
gang en admin åpner Min side, må vedkommende sette opp en autentiseringsapp.
Databasen avviser adminhandlinger fra økter som ikke er bekreftet på AAL2-nivå.

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
- Oppskrifter slettes ikke fra Min side; de arkiveres, skjules offentlig og kan
  gjenopprettes. Permanent sletting skjer først ved sikker kontosletting.
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

## Statistikk og samtykke

`js/consent.js` håndterer et eget, tilgjengelig samtykkebanner med versjonert
valg og Google Consent Mode v2. Google Analytics, Google Tag Manager og
Hotjar/Contentsquare lastes ikke før brukeren aktivt godtar statistikk. Det er
like enkelt å avvise som å godta, og valget kan endres fra bunnteksten eller
personvernsiden.

- Google Analytics: `G-13M0W90GNB`
- Google Tag Manager: `GTM-TXG48DXB`
- Contentsquare UXA-tag for Hotjar: `1f63737166e68`

Målingen er begrenset til `index.html`, `recipe.html`,
`community-notes.html` og offentlige `profile.html`. Konto, innlogging,
rapportoversikt, planlegger og oppskriftsredigering spores ikke. URL-parametere
og parametere i henvisende URL fjernes før data sendes til analyseverktøyene.

Google Analytics og Contentsquare lastes direkte fra den lokale
samtykkekontrollen. Ikke opprett en ekstra sidevisningstag for de samme
verktøyene i GTM, fordi det vil gi doble målinger. GTM-containeren er koblet til
etter samtykke og kan senere brukes til gjennomgåtte, ikke-personlige hendelser.
Beskytt Google-kontoen med tofaktor og begrens hvem som kan publisere GTM-tags.

Før produksjonsmåling:

1. Sett GA4-oppbevaring av hendelses- og brukerdata til korteste praktiske
   periode, for eksempel to måneder.
2. Hold Google Signals og annonsepersonalisering avslått.
3. Kontroller maskering og datalagring i Hotjar/Contentsquare.
4. Test i et privat nettleservindu: avvisning skal gi null forespørsler til
   Google/Contentsquare, mens samtykke skal vises i GA4 Realtime og Hotjars
   verktøy for installasjonskontroll.

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
