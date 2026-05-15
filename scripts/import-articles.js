/**
 * Script de importación del Maestro de Artículos desde Flexxus XLS
 * Uso: node scripts/import-articles.js [ruta-del-archivo.xls]
 *
 * Si no se pasa ruta, usa el path por defecto.
 */

require('dotenv').config();
const path  = require('path');
const XLSX  = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_PATH = 'C:/Archivos Flexxus/Listado de Artculos_11-05-2026 20-27-21.XLS';
const filePath     = process.argv[2] || DEFAULT_PATH;

// Índices de columnas (basados en el XLS real de Flexxus)
// Fila 9 = encabezados: Código | Descripción | (vacías) | Rubro | (vacías) | Coef.Var | Tipo | Clase | Activo?
const COL = {
  code:        0,
  description: 1,
  category:    5,
  coefVar:     8,
  type:        9,
  class:       10,
  active:      11,
};

// Fila donde empiezan los datos reales (0-based, fila 9 = index 8 es el header)
const DATA_START_ROW = 9; // fila 10 del Excel = index 9

async function main() {
  console.log(`\n📂 Leyendo archivo: ${filePath}`);

  let wb;
  try {
    wb = XLSX.readFile(filePath);
  } catch (e) {
    console.error(`❌ No se pudo leer el archivo: ${e.message}`);
    process.exit(1);
  }

  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const dataRows = rows.slice(DATA_START_ROW).filter(r => r[COL.code] && r[COL.description]);
  console.log(`📊 Artículos encontrados: ${dataRows.length}`);

  let created = 0, updated = 0, skipped = 0;
  const BATCH = 100;

  for (let i = 0; i < dataRows.length; i += BATCH) {
    const batch = dataRows.slice(i, i + BATCH);
    await Promise.all(batch.map(async (r) => {
      const code        = String(r[COL.code]).trim();
      const description = String(r[COL.description]).trim();
      if (!code || !description) { skipped++; return; }

      const data = {
        description,
        category:   r[COL.category]  ? String(r[COL.category]).trim()  : null,
        type:       r[COL.type]       ? String(r[COL.type]).trim()       : null,
        class:      r[COL.class]      ? String(r[COL.class]).trim()      : null,
        coefVar:    r[COL.coefVar] !== '' ? parseFloat(r[COL.coefVar]) || null : null,
        active:     String(r[COL.active]).trim().toUpperCase() !== 'NO',
      };

      await prisma.article.upsert({
        where:  { code },
        update: data,
        create: { code, ...data },
      });
      created++; // cuenta inserts + updates
    }));

    const pct = Math.round(((i + batch.length) / dataRows.length) * 100);
    process.stdout.write(`\r   Progreso: ${pct}% (${i + batch.length}/${dataRows.length})`);
  }

  console.log(`\n\n✅ Importación completa:`);
  console.log(`   Creados:   ${created}`);
  console.log(`   Actualizados: ${updated}`);
  console.log(`   Omitidos:  ${skipped}`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
