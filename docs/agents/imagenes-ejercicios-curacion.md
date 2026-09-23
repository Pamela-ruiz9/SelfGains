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
| prensa-piernas-unilateral | Prensa de piernas unilateral | aproximado | Leg Press |
| prensa-piernas-vertical | Prensa de piernas vertical | aproximado | Leg Press |
| press-arnold | Press Arnold | directo | Arnold Dumbbell Press |
| press-banca | Press de banca | directo | Barbell Bench Press - Medium Grip |
| press-cerrado-banca | Press cerrado en banca | directo | Close-Grip Barbell Bench Press |
| press-frances | Press francés | directo | Standing Overhead Barbell Triceps Extension |
| press-inclinado-mancuernas | Press inclinado con mancuernas | directo | Incline Dumbbell Press |
| press-militar | Press militar | directo | Standing Military Press |
| press-piernas | Press de piernas | directo | Leg Press |
| puente-gluteo | Puente de glúteo | directo | Butt Lift Bridge |
| pullover | Pullover con mancuerna | directo | Straight-Arm Dumbbell Pullover |
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

- De los 26 ejercicios de este segundo lote, 23 encontraron match directo (mismo movimiento, mismo tipo de equipo) y 3 quedaron en "aproximado": `prensa-piernas-unilateral`, `prensa-piernas-vertical` y `sentadilla-bulgara` (ver detalle en "Para revisar" más abajo). Ningún caso de "sin match razonable".
- Igual que en el lote 1, se inspeccionó visualmente `0.jpg` y `1.jpg` de cada entrada elegida y se seleccionó el frame que mejor representa el movimiento (fase de contracción/estiramiento más ilustrativa), no necesariamente el primero del array:
  - `0.jpg`: patada-triceps-mancuerna, peso-muerto-rumano, peso-muerto, prensa-piernas-45, prensa-piernas-unilateral, prensa-piernas-vertical, press-arnold, press-cerrado-banca, press-frances, press-inclinado-mancuernas, press-piernas, remo-al-menton, remo-polea-baja-sentado.
  - `1.jpg`: patada-gluteo-polea, plancha-abdominal, plancha-lateral, press-banca, press-militar, puente-gluteo, pullover, remo-barra, remo-mancuerna-un-brazo, sentadilla-bulgara, sentadilla-goblet, sentadilla, zancadas.
- `plancha-abdominal` usa `Plank/1.jpg` en lugar de `0.jpg` porque `Plank/0.jpg` está mal etiquetado en el dataset (muestra una postura de estiramiento de cadera arrodillado, no una plancha) — se verificó visualmente antes de descartarlo.
- `press-frances` usa `Standing_Overhead_Barbell_Triceps_Extension` en lugar de `EZ-Bar_Skullcrusher`: "press francés" en el uso habitual en español se refiere a la extensión de tríceps de pie/sentado con la barra detrás de la cabeza (no al rompecráneos acostado), y esa entrada del dataset coincide con esa forma exacta con equipo barra.
- `prensa-piernas-45` y `press-piernas` comparten la misma fuente (`Leg_Press`, genérica) porque el dataset no distingue variantes de ángulo — la máquina de prensa de piernas estándar que aparece en la imagen es efectivamente del tipo inclinado/45°, así que se consideró directo para ambas entradas del catálogo español.
- `prensa-piernas-unilateral` y `prensa-piernas-vertical` reusan la misma imagen de `Leg_Press` (bilateral, en ángulo) a falta de una variante unilateral o de prensa vertical en el dataset; quedan marcadas "aproximado" porque la imagen no muestra fielmente la variante (una pierna a la vez, o la orientación vertical acostado boca arriba).
- `sentadilla-bulgara` usa `Split_Squat_with_Dumbbells`, que muestra una sentadilla dividida con mancuernas y la pierna trasera flexionada cerca de un banco, pero no queda claro en la imagen que el pie trasero esté apoyado y elevado sobre el banco (el rasgo distintivo de la búlgara) — se marcó "aproximado" en vez de forzar un "directo".

## Para revisar

Los siguientes ejercicios NO tienen un match directo — revisar si el match aproximado es aceptable, o si conviene buscar otra fuente para esos casos puntuales:

- prensa-piernas-unilateral (Prensa de piernas unilateral): aproximado con "Leg Press" del dataset — la imagen muestra la variante bilateral (dos piernas), no hay una entrada dedicada a la prensa unilateral.
- prensa-piernas-vertical (Prensa de piernas vertical): aproximado con "Leg Press" del dataset — la imagen muestra la prensa inclinada/45° estándar, no la máquina de prensa vertical (acostado boca arriba, piernas hacia el techo).
- sentadilla-bulgara (Sentadilla búlgara): aproximado con "Split Squat with Dumbbells" del dataset — mismo movimiento general de sentadilla dividida con mancuernas, pero la imagen no confirma claramente el pie trasero elevado sobre un banco, que es el rasgo distintivo de la búlgara.

Los 23 ejercicios restantes de este lote y los 26 del lote anterior (Task 4) tuvieron match directo (mismo movimiento, mismo tipo de equipo) — no requieren revisión.
