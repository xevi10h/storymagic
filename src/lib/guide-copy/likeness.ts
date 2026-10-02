// /personalized-books/looks-like-your-child — all 4 locales, each written natively.
//
// Facts this page relies on (verify before editing): the traits are exactly the
// "Créalo tú" avatar matrix (lib/avatar/manifest.ts: 5 skin tones, 5 hair colours,
// 6–7 hairstyles per gender, 6 eye colours, round/square glasses in dark/red,
// freckles, portrait per age band ≤ 6 / ≥ 7); the free preview shows the cover,
// the portrait and the first PREVIEW_ILLUSTRATION_COUNT scenes (lib/pricing.ts);
// changing the look in the preview repaints the book (landingFaq.likenessA); p. 27
// prints the hero portrait (docs/product-spec.md). Photo upload is OFF
// (NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED): the `noPhoto` lines render only while it is off.

import type { GuideBaseCopy, GuideFacts, GuideFaq } from "./types";

export interface LikenessGuideCopy extends GuideBaseCopy {
  hubCrumb: string;
  traitsHeading: string;
  traitsIntro: string;
  traits: { label: string; detail: string }[];
  /** One caption per sample portrait (LIKENESS_SAMPLE_PORTRAITS order). */
  portraitCaptions: string[];
  portraitsNote: string;
  examplesHeading: string;
  examplesIntro: string;
  labels: { cover: string; portrait: string; scene: (n: number) => string; child: (name: string, age: number) => string; seeInside: string };
  /** Shown only while photo upload is off. */
  noPhoto: { trust: string; paragraph: string; faq: GuideFaq };
}

type Copy = (f: GuideFacts, previewScenes: number) => LikenessGuideCopy;

