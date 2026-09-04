"""
Valida el schema como lo haría Prisma, sin necesidad de ejecutarlo.

Comprueba lo que ya nos rompió el build tres veces:
  1. @@index y @@unique que apuntan a campos inexistentes
  2. @relation(fields:) que apunta a un campo inexistente
  3. Relaciones con nombre SIN su inversa en el otro modelo  <- el ultimo fallo
"""
import re, sys

t = open('packages/database/prisma/schema.prisma', encoding='utf-8').read()
modelos = dict(re.findall(r'model (\w+) \{(.*?)\n\}', t, re.S))
err = []

for n, c in modelos.items():
    campos = set(re.findall(r'^\s*(\w+)\s+\S', c, re.M))
    for pat, tipo in [
        (r'@@index\(\[([^\]]+)\]', '@@index'),
        (r'@@unique\(\[([^\]]+)\]', '@@unique'),
        (r'@relation\([^)]*fields:\s*\[([^\]]+)\]', '@relation fields'),
    ]:
        for grp in re.findall(pat, c):
            for f in [x.strip() for x in grp.split(',')]:
                if f not in campos:
                    err.append(f'{n}: {tipo} apunta a "{f}", que no existe')

# Relaciones con nombre: cada una necesita su pareja en el otro modelo con el
# MISMO nombre. Es lo que fallo con ClienteAgente.
nombradas = {}
for n, c in modelos.items():
    for nombre, destino in re.findall(r'@relation\("(\w+)"[^)]*\)', c) and \
            re.findall(r'^\s*\w+\s+(\w+)\[?\]?\??\s+@relation\("(\w+)"', c, re.M) or []:
        nombradas.setdefault(destino, []).append((n, nombre))

for n, c in modelos.items():
    for tipo, nombre in re.findall(r'^\s*\w+\s+(\w+)\[?\]?\??\s+@relation\("(\w+)"', c, re.M):
        if tipo not in modelos:
            continue
        # el otro modelo debe declarar una relacion con el mismo nombre
        if f'@relation("{nombre}"' not in modelos[tipo]:
            err.append(f'{n}: la relacion "{nombre}" hacia {tipo} no tiene inversa en {tipo}')

if err:
    print('SCHEMA CON ERRORES:')
    for e in err:
        print('  ' + e)
    sys.exit(1)
print(f'SCHEMA OK: {len(modelos)} modelos, indices, relaciones e inversas')
