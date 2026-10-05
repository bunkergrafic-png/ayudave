// Centro de ayuda de Rifalo: guías paso a paso, preguntas frecuentes y glosario.
// Formato de los pasos: **negrita** y [Botón] (se dibuja como un botón de la app).

export const CATEGORIES = [
  { id: 'inicio', label: 'Primeros pasos', icon: 'sparkles' },
  { id: 'vender', label: 'Vender y apartar', icon: 'ticket' },
  { id: 'pagos', label: 'Pagos y cobros', icon: 'wallet' },
  { id: 'web', label: 'Página pública', icon: 'share' },
  { id: 'cuenta', label: 'Mi dinero y comisión', icon: 'banknote' },
  { id: 'admin', label: 'Administrar', icon: 'settings' },
  { id: 'sorteo', label: 'Sorteo', icon: 'trophy' }
]

export const ARTICLES = [
  // ───────── Primeros pasos ─────────
  {
    id: 'entrar', cat: 'inicio', title: 'Cómo entrar a Rifalo',
    summary: 'Con el usuario y la clave que te dio el organizador.',
    keys: 'entrar iniciar sesion login usuario acceso ingresar abrir app',
    steps: [
      'Abre el enlace que te envió el organizador (termina en **/login**).',
      'Escribe tu **usuario** (ej. ana.guzman) y tu **clave temporal**.',
      'Toca [Entrar].',
      'La primera vez la app te pide **crear tu propia clave**. Escríbela dos veces y toca [Guardar clave].'
    ],
    tips: ['El usuario no lleva espacios ni acentos.', 'Si te equivocas varias veces, pídele al organizador una clave nueva.'],
    related: ['clave', 'instalar']
  },
  {
    id: 'instalar', cat: 'inicio', title: 'Instalar Rifalo en tu celular',
    summary: 'Tenerla como una app más, con su ícono.',
    keys: 'instalar app icono pantalla inicio celular telefono android iphone acceso directo',
    steps: [
      '**Android (Chrome):** abre Rifalo, toca los **tres puntos ⋮** arriba a la derecha y luego **"Instalar aplicación"** o **"Agregar a la pantalla principal"**.',
      '**iPhone (Safari):** abre Rifalo, toca el botón **Compartir** (el cuadrito con flecha) y luego **"Agregar a inicio"**.',
      'Listo: verás el ícono morado de Rifalo junto a tus otras apps.'
    ],
    related: ['entrar']
  },
  {
    id: 'clave', cat: 'inicio', title: 'Cambiar mi clave u olvidé mi clave',
    summary: 'Cambia tu clave cuando quieras; si la olvidaste, el organizador te da otra.',
    keys: 'clave contraseña password olvide olvidé cambiar nueva bloqueado no puedo entrar',
    steps: [
      'Para **cambiarla**: toca tu nombre o tus iniciales arriba a la derecha.',
      'Toca [Cambiar mi clave], escribe la nueva dos veces y toca [Guardar clave].',
      'Si la **olvidaste**: avísale al organizador. Él entra a **Equipo**, toca [Nueva clave] en tu nombre y te la envía por WhatsApp.'
    ],
    tips: ['Tu usuario y tus ventas no cambian cuando te dan una clave nueva.'],
    related: ['entrar', 'equipo']
  },
  {
    id: 'tablero', cat: 'inicio', title: 'El tablero y sus colores',
    summary: 'Qué significa cada color de los números.',
    keys: 'tablero colores numeros significado verde naranja azul blanco amarillo leyenda estado',
    steps: [
      '**Blanco:** libre, se puede vender.',
      '**Azul:** apartado desde la página pública, falta que un vendedor lo confirme.',
      '**Naranja:** vendido pero **por pagar**. Mitad naranja y mitad verde: tiene un **abono**.',
      '**Verde:** pagado y verificado.',
      '**Dorado con ✓:** los que tú estás seleccionando para vender.',
      'Los números con **borde morado** son tuyos. Los **atenuados con borde punteado** son del bloque de otro vendedor.'
    ],
    tips: ['Arriba puedes filtrar: [Libres], [Míos], [Por pagar], [Pagados].', 'El tablero se actualiza solo, en tiempo real, en todos los celulares.'],
    related: ['buscar', 'vender']
  },
  {
    id: 'buscar', cat: 'inicio', title: 'Buscar un número o un comprador',
    summary: 'Escribe un número y te dice quién lo tiene; o escribe un nombre o teléfono.',
    keys: 'buscar encontrar quien tiene numero dueño comprador nombre telefono cedula lupa',
    steps: [
      'Entra a la rifa y quédate en la pestaña [Tablero].',
      'En el buscador escribe el **número** (ej. 45). Aparece una ficha: si está libre, apartado, por pagar o pagado, **quién lo compró**, su teléfono y qué vendedor lo tiene.',
      'Desde la ficha puedes tocar [Ver venta], [WhatsApp] o [Llamar].',
      'También puedes escribir el **nombre**, el **teléfono** o la **cédula** del comprador: te muestra sus números y el tablero se filtra.'
    ],
    tips: ['Si el número es de otro vendedor, verás quién lo tiene pero no los datos del comprador (por privacidad). El administrador sí ve todo.', 'En la pestaña [Ventas] también puedes buscar por nombre o teléfono.'],
    related: ['tablero']
  },

  // ───────── Vender ─────────
  {
    id: 'vender', cat: 'vender', title: 'Vender uno o varios números',
    summary: 'Escoge los números, llena los datos del comprador y registra el pago.',
    keys: 'vender venta vendi nuevo comprador cliente numero varios escoger seleccionar registrar',
    steps: [
      'En el [Tablero], toca los números **blancos** que quiere el comprador. Se ponen dorados.',
      'Abajo aparece una barra con el total. Toca [Vender].',
      'Escribe **nombre y teléfono** del comprador (cédula, ciudad y correo son opcionales). Toca [Continuar].',
      'Escoge [Paga ahora] si ya te pagó, o [Paga después] si te pagará luego.',
      'Si paga ahora, elige el método (efectivo, pago móvil…) y llena los datos.',
      'Toca [Registrar venta]. ¡Listo!',
      'Toca [Enviar comprobante por WhatsApp] para mandarle su boleto.'
    ],
    tips: ['¿No sabe qué número escoger? Toca [Al azar] y la app escoge uno de la suerte.', 'Si otro vendedor vende el mismo número un segundo antes que tú, la app te avisa y no se repite nunca.'],
    related: ['apartar-vendedor', 'registrar-pago', 'boleto']
  },
  {
    id: 'apartar-vendedor', cat: 'vender', title: 'Apartar un número para alguien que paga después',
    summary: 'Usa “Paga después”: el número queda a su nombre mientras paga.',
    keys: 'apartar apartado reservar reserva separar guardar paga despues luego fiado credito pendiente',
    steps: [
      'Selecciona los números y toca [Vender], igual que una venta normal.',
      'Llena los datos del comprador y toca [Continuar].',
      'Escoge [Paga después] y toca [Registrar venta].',
      'El número queda **naranja (por pagar)** a nombre del comprador.',
      'Cuando te pague, búscalo y toca [Registrar pago].'
    ],
    tips: ['Ojo con el **plazo**: si no se registra ningún pago a tiempo, el número se libera solo. El plazo lo define el organizador (ej. 48 horas).', 'Con un abono, aunque sea pequeño, el número ya no se libera solo.'],
    related: ['vencimiento', 'registrar-pago', 'abono']
  },
  {
    id: 'boleto', cat: 'vender', title: 'Enviar el boleto por WhatsApp',
    summary: 'El comprador recibe sus números y un enlace para verificarlos.',
    keys: 'boleto ticket comprobante recibo whatsapp enviar mandar constancia enlace verificar',
    steps: [
      'Justo después de vender, toca [Enviar comprobante por WhatsApp].',
      'Se abre WhatsApp con el mensaje listo (números, premio, total, estado y enlace). Solo toca **Enviar**.',
      'Para reenviarlo después: busca la venta, ábrela y toca [Enviar boleto].'
    ],
    tips: ['El enlace del boleto muestra en vivo si está pagado, abonado o pendiente. Si gana, ¡le aparece “GANASTE”!', 'Si el comprador dio su correo y el organizador activó los correos, también le llega por email.'],
    related: ['vender', 'correo']
  },
  {
    id: 'editar-comprador', cat: 'vender', title: 'Corregir los datos de un comprador',
    summary: 'Si escribiste mal el nombre o el teléfono.',
    keys: 'corregir editar cambiar nombre telefono error equivoque datos comprador',
    steps: [
      'Busca la venta (por número o nombre) y ábrela.',
      'En la tarjeta del comprador toca el **lápiz ✏️**.',
      'Corrige y toca [Guardar].'
    ],
    related: ['buscar']
  },
  {
    id: 'anular', cat: 'vender', title: 'Anular una venta o liberar un número',
    summary: 'Si el comprador se arrepintió o fue un error.',
    keys: 'anular cancelar borrar eliminar liberar quitar error equivoque devolver arrepintio desistio',
    steps: [
      'Busca la venta y ábrela.',
      'Toca [Anular] y escribe el motivo (opcional).',
      'Confirma con [Anular y liberar]. Los números vuelven a estar **libres**.'
    ],
    tips: ['Un vendedor solo puede anular ventas **sin pagos**. Si ya hay pagos, debe hacerlo el administrador.', 'Todo queda guardado en el historial.'],
    related: ['vencimiento']
  },

  // ───────── Pagos ─────────
  {
    id: 'registrar-pago', cat: 'pagos', title: 'Registrar un pago',
    summary: 'Cuando el comprador te paga lo que debe.',
    keys: 'pago pagar pagaron cobrar cobre registrar pago completo total dinero me pago',
    steps: [
      'Busca el número o el nombre y toca [Ver venta].',
      'Toca [Registrar pago].',
      'Escoge el método: **Efectivo, Pago móvil, Transferencia o Binance**.',
      'Revisa el monto (toca [Total] para pagar todo) y llena los datos que pide.',
      'Toca [Guardar pago].'
    ],
    tips: ['El pago queda **“por verificar”** hasta que el administrador lo confirme. Cuando lo confirma, el número se pone **verde**.', 'Si el organizador lo permite, el efectivo queda confirmado de una vez.'],
    related: ['abono', 'pago-movil', 'verificar']
  },
  {
    id: 'abono', cat: 'pagos', title: 'Registrar un abono (pago parcial)',
    summary: 'Cuando paga solo una parte, por ejemplo la mitad.',
    keys: 'abono abonar parcial mitad parte cuota cuotas incompleto falta resto pago por partes',
    steps: [
      'Abre la venta y toca [Registrar pago].',
      'En el monto escribe lo que pagó, o toca [Mitad].',
      'Llena los datos y toca [Guardar pago].',
      'La venta queda **“Abonado”** y muestra cuánto falta. Cuando pague el resto, registra otro pago igual.'
    ],
    tips: ['Un número con abono **no se libera solo** aunque pase el plazo.', 'Si la rifa no acepta abonos, el monto no se puede cambiar (debe pagar el total).'],
    related: ['registrar-pago', 'vencimiento']
  },
  {
    id: 'pago-movil', cat: 'pagos', title: 'Pago móvil y transferencia: qué datos pedir',
    summary: 'Banco, teléfono, cédula y número de referencia son obligatorios.',
    keys: 'pago movil pagomovil transferencia banco referencia cedula telefono datos captura comprobante foto',
    steps: [
      'Pídele al comprador la **captura** del pago móvil o transferencia.',
      'Al registrar el pago escoge [Pago móvil] o [Transferencia].',
      'Llena: **banco desde donde pagó**, **teléfono que pagó**, **cédula del titular** y **número de referencia**.',
      'Si quieres, toca [Tomar foto o subir imagen] y adjunta la captura (opcional).',
      'Toca [Guardar pago].'
    ],
    tips: ['El monto va en **bolívares** y la app calcula a cuántos dólares equivale con la tasa BCV.', 'Si alguien registra una referencia que ya se usó, la app la marca como **“¿Duplicado?”** para que el admin la revise.'],
    related: ['tasa', 'verificar']
  },
  {
    id: 'binance', cat: 'pagos', title: 'Pagos con Binance / USDT',
    summary: 'ID de la orden y Pay ID o correo de quien pagó.',
    keys: 'binance usdt cripto tether pay id criptomoneda',
    steps: [
      'Al registrar el pago escoge [Binance / USDT].',
      'Escribe el monto en USDT.',
      'Llena el **ID de la orden o transacción** y el **Pay ID o correo** de quien pagó.',
      'Adjunta la captura si la tienes y toca [Guardar pago].'
    ],
    related: ['registrar-pago']
  },
  {
    id: 'tasa', cat: 'pagos', title: 'Cobrar en bolívares y la tasa BCV',
    summary: 'La app usa la tasa oficial del BCV del día y tiene calculadora.',
    keys: 'tasa bcv dolar dolares bolivares bs cambio divisa euro calculadora conversion precio',
    steps: [
      'Arriba en la app verás **“BCV 000,00”**: es la tasa oficial del día.',
      'Tócala para abrir la **calculadora de divisas** (dólares, euros y bolívares).',
      'Al registrar un pago en Bs, la app convierte sola el monto a dólares con esa tasa y la guarda en el pago.'
    ],
    tips: ['Desde la calculadora puedes [Copiar] la tasa para mandarla por WhatsApp.'],
    related: ['pago-movil']
  },
  {
    id: 'vencimiento', cat: 'pagos', title: '¿Qué pasa si no pagan a tiempo?',
    summary: 'Al vencer el plazo sin ningún pago, el número se libera solo.',
    keys: 'vence vencio vencido vencimiento cliente plazo expira tiempo libera liberado no pago perdio numero',
    steps: [
      'Cada venta “por pagar” tiene un **plazo** (ej. 48 horas) que define el organizador.',
      'En la venta y en el buscador verás **“Se libera en…”** con el tiempo que queda.',
      'Si se vence **sin ningún pago registrado**, el número vuelve a estar **libre** y otro lo puede comprar.',
      'Si tiene **un abono o un pago por verificar**, no se libera.'
    ],
    tips: ['Escríbele al comprador antes de que venza: desde la venta toca [WhatsApp].'],
    related: ['abono', 'apartar-vendedor']
  },

  // ───────── Página pública ─────────
  {
    id: 'apartados-web', cat: 'web', title: 'Apartados desde la página pública',
    summary: 'La gente aparta números desde el enlace y te llegan para confirmar.',
    keys: 'apartados web pagina publica link enlace internet reservaron llego bandeja azul confirmar',
    steps: [
      'Cuando alguien aparta desde **tu enlace personal**, te llega a la pestaña [Apartados] → **“Desde tu enlace”**.',
      'Si apartó desde el **enlace general** sin escoger vendedor, cae en la **bandeja compartida**.',
      'Escríbele por [WhatsApp], acuerden el pago y toca [Confirmar]. Queda a tu nombre como venta.',
      'Después registra el pago como siempre.'
    ],
    tips: ['El apartado web dura poco (ej. 2 horas). Si nadie lo confirma, se libera solo.', 'Los números apartados se ven **azules** en el tablero.'],
    related: ['tomar-bandeja', 'compartir']
  },
  {
    id: 'tomar-bandeja', cat: 'web', title: 'Tomar un apartado de la bandeja compartida',
    summary: 'El primer vendedor que lo toma se lo queda.',
    keys: 'bandeja compartida tomar agarrar quedarme cliente sin vendedor apartado libre',
    steps: [
      'Ve a la pestaña [Apartados] y baja a **“Bandeja compartida”**.',
      'Toca [Tomar] en el apartado que quieras atender.',
      'Ya es tuyo: aparecen el teléfono y los datos. Escríbele y registra el pago.'
    ],
    related: ['apartados-web']
  },
  {
    id: 'compartir', cat: 'web', title: 'Compartir la rifa y tu enlace personal',
    summary: 'Tu enlace hace que los apartados te lleguen a ti.',
    keys: 'compartir enlace link qr redes instagram estado facebook difundir publicar mi enlace personal',
    steps: [
      'Entra a la rifa y toca la pestaña [Compartir].',
      'Busca **“Mi enlace personal”**.',
      'Toca [WhatsApp] para mandarlo a tus contactos o estados, o [Copiar] para pegarlo donde quieras.',
      'También puedes mostrar el **código QR** para que lo escaneen con la cámara.'
    ],
    tips: ['Comparte **siempre tu enlace personal**: así lo que la gente aparte te llega directo a ti y cuenta para tus ventas.'],
    related: ['apartados-web']
  },

  // ───────── Mi cuenta ─────────
  {
    id: 'mi-cuenta', cat: 'cuenta', title: 'Mi cuenta: comisión y efectivo por entregar',
    summary: 'Cuánto vendiste, tu comisión y cuánto efectivo debes entregar.',
    keys: 'mi cuenta comision ganancia cuanto gano efectivo entregar debo deuda cuadre rendir cuentas resumen',
    steps: [
      'Entra a la rifa y toca la pestaña [Mi cuenta].',
      'Verás: **números vendidos**, **cobrado verificado**, **tu comisión** y **efectivo por entregar**.',
      'Abajo aparecen las **entregas** que el organizador ya te registró.'
    ],
    tips: ['“Efectivo por entregar” = efectivo cobrado − lo que ya entregaste − tu comisión.', 'El pago móvil, la transferencia y Binance llegan directo a la cuenta del organizador, así que no los tienes que entregar.'],
    related: ['entregas']
  },

  // ───────── Administrar ─────────
  {
    id: 'verificar', cat: 'admin', admin: true, title: 'Verificar o rechazar pagos',
    summary: 'Confirma que el dinero llegó antes de marcarlo pagado.',
    keys: 'verificar confirmar aprobar revisar rechazar pago pendiente por verificar llego dinero',
    steps: [
      'Entra a la rifa y toca la pestaña [Pagos] (el número rojo indica cuántos esperan).',
      'Revisa cada pago: monto, banco, referencia y la captura con [Comprobante].',
      'Si llegó a tu cuenta toca [Verificar]. Si no, toca [Rechazar] y escribe el motivo.',
      'Al completar el total, los números se ponen **verdes**.'
    ],
    tips: ['Revisa con cuidado los marcados **“Referencia repetida”**.'],
    related: ['registrar-pago', 'pago-movil']
  },
  {
    id: 'entregas', cat: 'admin', admin: true, title: 'Registrar el efectivo que te entrega un vendedor',
    summary: 'Lleva la cuenta de lo que cada vendedor te ha dado.',
    keys: 'entrega entregar efectivo vendedor me dio recibi cuadre rendir cuentas deuda',
    steps: [
      'Entra a la rifa → pestaña [Vendedores].',
      'En la tarjeta del vendedor verás cuánto **debe entregar**.',
      'Toca [Registrar entrega], escribe el monto recibido y toca [Guardar].'
    ],
    related: ['mi-cuenta']
  },
  {
    id: 'crear-rifa', cat: 'admin', admin: true, title: 'Crear o editar una rifa',
    summary: 'Números, precio, premios, sorteo, pagos y vendedores.',
    keys: 'crear rifa nueva editar configurar cantidad numeros precio premio premios foto portada',
    steps: [
      'En **Rifas** toca [Nueva rifa] (o, dentro de una rifa, [Editar]).',
      '**1 · Lo básico:** nombre, descripción y foto.',
      '**2 · Números y precio:** cantidad (50, 100, 200, 1.000…), precio y si cobras también en Bs.',
      '**3 · Premios:** uno o varios, con foto.',
      '**4 · Sorteo:** cuándo se habilita y cómo sale el ganador.',
      '**5 · Ventas y pagos:** plazo para pagar, abonos, comisiones y tus datos de pago móvil, transferencia o Binance.',
      '**6 · Vendedores:** quién vende esta rifa.',
      '**7 · Página pública:** si la gente puede ver y apartar desde el enlace.',
      'Toca [Publicar rifa] o [Guardar cambios].'
    ],
    related: ['abrir-ventas', 'asignar']
  },
  {
    id: 'abrir-ventas', cat: 'admin', admin: true, title: 'Abrir o cerrar las ventas',
    summary: 'Borrador, en venta y ventas cerradas.',
    keys: 'abrir ventas cerrar borrador publicar activar ocultar estado pausar',
    steps: [
      'Entra a la rifa y toca [Estado] arriba a la derecha.',
      '[Abrir ventas]: los vendedores venden y la página pública funciona.',
      '[Cerrar ventas]: nadie vende más (puedes seguir registrando pagos).',
      '[Pasar a borrador]: la rifa se oculta del público.'
    ],
    related: ['crear-rifa']
  },
  {
    id: 'equipo', cat: 'admin', admin: true, title: 'Crear vendedores y darles acceso',
    summary: 'Cada vendedor tiene su usuario y clave.',
    keys: 'crear vendedor nuevo usuario equipo agregar persona acceso dar clave desactivar quitar',
    steps: [
      'En el menú toca **Equipo** → [Nueva persona].',
      'Escribe su nombre y WhatsApp. La app sugiere el usuario y una clave temporal.',
      'Toca [Crear acceso] y luego [Enviar por WhatsApp] para mandarle sus datos.',
      'Para que venda en una rifa, asígnalo en la rifa (ver “Asignar vendedores”).'
    ],
    tips: ['[Nueva clave] le da una clave nueva si la olvidó.', '[Desactivar] le quita el acceso sin borrar sus ventas.'],
    related: ['asignar', 'clave']
  },
  {
    id: 'asignar', cat: 'admin', admin: true, title: 'Asignar vendedores a una rifa (y bloques de números)',
    summary: 'Quién vende en cada rifa y qué números le tocan.',
    keys: 'asignar vendedores rifa bloque bloques rango numeros repartir co-admin coadmin ayudante',
    steps: [
      'Entra a la rifa → [Editar] → sección **6 · Vendedores**.',
      'En cada persona escoge [Vendedor] o [Co-admin] (co-admin ayuda a administrar esa rifa).',
      'Escoge si los números son **libres para todos** o por **bloques asignados**.',
      'Con bloques, toca [Repartir en partes iguales] o define cada rango a mano.',
      'Toca [Guardar cambios].'
    ],
    related: ['equipo', 'crear-rifa']
  },
  {
    id: 'cambiar-vendedor', cat: 'admin', admin: true, title: 'Pasar una venta a otro vendedor',
    summary: 'Si quedó a nombre de la persona equivocada.',
    keys: 'cambiar vendedor pasar transferir mover venta otro vendedor reasignar',
    steps: [
      'Abre la venta.',
      'Toca [Cambiar vendedor], escoge el nuevo y toca [Pasar venta].'
    ],
    related: ['asignar']
  },
  {
    id: 'reportes', cat: 'admin', admin: true, title: 'Reportes, Excel, PDF e historial',
    summary: 'Todo lo vendido y cobrado, y quién hizo cada cosa.',
    keys: 'reporte reportes excel pdf exportar descargar estadisticas historial registro quien hizo',
    steps: [
      'Pestaña [Reportes]: recaudado, por cobrar, ventas por día, por método y ranking de vendedores.',
      'Toca [Excel] o [PDF] para descargar todo.',
      'Pestaña [Historial]: cada venta, pago, verificación o anulación con fecha y persona.'
    ],
    related: ['verificar']
  },
  {
    id: 'correo', cat: 'admin', admin: true, title: 'Enviar boletos por correo (opcional)',
    summary: 'Gratis con EmailJS, hasta 200 correos al mes.',
    keys: 'correo email gmail enviar emailjs mail',
    steps: [
      'Crea una cuenta gratis en emailjs.com y conecta tu Gmail.',
      'Crea una plantilla con los campos que se indican en **Ajustes**.',
      'En Rifalo entra a **Ajustes** y pega Service ID, Template ID y Public Key. Toca [Guardar ajustes].'
    ],
    related: ['boleto']
  },

  // ───────── Sorteo ─────────
  {
    id: 'sorteo', cat: 'sorteo', title: 'Cómo funciona el sorteo',
    summary: 'Cuándo se puede sortear y cómo se escoge el ganador.',
    keys: 'sorteo sortear ganador gano premio rifar loteria cuando resultado tombola',
    steps: [
      'Entra a la rifa → pestaña [Sorteo]. Ahí ves si ya se puede sortear (ej. “Faltan 12 números por vender”).',
      'Cuando se cumple la regla, el administrador toca [Sortear ahora].',
      '**Sorteo en la app:** gira una animación y escoge el ganador al azar entre los números vendidos. Queda registrado con fecha y hora.',
      '**Lotería o sorteo externo:** el administrador escribe el número ganador y la evidencia.',
      'El ganador aparece en la página pública y en su boleto dice **“¡GANASTE!”**.'
    ],
    tips: ['El resultado no se puede repetir. Solo el organizador puede anularlo si hubo un error, y queda en el historial.'],
    related: ['abrir-ventas']
  }
]

