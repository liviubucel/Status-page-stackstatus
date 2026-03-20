# StackStatus RSS -> Instatus Worker

Worker Cloudflare production-ready care:

- preia surse externe de status in acelasi Worker
- parseaza XML fara librarii externe
- traduce automat continutul in romana cu Workers AI
- detecteaza intrarile noi cu KV, separat pe fiecare sursa
- trimite incidentele in Instatus si actualizeaza acelasi incident cand apar note noi sau rezolvare
- returneaza JSON sigur, fara exceptii necapturate

## Fisiere

- `src/index.js` - Worker-ul complet
- `wrangler.toml` - configurare Worker, KV si cron

## Ce face Worker-ul

1. Poate monitoriza simultan sursa 20i prin `https://www.stackstatus.com/rss` si, optional, o sursa OneUptime precum Upmind.
2. Pentru 20i foloseste RSS/Atom, iar pentru Upmind foloseste API-ul public OneUptime al status page-ului.
3. Parseaza manual atat RSS clasic (`<item>`), cat si Atom (`<entry>`), pentru campurile `title`, `description`, `pubDate` sau `updated`, `link`.
4. Normalizeaza intrarile din fiecare sursa intr-un format comun si le proceseaza separat.
5. Curata HTML-ul din descriere si normalizeaza spatiile.
6. Traduce automat textul in romana prin Workers AI, iar daca binding-ul AI lipseste sau modelul esueaza, foloseste fallback-ul local pe reguli si dictionar.
7. Tine cursoare si stari de incident in KV separat pentru fiecare sursa, ca sa nu se calce intre ele.
8. Coreleaza update-urile `Investigating / Identified / Monitoring / Resolved` pe acelasi incident Instatus.
9. Returneaza JSON clar in romana.

## Deploy si configurare

### 1. Creeaza KV Namespace

Din Cloudflare Dashboard:

1. Intra la `Workers & Pages`.
2. Deschide `KV`.
3. Creeaza un namespace, de exemplu `stackstatus-cache`.
4. Copiaza `Namespace ID`.

Sau cu Wrangler:

```powershell
npx wrangler kv namespace create STATUS_KV
npx wrangler kv namespace create STATUS_KV --preview
```

Dupa aceea, pune valorile reale in [`wrangler.toml`](/D:/Apps/Status-page-stackstatus/wrangler.toml).

### 2. Leaga KV de Worker

Pentru Cloudflare Workers Builds din dashboard, recomandarea practica este:

1. nu tine ID-urile KV placeholder in `wrangler.toml`
2. adauga binding-ul direct in Cloudflare Dashboard la Worker
3. foloseste exact numele de binding `STATUS_KV`

Din Dashboard:

1. `Workers & Pages`
2. Worker-ul tau
3. `Settings`
4. `Bindings`
5. `Add binding`
6. tip `KV Namespace`
7. Variable name: `STATUS_KV`
8. alege namespace-ul real creat anterior

Binding-ul trebuie sa fie exact:

```toml
[[kv_namespaces]]
binding = "STATUS_KV"
id = "ID_REAL_KV"
preview_id = "ID_REAL_KV_PREVIEW"
```

Poti folosi blocul de mai sus doar daca deploy-ezi local cu Wrangler si vrei sa pastrezi binding-ul in fisier. Pentru Connected Builds din Cloudflare, binding-ul din dashboard este de obicei varianta mai sigura.

Cheile folosite de Worker sunt:

- `feed_cursor:20i`
- `incident_state:20i:*`
- `source_current_incident:20i`
- `last_incident` si `last_incident:20i`
- pentru surse suplimentare, acelasi model cu alt prefix, de exemplu `feed_cursor:upmind`

### 3. Seteaza secretele

Seteaza cheia API Instatus:

```powershell
npx wrangler secret put INSTATUS_API_KEY
```

Seteaza ID-ul paginii Instatus:

```powershell
npx wrangler secret put INSTATUS_PAGE_ID
```

Poti lasa `INSTATUS_PAGE_ID` si in `wrangler.toml` ca variabila normala daca preferi, dar pentru un setup curat este mai simplu sa o pastrezi si pe ea ca secret.

Optional, pentru trigger manual securizat:

