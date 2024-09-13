type CollapsedElement = {
  label: string;
  children: CollapsedElement[];
};

const generateWebsiteDescriptionPrompt = `You are an AI model tasked with generating a brief description of a website based on its screenshot. Your task is to:

1. **Analyze the Screenshot**: Carefully examine the screenshot of website pricing page to understand the primary focus of what it's selling.
2. **Identify Key Elements**: Identify the main products, services being presented on the page. Pay attention to any prominent headings, banners, or highlighted sections that indicate the purpose of the site.
3. **Generate a Description**: Write 2-3 sentences that describe the website's main purpose, the type of products or services it offers, and any notable features. Ensure that the description is concise and accurately reflects what is visible on the screenshot.`

const findPricesPrompt = `You are an AI model tasked with identifying up to three services with their prices from a website screenshot. Your task is as follows:

1. **Scan the Screenshot**: Carefully analyze the screenshot for any visible price values. These prices could be in any common format, such as "$100", "100 USD", "£75", '2500 RUB'etc.
2. **Identify Services**: Identify and list up to three services that are associated with these prices. Ensure that the services are clearly defined and located near the price values.
3. **Return the Information**: If you find services with prices, return a list of the service names along with their associated prices. If service includes duration then concatenate it to the service name same as it's displayed on the page.
4. **No Prices Detected**: If no visible prices are found on the screenshot check if there are collapsed items that might hide the prices and if yes then return a message: "No prices are visible. The prices may be hidden under collapsed elements."

### Note:
Do not invent or assume any information not present in the screenshot.
`

const identifyCollapsedElementsPrompt = `You are an AI model tasked with identifying up to 3 collapsed elements from a website screenshot. Your task is as follows:

1. **Scan the Screenshot**: Analyze the screenshot for any elements that are collapsed or require interaction (such as clicking) to reveal additional content. These elements are likely related to categories of services or products.
2. **Focus on Service Categories**: Focus on collapsed elements that are likely to contain service categories. Do not consider sidebars, navigation blocks, or footers.
3. **Determine Visibility of Prices**: If numerical prices are visible on the screenshot, do **not** return any collapsed elements. This indicates that the prices are already visible.
4. **Return the Labels**: Identify and return up to three labels of these collapsed elements, exactly as they appear on the screenshot.
5. **Prices are visible**: If prices are visible on the screenshot, return a message: "Prices are visible. No collapsed elements detected."

### Note:
It is very important that you do not hallucinate or add any text that is not present on the screenshot. The collapsed elements labels must be an exact match to what is on the page, with no modifications. Do not add counters or numbers to the labels like 1,2,3 if they are not present on the page. Do not invent or assume any information not present in the screenshot.

### EXAMPLE OUTPUT:
{ 
  labels: ['Процедурный кабинет', 'Анализы и диагностика', 'Хирургия']
}
`

const reactAgentPrompt = `You are an AI agent tasked with finding pricing information on a website. You have access to the following actions:

find_prices(): Analyze the screenshot and identify up to 3 services with their corresponding prices.

find_collapsed_elements(): Examine the screenshot and identify up to 3 collapsed elements that are likely to contain pricing information when expanded.

expand_collapsed_elements({ label: 'Процедурный кабинет', children: [] }): Expand the collapsed elements and return new screenshot which might contain prices. Takes as argument response from find_collapsed_elements().

done(result: any): Returns the final result of the agent.

Use the following format:

Question: [The input question you must answer]
Thought: [Your reasoning about what to do next]
Action: [The action to take (find_prices, find_collapsed_elements etc)]
Action Input: [The input for the action. Empty if is not required]
Observation: [The result of the action]
... (This Thought/Action/Action Input/Observation can repeat as needed)
Thought: [Your final reasoning]
Final Answer: [Your final answer to the original question]`

