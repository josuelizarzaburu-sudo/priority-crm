#!/usr/bin/env python3
"""
Quita de los documentos de Saludsa SOLO las paginas de premios y sorteos.

Criterio deliberadamente conservador. Un primer intento por palabras clave
marcaba como "marketing" paginas que contienen cobertura real: la lamina
"Te damos 10 razones" incluye Plan Dental y videoconsultas ilimitadas, que
son argumento de venta. Por eso solo se elimina una pagina cuando habla de
premios Y no menciona ninguna cobertura.
"""
import re, os, glob

KB = '/home/claude/priority-crm/apps/api/src/modules/priority-help/kb'

# Señales de pagina de premios/sorteo
PREMIOS = ('medallas', 'canjear', 'gift card', 'giftcard', 'multicines',
           'cupones', 'bebidas y comida', 'equipo deportivo', 'sorteo',
           'premios semanales', 'premios mensuales', 'acumula puntos')

# Si aparece cualquiera de estas, la pagina tiene contenido util y NO se toca
COBERTURA = ('cobertura', 'deducible', 'carencia', 'copago', 'hospital',
             'ambulatorio', 'maternidad', 'dental', 'videoconsulta',
             'preexistencia', 'emergencia', 'reembolso', 'medicina',
             'consulta', 'exclusion', 'exclusión', 'red ', 'prestador',
             'trasplante', 'laboratorio', 'imagen', 'terapia', 'beneficiario')


def decidir(cuerpo):
    b = cuerpo.lower()
    if not any(p in b for p in PREMIOS):
        return True, 'sin señales de premios'
    if any(c in b for c in COBERTURA):
        return True, 'menciona cobertura: se conserva'
    return False, 'premios sin cobertura'


def procesar(path):
    txt = open(path).read()
    bloques = list(re.finditer(r'(^## Página (\d+)\n\n```text\n(.*?)\n```\n)',
                               txt, flags=re.S | re.M))
    quitadas, ahorro = [], 0
    nuevo = txt
    for m in bloques:
        completo, num, cuerpo = m.group(1), m.group(2), m.group(3)
        conservar, motivo = decidir(cuerpo)
        if not conservar:
            nuevo = nuevo.replace(completo, '')
            quitadas.append((num, len(cuerpo) / 3.5))
            ahorro += len(cuerpo) / 3.5

    if quitadas:
        nota = ('\n> NOTA: se omitieron paginas de premios y sorteos del '
                'programa Vitality por no aportar informacion de cobertura. '
                'Todo lo demas del documento original se conserva.\n')
        nuevo = re.sub(r'(^> Fuente:.*$)', r'\1\n' + nota, nuevo,
                       count=1, flags=re.M)
        nuevo = re.sub(r'\n{4,}', '\n\n\n', nuevo)
        open(path, 'w').write(nuevo)

    return quitadas, ahorro


if __name__ == '__main__':
    total = 0
    for f in sorted(glob.glob(os.path.join(KB, 'saludsa-*coberturas.md'))):
        antes = len(open(f).read()) / 3.5
        quitadas, ahorro = procesar(f)
        despues = len(open(f).read()) / 3.5
        total += ahorro
        pags = ', '.join(f'p{n}' for n, _ in quitadas) or '—'
        print(f'{os.path.basename(f)[:52]:52} {antes:>6,.0f} -> {despues:>6,.0f} tok  '
              f'quitadas: {pags}')
    print(f'\nahorro total: {total:,.0f} tokens')