```powershell
npx wrangler secret put MANUAL_SYNC_TOKEN
```

### 4. Activeaza Workers AI pentru traducere automata

Adauga binding-ul AI in Worker. In acest proiect este deja definit in [`wrangler.toml`](/D:/Apps/Status-page-stackstatus/wrangler.toml):

```toml
[ai]
binding = "AI"
```

Pentru Connected Builds sau daca preferi configurarea din dashboard:

1. `Workers & Pages`
2. Worker-ul tau
3. `Settings`
4. `Bindings`
5. `Add binding`
6. tip `Workers AI`
7. Variable name: `AI`

Modelul folosit implicit este:

- `@cf/meta/m2m100-1.2b`

Worker-ul continua sa functioneze si fara binding-ul AI, dar traducerea va cadea pe fallback-ul local, mai limitat.

### 5. Ajusteaza variabilele optionale

In [`wrangler.toml`](/D:/Apps/Status-page-stackstatus/wrangler.toml) poti modifica:

- `ENABLE_20I_SOURCE`
- `RSS_URL`
- `RSS_FALLBACK_URL`
- `TIME_ZONE`
- `MAX_DESCRIPTION_LENGTH`
- `FETCH_TIMEOUT_MS`
- `PUBLIC_STATUS_URL`
- `HIDE_SOURCE_LINKS`
- `INSTATUS_NOTIFY`
- `INSTATUS_SHOULD_PUBLISH`
- `INSTATUS_COMPONENT_IDS`
- `INSTATUS_COMPONENT_UPDATES_ENABLED`
- `UPMIND_STATUS_PAGE_ID`
- `UPMIND_API_BASE_URL`
- `UPMIND_SOURCE_NAME`
- `UPMIND_SOURCE_URL`
- `UPMIND_PUBLIC_STATUS_URL`
- `UPMIND_HIDE_SOURCE_LINKS`
- `UPMIND_COMPONENT_IDS`
- `UPMIND_COMPONENT_UPDATES_ENABLED`
- `INSTATUS_COMPONENT_STATUS_INVESTIGATING`
- `INSTATUS_COMPONENT_STATUS_IDENTIFIED`
- `INSTATUS_COMPONENT_STATUS_MONITORING`
- `INSTATUS_COMPONENT_STATUS_RESOLVED`
- `AI_TRANSLATION_ENABLED`
- `AI_TRANSLATION_MODEL`
- `AI_SOURCE_LANG`
- `AI_TARGET_LANG`
- `AI_MAX_INPUT_LENGTH`
- `MANUAL_SYNC_TOKEN`

### 6. Adauga cron trigger

Cron-ul este deja definit in [`wrangler.toml`](/D:/Apps/Status-page-stackstatus/wrangler.toml):

```toml
[triggers]
crons = ["*/5 * * * *"]
```

Asta inseamna ca Worker-ul ruleaza la fiecare 5 minute.

Daca vrei alt interval:

- la 1 minut: `* * * * *`
- la 10 minute: `*/10 * * * *`

### 7. Ruleaza local

```powershell
npx wrangler dev --test-scheduled
```

Pentru a testa cron local:

```powershell
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"
```

### 8. Deploy

```powershell
npx wrangler deploy
```

### Trigger manual securizat

URL-ul normal al Worker-ului este acum read-only si nu mai trimite incidente in Instatus. Asta evita spam-ul si erorile `429`.

Pentru a forta manual o sincronizare:

```text
https://worker-ul-tau.workers.dev/?sync=1&token=TOKENUL_TAU
```

Fara `token` corect, Worker-ul doar afiseaza incidentul curent si nu face POST spre Instatus.

### Test manual pentru bannerul de sus

Poti testa fara sa astepti un incident real, folosind acelasi token de manual sync:

```text
https://worker-ul-tau.workers.dev/?sync=1&token=TOKENUL_TAU&diagnostic=1&status=investigating&title=Test%20banner
```

Statusuri acceptate:

- `investigating`
- `identified`
- `monitoring`
- `resolved`

Exemple:

