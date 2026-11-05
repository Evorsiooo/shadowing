// Textos en español del sitio público. La versión en inglés (en.mjs) es la de referencia; mismas claves.
const make = ({ SITE, L, host }) => ({
  code: 'es',
  htmlLang: 'es-ES',
  ogLocale: 'es_ES',
  label: 'Español',
  date: (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  ui: {
    skip: 'Ir al contenido',
    homeAria: `${SITE.name}, inicio`,
    mainNav: 'Navegación principal',
    footerNav: 'Pie de página',
    langNav: 'Idioma',
    langNow: 'Idioma: español',
    navWhat: '¿Qué es el shadowing?',
    navRoutine: 'Rutina diaria',
    contact: 'Contacto',
    privacy: 'Privacidad',
    terms: 'Condiciones',
    source: 'Código fuente',
    signIn: 'Iniciar sesión',
    openApp: 'Abrir la app',
    signInGoogle: 'Iniciar sesión con Google',
    ogImageAlt: `${SITE.name}: imita a un hablante real y mira qué sonidos difieren`,
    crumbs: 'Ruta de navegación',
    updated: (d) => `Última actualización: ${d}`,
    legalRef: (href) => `Esta es una traducción. Si hay alguna diferencia, prevalece la <a href="${href}" hreflang="en" lang="en">versión en inglés</a>.`,
    tryHtml: '<strong>Pruébalo con una guía a tu lado.</strong> Es totalmente gratis, sin suscripción. Euno Shadowing hace esta rutina por ti: repite el fragmento en bucle, cuenta tus pasadas, te graba y, en inglés, marca dónde tus sonidos difieren de los del hablante.',
    startFree: 'Empieza gratis con Google',
    readNext: 'Sigue leyendo',
  },
  example: {
    aria: 'Ejemplo de la pestaña Pronunciación: en la frase «I think this is the one», «think» y «this» están marcadas. En «think», el hablante dice «think» con el sonido «th» y tú dijiste una «s», así que sonó como «sink».',
    tag: 'Lo que te muestra Euno',
    sentence: 'I <mark>think</mark> <mark>this</mark> is the one.',
    word: 'think',
    speaker: 'Hablante',
    you: 'Tú',
    speakerSound: 'th',
    youSound: 's',
    note: 'El hablante dice «think» con una «th», como en «thin». Tú dijiste una «s», así que sonó como «sink».',
    more: 'Escucha al hablante y luego a ti, y oye la diferencia.',
  },
  faq: [
    ['¿Qué es el shadowing?', `Hacer shadowing es hablar a la vez que una grabación, copiando el ritmo, la entonación y los sonidos del hablante lo más fielmente posible. Entrena tu forma de hablar, no solo tu comprensión. <a href="${L('/what-is-shadowing/')}">Leer la guía completa</a>.`],
    ['¿Qué es Euno Shadowing, y tiene relación con el job shadowing o con Euno AI?', `Euno Shadowing es una aplicación web gratuita para trabajar tu acento con shadowing: hablas a la vez que fragmentos cortos de vídeos que traes tú. Tras una pasada grabada, compara tu grabación con el audio del hablante y, en inglés, marca los sonidos que difieren. También muestra tu ritmo y tu entonación junto a los suyos. No tiene relación con los programas de observación laboral como Erasmus+, con el shadowing médico ni con la plataforma de IA empresarial Euno. <a href="${L('/what-is-euno-shadowing/')}">Qué es, y qué no es</a>.`],
    ['¿Puede corregir mi pronunciación?', 'En parte, y solo en inglés. Tras una pasada grabada, la pestaña Pronunciación compara los sonidos de tu grabación con los del audio del hablante y marca hasta tres lugares donde los tuyos difieren, con las palabras en las que caen. Muestra diferencias con el hablante, no errores: te compara con el hablante que elegiste, no con una transcripción ni con un acento estándar, y no da puntuación. No te enseña dónde colocar la lengua o los labios. Es una función beta y puede interpretar mal un sonido, por eso cada elemento se puede descartar con «Me suena igual». Funciona en tu navegador, en un ordenador: está desactivada hasta que la actives en Ajustes → Análisis, lo que descarga una sola vez un modelo de voz de unos 71 MB en tu dispositivo (desde Hugging Face, un alojamiento de terceros), y tu grabación no se sube para ello. Por ahora, los fragmentos en francés y en español solo tienen las medidas de ritmo y entonación.'],
    ['¿Qué opiniones da?', 'En inglés, la pestaña Pronunciación marca hasta tres lugares por pasada grabada donde tus sonidos difieren del audio del hablante (beta, desactivada por defecto, sin puntuación). En todos los idiomas, Euno también muestra cuánto te retrasaste o adelantaste respecto al hablante, dónde fuiste más rápido o más lento, y dónde tu tono y tu acentuación fueron por otro lado. Puedes escuchar el original y tu grabación una tras otra o a la vez. Una comprobación opcional con reconocimiento de voz (solo Chrome, desactivada por defecto) puede marcar palabras poco claras. Preguntar a Euno, con tu propia clave de IA, puede responder preguntas sobre tus notas y estas medidas. Euno no da puntuación y no tiene subtítulos ni transcripciones automáticas.'],
    ['¿Cuesta algo?', 'No. Euno Shadowing es totalmente gratuito: no hay suscripción, ni plan de pago, ni nivel premium, ni tarjeta que introducir, ni anuncios. Lo único que puede costar dinero es la función opcional Ask Euno, que usa tu propia clave de IA, así que el proveedor que elijas (Anthropic, OpenAI u OpenRouter) te cobra directamente su uso. Todo lo demás funciona sin ella.'],
    ['¿Hay prueba gratuita o plan de pago?', 'No. No hay prueba gratuita porque no hay nada a lo que suscribirse: todas las funciones son gratis desde el principio y no existen planes de pago. Puedes empezar iniciando sesión con Google.'],
    ['¿Qué idiomas y acentos admite?', 'Puedes practicar inglés (australiano general, estadounidense general o británico del sur), francés (parisino o québécois) o español (mexicano, de España o rioplatense), o indicar otro acento de esos idiomas. La aplicación está disponible en español, inglés y francés. Se prevén más idiomas, como japonés y alemán. La pestaña Pronunciación, a nivel de sonidos, solo existe en inglés por ahora.'],
    ['¿Dónde se guardan mis vídeos y grabaciones?', 'En tu propio Google Drive. Al conectarlo, la app guarda tus archivos en una carpeta «Euno Shadowing», para que los tengas en todos los dispositivos donde inicies sesión, y solo puede ver los archivos que ella crea. Tu navegador también guarda una copia de los archivos que abres para que se reproduzcan al instante. Nuestro servidor solo guarda tus notas de práctica y tu progreso, nunca el audio ni el vídeo.'],
    ['¿Qué vídeos puedo usar?', 'Cualquier archivo de vídeo o audio que tengas derecho a usar para practicar: sube un archivo desde tu dispositivo o pega un enlace directo a un .mp4. Las entrevistas, pódcasts y charlas con un solo hablante claro funcionan mejor.'],
    ['¿Puedo pegar un enlace de YouTube?', 'No. Euno no descarga vídeos de YouTube ni de otros sitios. Necesitas un archivo que tengas derecho a usar, subido desde tu dispositivo o un enlace directo a un .mp4. Para practicar con un vídeo de YouTube, una extensión del navegador como Language Reactor actúa sobre la propia página; Euno sirve para recortar un fragmento de un archivo que tienes y comparar tu voz con la del hablante.'],
    ['¿Euno incluye lecciones, vídeos o transcripciones?', 'No. Haces shadowing con tus propios vídeos: sube un archivo desde tu dispositivo o pega un enlace directo a un .mp4 (no un enlace de YouTube), y recorta los fragmentos que quieras practicar. Euno no tiene biblioteca de lecciones, subtítulos ni transcripciones. Hace la rutina de shadowing con tus fragmentos y compara tu voz con la del hablante.'],
    ['¿Necesito una clave de IA?', 'No. Todo funciona sin ella. Con una clave de Anthropic, OpenAI u OpenRouter, puedes preguntar a Euno dentro de la app sobre un sonido, tus notas o tu práctica. Sin clave, las notas te dan un prompt para pegar en cualquier chatbot.'],
    ['¿Puedo conectar Claude, ChatGPT o Gemini?', 'Sí, de forma opcional. En Ajustes → Conexiones puedes vincular Claude, ChatGPT o Gemini a tus propios datos de práctica mediante MCP. Pueden leer tus notas, sesiones e historial de pronunciación, y nada más: no pueden cambiar nada y nunca reciben audio.'],
    ['¿Necesito un micrófono?', 'Sí, para grabar tus pasadas y tus revisiones. Unos auriculares ayudan, para que la voz del hablante no se cuele en tu grabación.'],
  ],
  home: {
    title: 'Euno Shadowing: práctica gratuita del acento que marca dónde tus sonidos difieren de los del hablante',
    description: 'Práctica gratuita del acento con shadowing de un hablante que eliges. Euno compara tu grabación con su audio y marca los sonidos que difieren (inglés, beta, sin puntuación), además de tu ritmo y tu entonación.',
    operatingSystem: 'Cualquiera (navegador web)',
    browserRequirements: 'Requiere un navegador moderno con acceso al micrófono.',
    featureList: ['Opiniones de pronunciación en inglés: marca los sonidos que difieren del audio del hablante, analizados en tu navegador (beta, sin puntuación)', 'Sesiones de shadowing guiadas en cuatro pasos con fragmentos de tus propios vídeos', 'Historial de pronunciación entre sesiones: lo que vuelve a aparecer', 'Comparación de ritmo y entonación con el hablante', 'Grabación y escucha lado a lado', 'Preguntar a Euno: preguntas y notas con tu propia clave de IA (opcional)', 'Conexión MCP de solo lectura con Claude, ChatGPT o Gemini (opcional)', 'Revisiones a las 12 semanas frente a un punto de partida', 'Recordatorios de práctica por Discord y notificación'],
    h1: 'Imita a un hablante real. Mira qué sonidos difieren.',
    lede: 'Euno Shadowing es una aplicación web gratuita para practicar tu acento. Recorta un fragmento corto de un vídeo de alguien cuyo acento quieres, habla a la vez que él durante quince minutos, y Euno compara tu grabación con el audio del hablante y marca los sonidos que difieren.',
    cta: 'Empezar con Google',
    how: 'Cómo funciona',
    fine: 'Totalmente gratis: sin suscripción, sin plan de pago, sin tarjeta. En tu navegador. La comparación de sonidos solo existe en inglés, y en beta. Tus archivos van a tu propio Google Drive, no a nuestro servidor.',
    caption: 'Un ejemplo de la pestaña Pronunciación, dibujado para esta página. No es una grabación real.',
    howH2: 'Una sesión, de principio a fin',
    howIntro: 'Cada sesión trabaja un fragmento de una o dos frases. Euno lo repite en bucle, cuenta tus pasadas y lleva el tiempo: tú solo escuchas y hablas.',
    steps: [
      ['Escuchar', '2 min.', 'Escucha el fragmento tres veces sin hablar. Fíjate en el ritmo y en dónde sube y baja la voz.'],
      ['Hacer shadowing', '7 min.', 'Habla a la vez que el hablante, unas 15 pasadas, sin transcripción. Copia todo: ritmo, entonación y sonidos.'],
      ['Grabar y comparar', '2 min.', 'Graba una pasada y escúchala junto al original. En inglés, la pestaña Pronunciación (beta, desactivada por defecto) marca hasta tres lugares donde tus sonidos difieren de los del hablante. También se muestran el ritmo y la entonación.'],
      ['Otra vez', '4 min.', 'Unas 8 pasadas más y una grabación final para comparar con la primera.'],
    ],
    after: '¿Poco tiempo? El modo día malo ofrece una versión de cinco minutos, para que nunca tengas que saltarte un día. Cada duración y cada número de pasadas se ajusta.',
    soundsH2: 'Tus sonidos, frente a los del hablante',
    soundsIntro: 'Esto es lo que hace la pestaña Pronunciación tras una pasada grabada. Solo existe en inglés, es una beta y está desactivada hasta que la actives en Ajustes → Análisis (una descarga única de unos 71 MB). Funciona en tu dispositivo, y tu grabación no se sube para ello.',
    soundsPoints: [
      '<strong>Comparado con el hablante, no con un manual.</strong> Euno alinea los sonidos de tu grabación con los del audio del hablante. No usa transcripción ni acento estándar: la meta es la persona que elegiste.',
      '<strong>Hasta tres lugares por pasada.</strong> Las palabras se marcan en la frase. Abre una para ver el sonido del hablante y el tuyo.',
      '<strong>Lo recuerda.</strong> Entre sesiones, Euno lleva la cuenta de qué diferencias vuelven y cuáles se han calmado, para que sepas qué escuchar después.',
      '<strong>Sin puntuación, y puede equivocarse.</strong> Quien escucha es un ordenador. Puede interpretar mal un sonido, o no mostrar nada en un fragmento ruidoso: decides tú de oído, y puedes descartar cualquier elemento con «Me suena igual».',
    ],
    whatH2: 'Tú eliges al hablante. Euno lleva la práctica.',
    whatIntro: 'Euno Shadowing es una herramienta de práctica, no un curso, así que no hay lecciones que seguir. La voz que imitas es la que elegiste, y la comparación es con esa voz.',
    whatPanels: [
      ['Tus fragmentos, tu hablante', [
        'Sube un archivo de vídeo o audio, o pega un enlace a un .mp4, y recorta un fragmento de una o dos frases.',
        'Elige al hablante cuyo acento quieras: un entrevistado, un podcaster, alguien a quien admires.',
        'No hay lecciones, subtítulos ni transcripciones incluidos. Euno aporta la rutina, el cronómetro, la grabación y la comparación.',
      ]],
      ['Preguntar a Euno, si quieres', [
        'Pregunta sobre un sonido, tus notas o tu práctica, dentro de la app. Euno conoce tus notas y lo que el ordenador marcó últimamente. No ha oído tu voz, así que puede equivocarse.',
        'Usa tu propia clave de Anthropic, OpenAI u OpenRouter: tú eliges el modelo y pagas directamente al proveedor. Solo se envía texto, nunca audio.',
        '¿Sin clave? Las notas te dan un prompt para pegar en cualquier chatbot. Todo lo demás funciona igual.',
      ]],
    ],
    featH2: 'Alrededor de la práctica',
    cards: [
      ['Fragmentos de cualquier vídeo', 'Añade un vídeo y arrastra sobre la línea de tiempo para recortar un fragmento. Una forma de onda ampliada te ayuda a cortar justo en las pausas.'],
      ['Ritmo y entonación', 'Junto a los sonidos, Euno muestra cuánto te retrasaste o adelantaste respecto al hablante y dónde tu tono y tu acentuación fueron por otro lado. Los fragmentos en francés y en español tienen esto.'],
      ['Notas que encuentran patrones', 'Apunta lo que sonó raro. Los problemas que se repiten forman una lista de puntos débiles, para saber qué trabajar después.'],
      ['Preguntar a Euno', 'Preguntas sobre un sonido o tu semana, con tu propia clave de IA. Opcional.'],
      ['Revisiones a las 12 semanas', 'Graba un punto de partida y revisa en las semanas 4, 8 y 12 con las mismas tareas, y escucha cuánto has avanzado.'],
      ['Recordatorios que se adaptan a tu día', 'Recordatorios opcionales por Discord y por notificación del navegador, para que la práctica ocurra de verdad.'],
    ],
    privH2: 'Gratis, privado y sin nada alojado por nosotros',
    panels: [
      ['Tus archivos, en tu propio Drive', [
        'Los vídeos y las grabaciones de tu voz van a una carpeta «Euno Shadowing» de tu propio Google Drive, para que los tengas en todos tus dispositivos.',
        'La app solo puede ver los archivos que guarda ahí, y nuestro servidor nunca los almacena.',
        'Nuestro servidor solo guarda tus notas de práctica, tus ajustes y tu progreso, que puedes exportar o borrar cuando quieras.',
        'La comparación de sonidos en inglés se calcula en tu navegador: tu grabación no se sube para ello.',
      ]],
      ['Tu clave de IA, tus apps de IA', [
        'Trae una clave de Anthropic, OpenAI u OpenRouter solo si quieres Preguntar a Euno. Tu clave se cifra en nuestro servidor y no se vuelve a mostrar, ni siquiera a ti.',
        'También puedes conectar Claude, ChatGPT o Gemini a tus propios datos de práctica, solo lectura, para preguntarles por tu progreso. Nunca reciben audio y no pueden cambiar nada.',
        '¿Sin clave y sin app de IA? Todo lo demás funciona igual.',
      ]],
    ],
    limitsH2: 'Lo que no hace',
    limitsIntro: 'Para que lo sepas antes de entrar.',
    limits: [
      ['Sin lecciones ni biblioteca.', 'Tú traes los vídeos. Euno no tiene cursos, fragmentos ya hechos, subtítulos ni transcripciones.'],
      ['Sin puntuación.', 'Nada dice si está bien o mal. Muestra dónde tus sonidos, tu ritmo y tu entonación difieren de los del hablante, y un ordenador puede equivocarse.'],
      ['La comparación de sonidos solo existe en inglés.', 'Es una beta. Los fragmentos en francés y en español tienen ritmo y entonación por ahora.'],
      ['Sin entrenamiento de la boca.', 'No te dice dónde colocar la lengua o los labios. Para un sonido que sigue apareciendo, combínalo con pares mínimos o una guía de fonética.'],
    ],
    faqH2: 'Preguntas',
    faqIntro: `Las respuestas cortas. Las guías profundizan en <a href="${L('/what-is-shadowing/')}">qué es el shadowing</a> y <a href="${L('/accent-shadowing/')}">la rutina diaria</a>.`,
    faqMore: `¿Algo más? <a href="${L('/contact/')}">Envíanos un mensaje</a>.`,
    finalH2: 'Empieza con un solo fragmento',
    finalP: 'Entra con Google, añade un vídeo de un hablante cuyo acento quieras, recorta una frase y haz tu primera sesión hoy.',
  },
  whatIs: {
    title: '¿Qué es el shadowing? Cómo funciona la técnica para la pronunciación | Euno Shadowing',
    h1: '¿Qué es el shadowing?',
    crumb: '¿Qué es el shadowing?',
    description: 'El shadowing consiste en hablar a la vez que una grabación. Descubre cómo funciona, por qué mejora el ritmo y la entonación, y cómo empezar.',
    lede: 'El shadowing es una técnica de expresión oral en la que repites lo que dice un hablante mientras lo dice, una fracción de segundo por detrás, como su sombra.',
    body: `
    <h2>Cómo funciona el shadowing</h2>
    <p>Pones una grabación corta de un hablante nativo o con fluidez y hablas a la vez que él, en voz alta. No esperas a que termine la frase ni lees una transcripción. Tus oídos guían y tu boca los sigue un instante después.</p>
    <p>Como no puedes pararte a pensar, acabas copiando toda la forma del discurso, no solo las palabras: dónde cae el acento, cómo sube y baja la voz, qué sílabas se comprimen y dónde hace pausas el hablante.</p>
    <p>Los intérpretes de conferencias usan el shadowing desde hace mucho como ejercicio de entrenamiento, y quienes aprenden idiomas lo han adoptado para practicar la expresión oral sin nadie más alrededor.</p>

    <h2>Por qué ayuda a tu acento</h2>
    <p>Lo que más hace notar un acento no son los sonidos sueltos, sino la <strong>prosodia</strong>: el ritmo, el acento y la entonación. Es difícil aprenderla con reglas, porque tendrías que pensar en ella de forma consciente mientras hablas. El shadowing la entrena por imitación.</p>
    <ul>
      <li><strong>Ritmo y acento.</strong> Seguir el ritmo de un hablante te obliga a acortar las sílabas átonas y alargar las tónicas como lo hace él.</li>
      <li><strong>Entonación.</strong> Copias la melodía de frases enteras, incluidas las partes que los libros de texto casi nunca mencionan.</li>
      <li><strong>Habla encadenada.</strong> Los enlaces, las reducciones y los sonidos que desaparecen vienen solos, porque no puedes pronunciar cada palabra por separado a velocidad normal.</li>
      <li><strong>Fluidez.</strong> Repetir el mismo fragmento muchas veces vuelve automáticas las frases, y te salen con más soltura cuando hablas tú.</li>
    </ul>

    <h2>Shadowing frente a escuchar y repetir</h2>
    <p>Al escuchar y repetir, oyes una frase y luego la dices. Eso te deja tiempo para volver a cómo <em>crees</em> que debería sonar la frase. Con el shadowing hablas durante la frase, lo que mantiene tu atención en lo que de verdad oyes. Los dos son útiles; el shadowing es el más exigente, y el mejor para la prosodia.</p>

    <h2>Cómo empezar</h2>
    <ol>
      <li><strong>Elige un hablante</strong> cuyo acento te gustaría tener. Las entrevistas y los pódcasts con audio claro y poco ruido de fondo funcionan bien.</li>
      <li><strong>Corta un fragmento corto</strong> de una o dos frases, de unos 10 a 20 segundos.</li>
      <li><strong>Escúchalo varias veces</strong> sin hablar.</li>
      <li><strong>Haz shadowing muchas veces seguidas</strong>, unas 15 pasadas. Está bien murmurar al principio.</li>
      <li><strong>Grábate</strong> y compara con el original. ¿Qué sigue sonando distinto?</li>
      <li><strong>Repite cada día.</strong> Quince minutos al día valen más que una hora una vez a la semana.</li>
    </ol>
    <p>Para un plan diario completo, lee <a href="${L('/accent-shadowing/')}">cómo mejorar tu acento con shadowing</a>.</p>

    <h2>Errores frecuentes</h2>
    <ul>
      <li><strong>Fragmentos demasiado largos.</strong> Si no puedes seguir el ritmo después de cinco o seis pasadas, acorta el fragmento.</li>
      <li><strong>Leer a la vez.</strong> Una transcripción te lleva hacia la ortografía y te aleja del sonido. Úsala una vez para comprobar las palabras y luego déjala.</li>
      <li><strong>Copiar solo las palabras.</strong> Lo importante es la entonación y el ritmo. Exagéralos si hace falta.</li>
      <li><strong>No escucharte nunca.</strong> No te oyes bien mientras hablas. Graba una pasada y compárala con el original.</li>
      <li><strong>Cambiar de hablante cada día.</strong> Quédate con una voz durante un tiempo para que los patrones se asienten.</li>
    </ul>`,
  },
  howTo: {
    title: 'Cómo mejorar tu acento en inglés con shadowing: una rutina diaria | Euno Shadowing',
    h1: 'Cómo mejorar tu acento en inglés con shadowing',
    crumb: 'Rutina de shadowing para el acento',
    description: 'Una rutina práctica de shadowing de 15 minutos al día para tu acento en inglés: elegir fragmentos, los cuatro pasos, grabarte y medir tu progreso durante 12 semanas.',
    lede: 'Una rutina de 15 minutos al día que acerca tu acento al de un hablante que tú eliges: qué practicar, con qué frecuencia y cómo saber si funciona.',
    body: `
    <h2>1. Elige tu acento objetivo y tu hablante</h2>
    <p>Decide qué acento quieres, por ejemplo estadounidense, británico del sur o australiano, y busca un hablante que lo tenga. Un solo hablante te da un modelo coherente; más adelante puedes añadir otros.</p>
    <p>Las buenas fuentes son entrevistas, pódcasts y charlas en las que una persona habla con naturalidad. Evita la música de fondo bajo la voz, los montajes muy editados y los textos leídos, que suenan distintos de una conversación.</p>

    <h2>2. Corta fragmentos cortos</h2>
    <p>Cada sesión usa un fragmento de una o dos frases, normalmente de 10 a 20 segundos. Corta en las pausas naturales para que el fragmento no empiece ni termine a mitad de una palabra. Elige frases que dirías tú; sus patrones pasarán antes a tu forma de hablar.</p>
    <p>Una rotación útil es un fragmento nuevo cada dos días, repitiendo entre medias el fragmento del día anterior. La repetición a lo largo de varios días es lo que hace que el cambio se quede.</p>

    <h2>3. La sesión de 15 minutos</h2>
    <table class="simple">
      <thead><tr><th>Paso</th><th>Tiempo</th><th>Qué haces</th></tr></thead>
      <tbody>
        <tr><td>Escuchar</td><td>2 min</td><td>Reproduce el fragmento tres veces sin hablar.</td></tr>
        <tr><td>Hacer shadowing</td><td>7 min</td><td>Habla a la vez que él, unas 15 pasadas, sin transcripción.</td></tr>
        <tr><td>Grabar y comparar</td><td>2 min</td><td>Graba una pasada y compárala con el original.</td></tr>
        <tr><td>Otra vez shadowing</td><td>4 min</td><td>Unas 8 pasadas más; luego graba una pasada final y compárala con la anterior.</td></tr>
      </tbody>
    </table>
    <p>Los días con mucho trabajo, haz una versión de cinco minutos: escucha y luego cinco pasadas de shadowing. Intenta no saltarte nunca dos días seguidos.</p>

    <h2>4. Cópialo todo y luego céntrate en lo que se resiste</h2>
    <p>En cada pasada, intenta copiar al hablante lo más fielmente posible, todo a la vez: ritmo, entonación y sonidos. No elijas de antemano un objetivo semanal. En cambio, apunta lo que sigue sonando raro cuando comparas las grabaciones. Cuando la misma diferencia aparece varios días, esa es la única cosa que trabajas en el último paso de tu sesión.</p>

    <h2>5. Grábate y mira, no solo escuches</h2>
    <p>Tu propia voz suena distinta desde dentro, así que grabarte es imprescindible. Ver también ayuda: una línea de entonación muestra si tu voz sube y baja tanto como la del hablante, y una medida del retraso muestra si sigues el ritmo. Las dos cosas son difíciles de juzgar solo de oído.</p>
    <p>En los fragmentos en inglés hay algo más que mirar: la pestaña Pronunciación (beta) muestra hasta tres sitios donde los sonidos que hiciste difieren de los del audio del hablante. Toma cada uno como un sitio para escuchar, no como un veredicto.</p>

    <h2>6. Mide tu progreso durante 12 semanas</h2>
    <p>El acento cambia despacio, así que las comparaciones de un día a otro engañan. Graba un punto de partida antes de empezar: unas frases leídas en voz alta, un minuto contando un fragmento con tus propias palabras y un minuto respondiendo a una pregunta que no has visto antes. Repite las mismas tareas en las semanas 4, 8 y 12 y compara. El habla espontánea es la prueba de verdad, porque la lectura en voz alta mejora antes.</p>
    <p>Para una opinión imparcial, pide a algunas personas que puntúen tus grabaciones sin saber cuál es cuál.</p>

    <h2>Consejos que marcan la diferencia</h2>
    <ul>
      <li>Usa auriculares, para oír bien al hablante y que tu grabación no lo capte.</li>
      <li>Si no puedes seguir el ritmo, ralentiza un poco el fragmento, pero mantén un tono natural.</li>
      <li>Mueve la boca y el cuerpo como el hablante; exagerar ayuda al principio.</li>
      <li>Practica a la misma hora cada día y mantén tu racha.</li>
    </ul>`,
  },
  privacy: {
    title: 'Política de privacidad | Euno Shadowing',
    description: 'Qué guarda Euno Shadowing, dónde están tus grabaciones, qué se queda en tu dispositivo para el análisis de pronunciación, cómo se tratan las claves de IA y los datos de Google, y cómo exportar o eliminar tu cuenta.',
    h1: 'Política de privacidad',
    lede: 'En resumen: tus videos y las grabaciones de tu voz se guardan en tu propio Google Drive, no en nuestro servidor. Nuestro servidor guarda tu cuenta, tus notas de práctica y tu progreso. No vendemos datos, no mostramos anuncios ni usamos rastreo.',
    body: `
    <h2>Quiénes somos</h2>
    <p>Euno Shadowing («nosotros») es el servicio de práctica de shadowing disponible en ${host}. Puedes contactarnos a través del <a href="${L('/contact/')}">formulario de contacto</a>.</p>

    <h2>Qué guardamos y por qué</h2>
    <table class="simple">
      <thead><tr><th>Datos</th><th>Dónde</th><th>Para qué</th></tr></thead>
      <tbody>
        <tr><td>La dirección de correo, el nombre y el identificador de tu cuenta de Google</td><td>Nuestra base de datos</td><td>Para iniciar tu sesión e identificar tu cuenta</td></tr>
        <tr><td>Datos de práctica: tu lista de videos, fragmentos, sesiones, notas, puntos débiles, resultados de evaluaciones, mediciones y ajustes</td><td>Nuestra base de datos</td><td>Para que la app funcione y mostrar tu progreso en cualquier dispositivo</td></tr>
        <tr><td>Videos y grabaciones de tu voz</td><td>Una carpeta «Euno Shadowing» en tu propio Google Drive, más una copia en tu navegador de los archivos que abres para que se reproduzcan al instante. Si eliges guardar los archivos solo en este navegador (Ajustes → Datos), se quedan en tu dispositivo.</td><td>Para reproducir los fragmentos y comparar tus grabaciones. No guardamos copias en nuestro servidor.</td></tr>
        <tr><td>Clave de un proveedor de IA (opcional)</td><td>Nuestra base de datos, cifrada</td><td>Para pedir comentarios de la IA al proveedor que elegiste, cuando lo pides</td></tr>
        <tr><td>Webhook e identificador de usuario de Discord (opcionales)</td><td>Nuestra base de datos</td><td>Para enviar los recordatorios de práctica que configuraste</td></tr>
        <tr><td>Resultados de pronunciación en inglés (opcional)</td><td>Nuestra base de datos, con tus datos de práctica</td><td>Para mostrar los sonidos que difirieron de los del hablante, seguirlos entre sesiones y, si lo pides, incluirlos en los comentarios de la IA. Son textos cortos, como un par de sonidos y una palabra de ejemplo, nunca audio.</td></tr>
        <tr><td>Mensajes del formulario de contacto</td><td>Nuestra base de datos</td><td>Para responderte</td></tr>
        <tr><td>Una cookie de inicio de sesión</td><td>Tu navegador</td><td>Para mantener tu sesión iniciada. Es la única cookie que usamos, y es estrictamente necesaria.</td></tr>
      </tbody>
    </table>
    <p>Nuestro proveedor de alojamiento, Cloudflare, trata datos técnicos de las solicitudes, como las direcciones IP, para servir y proteger el sitio.</p>

    <h2>Datos de Google</h2>
    <p>Cuando inicias sesión con Google, recibimos tu dirección de correo, tu nombre y el identificador de tu cuenta, y nada más. Cuando conectas Google Drive, pedimos permiso para acceder solo a los archivos que Euno Shadowing crea en tu Drive (el permiso <code>drive.file</code>). No podemos ver ninguno de tus otros archivos.</p>
    <p>El uso y la transferencia por parte de Euno Shadowing de la información recibida de las API de Google cumplen la <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Política de datos de usuario de los servicios de API de Google</a> (Google API Services User Data Policy), incluidos los requisitos de uso limitado (Limited Use). No usamos los datos de Google para publicidad, no los vendemos y no dejamos que nadie los lea, salvo cuando tú nos lo pides (por ejemplo, en una solicitud de ayuda), por motivos de seguridad o cuando lo exige la ley.</p>

    <h2>Análisis en tu dispositivo</h2>
    <p>Estas funciones opcionales están desactivadas hasta que las actives en los ajustes.</p>
    <ul>
      <li><strong>Comprobación de pronunciación en inglés (beta).</strong> Compara tu grabación con el audio del hablante dentro de tu navegador. Al activarla se descarga una vez un modelo de voz de unos 71 MB desde Hugging Face, un alojamiento de terceros. Hugging Face recibe la solicitud de ese archivo, como cualquier sitio web (por ejemplo tu dirección IP), pero no tus grabaciones ni tus datos de práctica. Tu audio no se sube para la comprobación. Sus resultados escritos (los sonidos que difirieron, palabras de ejemplo y recuentos a lo largo del tiempo) se guardan con tus datos de práctica en nuestro servidor, y las apps de IA que conectes mediante el enlace MCP de Euno pueden leerlos.</li>
      <li><strong>Palabras en la pestaña Pronunciación (beta, opcional).</strong> Un segundo ajuste independiente, en Ajustes → Análisis, descarga un modelo de reconocimiento de voz (Whisper) de unos 80 MB, una sola vez, desde Hugging Face, con las mismas condiciones de privacidad que arriba. Se ejecuta en tu navegador para mostrar las palabras sobre los sonidos, porque los clips no tienen transcripción. Tu audio no se sube para esto.</li>
      <li><strong>Comprobación por reconocimiento de voz (solo Chrome).</strong> Usa el reconocimiento de voz integrado en tu navegador. En Chrome, eso envía tu voz a Google mientras se ejecuta, según la política de privacidad de Google.</li>
    </ul>

    <h2>Comentarios de la IA</h2>
    <p>Los comentarios de la IA son opcionales. Si añades una clave, se cifra en nuestro servidor, nunca se devuelve a tu navegador y solo se usa cuando pides comentarios. Entonces, el texto de tu nota (la frase, lo que no sonó bien y tus puntos débiles recurrentes) y unas líneas cortas que describen lo medido en tu grabación (por ejemplo, un sonido o una diferencia de ritmo) se envían al proveedor que elegiste: Anthropic, OpenAI u OpenRouter. A esa solicitud se aplica su propia política de privacidad. No se envía audio.</p>

    <h2>Lo que no hacemos</h2>
    <ul>
      <li>Nada de publicidad, nada de rastreadores de analítica, nada de vender ni alquilar datos.</li>
      <li>No escuchamos tus grabaciones; no están en nuestro servidor.</li>
      <li>El administrador puede ver los datos de la cuenta (correo, fecha de alta, última visita, si Google Drive está conectado y si hay una clave de IA) para gestionar el servicio, pero no el contenido de tu práctica.</li>
    </ul>

    <h2>Cuánto tiempo guardamos los datos</h2>
    <p>Guardamos tu cuenta y tus datos de práctica hasta que eliminas tu cuenta. Los mensajes de contacto se guardan hasta que se atienden, y nunca más de un año.</p>

    <h2>Tus derechos y opciones</h2>
    <ul>
      <li><strong>Exportar:</strong> descarga una copia de seguridad completa de tus datos de práctica desde los ajustes de la app.</li>
      <li><strong>Eliminar:</strong> elimina tu cuenta desde los ajustes de la app, o pídenoslo a través del formulario de contacto. Así se borran de nuestra base de datos tu cuenta, tus datos de práctica, tu clave de IA y tus ajustes de recordatorios. Los archivos de tu Google Drive siguen siendo tuyos, y las copias en tu navegador se quedan hasta que las borres.</li>
      <li><strong>Retirar el acceso de Google</strong> en cualquier momento en los <a href="https://myaccount.google.com/permissions" rel="noopener">ajustes de tu cuenta de Google</a>.</li>
      <li>Según dónde vivas (por ejemplo, con el RGPD en la Unión Europea y el Reino Unido), también puedes tener derecho a acceder a tus datos, rectificarlos o limitar su uso, y a presentar una reclamación ante tu autoridad de protección de datos.</li>
    </ul>

    <h2>Menores</h2>
    <p>Euno Shadowing no está pensado para menores de 13 años, ni para quienes no tengan la edad mínima para usar servicios digitales en su país.</p>

    <h2>Cambios</h2>
    <p>Si cambiamos esta política, actualizaremos la fecha de arriba y te avisaremos en la app si el cambio es importante.</p>`,
  },
  terms: {
    title: 'Condiciones de uso | Euno Shadowing',
    description: 'Las condiciones de uso de Euno Shadowing, la app gratuita para practicar shadowing.',
    h1: 'Condiciones de uso',
    lede: 'Al usar Euno Shadowing aceptas estas condiciones. Son cortas; léelas, por favor.',
    body: `
    <h2>El servicio</h2>
    <p>Euno Shadowing es una app web gratuita para practicar la pronunciación con shadowing. Podemos cambiar, pausar o detener el servicio, o cualquiera de sus funciones, en cualquier momento. Intentaremos avisar de los cambios grandes, y siempre puedes exportar tus datos antes.</p>

    <h2>Tu cuenta</h2>
    <p>Inicias sesión con una cuenta de Google y eres responsable de lo que se haga con ella. A veces, el registro puede requerir un código de invitación. Podemos suspender o eliminar las cuentas que incumplan estas condiciones o que perjudiquen al servicio o a otras personas.</p>

    <h2>Tu contenido</h2>
    <ul>
      <li>Tus grabaciones, notas y datos de práctica son tuyos. Solo nos das el permiso necesario para guardarlos y procesarlos con el fin de prestarte el servicio.</li>
      <li>Añade solo videos y audios que tengas derecho a usar para tu práctica personal. No uses Euno Shadowing para compartir ni redistribuir contenido de otras personas.</li>
      <li>Hacer copias de seguridad de los archivos de tu Google Drive o de tu dispositivo es responsabilidad tuya.</li>
    </ul>

    <h2>Proveedores de IA</h2>
    <p>Si añades tu propia clave de IA, las solicitudes que hagas con ella son entre tú y ese proveedor. Se aplican sus condiciones y precios, y tú eres responsable de ese uso. Los comentarios de la IA pueden equivocarse; usa tu propio criterio.</p>

    <h2>Uso aceptable</h2>
    <p>No hagas un mal uso del servicio: nada de intentar acceder a datos de otras personas, interrumpir o sobrecargar el servicio, saltarse los límites ni usarlo para nada ilegal.</p>

    <h2>Sin garantía</h2>
    <p>Euno Shadowing se ofrece «tal cual», sin garantías de ningún tipo. No prometemos que funcione sin interrupciones ni errores, ni que vaya a cambiar tu acento. Los comentarios de pronunciación, incluidos los sonidos que la app dice que difieren de los del hablante, son una estimación automática y pueden ser erróneos. En la medida en que lo permita la ley, no somos responsables de pérdidas indirectas o consecuentes, ni de la pérdida de datos. Nada de estas condiciones limita los derechos que te otorga la normativa de protección del consumidor y que no se pueden limitar.</p>

    <h2>Cambios en estas condiciones</h2>
    <p>Podemos actualizar estas condiciones. Si sigues usando Euno Shadowing después de un cambio, se aplican las nuevas condiciones. Si no estás de acuerdo, puedes eliminar tu cuenta en cualquier momento.</p>

    <h2>Contacto</h2>
    <p>¿Preguntas? Usa el <a href="${L('/contact/')}">formulario de contacto</a>.</p>`,
  },
  contact: {
    title: 'Contacto y ayuda | Euno Shadowing',
    description: '¿Preguntas, errores o comentarios sobre Euno Shadowing? Envíanos un mensaje.',
    h1: 'Contacto y ayuda',
    lede: '¿Una pregunta, un error, una idea o una solicitud sobre tus datos? Envía un mensaje y te responderemos por correo.',
    email: 'Tu correo',
    name: 'Nombre',
    optional: '(opcional)',
    topic: 'Tema',
    topics: { question: 'Una pregunta', bug: 'Algo no funciona', feedback: 'Comentarios o una idea', account: 'Mi cuenta o mis datos' },
    message: 'Mensaje',
    honeypot: 'Deja esto vacío',
    send: 'Enviar mensaje',
    footnote: `Solo usamos tu correo para responderte. Consulta la <a href="${L('/privacy/')}">política de privacidad</a>.`,
  },
  notFound: {
    title: 'Página no encontrada | Euno Shadowing',
    description: 'Esta página no existe.',
    h1: 'Esta página no existe',
    lede: 'Puede que el enlace sea antiguo o tenga un error.',
    home: 'Ir a la página de inicio',
  },
});
make.code = 'es';
export default make;
