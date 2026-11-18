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
