# App
- Es una app web pensada principalmente para ser usada desde el celular pero que también debe poder ser usada desde una PC
- En un celular se debe comportar como una pwa

# Login
- Login mediante cuenta de Google
- En la base de datos hay una colección con los emails que se pueden autenticar

# Base de datos
- Se implementa en Firestore
- Las fotos se guardan en Firebase Storage y en Firestore se guarda su referencia

# Secciones de la app
- La app cuenta con las siguientes secciones principales:
    - Sesiones de tiro: es la sección principal de la app. Cada vez que el usuario vaya al polígono creará una o más sesiones de tiro para registrar su rendimiento.
    - Rendimiento: una vez que se implemente el análisis de blancos, se podrá ver un evolutivo de las diferentes métricas, pudiendo elegir diferentes filtros como configuración del arma, munición, blanco, distancia, etc. El filtro de arma es por configuración (arma virtual).
    - Inventario: incluirá todos los flujos de ABM (alta, baja y modificación) de las armas, personalizaciones de las armas, municiones, polígonos, blancos, etc. La baja es un archivado: el elemento deja de ofrecerse para nuevas sesiones pero se conserva en el historial y se puede restaurar.
    - Perfil: contendrá configuración propia de la cuenta (unidades y tema: oscuro por defecto, claro o según el sistema) y la posibilidad de cerrar sesión.
- La mayor parte del tiempo el usuario lo pasa en la sección de sesiones de tiro.

# Sesiones de tiro
- Existe un ABM de sesiones de tiro.
- Cada sesión de tiro se componede:
    - arma de fuego
    - lista de personalizaciones del arma: se guarda una copia al registrar la sesión, para que cambios posteriores en el inventario no alteren el historial
    - fecha
    - lugar
    - clima (soleado, lluvioso, nublado, con niebla, etc.)
    - fotos del polígono (desde la cámara o el sistema de archivos)
    - munición
    - notas
    - lista de blancos: una sesión de tiro se compone de varias rondas de tiros y cada una de estas se componen de:
        - blanco utilizado (del ABM de blancos)
        - distancia de tiro (en metros)
        - cantidad de disparos
        - puntaje: se carga a mano o lo propone el análisis del blanco y el usuario lo confirma
        - foto del blanco (desde la cámara o el sistema de archivos)
        - comentarios

# ABM de armas de fuego
- Cada usuario puede tener varias armas de fuego. Cada una se compone de:
    - fotos del arma (desde el sistema de archivos o la cámara): puede tener varias fotos asociadas
    - marca
    - modelo
    - calibre
    - fecha de compra
    - lugar de compra
    - acumulado de tiros realizados con ese arma
- Cada arma puede ser personalizada con diferentes modificaciones. cada una de estas modificaciones se compone de:
    - marca
    - modelo
    - comentarios
- A partir de un arma de fuego base y una o más modificaciones se pueden crear armas virtuales que pueden ser elegidas en las sesiones de tiro

# ABM de polígonos
- Se puede dar de alta varios polígonos. Cada uno se compone de:
    - nombre
    - dirección

# ABM de municiones
- Cada tipo de munición se compone de:
    - marca
    - modelo
    - descripción

# ABM de blancos
- Cada blanco se compone de:
    - nombre
    - foto (desde la cámara o el sistema de archivos)
    - tipo de puntuación: anillos concéntricos o sin zonas (puntaje manual)
    - tamaño de referencia en mm: diámetro de la zona exterior (anillos) o ancho del blanco (sin zonas). Es la escala para medir en mm sobre la foto
    - zonas de puntaje (solo para anillos): lista de zonas, cada una con su puntaje y su diámetro en mm. Un impacto suma el puntaje de la zona más chica que contiene su centro (no se tiene en cuenta el diámetro del proyectil)

# Análisis de blancos
La aplicación incluye herramientas para analizar las fotos de los blancos. A partir de la ubicación de los impactos en el blanco, la aplicación puede calcular la precisión del tirador.

- Detección automática y manual de los puntos de impacto
- Permite al usuario agregar o quitar puntos de impacto manualmente
- Utilizando el documento shooting_metrics.md, implementa la detección de puntaje, el tamaño de agrupación, el PMI (punto medio de impacto) y las métricas de distancia al centro.
- Las medidas en mm usan el tamaño de referencia del blanco; el tamaño de grupo también se expresa en MOA usando la distancia de tiro de la ronda.