import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as webpush from 'web-push'
import { PrismaService } from '../../prisma/prisma.service'
import { SubscribeDto } from './dto/subscribe.dto'

export interface PushPayload {
  title: string
  body: string
  url?: string
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name)
  private readonly enabled: boolean

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const publicKey = config.get<string>('VAPID_PUBLIC_KEY')
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY')

    if (publicKey && privateKey) {
      webpush.setVapidDetails('mailto:admin@priorityhealth.ec', publicKey, privateKey)
      this.enabled = true
      this.logger.log('Web Push configured')
    } else {
      this.enabled = false
      this.logger.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications disabled')
    }
  }

  async subscribe(userId: string, dto: SubscribeDto): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint: dto.endpoint } },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      update: { p256dh: dto.keys.p256dh, auth: dto.keys.auth },
    })
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } })
    await Promise.allSettled(
      subs.map(sub => this.sendOne(sub, payload)),
    )
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.enabled || userIds.length === 0) return
    await Promise.allSettled(userIds.map(uid => this.sendToUser(uid, payload)))
  }

  private async sendOne(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        // Subscription expired — clean it up
        await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => null)
      } else {
        this.logger.error(`Push send error for sub ${sub.id}: ${err}`)
      }
    }
  }
}
