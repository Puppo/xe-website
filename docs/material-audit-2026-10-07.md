# Verifica dei materiali dell’archivio

Modalità: scrittura

- Eventi esaminati: 45
- Eventi modificati: 45

Sono stati verificati tutti i 45 eventi che avevano materiali strutturati. In 41 eventi il corpo Markdown ripeteva collegamenti già presenti in `materials`. La riparazione conserva gli URL originali, i metadati degli eventi, l’ordine, gli orari e i riferimenti agli speaker.

Il risultato contiene 58 collegamenti associati a 54 talk in 23 eventi; 23 collegamenti rimangono comuni o non attribuiti. I prerequisiti dei due laboratori Git e del laboratorio Windows IoT, e il riferimento a Dapper, sono stati ricollocati nel loro contesto esplicativo. Sono state recuperate anche le slide di Prisma su Speaker Deck, già presenti nel corpo ma ignorate dall’importatore precedente.

- **App modernization:** 12 collegamenti sotto nove talk; conservati tutti i dieci talk e i cinque momenti di servizio. La sessione di Davide Contin non ha materiali nella fonte. Gli orari uguali sono sessioni parallele.
- **Blazor Conf 2026:** otto collegamenti attribuiti tramite il titolo. L’eccezione della keynote, che aggiunge il prefisso `Keynote -`, è esplicita nell’estrazione e verificata sull’agenda già documentata nell’audit degli speaker.
- **.NET MAUI:** cartella delle slide comune; repository distinti sotto i talk di Marco Bortolin e Andrea Dottor.
- **One Day Enterprise Application 2019:** dieci risorse attribuite dalle righe legacy; conservati abstract e PDF dell’agenda. Un’ancora vuota copiata nell’abstract di un altro talk non viene usata come prova di attribuzione.
- **JavaScript, giugno 2017:** la fonte attribuisce entrambi i talk a Daniele Morosinotto, ma elenca anche materiali di Andrea Dottor. Nessun collegamento identifica un solo talk; entrambi rimangono nell’elenco comune con i nomi originali.
- **Prisma:** una cartella legacy senza etichetta rimane disponibile nell’elenco dell’evento; slide e codice esplicitamente indicati sono associati al talk.

Non è stata eseguita una migrazione completa. La successiva simulazione sulle fonti live esamina nuovamente i 45 eventi e propone **zero modifiche**. Le fixture offline verificano la conservazione degli URL e delle associazioni di tutti i 45 eventi.

## Verifica degli eventi

- src/data/events/2015/2015-11-27-tech-pub-aspnet-5-real-case.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2016/2016-03-11-web-api-ionic.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2016/2016-04-22-lab-git-e-github-2.md: riparato; 0 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2016/2016-04-22-lab-git-e-github.md: riparato; 0 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2016/2016-05-20-lab-windows-10-iot-core.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2016/2016-09-16-ui-night-bootstrap-vs-angular-material.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2016/2016-11-18-debug-night.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2017/2017-02-17-aspnet-core-vs-nodejs.md: riparato; 2 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2017/2017-03-24-async-night.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2017/2017-04-06-20170406-windows-real-time.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2017/2017-06-08-javascript-da-0-a-es6.md: riparato; 0 risorse nelle sessioni, 2 risorse comuni o non attribuite.
- src/data/events/2017/2017-07-06-javascript-da-0-a-es6-api-rest.md: riparato; 2 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2017/2017-09-15-privacy-security-night.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2017/2017-11-18-one-day-performance-optimization.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2017/2017-12-01-electron-night.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2018/2018-03-23-power-bi-deep-learning-night.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2018/2018-09-15-one-day-good-code.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2018/2018-09-15-one-day-real-app.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2019/2019-02-22-data-night-influxdb-elastic-search.md: riparato; 2 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2019/2019-05-25-one-day-enterprise-application.md: riparato; 10 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2019/2019-09-20-grpc-and-c-optimising-night.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2020/2020-10-16-online-meeting-spa-framework-a-confronto.md: riparato; 4 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2020/2020-11-13-xe-online-meeting-novembre.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2021/2021-01-22-blazor-ha-vinto-storie-di-casi-reali.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2021/2021-02-19-iot-support-for-net-core.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2021/2021-05-21-xe-quizzone-design-pattern.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2021/2021-09-17-sql-server-query-optimization.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2021/2021-11-12-dotnet-conf-2021-hot-topics.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2022/2022-03-18-how-to-modernise-wpf-windows-forms-applications-with-windows-apps-sdk.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2022/2022-04-29-prisma-is-in-the-air.md: riparato; 2 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2022/2022-05-20-minimal-api-in-the-real-world.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2022/2022-09-16-net-maui.md: riparato; 2 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2023/2023-04-14-progettare-contenuti-per-la-user-experience.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2023/2023-05-20-one-day-app-modernization.md: riparato; 12 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2023/2023-10-20-ai-rimpiazzo-o-aiuto-per-gli-sviluppatori.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2024/2024-03-15-sql-night-2024.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2024/2024-04-12-tech-pub-playwright.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2024/2024-05-18-one-day-rethink-application.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2024/2024-09-20-fusioncache-hybrid-caching-in-net.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2025/2025-05-23-sql-night-2025.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2025/2025-09-12-un-ecosistema-di-agenti-per-microsoft-365-copilot.md: riparato; 1 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2025/2025-11-15-net-conf-2025-xe.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2026/2026-01-23-tech-pub-mcp-agenti-semantickernel.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.
- src/data/events/2026/2026-04-10-blazorconf2026.md: riparato; 8 risorse nelle sessioni, 0 risorse comuni o non attribuite.
- src/data/events/2026/2026-05-22-oneday2026.md: riparato; 0 risorse nelle sessioni, 1 risorse comuni o non attribuite.

## Fonti non disponibili e attribuzioni da verificare

- src/data/events/2017/2017-06-08-javascript-da-0-a-es6.md: https://github.com/andreadottor/XeDemo_PizzeriaAPI: associazione ambigua; conservato tra i materiali dell’evento.
- src/data/events/2017/2017-06-08-javascript-da-0-a-es6.md: https://github.com/dmorosinotto/LearnJS_INGPD: associazione ambigua; conservato tra i materiali dell’evento.
- src/data/events/2022/2022-04-29-prisma-is-in-the-air.md: https://drive.google.com/drive/folders/1S0QSYP7TOX3Z1WLh1Z7Z0zWc_sTS5UzA?usp=sharing?usp=sharing: collegamento legacy senza etichetta; conservato tra i materiali dell’evento.
