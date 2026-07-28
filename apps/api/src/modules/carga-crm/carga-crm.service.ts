import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// Carga TEMPORAL de la base real de Priority (4 ramos: salud, auto, vida, hogar).
// Es ADITIVA e idempotente:
//   - Si el cliente ya existe (misma identificacion) actualiza los campos nuevos
//     y le agrega solo las polizas/dependientes que le falten.
//   - Nunca duplica: las polizas se comparan por (tipo + numero de contrato),
//     y los dependientes por cedula o por nombre completo.
const DATOS: { clientes: any[] } = {"clientes": [{"identificacion": "1793056326001", "nombres": "SEGUROS", "apellidos": "IDEAL", "nombrePreferido": "PRIORITY", "referidoDe": "NO APLICA", "contactoSugerido": "PABLO CARRILLO", "celular": "0996097767", "telefono": null, "genero": null, "fechaNacimiento": "1972-05-05", "ciudad": "QUITO", "direccion": "LEONOR ROSALES N44 10 Y CAMILO EGAS", "email": "pcarrillo@priority.ec", "ejecutivoNombre": "GIANELLA POZO", "polizas": [{"tipo": "AUTO", "numeroContrato": "580203", "estado": "RENOVADO", "aseguradora": "ATLANTIDA", "plan": "AUTO", "deducible": "300", "formaPago": null, "fechaEmision": "2026-06-05", "primaNeta": 580.65, "sumaAsegurada": 24500.0, "marca": "NISSAN", "modelo": "XTRAIL", "anio": 2022, "placa": "PDS2345", "tiempoCobertura": null, "observacion": null, "agenteNombre": "PABLO CARRILLO", "cubre": [], "revisar": false, "revisarMotivo": null}, {"tipo": "AUTO", "numeroContrato": "580203", "estado": "RENOVADO", "aseguradora": "ATLANTIDA", "plan": "AUTO", "deducible": "300", "formaPago": null, "fechaEmision": "2026-06-05", "primaNeta": 825.0, "sumaAsegurada": 33000.0, "marca": "MAZDA", "modelo": "CX5", "anio": 2024, "placa": "PFL2785", "tiempoCobertura": null, "observacion": null, "agenteNombre": "PABLO CARRILLO", "cubre": [], "revisar": false, "revisarMotivo": null}, {"tipo": "AUTO", "numeroContrato": "580203", "estado": "RENOVADO", "aseguradora": "ATLANTIDA", "plan": "MOTO", "deducible": "350", "formaPago": null, "fechaEmision": "2026-06-05", "primaNeta": 170.1, "sumaAsegurada": 2700.0, "marca": "ZUZUKI", "modelo": "GN125", "anio": 2020, "placa": "IW266Q", "tiempoCobertura": null, "observacion": null, "agenteNombre": "PABLO CARRILLO", "cubre": [], "revisar": false, "revisarMotivo": null}, {"tipo": "HOGAR", "numeroContrato": "504695", "estado": "RENOVADO", "aseguradora": "ATLANTIDA", "plan": "HOGAR", "deducible": null, "formaPago": null, "fechaEmision": "2026-06-17", "primaNeta": 100.0, "sumaAsegurada": 15340.0, "marca": null, "modelo": null, "anio": null, "placa": null, "tiempoCobertura": null, "observacion": null, "agenteNombre": "ROXANA AVILES", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [], "revisar": false, "revisarMotivo": null}, {"identificacion": "1716093495", "nombres": "FRANCISCO XAVIER", "apellidos": "GONZALEZ MIÑO", "nombrePreferido": "FRANCISCO", "referidoDe": "ESTEFANIA AGUINAGA", "contactoSugerido": "ASEGURADO", "celular": "0982000192", "telefono": null, "genero": "MASCULINO", "fechaNacimiento": "1987-09-05", "ciudad": "QUITO", "direccion": "LUIS PAEZ E10 78 Y CARLOS ANDRADE", "email": "panchogonz@hotmail.com", "ejecutivoNombre": "GIANELLA POZO", "polizas": [{"tipo": "AUTO", "numeroContrato": "94323847", "estado": "RENOVADO", "aseguradora": "ATLANTIDA", "plan": "AUTO", "deducible": "300", "formaPago": null, "fechaEmision": "2026-06-02", "primaNeta": 530.55, "sumaAsegurada": 22000.0, "marca": "KIA", "modelo": "SELTOS", "anio": 2020, "placa": "PDP5892", "tiempoCobertura": null, "observacion": "COPIAR CORREO A ESPOSA esthefyaguinagaramos@gmail.com", "agenteNombre": "ROXANA AVILES", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [], "revisar": false, "revisarMotivo": null}, {"identificacion": "0501155048", "nombres": "LUIS ESTUARDO", "apellidos": "BERRAZUETA MEDINA", "nombrePreferido": "LUIS", "referidoDe": "GIANELLA POZO", "contactoSugerido": "CARMEN MENA ESPOSA", "celular": "0987502652", "telefono": null, "genero": "MASCULINO", "fechaNacimiento": "1933-02-05", "ciudad": "QUITO", "direccion": "RAFAEL RAMOS Y ANDRADE MARIN", "email": "pamen2009@life.com", "ejecutivoNombre": "GIANELLA POZO", "polizas": [{"tipo": "AUTO", "numeroContrato": "487323", "estado": "NUEVO", "aseguradora": "SWEDENT", "plan": "AUTO", "deducible": "250", "formaPago": null, "fechaEmision": "2026-05-13", "primaNeta": 380.0, "sumaAsegurada": 10000.0, "marca": "RENAULT", "modelo": "SANDERO", "anio": 2015, "placa": "PBE8375", "tiempoCobertura": null, "observacion": "CONTACTO SOLO CON LA ESPOSA", "agenteNombre": "ROXANA AVILES", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [], "revisar": false, "revisarMotivo": null}, {"identificacion": "1712055118", "nombres": "PABLO ALEJANDRO", "apellidos": "CARRILLO BEJARANO", "nombrePreferido": "PABLO", "referidoDe": null, "contactoSugerido": "NINGUNO", "celular": "0996097767", "telefono": null, "genero": "MASCULINO", "fechaNacimiento": "1972-05-05", "ciudad": "QUITO", "direccion": "LEONOR ROSALES N44 10 Y CAMILO EGAS", "email": "pcarrillo@priority.ec", "ejecutivoNombre": "GIANELLA POZO", "polizas": [{"tipo": "HOGAR", "numeroContrato": "516245", "estado": "RENOVADO", "aseguradora": "ATLANTIDA", "plan": "HOGAR", "deducible": null, "formaPago": null, "fechaEmision": "2026-06-02", "primaNeta": 367.0, "sumaAsegurada": 220000.0, "marca": null, "modelo": null, "anio": null, "placa": null, "tiempoCobertura": null, "observacion": null, "agenteNombre": "ROXANA AVILES", "cubre": [], "revisar": false, "revisarMotivo": null}, {"tipo": "SALUD", "numeroContrato": "266700462", "estado": "RENOVADO", "aseguradora": "BMI", "plan": "GMM", "deducible": "10000", "formaPago": "CONTADO", "fechaEmision": "2007-08-01", "primaNeta": 1177.2, "sumaAsegurada": null, "marca": null, "modelo": null, "anio": null, "placa": null, "tiempoCobertura": null, "observacion": null, "agenteNombre": "ROXANA AVILES", "cubre": ["1714356381", "1723456745", "1723456756", "1723226756"], "revisar": false, "revisarMotivo": null}], "dependientes": [{"clave": "1714356381", "nombres": "ROXANA", "apellidos": "AVILES", "identificacion": "1714356381", "fechaNacimiento": "1977-10-10", "parentesco": "CONYUGE"}, {"clave": "1723456745", "nombres": "MATHIAS", "apellidos": "CARRRILLO", "identificacion": "1723456745", "fechaNacimiento": "2002-08-19", "parentesco": "HIJO"}, {"clave": "1723456756", "nombres": "CAMILA", "apellidos": "CARRRILLO", "identificacion": "1723456756", "fechaNacimiento": "2006-12-18", "parentesco": "HIJO"}, {"clave": "1723226756", "nombres": "PABLO", "apellidos": "CARRRILLO", "identificacion": "1723226756", "fechaNacimiento": "2006-12-18", "parentesco": "HIJO"}], "revisar": false, "revisarMotivo": null}, {"identificacion": "1708477722", "nombres": "LUCIA PAULINA", "apellidos": "BARRERA CADENA", "nombrePreferido": "PAULINA", "referidoDe": "ANDY GUERRA", "contactoSugerido": "ANDY GUERRA", "celular": "0993610175", "telefono": null, "genero": "FEMENINO", "fechaNacimiento": "1970-02-28", "ciudad": "QUITO", "direccion": "JORGE ADOUM Y RIOJA CONJUNTO VILLA ORELLANA CASA 11", "email": "pbarrera@groupdmc.com", "ejecutivoNombre": "CAROLINA TERNEUS", "polizas": [{"tipo": "SALUD", "numeroContrato": "AI15Q00904", "estado": "RENOVADO", "aseguradora": "BMI", "plan": "IDEAL", "deducible": "10000", "formaPago": null, "fechaEmision": "2025-04-16", "primaNeta": 6984.05, "sumaAsegurada": null, "marca": null, "modelo": null, "anio": null, "placa": null, "tiempoCobertura": null, "observacion": null, "agenteNombre": "ROXANA AVILES", "cubre": ["1567845677", "1345768945"], "revisar": false, "revisarMotivo": null}], "dependientes": [{"clave": "1567845677", "nombres": "ANDY", "apellidos": "GUERRA", "identificacion": "1567845677", "fechaNacimiento": "1974-03-23", "parentesco": "CONYUGE"}, {"clave": "1345768945", "nombres": "ANDRES", "apellidos": "GUERRA", "identificacion": "1345768945", "fechaNacimiento": "2006-03-06", "parentesco": "HIJO"}], "revisar": false, "revisarMotivo": null}, {"identificacion": "1721234274", "nombres": "ANDRES EDUARDO", "apellidos": "GUERRA BARRERA", "nombrePreferido": "ANDRES", "referidoDe": null, "contactoSugerido": "ANDY GUERRA", "celular": "99001411", "telefono": null, "genero": "MASCULINO", "fechaNacimiento": "2003-03-06", "ciudad": "QUITO", "direccion": "JORGE ADOUM Y RIOJA CONJUNTO VILLA ORELLANA CASA 11", "email": "andres@guerraworks.com", "ejecutivoNombre": "CAROLINA TERNEUS", "polizas": [{"tipo": "SALUD", "numeroContrato": "IV25Q01961", "estado": "RENOVADO", "aseguradora": "BMI", "plan": "INNOVA", "deducible": "250", "formaPago": null, "fechaEmision": "2025-04-16", "primaNeta": 1257.96, "sumaAsegurada": null, "marca": null, "modelo": null, "anio": null, "placa": null, "tiempoCobertura": null, "observacion": null, "agenteNombre": "PABLO CARRILLO", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [], "revisar": true, "revisarMotivo": "celular incompleto (8 digitos)"}, {"identificacion": "1720460805", "nombres": "ANDY EDUBEL", "apellidos": "GUERRA ZULOAGA", "nombrePreferido": "ANDY", "referidoDe": null, "contactoSugerido": "ANDY GUERRA", "celular": "99001411", "telefono": null, "genero": "MASCULINO", "fechaNacimiento": "1974-03-23", "ciudad": "QUITO", "direccion": "JORGE ADOUM Y RIOJA CONJUNTO VILLA ORELLANA CASA 11", "email": "pbarrera@groupdmc.com", "ejecutivoNombre": "CAROLINA TERNEUS", "polizas": [{"tipo": "SALUD", "numeroContrato": "IV25Q01969", "estado": "RENOVADO", "aseguradora": "BMI", "plan": "INNOVA", "deducible": "250", "formaPago": null, "fechaEmision": "2025-04-16", "primaNeta": 6204.36, "sumaAsegurada": null, "marca": null, "modelo": null, "anio": null, "placa": null, "tiempoCobertura": null, "observacion": null, "agenteNombre": "PABLO CARRILLO", "cubre": ["1708477722"], "revisar": false, "revisarMotivo": null}], "dependientes": [{"clave": "1708477722", "nombres": "LUCIA", "apellidos": "BARRERA", "identificacion": "1708477722", "fechaNacimiento": "1970-02-28", "parentesco": "CONYUGE"}], "revisar": true, "revisarMotivo": "celular incompleto (8 digitos)"}, {"identificacion": "1710686799", "nombres": "MARIA GABRIELA", "apellidos": "GONZALEZ JACOME", "nombrePreferido": "GABRIELA", "referidoDe": null, "contactoSugerido": "ASEGURADO", "celular": "0998546426", "telefono": null, "genero": "FEMENINO", "fechaNacimiento": "1981-10-29", "ciudad": "GUAYAQUIL", "direccion": "DE LAS ORQUIDEAS E4-139 Y LOS PINOS", "email": "mgabrielagj@gmail.com", "ejecutivoNombre": "YESSICA OJEDA", "polizas": [{"tipo": "SALUD", "numeroContrato": "133853", "estado": "NUEVO", "aseguradora": "HUMANA", "plan": "METROHUMANA 50", "deducible": "100", "formaPago": null, "fechaEmision": "2026-03-03", "primaNeta": 1134.0, "sumaAsegurada": null, "marca": null, "modelo": null, "anio": null, "placa": null, "tiempoCobertura": null, "observacion": null, "agenteNombre": "JUAN FERNANDO SEGOVIA", "cubre": ["1745679078"], "revisar": false, "revisarMotivo": null}, {"tipo": "SALUD", "numeroContrato": "GM24Q47934", "estado": "NUEVO", "aseguradora": "BMI", "plan": "GMM", "deducible": "5000", "formaPago": "DIFERIDO_ESPECIAL", "fechaEmision": "2024-08-05", "primaNeta": 2312.85, "sumaAsegurada": null, "marca": null, "modelo": null, "anio": null, "placa": null, "tiempoCobertura": null, "observacion": null, "agenteNombre": "ROXANA AVILES", "cubre": ["1707771950", "1758083578", "1706518865"], "revisar": false, "revisarMotivo": null}], "dependientes": [{"clave": "1745679078", "nombres": "PEDRO", "apellidos": "GONZALEZ", "identificacion": "1745679078", "fechaNacimiento": "2023-01-01", "parentesco": "HIJO"}, {"clave": "1707771950", "nombres": "CESAR ALEXIS", "apellidos": "GUDIÑO VILLACRES", "identificacion": "1707771950", "fechaNacimiento": "1974-02-23", "parentesco": "CUNADO"}, {"clave": "1758083578", "nombres": "SOPHIA CAMILA", "apellidos": "EVANS GONZALEZ", "identificacion": "1758083578", "fechaNacimiento": "2017-05-06", "parentesco": "HIJA"}, {"clave": "1706518865", "nombres": "MARIA VERONICA", "apellidos": "GONZALEZ JACOME", "identificacion": "1706518865", "fechaNacimiento": "1974-02-28", "parentesco": "HERMANA"}], "revisar": false, "revisarMotivo": null}, {"identificacion": "1707330237", "nombres": "EDGAR SANTIAGO", "apellidos": "VILLAMARIN CORTES", "nombrePreferido": "EDGAR", "referidoDe": null, "contactoSugerido": "ASEGURADO", "celular": "0993523544", "telefono": null, "genero": "MASCULINO", "fechaNacimiento": "1977-01-08", "ciudad": "QUITO", "direccion": "SAN JUAN GUATEMALA SN JOSE MARIA BORJA", "email": "sanbid@gmail.com", "ejecutivoNombre": "STEPHANY SOSA", "polizas": [{"tipo": "VIDA", "numeroContrato": "MT25Q07412", "estado": "RENOVADO", "aseguradora": "BMI", "plan": "TERM 95", "deducible": null, "formaPago": "CONTADO", "fechaEmision": "2025-11-01", "primaNeta": 3123.0, "sumaAsegurada": 250000.0, "marca": null, "modelo": null, "anio": null, "placa": null, "tiempoCobertura": "30 AÑOS", "observacion": null, "agenteNombre": "ROXANA AVILES", "cubre": [], "revisar": false, "revisarMotivo": null}], "dependientes": [], "revisar": false, "revisarMotivo": null}]}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()

const fecha = (v: string | null) => (v ? new Date(v) : null)

// Clave para reconocer una poliza ya cargada
const clavePoliza = (p: { tipo: string; numeroContrato?: string | null; aseguradora?: string | null; plan?: string | null }) =>
  p.numeroContrato
    ? `${p.tipo}|${norm(p.numeroContrato)}`
    : `${p.tipo}|${norm(p.aseguradora ?? '')}|${norm(p.plan ?? '')}`

const claveDependiente = (d: { identificacion?: string | null; nombres: string; apellidos?: string | null }) =>
  d.identificacion ? `C|${d.identificacion}` : `N|${norm(d.nombres)}|${norm(d.apellidos ?? '')}`

@Injectable()
export class CargaCrmService {
  private readonly logger = new Logger(CargaCrmService.name)

  constructor(private readonly prisma: PrismaService) {}

  async cargar(organizationId: string, simular: boolean) {
    const log: string[] = []
    const cap = (m: string) => {
      log.push(m)
      this.logger.log(m)
    }

    // Resolver ejecutivas por nombre -> usuario
    const usuarios = await this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    })
    const porNombre = new Map<string, string>()
    for (const u of usuarios) {
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

    let clientesNuevos = 0
    let clientesActualizados = 0
    let polizasNuevas = 0
    let polizasExistentes = 0
    let dependientesNuevos = 0
    const sinEjecutivo: string[] = []

    for (const c of DATOS.clientes) {
      const ejecutivoId = resolverEjecutivo(c.ejecutivoNombre)
      if (c.ejecutivoNombre && !ejecutivoId) {
        sinEjecutivo.push(`${c.nombres} (${c.ejecutivoNombre})`)
      }

      const existente = await this.prisma.cliente.findUnique({
        where: {
          organizationId_identificacion: { organizationId, identificacion: c.identificacion },
        },
        include: { polizas: true, dependientes: true },
      })

      if (simular) {
        if (existente) {
          const yaTiene = new Set(existente.polizas.map((p: any) => clavePoliza(p)))
          const faltan = c.polizas.filter((p: any) => !yaTiene.has(clavePoliza(p))).length
          cap(`= ${c.identificacion} ${c.nombres}: ya existe, se agregarian ${faltan} poliza(s)`)
          clientesActualizados++
          polizasNuevas += faltan
          polizasExistentes += c.polizas.length - faltan
        } else {
          cap(`+ ${c.identificacion} ${c.nombres}: nuevo, ${c.polizas.length} poliza(s), ${c.dependientes.length} dependiente(s)`)
          clientesNuevos++
          polizasNuevas += c.polizas.length
          dependientesNuevos += c.dependientes.length
        }
        continue
      }

      // ── Cliente ──
      let clienteId: string
      let depsExistentes: any[] = []
      if (existente) {
        clienteId = existente.id
        depsExistentes = existente.dependientes
        await this.prisma.cliente.update({
          where: { id: existente.id },
          data: {
            nombrePreferido: c.nombrePreferido ?? existente.nombrePreferido,
            referidoDe: c.referidoDe ?? existente.referidoDe,
            contactoSugerido: c.contactoSugerido ?? existente.contactoSugerido,
            celular: existente.celular ?? c.celular,
            email: existente.email ?? c.email,
            ciudad: existente.ciudad ?? c.ciudad,
            direccion: existente.direccion ?? c.direccion,
            fechaNacimiento: existente.fechaNacimiento ?? fecha(c.fechaNacimiento),
            genero: existente.genero ?? c.genero,
            ejecutivoId: existente.ejecutivoId ?? ejecutivoId,
            ejecutivoNombre: existente.ejecutivoNombre ?? c.ejecutivoNombre,
          },
        })
        clientesActualizados++
        cap(`= ${c.identificacion} ${c.nombres}: actualizado`)
      } else {
        const creado = await this.prisma.cliente.create({
          data: {
            nombres: c.nombres,
            apellidos: c.apellidos ?? '',
            identificacion: c.identificacion,
            nombrePreferido: c.nombrePreferido,
            referidoDe: c.referidoDe,
            contactoSugerido: c.contactoSugerido,
            genero: c.genero,
            fechaNacimiento: fecha(c.fechaNacimiento),
            ciudad: c.ciudad,
            direccion: c.direccion,
            email: c.email,
            celular: c.celular,
            telefono: c.telefono,
            revisar: c.revisar,
            revisarMotivo: c.revisarMotivo,
            organizationId,
            ejecutivoId,
            ejecutivoNombre: c.ejecutivoNombre,
          } as any,
        })
        clienteId = creado.id
        clientesNuevos++
        cap(`+ ${c.identificacion} ${c.nombres}: creado`)
      }

      // ── Dependientes (se agregan los que falten) ──
      const yaDeps = new Map<string, string>()
      for (const d of depsExistentes) yaDeps.set(claveDependiente(d), d.id)

      for (const d of c.dependientes) {
        const k = claveDependiente(d)
        if (yaDeps.has(k)) continue
        const nuevo = await this.prisma.dependiente.create({
          data: {
            nombres: d.nombres,
            apellidos: d.apellidos,
            identificacion: d.identificacion,
            fechaNacimiento: fecha(d.fechaNacimiento),
            parentesco: d.parentesco,
            clienteId,
          } as any,
        })
        yaDeps.set(k, nuevo.id)
        dependientesNuevos++
      }
      // mapa clave-del-json -> id real
      const idPorClaveJson = new Map<string, string>()
      for (const d of c.dependientes) {
        const id = yaDeps.get(claveDependiente(d))
        if (id) idPorClaveJson.set(d.clave, id)
      }

      // ── Polizas (solo las que falten) ──
      const yaPolizas = new Set(
        (existente?.polizas ?? []).map((p: any) => clavePoliza(p)),
      )
      for (const p of c.polizas) {
        if (yaPolizas.has(clavePoliza(p))) {
          polizasExistentes++
          continue
        }
        await this.prisma.poliza.create({
          data: {
            tipo: p.tipo,
            numeroContrato: p.numeroContrato,
            estado: p.estado,
            aseguradora: p.aseguradora,
            plan: p.plan,
            deducible: p.deducible,
            formaPago: p.formaPago,
            fechaEmision: fecha(p.fechaEmision),
            primaNeta: p.primaNeta,
            sumaAsegurada: p.sumaAsegurada,
            marca: p.marca,
            modelo: p.modelo,
            anio: p.anio,
            placa: p.placa,
            tiempoCobertura: p.tiempoCobertura,
            observacion: p.observacion,
            agenteNombre: p.agenteNombre,
            revisar: p.revisar,
            revisarMotivo: p.revisarMotivo,
            clienteId,
            organizationId,
            dependientes: {
              create: (p.cubre ?? [])
                .map((clave: string) => idPorClaveJson.get(clave))
                .filter((id: string | undefined): id is string => Boolean(id))
                .map((dependienteId: string) => ({ dependienteId })),
            },
          } as any,
        })
        polizasNuevas++
      }
    }

    const totalClientes = await this.prisma.cliente.count({ where: { organizationId } })
    const totalPolizas = await this.prisma.poliza.count({ where: { organizationId } })

    return {
      ok: true,
      modo: simular ? 'SIMULACION — no se escribio nada' : 'EJECUTADO',
      clientesNuevos,
      clientesActualizados,
      polizasNuevas,
      polizasExistentes,
      dependientesNuevos,
      sinEjecutivo,
      totalEnBase: simular ? undefined : { clientes: totalClientes, polizas: totalPolizas },
      log,
    }
  }

  // Identificaciones de la base real entregada por Priority. Todo cliente que
  // NO este en esta lista es de la carga de prueba inicial (cedulas inventadas)
  // y se elimina. Al borrar el cliente, sus polizas y dependientes se van en
  // cascada (definido en el esquema).
  private readonly IDENTIFICACIONES_REALES: string[] = ["0501155048", "1707330237", "1708477722", "1710686799", "1712055118", "1716093495", "1720460805", "1721234274", "1793056326001"]

  async limpiarPrueba(organizationId: string, simular: boolean) {
    const aBorrar = await this.prisma.cliente.findMany({
      where: {
        organizationId,
        identificacion: { notIn: this.IDENTIFICACIONES_REALES },
      },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        identificacion: true,
        _count: { select: { polizas: true, dependientes: true } },
      },
    })

    const detalle = aBorrar.map(
      (c) =>
        `${c.identificacion} ${c.nombres} ${c.apellidos} (${c._count.polizas} poliza(s), ${c._count.dependientes} dependiente(s))`,
    )

    if (simular) {
      const conservados = await this.prisma.cliente.count({
        where: { organizationId, identificacion: { in: this.IDENTIFICACIONES_REALES } },
      })
      return {
        ok: true,
        modo: 'SIMULACION — no se borro nada',
        seEliminarian: aBorrar.length,
        detalle,
        seConservan: conservados,
        siguientePaso: 'Repetir agregando &confirm=si-borrar para ejecutar',
      }
    }

    const ids = aBorrar.map((c) => c.id)
    await this.prisma.cliente.deleteMany({ where: { id: { in: ids } } })

    const quedan = await this.prisma.cliente.count({ where: { organizationId } })
    this.logger.log(`Limpieza de prueba: ${ids.length} clientes eliminados, quedan ${quedan}`)

    return {
      ok: true,
      modo: 'EJECUTADO',
      eliminados: aBorrar.length,
      detalle,
      clientesQueQuedan: quedan,
    }
  }
}
