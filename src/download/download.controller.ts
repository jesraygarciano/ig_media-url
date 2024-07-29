import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { DownloadService } from './download.service';
import { DownloadDto } from './dto/download.dto';

@ApiTags('download')
@Controller('download')
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  @Post()
  @ApiOperation({ summary: 'Download media from Instagram' })
  @ApiResponse({ status: 200, description: 'Media URL retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Media not found.' })
  @ApiResponse({ status: 500, description: 'Failed to fetch media.' })
  @ApiBody({ type: DownloadDto })
  async download(@Body() downloadDto: DownloadDto) {
    const mediaUrl = await this.downloadService.getMediaUrl(downloadDto.url);
    return { mediaUrl };
  }
}
