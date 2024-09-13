import { OpenAI } from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import makeBrowserScreenshot from './utils/makeBrowserScreenshot';
import dotenv from 'dotenv';
import { buildIdentifyCollapsedElementsPrompt } from './prompts';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the schema for the structured output
const PricingIdentifiers = z.object({
  reasoning: z.string(),
  mainPricingIdentifier: z.string(),
  collapsedIdentifiers: z.array(z.string()).optional(),
});

const TitleIdentifier = z.object({
  title: z.string(),
  pageStructure: z.string(),
	// collapsedIdentifiers: z.array(z.string()).optional(),
	firstCollapsedElementTitle: z.string().optional(),
});

const prompt1 = `You are an AI model designed to analyze web page screenshots and identify specific UI elements based on visual and textual clues. In this task, you need to identify elements that could correspond to sections or blocks related to "Prices" on a web page.

        ### Instructions:
        1. Analyze the provided image and focus on identifying any blocks or sections that are likely used for handling or displaying pricing information.
        2. Key indicators of a "Prices" block may include:
          - Prominent headings or titles that could indicate pricing, such as words meaning "Prices" in various languages.
          - Expandable sections, dropdowns, or lists that categorize different services or products.
          - Blocks of text, tables, or lists that could logically contain pricing information.
        3. Identify the main pricing identifier and any expandable identifiers related to pricing.
        4. Output the results in a structured format as specified.

        ### Output:
        Provide a summary of identified elements, focusing on those related to price displays, in the specified JSON format.`

const prompt2 = `You are an AI model designed to analyze web page screenshots to identify elements related to prices. Your task is to:

1. Identify any sections, blocks, or elements that are likely associated with displaying prices. This includes actual price values, expandable elements, or categories that organize pricing information.
2. Find a textual or visual element that is most likely the heading or identifier for this price-related block. This could be a title, label, or any other text that serves as a key identifier.

### Output:
- Provide the identified price-related element and it's corresponding text or heading that could be used to locate these section in code.
- If there are any expandable elements related to prices, list the text of those expandable elements.
`

const prompt5 = `You are an AI model designed to analyze web page screenshots to identify elements related to prices. Your task is to:

1. Identify any sections, blocks, or elements that are likely associated with displaying prices. This includes actual price values, collapsed elements, or categories that organize pricing information.
2. Focus on identifying **collapsed elements** that are specifically related to categories of services. These elements should require user interaction to expand or reveal additional content, such as clicking or tapping.
3. If you detect visible numerical prices on the page, do **not** return a collapsedIdentifiers list, as this indicates that there are no collapsed elements related to service categories.
4. When identifying the main price-related element, use the exact text or visual elements as they appear on the page. Do **not** invent or alter any words.
5. Before providing the final output, include a reasoning section where you explain why you selected each element. Justify your choices based on the content of the page.
`

const prompt6 = `You are an AI model designed to analyze web page screenshots to identify elements related to prices. Your task is to:

1. Identify any sections, blocks, or elements that are likely associated with displaying prices. This includes actual price values, collapsed elements, or categories that organize pricing information.
2. Focus on identifying **collapsed elements** that are specifically related to categories of services. These elements should require user interaction to expand or reveal additional content, such as clicking or tapping.
3. If you detect visible numerical prices on the page, do **not** return a collapsedIdentifiers list, as this indicates that there are no collapsed elements related to service categories.
4. When identifying the main price-related element (mainPricingIdentifier), use the exact text or visual elements as they appear on the page. Do **not** invent or alter any words. The mainPricingIdentifier should be the closest heading, label, or text element that logically indicates the presence of prices below it. This could be a title related to prices, a product name, or any other relevant label.
5. Before providing the final output, include a reasoning section where you explain your chain of thought:
   - Describe how you identified the block with prices.
   - Explain how you found the nearest heading or label.
   - Justify why this heading or label is relevant and suitable to be used as the mainPricingIdentifier.
`

