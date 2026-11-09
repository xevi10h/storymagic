# Evaluación de impacto (EIPD): foto del niño en Meapica

Versión 2 · 9 de noviembre de 2026 (v1: 8-11-2026) · Responsable: Xavier Huix Trenco (Meapica), NIF 41649433K, Carrer Aribau 140, 5º, 08036 Barcelona.

Documento interno exigido por el art. 35 RGPD antes de activar la subida de fotos. Redactado sobre el código en producción (v1: commit `abbe7c1`; v2: nuevo flujo foto → dibujo del 9-11-2026). No sustituye la revisión de un abogado; los puntos abiertos están al final.

## 1. Por qué hace falta

La AEPD exige EIPD cuando concurren dos o más criterios de su lista (art. 35.4). Aquí concurren al menos dos: datos de personas vulnerables (menores de 14 años) y uso de tecnología innovadora (IA generativa de imágenes). La foto de una cara no es dato biométrico a efectos del art. 9 mientras no se trate para identificar a la persona (considerando 51); Meapica no identifica a nadie, solo dibuja un personaje parecido.

## 2. Descripción del tratamiento

| Elemento | Detalle |
|---|---|
| Finalidad | Dibujar el personaje del cuento parecido al niño, a petición del padre, madre o tutor. |
| Interesados | Niños (normalmente menores de 14) y el adulto que compra. |
| Datos | Una foto del niño (JPEG/PNG/WEBP, re-codificada a máx. 1536 px, sin metadatos EXIF ni GPS). De ella sale un dibujo (ilustración, no la foto) y de ese dibujo se leen los rasgos que describe el cuento (piel, pelo, peinado, ojos, gafas, pecas). Nombre, edad y género los indica el adulto, como sin foto. |
| Origen | El adulto, que declara ser padre, madre o tutor. |
| Base jurídica | Consentimiento explícito del titular de la patria potestad (art. 6.1.a RGPD y art. 7 LOPDGDD para menores de 14). Casilla obligatoria, sin premarcar, con versión del texto guardada (`photo_consents`, versión `2026-11-09`). El texto de la casilla y la explicación del flujo no nombran terceros; el encargado y sus plazos se informan en la política de privacidad (art. 13 RGPD), enlazada desde «Más información». |
| Encargado | OpenAI Ireland Ltd. (API de imágenes, modelo `gpt-image-2.5-flare`), bajo su Data Processing Addendum. Almacenamiento: Supabase (bucket privado `child-photos`, UE). Alojamiento web: Vercel. |
| Transferencias | Posibles a EE. UU. por soporte y subencargados de OpenAI: Marco de Privacidad UE-EE. UU. y cláusulas contractuales tipo del DPA. |
| Conservación | La foto se borra en cuanto el dibujo vuelve de OpenAI, unos 15-20 s después de que el adulto pulse «Crear su personaje»; si no lo pulsa o el dibujo falla, se conserva (para crearlo o reintentar) hasta que la quita con «Quitar la foto» o hasta el proceso horario que borra cualquier resto con más de 24 h. OpenAI puede conservar registros de abuso hasta 30 días, y conserva para revisión manual las imágenes que su clasificador de abuso infantil marque. El registro de consentimiento se conserva como prueba. |
| Quién accede | Nadie de Meapica ve la foto en el flujo normal. El bucket es privado y solo lo lee el servidor. |

Flujo (desde el 9-11-2026): subida con consentimiento → el adulto pulsa «Crear su personaje» → el servidor pide a OpenAI el retrato ilustrado con la foto como única referencia → la foto se borra → de ese dibujo (nunca de la foto) se leen los rasgos para el texto del cuento → el adulto ve el dibujo antes de continuar y puede probar con otra foto → la ficha de personaje, el cuento y el libro impreso usan solo el dibujo.

## 3. Necesidad y proporcionalidad

- La foto es opcional. El cuento se puede crear igual eligiendo rasgos, sin foto.
- Se usa una sola foto, para un solo fin, y se borra en segundos, en cuanto existe el dibujo (máximo 24 h).
- No se usa para entrenar modelos (la API de OpenAI no entrena con datos de clientes por defecto) ni para identificar, perfilar o hacer marketing.
- El texto del cuento no se deduce de la foto: los rasgos se leen del dibujo ya generado (una ilustración), con una lista cerrada de opciones (las mismas de «Créalo tú»), cuando la foto ya está borrada. Nunca se infieren género ni edad, que indica el adulto. Si los rasgos no se pueden leer, el texto no describe ningún rasgo físico y el dibujo es la única referencia.

## 4. Riesgos y medidas

| Riesgo | Probabilidad / gravedad antes | Medidas | Residual |
|---|---|---|---|
| Subida sin autorización de quien tiene la patria potestad | Media / alta | Consentimiento explícito con declaración de ser padre, madre o tutor; versión del texto registrada; retirada en cualquier momento. | Media: no se verifica la identidad del adulto (no es proporcionado en una compra de cuento). |
| Acceso indebido a la foto | Baja / alta | Bucket privado, rutas con UUID por usuario, comprobación de propiedad en servidor, borrado inmediato y purga horaria. | Baja |
| Conservación por el encargado más allá de lo prometido | Media / media | DPA firmado; textos legales dicen «hasta 30 días» en OpenAI; opción de pedir retención cero (ZDR). | Media hasta tener ZDR |
| Imagen marcada por el filtro de abuso infantil de OpenAI y revisada por personas | Baja / alta | Se informa en el texto legal; solo se aceptan fotos normales de un niño, una por cuento. | Baja |
| Metadatos (ubicación) en la foto | Media / media | Re-codificación y eliminación de EXIF/GPS antes de guardar. | Baja |
| El cuento o el dibujo no se parecen al niño (rasgos equivocados) | Media / baja | El adulto ve el dibujo antes de continuar y puede probar con otra foto; los rasgos del texto se leen del mismo dibujo, así texto e imágenes coinciden. | Baja |
| Publicidad que promete más de lo que hace | Alta / media | Textos de la web condicionados a que la opción esté activa. | Baja una vez activada |

## 5. Derechos

Acceso, rectificación, supresión, oposición, limitación y portabilidad en hola@meapica.shop. La retirada del consentimiento borra la foto si aún existe. Reclamación ante la AEPD (www.aepd.es).

## 6. Conclusión

Con las medidas anteriores, el riesgo residual es aceptable para activar la opción, con estas condiciones previas:

1. DPA de OpenAI aceptado para la organización dueña de la clave de la API.
2. Textos legales y de consentimiento en los 4 idiomas tal como están en producción con la opción activada (versión 2026-11-09).
3. Revisar las normas de uso de OpenAI que cambian el 20-11-2026.

## 7. Puntos para revisar con un abogado

- Si basta el consentimiento de un progenitor o hacen falta los dos.
- Si conviene solicitar ZDR a OpenAI y cambiar entonces los textos de «hasta 30 días».
- Validez de la base para transferencias a EE. UU. según el DPA vigente.
- Revisión de esta EIPD cada 12 meses o ante cualquier cambio de proveedor, modelo o finalidad.
