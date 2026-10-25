# Visión — [Range Book]

## En una frase
Range Book es una app para ayudar a un tirador a llevar registro de su desempeño en las sesiones de tiro en el polígono. Permite cargar las armas y municiones que dispone indicuando cuales usa en cada sesión y registrando fotos de las disparos en las dianas para evaluar el rendimiento.

## Restricciones generales
- **Plataforma:** la app se desplegará en un proyecto de Firebase usando los módulso de hosting, Firestore, Storage y Authentication
- **Fotos:** las fotos (armas, polígonos, blancos y rondas) se guardan en Firebase Storage; en Firestore solo se guarda la referencia
- **Idioma:** el idioma de la app será el español
- **Datos y privacidad:** los datos creados por cada usuario solo podrán ser vistos por ese usuario
- **Otras:** cada usuario se logueará en la app usando su email de Google