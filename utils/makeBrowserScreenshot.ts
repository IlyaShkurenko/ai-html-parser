import puppeteer, { Browser, Page } from 'puppeteer';
import { uploadFileToS3 } from './uploadFileToS3';
import fs from 'fs';
import { promisify } from 'util';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export class BrowserScreenshotMaker {
	private browser: Browser | null = null;
  private page: Page | null = null;
  private rendered: boolean = false;

	private async waitTillHTMLRendered(page: Page, timeout = 30000) {
		const checkDurationMsecs = 1000;
		const maxChecks = timeout / checkDurationMsecs;
		let lastHTMLSize = 0;
		let checkCounts = 1;
		let countStableSizeIterations = 0;
		const minStableSizeIterations = 3;

		while(checkCounts++ <= maxChecks){
			let html = await page.content();
			let currentHTMLSize = html.length; 

			let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);

			console.log('last: ', lastHTMLSize, ' <> curr: ', currentHTMLSize, " body html size: ", bodyHTMLSize);

			if(lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize) 
				countStableSizeIterations++;
			else 
				countStableSizeIterations = 0; //reset the counter

			if(countStableSizeIterations >= minStableSizeIterations) {
				console.log("Page rendered fully..");
				break;
			}

			lastHTMLSize = currentHTMLSize;
			await sleep(checkDurationMsecs);
		}
		return true;
	}

	async initialize() {
		if (!this.browser) {
			this.browser = await puppeteer.launch({ headless: false });
		}
	}

	async makeScreenshot(url: string, callback?: (page: Page) => void): Promise<string> {
		if (!this.browser) {
			await this.initialize();
		}

    if(!this.rendered && this.browser) {
      this.page = await this.browser.newPage();
    }

		// Increase viewport size for higher resolution
		const width = 1200;
		const height = 900;

		await this.page!.setViewport({
			width,
			height,
			deviceScaleFactor: 1
		});

    if(!this.rendered) {
      try {
        await this.page!.goto(url, {'timeout': 60000, 'waitUntil':'load'});
        this.rendered = await this.waitTillHTMLRendered(this.page);
      } catch (error) {
        console.error(`Failed to load page: ${error}`);
      }
    }
    
		if (callback) {
			await callback(this.page);
		}
		await sleep(3000);

		const screenshot = await this.page.screenshot({
			fullPage: false,
			omitBackground: true,
			clip: {
				x: 0,
				y: 0,
				width,
				height: 1.25 * height,
			},
		});

		const tempFilePath = `/tmp/${Date.now()}.png`;
		await promisify(fs.writeFile)(tempFilePath, screenshot);

		const bucketName = process.env.S3_BUCKET_NAME || 'testbucketzizo';
		const key = `screenshots/${Date.now()}.png`;
		const s3Url = await uploadFileToS3(tempFilePath, bucketName, key);

		await promisify(fs.unlink)(tempFilePath);

		return s3Url;
	}

	async close() {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
    if(this.page) {
      await this.page.close();
      this.page = null;
    }
	}
}

export default BrowserScreenshotMaker;
