/**
 * Carga inicial del módulo de Operaciones.
 *
 *   pnpm --filter @priority-crm/database exec ts-node prisma/seed-operaciones.ts
 *
 * Es IDEMPOTENTE: se puede correr varias veces sin duplicar nada. Los usuarios
 * se buscan por correo y los clientes por (organización + identificación), que
 * es justamente el índice único que impide que un mismo cliente entre dos veces.
 *
 * Contraseña inicial: se toma de SEED_DEFAULT_PASSWORD. Si no está definida,
 * el script se detiene en vez de poner una insegura por su cuenta.
 */
import { PrismaClient, UserRole, Genero, EstadoPoliza, FormaPago, Parentesco } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface DependienteJson {
  clave: string
  nombres: string
  apellidos: string | null
  identificacion: string | null
  fechaNacimiento: string | null
  parentesco: string
}
interface PolizaJson {
  numeroContrato: string | null
  estado: string | null
  aseguradora: string | null
  plan: string | null
  deducible: string | null
  formaPago: string | null
  fechaEmision: string | null
  primaNeta: number | null
  agenteNombre: string | null
  cubre: string[]
  revisar: boolean
  revisarMotivo: string | null
}
interface ClienteJson {
  nombres: string
  apellidos: string
  identificacion: string
  genero: string | null
  fechaNacimiento: string | null
  ciudad: string | null
  direccion: string | null
  email: string | null
  celular: string | null
  telefono: string | null
  ejecutivoNombre: string | null
  revisar: boolean
  revisarMotivo: string | null
  polizas: PolizaJson[]
  dependientes: DependienteJson[]
}
interface UsuarioJson {
  name: string
  email: string
  phone: string | null
  cargo: string
  role: string
}

const fecha = (v: string | null) => (v ? new Date(v) : null)

/** Compara nombres ignorando tildes y mayúsculas: "YESSICA OJEDA" vs "Yessenia Ojeda Flores". */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()

