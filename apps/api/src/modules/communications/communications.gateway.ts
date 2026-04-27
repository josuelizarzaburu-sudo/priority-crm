import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/communications' })
export class CommunicationsGateway {
  @WebSocketServer()
  server!: Server

  @SubscribeMessage('join-organization')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() orgId: string) {
    client.join(`org:${orgId}`)
  }

  broadcastMessage(organizationId: string, conversationId: string, message: any) {
    this.server.to(`org:${organizationId}`).emit('message:new', { conversationId, message })
  }
}
