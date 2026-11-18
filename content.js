// Contenuti della Palestra di Dizione.
// Nelle letture: "/" = pausa breve, "//" = pausa lunga, *parola* = parola chiave da sottolineare con la voce.

export const BREATH = { inhale: 4, hold: 2, exhale: 6 }; // secondi: un ciclo da 12", 5 cicli = 1 minuto

export const DRILLS = [
  { t: 'Labbra', d: 'Fai vibrare le labbra come un motorino: brrrr. Sali e scendi di tono.' },
  { t: 'Lingua', d: 'La punta tocca il palato dietro i denti: la-le-li-lo-lu. Sempre più veloce, sempre pulito.' },
  { t: 'Mascella', d: 'Due sbadigli lenti e profondi, poi massaggia le guance con le dita.' },
  { t: 'Sirena', d: 'Su «nggg», dal suono più basso al più alto, e ritorno. Senza forzare.' },
  { t: 'Vocali grandi', d: 'A – E – I – O – U, aprendo la bocca il più possibile. Lente, poi veloci.' },
  { t: 'Esplosive', d: 'PA-TA-KA, PA-TA-KA… e poi BA-DA-GA. Consonanti nette, vocali piene.' },
  { t: 'Risonanza', d: 'Mmmm a bocca chiusa: devi sentire vibrare labbra e naso. Poi apri: mmm-ma.' },
  { t: 'Lingua libera', d: 'Disegna cerchi con la punta della lingua tra labbra e denti: 5 per verso.' },
  { t: 'R vibrante', d: 'Trrrr… drrrr… brrrr… La lingua vibra, la gola resta rilassata.' },
  { t: 'Aperte e chiuse', d: 'Alterna lentamente é – è, poi ó – ò. Senti come cambia la bocca.' },
  { t: 'Sorde e sonore', d: 'Sss (sorda) → zzz (sonora), poi fff → vvv. Metti una mano sulla gola: deve vibrare solo sulle sonore.' },
  { t: 'Doppie', d: 'Pala – palla, caro – carro, nono – nonno. Tieni la doppia un attimo in più.' },
];

// level: 1 facile, 2 medio, 3 difficile · focus: suono allenato
export const TWISTERS = [
  { l: 1, f: 'T e R', t: 'Trentatré trentini entrarono a Trento, tutti e trentatré trotterellando.' },
  { l: 1, f: 'P e C', t: 'Sopra la panca la capra campa, sotto la panca la capra crepa.' },
  { l: 1, f: 'T e R', t: 'Tre tigri contro tre tigri.' },
  { l: 1, f: 'S e R', t: 'Se oggi seren non è, doman seren sarà; se non sarà seren, si rasserenerà.' },
  { l: 1, f: 'Doppie', t: 'Dietro il palazzo c\'è un povero cane pazzo: date un pezzo di pane al povero pazzo cane.' },
  { l: 1, f: 'GLI', t: 'Sul tagliere l\'aglio taglia, non tagliare la tovaglia: la tovaglia non è aglio, e se la tagli fai uno sbaglio.' },
  { l: 1, f: 'B e R', t: 'Barbara bada al bar, bada alla birra, bada al barbiere e al barbone.' },
  { l: 1, f: 'Vocali', t: 'Pèsca e pésca: pésco la pèsca nel lago, e la pèsca matura la mangio.' },
  { l: 2, f: 'P e L', t: 'Apelle figlio di Apollo fece una palla di pelle di pollo; tutti i pesci vennero a galla per vedere la palla di pelle di pollo fatta da Apelle figlio di Apollo.' },
  { l: 2, f: 'C dura', t: 'Il cuoco cuoce in cucina e dice che la cuoca giace e tace perché sua cugina non sa cucinare.' },
  { l: 2, f: 'S e T', t: 'Stanno stretti sotto i letti sette spettri a denti stretti.' },
  { l: 2, f: 'Z', t: 'Al pozzo dei pazzi c\'era una pazza che lavava una pezza; arrivò un pazzo con un pezzo di pizza e chiese alla pazza: mi dai la pezza in cambio della pizza?' },
  { l: 2, f: 'SC', t: 'Ho in tasca l\'esca ed esco per la pesca, ma il pesce non s\'adesca: c\'è l\'esca ma non s\'adesca, e il pesce non si pesca.' },
  { l: 2, f: 'R', t: 'Una rana nera e rara sulla rena errò una sera.' },
  { l: 2, f: 'GLI e GN', t: 'Guglielmo coglie gigli e foglie, mentre Agnese sogna bagni nello stagno.' },
  { l: 2, f: 'F e V', t: 'Fra fiori freschi e foglie verdi volano veloci venti farfalle vivaci.' },
  { l: 3, f: 'Ritmo', t: 'Chi troppo in alto sal, cade sovente precipitevolissimevolmente.' },
  { l: 3, f: 'Lunghezza', t: 'Se l\'arcivescovo di Costantinopoli si volesse disarcivescoviscostantinopolizzare, vi disarcivescoviscostantinopolizzereste voi per non farlo disarcivescoviscostantinopolizzare?' },
  { l: 3, f: 'T e R', t: 'Il tribunale tributario tratta tre trattati, trascritti in tre tribolati trimestri.' },
  { l: 3, f: 'S e Z', t: 'Sazio e sereno, Zeno sistemò sei sedie sbilenche sotto lo zampillo di zaffiro.' },
  { l: 3, f: 'Doppie', t: 'Otto botti piene, otto botti vuote: rotte le otto botti, tutto il vino sotto.' },
  { l: 3, f: 'C e G', t: 'Gigi, giocando, gettò giù la gigantesca giara gialla del giardiniere geloso.' },
  { l: 3, f: 'R e L', t: 'Il re ladro rilegge le regole reali, ma le regole reali rileggono il re ladro.' },
  { l: 3, f: 'Vocali', t: 'Bótte e bòtte: la bótte di vino rotolò giù dalle scale, e prese un sacco di bòtte.' },
];

