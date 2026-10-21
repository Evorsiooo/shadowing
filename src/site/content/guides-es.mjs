// Textos de las guías en español. La versión en inglés (guides-en.mjs) es la de referencia; mismas claves.
const make = ({ L }) => ({
  page: {
    title: 'Guías de shadowing: técnica, rutinas y acentos | Euno Shadowing',
    description: 'Guías gratuitas de shadowing para la pronunciación: cómo funciona, cuánto tarda, cómo elegir fragmentos, y rutinas y guías de acentos para inglés, francés y español.',
    crumb: 'Guías',
    h1: 'Guías de shadowing',
    lede: 'Todo lo que necesitas para practicar shadowing por tu cuenta: cómo funciona la técnica, cómo elegir qué imitar y qué escuchar en inglés, francés y español.',
    groups: { start: 'Para empezar', english: 'Inglés', french: 'Francés', spanish: 'Español' },
    homeH2: 'Aprende la técnica',
    homeIntro: 'Guías cortas y prácticas sobre shadowing, uses la app que uses.',
    all: 'Todas las guías, con los acentos de inglés, francés y español →',
  },

  'what-is-euno-shadowing': {
    title: '¿Qué es Euno Shadowing? Qué hace y qué no hace | Euno Shadowing',
    h1: '¿Qué es Euno Shadowing? Qué es y qué no es',
    crumb: '¿Qué es Euno Shadowing?',
    description: 'Euno Shadowing es una aplicación web gratuita para trabajar tu acento haciendo shadowing con tus propios vídeos. Qué hace, qué no hace (sin lecciones, subtítulos ni transcripciones) y en qué se diferencia de nombres parecidos.',
    lede: 'Euno Shadowing es una aplicación web gratuita que lleva una rutina diaria de shadowing sobre fragmentos cortos de los vídeos que tú aportas, te graba y muestra cómo se comparan tu ritmo y tu melodía con los del hablante.',
    body: `
    <h2>En un párrafo</h2>
    <p>Añades un vídeo o un archivo de audio de un hablante cuyo acento quieres, cortas un fragmento de una o dos frases, y Euno te guía en una sesión de 15 minutos: escuchar, imitar, grabar, comparar, imitar de nuevo. Tras una pasada grabada muestra tu línea de tono junto a la del hablante, tu desfase y algunas diferencias medidas. Funciona en inglés, francés y español, en tu navegador, y es gratis.</p>

    <h2>Qué hace</h2>
    <ul>
      <li><strong>Fragmentos de tus propios vídeos.</strong> Sube un archivo o pega un enlace a un .mp4 y arrastra sobre la línea de tiempo para cortar un fragmento. Una forma de onda ampliada te ayuda a cortar en las pausas.</li>
      <li><strong>Una sesión guiada.</strong> Una rutina de cuatro pasos con temporizador, contador de pasadas y repetición automática. Incluye una versión de cinco minutos para los días malos, y cada duración es un ajuste.</li>
      <li><strong>Controles de reproducción.</strong> Repetir el fragmento en bucle, reproducir a 0,5x, 0,75x o 1x con el tono natural, y atajos de teclado.</li>
      <li><strong>Grabación y comparación.</strong> Escucha el original, a ti mismo, uno tras otro o los dos a la vez. Se guardan tus grabaciones del paso 3 y la final de cada fragmento.</li>
      <li><strong>Tono y desfase.</strong> Euno dibuja la melodía del hablante y la tuya, cada una relativa a su propia voz, y mide cuánto ibas por detrás o por delante.</li>
      <li><strong>Diferencias con el hablante.</strong> Tras una pasada puede señalar tramos en los que fuiste más rápido o más lento, donde el tono fue en dirección contraria o donde el acento de intensidad era distinto. Esto sale de medir las dos grabaciones, no de un modelo de lenguaje que escuche tu voz.</li>
      <li><strong>Notas y problemas.</strong> Apunta lo que sonó mal; los problemas que se repiten se reúnen en una lista.</li>
      <li><strong>Revisiones de 12 semanas.</strong> Un punto de partida y después las mismas tareas en las semanas 4, 8 y 12.</li>
      <li><strong>Recordatorios.</strong> Recordatorios opcionales por Discord y notificaciones del navegador.</li>
    </ul>

    <h2>Qué no hace</h2>
    <ul>
      <li><strong>No tiene lecciones ni biblioteca de contenido.</strong> Los vídeos los pones tú. No hay lecciones integradas, cursos ni fragmentos ya preparados.</li>
      <li><strong>No tiene subtítulos ni transcripciones.</strong> No transcribe el vídeo, no muestra subtítulos sincronizados y no lo divide en frases por ti. Tú eliges dónde empieza y acaba cada fragmento.</li>
      <li><strong>No toma contenido de YouTube ni de otros sitios.</strong> Usas archivos que tienes derecho a usar para tu práctica privada.</li>
      <li><strong>No puntúa los sonidos uno a uno.</strong> No te dice qué vocal o consonante pronunciaste mal, y el tono y el ritmo no equivalen por sí solos a una buena pronunciación.</li>
      <li><strong>No es un profesor, un curso ni una garantía.</strong> Es una herramienta de práctica.</li>
    </ul>

    <h2>Qué comentarios recibes</h2>
    <p>De tres tipos, que puedes usar por separado:</p>
    <ol>
      <li><strong>Comentarios medidos, siempre activos:</strong> líneas de tono, desfase y las diferencias con el hablante descritas arriba.</li>
      <li><strong>Tu propia escucha:</strong> reproducción lado a lado y tus notas sobre lo que sonó mal.</li>
      <li><strong>Comentarios de IA, opcionales:</strong> si añades tu propia clave de API de Anthropic, OpenAI u OpenRouter, puedes pedir comentarios sobre tus notas. Solo se envía texto, nunca audio, y pagas directamente al proveedor. Sin clave, Euno escribe el prompt para que lo pegues en cualquier chatbot.</li>
    </ol>

    <h2>Coste y privacidad</h2>
    <p>Euno Shadowing es gratis. Tus vídeos y grabaciones se guardan en una carpeta «Euno Shadowing» de tu propio Google Drive, no en nuestro servidor. Nuestro servidor guarda tus notas, ajustes y progreso. Los detalles están en la <a href="${L('/privacy/')}">política de privacidad</a>.</p>

    <h2>No lo confundas con</h2>
    <p>El nombre se comparte con cosas que no tienen relación, y ninguna es Euno Shadowing:</p>
    <ul>
      <li><strong>Programas de «job shadowing»</strong> (observación en el puesto de trabajo), como las visitas Erasmus+ para docentes, en las que se acompaña a un profesional en su trabajo.</li>
      <li><strong>El shadowing clínico</strong>, en el que estudiantes observan a médicos.</li>
      <li><strong>Euno, la plataforma de IA para empresas</strong>, y sus despliegues «shadow» de agentes de IA.</li>
      <li><strong>Otras aplicaciones llamadas Euno</strong>, como aplicaciones de diario personal.</li>
    </ul>
    <p>Euno Shadowing es solo la aplicación de práctica de idiomas de shadowing.euno.cc. No está afiliada a ninguna de las anteriores.</p>

    <h2>A quién le conviene</h2>
    <p>A quien entiende bastante bien un idioma y quiere sonar más natural: el ritmo, la melodía y el tempo de un hablante que admira. Si quieres un curso estructurado, una biblioteca de lecciones, subtítulos o una nota por sonido, mira la <a href="${L('/euno-vs-elsa-and-language-reactor/')}">comparación con ELSA Speak y Language Reactor</a>. ¿Empiezas con la técnica? Lee <a href="${L('/what-is-shadowing/')}">qué es el shadowing</a>.</p>`,
  },

  'how-long-shadowing-takes': {
    title: '¿Cuánto tarda el shadowing en mejorar tu acento? | Euno Shadowing',
    h1: '¿Cuánto tarda el shadowing en funcionar?',
    crumb: 'Cuánto tarda',
    description: 'Qué esperar de la práctica diaria de shadowing: qué cambia primero, qué tarda más y cómo saber si tu acento está avanzando de verdad.',
    lede: 'No hay un número fijo de días. Lo que sí puedes saber es el orden en que cambian las cosas: primero los fragmentos que practicas, luego la lectura en voz alta y por último el habla espontánea.',
    body: `
    <h2>La respuesta corta</h2>
    <p>La mayoría de la gente nota una diferencia en los fragmentos que practica ya en la primera o la segunda sesión, porque la repetición hace que esas pocas frases salgan más fluidas casi enseguida. El cambio en cómo suenas cuando hablas libremente es más lento, y se juzga mejor en semanas y meses, no en días. La velocidad depende de cuánto practiques, de lo diferente que sea el acento que buscas de tu forma de hablar actual y de la atención con que compares tus grabaciones.</p>

    <h2>Qué cambia primero</h2>
    <ol>
      <li><strong>El fragmento practicado.</strong> Después de 15 o 20 pasadas, tu ritmo y tu entonación en ese fragmento se acercan mucho a los del hablante. Es real, pero es sobre todo memoria de ese fragmento.</li>
      <li><strong>El ritmo y la entonación en general.</strong> Tras unas semanas de fragmentos diarios, los patrones de acento y la melodía empiezan a pasar a otras frases, sobre todo al leer en voz alta.</li>
      <li><strong>Los sonidos sueltos.</strong> Las vocales y consonantes que no existen en tu lengua materna suelen tardar más, porque primero tienes que oír la diferencia de forma fiable.</li>
      <li><strong>El habla espontánea.</strong> Cuando piensas en qué decir, vuelven los viejos hábitos. Es lo último que cambia, y la prueba más importante.</li>
    </ol>

    <h2>Por qué a diario es mejor que sesiones largas</h2>
    <p>El acento es un hábito motor, como un golpe de tenis. La práctica corta y frecuente da a tu memoria más ocasiones de consolidarse que una sesión larga a la semana. Quince minutos al día es un buen punto de partida; los días ocupados, cinco minutos mantienen el hábito.</p>

    <h2>Cómo saber si funciona</h2>
    <p>Las comparaciones de un día para otro engañan: hay días buenos y malos, y te acostumbras a tu propia voz. En su lugar:</p>
    <ul>
      <li><strong>Graba un punto de partida</strong> antes de empezar: unas frases leídas en voz alta, un minuto contando algo que viste y un minuto respondiendo a una pregunta que no has preparado.</li>
      <li><strong>Repite las mismas tareas</strong> más o menos cada cuatro semanas, y escucha el punto de partida y la grabación nueva una detrás de otra.</li>
      <li><strong>Pide a otras personas</strong> que digan qué grabación suena más cerca del acento que buscas, sin decirles cuál es la más reciente.</li>
    </ul>
    <p>Euno Shadowing lo incluye: un punto de partida y luego evaluaciones en las semanas 4, 8 y 12 con las mismas tareas. Doce semanas es un punto de control para comparar, no la promesa de que habrás terminado.</p>

    <h2>Por qué te estancas, y qué hacer</h2>
    <ul>
      <li><strong>Fragmentos demasiado largos o rápidos.</strong> Si no puedes seguir al hablante después de cinco pasadas, corta un fragmento más corto.</li>
      <li><strong>Copiar las palabras, no la melodía.</strong> Exagera las subidas, las bajadas y las sílabas largas hasta que te parezca un poco teatral.</li>
      <li><strong>No comparar nunca.</strong> Graba una pasada y mírala junto al original. Las líneas de entonación y el retraso muestran lo que tus oídos no captan.</li>
      <li><strong>Cambiar de hablante demasiado a menudo.</strong> Quédate con una voz unas semanas para que los patrones se asienten.</li>
      <li><strong>Hacer solo shadowing.</strong> Usa el acento también en tus propias frases: cuenta con tus palabras lo que acabas de imitar.</li>
    </ul>`,
  },

  'choosing-clips': {
    title: 'Cómo elegir hablantes y fragmentos para el shadowing | Euno Shadowing',
    h1: 'Cómo elegir hablantes y fragmentos para el shadowing',
    crumb: 'Elegir fragmentos',
    description: 'Qué hace que un fragmento sea bueno para el shadowing: el hablante adecuado, habla natural, audio claro, la duración justa y dónde cortar. Con una lista de comprobación.',
    lede: 'El fragmento que imitas decide lo que aprendes. Uno bueno es corto, natural, claro y lo dice alguien cuyo acento de verdad quieres tener.',
    body: `
    <h2>Elige primero al hablante</h2>
    <p>Elige a una persona que tenga el acento que quieres y que hable como te gustaría hablar a ti: edad parecida, registro parecido y, si puede ser, un tono de voz parecido. Copiar un modelo coherente es más fácil que promediar varios, así que quédate con ese hablante unas semanas antes de añadir otros.</p>
    <p>Si no sabes qué acento buscar, lee las guías de acentos de <a href="${L('/english-accents/')}">inglés</a>, <a href="${L('/french-accents/')}">francés</a> o <a href="${L('/spanish-accents/')}">español</a>.</p>

    <h2>Prefiere el habla natural</h2>
    <ul>
      <li><strong>Bien:</strong> entrevistas, podcasts, charlas, gente hablando a cámara, conversaciones.</li>
      <li><strong>Menos bien:</strong> audiolibros, lectura de noticias y anuncios con guion. La lectura tiene otro ritmo que la conversación.</li>
      <li><strong>Evita:</strong> música bajo la voz, varias personas hablando a la vez, montajes que cortan a mitad de frase y habla muy rápida o poco clara.</li>
    </ul>

    <h2>Acierta con la duración</h2>
    <p>Una o dos frases, normalmente de 10 a 20 segundos. Al principio, mejor más corto. Si después de cinco o seis pasadas no puedes seguir al hablante, el fragmento es demasiado largo o rápido: córtalo por la mitad.</p>

    <h2>Corta en las pausas</h2>
    <p>Empieza y termina el fragmento en un silencio entre frases, no en medio de una palabra. Una forma de onda lo hace fácil: las pausas son las partes planas. Un comienzo limpio te deja respirar y entrar a la vez que el hablante.</p>

    <h2>Elige frases que dirías tú</h2>
    <p>Las expresiones cotidianas, las opiniones y las historias pasan a tu propia forma de hablar antes que el vocabulario técnico. Un fragmento con una melodía clara, como una pregunta, un contraste («esto no, sino aquello») o una enumeración, te da más que copiar que una afirmación plana.</p>

    <h2>Usa archivos que tengas derecho a usar</h2>
    <p>Usa grabaciones que tengas derecho a usar para tu práctica personal, y no las redistribuyas. En Euno Shadowing, subes un archivo de video o audio desde tu dispositivo o pegas un enlace directo a un archivo .mp4, y luego cortas los fragmentos en la línea de tiempo.</p>

    <h2>Lista de comprobación</h2>
    <ul>
      <li>Un solo hablante, con el acento que quieres.</li>
      <li>Habla natural, sin guion.</li>
      <li>Audio claro, sin música ni voces superpuestas.</li>
      <li>Una o dos frases, de 10 a 20 segundos.</li>
      <li>Empieza y termina en una pausa.</li>
      <li>Palabras que de verdad usarías.</li>
    </ul>`,
  },

  'shadowing-vs-other-methods': {
    title: 'Shadowing frente a escuchar y repetir, pares mínimos y lectura en voz alta | Euno Shadowing',
    h1: 'El shadowing frente a otros métodos de pronunciación',
    crumb: 'Shadowing y otros métodos',
    description: 'Cómo se compara el shadowing con escuchar y repetir, los pares mínimos, la lectura en voz alta y la fonética, para qué sirve cada uno y cómo combinarlos.',
    lede: 'El shadowing es el más fuerte para el ritmo y la melodía. Otros métodos son mejores para un sonido concreto o para entender lo que oyes. A la mayoría le va mejor combinándolos.',
    body: `
    <h2>De un vistazo</h2>
    <table class="simple">
      <thead><tr><th>Método</th><th>Ideal para</th><th>Límites</th></tr></thead>
      <tbody>
        <tr><td>Shadowing</td><td>Ritmo, acento, entonación, habla encadenada, fluidez</td><td>Difícil corregir un sonido que todavía no oyes</td></tr>
        <tr><td>Escuchar y repetir</td><td>Principiantes, trabajo detallado sobre una frase</td><td>Deja tiempo para volver a cómo crees que suena</td></tr>
        <tr><td>Pares mínimos</td><td>Oír y producir un contraste, como «ship» y «sheep»</td><td>Palabras sueltas, poco ritmo o melodía</td></tr>
        <tr><td>Lectura en voz alta</td><td>Relacionar sonido y ortografía, practicar sin grabación</td><td>La ortografía te devuelve a viejos hábitos; ritmo de lectura</td></tr>
        <tr><td>Fonética y AFI</td><td>Entender qué cambia y por qué</td><td>Saber no es hacer; hace falta práctica para que se quede</td></tr>
      </tbody>
    </table>

    <h2>El shadowing</h2>
    <p>Hablas a la vez que el hablante, una fracción de segundo por detrás. Como no hay tiempo para pensar, copias toda la forma del discurso. Es exigente, y por eso funciona bien para la prosodia, la parte del acento que las reglas enseñan mal. <a href="${L('/what-is-shadowing/')}">Más sobre cómo funciona el shadowing</a>.</p>

    <h2>Escuchar y repetir</h2>
    <p>Oyes una frase y la dices en la pausa. Es más suave, y útil cuando un fragmento todavía es demasiado rápido para el shadowing. El inconveniente es el retraso: repites tu recuerdo del sonido, ya filtrado por tu propio acento.</p>

    <h2>Los pares mínimos</h2>
    <p>Practicas pares de palabras que solo se diferencian en un sonido, primero de oído y luego en voz alta. Es la forma más directa de corregir un sonido que tu lengua materna no distingue. Cuando ya oyes la diferencia, el shadowing te ayuda a mantenerla a velocidad normal.</p>

    <h2>La lectura en voz alta</h2>
    <p>Útil para practicar sin audio y para relacionar los sonidos con la ortografía. El riesgo es que la ortografía active tu pronunciación de siempre, y que el habla leída tenga un ritmo más plano que la conversación.</p>

    <h2>Aprender fonética</h2>
    <p>Saber dónde va tu lengua, o que una vocal es un diptongo, te ayuda a notar las diferencias. No cambia tu forma de hablar por sí solo; hace tu práctica más precisa.</p>

    <h2>Cómo combinarlos</h2>
    <ol>
      <li>Haz del shadowing tu base diaria: un fragmento, unos 15 minutos.</li>
      <li>Cuando compares grabaciones, anota lo que todavía suena distinto.</li>
      <li>Si el mismo sonido aparece una y otra vez, dedícale unos minutos con pares mínimos.</li>
      <li>Luego vuelve al shadowing para usar ese sonido a velocidad normal, en frases reales.</li>
    </ol>`,
  },

  'euno-vs-elsa-language-reactor': {
    title: 'Euno Shadowing frente a ELSA Speak y Language Reactor | Euno Shadowing',
    h1: 'Euno Shadowing frente a ELSA Speak y Language Reactor',
    crumb: 'Euno, ELSA y Language Reactor',
    description: 'Una comparación honesta de Euno Shadowing, ELSA Speak y Language Reactor: para qué sirve cada herramienta, qué no hace y cómo elegir o combinarlas.',
    lede: 'Estas tres herramientas se mencionan a menudo juntas, pero hacen cosas distintas. ELSA te da lecciones y puntúa tus sonidos, Language Reactor te ayuda a entender lo que ves, y Euno te ayuda a hacer shadowing de los fragmentos que elijas y a comparar tu voz con la del hablante.',
    body: `
    <p><em>Hacemos Euno Shadowing, así que léelo teniéndolo en cuenta. Describimos las otras dos a partir de sus descripciones públicas, tal como las entendemos en octubre de 2026; las funciones y los precios cambian, así que consulta sus webs antes de decidir.</em></p>

    <h2>De un vistazo</h2>
    <table class="simple">
      <thead><tr><th></th><th>Euno Shadowing</th><th>ELSA Speak</th><th>Language Reactor</th></tr></thead>
      <tbody>
        <tr><td>Qué es</td><td>Una app de práctica de shadowing con tus propios fragmentos</td><td>Una app de curso de pronunciación con lecciones y puntuación</td><td>Una extensión del navegador para aprender con Netflix y YouTube</td></tr>
        <tr><td>Contenido</td><td>Tus propios vídeos y audios: subes un archivo o pegas un enlace y cortas fragmentos</td><td>Lecciones creadas por la empresa</td><td>Los vídeos que ya ves en las plataformas de streaming</td></tr>
        <tr><td>Idea principal</td><td>Imitar a un hablante real y comparar tu entonación y tu ritmo con los suyos</td><td>Decir una frase y recibir una valoración de tus sonidos</td><td>Subtítulos dobles y diccionario emergente para entender lo que oyes</td></tr>
        <tr><td>Idiomas</td><td>Acentos de inglés, francés y español</td><td>Inglés</td><td>Muchos idiomas</td></tr>
        <tr><td>Valoración</td><td>Tu línea de entonación y tu desfase junto a los del hablante; opinión de IA opcional con tu propia clave de API</td><td>Puntuación automática de tu pronunciación</td><td>No es una herramienta de pronunciación</td></tr>
        <tr><td>Coste</td><td>Gratis; el uso de IA, si lo eliges, lo factura tu proveedor</td><td>Plan gratuito y planes de pago</td><td>Plan gratuito y planes de pago</td></tr>
      </tbody>
    </table>

    <h2>Euno Shadowing</h2>
    <p>Euno lleva la rutina de shadowing por ti. Traes un vídeo de un hablante cuyo acento quieres, cortas un fragmento de una o dos frases, y Euno lo repite en bucle, cuenta tus pasadas, te graba y dibuja tu melodía y tu desfase junto a los del hablante. Se basa en el hablante real, no en un acento modelo, así que sirve con cualquier voz que encuentres.</p>
    <p><strong>Lo que no hace:</strong> no tiene lecciones ni biblioteca propia, ni subtítulos ni transcripciones, ni integración con plataformas de streaming, ni puntuación por sonido. Muestra las diferencias con la melodía y el ritmo del hablante; no te dice qué vocal has dicho mal. La opinión de IA es opcional y usa una clave que tú pones.</p>

    <h2>ELSA Speak</h2>
    <p>ELSA es una app de pronunciación del inglés. Sigues sus lecciones y ejercicios, hablas, y la app puntúa tu pronunciación y señala los sonidos que mejorar. Es buena opción si quieres un curso estructurado y una respuesta rápida sobre sonidos concretos frente a un acento estándar.</p>
    <p><strong>En qué se diferencia:</strong> el contenido es de la empresa, no puedes practicar con tu hablante favorito, y su valoración te juzga frente a un modelo, no frente a la persona a la que imitas. Está centrada en el inglés.</p>

    <h2>Language Reactor</h2>
    <p>Language Reactor es una extensión del navegador que añade subtítulos dobles, un diccionario emergente y controles de reproducción a los vídeos de sitios como Netflix y YouTube. Sirve para entender y aprender vocabulario con contenido real, y cubre muchos idiomas.</p>
    <p><strong>En qué se diferencia:</strong> trata de la comprensión, no de medir cómo suenas. Puedes usarla con cualquier vídeo, pero no te graba ni compara tu voz con la del hablante.</p>

    <h2>Cómo elegir</h2>
    <ul>
      <li><strong>Quieres sonar como un hablante concreto</strong>, con un ritmo y una melodía lo más parecidos posible: Euno.</li>
      <li><strong>Quieres un curso guiado</strong> y comentarios sobre sonidos del inglés: ELSA.</li>
      <li><strong>Quieres entender y aprender palabras</strong> de lo que ves: Language Reactor.</li>
    </ul>

    <h2>Usarlas juntas</h2>
    <p>Compiten menos de lo que parece. Una combinación razonable: encuentra un fragmento que te guste y aprende sus palabras con Language Reactor; luego córtalo y haz shadowing en Euno. Si un mismo sonido sigue apareciendo al comparar tus grabaciones, usa un curso como ELSA, o <a href="${L('/shadowing-vs-other-methods/')}">los pares mínimos</a>, para trabajarlo, y vuelve al shadowing para usarlo a velocidad real.</p>
    <p>¿Empiezas con la técnica? Lee primero <a href="${L('/what-is-shadowing/')}">qué es el shadowing</a> y <a href="${L('/choosing-shadowing-clips/')}">cómo elegir fragmentos</a>.</p>`,
  },

  'english-accents': {
    title: '¿Qué acento inglés imitar: americano, británico o australiano? | Euno Shadowing',
    h1: '¿Qué acento inglés elegir para el shadowing?',
    crumb: 'Acentos del inglés',
    description: 'El inglés americano general, el británico del sur y el australiano general comparados para el shadowing: qué escuchar en cada uno y cómo elegir.',
    lede: 'Elige el acento que más escuchas, o el que más vas a usar, y quédate con él. Esto es lo que distingue a los tres modelos más comunes, para que sepas qué escuchar.',
    body: `
    <h2>Cómo elegir</h2>
    <ul>
      <li><strong>Dónde vives o vivirás,</strong> y con quién hablas más.</li>
      <li><strong>Lo que escuchas.</strong> Muchas horas de escucha en un acento hacen mucho más fácil imitarlo.</li>
      <li><strong>Lo que te gusta.</strong> Practicarás más con una voz que disfrutas.</li>
    </ul>
    <p>Ninguno es más «correcto» que los otros. Lo importante es elegir un modelo, para que tu práctica se acumule en lugar de mezclar rasgos de varios acentos.</p>

    <h2>Inglés americano general</h2>
    <p>El acento de la mayoría del cine, la televisión y las noticias de Estados Unidos.</p>
    <ul>
      <li><strong>La «r» se pronuncia</strong> después de vocal: «car», «hard», «water».</li>
      <li><strong>La «t» entre vocales</strong> suena casi como una «r» suave del español: «water», «better», «a lot of».</li>
      <li><strong>«Bath», «dance» y «can’t»</strong> tienen la misma vocal que «cat».</li>
      <li><strong>«Lot» y «hot»</strong> tienen una vocal abierta, sin redondear los labios, parecida a la de «father».</li>
    </ul>

    <h2>Inglés británico del sur</h2>
    <p>El acento estándar moderno de Inglaterra, a menudo llamado RP o «inglés de la BBC».</p>
    <ul>
      <li><strong>No hay «r» después de vocal</strong> salvo que siga otra vocal: «car» y «hard» terminan sin ella, pero «car alarm» se une con una «r».</li>
      <li><strong>«Bath», «dance» y «can’t»</strong> usan la vocal larga de «father».</li>
      <li><strong>«Lot» y «hot»</strong> tienen una vocal corta, con los labios redondeados.</li>
      <li><strong>«Go» y «no»</strong> empiezan en una vocal central, más o menos «e-u».</li>
      <li><strong>La «t»</strong> suele pronunciarse con claridad, aunque en el habla diaria es común un golpe de glotis, como en «football».</li>
    </ul>

    <h2>Inglés australiano general</h2>
    <p>El acento cotidiano de la mayoría de los australianos.</p>
    <ul>
      <li><strong>No hay «r» después de vocal,</strong> como en el británico del sur.</li>
      <li><strong>Diptongos más amplios:</strong> las vocales de «day», «my» y «no» empiezan más lejos de donde terminan que en los otros dos acentos.</li>
      <li><strong>La «t» entre vocales</strong> suele sonar como una «r» suave, como en el americano: «water», «better».</li>
      <li><strong>«Bath» y «can’t»</strong> suelen llevar la vocal larga, pero «dance» y «plant» a menudo llevan la de «cat».</li>
      <li><strong>Una entonación ascendente</strong> al final de algunas afirmaciones es común en el habla informal.</li>
    </ul>

    <h2>Qué escuchar al hacer shadowing</h2>
    <p>Elijas el acento que elijas, las mayores diferencias con tu forma de hablar suelen ser el ritmo y la melodía, no los sonidos sueltos. El inglés tiene ritmo acentual: las sílabas tónicas son largas y claras, y las de en medio son cortas y reducidas, a menudo a una vocal neutra rápida. Para quien habla español, este es el cambio más grande: no des a todas las vocales la misma duración. Copia primero ese contraste. Después trabaja los rasgos de arriba que tus grabaciones muestran que te faltan.</p>
    <p>¿Listo para empezar? Sigue <a href="${L('/accent-shadowing/')}">la rutina diaria de shadowing en inglés</a>.</p>`,
  },

  'french-accent-shadowing': {
    title: 'Cómo mejorar tu acento en francés con shadowing: una rutina diaria | Euno Shadowing',
    h1: 'Cómo mejorar tu acento en francés con shadowing',
    crumb: 'Rutina para el acento francés',
    description: 'Una rutina diaria de shadowing de 15 minutos para tu acento en francés: el ritmo, la liaison y el encadenamiento, las vocales, las vocales nasales y la «r» francesa.',
    lede: 'El ritmo del francés funciona distinto, y justamente por eso ayuda el shadowing: copias el flujo de grupos de palabras enteros en lugar de ir palabra por palabra.',
    body: `
    <h2>Qué hace que un acento suene francés</h2>
    <ul>
      <li><strong>Sílabas regulares.</strong> Como el español, el francés tiene ritmo silábico: cada sílaba dura más o menos lo mismo.</li>
      <li><strong>El acento al final del grupo.</strong> La última sílaba de cada grupo de palabras es un poco más larga, a menudo con una subida en medio de la frase y una bajada al final. Las palabras sueltas no llevan su propio acento.</li>
      <li><strong>El encadenamiento.</strong> Las palabras se unen: una consonante final se junta con la vocal siguiente (<em>enchaînement</em>, como en «elle a»), y algunas consonantes finales mudas se pronuncian delante de vocal (<em>liaison</em>, como en «les amis»).</li>
      <li><strong>Más vocales que en español.</strong> Contrastes como «u» y «ou» («rue» y «roue»), «é» y «è», o la «e» de «le», cambian el significado o el acento.</li>
      <li><strong>Las vocales nasales</strong> de «vent», «vin» y «bon», y la «r» uvular, que se hace al fondo de la boca.</li>
    </ul>

    <h2>Elige tu modelo</h2>
    <p>Decide entre el francés de Francia (parisino) y el francés de Quebec, y luego busca un hablante. Mira <a href="${L('/french-accents/')}">los acentos del francés comparados</a>. Las entrevistas, los podcasts y la gente hablando a cámara funcionan mejor; las noticias leídas son más formales que el francés de todos los días.</p>

    <h2>La sesión de 15 minutos</h2>
    <table class="simple">
      <thead><tr><th>Paso</th><th>Tiempo</th><th>Qué haces</th></tr></thead>
      <tbody>
        <tr><td>Escuchar</td><td>2 min</td><td>Escucha el fragmento tres veces sin hablar. Fíjate dónde termina cada grupo y dónde sube o baja la voz.</td></tr>
        <tr><td>Shadowing</td><td>7 min</td><td>Unas 15 pasadas a la vez que el hablante, sin transcripción.</td></tr>
        <tr><td>Grabar y comparar</td><td>2 min</td><td>Graba una pasada y compárala con el original.</td></tr>
        <tr><td>Shadowing otra vez</td><td>4 min</td><td>Unas 8 pasadas más y una grabación final.</td></tr>
      </tbody>
    </table>

    <h2>En qué fijarte en francés</h2>
    <ul>
      <li><strong>No acentúes cada palabra.</strong> Quien habla español tiende a marcar la sílaba tónica de cada palabra; en francés solo se alarga el final de cada grupo.</li>
      <li><strong>Trabaja las vocales nuevas.</strong> La «u» francesa se hace con los labios de «u» y la lengua de «i». Si se te escapa, practica unos minutos con pares mínimos.</li>
      <li><strong>Encadena todo.</strong> Haz el shadowing a velocidad normal para que las palabras se fundan; si un encadenamiento te suena raro, probablemente es correcto.</li>
      <li><strong>Ojo con la «e» que desaparece.</strong> En el francés de todos los días muchas «e» se pierden («je suis» puede sonar como «j’suis»). Copia lo que hace el hablante, no la ortografía.</li>
      <li><strong>Revisa la melodía.</strong> Una línea de entonación muestra si tu voz sube al final de cada grupo dentro de la frase y baja al final.</li>
    </ul>

    <h2>Sigue tu progreso</h2>
    <p>Graba un punto de partida antes de empezar y repite las mismas tareas cada cuatro semanas: unas frases leídas en voz alta, un minuto contando algo en francés y un minuto respondiendo a una pregunta nueva. Euno Shadowing lo hace con evaluaciones en las semanas 4, 8 y 12. Mira <a href="${L('/how-long-does-shadowing-take/')}">cuánto tarda el shadowing</a>.</p>`,
  },

  'french-accents': {
    title: 'Francés parisino o de Quebec: ¿qué acento imitar? | Euno Shadowing',
    h1: 'Parisino o quebequense: ¿qué acento francés imitar?',
    crumb: 'Acentos del francés',
    description: 'El francés de Francia (parisino) y el de Quebec comparados para el shadowing: las principales diferencias de vocales, consonantes y melodía, y cómo elegir.',
    lede: 'Las dos son variedades completas y estándar del francés, con millones de hablantes. Elige la que más vas a oír y usar, y escucha los rasgos de abajo.',
    body: `
    <h2>Cómo elegir</h2>
    <ul>
      <li><strong>Dónde vas a usar el francés:</strong> Francia, Bélgica, Suiza y la mayor parte del mundo francófono están más cerca del modelo de Francia; Quebec y buena parte del Canadá francófono usan el quebequense.</li>
      <li><strong>Lo que ves y escuchas.</strong> Mucha escucha en una variedad hace más fácil imitarla.</li>
      <li><strong>Elige una y quédate con ella,</strong> para que tu práctica se acumule.</li>
    </ul>

    <h2>El francés de Francia (parisino)</h2>
    <p>El acento estándar de Francia, el que se oye en la televisión y la radio nacionales.</p>
    <ul>
      <li><strong>Las vocales se mantienen puras,</strong> incluso las largas.</li>
      <li><strong>Varios contrastes antiguos se han fusionado</strong> para muchos hablantes: «brin» y «brun» suenan igual, y a menudo también «patte» y «pâte».</li>
      <li><strong>Muchas «e» mudas desaparecen</strong> al hablar: «petit» puede sonar como «p’tit».</li>
      <li><strong>La «r»</strong> es uvular, al fondo de la boca, y a menudo suave.</li>
    </ul>

    <h2>El francés de Quebec</h2>
    <p>El francés de todos los días en Quebec, Canadá.</p>
    <ul>
      <li><strong>«t» y «d» delante de «i» y «u»</strong> se vuelven «ts» y «dz»: «tu» suena como «tsu», «dire» como «dzire».</li>
      <li><strong>La «i», la «u» y la «ou» cortas</strong> en sílaba que termina en consonante se relajan: «petite» tiene una vocal más parecida a la del inglés «it».</li>
      <li><strong>Las vocales largas pueden diptongarse,</strong> sobre todo delante de «r»: «père» y «fête» pueden deslizarse.</li>
      <li><strong>Mantiene contrastes</strong> que muchos parisinos han perdido: «patte» y «pâte», y a menudo «brin» y «brun».</li>
    </ul>

    <h2>Lo que comparten</h2>
    <p>El ritmo y el acento al final del grupo, el encadenamiento entre palabras, las vocales nasales y las vocales puras son rasgos franceses en los dos. Trabájalos primero; importan más para sonar francés que las diferencias de arriba.</p>
    <p>Después: sigue <a href="${L('/french-accent-shadowing/')}">la rutina diaria de shadowing en francés</a>.</p>`,
  },

  'spanish-accent-shadowing': {
    title: 'Cómo mejorar tu acento en español con shadowing: una rutina diaria | Euno Shadowing',
    h1: 'Cómo mejorar tu acento en español con shadowing',
    crumb: 'Rutina para el acento español',
    description: 'Una rutina diaria de shadowing de 15 minutos para tu acento en español: el ritmo, las cinco vocales, «r» y «rr», la b, d y g suaves, el encadenamiento y cómo seguir tu progreso.',
    lede: 'El español tiene un ritmo claro y regular y solo cinco vocales, lo que lo hace ideal para el shadowing: cuando oyes los patrones, puedes copiarlos de cerca.',
    body: `
    <h2>Qué hace que un acento suene español</h2>
    <ul>
      <li><strong>Sílabas regulares.</strong> El español tiene ritmo silábico: las vocales átonas mantienen su timbre en lugar de reducirse.</li>
      <li><strong>Cinco vocales puras.</strong> «a, e, i, o, u» se mantienen estables, sin deslizarse como en el inglés «day» o «go».</li>
      <li><strong>Un acento que cambia el significado.</strong> «papa» y «papá», «hablo» y «habló» solo se diferencian por el acento.</li>
      <li><strong>Dos erres.</strong> Un solo toque en «pero», una vibrante múltiple en «perro» y al principio de palabras como «rosa».</li>
      <li><strong>b, d y g suaves entre vocales.</strong> En «nada», «lobo» y «lago», los labios o la lengua apenas se tocan.</li>
      <li><strong>El encadenamiento.</strong> Las palabras fluyen juntas, y las vocales en los bordes de palabra se unen: «la_amiga», «mi_hermano».</li>
    </ul>

    <h2>Elige tu modelo</h2>
    <p>Elige el español de México, de España o rioplatense, y luego un hablante. Mira <a href="${L('/spanish-accents/')}">los acentos del español comparados</a>.</p>

    <h2>La sesión de 15 minutos</h2>
    <table class="simple">
      <thead><tr><th>Paso</th><th>Tiempo</th><th>Qué haces</th></tr></thead>
      <tbody>
        <tr><td>Escuchar</td><td>2 min</td><td>Escucha el fragmento tres veces sin hablar. Fíjate en qué sílabas llevan el acento.</td></tr>
        <tr><td>Shadowing</td><td>7 min</td><td>Unas 15 pasadas a la vez que el hablante, sin transcripción.</td></tr>
        <tr><td>Grabar y comparar</td><td>2 min</td><td>Graba una pasada y compárala con el original.</td></tr>
        <tr><td>Shadowing otra vez</td><td>4 min</td><td>Unas 8 pasadas más y una grabación final.</td></tr>
      </tbody>
    </table>

    <h2>En qué fijarte en español</h2>
    <ul>
      <li><strong>Mantén las vocales plenas y cortas.</strong> Quien habla inglés tiende a reducir las vocales átonas y a deslizar las tónicas; el español no hace ninguna de las dos cosas.</li>
      <li><strong>Mantén el compás.</strong> El español puede ser rápido. Acorta el fragmento antes que alargar tus sílabas de forma irregular.</li>
      <li><strong>Suaviza la b, la d y la g</strong> entre vocales, y pronuncia «p», «t» y «k» sin el soplo de aire que tienen en inglés.</li>
      <li><strong>Pon el acento</strong> donde lo pone el hablante, y compruébalo en tu grabación.</li>
      <li><strong>Revisa la melodía.</strong> Las afirmaciones suelen terminar bajando y las preguntas de sí o no, subiendo. Una línea de entonación muestra si sigues al hablante.</li>
    </ul>

    <h2>Sigue tu progreso</h2>
    <p>Graba un punto de partida antes de empezar y repite las mismas tareas cada cuatro semanas: frases leídas en voz alta, un minuto contando algo en español y un minuto respondiendo a una pregunta nueva. Euno Shadowing lo hace con evaluaciones en las semanas 4, 8 y 12. Mira <a href="${L('/how-long-does-shadowing-take/')}">cuánto tarda el shadowing</a>.</p>`,
  },

  'spanish-accents': {
    title: 'Español de México, de España o rioplatense: ¿qué acento imitar? | Euno Shadowing',
    h1: 'México, España o Río de la Plata: ¿qué acento del español imitar?',
    crumb: 'Acentos del español',
    description: 'El español de México, el de España y el rioplatense comparados para el shadowing: los sonidos que distinguen a cada uno y cómo elegir cuál practicar.',
    lede: 'Los tres se entienden en todas partes. Elige según dónde vas a usar el español y lo que escuchas, y luego fíjate en los rasgos de abajo.',
    body: `
    <h2>Cómo elegir</h2>
    <ul>
      <li><strong>Dónde vas a usar el español:</strong> España, México y Centroamérica, o Argentina y Uruguay.</li>
      <li><strong>Lo que ves y escuchas.</strong> Mucha escucha en un acento hace más fácil imitarlo.</li>
      <li><strong>Elige uno y quédate con él,</strong> para que tu práctica se acumule.</li>
    </ul>

    <h2>Español de México</h2>
    <p>El acento latinoamericano más escuchado, habitual en el doblaje de películas.</p>
    <ul>
      <li><strong>La «c» y la «z» suenan como «s»:</strong> «cielo» y «zapato» empiezan con sonido de «s».</li>
      <li><strong>La «s» se mantiene</strong> al final de sílaba: «los otros», «mismo».</li>
      <li><strong>La «ll» y la «y» suenan igual,</strong> como una «y» suave: «calle», «yo».</li>
      <li><strong>Las consonantes suelen ser claras,</strong> y en el habla rápida del centro de México las vocales átonas pueden ser muy breves.</li>
    </ul>

    <h2>Español de España</h2>
    <p>El acento del centro y el norte de España.</p>
    <ul>
      <li><strong>La «c» delante de «e» e «i», y la «z»,</strong> se pronuncian como la «th» inglesa de «think»: «cielo», «zapato», «gracias».</li>
      <li><strong>La «j»</strong> (y la «g» delante de «e» e «i») es un sonido fuerte y áspero al fondo de la boca: «jamón», «gente».</li>
      <li><strong>La «s»</strong> se hace con la punta de la lengua y a otros hispanohablantes les puede sonar un poco a «sh».</li>
      <li><strong>La «d» final</strong> suele ser muy suave o desaparecer: «Madrid», «verdad».</li>
    </ul>

    <h2>Español rioplatense</h2>
    <p>El español de Buenos Aires y Montevideo.</p>
    <ul>
      <li><strong>La «ll» y la «y» suenan como «sh»</strong> (o «zh»): «yo» suena como «sho», «calle» como «cashe».</li>
      <li><strong>La «s» al final de sílaba</strong> a menudo se aspira como una «h» o desaparece: «mismo» suena como «mihmo».</li>
      <li><strong>La «c» y la «z» suenan como «s»,</strong> como en México.</li>
      <li><strong>Una melodía característica,</strong> con finales de frase largos y descendentes, que a menudo se compara con el italiano.</li>
      <li><strong>El «vos»</strong> reemplaza al «tú», con sus propias formas verbales («vos tenés»). Es gramática, no acento, pero lo oirás en cada fragmento.</li>
    </ul>

    <h2>Lo que comparten</h2>
    <p>Las cinco vocales puras, las sílabas regulares, la «r» simple y la múltiple, y la b, d y g suaves son españolas en los tres. Son lo que más cambia lo español que suenas, elijas el acento que elijas.</p>
    <p>Después: sigue <a href="${L('/spanish-accent-shadowing/')}">la rutina diaria de shadowing en español</a>.</p>`,
  },
});
make.code = 'es';
export default make;
