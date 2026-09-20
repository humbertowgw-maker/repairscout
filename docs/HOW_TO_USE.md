# How to use RepairScout

Live at: https://repairscout-smoky.vercel.app (bilingual — English/Spanish,
switch with the EN/ES toggle top right)

RepairScout has two separate sides: **drivers** research a problem before
paying anyone; **shops** manage the resulting quote requests.

## For drivers ("Para conductores")

1. Click **Diagnosticar mi auto**.
2. Step 1 of 4: identify your vehicle by VIN (**Buscar por VIN**) or enter
   it manually, then describe the problem in plain language. Optional: add
   an OBD-II code if you have one (from a code reader or a Bluetooth
   adapter RepairScout can scan directly), or tap a quick-tag like "Luz de
   advertencia" (warning light) / "Ruido extraño" (strange noise) / "No
   enciende" (won't start) instead of typing.
3. Set your ZIP code and search radius, then **Iniciar evaluación con IA**.
4. First diagnosis requires phone verification (a 6-digit SMS code) —
   RepairScout does this once to keep quote requests real for the shops on
   the other end.
5. After that: Step 2 shows the AI's diagnosis, Step 3 compares real local
   parts + labor cost estimates, Step 4 lets you pick a verified shop and
   send your request.

## For shops ("Para talleres")

Click **Gestionar mi taller** — this side has no login wall to look around
(claiming a real shop profile does require an account). You land in a full
shop dashboard:

- **Resumen** — today's snapshot: new requests, appointments, open work
  orders, and quoted revenue this week.
- **Solicitudes** — incoming quote requests from drivers near you, filtered
  by status (new, in review, needs revision, quoted, appointment requested,
  declined).
- **Cotizaciones** — quotes you've sent out.
- **Citas** / **Órdenes de trabajo** — scheduled appointments and active
  repair jobs.
- **Clientes** — your customer list.
- **Búsqueda de piezas** — parts search.
- **Scout IA** — an AI service-advisor assistant (bottom-left "Asesor de
  servicio con IA") that drafts estimates and explains repairs for you in
  seconds — click **Preguntar a Scout** to try it.
- **Perfil** / **Plan** — your shop's public profile and subscription tier.

Fill in your shop profile (name, contact, hourly rate, specialties,
warranty, availability) and click **Guardar y reclamar taller** to claim it
for real — that's the one step to send/receive live quotes rather than
just browsing the demo.