const es: Copy = (f, n) => ({
  metaTitle: "Cuento personalizado que se parece a tu hijo | Meapica",
  metaDescription: `Su retrato en acuarela con los rasgos que eliges: piel, pelo, peinado, ojos, gafas y pecas. Ves la portada, su retrato y ${n} escenas antes de pagar.`,
  breadcrumb: "Se parece a tu hijo",
  hubCrumb: "Cuentos personalizados",
  eyebrow: "Su retrato, en cada página",
  h1: "Un cuento personalizado que se parece a tu hijo",
  lead: `Su retrato se pinta en acuarela con los rasgos que tú eliges: tono de piel, color y forma del pelo, color de ojos, gafas y pecas. Antes de pagar ves la portada con su nombre, su retrato y las ${n} primeras escenas de su cuento.`,
  cta: "Crear su libro",
  trust: ["Ves su retrato antes de pagar", "Tapa dura o blanda, con PDF incluido"],
  traitsHeading: "Lo que eliges tú, rasgo a rasgo",
  traitsIntro:
    "No es un niño genérico con su nombre encima. El protagonista se construye con lo que tú ves en tu hijo, y el retrato cambia en el momento con cada elección.",
  traits: [
    { label: "Tono de piel", detail: "Cinco tonos, de muy claro a muy oscuro." },
    { label: "Color de pelo", detail: "Negro, castaño oscuro, castaño, rubio o pelirrojo." },
    { label: "Peinado", detail: "Largo, rizado, trenzas, coletas, afro, rapado… hasta siete estilos." },
    { label: "Color de ojos", detail: "Marrón oscuro, marrón, verde, azul, avellana o gris." },
    { label: "Gafas", detail: "Redondas o cuadradas, negras o rojas. O sin gafas." },
    { label: "Pecas", detail: "Si tiene pecas, su retrato también." },
    { label: "Edad", detail: "El retrato cambia de los más pequeños (hasta 6 años) a los mayores (desde 7)." },
    { label: "Niño, niña o neutro", detail: "Cambia el retrato y la forma de escribir el texto." },
  ],
  portraitCaptions: [
    "Piel clara, rizos pelirrojos, ojos verdes y pecas",
    "Piel clara media, pelo castaño corto y gafas redondas",
    "Piel media y trenzas castaño oscuro",
    "Piel oscura y pelo afro negro",
    "Piel muy oscura y melena larga negra",
    "Piel clara media, media melena rubia y gafas rojas",
  ],
  portraitsNote: "Seis combinaciones de los mismos rasgos que eliges tú. Ninguno es un niño real: son retratos de muestra.",
  examplesHeading: "Lo que ves antes de pagar",
  examplesIntro: `Libros reales de nuestros ejemplos, con lo mismo que verás tú en la vista previa: la portada con su nombre, su retrato y las ${n} primeras escenas.`,
  labels: {
    cover: "Portada",
    portrait: "Retrato",
    scene: (i) => `Escena ${i}`,
    child: (name, age) => `${name}, ${age} años`,
    seeInside: "Ver su libro por dentro",
  },
  sections: [
    {
      heading: "Cómo se pinta su retrato",
      paragraphs: [
        `Con los rasgos que eliges pintamos su retrato en acuarela. Ese retrato es la referencia de todo el libro: cada una de las ${f.scenes} escenas se pinta a partir de él, para que sea el mismo niño en la portada, en mitad de la aventura y en la última página.`,
        "Al final del libro, su retrato vuelve a página completa, junto a su edad y sus cosas favoritas.",
      ],
    },
    {
      heading: "Un retrato que se le parece, no una foto",
      paragraphs: [
        "Es una ilustración, no una fotografía. Se parece a tu hijo porque comparte sus rasgos (su piel, su pelo, sus gafas, sus pecas), no porque copie su cara al detalle. Lo que buscamos es que, al abrir el libro, se señale y diga «soy yo».",
      ],
    },
    {
      heading: "Si algo no encaja, lo cambias",
      paragraphs: [
        `En la vista previa ves su retrato, la portada y las ${n} primeras escenas. Si quieres cambiar algo de su aspecto, lo cambias y volvemos a pintar el libro con el nuevo personaje; el nombre, el mundo, los capítulos y la dedicatoria se mantienen. Imprimimos el libro tal como lo ves.`,
      ],
    },
    {
      heading: "Formato y precio",
      paragraphs: [
        `Libro cuadrado de ${f.size} × ${f.size} cm, ${f.pages} páginas, ${f.scenes} escenas en acuarela y papel estucado seda de ${f.paper} g. Tapa dura, ${f.hardcover} IVA incluido; tapa blanda, ${f.softcover} IVA incluido; las dos con envío gratis a España peninsular y Baleares y el PDF del cuento. Llega en ${f.minDays}-${f.maxDays} días laborables.`,
      ],
    },
  ],
  faq: [
    {
      question: "¿Cómo consigue el cuento parecerse a mi hijo?",
      answer:
        "Tú eliges sus rasgos: tono de piel, color de pelo, peinado, color de ojos, gafas y pecas, además de su edad y si es niño, niña o neutro. Con eso pintamos su retrato en acuarela, y ese retrato es la referencia de todas las escenas del libro.",
    },
    {
      question: "¿Puedo ver su retrato antes de pagar?",
      answer: `Sí. Creas su libro gratis y sin registrarte, y ves la portada con su nombre, su retrato y las ${n} primeras escenas ilustradas. Solo pagas si te gusta.`,
    },
    {
      question: "¿Y si no se parece lo suficiente?",
      answer:
        "Cambias su aspecto en la vista previa y volvemos a pintar el libro con el nuevo personaje; todo lo demás se mantiene. Lo imprimimos tal cual lo ves.",
    },
    {
      question: "¿Hay opciones para niños con gafas, pecas o piel oscura?",
      answer:
        "Sí. Hay cinco tonos de piel, de muy claro a muy oscuro, cinco colores de pelo con peinados como afro, trenzas o rapado, seis colores de ojos, gafas redondas o cuadradas en negro o en rojo, y pecas.",
    },
  ],
  noPhoto: {
    trust: "Sin subir ninguna foto",
    paragraph: "Y como el retrato se crea solo con los rasgos que eliges, no hace falta compartir ninguna foto de tu hijo.",
    faq: {
      question: "¿Tengo que subir una foto de mi hijo?",
      answer: "No. Su retrato se crea solo con los rasgos que eliges; no te pedimos ninguna foto.",
    },
  },
  relatedHeading: "También te puede interesar",
});

