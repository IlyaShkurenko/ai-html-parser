import puppeteer, { Page } from 'puppeteer';
import { uploadFileToS3 } from './uploadFileToS3';
import fs from 'fs';
import { promisify } from 'util';
const sleep = ms => new Promise(res => setTimeout(res, ms));

const waitTillHTMLRendered = async (page, timeout = 30000) => {
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
};

// export const makeBrowserScreenshot = async (url: string, collapseElementLabel: string): Promise<string> => {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();

//   // Increase viewport size for higher resolution
// 	const width = 1200;
// 	const height = 900;

// 	// const width = 1920;
// 	// const height = 1080;

//   await page.setViewport({
//     width,
//     height,
//     deviceScaleFactor: 2
//   });

//   await page.goto(url, {'timeout': 60000, 'waitUntil':'load'});
// 	await waitTillHTMLRendered(page)
// 	await page.evaluate((name) => {
//     const collapseElements = [...document.querySelectorAll('*')]
//         .filter(el => {
// 					return el.textContent?.trim().toLowerCase() === name.toLowerCase() && !(el as HTMLElement).hasAttribute('href');
// 				});
    
//     collapseElements.forEach(element => {
//       console.log('element', element);
//         (element as HTMLElement).click();
//     });
// }, collapseElementLabel);
// 		console.log('rendered')
//   // Capture full viewport
//   await sleep(1000);
//   const screenshot = await page.screenshot({
//     fullPage: false,
// 		omitBackground: true,
//     path: `demo.png`,
//     clip: {
//       x: 0,
//       y: 0,
//       width,
//       height: 1.5 * height,
//     },
//   });

//   // await browser.close();

//   // Save screenshot to a temporary file
//   const tempFilePath = `/tmp/${Date.now()}.png`;
//   await promisify(fs.writeFile)(tempFilePath, screenshot);

//   // Upload the file to S3
//   const bucketName = process.env.S3_BUCKET_NAME || 'testbucketzizo';
//   const key = `screenshots/${Date.now()}.png`;
//   const s3Url = await uploadFileToS3(tempFilePath, bucketName, key);

//   // Delete the temporary file
//   await promisify(fs.unlink)(tempFilePath);

//   return s3Url;
// }

export const makeBrowserScreenshot = async (url: string, callback?: (page: Page) => void): Promise<string> => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Increase viewport size for higher resolution
	const width = 1200;
	const height = 900;

	// const width = 1920;
	// const height = 1080;

  await page.setViewport({
    width,
    height,
    deviceScaleFactor: 1
  });

  try {
    await page.goto(url, {'timeout': 60000, 'waitUntil':'load'});
  } catch (error) {
    console.error(`Failed to load page: ${error}`);
    // throw error;
  }
	await waitTillHTMLRendered(page)
  if (callback) {
    await callback(page);
  }
  await sleep(3000); // to be sure that all collapsed elements are opened
  //Capture full viewport
  const screenshot = await page.screenshot({
    fullPage: false,
		omitBackground: true,
    path: `demo.png`,
    clip: {
      x: 0,
      y: 0,
      width,
      height: 1.25 * height,
    },
  });

  await browser.close();

  // Save screenshot to a temporary file
  const tempFilePath = `/tmp/${Date.now()}.png`;
  await promisify(fs.writeFile)(tempFilePath, screenshot);

  // Upload the file to S3
  const bucketName = process.env.S3_BUCKET_NAME || 'testbucketzizo';
  const key = `screenshots/${Date.now()}.png`;
  const s3Url = await uploadFileToS3(tempFilePath, bucketName, key);

  // Delete the temporary file
  await promisify(fs.unlink)(tempFilePath);

  return s3Url;
  // return 'done';
}

export default makeBrowserScreenshot;
