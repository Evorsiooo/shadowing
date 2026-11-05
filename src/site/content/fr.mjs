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
    contact: 'Contact',
    privacy: 'Confidentialité',
    terms: 'Conditions',
    source: 'Code source',
    signIn: 'Se connecter',
    openApp: 'Ouvrir l’app',
    signInGoogle: 'Se connecter avec Google',
    ogImageAlt: `${SITE.name} : imite un vrai locuteur et vois quels sons diffèrent`,
    crumbs: 'Fil d’Ariane',
    updated: (d) => `Dernière mise à jour : ${d}`,
    legalRef: (href) => `Ceci est une traduction. En cas de différence, c’est la <a href="${href}" hreflang="en" lang="en">version anglaise</a> qui fait foi.`,
    tryHtml: '<strong>Essaie avec un guide à tes côtés.</strong> Euno Shadowing déroule cette routine pour toi : il passe l’extrait en boucle, compte tes passages, t’enregistre et, en anglais, signale où tes sons diffèrent de ceux du locuteur.',
    startFree: 'Commencer gratuitement avec Google',
    readNext: 'À lire ensuite',
  },
  example: {
    aria: 'Exemple de l’onglet Prononciation : dans la phrase « I think this is the one », « think » et « this » sont signalés. Pour « think », le locuteur a le son θ et tu as peut-être dit s.',
    tag: 'Exemple',
    sentence: 'I <mark>think</mark> <mark>this</mark> is the one.',
    word: 'think',
    speaker: 'Locuteur',
    you: 'Toi',
    speakerSound: 'θ',
    youSound: 's',
    note: 'Le locuteur a θ ici ; tu as peut-être dit s. C’est un ordinateur qui écoute : il peut se tromper.',
    more: 'Deux endroits signalés dans cette passe. Pas de note, et chacun peut être écarté.',
  },
  faq: [
    ['C’est quoi le shadowing ?', `Faire du shadowing, c’est parler en même temps qu’un enregistrement, en copiant le rythme, la mélodie et les sons du locuteur d’aussi près que possible. Ça entraîne ta façon de parler, pas seulement ta compréhension. <a href="${L('/what-is-shadowing/')}">Lire le guide complet</a>.`],
    ['C’est quoi Euno Shadowing, et est-ce lié au job shadowing ou à Euno AI ?', `Euno Shadowing est une application web gratuite pour travailler ton accent en faisant du shadowing : tu parles en même temps que de courts extraits de vidéos que tu apportes. Après une passe enregistrée, il compare ton enregistrement à l’audio du locuteur et, en anglais, signale les sons qui diffèrent. Il montre aussi ton rythme et ta mélodie à côté des siens. Il n’a aucun rapport avec les stages d’observation comme Erasmus+, avec le shadowing médical, ni avec la plateforme d’IA d’entreprise Euno. <a href="${L('/what-is-euno-shadowing/')}">Ce qu’il est, et ce qu’il n’est pas</a>.`],
    ['Peut-il corriger ma prononciation ?', 'En partie, et seulement en anglais. Après une passe enregistrée, l’onglet Prononciation compare les sons de ton enregistrement à ceux de l’audio du locuteur et signale jusqu’à trois endroits où les tiens diffèrent, avec les mots concernés. Il montre des différences avec le locuteur, pas des erreurs : il te compare au locuteur que tu as choisi, pas à une transcription ni à un accent standard, et il ne donne pas de note. Il ne t’indique pas où placer la langue ou les lèvres. C’est une fonction bêta et elle peut mal interpréter un son : chaque élément peut être écarté avec « Ça sonne pareil pour moi ». Elle fonctionne dans ton navigateur, sur ordinateur : elle est désactivée tant que tu ne l’actives pas dans Réglages → Analyse, ce qui télécharge une seule fois un modèle vocal d’environ 71 Mo sur ton appareil (depuis Hugging Face, un hébergeur tiers), et ton enregistrement n’est pas envoyé pour cela. Pour le moment, les extraits en français et en espagnol n’ont que les mesures de rythme et de mélodie.'],
    ['Quels retours donne-t-il ?', 'En anglais, l’onglet Prononciation signale jusqu’à trois endroits par passe enregistrée où tes sons diffèrent de l’audio du locuteur (bêta, désactivé par défaut, pas de note). Pour toutes les langues, Euno montre aussi de combien tu étais en retard ou en avance sur le locuteur, où tu as été plus vite ou plus lentement, et où ta hauteur et ton accentuation sont parties ailleurs. Tu peux écouter l’original et ton enregistrement l’un après l’autre ou ensemble. Une vérification optionnelle par reconnaissance vocale (Chrome uniquement, désactivée par défaut) peut signaler des mots peu clairs. Demander à Euno, avec ta propre clé d’IA, permet de répondre à des questions sur tes notes et ces mesures. Euno ne donne pas de note et n’a ni sous-titres ni transcriptions automatiques.'],
    ['C’est payant ?', 'Non. Euno Shadowing est gratuit. L’IA est optionnelle et utilise ta propre clé API : son usage t’est facturé directement par le fournisseur que tu choisis, et c’est toi qui choisis le modèle.'],
    ['Quelles langues et quels accents ?', 'Tu peux pratiquer l’anglais (australien, américain ou britannique du Sud), le français (parisien ou québécois) ou l’espagnol (mexicain, d’Espagne ou rioplatense), ou indiquer un autre accent de ces langues. L’application est disponible en français, en anglais et en espagnol. D’autres langues, comme le japonais et l’allemand, sont prévues. L’onglet Prononciation, au niveau des sons, n’existe qu’en anglais pour le moment.'],
    ['Où sont stockés mes vidéos et mes enregistrements ?', 'Dans ton propre Google Drive. Quand tu le connectes, l’app range tes fichiers dans un dossier « Euno Shadowing », pour que tu les retrouves sur tous les appareils où tu te connectes, et elle ne voit que les fichiers qu’elle crée. Ton navigateur garde aussi une copie des fichiers que tu ouvres pour qu’ils se lancent tout de suite. Notre serveur ne garde que tes notes d’entraînement et tes progrès, jamais l’audio ni la vidéo.'],
    ['Quelles vidéos puis-je utiliser ?', 'N’importe quel fichier vidéo ou audio que tu as le droit d’utiliser pour t’entraîner : importe un fichier depuis ton appareil ou colle un lien direct vers un .mp4. Les interviews, podcasts et conférences avec un seul locuteur bien audible marchent le mieux.'],
    ['Euno propose-t-il des leçons, des vidéos ou des transcriptions ?', 'Non. Tu fais du shadowing sur tes propres vidéos : importe un fichier depuis ton appareil ou colle un lien, puis découpe les extraits que tu veux travailler. Euno n’a ni bibliothèque de leçons, ni sous-titres, ni transcriptions. Il déroule la routine de shadowing sur tes extraits et compare ta voix à celle du locuteur.'],
    ['Faut-il une clé d’IA ?', 'Non. Tout fonctionne sans. Avec une clé Anthropic, OpenAI ou OpenRouter, tu peux interroger Euno dans l’app sur un son, tes notes ou ton entraînement. Sans clé, les notes te donnent un prompt à coller dans n’importe quel chatbot.'],
    ['Puis-je connecter Claude, ChatGPT ou Gemini ?', 'Oui, en option. Dans Réglages → Connexions, tu peux relier Claude, ChatGPT ou Gemini à tes propres données d’entraînement via MCP. Ils peuvent lire tes notes, tes séances et ton historique de prononciation, et rien d’autre : ils ne peuvent rien modifier et ne reçoivent jamais d’audio.'],
    ['Faut-il un micro ?', 'Oui, pour enregistrer tes passages et tes bilans. Un casque ou des écouteurs aident, pour que la voix du locuteur ne passe pas dans ton enregistrement.'],
  ],
  home: {
    title: 'Euno Shadowing : un entraînement gratuit à l’accent qui signale où tes sons diffèrent de ceux du locuteur',
    description: 'Entraînement gratuit à l’accent par le shadowing d’un locuteur que tu choisis. Euno compare ton enregistrement à son audio et signale les sons qui diffèrent (anglais, bêta, pas de note), ainsi que ton rythme et ta mélodie.',
    operatingSystem: 'Tous (navigateur web)',
    browserRequirements: 'Nécessite un navigateur récent avec accès au micro.',
    featureList: ['Retours de prononciation en anglais : signale les sons qui diffèrent de l’audio du locuteur, analysés dans ton navigateur (bêta, pas de note)', 'Séances de shadowing guidées en quatre étapes sur des extraits de tes propres vidéos', 'Historique de prononciation d’une séance à l’autre : ce qui revient', 'Comparaison du rythme et de la mélodie avec le locuteur', 'Enregistrement et écoute côte à côte', 'Demander à Euno : questions et notes traitées avec ta propre clé d’IA (en option)', 'Connexion MCP en lecture seule à Claude, ChatGPT ou Gemini (en option)', 'Bilans sur 12 semaines par rapport à un point de départ', 'Rappels d’entraînement par Discord et par notification'],
    h1: 'Imite un vrai locuteur. Vois quels sons diffèrent.',
    lede: 'Euno Shadowing est une application web gratuite pour travailler ton accent. Découpe un court extrait d’une vidéo de quelqu’un dont tu veux l’accent, parle en même temps que lui pendant quinze minutes, et Euno compare ton enregistrement à l’audio du locuteur et signale les sons qui diffèrent.',
    cta: 'Commencer avec Google',
    how: 'Comment ça marche',
    fine: 'Gratuit, dans ton navigateur. La comparaison des sons n’existe qu’en anglais, et en bêta. Tes fichiers vont dans ton propre Google Drive, pas sur notre serveur.',
    caption: 'Un exemple de l’onglet Prononciation, dessiné pour cette page. Ce n’est pas un vrai enregistrement.',
    howH2: 'Une séance, du début à la fin',
    howIntro: 'Chaque séance porte sur un extrait d’une ou deux phrases. Euno le passe en boucle, compte tes passages et gère le temps : tu n’as plus qu’à écouter et parler.',
    steps: [
      ['Écouter', '2 min.', 'Écoute l’extrait trois fois sans parler. Repère le rythme et les endroits où la voix monte et descend.'],
      ['Faire du shadowing', '7 min.', 'Parle en même temps que le locuteur, environ 15 passages, sans transcription. Copie tout : rythme, mélodie et sons.'],
      ['Enregistrer et comparer', '2 min.', 'Enregistre un passage et écoute-le à côté de l’original. En anglais, l’onglet Prononciation (bêta, désactivé par défaut) signale jusqu’à trois endroits où tes sons diffèrent de ceux du locuteur. Le rythme et la mélodie sont montrés aussi.'],
      ['Recommencer', '4 min.', 'Environ 8 passages de plus, puis un dernier enregistrement à comparer avec le premier.'],
    ],
    after: 'Pas le temps ? Le mode jour sans propose une version de cinq minutes, pour ne jamais sauter un jour. Chaque durée et chaque nombre de passages se règle.',
    soundsH2: 'Tes sons, face à ceux du locuteur',
    soundsIntro: 'Voilà ce que fait l’onglet Prononciation après une passe enregistrée. Il n’existe qu’en anglais, en bêta, et il est désactivé tant que tu ne l’actives pas dans Réglages → Analyse (un téléchargement unique d’environ 71 Mo). Il fonctionne sur ton appareil, et ton enregistrement n’est pas envoyé pour cela.',
    soundsPoints: [
      '<strong>Comparé au locuteur, pas à un manuel.</strong> Euno aligne les sons de ton enregistrement sur ceux de l’audio du locuteur. Il n’utilise ni transcription ni accent standard : la cible, c’est la personne que tu as choisie.',
      '<strong>Jusqu’à trois endroits par passe.</strong> Les mots sont marqués dans la phrase. Ouvre-en un pour voir le son du locuteur et le tien.',
      '<strong>Il s’en souvient.</strong> D’une séance à l’autre, Euno garde la trace des différences qui reviennent et de celles qui se sont calmées, pour que tu saches quoi écouter ensuite.',
      '<strong>Pas de note, et il peut se tromper.</strong> C’est un ordinateur qui écoute. Il peut mal interpréter un son, ou ne rien montrer sur un extrait bruyant : tu décides à l’oreille, et tu peux écarter chaque élément avec « Ça sonne pareil pour moi ».',
    ],
    whatH2: 'Tu choisis le locuteur. Euno gère l’entraînement.',
    whatIntro: 'Euno Shadowing est un outil d’entraînement, pas un cours : il n’y a pas de leçons à suivre. La voix que tu imites est celle que tu as choisie, et la comparaison se fait avec elle.',
    whatPanels: [
      ['Tes extraits, ton locuteur', [
        'Importe un fichier vidéo ou audio, ou colle un lien vers un .mp4, puis découpe un extrait d’une ou deux phrases.',
        'Choisis le locuteur dont tu veux l’accent : un invité d’interview, un podcasteur, quelqu’un que tu admires.',
        'Pas de leçons, de sous-titres ni de transcriptions intégrés. Euno apporte la routine, le chronomètre, l’enregistrement et la comparaison.',
      ]],
      ['Demander à Euno, si tu veux', [
        'Pose une question sur un son, tes notes ou ton entraînement, directement dans l’app. Euno connaît tes notes et ce que l’ordinateur a signalé récemment. Il n’a pas entendu ta voix, donc il peut se tromper.',
        'Il utilise ta propre clé Anthropic, OpenAI ou OpenRouter : tu choisis le modèle et tu paies directement le fournisseur. Seul du texte est envoyé, jamais d’audio.',
        'Pas de clé ? Les notes te donnent un prompt à coller dans n’importe quel chatbot. Tout le reste fonctionne pareil.',
      ]],
    ],
    featH2: 'Autour de l’entraînement',
    cards: [
      ['Des extraits de n’importe quelle vidéo', 'Ajoute une vidéo, puis fais glisser sur la frise pour couper un extrait. Une forme d’onde zoomée t’aide à couper pile dans les pauses.'],
      ['Rythme et mélodie', 'À côté des sons, Euno montre de combien tu étais en retard ou en avance sur le locuteur, et où ta hauteur et ton accentuation sont parties ailleurs. Les extraits en français et en espagnol ont cela.'],
      ['Des notes qui repèrent les tendances', 'Note ce qui sonnait faux. Les problèmes qui reviennent forment une liste de points faibles, pour savoir quoi travailler ensuite.'],
      ['Demander à Euno', 'Des questions sur un son ou ta semaine, avec ta propre clé d’IA. En option.'],
      ['Bilans sur 12 semaines', 'Enregistre un point de départ, puis fais un bilan aux semaines 4, 8 et 12 avec les mêmes exercices, et entends le chemin parcouru.'],
      ['Des rappels qui s’adaptent à ta journée', 'Des rappels optionnels par Discord et par notification du navigateur, pour que l’entraînement ait bien lieu.'],
    ],
    privH2: 'Gratuit, privé, et rien d’hébergé chez nous',
    panels: [
      ['Tes fichiers, dans ton propre Drive', [
        'Les vidéos et les enregistrements de ta voix vont dans un dossier « Euno Shadowing » de ton propre Google Drive, pour que tu les retrouves sur tous tes appareils.',
        'L’app ne voit que les fichiers qu’elle y range, et notre serveur ne les stocke jamais.',
        'Notre serveur ne garde que tes notes d’entraînement, tes réglages et tes progrès, que tu peux exporter ou supprimer quand tu veux.',
        'La comparaison des sons en anglais est calculée dans ton navigateur : ton enregistrement n’est pas envoyé pour cela.',
      ]],
      ['Ta clé d’IA, tes apps d’IA', [
        'Apporte une clé Anthropic, OpenAI ou OpenRouter seulement si tu veux Demander à Euno. Ta clé est chiffrée sur notre serveur et n’est plus jamais affichée, même pas à toi.',
        'Tu peux aussi connecter Claude, ChatGPT ou Gemini à tes propres données d’entraînement, en lecture seule, pour leur poser des questions sur tes progrès. Ils ne reçoivent jamais d’audio et ne peuvent rien modifier.',
        'Pas de clé et pas d’app d’IA ? Tout le reste fonctionne pareil.',
      ]],
    ],
    limitsH2: 'Ce qu’il ne fait pas',
    limitsIntro: 'Pour que tu le saches avant de te connecter.',
    limits: [
      ['Pas de leçons ni de bibliothèque.', 'Tu apportes les vidéos. Euno n’a ni cours, ni extraits prêts à l’emploi, ni sous-titres, ni transcriptions.'],
      ['Pas de note.', 'Rien ne dit juste ou faux. Il montre où tes sons, ton rythme et ta mélodie diffèrent de ceux du locuteur, et un ordinateur peut se tromper.'],
      ['La comparaison des sons n’existe qu’en anglais.', 'C’est une bêta. Les extraits en français et en espagnol ont le rythme et la mélodie pour le moment.'],
      ['Pas de coaching de la bouche.', 'Il ne te dit pas où placer la langue ou les lèvres. Pour un son qui revient sans cesse, associe-le à des paires minimales ou à un guide de phonétique.'],
    ],
    faqH2: 'Questions',
    faqIntro: `Les réponses courtes. Les guides vont plus loin sur <a href="${L('/what-is-shadowing/')}">ce qu’est le shadowing</a> et <a href="${L('/accent-shadowing/')}">la routine quotidienne</a>.`,
    faqMore: `Autre chose ? <a href="${L('/contact/')}">Envoie-nous un message</a>.`,
    finalH2: 'Commence avec un seul extrait',
    finalP: 'Connecte-toi avec Google, ajoute une vidéo d’un locuteur dont tu veux l’accent, découpe une phrase, et lance ta première séance aujourd’hui.',
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
    <p>Pour les extraits en anglais, il y a autre chose à regarder : l’onglet Prononciation (bêta) montre jusqu’à trois endroits où les sons que tu as produits diffèrent de ceux de l’audio du locuteur. Prends chacun comme un endroit à écouter, pas comme un verdict.</p>

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
    description: 'Ce qu’Euno Shadowing stocke, où se trouvent tes enregistrements, ce qui reste sur ton appareil pour l’analyse de prononciation, comment sont traitées les clés d’IA et les données Google, et comment exporter ou supprimer ton compte.',
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
        <tr><td>Vidéos et enregistrements de ta voix</td><td>Un dossier « Euno Shadowing » dans ton propre Google Drive, plus une copie dans ton navigateur des fichiers que tu ouvres pour qu’ils se lancent tout de suite. Si tu choisis de garder tes fichiers uniquement dans ce navigateur (Réglages → Données), ils restent sur ton appareil.</td><td>Pour lire les extraits et comparer tes enregistrements. Nous n’en gardons aucune copie sur notre serveur.</td></tr>
        <tr><td>Clé d’un fournisseur d’IA (optionnelle)</td><td>Notre base de données, chiffrée</td><td>Pour demander un retour de l’IA au fournisseur que tu as choisi, quand tu le demandes</td></tr>
        <tr><td>Webhook et identifiant Discord (optionnels)</td><td>Notre base de données</td><td>Pour envoyer les rappels d’entraînement que tu as configurés</td></tr>
        <tr><td>Résultats de la prononciation en anglais (optionnel)</td><td>Notre base de données, avec tes données d’entraînement</td><td>Pour montrer les sons qui ont différé de ceux du locuteur, les suivre d’une séance à l’autre et, si tu le demandes, les inclure dans un retour de l’IA. Ce sont de courts textes, comme une paire de sons et un mot d’exemple, jamais de l’audio.</td></tr>
        <tr><td>Messages du formulaire de contact</td><td>Notre base de données</td><td>Pour te répondre</td></tr>
        <tr><td>Un cookie de connexion</td><td>Ton navigateur</td><td>Pour que tu restes connecté. C’est le seul cookie que nous déposons, et il est strictement nécessaire.</td></tr>
      </tbody>
    </table>
    <p>Notre hébergeur, Cloudflare, traite des données techniques liées aux requêtes, comme les adresses IP, pour délivrer et protéger le site.</p>

    <h2>Données Google</h2>
    <p>Quand tu te connectes avec Google, nous recevons ton adresse e-mail, ton nom et l’identifiant de ton compte, et rien d’autre. Quand tu connectes Google Drive, nous demandons l’autorisation d’accéder uniquement aux fichiers qu’Euno Shadowing crée dans ton Drive (l’autorisation <code>drive.file</code>). Nous ne pouvons voir aucun de tes autres fichiers.</p>
    <p>L’utilisation et le transfert par Euno Shadowing des informations reçues des API Google respectent le <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">règlement sur les données utilisateur des services d’API Google</a> (Google API Services User Data Policy), y compris les exigences d’utilisation limitée (Limited Use). Nous n’utilisons pas les données Google pour la publicité, ne les vendons pas, et ne laissons personne les lire, sauf si tu nous le demandes (par exemple dans une demande d’assistance), pour des raisons de sécurité, ou si la loi l’exige.</p>

    <h2>Analyse sur ton appareil</h2>
    <p>Ces fonctions optionnelles sont désactivées tant que tu ne les actives pas dans les réglages.</p>
    <ul>
      <li><strong>Vérification de la prononciation en anglais (bêta).</strong> Elle compare ton enregistrement à l’audio du locuteur dans ton navigateur. L’activer télécharge une fois un modèle vocal d’environ 71 Mo depuis Hugging Face, un hébergeur tiers. Hugging Face reçoit la demande de ce fichier, comme n’importe quel site (par exemple ton adresse IP), mais pas tes enregistrements ni tes données d’entraînement. Ton audio n’est pas envoyé pour cette vérification. Ses résultats écrits (les sons qui ont différé, des mots d’exemple et des comptes dans le temps) sont enregistrés avec tes données d’entraînement sur notre serveur, et les applis d’IA que tu connectes via le lien MCP d’Euno peuvent les lire.</li>
      <li><strong>Mots affichés dans l’onglet Prononciation (bêta, facultatif).</strong> Un second réglage distinct, dans Réglages → Analyse, télécharge un modèle de reconnaissance vocale (Whisper) d’environ 80 Mo, une seule fois, depuis Hugging Face, avec les mêmes conditions de confidentialité que ci-dessus. Il s’exécute dans ton navigateur pour afficher les mots au-dessus des sons, car les extraits n’ont pas de transcription. Ton audio n’est pas envoyé pour cela.</li>
      <li><strong>Vérification par reconnaissance vocale (Chrome uniquement).</strong> Elle utilise la reconnaissance vocale intégrée à ton navigateur. Dans Chrome, cela envoie ta voix à Google pendant la vérification, selon la politique de confidentialité de Google.</li>
    </ul>

    <h2>Retours de l’IA</h2>
    <p>Les retours de l’IA sont optionnels. Si tu ajoutes une clé, elle est chiffrée sur notre serveur, n’est jamais renvoyée à ton navigateur et n’est utilisée que quand tu demandes un retour. Le texte de ta note (la phrase, ce qui sonnait faux et tes points faibles récurrents) et de courtes lignes décrivant ce qui a été mesuré sur ton enregistrement (par exemple un son ou une différence de rythme) sont alors envoyés au fournisseur que tu as choisi : Anthropic, OpenAI ou OpenRouter. Sa propre politique de confidentialité s’applique à cette requête. Aucun audio n’est envoyé.</p>

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
    <p>Euno Shadowing est fourni « tel quel », sans garantie d’aucune sorte. Nous ne promettons pas qu’il fonctionnera sans interruption ni erreur, ni qu’il changera ton accent. Les retours de prononciation, y compris les sons que l’app dit différents de ceux du locuteur, sont des estimations automatiques et peuvent être faux. Dans la mesure permise par la loi, nous ne sommes pas responsables des pertes indirectes ou consécutives, ni des pertes de données. Rien dans ces conditions ne limite les droits que tu tiens du droit de la consommation et qui ne peuvent pas être limités.</p>

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
