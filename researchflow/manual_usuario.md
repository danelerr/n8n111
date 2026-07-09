# Manual de usuario - ResearchFlow v2

## 1. Que es ResearchFlow

ResearchFlow es un asistente de investigacion automatizado. Recibe un tema o una pregunta (desde una pagina web o por WhatsApp), investiga con IA usando busqueda en Google, y entrega un articulo con hechos citados, graficos con fuente y preguntas abiertas. Tambien mantiene un backlog de ideas y envia un resumen semanal.

Canales disponibles:

| Canal | Para que sirve |
| --- | --- |
| Landing page (web) | Pedir una investigacion completa o pedir preguntas sobre un tema |
| WhatsApp | Capturar ideas sueltas, refinarlas conversando y lanzar investigaciones |
| Correo (Gmail) | Recibir los articulos, las preguntas propuestas y el digest semanal |

## 2. Uso desde la landing page

Abrir la landing (publicada en Vercel) y completar el formulario:

- **Nombre** y **correo**: obligatorios; el correo es donde llega el resultado.
- **WhatsApp**: opcional; si se llena, llega un aviso corto cuando el articulo este listo.
- **Tema**: obligatorio; de que trata la investigacion.
- **Pregunta central**: opcional. Este campo decide el modo de trabajo (ver abajo).
- **URL o texto de fuente**: opcional; material inicial que quieres que se considere.
- **Tipo de entregable** y **prioridad**: preferencias de formato y urgencia.

### 2.1 Caso A: envias TEMA sin pregunta

Si dejas vacio el campo "Pregunta central", el sistema NO investiga todavia. En su lugar:

1. Genera de 3 a 5 preguntas investigables e interesantes sobre el tema.
2. Las muestra en pantalla en la misma landing (con la razon de por que cada una es interesante).
3. Envia las mismas preguntas a tu correo.
4. Guarda el tema y las preguntas en el backlog de ideas.

Tiempo esperado: entre 10 y 40 segundos (una sola llamada a la IA).

Siguiente paso: elige la pregunta que mas te interese, pegala en el campo "Pregunta central" y vuelve a enviar el formulario para lanzar la investigacion completa.

### 2.2 Caso B: envias TEMA con PREGUNTA

Si llenas la pregunta central, el sistema lanza la investigacion profunda:

