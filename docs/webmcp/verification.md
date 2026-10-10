# Verifica dell’implementazione WebMCP

Data: 10 ottobre 2026. Node 24, dipendenze installate con `npm ci`,
Chromium 156.0.8078.4 e Lighthouse 13.5.0.

| Controllo | Risultato |
| --- | --- |
| `npm test -- --maxWorkers=2` | 162 test superati in 19 file |
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

La suite locale comprende sei casi e usa `webmcp-evals@0.0.4` tramite il backend
SDK compatibile con l’API chat di Ollama. Le prove iniziali sui quattro casi
originali hanno incontrato `ECONNREFUSED 127.0.0.1:11434`. Il nuovo comando
`npm run eval:webmcp:ollama` ha confermato l’assenza del server e termina con
codice **2**, senza avviare inferenza o scaricare modelli.

Otto test deterministici verificano catalogo, fixture, offset e controllo del
rapporto, inclusi errori del provider, selezioni errate e risultati incompleti.
Una prova di integrazione con un’API Ollama simulata ha esercitato il wrapper e
la CLI reale: sei conversazioni, tredici richieste chat, rapporti JSON e HTML,
e codice zero per le traiettorie simulate corrette. Questa prova dimostra il
funzionamento del protocollo e del runner, **non** la scelta degli strumenti
con un modello reale.

L’inferenza resta **non eseguita**: non sono disponibili misure di consumo,
durata o qualità della selezione. L’ambiente da 4 GB non è stato modificato per
ospitare un modello. Il comando per una macchina adeguata è nel
[README WebMCP](README.md#valutazioni-con-ollama).
I rapporti generati risiedono nella directory ignorata `.evals/`.

Il workflow CI installa Ollama nel runner e verifica versione, checksum,
RAM disponibile e digest dei pesi. È stato controllato staticamente; la sua
esecuzione con un modello reale parte sulle PR che modificano WebMCP,
comprese le draft, dopo la pubblicazione del commit. Non è stata dichiarata
riuscita una valutazione con modello.
