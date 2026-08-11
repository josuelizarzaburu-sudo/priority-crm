#!/usr/bin/env python3
"""
Re-extrae los PDF de Saludsa agrupando por BLOQUES de layout.

La primera extraccion uso `pdftotext -layout`, que devuelve la lamina como
texto alineado con espacios. Eso trae dos problemas:

  1. ~9.350 tokens de toda la base son espacios de relleno, que se pagan en
     cada consulta.
  2. Peor: las laminas tienen cajas lado a lado, asi que una linea mezcla
     temas distintos ("Monto limite por | Afiliado intrautero: | Emergencia/").
     El modelo tiene que reconstruir a que caja pertenece cada fragmento.

Extrayendo por bloques cada caja queda junta y rotulada, sin relleno.

Se conserva el arreglo de codificacion: algunas paginas traen la fuente sin
tabla de caracteres y el texto sale desplazado 29 posiciones, con los
acentos en rango MacRoman.
"""
import pymupdf, re, os, glob

KB = '/home/claude/priority-crm/apps/api/src/modules/priority-help/kb'
PDFS = '/mnt/project'

NOTA_LITE = ('NOTA: Priority no comercializa los planes "Lite". Si el material '
             'los menciona en notas al pie, no deben ofrecerse ni compararse.')

PREMIOS = ('medallas', 'canjear', 'gift card', 'giftcard', 'multicines',
           'cupones', 'bebidas y comida', 'equipo deportivo', 'sorteo',
           'premios semanales', 'premios mensuales', 'acumula puntos')

COBERTURA = ('cobertura', 'deducible', 'carencia', 'copago', 'hospital',
             'ambulatorio', 'maternidad', 'dental', 'videoconsulta',
             'preexistencia', 'emergencia', 'reembolso', 'medicina',
             'consulta', 'exclusion', 'exclusión', 'red ', 'prestador',
             'trasplante', 'laboratorio', 'imagen', 'terapia', 'beneficiario')

SALIDA = {
    'Saludsa_coberturas_y_redes_de_planes_star_15_y_star_30_.pdf':
        ('saludsa-star-15k-star-30k', 'Star 15K y Star 30K'),
    'Saludsa_cobertuas_y_red_Sky_50_y_Sky_70_.pdf':
        ('saludsa-sky-50-sky-70', 'Sky 50 y Sky 70'),
    'Saludsa_Plan_Cobertuas_y_red_Pro_150k.pdf':
        ('saludsa-pro-150k', 'Pro 150K'),
    'Saludsa_Plan_cobertura_y_red_Optimus.pdf':
        ('saludsa-optimus', 'Optimus'),
    'Saludsa_Plan_coberturas_y_red_Optimus_Plus.pdf':
        ('saludsa-optimus-plus', 'Optimus Plus'),
    'Saludsa_Plan_coberturas_y_Red_65.pdf':
        ('saludsa-red-65', 'Red 65+'),
}


def decodificar(t):
    """Revierte el desplazamiento +29 de las paginas mal codificadas."""
    if '\x03' not in t:
        return t
    out = []
    for ch in t:
        if ch in ' \n\t':
            out.append(ch)
            continue
        v = ord(ch) + 29
        if v >= 0x80:
            try:
                out.append(bytes([v + 1]).decode('mac_roman'))
            except Exception:
                out.append('?')
        else:
            out.append(chr(v))
    return ''.join(out)


def limpiar(t):
    t = re.sub(r'[ \t]{2,}', ' ', t)
    t = re.sub(r'\n{2,}', '\n', t)
    return t.strip()


def es_pagina_red(txt):
    u = txt.upper()
    return ('CONOCE LA RED' in u or
            (u.count('HOSPITALES') and u.count('CIUDAD')) or
            'FARMACIAS' in u and 'PRESTADOR' in u)


def descartar(txt):
    b = txt.lower()
    if not any(p in b for p in PREMIOS):
        return False
    return not any(c in b for c in COBERTURA)


def procesar(pdf_name):
    slug, titulo = SALIDA[pdf_name]
    doc = pymupdf.open(os.path.join(PDFS, pdf_name))

    cob, red, omitidas = [], [], []

    for i, page in enumerate(doc, 1):
        bloques = page.get_text('blocks')
        # orden de lectura: por columna (x) y luego por altura (y)
        bloques = sorted(bloques, key=lambda b: (round(b[0] / 60), b[1]))
        piezas = []
        for b in bloques:
            t = limpiar(decodificar(b[4]))
            if t:
                piezas.append(t)
        texto = '\n\n'.join(piezas)
        if not texto.strip():
            continue
        if descartar(texto):
            omitidas.append(i)
            continue
        (red if es_pagina_red(texto) else cob).append((i, texto))

    doc.close()
    hechos = []

    if cob:
        md = [f'# Saludsa — {titulo}', '',
              f'> Fuente: `{pdf_name}` (páginas de coberturas)', '',
              f'> {NOTA_LITE}', '']
        if omitidas:
            md += [f'> Se omitieron las páginas de premios y sorteos de '
                   f'Vitality ({", ".join("p" + str(n) for n in omitidas)}), '
                   f'por no aportar información de cobertura.', '']
        for n, t in cob:
            md += [f'## Página {n}', '', t, '']
        p = os.path.join(KB, f'{slug}-coberturas.md')
        open(p, 'w').write('\n'.join(md))
        hechos.append(p)

    if red:
        md = [f'# Saludsa — Red médica ({titulo})', '',
              f'> Fuente: `{pdf_name}` (páginas de red)', '',
              '> AVISO DE VIGENCIA: la red de prestadores cambia. Al responder '
              'sobre red, indicar que debe confirmarse contra la guía médica '
              'vigente de Saludsa.', '']
        for n, t in red:
            md += [f'## Página {n}', '', t, '']
        p = os.path.join(KB + '/../kb-red-v2', f'{slug}-red.md')
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'w').write('\n'.join(md))
        hechos.append(p)

    return hechos


def valores(t):
    return re.findall(r'\$\s?[\d.,]+|\d+\s*%|\d+\s*(?:d[ií]as|horas|meses|SBU)', t)


if __name__ == '__main__':
    total_antes = total_despues = 0
    for pdf in SALIDA:
        slug, _ = SALIDA[pdf]
        viejo_path = os.path.join(KB, f'{slug}-coberturas.md')
        viejo = open(viejo_path).read() if os.path.exists(viejo_path) else ''

        procesar(pdf)
        nuevo = open(viejo_path).read()

        va, vn = valores(viejo), valores(nuevo)
        faltan = sorted({v for v in set(va) if va.count(v) > vn.count(v)})

        a, d = len(viejo) / 3.5, len(nuevo) / 3.5
        total_antes += a
        total_despues += d
        print(f'{slug:26} {a:>6,.0f} -> {d:>6,.0f} tok  '
              f'({(1 - d / a) * 100:>4.0f}%)  perdidos={len(faltan)}')
        for f in faltan[:8]:
            print('      ', f)

    print(f'\nTOTAL {total_antes:,.0f} -> {total_despues:,.0f} tokens '
          f'({(1 - total_despues / total_antes) * 100:.0f}% menos)')
