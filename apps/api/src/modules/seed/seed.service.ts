import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { UserRole, Genero, EstadoPoliza, FormaPago, Parentesco } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

// Datos iniciales del módulo de Operaciones, extraídos y limpiados del Excel.
// Se incrustan aquí para no depender de rutas de archivo en el contenedor.
const DATOS: {
  usuarios: Array<{ name: string; email: string; phone: string | null; cargo: string; role: string }>
  clientes: Array<any>
} = {"usuarios": [{"name": "Yessenia Amparo Ojeda Flores", "email": "yojeda@priority.ec", "phone": "0987687910", "cargo": "Jefe de Servicio al Cliente", "role": "JEFE_OPERACIONES"}, {"name": "Stephany Karolina Sosa Moscoso", "email": "ssosa@priority.ec", "phone": "0987378307", "cargo": "Ejecutiva de Cuenta", "role": "OPERACIONES"}, {"name": "Carolina Terneus Toledo", "email": "serviciouio@priority.ec", "phone": "0984802996", "cargo": "Ejecutiva de Cuenta", "role": "OPERACIONES"}, {"name": "Erika Elizabeth Diaz Pupiales", "email": "servicio@priority.ec", "phone": "0987173368", "cargo": "Ejecutiva de Cuenta", "role": "OPERACIONES"}, {"name": "Gianella Pozo", "email": "comercial@priority.ec", "phone": "0987734263", "cargo": "Ejecutiva de Cuenta", "role": "OPERACIONES"}], "clientes": [{"nombres": "PABLO ALEJANDRO", "apellidos": "CARRILLO BEJARANO", "identificacion": "1712055118", "genero": "MASCULINO", "fechaNacimiento": "1972-05-05", "ciudad": "QUITO", "direccion": "LEONOR ROSALES N44 10 Y CAMILO EGAS", "email": "pcarrillo@priority.ec", "celular": "0996097767", "telefono": null, "ejecutivoNombre": "CAROLINA TERNEUS", "polizas": [{"numeroContrato": "266700462", "estado": "RENOVADO", "aseguradora": "BMI", "plan": "GMM", "deducible": "10000", "formaPago": "CONTADO", "fechaEmision": "2007-08-01", "primaNeta": 1177.2, "agenteNombre": "ROXANA AVILES", "cubre": ["1714356381", "1723456745", "1723456756", "1723226756"], "revisar": false, "revisarMotivo": null}, {"numeroContrato": "4567y8", "estado": "NUEVO", "aseguradora": "ATLANTIDA", "plan": "AUTO", "deducible": null, "formaPago": "CONTADO", "fechaEmision": "2026-08-01", "primaNeta": 890.0, "agenteNombre": "ROXANA AVILES", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [{"clave": "1714356381", "nombres": "ROXANA", "apellidos": "AVILES", "identificacion": "1714356381", "fechaNacimiento": "1977-10-10", "parentesco": "CONYUGE"}, {"clave": "1723456745", "nombres": "MATHIAS", "apellidos": "CARRRILLO", "identificacion": "1723456745", "fechaNacimiento": "2002-08-19", "parentesco": "HIJO"}, {"clave": "1723456756", "nombres": "CAMILA", "apellidos": "CARRRILLO", "identificacion": "1723456756", "fechaNacimiento": "2006-12-18", "parentesco": "HIJO"}, {"clave": "1723226756", "nombres": "PABLO", "apellidos": "CARRRILLO", "identificacion": "1723226756", "fechaNacimiento": "2006-12-18", "parentesco": "HIJO"}], "revisar": false, "revisarMotivo": null}, {"nombres": "EDGAR SANTIAGO", "apellidos": "VILLAMARIN CORTES", "identificacion": "1723658946", "genero": "MASCULINO", "fechaNacimiento": "1977-01-08", "ciudad": "QUITO", "direccion": "SAN JUAN GUATEMALA SN JOSE MARIA BORJA", "email": "sanbid@gmail.com", "celular": "98567845", "telefono": null, "ejecutivoNombre": "CAROLINA TERNEUS", "polizas": [{"numeroContrato": "MT25Q07412", "estado": "RENOVADO", "aseguradora": "BMI", "plan": "TERM 95", "deducible": null, "formaPago": "CONTADO", "fechaEmision": "2025-11-01", "primaNeta": 2346.2, "agenteNombre": "ROXANA AVILES", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [], "revisar": true, "revisarMotivo": "celular incompleto (8 digitos: 98567845); cedula no pasa el digito verificador (1723658946)"}, {"nombres": "LUCIA PAULINA", "apellidos": "BARRERA CADENA", "identificacion": "1245678909", "genero": "FEMENINO", "fechaNacimiento": "1970-02-28", "ciudad": "QUITO", "direccion": "JORGE ADOUM Y RIOJA CONJUNTO VILLA ORELLANA Casa 11", "email": "pbarrera@groupdmc.com", "celular": "0996783452", "telefono": null, "ejecutivoNombre": "CAROLINA TERNEUS", "polizas": [{"numeroContrato": "AI15Q00904", "estado": "RENOVADO", "aseguradora": "BMI", "plan": "IDEAL", "deducible": "10000", "formaPago": "MENSUAL", "fechaEmision": "2025-04-16", "primaNeta": 6984.05, "agenteNombre": "ROXANA AVILES", "cubre": ["1567845677", "1345768945"], "revisar": false, "revisarMotivo": null}], "dependientes": [{"clave": "1567845677", "nombres": "ANDY", "apellidos": "GUERRA", "identificacion": "1567845677", "fechaNacimiento": "1974-03-23", "parentesco": "CONYUGE"}, {"clave": "1345768945", "nombres": "ANDRES", "apellidos": "GUERRA", "identificacion": "1345768945", "fechaNacimiento": "2006-03-06", "parentesco": "HIJO"}], "revisar": true, "revisarMotivo": "cedula no pasa el digito verificador (1245678909)"}, {"nombres": "IVAN RENE", "apellidos": "JIMENEZ NUÑEZ", "identificacion": "1745678945", "genero": "MASCULINO", "fechaNacimiento": "1977-03-03", "ciudad": "AMBATO", "direccion": "AV 19 DE AGOSTO Y ELOY ALFARO", "email": "rg@gmail.com", "celular": "96602567", "telefono": null, "ejecutivoNombre": "STEPHANY SOSA", "polizas": [{"numeroContrato": "345674", "estado": "NUEVO", "aseguradora": "CONFIAMED", "plan": "CONFIPLUS 30", "deducible": "120", "formaPago": "MENSUAL", "fechaEmision": "2026-05-23", "primaNeta": 3465.0, "agenteNombre": "MARIA JOSE MOSQUERA", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [], "revisar": true, "revisarMotivo": "celular incompleto (8 digitos: 96602567); cedula no pasa el digito verificador (1745678945)"}, {"nombres": "MARIA GABRIELA", "apellidos": "GONZALEZ", "identificacion": "1789456723", "genero": "FEMENINO", "fechaNacimiento": "1977-05-04", "ciudad": "GUAYAQUIL", "direccion": "ELOY ALFARO N4567 Y SUCRE", "email": "gy@gmail.com", "celular": "0995673489", "telefono": null, "ejecutivoNombre": "YESSICA OJEDA", "polizas": [{"numeroContrato": "HU45678", "estado": "NUEVO", "aseguradora": "HUMANA", "plan": "METROHUMANA 50", "deducible": "100", "formaPago": "MENSUAL", "fechaEmision": "2026-03-03", "primaNeta": 1134.0, "agenteNombre": "JUAN FERNANDO SEGOVIA", "cubre": ["1745679078"], "revisar": false, "revisarMotivo": null}], "dependientes": [{"clave": "1745679078", "nombres": "PEDRO", "apellidos": "GONZALEZ", "identificacion": "1745679078", "fechaNacimiento": "2023-01-01", "parentesco": "HIJO"}], "revisar": true, "revisarMotivo": "cedula no pasa el digito verificador (1789456723)"}, {"nombres": "MARIA AMPARO", "apellidos": "JARRIN", "identificacion": "1767458909", "genero": "FEMENINO", "fechaNacimiento": "2000-07-03", "ciudad": "QUITO", "direccion": "AV DE DICIEMBRE N56 7 Y PORTUGAL", "email": "yu@gmail.com", "celular": "99767894", "telefono": null, "ejecutivoNombre": "ERIKA DIAZ", "polizas": [{"numeroContrato": "12345678", "estado": "RENOVADO", "aseguradora": "SALUD", "plan": "SKY 50", "deducible": "100", "formaPago": "MENSUAL", "fechaEmision": "2022-06-17", "primaNeta": 5678.0, "agenteNombre": "ELIZABETH TORRES", "cubre": ["1756908876", "1734659067"], "revisar": false, "revisarMotivo": null}], "dependientes": [{"clave": "1756908876", "nombres": "PABLO", "apellidos": "DAVILA", "identificacion": "1756908876", "fechaNacimiento": "2000-12-03", "parentesco": "CONYUGE"}, {"clave": "1734659067", "nombres": "JOSE", "apellidos": "JARRIN", "identificacion": "1734659067", "fechaNacimiento": "1989-03-23", "parentesco": "HERMANO"}], "revisar": true, "revisarMotivo": "celular incompleto (8 digitos: 99767894); cedula no pasa el digito verificador (1767458909)"}, {"nombres": "DANIEL", "apellidos": "SALAS", "identificacion": "1789556671", "genero": "MASCULINO", "fechaNacimiento": "1990-04-23", "ciudad": "QUITO", "direccion": "SUCRE N11 10 Y RIOS", "email": "pcv@hotmail.com", "celular": "96785890", "telefono": null, "ejecutivoNombre": "GIANELLA POZO", "polizas": [{"numeroContrato": "MU6679A", "estado": "RENOVADO", "aseguradora": "ATLANTIDA", "plan": "AUTO", "deducible": null, "formaPago": "DIFERIDO_ESPECIAL", "fechaEmision": "2026-03-23", "primaNeta": 456.0, "agenteNombre": "ELIZABETH TORRES", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [], "revisar": true, "revisarMotivo": "celular incompleto (8 digitos: 96785890); cedula no pasa el digito verificador (1789556671)"}, {"nombres": "ANDREA", "apellidos": "RODRIGUEZ", "identificacion": "1745889034", "genero": "FEMENINO", "fechaNacimiento": "1996-05-01", "ciudad": "QUITO", "direccion": "LUIS FELIPE N56 45", "email": "pca@hotmail.com", "celular": "99567489", "telefono": null, "ejecutivoNombre": "STEPHANY SOSA", "polizas": [{"numeroContrato": "PRA76596", "estado": "NUEVO", "aseguradora": "ZURICH", "plan": "AUTO", "deducible": null, "formaPago": "DIFERIDO_ESPECIAL", "fechaEmision": "2026-05-23", "primaNeta": 1922.0, "agenteNombre": "ROXANA AVILES", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [], "revisar": true, "revisarMotivo": "celular incompleto (8 digitos: 99567489); cedula no pasa el digito verificador (1745889034)"}, {"nombres": "DAVID", "apellidos": "HIDALGO", "identificacion": "17223345673", "genero": "MASCULINO", "fechaNacimiento": "2000-07-04", "ciudad": "AMBATO", "direccion": "PADRE GENARO N8 45", "email": "poco@gmail.com", "celular": "99890098", "telefono": null, "ejecutivoNombre": "ERIKA DIAZ", "polizas": [{"numeroContrato": "23456", "estado": "RENOVADO", "aseguradora": "AIG", "plan": "HOGAR", "deducible": null, "formaPago": "MENSUAL", "fechaEmision": "2023-01-23", "primaNeta": 733.0, "agenteNombre": "ALEXANDRA", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [], "revisar": true, "revisarMotivo": "celular incompleto (8 digitos: 99890098); cedula no pasa el digito verificador (17223345673)"}, {"nombres": "ANDRES", "apellidos": "LALAMA", "identificacion": "1734568911", "genero": "MASCULINO", "fechaNacimiento": "2001-02-12", "ciudad": "QUITO", "direccion": "LIS FELIPE Y ENGENDRO", "email": "jua@gmail.com", "celular": "0996097654", "telefono": null, "ejecutivoNombre": "YESSICA OJEDA", "polizas": [{"numeroContrato": "345678", "estado": "CARTA_DE_NOMBRAMIENTO", "aseguradora": null, "plan": "AUTO", "deducible": null, "formaPago": "MENSUAL", "fechaEmision": "2023-05-05", "primaNeta": 567.0, "agenteNombre": "PABLO CARRILLO", "cubre": [], "revisar": true, "revisarMotivo": "sin compania de seguros"}], "dependientes": [], "revisar": true, "revisarMotivo": "cedula no pasa el digito verificador (1734568911)"}]}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()

const fecha = (v: string | null) => (v ? new Date(v) : null)

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name)

  constructor(private readonly prisma: PrismaService) {}

  async cargarOperaciones(password: string) {
    const log: string[] = []
    const cap = (m: string) => {
      log.push(m)
      this.logger.log(m)
    }

    const orgSlug = process.env.ORGANIZATION_SLUG ?? 'acme-corp'
    const org = await this.prisma.organization.findFirst({ where: { slug: orgSlug } })
    if (!org) {
      return { ok: false, error: `No existe la organización "${orgSlug}"`, log }
    }

    // 1) Usuarios
    const hash = await bcrypt.hash(password, 12)
    const usuariosCreados: { id: string; name: string; email: string }[] = []
    for (const u of DATOS.usuarios) {
      const existente = await this.prisma.user.findUnique({ where: { email: u.email } })
      if (existente) {
        const upd = await this.prisma.user.update({
          where: { id: existente.id },
          data: { name: u.name, phone: u.phone, role: u.role as UserRole },
        })
        usuariosCreados.push(upd)
        cap(`= ${u.email} ya existía (rol actualizado)`)
      } else {
        const nuevo = await this.prisma.user.create({
          data: {
            name: u.name,
            email: u.email,
            password: hash,
            phone: u.phone,
            role: u.role as UserRole,
            organizationId: org.id,
          },
        })
        usuariosCreados.push(nuevo)
        cap(`+ ${u.email} creado como ${u.role}`)
      }
    }

    // 2) Índice apellido/nombre -> userId
    const porNombre = new Map<string, string>()
    for (const u of usuariosCreados) {
      for (const parte of norm(u.name).split(/\s+/)) {
        if (parte.length > 2 && !porNombre.has(parte)) porNombre.set(parte, u.id)
      }
    }
    const resolverEjecutivo = (nombre: string | null): string | null => {
      if (!nombre) return null
      for (const parte of norm(nombre).split(/\s+/)) {
        const id = porNombre.get(parte)
        if (id) return id
      }
      return null
    }

    // 3) Clientes, pólizas y dependientes
    let nuevos = 0
    let yaExistian = 0
    const sinEjecutivo: string[] = []

    for (const c of DATOS.clientes) {
      const ejecutivoId = resolverEjecutivo(c.ejecutivoNombre)
      if (c.ejecutivoNombre && !ejecutivoId) {
        sinEjecutivo.push(`${c.nombres} ${c.apellidos} (${c.ejecutivoNombre})`)
      }

      const existente = await this.prisma.cliente.findUnique({
        where: {
          organizationId_identificacion: {
            organizationId: org.id,
            identificacion: c.identificacion,
          },
        },
      })
      if (existente) {
        yaExistian++
        continue
      }

      const cliente = await this.prisma.cliente.create({
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
            create: c.dependientes.map((d: any) => ({
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

      const idPorClave = new Map<string, string>()
      c.dependientes.forEach((d: any, i: number) => {
        const creado = cliente.dependientes[i]
        if (creado) idPorClave.set(d.clave, creado.id)
      })

      for (const p of c.polizas) {
        await this.prisma.poliza.create({
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
                .map((clave: string) => idPorClave.get(clave))
                .filter((id: string | undefined): id is string => Boolean(id))
                .map((dependienteId: string) => ({ dependienteId })),
            },
          },
        })
      }
      nuevos++
    }

    const marcados = await this.prisma.cliente.count({
      where: { organizationId: org.id, revisar: true },
    })

    cap('─────────────────────────────')
    cap(`Usuarios procesados: ${usuariosCreados.length}`)
    cap(`Clientes nuevos: ${nuevos}`)
    cap(`Clientes ya existentes: ${yaExistian}`)
    cap(`Marcados para revisar: ${marcados}`)
    if (sinEjecutivo.length) {
      cap(`Sin ejecutivo asignado: ${sinEjecutivo.join(', ')}`)
    }

    return {
      ok: true,
      usuarios: usuariosCreados.length,
      clientesNuevos: nuevos,
      clientesExistentes: yaExistian,
      marcadosRevisar: marcados,
      sinEjecutivo,
      log,
    }
  }
}
