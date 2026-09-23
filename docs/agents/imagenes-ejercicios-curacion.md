# Curación de imágenes de ejercicios

Fuente: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público). Ver `docs/superpowers/specs/2026-09-23-imagenes-ejercicios-design.md` para el criterio de curación completo.

| id | nombre | confianza | fuente en el dataset |
|---|---|---|---|
| abductor-maquina | Abductor en máquina | directo | Thigh Abductor |
| aductor-maquina | Aductor en máquina | directo | Thigh Adductor |
| aperturas-mancuernas | Aperturas con mancuernas | directo | Dumbbell Flyes |
| crunch-abdominal | Crunch abdominal | directo | Crunches |
| curl-biceps-barra | Curl de bíceps con barra | directo | Barbell Curl |
| curl-biceps-mancuernas | Curl de bíceps con mancuernas | directo | Dumbbell Bicep Curl |
| curl-femoral | Curl femoral | directo | Lying Leg Curls |
| curl-muneca | Curl de muñeca con barra | directo | Palms-Up Barbell Wrist Curl Over A Bench |
| dominadas | Dominadas | directo | Pullups |
| elevacion-frontal-mancuerna | Elevación frontal con mancuerna | directo | Front Dumbbell Raise |
| elevacion-gemelos-prensa | Elevación de gemelos en prensa | directo | Calf Press On The Leg Press Machine |
| elevacion-gemelos-sentado | Elevación de gemelos sentado | directo | Seated Calf Raise |
| elevacion-gemelos | Elevación de gemelos de pie | directo | Standing Calf Raises |
| elevacion-piernas-banco | Elevación de piernas acostado | directo | Flat Bench Lying Leg Raise |
| elevacion-piernas-colgado | Elevación de piernas colgado | directo | Hanging Leg Raise |
| elevaciones-laterales | Elevaciones laterales | directo | Side Lateral Raise |
| encogimientos-hombros | Encogimientos de hombros | directo | Dumbbell Shrug |
| extension-cuadriceps | Extensión de cuádriceps | directo | Leg Extensions |
| extension-triceps-polea | Extensión de tríceps en polea | directo | Triceps Pushdown |
| face-pull | Face pull | directo | Face Pull |
| fondos-paralelas | Fondos en paralelas | directo | Parallel Bar Dip |
| giro-ruso | Giro ruso | directo | Russian Twist |
| hip-thrust | Hip thrust | directo | Barbell Hip Thrust |
| hiperextensiones | Hiperextensiones | directo | Hyperextensions (Back Extensions) |
| jalon-al-pecho | Jalón al pecho | directo | Wide-Grip Lat Pulldown |
| pajaros-mancuernas | Pájaros con mancuernas | directo | Reverse Flyes |
| patada-gluteo-polea | Patada de glúteo en polea | directo | One-Legged Cable Kickback |
| patada-triceps-mancuerna | Patada de tríceps con mancuerna | directo | Tricep Dumbbell Kickback |
| peso-muerto-rumano | Peso muerto rumano | directo | Romanian Deadlift |
| peso-muerto | Peso muerto | directo | Barbell Deadlift |
| plancha-abdominal | Plancha abdominal | directo | Plank |
| plancha-lateral | Plancha lateral | directo | Side Bridge |
| prensa-piernas-45 | Prensa de piernas 45° | directo | Leg Press |
| prensa-piernas-unilateral | Prensa de piernas unilateral | sin match | — |
| prensa-piernas-vertical | Prensa de piernas vertical | sin match | — |
| press-arnold | Press Arnold | directo | Arnold Dumbbell Press |
| press-banca | Press de banca | directo | Barbell Bench Press - Medium Grip |
| press-cerrado-banca | Press cerrado en banca | directo | Close-Grip Barbell Bench Press |
| press-frances | Press francés | directo | EZ-Bar Skullcrusher |
| press-inclinado-mancuernas | Press inclinado con mancuernas | directo | Incline Dumbbell Press |
| press-militar | Press militar | directo | Standing Military Press |
| press-piernas | Press de piernas | directo | Leg Press |
| puente-gluteo | Puente de glúteo | directo | Butt Lift Bridge |
| pullover | Pullover con mancuerna | directo | Bent-Arm Dumbbell Pullover |
| remo-al-menton | Remo al mentón | directo | Upright Barbell Row |
| remo-barra | Remo con barra | directo | Bent Over Barbell Row |
| remo-mancuerna-un-brazo | Remo con mancuerna a un brazo | directo | One-Arm Dumbbell Row |
| remo-polea-baja-sentado | Remo en polea baja sentado | directo | Seated Cable Rows |
| sentadilla-bulgara | Sentadilla búlgara | aproximado | Split Squat with Dumbbells |
| sentadilla-goblet | Sentadilla goblet | directo | Goblet Squat |
| sentadilla | Sentadilla con barra | directo | Barbell Squat |
| zancadas | Zancadas | directo | Dumbbell Lunges |

