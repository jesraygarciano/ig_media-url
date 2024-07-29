import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';

@Injectable()
export class DownloadService {
  private readonly logger = new Logger(DownloadService.name);

  async getMediaUrl(instagramUrl: string): Promise<string> {
    try {
      this.logger.log(`Fetching URL: ${instagramUrl}`);
      const response = await axios.get(instagramUrl);
      const $ = cheerio.load(response.data);

      // Log the HTML content for debugging
      this.logger.debug(`HTML Content: ${response.data}`);

      // Try to find the media URL in different structures
      let mediaUrl = this.extractMediaUrlFromJsonLd($);
      if (!mediaUrl) {
        mediaUrl = this.extractMediaUrlFromGraphQl($);
      }

      if (!mediaUrl) {
        throw new HttpException('Media not found', HttpStatus.NOT_FOUND);
      }

      return mediaUrl;
    } catch (error) {
      this.logger.error(`Failed to fetch media: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch media', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private extractMediaUrlFromJsonLd($: CheerioAPI): string | null {
    try {
      const scriptTag = $('script[type="application/ld+json"]').html();
      if (scriptTag) {
        const json = JSON.parse(scriptTag);
        return json.video?.contentUrl || json.image;
      }
    } catch (error) {
      this.logger.warn(`Failed to extract media URL from JSON-LD: ${error.message}`);
    }
    return null;
  }

  private extractMediaUrlFromGraphQl($: CheerioAPI): string | null {
    try {
      const scriptTag = $('script[type="text/javascript"]').filter((i, el) => {
        return $(el).html().includes('window._sharedData');
      }).html();

      if (scriptTag) {
        const json = JSON.parse(scriptTag.replace('window._sharedData = ', '').slice(0, -1));
        const media = json.entry_data.PostPage[0].graphql.shortcode_media;
        if (media.__typename === 'GraphImage') {
          return media.display_url;
        } else if (media.__typename === 'GraphVideo') {
          return media.video_url;
        } else if (media.__typename === 'GraphSidecar') {
          return media.edge_sidecar_to_children.edges[0].node.display_url;
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to extract media URL from GraphQL: ${error.message}`);
    }
    return null;
  }
}