export const READINGS = [
  { title: 'Il caffè del mattino', type: 'articolo', g: 'Spot radio', body:
`C'è un momento / prima di tutto. // Prima delle email, / prima del traffico, / prima delle cose da fare. //
È il momento del *tuo* caffè. //
Un aroma che riempie la cucina, / una tazza calda tra le mani, / e il mondo che può aspettare. / Ancora un minuto. //
Miscela Aurora. / Il buongiorno / che ti meriti. //` },
  { title: 'Il bosco d\'inverno', type: 'articolo', g: 'Documentario', body:
`Quando arriva l'inverno, / il bosco sembra addormentato. // Ma sotto la neve / la vita continua. //
Il ghiro dorme profondamente nella sua tana, / mentre la volpe / segue tracce invisibili, / attenta a ogni rumore. //
Gli alberi hanno perso le foglie, / ma non la forza. // Le radici conservano l'energia / che a primavera / farà esplodere *di nuovo* / il verde. //
Il silenzio del bosco / non è vuoto. // È attesa. //` },
  { title: 'La lettera', type: 'audiolibro', g: 'Narrativa', body:
`La lettera era rimasta sul tavolo per tre giorni. // Marta la guardava ogni sera, / tornando a casa, / senza trovare il coraggio di aprirla. //
Conosceva quella calligrafia. / L'avrebbe riconosciuta tra mille. //
La quarta sera / si sedette, / respirò a fondo / e strappò la busta. //
Dentro / c'era un solo foglio, / e una sola frase: // «Sono tornato. / Se vuoi, / domani alle sei / sono al solito posto.» //
Marta rimase immobile. / Poi, / per la prima volta dopo tanto tempo, / sorrise. //` },
  { title: 'Notiziario delle otto', type: 'articolo', g: 'Notiziario', body:
`Buongiorno, / sono le otto. // Ecco le notizie principali. //
Tempo in miglioramento su tutta la penisola: / dopo le piogge dei giorni scorsi / torna il sole al Nord e al Centro, / mentre al Sud / sono attese ancora nuvole sparse. //
Traffico intenso sulle principali tangenziali / per il rientro dal ponte festivo. // Si consiglia di partire con *anticipo*. //
In chiusura, / la cultura: / riaprono da oggi / i musei civici, / con ingresso gratuito per tutta la settimana. //` },
  { title: 'Il guardiano del faro', type: 'copione', g: 'Monologo', body:
`VECCHIO: (guardando il mare) Quarant'anni. // Quarant'anni / che accendo questa luce ogni sera. //
(pausa) Dicono che adesso / la nave la guida un computer. / Che il faro / non serve più. //
Forse hanno ragione. // Ma io lo so / cosa vuol dire / vedere una luce / quando tutto intorno è buio. //
(piano) E finché avrò fiato, / questa luce / *non si spegne*. //` },
  { title: 'Benvenuto nel corso', type: 'articolo', g: 'E-learning', body:
`Benvenuto nel corso. // In questo primo modulo / scoprirai come organizzare il tuo lavoro / in modo semplice ed efficace. //
Il modulo è diviso in tre parti. // Nella prima / vedremo gli strumenti di base. / Nella seconda / li applicheremo a un caso reale. / Nella terza, / infine, / metterai alla prova ciò che hai imparato. //
Ricorda: / non c'è fretta. // Puoi mettere in pausa / e riprendere quando vuoi. // Iniziamo. //` },
  { title: 'Sera d\'estate', type: 'poesia', g: 'Poesia', body:
`Scende la sera / sui tetti di rame, //
e l'aria sa di pane / e di gelsomino. //
Una finestra accesa, / una voce lontana, //
un bambino che ride / e non vuole dormire. //
Resta, / sera d'estate. / Resta ancora un poco. //
Domani / avrò bisogno / di ricordarti. //` },
  { title: 'La nuova auto elettrica', type: 'articolo', g: 'Spot TV', body:
`Silenziosa. // Potente. // Pensata per chi guarda *avanti*. //
Cinquecento chilometri di autonomia, / ricarica completa in trenta minuti, / e un abitacolo / che ti fa sentire a casa. //
Non è solo un'auto. / È un nuovo modo / di muoversi nel mondo. //
Vieni a provarla. / Ti aspettiamo in concessionaria / da sabato. //` },
  { title: 'Il cane di Lorenzo', type: 'audiolibro', g: 'Racconto per ragazzi', body:
`Lorenzo aveva sempre voluto un cane. // Ne parlava a colazione, / a pranzo, / a cena, / e qualche volta / perfino nel sonno. //
Così, / il giorno del suo compleanno, / quando sentì un piccolo guaito / provenire da una scatola di cartone, / il cuore gli saltò in gola. //
Dentro / c'era un cucciolo marrone, / con un orecchio dritto / e uno piegato. // «Ti chiamerò Briciola» / disse Lorenzo. //
E Briciola, / come se avesse capito, / gli leccò il naso. //` },
  { title: 'Le stelle cadenti', type: 'articolo', g: 'Divulgazione', body:
`Ogni anno, / verso la metà di agosto, / il cielo si riempie di stelle cadenti. // Ma che cosa sono, / davvero? //
Non sono stelle. // Sono minuscoli frammenti di roccia e polvere, / lasciati nello spazio da una cometa. //
Quando la Terra attraversa questa scia, / i frammenti entrano nell'atmosfera / a una velocità enorme, / si scaldano / e bruciano / in una striscia di luce. //
Uno spettacolo che dura *un istante*, / ma che arriva da molto, / molto lontano. //` },
  { title: 'Il colloquio', type: 'copione', g: 'Scena a due', body:
`ANNA: (entrando) Buongiorno. Mi scusi il ritardo, / il treno… //
DIRETTORE: Si accomodi. // Il treno arriva in ritardo anche per me, / ogni mattina. //
ANNA: (sollevata) Allora siamo in due. //
DIRETTORE: Mi dica una cosa, / Anna. // Perché dovremmo scegliere proprio lei? //
ANNA: (pausa) Perché quando inizio una cosa, / *la finisco*. // Anche se il treno è in ritardo. //` },
  { title: 'La città che si sveglia', type: 'audiolibro', g: 'Narrativa descrittiva', body:
`Alle cinque del mattino / la città è ancora grigia. // Le serrande sono abbassate, / i lampioni stanchi. //
Poi, / poco alla volta, / arrivano i primi suoni. // Il fornaio che alza la saracinesca. / Un motorino che tossisce. / I passi veloci di chi va a lavorare. //
Il cielo cambia colore: / dal grigio al rosa, / dal rosa all'oro. //
E la città, / come ogni giorno, / apre gli occhi / e ricomincia. //` },
];

