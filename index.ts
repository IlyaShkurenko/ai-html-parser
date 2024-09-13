import { PriceFinder } from './findPrices';
import dotenv from 'dotenv';

dotenv.config();

const priceFinder = new PriceFinder(process.env.OPENAI_API_KEY as string, "https://cidk.ru/czeny/");
priceFinder.main().then(console.log).catch(console.error);