const prompt7 = `You are an AI model designed to analyze web page screenshots to identify elements related to prices. Your task is to:

### Instructions:
1. Identify any sections, blocks, or elements that are likely associated with displaying prices. This includes actual price values, collapsed elements, or categories that organize pricing information.
2. Focus on identifying **collapsed elements** that are specifically related to categories of services. These elements should require user interaction to expand or reveal additional content, such as clicking or tapping.
3. If you detect visible numerical prices on the page, do **not** return a collapsedIdentifiers list, as this indicates that there are no collapsed elements related to service categories.
4. When identifying the main price-related element (mainPricingIdentifier), use the exact text or visual elements as they appear on the page. Do **not** invent or alter any words. The mainPricingIdentifier should be the closest heading, label, or text element that logically indicates the presence of prices below it. This could be a title related to prices, a product name, or any other relevant label.

### Reasoning:
1. **Determine the Website's Purpose**: Begin by analyzing the context of the page to understand the purpose of the website (e.g., e-commerce, informational, service-oriented). This will help in identifying where pricing information is likely to be displayed.
2. **Locate the Pricing Block or Collapsed Elements**: Identify the section or block that contains visible prices or collapsed elements that may organize pricing information by category.
3. **Find the Nearest Heading**: Search for the closest heading, label, or text element near the identified pricing block that could logically serve as a mainPricingIdentifier.
4. **Verify the Heading**: Ensure that the selected heading or label exists on the page as it is and has not been invented or altered. This step confirms that the identifier is valid and reflective of the page's content.
5. **Return Results**: Provide the mainPricingIdentifier along with a list of any collapsedIdentifiers. If no collapsed elements are found, return an empty collapsedIdentifiers list.

### Output:
- Include a reasoning section that details your step-by-step thought process, including the verification step for the heading. It must be before you process mainPricingIdentifier and collapsedIdentifiers
- Provide the identified price-related element and its corresponding text or heading that could be used to locate this section in code as the mainPricingIdentifier. Remember Do not invent or alter any words, use the exact text as it is on the page.
- List the text of any collapsed elements specifically related to service categories under collapsedIdentifiers. Remember If you detect visible numerical prices on the page, do **not** return a collapsedIdentifiers list`

const prompt8 = `You are analyzing a screenshot of a webpage that displays prices. This page can belong to any type of website. Your task is to:

1. Identify the main block related to prices. This could include:
   - Price cards or listings
   - Text lists of prices for services/products
   - Collapsed lists where prices are hidden but service/product categories are shown
2. Find the closest heading or title related to this price block. This title should be:
   - The main title on the page, not just a list heading or breadcrumb
   - It should stand out by its text size or prominence on the page
   - It could be a term like "Prices," its synonyms in various languages, or a product/service category name
   - The title must be exactly as it appears on the screenshot. No alterations, additions, or changes in case are allowed.
3. Before returning the result, verify that the title matches exactly what is on the site.
4. Return the title in a field called "title". If no suitable title is found, return "Not defined".
`

const prompt9 = `You are analyzing a screenshot of a webpage that displays prices. This page can belong to any type of website. Your task is to find a main title on the page and return it as it is exactly on screenshot without any modifications. Before your response provide step by step reasoning on which title you chose and why`

const prompt10 = `You are an AI model designed to analyze web page screenshots to identify elements related to prices. Your task is to:

1. Identify any sections, blocks, or elements that are likely associated with displaying prices. This includes actual price values, collapsed elements, or categories that organize pricing information.
2. Focus on identifying **collapsed elements** that are specifically related to categories of services. These elements should require user interaction to expand or reveal additional content, such as clicking or tapping.
3. If you detect visible numerical prices on the page, do **not** return a collapsedIdentifiers list, as this indicates that there are no collapsed elements related to service categories.
4. When identifying the main price-related element, use the exact text or visual elements as they appear on the page. Do **not** invent or alter any words. It is crucial that you select text exactly as it appears because I will be performing a string-based search later.
5. Before providing the final output, include a brief description of the page structure, highlighting the main elements and why you selected the specific title or heading. Clearly explain the reasoning behind your choice of the main price-related element.

### Note:
It is very important that you do not hallucinate or add any text that is not present on the screenshot. The title and collapsedIdentifiers must be an exact match to what is on the page, with no modifications. It's very important for user`