export const FAQS = [
  { q: '¿Puede venderse el mismo número dos veces?', a: 'No. Cada venta se guarda de forma segura: si dos personas tocan el mismo número al mismo tiempo, solo una lo consigue y a la otra la app le avisa.', link: 'vender' },
  { q: '¿Cómo sé quién compró un número?', a: 'Escríbelo en el buscador del tablero: te muestra el comprador, su teléfono, el vendedor y el estado.', link: 'buscar' },
  { q: 'Un cliente me pagó solo la mitad, ¿qué hago?', a: 'Registra un abono: abre la venta → Registrar pago → toca “Mitad” o escribe lo que pagó.', link: 'abono' },
  { q: 'Me pagaron por pago móvil, ¿qué datos anoto?', a: 'Banco desde donde pagó, teléfono, cédula del titular y número de referencia. La captura es opcional.', link: 'pago-movil' },
  { q: '¿Por qué mi pago dice “por verificar”?', a: 'Porque el administrador debe confirmar que el dinero llegó. Cuando lo verifica, el número se pone verde.', link: 'verificar' },
  { q: 'El comprador no ha pagado, ¿pierde el número?', a: 'Solo si se vence el plazo sin ningún pago. Con un abono, el número no se libera solo.', link: 'vencimiento' },
  { q: '¿Cómo aparto un número para alguien que paga después?', a: 'Vende normal y escoge “Paga después”. Queda por pagar a su nombre hasta el plazo.', link: 'apartar-vendedor' },
  { q: 'Alguien apartó por la página, ¿dónde lo veo?', a: 'En la pestaña Apartados: “Desde tu enlace” si usó tu enlace, o en la bandeja compartida.', link: 'apartados-web' },
  { q: '¿Qué enlace comparto en mis redes?', a: 'Tu enlace personal, en la pestaña Compartir. Así los apartados te llegan a ti.', link: 'compartir' },
  { q: 'Me equivoqué en el nombre o el teléfono', a: 'Abre la venta y toca el lápiz en la tarjeta del comprador.', link: 'editar-comprador' },
  { q: 'El comprador se arrepintió', a: 'Abre la venta y toca Anular. Si ya tenía pagos, debe anularla el administrador.', link: 'anular' },
  { q: '¿Cuánto efectivo debo entregar?', a: 'Mira la pestaña Mi cuenta: “Efectivo por entregar” ya descuenta tu comisión y lo que entregaste.', link: 'mi-cuenta' },
  { q: '¿Cuánto gano de comisión?', a: 'Lo ves en Mi cuenta. La comisión la define el organizador en cada rifa.', link: 'mi-cuenta' },
  { q: 'Olvidé mi clave', a: 'Pídele al organizador una clave nueva desde Equipo. Tus ventas no se pierden.', link: 'clave' },
  { q: '¿A qué tasa se cobra en bolívares?', a: 'A la tasa oficial del BCV del día. Tócala arriba para abrir la calculadora.', link: 'tasa' },
  { q: '¿Cómo le mando el boleto al comprador?', a: 'Después de vender toca “Enviar comprobante por WhatsApp”, o desde la venta toca “Enviar boleto”.', link: 'boleto' },
  { q: '¿Por qué algunos números se ven atenuados?', a: 'Porque la rifa usa bloques y esos números son de otro vendedor.', link: 'tablero' },
  { q: '¿Cuándo es el sorteo?', a: 'Depende de la regla de la rifa (ej. cuando se vendan todos). Lo ves en la pestaña Sorteo.', link: 'sorteo' },
  { q: '¿Funciona sin internet?', a: 'La app abre sin internet, pero para vender y registrar pagos necesita conexión, porque así nadie vende el mismo número.', link: 'tablero' }
]

