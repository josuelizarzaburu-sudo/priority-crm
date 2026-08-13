#!/usr/bin/env python3
"""
Extrae la Malla de Planes 2026 de Saludsa a markdown, un archivo por plan.

Esta fuente es mucho mejor que los PDF: es una tabla real con Copago,
Sublimites y Carencia por prestacion, separados en Red Cerrada y Red
Abierta. Los PDF eran infografias y obligaban a inferir esas asociaciones.

Estructura del Excel:
  fila 2  -> nombre del plan (en la columna donde empieza su bloque)
  fila 3  -> deducible
  fila 6  -> monto de wallet
  fila 7  -> RED CERRADA (col c) / RED ABIERTA (col c+3)
  fila 8  -> encabezados: Copago | Sub_limites | Carencia (x2)
  fila 9+ -> prestaciones

Por defecto se excluyen los planes LITE (Priority no los comercializa).
"""
import openpyxl, re, os, sys

SRC = '/mnt/user-data/uploads/Malla_Nuevos_Planes_2026.xlsx'
OUT = '/home/claude/kb-saludsa-2026'
os.makedirs(OUT, exist_ok=True)

EXCLUIR = ('LITE', 'WALLET', 'HOSPITALARIO', 'PRO 500K', 'SKY 70K PLUS')


def limpiar(v):
    if v is None:
        return ''
    # Copagos guardados como fraccion: 0.1 -> 10%
    if isinstance(v, float) and not isinstance(v, bool) and 0 < v <= 1:
        p = v * 100
        return f'{p:.0f}%' if abs(p - round(p)) < 1e-9 else f'{p:.1f}%'
    s = re.sub(r'\s+', ' ', str(v).replace('\n', ' ')).strip()
    return s


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def main(incluir_lite=False):
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb['Malla Nuevos Planes']
    rows = list(ws.iter_rows(values_only=True))

    r2, r3, r5, r6, r7, r8 = rows[1], rows[2], rows[4], rows[5], rows[6], rows[7]

    cerradas = {j for j, c in enumerate(r7) if c and 'CERRADA' in str(c).upper()}
    presta = [j for j, c in enumerate(r8) if c and 'Prestaciones' in str(c)]
    planes = [(j, limpiar(c)) for j, c in enumerate(r2) if c and j in cerradas]

    hechos = []
    for col, nombre in planes:
        if not incluir_lite and any(x in nombre.upper() for x in EXCLUIR):
            continue

        # columna de prestaciones = la ultima que quede antes del bloque
        pcol = max([p for p in presta if p < col], default=None)
        if pcol is None:
            continue

        def val(fila, j):
            return limpiar(fila[j]) if j < len(fila) else ''

        md = [f'# Saludsa — {nombre}', '',
              f'> Fuente: `Malla_Nuevos_Planes_2026.xlsx` — hoja '
              f'`Malla Nuevos Planes`', '',
              '> Tabla oficial de coberturas 2026. Copagos, topes y carencias '
              'por prestación, separados en Red Cerrada y Red Abierta.', '']

        # --- ficha ---
        # El monto maximo esta en la misma fila del nombre, en la celda
        # combinada de la izquierda; si ahi cae la etiqueta en vez del valor,
        # se deduce del propio nombre del plan (STAR 15K -> $15.000).
        monto = val(r2, col + 1) or val(r2, col + 2)
        if not monto or 'Monto' in monto:
            m = re.search(r'(\d+)\s*K', nombre.upper())
            monto = f'USD {int(m.group(1)):,}'.replace(',', '.') + '.000' if m else ''
            if m:
                monto = f'USD {int(m.group(1))}.000'

        ficha = [
            ('Monto máximo de cobertura anual (por enfermedad por usuario)', monto),
            ('Deducible anual por persona', val(r3, col)),
            ('Tarifario aplicable', val(r5, col)),
            ('Monto de Wallet', val(r6, col)),
        ]
        md += ['## Datos del plan', '', '| Campo | Valor |', '|---|---|']
        for k, v in ficha:
            if v and v.upper() not in ('N/A', 'NA'):
                md.append(f'| {k} | {v} |')
            elif v:
                md.append(f'| {k} | No aplica |')
        md.append('')

        # --- prestaciones ---
        md += ['## Prestaciones', '',
               '| Cobertura | Prestación | Copago Red Cerrada | Tope Red Cerrada '
               '| Carencia Red Cerrada | Copago Red Abierta | Tope Red Abierta '
               '| Carencia Red Abierta |',
               '|---|---|---|---|---|---|---|---|']

        grupo = ''
        n = 0
        for fila in rows[8:]:
            g = limpiar(fila[pcol - 1]) if pcol - 1 < len(fila) else ''
            if g:
                grupo = g
            prest = val(fila, pcol)
            if not prest:
                continue
            vals = [val(fila, col + k) for k in range(6)]
            if not any(vals):
                continue
            md.append('| ' + ' | '.join(
                [grupo or '—', prest] + [v or '—' for v in vals]) + ' |')
            n += 1

        if n == 0:
            continue

        path = os.path.join(OUT, f'saludsa-{slug(nombre)}-coberturas.md')
        open(path, 'w').write('\n'.join(md) + '\n')
        hechos.append((path, n, len('\n'.join(md)) / 3.5))

    wb.close()
    return hechos


if __name__ == '__main__':
    for p, n, tk in main():
        print(f'{os.path.basename(p):46} {n:>3} prestaciones  {tk:>6,.0f} tok')