const prompt11 = `You are an AI model designed to analyze web page screenshots to identify elements related to prices. Your task is to:

1. Identify any sections, blocks, or elements that are likely associated with displaying prices. This includes actual price values, collapsed elements, or categories that organize pricing information.
2. Focus on identifying **collapsed elements** that are specifically related to categories of services. These elements should require user interaction to expand or reveal additional content, such as clicking or tapping. It cannot be sidebars, navigation, footer etc.
3. If you detect visible numerical prices on the page, do **not** return a firstCollapsedElementTitle, as this indicates that there are no collapsed elements related to service categories.
4. When identifying the main price-related element, use the exact text or visual elements as they appear on the page. Do **not** invent or alter any words. It is crucial that you select text exactly as it appears because I will be performing a string-based search later.
5. Before providing the final output, include a brief description of the page structure, highlighting the main elements and why you selected the specific title and firstCollapsedElementTitle. Clearly explain the reasoning behind your choice.

### Note:
It is very important that you do not hallucinate or add any text that is not present on the screenshot. The title and firstCollapsedElementTitle must be an exact match to what is on the page, with no modifications. Also remember to not consider firstCollapsedElementTitle if you recognized prices on the page. It's very important for me.
`

const explainImageParsed = async (imageUrl: string): Promise<z.infer<typeof TitleIdentifier> | null> => {
  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "system",
        content: prompt11
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high"
            },
          },
        ],
      },
    ],
    response_format: zodResponseFormat(TitleIdentifier, "title_identifier"),
  });
  return completion.choices[0].message.parsed;
};

// Альтернативный вариант без structured outputs
const explainImageAlternative = async (imageUrl: string): Promise<any> => {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: prompt7
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high"
            },
          },
        ],
      },
    ],
  });
  
  return completion.choices[0].message.content;
};

const images1 = ['https://testbucketzizo.s3.amazonaws.com/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA+%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0+2024-09-07+%D0%B2+13.04.38.png', 'https://testbucketzizo.s3.amazonaws.com/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA+%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0+2024-09-07+%D0%B2+12.40.36.png', 'https://testbucketzizo.s3.amazonaws.com/%D0%A1%D0%BD%D0%B8%D0%BC%D0%BE%D0%BA+%D1%8D%D0%BA%D1%80%D0%B0%D0%BD%D0%B0+2024-09-07+%D0%B2+13.04.59.png']

const images2 = ['https://testbucketzizo.s3.amazonaws.com/cosmetologmoscow.ru_price_.png', 'https://testbucketzizo.s3.amazonaws.com/www.sm-estetica.ru_about_price-list_.png', 'https://testbucketzizo.s3.amazonaws.com/rozetka.com.ua_notebooks_c80004_producer%3Dapple_+(1).png', 'https://testbucketzizo.s3.amazonaws.com/cosmetomed.ru_prices.png', 'https://testbucketzizo.s3.amazonaws.com/gen87.ru_price_.png'];

// ['https://testbucketzizo.s3.amazonaws.com/screenshots/1725743722917.png'].forEach(url => 
//   explainImageParsed(url)
//     .then(response => console.log({ ...response, imageUrl: url }))
//     .catch(console.error)
// );


// makeBrowserScreenshot('https://www.sm-estetica.ru/about/price-list/').then(console.log);

// makeBrowserScreenshot('https://gen87.ru/price/', 
// 'КОНСУЛЬТАЦИОННЫЙ ПРИЕМ').then(console.log);

// await makeBrowserScreenshot('https://cidk.ru/czeny/', async (page) => {
//   await page.evaluate((name) => {
//     const openedElements = new Set<Element>();
//     const hiddenElements = new Set<Element>();
//     const collapseElements: Element[] = [];
//     [...document.querySelectorAll('*')].forEach(el => {
//       const hasHref = (el as HTMLElement).hasAttribute('href');
//       const hrefValue = (el as HTMLElement).getAttribute('href');
//       const matchesText = el.textContent?.trim().toLowerCase() === name.toLowerCase();
//       const isValidElement = matchesText && (!hasHref || (hasHref && hrefValue === ''));
    
//       if (isValidElement) {
//         // console.log('el', el);
//         // console.log('el.parentElement', el.parentElement);
//         // if (hasHref || (!collapseElements.includes(el.parentElement) && !collapseElements.includes(el))) {
//         //   collapseElements.push(el);
//         // }
//         collapseElements.push(el);
//       }