export const GLOSSARY = [
  { term: 'Abono', def: 'Pago de solo una parte del total. La venta queda “Abonado” hasta completar el monto.', link: 'abono' },
  { term: 'Administrador (admin)', def: 'Quien organiza la rifa: la configura, verifica pagos y hace el sorteo.' },
  { term: 'Al azar', def: 'Botón que escoge un número libre al azar (“número de la suerte”).', link: 'vender' },
  { term: 'Anular', def: 'Cancelar una venta. Sus números vuelven a quedar libres.', link: 'anular' },
  { term: 'Apartado', def: 'Número reservado por un comprador que todavía no lo ha confirmado o pagado. En el tablero se ve azul (apartado web).', link: 'apartados-web' },
  { term: 'Bandeja compartida', def: 'Lista de apartados de la página pública sin vendedor. El primero que lo toma, se lo queda.', link: 'tomar-bandeja' },
  { term: 'Bloque de números', def: 'Rango de números asignado a un vendedor (ej. 001 al 050).', link: 'asignar' },
  { term: 'Boleto digital', def: 'Enlace que recibe el comprador con sus números y el estado del pago, verificable en cualquier momento.', link: 'boleto' },
  { term: 'Borrador', def: 'Rifa que todavía no está a la venta ni se ve en la página pública.', link: 'abrir-ventas' },
  { term: 'Co-admin', def: 'Ayudante del organizador que puede administrar una rifa específica.', link: 'asignar' },
  { term: 'Comisión', def: 'Lo que gana el vendedor: un porcentaje de lo cobrado o un monto por número pagado.', link: 'mi-cuenta' },
  { term: 'Duplicado', def: 'Pago cuya referencia ya se usó en otro pago. Hay que revisarlo.', link: 'pago-movil' },
  { term: 'Efectivo por entregar', def: 'Efectivo que cobraste y aún no le has dado al organizador, ya descontada tu comisión.', link: 'mi-cuenta' },
  { term: 'Enlace personal', def: 'Link de la rifa con tu código de vendedor. Lo apartado desde ahí te llega a ti.', link: 'compartir' },
  { term: 'Entrega', def: 'Registro del dinero en efectivo que un vendedor le da al organizador.', link: 'entregas' },
  { term: 'Liberar', def: 'Cuando un número vuelve a estar disponible (por vencimiento o anulación).', link: 'vencimiento' },
  { term: 'Organizador', def: 'Dueño de las rifas de una organización (cliente de Rifalo).' },
  { term: 'Página pública', def: 'Página de la rifa que ve cualquier persona con el enlace: premio, precio y números libres.', link: 'apartados-web' },
  { term: 'Pagado', def: 'Número con el total pagado y verificado. Se ve verde.', link: 'tablero' },
  { term: 'Pago móvil', def: 'Pago instantáneo entre bancos venezolanos. Se anota banco, teléfono, cédula y referencia.', link: 'pago-movil' },
  { term: 'Plazo de pago', def: 'Tiempo que tiene el comprador para pagar antes de que el número se libere solo.', link: 'vencimiento' },
  { term: 'Por pagar', def: 'Número vendido que aún no se ha pagado. Se ve naranja.', link: 'apartar-vendedor' },
  { term: 'Por verificar', def: 'Pago registrado que el administrador todavía no ha confirmado.', link: 'verificar' },
  { term: 'Rechazado', def: 'Pago que el administrador no aceptó (por ejemplo, porque no llegó el dinero).', link: 'verificar' },
  { term: 'Referencia', def: 'Número de operación que da el banco en cada pago móvil o transferencia.', link: 'pago-movil' },
  { term: 'Sorteo', def: 'Momento en que se escoge el número ganador, según la regla de la rifa.', link: 'sorteo' },
  { term: 'Tablero', def: 'Cuadrícula con todos los números de la rifa y su estado por colores.', link: 'tablero' },
  { term: 'Tasa BCV', def: 'Tasa oficial del Banco Central de Venezuela para pasar de dólares a bolívares.', link: 'tasa' },
  { term: 'USDT', def: 'Moneda digital equivalente a un dólar, usada en Binance.', link: 'binance' },
  { term: 'Vendedor', def: 'Persona del equipo que vende números en una rifa con su usuario y clave.', link: 'equipo' },
  { term: 'Ventas cerradas', def: 'Estado en el que ya no se pueden vender números, pero sí registrar pagos.', link: 'abrir-ventas' },
  { term: 'Verificar', def: 'Confirmar que un pago llegó. Solo lo hace el administrador.', link: 'verificar' }
]

