import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface DocumentoKb {
  /** Nombre del archivo, es lo que el bot debe citar. */
  archivo: string
  aseguradora: string
  contenido: string
  /** Aproximacion de tokens, solo para vigilar el tamano del prompt. */
  tokens: number
}

/**
 * Carga los documentos de coberturas desde disco una sola vez al arrancar.
 *
 * Los .md viven versionados en el repo (kb/). No hay tabla en Prisma ni
 * pantalla de carga a proposito: hoy Josue es el unico que actualiza el
 * material, asi que un commit es mas simple y deja historial.
 */
@Injectable()
export class KbLoader implements OnModuleInit {
  private readonly logger = new Logger(KbLoader.name)
  private documentos: DocumentoKb[] = []

  onModuleInit() {
    this.cargar()
  }

  private rutaKb(): string {
    // En dev corre desde src/, en produccion desde dist/. Los .md se copian
    // a dist en el build (ver "assets" en nest-cli.json).
    const candidatas = [
      join(__dirname, 'kb'),
      join(process.cwd(), 'apps/api/src/modules/priority-help/kb'),
      join(process.cwd(), 'src/modules/priority-help/kb'),
    ]
    return candidatas.find((p) => existsSync(p)) ?? candidatas[0]
  }

  private cargar() {
    const dir = this.rutaKb()
    if (!existsSync(dir)) {
      this.logger.error(`No se encontro la carpeta de documentos: ${dir}`)
      return
    }

    const archivos = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()

    this.documentos = archivos.map((archivo) => {
      const contenido = readFileSync(join(dir, archivo), 'utf8')
      return {
        archivo,
        aseguradora: archivo.split('-')[0],
        contenido,
        tokens: Math.ceil(contenido.length / 3.5),
      }
    })

    const total = this.documentos.reduce((a, d) => a + d.tokens, 0)
    this.logger.log(
      `Documentos cargados: ${this.documentos.length} (~${total} tokens)`,
    )
  }

  todos(): DocumentoKb[] {
    return this.documentos
  }

  /** Lista corta para que el bot sepa que existe antes de elegir. */
  indice(): string {
    const porAseguradora = new Map<string, string[]>()
    for (const d of this.documentos) {
      const lista = porAseguradora.get(d.aseguradora) ?? []
      lista.push(d.archivo)
      porAseguradora.set(d.aseguradora, lista)
    }
    return [...porAseguradora.entries()]
      .map(([aseg, archivos]) => `${aseg}:\n  ${archivos.join('\n  ')}`)
      .join('\n')
  }

  /**
   * Selecciona los documentos relevantes por palabras clave.
   *
   * Es busqueda por coincidencia de terminos, no embeddings. Con 28
   * documentos alcanza y evita montar infraestructura de vectores. Si el
   * material crece bastante, aca es donde habria que cambiar a RAG.
   */
  /**
   * Detecta a que aseguradoras apunta la pregunta.
   *
   * Si el asesor nombra un plan ("sigma", "sky 70", "confiplus"), no tiene
   * sentido mirar documentos de las otras aseguradoras: solo encarecen la
   * consulta y meten ruido en el ranking.
   */
  private aseguradorasDe(consulta: string): Set<string> {
    const t = normalizar(consulta)
    const encontradas = new Set<string>()
    for (const [termino, aseguradora] of Object.entries(PLANES)) {
      if (new RegExp(`(?<![a-z0-9])${termino}(?![a-z0-9])`).test(t)) {
        encontradas.add(aseguradora)
      }
    }
    return encontradas
  }

  buscar(consulta: string, limite = 6): DocumentoKb[] {
    // Ojo con el umbral de longitud: terminos cortos como "sky", "red",
    // "30k", "15" o "ph" son justamente los que identifican un plan.
    // Filtrarlos por largo hacia que "confiplus 30k red 2" no encontrara
    // su propio documento.
    const terminos = normalizar(consulta)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2 && !VACIAS.has(t))

    if (!terminos.length) return this.muestraVariada(limite)

    // Acotar por aseguradora cuando la pregunta nombra un plan. Los
    // documentos transversales (objeciones, preguntas frecuentes) siempre
    // quedan disponibles: aplican a cualquier aseguradora.
    const asegs = this.aseguradorasDe(consulta)
    const universo = asegs.size
      ? this.documentos.filter(
          (d) =>
            asegs.has(d.aseguradora) ||
            d.archivo.startsWith('objeciones') ||
            d.archivo.startsWith('preguntas'),
        )
      : this.documentos

