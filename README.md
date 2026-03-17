# StackStatus RSS -> Instatus Worker

Worker Cloudflare production-ready care:

- preia feed-ul RSS StackStatus
- parseaza XML fara librarii externe
- traduce continutul in romana
- detecteaza ultimul incident nou cu KV
- trimite incidentul in Instatus
- returneaza JSON sigur, fara exceptii necapturate

## Fisiere

- `src/index.js` - Worker-ul complet
- `wrangler.toml` - configurare Worker, KV si cron

## Ce face Worker-ul

1. Cere RSS-ul de la `https://www.stackstatus.net/history.rss`.
2. Daca feed-ul principal pica, incearca fallback pe `https://www.stackstatus.com/history.rss`.
3. Parseaza manual campurile `title`, `description`, `pubDate`, `link`.
4. Curata HTML-ul din descriere si normalizeaza spatiile.
5. Traduce textul in romana prin reguli pentru status si fraze uzuale.
6. Ia cel mai nou item si il compara cu `STATUS_KV.get("last_incident")`.
7. Daca este nou, il trimite in Instatus si apoi salveaza titlul in KV.
8. Returneaza JSON clar in romana.

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

Cheia folosita de Worker este:

- `last_incident`

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

### 4. Ajusteaza variabilele optionale

In [`wrangler.toml`](/D:/Apps/Status-page-stackstatus/wrangler.toml) poti modifica:

- `RSS_URL`
- `RSS_FALLBACK_URL`
- `TIME_ZONE`
- `MAX_DESCRIPTION_LENGTH`
- `FETCH_TIMEOUT_MS`
- `INSTATUS_NOTIFY`
- `INSTATUS_SHOULD_PUBLISH`

### 5. Adauga cron trigger

Cron-ul este deja definit in [`wrangler.toml`](/D:/Apps/Status-page-stackstatus/wrangler.toml):

```toml
[triggers]
crons = ["*/5 * * * *"]
```

Asta inseamna ca Worker-ul ruleaza la fiecare 5 minute.

Daca vrei alt interval:

- la 1 minut: `* * * * *`
- la 10 minute: `*/10 * * * *`

### 6. Ruleaza local

```powershell
npx wrangler dev --test-scheduled
```

Pentru a testa cron local:

```powershell
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"
```

### 7. Deploy

```powershell
npx wrangler deploy
```

## Variabile folosite

- `STATUS_KV` - binding KV obligatoriu
- `INSTATUS_API_KEY` - secret obligatoriu
- `INSTATUS_PAGE_ID` - obligatoriu
- `RSS_URL` - optional
- `RSS_FALLBACK_URL` - optional
- `TIME_ZONE` - optional
- `MAX_DESCRIPTION_LENGTH` - optional
- `FETCH_TIMEOUT_MS` - optional
- `INSTATUS_NOTIFY` - optional
- `INSTATUS_SHOULD_PUBLISH` - optional

## Observatie importanta despre Instatus

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

## Exemple de raspuns

### Incident procesat

```json
{
  "status": "Incident procesat.",
  "incident": {
    "title": "Investigam rata crescuta de erori pentru Stack Overflow",
    "description": "Investigam rapoartele privind erori intermitente pentru Stack Overflow. Utilizatorii pot intampina probleme la autentificare.",
    "date": "17 martie 2026 la 22:14",
    "link": "https://www.stackstatus.net/incidents/example"
  }
}
```

### Fara incident nou

```json
{
  "status": "Nu exista incident nou.",
  "incident": {
    "title": "Rezolvat - probleme de autentificare pentru Stack Overflow",
    "description": "Problema a fost rezolvata. Va multumim pentru rabdare.",
    "date": "17 martie 2026 la 21:10",
    "link": "https://www.stackstatus.net/incidents/example"
  }
}
```

### RSS invalid sau gol

```json
{
  "status": "Nu au fost gasite elemente RSS valide.",
  "incident": null
}
```

### Configuratie lipsa

```json
{
  "status": "Configuratia Instatus lipseste. Seteaza INSTATUS_API_KEY si INSTATUS_PAGE_ID.",
  "incident": {
    "title": "Investigam probleme de conectivitate",
    "description": "Investigam rapoartele privind probleme de conectivitate.",
    "date": "17 martie 2026 la 20:55",
    "link": "https://www.stackstatus.net/incidents/example"
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
