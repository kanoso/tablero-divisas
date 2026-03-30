# Tablero Financiero LATAM

Panel de monitoreo de mercados financieros latinoamericanos. Consolida datos de tasas de referencia, bonos soberanos, divisas, índices bursátiles, materias primas, ETFs de renta fija y criptomonedas en un único dashboard actualizado diariamente de forma automática.

- **Dashboard en vivo**: https://kanoso.github.io/tablero-divisas
- **Índice de reportes**: https://kanoso.github.io/tablero-divisas/reports
- **Repositorio**: https://github.com/kanoso/tablero-divisas

---

## Qué muestra el dashboard

El tablero tiene siete pestanas:

| Pestaña | Contenido |
|---|---|
| **Tasas** | Tasas de política monetaria de BCRP, Fed, ECB, Chile, Colombia, México y Brasil. Incluye gráfico comparativo. |
| **Bonos** | Curva soberana de Perú (2Y–30Y), rendimientos a 10 años de países LATAM y spreads EMBIG por país. |
| **Divisas** | Tipos de cambio USD/PEN, DXY, USD/CLP, USD/COP, USD/MXN y USD/BRL con variación diaria y YTD. |
| **Activos** | Índices bursátiles (S&P 500, NASDAQ, Dow Jones, BVL Perú, MSCI LATAM) y materias primas (oro, plata, cobre, WTI, gas natural). |
| **ETFs RF** | ETFs de renta fija con precio, rendimiento estimado y TER. |
| **Crypto** | Top criptomonedas con precio, variación 24h, 7d, YTD y capitalización de mercado. |
| **Macro Perú** | Inflación CPI, crecimiento PIB, deuda/PIB, reservas internacionales, calificaciones crediticias y comparativa de deuda LATAM. |

Cada ejecución también genera un **reporte diario** en formato `.md` y `.html` con un resumen del estado del mercado.

---

## Fuentes de datos

| Fuente | Datos |
|---|---|
| **yahoo-finance2** | Tipos de cambio, índices bursátiles, materias primas, ETFs (precio, variación diaria, YTD) |
| **CoinGecko API** | Criptomonedas (precio, variación 24h / 7d, capitalización de mercado) |
| **Hardcoded (est.)** | Tasas de referencia, curva soberana Perú, rendimientos regionales a 10Y, spreads EMBIG, indicadores macro Perú |

> Los valores marcados con **(est.)** en el dashboard son datos hardcodeados. Se actualizan manualmente en `scripts/fetch_data.ts`. Ver la sección [Notas](#notas) para mas detalle.

---

## Estructura del proyecto

```
tablero-divisas/
├── .github/
│   └── workflows/
│       └── daily.yml          # Cron de GitHub Actions (13:00 UTC)
├── data/
│   └── latest.json            # Ultimo snapshot de mercado (generado)
├── reports/
│   ├── index.html             # Índice navegable de reportes (generado)
│   ├── YYYY-MM-DD.md          # Reporte diario en Markdown (generado)
│   └── YYYY-MM-DD.html        # Reporte diario en HTML (generado)
├── scripts/
│   ├── fetch_data.ts          # Obtiene datos de APIs y genera data/latest.json
│   ├── generate_html.ts       # Genera index.html a partir del template y los datos
│   ├── generate_md.ts         # Genera el reporte diario en Markdown
│   └── generate_reports_index.ts  # Genera el índice de reportes en reports/index.html
├── templates/
│   └── dashboard.html         # Template HTML del dashboard (Chart.js, Mermaid.js)
├── index.html                 # Dashboard publicado (generado)
├── package.json
└── tsconfig.json
```

---

## Setup local

**Requisitos previos**: Node.js 18+ y Git.

```bash
# Clonar el repositorio
git clone https://github.com/kanoso/tablero-divisas.git
cd tablero-divisas

# Instalar dependencias
npm install

# Obtener datos y generar todos los archivos
npm run build
```

Abrir `index.html` directamente en el navegador para ver el dashboard localmente.

---

## Scripts disponibles

| Script | Descripcion |
|---|---|
| `npm run fetch` | Consulta las APIs y escribe `data/latest.json` |
| `npm run html` | Genera `index.html` a partir del template y `latest.json` |
| `npm run md` | Genera el reporte diario en `reports/YYYY-MM-DD.md` |
| `npm run reports` | Genera el índice HTML en `reports/index.html` |
| `npm run build` | Ejecuta los cuatro scripts anteriores en secuencia |

---

## Automatizacion con GitHub Actions

El workflow `.github/workflows/daily.yml` se ejecuta todos los días a las **13:00 UTC (08:00 Lima, UTC-5)**.

El flujo completo tiene dos jobs:

1. **`update-dashboard`**: ejecuta `npm run build`, hace commit de los archivos generados (`index.html`, `data/latest.json`, `reports/`) y los empuja a `main`.
2. **`deploy-pages`**: toma el contenido del repositorio y lo despliega a GitHub Pages.

Para ejecutarlo manualmente: ir a **Actions → Daily Dashboard Update → Run workflow**.

---

## Reportes diarios

Cada ejecucion genera dos archivos en `reports/`:

- `YYYY-MM-DD.md` — reporte en Markdown, ideal para sincronizar con Obsidian.
- `YYYY-MM-DD.html` — version navegable accesible desde el índice en `/reports`.

**Tip para Obsidian**: apuntar la carpeta `reports/` de este repositorio como vault o carpeta dentro de un vault existente para tener los reportes disponibles sin pasos adicionales.

---

## Publicacion en GitHub Pages

1. Ir a **Settings → Pages** del repositorio.
2. En *Source*, seleccionar **GitHub Actions**.
3. Hacer un push o ejecutar el workflow manualmente para el primer despliegue.

El sitio queda disponible en `https://<usuario>.github.io/tablero-divisas`.

---

## Notas

- Los datos marcados con **(est.)** en el dashboard son valores hardcodeados en `scripts/fetch_data.ts`. Representan tasas de referencia, curva soberana y macroeconomía de Perú, que no están disponibles en las APIs gratuitas utilizadas. Deben actualizarse manualmente cuando cambian.
- **BVL Perú** no está disponible a través de la API gratuita de Yahoo Finance. El ticker `BVL` puede retornar datos incorrectos o nulos; se muestra en el panel con la advertencia correspondiente.
