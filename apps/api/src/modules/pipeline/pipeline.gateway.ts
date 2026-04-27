import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/pipeline' })
export class PipelineGateway {
  @WebSocketServer()
  server!: Server

  @SubscribeMessage('join-organization')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() orgId: string) {
    client.join(`org:${orgId}`)
  }

  @SubscribeMessage('join-user')
  handleJoinUser(@ConnectedSocket() client: Socket, @MessageBody() userId: string) {
    client.join(`user:${userId}`)
  }

  broadcastDealMoved(organizationId: string, deal: any) {
    this.server.to(`org:${organizationId}`).emit('deal:moved', deal)
  }

  broadcastDealUpdated(organizationId: string, deal: any) {
    this.server.to(`org:${organizationId}`).emit('deal:updated', deal)
  }

  broadcastLeadAssigned(agentUserId: string, deal: any) {
    this.server.to(`user:${agentUserId}`).emit('lead:assigned', deal)
  }
}