const buildFindPricesPrompt = (websiteDescription: string) => {
  return `You are an AI model tasked with identifying up to three services with their prices from a website screenshot. Your task is as follows:

1. **Scan the Screenshot**: Carefully analyze the screenshot for any visible price values. These prices could be in any common format, such as "$100", "100 USD", "£75", '2500 RUB'etc.
2. **Identify Services**: Identify and list up to three services that are associated with these prices. Ensure that the services are clearly defined and located near the price values.
3. **Return the Information**: If you find services with prices, return a list of the service names along with their associated prices. If service includes duration then concatenate it to the service name same as it's displayed on the page.
4. **No Prices Detected**: If no visible prices are found on the screenshot check if there are collapsed items that might hide the prices and if yes then return a message: "No prices are visible. The prices may be hidden under collapsed elements."

<website_description>
${websiteDescription}
</website_description>

### Note:
Do not invent or assume any information not present in the screenshot.`
}

const buildIdentifyCollapsedElementsPrompt = (websiteDescription: string, previousCollapsedElements: CollapsedElement[], currentCollapsedBranch?: CollapsedElement) => {
  return `You are an AI model tasked with identifying one collapsed element from a website screenshot. Your task is as follows:

1. **Scan the Screenshot**: Analyze the screenshot for any collapsed element that requires interaction (such as clicking) to reveal additional content. These elements are typically related to categories of services or products. Do not consider sidebars, navigation blocks, or footers.
2. **Focus on Sub-Categories**: If a collapsed element is already expanded but contains sub-categories that are still collapsed, return the whole tree with the first collapsed sub-category you find. This should be done regardless of how deep the nesting goes.
3. **Return the Tree**: Identify and return the tree of collapsed elements, exactly as it appears on the screenshot including category it's sub-categories with only one children on each level.
4. **Check Current Collapsed Branch**: If <current_collapsed_branch> is provided, examine the screenshot to see if this element is expanded. If it is expanded and no prices are visible, consider any tables, lists, or rows within it as potential collapsed elements. Return the first collapsed sub-category found within this branch, regardless of depth.

<website_description>
${websiteDescription}
</website_description>

${previousCollapsedElements.length > 0 ? `<already_detected_collapsed_elements>\n${previousCollapsedElements.map(element => getCollapsedElementPath(element)).join('\n')}\n</already_detected_collapsed_elements>` : ''}

### Note:
It is crucial that you do not invent or add any text that is not present on the screenshot. The label of the collapsed element must be an exact match to what is on the page, with no modifications. Do not include counters or numbers in the label unless they are explicitly present in the screenshot.

### EXAMPLE OUTPUT:
<screenshot_structure>
- Процедурный кабинет
</screenshot_structure>
{ 
  label: 'Процедурный кабинет',
  children: []
}

### EXAMPLE OUTPUT WITH SUB-CATEGORIES:
<screenshot_structure>
→ Процедурный кабинет
  → Анализы и диагностика
    → Биохимический анализ крови
</screenshot_structure>
<current_collapsed_branch>
Процедурный кабинет -> Анализы и диагностика
</current_collapsed_branch>
{ 
  label: 'Процедурный кабинет',
  children: [{
    label: 'Анализы и диагностика',
    children: [{
      label: 'Биохимический анализ крови',
      children: []
    }]
  }]
}

${currentCollapsedBranch ? `<current_collapsed_branch>\n${getCollapsedElementPath(currentCollapsedBranch)}\n</current_collapsed_branch>` : ''}
`
}

function getCollapsedElementPath(element: CollapsedElement): string {
  let path = element.label;
  let current = element;
  while (current.children.length > 0) {
    current = current.children[0];
    path += ` -> ${current.label}`;
  }
  return `${path}.`;
}


export { generateWebsiteDescriptionPrompt, findPricesPrompt, identifyCollapsedElementsPrompt, reactAgentPrompt, buildFindPricesPrompt, buildIdentifyCollapsedElementsPrompt };
