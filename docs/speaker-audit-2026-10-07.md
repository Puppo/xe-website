# Verifica degli speaker dell’archivio — 7 ottobre 2026

Sono stati confrontati tutti i 120 eventi con le rispettive fonti legacy. Sette eventi avevano sessioni mancanti: cinque agende Sessionize, un elenco esplicito di ospiti e l’agenda esterna di Blazor Conf 2026 verificata direttamente. Sono state ripristinate le associazioni e creati quindici profili di speaker, senza modificare gli elenchi dei soci. Corpo Markdown, materiali, URL e altri metadati degli eventi sono conservati.

## Eventi riparati

| Evento | Sessioni totali | Sessioni con speaker |
| --- | --- | --- |
| [Visual Studio Saturday 2017](https://www.xedotnet.org/eventi/visual-studio-saturday-2017/) | 15 | 13 |
| [Visual Studio Saturday 2018](https://www.xedotnet.org/eventi/visual-studio-saturday-2018/) | 21 | 18 |
| [Visual Studio Saturday 2019](https://www.xedotnet.org/eventi/visual-studio-saturday-2019/) | 19 | 15 |
| [XE - Online Meeting - Intelligenza Artificiale](https://www.xedotnet.org/eventi/xe-online-meeting-intelligenza-artificiale/) | 1 | 1 |
| [One Day - App modernization](https://www.xedotnet.org/eventi/one-day-app-modernization/) | 15 | 10 |
| [One Day - Rethink application](https://www.xedotnet.org/eventi/one-day-rethink-application/) | 16 | 10 |
| [Blazor Conf 2026](https://blazorconf.it/#schedule) | 13 | 8 |

Per *One Day – App modernization* l’agenda contiene dieci talk: il solo elenco dei materiali ne documentava nove. La sessione di Davide Contin, *Modernize your community*, è stata recuperata dall’agenda completa. Le registrazioni e le pause restano sessioni senza speaker; pause omonime a orari diversi restano distinte.

## Profili creati

- `alberto-mori`
- `alessio-iafrate`
- `antonio-dell-ava`
- `christian-de-simone`
- `daniele-pozzobon`
- `gaetano-paterno`
- `giulio-vian`
- `manuel-grillo`
- `marco-dal-pino`
- `marco-leoncini`
- `marco-zamana`
- `massimo-bonanni`
- `michele-aponte`
- `riccardo-cappello`
- `simone-recupero`

I nuovi profili riportano una fonte dell’evento. Non sono state inventate biografie, fotografie o pagine personali. Gli speaker senza fotografia usano il fallback con iniziali.

## Revisione dei dieci eventi inizialmente senza sessioni

- I sette eventi della tabella sono stati riparati.
- Le riunioni dei soci di maggio, giugno e luglio 2018 non riportano sessioni o speaker identificabili nelle fonti: rimangono senza agenda strutturata.
- *Blazor Conf 2026* rimanda a [blazorconf.it](https://blazorconf.it/#schedule). Sono stati verificati titolo, anno 2026 e giornata del 10 aprile; le tredici sessioni e gli otto speaker sono stati trascritti dall’agenda esplicita. Un estratto con titoli, orari e nomi è conservato in `tests/fixtures/speakers/blazorconf-2026-agenda.json`. Il comando automatico continua a segnalare il formato esterno per le verifiche future; conserva le associazioni già presenti anche durante una migrazione completa.

## Inconsistenze conservate e limiti

- La sessione *Visual Studio for IoT Solutions* del 2018 riporta due identificativi Sessionize con lo stesso nome, Alessio Biasiutti. È conservata una sola associazione al profilo esistente; l’inconsistenza della fonte è segnalata dal comando. La fonte non consente di stabilire due identità distinte.
- In *One Day – Performance optimization* alcune sessioni omonime hanno orari distinti. Sono mantenute; il confronto usa titolo e orario per evitare di confonderle.
- Nessuna fonte legacy o agenda Sessionize ha restituito errori durante questa verifica. Disponibilità e contenuto delle fonti possono cambiare; un recupero fallito viene sempre segnalato e conserva i dati già presenti.
- La simulazione successiva alle riparazioni ha riportato **zero eventi modificati e zero profili creati**. Le fonti non sono richieste durante il build o l’esecuzione del sito.

## Registro di confronto completo

Le righe seguenti indicano formato riconosciuto e numero di sessioni prima e dopo il recupero; “nessuna agenda riconosciuta” non implica assenza di speaker in una fonte esterna. Per il 2018 il nome duplicato nella fonte richiede la verifica descritta sopra.

- https://www.xedotnet.org/eventi/20170406-windows-real-time/: righe; 7 → 7 sessioni.
- https://www.xedotnet.org/eventi/20180126_xe_night/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/ai-rimpiazzo-o-aiuto-per-gli-sviluppatori/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/angular-di-sei-veramente-sicuro-di-conoscerla/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/angularjs-e-xamarin-forms/: righe; 5 → 5 sessioni.
- https://www.xedotnet.org/eventi/architecture-tech-pub/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/aspnet-core-vs-nodejs/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/async-debugging-a-practical-guide-to-survive/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/async-night/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/azure-in-the-real-world/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/blazor-ha-vinto-storie-di-casi-reali/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/blazor-lo-sapevi-che/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/blazorconf2026/: agenda esterna verificata direttamente su https://blazorconf.it/#schedule; 0 → 13 sessioni.
- https://www.xedotnet.org/eventi/build-a-visual-studio-code-extension/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/cena-di-fine-anno-monthly-members-meeting/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/coding-gym-febbraio-2024/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/coding-gym-gennaio-2023/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/coding-gym-ottobre-2022/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/coding-gym-settembre-2023/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/data-night-influxdb-elastic-search/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/debug-night/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/dotnet-conf-2021-hot-topics/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/electron-night/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/from-0-to-aws/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/front-end-night-2024/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/frontend-night-vuejs-pwa/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/fullstack-typescript-with-deno/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/fusioncache-hybrid-caching-in-net/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/generative-ai-in-pratica/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/github-copilot-bootcamp-venezia-marghera/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/global-azure-bootcamp-2016/: righe; 8 → 8 sessioni.
- https://www.xedotnet.org/eventi/grpc-and-c-optimising-night/: righe; 3 → 3 sessioni.
- https://www.xedotnet.org/eventi/how-to-modernise-wpf-windows-forms-applications-with-windows-apps-sdk/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/iot-support-for-net-core/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/javascript-da-0-a-es6-api-rest/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/javascript-da-0-a-es6/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/lab-angular-1-to-2-lab/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/lab-from-0-to-docker/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/lab-git-e-github-2/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/lab-git-e-github/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/lab-windows-10-iot-core/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/lavorare-in-team/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/minimal-api-in-the-real-world/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/modern-application-development-developers-azure-sql-a-growth-mindset/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-aprile-2020/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-aprile-2025/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-febbraio-2019/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-febbraio-2020/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-giugno-2018/: nessuna agenda riconosciuta; 0 → 0 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-luglio-2018/: nessuna agenda riconosciuta; 0 → 0 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-luglio-2019/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-maggio-2018/: nessuna agenda riconosciuta; 0 → 0 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-maggio-2019/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-maggio-2020/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-maggio-2023/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-novembre-2019/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-ottobre-2018/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-ottobre-2019/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-ottobre-2022/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/monthly-members-meeting-settembre-2018/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/net-conf-2019/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/net-conf-2022-hot-topics/: righe; 5 → 5 sessioni.
- https://www.xedotnet.org/eventi/net-conf-2023-xe/: righe; 8 → 8 sessioni.
- https://www.xedotnet.org/eventi/net-conf-2024-xe/: righe; 8 → 8 sessioni.
- https://www.xedotnet.org/eventi/net-conf-2025-xe/: righe; 8 → 8 sessioni.
- https://www.xedotnet.org/eventi/net-conf-2026-xe/: righe; 8 → 8 sessioni.
- https://www.xedotnet.org/eventi/net-core-saturday/: righe; 7 → 7 sessioni; verifica incompleta.
- https://www.xedotnet.org/eventi/net-maui/: righe; 3 → 3 sessioni.
- https://www.xedotnet.org/eventi/observability-night/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/one-day-app-modernization/: Sessionize; 0 → 15 sessioni.
- https://www.xedotnet.org/eventi/one-day-enterprise-application/: righe; 14 → 14 sessioni.
- https://www.xedotnet.org/eventi/one-day-good-code/: righe; 9 → 9 sessioni.
- https://www.xedotnet.org/eventi/one-day-performance-optimization/: righe; 12 → 12 sessioni.
- https://www.xedotnet.org/eventi/one-day-real-app/: righe; 9 → 9 sessioni.
- https://www.xedotnet.org/eventi/one-day-rethink-application/: Sessionize; 0 → 16 sessioni.
- https://www.xedotnet.org/eventi/oneday2026/: righe; 12 → 12 sessioni.
- https://www.xedotnet.org/eventi/online-meeting-spa-framework-a-confronto/: righe; 4 → 4 sessioni.
- https://www.xedotnet.org/eventi/ottobre-2025/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/ottobre2026/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/power-bi-deep-learning-night/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/prisma-is-in-the-air/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/privacy-security-night/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/progettare-contenuti-per-la-user-experience/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/source-generator-multi-target-conditional-compilation-tecniche-avanzate-di-compilazione-per-progetti-net/: righe; 3 → 3 sessioni.
- https://www.xedotnet.org/eventi/sql-night-2024/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/sql-night-2025/: righe; 6 → 6 sessioni.
- https://www.xedotnet.org/eventi/sql-nosql/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/sql-server-query-optimization/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/sql-vs-nosql-night/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/team-working-in-action/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-alexa/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-aspnet-5-real-case/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-dbup/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-diagnostic-toolset-aspire/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-gennaio-2025/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-infrastructure-as-code/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-library/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-mcp-agenti-semantickernel/: righe; 3 → 3 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-nuget/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-oqtane-is-not-the-new-dotnetnuke/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/tech-pub-playwright/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/techpub-telegram-bot/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/ui-night-bootstrap-vs-angular-material/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/un-ecosistema-di-agenti-per-microsoft-365-copilot/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/unconference-web-saturday/: righe; 4 → 4 sessioni; verifica incompleta.
- https://www.xedotnet.org/eventi/visual-studio-2015-saturday/: righe; 8 → 8 sessioni.
- https://www.xedotnet.org/eventi/visual-studio-2019-launch/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/visual-studio-saturday-2017/: Sessionize; 0 → 15 sessioni.
- https://www.xedotnet.org/eventi/visual-studio-saturday-2018/: Sessionize; 0 → 21 sessioni; verifica incompleta.
- https://www.xedotnet.org/eventi/visual-studio-saturday-2019/: Sessionize; 0 → 19 sessioni.
- https://www.xedotnet.org/eventi/web-api-ionic/: righe; 3 → 3 sessioni.
- https://www.xedotnet.org/eventi/web-innovations-ordine-degli-ingegneri-di-padova/: righe; 2 → 2 sessioni; verifica incompleta.
- https://www.xedotnet.org/eventi/xe-brain-troviamo-la-soluzione/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/xe-community-pizza-1072016/: righe; 1 → 1 sessioni.
- https://www.xedotnet.org/eventi/xe-online-meeting-devops-gestione-dei-branch/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/xe-online-meeting-from-crud-to-messages-a-true-story/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/xe-online-meeting-intelligenza-artificiale/: elenco esplicito; 0 → 1 sessioni.
- https://www.xedotnet.org/eventi/xe-online-meeting-novembre/: righe; 4 → 4 sessioni.
- https://www.xedotnet.org/eventi/xe-quizzone-design-pattern/: righe; 2 → 2 sessioni.
- https://www.xedotnet.org/eventi/xe-quizzone-solid-priciples/: righe; 2 → 2 sessioni; verifica incompleta.

## Verifica della correzione

- 125 test Vitest superati, incluse simulazione senza scritture, idempotenza, collisioni di nomi e conservazione dei dati quando una fonte non è disponibile.
- Build statico e controllo dei collegamenti superati per il dominio root e per `https://puppo.github.io/xe-website/`.
- Suite Chromium: 50 test superati; due test specifici del modulo contatti saltati perché il build locale usa il fallback email (`PUBLIC_CONTACT_FORM_ACTION` non impostata).
- Due test mobile superati per l’evento di esempio, inclusa la scansione axe.
- Agenda, fotografie, collegamenti ai profili, assenza di overflow e scansioni axe verificate nel deployment con subpath a 1280 e 390 pixel.
- Lint e controllo della formattazione superati. Il confronto con la revisione precedente conferma corpo Markdown e metadati invariati nei sette eventi, salvo `sessions`; gli elenchi annuali dei soci sono invariati.
