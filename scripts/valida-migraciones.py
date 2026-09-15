"""
Compara las columnas de cada CREATE TABLE con lo que espera Prisma.

Existe por un error real: una columna se escribio "corteePrima" en el SQL y
"cortePrima" en el schema. Prisma compila igual —no lee el SQL— y el fallo
aparece recien en produccion, con un error 500 sin explicacion.

Uso:  python3 scripts/valida-migraciones.py
"""
import re, sys, glob

# columnas declaradas en las migraciones
tablas = {}
for f in glob.glob('packages/database/prisma/migrations/*/migration.sql'):
    sql = open(f, encoding='utf-8').read()
    for m in re.finditer(r'CREATE TABLE(?: IF NOT EXISTS)? "(\w+)" \((.*?)\n\);', sql, re.S):
        # El tipo puede ir entre comillas cuando es un enum:
        #   "estado" "EstadoPoliza" NOT NULL
        cols = set(re.findall(r'^\s+"(\w+)"\s+"?\w', m.group(2), re.M))
        # una tabla puede crearse en una migracion y ampliarse en otra
        tablas.setdefault(m.group(1), set()).update(cols)
    # las columnas que se agregan despues cuentan igual
    # Un ALTER TABLE puede agregar VARIAS columnas de una vez:
    #   ALTER TABLE "clientes" ADD COLUMN "a" TEXT,
    #                          ADD COLUMN "b" TEXT;
    # Se toma el bloque entero hasta el punto y coma y se leen todas.
    for t, bloque in re.findall(r'ALTER TABLE "(\w+)"(.*?);', sql, re.S):
        for c in re.findall(r'ADD COLUMN(?: IF NOT EXISTS)?\s+"(\w+)"', bloque):
            tablas.setdefault(t, set()).add(c)
    # y los renombres
    for t, viejo, nuevo in re.findall(
        r'ALTER TABLE "(\w+)" RENAME COLUMN "(\w+)" TO "(\w+)"', sql
    ):
        tablas.setdefault(t, set()).add(nuevo)

schema = open('packages/database/prisma/schema.prisma', encoding='utf-8').read()
modelos = dict(re.findall(r'model (\w+) \{(.*?)\n\}', schema, re.S))
nombres = set(modelos)

err = []
for modelo, cuerpo in modelos.items():
    mp = re.search(r'@@map\("(\w+)"\)', cuerpo)
    if not mp or mp.group(1) not in tablas:
        continue  # sin migracion propia: se creo antes de este validador

    campos = set()
    for l in cuerpo.split('\n'):
        m = re.match(r'\s+(\w+)\s+(\w+)(\[\]|\?)?\s*(.*)$', l)
        if not m:
            continue
        nombre, tipo, _, resto = m.groups()
        # las relaciones no son columnas
        if '@relation' in (resto or '') or tipo in nombres:
            continue
        campos.add(nombre)

    faltan = campos - tablas[mp.group(1)]
    if faltan:
        err.append(f'{modelo} ({mp.group(1)}): la tabla no tiene {", ".join(sorted(faltan))}')

if err:
    print('COLUMNAS QUE PRISMA ESPERA Y LA TABLA NO TIENE:')
    for e in err:
        print('  ' + e)
    sys.exit(1)
print(f'MIGRACIONES OK: {len(tablas)} tablas comprobadas contra el schema')
