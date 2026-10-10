# Verifica dell’implementazione WebMCP

Data: 10 ottobre 2026. Node 24, dipendenze installate con `npm ci`,
Chromium 156.0.8078.4 e Lighthouse 13.5.0.

| Controllo | Risultato |
| --- | --- |
| `npm test -- --maxWorkers=2` | 170 test superati in 20 file |
| `npm run lint` | Nessun errore; rimangono avvisi non bloccanti |
| `npm run format:check` | Superato |
| `npm run build` | Nessun errore, avviso o hint Astro/TypeScript; 187 documenti generati |
| `npm run check:build` | 187 documenti verificati alla radice |
| Playwright Chromium completo | 69 test superati; esclusi il caso riservato al viewport mobile e il caso contatto senza modulo configurato |
| WebMCP, API native e contatti con modulo configurato | 25 test Chromium superati |
| Contatti e accessibilità con modulo configurato | 5 test mobile superati |
| Build e link con `SITE_URL=http://127.0.0.1:4325/xe/` | 187 documenti verificati |
| API native sotto `/xe/` | 3 test superati, inclusa la navigazione nell’origine attiva |
| Lighthouse Agentic Browsing | 94/100; schemi WebMCP validi, strumenti scoperti e albero accessibile validato |

Lighthouse misura CLS 0,133 nell’ultimo passaggio: è la voce che abbassa il
punteggio complessivo. Il passaggio precedente aveva totalizzato 100/100.
L’avviso informativo sul modulo newsletter senza attributi declarativi rimane
coerente con l’invio manuale previsto; non è un errore di schema.

Le prove native non sostituiscono `document.modelContext`: eseguono i nuovi
strumenti, errori strutturati e navigazione. Rimozione e ripristino sono verificati
con eventi `pagehide` e `pageshow.persisted` simulati contro l’API nativa, senza
duplicati. Back/Forward è provato con navigazione reale; nel controllo locale
Chrome ha ricaricato il documento, quindi la conservazione effettiva nella
Back/Forward cache non è stata dimostrata.
L’ispezione manuale del pannello Application → WebMCP non è stata eseguita perché
l’ambiente disponibile è headless.

La prova di mutazione ha invertito temporaneamente il criterio di inserimento
nella pagina: il test sulla paginazione è fallito. Il codice originale è stato
ripristinato prima delle verifiche finali.

## Valutazioni con modello

La suite comprende sei casi e usa **Promptfoo 0.124.1**, con un provider
personalizzato per l’API nativa Ollama. Le assertion deterministiche verificano
schema, strumenti, ordine, argomenti e completamento della conversazione.
I test unitari verificano catalogo, fixture, offset, rapporti, conversazioni,
isolamento dello stato, errori HTTP, annullamento e limiti di generazione.

La CLI reale Promptfoo è stata provata contro un’API Ollama simulata:
sei conversazioni, tredici richieste chat, rapporti JSON e HTML e codice **0**
per le traiettorie corrette. Le prove di mutazione hanno confermato codice **1**
per un argomento incompatibile con lo schema e per una risposta conclusiva
interrotta dal limite di generazione; HTTP 503 produce codice **2** con errori
del provider distinti dalle assertion fallite. Questa integrazione dimostra il
funzionamento del protocollo e del runner, **non** la scelta degli strumenti
con un modello reale.

La prima esecuzione CI con il runner precedente ha verificato installazione
Ollama, download, cache e digest di Qwen3 4B, ma l’inferenza ha raggiunto il timeout
di 15 minuti senza completare casi. Non è stata dichiarata riuscita.
Il profilo Promptfoo disabilita esplicitamente il thinking e limita ogni
richiesta a 1.024 token generati e 120 secondi, mantenendo tutti i prompt,
le fixture e gli otto strumenti della homepage. I limiti raggiunti fanno fallire
il caso, senza accettare risultati parziali. Il primo run Promptfoo
[38058199926](https://github.com/Puppo/xe-website/actions/runs/38058199926) ha
completato sei casi in 11 minuti e 9 secondi: newsletter riuscita, retry del
catalogo non eseguito dal modello e quattro timeout di richiesta. I rapporti
JSON/HTML e i log sono stati caricati e il wrapper ha restituito codice **2**.
Tutti i job del workflow Checks sono riusciti, inclusa la suite browser.

Le trascrizioni mostrano reasoning anche con `think: false`; i log confermano
il template Go. Il template pubblicato usa il testo dell’assistente in
alternativa alle sue chiamate, perdendo queste ultime quando entrambi esistono.
La CI ora imposta `OLLAMA_GO_TEMPLATE=false` per usare il template GGUF originale,
conservando tutti i messaggi e lasciando inalterate fixture e assertion.

L’ispezione dei metadati GGUF ha poi identificato `general.finetune: Thinking`
e `general.name: Qwen3 4B Thinking 2507`: il modello fissato non supporta la
modalità senza thinking. Il secondo run è stato interrotto per evitare di
ripetere la configurazione incompatibile. Il profilo ora seleziona esplicitamente
`qwen3:4b-instruct`, con un nuovo digest del manifest ufficiale; il preflight
rifiuta i modelli con thinking obbligatorio se richiesto `think: false`.
Fixture, schemi, assertion e limiti rimangono gli stessi. Questa correzione
va verificata nel prossimo run; non si dichiara riuscita la qualità del modello
sulla base delle prove simulate.

Riferimenti per il renderer: [configurazione Ollama 0.40.2](https://github.com/ollama/ollama/blob/v0.40.2/envconfig/config.go),
[template del modello](https://ollama.com/library/qwen3:4b/blobs/ae370d884f10),
[modalità Thinking/Instruct Qwen3](https://github.com/QwenLM/Qwen3/blob/main/docs/source/getting_started/quickstart.md).

L’ambiente locale da 4 GB non è stato modificato per ospitare un modello:
nessun server avviato né pesi scaricati. Il comando per una macchina adeguata
è nel [README WebMCP](README.md#valutazioni-con-ollama).
I rapporti generati risiedono nella directory ignorata `.evals/`.