async function main() {
  const password = process.env.SEED_DEFAULT_PASSWORD
  if (!password) {
    throw new Error(
      'Falta SEED_DEFAULT_PASSWORD. Definila antes de correr el seed, por ejemplo:\n' +
        '  SEED_DEFAULT_PASSWORD="unaClaveTemporal" pnpm ... seed-operaciones.ts',
    )
  }

  const orgSlug = process.env.ORGANIZATION_SLUG ?? 'acme-corp'
  const org = await prisma.organization.findFirst({ where: { slug: orgSlug } })
  if (!org) throw new Error(`No existe la organización con slug "${orgSlug}"`)

  const raw = fs.readFileSync(path.join(__dirname, 'datos-iniciales.json'), 'utf8')
  const { usuarios, clientes } = JSON.parse(raw) as {
    usuarios: UsuarioJson[]
    clientes: ClienteJson[]
  }

  // ── 1. Usuarios del área de operaciones ──
  const hash = await bcrypt.hash(password, 12)
  const usuariosCreados: { id: string; name: string; email: string }[] = []

  for (const u of usuarios) {
    const existente = await prisma.user.findUnique({ where: { email: u.email } })
    if (existente) {
      // No le tocamos la contraseña a alguien que ya entró alguna vez.
      const actualizado = await prisma.user.update({
        where: { id: existente.id },
        data: { name: u.name, phone: u.phone, role: u.role as UserRole },
      })
      usuariosCreados.push(actualizado)
      console.log(`  = ${u.email} ya existía, se actualizó nombre/rol`)
    } else {
      const creado = await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hash,
          phone: u.phone,
          role: u.role as UserRole,
          organizationId: org.id,
        },
      })
      usuariosCreados.push(creado)
      console.log(`  + ${u.email} creado como ${u.role}`)
    }
  }

  // ── 2. Índice para resolver "CAROLINA TERNEUS" -> usuario ──
  const porApellido = new Map<string, string>()
  for (const u of usuariosCreados) {
    for (const parte of norm(u.name).split(/\s+/)) {
      if (parte.length > 2 && !porApellido.has(parte)) porApellido.set(parte, u.id)
    }
  }
  const resolverEjecutivo = (nombre: string | null): string | null => {
    if (!nombre) return null
    for (const parte of norm(nombre).split(/\s+/)) {
      const id = porApellido.get(parte)
      if (id) return id
    }
    return null
  }

  // ── 3. Clientes, pólizas y dependientes ──
  let nuevos = 0
  let yaExistian = 0
  const sinEjecutivo: string[] = []

  for (const c of clientes) {
    const ejecutivoId = resolverEjecutivo(c.ejecutivoNombre)
    if (c.ejecutivoNombre && !ejecutivoId) {
      sinEjecutivo.push(`${c.nombres} ${c.apellidos} (${c.ejecutivoNombre})`)
    }

    const existente = await prisma.cliente.findUnique({
      where: {
        organizationId_identificacion: {
          organizationId: org.id,
          identificacion: c.identificacion,
        },
      },
    })
    if (existente) {
      yaExistian++
      console.log(`  = cliente ${c.identificacion} ya existía, se omite`)
      continue
    }

    // Creamos el cliente con sus dependientes en una sola operación.
    const cliente = await prisma.cliente.create({
      data: {
        nombres: c.nombres,
        apellidos: c.apellidos,
        identificacion: c.identificacion,
        genero: (c.genero as Genero) ?? null,
        fechaNacimiento: fecha(c.fechaNacimiento),
        ciudad: c.ciudad,
        direccion: c.direccion,
        email: c.email,
        celular: c.celular,
        telefono: c.telefono,
        revisar: c.revisar,
        revisarMotivo: c.revisarMotivo,
        organizationId: org.id,
        ejecutivoId,
        ejecutivoNombre: c.ejecutivoNombre,
        dependientes: {
          create: c.dependientes.map(d => ({
            nombres: d.nombres,
            apellidos: d.apellidos,
            identificacion: d.identificacion,
            fechaNacimiento: fecha(d.fechaNacimiento),
            parentesco: d.parentesco as Parentesco,
          })),
        },
      },
      include: { dependientes: true },
    })

    // Mapa clave-del-json -> id real, para saber a quién cubre cada póliza.
    const idPorClave = new Map<string, string>()
    c.dependientes.forEach((d, i) => {
      const creado = cliente.dependientes[i]
      if (creado) idPorClave.set(d.clave, creado.id)
    })

    for (const p of c.polizas) {
      await prisma.poliza.create({
        data: {
          numeroContrato: p.numeroContrato,
          estado: (p.estado as EstadoPoliza) ?? null,
          aseguradora: p.aseguradora,
          plan: p.plan,
          deducible: p.deducible,
          formaPago: (p.formaPago as FormaPago) ?? null,
          fechaEmision: fecha(p.fechaEmision),
          primaNeta: p.primaNeta,
          agenteNombre: p.agenteNombre,
          revisar: p.revisar,
          revisarMotivo: p.revisarMotivo,
          clienteId: cliente.id,
          organizationId: org.id,
          dependientes: {
            create: p.cubre
              .map(clave => idPorClave.get(clave))
              .filter((id): id is string => Boolean(id))
              .map(dependienteId => ({ dependienteId })),
          },
        },
      })
    }
    nuevos++
  }

  // ── Resumen ──
  const marcados = await prisma.cliente.count({ where: { organizationId: org.id, revisar: true } })
  console.log('\n─────────────────────────────')
  console.log(`Usuarios procesados ..... ${usuariosCreados.length}`)
  console.log(`Clientes nuevos ......... ${nuevos}`)
  console.log(`Clientes ya existentes .. ${yaExistian}`)
  console.log(`Marcados "por revisar" .. ${marcados}`)
  if (sinEjecutivo.length) {
    console.log('\nSIN EJECUTIVO ASIGNADO (no los verá ninguna ejecutiva):')
    sinEjecutivo.forEach(x => console.log(`  - ${x}`))
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
