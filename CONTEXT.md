# Eventi e soci XE

Il contesto descrive gli appuntamenti pubblicati dalla community XE, la disponibilità delle relative iscrizioni e l’albo soci annuale.

## Language

**Evento programmato**:
Un evento confermato che si svolgerà nella data pubblicata.
_Avoid_: Evento attivo, evento aperto

**Evento annullato**:
Un evento che non si svolgerà, ma resta pubblicato per comunicare chiaramente l’annullamento.
_Avoid_: Evento chiuso, evento eliminato

**Periodo di iscrizione**:
L’intervallo inclusivo di date durante il quale una persona può iscriversi a un evento.
_Avoid_: Stato iscrizione, disponibilità manuale


**Anno associativo**:
L’anno indicato dal nome del file `src/data/memberships/YYYY.json`. Il sito mostra i soci pubblicati presenti nell’elenco dell’anno associativo più alto disponibile, indipendentemente dalla data corrente.
_Avoid_: Anno corrente calcolato dalla data, ruolo member nel profilo

**Albo soci**:
L’elenco annuale degli slug delle persone che hanno sottoscritto la tessera. Gli elenchi storici e i profili restano nel repository anche in caso di mancato rinnovo. Lo stato di speaker deriva dai riferimenti negli eventi pubblicati e non dipende dal rinnovo della tessera.


**Speaker**:
Una persona referenziata esplicitamente nelle sessioni di almeno un evento non in bozza, storico o futuro, programmato o annullato. Lo stato è derivato dai dati degli eventi, senza un campo `roles` nel profilo. Le stringhe speaker storiche sono solo testo e non identificano automaticamente un profilo.
_Avoid_: Ruolo speaker mantenuto manualmente nel profilo