## Notas

- Los 26 ejercicios de este lote encontraron match directo en el dataset — mismo movimiento y mismo tipo de equipo. No hubo casos de "aproximado" ni "sin match razonable" en este lote.
- Para cada ejercicio se inspeccionó visualmente `0.jpg` y, cuando correspondía, `1.jpg` del par de imágenes del dataset, y se eligió el frame que representa mejor el movimiento completo (por ejemplo la fase de contracción/tope en curls, elevaciones, dominadas, remos, o la fase de apertura en aperturas/pájaros), no necesariamente el primer elemento del array. El frame elegido para cada uno:
  - `0.jpg`: abductor-maquina, aductor-maquina, curl-femoral, curl-muneca, elevacion-gemelos-prensa, elevacion-gemelos-sentado, elevacion-gemelos, face-pull, fondos-paralelas, hiperextensiones.
  - `1.jpg`: aperturas-mancuernas, crunch-abdominal, curl-biceps-barra, curl-biceps-mancuernas, dominadas, elevacion-frontal-mancuerna, elevacion-piernas-banco, elevacion-piernas-colgado, elevaciones-laterales, encogimientos-hombros, extension-cuadriceps, extension-triceps-polea, giro-ruso, hip-thrust, jalon-al-pecho, pajaros-mancuernas.
- `giro-ruso` usa `Russian_Twist/1.jpg` en particular porque esa imagen muestra la variante con disco (coincide con "peso corporal o disco"), mientras que `0.jpg` mostraba una polea que no correspondía a ninguna de las dos opciones de equipo.

### Notas (lote 2 — Task 5)

- De los 26 ejercicios de este segundo lote, 23 encontraron match directo (mismo movimiento, mismo tipo de equipo) y 3 quedaron en "aproximado" originalmente: `prensa-piernas-unilateral`, `prensa-piernas-vertical` y `sentadilla-bulgara`. Tras la revisión posterior (ver "Correcciones post-revisión" más abajo), las primeras dos pasaron a "sin match" (imagen eliminada) y `sentadilla-bulgara` se mantiene en "aproximado" (ver detalle en "Para revisar" más abajo).
- Igual que en el lote 1, se inspeccionó visualmente `0.jpg` y `1.jpg` de cada entrada elegida y se seleccionó el frame que mejor representa el movimiento (fase de contracción/estiramiento más ilustrativa), no necesariamente el primero del array:
  - `0.jpg`: patada-triceps-mancuerna, peso-muerto-rumano, peso-muerto, prensa-piernas-45, prensa-piernas-unilateral, prensa-piernas-vertical, press-arnold, press-cerrado-banca, press-frances, press-inclinado-mancuernas, press-piernas, remo-al-menton, remo-polea-baja-sentado.
  - `1.jpg`: patada-gluteo-polea, plancha-abdominal, plancha-lateral, press-banca, press-militar, puente-gluteo, pullover, remo-barra, remo-mancuerna-un-brazo, sentadilla-bulgara, sentadilla-goblet, sentadilla, zancadas.
- `plancha-abdominal` usa `Plank/1.jpg` en lugar de `0.jpg` porque `Plank/0.jpg` está mal etiquetado en el dataset (muestra una postura de estiramiento de cadera arrodillado, no una plancha) — se verificó visualmente antes de descartarlo.
- `prensa-piernas-45` y `press-piernas` comparten la misma fuente (`Leg_Press`, genérica) porque el dataset no distingue variantes de ángulo — la máquina de prensa de piernas estándar que aparece en la imagen es efectivamente del tipo inclinado/45°, así que se consideró directo para ambas entradas del catálogo español.
- `sentadilla-bulgara` usa `Split_Squat_with_Dumbbells`, que muestra una sentadilla dividida con mancuernas y la pierna trasera flexionada cerca de un banco, pero no queda claro en la imagen que el pie trasero esté apoyado y elevado sobre el banco (el rasgo distintivo de la búlgara) — se marcó "aproximado" en vez de forzar un "directo".

### Correcciones post-revisión (revisión de código, 2026-09-23)

Una revisión posterior encontró que la curación original (Tasks 4-5) nunca conectó los `.webp` ya curados al campo `image` del frontmatter (cero ejercicios lo tenían seteado), y que algunos pares "directo" no se habían verificado contra el texto de instrucciones propio de cada ejercicio (solo contra nombre/equipo). Se corrigieron los siguientes casos:

- **press-frances**: la nota original decía que "press francés" en uso habitual se refiere a la extensión de pie con barra tras la cabeza, y por eso usaba `Standing_Overhead_Barbell_Triceps_Extension`. Pero el cuerpo de `press-frances.md` describe explícitamente el movimiento acostado ("Acostado en un banco con los brazos extendidos hacia el techo, flexiona solo los codos bajando el peso hacia la frente..."), que es el rompecráneos (skullcrusher) acostado, no la extensión de pie. Se corrigió a `EZ-Bar_Skullcrusher` (equipo "e-z curl bar", coincide con "Barra o mancuernas"; instrucciones del dataset: acostado, brazos perpendiculares al piso, solo se flexionan los codos bajando la barra hasta la frente) — ahora sí coincide con el texto propio del ejercicio. Se regeneró `public/exercises/press-frances.webp` desde `EZ-Bar_Skullcrusher/1.jpg` (posición de flexión, barra cerca de la frente).
- **pullover**: usaba `Straight-Arm_Dumbbell_Pullover`, cuyas instrucciones del dataset dicen explícitamente "keeping your arms straight" (brazos rectos durante todo el movimiento). Pero `pullover.md` describe "manteniendo los brazos semiflexionados" — una contradicción directa, no solo falta de detalle. El dataset sí tiene una entrada dedicada a la variante con codos semiflexionados: `Bent-Arm_Dumbbell_Pullover` (mismo equipo "dumbbell", instrucciones: "hold it... with a bend in your arms" / "keeping your arms locked in the bent arm position"). Se corrigió la fuente y se regeneró `public/exercises/pullover.webp` desde `Bent-Arm_Dumbbell_Pullover/1.jpg` (posición de estiramiento, mismo encuadre que la imagen anterior).
- El resto de los 49 ejercicios restantes marcados "directo" (más `sentadilla-bulgara` en "aproximado") se revisaron comparando el texto de instrucciones en español contra el nombre/equipo/músculos de la entrada del dataset elegida — no se encontraron más contradicciones. `sentadilla-bulgara` en particular: al inspeccionar visualmente `public/exercises/sentadilla-bulgara.webp` se confirma que el pie trasero sí está apoyado y elevado sobre un banco visible en el encuadre, así que la duda original ("no queda claro en la imagen...") parece haber sido excesivamente cautelosa — se deja en "aproximado" de todas formas por no ser parte del alcance de esta corrección.
- **prensa-piernas-unilateral** y **prensa-piernas-vertical**: se determinó que la imagen compartida de `Leg_Press` (bilateral, inclinada/45°) no solo carece de detalle sino que contradice activamente la forma descrita — la unilateral requiere que se vea una sola pierna empujando a la vez, y la vertical requiere una orientación acostado boca arriba con la plataforma sobre el cuerpo, no un ángulo inclinado. Se eliminaron ambas imágenes (`public/exercises/prensa-piernas-unilateral.webp`, `public/exercises/prensa-piernas-vertical.webp`) en vez de dejar una imagen engañosa; sus filas pasaron de "aproximado" a "sin match" y no tienen `image:` en su frontmatter.
- Se agregó `image: <id>.webp` al frontmatter de los 50 ejercicios que sí tienen `.webp` válido en `public/exercises/` (los 52 curados originalmente, menos los 2 recién eliminados).

## Para revisar

Los siguientes ejercicios NO tienen imagen — no hay match aceptable en el dataset y se prefirió omitir la imagen antes que mostrar una engañosa:

- prensa-piernas-unilateral (Prensa de piernas unilateral): sin match — la única fuente candidata en el dataset ("Leg Press") muestra la variante bilateral (dos piernas empujando a la vez), lo que contradice el rasgo definitorio del ejercicio (una pierna a la vez). Imagen eliminada.
- prensa-piernas-vertical (Prensa de piernas vertical): sin match — la única fuente candidata ("Leg Press") muestra la prensa inclinada/45° estándar, con una orientación de cuerpo completamente distinta a la máquina de prensa vertical (acostado boca arriba, plataforma sobre el cuerpo). Imagen eliminada.

El siguiente ejercicio tiene match aproximado (imagen presente pero con una salvedad menor, no contradictoria):

- sentadilla-bulgara (Sentadilla búlgara): aproximado con "Split Squat with Dumbbells" del dataset — mismo movimiento general de sentadilla dividida con mancuernas; el pie trasero elevado sobre un banco (rasgo distintivo de la búlgara) sí es visible en la imagen elegida.

Los 49 ejercicios restantes (26 del lote 1 + 23 del lote 2) tienen match directo (mismo movimiento, mismo tipo de equipo, verificado contra el texto de instrucciones propio de cada ejercicio) — no requieren revisión. Sumado a `sentadilla-bulgara` (aproximado), da un total de 50 ejercicios con imagen.
