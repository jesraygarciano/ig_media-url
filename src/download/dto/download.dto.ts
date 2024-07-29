import { ApiProperty } from '@nestjs/swagger';

export class DownloadDto {
  @ApiProperty({
    description: 'The URL of the Instagram post',
    example: 'https://www.instagram.com/p/XXXXXXXXX/',
  })
  url: string;
}
