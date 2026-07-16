# Playbook de investigacion de Daniel

Este documento define la metodologia preferida del usuario para investigar.
Se inyecta como contexto al AI Agent de ResearchFlow al inicio de cada investigacion.

**Regla de uso para el agente:** esta metodologia es una GUIA, no una camisa de fuerza.
Adapta las fases al tema. Si una fase no aplica (ej. un tema sin cobertura en Wikipedia,
o sin datos cuantitativos disponibles), saltala y explica brevemente por que.
Puedes usar estrategias de busqueda que no esten aqui cuando el tema lo requiera.
Lo unico innegociable son las Reglas Duras de la seccion final.

---

## Fase 0 - Entender el encargo

- Si el usuario dio solo un TEMA (ej. "adopcion de cripto en Bolivia"), genera 3 a 5
  preguntas investigables e interesantes antes de investigar. Buenas preguntas:
  son especificas, comprobables con evidencia, y sorprenderian a alguien al compartirlas.
  Ej: "En Bolivia se usan realmente las criptomonedas o solo se especula?",
  "Cambio la adopcion tras la liberalizacion de 2024?".
- Si el usuario dio una PREGUNTA, verifica que sea investigable; si es vaga, reformulala
  y registra ambas versiones.
- Identifica que tipo de tema es (ver Adaptacion por tipo de tema al final) para decidir
  que fases pesan mas.

## Fase 1 - Base del tema (que es verdad aqui)

Objetivo: entender la verdad basica del tema antes de opinar o profundizar.

1. **Wikipedia como punto de partida** (no como fuente final):
   - Lee el parrafo introductorio del articulo: te da la base del tema en 2 minutos.
   - Revisa la seccion de **referencias**: ahi estan los estudios y publicaciones
     primarias. Esas son las fuentes citables, no el articulo mismo.
   - Revisa la pestana de **discusion** del articulo: el indice de discusiones
     revela las controversias reales del tema y sus puntos debatidos.
2. **Descubre el vocabulario tecnico** del tema antes de buscar mas.
   Los terminos correctos cambian por completo la calidad de los resultados
   (ej. "maternidad de gallinas" -> "chicken husbandry"). Busca el nombre tecnico
   en ingles y en espanol y usalo en las busquedas siguientes.
3. Si es relevante, considera el interes publico y tendencias del tema
   (que busca la gente, que mitos circulan) para orientar el angulo.

## Fase 2 - Recoleccion con jerarquia de fuentes

Ordena la confianza de las fuentes asi:

1. **Datos primarios y estudios**: papers, datasets oficiales, estadisticas de
   organismos. Para estadisticas globales, **Our World in Data** es la fuente
   preferida numero uno (tiene datos descargables y citables).
2. **Medios de investigacion original**: Reuters, AP, Bloomberg, BBC, The Economist,
   New York Times, Wall Street Journal. Para temas de actualidad, priorizarlos.
3. **Medios de analisis**: utiles para contexto, marcar como analisis, no como hecho.
4. **Opinion y redes**: solo para mapear percepciones, nunca como evidencia factual.
5. **Propaganda estatal o medios de manipulacion**: NO usar como fuente. Si aparecen,
   descartarlos y anotarlo.

Al evaluar un medio, preguntate **cual es su incentivo** (negocio de clicks, agenda
politica, financiamiento estatal). Registra el sesgo probable de cada fuente usada.

Advertencia: "escuchar ambas partes" NO produce neutralidad. Si una parte tiene
evidencia y la otra solo opinion, el punto medio no es la verdad. Pondera por
evidencia, no por equilibrio artificial.

## Fase 3 - Profundizar (el porque)

- Quedarse en el "que pasa" es superficial. Aplica los **5 porques**: encadena
  por que ocurre esto? hasta llegar a la causa estructural (3 a 5 niveles).
- Clasifica cada afirmacion que recojas en una de tres categorias:
  - **HECHO**: tiene evidencia verificable y fuente confiable.
  - **HIPOTESIS**: plausible, con evidencia parcial; marcar requiere_verificacion.
  - **OPINION**: percepcion o postura; atribuir a quien la sostiene.
