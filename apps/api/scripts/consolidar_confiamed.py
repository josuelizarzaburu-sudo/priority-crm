#!/usr/bin/env python3
"""
Consolida los 8 documentos de Confiamed en 4, uno por nivel de cobertura.

Cada nivel (10K/30K/60K/110K) tenia dos archivos, uno por red, que resultaron
99.8% identicos. Se conserva la tabla completa una sola vez y se listan
explicitamente las diferencias de la otra red.

Deliberadamente NO se fusionan niveles distintos entre si: ahi los valores
cambian en decenas de lugares y el riesgo de mezclar cifras es real.

El script verifica al final que no se haya perdido ningun valor.
"""
import re, os, difflib

KB = '/home/claude/priority-crm/apps/api/src/modules/priority-help/kb'

PARES = [
    ('10',  'confiamed-10-red-1.md',    'RED 1',     'confiamed-10-red-2.md',   'RED 2'),
    ('30',  'confiamed-30-red-top.md',  'RED 1 TOP', 'confiamed-30-red-2.md',   'RED 2'),
    ('60',  'confiamed-60-red-top.md',  'RED 1 TOP', 'confiamed-60-red-2.md',   'RED 2'),
    ('110', 'confiamed-110-red-top.md', 'RED 1 TOP', 'confiamed-110-red-2.md',  'RED 2'),
]


def norm(l):
    return re.sub(r'\s+', ' ', l).strip()


def consolidar(nivel, fa, reda, fb, redb):
    a = open(os.path.join(KB, fa)).read().split('\n')
    b = open(os.path.join(KB, fb)).read().split('\n')

    na, nb = [norm(l) for l in a], [norm(l) for l in b]

    # Diferencias reales, ignorando titulo y linea de fuente
    difs = []
    sm = difflib.SequenceMatcher(None, na, nb)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        izq = [l for l in na[i1:i2] if l]
        der = [l for l in nb[j1:j2] if l]
        for l in izq + der:
            if l.startswith('#') or l.startswith('> Fuente') or 'NOMBRE DEL PLAN' in l:
                break
        else:
            if izq or der:
                difs.append((izq, der))

    cuerpo = '\n'.join(a)
    # Reencabezar: el documento ahora cubre las dos redes
    cuerpo = re.sub(r'^# .*$',
                    f'# Confiamed — CONFIPLUS {nivel}K (Red 1 TOP y Red 2)'
                    if reda != 'RED 1' else
                    f'# Confiamed — CONFIPLUS {nivel}K (Red 1 y Red 2)',
                    cuerpo, count=1, flags=re.M)
    cuerpo = re.sub(r'^> Fuente:.*$',
                    f'> Fuente: `{fa.replace(".md", ".pdf")}` y '
                    f'`{fb.replace(".md", ".pdf")}`',
                    cuerpo, count=1, flags=re.M)

    aviso = (
        f'\n> IMPORTANTE: la tabla de abajo corresponde a **{reda}**.\n'
        f'> Las coberturas de **{redb}** son las mismas SALVO las diferencias\n'
        f'> listadas en la seccion "Diferencias entre redes" al final de este\n'
        f'> documento. Al responder sobre {redb}, aplicar esas diferencias.\n'
    )
    cuerpo = cuerpo.replace('\n```text', aviso + '\n```text', 1)

    seccion = [f'\n## Diferencias entre redes ({nivel}K)\n',
               f'| Concepto | {reda} | {redb} |', '|---|---|---|']
    for izq, der in difs:
        li = ' / '.join(izq) or '—'
        ld = ' / '.join(der) or '—'
        concepto = 'Diferencia'
        if 'TARIFARIO' in li.upper():
            concepto = 'Tarifario'
            li = li.replace('TARIFARIO', '').strip()
            ld = ld.replace('TARIFARIO', '').strip()
        elif 'PREFERENCIAL' in li.upper() or 'PREFERENCIAL' in ld.upper():
            concepto = 'Atención Hospitalaria Preferencial'
            li = re.sub(r'(?i)atención hospitalaria preferencial', '', li).strip()
            ld = re.sub(r'(?i)atención hospitalaria preferencial', '', ld).strip()
        seccion.append(f'| {concepto} | {li} | {ld} |')

    seccion.append('')
    seccion.append(f'Todo lo demas es identico entre {reda} y {redb} en el '
                   f'plan de {nivel}K.')

    salida = cuerpo.rstrip() + '\n' + '\n'.join(seccion) + '\n'
    destino = os.path.join(KB, f'confiamed-{nivel}k.md')
    open(destino, 'w').write(salida)
    return destino, difs, a, b, salida


def valores(texto):
    """Todos los importes y porcentajes del documento."""
    return set(re.findall(r'\$\s?[\d.,]+|\b\d+%|\b\d+\s*(?:días|dias|horas|meses|MESES)\b',
                          texto))


if __name__ == '__main__':
    print('=== CONSOLIDACION ===')
    fallos = 0
    for nivel, fa, reda, fb, redb in PARES:
        destino, difs, a, b, salida = consolidar(nivel, fa, reda, fb, redb)

        orig = valores('\n'.join(a)) | valores('\n'.join(b))
        nuevo = valores(salida)
        perdidos = orig - nuevo

        estado = 'OK' if not perdidos else f'FALTAN {len(perdidos)}'
        print(f'{os.path.basename(destino):24} difs={len(difs)}  {estado}')
        if perdidos:
            fallos += 1
            for p in sorted(perdidos)[:10]:
                print('      perdido:', p)

    print('\nfallos:', fallos)
