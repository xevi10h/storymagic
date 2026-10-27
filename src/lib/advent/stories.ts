// Advent calendar 2026: the 24 bedtime mini-stories (one per door, 1–24 December).
// Arc: Bartolo, the Three Kings' youngest camel, is sent ahead to the child's house to
// learn everything a camel of the Reyes caravan must know; on Nochebuena (door 24) he
// goes back to Oriente, leading toward the Reyes book ("Paje Real por una noche").
//
// Written natively in Spanish and in Catalan (not translated line by line): Catalan uses
// the personal article ("en Bartolo", "en Melcior", "la Noa"), the tortell, the
// tramuntana. Name / gender tokens are documented in ./render.ts. Static content, no AI
// at runtime. Import-free (type-only imports are stripped): advent.check.mjs runs it.
//
// Art: existing path illustrations only (public/images/path/*), never generated here.
// Chosen without lettering or fold lines (castle "dance/wish/song/hands/knights" and
// reyes-c3mapb-boat are left out on purpose); three doors borrow night scenes from the
// forest and castle worlds.

import type { AdventLocale, StoryTemplate } from "./render";

export interface DoorContent {
  /** Public path of the door illustration (720×480 webp). */
  art: string;
  artAlt: Record<AdventLocale, string>;
  stories: Record<AdventLocale, StoryTemplate>;
}

const art = (path: string) => `/images/path/${path}.webp`;