const ca: Copy = (f, n) => ({
  metaTitle: "Conte personalitzat que s'assembla al teu fill | Meapica",
  metaDescription: `El seu retrat a l'aquarel·la amb els trets que tries: pell, cabell, ulls, ulleres i pigues. Veus la portada, el retrat i ${n} escenes abans de pagar.`,
  breadcrumb: "S'assembla al teu fill",
  hubCrumb: "Contes personalitzats",
  eyebrow: "El seu retrat, a cada pàgina",
  h1: "Un conte personalitzat que s'assembla al teu fill",
  lead: `El seu retrat es pinta a l'aquarel·la amb els trets que tries tu: el to de pell, el color i la forma del cabell, el color dels ulls, les ulleres i les pigues. Abans de pagar veus la portada amb el seu nom, el seu retrat i les ${n} primeres escenes del conte.`,
  cta: "Crear el seu llibre",
  trust: ["Veus el seu retrat abans de pagar", "Tapa dura o tova, amb PDF inclòs"],
  traitsHeading: "El tries tu, tret a tret",
  traitsIntro:
    "No és un nen qualsevol amb el seu nom al damunt. El protagonista es fa amb el que tu veus en el teu fill, i el retrat canvia a l'instant amb cada tria.",
  traits: [
    { label: "To de pell", detail: "Cinc tons, de molt clar a molt fosc." },
    { label: "Color de cabell", detail: "Negre, castany fosc, castany, ros o pèl-roig." },
    { label: "Pentinat", detail: "Llarg, arrissat, trenes, cuetes, afro, rapat… fins a set estils." },
    { label: "Color dels ulls", detail: "Marró fosc, marró, verd, blau, avellana o gris." },
    { label: "Ulleres", detail: "Rodones o quadrades, negres o vermelles. O sense ulleres." },
    { label: "Pigues", detail: "Si té pigues, el seu retrat també." },
    { label: "Edat", detail: "El retrat canvia dels més petits (fins a 6 anys) als més grans (a partir de 7)." },
    { label: "Nen, nena o neutre", detail: "Canvia el retrat i la manera d'escriure el text." },
  ],
  portraitCaptions: [
    "Pell clara, rínxols pèl-rojos, ulls verds i pigues",
    "Pell clara mitjana, cabell castany curt i ulleres rodones",
    "Pell mitjana i trenes castany fosc",
    "Pell fosca i cabell afro negre",
    "Pell molt fosca i cabellera llarga negra",
    "Pell clara mitjana, mitja melena rossa i ulleres vermelles",
  ],
  portraitsNote: "Sis combinacions dels mateixos trets que tries tu. Cap no és un nen real: són retrats de mostra.",
  examplesHeading: "El que veus abans de pagar",
  examplesIntro: `Llibres reals dels nostres exemples, amb el mateix que veuràs tu a la vista prèvia: la portada amb el seu nom, el seu retrat i les ${n} primeres escenes.`,
  labels: {
    cover: "Portada",
    portrait: "Retrat",
    scene: (i) => `Escena ${i}`,
    child: (name, age) => `${name}, ${age} anys`,
    seeInside: "Veure el seu llibre per dins",
  },
  sections: [
    {
      heading: "Com es pinta el seu retrat",
      paragraphs: [
        `Amb els trets que tries pintem el seu retrat a l'aquarel·la. Aquest retrat és la referència de tot el llibre: cadascuna de les ${f.scenes} escenes es pinta a partir d'ell, perquè sigui el mateix nen a la portada, al bell mig de l'aventura i a l'última pàgina.`,
        "Al final del llibre, el seu retrat torna a pàgina sencera, amb la seva edat i les seves coses preferides.",
      ],
    },
    {
      heading: "Un retrat que s'hi assembla, no una foto",
      paragraphs: [
        "És una il·lustració, no una fotografia. S'assembla al teu fill perquè en comparteix els trets (la pell, el cabell, les ulleres, les pigues), no perquè en copiï la cara fil per randa. El que volem és que, quan obri el llibre, s'assenyali i digui «soc jo».",
      ],
    },
    {
      heading: "Si alguna cosa no et convenç, la canvies",
      paragraphs: [
        `A la vista prèvia veus el seu retrat, la portada i les ${n} primeres escenes. Si vols canviar alguna cosa del seu aspecte, la canvies i tornem a pintar el llibre amb el nou personatge; el nom, el món, els capítols i la dedicatòria es mantenen. L'imprimim tal com el veus.`,
      ],
    },
    {
      heading: "Format i preu",
      paragraphs: [
        `Llibre quadrat de ${f.size} × ${f.size} cm, ${f.pages} pàgines, ${f.scenes} escenes a l'aquarel·la i paper estucat setinat de ${f.paper} g. Tapa dura, ${f.hardcover} IVA inclòs; tapa tova, ${f.softcover} IVA inclòs; totes dues amb l'enviament gratuït a la Península i les Balears i el PDF del conte. Arriba en ${f.minDays}-${f.maxDays} dies laborables.`,
      ],
    },
  ],
  faq: [
    {
      question: "Com fa el conte per assemblar-se al meu fill?",
      answer:
        "Tu tries els seus trets: el to de pell, el color de cabell, el pentinat, el color dels ulls, les ulleres i les pigues, a més de l'edat i si és nen, nena o neutre. Amb això pintem el seu retrat a l'aquarel·la, i aquest retrat és la referència de totes les escenes del llibre.",
    },
    {
      question: "Puc veure el seu retrat abans de pagar?",
      answer: `Sí. Crees el seu llibre gratis i sense registrar-te, i veus la portada amb el seu nom, el seu retrat i les ${n} primeres escenes il·lustrades. Només pagues si t'agrada.`,
    },
    {
      question: "I si no s'hi assembla prou?",
      answer:
        "Canvies el seu aspecte a la vista prèvia i tornem a pintar el llibre amb el nou personatge; tota la resta es manté. L'imprimim tal com el veus.",
    },
    {
      question: "Hi ha opcions per a nens amb ulleres, pigues o pell fosca?",
      answer:
        "Sí. Hi ha cinc tons de pell, de molt clar a molt fosc, cinc colors de cabell amb pentinats com afro, trenes o rapat, sis colors d'ulls, ulleres rodones o quadrades en negre o en vermell, i pigues.",
    },
  ],
  noPhoto: {
    trust: "Sense pujar cap foto",
    paragraph: "I com que el retrat es crea només amb els trets que tries, no cal compartir cap foto del teu fill.",
    faq: {
      question: "He de pujar una foto del meu fill?",
      answer: "No. El seu retrat es crea només amb els trets que tries; no et demanem cap foto.",
    },
  },
  relatedHeading: "També et pot interessar",
});