/* ---- segni di dizione (pronuncia standard) ---- */
// parole con vocale aperta o chiusa (vocale tonica indicata dall'accento)
const LIST = `bène tèmpo tèrra guèrra fèsta sètte cènto lèi mèglio pèggio sèmpre prèsto fèrro lètto pètto vècchio specchio
finèstra rèsto bèstia èrba sèdia mèdico cèrto sècolo tèsto tètto aspètto progètto oggètto rispètto perfètto effètto concètto difètto
séra néro véro néve féde stélla stélle vérde céna péna véla péra séme séte tré mése quéllo quélla quélli quélle quésto quésta quésti quéste capéllo capélli
vedére avére potére sapére volére dovére tenére parére piacére sedére tacére cadére valére godére
nòtte pòrta mòrte fòrte mòdo pòco còsa ròsa tròppo pòsto nòve pòi òggi òtto òlio òcchio òro dònna nòstro vòstro nòstra vòstra mòda giòco vòglio fòglia
ménte prèzzo stòria memòria glòria vittòria
sóle vóce dópo sólo móndo cónto ógni ónda giórno fórno tórre sótto códa nóme óra cóme nói vói lóro dóve mólto sóno bócca cólpa gónna rósso mósca`;
const ACC = { 'è': 'e', 'é': 'e', 'ò': 'o', 'ó': 'o' };
export const DIZ_WORDS = {};
for (const w of LIST.split(/\s+/).filter(Boolean)) {
  const i = [...w].findIndex((c) => ACC[c]);
  if (i >= 0) DIZ_WORDS[[...w].map((c) => ACC[c] || c).join('')] = { i, ch: w[i] };
}
for (const [a, b] of [['specchio', 'spècchio']]) { const i = [...b].findIndex((c) => ACC[c]); DIZ_WORDS[a] = { i, ch: b[i] }; }
export const DIZ_NOT = new Set(['stella', 'stelle', 'quello', 'quella', 'quelli', 'quelle', 'capello', 'capelli', 'riposo', 'sposo', 'sposa', 'ella', 'sella', 'della', 'dello', 'delle', 'nella', 'nello', 'nelle', 'medesimo', 'chiese']);
// parole che cambiano pronuncia secondo il significato
export const DIZ_DOUBLE = {
  pesca: 'pèsca (il frutto) · pésca (pescare)', botte: 'bótte (del vino) · bòtte (colpi)', accetta: 'accètta (accettare) · accétta (scure)',
  venti: 'vénti (20) · vènti (il vento)', legge: 'lègge (leggere) · légge (norma)', colto: 'còlto (raccolto) · cólto (istruito)',
  volto: 'vòlto (girato) · vólto (viso)', mozzo: 'mòzzo (ruota) · mózzo (di nave)', foro: 'fòro (piazza) · fóro (buco)',
  esca: 'ésca (per pesci) · èsca (uscire)', tema: 'tèma (argomento) · téma (paura)', corso: 'córso (strada) · còrso (della Corsica)',
};
// suffissi tonici: [regex, accento, posizione della vocale dall'inizio del match, lunghezza minima]
export const DIZ_RULES = [
  [/uo[^aeiou]{1,2}[aeiou]$/, 'ò', 1, 4],
  [/ie[^aeiou]{1,2}[aeiou]$/, 'è', 1, 4],
  [/ezz[aeio]$/, 'é', 0, 6],
  [/ment[eoi]$/, 'é', 1, 7],
  [/es[ei]$/, 'é', 0, 5],
  [/ell[aeio]$/, 'è', 0, 5],
  [/enz[aei]$/, 'è', 0, 5],
  [/ent[ei]$/, 'è', 0, 5],
  [/esim[aeio]$/, 'è', 0, 7],
  [/ion[ei]$/, 'ó', 1, 5],
  [/or[ei]$/, 'ó', 0, 5],
  [/os[aeio]$/, 'ó', 0, 6],
  [/ori[o]$/, 'ò', 0, 6],
];
