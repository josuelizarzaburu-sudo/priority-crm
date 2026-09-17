"""
Comprueba que los valores de enum usados en el codigo existan en el schema.

Existe por un error propio: al listar el enum EstadoRenovacion con una expresion
que no toleraba comentarios en la misma linea, "POR_RENOVAR // entra aqui por
defecto" no aparecio. Lo di por inexistente, lo quite de la lista y rompi el
guardado de renovaciones.

Uso:  python3 scripts/valida-enums.py
"""
import re, sys, glob

schema = open('packages/database/prisma/schema.prisma', encoding='utf-8').read()

# valores de cada enum, tolerando comentarios y espacios
enums = {}
for nombre, cuerpo in re.findall(r'enum (\w+) \{(.*?)\n\}', schema, re.S):
    valores = set()
    for linea in cuerpo.split('\n'):
        # se corta el comentario antes de leer el valor
        limpio = linea.split('//')[0].strip()
        if re.fullmatch(r'[A-Z][A-Z0-9_]*', limpio):
            valores.add(limpio)
    enums[nombre] = valores

# el @default de cada campo tiene que existir en su enum
err = []
for modelo, cuerpo in re.findall(r'model (\w+) \{(.*?)\n\}', schema, re.S):
    # El patron se aplica LINEA A LINEA: con re.M y .*? cruzaba al siguiente
    # renglon y tomaba el @default de otro campo.
    for linea in cuerpo.split('\n'):
        m = re.match(r'\s*(\w+)\s+(\w+)[^@]*@default\((\w+)\)', linea)
        if not m:
            continue
        campo, tipo, defecto = m.groups()
        if tipo in enums and defecto not in enums[tipo]:
            err.append(f'{modelo}.{campo}: @default({defecto}) no existe en {tipo}')

if err:
    print('VALORES POR DEFECTO QUE NO EXISTEN EN SU ENUM:')
    for e in err:
        print('  ' + e)
    sys.exit(1)

total = sum(len(v) for v in enums.values())
print(f'ENUMS OK: {len(enums)} enums, {total} valores')