const en: Copy = (f, n) => ({
  metaTitle: "A personalised book that looks like your child | Meapica",
  metaDescription: `Their watercolour portrait, made from the features you pick: skin, hair, eyes, glasses and freckles. See the cover, portrait and ${n} scenes before you pay.`,
  breadcrumb: "Looks like your child",
  hubCrumb: "Personalised books",
  eyebrow: "Their portrait, on every page",
  h1: "A personalised book that looks like your child",
  lead: `Their portrait is painted in watercolour from the features you choose: skin tone, hair colour and style, eye colour, glasses and freckles. Before you pay, you see the cover with their name, their portrait and the first ${n} scenes of their story.`,
  cta: "Create their book",
  trust: ["See their portrait before you pay", "Hardcover or softcover, PDF included"],
  traitsHeading: "You choose it, feature by feature",
  traitsIntro:
    "It isn't a generic child with a name printed on top. The hero is built from what you see in your child, and the portrait changes instantly with every choice.",
  traits: [
    { label: "Skin tone", detail: "Five tones, from very light to very dark." },
    { label: "Hair colour", detail: "Black, dark brown, brown, blonde or red." },
    { label: "Hairstyle", detail: "Long, curly, braids, pigtails, afro, buzz cut… up to seven styles." },
    { label: "Eye colour", detail: "Dark brown, brown, green, blue, hazel or grey." },
    { label: "Glasses", detail: "Round or square, black or red. Or no glasses." },
    { label: "Freckles", detail: "If they have freckles, so does their portrait." },
    { label: "Age", detail: "The portrait changes from little ones (up to 6) to older children (7 and up)." },
    { label: "Boy, girl or neutral", detail: "Changes the portrait and how the story is written." },
  ],
  portraitCaptions: [
    "Light skin, red curls, green eyes and freckles",
    "Medium-light skin, short brown hair and round glasses",
    "Medium skin and dark-brown braids",
    "Dark skin and black afro",
    "Very dark skin and long black hair",
    "Medium-light skin, blonde bob and red glasses",
  ],
  portraitsNote: "Six combinations of the same features you choose from. None of them is a real child: these are sample portraits.",
  examplesHeading: "What you see before you pay",
  examplesIntro: `Real books from our examples, showing exactly what you get in the preview: the cover with their name, their portrait and the first ${n} scenes.`,
  labels: {
    cover: "Cover",
    portrait: "Portrait",
    scene: (i) => `Scene ${i}`,
    child: (name, age) => `${name}, ${age}`,
    seeInside: "Look inside the book",
  },
  sections: [
    {
      heading: "How their portrait is painted",
      paragraphs: [
        `We paint their portrait in watercolour from the features you choose. That portrait is the reference for the whole book: each of the ${f.scenes} scenes is painted from it, so it's the same child on the cover, in the middle of the adventure and on the last page.`,
        "At the end of the book, their portrait returns as a full page, next to their age and their favourite things.",
      ],
    },
    {
      heading: "A portrait that looks like them, not a photo",
      paragraphs: [
        "It's an illustration, not a photograph. It looks like your child because it shares their features (their skin, their hair, their glasses, their freckles), not because it copies their face line by line. What we want is for them to open the book, point and say \"that's me\".",
      ],
    },
    {
      heading: "If something isn't right, change it",
      paragraphs: [
        `In the preview you see their portrait, the cover and the first ${n} scenes. If you want to change something about how they look, change it and we paint the book again with the new character; the name, the world, the chapters and the dedication stay. We print the book exactly as you see it.`,
      ],
    },
    {
      heading: "Format and price",
      paragraphs: [
        `A square ${f.size} × ${f.size} cm book, ${f.pages} pages, ${f.scenes} watercolour scenes on ${f.paper} gsm silk paper. Hardcover ${f.hardcover} VAT included; softcover ${f.softcover} VAT included; both with free delivery and the PDF of the story. We currently deliver to mainland Spain and the Balearic Islands, in ${f.minDays}-${f.maxDays} working days.`,
      ],
    },
  ],
  faq: [
    {
      question: "How does the book end up looking like my child?",
      answer:
        "You choose their features: skin tone, hair colour, hairstyle, eye colour, glasses and freckles, plus their age and whether they're a boy, a girl or neutral. From that we paint their watercolour portrait, which is the reference for every scene in the book.",
    },
    {
      question: "Can I see their portrait before paying?",
      answer: `Yes. You create their book for free, with no account, and see the cover with their name, their portrait and the first ${n} illustrated scenes. You only pay if you like it.`,
    },
    {
      question: "What if it doesn't look enough like them?",
      answer: "Change their look in the preview and we paint the book again with the new character; everything else stays. We print it exactly as you see it.",
    },
    {
      question: "Are there options for children with glasses, freckles or dark skin?",
      answer:
        "Yes. There are five skin tones from very light to very dark, five hair colours with styles such as afro, braids or a buzz cut, six eye colours, round or square glasses in black or red, and freckles.",
    },
  ],
  noPhoto: {
    trust: "No photo upload needed",
    paragraph: "And because the portrait is made only from the features you choose, you don't need to share any photo of your child.",
    faq: {
      question: "Do I have to upload a photo of my child?",
      answer: "No. Their portrait is made only from the features you choose; we never ask for a photo.",
    },
  },
  relatedHeading: "You might also like",
});

