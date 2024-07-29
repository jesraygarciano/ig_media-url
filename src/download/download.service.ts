import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class DownloadService {
  async getMediaUrl(instagramUrl: string): Promise<string> {
    try {
      const response = await axios.get(instagramUrl);
      const $ = cheerio.load(response.data);
      const scriptTag = $('script[type="application/ld+json"]').html();
      const json = JSON.parse(scriptTag);
      const mediaUrl = json.video?.contentUrl || json.image;
      if (!mediaUrl) {
        throw new HttpException('Media not found', HttpStatus.NOT_FOUND);
      }
      return mediaUrl;
    } catch (error) {
      throw new HttpException('Failed to fetch media', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