```text
https://worker-ul-tau.workers.dev/?sync=1&token=TOKENUL_TAU&diagnostic=1&status=investigating&title=Test%20banner
https://worker-ul-tau.workers.dev/?sync=1&token=TOKENUL_TAU&diagnostic=1&status=monitoring&title=Test%20banner
https://worker-ul-tau.workers.dev/?sync=1&token=TOKENUL_TAU&diagnostic=1&status=resolved&title=Test%20banner
```

Asta creeaza sau actualizeaza un singur incident de diagnostic in Instatus, separat de sursele externe, ca sa poti verifica daca bannerul general al paginii se schimba.

## Variabile folosite

- `STATUS_KV` - binding KV obligatoriu
- `INSTATUS_API_KEY` - secret obligatoriu
- `INSTATUS_PAGE_ID` - obligatoriu
- `ENABLE_20I_SOURCE` - optional, implicit activ
- `RSS_URL` - optional
- `RSS_FALLBACK_URL` - optional
- `TIME_ZONE` - optional
- `MAX_DESCRIPTION_LENGTH` - optional
- `FETCH_TIMEOUT_MS` - optional
- `PUBLIC_STATUS_URL` - optional, URL-ul public ZebraByte afisat in raspuns
- `HIDE_SOURCE_LINKS` - optional, ascunde linkurile directe catre `stackstatus.com`
- `INSTATUS_NOTIFY` - optional
- `INSTATUS_SHOULD_PUBLISH` - optional
- `INSTATUS_COMPONENT_IDS` - optional, lista de componente afectate de sursa 20i
- `INSTATUS_COMPONENT_UPDATES_ENABLED` - optional, implicit `false`; daca este `false`, Worker-ul creeaza si actualizeaza incidente in Instatus fara sa rescrie statusul componentelor
- `UPMIND_STATUS_PAGE_ID` - optional, activeaza sursa Upmind / OneUptime cand este setat
- `UPMIND_API_BASE_URL` - optional, implicit `https://oneuptime.com`
- `UPMIND_SOURCE_NAME` - optional
- `UPMIND_SOURCE_URL` - optional
- `UPMIND_PUBLIC_STATUS_URL` - optional
- `UPMIND_HIDE_SOURCE_LINKS` - optional
- `UPMIND_COMPONENT_IDS` - optional, lista de componente afectate doar de sursa Upmind
- `UPMIND_COMPONENT_UPDATES_ENABLED` - optional, implicit `false`; controleaza separat daca sursa Upmind are voie sa modifice statusul componentelor din Instatus
- `INSTATUS_COMPONENT_STATUS_INVESTIGATING` - optional
- `INSTATUS_COMPONENT_STATUS_IDENTIFIED` - optional
- `INSTATUS_COMPONENT_STATUS_MONITORING` - optional
- `INSTATUS_COMPONENT_STATUS_RESOLVED` - optional
- `AI` - binding Workers AI recomandat pentru traducere automata
- `AI_TRANSLATION_ENABLED` - optional
- `AI_TRANSLATION_MODEL` - optional
- `AI_SOURCE_LANG` - optional
- `AI_TARGET_LANG` - optional
- `AI_MAX_INPUT_LENGTH` - optional
- `MANUAL_SYNC_TOKEN` - optional, recomandat ca secret

## Observatie importanta despre Instatus

Sursa implicita monitorizata in acest proiect este Stack Status de la 20i, pe `https://www.stackstatus.com/rss`, nu `stackstatus.net` de la Stack Exchange.

Optional, acelasi Worker poate monitoriza si o a doua sursa OneUptime, de exemplu Upmind, cu un alt `component_id` din aceeasi pagina Instatus.

Worker-ul nu citeste incidentele create direct in Instatus si nu incearca sa le reconcilieze. El tine propria stare in KV si doar creeaza sau actualizeaza incidentele pe care le gestioneaza automat din sursele externe.

Worker-ul foloseste endpoint-ul curent de API:

- `POST /v1/{page_id}/incidents`

si trimite status-urile Instatus in formatul cerut de API:

- `INVESTIGATING`
- `IDENTIFIED`
- `MONITORING`
- `RESOLVED`

Intern, maparea ramane:

- `Investigating` -> `Investigam`
- `Identified` -> `Identificat`
- `Monitoring` -> `Monitorizam`
- `Resolved` -> `Rezolvat`

