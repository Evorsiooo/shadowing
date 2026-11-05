// Textes des guides en français. La version anglaise (guides-en.mjs) est la référence ; mêmes clés.
// Espaces normales devant ? ! : ; et dans « » : typo() (de fr.mjs) les rend insécables.
import { typo } from './fr.mjs';

const make = ({ L }) => ({
  page: {
    title: 'Guides du shadowing : technique, routines et accents | Euno Shadowing',
    description: 'Des guides gratuits sur le shadowing pour la prononciation : comment ça marche, combien de temps ça prend, choisir ses extraits, et des routines et guides d’accents pour l’anglais, le français et l’espagnol.',
    crumb: 'Guides',
    h1: 'Guides du shadowing',
    lede: 'Tout ce qu’il faut pour pratiquer le shadowing seul : comment marche la technique, comment choisir quoi imiter, et ce qu’il faut écouter en anglais, en français et en espagnol.',
    groups: { start: 'Pour commencer', english: 'Anglais', french: 'Français', spanish: 'Espagnol' },
    homeH2: 'Apprendre la technique',
    homeIntro: 'Des guides courts et pratiques sur le shadowing, quelle que soit l’appli que tu utilises.',
    all: 'Tous les guides, avec les accents anglais, français et espagnols →',
  },

  'what-is-euno-shadowing': {
    title: 'C’est quoi Euno Shadowing ? Ce qu’il fait et ne fait pas | Euno Shadowing',
    h1: 'C’est quoi Euno Shadowing ? Ce que c’est, et ce que ce n’est pas',
    crumb: 'C’est quoi Euno Shadowing ?',
    description: 'Euno Shadowing est une application web gratuite pour travailler son accent en faisant du shadowing sur tes propres vidéos. Ce qu’elle fait, ce qu’elle ne fait pas (pas de leçons, de sous-titres ni de transcriptions), et en quoi elle diffère de noms proches.',
    lede: 'Euno Shadowing est une application web gratuite qui déroule une routine de shadowing quotidienne sur de courts extraits de vidéos que tu apportes, t’enregistre, et compare ton enregistrement à celui du locuteur : en anglais, les sons qui diffèrent, et pour toutes les langues, ton rythme et ta mélodie.',
    body: `
    <h2>En un paragraphe</h2>
    <p>Tu ajoutes une vidéo ou un fichier audio d’un locuteur dont tu veux l’accent, tu découpes un extrait d’une ou deux phrases, et Euno te guide dans une séance de 15 minutes : écouter, imiter, enregistrer, comparer, imiter encore. Après une passe enregistrée, pour les extraits en anglais, il aligne les sons que tu as produits sur ceux de l’audio du locuteur et signale jusqu’à trois endroits où ils diffèrent. Pour toutes les langues, il montre aussi ta courbe de hauteur à côté de celle du locuteur, ton décalage et quelques différences mesurées. Il fonctionne en anglais, en français et en espagnol, dans ton navigateur, et il est gratuit.</p>

    <h2>Ce qu’il fait</h2>
    <ul>
      <li><strong>Des extraits de tes propres vidéos.</strong> Envoie un fichier ou colle un lien vers un .mp4, puis fais glisser sur la ligne de temps pour découper un extrait. Une forme d’onde agrandie t’aide à couper dans les pauses.</li>
      <li><strong>Une séance guidée.</strong> Une routine en quatre étapes avec minuteur, compteur de passes et lecture en boucle automatique. Une version de cinq minutes pour les mauvais jours est incluse, et chaque durée est réglable.</li>
      <li><strong>Des commandes de lecture.</strong> Boucle sur l’extrait, lecture à 0,5x, 0,75x ou 1x avec une hauteur naturelle, et raccourcis clavier.</li>
      <li><strong>Enregistrement et comparaison.</strong> Écoute l’original, toi-même, l’un après l’autre ou les deux ensemble. Tes enregistrements de l’étape 3 et final sont conservés pour chaque extrait.</li>
      <li><strong>Différences de prononciation (anglais uniquement, pour l’instant).</strong> Après une passe enregistrée, l’onglet Prononciation aligne les sons que tu as produits sur ceux de l’audio du locuteur et signale jusqu’à trois endroits où ils diffèrent. Il te compare au locuteur que tu as choisi, pas à une transcription, un dictionnaire ou un accent standard, il ne donne pas de note et ne parle d’aucune erreur. Il fonctionne dans ton navigateur : c’est désactivé tant que tu ne l’actives pas dans Réglages → Analyse, ce qui télécharge une fois sur ton appareil un modèle vocal d’environ 71 Mo (depuis Hugging Face, un hébergeur tiers), et ton enregistrement n’est pas envoyé pour l’analyse. C’est une fonction bêta, elle demande un ordinateur et n’affiche rien quand l’audio est trop bruyant pour être jugé. Il peut mal interpréter un son : vois chaque point comme un endroit où écouter, et écarte-le avec « Ça sonne pareil pour moi » si c’est le cas. Les extraits en français et en espagnol n’ont pas encore cela.</li>
      <li><strong>Hauteur et décalage.</strong> Euno trace la mélodie du locuteur et la tienne, chacune relative à sa propre voix, et mesure de combien tu étais en retard ou en avance.</li>
      <li><strong>Différences avec le locuteur.</strong> Après une passe, il peut signaler les passages où tu as été plus vite ou plus lentement, où la hauteur est allée dans l’autre sens, ou où l’accentuation différait. Ces indications viennent de la mesure des deux enregistrements, pas d’un modèle de langage qui écoute ta voix. Si tu l’actives dans les Réglages (désactivé par défaut, Chrome uniquement, ta voix est envoyée à Google pendant son fonctionnement), il peut aussi signaler les mots de l’extrait que la reconnaissance vocale du navigateur n’a pas entendus et qui étaient peut-être peu clairs. Elle peut aussi rater des mots clairs : prends cela comme une piste.</li>
      <li><strong>Notes et problèmes.</strong> Note ce qui sonnait faux ; les problèmes récurrents sont regroupés dans une liste.</li>
      <li><strong>Bilans sur 12 semaines.</strong> Un point de départ, puis les mêmes exercices aux semaines 4, 8 et 12.</li>
      <li><strong>Rappels.</strong> Rappels optionnels par Discord et notifications du navigateur.</li>
    </ul>

    <h2>Ce qu’il ne fait pas</h2>
    <ul>
      <li><strong>Il n’a ni leçons ni bibliothèque de contenu.</strong> Tu apportes les vidéos. Il n’y a ni leçons intégrées, ni cours, ni extraits prêts à l’emploi.</li>
      <li><strong>Il n’a ni sous-titres ni transcriptions.</strong> Il ne transcrit pas la vidéo, n’affiche pas de sous-titres synchronisés et ne la découpe pas en phrases à ta place. C’est toi qui choisis le début et la fin de chaque extrait.</li>
      <li><strong>Il ne récupère pas de contenu sur YouTube ou d’autres sites.</strong> Tu utilises des fichiers que tu as le droit d’utiliser pour un entraînement privé.</li>
      <li><strong>Il ne donne pas de note.</strong> Pas de note, pas de verdict juste ou faux. En anglais, l’onglet Prononciation signale bien les sons qui diffèrent de ceux du locuteur, et il peut se tromper ; en français et en espagnol, il n’y a pas encore de comparaison son par son. Il ne t’indique pas où placer la langue ou les lèvres, et la hauteur et le rythme ne font pas, à eux seuls, une bonne prononciation.</li>
      <li><strong>Ce n’est ni un coach, ni un cours, ni une garantie.</strong> C’est un outil d’entraînement.</li>
    </ul>

    <h2>Quels retours tu obtiens</h2>
    <p>Trois sortes, utilisables séparément :</p>
    <ol>
      <li><strong>Des retours mesurés :</strong> en anglais, l’onglet Prononciation (désactivé tant que tu ne l’as pas activé dans Réglages → Analyse et téléchargé un modèle d’environ 71 Mo) ; pour toutes les langues, courbes de hauteur, décalage et les différences avec le locuteur décrites plus haut.</li>
      <li><strong>Ta propre écoute :</strong> lecture côte à côte et tes notes sur ce qui sonnait faux.</li>
      <li><strong>Des retours de l’IA, optionnels :</strong> si tu ajoutes ta propre clé API d’Anthropic, d’OpenAI ou d’OpenRouter, tu peux demander un retour sur tes notes. Seul du texte est envoyé, jamais d’audio : ta note, plus de courtes lignes décrivant ce qui a été mesuré sur l’enregistrement (par exemple un passage où tu as été plus vite que le locuteur), auxquelles l’IA a pour consigne de ne pas ajouter d’autres problèmes. Tu paies directement le fournisseur. Sans clé, Euno écrit le prompt à coller dans n’importe quel chatbot.</li>
    </ol>

    <h2>Prix et confidentialité</h2>
    <p>Euno Shadowing est gratuit. Tes vidéos et tes enregistrements sont rangés dans un dossier « Euno Shadowing » de ton propre Google Drive, pas sur notre serveur. Notre serveur garde tes notes, tes réglages et ta progression. L’analyse de prononciation en anglais se fait sur ton appareil : ton audio n’est envoyé nulle part pour cela ; ses résultats écrits sont conservés avec tes données d’entraînement. Les détails sont dans la <a href="${L('/privacy/')}">politique de confidentialité</a>.</p>

    <h2>À ne pas confondre avec</h2>
    <p>Le nom est partagé avec des choses sans rapport, et aucune n’est Euno Shadowing :</p>
    <ul>
      <li><strong>Les stages d’observation en entreprise</strong> (« job shadowing »), comme les visites Erasmus+ pour enseignants, où l’on suit un professionnel au travail.</li>
      <li><strong>Le shadowing médical</strong>, où des étudiants observent des médecins.</li>
      <li><strong>Euno, la plateforme d’IA d’entreprise</strong>, et ses déploiements « shadow » d’agents d’IA.</li>
      <li><strong>D’autres applications nommées Euno</strong>, comme des applications de journal intime.</li>
    </ul>
    <p>Euno Shadowing, c’est uniquement l’application d’entraînement aux langues sur shadowing.euno.cc. Elle n’est affiliée à aucune des précédentes.</p>

    <h2>À qui il convient</h2>
    <p>À ceux qui comprennent assez bien une langue et veulent sonner plus naturellement : le rythme, la mélodie et le timing d’un locuteur qu’ils admirent. Si tu veux un cours structuré, une bibliothèque de leçons, des sous-titres ou un cours noté, regarde la <a href="${L('/euno-vs-elsa-and-language-reactor/')}">comparaison avec ELSA Speak et Language Reactor</a>. Tu débutes avec la technique ? Lis <a href="${L('/what-is-shadowing/')}">c’est quoi le shadowing</a>.</p>`,
  },

  'how-long-shadowing-takes': {
    title: 'Combien de temps faut-il pour améliorer son accent avec le shadowing ? | Euno Shadowing',
    h1: 'Combien de temps faut-il pour que le shadowing marche ?',
    crumb: 'Combien de temps',
    description: 'À quoi t’attendre avec une pratique quotidienne du shadowing : ce qui change d’abord, ce qui prend plus de temps, et comment savoir si ton accent évolue vraiment.',
    lede: 'Il n’y a pas de nombre de jours fixe. Ce qui est sûr, c’est l’ordre dans lequel les choses changent : d’abord les extraits que tu travailles, puis la lecture à voix haute, et la parole spontanée en dernier.',
    body: `
    <h2>La réponse courte</h2>
    <p>La plupart des gens entendent une différence sur les extraits travaillés dès la première ou la deuxième séance, parce que la répétition rend ces quelques phrases plus fluides presque tout de suite. Le changement dans ta façon de parler quand tu t’exprimes librement est plus lent, et se juge sur des semaines et des mois, pas des jours. Sa vitesse dépend de la fréquence de ta pratique, de l’écart entre l’accent visé et ta façon de parler actuelle, et de l’attention que tu portes en comparant tes enregistrements.</p>

    <h2>Ce qui change en premier</h2>
    <ol>
      <li><strong>L’extrait travaillé.</strong> Après 15 ou 20 passages, ton rythme et ta mélodie sur cet extrait se rapprochent nettement de ceux du locuteur. C’est réel, mais c’est surtout la mémoire de cet extrait.</li>
      <li><strong>Le rythme et l’intonation en général.</strong> Après quelques semaines d’extraits quotidiens, les accents et la mélodie commencent à se transférer à d’autres phrases, surtout quand tu lis à voix haute.</li>
      <li><strong>Les sons isolés.</strong> Les voyelles et consonnes qui n’existent pas dans ta langue maternelle prennent souvent plus de temps, parce qu’il faut d’abord entendre la différence de façon fiable.</li>
      <li><strong>La parole spontanée.</strong> Quand tu réfléchis à ce que tu vas dire, les vieilles habitudes reviennent. C’est la dernière chose à changer, et le test le plus important.</li>
    </ol>

    <h2>Pourquoi tous les jours vaut mieux que de longues séances</h2>
    <p>L’accent est une habitude motrice, comme un coup droit au tennis. Une pratique courte et fréquente donne à ta mémoire plus d’occasions de se consolider qu’une longue séance par semaine. Quinze minutes par jour, c’est un bon point de départ ; les jours chargés, cinq minutes suffisent à garder l’habitude.</p>

    <h2>Comment savoir si ça marche</h2>
    <p>Les comparaisons d’un jour à l’autre sont trompeuses : il y a des bons et des mauvais jours, et tu t’habitues à ta propre voix. À la place :</p>
    <ul>
      <li><strong>Enregistre un point de départ</strong> avant de commencer : quelques phrases lues à voix haute, une minute à raconter quelque chose que tu as regardé, et une minute à répondre à une question non préparée.</li>
      <li><strong>Refais les mêmes tâches</strong> toutes les quatre semaines environ, et écoute le point de départ et le nouvel enregistrement à la suite.</li>
      <li><strong>Demande à d’autres personnes</strong> quel enregistrement est le plus proche de l’accent visé, sans leur dire lequel est le plus récent.</li>
    </ul>
    <p>Euno Shadowing intègre tout ça : un point de départ, puis des bilans aux semaines 4, 8 et 12 avec les mêmes tâches. Douze semaines, c’est un repère pour comparer, pas la promesse que tu auras fini.</p>

    <h2>Pourquoi on stagne, et quoi faire</h2>
    <ul>
      <li><strong>Des extraits trop longs ou trop rapides.</strong> Si tu ne suis pas après cinq passages, coupe un extrait plus court.</li>
      <li><strong>Copier les mots, pas la mélodie.</strong> Exagère les montées, les descentes et les syllabes longues jusqu’à trouver ça un peu théâtral.</li>
      <li><strong>Ne jamais comparer.</strong> Enregistre un passage et regarde-le à côté de l’original. Les courbes de mélodie et le décalage montrent ce que tes oreilles ratent. Pour les extraits en anglais, l’onglet Prononciation (bêta) peut aussi signaler des sons qui diffèrent de ceux du locuteur.</li>
      <li><strong>Changer de locuteur trop souvent.</strong> Garde une même voix quelques semaines pour que les schémas s’installent.</li>
      <li><strong>Ne faire que du shadowing.</strong> Utilise aussi l’accent dans tes propres phrases : raconte avec tes mots ce que tu viens d’imiter.</li>
    </ul>`,
  },

  'choosing-clips': {
    title: 'Comment choisir ses locuteurs et ses extraits pour le shadowing | Euno Shadowing',
    h1: 'Comment choisir ses locuteurs et ses extraits pour le shadowing',
    crumb: 'Choisir ses extraits',
    description: 'Ce qui fait un bon extrait pour le shadowing : le bon locuteur, une parole naturelle, un son clair, la bonne longueur et où couper. Avec une liste à cocher.',
    lede: 'L’extrait que tu imites décide de ce que tu apprends. Un bon extrait est court, naturel, clair, et prononcé par quelqu’un dont tu veux vraiment l’accent.',
    body: `
    <h2>Choisis d’abord le locuteur</h2>
    <p>Prends une personne qui a l’accent que tu veux, et qui parle comme tu aimerais parler : un âge proche, un registre proche, idéalement une tessiture proche. Copier un modèle cohérent est plus facile que de faire la moyenne de plusieurs, alors garde ce locuteur quelques semaines avant d’en ajouter d’autres.</p>
    <p>Si tu hésites sur l’accent à viser, lis les guides des accents <a href="${L('/english-accents/')}">anglais</a>, <a href="${L('/french-accents/')}">français</a> ou <a href="${L('/spanish-accents/')}">espagnols</a>.</p>

    <h2>Préfère une parole naturelle</h2>
    <ul>
      <li><strong>Bien :</strong> interviews, podcasts, conférences, gens qui parlent face caméra, conversations.</li>
      <li><strong>Moins bien :</strong> livres audio, lecture du journal et publicités écrites à l’avance. La lecture n’a pas le même rythme que la conversation.</li>
      <li><strong>À éviter :</strong> de la musique sous la voix, plusieurs personnes qui parlent en même temps, un montage qui coupe au milieu des phrases, et une parole très rapide ou mâchée.</li>
    </ul>
    <p>Un audio propre compte doublement si tu utilises l’onglet Prononciation d’Euno (anglais) : quand la voix du locuteur est noyée dans de la musique, du bruit ou des voix qui se chevauchent, il le dit et n’affiche aucune différence.</p>

    <h2>Trouve la bonne longueur</h2>
    <p>Une ou deux phrases, en général 10 à 20 secondes. Au début, plus court, c’est mieux. Si tu ne suis toujours pas le locuteur après cinq ou six passages, l’extrait est trop long ou trop rapide : coupe-le en deux.</p>

    <h2>Coupe dans les pauses</h2>
    <p>Commence et termine l’extrait dans un silence entre deux groupes de mots, pas au milieu d’un mot. Une forme d’onde rend ça facile : les pauses sont les parties plates. Un début propre te laisse respirer et démarrer avec le locuteur.</p>

    <h2>Choisis des phrases que tu dirais</h2>
    <p>Les expressions de tous les jours, les opinions et les histoires passent dans ta propre façon de parler plus vite que le vocabulaire technique. Un extrait avec une mélodie marquée, comme une question, une opposition (« pas ça, mais ça ») ou une énumération, te donne plus à copier qu’une affirmation plate.</p>

    <h2>Utilise des fichiers que tu as le droit d’utiliser</h2>
    <p>Utilise des enregistrements que tu as le droit d’utiliser pour ta pratique personnelle, et ne les redistribue pas. Dans Euno Shadowing, tu importes un fichier vidéo ou audio depuis ton appareil ou tu colles un lien direct vers un fichier .mp4, puis tu coupes tes extraits sur la frise.</p>

    <h2>Liste à cocher</h2>
    <ul>
      <li>Un seul locuteur, avec l’accent que tu veux.</li>
      <li>Une parole naturelle, non écrite à l’avance.</li>
      <li>Un son clair, sans musique ni voix qui se chevauchent.</li>
      <li>Une ou deux phrases, 10 à 20 secondes.</li>
      <li>Commence et finit dans une pause.</li>
      <li>Des mots que tu utiliserais vraiment.</li>
    </ul>`,
  },

  'shadowing-vs-other-methods': {
    title: 'Shadowing, écoute-répétition, paires minimales et lecture à voix haute | Euno Shadowing',
    h1: 'Le shadowing face aux autres méthodes de prononciation',
    crumb: 'Shadowing et autres méthodes',
    description: 'Comment le shadowing se compare à l’écoute-répétition, aux paires minimales, à la lecture à voix haute et à la phonétique, à quoi sert chacune, et comment les combiner.',
    lede: 'Le shadowing est le plus fort pour le rythme et la mélodie. D’autres méthodes sont meilleures pour un son précis ou pour comprendre ce que tu entends. La plupart des apprenants réussissent mieux en les mélangeant.',
    body: `
    <h2>En un coup d’œil</h2>
    <table class="simple">
      <thead><tr><th>Méthode</th><th>Idéale pour</th><th>Limites</th></tr></thead>
      <tbody>
        <tr><td>Shadowing</td><td>Rythme, accentuation, intonation, enchaînements, fluidité</td><td>Difficile de corriger un son que tu n’entends pas encore</td></tr>
        <tr><td>Écoute-répétition</td><td>Débutants, travail minutieux sur une phrase</td><td>Laisse le temps de revenir à comment tu crois que ça sonne</td></tr>
        <tr><td>Paires minimales</td><td>Entendre et produire une opposition, comme « rue » et « roue »</td><td>Mots isolés, peu de rythme ou de mélodie</td></tr>
        <tr><td>Lecture à voix haute</td><td>Relier le son à l’orthographe, pratiquer sans enregistrement</td><td>L’orthographe ramène aux vieilles habitudes ; un rythme de lecture</td></tr>
        <tr><td>Phonétique et API</td><td>Comprendre ce qui change et pourquoi</td><td>Savoir n’est pas faire ; il faut pratiquer pour que ça reste</td></tr>
      </tbody>
    </table>

    <h2>Le shadowing</h2>
    <p>Tu parles en même temps que le locuteur, une fraction de seconde derrière lui. Comme tu n’as pas le temps de réfléchir, tu copies toute la forme du discours. C’est exigeant, et c’est pour ça que ça marche bien pour la prosodie, la partie de l’accent que les règles ont du mal à enseigner. <a href="${L('/what-is-shadowing/')}">En savoir plus sur le shadowing</a>.</p>

    <h2>L’écoute-répétition</h2>
    <p>Tu entends une phrase, puis tu la répètes dans le silence. C’est plus doux, et utile quand un extrait est encore trop rapide pour le shadowing. L’inconvénient, c’est le délai : tu répètes ton souvenir du son, déjà filtré par ton propre accent.</p>

    <h2>Les paires minimales</h2>
    <p>Tu travailles des paires de mots qui ne diffèrent que par un son, d’abord à l’oreille, puis à voix haute. C’est la façon la plus directe de corriger un son que ta langue maternelle ne distingue pas. Une fois que tu entends la différence, le shadowing t’aide à la garder à vitesse normale.</p>

    <h2>La lecture à voix haute</h2>
    <p>Utile pour pratiquer sans audio et pour relier les sons à l’orthographe. Le risque, c’est que l’orthographe déclenche ton ancienne prononciation, et que la parole lue ait un rythme plus plat que la conversation.</p>

    <h2>Apprendre la phonétique</h2>
    <p>Savoir où va ta langue, ou qu’une voyelle est une diphtongue, t’aide à remarquer les différences. Ça ne change pas ta façon de parler à lui seul ; ça rend ta pratique plus précise.</p>

    <h2>Comment les combiner</h2>
    <ol>
      <li>Fais du shadowing la base de chaque jour : un extrait, environ 15 minutes.</li>
      <li>Quand tu compares tes enregistrements, note ce qui sonne encore différemment.</li>
      <li>Si le même son revient sans cesse, passe quelques minutes sur des paires minimales pour lui.</li>
      <li>Puis reviens au shadowing pour utiliser ce son à vitesse normale, dans de vraies phrases.</li>
    </ol>
    <p>Dans Euno Shadowing, les extraits en anglais ont un onglet Prononciation (bêta) qui peut suggérer quel son regarder : il signale jusqu’à trois endroits où tes sons diffèrent de l’audio du locuteur. Il peut se tromper, alors écoute les deux avant de t’investir dans un exercice.</p>`,
  },

  'euno-vs-elsa-language-reactor': {
    title: 'Euno Shadowing, ELSA Speak et Language Reactor : comparaison | Euno Shadowing',
    h1: 'Euno Shadowing, ELSA Speak et Language Reactor',
    crumb: 'Euno, ELSA et Language Reactor',
    description: 'Une comparaison honnête d’Euno Shadowing, ELSA Speak et Language Reactor : à quoi sert chaque outil, ce qu’il ne fait pas, et comment choisir ou les combiner.',
    lede: 'On cite souvent ces trois outils ensemble, mais ils font des choses différentes. ELSA te fait suivre des leçons et note tes sons, Language Reactor t’aide à comprendre ce que tu regardes, et Euno t’aide à imiter des extraits de ton choix et à comparer ta voix à celle du locuteur.',
    body: `
    <p><em>Nous faisons Euno Shadowing : lis ce comparatif en sachant cela. Nous décrivons les deux autres d’après leurs descriptions publiques, telles que nous les comprenons en octobre 2026 ; les fonctions et les prix changent, vérifie donc leurs sites avant de décider.</em></p>

    <h2>En un coup d’œil</h2>
    <table class="simple">
      <thead><tr><th></th><th>Euno Shadowing</th><th>ELSA Speak</th><th>Language Reactor</th></tr></thead>
      <tbody>
        <tr><td>Ce que c’est</td><td>Une app d’entraînement au shadowing sur tes propres extraits</td><td>Une app de cours de prononciation, avec leçons et notation</td><td>Une extension de navigateur pour apprendre avec Netflix et YouTube</td></tr>
        <tr><td>Contenu</td><td>Tes propres vidéos et audios : tu importes un fichier ou colles un lien, puis tu découpes des extraits</td><td>Des leçons créées par l’entreprise</td><td>Les vidéos que tu regardes déjà sur les sites de streaming</td></tr>
        <tr><td>Principe</td><td>Imiter un vrai locuteur, puis comparer tes sons, ton timing et ta mélodie aux siens</td><td>Dire une phrase et recevoir un retour sur tes sons</td><td>Sous-titres doubles et dictionnaire en infobulle pour comprendre ce que tu entends</td></tr>
        <tr><td>Langues</td><td>Accents anglais, français et espagnols</td><td>Anglais</td><td>De nombreuses langues</td></tr>
        <tr><td>Retour</td><td>En anglais, les sons qui diffèrent de ceux du locuteur ; pour toutes les langues, ton rythme et ta courbe de mélodie à côté de ceux du locuteur ; retour IA facultatif avec ta propre clé d’API</td><td>Notation automatique de ta prononciation</td><td>Pas un outil de prononciation</td></tr>
        <tr><td>Retour au niveau des sons</td><td>Anglais uniquement, en bêta : jusqu’à trois endroits où tes sons diffèrent de l’audio du locuteur, sans note. Désactivé par défaut ; un modèle d’environ 71 Mo est téléchargé une fois et fonctionne dans ton navigateur</td><td>Note tes sons par rapport à un accent standard (anglais)</td><td>Aucun</td></tr>
        <tr><td>Comparé à</td><td>Le locuteur que tu as choisi</td><td>Un accent cible</td><td>Personne : elle n’analyse pas ta voix</td></tr>
        <tr><td>Prix</td><td>Gratuit ; l’usage de l’IA, si tu la choisis, est facturé par ton fournisseur</td><td>Offre gratuite et abonnements payants</td><td>Offre gratuite et abonnements payants</td></tr>
      </tbody>
    </table>

    <h2>Euno Shadowing</h2>
    <p>Euno déroule la routine de shadowing à ta place. Tu apportes une vidéo d’un locuteur dont tu veux l’accent, tu découpes un extrait d’une ou deux phrases, et Euno le boucle, compte tes passages, t’enregistre et, en anglais, signale où tes sons diffèrent de ceux du locuteur, avec ton rythme et ta mélodie tracés à côté des siens. Il s’appuie sur le vrai locuteur, pas sur un accent modèle, donc il marche avec n’importe quelle voix que tu trouves.</p>
    <p><strong>Ce qu’il ne fait pas :</strong> pas de leçons ni de bibliothèque à lui, pas de sous-titres ni de transcriptions, pas d’intégration aux sites de streaming, et pas de note ni de score. Il montre les différences avec la mélodie et le timing du locuteur et, en anglais, les sons qui diffèrent des siens ; il ne dit pas que tu as juste ou faux, et il peut mal interpréter un son. Le retour IA est facultatif et utilise une clé que tu fournis. La comparaison des sons est une fonction bêta, uniquement en anglais, et nous n’annonçons aucune précision particulière : c’est un indice pour écouter, pas un verdict.</p>

    <h2>ELSA Speak</h2>
    <p>ELSA est une app de prononciation de l’anglais. Tu suis ses leçons et exercices, tu parles, et l’app note ta prononciation et signale les sons à travailler. C’est un bon choix si tu veux un cours structuré et un retour rapide sur les sons, par rapport à un accent standard.</p>
    <p><strong>La différence :</strong> le contenu est celui de l’entreprise, tu ne peux pas t’exercer avec ton locuteur préféré, et son retour te juge par rapport à une cible, pas par rapport à la personne que tu imites. Elle est centrée sur l’anglais. L’onglet Prononciation d’Euno fait l’inverse : il te compare au locuteur que tu as choisi et ne donne pas de note. Si tu veux un cours noté, son par son, ELSA est fait pour ça ; l’onglet Prononciation d’Euno est plus récent, en bêta, et pensé comme un indice à côté de ta propre écoute.</p>

    <h2>Language Reactor</h2>
    <p>Language Reactor est une extension de navigateur qui ajoute des sous-titres doubles, un dictionnaire en infobulle et des commandes de lecture aux vidéos de sites comme Netflix et YouTube. Elle sert à comprendre et à retenir du vocabulaire à partir de contenus réels, et couvre de nombreuses langues.</p>
    <p><strong>La différence :</strong> elle porte sur la compréhension, pas sur la mesure de ta façon de parler. Tu peux l’utiliser avec n’importe quelle vidéo, mais elle ne t’enregistre pas et ne compare pas ta voix à celle du locuteur.</p>

    <h2>Comment choisir</h2>
    <ul>
      <li><strong>Tu veux ressembler à un locuteur précis</strong>, avec un rythme et une mélodie les plus proches possible : Euno. (En anglais, il signale aussi des sons qui diffèrent de ceux du locuteur.)</li>
      <li><strong>Tu veux un cours guidé</strong> et un retour sur les sons de l’anglais : ELSA.</li>
      <li><strong>Tu veux comprendre et apprendre des mots</strong> à partir de ce que tu regardes : Language Reactor.</li>
    </ul>

    <h2>Les utiliser ensemble</h2>
    <p>Ils sont moins concurrents qu’il n’y paraît. Une combinaison raisonnable : trouve un extrait qui te plaît et apprends ses mots avec Language Reactor, puis découpe-le et imite-le dans Euno. Si un même son revient quand tu compares tes enregistrements, utilise un cours comme ELSA, ou <a href="${L('/shadowing-vs-other-methods/')}">les paires minimales</a>, pour le travailler, puis retourne au shadowing pour l’utiliser à vitesse réelle.</p>
    <p>Tu découvres la technique ? Commence par <a href="${L('/what-is-shadowing/')}">ce qu’est le shadowing</a> et <a href="${L('/choosing-shadowing-clips/')}">comment choisir ses extraits</a>.</p>`,
  },

  'euno-vs-shadow-talk-praat': {
    title: 'Euno Shadowing, Shadow Talk et Praat : comparaison | Euno Shadowing',
    h1: 'Euno Shadowing, Shadow Talk et Praat',
    crumb: 'Euno, Shadow Talk et Praat',
    description: 'Une comparaison honnête d’Euno Shadowing, Shadow Talk et Praat : à quoi sert chaque outil, ce qu’il ne fait pas, et comment choisir ou les combiner.',
    lede: 'On recommande souvent ces trois outils ensemble pour travailler l’accent, mais ils font des choses différentes. Shadow Talk fait du shadowing sur les sous-titres YouTube, Praat est un logiciel d’analyse de la parole pour examiner soi-même un enregistrement, et Euno déroule la routine de shadowing sur des extraits de ton choix et compare ta voix à celle du locuteur.',
    body: `
    <p><em>Nous faisons Euno Shadowing : lis ce comparatif en sachant cela. Nous décrivons les deux autres d’après leurs descriptions publiques, telles que nous les comprenons en novembre 2026 ; les fonctions changent, vérifie donc leurs pages avant de te décider.</em></p>

    <h2>En un coup d’œil</h2>
    <table class="simple">
      <thead><tr><th></th><th>Euno Shadowing</th><th>Shadow Talk</th><th>Praat</th></tr></thead>
      <tbody>
        <tr><td>Ce que c’est</td><td>Une app web qui déroule la routine de shadowing sur tes propres extraits</td><td>Une extension Chrome pour faire du shadowing sur YouTube</td><td>Un logiciel pour analyser, synthétiser et manipuler la parole, créé à l’université d’Amsterdam</td></tr>
        <tr><td>Contenu</td><td>Tes propres fichiers vidéo ou audio (import, ou lien direct .mp4). Pas de liens YouTube</td><td>Des vidéos YouTube : il lit les sous-titres de la page et propose des phrases à répéter</td><td>N’importe quel son enregistré ou ouvert</td></tr>
        <tr><td>Comment il te vérifie</td><td>Compare ton enregistrement à l’audio du locuteur : ton rythme et ta mélodie à côté des siens et, en anglais, les sons qui diffèrent (bêta, sans note)</td><td>Utilise la reconnaissance vocale intégrée de Chrome pour vérifier ce que tu as dit</td><td>Il ne vérifie rien : il montre spectrogrammes, courbes de hauteur, de formants et d’intensité, à toi de les interpréter</td></tr>
        <tr><td>Prise en main</td><td>Une routine guidée</td><td>Rapide à essayer sur une page YouTube</td><td>Un outil de recherche avec beaucoup de fonctions et des scripts</td></tr>
        <tr><td>Langues</td><td>Accents anglais, français et espagnols (comparaison des sons : anglais seulement)</td><td>Selon les sous-titres de la vidéo et la reconnaissance vocale de Chrome</td><td>Toutes : il analyse le son, pas les mots</td></tr>
      </tbody>
    </table>

    <h2>Euno Shadowing</h2>
    <p>Tu apportes une vidéo d’un locuteur dont tu veux l’accent, tu découpes un extrait d’une ou deux phrases, et Euno le met en boucle, compte tes passages, t’enregistre et compare ton enregistrement à celui du locuteur. Il demande une connexion Google et n’a ni leçons, ni sous-titres, ni transcriptions. Il ne donne aucune note. La comparaison des sons en anglais est une bêta qui peut mal interpréter un son.</p>

    <h2>Shadow Talk</h2>
    <p>Shadow Talk est une extension Chrome open source qui fonctionne sur YouTube. Elle lit les sous-titres de la page, propose des phrases à répéter et utilise la reconnaissance vocale de Chrome pour t’entendre. C’est un moyen rapide de faire du shadowing sur presque toute vidéo YouTube sous-titrée, sans fichier à préparer.</p>
    <p><strong>La différence :</strong> la reconnaissance vocale vérifie quels mots elle a compris, pas comment tes sons, ton rythme ou ta mélodie se comparent à ceux du locuteur. Elle dépend aussi de la présence de sous-titres. Euno compare ton enregistrement à l’audio du locuteur, mais ne peut pas ouvrir de vidéos YouTube.</p>

    <h2>Praat</h2>
    <p>Praat est un logiciel d’analyse de la parole utilisé en phonétique. Tu peux enregistrer ou ouvrir des sons et regarder spectrogrammes et courbes de hauteur, de formants et d’intensité. C’est l’outil qu’il faut pour mesurer toi-même un enregistrement, ou pour faire de la recherche.</p>
    <p><strong>La différence :</strong> Praat montre l’acoustique et te laisse l’interpréter ; il n’y a pas de routine de shadowing, et l’apprivoiser prend du temps. Euno dessine pour toi ton rythme et ta mélodie à côté de ceux du locuteur et, en anglais, signale des sons à écouter. Pour des valeurs de formants exactes ou des mesures sur mesure, utilise Praat.</p>

    <h2>Comment choisir</h2>
    <ul>
      <li><strong>Tu veux faire vite du shadowing sur une vidéo YouTube :</strong> Shadow Talk.</li>
      <li><strong>Tu as un extrait d’un locuteur et tu veux comparer ta voix à la sienne :</strong> Euno.</li>
      <li><strong>Tu veux mesurer toi-même des propriétés du son :</strong> Praat.</li>
    </ul>
    <p>Ils se combinent bien : examine un son récalcitrant dans Praat, puis fais du shadowing sur l’extrait dans Euno. Voir aussi le <a href="${L('/euno-vs-elsa-and-language-reactor/')}">comparatif avec ELSA Speak et Language Reactor</a>, et <a href="${L('/what-is-shadowing/')}">ce qu’est le shadowing</a>.</p>`,
  },

  'english-accents': {
    title: 'Quel accent anglais imiter : américain, britannique ou australien ? | Euno Shadowing',
    h1: 'Quel accent anglais choisir pour le shadowing ?',
    crumb: 'Accents anglais',
    description: 'L’anglais américain général, l’anglais britannique du Sud et l’anglais australien général comparés pour le shadowing : ce qu’il faut écouter, et comment en choisir un.',
    lede: 'Choisis l’accent que tu entends le plus, ou celui que tu utiliseras le plus, et garde-le. Voici ce qui distingue les trois modèles les plus courants, pour savoir quoi écouter.',
    body: `
    <h2>Comment choisir</h2>
    <ul>
      <li><strong>Là où tu vis ou vivras,</strong> et les personnes à qui tu parles le plus.</li>
      <li><strong>Ce que tu écoutes.</strong> Des heures d’écoute dans un accent rendent son shadowing bien plus facile.</li>
      <li><strong>Ce que tu aimes.</strong> Tu pratiqueras plus avec une voix qui te plaît.</li>
    </ul>
    <p>Aucun n’est plus « correct » que les autres. Ce qui compte, c’est de choisir un modèle, pour que ta pratique s’additionne au lieu de mélanger les traits de plusieurs accents.</p>

    <h2>L’anglais américain général</h2>
    <p>L’accent de la plupart des films, séries et journaux télévisés américains.</p>
    <ul>
      <li><strong>Le « r » se prononce</strong> après les voyelles : « car », « hard », « water ».</li>
      <li><strong>Le « t » battu</strong> entre deux voyelles ressemble à un « d » rapide : « water », « better », « a lot of ».</li>
      <li><strong>« Bath », « dance » et « can’t »</strong> ont la même voyelle que « cat ».</li>
      <li><strong>« Lot » et « hot »</strong> ont une voyelle ouverte, sans arrondir les lèvres, proche de celle de « father ».</li>
    </ul>

    <h2>L’anglais britannique du Sud</h2>
    <p>L’accent standard moderne de l’Angleterre, souvent appelé RP ou « anglais de la BBC ».</p>
    <ul>
      <li><strong>Pas de « r » après une voyelle,</strong> sauf si une voyelle suit : « car » et « hard » se terminent sans, mais « car alarm » se lie avec un « r ».</li>
      <li><strong>« Bath », « dance » et « can’t »</strong> ont la voyelle longue de « father ».</li>
      <li><strong>« Lot » et « hot »</strong> ont une voyelle courte, avec les lèvres arrondies.</li>
      <li><strong>« Go » et « no »</strong> partent d’une voyelle centrale, à peu près « eu-ou ».</li>
      <li><strong>Le « t »</strong> est souvent bien prononcé, même si un coup de glotte est courant dans la parole de tous les jours, comme dans « football ».</li>
    </ul>

    <h2>L’anglais australien général</h2>
    <p>L’accent de tous les jours de la plupart des Australiens.</p>
    <ul>
      <li><strong>Pas de « r » après une voyelle,</strong> comme en anglais britannique du Sud.</li>
      <li><strong>Des diphtongues plus larges :</strong> les voyelles de « day », « my » et « no » partent de plus loin de leur point d’arrivée que dans les deux autres accents.</li>
      <li><strong>Le « t » battu</strong> entre deux voyelles est courant, comme en américain : « water », « better ».</li>
      <li><strong>« Bath » et « can’t »</strong> ont en général la voyelle longue, mais « dance » et « plant » ont souvent celle de « cat ».</li>
      <li><strong>Une intonation montante</strong> à la fin de certaines affirmations est courante à l’oral familier.</li>
    </ul>

    <h2>Quoi écouter pendant le shadowing</h2>
    <p>Quel que soit l’accent choisi, les plus grandes différences avec ta façon de parler sont en général le rythme et la mélodie, pas les sons isolés. L’anglais est une langue à rythme accentuel : les syllabes accentuées sont longues et claires, et celles entre elles sont courtes et réduites, souvent à un « eu » rapide. Copie d’abord ce contraste. Ensuite, travaille les traits ci-dessus que tes enregistrements montrent comme manquants.</p>
    <p>Prêt à commencer ? Suis <a href="${L('/accent-shadowing/')}">la routine quotidienne de shadowing en anglais</a>.</p>`,
  },

  'french-accent-shadowing': {
    title: 'Améliorer ton accent en français avec le shadowing : une routine quotidienne | Euno Shadowing',
    h1: 'Comment améliorer ton accent en français avec le shadowing',
    crumb: 'Routine pour l’accent français',
    description: 'Une routine de shadowing de 15 minutes par jour pour ton accent en français : le rythme, la liaison et l’enchaînement, les voyelles, les voyelles nasales et le « r » français.',
    lede: 'Le rythme du français ne fonctionne pas comme celui de l’anglais ou de l’espagnol, et c’est justement pour ça que le shadowing aide : tu copies le flux de groupes de mots entiers au lieu d’avancer mot par mot.',
    body: `
    <h2>Ce qui fait sonner un accent français</h2>
    <ul>
      <li><strong>Des syllabes régulières.</strong> Le français a un rythme syllabique : chaque syllabe dure à peu près le même temps, et les voyelles ne sont pas réduites comme en anglais.</li>
      <li><strong>L’accent en fin de groupe.</strong> La dernière syllabe de chaque groupe de mots est un peu plus longue, souvent avec une montée au milieu de la phrase et une descente à la fin. Les mots seuls n’ont pas leur propre accent.</li>
      <li><strong>Les enchaînements.</strong> Les mots s’enchaînent : une consonne finale se lie à la voyelle suivante (l’<em>enchaînement</em>, comme dans « elle a »), et certaines consonnes finales muettes se prononcent devant une voyelle (la <em>liaison</em>, comme dans « les amis »).</li>
      <li><strong>Des voyelles pures.</strong> Les voyelles restent stables, sans le glissement de « day » ou « go » en anglais. Des oppositions comme « u » et « ou » (« rue » et « roue ») comptent.</li>
      <li><strong>Les voyelles nasales</strong> de « vent », « vin » et « bon », et le « r » uvulaire, fait au fond de la bouche.</li>
    </ul>

    <h2>Choisis ton modèle</h2>
    <p>Décide entre le français de France (parisien) et le français québécois, puis trouve un locuteur. Voir <a href="${L('/french-accents/')}">les accents français comparés</a>. Les interviews, les podcasts et les gens qui parlent face caméra marchent le mieux ; le journal lu est plus formel que le français de tous les jours.</p>

    <h2>La séance de 15 minutes</h2>
    <table class="simple">
      <thead><tr><th>Étape</th><th>Durée</th><th>Ce que tu fais</th></tr></thead>
      <tbody>
        <tr><td>Écouter</td><td>2 min</td><td>Écoute l’extrait trois fois sans parler. Repère où finit chaque groupe et où la voix monte ou descend.</td></tr>
        <tr><td>Shadowing</td><td>7 min</td><td>Environ 15 passages avec le locuteur, sans transcription.</td></tr>
        <tr><td>Enregistrer et comparer</td><td>2 min</td><td>Enregistre un passage et compare-le à l’original.</td></tr>
        <tr><td>Shadowing à nouveau</td><td>4 min</td><td>Environ 8 passages de plus, puis un enregistrement final.</td></tr>
      </tbody>
    </table>

    <p>Dans Euno, les extraits en français ont la courbe de hauteur, le décalage et les mesures de rythme. L’onglet Prononciation, qui compare les sons un par un, est pour l’instant réservé à l’anglais.</p>

    <h2>Sur quoi te concentrer en français</h2>
    <ul>
      <li><strong>N’accentue pas les mots.</strong> Si ta langue maternelle accentue les mots, ton français sonnera saccadé tant que tu ne les aplatis pas pour n’allonger que la fin de chaque groupe.</li>
      <li><strong>Garde des syllabes régulières.</strong> Donne aux voyelles non accentuées toute leur qualité au lieu de les réduire.</li>
      <li><strong>Enchaîne tout.</strong> Fais le shadowing à vitesse normale pour que les mots se fondent ; si un enchaînement te semble bizarre, il est sans doute juste.</li>
      <li><strong>Attention aux « e » qui tombent.</strong> En français de tous les jours, beaucoup de « e » muets disparaissent (« je suis » peut sonner comme « j’suis »). Copie ce que fait le locuteur, pas l’orthographe.</li>
      <li><strong>Vérifie la mélodie.</strong> Une courbe de mélodie montre si ta voix monte à la fin de chaque groupe à l’intérieur d’une phrase et descend à la fin.</li>
    </ul>

    <h2>Suivre tes progrès</h2>
    <p>Enregistre un point de départ avant de commencer, puis refais les mêmes tâches toutes les quatre semaines : quelques phrases lues à voix haute, une minute à raconter quelque chose en français et une minute à répondre à une question inconnue. Euno Shadowing le fait avec des bilans aux semaines 4, 8 et 12. Voir <a href="${L('/how-long-does-shadowing-take/')}">combien de temps prend le shadowing</a>.</p>`,
  },

  'french-accents': {
    title: 'Français parisien ou québécois : quel accent imiter ? | Euno Shadowing',
    h1: 'Parisien ou québécois : quel accent français imiter ?',
    crumb: 'Accents français',
    description: 'Le français de France (parisien) et le français québécois comparés pour le shadowing : les principales différences de voyelles, de consonnes et de mélodie, et comment choisir.',
    lede: 'Ce sont deux variétés complètes et standard du français, avec des millions de locuteurs. Choisis celle que tu entendras et utiliseras le plus, et écoute les traits ci-dessous.',
    body: `
    <h2>Comment choisir</h2>
    <ul>
      <li><strong>Là où tu utiliseras le français :</strong> la France, la Belgique, la Suisse et la plupart des pays francophones sont plus proches du modèle de France ; le Québec et une grande partie du Canada francophone utilisent le québécois.</li>
      <li><strong>Ce que tu regardes et écoutes.</strong> Beaucoup d’écoute dans une variété rend son shadowing plus facile.</li>
      <li><strong>Choisis-en une et garde-la,</strong> pour que ta pratique s’additionne.</li>
    </ul>

    <h2>Le français de France (parisien)</h2>
    <p>L’accent standard de France, entendu à la télévision et à la radio nationales.</p>
    <ul>
      <li><strong>Les voyelles restent pures,</strong> même longues.</li>
      <li><strong>Plusieurs anciennes oppositions ont fusionné</strong> chez beaucoup de locuteurs : « brin » et « brun » se prononcent pareil, comme souvent « patte » et « pâte ».</li>
      <li><strong>Beaucoup de « e » muets tombent</strong> à l’oral : « petit » peut sonner comme « p’tit ».</li>
      <li><strong>Le « r »</strong> est uvulaire, fait au fond de la bouche, et souvent doux.</li>
    </ul>

    <h2>Le français québécois</h2>
    <p>Le français de tous les jours au Québec, au Canada.</p>
    <ul>
      <li><strong>« t » et « d » devant « i » et « u »</strong> deviennent « ts » et « dz » : « tu » sonne comme « tsu », « dire » comme « dzire ».</li>
      <li><strong>Les « i », « u » et « ou » courts</strong> dans une syllabe qui finit par une consonne sont plus relâchés : « petite » a une voyelle plus proche du « i » anglais de « it ».</li>
      <li><strong>Les voyelles longues peuvent devenir des diphtongues,</strong> surtout devant « r » : « père » et « fête » peuvent glisser.</li>
      <li><strong>Des oppositions conservées</strong> que beaucoup de Parisiens ont perdues : « patte » et « pâte », et souvent « brin » et « brun ».</li>
    </ul>

    <h2>Ce qu’ils ont en commun</h2>
    <p>Le rythme et l’accent en fin de groupe, les enchaînements entre les mots, les voyelles nasales et les voyelles pures sont des traits français dans les deux. Travaille-les d’abord ; ils comptent plus pour sonner français que les différences ci-dessus.</p>
    <p>Ensuite : suis <a href="${L('/french-accent-shadowing/')}">la routine quotidienne de shadowing en français</a>.</p>`,
  },

  'spanish-accent-shadowing': {
    title: 'Améliorer ton accent en espagnol avec le shadowing : une routine quotidienne | Euno Shadowing',
    h1: 'Comment améliorer ton accent en espagnol avec le shadowing',
    crumb: 'Routine pour l’accent espagnol',
    description: 'Une routine de shadowing de 15 minutes par jour pour ton accent en espagnol : le rythme, les cinq voyelles, « r » et « rr », les b, d et g doux, les enchaînements et le suivi de tes progrès.',
    lede: 'L’espagnol a un rythme clair et régulier et seulement cinq voyelles, ce qui en fait une langue idéale pour le shadowing : une fois que tu entends les schémas, tu peux les copier de près.',
    body: `
    <h2>Ce qui fait sonner un accent espagnol</h2>
    <ul>
      <li><strong>Des syllabes régulières.</strong> L’espagnol a un rythme syllabique : les voyelles non accentuées gardent toute leur qualité au lieu de se réduire.</li>
      <li><strong>Cinq voyelles pures.</strong> « a, e, i, o, u » restent stables, sans glissement.</li>
      <li><strong>Un accent qui change le sens.</strong> « papa » et « papá », « hablo » et « habló » ne diffèrent que par l’accent.</li>
      <li><strong>Deux « r ».</strong> Un seul battement dans « pero », un « r » roulé dans « perro » et au début des mots comme « rosa ».</li>
      <li><strong>Des b, d et g doux entre deux voyelles.</strong> Dans « nada », « lobo » et « lago », les lèvres ou la langue se touchent à peine.</li>
      <li><strong>Les enchaînements.</strong> Les mots coulent ensemble, et les voyelles en bord de mot se fondent : « la_amiga », « mi_hermano ».</li>
    </ul>

    <h2>Choisis ton modèle</h2>
    <p>Choisis l’espagnol du Mexique, d’Espagne ou rioplatense, puis un locuteur. Voir <a href="${L('/spanish-accents/')}">les accents espagnols comparés</a>.</p>

    <h2>La séance de 15 minutes</h2>
    <table class="simple">
      <thead><tr><th>Étape</th><th>Durée</th><th>Ce que tu fais</th></tr></thead>
      <tbody>
        <tr><td>Écouter</td><td>2 min</td><td>Écoute l’extrait trois fois sans parler. Repère les syllabes accentuées.</td></tr>
        <tr><td>Shadowing</td><td>7 min</td><td>Environ 15 passages avec le locuteur, sans transcription.</td></tr>
        <tr><td>Enregistrer et comparer</td><td>2 min</td><td>Enregistre un passage et compare-le à l’original.</td></tr>
        <tr><td>Shadowing à nouveau</td><td>4 min</td><td>Environ 8 passages de plus, puis un enregistrement final.</td></tr>
      </tbody>
    </table>

    <p>Dans Euno, les extraits en espagnol ont la courbe de hauteur, le décalage et les mesures de rythme. L’onglet Prononciation, qui compare les sons un par un, est pour l’instant réservé à l’anglais.</p>

    <h2>Sur quoi te concentrer en espagnol</h2>
    <ul>
      <li><strong>Garde des voyelles pleines et courtes.</strong> Les francophones ont tendance à nasaliser une voyelle devant « n » ou « m » (« con », « tiempo ») : en espagnol, la voyelle reste orale et le « n » se prononce.</li>
      <li><strong>Garde la cadence.</strong> L’espagnol peut être rapide. Raccourcis ton extrait plutôt que de ralentir tes syllabes de façon irrégulière.</li>
      <li><strong>Adoucis b, d et g</strong> entre deux voyelles, et fais le « r » simple avec un battement de la pointe de la langue, pas au fond de la gorge.</li>
      <li><strong>Place l’accent</strong> là où le locuteur le met, souvent ailleurs qu’à la fin du mot, et vérifie-le dans ton enregistrement.</li>
      <li><strong>Vérifie la mélodie.</strong> Les affirmations finissent en général par une descente, les questions fermées par une montée. Une courbe de mélodie montre si tu suis le locuteur.</li>
    </ul>

    <h2>Suivre tes progrès</h2>
    <p>Enregistre un point de départ avant de commencer, puis refais les mêmes tâches toutes les quatre semaines : des phrases lues à voix haute, une minute à raconter quelque chose en espagnol et une minute à répondre à une question inconnue. Euno Shadowing le fait avec des bilans aux semaines 4, 8 et 12. Voir <a href="${L('/how-long-does-shadowing-take/')}">combien de temps prend le shadowing</a>.</p>`,
  },

  'spanish-accents': {
    title: 'Espagnol du Mexique, d’Espagne ou d’Argentine : quel accent imiter ? | Euno Shadowing',
    h1: 'Mexique, Espagne ou Río de la Plata : quel accent espagnol imiter ?',
    crumb: 'Accents espagnols',
    description: 'L’espagnol du Mexique, d’Espagne et rioplatense comparés pour le shadowing : les sons qui distinguent chacun, et comment en choisir un.',
    lede: 'Les trois sont largement compris. Choisis selon l’endroit où tu utiliseras l’espagnol et ce que tu écoutes, puis écoute les traits ci-dessous.',
    body: `
    <h2>Comment choisir</h2>
    <ul>
      <li><strong>Là où tu utiliseras l’espagnol :</strong> l’Espagne, le Mexique et l’Amérique centrale, ou l’Argentine et l’Uruguay.</li>
      <li><strong>Ce que tu regardes et écoutes.</strong> Beaucoup d’écoute dans un accent rend son shadowing plus facile.</li>
      <li><strong>Choisis-en un et garde-le,</strong> pour que ta pratique s’additionne.</li>
    </ul>

    <h2>L’espagnol du Mexique</h2>
    <p>L’accent latino-américain le plus entendu, courant dans le doublage des films.</p>
    <ul>
      <li><strong>« c » et « z » se prononcent « s » :</strong> « cielo » et « zapato » commencent par un son « s ».</li>
      <li><strong>Le « s » est conservé</strong> en fin de syllabe : « los otros », « mismo ».</li>
      <li><strong>« ll » et « y » se prononcent pareil,</strong> comme un « y » doux : « calle », « yo ».</li>
      <li><strong>Les consonnes sont en général nettes,</strong> et les voyelles non accentuées peuvent être très courtes dans la parole rapide du centre du Mexique.</li>
    </ul>

    <h2>L’espagnol d’Espagne</h2>
    <p>L’accent du centre et du nord de l’Espagne.</p>
    <ul>
      <li><strong>« c » devant « e » et « i », et « z »,</strong> se prononcent comme le « th » anglais de « think » : « cielo », « zapato », « gracias ».</li>
      <li><strong>Le « j »</strong> (et le « g » devant « e » et « i ») est un son fort et râpeux au fond de la bouche : « jamón », « gente ».</li>
      <li><strong>Le « s »</strong> se fait avec la pointe de la langue et peut sonner un peu comme « ch » pour d’autres hispanophones.</li>
      <li><strong>Un « d » final</strong> est souvent très doux ou disparaît : « Madrid », « verdad ».</li>
    </ul>

    <h2>L’espagnol rioplatense</h2>
    <p>L’espagnol de Buenos Aires et de Montevideo.</p>
    <ul>
      <li><strong>« ll » et « y » se prononcent « ch »</strong> (ou « j » comme dans « jour ») : « yo » sonne comme « cho », « calle » comme « cache ».</li>
      <li><strong>Le « s » en fin de syllabe</strong> devient souvent un « h » soufflé ou disparaît : « mismo » sonne comme « mihmo ».</li>
      <li><strong>« c » et « z » se prononcent « s »,</strong> comme au Mexique.</li>
      <li><strong>Une mélodie caractéristique</strong> avec des fins de groupe longues et descendantes, souvent comparée à l’italien.</li>
      <li><strong>« Vos »</strong> remplace « tú », avec ses propres formes verbales (« vos tenés »). C’est de la grammaire, pas de l’accent, mais tu l’entendras dans chaque extrait.</li>
    </ul>

    <h2>Ce qu’ils ont en commun</h2>
    <p>Les cinq voyelles pures, les syllabes régulières, le « r » battu et roulé, et les b, d et g doux sont espagnols dans les trois. Ce sont eux qui font la plus grande différence, quel que soit l’accent choisi.</p>
    <p>Ensuite : suis <a href="${L('/spanish-accent-shadowing/')}">la routine quotidienne de shadowing en espagnol</a>.</p>`,
  },
});
const makeFr = (h) => typo(make(h));
makeFr.code = 'fr';
export default makeFr;
