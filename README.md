# Box Training 3D 🥊

Un simulador de entrenamiento de boxeo estilo arcade en 3D, ejecutado directamente en el navegador. Demuestra tus reflejos, administra tu estamina y consigue el rango más alto (SS) antes de que el reloj llegue a cero.
## 📋 Datos académicos

| Campo               | Valor                             |
|---------------------|-----------------------------------|
| **Institución**     | Instituto Tecnológico de Pachuca |
| **Materia**         | Desarrollo de soluciones en ambientes virtuales |
| **Actividad**       | 2.6 Examen Tema 2. Programación y desarrollo de aplicaciones en escenarios virtuales   |
| **Estudiante**      | Luis Enrique Cabrera García       |
| **Matrícula**       | 22200205                          |
| **Profesor**        | M.C. Víctor Manuel Pinedo Fernández |
| **Fecha**           | 24 de marzo de 2026               |

## 🌟 Características Principales

* **Físicas Dinámicas:** El costal reacciona al peso y dirección de cada golpe, balanceándose de forma realista. Si te golpea de regreso, te empujará por el ring.
* **Sistema de Combate Arcade:** Encadena golpes (*Jab, Cross, Hook, Uppercut*) para multiplicar tu puntaje. Mantén el ritmo para no agotar tu estamina.
* **Modo "Frenesí":** En los últimos 15 segundos del round, las luces cambian, el costal pierde fricción y los impactos te empujarán con mucha más violencia.
* **Efectos Visuales (Juice):** Partículas de impacto, destellos, estelas de movimiento en los puños (Trails), *Screen Shake* (temblor de cámara) y un HUD dinámico.
* **Audio Inmersivo:** Efectos de sonido sincronizados exactamente en el frame de impacto y música de ambiente para mantener el ritmo del entrenamiento.

## 🎮 Controles

* **Mirar:** Mouse
* **Moverse:** `W` `A` `S` `D`
* **Correr:** `Shift Izquierdo` (Consume estamina)
* **Jab:** `Clic Izquierdo`
* **Punching (Fuerte):** `Clic Derecho`
* **Uppercut:** `Q`
* **Hook (Gancho):** `F`
* **Guardia:** `Espacio`
* **Esquivar:** `E`
* **Reiniciar Round:** `R`

## 🛠️ Tecnologías Utilizadas

* **HTML5 & CSS3:** Maquetación de interfaz de usuario (HUD, Overlays, Menús).
* **JavaScript (ES6+):** Lógica principal del juego y gestión de estados.
* **Three.js:** Motor WebGL para renderizado 3D, luces, sombras y manejo de cámara.
* **Three.js Addons:** * `FBXLoader` / `GLTFLoader` (Para importar modelos y animaciones).
  * `Octree` / `Capsule` (Para el sistema de colisiones preciso de los límites del ring).
* **Lil-GUI:** Panel de depuración y ajustes en tiempo real (luces, niebla, cámara).

## 🎓 Créditos
Desarrollado por Luis Enrique Cabrera García.
Proyecto de WebGL y Three.js - Ingeniería en Tecnologías de la Información y Comunicaciones (ITICS), Instituto Tecnológico de Pachuca.
