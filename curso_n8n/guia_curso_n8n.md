# Guia tecnica consolidada del curso n8n

Esta guia resume el contenido practico del curso y lo convierte en criterios de implementacion para el proyecto final.

## 1. Entorno base

Herramientas vistas:

- Node.js para ejecutar n8n local con `npx n8n`.
- Docker Desktop para servicios mas robustos.
- n8n local en `http://localhost:5678`.
- ngrok para exponer un servicio local a internet durante pruebas.
- XAMPP/MySQL o Supabase/Postgres para almacenamiento.
- VS Code para landing pages y archivos del proyecto.
- Google Cloud para habilitar APIs y credenciales OAuth.

Instaladores registrados:

- Node.js: `https://nodejs.org/en`
- Docker Desktop: `https://docs.docker.com/desktop/setup/install/windows-install/`

## 2. Conceptos centrales

### Workflow

Un workflow es una secuencia de nodos. Cada nodo recibe datos, los transforma o llama un servicio externo. En defensa, hay que explicar el flujo de punta a punta: entrada, procesamiento, decision, salida y registro.

### Trigger

El trigger inicia el workflow. En el curso se usaron:

- `On form submission`: formulario interno de n8n.
- `Webhook`: endpoint HTTP para formularios web, APIs, WhatsApp o servicios externos.
- Trigger manual para pruebas.

### Webhook

Un webhook recibe solicitudes HTTP. En el curso se uso principalmente con POST para capturar formularios o eventos. Buenas practicas:

- Usar URL de test para pruebas y production URL para entrega.
- Definir metodo HTTP correcto.
- Validar que el formulario envie los mismos nombres de campos que n8n espera.
- Guardar evidencia de la llamada y del output JSON.

### Edit Fields

Nodo usado para limpiar y mapear datos. Sirve para convertir datos de entrada en campos consistentes:

- `nombre`
- `email`
- `celular`
- `mensaje`
- `origen`
- `fecha_registro`

Tambien permite definir valores por defecto cuando falta un dato.

## 3. Integraciones Google

### Google Sheets

Uso principal: base de datos simple para formularios y leads.

Flujo tipico:

1. Trigger de formulario o webhook.
2. Edit Fields.
3. Google Sheets `Append row in sheet`.

Ventajas:

- Rapido de mostrar en defensa.
- Facil de revisar por el docente.
- No requiere una interfaz administrativa compleja.

Limitaciones:

- No es ideal para consultas complejas.
- Puede quedarse corto si se necesita historial relacional.

### Gmail

Uso principal: comunicacion automatizada.

Buenas practicas:

- Asunto claro con nombre del cliente o numero de solicitud.
- Cuerpo HTML legible.
- Incluir resumen de lo solicitado y siguiente paso.
- Guardar copia o log del envio.

### Google Drive

Uso principal: almacenar y recuperar catalogos, PDFs o adjuntos.

Patron visto:

1. Buscar o descargar archivo desde Drive.
2. Combinarlo con datos del cliente.
3. Usarlo como insumo para respuesta o adjunto de Gmail.

## 4. Bases de datos

### MySQL/XAMPP

Se uso para guardar clientes, mensajes y productos. Es buena opcion si se quiere demostrar SQL local.

Tabla minima recomendada:

```sql
CREATE TABLE leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(160),
  celular VARCHAR(40),
  mensaje TEXT NOT NULL,
  categoria VARCHAR(80),
  respuesta_ia TEXT,
  canal VARCHAR(40) DEFAULT 'web',
  estado VARCHAR(40) DEFAULT 'nuevo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Supabase/Postgres

Se vio como alternativa moderna para publicar una web y guardar contactos. Ventajas:

- Panel web facil de mostrar.
- Base Postgres gestionada.
- APIs disponibles.
- Mejor aspecto profesional para defensa.

### PostGIS

Se menciono para proyectos con datos geoespaciales. Solo conviene usarlo si el proyecto realmente necesita coordenadas, mapas o analisis territorial.

## 5. IA en n8n

Opciones vistas:

- OpenAI Chat Model.
- DeepSeek Platform.
- Ollama/Mistral local.
- Basic LLM Chain.
- AI Agent con memoria.

Patron recomendado:

1. Recibir datos del cliente.
2. Consultar catalogo o base de datos.
3. Construir prompt con contexto de negocio.
4. Generar respuesta.
5. Guardar respuesta y enviarla por correo o WhatsApp.

Prompt base recomendado:

```text
Eres un asesor comercial de [EMPRESA].
Responde de forma breve, profesional y util.
Usa solo la informacion de catalogo entregada.
Si falta informacion, pide el dato faltante.
Datos del cliente:
- Nombre: {{nombre}}
- Mensaje: {{mensaje}}
Catalogo:
{{catalogo}}
Devuelve:
1. Saludo personalizado.
2. Recomendacion de producto o servicio.
3. Siguiente paso concreto.
```

## 6. HTTP Request y APIs externas

HTTP Request permite integrar servicios que no tienen nodo dedicado.

Elementos importantes:

- Metodo: GET, POST, PUT, DELETE.
- URL.
- Headers.
- Query params.
- Body JSON.
- Autenticacion o API key.

Casos vistos:

- APIs publicas de prueba.
- Ollama local.
- Evolution API.
- Servicios de catalogo o productos.

## 7. WhatsApp con Evolution API

Evolution API se vio como canal avanzado para WhatsApp.

Componentes:

- Docker Desktop.
- Evolution API.
- Evolution Manager.
- Postgres.
- Redis.
- Instancia vinculada a WhatsApp.
- API key.

Patron de envio:

1. n8n genera respuesta.
2. HTTP Request hace POST al endpoint `sendText`.
3. Headers incluyen `Content-Type` y `apikey`.
4. Body incluye numero y mensaje.

Patron de recepcion:

1. Evolution envia evento a webhook de n8n.
2. n8n extrae numero, nombre y mensaje.
3. AI Agent responde con memoria.
4. HTTP Request envia respuesta por WhatsApp.

Riesgos:

- WhatsApp personal puede bloquearse con pruebas masivas.
- Conviene usar WhatsApp Business.
- Proteger API keys y tokens.
- Manejar errores de conexion.

## 8. Landing page

Se uso HTML/CSS para crear paginas simples con formulario.

Requisitos tecnicos:

- Campos: nombre, email, celular, mensaje.
- Metodo POST.
- Action apuntando al webhook de n8n.
- Diseno claro y responsive.
- Mensaje de confirmacion al enviar.

Para defensa, la landing page sirve como entrada visible del sistema.

## 9. Evidencias funcionales

Capturas recomendadas:

1. Landing page o formulario.
2. URL y configuracion del Webhook/Form Trigger.
3. Ejecucion recibida en n8n.
4. Nodo Edit Fields con campos normalizados.
5. Nodo IA con prompt/respuesta.
6. Insercion en Sheets/MySQL/Supabase.
7. Correo Gmail recibido.
8. WhatsApp enviado o recibido.
9. Workflow completo.
10. Export JSON del workflow.

## 10. Errores comunes

- Usar GET cuando el formulario envia POST.
- Cambiar nombres de campos y no actualizar `Edit Fields`.
- Probar con URL de test y luego olvidar production URL.
- No ejecutar el workflow en modo escucha durante pruebas.
- No tener credenciales OAuth listas.
- No validar que MySQL/Supabase guarde realmente.
- Depender de IA sin catalogo o contexto.
- No documentar costos ni ROI.

## 11. Recomendacion tecnica final

Para maximizar nota y reducir riesgo, usar esta combinacion:

- Entrada: landing page con Webhook POST.
- Base: Google Sheets para demo rapida o Supabase/MySQL para version fuerte.
- IA: OpenAI o DeepSeek para calidad; Ollama como alternativa local si no hay credito.
- Comunicacion: Gmail obligatoria y WhatsApp con Evolution API como mejora.
- Catalogo: tabla de productos o PDF en Drive.
- Evidencia: capturas + workflow JSON + informe con ROI.

Esta combinacion cubre la rubrica y refleja la mayor parte de lo visto en clase.
