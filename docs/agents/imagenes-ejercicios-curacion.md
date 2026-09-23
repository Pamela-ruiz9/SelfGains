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

## Notas

- Los 26 ejercicios de este lote encontraron match directo en el dataset — mismo movimiento y mismo tipo de equipo. No hubo casos de "aproximado" ni "sin match razonable" en este lote.
- Para cada ejercicio se inspeccionó visualmente `0.jpg` y, cuando correspondía, `1.jpg` del par de imágenes del dataset, y se eligió el frame que representa mejor el movimiento completo (por ejemplo la fase de contracción/tope en curls, elevaciones, dominadas, remos, o la fase de apertura en aperturas/pájaros), no necesariamente el primer elemento del array. El frame elegido para cada uno:
  - `0.jpg`: abductor-maquina, aductor-maquina, curl-femoral, curl-muneca, elevacion-gemelos-prensa, elevacion-gemelos-sentado, elevacion-gemelos, face-pull, fondos-paralelas, hiperextensiones.
  - `1.jpg`: aperturas-mancuernas, crunch-abdominal, curl-biceps-barra, curl-biceps-mancuernas, dominadas, elevacion-frontal-mancuerna, elevacion-piernas-banco, elevacion-piernas-colgado, elevaciones-laterales, encogimientos-hombros, extension-cuadriceps, extension-triceps-polea, giro-ruso, hip-thrust, jalon-al-pecho, pajaros-mancuernas.
- `giro-ruso` usa `Russian_Twist/1.jpg` en particular porque esa imagen muestra la variante con disco (coincide con "peso corporal o disco"), mientras que `0.jpg` mostraba una polea que no correspondía a ninguna de las dos opciones de equipo.
