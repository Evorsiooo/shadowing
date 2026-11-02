// Mots français du site public. La version anglaise (en.mjs) fait référence ; mêmes clés.
const make = ({ SITE, L, host }) => ({
  code: 'fr',
  htmlLang: 'fr-FR',
  ogLocale: 'fr_FR',
  label: 'Français',
  date: (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  ui: {
    skip: 'Aller au contenu',
    homeAria: `${SITE.name}, accueil`,
    mainNav: 'Navigation principale',
    footerNav: 'Pied de page',
    langNav: 'Langue',
    langNow: 'Langue : français',
    navWhat: 'C’est quoi le shadowing ?',
    navRoutine: 'Routine quotidienne',
    footRoutine: 'Routine de shadowing pour l’accent',
    contact: 'Contact',
    privacy: 'Confidentialité',
    terms: 'Conditions',
    signIn: 'Se connecter',
    openApp: 'Ouvrir l’app',
    signInGoogle: 'Se connecter avec Google',
    ogImageAlt: `${SITE.name} : la courbe de mélodie du locuteur et la tienne, avec le décalage entre les deux`,
    crumbs: 'Fil d’Ariane',
    updated: (d) => `Dernière mise à jour : ${d}`,
    legalRef: (href) => `Ceci est une traduction. En cas de différence, c’est la <a href="${href}" hreflang="en" lang="en">version anglaise</a> qui fait foi.`,
    tryHtml: '<strong>Essaie avec un guide à tes côtés.</strong> Euno Shadowing déroule cette routine pour toi : il passe l’extrait en boucle, compte tes passages, t’enregistre et affiche ta mélodie et ton décalage à côté de ceux du locuteur.',
    startFree: 'Commencer gratuitement avec Google',
    readNext: 'À lire ensuite',
  },
  demo: {
    title: 'Courbes de mélodie du locuteur et de l’apprenant',
    desc: 'Deux courbes de mélodie sur un court extrait. Celle de l’apprenant suit de près celle du locuteur, avec environ 0,18 seconde de décalage et des montées et descentes un peu plus plates.',
    speaker: 'Locuteur',
    you: 'Toi',
    lag: 'Décalage : 0,18 s',
  },
  compare: {
    title: 'Vue de comparaison : le locuteur face à ton premier et ton dernier enregistrement',
    desc: 'Deux panneaux. Dans le premier, ta courbe de mélodie est 0,31 seconde derrière celle du locuteur et monte et descend moins. Dans le second, après d’autres passages, elle suit de près celle du locuteur, avec 0,18 seconde de décalage.',
    first: 'Enregistrement de l’étape 3',
    last: 'Enregistrement final',
    lagFirst: 'Décalage : 0,31 s',
    lagLast: 'Décalage : 0,18 s',
  },
  faq: [
    ['C’est quoi le shadowing ?', `Faire du shadowing, c’est parler en même temps qu’un enregistrement, en copiant le rythme, la mélodie et les sons du locuteur d’aussi près que possible. Ça entraîne ta façon de parler, pas seulement ta compréhension. <a href="${L('/what-is-shadowing/')}">Lire le guide complet</a>.`],
    ['C’est quoi Euno Shadowing, et est-ce lié au job shadowing ou à Euno AI ?', `Euno Shadowing est une application web gratuite pour travailler ton accent en faisant du shadowing : tu parles en même temps que de courts extraits de vidéos que tu apportes, puis tu compares ta hauteur et ton rythme à ceux du locuteur. Il n’a aucun rapport avec les stages d’observation comme Erasmus+, avec le shadowing médical, ni avec la plateforme d’IA d’entreprise Euno. <a href="${L('/what-is-euno-shadowing/')}">Ce que c’est, et ce que ce n’est pas</a>.`],
    ['Quels retours donne-t-il ?', 'Après une passe enregistrée, il montre ta courbe de hauteur à côté de celle du locuteur, ton décalage, et des différences mesurées de vitesse, de direction de la hauteur et d’accentuation. Une vérification optionnelle par reconnaissance vocale (Chrome uniquement, désactivée par défaut) peut signaler des mots peu clairs. Un retour optionnel de l’IA sur tes notes écrites, qui reçoit aussi ces mesures, utilise ta propre clé API. Pour les extraits en anglais, il y a aussi un onglet Prononciation, décrit juste après. Euno ne donne pas de note, et n’a ni sous-titres ni transcriptions automatiques.'],
    ['Vérifie-t-il ma prononciation ?', 'En anglais, il montre des différences avec le locuteur, pas des erreurs. Après une passe enregistrée, l’onglet Prononciation compare les sons de ton enregistrement à ceux de l’audio du locuteur et signale jusqu’à trois endroits où les tiens diffèrent. Il te compare au locuteur que tu as choisi, pas à une transcription ni à un accent standard, et il ne donne pas de note. Il fonctionne dans ton navigateur : le modèle vocal se télécharge à la première utilisation, et ton enregistrement n’est pas envoyé pour cela. Il peut mal interpréter un son, donc chaque point peut être écarté avec « Ça sonne pareil pour moi ». Les extraits en français et en espagnol n’ont pour l’instant que les mesures de hauteur, de décalage et de rythme.'],
    ['C’est payant ?', 'Non. Euno Shadowing est gratuit. Les retours de l’IA sont optionnels et utilisent ta propre clé API : l’usage de l’IA t’est facturé directement par le fournisseur que tu choisis, et c’est toi qui choisis le modèle.'],
    ['Quelles langues et quels accents ?', 'Tu peux pratiquer l’anglais (australien, américain ou britannique du Sud), le français (parisien ou québécois) ou l’espagnol (mexicain, d’Espagne ou rioplatense), ou indiquer un autre accent de ces langues. L’application est disponible en français, en anglais et en espagnol. D’autres langues, comme le japonais et l’allemand, sont prévues.'],
    ['Où sont stockés mes vidéos et mes enregistrements ?', 'Dans ton propre Google Drive. Quand tu le connectes, l’app range tes fichiers dans un dossier « Euno Shadowing », pour que tu les retrouves sur tous les appareils où tu te connectes, et elle ne voit que les fichiers qu’elle crée. Ton navigateur garde aussi une copie des fichiers que tu ouvres pour qu’ils se lancent tout de suite. Notre serveur ne garde que tes notes d’entraînement et tes progrès, jamais l’audio ni la vidéo.'],
    ['Quelles vidéos puis-je utiliser ?', 'N’importe quel fichier vidéo ou audio que tu as le droit d’utiliser pour t’entraîner : importe un fichier depuis ton appareil ou colle un lien direct vers un .mp4. Les interviews, podcasts et conférences avec un seul locuteur bien audible marchent le mieux.'],
    ['Euno propose-t-il des leçons, des vidéos ou des transcriptions ?', 'Non. Tu fais du shadowing sur tes propres vidéos : importe un fichier depuis ton appareil ou colle un lien, puis découpe les extraits que tu veux travailler. Euno n’a ni bibliothèque de leçons, ni sous-titres, ni transcriptions. Il déroule la routine de shadowing sur tes extraits et compare ta voix à celle du locuteur.'],
    ['Faut-il une clé d’IA ?', 'Non. Tout fonctionne sans. Avec une clé Anthropic, OpenAI ou OpenRouter, tu peux demander un retour sur ce qui sonnait faux dans ton enregistrement. Sans clé, Euno rédige le prompt pour que tu le colles dans n’importe quel chatbot.'],
    ['Faut-il un micro ?', 'Oui, pour enregistrer tes passages et tes bilans. Un casque ou des écouteurs aident, pour que la voix du locuteur ne passe pas dans ton enregistrement.'],
  ],
  home: {
    title: 'Euno Shadowing : le shadowing au quotidien pour ton accent en anglais ou en espagnol',
    description: 'Euno Shadowing est un coach gratuit pour travailler ton accent par le shadowing. Parle en même temps que de vrais extraits, compare ta mélodie et ton rythme à ceux du locuteur, et suis ton accent sur 12 semaines.',
    operatingSystem: 'Tous (navigateur web)',
    browserRequirements: 'Nécessite un navigateur récent avec accès au micro.',
    featureList: ['Séances de shadowing guidées en quatre étapes', 'Comparaison de la mélodie et du rythme avec le locuteur', 'Enregistrement et écoute côte à côte', 'Notes avec retours de l’IA en option (avec ta propre clé)', 'Bilans sur 12 semaines par rapport à un point de départ', 'Retours de prononciation en anglais : les sons qui diffèrent de ceux du locuteur, analysés dans ton navigateur', 'Rappels d’entraînement sur Discord'],
    h1: 'Parle davantage comme les gens que tu écoutes.',
    lede: 'Euno Shadowing est un coach quotidien pour le shadowing : choisis un court extrait, parle en même temps que lui, et vois ta mélodie et ton rythme à côté de ceux du locuteur. Quinze minutes par jour, et ton accent évolue.',
    cta: 'Commencer avec Google',
    how: 'Comment ça marche',
    fine: 'Gratuit. Dans ton navigateur. Tes vidéos et tes enregistrements vont dans ton propre Google Drive, pas sur notre serveur.',
    caption: 'Après chaque passage, Euno aligne ta voix sur celle du locuteur et te montre ton décalage et les endroits où ta mélodie était trop plate.',
    howH2: 'Une séance de 15 minutes, toute prête',
    howIntro: 'Chaque séance porte sur un extrait d’une ou deux phrases. Euno le passe en boucle, compte tes passages et gère le temps : tu n’as plus qu’à écouter et parler.',
    steps: [
      ['Écouter', '2 min.', 'Écoute l’extrait trois fois sans parler. Repère le rythme et les endroits où la voix monte et descend.'],
      ['Faire du shadowing', '7 min.', 'Parle en même temps que le locuteur, environ 15 passages, sans transcription. Copie tout : rythme, mélodie et sons.'],
      ['Enregistrer et comparer', '2 min.', 'Enregistre un passage et écoute-le à côté de l’original. Regarde ta courbe de mélodie et ton décalage.'],
      ['Recommencer', '4 min.', 'Environ 8 passages de plus, puis un dernier enregistrement à comparer avec le premier.'],
    ],
    after: 'Pas le temps ? Le mode jour sans propose une version de cinq minutes, pour ne jamais sauter un jour. Chaque durée et chaque nombre de passages se règle.',
    featH2: 'Tout ce qu’il faut pour une routine de shadowing',
    cards: [
      ['Des extraits de n’importe quelle vidéo', 'Ajoute une vidéo, puis fais glisser sur la frise pour couper un extrait. Une forme d’onde zoomée t’aide à couper pile dans les pauses.'],
      ['Vois ta mélodie', 'Le suivi de la hauteur trace l’intonation du locuteur et la tienne, chacune par rapport à sa propre voix, pour voir où ta voix reste trop plate.'],
      ['Mesure ton décalage', 'Après chaque passage, Euno aligne ton enregistrement sur l’extrait et te dit de combien tu étais en retard ou en avance.'],
      ['Enregistre et compare', 'Écoute l’original, puis toi, l’un après l’autre ou les deux ensemble. Tes enregistrements de l’étape 3 et de la fin sont gardés pour chaque extrait.'],
      ['Des notes qui repèrent les tendances', 'Note ce qui sonnait faux. Les problèmes qui reviennent forment une liste de points faibles, pour savoir quoi travailler ensuite.'],
      ['Bilans sur 12 semaines', 'Enregistre un point de départ, puis fais un bilan aux semaines 4, 8 et 12 avec les mêmes exercices, et entends le chemin parcouru.'],
    ],
    privH2: 'Ta voix reste à toi',
    panels: [
      ['Tes fichiers, dans ton propre Drive', [
        'Les vidéos et les enregistrements de ta voix vont dans un dossier « Euno Shadowing » de ton propre Google Drive, pour que tu les retrouves sur tous tes appareils.',
        'L’app ne voit que les fichiers qu’elle y range, et notre serveur ne les stocke jamais.',
        'Notre serveur ne garde que tes notes d’entraînement, tes réglages et tes progrès, que tu peux exporter ou supprimer quand tu veux.',
        'Les retours de prononciation en anglais sont calculés dans ton navigateur : ton enregistrement n’est pas envoyé pour cela.',
      ]],
      ['Des retours de l’IA avec ta propre clé, si tu veux', [
        'Apporte une clé Anthropic, OpenAI ou OpenRouter et choisis le modèle, du moins cher et rapide au plus performant.',
        'Ta clé est chiffrée sur notre serveur et n’est plus jamais affichée, même pas à toi.',
        'Pas de clé ? Euno rédige le prompt pour que tu le colles dans n’importe quel chatbot.',
      ]],
    ],
    faqH2: 'Questions',
    faqIntro: `Les réponses courtes. Les guides vont plus loin sur <a href="${L('/what-is-shadowing/')}">ce qu’est le shadowing</a> et <a href="${L('/accent-shadowing/')}">la routine quotidienne</a>.`,
    faqMore: `Autre chose ? <a href="${L('/contact/')}">Envoie-nous un message</a>.`,
    whatH2: 'Tu choisis le locuteur. Euno gère l’entraînement.',
    whatIntro: 'Euno Shadowing est un outil d’entraînement, pas un cours. Il n’a pas de leçons : la voix que tu imites est celle que tu as choisie.',
    whatPanels: [
      ['Fais du shadowing sur tes propres vidéos', [
        'Importe un fichier vidéo ou audio, ou colle un lien vers un .mp4, puis découpe un extrait d’une ou deux phrases.',
        'Choisis le locuteur dont tu veux l’accent : un invité d’interview, un podcasteur, quelqu’un que tu admires.',
        'Pas de leçons, de sous-titres ni de transcriptions intégrés. Euno apporte la routine, le chronomètre, l’enregistrement et la comparaison.',
      ]],
      ['Un retour IA, si tu le veux', [
        'Note ce qui sonnait faux dans un enregistrement et demande un retour à une IA.',
        'Elle utilise ta propre clé d’API Anthropic, OpenAI ou OpenRouter : tu choisis le modèle et tu paies directement le fournisseur.',
        'Pas de clé, ou pas d’IA du tout ? Tout le reste fonctionne pareil.',
      ]],
    ],
    cmpH2: 'Vois comment ton enregistrement se compare',
    cmpIntro: 'Voici la vue de comparaison. Chaque enregistrement est tracé sur celui du locuteur, pour voir ce qui a changé entre ta première tentative et la dernière.',
    cmpCaption: 'La mélodie du locuteur (vert) et la tienne (bleu) après l’enregistrement de l’étape 3 puis après le dernier : plus proche en timing et en forme.',
    cmpPoints: [
      '<strong>Ta mélodie à côté de la sienne.</strong> Les deux courbes sont mesurées par rapport à la voix de chacun, donc une voix plus aiguë ou plus grave n’a pas d’importance.',
      '<strong>Ton décalage.</strong> Euno aligne les enregistrements et te dit de combien tu étais en retard ou en avance sur le locuteur.',
      '<strong>Le premier enregistrement contre le dernier.</strong> Écoute-les l’un après l’autre, ou ensemble, et entends le changement.',
      '<strong>Les sons qui diffèrent (anglais).</strong> Un onglet Prononciation signale jusqu’à trois endroits où tes sons diffèrent de ceux du locuteur. Il fonctionne dans ton navigateur, ne donne pas de note et peut se tromper.',
    ],
    finalH2: 'Ton premier extrait prend deux minutes',
    finalP: 'Connecte-toi avec Google, choisis un locuteur dont tu veux l’accent, et commence ta première séance aujourd’hui.',
  },
  whatIs: {
    title: 'C’est quoi le shadowing ? Comment la technique aide la prononciation | Euno Shadowing',
    h1: 'C’est quoi le shadowing ?',
    crumb: 'C’est quoi le shadowing ?',
    description: 'Le shadowing consiste à parler en même temps qu’un enregistrement. Découvre comment ça marche, pourquoi ça améliore le rythme et l’intonation, et comment commencer.',
    lede: 'Le shadowing est une technique d’expression orale où tu répètes ce que dit un locuteur pendant qu’il le dit, une fraction de seconde derrière lui, comme son ombre.',
    body: `
    <h2>Comment marche le shadowing</h2>
    <p>Tu lances un court enregistrement d’un locuteur natif ou fluide et tu parles en même temps que lui, à voix haute. Tu n’attends pas la fin de la phrase et tu ne lis pas de transcription. Tes oreilles mènent et ta bouche suit un instant plus tard.</p>
    <p>Comme tu ne peux pas t’arrêter pour réfléchir, tu finis par copier toute la forme du discours, pas seulement les mots : où tombe l’accent tonique, comment la voix monte et descend, quelles syllabes sont avalées et où le locuteur fait des pauses.</p>
    <p>Les interprètes de conférence utilisent depuis longtemps le shadowing comme exercice d’entraînement, et les apprenants en langues l’ont adopté pour s’entraîner à parler sans personne autour.</p>

    <h2>Pourquoi ça aide ton accent</h2>
    <p>Ce qui rend un accent remarquable, ce ne sont pas surtout les sons isolés, c’est la <strong>prosodie</strong> : le rythme, l’accentuation et l’intonation. C’est difficile à apprendre avec des règles, parce qu’il faudrait y penser consciemment en parlant. Le shadowing les entraîne par imitation.</p>
    <ul>
      <li><strong>Rythme et accentuation.</strong> Suivre le rythme d’un locuteur t’oblige à raccourcir les syllabes non accentuées et à allonger les syllabes accentuées comme lui.</li>
      <li><strong>Intonation.</strong> Tu copies la mélodie de phrases entières, y compris ce dont les manuels parlent rarement.</li>
      <li><strong>Parole enchaînée.</strong> Les liaisons, les réductions et les sons qui disparaissent viennent tout seuls, parce qu’on ne peut pas prononcer chaque mot séparément à vitesse normale.</li>
      <li><strong>Aisance.</strong> Répéter le même extrait de nombreuses fois rend les tournures automatiques, et elles sortent plus facilement quand tu parles toi-même.</li>
    </ul>

    <h2>Shadowing ou écouter-répéter ?</h2>
    <p>Avec l’écoute-répétition, tu entends une phrase, puis tu la redis. Ça te laisse le temps de revenir à la façon dont tu <em>penses</em> que la phrase devrait sonner. Avec le shadowing, tu parles pendant la phrase, ce qui garde ton attention sur ce que tu entends vraiment. Les deux sont utiles ; le shadowing est le plus exigeant, et le meilleur pour la prosodie.</p>

    <h2>Comment commencer</h2>
    <ol>
      <li><strong>Choisis un locuteur</strong> dont tu aimerais avoir l’accent. Les interviews et les podcasts avec un son clair et peu de bruit de fond marchent bien.</li>
      <li><strong>Coupe un court extrait</strong> d’une ou deux phrases, environ 10 à 20 secondes.</li>
      <li><strong>Écoute-le plusieurs fois</strong> sans parler.</li>
      <li><strong>Fais du shadowing plusieurs fois de suite</strong>, environ 15 passages. Marmonner au début, c’est normal.</li>
      <li><strong>Enregistre-toi</strong> et compare avec l’original. Qu’est-ce qui sonne encore différemment ?</li>
      <li><strong>Recommence chaque jour.</strong> Quinze minutes par jour valent mieux qu’une heure une fois par semaine.</li>
    </ol>
    <p>Pour un programme quotidien complet, lis <a href="${L('/accent-shadowing/')}">comment améliorer ton accent avec le shadowing</a>.</p>

    <h2>Erreurs fréquentes</h2>
    <ul>
      <li><strong>Des extraits trop longs.</strong> Si tu n’arrives pas à suivre après cinq ou six passages, raccourcis l’extrait.</li>
      <li><strong>Lire en même temps.</strong> Une transcription t’attire vers l’orthographe et t’éloigne du son. Utilise-la une fois pour vérifier les mots, puis mets-la de côté.</li>
      <li><strong>Ne copier que les mots.</strong> Ce qui compte, c’est la mélodie et le rythme. Exagère-les si besoin.</li>
      <li><strong>Ne jamais te réécouter.</strong> On s’entend mal en parlant. Enregistre un passage et compare-le avec l’original.</li>
      <li><strong>Changer de locuteur tous les jours.</strong> Reste un moment avec la même voix pour que les schémas s’installent.</li>
    </ul>`,
  },
  howTo: {
    title: 'Améliorer ton accent en anglais avec le shadowing : une routine quotidienne | Euno Shadowing',
    h1: 'Comment améliorer ton accent en anglais avec le shadowing',
    crumb: 'Routine de shadowing pour l’accent',
    description: 'Une routine de shadowing de 15 minutes par jour pour ton accent en anglais : choisir ses extraits, les quatre étapes, s’enregistrer et mesurer ses progrès sur 12 semaines.',
    lede: 'Une routine de 15 minutes par jour qui rapproche ton accent de celui d’un locuteur que tu choisis : quoi travailler, à quelle fréquence, et comment savoir si ça marche.',
    body: `
    <h2>1. Choisis ton accent visé et ton locuteur</h2>
    <p>Décide quel accent tu veux, par exemple américain, britannique du Sud ou australien, et trouve un locuteur qui l’a. Un seul locuteur te donne un modèle cohérent ; tu pourras en ajouter d’autres plus tard.</p>
    <p>Les bonnes sources sont les interviews, les podcasts et les conférences où une personne parle naturellement. Évite la musique sous la voix, les montages trop serrés et les textes lus, qui sonnent différemment d’une conversation.</p>

    <h2>2. Coupe de courts extraits</h2>
    <p>Chaque séance utilise un extrait d’une ou deux phrases, en général de 10 à 20 secondes. Coupe dans les pauses naturelles pour que l’extrait ne commence ni ne finisse au milieu d’un mot. Choisis des phrases que tu dirais vraiment ; leurs schémas passeront plus vite dans ta façon de parler.</p>
    <p>Un bon rythme : un nouvel extrait un jour sur deux, et entre les deux, l’extrait de la veille. C’est la répétition sur plusieurs jours qui fait durer le changement.</p>

    <h2>3. La séance de 15 minutes</h2>
    <table class="simple">
      <thead><tr><th>Étape</th><th>Durée</th><th>Ce que tu fais</th></tr></thead>
      <tbody>
        <tr><td>Écouter</td><td>2 min</td><td>Écoute l’extrait trois fois sans parler.</td></tr>
        <tr><td>Faire du shadowing</td><td>7 min</td><td>Parle en même temps, environ 15 passages, sans transcription.</td></tr>
        <tr><td>Enregistrer et comparer</td><td>2 min</td><td>Enregistre un passage et compare-le avec l’original.</td></tr>
        <tr><td>Recommencer</td><td>4 min</td><td>Environ 8 passages de plus, puis enregistre un dernier passage et compare-le avec le précédent.</td></tr>
      </tbody>
    </table>
    <p>Les jours chargés, fais une version de cinq minutes : écoute, puis cinq passages de shadowing. Essaie de ne jamais sauter deux jours d’affilée.</p>

    <h2>4. Copie tout, puis cible ce qui résiste</h2>
    <p>À chaque passage, essaie de copier le locuteur d’aussi près que possible, tout à la fois : rythme, mélodie et sons. Ne choisis pas d’objectif de la semaine à l’avance. Note plutôt ce qui sonne encore faux quand tu compares tes enregistrements. Quand la même différence revient plusieurs jours de suite, c’est elle que tu cibles à la dernière étape de ta séance.</p>

    <h2>5. Enregistre-toi, et regarde au lieu de seulement écouter</h2>
    <p>Ta propre voix sonne différemment de l’intérieur, donc l’enregistrement est indispensable. Voir aide aussi : une courbe de mélodie montre si ta voix monte et descend autant que celle du locuteur, et une mesure du décalage montre si tu suis le rythme. Les deux sont difficiles à juger à l’oreille seule.</p>

    <h2>6. Mesure tes progrès sur 12 semaines</h2>
    <p>Un accent change lentement, donc les comparaisons d’un jour à l’autre sont trompeuses. Enregistre un point de départ avant de commencer : quelques phrases lues à voix haute, une minute à raconter un extrait avec tes propres mots, et une minute à répondre à une question que tu n’as pas vue avant. Refais les mêmes exercices aux semaines 4, 8 et 12 et compare. La parole spontanée est le vrai test, car la lecture à voix haute progresse en premier.</p>
    <p>Pour un avis impartial, demande à quelques personnes de noter tes enregistrements sans savoir lequel est lequel.</p>

    <h2>Astuces qui font la différence</h2>
    <ul>
      <li>Utilise des écouteurs : tu entends bien le locuteur, et ton enregistrement ne le capte pas.</li>
      <li>Ralentis un peu l’extrait si tu n’arrives pas à suivre, mais garde une hauteur de voix naturelle.</li>
      <li>Bouge la bouche et le corps comme le locuteur ; exagérer aide au début.</li>
      <li>Entraîne-toi à la même heure chaque jour, et garde ta série.</li>
    </ul>`,
  },
  privacy: {
    title: 'Politique de confidentialité | Euno Shadowing',
    description: 'Ce qu’Euno Shadowing stocke, où se trouvent tes enregistrements, comment sont traitées les clés d’IA et les données Google, et comment exporter ou supprimer ton compte.',
    h1: 'Politique de confidentialité',
    lede: 'En bref : tes vidéos et les enregistrements de ta voix sont gardés dans ton propre Google Drive, pas sur notre serveur. Notre serveur stocke ton compte, tes notes d’entraînement et tes progrès. Nous ne vendons pas de données, n’affichons pas de publicité et n’utilisons aucun pistage.',
    body: `
    <h2>Qui sommes-nous</h2>
    <p>Euno Shadowing (« nous ») est le service d’entraînement au shadowing disponible sur ${host}. Tu peux nous joindre via le <a href="${L('/contact/')}">formulaire de contact</a>.</p>

    <h2>Ce que nous stockons et pourquoi</h2>
    <table class="simple">
      <thead><tr><th>Données</th><th>Où</th><th>Pourquoi</th></tr></thead>
      <tbody>
        <tr><td>L’adresse e-mail, le nom et l’identifiant de ton compte Google</td><td>Notre base de données</td><td>Pour te connecter et identifier ton compte</td></tr>
        <tr><td>Données d’entraînement : ta liste de vidéos, tes extraits, séances, notes, points faibles, résultats de bilans, mesures et réglages</td><td>Notre base de données</td><td>Pour faire fonctionner l’app et afficher tes progrès sur tous tes appareils</td></tr>
        <tr><td>Vidéos et enregistrements de ta voix</td><td>Un dossier « Euno Shadowing » dans ton propre Google Drive, plus une copie dans ton navigateur des fichiers que tu ouvres pour qu’ils se lancent tout de suite. Si tu choisis de garder tes fichiers uniquement dans ce navigateur (Réglages → Stockage), ils restent sur ton appareil.</td><td>Pour lire les extraits et comparer tes enregistrements. Nous n’en gardons aucune copie sur notre serveur.</td></tr>
        <tr><td>Clé d’un fournisseur d’IA (optionnelle)</td><td>Notre base de données, chiffrée</td><td>Pour demander un retour de l’IA au fournisseur que tu as choisi, quand tu le demandes</td></tr>
        <tr><td>Webhook et identifiant Discord (optionnels)</td><td>Notre base de données</td><td>Pour envoyer les rappels d’entraînement que tu as configurés</td></tr>
        <tr><td>Messages du formulaire de contact</td><td>Notre base de données</td><td>Pour te répondre</td></tr>
        <tr><td>Un cookie de connexion</td><td>Ton navigateur</td><td>Pour que tu restes connecté. C’est le seul cookie que nous déposons, et il est strictement nécessaire.</td></tr>
      </tbody>
    </table>
    <p>Notre hébergeur, Cloudflare, traite des données techniques liées aux requêtes, comme les adresses IP, pour délivrer et protéger le site.</p>

    <h2>Données Google</h2>
    <p>Quand tu te connectes avec Google, nous recevons ton adresse e-mail, ton nom et l’identifiant de ton compte, et rien d’autre. Quand tu connectes Google Drive, nous demandons l’autorisation d’accéder uniquement aux fichiers qu’Euno Shadowing crée dans ton Drive (l’autorisation <code>drive.file</code>). Nous ne pouvons voir aucun de tes autres fichiers.</p>
    <p>L’utilisation et le transfert par Euno Shadowing des informations reçues des API Google respectent le <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">règlement sur les données utilisateur des services d’API Google</a> (Google API Services User Data Policy), y compris les exigences d’utilisation limitée (Limited Use). Nous n’utilisons pas les données Google pour la publicité, ne les vendons pas, et ne laissons personne les lire, sauf si tu nous le demandes (par exemple dans une demande d’assistance), pour des raisons de sécurité, ou si la loi l’exige.</p>

    <h2>Retours de l’IA</h2>
    <p>Les retours de l’IA sont optionnels. Si tu ajoutes une clé, elle est chiffrée sur notre serveur, n’est jamais renvoyée à ton navigateur et n’est utilisée que quand tu demandes un retour. Le texte de ta note (la phrase, ce qui sonnait faux et tes points faibles récurrents) est alors envoyé au fournisseur que tu as choisi : Anthropic, OpenAI ou OpenRouter. Sa propre politique de confidentialité s’applique à cette requête. Aucun audio n’est envoyé.</p>

    <h2>Ce que nous ne faisons pas</h2>
    <ul>
      <li>Pas de publicité, pas de traceurs d’analyse, pas de vente ni de location de données.</li>
      <li>Nous n’écoutons pas tes enregistrements ; ils ne sont pas sur notre serveur.</li>
      <li>L’administrateur peut voir les informations du compte (e-mail, date d’inscription, dernière visite, connexion de Google Drive et présence d’une clé d’IA) pour faire fonctionner le service, mais pas le contenu de ton entraînement.</li>
    </ul>

    <h2>Durée de conservation</h2>
    <p>Nous gardons ton compte et tes données d’entraînement jusqu’à ce que tu supprimes ton compte. Les messages de contact sont gardés jusqu’à leur traitement, et pas plus d’un an.</p>

    <h2>Tes droits et tes choix</h2>
    <ul>
      <li><strong>Exporter :</strong> télécharge une sauvegarde complète de tes données d’entraînement depuis les réglages de l’app.</li>
      <li><strong>Supprimer :</strong> supprime ton compte depuis les réglages de l’app, ou demande-le-nous via le formulaire de contact. Cela efface de notre base de données ton compte, tes données d’entraînement, ta clé d’IA et tes réglages de rappels. Les fichiers de ton Google Drive restent à toi, et les copies dans ton navigateur restent jusqu’à ce que tu les effaces.</li>
      <li><strong>Retirer l’accès de Google</strong> à tout moment dans les <a href="https://myaccount.google.com/permissions" rel="noopener">paramètres de ton compte Google</a>.</li>
      <li>Selon l’endroit où tu vis (par exemple avec le RGPD dans l’Union européenne et au Royaume-Uni), tu peux aussi avoir le droit d’accéder à tes données, de les rectifier ou d’en limiter l’utilisation, et de porter plainte auprès de ton autorité de protection des données.</li>
    </ul>

    <h2>Enfants</h2>
    <p>Euno Shadowing n’est pas destiné aux enfants de moins de 13 ans, ou de moins de l’âge minimum requis pour les services numériques dans ton pays.</p>

    <h2>Modifications</h2>
    <p>Si nous modifions cette politique, nous mettrons à jour la date en haut de la page, et nous te préviendrons dans l’app si le changement est important.</p>`,
  },
  terms: {
    title: 'Conditions d’utilisation | Euno Shadowing',
    description: 'Les conditions d’utilisation d’Euno Shadowing, l’app gratuite d’entraînement au shadowing.',
    h1: 'Conditions d’utilisation',
    lede: 'En utilisant Euno Shadowing, tu acceptes ces conditions. Elles sont courtes ; prends le temps de les lire.',
    body: `
    <h2>Le service</h2>
    <p>Euno Shadowing est une app web gratuite pour travailler sa prononciation par le shadowing. Nous pouvons modifier, suspendre ou arrêter le service, ou n’importe laquelle de ses fonctions, à tout moment. Nous essaierons de prévenir avant les gros changements, et tu peux toujours exporter tes données avant.</p>

    <h2>Ton compte</h2>
    <p>Tu te connectes avec un compte Google et tu es responsable de ce qui s’y passe. L’inscription peut parfois demander un code d’invitation. Nous pouvons suspendre ou supprimer les comptes qui ne respectent pas ces conditions ou qui nuisent au service ou à d’autres personnes.</p>

    <h2>Ton contenu</h2>
    <ul>
      <li>Tes enregistrements, tes notes et tes données d’entraînement t’appartiennent. Tu nous donnes seulement l’autorisation nécessaire pour les stocker et les traiter afin de faire fonctionner le service pour toi.</li>
      <li>N’ajoute que des vidéos et des fichiers audio que tu as le droit d’utiliser pour ton entraînement personnel. N’utilise pas Euno Shadowing pour partager ou redistribuer le contenu d’autres personnes.</li>
      <li>C’est à toi de sauvegarder les fichiers qui sont dans ton Google Drive ou sur ton appareil.</li>
    </ul>

    <h2>Fournisseurs d’IA</h2>
    <p>Si tu ajoutes ta propre clé d’IA, les requêtes faites avec elle se font entre toi et ce fournisseur. Ses conditions et ses tarifs s’appliquent, et tu es responsable de cet usage. Les retours de l’IA peuvent se tromper ; fie-toi aussi à ton propre jugement.</p>

    <h2>Utilisation acceptable</h2>
    <p>N’abuse pas du service : pas de tentative d’accéder aux données d’autres personnes, de perturber ou de surcharger le service, de contourner les limites, ni de l’utiliser à des fins illégales.</p>

    <h2>Absence de garantie</h2>
    <p>Euno Shadowing est fourni « tel quel », sans garantie d’aucune sorte. Nous ne promettons pas qu’il fonctionnera sans interruption ni erreur, ni qu’il changera ton accent. Dans la mesure permise par la loi, nous ne sommes pas responsables des pertes indirectes ou consécutives, ni des pertes de données. Rien dans ces conditions ne limite les droits que tu tiens du droit de la consommation et qui ne peuvent pas être limités.</p>

    <h2>Modification de ces conditions</h2>
    <p>Nous pouvons mettre à jour ces conditions. Si tu continues à utiliser Euno Shadowing après un changement, les nouvelles conditions s’appliquent. Si tu n’es pas d’accord, tu peux supprimer ton compte à tout moment.</p>

    <h2>Contact</h2>
    <p>Des questions ? Utilise le <a href="${L('/contact/')}">formulaire de contact</a>.</p>`,
  },
  contact: {
    title: 'Contact et assistance | Euno Shadowing',
    description: 'Une question, un bug ou une idée à propos d’Euno Shadowing ? Envoie-nous un message.',
    h1: 'Contact et assistance',
    lede: 'Une question, un bug, une idée ou une demande à propos de tes données ? Envoie un message et nous te répondrons par e-mail.',
    email: 'Ton e-mail',
    name: 'Nom',
    optional: '(facultatif)',
    topic: 'Sujet',
    topics: { question: 'Une question', bug: 'Quelque chose ne marche pas', feedback: 'Un avis ou une idée', account: 'Mon compte ou mes données' },
    message: 'Message',
    honeypot: 'Laisse ce champ vide',
    send: 'Envoyer le message',
    footnote: `Nous utilisons ton e-mail uniquement pour te répondre. Voir la <a href="${L('/privacy/')}">politique de confidentialité</a>.`,
  },
  notFound: {
    title: 'Page introuvable | Euno Shadowing',
    description: 'Cette page n’existe pas.',
    h1: 'Cette page n’existe pas',
    lede: 'Le lien est peut-être ancien ou mal saisi.',
    home: 'Aller à l’accueil',
  },
});
// French typography: a no-break space before ? ! : ; and inside « », so the sign never wraps onto its own line.
// Only touches a space followed by the sign, so URLs, attributes and tags are left alone.
const nbsp = (x) => x.replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
export const typo = (v) => (typeof v === 'string' ? nbsp(v)
  : typeof v === 'function' ? (...a) => typo(v(...a))
  : Array.isArray(v) ? v.map(typo)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typo(x)]))
  : v);
const makeFr = (h) => { const c = typo(make(h)); c.date = make(h).date; return c; };
makeFr.code = 'fr';
export default makeFr;
