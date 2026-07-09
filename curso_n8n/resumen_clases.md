# Resumen consolidado de clases

Fuente: 14 videos transcritos en `transcripts/` y revisados visualmente mediante `visual_evidence/contact_sheets/`.

## Cobertura

| Archivo | Duracion aprox. | Evidencia generada |
| --- | ---: | --- |
| `2.clase1.mp4` | 81.51 min | transcript + segmentos + hoja visual |
| `3.clase2.mp4` | 81.11 min | transcript + segmentos + hoja visual |
| `4.clase3.mp4` | 78.52 min | transcript + segmentos + hoja visual |
| `4.clase4.mp4` | 10.13 min | transcript + segmentos + hoja visual |
| `5.clase5.mp4` | 67.21 min | transcript + segmentos + hoja visual |
| `7.clase6.mp4` | 83.49 min | transcript + segmentos + hoja visual |
| `7.clase7.mp4` | 12.04 min | transcript + segmentos + hoja visual |
| `8.clase8.mp4` | 56.56 min | transcript + segmentos + hoja visual |
| `10.clase9.mp4` | 63.40 min | transcript + segmentos + hoja visual |
| `11.clase10.mp4` | 77.62 min | transcript + segmentos + hoja visual |
| `12.CLASE12.mp4` | 60.13 min | transcript + segmentos + hoja visual |
| `13clase14.mp4` | 54.15 min | transcript + segmentos + hoja visual |
| `14.clase15.mp4` | 50.55 min | transcript + segmentos + hoja visual |
| `15.clase 16.mp4` | 77.39 min | transcript + segmentos + hoja visual |

Total aproximado revisado: 14.23 horas.

## Clase 1 - Fundamentos, instaladores y panorama

La primera clase presenta el curso de n8n como automatizacion e integracion de flujos de trabajo. Se introducen los conceptos de automatizacion, nube, ejecucion local y servicios conectados. Visualmente aparecen el temario, diagramas de automatizacion, descarga de Node.js, Docker Desktop, n8n Cloud y modelos locales como Ollama/Mistral.

Aprendizajes clave:

- n8n puede ejecutarse localmente, en la nube o sobre Docker.
- Node.js es una via rapida para levantar n8n local con `npx n8n`.
- Docker se plantea como opcion mas robusta para servicios posteriores.
- Ollama/Mistral permite usar IA local como alternativa a proveedores pagos.
- El proyecto final debe ser realista y automatizar un proceso de negocio.

## Clase 2 - Instalacion de n8n y primer formulario

Se trabaja con Google Forms y con n8n local. La clase muestra la ejecucion de n8n, acceso por `localhost:5678`, configuracion inicial de cuenta y creacion de un primer workflow. Aparece el trigger `On form submission`, con campos como nombre, correo y numero de documento.

Aprendizajes clave:

- Levantar n8n local y acceder desde navegador.
- Crear workflows desde cero.
- Usar un trigger de formulario para capturar datos.
- Revisar la salida del nodo en vista `Table` o `JSON`.
- Entender que los formularios son una puerta de entrada para automatizaciones.

## Clase 3 - Webhooks, ngrok y Google Cloud

La clase introduce la exposicion de servicios locales hacia internet. Se revisa ngrok, autenticacion, descarga del agente y tunnel hacia n8n local. Tambien aparece Google Cloud API Library, anticipando integraciones con servicios de Google.

Aprendizajes clave:

- Un webhook es una URL que recibe eventos o datos externos.
- ngrok permite probar webhooks locales desde servicios externos.
- La URL de produccion/test de n8n debe configurarse segun el caso.
- Google Cloud se usa para habilitar APIs y credenciales.
- Las capturas de pantalla son parte recurrente de las tareas/evaluaciones.

## Clase 4 - ngrok + Google Sheets

Clase corta orientada a configurar ngrok con authtoken y conectar un formulario de n8n con Google Sheets. Visualmente se ve el flujo `On form submission -> Append row in sheet`.

Aprendizajes clave:

- Configurar `ngrok config add-authtoken`.
- Abrir un endpoint HTTP hacia el puerto local de n8n.
- Usar Google Sheets como almacenamiento simple.
- Mapear campos del formulario hacia columnas.
- Probar el flujo con `Execute workflow`.

## Clase 5 - Google APIs, Sheets, Gmail e IA

Se profundiza la integracion con Google. La clase muestra Sheets como repositorio de respuestas, credenciales en Google Cloud/OAuth, nodos de procesamiento y envio de Gmail. Tambien se trabaja con contenido HTML para correos.

Aprendizajes clave:

- Crear y usar credenciales de Google.
- Insertar filas en Google Sheets.
- Capturar datos de contacto y requerimientos.
- Enviar correos con Gmail desde n8n.
- Construir respuestas mas presentables con HTML.
- Documentar con capturas numeradas.

## Clase 6 - Webhook/Form, OpenAI, MySQL y flujo comercial

La clase arma un flujo mas completo: formulario o webhook, limpieza con `Edit Fields`, llamada a OpenAI, Gmail, HTTP Request y MySQL. Se usa una empresa de fertilizantes como ejemplo de negocio y se redactan prompts para responder consultas de clientes.

Aprendizajes clave:

- `Webhook` y `On form submission` capturan datos de forma similar, pero sirven a contextos distintos.
- `Edit Fields` normaliza nombres, correos, telefonos y mensajes.
- OpenAI/LLM puede generar respuestas comerciales.
- MySQL permite persistir clientes y mensajes.
- El workflow final empieza a parecerse a un proyecto completo.

## Clase 7 - APIs externas y continuidad del flujo IA

Clase breve que continua con webhooks, APIs externas y respuestas. Se muestran nodos HTTP Request hacia APIs publicas, formulario de empresa, Gmail y almacenamiento en MySQL.

Aprendizajes clave:

- HTTP Request amplia n8n hacia cualquier API REST.
- Los webhooks pueden recibir eventos, pagos, mensajes o formularios.
- Las APIs deben probarse y mapearse antes de integrarlas.
- El flujo ideal valida entrada, procesa, consulta y comunica.

## Clase 8 - MySQL/XAMPP y Ollama local

Se instala o usa XAMPP/MySQL, se revisan tablas de productos y se conecta n8n a una base local. Tambien se muestra Ollama/Mistral y llamadas HTTP locales para generar respuestas sin depender de OpenAI.

Aprendizajes clave:

- MySQL puede funcionar como base central del proyecto.
- XAMPP facilita levantar MySQL localmente en Windows.
- Ollama permite IA local con modelos como Mistral.
- n8n puede llamar a IA local mediante HTTP Request.
- Una tabla de productos permite respuestas mas contextualizadas.

## Clase 9 - Landing page, webhook POST y base de datos

Se construye una landing page con HTML/CSS generada con IA, conectada por POST a un webhook de n8n. Se explican pruebas con formulario, mapeo de variables, respuesta por correo, insercion en MySQL y evidencias en Word. Tambien aparece PostGIS como referencia para casos con datos geoespaciales.

Aprendizajes clave:

- Una landing page propia mejora la presentacion del proyecto final.
- El formulario debe enviar campos por metodo POST al webhook correcto.
- Los campos faltantes deben manejarse con valores por defecto o validacion.
- MySQL guarda leads y mensajes.
- Las capturas esperadas incluyen formulario, ejecucion, correo y base de datos.

## Clase 10 - Catalogos, Drive, PDFs y LLM Chain

La clase trabaja con archivos y catalogos. Se ve Canva/Drive para generar o alojar PDFs, Google Drive para descargar archivos desde n8n, `Basic LLM Chain` con DeepSeek y un `Merge` antes de Gmail.

Aprendizajes clave:

- Un catalogo en PDF o Drive puede alimentar respuestas comerciales.
- Google Drive puede integrarse para buscar/descargar archivos.
- DeepSeek u OpenAI pueden actuar como modelo del chain.
- `Merge` permite juntar datos del cliente y datos del archivo/catalogo.
- En un proyecto final, responder con catalogo adjunto suma evidencia funcional.