1. La landing responde de inmediato "investigacion en curso" con un numero de solicitud (ej. #12). Puedes cerrar la pagina: el resto llega por correo.
2. En segundo plano corren tres fases de investigacion con IA y busqueda en Google: base del tema, profundizacion (los 5 porques y datos numericos con fuente) y sintesis.
3. Al terminar recibes:
   - **Correo** con el articulo completo en HTML: respuesta corta, hechos con fuentes, analisis, graficos (si hubo cifras confiables) y preguntas abiertas.
   - **Aviso por WhatsApp** (solo si diste tu numero) indicando que el articulo ya esta en tu correo.

Tiempo esperado: entre 2 y 10 minutos segun el tema. Si despues de 15 minutos no llega nada, ver la seccion de preguntas frecuentes.

## 3. Uso por WhatsApp

Escribe al numero de WhatsApp conectado al sistema. Hay tres formas de interactuar:

### 3.1 Mandar una idea vaga

Escribe la idea tal como se te ocurra, por ejemplo: "algo sobre el litio en Bolivia" o "me pregunto si la gente realmente usa cripto aca".

El asistente de ideas responde conversando: refina el tema, te propone preguntas investigables **numeradas** y guarda la idea en el backlog. Tiene memoria por numero, asi que puedes seguir la conversacion ("mas enfocado en empleo", "y si lo comparamos con Chile?") y el asistente recuerda el contexto.

### 3.2 Comando "ideas"

Envia la palabra `ideas` para recibir la lista del backlog: cada idea con su numero, tema y estado. Ese numero es el que se usa para lanzar la investigacion.

### 3.3 Comando "investigar N"

Envia `investigar 3` (o el numero que corresponda) para lanzar la investigacion completa de esa idea. Respuestas esperadas:

- Confirmacion inmediata por WhatsApp de que la investigacion se lanzo y la idea quedo en cola.
- En unos minutos, el articulo llega al correo del propietario configurado, con aviso por WhatsApp.
- Si el numero no existe en el backlog, el sistema responde que no encontro la idea y sugiere enviar `ideas` para ver la lista.

## 4. Digest semanal

Cada lunes a las 8:00 el sistema revisa el backlog de ideas pendientes, redacta un resumen breve con IA y lo envia:

- Por **correo**: lista de ideas pendientes con sus preguntas sugeridas y una recomendacion de por donde empezar.
- Por **WhatsApp**: aviso corto de que el digest esta en el correo.

Sirve para no perder ideas capturadas durante la semana. Para investigar una, responde por WhatsApp con `investigar N`.

## 5. Como leer el articulo recibido

El articulo sigue una estructura fija pensada para separar lo verificado de lo especulativo:

| Seccion | Que contiene | Como leerla |
| --- | --- | --- |
| La pregunta y por que importa | Contexto del encargo | Verifica que se investigo lo que pediste |
| Respuesta corta | La conclusion en 2-3 lineas | Es el resumen ejecutivo |
| Hechos con fuentes | Afirmaciones con evidencia verificable | Cada hecho lleva su fuente; puedes abrir los enlaces |
| El porque | Analisis de causas (metodo de los 5 porques) | Explica la cadena causal, no solo el sintoma |
| Hipotesis y opiniones | Afirmaciones plausibles sin evidencia completa | Van marcadas como `requiere_verificacion` u opinion atribuida; NO son hechos |
| Graficos | Imagenes con cifras reales | Cada grafico sale de datos con fuente; la fuente acompana al dato |
| Lo que no se sabe | Vacios de informacion detectados | Honestidad sobre los limites de la evidencia |
| Preguntas abiertas | 2-3 preguntas nuevas que destapo la investigacion | Puedes mandarlas por WhatsApp como nuevas ideas |

Regla central del sistema: **nunca inventa cifras ni fuentes**. Si una afirmacion no tiene fuente confiable, aparece marcada como hipotesis o como pendiente de verificacion. Si no se encontraron cifras confiables, el articulo lo dice y no incluye grafico.

## 6. Preguntas frecuentes

**No me llego el correo.**
1) Revisa la carpeta de spam o promociones. 2) Verifica que escribiste bien tu correo en el formulario. 3) Espera hasta 15 minutos en investigaciones completas. 4) Si sigue sin llegar, avisa al administrador: puede revisar el estado de tu solicitud con el numero que te dio la landing.

**El articulo llego sin grafico.**
Es a proposito. El sistema solo grafica cifras reales encontradas en fuentes confiables, con la fuente pegada a cada dato. Si la investigacion no encontro cifras confiables, el articulo lo dice de forma explicita y no genera grafico. Un grafico sin fuente seria peor que ningun grafico.

**Envie el formulario y solo recibi preguntas, no un articulo.**
Dejaste vacio el campo "Pregunta central". Ese es el modo de generacion de preguntas. Elige una de las preguntas propuestas, pegala en el campo y vuelve a enviar.

**La landing dice "No se pudo enviar".**
El servidor puede estar apagado o el workflow inactivo. Avisa al administrador. Para demostraciones existe un modo demo que no depende del servidor de produccion.

**WhatsApp no me responde.**
Verifica que escribes al numero correcto. Los comandos deben ir como texto simple: `ideas` o `investigar 3`. Mensajes de grupos no se procesan (el sistema solo atiende chats directos). Si nada responde, la instancia de WhatsApp puede estar desconectada: avisa al administrador.

**Le mande "investigar 99" y dice que no encontro la idea.**
El numero no existe en el backlog. Envia `ideas` para ver los numeros validos.

**Puedo confiar en las cifras del articulo?**
Cada cifra lleva su fuente al lado. Aun asi, el articulo es un primer borrador riguroso, no una investigacion cerrada: revisa las afirmaciones marcadas `requiere_verificacion` antes de publicar o citar.

**Puedo pedir varios articulos seguidos?**
Si, cada solicitud se procesa por separado y recibe su propio numero. Para uso razonable no hay limite practico; el costo por investigacion es de centavos.
