import { IsEmail, IsString, IsOptional, MinLength, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateTeamMemberDto {
  @ApiProperty()
  @IsString()
  name!: string

  @ApiProperty()
  @IsEmail()
  email!: string

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string

  @ApiProperty()
  @IsString()
  role!: string

  @ApiProperty({ required: false, example: '+593999999999' })
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/, { message: 'Formato inválido. Usa +593XXXXXXXXX' })
  phone?: string
}