export const ADVENT_DOORS: readonly DoorContent[] = [
  // 1
  {
    art: art("reyes/reyes-c3mapa-neck"),
    artAlt: {
      es: "Un camello estira el cuello junto a una escalera de madera",
      ca: "Un camell estira el coll al costat d'una escala de fusta",
    },
    stories: {
      es: {
        title: "{v} y el camello de la ventana",
        teaser: "La noche del 1 de diciembre, alguien dio tres golpecitos en la ventana. Era un camello muy pequeño.",
        paragraphs: [
          "La noche del 1 de diciembre, alguien dio tres golpecitos en la ventana. Toc, toc, toc.",
          "{N} se asomó y vio una cabeza peluda, unas pestañas larguísimas y una sonrisa con muchos dientes. Era un camello que estiraba el cuello por encima de la escalera del jardín.",
          "—Me llamo Bartolo —dijo—. Soy el camello más pequeño de los Reyes Magos.",
          "Melchor lo había enviado por delante con una misión: este año, por primera vez, Bartolo iría en la caravana de la noche de Reyes. Pero antes tenía que aprender muchas cosas.",
          "—Tengo veinticuatro días —suspiró Bartolo—, y no sé por dónde empezar.",
          "{N} pensó un momento y le tendió la mano por la ventana.",
          "—Empezamos mañana. Yo te ayudo.",
          "Bartolo se puso tan contento que se le escapó un bostezo enorme. Al fin y al cabo, los camellos también tienen que dormir.",
        ],
        question: "¿Qué crees que tendrá que aprender Bartolo antes de la noche de Reyes?",
      },
      ca: {
        title: "{N} i el camell de la finestra",
        teaser: "La nit de l'1 de desembre, algú va picar tres vegades a la finestra. Era un camell molt petit.",
        paragraphs: [
          "La nit de l'1 de desembre, algú va picar tres vegades a la finestra. Toc, toc, toc.",
          "{N} va treure el cap i va veure una cara peluda, unes pestanyes llarguíssimes i un somriure ple de dents. Era un camell que allargava el coll per sobre de l'escala del jardí.",
          "—Em dic Bartolo —va dir—. Soc el camell més petit dels Reis d'Orient.",
          "En Melcior l'havia enviat per davant amb una missió: aquest any, per primera vegada, en Bartolo aniria a la caravana de la nit de Reis. Però abans havia d'aprendre moltes coses.",
          "—Tinc vint-i-quatre dies —va sospirar en Bartolo—, i no sé per on començar.",
          "{N} s'ho va pensar una estona i li va allargar la mà per la finestra.",
          "—Comencem demà. Jo t'ajudo.",
          "En Bartolo es va posar tan content que se li va escapar un badall enorme. Al cap i a la fi, els camells també han de dormir.",
        ],
        question: "Què creus que haurà d'aprendre en Bartolo abans de la nit de Reis?",
      },
    },
  },
  // 2
  {
    art: art("reyes/reyes-c2camels-breakfast"),
    artAlt: {
      es: "Un camello junto a un montón de paja, zanahorias y un cubo de agua",
      ca: "Un camell al costat d'un munt de palla, pastanagues i una galleda d'aigua",
    },
    stories: {
      es: {
        title: "{v} y el desayuno de Bartolo",
        teaser: "Bartolo arrugó la nariz delante del montón de paja. ¿Eso era todo lo que desayunaban los camellos?",
        paragraphs: [
          "Por la mañana, Bartolo esperaba en el jardín delante de un montón de paja y un cubo de agua.",
          "—Los camellos de los Reyes tienen que comer bien —explicó—. El viaje desde Oriente es larguísimo.",
          "Pero arrugó la nariz. La paja le picaba en la lengua.",
          "{N} entró corriendo en la cocina y volvió con una zanahoria. Bartolo la olió, le dio un mordisco y… ¡crac! Se le iluminaron los ojos.",
          "—¡Esto sí que es un desayuno!",
          "Al final se comió tres zanahorias, un poco de paja (para no quedar mal) y se bebió el cubo entero de un trago.",
          "—Ahora podría cruzar el desierto dos veces —dijo, dándose palmaditas en la barriga.",
          "Primera lección: con la barriga llena, todo se aprende mejor.",
        ],
        question: "Y tú, ¿qué desayunarías si tuvieras que cruzar un desierto?",
      },
      ca: {
        title: "{N} i l'esmorzar d'en Bartolo",
        teaser: "En Bartolo va arrufar el nas davant del munt de palla. Això era tot el que esmorzaven els camells?",
        paragraphs: [
          "Al matí, en Bartolo esperava al jardí davant d'un munt de palla i una galleda d'aigua.",
          "—Els camells dels Reis han de menjar bé —va explicar—. El viatge des d'Orient és llarguíssim.",
          "Però va arrufar el nas. La palla li punxava la llengua.",
          "{N} va entrar corrents a la cuina i va tornar amb una pastanaga. En Bartolo la va ensumar, li va clavar una mossegada i… crac! Se li van il·luminar els ulls.",
          "—Això sí que és un esmorzar!",
          "Al final es va menjar tres pastanagues, una mica de palla (per quedar bé) i es va beure tota la galleda d'un glop.",
          "—Ara podria travessar el desert dues vegades —va dir, donant-se copets a la panxa.",
          "Primera lliçó: amb la panxa plena, tot s'aprèn millor.",
        ],
        question: "I tu, què esmorzaries si haguessis de travessar un desert?",
      },
    },
  },
  // 3
  {
    art: art("reyes/reyes-c1-map"),
    artAlt: {
      es: "Un mapa vuela sobre un pueblo bajo el cielo estrellado",
      ca: "Un mapa vola per sobre d'un poble sota el cel estrellat",
    },
    stories: {
      es: {
        title: "{v} y el mapa que salió volando",
        teaser: "Gaspar le había dado a Bartolo el mapa de todos los tejados del mundo. Y el mapa tenía muchas ganas de volar.",
        paragraphs: [
          "Gaspar le había confiado a Bartolo un tesoro: el mapa de todos los tejados del mundo, con una estrellita en cada casa donde vive un niño o una niña.",
          "—Si lo pierdes, la noche de Reyes nos perderemos todos —le había dicho.",
          "Bartolo se lo enseñó {a}, muy orgulloso. Justo entonces sopló el viento del norte, y el mapa se soltó, dio una voltereta y salió volando por encima del pueblo.",
          "—¡Mi mapa! —gritó Bartolo.",
          "{N} no se lo pensó dos veces. Corrieron calle abajo, saltaron un charco, rodearon la plaza… y cuando el mapa bajó a descansar sobre un seto, {n} lo atrapó con las dos manos.",
          "Lo doblaron en cuatro, bien doblado, y Bartolo lo guardó debajo de su manta.",
          "—Segunda lección —dijo, todavía sin aliento—: los mapas, siempre doblados.",
          "Pero el mapa, debajo de la manta, se movía un poquito. Como si estuviera pensando en otra aventura.",
        ],
        question: "Si tuvieras un mapa mágico, ¿adónde te gustaría que te llevara?",
      },
      ca: {
        title: "{N} i el mapa que va sortir volant",
        teaser: "En Gaspar havia donat a en Bartolo el mapa de totes les teulades del món. I el mapa tenia moltes ganes de volar.",
        paragraphs: [
          "En Gaspar havia confiat un tresor a en Bartolo: el mapa de totes les teulades del món, amb una estrelleta a cada casa on viu un nen o una nena.",
          "—Si el perds, la nit de Reis ens perdrem tots —li havia dit.",
          "En Bartolo el va ensenyar {a}, molt cofoi. Just aleshores va bufar la tramuntana, i el mapa es va deixar anar, va fer una tombarella i va sortir volant per sobre del poble.",
          "—El meu mapa! —va cridar en Bartolo.",
          "{N} no s'ho va pensar dues vegades. Van córrer carrer avall, van saltar un bassal, van fer la volta a la plaça… i quan el mapa es va aturar a descansar damunt d'una bardissa, {n} el va atrapar amb totes dues mans.",
          "El van plegar en quatre, ben plegat, i en Bartolo el va desar sota la seva manta.",
          "—Segona lliçó —va dir, encara sense alè—: els mapes, sempre plegats.",
          "Però el mapa, a sota de la manta, es bellugava una mica. Com si estigués pensant en una altra aventura.",
        ],
        question: "Si tinguessis un mapa màgic, on t'agradaria que et portés?",
      },
    },
  },
  // 4
  {
    art: art("reyes/reyes-c2camels-feather"),
    artAlt: {
      es: "Un camello con una pluma blanca junto al hocico",
      ca: "Un camell amb una ploma blanca al costat del morro",
    },
    stories: {
      es: {
        title: "{v} y la pluma que hacía cosquillas",
        teaser: "Melchor escribe la lista de regalos con una pluma blanca. Y esa pluma le hace muchas cosquillas a Bartolo.",
        paragraphs: [
          "Melchor escribe la lista de regalos con una pluma blanca y larga. Esa mañana se la había enviado a Bartolo para que la llevara a afilar.",
          "Pero la pluma se movía con el aire y le rozaba la nariz.",
          "—Aaa… aaa… ¡ATCHÍS!",
          "El estornudo fue tan fuerte que las hojas del árbol temblaron y un gorrión se cayó de la rama (del susto; no se hizo nada).",
          "—Si estornudo así la noche de Reyes, despertaré a todos los niños del mundo —se lamentó Bartolo.",
          "{N} le enseñó un truco: cuando notes que viene el estornudo, aprieta suavecito el labio de arriba con un dedo y cuenta hasta tres.",
          "Bartolo no tiene dedos, pero lo intentó con la pezuña. Uno, dos, tres… y el estornudo se marchó por donde había venido.",
          "—¡Funciona! —susurró, muy contento de tener [un amigo tan listo|una amiga tan lista|a alguien tan listo a su lado].",
        ],
        question: "¿Dónde tienes tú más cosquillas?",
      },
      ca: {
        title: "{N} i la ploma que feia pessigolles",
        teaser: "En Melcior escriu la llista de regals amb una ploma blanca. I aquesta ploma fa moltes pessigolles a en Bartolo.",
        paragraphs: [
          "En Melcior escriu la llista de regals amb una ploma blanca i llarga. Aquell matí l'havia enviat a en Bartolo perquè la portés a esmolar.",
          "Però la ploma es movia amb l'aire i li fregava el nas.",
          "—Aaa… aaa… ATXIM!",
          "L'esternut va ser tan fort que les fulles de l'arbre van tremolar i un pardal va caure de la branca (de l'ensurt; no es va fer res).",
          "—Si esternudo així la nit de Reis, despertaré tots els nens i nenes del món —es va lamentar en Bartolo.",
          "{N} li va ensenyar un truc: quan notis que arriba l'esternut, prem suaument el llavi de dalt amb un dit i compta fins a tres.",
          "En Bartolo no té dits, però ho va provar amb la peülla. U, dos, tres… i l'esternut se'n va anar per on havia vingut.",
          "—Funciona! —va xiuxiuejar, molt content de tenir [un amic tan llest|una amiga tan llesta|algú tan llest al costat].",
        ],
        question: "On tens tu més pessigolles?",
      },
    },
  },
  // 5 (the approved design's door)
  {
    art: art("reyes/reyes-c1-camels"),
    artAlt: {
      es: "Los camellos de los Reyes duermen sobre un tejado",
      ca: "Els camells dels Reis dormen damunt d'una teulada",
    },
    stories: {
      es: {
        title: "{v} y el camello que no sabía estarse quieto",
        teaser: "Bartolo, el camello más pequeño de los Reyes, tiene un problema: no sabe estarse quieto. {N} tiene un truco.",
        paragraphs: [
          "Bartolo es el camello más pequeño de los Reyes Magos. Tiene las rodillas huesudas, las pestañas larguísimas y un problema: no sabe estarse quieto.",
          "—Si me muevo en la noche de Reyes, se caerán los regalos —le dijo {a}, muy serio.",
          "Así que {n} le enseñó su truco. Cerrar los ojos, contar ovejas y, cuando las ovejas se acaban, contar estrellas.",
          "Bartolo contó tres ovejas. Luego cuatro estrellas. A la quinta estrella soltó un ronquido tan grande que se le movieron las pestañas.",
          "Allí, en el tejado, los otros camellos de la caravana también dormían, con las alforjas puestas y la cabeza sobre las tejas.",
          "{N} sonrió y lo tapó con su bufanda.",
          "—Mañana practicamos otra vez —susurró.",
        ],
        question: "Y ahora, ¿cuántas estrellas cuentas tú antes de dormirte?",
      },
      ca: {
        title: "{N} i el camell que no sabia estar-se quiet",
        teaser: "En Bartolo, el camell més petit dels Reis, té un problema: no sap estar-se quiet. {N} té un truc.",
        paragraphs: [
          "En Bartolo és el camell més petit dels Reis d'Orient. Té els genolls ossuts, les pestanyes llarguíssimes i un problema: no sap estar-se quiet.",
          "—Si em bellugo la nit de Reis, cauran els regals —li va dir {a}, molt seriós.",
          "Així que {n} li va ensenyar el seu truc. Tancar els ulls, comptar ovelles i, quan s'acaben les ovelles, comptar estrelles.",
          "En Bartolo va comptar tres ovelles. Després quatre estrelles. A la cinquena estrella va deixar anar un ronc tan gros que se li van moure les pestanyes.",
          "Allà, a la teulada, els altres camells de la caravana també dormien, amb les alforges posades i el cap damunt les teules.",
          "{N} va somriure i el va tapar amb la seva bufanda.",
          "—Demà ho tornem a practicar —va xiuxiuejar.",
        ],
        question: "I ara, quantes estrelles comptes tu abans d'adormir-te?",
      },
    },
  },
  // 6
  {
    art: art("reyes/reyes-c2map-bakery"),
    artAlt: {
      es: "Un mapa de estrellas entra por la ventana de una panadería llena de roscones",
      ca: "Un mapa d'estrelles entra per la finestra d'un forn ple de tortells",
    },
    stories: {
      es: {
        title: "{v} y el olor a roscón",
        teaser: "El mapa travieso se escapó otra vez y fue a parar a la ventana de la panadería. Allí olía a roscón.",
        paragraphs: [
          "El mapa se escapó otra vez de debajo de la manta. Esta vez se coló por la ventana abierta de la panadería.",
          "{N} y Bartolo entraron detrás de él. Dentro olía a mantequilla, a azúcar y a agua de azahar.",
          "En las bandejas había roscones de Reyes, redondos como coronas, con frutas de colores que brillaban como joyas.",
          "—¿Nos podemos comer uno? —preguntó Bartolo, con los ojos como platos.",
          "El panadero se rio.",
          "—Estos son para el 6 de enero. Lo bueno se hace esperar.",
          "Bartolo suspiró. Esperar era dificilísimo. Pero el panadero les dio una miguita para probar, y {n} recuperó el mapa, que se había quedado pegado a un trocito de fruta escarchada.",
          "De vuelta a casa, Bartolo iba muy callado.",
          "—Hoy he aprendido algo —dijo al fin—: esperar también es parte de la fiesta.",
        ],
        question: "¿Qué es lo que más te cuesta esperar?",
      },
      ca: {
        title: "{N} i l'olor de tortell",
        teaser: "El mapa entremaliat es va tornar a escapar i va anar a parar a la finestra del forn. Allà feia olor de tortell.",
        paragraphs: [
          "El mapa es va tornar a escapar de sota la manta. Aquesta vegada es va escolar per la finestra oberta del forn.",
          "{N} i en Bartolo hi van entrar darrere seu. A dins feia olor de mantega, de sucre i d'aigua de flor de taronger.",
          "A les safates hi havia tortells de Reis, rodons com corones, amb fruita confitada de colors que brillava com si fossin joies.",
          "—Ens en podem menjar un? —va preguntar en Bartolo, amb els ulls com taronges.",
          "El forner va riure.",
          "—Aquests són per al 6 de gener. Les coses bones es fan esperar.",
          "En Bartolo va sospirar. Esperar era dificilíssim. Però el forner els va donar una engruna per tastar, i {n} va recuperar el mapa, que s'havia quedat enganxat a un trosset de fruita confitada.",
          "De tornada cap a casa, en Bartolo anava molt callat.",
          "—Avui he après una cosa —va dir al final—: esperar també forma part de la festa.",
        ],
        question: "Què és el que et costa més d'esperar?",
      },
    },
  },
  // 7
  {
    art: art("reyes/reyes-c2map-clock"),
    artAlt: {
      es: "Un mapa de estrellas enganchado en el reloj de una torre",
      ca: "Un mapa d'estrelles enganxat al rellotge d'una torre",
    },
    stories: {
      es: {
        title: "{v} y el reloj de la plaza",
        teaser: "La noche de Reyes hay que acabar antes de que salga el sol. Pero Bartolo todavía no sabe leer la hora.",
        paragraphs: [
          "—La noche de Reyes hay que repartirlo todo antes de que salga el sol —explicó Bartolo—. Pero tengo un problema: no sé leer la hora.",
          "Así que {n} lo llevó a la plaza, donde hay una torre muy alta con un reloj enorme.",
          "Y allí, enganchado en la aguja larga, estaba… ¡el mapa! Se había escapado otra vez.",
          "—Mira —dijo {n}—. La aguja corta dice la hora. La larga, los minutos. Cuando las dos miran hacia arriba, son las doce.",
          "Bartolo miraba y miraba, con la cabeza ladeada.",
          "—¿Y cuando el mapa tapa las agujas?",
          "—Entonces hay que esperar a que el reloj dé las campanadas.",
          "Justo entonces sonó: ¡dong, dong, dong! El mapa se asustó, se soltó y bajó planeando hasta los pies de Bartolo.",
          "—Las tres en punto —dijo Bartolo, muy orgulloso—. ¡Y mapa recuperado!",
        ],
        question: "¿A qué hora te vas tú a dormir?",
      },
      ca: {
        title: "{N} i el rellotge de la plaça",
        teaser: "La nit de Reis cal acabar abans que surti el sol. Però en Bartolo encara no sap llegir l'hora.",
        paragraphs: [
          "—La nit de Reis ho hem de repartir tot abans que surti el sol —va explicar en Bartolo—. Però tinc un problema: no sé llegir l'hora.",
          "Així que {n} el va portar a la plaça, on hi ha una torre molt alta amb un rellotge enorme.",
          "I allà, enganxat a l'agulla llarga, hi havia… el mapa! S'havia tornat a escapar.",
          "—Mira —va dir {n}—. L'agulla curta diu l'hora. La llarga, els minuts. Quan totes dues miren amunt, són les dotze.",
          "En Bartolo mirava i mirava, amb el cap de costat.",
          "—I quan el mapa tapa les agulles?",
          "—Doncs llavors cal esperar que el rellotge toqui les campanades.",
          "Just aleshores va sonar: dong, dong, dong! El mapa es va espantar, es va deixar anar i va baixar planant fins als peus d'en Bartolo.",
          "—Les tres en punt —va dir en Bartolo, molt cofoi—. I mapa recuperat!",
        ],
        question: "A quina hora te'n vas tu a dormir?",
      },
    },
  },
  // 8
  {
    art: art("reyes/reyes-c2map-pond"),
    artAlt: {
      es: "Un pato duerme en un barquito con una vela de estrellas",
      ca: "Un ànec dorm en una barqueta amb una vela d'estrelles",
    },
    stories: {
      es: {
        title: "{v} y el pato capitán",
        teaser: "En el estanque navegaba un barquito con una vela llena de estrellas. Y esa vela se parecía mucho a cierto mapa.",
        paragraphs: [
          "En el estanque del parque navegaba un barquito con una vela azul llena de estrellas. Y al timón iba un pato que dormitaba con cara de capitán.",
          "—¡Esa vela es mi mapa! —dijo Bartolo.",
          "Pero Bartolo no sabe nadar, y el agua le da un poco de miedo. Se quedó en la orilla, con las patas muy juntas.",
          "{N} se acercó al borde y saludó al pato, que abrió un ojo.",
          "—Buenas tardes, capitán. ¿Nos devolvería la vela, por favor? Es muy importante para la noche de Reyes.",
          "El pato se lo pensó, porque era un pato serio. Luego remó con las patas hasta la orilla, desató la vela y se la entregó a Bartolo con una reverencia.",
          "—Cuando se pide con educación —dijo el pato—, todo navega mejor.",
          "Bartolo le dio las gracias tres veces. Y desde entonces, cada vez que pasa junto a un estanque, saluda a los patos con la cabeza.",
        ],
        question: "¿Qué palabra mágica usas tú cuando pides algo?",
      },
      ca: {
        title: "{N} i l'ànec capità",
        teaser: "A l'estany hi navegava una barqueta amb una vela plena d'estrelles. I aquella vela s'assemblava molt a cert mapa.",
        paragraphs: [
          "A l'estany del parc hi navegava una barqueta amb una vela blava plena d'estrelles. I al timó hi anava un ànec que becainava amb cara de capità.",
          "—Aquesta vela és el meu mapa! —va dir en Bartolo.",
          "Però en Bartolo no sap nedar, i l'aigua li fa una mica de por. Es va quedar a la vora, amb les potes ben juntes.",
          "{N} es va acostar a l'aigua i va saludar l'ànec, que va obrir un ull.",
          "—Bona tarda, capità. Ens tornaria la vela, si us plau? És molt important per a la nit de Reis.",
          "L'ànec s'ho va rumiar, perquè era un ànec seriós. Després va remar amb les potes fins a la vora, va deslligar la vela i la va donar a en Bartolo fent una reverència.",
          "—Quan es demana amb educació —va dir l'ànec—, tot navega millor.",
          "En Bartolo li va donar les gràcies tres vegades. I des d'aleshores, cada cop que passa per un estany, saluda els ànecs amb el cap.",
        ],
        question: "Quina paraula màgica fas servir tu quan demanes alguna cosa?",
      },
    },
  },
  // 9
  {
    art: art("reyes/reyes-c2camels-trumpet"),
    artAlt: {
      es: "Una trompeta dorada con cintas de colores en una fiesta",
      ca: "Una trompeta daurada amb cintes de colors en una festa",
    },
    stories: {
      es: {
        title: "{v} y la trompeta de la cabalgata",
        teaser: "En la cabalgata, los camellos caminan al ritmo de la música. Bartolo, de momento, camina al ritmo de sus tropiezos.",
        paragraphs: [
          "En el pueblo ensayaban la cabalgata. Había cintas de colores, tambores y una trompeta dorada que sonaba ta-ra-rííí.",
          "—Los camellos de los Reyes caminan al ritmo de la música —dijo Bartolo—. Mira.",
          "Dio un paso, otro, se le cruzaron las patas y acabó sentado en el suelo, con una cinta enredada en la oreja.",
          "{N} se rio, pero no de él, sino con él. Y luego le ayudó a levantarse.",
          "—Vamos a contar juntos. Un, dos. Un, dos. La pata de delante con el un, la de detrás con el dos.",
          "Un, dos. Un, dos. La trompeta tocaba y Bartolo contaba en voz alta, muy concentrado.",
          "Al cabo de un rato, ya no tropezaba. Al cabo de otro rato, hasta movía la cola al compás.",
          "—¡Estoy desfilando! —gritó, tan feliz que la trompeta se equivocó de nota.",
        ],
        question: "¿Qué música te gustaría que tocaran en tu cabalgata?",
      },
      ca: {
        title: "{N} i la trompeta de la cavalcada",
        teaser: "A la cavalcada, els camells caminen al ritme de la música. En Bartolo, de moment, camina al ritme de les seves ensopegades.",
        paragraphs: [
          "Al poble assajaven la cavalcada. Hi havia cintes de colors, tambors i una trompeta daurada que sonava ta-ra-rííí.",
          "—Els camells dels Reis caminen al ritme de la música —va dir en Bartolo—. Mira.",
          "Va fer una passa, una altra, se li van creuar les potes i va acabar assegut a terra, amb una cinta embolicada a l'orella.",
          "{N} va riure, però no d'ell, sinó amb ell. I després el va ajudar a aixecar-se.",
          "—Comptem junts. U, dos. U, dos. La pota del davant amb l'u, la del darrere amb el dos.",
          "U, dos. U, dos. La trompeta tocava i en Bartolo comptava en veu alta, molt concentrat.",
          "Al cap d'una estona, ja no ensopegava. Al cap d'una altra estona, fins i tot movia la cua al compàs.",
          "—Estic desfilant! —va cridar, tan feliç que la trompeta es va equivocar de nota.",
        ],
        question: "Quina música t'agradaria que toquessin a la teva cavalcada?",
      },
    },
  },
  // 10
  {
    art: art("reyes/reyes-c3camelsa-workout"),
    artAlt: {
      es: "Tres camellos saltan sobre un muro de piedra",
      ca: "Tres camells salten damunt d'un mur de pedra",
    },
    stories: {
      es: {
        title: "{v} y la gimnasia de los camellos",
        teaser: "Sobre el muro del pueblo, los camellos de la caravana hacían gimnasia. Bartolo quería apuntarse.",
        paragraphs: [
          "Sobre el muro del pueblo, tres camellos de la caravana hacían gimnasia: estirar el cuello, doblar las rodillas, saltar de piedra en piedra.",
          "—Para cargar los sacos de regalos hay que estar en forma —le explicó uno de ellos a Bartolo.",
          "Bartolo quiso apuntarse, pero en el primer salto se quedó con una pata arriba y otra abajo, como una mesa coja.",
          "{N} se quedó abajo, en la hierba, y le propuso empezar por lo fácil: estirarse hacia el cielo, como un árbol, y luego tocarse las rodillas, como un puente.",
          "Arriba, abajo. Arriba, abajo. Bartolo lo hizo tan bien que los camellos grandes le aplaudieron con las pezuñas, que suena como tac-tac-tac.",
          "Al terminar, se tumbaron los dos al sol, cansados y contentos.",
          "—Mañana, dos saltos —dijo Bartolo.",
          "—Y un estiramiento más —dijo {n}, bostezando.",
        ],
        question: "¿Te estiras como un árbol antes de dormir? Prueba ahora: arriba, abajo.",
      },
      ca: {
        title: "{N} i la gimnàstica dels camells",
        teaser: "Damunt del mur del poble, els camells de la caravana feien gimnàstica. En Bartolo s'hi volia apuntar.",
        paragraphs: [
          "Damunt del mur del poble, tres camells de la caravana feien gimnàstica: estirar el coll, doblegar els genolls, saltar de pedra en pedra.",
          "—Per carregar els sacs de regals cal estar en forma —va explicar un d'ells a en Bartolo.",
          "En Bartolo s'hi va voler apuntar, però al primer salt es va quedar amb una pota amunt i una altra avall, com una taula coixa.",
          "{N} es va quedar a baix, a l'herba, i li va proposar començar pel més fàcil: estirar-se cap al cel, com un arbre, i després tocar-se els genolls, com un pont.",
          "Amunt, avall. Amunt, avall. En Bartolo ho va fer tan bé que els camells grans el van aplaudir amb les peülles, que fan un soroll com tac-tac-tac.",
          "En acabar, es van estirar tots dos al sol, cansats i contents.",
          "—Demà, dos salts —va dir en Bartolo.",
          "—I un estirament més —va dir {n}, badallant.",
        ],
        question: "T'estires com un arbre abans d'anar a dormir? Prova-ho ara: amunt, avall.",
      },
    },
  },
  // 11
  {
    art: art("reyes/reyes-c3camelsb-cloud"),
    artAlt: {
      es: "Una nube enorme sobre los tejados del pueblo",
      ca: "Un núvol enorme damunt les teulades del poble",
    },
    stories: {
      es: {
        title: "{v} y la nube con forma de regalo",
        teaser: "Tumbados en la colina, {n} y Bartolo jugaron a encontrar formas en las nubes. Y apareció una muy especial.",
        paragraphs: [
          "Esa tarde no había que aprender nada. Bartolo y {n} se tumbaron en la colina, por encima de los tejados del pueblo, a mirar las nubes.",
          "—Esa parece una oveja —dijo {n}.",
          "—Y esa, una tetera —dijo Bartolo.",
          "Vieron un dragón con sombrero, una bicicleta y una cuchara gigante. Y entonces apareció una nube enorme, cuadrada, con un lazo encima.",
          "—¡Un regalo! —dijeron los dos a la vez.",
          "Bartolo se quedó pensativo.",
          "—¿Sabes qué es lo que más me gusta de la noche de Reyes? Imaginar las caras de los niños por la mañana.",
          "{N} sonrió. El viento empujó la nube despacito, y el regalo se convirtió en un barco, y el barco en un gato dormido.",
          "—Hasta las nubes se van a dormir —susurró Bartolo.",
        ],
        question: "¿Qué forma tendría tu nube favorita?",
      },
      ca: {
        title: "{N} i el núvol amb forma de regal",
        teaser: "Estirats al turó, {n} i en Bartolo van jugar a trobar formes als núvols. I en va aparèixer un de molt especial.",
        paragraphs: [
          "Aquella tarda no calia aprendre res. En Bartolo i {n} es van estirar al turó, per sobre de les teulades del poble, a mirar els núvols.",
          "—Aquell sembla una ovella —va dir {n}.",
          "—I aquell, una tetera —va dir en Bartolo.",
          "Van veure un drac amb barret, una bicicleta i una cullera gegant. I aleshores va aparèixer un núvol enorme, quadrat, amb un llaç a sobre.",
          "—Un regal! —van dir tots dos alhora.",
          "En Bartolo es va quedar pensatiu.",
          "—Saps què és el que més m'agrada de la nit de Reis? Imaginar la cara dels nens i les nenes al matí.",
          "{N} va somriure. El vent va empènyer el núvol a poc a poc, i el regal es va convertir en un vaixell, i el vaixell en un gat adormit.",
          "—Fins i tot els núvols se'n van a dormir —va xiuxiuejar en Bartolo.",
        ],
        question: "Quina forma tindria el teu núvol preferit?",
      },
    },
  },
  // 12
  {
    art: art("reyes/reyes-c3camelsb-lullaby"),
    artAlt: {
      es: "Una calle tranquila de noche, con las ventanas encendidas",
      ca: "Un carrer tranquil de nit, amb les finestres enceses",
    },
    stories: {
      es: {
        title: "{v} y las patas de puntillas",
        teaser: "La noche de Reyes, los camellos no pueden hacer ruido. Y las patas de Bartolo suenan como cuatro tambores.",
        paragraphs: [
          "La noche de Reyes, los camellos tienen que pasar por las calles sin despertar a nadie. Pero las patas de Bartolo sonaban como cuatro tambores: plom, plom, plom, plom.",
          "—Así no —dijo {n}—. Hay que ir de puntillas.",
          "Esa noche salieron a practicar por la calle dormida. Las ventanas brillaban amarillas, como galletas recién hechas, y de las casas salían ronquidos pequeñitos.",
          "{N} iba delante, pisando despacito, primero la punta, luego el talón. Bartolo iba detrás, copiando cada paso.",
          "Plom… plom… plo… pl…",
          "Al final de la calle ya no se oía nada. Solo el viento y, muy lejos, una lechuza.",
          "—Lo he conseguido —susurró Bartolo, tan bajito que {n} tuvo que acercarse para oírlo.",
          "Y volvieron a casa de puntillas, aunque ya no hiciera falta, porque les había gustado.",
        ],
        question: "¿Sabes caminar de puntillas sin hacer nada de ruido?",
      },
      ca: {
        title: "{N} i les potes de puntetes",
        teaser: "La nit de Reis, els camells no poden fer soroll. I les potes d'en Bartolo sonen com quatre tambors.",
        paragraphs: [
          "La nit de Reis, els camells han de passar pels carrers sense despertar ningú. Però les potes d'en Bartolo sonaven com quatre tambors: plom, plom, plom, plom.",
          "—Així no —va dir {n}—. Cal anar de puntetes.",
          "Aquella nit van sortir a practicar pel carrer adormit. Les finestres brillaven grogues, com galetes acabades de fer, i de les cases en sortien roncs petitons.",
          "{N} anava al davant, trepitjant a poc a poc, primer la punta, després el taló. En Bartolo anava al darrere, copiant cada passa.",
          "Plom… plom… plo… pl…",
          "Al final del carrer ja no se sentia res. Només el vent i, molt lluny, una òliba.",
          "—Ho he aconseguit —va xiuxiuejar en Bartolo, tan fluixet que {n} s'hi va haver d'acostar per sentir-lo.",
          "I van tornar a casa de puntetes, encara que ja no calgués, perquè els havia agradat.",
        ],
        question: "Saps caminar de puntetes sense fer gens de soroll?",
      },
    },
  },
  // 13
  {
    art: art("reyes/reyes-c3camelsb-statues"),
    artAlt: {
      es: "Camellos quietos como estatuas delante de una juguetería",
      ca: "Camells quiets com estàtues davant d'una botiga de joguines",
    },
    stories: {
      es: {
        title: "{v} y el juego de las estatuas",
        teaser: "Delante de la juguetería, los camellos de la caravana jugaban a las estatuas. Y Bartolo, el que no sabía estarse quieto, quería jugar.",
        paragraphs: [
          "Delante del escaparate de la juguetería, los camellos de la caravana jugaban a las estatuas. Cuando alguien decía «¡ya!», todos se quedaban quietos como si fueran de piedra.",
          "—¿Puedo jugar? —preguntó Bartolo.",
          "Los camellos grandes se miraron. Todo el mundo sabía que Bartolo no sabía estarse quieto.",
          "Pero {n} le guiñó un ojo y le recordó el truco: respirar despacio, mirar un punto fijo y pensar en algo bonito.",
          "—¡Ya! —gritó {n}.",
          "Bartolo se quedó quieto. Quieto de verdad. Una paloma se le posó en la joroba. Un niño que pasaba dijo: «Mamá, mira qué estatua de camello tan bonita».",
          "Bartolo aguantó, aguantó… hasta que la paloma le hizo cosquillas con las patas y se le escapó la risa.",
          "—¡Has ganado tú! —le dijeron los camellos grandes. Y era verdad.",
        ],
        question: "¿Cuánto rato aguantas tú [quieto|quieta|sin moverte] como una estatua?",
      },
      ca: {
        title: "{N} i el joc de les estàtues",
        teaser: "Davant de la botiga de joguines, els camells de la caravana jugaven a estàtues. I en Bartolo, el que no sabia estar-se quiet, hi volia jugar.",
        paragraphs: [
          "Davant de l'aparador de la botiga de joguines, els camells de la caravana jugaven a estàtues. Quan algú deia «ja!», tots es quedaven quiets com si fossin de pedra.",
          "—Puc jugar? —va preguntar en Bartolo.",
          "Els camells grans es van mirar. Tothom sabia que en Bartolo no sabia estar-se quiet.",
          "Però {n} li va picar l'ullet i li va recordar el truc: respirar a poc a poc, mirar un punt fix i pensar en alguna cosa bonica.",
          "—Ja! —va cridar {n}.",
          "En Bartolo es va quedar quiet. Quiet de debò. Un colom se li va posar a la gepa. Un nen que passava va dir: «Mama, mira quina estàtua de camell tan bonica».",
          "En Bartolo va aguantar, va aguantar… fins que el colom li va fer pessigolles amb les potes i se li va escapar el riure.",
          "—Has guanyat tu! —li van dir els camells grans. I era veritat.",
        ],
        question: "Quanta estona aguantes tu [quiet|quieta|sense moure't] com una estàtua?",
      },
    },
  },
  // 14
  {
    art: art("reyes/reyes-c3camelsc-balloons"),
    artAlt: {
      es: "Tres globos de colores vuelan sobre un prado",
      ca: "Tres globus de colors volen damunt d'un prat",
    },
    stories: {
      es: {
        title: "{v} y los globos que se escaparon",
        teaser: "Tres globos de colores se escaparon de la feria. Bartolo los quería atrapar todos.",
        paragraphs: [
          "De la feria del pueblo se escaparon tres globos: uno rojo, uno verde y uno azul. Subían despacito por encima del prado.",
          "—¡Los atrapo! —dijo Bartolo, y empezó a dar saltos con el cuello estirado.",
          "Saltó una vez, dos, tres. Los globos subían un poquito más cada vez, como si jugaran con él.",
          "{N} se sentó en la hierba a mirarlos.",
          "—A lo mejor no hace falta atraparlos —dijo—. A lo mejor quieren ir a algún sitio.",
          "Bartolo se sentó a su lado, sin aliento. Los globos se fueron haciendo pequeños, pequeños, hasta parecer tres puntitos de colores.",
          "—¿Adónde crees que van? —preguntó.",
          "—El rojo, a la luna. El verde, al mar. Y el azul… a Oriente, a decirles a los Reyes que lo estás haciendo muy bien.",
          "Bartolo se quedó mirando el cielo un buen rato, con una sonrisa que no le cabía en la cara.",
        ],
        question: "Si tuvieras un globo, ¿adónde lo enviarías?",
      },
      ca: {
        title: "{N} i els globus que es van escapar",
        teaser: "Tres globus de colors es van escapar de la fira. En Bartolo els volia atrapar tots.",
        paragraphs: [
          "De la fira del poble es van escapar tres globus: un de vermell, un de verd i un de blau. Pujaven a poc a poc per sobre del prat.",
          "—Els atrapo! —va dir en Bartolo, i va començar a saltar amb el coll estirat.",
          "Va saltar una vegada, dues, tres. Els globus pujaven una mica més cada cop, com si juguessin amb ell.",
          "{N} es va asseure a l'herba a mirar-los.",
          "—Potser no cal atrapar-los —va dir—. Potser volen anar a algun lloc.",
          "En Bartolo s'hi va asseure al costat, sense alè. Els globus es van anar fent petits, petits, fins que van semblar tres puntets de colors.",
          "—On creus que van? —va preguntar.",
          "—El vermell, a la lluna. El verd, al mar. I el blau… a Orient, a dir als Reis que ho estàs fent molt bé.",
          "En Bartolo es va quedar mirant el cel una bona estona, amb un somriure que no li cabia a la cara.",
        ],
        question: "Si tinguessis un globus, on l'enviaries?",
      },
    },
  },
  // 15
  {
    art: art("reyes/reyes-c3camelsc-fountain"),
    artAlt: {
      es: "Una fuente en una plaza bajo la luna",
      ca: "Una font en una plaça sota la lluna",
    },
    stories: {
      es: {
        title: "{v} y la fuente de los deseos",
        teaser: "En la plaza hay una fuente que, de noche, brilla bajo la luna. Dicen que escucha los deseos.",
        paragraphs: [
          "De noche, la fuente de la plaza brilla bajo la luna, y el agua hace un ruido suave, como alguien que se ríe bajito.",
          "—Dicen que esta fuente escucha los deseos —contó {n}—. Pero solo si los dices en voz muy baja.",
          "Bartolo se acercó al borde. Cerró los ojos, movió las orejas y le susurró algo al agua. Nadie más lo oyó.",
          "Luego le tocó {a}. También cerró los ojos, también susurró. El agua hizo plic, como si dijera «apuntado».",
          "—¿Qué has pedido? —preguntó Bartolo.",
          "—Si lo cuento, no se cumple.",
          "Bartolo asintió muy serio. Pero de camino a casa no pudo aguantarse.",
          "—El mío era ser un buen camello de los Reyes —confesó—. Pero ya no lo cuento más, para que se cumpla.",
          "{N} le dio una palmadita en el cuello. Algunos deseos, pensó, ya se están cumpliendo un poquito cada día.",
        ],
        question: "Si encontraras una fuente de los deseos, ¿qué le pedirías en voz muy bajita?",
      },
      ca: {
        title: "{N} i la font dels desitjos",
        teaser: "A la plaça hi ha una font que, de nit, brilla sota la lluna. Diuen que escolta els desitjos.",
        paragraphs: [
          "De nit, la font de la plaça brilla sota la lluna, i l'aigua fa un soroll suau, com algú que riu fluixet.",
          "—Diuen que aquesta font escolta els desitjos —va explicar {n}—. Però només si els dius en veu molt baixa.",
          "En Bartolo es va acostar a la vora. Va tancar els ulls, va moure les orelles i va xiuxiuejar alguna cosa a l'aigua. Ningú més no ho va sentir.",
          "Després li va tocar {a}. També va tancar els ulls, també va xiuxiuejar. L'aigua va fer plic, com si digués «apuntat».",
          "—Què has demanat? —va preguntar en Bartolo.",
          "—Si ho explico, no es compleix.",
          "En Bartolo va fer que sí amb el cap, molt seriós. Però de camí cap a casa no s'ho va poder aguantar.",
          "—El meu era ser un bon camell dels Reis —va confessar—. Però ja no ho explico més, perquè es compleixi.",
          "{N} li va fer un copet al coll. Alguns desitjos, va pensar, ja s'estan complint una mica cada dia.",
        ],
        question: "Si trobessis una font dels desitjos, què li demanaries en veu molt baixeta?",
      },
    },
  },
  // 16
  {
    art: art("reyes/reyes-c3camelsc-serious"),
    artAlt: {
      es: "Tres camellos con cara muy seria",
      ca: "Tres camells amb cara molt seriosa",
    },
    stories: {
      es: {
        title: "{v} y la cara de camello serio",
        teaser: "Los camellos de los Reyes ensayan su cara más seria para la cabalgata. A Bartolo le da la risa.",
        paragraphs: [
          "Los tres camellos grandes de los Reyes ensayaban su cara para la cabalgata: la cabeza alta, la mirada al frente y la boca muy, muy seria.",
          "—Un camello real no se ríe en público —dijo el más grande, sin mover ni un pelo.",
          "Bartolo lo intentó. Levantó la cabeza, miró al frente y apretó la boca. Pero entonces vio {a} poniendo exactamente la misma cara, con las cejas arrugadas y los mofletes hinchados.",
          "—Pfff… ¡jajajá!",
          "Se rio Bartolo. Se rio {n}. Y luego, sin poder evitarlo, se rio el más pequeño de los camellos grandes, y el mediano, y al final hasta el más grande, que se reía con un ruido como de tetera.",
          "Cuando por fin pararon, el camello grande se secó una lágrima.",
          "—Bueno —dijo—. A lo mejor en la cabalgata se puede sonreír un poquito.",
          "Y así lo decidieron, por mayoría.",
        ],
        question: "¿Cuál es la cara más seria que sabes poner? ¿Y cuánto rato aguantas sin reírte?",
      },
      ca: {
        title: "{N} i la cara de camell seriós",
        teaser: "Els camells dels Reis assagen la cara més seriosa per a la cavalcada. A en Bartolo li agafa el riure.",
        paragraphs: [
          "Els tres camells grans dels Reis assajaven la cara per a la cavalcada: el cap ben alt, la mirada endavant i la boca molt, molt seriosa.",
          "—Un camell reial no riu en públic —va dir el més gran, sense moure ni un pèl.",
          "En Bartolo ho va provar. Va aixecar el cap, va mirar endavant i va estrènyer la boca. Però aleshores va veure {n} fent exactament la mateixa cara, amb les celles arrufades i les galtes inflades.",
          "—Pfff… ha, ha, ha!",
          "Va riure en Bartolo. Va riure {n}. I després, sense poder-ho evitar, va riure el més petit dels camells grans, i el mitjà, i al final fins i tot el més gran, que reia amb un soroll com de tetera.",
          "Quan finalment van parar, el camell gran es va eixugar una llàgrima.",
          "—Bé —va dir—. Potser a la cavalcada es pot somriure una mica.",
          "I així ho van decidir, per majoria.",
        ],
        question: "Quina és la cara més seriosa que saps fer? I quanta estona aguantes sense riure?",
      },
    },
  },
  // 17
  {
    art: art("reyes/reyes-c3mapa-kite"),
    artAlt: {
      es: "Una cometa roja vuela bajo la luna",
      ca: "Un estel vermell vola sota la lluna",
    },
    stories: {
      es: {
        title: "{v} y la cometa de la luna",
        teaser: "Al atardecer sopló un viento perfecto para volar cometas. Y la cometa roja quería llegar hasta la luna.",
        paragraphs: [
          "Al atardecer sopló un viento perfecto. {N} sacó su cometa roja y Bartolo sujetó el hilo con los dientes, con mucho cuidado.",
          "La cometa subió, y subió, y subió. Detrás de las nubes asomó la luna, fina como una uña.",
          "—¡Quiere llegar hasta la luna! —dijo Bartolo, entre dientes.",
          "Entonces una ráfaga tiró tan fuerte que a Bartolo se le escapó el hilo. Por suerte, {n} había atado una pinza de la ropa a la cola para que pesara un poco, y la cometa se quedó flotando, tranquila, sin irse a ninguna parte.",
          "Recogieron el hilo despacito, vuelta a vuelta.",
          "—La noche de Reyes también hará viento —dijo Bartolo—. Tendré que agarrar bien las riendas.",
          "—Y no soltar nunca la cuerda de la caravana —dijo {n}.",
          "Bartolo asintió y miró la luna. Le pareció que la luna también asentía.",
        ],
        question: "¿Has volado alguna vez una cometa? ¿De qué color sería la tuya?",
      },
      ca: {
        title: "{N} i l'estel de la lluna",
        teaser: "Al capvespre va bufar un vent perfecte per fer volar estels. I l'estel vermell volia arribar fins a la lluna.",
        paragraphs: [
          "Al capvespre va bufar un vent perfecte. {N} va treure el seu estel vermell i en Bartolo va agafar el fil amb les dents, amb molta cura.",
          "L'estel va pujar, i va pujar, i va pujar. Darrere els núvols va treure el cap la lluna, prima com una ungla.",
          "—Vol arribar fins a la lluna! —va dir en Bartolo, entre dents.",
          "Aleshores una ventada va estirar tan fort que a en Bartolo se li va escapar el fil. Per sort, {n} havia lligat una pinça d'estendre a la cua perquè pesés una mica, i l'estel es va quedar surant, tranquil, sense anar enlloc.",
          "Van recollir el fil a poc a poc, volta a volta.",
          "—La nit de Reis també farà vent —va dir en Bartolo—. Hauré d'agafar bé les regnes.",
          "—I no deixar anar mai la corda de la caravana —va dir {n}.",
          "En Bartolo va fer que sí amb el cap i va mirar la lluna. Li va semblar que la lluna també feia que sí.",
        ],
        question: "Has fet volar mai un estel? De quin color seria el teu?",
      },
    },
  },
  // 18
  {
    art: art("reyes/reyes-c3mapa-pigeons"),
    artAlt: {
      es: "Palomas en una plaza mayor",
      ca: "Coloms en una plaça major",
    },
    stories: {
      es: {
        title: "{v} y las palomas mensajeras",
        teaser: "En la plaza mayor, las palomas recogen las cartas para los Reyes. Ese día había tantas que necesitaban ayuda.",
        paragraphs: [
          "En la plaza mayor vive una bandada de palomas muy trabajadoras. En diciembre recogen las cartas de los niños y las llevan a Oriente.",
          "Pero ese día había tantas cartas que las palomas no daban abasto. Volaban de aquí para allá, chocaban entre ellas y perdían plumas.",
          "—¡Nosotros os ayudamos! —dijo {n}.",
          "Bartolo se colgó una cesta en la joroba y {n} fue metiendo las cartas, una a una, bien ordenadas: las de los pueblos del mar, a un lado; las de las montañas, al otro.",
          "Las palomas, más tranquilas, se las fueron llevando de diez en diez.",
          "Al final quedó una sola carta en la cesta. Tenía el dibujo de un camello en el sobre.",
          "—Esta es la mía —dijo {n}, con un poco de vergüenza—. ¿Se la llevarás tú?",
          "Bartolo la guardó debajo de su manta, junto al mapa.",
          "—La llevaré yo mismo. Te lo prometo.",
        ],
        question: "¿Qué dibujarías tú en el sobre de tu carta a los Reyes?",
      },
      ca: {
        title: "{N} i els coloms missatgers",
        teaser: "A la plaça major, els coloms recullen les cartes per als Reis. Aquell dia n'hi havia tantes que necessitaven ajuda.",
        paragraphs: [
          "A la plaça major hi viu una colla de coloms molt treballadors. Pel desembre recullen les cartes dels nens i les nenes i les porten a Orient.",
          "Però aquell dia hi havia tantes cartes que els coloms no donaven l'abast. Volaven amunt i avall, xocaven entre ells i perdien plomes.",
          "—Nosaltres us ajudem! —va dir {n}.",
          "En Bartolo es va penjar una cistella a la gepa i {n} hi va anar posant les cartes, una per una, ben ordenades: les dels pobles de mar, a una banda; les de muntanya, a l'altra.",
          "Els coloms, més tranquils, se les van anar emportant de deu en deu.",
          "Al final va quedar una sola carta a la cistella. Tenia el dibuix d'un camell al sobre.",
          "—Aquesta és la meva —va dir {n}, amb una mica de vergonya—. Me la portaràs tu?",
          "En Bartolo la va desar sota la seva manta, al costat del mapa.",
          "—La portaré jo mateix. T'ho prometo.",
        ],
        question: "Què dibuixaries tu al sobre de la teva carta als Reis?",
      },
    },
  },
  // 19
  {
    art: art("reyes/reyes-c1-sack"),
    artAlt: {
      es: "Un saco roto y regalos por la calle",
      ca: "Un sac trencat i regals pel carrer",
    },
    stories: {
      es: {
        title: "{v} y el saco que se rompió",
        teaser: "Al saco de los regalos le salió un agujero, y los paquetes rodaron por toda la calle.",
        paragraphs: [
          "Baltasar le había enviado a Bartolo un saco de prueba, lleno de paquetes vacíos, para que practicara cómo llevarlo.",
          "Bartolo iba muy orgulloso calle abajo cuando oyó un ruido: ¡rasss! El saco se había enganchado en una farola y tenía un agujero enorme.",
          "Los paquetes rodaron por los adoquines: uno rojo, uno azul, uno de lunares…",
          "—¡Qué desastre! —dijo Bartolo, y se tapó los ojos con las pestañas.",
          "{N} no dijo nada. Empezó a recoger paquetes. Luego fue a casa a por aguja e hilo rojo, y entre los dos cosieron el agujero, puntada a puntada.",
          "—Ha quedado una cicatriz —dijo Bartolo, mirando el remiendo.",
          "—Ha quedado más fuerte que antes —dijo {n}—. Los remiendos son como las tiritas: cuentan que algo se arregló.",
          "Bartolo volvió a cargar el saco. Y esta vez, al pasar junto a la farola, la rodeó con mucho cuidado.",
        ],
        question: "¿Alguna vez has arreglado algo que se había roto?",
      },
      ca: {
        title: "{N} i el sac que es va trencar",
        teaser: "Al sac dels regals li va sortir un forat, i els paquets van rodolar per tot el carrer.",
        paragraphs: [
          "En Baltasar havia enviat a en Bartolo un sac de prova, ple de paquets buits, perquè practiqués com portar-lo.",
          "En Bartolo baixava pel carrer molt cofoi quan va sentir un soroll: rasss! El sac s'havia enganxat en un fanal i tenia un forat enorme.",
          "Els paquets van rodolar per les llambordes: un de vermell, un de blau, un de pics…",
          "—Quin desastre! —va dir en Bartolo, i es va tapar els ulls amb les pestanyes.",
          "{N} no va dir res. Va començar a recollir paquets. Després va anar a casa a buscar agulla i fil vermell, i entre tots dos van cosir el forat, punt per punt.",
          "—Ha quedat una cicatriu —va dir en Bartolo, mirant el sargit.",
          "—Ha quedat més fort que abans —va dir {n}—. Els sargits són com les tiretes: expliquen que una cosa es va arreglar.",
          "En Bartolo va tornar a carregar el sac. I aquesta vegada, en passar pel costat del fanal, el va voltar amb molta cura.",
        ],
        question: "Has arreglat mai alguna cosa que s'havia trencat?",
      },
    },
  },
  // 20
  {
    art: art("forest/forest-c2dragon-fireflies"),
    artAlt: {
      es: "Luciérnagas sobre una pradera al anochecer",
      ca: "Lluernes damunt d'un prat al capvespre",
    },
    stories: {
      es: {
        title: "{v} y las luciérnagas de invierno",
        teaser: "En la pradera, al anochecer, cientos de luciérnagas se encendieron a la vez. Tenían algo que enseñarle a Bartolo.",
        paragraphs: [
          "Al anochecer, {n} y Bartolo cruzaron la pradera que hay detrás del bosque. Estaba tan oscuro que Bartolo no se veía ni las pezuñas.",
          "—La noche de Reyes será todavía más oscura —dijo, preocupado—. ¿Y si me pierdo?",
          "Entonces, como si alguien hubiera dado una señal, se encendió una lucecita en la hierba. Luego otra. Luego cien. Luego mil.",
          "Eran luciérnagas de invierno, de las que solo salen las noches de diciembre. Volaban despacio y dibujaban un camino brillante entre las hierbas.",
          "—Siguen a la primera —explicó {n}—. Y la primera sigue a la luna.",
          "Bartolo caminó entre las luces con la boca abierta. No se perdió ni una sola vez.",
          "—Cuando tengas miedo —dijo {n}—, busca una luz pequeña. Siempre hay una.",
          "Las luciérnagas los acompañaron hasta la puerta de casa, y allí se apagaron, una a una, como si dieran las buenas noches.",
        ],
        question: "¿Qué lucecita te gusta tener cerca cuando te vas a dormir?",
      },
      ca: {
        title: "{N} i les lluernes d'hivern",
        teaser: "Al prat, en fer-se fosc, centenars de lluernes es van encendre alhora. Tenien alguna cosa a ensenyar a en Bartolo.",
        paragraphs: [
          "En fer-se fosc, {n} i en Bartolo van travessar el prat que hi ha darrere el bosc. Era tan fosc que en Bartolo no es veia ni les peülles.",
          "—La nit de Reis serà encara més fosca —va dir, amoïnat—. I si em perdo?",
          "Aleshores, com si algú hagués fet un senyal, es va encendre un llumet a l'herba. Després un altre. Després cent. Després mil.",
          "Eren lluernes d'hivern, d'aquelles que només surten les nits de desembre. Volaven a poc a poc i dibuixaven un camí brillant entre les herbes.",
          "—Segueixen la primera —va explicar {n}—. I la primera segueix la lluna.",
          "En Bartolo va caminar entre els llums amb la boca oberta. No es va perdre ni una sola vegada.",
          "—Quan tinguis por —va dir {n}—, busca una llum petita. Sempre n'hi ha una.",
          "Les lluernes els van acompanyar fins a la porta de casa, i allà es van apagar, una per una, com si diguessin bona nit.",
        ],
        question: "Quina llumeta t'agrada tenir a prop quan te'n vas a dormir?",
      },
    },
  },
  // 21
  {
    art: art("reyes/reyes-c3camelsa-ramp"),
    artAlt: {
      es: "Un camino de estrellas sale de un tejado hacia el cielo",
      ca: "Un camí d'estrelles surt d'una teulada cap al cel",
    },
    stories: {
      es: {
        title: "{v} y el camino de estrellas",
        teaser: "Desde el tejado se ve el camino que siguen los Reyes: una cinta de estrellas que cruza el cielo.",
        paragraphs: [
          "Esa noche, {n} abrió la ventana del desván y Bartolo asomó la cabeza desde el jardín, estirando el cuello todo lo que pudo.",
          "—Mira allí —dijo Bartolo—. ¿Ves esa cinta brillante?",
          "Sobre el tejado nacía un camino de estrellas que subía y subía hasta perderse por el lado de Oriente.",
          "—Es el camino de los Reyes. La noche del 5 de enero, la caravana lo sigue de casa en casa, de tejado en tejado.",
          "{N} lo miró un buen rato. Las estrellas parpadeaban, como si se estuvieran preparando.",
          "—¿Y cómo sabéis por dónde hay que ir?",
          "Bartolo sacó el mapa de debajo de la manta. Esta vez no intentó escaparse: se quedó muy quieto, como si también quisiera mirar.",
          "—El mapa dice dónde. Y las estrellas dicen cuándo —dijo Bartolo—. Y yo ya sé leer los dos.",
          "Faltaban tres noches para que Bartolo se marchara. Pero esa noche nadie quiso pensar en eso.",
        ],
        question: "Si pudieras caminar por un camino de estrellas, ¿adónde irías?",
      },
      ca: {
        title: "{N} i el camí d'estrelles",
        teaser: "Des de la teulada es veu el camí que segueixen els Reis: una cinta d'estrelles que travessa el cel.",
        paragraphs: [
          "Aquella nit, {n} va obrir la finestra de les golfes i en Bartolo hi va treure el cap des del jardí, estirant el coll tant com va poder.",
          "—Mira allà —va dir en Bartolo—. Veus aquella cinta brillant?",
          "Damunt la teulada naixia un camí d'estrelles que pujava i pujava fins a perdre's cap a Orient.",
          "—És el camí dels Reis. La nit del 5 de gener, la caravana el segueix de casa en casa, de teulada en teulada.",
          "{N} el va mirar una bona estona. Les estrelles parpellejaven, com si s'estiguessin preparant.",
          "—I com sabeu per on heu d'anar?",
          "En Bartolo va treure el mapa de sota la manta. Aquesta vegada no es va intentar escapar: es va quedar molt quiet, com si també volgués mirar.",
          "—El mapa diu on. I les estrelles diuen quan —va dir en Bartolo—. I jo ja els sé llegir tots dos.",
          "Faltaven tres nits perquè en Bartolo marxés. Però aquella nit ningú no hi va voler pensar.",
        ],
        question: "Si poguessis caminar per un camí d'estrelles, on aniries?",
      },
    },
  },
  // 22
  {
    art: art("forest/forest-c3doorc-whistle"),
    artAlt: {
      es: "Un pájaro en una rama junto a un estanque bajo la luna",
      ca: "Un ocell en una branca al costat d'un estany sota la lluna",
    },
    stories: {
      es: {
        title: "{v} y el pájaro que silbaba bajito",
        teaser: "Un pájaro pequeño, posado en una rama bajo la luna, conocía el silbido secreto de la caravana.",
        paragraphs: [
          "Junto al estanque, bajo una luna redonda, un pájaro pequeño silbaba una canción muy bajita: fiu-fiu-fiuuu.",
          "—¡Ese es el silbido de la caravana! —dijo Bartolo—. Los Reyes lo usan para llamar a los camellos sin despertar a nadie.",
          "—¿Y tú sabes hacerlo? —preguntó {n}.",
          "Bartolo lo intentó. Le salió un fffff que sonaba como una rueda pinchada.",
          "El pájaro se rio (los pájaros también se ríen, pero muy bajito) y repitió la canción despacio, nota a nota.",
          "{N} lo intentó también. Fiu… fiu… fiuuu. ¡Le salió a la primera!",
          "—Enséñame —pidió Bartolo.",
          "Y {n} le enseñó: los labios redondos, poquito aire y pensar en algo que te haga feliz. Al décimo intento, Bartolo silbó. Bajito, pero silbó.",
          "Sobre el estanque, las estrellas reflejadas temblaron, como si aplaudieran.",
        ],
        question: "¿Sabes silbar? Prueba muy bajito, para no despertar a nadie.",
      },
      ca: {
        title: "{N} i l'ocell que xiulava fluixet",
        teaser: "Un ocell petit, posat en una branca sota la lluna, coneixia el xiulet secret de la caravana.",
        paragraphs: [
          "Al costat de l'estany, sota una lluna rodona, un ocell petit xiulava una cançó molt fluixeta: fiu-fiu-fiuuu.",
          "—Aquest és el xiulet de la caravana! —va dir en Bartolo—. Els Reis el fan servir per cridar els camells sense despertar ningú.",
          "—I tu el saps fer? —va preguntar {n}.",
          "En Bartolo ho va provar. Li va sortir un fffff que sonava com una roda punxada.",
          "L'ocell va riure (els ocells també riuen, però molt fluixet) i va repetir la cançó a poc a poc, nota a nota.",
          "{N} també ho va provar. Fiu… fiu… fiuuu. Li va sortir a la primera!",
          "—Ensenya-me'l —va demanar en Bartolo.",
          "I {n} li va ensenyar com es fa: els llavis rodons, poc aire i pensar en alguna cosa que et faci feliç. Al desè intent, en Bartolo va xiular. Fluixet, però va xiular.",
          "Damunt l'estany, les estrelles reflectides van tremolar, com si aplaudissin.",
        ],
        question: "Saps xiular? Prova-ho molt fluixet, per no despertar ningú.",
      },
    },
  },
  // 23
  {
    art: art("castle/castle-c2stairs-moon"),
    artAlt: {
      es: "La luna sobre un prado, con hilos de luz que bajan hasta la hierba",
      ca: "La lluna damunt d'un prat, amb fils de llum que baixen fins a l'herba",
    },
    stories: {
      es: {
        title: "{v} y la luna que lo sabía todo",
        teaser: "La víspera de Nochebuena, Bartolo le hizo una pregunta a la luna. Y la luna contestó.",
        paragraphs: [
          "La víspera de Nochebuena, Bartolo estaba nervioso. No paraba de dar vueltas por el jardín.",
          "—¿Y si no estoy preparado? —le preguntó {a}—. ¿Y si se me olvida todo?",
          "{N} señaló el cielo. La luna estaba enorme, blanca, con hilos de luz que bajaban hasta la hierba.",
          "—Pregúntaselo a ella. La luna lo ve todo.",
          "Bartolo levantó la cabeza y, muy bajito, preguntó: «Luna, ¿soy ya un buen camello de los Reyes?».",
          "La luna no habló, porque las lunas no hablan. Pero uno de sus hilos de luz bajó despacio y fue iluminando, una a una, todas las cosas que había aprendido: la zanahoria del desayuno, el mapa doblado, la bufanda, las puntillas, el remiendo del saco, el silbido…",
          "—Lo sabías desde el principio —sonrió {n}.",
          "Bartolo respiró hondo. Por primera vez en veintitrés días, se quedó quieto sin ningún esfuerzo.",
          "—Mañana me voy —dijo—. Pero no me voy del todo.",
        ],
        question: "¿Qué cosa nueva has aprendido tú este mes?",
      },
      ca: {
        title: "{N} i la lluna que ho sabia tot",
        teaser: "La nit abans de la vigília de Nadal, en Bartolo va fer una pregunta a la lluna. I la lluna va respondre.",
        paragraphs: [
          "La nit abans de la vigília de Nadal, en Bartolo estava neguitós. No parava de donar voltes pel jardí.",
          "—I si no estic preparat? —va preguntar {a}—. I si me n'oblido de tot?",
          "{N} va assenyalar el cel. La lluna era enorme, blanca, amb fils de llum que baixaven fins a l'herba.",
          "—Pregunta-ho a ella. La lluna ho veu tot.",
          "En Bartolo va aixecar el cap i, molt fluixet, va preguntar: «Lluna, ja soc un bon camell dels Reis?».",
          "La lluna no va parlar, perquè les llunes no parlen. Però un dels seus fils de llum va baixar a poc a poc i va anar il·luminant, una per una, totes les coses que havia après: la pastanaga de l'esmorzar, el mapa plegat, la bufanda, les puntetes, el sargit del sac, el xiulet…",
          "—Ho sabies des del principi —va somriure {n}.",
          "En Bartolo va respirar fondo. Per primera vegada en vint-i-tres dies, es va quedar quiet sense fer cap esforç.",
          "—Demà me'n vaig —va dir—. Però no me'n vaig del tot.",
        ],
        question: "Quina cosa nova has après tu aquest mes?",
      },
    },
  },
  // 24 (Nochebuena: leads toward the Reyes book)
  {
    art: art("reyes/reyes-c2sack-rooftops"),
    artAlt: {
      es: "Tejados de noche bajo la luna, con una ventana encendida y regalos junto a las chimeneas",
      ca: "Teulades de nit sota la lluna, amb una finestra encesa i regals al costat de les xemeneies",
    },
    stories: {
      es: {
        title: "{v} y la luz de Nochebuena",
        teaser: "Es Nochebuena, y Bartolo tiene que volver a Oriente con los Reyes. Pero antes, {n} tiene una idea.",
        paragraphs: [
          "Es Nochebuena. En casa huele a cena de fiesta, y por las ventanas de toda la calle se oyen villancicos.",
          "Bartolo esperaba en el jardín con el mapa, la carta {de} y la bufanda bien puesta. Había llegado la hora de volver a Oriente: la caravana sale dentro de pocos días, y él va en ella.",
          "—Os voy a echar de menos —dijo, con las pestañas un poco mojadas.",
          "{N} tenía una idea. Fue a por un farolillo, lo encendió y lo colgó junto a la ventana.",
          "—Para que la noche de Reyes encuentres el camino a esta casa —dijo—. Aunque haya mil tejados, solo este tendrá tu luz.",
          "Bartolo apoyó la frente en la frente {de}, que es como se abrazan los camellos. Luego echó a andar hacia la cinta de estrellas, de puntillas, sin hacer ni un ruido.",
          "Desde muy lejos se oyó un silbido bajito: fiu-fiu-fiuuu.",
          "La luz del farolillo se quedó encendida toda la noche. Y la noche del 5 de enero, alguien volverá a buscarla. Pero esa… esa ya es otra historia.",
        ],
        question: "¿Dónde pondrías tú una luz para que Bartolo encuentre tu casa?",
      },
      ca: {
        title: "{N} i la llum de la Nit de Nadal",
        teaser: "És la Nit de Nadal, i en Bartolo ha de tornar a Orient amb els Reis. Però abans, {n} té una idea.",
        paragraphs: [
          "És la Nit de Nadal. A casa fa olor de sopar de festa, i per les finestres de tot el carrer se senten nadales.",
          "En Bartolo esperava al jardí amb el mapa, la carta {de} i la bufanda ben posada. Havia arribat l'hora de tornar a Orient: la caravana surt d'aquí a pocs dies, i ell hi va.",
          "—Us trobaré a faltar —va dir, amb les pestanyes una mica molles.",
          "{N} va tenir una idea. Va anar a buscar un fanalet, el va encendre i el va penjar al costat de la finestra.",
          "—Perquè la nit de Reis trobis el camí cap a aquesta casa —va dir—. Encara que hi hagi mil teulades, només aquesta tindrà la teva llum.",
          "En Bartolo va recolzar el front contra el front {de}, que és com s'abracen els camells. Després va començar a caminar cap a la cinta d'estrelles, de puntetes, sense fer gens de soroll.",
          "De molt lluny estant es va sentir un xiulet fluixet: fiu-fiu-fiuuu.",
          "La llum del fanalet es va quedar encesa tota la nit. I la nit del 5 de gener, algú tornarà a buscar-la. Però això… això ja és una altra història.",
        ],
        question: "On posaries tu una llum perquè en Bartolo trobi casa teva?",
      },
    },
  },
];
