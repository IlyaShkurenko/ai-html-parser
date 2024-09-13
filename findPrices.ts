import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import makeBrowserScreenshot, { BrowserScreenshotMaker } from './utils/makeBrowserScreenshot';
import { buildFindPricesPrompt, buildIdentifyCollapsedElementsPrompt, generateWebsiteDescriptionPrompt, reactAgentPrompt } from './prompts';

type CollapsedElement = {
  label: string;
  children: CollapsedElement[];
};

export class PriceFinder {
  private openai: OpenAI;
  private screenshot: string | null = null;
  private websiteDescription: string | null = null;
  private url: string;
  private collapsedElements: CollapsedElement[] = [];
  private currentCollapsedBranch: CollapsedElement;
  private browserScreenshotMaker: BrowserScreenshotMaker;

  constructor(apiKey: string, url: string) {
    this.openai = new OpenAI({ apiKey });
    this.url = url;
    this.browserScreenshotMaker = new BrowserScreenshotMaker();
  }

  private ReasoningSchema = z.object({
    thought: z.string(),
    action: z.object({
      name: z.string(),
      input: z.string().optional()
    }),
  });

  private CollapsedElementsSchema = z.object({
    label: z.string(),
    children: z.lazy(() => z.array(this.CollapsedElementsSchema))
  });
  
  private functionsMap = {
    find_prices: async () => await this.findPrices(),
    find_collapsed_elements: async () => await this.findCollapsedElements(),
    expand_collapsed_elements: async (elementToCollapse: string) => await this.expandCollapsedElements(elementToCollapse),
    done: async (result: any) => await this.done(result)
  };

  private async generateWebsiteDescription() {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: generateWebsiteDescriptionPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: this.screenshot as string,
                detail: "high"
              },
            },
          ],
        },
      ],
    });
    return response.choices[0].message.content;
  }

  private async findPrices() {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: buildFindPricesPrompt(this.websiteDescription as string) },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: this.screenshot as string,
                detail: "high"
              },
            },
          ],
        },
      ],
    });
    return response.choices[0].message.content;
  }

  private async findCollapsedElements() {
    const prompt = buildIdentifyCollapsedElementsPrompt(this.websiteDescription as string, this.collapsedElements, this.currentCollapsedBranch);
    console.log(this.currentCollapsedBranch)
    console.log(prompt);
    console.log(this.screenshot)
    const response = await this.openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: this.screenshot as string,
                detail: "high"
              },
            },
          ],
        },
      ],
      response_format: zodResponseFormat(this.CollapsedElementsSchema, "collapsed_elements"),
    });

    const newElement = response.choices[0].message.parsed;
    
    const existingIndex = this.collapsedElements.findIndex(el => el.label === newElement.label);
    this.currentCollapsedBranch = newElement as CollapsedElement;
    if (existingIndex !== -1) {
      this.collapsedElements[existingIndex] = newElement as CollapsedElement;
    } else {
      this.collapsedElements.push(newElement as CollapsedElement);
    }

    return JSON.stringify(newElement, null, 2);
  }

  // private async expandCollapsedElements(labels: string[]) {
  //   this.screenshot = await makeBrowserScreenshot(this.url, async (page) => {
  //     await page.evaluate((name) => {
  //       const collapseElements = [...document.querySelectorAll('*')]
  //         .filter(el => {
  //           return el.textContent?.trim().toLowerCase() === name.toLowerCase();
  //         });
      
  //     collapseElements.forEach(element => {
  //         (element as HTMLElement).click();
  //       });
  //     }, labels[0]);
  //   });
  //   return this.screenshot;
  // }

  private async expandCollapsedElements(elementToCollapseStr: string) {
    let elementToCollapse: CollapsedElement;
    if (typeof elementToCollapseStr === 'string') {
      try {
        elementToCollapse = JSON.parse(elementToCollapseStr);
      } catch (error) {
        console.error('Failed to parse elementToCollapseStr:', error);
        elementToCollapse = { label: elementToCollapseStr, children: [] };
      }
    } else {
      elementToCollapse = elementToCollapseStr;
    }
    console.log(elementToCollapse.label);
    this.screenshot = await this.browserScreenshotMaker.makeScreenshot(this.url, async (page) => {
      await page.evaluate((element) => {
        console.log('label', element.label);
        function expandElement(el: { label: string; children: any[] }) {
          const collapseElements = [...document.querySelectorAll('*')]
            .filter(domEl => {
              const hasHref = (domEl as HTMLElement).hasAttribute('href');
              const hrefValue = (domEl as HTMLElement).getAttribute('href');
              const matchesText = domEl.textContent?.trim().toLowerCase() === el.label.toLowerCase();
              return matchesText && (!hasHref || (hasHref && hrefValue === ''));
            });
    
          collapseElements.forEach(domEl => {
            (domEl as HTMLElement).click();
            console.log(`Clicked element: ${el.label}`);
          });
    
          el.children.forEach(child => expandElement(child));
        }
    
        function addElementObserver(el: Element) {
          const observer = new MutationObserver(() => {
            if (isElementVisible(el)) {
              console.log('Hidden element became visible:', el);
            } else {
              console.log('Visible element became hidden:', el);
              (el as HTMLElement).style.display = 'block';
              (el as HTMLElement).style.visibility = 'visible';
              (el as HTMLElement).style.opacity = '1';
            }
          });
        
          observer.observe(el as HTMLElement, {
            attributes: true,
            attributeOldValue: true,
            attributeFilter: ['style', 'class']
          });
        
          return observer;
        }
    
        function isElementVisible(el: Element): boolean {
          const style = window.getComputedStyle(el as HTMLElement);
          return style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 style.opacity !== '0';
        }
    
        [...document.querySelectorAll('*')].forEach(el => {
          if (!isElementVisible(el)) {
            (el as any)._observer = addElementObserver(el);
          }
        });
    
        expandElement(element);
      }, elementToCollapse);
    });
    return this.screenshot;
  }

  private async done(result: any) {
    console.log(result);
  }

  private async runAgent(history: { thought: string, observation: string, action: string, input: string[] }[]): Promise<z.infer<typeof this.ReasoningSchema>> {

    let userPrompt = `Question: Find up to 3 services with prices on website\n`;

    history.forEach(entry => {
      userPrompt += `
      Thought: ${entry.thought}.\n
      Action: ${entry.action}.\n
      Action Input: ${entry.input}.\n
      Observation: ${entry.observation}.\n`;
    });

    userPrompt += `Thought: \n`;

    const response = await this.openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: reactAgentPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: zodResponseFormat(this.ReasoningSchema, "reasoning_action"),
    });

    return response.choices[0].message.parsed as z.infer<typeof this.ReasoningSchema>;
  }

  public async main() {
    this.screenshot = await this.browserScreenshotMaker.makeScreenshot(this.url);
    this.websiteDescription = await this.generateWebsiteDescription();
    let continueLoop = true;
    let result;
    let agentResponse;
    let history: { thought: string, observation: string, action: string, input: string[] }[] = [];

    while (continueLoop) {
      agentResponse = await this.runAgent(history);
      const { action, thought } = agentResponse;

      if (action && action.name === 'done') {
        continueLoop = false;
        this.done(agentResponse);
      } else if (action && this.functionsMap[action.name]) {
        result = await this.functionsMap[action.name](action.input);
        history.push({
          thought: thought,
          observation: result,
          action: action.name,
          input: action.input
        });
      } else {
        console.error("Unknown action or missing action name in agentResponse:", agentResponse);
        continueLoop = false;
      }
    }
  }
}