    const puntuados = universo.map((doc) => {
      const nombre = normalizar(doc.archivo)
      const cuerpo = normalizar(doc.contenido)
      let puntos = 0
      for (const t of terminos) {
        // Coincidir en el nombre del archivo pesa mucho mas: si el asesor
        // dice "sigma", el documento de Sigma es el que importa.
        if (nombre.includes(t)) puntos += 25

        // En el cuerpo se cuenta PALABRA COMPLETA, no fragmento. Buscar
        // "me" como substring daba 70 aciertos dentro de "medicina" y
        // "mensual", lo que inflaba los documentos largos y hundia los
        // cortos (el argumentario de objeciones se perdia por esto).
        const veces = (cuerpo.match(bordes(t)) ?? []).length
        puntos += Math.min(veces, 8)
      }
      return { doc, puntos }
    })

    const ordenados = puntuados
      .filter((p) => p.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos)

    if (!ordenados.length) return this.muestraVariada(3)

    // Corte por relevancia RELATIVA al mejor resultado, en vez de mandar
    // siempre `limite` documentos.
    //
    // Antes se rellenaba hasta 6 aunque solo uno viniera al caso: en
    // "que cubre sky 70 en maternidad" se mandaban 13.400 tokens cuando el
    // documento util pesaba 1.500. Ese relleno se pagaba en cada consulta y
    // ademas metia ruido.
    const mejor = ordenados[0].puntos
    return ordenados
      .filter((p) => p.puntos >= mejor * UMBRAL_RELEVANCIA)
      .slice(0, limite)
      .map((p) => p.doc)
  }

  /** Un documento por aseguradora, para preguntas generales. */
  private muestraVariada(limite: number): DocumentoKb[] {
    const vistas = new Set<string>()
    const salida: DocumentoKb[] = []
    for (const d of this.documentos) {
      if (vistas.has(d.aseguradora)) continue
      vistas.add(d.aseguradora)
      salida.push(d)
      if (salida.length >= limite) break
    }
    return salida
  }
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Un documento entra solo si puntua al menos este porcentaje del mejor.
 * Mas alto = mas barato pero mas riesgo de dejar fuera algo util; mas bajo
 * = mas seguro pero mas caro. 0.35 salio de probar preguntas reales.
 */
const UMBRAL_RELEVANCIA = 0.35

/** Nombre de plan o marca -> aseguradora a la que pertenece. */
const PLANES: Record<string, string> = {
  bmi: 'bmi', sigma: 'bmi', innova: 'bmi', ideal: 'bmi', support: 'bmi',
  azure: 'bmi', meridian: 'bmi',
  humana: 'humana', proteger: 'humana', practihumana: 'humana',
  metrohumana: 'humana', ph15: 'humana', ph30: 'humana', mh150: 'humana',
  confiamed: 'confiamed', confiplus: 'confiamed', confired: 'confiamed',
  saludsa: 'saludsa', star: 'saludsa', sky: 'saludsa', optimus: 'saludsa',
  vitality: 'saludsa',
}

/** Coincidencia de palabra completa, tolerante a signos alrededor. */
function bordes(termino: string): RegExp {
  const escapado = termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![a-z0-9])${escapado}(?![a-z0-9])`, 'g')
}

const VACIAS = new Set([
  'para', 'como', 'este', 'esta', 'esto', 'pero', 'porque', 'cuando',
  'donde', 'desde', 'hasta', 'sobre', 'entre', 'tiene', 'tienen', 'puede',
  'pueden', 'cual', 'cuales', 'que', 'los', 'las', 'del', 'con', 'por',
  'una', 'unos', 'unas', 'mas', 'muy', 'todo', 'toda', 'todos', 'todas',
  'plan', 'planes', 'cliente', 'seguro',
  // Muletillas de la pregunta hablada. Josue suele dictar por voz, asi que
  // llegan frases largas con mucho relleno que no aporta a la busqueda.
  'dice', 'dices', 'quiere', 'quieren', 'saber', 'cuanto', 'cuanta',
  'ademas', 'menos', 'sale', 'salen', 'osea', 'nomas', 'digamos',
  'necesito', 'ayuda', 'respondo', 'responder', 'decir', 'hacer',
  'me', 'le', 'lo', 'la', 'el', 'ya', 'es', 'en', 'de', 'un', 'al',
  'su', 'sus', 'si', 'no', 'yo', 'te', 'se', 'mi', 'tu', 'ese', 'esa',
])