const fr: Copy = (f, n) => ({
  metaTitle: "Livre personnalisé qui ressemble à votre enfant | Meapica",
  metaDescription: `Son portrait à l'aquarelle selon les traits choisis : peau, cheveux, yeux, lunettes, taches de rousseur. Couverture, portrait et ${n} scènes avant de payer.`,
  breadcrumb: "Il lui ressemble",
  hubCrumb: "Livres personnalisés",
  eyebrow: "Son portrait, à chaque page",
  h1: "Un livre personnalisé qui ressemble à votre enfant",
  lead: `Son portrait est peint à l'aquarelle à partir des traits que vous choisissez : teint, couleur et coupe de cheveux, couleur des yeux, lunettes et taches de rousseur. Avant de payer, vous voyez la couverture avec son prénom, son portrait et les ${n} premières scènes de son histoire.`,
  cta: "Créer son livre",
  trust: ["Vous voyez son portrait avant de payer", "Couverture rigide ou souple, PDF inclus"],
  traitsHeading: "Vous le composez, trait par trait",
  traitsIntro:
    "Ce n'est pas un enfant générique avec un prénom imprimé dessus. Le héros se construit à partir de ce que vous voyez chez votre enfant, et le portrait change à chaque choix, instantanément.",
  traits: [
    { label: "Teint", detail: "Cinq teintes, du très clair au très foncé." },
    { label: "Couleur des cheveux", detail: "Noirs, châtain foncé, châtains, blonds ou roux." },
    { label: "Coiffure", detail: "Longs, bouclés, tresses, couettes, afro, rasés… jusqu'à sept styles." },
    { label: "Couleur des yeux", detail: "Marron foncé, marron, verts, bleus, noisette ou gris." },
    { label: "Lunettes", detail: "Rondes ou carrées, noires ou rouges. Ou sans lunettes." },
    { label: "Taches de rousseur", detail: "S'il en a, son portrait aussi." },
    { label: "Âge", detail: "Le portrait change entre les plus petits (jusqu'à 6 ans) et les plus grands (dès 7 ans)." },
    { label: "Garçon, fille ou neutre", detail: "Change le portrait et la façon d'écrire le texte." },
  ],
  portraitCaptions: [
    "Peau claire, boucles rousses, yeux verts et taches de rousseur",
    "Peau mate claire, cheveux châtains courts et lunettes rondes",
    "Peau mate et tresses châtain foncé",
    "Peau foncée et cheveux afro noirs",
    "Peau très foncée et longs cheveux noirs",
    "Peau mate claire, carré blond et lunettes rouges",
  ],
  portraitsNote: "Six combinaisons des mêmes traits que ceux que vous choisissez. Aucun n'est un enfant réel : ce sont des portraits d'exemple.",
  examplesHeading: "Ce que vous voyez avant de payer",
  examplesIntro: `De vrais livres de nos exemples, avec exactement ce que vous verrez dans l'aperçu : la couverture avec son prénom, son portrait et les ${n} premières scènes.`,
  labels: {
    cover: "Couverture",
    portrait: "Portrait",
    scene: (i) => `Scène ${i}`,
    child: (name, age) => `${name}, ${age} ans`,
    seeInside: "Feuilleter son livre",
  },
  sections: [
    {
      heading: "Comment son portrait est peint",
      paragraphs: [
        `À partir des traits que vous choisissez, nous peignons son portrait à l'aquarelle. Ce portrait sert de référence à tout le livre : chacune des ${f.scenes} scènes est peinte à partir de lui, pour que ce soit le même enfant sur la couverture, au milieu de l'aventure et à la dernière page.`,
        "À la fin du livre, son portrait revient en pleine page, avec son âge et ses choses préférées.",
      ],
    },
    {
      heading: "Un portrait qui lui ressemble, pas une photo",
      paragraphs: [
        "C'est une illustration, pas une photographie. Il ressemble à votre enfant parce qu'il partage ses traits (son teint, ses cheveux, ses lunettes, ses taches de rousseur), pas parce qu'il recopie son visage trait pour trait. Ce que nous voulons, c'est qu'en ouvrant le livre il se montre du doigt et dise « c'est moi ».",
      ],
    },
    {
      heading: "Si quelque chose ne va pas, vous le changez",
      paragraphs: [
        `Dans l'aperçu, vous voyez son portrait, la couverture et les ${n} premières scènes. Si vous voulez changer quelque chose à son apparence, vous le modifiez et nous repeignons le livre avec le nouveau personnage ; le prénom, l'univers, les chapitres et la dédicace sont conservés. Nous imprimons le livre tel que vous le voyez.`,
      ],
    },
    {
      heading: "Format et prix",
      paragraphs: [
        `Livre carré de ${f.size} × ${f.size} cm, ${f.pages} pages, ${f.scenes} scènes à l'aquarelle sur papier couché satiné de ${f.paper} g. Couverture rigide ${f.hardcover} TVA incluse ; souple ${f.softcover} TVA incluse ; les deux avec la livraison offerte et le PDF de l'histoire. Nous livrons pour l'instant l'Espagne péninsulaire et les Baléares, en ${f.minDays} à ${f.maxDays} jours ouvrés.`,
      ],
    },
  ],
  faq: [
    {
      question: "Comment le livre arrive-t-il à ressembler à mon enfant ?",
      answer:
        "Vous choisissez ses traits : teint, couleur et coupe de cheveux, couleur des yeux, lunettes et taches de rousseur, ainsi que son âge et s'il s'agit d'un garçon, d'une fille ou d'un personnage neutre. Nous peignons alors son portrait à l'aquarelle, qui sert de référence à toutes les scènes du livre.",
    },
    {
      question: "Puis-je voir son portrait avant de payer ?",
      answer: `Oui. Vous créez son livre gratuitement et sans compte, et vous voyez la couverture avec son prénom, son portrait et les ${n} premières scènes illustrées. Vous ne payez que s'il vous plaît.`,
    },
    {
      question: "Et s'il ne lui ressemble pas assez ?",
      answer:
        "Vous modifiez son apparence dans l'aperçu et nous repeignons le livre avec le nouveau personnage ; tout le reste est conservé. Nous l'imprimons tel que vous le voyez.",
    },
    {
      question: "Y a-t-il des options pour les enfants à lunettes, à taches de rousseur ou à la peau foncée ?",
      answer:
        "Oui. Il y a cinq teintes de peau, du très clair au très foncé, cinq couleurs de cheveux avec des coiffures comme l'afro, les tresses ou les cheveux rasés, six couleurs d'yeux, des lunettes rondes ou carrées en noir ou en rouge, et des taches de rousseur.",
    },
  ],
  noPhoto: {
    trust: "Aucune photo à envoyer",
    paragraph: "Et comme le portrait est créé uniquement à partir des traits que vous choisissez, vous n'avez à partager aucune photo de votre enfant.",
    faq: {
      question: "Dois-je envoyer une photo de mon enfant ?",
      answer: "Non. Son portrait est créé uniquement à partir des traits que vous choisissez ; nous ne vous demandons aucune photo.",
    },
  },
  relatedHeading: "À découvrir aussi",
});

export const LIKENESS_GUIDE_COPY: Record<string, Copy> = { es, ca, en, fr };
