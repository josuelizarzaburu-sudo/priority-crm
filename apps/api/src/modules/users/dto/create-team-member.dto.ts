import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'

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

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole
}