//       if(!isElementVisible(el)) {
//         hiddenElements.add(el);
//       }
//     });

//     function isElementVisible(el: Element): boolean {
//       const style = window.getComputedStyle(el as HTMLElement);
//       return style.display !== 'none' && 
//              style.visibility !== 'hidden' && 
//              style.opacity !== '0';
//     }

//     function findChangedElements(): Element[] {
//       return [...document.body.querySelectorAll('*')].filter(el => {
//         const wasHidden = hiddenElements.has(el);
//         const isVisible = isElementVisible(el);
//         return wasHidden !== !isVisible;
//       });
//     }

//     collapseElements.slice(0, 2).forEach(element => {
//       (element as HTMLElement).addEventListener('click', (event) => {
//         const changedElements = findChangedElements();
//         console.log('Debugging element:', element);
//         console.log('changedElements', changedElements);
//         if(changedElements.length) {
//           changedElements.forEach(el => {
//             if (isElementVisible(el)) {
//               if (hiddenElements.has(el)) {
//               hiddenElements.delete(el);
//               openedElements.add(el);
//               console.log('Element opened:', el);
//               // const originalState = {
//               //   style: (el as HTMLElement).getAttribute('style'),
//               //   class: el.getAttribute('class')
//               // };
//               // (el as any)._originalState = originalState;
      
//               // const observer = new MutationObserver((mutations) => {
//               //   mutations.forEach((mutation) => {
//               //     if (mutation.type === 'attributes' && 
//               //        (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
//               //       const target = mutation.target as HTMLElement;
//               //       if (!isElementVisible(target)) {
//               //         console.log('Preventing element from closing:', target);
//               //         const originalState = (target as any)._originalState;
//               //         if (originalState.style) {
//               //           target.setAttribute('style', originalState.style);
//               //         } else {
//               //           target.removeAttribute('style');
//               //         }
//               //         if (originalState.class) {
//               //           target.setAttribute('class', originalState.class);
//               //         } else {
//               //           target.removeAttribute('class');
//               //         }
//               //       }
//               //     }
//               //   });
//               // });
//               // observer.observe(el as HTMLElement, {
//               //   attributes: true,
//               //   attributeFilter: ['style', 'class']
//               // });
      
//               // (el as any)._stateObserver = observer;
//             }
//           }
//         });
//       }
//       setTimeout(() => {
//         if(openedElements.size) {
//           console.log('openedElements', openedElements);
//           openedElements.forEach(el => {
//             console.log(isElementVisible(el));
//             if (!isElementVisible(el)) {
//               console.log('visible', el)
//               event.preventDefault();
//               event.stopPropagation();
//               console.log('Preventing element from closing:', el);
//               // (el as HTMLElement).style.display = 'block';
//               // (el as HTMLElement).style.visibility = 'visible';
//               // (el as HTMLElement).style.opacity = '1';
//             }
//           });
//         }
//       }, 2000)
//     });
//   });

//     collapseElements.slice(0, 2).forEach(element => {
//       // console.log('element',element);
//       (element as HTMLElement).click();
//     });
//   }, 'Консультации');
// });

// await makeBrowserScreenshot('https://cidk.ru/czeny/', 'Консультации');

// await makeBrowserScreenshot('https://cidk.ru/czeny/', async (page) => {
//   await page.evaluate((name) => {
//     const openedElements = new Set<Element>();
//     const hiddenElements = new Set<Element>();
//     const collapseElements: Element[] = [];
//     [...document.querySelectorAll('*')].forEach(el => {
//       const hasHref = (el as HTMLElement).hasAttribute('href');
//       const hrefValue = (el as HTMLElement).getAttribute('href');
//       const matchesText = el.textContent?.trim().toLowerCase() === name.toLowerCase();
//       const isValidElement = matchesText && (!hasHref || (hasHref && hrefValue === ''));
    
//       if (isValidElement) {
//         collapseElements.push(el);
//       }

//       if(!isElementVisible(el)) {
//         hiddenElements.add(el);
//         (el as any)._observer = addElementObserver(el);
//       }
//     });

