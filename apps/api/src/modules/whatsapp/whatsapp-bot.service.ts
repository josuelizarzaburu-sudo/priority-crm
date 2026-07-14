import { Injectable, Logger, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type Redis from 'ioredis'
import Anthropic from '@anthropic-ai/sdk'
import { LeadsService } from '../leads/leads.service'
import { InsuranceType, LeadSource } from '../leads/dto/ingest-lead.dto'

export const WHATSAPP_REDIS = 'WHATSAPP_REDIS'

export class RedisUnavailableError extends Error {
  constructor() { super('Redis unavailable') }
}

type BotStep =
  | 'menu'
  // salud
  | 'sport'
  | 'insured'
  | 'nombre'
  | 'completado'
  // auto
  | 'auto_vehiculo'
  | 'auto_propietario'
  | 'auto_repregunta'
  | 'auto_completado'

interface AutoData {
  marca?: string | null
  modelo?: string | null
  anio?: string | null
  placa?: string | null
  ciudad?: string | null
  nombrePropietario?: string | null
  cedulaRuc?: string | null
  edad?: string | null
  estadoCivil?: string | null
  sexo?: string | null
}

interface BotSession {
  step: BotStep
  insuranceType?: 'SALUD' | 'AUTO'
  // salud fields
  sport?: boolean
  insured?: boolean
  firstName?: string
  lastName?: string
  // auto fields
  autoData?: AutoData
  // preguntas que el bot no pudo responder, para que el asesor las vea
  preguntas?: string[]
}

const SESSION_TTL_SECONDS = 86400

const REQUIRED_AUTO_FIELDS: (keyof AutoData)[] = [
  'marca', 'modelo', 'anio', 'placa', 'ciudad', 'nombrePropietario', 'cedulaRuc',
]

const FIELD_LABELS: Record<string, string> = {
  marca: 'marca del vehículo',
  modelo: 'modelo',
  anio: 'año del vehículo',
  placa: 'número de placa',
  ciudad: 'ciudad donde circula',
  nombrePropietario: 'nombre completo del propietario',
  cedulaRuc: 'cédula o RUC',
}

// ─── Messages ──────────────────────────────────────────────────────────────────

const MSG_MENU =
  '¡Hola! 👋 Soy el asistente de Priority. ¿Qué tipo de seguro te interesa?\n1️⃣ Seguro de Salud\n2️⃣ Seguro de Auto'

const MSG_SALUD_INICIO =
  '¡Genial! 😊 Te haré 2 preguntas rápidas para conocer tu perfil.'

const MSG_SPORT =
  '¿Practicas deporte o actividad física regularmente?\n1️⃣ Sí, me ejercito\n2️⃣ No hago ejercicio'

const MSG_INSURED =
  '¿Tienes seguro de salud actualmente?\n1️⃣ Sí, tengo seguro\n2️⃣ No tengo seguro'

const MSG_NOMBRE = '¡Perfecto! ¿Me puedes dar tu nombre completo?'

const MSG_COMPLETADO_SALUD =
  '¡Con gusto! 😊 Recuerda que un asesor de Priority Health se pondrá en contacto contigo muy pronto. ¡Que tengas un excelente día!'

// ─── Vitality: saludos personalizados según el perfil de la encuesta web ─────
const MSG_VITALITY: Record<string, string> = {
  A: '¡Felicitaciones! 🎉 Haces deporte Y ya tienes seguro — eso dice mucho de ti: te cuidas de verdad. 💪\n\nCon SALUDSA Vitality, todo ese esfuerzo se convierte en premios reales: te devuelve hasta el 20% de vuelta de lo pagado en tu plan anual, además de Apple Watch y más.\n\nPara empezar solo necesito tu nombre completo 😊',
  B: '¡Qué bueno tenerte aquí! 🙌 Ya tienes seguro de salud — ese es un gran paso. Ahora imagina que ese mismo seguro te devuelva hasta el 20% de vuelta de lo pagado en tu plan anual con SALUDSA Vitality. 💰\n\nPara empezar solo necesito tu nombre completo 😊',
  C: '¡Felicitaciones por ese estilo de vida activo! 💪 Entrenas y te cuidas — solo te falta la protección que lo respalde. Con SALUDSA Vitality te aseguramos Y te premiamos por cada logro: efectivo, Apple Watch y más. 🎁\n\nPara empezar solo necesito tu nombre completo 😊',
  D: '¡Bienvenido! 🙌 Hoy puede ser el día en que empieces a cuidarte — y que te paguen por hacerlo. 💛 Con SALUDSA Vitality tienes protección médica completa y premios reales por cada paso que des hacia una vida más sana.\n\nPara empezar solo necesito tu nombre completo 😊',
}

// ─── Entradas contextuales desde las demás landings del sitio ────────────────
const MSG_LANDING: Record<string, string> = {
  familia: '¡Qué lindo que pienses en proteger a los tuyos! 👨‍👩‍👧 Con nuestra póliza familiar, mientras más integrantes agregas más ahorras — hasta 40% de descuento por familiar, con cobertura de maternidad y pediatría.\n\nPara armar tu cotización solo necesito tu nombre completo 😊',
  individual: '¡Excelente decisión cuidar de ti! 🙌 Tenemos planes individuales desde $25/mes, con libre elección de médicos y cobertura a tu medida — sin ataduras.\n\nPara armar tu cotización solo necesito tu nombre completo 😊',
  mayores: '¡Qué gusto tenerte aquí! 💛 Cuidarte en cada etapa es nuestra prioridad: planes con cobertura de especialistas, enfermedades crónicas y todo lo que necesitas hoy y a futuro.\n\nPara armar tu cotización solo necesito tu nombre completo 😊',
  auto: '¡Perfecto! 🚗 Vamos a poner a 5 aseguradoras a competir por tu auto (AIG, Zurich, Atlántida, Sweaden y Latina) y te damos la mejor.\n\nPara empezar, envíame en un solo mensaje:\n- Marca y modelo\n- Año\n- Placa\n- Ciudad donde circula',
}

const MSG_AUTO_VEHICULO =
  '¡Genial! Para cotizar tu seguro de auto necesito algunos datos. Puedes enviármelos en un solo mensaje 😊\n\n' +
  '🚗 De tu vehículo:\n- Marca y modelo\n- Año\n- Placa\n- Ciudad donde circula'

const MSG_AUTO_PROPIETARIO =
  '¡Perfecto! Ahora del propietario:\n- Nombre completo\n- Cédula o RUC\n- Edad, estado civil y sexo (esto ayuda a conseguirte el mejor precio)'

const MSG_AUTO_COMPLETADO = (nombre: string) =>
  `¡Listo ${nombre}! 🎉 Ya tengo todo para cotizarte. Uno de nuestros asesores te preparará la mejor opción entre las aseguradoras AIG, Zurich, Atlántida, Sweaden y Latina, y te la envía hoy mismo. 🚀`

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name)

  constructor(
    @Inject(WHATSAPP_REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly leadsService: LeadsService,
  ) {}

  private isRestart(text: string): boolean {
    const t = text.trim().toLowerCase()
    return ['hola', 'inicio', 'start', 'reiniciar', 'reset'].includes(t)
  }

  /**
   * Detecta si el mensaje viene del link personalizado de la encuesta Vitality
   * (salud-premia.html) y devuelve el perfil con sus respuestas ya conocidas.
   * Los 4 textos posibles se definen en WA_MSGS dentro de salud-premia.html.
   */
  private detectVitalityProfile(text: string): { profile: 'A' | 'B' | 'C' | 'D'; sport: boolean; insured: boolean } | null {
    const t = text.toLowerCase()
    if (!t.includes('vengo de vitality')) return null

    const sport = t.includes('hago deporte')
    // "ya tengo seguro" → insured; "aún no tengo seguro" / "no tengo seguro" → not insured
    const insured = /ya tengo seguro/.test(t)

    const profile = sport && insured ? 'A' : !sport && insured ? 'B' : sport && !insured ? 'C' : 'D'
    return { profile, sport, insured }
  }

  /**
   * Detecta si el mensaje viene de un link contextual de las demás landings
   * (salud-familia, salud-individual, salud-mayores, vehiculo).
   */
  private detectLandingEntry(text: string): 'familia' | 'individual' | 'mayores' | 'auto' | null {
    const t = text.toLowerCase()
    if (t.includes('vengo de la página de seguro familiar')) return 'familia'
    if (t.includes('vengo de la página de seguro individual')) return 'individual'
    if (t.includes('vengo de la página de adultos mayores') || t.includes('vengo de la página de seguro para mayores')) return 'mayores'
    if (t.includes('vengo de la página de seguro de auto') || t.includes('vengo de la página de vehículo')) return 'auto'
    return null
  }

  async processMessage(phone: string, text: string): Promise<void> {
    console.log('Processing message from:', phone)

    // ── Entrada desde la encuesta Vitality de la web ─────────────────────────
    // El link de salud-premia.html pre-carga un mensaje con el perfil del usuario.
    // Si lo detectamos, ya sabemos sport/insured — no volvemos a preguntar.
    const vitalityProfile = this.detectVitalityProfile(text)
    if (vitalityProfile) {
      console.log('Vitality entry detected — profile:', vitalityProfile.profile)
      await this.saveSession(phone, {
        step: 'nombre',
        insuranceType: 'SALUD',
        sport: vitalityProfile.sport,
        insured: vitalityProfile.insured,
      })
      await this.sendMessage(phone, MSG_VITALITY[vitalityProfile.profile])
      return
    }

    // ── Entradas contextuales desde las demás landings del sitio ────────────
    const landing = this.detectLandingEntry(text)
    if (landing) {
      console.log('Landing entry detected:', landing)
      if (landing === 'auto') {
        await this.saveSession(phone, { step: 'auto_vehiculo', insuranceType: 'AUTO' })
      } else {
        await this.saveSession(phone, { step: 'nombre', insuranceType: 'SALUD' })
      }
      await this.sendMessage(phone, MSG_LANDING[landing])
      return
    }

    if (this.isRestart(text)) {
      console.log('Restart keyword — clearing session for', phone)
      await this.redis.del(this.sessionKey(phone))
      await this.handleMenu(phone)
      return
    }

    const session = await this.getSession(phone)
    console.log('Bot state:', JSON.stringify(session))

    if (!session) {
      console.log('No session — starting menu for', phone)
      await this.handleMenu(phone)
      return
    }

    console.log('Dispatching for step:', session.step)
    switch (session.step) {
      case 'menu':
        await this.handleMenuAnswer(phone, session, text)
        break
      // ── salud ─────────────────────────────────────────────────────────────
      case 'sport':
        await this.handleSport(phone, session, text)
        break
      case 'insured':
        await this.handleInsured(phone, session, text)
        break
      case 'nombre':
        await this.handleNombre(phone, session, text)
        break
      case 'completado':
        await this.sendMessage(phone, MSG_COMPLETADO_SALUD)
        break
      // ── auto ──────────────────────────────────────────────────────────────
      case 'auto_vehiculo':
        await this.handleAutoVehiculo(phone, session, text)
        break
      case 'auto_propietario':
        await this.handleAutoPropietario(phone, session, text)
        break
      case 'auto_repregunta':
        await this.handleAutoRepregunta(phone, session, text)
        break
      case 'auto_completado':
        await this.sendMessage(phone, MSG_AUTO_COMPLETADO(session.autoData?.nombrePropietario?.split(' ')[0] ?? ''))
        break
    }
  }

  // ─── Menu ─────────────────────────────────────────────────────────────────

  private async handleMenu(phone: string): Promise<void> {
    await this.saveSession(phone, { step: 'menu' })
    await this.sendMessage(phone, MSG_MENU)
  }

  private async handleMenuAnswer(phone: string, _session: BotSession, text: string): Promise<void> {
    const choice = this.parseMenuChoice(text)
    if (choice === null) {
      await this.sendMessage(phone, MSG_MENU)
      return
    }

    if (choice === 1) {
      await this.saveSession(phone, { step: 'sport', insuranceType: 'SALUD' })
      await this.sendMessage(phone, MSG_SALUD_INICIO)
      await this.sendMessage(phone, MSG_SPORT)
    } else {
      await this.saveSession(phone, { step: 'auto_vehiculo', insuranceType: 'AUTO' })
      await this.sendMessage(phone, MSG_AUTO_VEHICULO)
    }
  }

  // ─── Salud steps (unchanged logic) ────────────────────────────────────────

  private async handleSport(phone: string, session: BotSession, text: string): Promise<void> {
    const answer = this.parseYesNo(text)
    if (answer === null) {
      await this.sendMessage(phone, MSG_SPORT)
      return
    }
    session.sport = answer
    session.step = 'insured'
    await this.saveSession(phone, session)
    await this.sendMessage(phone, MSG_INSURED)
  }

  private async handleInsured(phone: string, session: BotSession, text: string): Promise<void> {
    const answer = this.parseYesNo(text)
    if (answer === null) {
      await this.sendMessage(phone, MSG_INSURED)
      return
    }
    session.insured = answer
    session.step = 'nombre'
    await this.saveSession(phone, session)
    await this.sendMessage(phone, MSG_NOMBRE)
  }

  /**
   * Detecta si el mensaje del cliente es una pregunta/duda en vez de la
   * respuesta que el paso espera. Heurística simple: signos de interrogación
   * o palabras interrogativas comunes.
   */
  private looksLikeQuestion(text: string): boolean {
    const t = text.trim().toLowerCase()
    if (t.includes('?') || t.includes('¿')) return true
    return /^(cuanto|cuánto|cuanta|cuánta|como|cómo|que |qué |cual|cuál|donde|dónde|cuando|cuándo|por que|por qué|porque me|quisiera saber|puedo|puedes|tienen|hay |sirve|cubre|incluye|acepta)/.test(t)
  }

  /**
   * Respuesta cálida cuando el cliente pregunta algo que el bot no puede
   * responder: valida la pregunta, la anota para el asesor, y retoma el paso.
   */
  private async handleClientQuestion(phone: string, session: BotSession, text: string, resumeMsg: string): Promise<void> {
    session.preguntas = [...(session.preguntas ?? []), text.trim()].slice(-5)
    await this.saveSession(phone, session)
    await this.sendMessage(
      phone,
      '¡Tu pregunta es súper válida! 😊 La dejo anotada para que tu asesor te la responda con todo el detalle que merece.\n\n' + resumeMsg,
    )
  }

  private async handleNombre(phone: string, session: BotSession, text: string): Promise<void> {
    if (this.looksLikeQuestion(text)) {
      await this.handleClientQuestion(phone, session, text, 'Mientras tanto, ¿me ayudas con tu nombre completo para avanzar? 🙌')
      return
    }
    const { firstName, lastName } = this.parseName(text)
    session.firstName = firstName
    session.lastName = lastName
    session.step = 'completado'
    await this.saveSession(phone, session)
    await this.createSaludLead(phone, session)
    await this.sendMessage(
      phone,
      `¡Gracias ${firstName}! Un asesor de Priority Health se pondrá en contacto contigo lo más pronto posible 🎯`,
    )
  }

  // ─── Auto steps ───────────────────────────────────────────────────────────

  private async handleAutoVehiculo(phone: string, session: BotSession, text: string): Promise<void> {
    if (this.looksLikeQuestion(text)) {
      await this.handleClientQuestion(phone, session, text, 'Mientras tanto, ¿me compartes los datos de tu vehículo (marca, modelo, año, placa y ciudad) para avanzar con tu cotización? 🚗')
      return
    }
    const extracted = await this.extractAutoData(text)
    session.autoData = { ...(session.autoData ?? {}), ...this.filterNulls(extracted) }
    session.step = 'auto_propietario'
    await this.saveSession(phone, session)
    await this.sendMessage(phone, MSG_AUTO_PROPIETARIO)
  }

  private async handleAutoPropietario(phone: string, session: BotSession, text: string): Promise<void> {
    if (this.looksLikeQuestion(text)) {
      await this.handleClientQuestion(phone, session, text, 'Mientras tanto, ¿me compartes los datos del propietario (nombre completo y cédula o RUC) para avanzar? 🙌')
      return
    }
    const extracted = await this.extractAutoData(text)
    session.autoData = { ...(session.autoData ?? {}), ...this.filterNulls(extracted) }
    await this.checkAndCloseAuto(phone, session)
  }

  private async handleAutoRepregunta(phone: string, session: BotSession, text: string): Promise<void> {
    if (this.looksLikeQuestion(text)) {
      await this.handleClientQuestion(phone, session, text, 'Mientras tanto, ¿me ayudas con los datos que nos faltan para completar tu cotización? 🙌')
      return
    }
    const extracted = await this.extractAutoData(text)
    session.autoData = { ...(session.autoData ?? {}), ...this.filterNulls(extracted) }
    await this.checkAndCloseAuto(phone, session)
  }

  private async checkAndCloseAuto(phone: string, session: BotSession): Promise<void> {
    const missing = REQUIRED_AUTO_FIELDS.filter(f => !session.autoData?.[f])

    if (missing.length === 0) {
      session.step = 'auto_completado'
      await this.saveSession(phone, session)
      await this.createAutoLead(phone, session)
      const firstName = session.autoData?.nombrePropietario?.split(' ')[0] ?? ''
      await this.sendMessage(phone, MSG_AUTO_COMPLETADO(firstName))
    } else {
      session.step = 'auto_repregunta'
      await this.saveSession(phone, session)
      await this.sendMessage(phone, this.buildMissingFieldsMsg(missing))
    }
  }

  // ─── Claude extraction ────────────────────────────────────────────────────

  private async extractAutoData(text: string): Promise<Partial<AutoData>> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY')
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set — skipping Claude extraction')
      return {}
    }

    try {
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system:
          'Eres un extractor de datos para cotización de seguros de auto en Ecuador. ' +
          'Extrae SOLO los datos presentes en el mensaje del usuario y devuelve un JSON válido sin texto adicional ' +
          'con estos campos (null si no está presente): ' +
          'marca, modelo, anio, placa, ciudad, nombrePropietario, cedulaRuc, edad, estadoCivil, sexo. ' +
          'No inventes datos.',
        messages: [{ role: 'user', content: text }],
      })

      const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
      const json = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '')
      return JSON.parse(json) as Partial<AutoData>
    } catch (err) {
      this.logger.error('Claude extraction error', err)
      return {}
    }
  }

  // ─── Lead creation ────────────────────────────────────────────────────────

  private async createSaludLead(phone: string, session: BotSession): Promise<void> {
    if (!session.firstName) return
    const sport = session.sport ?? false
    const insured = session.insured ?? false
    // Misma convención que calcProfile() en salud-premia.html:
    // A = deporte+seguro, B = seguro sin deporte, C = deporte sin seguro, D = ninguno
    let profileType: string
    if (sport && insured) profileType = 'A'
    else if (!sport && insured) profileType = 'B'
    else if (sport && !insured) profileType = 'C'
    else profileType = 'D'

    try {
      await this.leadsService.ingestLead({
        firstName: session.firstName,
        lastName: session.lastName,
        phone,
        insuranceType: InsuranceType.SALUD,
        source: LeadSource.WHATSAPP,
        sport,
        insured,
        profileType,
        notes: session.preguntas?.length
          ? `Preguntas del cliente: ${session.preguntas.join(' // ')}`
          : undefined,
      })
      this.logger.log(`Salud lead created via WhatsApp bot for ${phone} — profile ${profileType}`)
    } catch (err) {
      this.logger.error(`Failed to create salud lead for ${phone}`, err)
    }
  }

  private async createAutoLead(phone: string, session: BotSession): Promise<void> {
    const ad = session.autoData ?? {}
    const nombreCompleto = ad.nombrePropietario ?? ''
    const parts = nombreCompleto.trim().split(/\s+/).filter(Boolean)
    const firstName = parts[0] ?? phone
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined

    try {
      await this.leadsService.ingestLead({
        firstName,
        lastName,
        phone,
        insuranceType: InsuranceType.AUTO,
        source: LeadSource.WHATSAPP,
        autoData: {
          marca: ad.marca ?? null,
          modelo: ad.modelo ?? null,
          anio: ad.anio ?? null,
          placa: ad.placa ?? null,
          ciudad: ad.ciudad ?? null,
          nombrePropietario: nombreCompleto || undefined,
          cedulaRuc: ad.cedulaRuc ?? null,
          edad: ad.edad ?? null,
          estadoCivil: ad.estadoCivil ?? null,
          sexo: ad.sexo ?? null,
        },
        notes: session.preguntas?.length
          ? `Preguntas del cliente: ${session.preguntas.join(' // ')}`
          : undefined,
      })
      this.logger.log(`Auto lead created via WhatsApp bot for ${phone}`)
    } catch (err) {
      this.logger.error(`Failed to create auto lead for ${phone}`, err)
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private parseMenuChoice(text: string): 1 | 2 | null {
    const t = text.trim().toLowerCase()
    if (t === '1' || t === '1️⃣' || t.includes('salud')) return 1
    if (t === '2' || t === '2️⃣' || t.includes('auto')) return 2
    return null
  }

  private parseYesNo(text: string): boolean | null {
    const t = text.trim().toLowerCase()
    if (t === '1' || t === 'sí' || t === 'si' || t === 'yes' || t === '1️⃣') return true
    if (t === '2' || t === 'no' || t === '2️⃣') return false
    return null
  }

  private parseName(text: string): { firstName: string; lastName?: string } {
    const parts = text.trim().split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined
    return { firstName, lastName }
  }

  private filterNulls(data: Partial<AutoData>): Partial<AutoData> {
    const result: Partial<AutoData> = {}
    for (const [k, v] of Object.entries(data)) {
      if (v !== null && v !== undefined && v !== '') {
        result[k as keyof AutoData] = v as string
      }
    }
    return result
  }

  private buildMissingFieldsMsg(missing: string[]): string {
    const labels = missing.map(f => FIELD_LABELS[f] ?? f)
    const list = labels.map(l => `· ${l}`).join('\n')
    const plural = missing.length === 1
    return `¡Gracias! Solo me falt${plural ? 'a' : 'an'} ${plural ? 'este dato' : 'estos datos'}:\n${list}\n\nPor favor compártelos para continuar 😊`
  }

  // ─── Redis ────────────────────────────────────────────────────────────────

  private sessionKey(phone: string) {
    return `whatsapp:session:${phone}`
  }

  // Throws RedisUnavailableError on Redis failure so callers can distinguish
  // "no session" (null) from "can't tell" (error)
  async getSessionStep(phone: string): Promise<BotStep | null> {
    let raw: string | null
    try {
      raw = await this.redis.get(this.sessionKey(phone))
    } catch (err) {
      this.logger.error(`Redis GET error for ${phone}`, err)
      throw new RedisUnavailableError()
    }
    if (!raw) return null
    try {
      return (JSON.parse(raw) as BotSession).step ?? null
    } catch {
      return null
    }
  }

  async clearSession(phone: string): Promise<void> {
    try {
      await this.redis.del(this.sessionKey(phone))
    } catch (err) {
      this.logger.error(`Redis DEL error for ${phone}`, err)
    }
  }

  // ─── Manual mode (client chose "Continuar con asesor") ───────────────────
  // Flag lives separately from the bot session so it survives session expiry.
  // TTL is refreshed on every message while in manual mode (24 h of inactivity).

  private manualKey(phone: string) { return `whatsapp:manual:${phone}` }
  private readonly MANUAL_TTL_SECONDS = 86400 // 24 h

  async isManualMode(phone: string): Promise<boolean> {
    try {
      return (await this.redis.exists(this.manualKey(phone))) === 1
    } catch (err) {
      this.logger.error(`Redis EXISTS (manual) error for ${phone}`, err)
      return false
    }
  }

  async setManualMode(phone: string): Promise<void> {
    try {
      await this.redis.set(this.manualKey(phone), '1', 'EX', this.MANUAL_TTL_SECONDS)
    } catch (err) {
      this.logger.error(`Redis SET (manual) error for ${phone}`, err)
    }
  }

  // ─── Reentry menu (interactive buttons) ──────────────────────────────────

  async sendReentryMenu(to: string): Promise<void> {
    const token = this.config.get<string>('META_WHATSAPP_TOKEN')
    const phoneId = this.config.get<string>('META_WHATSAPP_PHONE_ID')
    if (!token || !phoneId) {
      this.logger.warn('META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID not set — skipping reentry menu')
      return
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: '¡Hola de nuevo! 👋 ¿En qué te podemos ayudar?' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'continue_advisor', title: 'Continuar con asesor' } },
                { type: 'reply', reply: { id: 'new_quote', title: 'Cotizar nuevo seguro' } },
              ],
            },
          },
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        this.logger.error(`Reentry menu send failed: ${errText}`)
      }
    } catch (err) {
      this.logger.error('Reentry menu send error', err)
    }
  }

  private async getSession(phone: string): Promise<BotSession | null> {
    try {
      const raw = await this.redis.get(this.sessionKey(phone))
      return raw ? (JSON.parse(raw) as BotSession) : null
    } catch (err) {
      this.logger.error(`Redis GET error for ${phone}`, err)
      return null
    }
  }

  private async saveSession(phone: string, session: BotSession): Promise<void> {
    try {
      await this.redis.set(this.sessionKey(phone), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS)
    } catch (err) {
      this.logger.error(`Redis SET error for ${phone}`, err)
    }
  }

  // ─── WhatsApp send ────────────────────────────────────────────────────────

  async sendMessage(to: string, body: string): Promise<void> {
    const token = this.config.get('META_WHATSAPP_TOKEN')
    const phoneId = this.config.get('META_WHATSAPP_PHONE_ID')

    console.log('Sending response...', { to, phoneId: !!phoneId, token: !!token, preview: body.slice(0, 60) })

    if (!token || !phoneId) {
      this.logger.warn('META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID not set — skipping send')
      return
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.log('WhatsApp API error:', response.status, errText)
        this.logger.error(`WhatsApp send failed: ${errText}`)
      } else {
        console.log('WhatsApp API OK — message sent to', to)
      }
    } catch (err) {
      console.log('WhatsApp send exception:', err)
      this.logger.error('WhatsApp send error', err)
    }
  }
}
