# VActor

La tua cabina personale di lettura, dizione e doppiaggio. È una web app che si installa su Android.

**Fase 1 «La Cabina»**
- Bottone REC gigante, con conto alla rovescia 3-2-1
- Gobbo che scorre solo mentre parli
- Import di testo, PDF, screenshot (letti in automatico) e video mp4
- Take multiple e confronto A/B nello stesso punto della frase
- Archivio con minuti di cabina
- Modalità Casa (audio puro, mic USB) e Fuori (riduzione rumore)
- Condividi → VActor da qualsiasi app Android

**Gobbo che segue le parole**: riconoscimento vocale offline in italiano con [Vosk](https://alphacephei.com/vosk/) (modello `vosk-model-small-it-0.22`, licenza Apache 2.0) tramite [vosk-browser](https://github.com/ccoreilly/vosk-browser). Il modello si scarica una sola volta (~50 MB) e poi resta sul telefono.

**Fase 2 «Palestra di dizione»**
- Allenamento guidato di 10 minuti con un tocco: respiro, articolazione, 3 scioglilingua registrati, lettura del giorno
- 24 scioglilingua su 3 livelli, 12 letture originali (spot, documentario, audiolibro, notiziario, monologhi, poesia)
- Segni di dizione accendibili: vocali aperte e chiuse, S sonora, parole con doppia pronuncia
- Pause (`/` breve, `//` lunga) e parole chiave (`*parola*`) segnate nel testo
- «Prima e dopo»: confronto con la lettura precedente dello stesso testo
- Promemoria per giorno della settimana tramite Google Calendar

**Fase 3 «Leggio di doppiaggio»**
- Carichi un video: l'app ascolta la voce originale (offline) e mette ogni parola al suo tempo; con il copione lo allinea, senza copione lo ricava dall'audio
- Divisione automatica in anelli (battute), battute del copione non presenti nel video escluse
- Banda ritmica che scorre sotto il video con le parole allungate secondo la durata, segni di pausa e respiro
- Prova dell'anello con voce originale, loop, 3 bip prima dell'attacco
- Misuratore di sync dopo ogni take (attacco e chiusura in anticipo o in ritardo)
- Esportazione del video doppiato (MP4 dove supportato, altrimenti WebM)

**Fase 4 «Coach Sergente»**
- Dopo ogni take: un ascolto severo senza aiuti (parole saltate, sbagliate o aggiunte), velocità, pause rispettate o no, intonazione e cadenza (fine frase che sale, domande piatte, monotonia), volume e distorsione. Tutto sul telefono e gratis.
- Con una chiave gratuita di Google Gemini: giudizio su accento tonico, vocali aperte/chiuse, S/Z, doppie e interpretazione, con il secondo esatto, come va detto e un esercizio. Errori dal più grave, nessun complimento, miglioramenti solo se misurati rispetto alla volta precedente.
- Quando il modello migliore finisce il limite gratuito si passa da soli al modello leggero.
- Chat con il coach: descrivi un problema a parole (e se vuoi con una registrazione); il coach risponde, propone esercizi da aggiungere ai testi e ricorda i tuoi punti deboli, che poi controlla in ogni analisi.
- Scelta del modello: Leggero (~500 analisi al giorno, predefinito) o Migliore (~20 al giorno, più sensibile alle sfumature).

**Backup su Google Drive**
- Cartella «VActor» sul tuo Drive con registrazioni, testi, report del coach e impostazioni (non la chiave Gemini). Permesso `drive.file`: l'app vede solo i file che ha creato.
- Backup incrementale, automatico a fine allenamento, video facoltativi; ripristino su un telefono nuovo.
