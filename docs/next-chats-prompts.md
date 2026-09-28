# Prompts for the next conversations (2026-09-28)

One conversation per block. Recommended order: **A → B → C** (C depends on A's PDF/token work and
B's shipping data); **D** can run in parallel from day one; **E** after launch.
Each prompt is self-contained: paste it as the first message of a new chat.

---

## A — Compra: Stripe + libro completo + PDF

```
Proyecto meapica (Desktop/Casmar/kids-book). Bloque A: dejar el flujo de compra listo para cobrar de verdad.

Lee primero: docs/audit-2026-09-28-commerce.md (sección 1 y los P0 de la 3), docs/stack.md, docs/generation-pipeline.md, docs/technical-architecture.md y la memoria project_creation_flow_v2. El flujo de creación v2 ya está en prod desde el 28-09.

Objetivos:
1. Webhook de Stripe live funcionando (hoy está disabled): eventos checkout.session.completed/expired/async_payment_succeeded + charge.refunded, secret verificado. Crear también el endpoint de test y probar con `stripe trigger`/`stripe listen`.
2. Libro completo + PDF para TODOS los formatos generado en el pipeline, guardado en book-pdfs y servido con URL firmada (nada de PDFs a través de la función: límite 4,5 MB de Vercel). Enlace del email por pedido con token (hoy cualquiera descarga el PDF de un storyId pagado).
3. IVA B2C: Prices inclusive + tax_code de libros + automatic_tax + factura (invoice_creation o herramienta española). Precio visible siempre "IVA incluido".
4. Reembolsos: charge.refunded cancela la generación/impresión si aún no ha salido.
5. Copia extra con precio correcto por formato, idempotencia en sessions.create, locale es/ca en Checkout y en success/cancel URL, aviso de desistimiento (art. 103 LGDCU) con consentimiento expreso para el PDF digital.
6. Mensaje claro si una preview antigua no se puede comprar.

Decisiones ya tomadas (28-09): envío solo a España; el cliente elige tapa blanda o tapa dura; la copia extra es del mismo formato que el libro y su precio depende del formato (confirmado: tapa dura +29,90 €, tapa blanda +19,90 €, IVA incluido); encuadernación encolada.

Antes de implementar pregúntame: (a) IVA 4 % confirmado por gestor, (b) cuenta de Stripe separada para Meapica o renombrar la compartida (hoy sale "Constrack" y mi nombre en el extracto), (c) factura con Stripe o con herramienta española, (d) precios finales (digital 9,90 / blanda 34,90 / dura 49,90?).

Tope de gasto en OpenAI para pruebas: 5 $ (dímelo antes de cada lote). Pruebas de pago en modo test; un único pago live real al final con reembolso inmediato, solo con mi OK. QA e2e con Playwright en es/ca, desktop y móvil. Actualiza docs.
```

---

## B — Gelato: impresión y envío

```
Proyecto meapica (Desktop/Casmar/kids-book). Bloque B: integración con Gelato lista para producción.

Lee primero: docs/audit-2026-09-28-commerce.md (sección 2 Gelato), docs/stack.md, docs/technical-architecture.md, src/lib/fulfilment/pipeline.ts y la memoria project_gelato_integration_production. Verifica todo contra el código y la documentación actual de la API de Gelato (no te fíes de la memoria).

Ya funciona (no rehacer): productUid, geometría de portada, paridad, DPI, dedupe, reintentos y cron. Lo que falta, por orden:
1. P0 tracking: el webhook nunca captura el seguimiento (lee items[].shipment.trackingCode; el real llega en order_status_updated.items[].fulfillments[] y en order_item_tracking_code_updated). Corrige handler y tipos.
2. P0 webhook: comprobar en el dashboard de Gelato que la URL registrada lleva ?secret= (si no, todos los eventos dan 401 en silencio). Dime qué tengo que hacer yo si no tienes acceso.
3. pending_approval / on_hold / not_connected → alerta a ops (hoy pending_approval se muestra como "en producción"). Cron de conciliación que consulte GET /v4/orders/{id} para pedidos atascados. Pedidos divididos (connected orders).
4. Pedido real de prueba (draft si basta) para validar el libro impreso de extremo a extremo.
3. Envío: países a los que vendemos, tarifas y plazos reales por país, teléfono para el transportista, nada de envío gratis fuera de lo que yo decida. Los plazos reales alimentan la página "¿Llega a tiempo para Reyes?" del bloque D (deja un módulo con las fechas límite por formato y región).
4. Margen por libro: coste Gelato + envío + OpenAI (~1,8 $) vs precio con IVA. Si algún formato pierde dinero, avísame con números.
5. Alertas a ops si Gelato rechaza un fichero o un pedido se atasca > X horas.

Decisiones ya tomadas (28-09): solo España (quitar los otros 17 países de Stripe), tapa blanda y tapa dura a elegir, copia extra del mismo formato con precio por formato (dura +29,90 €, blanda +19,90 €, confirmado), encuadernación encolada (glued-left, la actual).

Antes de implementar pregúntame: ¿envío incluido o aparte?, tope de coste para el pedido de prueba real.

No hagas pedidos reales sin mi OK. Actualiza docs.
```

---

## C — Postcompra: emails, cuentas y zona de usuario

```
Proyecto meapica (Desktop/Casmar/kids-book). Bloque C: postcompra y zona de usuario. Requiere que el bloque A (PDF en storage + enlace con token) esté hecho.

Lee primero: docs/audit-2026-09-28-commerce.md (sección 3), docs/user-experience.md, docs/product-spec.md, src/lib/email/, src/lib/fulfilment/emails.ts, src/app/[locale]/dashboard/.

Objetivos:
1. Dominio de email meapica.com en Resend: SPF, DKIM, DMARC y MX de retorno (DNS en Spaceship); EMAIL_FROM y OPS_ALERT_EMAIL en Vercel. Buzón real para hola@meapica.com si lo decido.
2. Emails: saludar al padre/madre (no al niño), confirmación como recibo (importe, "IVA incluido", líneas, dirección), PDF listo con enlace con token, en producción, enviado con tracking, entregado, y nuevos: retraso, reembolso, cancelación. es/ca/en/fr, HTML (nunca text/plain), diseño de marca.
3. Invitados: recuperar sus libros en otro dispositivo (magic link con el email del pago o "encontrar mi pedido"), vincular orders.customer_email a la cuenta.
4. "Mi biblioteca": todos los pedidos con estado, descargar PDF siempre (también enviado/entregado), pedir otra copia/regalar, crear otro libro con el mismo protagonista (avatar guardado incl. gafas/pecas).
5. QA completo con Playwright (es/ca, desktop y móvil) y emails de prueba reales a mi correo.

Antes de implementar pregúntame: magic link vs cuentas opcionales, ¿emails de retraso/reembolso automáticos o manuales?, ¿buzón real en hola@meapica.com?, qué necesitas que haga yo en DNS si no tienes acceso.

Actualiza docs.
```

---

## D — SEO + GEO: empezar a generar tráfico (puede ir en paralelo)

```
Proyecto meapica (Desktop/Casmar/kids-book). Bloque D: SEO y GEO para empezar a generar tráfico antes de Navidad/Reyes.

Lee primero: docs/audit-2026-09-28-commerce.md (sección 4, puntuación 62/100), docs/roadmap.md (iniciativa de growth) y las memorias project_growth_initiative_2026 y feedback_no_fake_content (nunca reseñas ni cifras inventadas).

Objetivos por orden:
1. P0 técnicos: rendimiento móvil de la home (hoy LCP 11 s: fuente Material Symbols de 1,1 MB, imagen de Stitch enlazada en globals.css, /es sin caché), title/H1 con "cuento personalizado"/"conte personalitzat", llms.txt, schema Product completo (imagen real, shippingDetails, devoluciones), canonical de /crear, /en y /fr blog vacíos. Medir con Lighthouse móvil antes y después.
2. Medición: dar de alta meapica en `cana` (sites.json) cuando yo verifique sc-domain:meapica.com en Search Console y añada la service account; Bing Webmaster + IndexNow. Dime exactamente qué tengo que hacer yo.
3. Página "¿Llega a tiempo para Reyes?" con fechas límite reales (del bloque B; si aún no están, deja la estructura y pregúntame).
4. Estrategia catalana (Sant Jordi, Nadal) y página de comparativa honesta Meapica vs Wonderbly vs Hurra Héroes vs Mumablue con datos verificables.
5. Plan de GEO: lista de medios/listicles a contactar con el email de pitch redactado (en mi voz), sin enviarlo.

Antes de implementar pregúntame: ¿vendemos en Francia/inglés o concentramos en es/ca?, ¿indexamos libros de ejemplo reales (con consentimiento)?, prioridades de contenido.

QA con Playwright y Lighthouse, cero regresiones. Actualiza docs.
```

---

## E — Nuevos tipos de libro (después del lanzamiento)

```
Proyecto meapica (Desktop/Casmar/kids-book). Bloque E: más tipos de libro.

Lee primero: docs/audit-2026-09-28-commerce.md (sección 3, P2 "more book types"), src/lib/create-store.ts, src/lib/story-trees/, docs/generation-pipeline.md.

Objetivos:
1. Refactor: un único registro de mundos del que se derivan STORY_TEMPLATES, STORY_TREES, VALID_TEMPLATE_IDS, TEMPLATE_THEMES, THEME_TEMPLATE y los textos.
2. Disponibilidad por temporada (ventanas de fechas) para mundos estacionales.
3. Primeros mundos nuevos: Navidad/Reyes y Sant Jordi (es/ca de verdad), con portada y ~39 ilustraciones de camino.
4. Propuesta (sin implementar) para hermanos/2 protagonistas: impacto en esquema, prompts, consistencia y avatar, con estimación.

Antes de implementar pregúntame qué mundos, fechas y tope de gasto en imágenes.

QA con Playwright es/ca desktop y móvil. Actualiza docs.
```

---

## Things only the owner can do (unblockers)
- Confirm VAT rate for books (4 %?) with the gestor.
- Decide Stripe: separate Meapica account vs rename the shared one.
- DNS at Spaceship for email (if the agent has no access) and Search Console verification.
- Sign the DPIA + accept the OpenAI DPA before enabling the photo upload.