### Componente si culori automate in Instatus

Daca vrei ca bannerul de sus si componentele din pagina Instatus sa nu mai ramana verzi, trebuie sa configurezi componente afectate.

Seteaza in [`wrangler.toml`](/D:/Apps/Status-page-stackstatus/wrangler.toml) sau in dashboard:

```toml
INSTATUS_COMPONENT_IDS = "component_id_1,component_id_2"
```

Pentru o a doua sursa, de exemplu Upmind, folosesti alta variabila:

```toml
UPMIND_COMPONENT_IDS = "component_id_upmind"
```

Worker-ul va trimite automat si statusurile componentelor impreuna cu incidentele:

- `INVESTIGATING` -> `MAJOROUTAGE`
- `IDENTIFIED` -> `PARTIALOUTAGE`
- `MONITORING` -> `DEGRADEDPERFORMANCE`
- `RESOLVED` -> `OPERATIONAL`

Poti schimba maparea prin:

- `INSTATUS_COMPONENT_STATUS_INVESTIGATING`
- `INSTATUS_COMPONENT_STATUS_IDENTIFIED`
- `INSTATUS_COMPONENT_STATUS_MONITORING`
- `INSTATUS_COMPONENT_STATUS_RESOLVED`

Fara `INSTATUS_COMPONENT_IDS`, incidentele 20i apar in lista de incidente, dar statusul general al paginii poate ramane verde.

Fara `UPMIND_COMPONENT_IDS`, sursa Upmind poate crea incidente, dar nu va colora componenta ei dedicata.

## Exemple de raspuns

### Incident procesat

```json
{
  "status": "20i: 1 incident nou creat.",
  "incident": {
    "title": "Investigam rata crescuta de erori pentru Stack Overflow",
    "description": "Investigam rapoartele privind erori intermitente pentru Stack Overflow. Utilizatorii pot intampina probleme la autentificare.",
    "date": "17 martie 2026 la 22:14",
    "link": "https://status.zebrabyte.ro"
  }
}
```

### Fara incident nou

```json
{
  "status": "20i: Nu exista actualizari noi.",
  "incident": {
    "title": "Rezolvat - probleme de autentificare pentru Stack Overflow",
    "description": "Problema a fost rezolvata. Va multumim pentru rabdare.",
    "date": "17 martie 2026 la 21:10",
    "link": "https://status.zebrabyte.ro"
  }
}
```

### RSS invalid sau gol

```json
{
  "status": "20i: Preluarea sursei 20i a esuat.",
  "incident": null
}
```

### Configuratie lipsa

```json
{
  "status": "20i: Configuratia Instatus lipseste. Seteaza INSTATUS_API_KEY si INSTATUS_PAGE_ID.",
  "incident": {
    "title": "Investigam probleme de conectivitate",
    "description": "Investigam rapoartele privind probleme de conectivitate.",
    "date": "17 martie 2026 la 20:55",
    "link": "https://status.zebrabyte.ro"
  }
}
```

## Note de stabilitate

- Toata logica este in `try/catch`.
- Worker-ul nu arunca exceptii necapturate.
- RSS-ul gol, invalid sau blocat returneaza mesaj sigur.
- Instatus nu este apelat daca incidentul este duplicat.
- Titlul este salvat in KV doar dupa un POST Instatus reusit.
- Descrierea este curatata de HTML si limitata ca lungime.
- Daca Workers AI nu este configurat sau esueaza, traducerea cade automat pe fallback-ul local.
- Cererile HTTP normale nu mai publica in Instatus, ceea ce reduce drastic riscul de `429`.
- Daca Instatus raspunde cu `429`, Worker-ul respecta un backoff temporar salvat in KV.
- Worker-ul proceseaza entry-urile noi din feed in ordine si poate face create sau update pe acelasi incident Instatus.
- Daca `PUBLIC_STATUS_URL` este gol si `HIDE_SOURCE_LINKS=true`, raspunsul public nu mai expune `stackstatus.com`.
- Fiecare sursa foloseste propriul cursor KV, propria stare de incident si propriile componente Instatus, deci 20i si Upmind nu se suprascriu reciproc.