//     function addElementObserver(el: Element) {
//       const observer = new MutationObserver(() => {
//         if (isElementVisible(el)) {
//           if (hiddenElements.has(el)) {
//             const elCopy = el.cloneNode(true) as HTMLElement;
//             console.log('Hidden element became visible:', elCopy);
//             hiddenElements.delete(el);
//             openedElements.add(el);
//           }
//         } else {
//           if (openedElements.has(el)) {
//             const elCopy = el.cloneNode(true) as HTMLElement;
//             console.log('Visible element became hidden:', elCopy);
//             (el as HTMLElement).style.display = 'block';
//             (el as HTMLElement).style.visibility = 'visible';
//             (el as HTMLElement).style.opacity = '1';
//             openedElements.delete(el);
//             hiddenElements.add(el);
//           }
//         }
//       });
    
//       observer.observe(el as HTMLElement, {
//         attributes: true,
//         attributeOldValue: true,
//         attributeFilter: ['style', 'class']
//       });
    
//       return observer;
//     }

//     function isElementVisible(el: Element): boolean {
//       const style = window.getComputedStyle(el as HTMLElement);
//       return style.display !== 'none' && 
//              style.visibility !== 'hidden' && 
//              style.opacity !== '0';
//     }

//     collapseElements.forEach(element => {
//       // console.log('element',element);
//       (element as HTMLElement).click();
//     });
//   }, 'Консультации');
// });

// await makeBrowserScreenshot('https://cidk.ru/czeny/', async (page) => {
//   await page.evaluate((element) => {
//     function expandElement(el: { label: string; children: any[] }) {
//       const collapseElements = [...document.querySelectorAll('*')]
//         .filter(domEl => {
//           const hasHref = (domEl as HTMLElement).hasAttribute('href');
//           const hrefValue = (domEl as HTMLElement).getAttribute('href');
//           const matchesText = domEl.textContent?.trim().toLowerCase() === el.label.toLowerCase();
//           return matchesText && (!hasHref || (hasHref && hrefValue === ''));
//         });

//       collapseElements.forEach(domEl => {
//         (domEl as HTMLElement).click();
//         console.log(`Clicked element: ${el.label}`);
//       });

//       // Рекурсивно обрабатываем дочерние элементы
//       el.children.forEach(child => expandElement(child));
//     }

//     function addElementObserver(el: Element) {
//       const observer = new MutationObserver(() => {
//         if (isElementVisible(el)) {
//           console.log('Hidden element became visible:', el);
//         } else {
//           console.log('Visible element became hidden:', el);
//           (el as HTMLElement).style.display = 'block';
//           (el as HTMLElement).style.visibility = 'visible';
//           (el as HTMLElement).style.opacity = '1';
//         }
//       });
    
//       observer.observe(el as HTMLElement, {
//         attributes: true,
//         attributeOldValue: true,
//         attributeFilter: ['style', 'class']
//       });
    
//       return observer;
//     }

//     function isElementVisible(el: Element): boolean {
//       const style = window.getComputedStyle(el as HTMLElement);
//       return style.display !== 'none' && 
//              style.visibility !== 'hidden' && 
//              style.opacity !== '0';
//     }

//     // Добавляем наблюдатели для всех элементов
//     [...document.querySelectorAll('*')].forEach(el => {
//       if (!isElementVisible(el)) {
//         (el as any)._observer = addElementObserver(el);
//       }
//     });

//     // Начинаем раскрытие с корневого элемента
//     expandElement(element);
//   }, {
//     label: 'Консультации',
//     children: [{
//       label: 'Консультации',
//       children: [{
//         label: 'Онлайн консультации',
//         children: []
//       }]
//     }]
//   });
// });

console.log(buildIdentifyCollapsedElementsPrompt(
  'Центр инновационных диагностических технологий',
  [{
    label: 'Процедурный кабинет',
    children: [{
      label: 'Анализы и диагностика',
      children: [{
        label: 'Биохимический анализ крови',
        children: []
      }]
    }]
  },
  {
    label: 'Терапия',
    children: [{
      label: 'Консультации и диагностика',
      children: []
    }]
  }
]));