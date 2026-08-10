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
  buscar(consulta: string, limite = 6): DocumentoKb[] {
    // Ojo con el umbral de longitud: terminos cortos como "sky", "red",
    // "30k", "15" o "ph" son justamente los que identifican un plan.
    // Filtrarlos por largo hacia que "confiplus 30k red 2" no encontrara
    // su propio documento.
    const terminos = normalizar(consulta)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2 && !VACIAS.has(t))

    if (!terminos.length) return this.muestraVariada(limite)

    const puntuados = this.documentos.map((doc) => {
      const nombre = normalizar(doc.archivo)
      const cuerpo = normalizar(doc.contenido)
      let puntos = 0
      for (const t of terminos) {
        // Coincidir en el nombre del archivo pesa mucho mas: si el asesor
        // dice "sigma", el documento de Sigma es el que importa.
        if (nombre.includes(t)) puntos += 25
        const veces = cuerpo.split(t).length - 1
        puntos += Math.min(veces, 8)
      }
      return { doc, puntos }
    })

    const conPuntaje = puntuados
      .filter((p) => p.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, limite)
      .map((p) => p.doc)

    // Preguntas sin nombre de plan (tipicamente objeciones: "esta caro",
    // "ya tiene IESS") no matchean nada util. En vez de dejar al modelo sin
    // material, se le manda una muestra de cada aseguradora.
    if (conPuntaje.length < 3) return this.muestraVariada(limite)

    return conPuntaje
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

const VACIAS = new Set([
  'para', 'como', 'este', 'esta', 'esto', 'pero', 'porque', 'cuando',
  'donde', 'desde', 'hasta', 'sobre', 'entre', 'tiene', 'tienen', 'puede',
  'pueden', 'cual', 'cuales', 'que', 'los', 'las', 'del', 'con', 'por',
  'una', 'unos', 'unas', 'mas', 'muy', 'todo', 'toda', 'todos', 'todas',
  'plan', 'planes', 'cliente', 'seguro',
])