// ───────── Buscador ─────────
const SYNONYMS = [
  ['pago', 'pagar', 'pague', 'pagaron', 'pagó', 'pago', 'cobrar', 'cobro', 'cobre', 'cobré', 'dinero', 'plata', 'pagado', 'cancelo', 'canceló'],
  ['abono', 'abonar', 'abonó', 'parcial', 'mitad', 'parte', 'cuota', 'cuotas', 'incompleto', 'falta', 'resto'],
  ['apartar', 'apartado', 'apartados', 'aparto', 'reservar', 'reserva', 'reservado', 'separar', 'separado', 'guardar', 'fiado', 'despues'],
  ['vender', 'venta', 'ventas', 'vendi', 'vendí', 'vendo', 'comprador', 'cliente', 'compra', 'compro'],
  ['boleto', 'ticket', 'comprobante', 'recibo', 'constancia', 'whatsapp', 'wasap', 'guasap'],
  ['clave', 'contraseña', 'contrasena', 'password', 'olvide', 'olvidé', 'acceso', 'entrar', 'login', 'usuario'],
  ['anular', 'cancelar', 'borrar', 'eliminar', 'liberar', 'quitar', 'devolver', 'error', 'equivoque', 'equivoqué', 'arrepintio', 'arrepintió'],
  ['tasa', 'bcv', 'dolar', 'dólar', 'dolares', 'bolivares', 'bolívares', 'bs', 'cambio', 'divisa', 'euro', 'calculadora'],
  ['movil', 'móvil', 'pagomovil', 'transferencia', 'banco', 'referencia', 'captura'],
  ['binance', 'usdt', 'cripto', 'tether'],
  ['sorteo', 'sortear', 'ganador', 'gano', 'ganó', 'premio', 'rifar', 'loteria', 'lotería', 'resultado'],
  ['vence', 'vencio', 'venció', 'vencer', 'vencido', 'vencimiento', 'plazo', 'expira', 'tiempo', 'libera', 'liberó', 'liberado'],
  ['bandeja', 'web', 'pagina', 'página', 'publica', 'pública', 'internet'],
  ['compartir', 'enlace', 'link', 'qr', 'redes', 'instagram', 'estado', 'facebook', 'difundir'],
  ['comision', 'comisión', 'ganancia', 'porcentaje', 'gano'],
  ['entregar', 'entrega', 'efectivo', 'deuda', 'debo', 'rendir', 'cuadre'],
  ['verificar', 'confirmar', 'aprobar', 'revisar', 'rechazar', 'verificado'],
  ['buscar', 'encontrar', 'quien', 'quién', 'dueño', 'tiene', 'lupa'],
  ['equipo', 'vendedor', 'vendedores', 'persona', 'agregar', 'crear'],
  ['reporte', 'reportes', 'excel', 'pdf', 'exportar', 'historial', 'estadisticas'],
  ['instalar', 'icono', 'ícono', 'celular', 'telefono', 'teléfono', 'android', 'iphone']
]