## Clase 12 - GitHub Pages, Supabase y web publica

Se trabaja una pagina web en VS Code, GitHub/GitHub Pages y Supabase. La evidencia visual muestra un ejemplo de tienda de zapatillas, tablas de contactos en Supabase y pruebas de captura.

Aprendizajes clave:

- GitHub Pages sirve para publicar una landing page sin hosting complejo.
- Supabase ofrece base de datos Postgres accesible desde web y APIs.
- El proyecto puede verse mas profesional si la entrada de datos es una web real.
- Se deben cuidar permisos, tablas y pruebas de insercion.

## Clase 14 - Docker y Evolution API para WhatsApp

Se introduce Evolution API para WhatsApp. La clase muestra Docker Desktop, repositorio, archivos `.env`, `docker-compose.yml`, Postgres, Redis y Evolution Manager. Tambien se discuten riesgos, orden y alternativas de WhatsApp API.

Aprendizajes clave:

- Evolution API permite conectar WhatsApp con automatizaciones.
- Docker es necesario para levantar servicios como Evolution API de forma reproducible.
- Postgres y Redis forman parte del stack de Evolution.
- Hay que manejar claves, instancias y vinculacion de WhatsApp con cuidado.
- WhatsApp puede ser la comunicacion automatizada mas visible del proyecto.

## Clase 15 - WhatsApp operativo con Evolution API

La clase configura una instancia conectada, revisa ajustes, eventos, documentacion de API y headers con `apikey`. En n8n se observa un flujo con webhook, `Edit Fields`, AI Agent y HTTP Request para enviar mensajes.

Aprendizajes clave:

- Crear instancia de WhatsApp en Evolution Manager.
- Configurar eventos y lectura de mensajes.
- Consumir endpoints como `sendText`.
- Enviar headers `Content-Type` y `apikey`.
- Integrar IA con WhatsApp para respuesta automatizada.

## Clase 16 - AI Agent, memoria y webhooks de WhatsApp

La ultima clase trabaja con webhooks de Evolution, AI Agent, OpenAI Chat Model, memoria simple y HTTP Request de respuesta. Se observan errores de conexion y ajuste de endpoints, lo cual es importante para pruebas reales.

Aprendizajes clave:

- AI Agent puede recordar contexto usando memoria.
- Los webhooks de WhatsApp permiten recibir mensajes entrantes.
- La respuesta se envia con HTTP Request hacia Evolution API.
- Las pruebas deben incluir manejo de errores de conexion.
- Para defensa final conviene mostrar logs de ejecucion y un caso completo.

## Mapa de competencias del curso

| Competencia | Clases donde aparece |
| --- | --- |
| Instalacion local de n8n | 1, 2 |
| Docker | 1, 2, 14, 15, 16 |
| Formularios y webhooks | 2, 3, 4, 6, 7, 9, 15, 16 |
| Google Sheets | 4, 5 |
| Gmail | 5, 6, 7, 8, 9, 10 |
| Google Cloud/OAuth | 3, 4, 5 |
| HTTP Request/APIs | 6, 7, 8, 15, 16 |
| IA con OpenAI/DeepSeek/Ollama | 1, 6, 8, 10, 15, 16 |
| MySQL/XAMPP | 6, 8, 9 |
| Supabase/Postgres | 12, 14 |
| Google Drive/PDF/catalogos | 10 |
| WhatsApp/Evolution API | 14, 15, 16 |
| Evidencias para evaluacion | 3, 5, 9, 16 |

## Conclusiones para el proyecto final

El proyecto final mas fuerte debe combinar: entrada de cliente por web o WhatsApp, procesamiento con IA, consulta a datos internos, almacenamiento persistente y comunicacion automatizada. Un simple formulario a Sheets cumple lo minimo, pero un agente comercial multicanal con Gmail/WhatsApp, catalogo y base de datos cubre mejor la rubrica de integraciones, innovacion y defensa.