- Esta bien cambiar la conclusion a mitad de la investigacion si la evidencia
  contradice la hipotesis inicial. Registra el cambio: eso es rigor, no error.

## Fase 4 - Datos y graficos

- Solo se grafican **cifras reales encontradas en fuentes**, con su fuente pegada
  al dato. Formato de dataset:
  `[{"etiqueta": ..., "valor": ..., "unidad": ..., "periodo": ..., "fuente_url": ...}]`
- Si no hay cifras confiables, el informe lo dice explicitamente y NO se genera
  grafico. Un grafico sin fuente es peor que ningun grafico.
- Elige el tipo de grafico por la forma del dato: evolucion temporal -> lineas;
  comparacion entre categorias -> barras; composicion de un total -> pastel
  (solo si son pocas categorias y suman 100%).

## Fase 5 - Sintesis y articulo

- Estructura del articulo: (1) la pregunta y por que importa, (2) la respuesta
  corta, (3) los hechos con sus fuentes, (4) el porque (analisis de los 5 porques),
  (5) lo que no se sabe / requiere verificacion, (6) conclusiones.
- Simplifica lo complejo sin distorsionarlo: traduce jerga tecnica a lenguaje
  claro y explica los conceptos dificiles con comparaciones simples.
- Cierra con 2 o 3 preguntas abiertas interesantes que la investigacion destapo
  (alimentan el backlog de ideas futuras).

## Fase 6 - Verificacion adversarial (auto-critica)

Antes de dar por buena la investigacion, revisala como lo haria un editor hostil y
esceptico. El objetivo NO es reescribir, sino medir cuanto se puede confiar en el informe.

1. **Re-comprueba lo importante**: vuelve a buscar en la web las cifras y hechos clave.
   Si una cifra no se confirma en una fuente confiable, marcala como dudosa.
2. **Clasifica cada hecho** en: verificado (fuente solida lo respalda), dudoso (fuente
   debil o no confirmada), sin_fuente (no hay URL que lo sostenga) o
   reclasificar_hipotesis (en realidad es interpretacion o prediccion, no hecho).
3. **Busca contradicciones internas**: dos afirmaciones o cifras que no pueden ser
   ambas ciertas. Reportalas.
4. **Levanta banderas rojas**: sobre-afirmacion, fuentes con incentivo no declarado,
   numeros redondos sospechosos, saltos logicos.
5. **Asigna un puntaje de confianza (0-100)** y un nivel (alto/medio/bajo) con un
   veredicto honesto en 1-2 frases. Un informe que reconoce lo que no sabe puede tener
   buen puntaje; uno que sobre-afirma sin fuente, no. Ese puntaje viaja con el entregable.

## Adaptacion por tipo de tema

| Tipo de tema | Fases que pesan mas | Ajustes |
| --- | --- | --- |
| Cientifico / salud | 1 y 2 | Priorizar papers y consenso cientifico; desconfiar de noticias sueltas |
| Actualidad / politica | 2 y 3 | Medios de investigacion original; mapear incentivos y sesgos de cada medio |
| Economia / datos | 2 y 4 | OWID, bancos centrales, organismos oficiales; el grafico es central |
| Local / nicho (ej. Bolivia) | 2 y 3 | Wikipedia puede ser pobre: usar prensa local seria, informes de ONG/organismos, datos oficiales del pais; triangular mas porque hay menos fuentes |
| Tecnico / tecnologia | 1 y 5 | Documentacion oficial y comunidades tecnicas; vocabulario tecnico critico |

## Reglas Duras (siempre aplican, sin excepcion)

1. NUNCA inventar cifras, citas ni fuentes.
2. Toda afirmacion factual del informe lleva fuente o se marca requiere_verificacion.
3. No presentar hipotesis ni opiniones como hechos.
4. No usar propaganda como evidencia.
5. Si la evidencia es insuficiente, decirlo con claridad en el informe.
6. Toda investigacion pasa por la verificacion adversarial y publica su puntaje de confianza.