export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'que', 'como', 'cómo', 'y', 'o', 'a', 'en', 'me', 'mi', 'se', 'lo', 'le', 'por', 'para', 'con', 'si', 'no', 'es', 'del', 'al', 'hago', 'hacer', 'puedo', 'quiero', 'cuando', 'donde', 'qué', 'que', 'su', 'sus', 'ya', 'hay'])
const SYN = (() => {
  const m = new Map()
  for (const g of SYNONYMS) {
    const ng = g.map(norm)
    for (const w of ng) m.set(w, new Set([...(m.get(w) || []), ...ng]))
  }
  return m
})()

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[a.length][b.length]
}

const stripMarks = s => s.replace(/\*\*|\[|\]/g, '')
const DOCS = [
  ...ARTICLES.map(a => ({ type: 'article', id: a.id, ref: a, title: a.title, head: norm(`${a.title} ${a.keys}`), body: norm(stripMarks(`${a.summary} ${a.steps.join(' ')} ${(a.tips || []).join(' ')}`)) })),
  ...FAQS.map((f, i) => ({ type: 'faq', id: 'faq' + i, ref: f, title: f.q, head: norm(f.q), body: norm(f.a) })),
  ...GLOSSARY.map(g => ({ type: 'term', id: 'term-' + norm(g.term), ref: g, title: g.term, head: norm(g.term), body: norm(g.def) }))
]
const wordsOf = s => new Set(s.split(/[^a-z0-9ñ]+/).filter(w => w.length > 3))
for (const d of DOCS) { d.headWords = wordsOf(d.head); d.words = wordsOf(d.body) }

function expand(token) {
  const out = new Set([token])
  for (const [w, set] of SYN) {
    if (w === token || (token.length >= 5 && w.length >= 5 && (w.startsWith(token) || token.startsWith(w)))) set.forEach(x => out.add(x))
  }
  return out
}

/** Busca en guías, preguntas frecuentes y glosario. Devuelve los resultados ordenados por relevancia. */
export function searchHelp(query, limit = 12) {
  const tokens = norm(query).split(/[^a-z0-9ñ]+/).filter(t => t && !STOP.has(t))
  if (!tokens.length) return []
  const scored = []
  for (const d of DOCS) {
    let score = 0
    let hits = 0
    for (const t of tokens) {
      let best = 0
      for (const w of expand(t)) {
        const exact = w === t
        if (d.head.includes(w)) best = Math.max(best, exact ? 8 : 5)
        else if (d.body.includes(w)) best = Math.max(best, exact ? 3 : 2)
      }
      if (!best && t.length >= 5) {
        for (const w of d.headWords) if (lev(t, w) <= 1) { best = 4; break }
        if (!best) for (const w of d.words) if (lev(t, w) <= 1) { best = 1.5; break }
      }
      if (best) hits++
      score += best
    }
    if (score > 0) {
      score *= hits / tokens.length + 0.3
      if (d.type === 'article') score *= 1.15
      scored.push({ ...d, score })
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}

export const articleById = id => ARTICLES.find(a => a.id === id)

/** Convierte **negrita** y [Botón] en HTML seguro. */
export function rich(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[(.+?)\]/g, '<span class="ui-btn">$1</span>')
}
